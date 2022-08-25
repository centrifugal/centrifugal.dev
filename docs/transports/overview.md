---
id: overview
title: Real-time transports 
---

Centrifugo supports a variety of transports to deliver real-time messages to clients.

:::info Every transport is a persistent connection

Here we describe supported transports between your application frontend and Centrifugo itself. Every Centrifugo transport is a persistent connection so the server can push data towards clients at any moment.

:::

The important distinction here is that all supported transports belong to one of two possible groups:

* Bidirectional
* Unidirectional

## Bidirectional

Bidirectional transports are capable to serve all Centrifugo features. These transports are the main Centrifugo focus.

Bidirectional transports come with a cost that developers need to use a special client connector library (SDK) which speaks Centrifugo [client protocol](./client_protocol.md). The reason why we need a special client connector library is that a bidirectional connection is asynchronous – it's required to match requests to responses, properly manage connection state, handle request queueing/timeouts/errors, etc.

Centrifugo has several official [client SDKs](../transports/client_sdk.md) for popular environments.

## Unidirectional

Unidirectional transports suit well for simple use-cases with stable subscriptions, usually known at connection time.

The advantage is that unidirectional transports do not require special client connectors - developers can use native browser APIs (like WebSocket, EventSource, HTTP streaming), or GRPC generated code to receive real-time updates from Centrifugo. Thus avoiding dependency to a client connector that abstracts bidirectional communication.

The drawback is that with unidirectional transports you are not inheriting all Centrifugo features out of the box (like dynamic subscriptions/unsubscriptions, automatic message recovery on reconnect, possibility to send RPC calls over persistent connection). But some of the missing client APIs can be mimicked by using calls to Centrifugo [server API](../server/server_api.md) (i.e. over client -> application backend -> Centrifugo).

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

## PING/PONG behavior

Centrifugo server periodically sends pings to clients and expects pong from clients that works over bidirectional transports. Sending ping and receiving pong allows to find broken connections faster. Centrifugo sends pings on the Centrifugo client protocol level, thus it's possible for clients to handle ping messages on the client side to make sure connection is not broken (our bidirectional SDKs do this automatically).

By default Centrifugo sends pings every 25 seconds. This may be changed using `ping_interval` option ([duration](../server/configuration.md#setting-time-duration-options), default `"25s"`).

Centrifugo expects pong message from bidirectional client SDK after sending ping to it. By default, it waits no more than 8 seconds before closing a connection. This may be changed using `pong_timeout` option ([duration](../server/configuration.md#setting-time-duration-options), default `"8s"`).

In most cases default ping/pong intervals are fine so you don't really need to tweak them. Reducing timeouts may help you to find non-gracefully closed connections faster, but will increase network traffic and CPU resource usage since ping/pongs are sent faster.

:::caution

`ping_interval` must be greater than `pong_timeout` in the current implementation.

:::

Here is a scheme how ping/pong works in bidirectional and unidirectional client scenarios:

![](/img/ping_pong.png)
