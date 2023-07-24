---
id: uni_client_protocol
title: Unidirectional client protocol
sidebar_label: Unidirectional protocol
---

As we mentioned in overview you can avoid using Centrifugo SDKs if you stick with [unidirectional approach](./overview.md#unidirectional). In this case though you will need to implement some basic parsing on client side to consume message types sent by Centrifugo into unidirectional connections.

At this point Centrifugo supports unidirectional WebSocket, HTTP streaming, SSE (EventSource), GRPC transports – and all of them inherit the same protocol structure described here.   

### Unidirectional message types

In case of unidirectional transports Centrifugo will send `Push` frames to the connection. Push frames defined by [client protocol schema](https://github.com/centrifugal/protocol/blob/master/definitions/client.proto). I.e. Centrifugo reuses a part of its bidirectional protocol for unidirectional communication. Push message defined as:

```
message Push {
  string channel = 2;

  Publication pub = 4;
  Join join = 5;
  Leave leave = 6;
  Unsubscribe unsubscribe = 7;
  Message message = 8;
  Subscribe subscribe = 9;
  Connect connect = 10;
  Disconnect disconnect = 11;
  Refresh refresh = 12;
}
```

:::tip

Some numbers in Protobuf definitions skipped for backwards compatibility with previous client protocol version.

:::

So unidirectional connection will receive various pushes. Every push contains **one of** the following objects:

* Publication
* Join
* Leave
* Unsubscribe
* Message
* Subscribe
* Connect
* Disconnect
* Refresh

Some pushes belong to a `channel` which may be set on Push top level.

All you need to do is look at Push, process messages you are interested in and ignore others. In most cases you will be most interested in pushes which contain `Connect` or `Publication` messages.

For example, according to [protocol schema](https://github.com/centrifugal/protocol/blob/master/definitions/client.proto) Publication message type looks like this:

```
message Publication {
  bytes data = 4;
  ClientInfo info = 5;
  uint64 offset = 6;
  map<string, string> tags = 7;
}
```

:::tip

In JSON protocol case Centrifugo replaces `bytes` type with embedded JSON.

:::

Just try using any unidirectional transport and you will quickly get the idea.
