---
description: "Centrifugo unidirectional WebSocket transport: simple real-time message consumption without SDK dependency. Configuration, ping, and usage examples."
id: uni_websocket
title: Unidirectional WebSocket
sidebar_label: WebSocket
---

While WebSocket is a bidirectional transport in its nature, Centrifugo provides its unidirectional version too to give developers more choice in transports when using the unidirectional approach.

When using unidirectional WebSocket Centrifugo uses both native frame ping/pong mechanism and periodic Centrifugo protocol specific application-level pings. This combination allows to detect broken connections faster and still have server ping accessible for application-level logic.

## How to enable

```json title=config.json
{
  "uni_websocket": {
    "enabled": true
  }
}
```

## Default endpoint

Default unidirectional WebSocket connection endpoint in Centrifugo is:

```
/connection/uni_websocket
```

## Send connect request

Once the connection is established you should pass [ConnectRequest](./uni_client_protocol.md#connectrequest) as the first WebSocket message to the server. This allows Centrifugo to authenticate the connection.

Alternatively, since Centrifugo v6.3.0 you can use `cf_connect` URL query parameter to pass connection command in the URL itself. This way you can connect to unidirectional WebSocket endpoint without sending the first connect message from client to server. This works similar to what [Centrifugo has for unidirectional SSE](./uni_sse.md#send-connect-request) transport.

## Supported data formats

JSON

## Ping

Centrifugo uses empty commands (`{}` in JSON case) as pings for unidirectional WS. You can ignore such messages or use them to detect broken connections (nothing received from a server for a long time).

## `uni_websocket`

### `uni_websocket.enabled`

Boolean, default: `false`.

Enables unidirectional WebSocket endpoint.

```json title="config.json"
{
  "uni_websocket": {
    "enabled": true
  }
}
```

### `uni_websocket.message_size_limit`

Default: 65536 (64KB)

Maximum allowed size of a first connect message received from WebSocket connection in bytes.

### `uni_websocket.decompressed_message_size_limit`

Default: 0. Available since Centrifugo v6.8.4

Maximum allowed size of a message in bytes after `permessage-deflate` decompression for the unidirectional WebSocket transport. Only used when [`uni_websocket.compression`](#uni_websocketcompression) is enabled.

`uni_websocket.message_size_limit` alone only bounds the compressed bytes received on the wire, so without this limit a small compressed frame could be inflated into a much larger amount of memory (a "decompression bomb"). When set to `0` (the default), the limit is derived from `uni_websocket.message_size_limit` multiplied by the default multiplier (`10`). If a message exceeds the limit, Centrifugo closes the connection with a `message too big` close code.

### `uni_websocket.join_push_messages`

Boolean. Default: `false`. New in Centrifugo v6.0.3

Once the option is enabled, Centrifugo can join different messages going through unidirectional WebSocket into a single WebSocket frame. The messages are joined using the same approach as Centrifugo uses for bidirectional protocol. This means that for JSON case messages are joined with new line.

:::caution

In other words, you can benefit from message batching and less system calls (which is positive for server CPU usage). But your client side must be prepared to decode the WebSocket message into separate `Push` messages: For JSON case split by `\n`:

```javascript
const messages = data.trim().split('\n').map(r => JSON.parse(r));
```

Note, `trim` is important since message may end on `\n` too: `{}\n{}\n`.

:::

### `uni_websocket.disable_closing_handshake`

Default: `false`. Available since Centrifugo v6.5.1

`disable_closing_handshake` boolean option disables WebSocket closing handshake for unidirectional WebSocket transport. This restores the behavior prior to Centrifugo v6.5.1 where server never sent a close frame on connection close initiated by server. Normally closing handshake is recommended to be performed according to WebSocket protocol RFC, so this option is useful only in some specific cases when you need to restore the previous behavior.

### `uni_websocket.disable_disconnect_push`

Default: `false`. Available since Centrifugo v6.5.1

`disable_disconnect_push` boolean option disables sending disconnect push messages to clients. It's sent by default to make unidirectional transports consistent, but since the unidirectional WebSocket transport also sends a close frame to the client with the same code/reason – some users may want to disable disconnect push to avoid ambiguity.

### `uni_websocket.compression`

Same as for the bidirectional WebSocket transport, Centrifugo supports `permessage-deflate` compression for the unidirectional WebSocket transport. See [`websocket.compression`](./websocket.md#websocketcompression) for a general overview of WebSocket compression and its trade-offs.

To enable it set `uni_websocket.compression` to `true`. After this clients that support `permessage-deflate` will negotiate compression with server automatically. Note that enabling compression does not mean that every connection will use it - this depends on client support for this feature.

`uni_websocket.compression_min_size` (default `0`) is the minimal size of message in bytes for which `deflate` compression is used when writing it to the client's connection. Default value `0` means all messages are compressed when `uni_websocket.compression` is enabled and compression support is negotiated with the client.

`uni_websocket.compression_level` controls the [compress/flate](https://golang.org/pkg/compress/flate/#NewWriter) compression level. By default, when compression is negotiated, Centrifugo uses compression level 1 (BestSpeed).

## WebSocket over HTTP/2 (RFC 8441)

Same as for bidirectional WebSocket transport Centrifugo supports WebSocket over HTTP/2 (RFC 8441) for unidirectional WebSocket too. See [WebSocket over HTTP/2 (RFC 8441)](./websocket.md#websocket-over-http2-rfc-8441) for more details. It's enabled in the same way as for bidirectional WebSocket using `GODEBUG=http2xconnect=1` env var.

## Example

Let's connect to a unidirectional WebSocket endpoint using [wscat](https://github.com/websockets/wscat) tool – it allows connecting to WebSocket servers interactively from a terminal.

First, run Centrifugo with `uni_websocket` enabled. Also let's enable automatic personal channel subscriptions for users. Configuration example:

```json title="config.json"
{
  "client": {
    "token": {
      "hmac_secret_key": "secret"
    },
    "subscribe_to_user_personal_channel": {
      "enabled": true
    }
  },
  "uni_websocket": {
    "enabled": true
  }
}
```

Run Centrifugo:

```
./centrifugo -c config.json
```

In another terminal:

```
❯ ./centrifugo gentoken -c config.json -u test_user
HMAC SHA-256 JWT for user test_user with expiration TTL 168h0m0s:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXIiLCJleHAiOjE2MzAxMzAxNzB9.u7anX-VYXywX1p1lv9UC9CAu04vpA6LgG5gsw5lz1Iw
```

Install [wscat](https://github.com/websockets/wscat) and run:

```
wscat -c "ws://localhost:8000/connection/uni_websocket"
```

This will establish a connection with a server and you then can send connect command to a server:

```
❯ wscat -c "ws://localhost:8000/connection/uni_websocket"

Connected (press CTRL+C to quit)
> {"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXIiLCJleHAiOjE2NTY1MDMwNDV9.3UYL-UCUBp27TybeBK7Z0OenwdsKwCMRe46fuEjJnzI", "subs": {"abc": {}}}
< {"connect":{"client":"bfd28799-b958-4791-b9e9-b011eaef68c1","version":"0.0.0","subs":{"#test_user":{}},"expires":true,"ttl":604407,"ping":25,"session":"57b1287b-44ec-45c8-93fc-696c5294af25"}}
```

The connection will receive server pings (empty commands `{}`) periodically. You can try to publish something to `#test_user` or `abc` channels (using Centrifugo server API or using admin UI) – and the message should come to the connection we just established.
