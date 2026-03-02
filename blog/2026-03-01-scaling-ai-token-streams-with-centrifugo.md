---
title: Scaling AI token streams with Centrifugo
tags: [centrifugo, ai, streaming, tutorial, websocket, sse]
description: An interactive demo playground demonstrating what Centrifugo brings to AI token streaming — channel multiplexing, recovery, multi-tab sync, transport fallbacks, and horizontal scaling with Redis.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/scale_ai.jpg
hide_table_of_contents: false
---

<img src="/img/scale_ai.jpg" />

In a [previous post](/blog/2025/06/17/streaming-ai-gpt-responses-with-centrifugo) we showed how to stream LLM responses through Centrifugo — backend receives tokens from an LLM API, publishes them to a channel, browser subscribes and renders text as it arrives.

<!--truncate-->

That post covered the basics. This one looks at what Centrifugo adds beyond just delivering tokens from point A to point B — automatic recovery after disconnects, horizontal scaling, transport flexibility, and multi-tab synchronization backed by a database. We built an interactive playground demo that demonstrates the concepts – you can run it locally and see every feature in action.

## The playground

The source code is on [GitHub](https://github.com/centrifugal/examples/tree/master/v6/scale-ai). Run it:

```bash
git clone https://github.com/centrifugal/examples.git
cd examples/v6/scale-ai
docker compose up --build
```

Open [http://localhost:9000](http://localhost:9000).

The playground simulates an AI token stream without requiring an actual LLM API. You control the token rate, total token count, and other parameters. The backend picks a random AI-related question, generates random words as the "answer", and publishes them to Centrifugo — the delivery path is identical to a real LLM integration.

The architecture:

```
                 ┌─────────────────────┐
                 │    nginx  :9000     │
                 └──┬───────────────┬──┘
                    │               │
                    ▼               ▼
┌──────────┐   ┌─────────┐   ┌────────────┐   ┌───────┐
│ postgres │◀──│ backend │──▶│ centrifugo │──▶│ redis │
└──────────┘   │  :5000  │   │   :8000    │   └───────┘
               └─────────┘   └────────────┘
```

Nginx serves the frontend and proxies `/api` to the backend, `/connection` and `/emulation` to Centrifugo. The backend publishes tokens via Centrifugo HTTP API and persists stream state in PostgreSQL. The frontend subscribes to channels using centrifuge-js.

Let's walk through each feature.

## 1. Token streaming and aggregation

Start a stream with default settings: 30 tokens/sec, 100 tokens total. Tokens appear in real-time in the output area. The stats bar shows messages and tokens incrementing.

<!-- VIDEO: baseline streaming — start stream with defaults, tokens flowing, stats incrementing -->
<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/scale_ai_baseline.mp4"></video>

This is the simplest case — one token per message, one message per publish call to Centrifugo HTTP API:

```python
async def publish_to_centrifugo(channel: str, data: dict):
    await http_client.post(
        CENTRIFUGO_API_URL,
        json={"channel": channel, "data": data},
        headers={"X-API-Key": CENTRIFUGO_API_KEY},
    )
```

On the client side, the subscription receives each token:

```javascript
subscription.on('publication', (ctx) => {
    const msg = ctx.data;
    if (msg.text) {
        appendText(msg.text + ' ');
    }
});
```

With default settings, 100 tokens = 100 messages. You could achieve this with plain SSE — one endpoint, one event stream. But production AI streaming hits problems that SSE alone doesn't solve: what happens when the connection drops mid-stream? When the user switches networks? When you need to scale beyond one server? When multiple tabs need the same stream? The rest of this post walks through how Centrifugo handles each of these at the infrastructure layer.

Before moving on — try toggling "Publisher-side aggregation" in the controls, set it to 5, and start a new stream.

<!-- VIDEO: aggregation — toggle aggregation to 5, start stream, show message count ~20 vs token count 100 -->
<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/scale_ai_aggregation.mp4"></video>

The token count still reaches 100, but the message count drops to ~20. The backend buffers N tokens and publishes them as a batch. At 80 tokens/sec with aggregation of 5, you go from 80 to 16 publish calls per second per stream — fewer syscalls at every layer, and the text still flows naturally. This is a general technique, not Centrifugo-specific, but it composes well with Centrifugo's delivery.

## 2. Stream recovery

Start a stream and click "Simulate Disconnect" while tokens are flowing. You'll see:

1. `[DISCONNECTED]` marker — the client called `centrifuge.disconnect()`
2. Then 2.5 second gap — tokens keep being published by the backend, but the client isn't connected
3. `[RECONNECTING...]` marker — the client calls `centrifuge.connect()`
4. `[RECOVERED]` marker — all missed tokens arrive at once, the stream continues

<!-- VIDEO: recovery — start stream, click Simulate Disconnect mid-stream, show markers and tokens catching up -->
<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/scale_ai_recovery.mp4"></video>

The recovery detection on the client:

```javascript
subscription.on('subscribed', (ctx) => {
    if (ctx.wasRecovering && ctx.recovered) {
        appendMarker(' [RECOVERED] ', 'text-green-400');
    }
});
```

This is Centrifugo's [history-based recovery](/docs/server/history_and_recovery). The channel is configured with `history_size: 500` and `force_recovery: true`. When the client reconnects, Centrifugo sends all publications that were missed during the disconnect. The client SDK handles this transparently — the `publication` event fires for each missed message in order.

In the playground we call `disconnect()` and `connect()` manually to make the gap visible. In a real application you wouldn't do this — Centrifugo SDKs have built-in reconnect with exponential backoff. When the network drops, the client reconnects automatically and recovery happens without any application code involved. The SDK handles the full cycle: detect disconnect, reconnect, re-subscribe, recover missed messages.

Building this from scratch is a real project: reconnect logic, offset tracking on the client, message buffering on the server, a catch-up protocol. With Centrifugo it's a config option and SDK behavior you get out of the box.

Mobile networks drop, laptops sleep, WiFi switches. Users won't notice a brief gap if the response continues from where it left off.

## 3. Redis for scaling and persistence

The playground already runs Centrifugo with Redis as the engine:

```json
{
  "engine": {
    "type": "redis",
    "redis": {
      "address": "redis:6379"
    }
  }
}
```

This is what makes recovery work — channel history is stored in Redis, not in Centrifugo's process memory. If you restart Centrifugo while a stream is active, recovery still works because the history survives in Redis.

Redis also decouples the real-time layer from the backend. The backend publishes tokens to Centrifugo via HTTP API, then moves on — it doesn't hold WebSocket connections, doesn't track who's listening, doesn't buffer messages. Centrifugo and Redis handle all of that. This means you can scale each layer independently: add more backend instances to handle more concurrent LLM calls, add more Centrifugo nodes to handle more subscribers. They share state through Redis — the backend publishes to any Centrifugo node, Redis routes messages to the node that holds the subscriber's connection.

The playground uses a single Redis and single Centrifugo instance, but the architecture is ready for horizontal scaling — just add more Centrifugo nodes pointing to the same Redis. In production, Centrifugo supports Redis Cluster and Redis Sentinel for high availability.

## 4. Transport fallbacks

The playground has a transport selector: WebSocket, HTTP Streaming, SSE. Try starting a stream with each — the token delivery works identically regardless of the transport underneath. If you switch transport mid-stream, recovery kicks in and delivers missed tokens, but the real point is that the application code doesn't change at all.

<!-- VIDEO: transport fallbacks — select SSE or HTTP Streaming, start stream, tokens flow the same way -->
<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/scale_ai_transport.mp4"></video>

```javascript
function buildTransports(type) {
    switch (type) {
        case 'websocket':
            return [{ transport: 'websocket', endpoint: `${proto}//${host}/connection/websocket` }];
        case 'http_stream':
            return [{ transport: 'http_stream', endpoint: `${httpProto}//${host}/connection/http_stream` }];
        case 'sse':
            return [{ transport: 'sse', endpoint: `${httpProto}//${host}/connection/sse` }];
    }
}
```

Why this matters: corporate networks often run TLS-intercepting proxies that terminate HTTPS, inspect traffic, and re-encrypt it. These proxies may not forward the HTTP `Upgrade` handshake that WebSocket requires — even when the original connection is over TLS. If your only transport is WebSocket, those users silently fail to connect. With Centrifugo, you configure SSE and HTTP-streaming as fallbacks. The client SDK can try transports in order and use the first one that connects.

From the application's perspective, nothing changes — the subscription API, recovery, channel multiplexing all work identically regardless of the underlying transport. The Centrifugo config to enable these:

```json
{
  "sse": { "enabled": true },
  "http_stream": { "enabled": true }
}
```

For SSE and HTTP-streaming, Centrifugo uses an emulation layer for the bidirectional part (subscribe/unsubscribe commands). Nginx needs to proxy the `/emulation` endpoint in addition to `/connection`.

A related point worth mentioning: services like OpenAI use SSE for streaming, partly because SSE over HTTP/2 lets multiple streams share a single TCP connection. Centrifugo supports [WebSocket over HTTP/2 (RFC 8441)](/docs/transports/websocket#websocket-over-http2-rfc-8441), where each WebSocket connection becomes an HTTP/2 stream inside a shared HTTP/2 connection. You get the multiplexing benefits of SSE/HTTP/2 while keeping bidirectional communication and Centrifugo features like recovery.

## 5. Multi-tab sync with PostgreSQL

The features above work within a single tab's lifecycle. But what happens when a user opens a second tab? Or navigates back to a page while a stream is still running? The tab needs to discover the active stream, catch up on tokens it missed, and continue receiving live updates.

The playground demonstrates this. Start a stream in one tab, then open a fresh tab — it automatically picks up the same stream, shows accumulated tokens, and continues with live ones.

<!-- VIDEO: multi-tab — two tabs side by side, start stream in one, second tab auto-discovers and shows same tokens -->
<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/scale_ai_multi_tabs.mp4"></video>

### How it works

The backend persists each stream in PostgreSQL — the question, accumulated answer, and status. Only two writes happen: an `INSERT` when the stream starts and an `UPDATE` when it finishes (with the complete answer and `status='done'`). No database writes during streaming — Centrifugo handles real-time delivery.

**Discovering streams on page load.** When a tab opens, it calls `GET /api/stream/active` to find the most recent stream. If the stream is still active, the tab joins it. If it's already done, the tab shows the full question and answer from the database.

**Discovering streams in real-time.** What about a tab that's already open when someone starts a new stream? Every tab subscribes to an `ai:notifications` channel. The backend publishes a notification there when a stream starts:

```python
await publish_to_centrifugo("ai:notifications", {
    "type": "stream_started",
    "id": stream_id,
    "channel": channel,
    "question": question,
})
```

When a tab receives this notification, it joins the new stream immediately — no polling, no page reload.

**Subscribing with catch-up.** Every tab — including the one that started the stream — subscribes to the stream's channel with `since: {offset: 0, epoch: ''}`. This tells Centrifugo to deliver all existing channel history through the normal recovery flow, then continue with live publications — all through the same `publication` handler, in order:

```javascript
const opts = { since: { offset: 0, epoch: '' } };
subscription = centrifuge.newSubscription(channel, opts);

subscription.on('publication', (ctx) => {
    // History and live publications arrive through the same handler, in order.
    processPublication(ctx);
});
```

No client-side buffering, no deduplication logic. Centrifugo's recovery mechanism handles the sequencing. This also eliminates the race condition between starting the stream and subscribing — even if the backend publishes tokens before the client subscribes, they arrive through history recovery.

Building this from scratch means implementing ordered pub/sub with offset tracking, fan-out to multiple subscribers, and a protocol to distinguish history replay from live delivery. Centrifugo provides all of these as built-in primitives.

### The pattern

This is a realistic pattern for combining a database with real-time delivery:

- **PostgreSQL** is the source of truth for completed conversations — query it to show past streams, build dashboards, or feed analytics.
- **Centrifugo** handles live token delivery and short-term history for mid-stream catch-up.
- **The backend stays stateless** — it writes to PG and publishes to Centrifugo, it doesn't hold client connections or track who is listening.

A new tab can appear at any point during a stream, catch up seamlessly, and continue with live tokens. This works because Centrifugo's core operation is fan-out: publish once, deliver to all subscribers on the channel. No extra work on the backend, no tracking of which tabs or devices are connected.

Practical cases: a user starts a conversation on desktop, picks up the phone, the response keeps streaming. Or a customer support scenario where an AI suggests responses and multiple agents see the same stream. These are all just N subscribers on one channel. And since Centrifugo supports channel multiplexing, the AI stream, a notifications feed, and presence indicators can all share a single WebSocket connection — each additional subscription is virtually free.

## Conclusion

Each of these features solves a real problem in AI streaming:

- **Recovery** handles the inevitable network disruptions without application-level complexity
- **Redis** decouples the real-time layer, enables horizontal scaling, and persists history
- **Transport fallbacks** ensure the service works in restricted network environments
- **Multi-tab sync with PostgreSQL** shows how Centrifugo pairs with a database — PG for durable state, Centrifugo for real-time delivery and catch-up

None of these are AI-specific features — they're general real-time infrastructure capabilities that happen to be exactly what AI token streaming needs. Implementing them from scratch is significant engineering work: retry logic, offset tracking, message buffering, transport negotiation, fan-out routing. Centrifugo provides them as a single infrastructure layer.
