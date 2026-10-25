---
description: "When direct SSE streaming of LLM responses breaks in production — Centrifugo adds resumable streams, multi-viewer sessions, transport fallback, and horizontal scale for AI apps."
id: ai_apps
title: Centrifugo for AI apps
---

Most AI apps start streaming the same way: the backend calls the model and pipes tokens straight to the browser over SSE (or a raw WebSocket). It's the approach in every tutorial, and for a single user watching a single generation it works well — if that's your case, [stream directly](#when-you-dont-need-centrifugo) and skip Centrifugo.

The trouble is what comes after the demo. Direct streaming breaks down on exactly the things a production AI app needs — and each of those is a primitive Centrifugo already provides, rather than custom catch-up code you write and maintain.

## Where direct streaming breaks

| In production you need… | With direct streaming | With Centrifugo |
|---|---|---|
| **Resume after a reload or a dropped connection** | the in-flight response is gone — nothing to replay | clients reattach and replay missed tokens via [history & recovery](../server/history_and_recovery.md) |
| **The same generation in more than one place** — the user's other tabs, a human operator, an audit log | a single stream can't fan out | publish once to a channel; every subscriber receives it |
| **Survive proxies and networks that drop SSE** | no fallback path | [WebSocket, SSE, HTTP-streaming, WebTransport](../transports/overview.md) with automatic fallback in the SDKs |
| **Scale past one backend node** | a token produced on node A can't reach a client connected to node B | horizontal scaling through a [Redis or NATS broker](../server/engines.md) |
| **Sane cost at token volume** | hosted pub/sub bills per message or connection-minute | self-hosted — no per-message billing |
| **Keep data and keys on your network** | prompts and provider API keys traverse a third-party SaaS | runs on your own infrastructure |

Every row is the same shape: the toy version doesn't need it, the real product does.

## How it fits

Centrifugo sits between your inference backend and your clients. Your backend stays in control of the model call and publishes tokens (or larger chunks) to a channel through the [server API](../server/server_api.md); Centrifugo delivers them to every connected subscriber over whatever transport each client uses. It's language- and framework-agnostic — it doesn't care whether your inference pipeline runs Python, Go, or anything else.

For high-throughput streams, the [binary Protobuf protocol](../transports/overview.md) keeps per-token overhead low. [Online presence](../server/presence.md) tracks who is attached to a session. And when an assistant message is persisted, the [PostgreSQL stream broker](../server/engines.md#postgresql-broker) can publish the realtime event inside the same database transaction as the row write — so the stored message and the delivered event never diverge.

## Configuring a channel for a stream

Publish a response from one place, in order, each publish call waiting for the previous one: calls made concurrently have no order. Publish in chunks — what the model produced in the last 50 ms or so — rather than one publication per token: a model emits up to hundreds of tokens a second, and 20 publications a second render just as smoothly at a fraction of the messages.

Give each response its own channel, in a namespace with history and recovery, so that a client which reconnects, or opens the page while the response is generated, replays it from the start. Size two limits for your longest response:

- [`history_size`](../server/channels.md#history_size) must hold the publications of a whole response.
- [`client.recovery_max_publication_limit`](../server/configuration.md#clientrecovery_max_publication_limit) is the most publications Centrifugo returns in one recovery: 300 by default, which is 15 seconds of streaming at 20 publications a second. A client which missed more is told the stream was not recovered (`recovered: false`) and gets none of it.

For responses of up to two and a half minutes at 20 publications a second:

```json title="config.json"
{
  "client": {
    "recovery_max_publication_limit": 3000
  },
  "channel": {
    "namespaces": [
      {
        "name": "ai",
        "history_size": 3000,
        "history_ttl": "10m",
        "force_recovery": true
      }
    ]
  }
}
```

Once a response is complete, store it with the conversation and serve it from there: history is for the stream in flight.

Publishing the whole response so far with [delta compression](../server/delta_compression.md) and [cache recovery](../server/cache_recovery.md) instead lets a late client get one message rather than every chunk. But the backend then sends the growing text with every publication — for a response of a few thousand tokens, over a hundred times its size — and live subscribers, receiving deltas, get more bytes than chunks would send them. Chunks are the better default.

## Examples

- **[Streaming AI responses with Centrifugo](/blog/2025/06/17/streaming-ai-gpt-responses-with-centrifugo)** — end-to-end tutorial streaming GPT responses with FastAPI and temporary channels.
- **[Scaling AI token streams with Centrifugo](/blog/2026/03/01/scaling-ai-token-streams-with-centrifugo)** — reconnect recovery, multi-tab synchronization, transport fallbacks, and horizontal scaling with Redis. Source on [GitHub](https://github.com/centrifugal/examples/tree/master/v6/scale-ai).
- **[Transactional publishing with the PostgreSQL stream broker](/blog/2026/05/24/pg-stream-broker-benefits)** — committing the stored message and the published event in one transaction.

## When you don't need Centrifugo

For a single user watching a single generation — no reconnect recovery, no observers, one backend node — streaming straight from the model provider to the browser over SSE is simpler, and you should use that. Centrifugo earns its place once you need resumable streams, fan-out to multiple viewers, transport flexibility, or scale beyond one node.
