---
id: sse
title: SSE (EventSource), with bidirectional emulation 
sidebar_label: SSE (EventSource)
---

SSE (EventSource) connection endpoint in Centrifugo is:

```
/connection/sse
```

:::info

This transport is only implemented by our Javascript SDK at this point – as it mostly makes sense as a fallback for WebSocket to have real-time connection in an environment where WebSocket is unavailable. These days those envs are mostly corporate networks which can block WebSocket traffic (even TLS-based).

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
