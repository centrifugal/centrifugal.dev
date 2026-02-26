---
description: "Configure Centrifugo WebSocket transport: endpoints, message size limits, buffer settings, permessage-deflate compression, Protobuf protocol, and HTTP/2 support."
id: websocket
title: WebSocket
---

[Websocket](https://en.wikipedia.org/wiki/WebSocket) is the main transport in Centrifugo. It's a very efficient low-overhead protocol on top of TCP. Websocket works out of the box in all modern browsers and almost all programming languages have Websocket implementations. This makes Websocket an efficient universal real-time transport which can be used to connect to Centrifugo from almost everywhere.

## How to enable

Unlike other transports, WebSocket transport is enabled in Centrifugo by default. See below how to disable it if needed.

## Default endpoint

The default WebSocket connection endpoint in Centrifugo is:

```
/connection/websocket
```

To connect:

```javascript title="Connect to local Centrifugo with JavaScript SDK"
const client = new Centrifuge('ws://localhost:8000/connection/websocket', {
    // token: ?,
    // getToken: ?
});

client.connect();
```

## `websocket`

### `websocket.disabled`

Boolean, default: `false`.

### `websocket.message_size_limit`

Default: 65536 (64KB)

Maximum allowed size of a message received from WebSocket connection in bytes.

### `websocket.read_buffer_size`

In bytes, by default 0 which tells Centrifugo to reuse read buffer from HTTP server for WebSocket connection (usually 4096 bytes in size). If set to a lower value can reduce memory usage per WebSocket connection (but can increase number of system calls depending on average message size).

```json title="config.json"
{
    ...
    "websocket": {
        "read_buffer_size": 512
    }
}
```

### `websocket.write_buffer_size`

In bytes, by default 0 which tells Centrifugo to reuse write buffer from HTTP server for WebSocket connection (usually 4096 bytes in size). If set to a lower value can reduce memory usage per WebSocket connection (but HTTP buffer won't be reused):

```json title="config.json"
{
    ...
    "websocket": {
        "write_buffer_size": 512
    }
}
```

### `websocket.use_write_buffer_pool`

If you have a few writes then `websocket.use_write_buffer_pool` (boolean, default `false`) option can reduce memory usage of Centrifugo a bit as there won't be separate write buffer binded to each WebSocket connection.

### `websocket.compression`

Centrifugo supports `permessage-deflate` compression for websocket messages. Check out the [great article](https://www.igvita.com/2013/11/27/configuring-and-optimizing-websocket-compression/) about websocket compression for a general ovirview. WebSocket compression can reduce an amount of traffic travelling over the wire and reduce bandwidth costs.

:::caution

Enabling WebSocket compression may result in more CPU and memory usage by Centrifugo – depending on your load profile the increase may be notable. But it [can be still economically sufficient](/blog/2024/08/19/optimizing-websocket-compression) due to reduced bandwidth costs.

:::

To enable WebSocket compression for raw WebSocket endpoint set `websocket.compression` to `true` in a configuration file. After this clients that support `permessage-deflate` will negotiate compression with server automatically. Note that enabling compression does not mean that every connection will use it - this depends on client support for this feature.

Another option is `websocket.compression_min_size`. Default 0. This is a minimal size of message in bytes for which we use `deflate` compression when writing it to client's connection. Default value `0` means that we will compress all messages when `websocket.compression` enabled and compression support negotiated with client.

It's also possible to control websocket compression level defined at [compress/flate](https://golang.org/pkg/compress/flate/#NewWriter) By default when compression with a client negotiated Centrifugo uses compression level 1 (BestSpeed). If you want to set custom compression level use `websocket.compression_level` configuration option.

## Protobuf binary protocol

In most cases you will use Centrifugo with JSON protocol which is used by default. It consists of simple human-readable frames that can be easily inspected. Also it's a very simple task to publish JSON encoded data to HTTP API endpoint. You may want to use binary Protobuf client protocol if:

* you want less traffic on wire as Protobuf is very compact
* you want maximum performance on server-side as Protobuf encoding/decoding is very efficient
* you can sacrifice human-readable JSON for your application

To enable Protobuf protocol WebSocket clients should use `centrifuge-protobuf` subprotocol in the WebSocket Upgrade.

After doing this Centrifugo will use binary frames to pass data between client and server. Your application specific payload can be random bytes.

:::tip

You still can continue to encode your application specific data as JSON when using Protobuf protocol thus have a possibility to co-exist with clients that use JSON protocol on the same Centrifugo installation inside the same channels.

:::

## WebSocket over HTTP/2 (RFC 8441)

Since Centrifugo v6.5.0.

Centrifugo provides an experimental support for establishing WebSocket connections over HTTP/2 transport as described in [RFC 8441](https://datatracker.ietf.org/doc/html/rfc8441). In that case each WebSocket connection is a separate HTTP/2 stream inside a single HTTP/2 connection.

Why this may be important:

* allows using WebSocket connections in environments where only HTTP/2 traffic is allowed (for example, some mobile networks or corporate networks).
* allows multiplexing multiple WebSocket connections over a single HTTP/2 connection thus reducing number of TCP connections from client to Centrifugo server.
* reduces TLS handshake latency overhead when using secure connections (WSS) as multiple WebSocket connections can share a single TLS session (saving 2 RTT).

To enable WebSocket over HTTP/2 support in Centrifugo:

* Go runtime environment variable `GODEBUG=http2xconnect=1` must be set. Once Go has another way to enable this feature we will update Centrifugo in order to provide a more convenient way to enable it.
* Server must be run with [TLS enabled](../server/configuration.md#http_servertls) as HTTP/2 is available only for HTTPS servers. It's possible to also enable H2C (HTTP/2 CLEARTEXT) in Centrifugo by setting `http_server.h2c_external` boolean configuration option to `true`.
* Note also, that in case of using any kind load balancer before Centrifugo – make sure it supports WebSocket over HTTP/2 proxying. Haproxy and Envoy support it.

All major browsers support WebSocket over HTTP/2 and will use it automatically when supported by server:

| Browser         | Version |
| --------------- | ------- |
| ✅ Chrome/Chromium | 67+     |
| ✅ Firefox         | 65+     |
| ✅ Safari          | 14.1+   |
| ✅ Edge            | 79+     |

## Debugging with Postman, wscat, etc

Centrifugo supports a special url parameter for bidirectional websocket which turns on using native WebSocket frame ping-pong mechanism instead of [server-to-client application level pings](./overview.md#pingpong-behavior) Centrifugo uses by default. This simplifies debugging Centrifugo protocol with tools like Postman, wscat, websocat, etc.

By default, it may be inconvenient due to the fact Centrifugo sends periodic ping message to the client (`{}` in JSON protocol scenario) and expects pong response back within some time period. Otherwise Centrifugo closes connection. This results in problems with mentioned tools because you had to manually send `{}` pong message upon ping message. So typical session in `wscat` could look like this:

```bash
❯ wscat --connect ws://localhost:8000/connection/websocket
Connected (press CTRL+C to quit)
> {"id": 1, "connect": {}}
< {"id":1,"connect":{"client":"9ac9de4e-5289-4ad6-9aa7-8447f007083e","version":"0.0.0","ping":25,"pong":true}}
< {}
Disconnected (code: 3012, reason: "no pong")
```

The parameter is called `cf_ws_frame_ping_pong`, to use it connect to Centrifugo bidirectional WebSocket endpoint like `ws://localhost:8000/connection/websocket?cf_ws_frame_ping_pong=true`. Here is an example which demonstrates working with Postman WebSocket where we connect to local Centrifugo and subscribe to two channels `test1` and `test2`:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/postman.mp4"></video>

You can then proceed to Centrifugo [admin web UI](/docs/server/admin_web), publish something to these channels and see publications in Postman.

Note, how we sent several JSON commands in one WebSocket frame to Centrifugo from Postman in the example above - this is possible since Centrifugo protocol supports batches of commands in line-delimited format.

We consider this feature to be used only for debugging, **in production prefer using our SDKs without using `cf_ws_frame_ping_pong` parameter** – because app-level ping-pong is more efficient and our SDKs detect broken connections due to it.
