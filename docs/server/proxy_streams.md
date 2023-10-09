---
id: proxy_streams
sidebar_label: Proxy subscription streams
title: Proxy subscription streams
draft: true
---

:::caution Experimental

This is an experimental extension of Centrifugo [proxy](./proxy.md). We appreciate your feedback to make sure it's useful and solves real-world problems before marking it as stable and commit to the API.

:::

Proxy subscription streams allow pushing data towards client channel subscription directly and individually from your application backend over the unidirectional [GRPC](https://grpc.io/) stream. Additionally, bidirectional GRPC streams may be utilized to stream data in both directions.

The stream is established between Centrifugo and your application backend as soon as user subscribes to a channel. Subscription streams may be useful if you want to generate individual streams and these streams should only work for a time while client is subscribed to a channel.

In this case Centrifugo plays a role of WebSocket-to-GRPC streaming proxy – keeping numerous real-time connections from your application's clients and establishing GRPC streams to the backend, multiplexing them using a pool of HTTP/2 (transport used by GRPC) connections:

![](/img/on_demand_stream_connections.png)

Our bidirectional WebSocket fallbacks (HTTP-streaming and SSE) and experimental WebTransport work with proxy subscription streams too. So it's possible to say that Centrifugo may be also Webtransport-to-GRPC proxy or SSE-to-GRPC proxy.

### Scalability concerns

Using proxy subscription streams increases resource usage on both Centrifugo and app backend sides because it involves more moving parts such as goroutines, additional buffers, connections, etc.

The feature is quite niche. Read carefully the motivation described in this doc. If you don't really need proxy streams – prefer using Centrifugo usual approach by always publishing messages to channels over [Centrifugo publish API](./server_api.md#publish) whenever an event happens. This is efficient and Centrifugo just drops messages in case of no active subscribers in a channel. I.e. follow our [idiomatic guidelines](./../getting-started/design.md).

:::tip

Use proxy subscription streams only when really needed. Specifically, proxy subscription stream may be very useful to stream data for a limited time upon some user action in the app.

:::

At the same time proxy subscription streams should scale well horizontally with adding more servers. But scaling GRPC is more involved and using GRPC streams results into more resources utilized than with the common Centrifugo approach, so make sure the resource consumption is sufficient for your system by performing load tests with your expected load profile.

The thing is that sometimes proxy streams is the only way to achieve the desired behaviour – at that point they shine even though require more resources and developer effort. Also, not every use case involves tens of thousands of subscriptions/connections to worry about – be realistic about your practical situation.

### Motivation and design

Here is a diagram which shows the sequence of events happening when using subscription streams:

![](/img/proxy_subscribe.png)

Subscription streams generally solve a task of integrating with third-party streaming providers or external process, possibly with custom filtering. They come into play when it's not feasible to continuously stream all data to various channels, and when you need to deallocate resources on the backend side as soon as stream is not needed anymore.

Subscription streams may be also considered as streaming requests – an isolated way to stream something from the backend to the client or from the client to the backend.

Let's describe a real-life use case. Say you have [Loki](https://grafana.com/oss/loki/) for keeping logs, it provides a [streaming API for tailing logs](https://grafana.com/docs/loki/latest/api/#stream-log-messages). You decided to stream logs towards your app's clients. When client subscribes to some channel in Centrifugo and the unidirectional stream established between Centrifugo and your backend – you can make sure client has proper permissions for the requested resource and backend then starts tailing Loki logs (or other third-party system, this may be Twitter streaming API, MQTT broker, GraphQL subscription, or streaming query to the real-time  database such as RethinkDB). As soon as backend receives log events from Loki it transfers them towards client over Centrifugo.

Client can provide custom data upon subscribing to a channel which makes it possible to pass query filters from the frontend app to the backend. In the example with Loki above this may be a LogQL query.

In case of proxy subscription streams all the client authentication may be delegated to common Centrifugo mechanisms, so when the channel stream is established you know the ID of user (obtained by Centrifugo from [JWT auth](./authentication.md) process or over [connect proxy](./proxy.md#connect-proxy)). You can additionally check channel permissions at the moment of stream establishement.

As soon as client unsubscribes from the channel – Centrifugo closes the unidirectional GRPC stream – so your backend will notice that. If client disconnects – stream is closed also.

If for some reason connection between Centrifugo and backend is closed – then Centrifugo will unsubscribe a client with `insufficient state` reason and a client will soon resubscribe to a channel (managed automatically by our SDKs).

You may wonder – what about the same channel name used for subscribing to such a stream by different connections. Proxy stream is an individual link between a client and a backend – Centrifugo transfers stream data published to the GRPC stream by the backend only to the client connection to whom the stream belongs. I.e. messages sent by the backend to GRPC stream are not broadcasted to other channel subscribers. **But if you will use server API for publishing** – then message will be broadcasted to all channel subscribers even if they are currently using proxy stream within that channel.

Presence and join/leave features will work as usual for channels with subscription proxy streams. If different connections use the same channel they will be able to use presence (if enabled) to see who else is currently in the channel, and may receive join/leave messages (if enabled).

:::info Channel history for proxy subscription streams

For the case of proxy subscription streams Centrifugo channel history and recovery features do not really make sense. Proxy stream is an individual direct link between client and your backend through Centrifugo which is always re-established from scratch upon re-subscription or connection drops. The benefit of the history and its semantics are not clear in this case and can only bring undesired overhead (because Centrifugo will have to use broker, now messages just go directly towards connections without broker/engine involved at all).

:::

:::info Only for client-side subscriptions

Subscription streams work only with client-side subscriptions (i.e. when client explicitly subscribes to a channel on the application's frontend side). Server-side subscriptions won't initiate a GRPC stream to the backend.

:::

Don't forget that Centrifugo namespace system is very flexible – so you can always combine different approaches using different channel namespaces. You can always use subscription streams only for some channels belonging to a specific namespace.

### Unidirectional subscription streams

From the configuration point of view subscription streams may be enabled for channel namespace just as additional type of [proxy](./proxy.md). The important difference is that **only GRPC endpoints may be used** - as we are using GRPC streaming RPCs for this functionality.

You can configure subscription streams for channels very similar to how [subscribe proxy](../server/proxy.md#subscribe-proxy) is configured.

First, configure subscribe stream proxy, pointing it to the backend which implements our proxy stream GRPC service contract:

```json title="config.json"
{
  ...
  "proxy_subscribe_stream_endpoint": "grpc://localhost:12000",
  "proxy_subscribe_stream_timeout": "3s"
}
```

Only `grpc://` endpoints are supported since we are heavily relying on GRPC streaming ecosystem here. In this case `proxy_subscribe_stream_timeout` defines a time how long Centrifugo waits for a first message from a stream which contains subscription details to transfer to a client.

Then you can enable subscription streams for channels on a namespace level:

```json title="config.json"
{
  ...
  "proxy_subscribe_stream_endpoint": "grpc://localhost:12000",
  "proxy_subscribe_stream_timeout": "3s",
  "namespaces": [
    {
        "name": "streams",
        "proxy_subscribe_stream": true
    }
  ]
}
```

:::info

You can not use subscribe, publish, sub_refresh proxy configurations together with stream proxy configuration inside one channel namespace.

:::

That's it on Centrifugo side. Now on the app backend you should implement GRPC service according to the following definitions:

```php
service CentrifugoProxy {
  ...
  // SubscribeUnidirectional allows handling unidirectional subscription streams.
  rpc SubscribeUnidirectional(SubscribeRequest) returns (stream StreamSubscribeResponse);
  ...
}
```

GRPC service definitions can be found in the Centrifugo repository: [proxy.proto](https://github.com/centrifugal/centrifugo/blob/master/internal/proxyproto/proxy.proto) - same as [we described before](./proxy.md#grpc-proxy), probably you already have a service which implements some methods from it. If you don't – just follow [GRPC tutorials](https://grpc.io/docs/languages/) for your programming language to generate server stubs from our Protobuf schema – and you are ready to describe stream logic.

Here we are looking at unidirectional subscription stream – so the next thing to do is to implement streaming handler on the application backend side which contains stream business logic, i.e. implement `SubscribeUnidirectional` streaming rpc handler. A basic example of such handler in Go may look like this (error handling skipped for brevity):

```go
package main

import (
	"fmt"
	"log"
	"math"
	"net"
	"strconv"
	"time"

	pb "example/proxyproto"
	"google.golang.org/grpc"
)

type streamServer struct {
	pb.UnimplementedCentrifugoProxyServer
}

func (s *streamerServer) SubscribeUnidirectional(
  req *pb.SubscribeRequest,
  stream pb.CentrifugoProxy_SubscribeUnidirectionalServer,
) error {
	started := time.Now()
	fmt.Println("unidirectional subscribe called with request", req)
	defer func() {
		fmt.Println("unidirectional subscribe finished, elapsed", time.Since(started))
	}()
	_ = stream.Send(&pb.StreamSubscribeResponse{
		SubscribeResponse: &pb.SubscribeResponse{},
	})
	// Now publish data to a stream every 1 second.
	for {
		select {
		case <-stream.Context().Done():
			return stream.Context().Err()
		case <-time.After(1000 * time.Millisecond):
		}
		pub := &pb.Publication{Data: []byte(`{"input": "` + strconv.Itoa(i) + `"}`)}
		_ = stream.Send(&pb.StreamSubscribeResponse{Publication: pub})
	}
}

func main() {
	lis, _ := net.Listen("tcp", ":12000")
	s := grpc.NewServer(grpc.MaxConcurrentStreams(math.MaxUint32))
	pb.RegisterCentrifugoProxyServer(s, &streamServer{})
	_ = s.Serve(lis)
}
```

:::tip

Note we have increased `grpc.MaxConcurrentStreams` for server to handle more simultaneous streams than allowed by default. Usually default is 100 but can differ in various GRPC server implementations. If you expect more streams then you need a bigger value.

:::

Centrifugo has some rules about messages in streams. Upon stream establishement Centrifugo expects backend to send first message from a stream - this is a `StreamSubscribeResponse` with `SubscribeResponse` in it. Centrifugo waits for this message before replying to the client's subscription command. This way we can communicate initial state with a client and make sure streaming is properly established with all permission checks passed. After sending initial message you can send events (publications) as they appear in your system.

Now everything should be ready to test it out from the client side: just subscribe to a channel where stream proxy is on with our SDK – and you will see your stream handler called and data streamed from it to a client. For example, with our Javascript SDK:

```javascript
const client = new Centrifuge('ws://localhost:8000/connection/websocket', {
    getToken: getTokenImplementation
});

client.connect();

const sub = client.newSubscription('streams:123e4567-e89b-12d3-a456-426614174000', {
    data: {}
}).on('publication', function(ctx) {
    console.log("received publication from a channel", ctx.data);
});

sub.subscribe();
```

Again, while we are still looking for a proper semantics of subscription streams we recommend using unique channel names for all on-demand streams you are establishing.

### Bidirectional subscription streams

In addition to unidirectional streams, Centrifugo supports bidirectional streams upon client channel subscription. In this case client gets a possibility to stream any data to the backend utilizing bidirectional communication. Client can send messages to a bidirectional stream by using `.publish(data)` method of a `Subscription` object.

In terms of general design bidirectional streams behave similar to unidirectional streams as described above.

When enabling subscription streams, Centrifugo uses unidirectional GRPC streams by default – as those should fit most of the use cases proxy subscription streams were introduced for. To tell Centrifugo use bidirectional streaming add `proxy_subscribe_stream_bidirectional` flag to the namespace configuration:

```json title="config.json"
{
  ...
  "proxy_subscribe_stream_endpoint": "grpc://localhost:12000",
  "proxy_subscribe_stream_timeout": "3s",
  "namespaces": [
    {
        "name": "streams",
        "proxy_subscribe_stream": true,
        "proxy_subscribe_stream_bidirectional": true
    }
  ]
}
```

On the backend you need to implement the following streaming handler:

```php
service CentrifugoProxy {
  ...
  // SubscribeBidirectional allows handling bidirectional subscription streams.
  rpc SubscribeBidirectional(stream StreamSubscribeRequest) returns (stream StreamSubscribeResponse);
  ...
}
```

The first `StreamSubscribeRequest` message in stream will contain `SubscribeRequest` and Centrifugo expects `StreamSubscribeResponse` with `SubscribeResponse` from the backend – just like in unidirectional case described above.

An example of such handler in Go language which echoes back all publications from client (error handling skipped for brevity):

```go
func (s *streamerServer) SubscribeBidirectional(
	stream pb.CentrifugoProxy_SubscribeBidirectionalServer,
) error {
	started := time.Now()
	fmt.Println("bidirectional subscribe called")
	defer func() {
		fmt.Println("bidirectional subscribe finished, elapsed", time.Since(started))
	}()
	// First message always contains SubscribeRequest.
	req, _ := stream.Recv()
	fmt.Println("subscribe request received", req.SubscribeRequest)
	_ = stream.Send(&pb.StreamSubscribeResponse{
		SubscribeResponse: &pb.SubscribeResponse{},
	})
	// The following messages contain publications from client.
	for {
		req, _ = stream.Recv()
		data := req.Publication.Data
		fmt.Println("data from client", string(data))
		var cd clientData
		pub := &pb.Publication{Data: data}
		_ = stream.Send(&pb.StreamSubscribeResponse{Publication: pub})
	}
}
```

## Granular proxy mode

[Granular proxy mode](./proxy.md#granular-proxy-mode) works with subscription streams in the same manner as for other Centrifugo proxy types.

Here is an example how you can define different subscribe stream proxies for different namespaces:

```json title=config.json
{
  ...
  "granular_proxy_mode": true,
  "proxies": [
    {
	  "name": "stream_1",
	  "endpoint": "grpc://localhost:3000",
	  "timeout": "500ms",
    },
    {
	  "name": "stream_2",
	  "endpoint": "grpc://localhost:3001",
	  "timeout": "500ms",
    }
  ],
  "namespaces": [
    {
      "name": "ns1",
      "subscribe_stream_proxy_name": "stream_1"
    },
    {
      "name": "ns2",
      "subscribe_stream_proxy_name": "stream_2"
    }
  ]
}
```
