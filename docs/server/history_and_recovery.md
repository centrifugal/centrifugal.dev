---
description: "How Centrifugo keeps a per-channel message history and automatically recovers missed publications after a disconnect — the design, the trade-offs, and how it maps to configuration."
id: history_and_recovery
title: Stream history and recovery
---

import RecoveryStormDiagram from '@site/src/components/RecoveryStormDiagram';
import RecoveryStreamDiagram from '@site/src/components/RecoveryStreamDiagram';
import RecoveryDecisionDiagram from '@site/src/components/RecoveryDecisionDiagram';
import RecoveryModesDiagram from '@site/src/components/RecoveryModesDiagram';

A real-time connection is *stateful*: the client holds a view of the world that it keeps up to date from a stream of messages. So the moment a connection drops, an awkward question appears — **"while I was gone, did I miss anything?"**

Centrifugo can answer that question itself. When a channel keeps a short history, Centrifugo remembers recent publications and **replays exactly the ones a returning client missed** — without touching your backend. This chapter is about how that works, why it's designed the way it is, and which configuration knobs control it.

It covers history and recovery for standard **stream** channels (the default subscription type). If you instead need keyed, synchronized state rather than a flowing message stream, see [map subscriptions](./map_subscriptions.md).

## Why recovery matters

The naive answer to "did I miss anything?" is: ask the database. One client doing that on reconnect is nothing. But WebSocket apps don't lose one connection at a time — a balancer reload, a deploy, or a network blip drops *everyone at once*, and they all reconnect within seconds. If every returning client queries your database to refresh its state, that **reconnect storm** turns into a thundering herd right when your system is already under stress.

Recovery breaks that link. Try toggling it:

<RecoveryStormDiagram />

Because the missed messages are served from Centrifugo's fast history broker, the database load from a mass reconnect drops to roughly zero. For setups with hundreds of thousands or millions of connections this can be the difference between a smooth redeploy and an outage. This idea — keeping a short, fast event stream per channel so clients can catch up without hitting the database — is explored in depth in [Scaling WebSocket](/blog/2020/11/12/scaling-websocket#message-event-stream-benefits) (see also [Massive reconnect](/blog/2020/11/12/scaling-websocket#massive-reconnect)).

## The history stream

Recovery is built on a simple structure: when history is enabled, every publication in a channel is appended to a **stream** — a bounded, ordered, sliding window of recent messages.

<RecoveryStreamDiagram />

Two values make the stream usable for catch-up:

* **`offset`** — an incremental `uint64` stamped on each publication. It's the message's position in the stream, and what a client uses to say "I'm up to here."
* **`epoch`** — an arbitrary string identifying *this particular* stream. It matters because a stream can be lost and recreated (a Memory-engine node restarts, a broker is cleared). After that, offsets start over from the beginning — so offset `10` in the new stream is a completely different message than offset `10` in the old one. A changed epoch is Centrifugo's way of saying "this is not the stream you were reading", so a stale offset is never trusted.

The window is deliberately bounded by two namespace options:

* [`history_size`](./channels.md#history_size) — how many recent publications to keep.
* [`history_ttl`](./channels.md#history_ttl) — how long to keep them.

Both must be greater than zero to enable history — setting only one does nothing. The design intent is that streams are **ephemeral**: they're created on the fly, they can expire, and they can be lost at any moment. That keeps history cheap, and it's why your main database should always remain the ultimate source of truth.

Where the data actually lives depends on the [broker](./engines.md): the Memory broker keeps the stream in process memory (gone on restart); the Redis broker stores it in a Redis Stream, inheriting Redis' persistence; the [PostgreSQL broker](./engines.md#postgresql-broker) stores it in Postgres. All are fast enough to absorb reconnect traffic — the trade-off between them is durability and operational fit, not whether recovery works. A separate [`history_meta_ttl`](./channels.md#history_meta_ttl) controls how long the lightweight stream metadata (its epoch and top offset) survives — kept longer than the data itself so a channel's identity outlives any single message.

:::important History is a cache, not your source of truth

Think of a channel's history as a **bounded cache of the most recent messages** — capped by `history_size`, aged out by `history_ttl`. It is deliberately *not* a durable message queue or an event log you can replay from the beginning of time, and it is never authoritative. It can be empty, truncated, or lost at any moment — so your application database stays the source of truth, and history is the fast shortcut that saves you from hitting it on every reconnect.

:::

:::tip

History is off by default. Enable it per namespace via [channel options](./channels.md#channel-options). Once on, it's available from both the [server API](./server_api.md) and (with permission) the client API.

:::

## How recovery works

With history in place, recovery is a small, automatic protocol on top of it. The SDK does the bookkeeping — for a [bidirectional client](../transports/client_protocol.md) you don't write any of this by hand:

1. On subscribe, the server returns the stream's current `epoch` and top `offset`. The SDK stores them.
2. As publications arrive, each carries the next `offset`; the SDK advances its saved position.
3. The connection drops. Messages may be published while the client is away.
4. On resubscribe, the SDK sends back the **last seen `epoch` and `offset`**.
5. Centrifugo looks at the stream and decides whether it can fill the gap from that position. If it can, the missed publications come back in the subscribe reply — in order and deduplicated — and the client sees `recovered: true`. If it can't, it returns `recovered: false` and no publications.

That `recovered` flag is the important output. It lets the application stay cheap in the common case and fall back to a full state load from the backend only when recovery genuinely couldn't keep continuity.

The position-tracking in steps 1–4 is done entirely by **bidirectional SDKs** — they hold the `epoch`/`offset` and replay it on resubscribe, so your application code never deals with offsets at all. **Unidirectional** transports (SSE, HTTP-streaming, unidirectional WebSocket) can't drive this themselves; for them Centrifugo can still deliver the latest state on every (re)subscribe via [cache recovery mode](./cache_recovery.md) with [`auto_cache_recover`](./channels.md#auto_cache_recover).

## The recovery decision

So when *can* Centrifugo recover? It comes down to two checks against the position the client sends back: is this the **same stream** (epoch matches), and is the gap **fully present** in history (no missing publications between the client's offset and the current top). Both must hold.

The scenarios below walk through what happens in practice — and which configuration option governs each outcome:

<RecoveryDecisionDiagram />

The common thread: Centrifugo never delivers a *partial* recovery. If it can't prove the client's view can be made whole, it says so with `recovered: false` rather than handing over a stream with a silent hole — and the application loads fresh state from its own database, exactly as it would on first load.

## Positioning: detecting loss proactively

Recovery handles the reconnect. Its sibling, **positioning**, handles the subtler case where a client *stays connected* but quietly falls behind — PUB/SUB brokers deliver at-most-once, so a message can be dropped without the connection noticing.

With [`force_positioning`](./channels.md#force_positioning) on, Centrifugo periodically checks each client's position against the stream top. If it detects a client can no longer be in a valid position (a potential gap), it disconnects with the `insufficient state` code (`3010`) — which is itself a *reconnect* signal, so the SDK comes back and runs the recovery flow above. Enabling recovery turns positioning on automatically, since the two work together: positioning notices the problem, recovery fixes it.

## Two recovery modes

Not every channel wants the same thing back. A chat needs **every** missed message; a "now playing" widget only needs the **latest** value. Centrifugo supports both via [`force_recovery_mode`](./channels.md#force_recovery_mode):

<RecoveryModesDiagram />

* **`stream`** (default) — replay all missed publications in order. The right choice when each message is an event that matters on its own: chats, feeds, activity logs.
* **`cache`** — deliver only the single latest publication. The right choice when each publication is a complete snapshot of state and only the current one matters: prices, dashboards, presence, "now playing". Typically paired with `history_size: 1`.

Cache mode effectively turns a channel into a real-time key-value cache and can remove the "fetch initial state" step entirely. It has its own chapter with configuration details and the automatic variant for unidirectional clients: [Cache recovery mode](./cache_recovery.md).

## Using recovery in your app

With a bidirectional SDK the application's only job is to react to the outcome on each (re)subscribe — the SDK has already replayed any missed publications through the `publication` handler. The `subscribed` event carries two flags (protocol fields `was_recovering` / `recovered`):

* **`wasRecovering`** — the client *asked* to recover (it came back with a saved position). It says nothing about success.
* **`recovered`** — recovery actually *succeeded*: the gap was filled with no loss. This can be `true` with **zero publications** replayed — if the client was already at the stream top, there was simply nothing to catch up on.

So `wasRecovering: true` with `recovered: false` is the meaningful "I tried to catch up but couldn't — reload from the backend" signal:

```javascript
sub.on('subscribed', (ctx) => {
  if (ctx.wasRecovering && !ctx.recovered) {
    loadOrdersFromBackend(); // continuity lost — reload full state
  }
});
```

One subtlety is worth knowing about for the common pattern of *loading initial state from your own database, then subscribing*: those two steps don't line up perfectly, so an update can slip through the gap between them (or arrive slightly late). There are a few ways to handle it — a version-based reconciliation in your own code is one (walked through in [reliable document state sync](/blog/2024/06/03/real-time-document-state-sync)). If you'd rather not hand-roll it, some SDKs offer an optional `getState` callback that wires the same idea in for you — read the stream position **first**, then load your data, and return the position so the SDK subscribes from exactly there and recovers on every reconnect:

```javascript
const sub = client.newSubscription('orders:42', {
  getState: async () => {
    const pos = await api.getStreamPosition('orders:42'); // 1. capture position FIRST
    renderOrders(await api.getOrders(42));                // 2. then load your data
    return { offset: pos.offset, epoch: pos.epoch };      // 3. SDK recovers from here on
  },
});
sub.on('publication', (ctx) => applyOrderUpdate(ctx.data));
sub.subscribe();
```

`getState` is one convenience for this, not a requirement. The broader point holds either way: when your own database is the source of truth and Centrifugo streams only the change events, you can combine the publication cache's reconnect-storm protection with a consistent view in every scenario. See [app-owned state with stream subscriptions](/blog/2026/05/24/pg-stream-broker-benefits#app-owned-state-with-stream-subscriptions) for more.

## Configuration recap

Everything above maps to a handful of namespace options:

| Option | Role |
|---|---|
| [`history_size`](./channels.md#history_size) | How many publications the stream keeps (window size) |
| [`history_ttl`](./channels.md#history_ttl) | How long publications are kept (window age) |
| [`history_meta_ttl`](./channels.md#history_meta_ttl) | How long the stream's epoch/offset metadata survives |
| [`force_recovery`](./channels.md#force_recovery) | Make subscriptions recoverable (implies positioning) |
| [`force_positioning`](./channels.md#force_positioning) | Detect dropped messages on live connections (`3010` on loss) |
| [`force_recovery_mode`](./channels.md#force_recovery_mode) | `stream` (all messages) or `cache` (latest only) |
| `client.recovery_max_publication_limit` | Cap on publications recovered in one go (default `300`) |

A minimal recoverable namespace:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "chat",
        "history_size": 100,
        "history_ttl": "300s",
        "force_recovery": true
      }
    ]
  }
}
```

Recovery can also be requested per-subscription from the client side instead of forced namespace-wide — in that case the client needs permission to access channel history.

## Trade-offs and guidance

Recovery is intentionally scoped to be a fast, broker-backed continuity mechanism, not a durable mailbox. Keep that in mind:

* **Keep streams small and short.** All missed publications come back in a single subscribe frame, so recovery is built for short disconnects — surviving a reconnect storm, not catching a client up after an hour offline. Size and TTL should reflect that.
* **Always keep a backend fallback.** Streams are ephemeral by design; on `recovered: false` (and on a fresh app load) the application should load full state from its own database. Recovery optimizes the common path — it doesn't replace your source of truth.
* **Tolerate duplicates.** Centrifugo currently returns recovered publications in order and without duplicates, but applications using recovery should be designed to tolerate an occasional repeat (e.g. a stable key in the payload).

Recovery shines for keeping the continuity of long-lived connections and shielding the backend from reconnect spikes. It's not the right tool for guaranteed, long-term delivery of every message — for that, design around your database.

## History iteration API

Automatic recovery is built *on top of* the same stream, but you can also read that stream yourself — directly, with no subscription involved. Centrifugo exposes a **history API** from the [server API](./server_api.md) (a `history` call) and from the client side (with [history permission](./channel_permissions.md#history-permission-model)). Use it to page through recent messages, or to read just the current top `offset` + `epoch` when building your own positioning logic. It's built on three fields:

* `limit`
* `since`
* `reverse`

Combining them lets you page through a stream in either direction:

```
history(limit: 0, since: null, reverse: false)     // just the current top offset + epoch
history(limit: -1, since: null, reverse: false)    // from the beginning (up to client.history_max_publication_limit, default 300)
history(limit: -1, since: null, reverse: true)     // from the end
history(limit: 10, since: null, reverse: false)    // first 10
history(limit: 10, since: null, reverse: true)     // last 10, newest first
history(limit: 10, since: {offset: 0, epoch: "epoch"}, reverse: false)   // 10 after a known position
history(limit: 10, since: {offset: 11, epoch: "epoch"}, reverse: true)   // 10 before a known position
```

Here's a Go program (using the [gocent](https://github.com/centrifugal/gocent) API library) that endlessly walks a stream, flipping direction each time it reaches an end — not practical, but it shows the pagination pattern:

```go
// Iterate by 10.
limit := 10
// Paginate in reversed order first, then invert it.
reverse := true
// Start with nil StreamPosition, then fill it with value while paginating.
var sp *gocent.StreamPosition

for {
	historyResult, err = c.History(
        ctx,
        channel,
		gocent.WithLimit(limit),
		gocent.WithReverse(reverse),
        gocent.WithSince(sp),
	)
	if err != nil {
		log.Fatalf("Error calling history: %v", err)
	}
	for _, pub := range historyResult.Publications {
		log.Println(pub.Offset, "=>", string(pub.Data))
		sp = &gocent.StreamPosition{
			Offset: pub.Offset,
			Epoch:  historyResult.Epoch,
		}
	}
	if len(historyResult.Publications) < limit {
		// Got all pubs, invert pagination direction.
		reverse = !reverse
		log.Println("end of stream reached, change iteration direction")
	}
}
```

## Rolling your own

Finally, recovery is opt-in convenience, not a cage. You can always bypass it and implement catch-up yourself on top of plain PUB/SUB — query your backend for fresh state after every resubscribe, or iterate the Centrifugo stream manually with the history API above. The automatic mechanism just saves you from writing that for the common case.
