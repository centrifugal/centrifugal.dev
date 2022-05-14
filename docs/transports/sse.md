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
