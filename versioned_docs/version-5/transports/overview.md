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

Bidirectional transports are capable to serve all Centrifugo features. These transports are the main Centrifugo focus and where Centrifugo really shines.

Bidirectional transports come with a cost that developers need to use a special client connector library (SDK) which speaks Centrifugo [client protocol](./client_protocol.md). The reason why we need a special client connector library is that a bidirectional connection is asynchronous – it's required to match requests to responses, properly manage connection state, handle request queueing/timeouts/errors, etc. And of course to multiplex subscriptions to different channels over a single connection.

Centrifugo has several official [client SDKs](../transports/client_sdk.md) for popular environments. All of them work over [WebSocket](./websocket.md) transport. Our Javascript SDK also offers bidirectional fallbacks over [HTTP-Streaming](./http_stream.md), [Server-Sent Events (SSE)](./sse.md), [SockJS](./sockjs.md), and has an experimental support for [WebTransport](./webtransport.md).

## Unidirectional

Unidirectional transports suit well for simple use-cases with stable subscriptions, usually known at connection time.

The advantage is that unidirectional transports do not require special client connectors - developers can use native browser APIs (like [WebSocket](./uni_websocket.md), [EventSource/SSE](./uni_sse.md), [HTTP-streaming](./uni_http_stream.md)), or [GRPC](./uni_grpc.md) generated code to receive real-time updates from Centrifugo. Thus avoiding dependency to a client connector that abstracts bidirectional communication.

The drawback is that with unidirectional transports you are not inheriting all Centrifugo features out of the box (like dynamic subscriptions/unsubscriptions, automatic message recovery on reconnect, possibility to send RPC calls over persistent connection). But some of the missing client APIs can be mimicked by using calls to Centrifugo [server API](../server/server_api.md) (i.e. over client -> application backend -> Centrifugo).

Learn more about [unidirectional protocol](./uni_client_protocol.md) and available unidirectional transports.

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
