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

When enabling `sse` you can connect to `/connection/sse` from `centrifuge-js`. Note that our bidirectional emulation also uses `/emulation` endpoint of Centrifugo to send requests from client to server. This is required because SSE/EventSource is a unidirectional transport in its nature. So we use HTTP call to send data from client to server and proxy this call to the correct Centrifugo node which handles the connection. Thus achieving bidirectional behaviour - see details about [Centrifugo bidirectional emulation layer](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#modern-websocket-emulation-in-javascript). Make sure `/emulation` endpoint is available for requests from the client side too. If required, you can also control both SSE connection url prefix and emulation endpoint prefix, see [customizing endpoints](../server/configuration.md#customize-handler-endpoints).

### sse_max_request_body_size

Default: 65536 (64KB)

Maximum allowed size of a initial HTTP POST request in bytes when using HTTP POST requests to connect (browsers are using GET so it's not applied).
