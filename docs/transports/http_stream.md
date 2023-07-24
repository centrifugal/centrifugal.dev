---
id: http_stream
title: HTTP streaming, with bidirectional emulation
sidebar_label: HTTP streaming
---

HTTP streaming is a technique based on using a long-lived HTTP connection between a client and a server with a chunked transfer encoding. Usually it only allows unidirectional flow of messages from server to client but with [Centrifugo bidirectional emulation layer](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#modern-websocket-emulation-in-javascript) it may be used as a full-featured fallback or alternative to WebSocket.

HTTP-streaming connection endpoint in Centrifugo is:

```
/connection/http_stream
```

:::info

This transport is only implemented by our Javascript SDK. Internally it uses modern [Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [Readable Streams](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) API. HTTP-streaming fully supports binary transfer using our Protobuf protocol.

:::

Here is an example how to use JavaScript SDK with WebSocket as the main transport and HTTP-streaming transport fallback:

```javascript title="Use HTTP-streaming with bidirectional emulation as a fallback for WebSocket in JS SDK"
const transports = [
    {
        transport: 'websocket',
        endpoint: 'ws://localhost:8000/connection/websocket'
    },
    {
        transport: 'http_stream',
        endpoint: 'http://localhost:8000/connection/http_stream'
    }
];
const centrifuge = new Centrifuge(transports);
centrifuge.connect()
```

:::danger

Make sure [allowed_origins](../server/configuration.md#allowed_origins) are properly configured.

:::

## Options

### http_stream

Boolean, default: `false`.

Enables HTTP streaming endpoint. And enables emulation endpoint (`/emulation` by default) to accept emulation HTTP requests from clients.

```json title="config.json"
{
    ...
    "http_stream": true
}
```

### http_stream_max_request_body_size

Default: 65536 (64KB)

Maximum allowed size of a initial HTTP POST request in bytes.
