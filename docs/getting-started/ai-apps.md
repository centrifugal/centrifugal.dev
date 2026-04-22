---
description: "Centrifugo for AI applications — a transport-agnostic, reconnect-resilient, fan-out-capable, and transactional realtime layer for LLM token streaming, agent sessions, and collaborative AI experiences."
id: ai_apps
title: Centrifugo for AI apps
---

Centrifugo for AI apps — transport-agnostic, reconnect-resilient, fan-out-capable.

AI applications stream thousands of tokens per session across thousands of sessions per day. On hosted pub/sub services, that bill scales linearly with message volume and connection time. Self-hosted Centrifugo runs on infrastructure you already own — at AI-workload scale, it is fundamentally cheaper than any per-message cloud pricing model.

## Examples

We've covered AI transport scenarios in the Centrifugo blog:

- **[Streaming AI responses with Centrifugo](/blog/2025/06/17/streaming-ai-gpt-responses-with-centrifugo)** — end-to-end tutorial streaming GPT-3.5 responses with FastAPI and temporary channels. Start here for the basic pattern.
- **[Scaling AI token streams with Centrifugo](/blog/2026/03/01/scaling-ai-token-streams-with-centrifugo)** — interactive playground covering recovery after disconnects, multi-tab synchronization, transport fallbacks, and horizontal scaling with Redis. Source on [GitHub](https://github.com/centrifugal/examples/tree/master/v6/scale-ai).

For the transactional-publishing angle — where the assistant message row and the published event commit together in one PostgreSQL transaction — see the [PostgreSQL stream broker post](/blog/2026/04/10/pg-stream-broker-benefits).

## When to reach for Centrifugo for AI

Centrifugo earns its place in the stack when you need any of:

- Multiple subscribers per session (user + operator + audit log).
- Reconnect resilience without writing your own catch-up logic.
- Multi-transport reach (WebSocket + SSE + HTTP streaming + WebTransport).
- Binary protocol for token-dense workloads.
- Transactional coupling between AI events and your application database.
- Control over where LLM credentials live and which network traffic crosses.
- Online presence to see all users connected to a session.
- A realtime layer that does not charge per message.

For a single-user chat with no reconnect recovery and no observers, a direct SSE from the LLM provider to the browser is simpler. Every step beyond that pushes toward a realtime layer — and Centrifugo is fit for that purpose with no AI-specific protocol additions required.
