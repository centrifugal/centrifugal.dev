---
id: http_stream
title: HTTP streaming, with bidirectional emulation
sidebar_label: HTTP streaming
---

HTTP streaming is a technique based on using a long-lived HTTP connection between a client and a server with a chunked transfer encoding. Usually it only allows unidirectional flow of messages from server to client but with [Centrifugo bidirectional emulation layer](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#modern-websocket-emulation-in-javascript) it may be used as a full-featured fallback or alternative to WebSocket.

Can be enabled using:

```json title=config.json
{
  "http_stream": {
    "enabled": true
  }
}
```

HTTP-streaming connection endpoint in Centrifugo is:

```
/connection/http_stream
```

:::info

This transport is only implemented by our Javascript SDK at this point. Internally it uses modern [Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [Readable Streams](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) API. HTTP-streaming fully supports binary transfer using our Protobuf protocol.

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

Make sure [allowed_origins](../server/configuration.md#clientallowed_origins) are properly configured.

:::

## Options

### http_stream.enabled

Boolean, default: `false`.

Enables HTTP streaming endpoint. And enables emulation endpoint (`/emulation` by default) to accept emulation HTTP requests from clients.

```json title="config.json"
{
    ...
    "http_stream": {
        "enabled": true
    }
}
```

When enabling `http_stream` you can connect to `/connection/http_stream` from `centrifuge-js`. Note that our bidirectional emulation also uses `/emulation` endpoint of Centrifugo to send requests from client to server. This is required because HTTP streaming is a unidirectional transport in its nature. So we use HTTP call to send data from client to server and proxy this call to the correct Centrifugo node which handles the connection. Thus achieving bidirectional behaviour - see details about [Centrifugo bidirectional emulation layer](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#modern-websocket-emulation-in-javascript). Make sure `/emulation` endpoint is available for requests from the client side too. If required, you can also control both HTTP streaming connection url prefix and emulation endpoint prefix, see [customizing endpoints](../server/configuration.md#customize-handler-endpoints).

### http_stream.max_request_body_size

Default: 65536 (64KB)

Maximum allowed size of a initial HTTP POST request in bytes.
