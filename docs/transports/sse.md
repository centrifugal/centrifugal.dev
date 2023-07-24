---
id: sse
title: SSE (EventSource), with bidirectional emulation 
sidebar_label: SSE (EventSource)
---

[Server-Sent Events or EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) is a well-known HTTP-based transport available in all modern browsers and loved by many developers. It's unidirectional in its nature but with [Centrifugo bidirectional emulation layer](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#modern-websocket-emulation-in-javascript) it may be used as a fallback or alternative to WebSocket.

SSE (EventSource) connection endpoint in Centrifugo is:

```
/connection/sse
```

:::info

This transport is only implemented by our Javascript SDK. 

:::

Here is an example how to use JavaScript SDK with WebSocket as the main transport and SSE transport fallback:

```javascript title="Use SSE with bidirectional emulation as a fallback for WebSocket in JS SDK"
const transports = [
    {
        transport: 'websocket',
        endpoint: 'ws://localhost:8000/connection/websocket'
    },
    {
        transport: 'sse',
        endpoint: 'http://localhost:8000/connection/sse'
    }
];
const centrifuge = new Centrifuge(transports);
centrifuge.connect()
```

:::danger

Make sure [allowed_origins](../server/configuration.md#allowed_origins) are properly configured.

:::

## Options

### sse

Boolean, default: `false`.

Enables SSE (EventSource) endpoint. And enables emulation endpoint (`/emulation` by default) to accept emulation HTTP requests from clients.

```json title="config.json"
{
    ...
    "sse": true
}
```

### sse_max_request_body_size

Default: 65536 (64KB)

Maximum allowed size of a initial HTTP POST request in bytes when using HTTP POST requests to connect (browsers are using GET so it's not applied).
