---
id: on_demand_streams
sidebar_label: On-demand streams
title: On-demand streams
draft: true
---

In design 🚧

On-demand streams feature of Centrifugo allows pushing data towards client channel subscription directly and individually from your application backend over the unidirectional GRPC stream (and optionally over the [bidirectional](#bidirectional-streaming) one). The stream is established between Centrifugo and your application backend as soon as user subscribes to a channel. The scheme may be useful if you want to generate individual streams for clients and these streams should only work for a time while client is subscribed to a channel – i.e. a stream must only be allocated on client's demand.

In this case Centrifugo plays a role of WebSocket-to-GRPC streaming proxy – keeping many real-time connections from your app clients and establishing GRPC streams to the backend using a pool of HTTP/2 (transport used by GRPC) connections.

![](/img/proxy_streams.png)

## Motivation and design

On-demand streams generally solve a task of integrating with third-party streaming providers with custom filtering.

Let's describe a real-life use case. Say you have [Loki](https://grafana.com/oss/loki/) for keeping logs, it provides a [streaming API for tailing logs](https://grafana.com/docs/loki/latest/api/#stream-log-messages). You decided to stream logs towards your clients. When client subscribes to some channel in Centrifugo and the unidirectional stream established between Centrifugo and your backend – backend starts tailing Loki logs and transfers them towards client over Centrifugo. Client can provide custom data upon subscribing to a channel which makes it possible to pass query filters from the frontend app.

:::note

Is this possible to implement without on-demand streams using other Centrifugo primitives? Actually, yes. Client can subscribe to the unique channel name, with the help of [subscribe proxy](../server/proxy.md#subscribe-proxy) app backend could know about new subscription and start streaming towards the provided channel by publishing messages over Centrifugo server API. If you enable channel presence then you can periodically ask Centrifugo whether the channel is still occupied by a subscriber and deallocate resources on the app backend. Or use sub_refresh proxy feature to be periodically notified by Centrifugo about subscription liveness. If your stream ends – you can call Centrifugo unsubscribe server API. This could be more efficient than on-demand streams actually – but more complex to implement and has its own trade-offs in terms of latencies.

:::

In case of on-demand streams all the client authentication and channel permission control may be delegated to common Centrifugo mechanisms, so when the stream is established you know the ID of user and the channel. You can also additionally check channel permissions at the moment of stream establishement. As soon as client unsubscribes from the channel – Centrifugo closes the unidirectional GRPC stream.

If for some reason connection between Centrifugo and backend is closed – then Centrifugo will unsubscribe a client with `insufficient state` reason and a client will soon resubscribe to a channel (managed automatically by our SDKs).


:::danger Take care of channel names

At this point it's the task of an application to use unique channel names for each individual on-demand stream created on the client side. If you subscribe to the same channel name from different browser tabs - then two different GRPC streams will be established with your backend and you will have merged/duplicate data in client-side subscriptions. To avoid this use unique channel names – for example, generate UUID V4 string and use it as part of a channel.

:::

:::caution Use on-demand streams only when really needed

This scheme increases resource usage on both Centrifugo and app backend sides because it involves more moving parts and connections. The feature is quite niche actually. If you don't really need on-demand streams – prefer using Centrifugo usual approach for always publishing messages to channels whenever event happens. This is efficient and Centrifugo just drops messages in case of no active subscribers in a channel. On-demand streams should scale well horizontally – but they consume more resources which may become expensive in scale. The common advice here is load testing for your concrete use case.

:::

:::info History and presence are not used for on-demand streams

Note, that for the case of on-demand streams Centrifugo channel history, recovery, presence features are not available. On-demand stream is an individual direct link between client and your backend through Centrifugo which is always re-established from scratch upon re-subscription. The benefit of the history is not clear in this case and can only bring undesired overhead. For presence you can always use a separate channel which works in a standard Centrifugo way.

:::

## Bidirectional streaming

In addition to unidirectional streams, Centrifugo supports bidirectional streams upon client channel subscription. In this case client gets a possibility to stream any data to the backend utilizing bidirectional communication. Client can send messages to a bidi stream by using `.publish(data)` method of a Subscription object.

In terms of general design bidirectional streams behave similar to unidirectional streams as described above. 

## Configuration

You can configure on-demand streams usage for channels similar to how [subscribe proxy](../server/proxy.md#subscribe-proxy) is configured.

First, configure stream proxy, pointing to the backend which implements out on-demand streaming service:

```json title="config.json"
{
  ...
  "proxy_stream_endpoint": "grpc://localhost:3000/centrifugo/subscribe",
  "proxy_stream_timeout": "5s"
}
```

Only `grpc` endpoints are supported since we are heavily relying on GRPC ecosystem here. `proxy_stream_timeout` in this case defines a time how long Centrifugo waits for a first message from a stream which can contain subscription details to transfer to a client. 

Then you can enable on-demand streams for channels on a namespace level:

```json title="config.json"
{
  ...
  "proxy_stream_endpoint": "grpc://localhost:12000",
  "proxy_stream_timeout": "5s",
  "namespaces": [
    {
        "name": "streams",
        "proxy_stream": true
    }
  ]
}
```

By default, Centrifugo uses unidirectional GRPC streams which should fit most of the use cases. To enable bidirectional streaming add `proxy_stream_bidirectional` flag:

```json title="config.json"
{
  ...
  "proxy_stream_endpoint": "grpc://localhost:12000",
  "proxy_stream_timeout": "5s",
  "namespaces": [
    {
        "name": "streams",
        "proxy_stream": true,
        "proxy_stream_bidirectional": true
    }
  ]
}
```

:::info

At this point you can not use subscribe, publish, sub_refresh proxy configurations together with stream proxy configuration inside one channel namespace. 

:::

That's it on Centrifugo side. Now on the app backend you should implement GRPC service according to the following definitions:

```php
service CentrifugoProxyStream {
  // Consume allows handling unidirectional streams.
  rpc Consume(SubscribeRequest) returns (stream Response);

  // Communicate allows handling bidirectional streams.
  rpc Communicate(stream CommunicateRequest) returns (stream Response);
}
```

Just follow GRPC tutorials for your programming language to generate server stubs from our Protobuf schema.

Next you need to implement streaming handler on the application backend side which contains stream business logic. A basic example of such handler in Go may look like this:

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

func (s *streamServer) Consume(
    req *pb.SubscribeRequest,
    stream pb.CentrifugoProxyStream_ConsumeServer,
) error {
    log.Println("consume called for channel", req.Channel)
	stream.Send(&pb.Response{}) // We expect first message to always be sent.
	i := 0
	for {
		time.Sleep(time.Second)
        pub := &pb.Publication{Data: []byte(`{"input": "` + strconv.Itoa(i) + `"}`)}
		stream.Send(&pb.Response{Publication: pub})
		i++
        if i > 10 {
            break
        }
	}
    return nil
}

func main() {
	lis, _ := net.Listen("tcp", ":12000")
	s := grpc.NewServer(grpc.MaxConcurrentStreams(math.MaxUint32))
	pb.RegisterCentrifugoProxyStreamServer(s, &streamServer{})
	_ = s.Serve(lis) // Error handling skipped for brevity.
}
```

Note that we have some rules about messages in streams. Upon stream establishement Centrifugo expects backend to send first message from a stream and waits for it before replying to the client's subscription command. This way we can communicate initial state with a client and make sure streaming is properly established with all permission checks passed. After sending initial message you can send events (publications) as they appear in your system.

Now everything should be ready to test it out from the client side: just subscribe to a channel where stream proxy is on with our SDK – and you will see your stream handler called and data streamed from it to a client. For example, with our Javascript SDK:

```javascript
const client = new Centrifuge('ws://localhost:8000/connection/websocket', {
    getToken: getTokenImplementation
});

const sub = client.newSubscription('streams:123e4567-e89b-12d3-a456-426614174000', {
    data: {}
}).on('publication', function(ctx) {
    console.log("received publication from a channel", ctx.data);
});

sub.subscribe();
client.connect();
```

## Granular stream proxy mode

At this point we are not providing a way to configure stream proxies in a granular mode similar to what we have for [connection event proxies](../server/proxy.md#granular-proxy-mode). Please reach us out if you need this feature.
