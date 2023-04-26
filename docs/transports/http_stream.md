---
id: http_stream
title: HTTP streaming, with bidirectional emulation
sidebar_label: HTTP streaming
---

HTTP streaming connection endpoint in Centrifugo is:

```
/connection/http_stream
```

:::info

This transport is only implemented by our Javascript SDK at this point – as it mostly makes sense as a fallback for WebSocket to have real-time connection in an environment where WebSocket is unavailable. These days those envs are mostly corporate networks which can block WebSocket traffic (even TLS-based).

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
