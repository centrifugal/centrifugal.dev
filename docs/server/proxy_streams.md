---
id: proxy_streams
sidebar_label: Proxy streams
title: Proxy streams
draft: true
---

:::caution Experimental

This is an experimental feature. We appreciate your feedback to make sure it's useful and solves real-world problems before marking it as stable and commit to the API.

:::

Proxy streams allow pushing data towards client channel subscription (and optionally connection itself) directly and individually from your application backend over the unidirectional or bidirectional [GRPC](https://grpc.io/) stream.

The stream is established between Centrifugo and your application backend as soon as user subscribes to a channel (or connects to Centrifugo). The scheme may be useful if you want to generate individual streams and these streams should only work for a time while client is connected or subscribed to a channel.

In this case Centrifugo plays a role of WebSocket-to-GRPC streaming proxy – keeping numerous real-time connections from your application's clients and establishing GRPC streams to the backend, multiplexing them using a pool of HTTP/2 (transport used by GRPC) connections:

![](/img/on_demand_stream_connections.png)

BTW, our bidirectional WebSocket fallbacks (HTTP-streaming and SSE) and experimental WebTransport work with proxy streams too.

:::caution Use proxy streams only when really needed

This scheme increases resource usage on both Centrifugo and app backend sides because it involves more moving parts, such as goroutines, additional buffers, connections, etc. The feature is quite niche. Read carefully the motivation for proxy streams described in this doc. If you don't really need proxy streams – prefer using Centrifugo usual approach by always publishing messages to channels over Centrifugo publish API whenever an event happens. This is efficient and Centrifugo just drops messages in case of no active subscribers in a channel. Proxy streams should scale well horizontally with adding more servers – but they consume more resources than common Centrifugo approach, so make sure the resource consumption is sifficient for your system by performing load tests.

:::

## Subscription streams

We will start from subscription streams as we see more value in them for Centrifugo users. Here is a diagram which shows the sequence of events happening when using subscription streams:

![](/img/proxy_subscribe.png)

### Motivation and design

Subscription streams generally solve a task of integrating with third-party streaming providers with custom filtering. They come into play when it's not feasible to continuously stream all data to various channels, and when you need to deallocate some resources on the backend side as soon as stream is not needed anymore.

Subscriptions streams may be also considered as streaming requests – an isolated way to stream something from the backend to the client or from the client to the backend.

Let's describe a real-life use case. Say you have [Loki](https://grafana.com/oss/loki/) for keeping logs, it provides a [streaming API for tailing logs](https://grafana.com/docs/loki/latest/api/#stream-log-messages). You decided to stream logs towards your app's clients. When client subscribes to some channel in Centrifugo and the unidirectional stream established between Centrifugo and your backend – you can make sure client has proper permissions for the requested resource and backend then starts tailing Loki logs (or other third-party system, this may be Twitter streaming API, MQTT broker, GraphQL subscription, or streaming query to the real-time  database such as RethinkDB). As soon as backend receives log events from Loki it transfers them towards client over Centrifugo.

Client can provide custom data upon subscribing to a channel which makes it possible to pass query filters from the frontend app to the backend. In the example with Loki above this may be a LogQL query.

In case of proxy subscription streams all the client authentication may be delegated to common Centrifugo mechanisms, so when the channel stream is established you know the ID of user (obtained by Centrifugo from JWT auth process or over connect proxy). You can additionally check channel permissions at the moment of stream establishement.

As soon as client unsubscribes from the channel – Centrifugo closes the unidirectional GRPC stream so your backend will notice that. If client disconnects – stream is closed also.

If for some reason connection between Centrifugo and backend is closed – then Centrifugo will unsubscribe a client with `insufficient state` reason and a client will soon resubscribe to a channel (managed automatically by our SDKs).

You may wonder – what about the same channel name used for subscribing to an such a stream by different connections. Proxy stream is an individual link between a client and a backend – at this moment Centrifugo transfers stream data published to the GRPC stream by the backend only to the client connection to whom the stream belongs. I.e. messages sent by the backend to GRPC stream are not broadcasted to other channel subscribers. **But if you will use server API for publishing** – then message will be broadcasted to all channel subscribers even if they are currently using proxy stream within that channel.

Presence and join/leave features will work as usual for channels with subscription proxy streams. If different connections use the same channel they will be able to use presence (if enabled) to see who else is currently in the channel, and may receive join/leave messages (if enabled). This is actually a side effect – and **we are still thinking about the desired semantics here**. Your feedback is very welcome.

:::info Channel history for proxy subscription streams

For the case of proxy subscription streams Centrifugo channel history and recovery features do not really make sense. Proxy stream is an individual direct link between client and your backend through Centrifugo which is always re-established from scratch upon re-subscription or connection drops. The benefit of the history is not clear in this case and can only bring undesired overhead (because Centrifugo will have to use broker, now messages just go directly towards connections without broker/engine involved).

:::

:::info Only for client-side subscriptions

Subscription streams work only with client-side subscriptions (i.e. when client explicitly subscribes to a channel on the application's frontend side). Server-side subscriptions won't initiate a GRPC stream to the backend.

:::

### Unidirectional subscription streams

You can configure on-demand subscription streams for channels similar to how [subscribe proxy](../server/proxy.md#subscribe-proxy) is configured.

First, configure subscribe stream proxy, pointing to the backend which implements our proxy stream service:

```json title="config.json"
{
  ...
  "proxy_stream_subscribe_endpoint": "grpc://localhost:12000",
  "proxy_stream_subscribe_timeout": "3s"
}
```

Only `grpc` endpoints are supported since we are heavily relying on GRPC ecosystem here. `proxy_stream_subscribe_timeout` in this case defines a time how long Centrifugo waits for a first message from a stream which can contain subscription details to transfer to a client. 

Then you can enable subscription streams for channels on a namespace level:

```json title="config.json"
{
  ...
  "proxy_stream_subscribe_endpoint": "grpc://localhost:12000",
  "proxy_stream_subscribe_timeout": "3s",
  "namespaces": [
    {
        "name": "streams",
        "proxy_stream_subscribe": true
    }
  ]
}
```

:::info

At this point you can not use subscribe, publish, sub_refresh proxy configurations together with stream proxy configuration inside one channel namespace. 

:::

That's it on Centrifugo side. Now on the app backend you should implement GRPC service according to the following definitions:

```php
// CentrifugoProxyStream allows proxying Centrifugo connections and channel subscriptions
// to the application backend in form of unidirectional or bidirectional streams. This way
// it's possible to achieve on-demand streaming when data is only exchanged while client is
// connected or subscribed.
service CentrifugoProxyStream {
  ...
  // SubscribeUnidirectional allows handling unidirectional subscription streams.
  rpc SubscribeUnidirectional(SubscribeRequest) returns (stream ChannelResponse);
  ...
}
```

Just follow GRPC tutorials for your programming language to generate server stubs from our Protobuf schema.

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

	pb "example/proxystreamproto"
	"google.golang.org/grpc"
)

type streamServer struct {
	pb.UnimplementedCentrifugoProxyStreamServer
}

func (s *streamerServer) SubscribeUnidirectional(
  req *pb.SubscribeRequest,
  stream pb.CentrifugoProxyStream_SubscribeUnidirectionalServer,
) error {
	started := time.Now()
	fmt.Println("unidirectional subscribe called with request", req)
	defer func() {
		fmt.Println("unidirectional subscribe finished, elapsed", time.Since(started))
	}()
	_ = stream.Send(&pb.ChannelResponse{
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
		_ = stream.Send(&pb.ChannelResponse{Publication: pub})
	}
}

func main() {
	lis, _ := net.Listen("tcp", ":12000")
	s := grpc.NewServer(grpc.MaxConcurrentStreams(math.MaxUint32))
	pb.RegisterCentrifugoProxyStreamServer(s, &streamServer{})
	_ = s.Serve(lis)
}
```

Note that we have some rules about messages in streams. Upon stream establishement Centrifugo expects backend to send first message from a stream - this is a `ChannelResponse` with `SubscribeResponse` in it. Centrifugo waits for this message before replying to the client's subscription command. This way we can communicate initial state with a client and make sure streaming is properly established with all permission checks passed. After sending initial message you can send events (publications) as they appear in your system.

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

Again, while we are still looking for a proper semantics of on-demand streams we recommend using unique channel names for all on-demand streams you are establishing.

### Bidirectional subscription streams

In addition to unidirectional streams, Centrifugo supports bidirectional streams upon client channel subscription. In this case client gets a possibility to stream any data to the backend utilizing bidirectional communication. Client can send messages to a bidi stream by using `.publish(data)` method of a Subscription object.

In terms of general design bidirectional streams behave similar to unidirectional streams as described above. 

By default, Centrifugo uses unidirectional GRPC streams which should fit most of the use cases proxy subscription streams were introduced for. To enable bidirectional streaming add `proxy_stream_subscribe_bidirectional` flag to the namespace configuration:

```json title="config.json"
{
  ...
  "proxy_stream_subscribe_endpoint": "grpc://localhost:12000",
  "proxy_stream_subscribe_timeout": "3s",
  "namespaces": [
    {
        "name": "streams",
        "proxy_stream_subscribe": true,
        "proxy_stream_subscribe_bidirectional": true
    }
  ]
}
```

On the backend you need to implement the following streaming handler:

```php
// CentrifugoProxyStream allows proxying Centrifugo connections and channel subscriptions
// to the application backend in form of unidirectional or bidirectional streams. This way
// it's possible to achieve on-demand streaming when data is only exchanged while client is
// connected or subscribed.
service CentrifugoProxyStream {
  ...
  // SubscribeBidirectional allows handling bidirectional subscription streams.
  rpc SubscribeBidirectional(stream ChannelRequest) returns (stream ChannelResponse);
  ...
}
```

The first message in stream will contain `SubscribeRequest` and Centrifugo expects `ChannelResponse` with `SubscribeResponse` from the backend – just like in unidirectional case described above.

An example of such handler in Go language which echoes back all publications from client (error handling skipped for brevity):

```go
func (s *streamerServer) SubscribeBidirectional(
	stream pb.CentrifugoProxyStream_SubscribeBidirectionalServer,
) error {
	started := time.Now()
	fmt.Println("bidirectional subscribe called")
	defer func() {
		fmt.Println("bidirectional subscribe finished, elapsed", time.Since(started))
	}()
	// First message always contains SubscribeRequest.
	req, _ := stream.Recv()
	fmt.Println("subscribe request received", req.SubscribeRequest)
	_ = stream.Send(&pb.ChannelResponse{
		SubscribeResponse: &pb.SubscribeResponse{},
	})
	// The following messages contain publications from client.
	for {
		req, _ = stream.Recv()
		data := req.Publication.Data
		fmt.Println("data from client", string(data))
		var cd clientData
		pub := &pb.Publication{Data: data}
		_ = stream.Send(&pb.ChannelResponse{Publication: pub})
	}
}
```

## Connection streams

![](/img/proxy_connect.png)

### Motivation and design

That's actually an approach which allows Centrifugo to offer a support for `disconnect` hooks in some form. As you know we do not want to add disconnect hooks to a [standard Centrifugo proxy](./proxy.md) because the disconnect event [may be not delivered](../faq/index.md#why-centrifugo-does-not-have-disconnect-hooks). And we suggest working around that based on periodic pings. Connection streams change this since the stream will be canceled as soon as client goes away or Centrifugo node restarted and your backend has a chance to notice that no matter what – since a persistent link in form of GRPC stream will be closed. So we are delegating the responsibility to reliably handle disconnections from Centrifugo to the backend – making the behavior more predictable.

In terms of general behavior connection streams mostly match subscription streams:

* when client disconnects – stream to the backend is closed by Centrifugo
* if connection between Centrifugo and backend is lost – client is disconnected with `insufficient state` reason and will reconnect soon automatically
* if stream is cleanly finished by the backend - client will be disconnected with advice to not reconnect
* in bidirectional case client is able to stream data to the backend using `.send(data)` method of our SDKs

### Unidirectional connections streams

When the following is configured:

```json title="config.json"
{
  ...
  "proxy_stream_connect_endpoint": "grpc://localhost:12000",
  "proxy_stream_connect_timeout": "3s"
}
```

– then Centrifugo will start stream to the backend whenever client connects to Centrifugo.

On the backend you need to have a streaming handler which implement `ConnectUnidirectional` GRPC contract:

```php
service CentrifugoProxyStream {
  ...
  // ConnectUnidirectional allows handling unidirectional connection streams.
  rpc ConnectUnidirectional(ConnectRequest) returns (stream Response);
  ...
}
```

Note, that just like in subscription stream case Centrifugo expects first message from the backend in the stream to be a `ConnectResponse` to communicate initial state for the client.

Here is an example of unidirectional connect stream which authenticates connection and will be closed as soon as client is disconnected:

```go
func (s *streamerServer) ConnectUnidirectional(
	req *pb.SubscribeRequest,
	stream pb.CentrifugoProxyStream_SubscribeUnidirectionalServer,
) error {
	started := time.Now()
	fmt.Println("unidirectional connect called with request", req)
	defer func() {
		fmt.Println("unidirectional connect finished, elapsed", time.Since(started))
	}()
  _ = stream.Send(&pb.Response{
		ConnectResponse: &pb.ConnectResponse{
			Result: &pb.ConnectResult{
				User: "test",
			},
		},
	})
  <-stream.Context().Done():
	return stream.Context().Err()
}
```

### Bidirectional connection streams

Same thing but allows client to stream data to the backend by calling `.send(data)` API of our bidirectional SDKs. Can be enabled by adding `proxy_stream_connect_bidirectional` flag to the configuration:

```json title="config.json"
{
  ...
  "proxy_stream_connect_endpoint": "grpc://localhost:12000",
  "proxy_stream_connect_timeout": "3s",
  "proxy_stream_connect_bidirectional": true
}
```

On the backend you need to have a streaming handler which implement `ConnectBidirectional` GRPC contract:

```php
service CentrifugoProxyStream {
  ...
  rpc ConnectBidirectional(stream Request) returns (stream Response);
  ...
}
```

The first message in stream from Centrifugo to the backend always contains `ConnectRequest`. Then Centrifugo expects first message from the backend in the stream to be a `ConnectResponse` to communicate initial state for the client. All the following messages are bidirectional data message exchange.

Here is an example of possible streaming handler - this is a simple echo server which authenticates connection and then sends all the messages received from a client back:

```go
func (s *streamerServer) ConnectBidirectional(
	stream pb.CentrifugoProxyStream_ConnectBidirectionalServer,
) error {
	started := time.Now()
	fmt.Println("bidirectional connect called")
	defer func() {
		fmt.Println("bidirectional connect finished, elapsed", time.Since(started))
	}()
	// First message always contains SubscribeRequest.
	req, _ := stream.Recv()
	fmt.Println("connect request received", req.ConnectRequest)
	_ = stream.Send(&pb.Response{
		ConnectResponse: &pb.ConnectResponse{
			Result: &pb.ConnectResult{
				User: "test",
			},
		},
	})
	// The following messages contain publications from client.
	for {
		req, _ = stream.Recv()
		data := req.Message.Data
		fmt.Println("message from client", string(data))
		var cd clientData
		_ = json.Unmarshal(data, &cd)
		msg := &pb.Message{Data: []byte(`{"input": "` + cd.Input + `"}`)}
		_ = stream.Send(&pb.Response{Message: msg})
	}
}
```

## Granular stream proxy mode

At this point we are not providing a way to configure stream proxies in a granular mode similar to what we have for [connection event proxies](../server/proxy.md#granular-proxy-mode). Please reach us out if you need this feature.
