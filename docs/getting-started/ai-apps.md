---
description: "How Centrifugo fits into AI application architectures — LLM token streaming, multi-subscriber sessions, reconnect recovery, and transactional publishing."
id: ai_apps
title: Centrifugo for AI apps
---

This page covers how Centrifugo fits into AI application architectures — primarily LLM token streaming, but also multi-subscriber session management, reconnect recovery, and transactional publishing.

Centrifugo is language- and framework-agnostic: your backend publishes events through the server API and Centrifugo handles delivery to connected clients, regardless of what language or framework runs your inference pipeline. The same concepts — channels, history, presence, reconnect recovery — apply the same way across different projects and stacks.

Hosted pub/sub services typically price per message or per connection-minute. At AI token-streaming volumes that can become significant; running Centrifugo on your own infrastructure avoids per-message billing entirely.

## Examples

We've covered AI transport scenarios in the Centrifugo blog:

- **[Streaming AI responses with Centrifugo](/blog/2025/06/17/streaming-ai-gpt-responses-with-centrifugo)** — end-to-end tutorial streaming GPT-3.5 responses with FastAPI and temporary channels.
- **[Scaling AI token streams with Centrifugo](/blog/2026/03/01/scaling-ai-token-streams-with-centrifugo)** — covers reconnect recovery, multi-tab synchronization, transport fallbacks, and horizontal scaling with Redis. Source on [GitHub](https://github.com/centrifugal/examples/tree/master/v6/scale-ai).

For the transactional-publishing angle — where the assistant message row and the published event commit together in one PostgreSQL transaction — see the [PostgreSQL stream broker post](/blog/2026/05/24/pg-stream-broker-benefits).

## When to use Centrifugo for AI workloads

Consider Centrifugo when your use case involves:

- Multiple subscribers per session (user + operator + audit log).
- Reconnect recovery without writing custom catch-up logic.
- Multiple transports (WebSocket, SSE, HTTP streaming, WebTransport).
- Binary protocol for high-throughput token streams.
- Transactional publishing tied to your application database.
- Keeping LLM credentials and traffic within your own network.
- Online presence across a session.
- No per-message billing.

For a simple single-user chat without reconnect recovery or observers, streaming directly from the LLM provider to the browser via SSE is more straightforward. Centrifugo is relevant when you need capabilities beyond what a direct stream provides.
