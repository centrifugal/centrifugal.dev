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

Centrifugo sits between your inference backend and your clients. Your backend stays in control of the model call and publishes tokens (or larger chunks) to a channel through the [server API](../server/server_api.md) - with one of the [server SDKs](../server/server_sdks.md), in your backend's language; Centrifugo delivers them to every connected subscriber over whatever transport each client uses. It's language- and framework-agnostic — it doesn't care whether your inference pipeline runs Python, Go, or anything else.

For high-throughput streams, the [binary Protobuf protocol](../transports/overview.md) keeps per-token overhead low. [Online presence](../server/presence.md) tracks who is attached to a session. And when an assistant message is persisted, the [PostgreSQL stream broker](../server/engines.md#postgresql-broker) can publish the realtime event inside the same database transaction as the row write — so the stored message and the delivered event never diverge.

## Configuring a channel for a stream

Publish a response from one place, in order, each publish call waiting for the previous one: calls made concurrently have no order. Publish in chunks — what the model produced in the last 50 ms or so — rather than one publication per token: a model emits up to hundreds of tokens a second, and 20 publications a second render just as smoothly at a fraction of the messages.

Give each response its own channel, in a namespace with history and recovery, so that a client which reconnects, or opens the page while the response is generated, replays it from the start. Size two limits for your longest response:

- [`history_size`](../server/channels.md#history_size) must hold the publications of a whole response.
- [`recovery_max_publication_limit`](../server/channels.md#recovery_max_publication_limit) is the most publications Centrifugo returns in one recovery: 300 by default, which is 15 seconds of streaming at 20 publications a second. A client which missed more is told the stream was not recovered (`recovered: false`) and gets none of it. Set it on the namespace, so that other namespaces keep the default.

For responses of up to two and a half minutes at 20 publications a second:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "ai",
        "history_size": 3000,
        "history_ttl": "10m",
        "force_recovery": true,
        "recovery_max_publication_limit": 3000
      }
    ]
  }
}
```

Before Centrifugo v6.10.3 the limit can be set only for all namespaces at once, with [`client.recovery_max_publication_limit`](../server/configuration.md#clientrecovery_max_publication_limit).

Once a response is complete, store it with the conversation and serve it from there: history is for the stream in flight.

Publishing the whole response so far with [delta compression](../server/delta_compression.md) and [cache recovery](../server/cache_recovery.md) instead lets a late client get one message rather than every chunk. But the backend then sends the growing text with every publication — for a response of a few thousand tokens, over a hundred times its size — and live subscribers, receiving deltas, get more bytes than chunks would send them. Chunks are the better default.

### Responses longer than history: checkpoints

Sizing history and the recovery limit as above is enough for most responses. It has a limit, though: an agent working for minutes produces more chunks than is reasonable to keep and to replay. A checkpoint removes it, at the cost of storing the response in flight. While the response streams, the backend periodically stores the response so far, together with the stream position of the last publication it includes – in Redis, or next to the conversation in the database. Store the chunks merged, with the pieces of each text part joined into one, so the checkpoint stays about as small as the text.

A client which opens the conversation while the response is generated loads the checkpoint, renders it, and subscribes from its position – see [loading a conversation](#loading-a-conversation) below. So:

- history only has to cover what was published since the last checkpoint, plus a reconnect – not the whole response;
- a client joining mid-response receives the response so far at once, instead of every chunk of it.

## Loading a conversation

A client which opens a conversation needs two things joined without a gap: the stored conversation, with the response in flight, and every publication after it. The subscription option [`getState`](../transports/client_api.md#subscription-getstate) does the joining: the SDK calls it before subscribing, subscribes from the stream position it returns, and calls it again whenever the server can't recover what the client missed – after a long disconnect, or when the loaded checkpoint is older than what history still holds.

```javascript
const sub = centrifuge.newSubscription(`ai:${conversationId}`, {
  getState: async () => {
    // Your endpoint reads the channel position first, then the conversation.
    const conv = await fetch(`/api/conversations/${conversationId}`).then((r) => r.json());
    render(conv.messages, conv.checkpoint?.response);
    // A response in flight: continue from its checkpoint.
    return conv.checkpoint?.position ?? conv.position;
  },
});
sub.on('publication', (ctx) => applyChunk(ctx.data));
sub.subscribe();
```

The endpoint gets the channel position from the server API – a [`history`](../server/server_api.md#history) call without a limit returns just the position, which the [server SDKs](../server/server_sdks.md) give as a stream position (gocent: `res.Position()`) – and must read it **before** the conversation. In this order a publication made between the two reads may be loaded and delivered again, but is never lost: skip chunks the checkpoint already includes, for example by a sequence number in each publication.

## Stopping generation from every device

With the response generated on the backend and watched from several tabs or devices, stop should work from any of them, and stop the model call itself. The client asks your backend to stop the response; the backend publishes a cancel event into the response channel; the process generating the response – subscribed to the channel since the response started – aborts the model call. This works whichever backend instance received the request, and every viewer sees the response end at the same text.

## Examples

- **[Streaming AI responses with Centrifugo](/blog/2025/06/17/streaming-ai-gpt-responses-with-centrifugo)** — end-to-end tutorial streaming GPT responses with FastAPI and temporary channels.
- **[Scaling AI token streams with Centrifugo](/blog/2026/03/01/scaling-ai-token-streams-with-centrifugo)** — reconnect recovery, multi-tab synchronization, transport fallbacks, and horizontal scaling with Redis. Source on [GitHub](https://github.com/centrifugal/examples/tree/master/v6/scale-ai).
- **[Transactional publishing with the PostgreSQL stream broker](/blog/2026/05/24/pg-stream-broker-benefits)** — committing the stored message and the published event in one transaction.
- **[Chat with the Vercel AI SDK](https://github.com/centrifugal/examples/tree/master/v6/ai-sdk-chat)** — `useChat` over Centrifugo: a response survives reloads, every tab and device of a conversation shows it live, and stop works from any of them. Uses checkpoints and `getState`, with tests against a real Centrifugo.

## When you don't need Centrifugo

For a single user watching a single generation — no reconnect recovery, no observers, one backend node — streaming straight from the model provider to the browser over SSE is simpler, and you should use that. Centrifugo earns its place once you need resumable streams, fan-out to multiple viewers, transport flexibility, or scale beyond one node.
