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

Bidirectional transports come with a cost that developers need to use a special client connector library which speaks Centrifugo [client protocol](./protocol.md). The reason why we need a special client connector library is that a bidirectional connection is asynchronous – it's required to match requests to responses, properly manage connection state and request queueing/timeouts/errors.

Centrifugo has [client connector libraries](../ecosystem/client.md) for popular environments.

## Unidirectional

Unidirectional transports suit well for simple use-cases with stable subscriptions.

The advantage is that unidirectional transports do not require special client connectors - developers can use native browser APIs (like WebSocket, SSE, HTTP streaming), or GRPC generated code to receive real-time updates from Centrifugo – thus avoiding dependency to a client connector that abstracts bidirectional communication.

The drawback is that with unidirectional transports you are not inheriting all Centrifugo features out of the box (like dynamic subscriptions/unsubscriptions, automatic message recovery on reconnect, possibility to send RPC calls over persistent connection). But some of the missing client APIs can be mimicked by using calls to Centrifugo [server API](../server/server_api.md) (i.e. over client -> application backend -> Centrifugo).

### Unidirectional message types

In case of unidirectional transports Centrifugo will send `Push` frames to the connection. Push frames defined by [client protocol schema](https://github.com/centrifugal/protocol/blob/master/definitions/client.proto). I.e. Centrifugo reuses a part of its bidirectional protocol for unidirectional communication. Push message defined as:

```
message Push {
  enum PushType {
    PUBLICATION = 0;
    JOIN = 1;
    LEAVE = 2;
    UNSUBSCRIBE = 3;
    MESSAGE = 4;
    SUBSCRIBE = 5;
    CONNECT = 6;
    DISCONNECT = 7;
    REFRESH = 8;
  }
  PushType type = 1;
  string channel = 2;
  bytes data = 3;
}
```

So unidirectional connection will receive various pushes. All you need to do is look at Push type and process it or skip it. In most cases you will be most interested in `CONNECT` and `PUBLICATION` types.

:::tip

In case of unidirectional WebSocket, EventSource and HTTP-streaming which currently work only with JSON `data` field of Push will come as an embedded JSON instead of `bytes` (again – the same mechanism as for Centrifugo bidirectional JSON protocol).

:::

Just try any unidirectional transport and you will quickly get the idea.
