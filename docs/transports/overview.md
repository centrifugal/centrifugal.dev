---
id: overview
title: Real-time transports 
---

Centrifugo supports a variety of transports to deliver real-time messages to clients.

:::info Every transport is a persistent connection

Here we describe supported transports between your application frontend and Centrifugo. Every Centrifugo real-time transport is a persistent connection so the server can push data towards clients at any moment.

:::

The important distinction here is that all supported transports belong to one of two possible groups:

* [Bidirectional](#bidirectional)
* [Unidirectional](#unidirectional)

## Bidirectional

Bidirectional transports are capable to serve all Centrifugo features. These transports are the main Centrifugo focus and where Centrifugo really shines.

Bidirectional transports come with the requirement that developers use a special client connector library (real-time SDK) that communicates with Centrifugo over custom [client protocol](./client_protocol.md). This is necessary because bidirectional connections are asynchronous, meaning requests must be matched to their corresponding responses, connection state must be properly managed, and request queueing, timeouts, and errors must be handled. Additionally, the SDK is needed to multiplex subscriptions to different channels over a single connection.

Centrifugo has several official [client real-time SDKs](../transports/client_sdk.md) for popular environments. All of them work over [WebSocket](./websocket.md) transport. Our Javascript SDK also offers bidirectional fallbacks over [HTTP-Streaming](./http_stream.md), [Server-Sent Events (SSE)](./sse.md), and has an experimental support for [WebTransport](./webtransport.md).

## Unidirectional

Unidirectional transports suit well for use cases without dynamic subscriptions, where channels to subscribe are known at connection time.

The main advantage is that unidirectional transports do not require special client connectors. Developers can use native browser APIs, such as [WebSocket](./uni_websocket.md), [Server-Sent Events (SSE)](./uni_sse.md), or [HTTP-streaming](./uni_http_stream.md)), as well as [gRPC](./uni_grpc.md) to receive real-time updates from Centrifugo. This eliminates the need for a client connector that abstracts bidirectional communication.

However, the tradeoff is that with unidirectional transports, you won't get some of Centrifugo's advanced features implemented in bidirectional SDKs, such as dynamic subscriptions/unsubscriptions, automatic message recovery on reconnect, ability to send RPC to the backend over a persistent real-time connection.

Learn more about [unidirectional protocol](./uni_client_protocol.md) and available unidirectional transports.

## PING/PONG behavior

Centrifugo server periodically sends pings to clients and expects pong from clients that works over bidirectional transports. Sending ping and receiving pong allows to find broken connections faster. Centrifugo sends pings on the Centrifugo client protocol level, thus it's possible for clients to handle ping messages on the client side to make sure connection is not broken (our bidirectional SDKs do this automatically).

Here is a scheme how ping/pong works in bidirectional and unidirectional client scenarios:

![](/img/ping_pong.png)

By default Centrifugo sends pings every 25 seconds. This may be changed using `client.ping_interval` option ([duration](../server/configuration.md#setting-time-duration-options), default `"25s"`).

Centrifugo expects pong message from bidirectional client SDK after sending ping to it. By default, it waits no more than 8 seconds before closing a connection. This may be changed using `client.pong_timeout` option ([duration](../server/configuration.md#setting-time-duration-options), default `"8s"`).

In most cases default ping/pong intervals are fine so you don't really need to tweak them. Reducing timeouts may help you to find non-gracefully closed connections faster, but will increase network traffic and CPU resource usage since ping/pongs are sent faster.

:::caution

When overriding default values make sure that `client.ping_interval` is greater than `client.pong_timeout` – this is required by the current server implementation.

:::

Example of configuration:

```json title="config.json"
{
  "client": {
    "ping_interval": "25s",
    "pong_timeout": "8s"
  }   
}
```
