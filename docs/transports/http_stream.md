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
