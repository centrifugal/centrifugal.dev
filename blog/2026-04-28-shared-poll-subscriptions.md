---
title: "Shared poll subscriptions: O(unique items) polling with low-latency updates"
tags: [centrifugo, websocket, state-sync, polling]
description: Shared poll subscriptions move polling from clients to Centrifugo. Instead of 10,000 clients each hitting your backend every second, Centrifugo asks once per cycle for the union of items everyone is watching and fans the changes back out.
author: Alexander Emelin
image: /img/blog_shared_poll.jpg
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
date: 2026-04-28T10:00:00
hide_table_of_contents: false
---

import SharedPollDiagram from '@site/src/components/SharedPollDiagram';
import SharedPollPublishDiagram from '@site/src/components/SharedPollPublishDiagram';

What if 10,000 clients could stay up to date with just one backend request per second? That's the idea behind shared poll subscriptions.

Centrifugo's core model is push-based: your backend publishes to a channel, Centrifugo delivers it over persistent WebSocket connections, and [history and recovery](/docs/server/history_and_recovery) catch clients up after a reconnect. This is what we call **stream subscriptions** — the original and still the most common subscription type. They work well when your backend owns the writes, and they'll remain the foundation of most Centrifugo deployments. But there's a class of use cases where a different shape fits better — and unlocks properties push alone can't provide.

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_drones.mp4"></video>

<!--truncate-->

:::tip TL;DR

- Each Centrifugo node aggregates interest across all its connected clients and polls your backend once per cycle for the **union** of tracked keys — backend load scales with `O(unique items)`, not `O(clients)`.
- Clients use a single `SharedPollSubscription` and call `track()` / `untrack()` as items come into view. Per-key access is enforced via fast HMAC signatures verified locally on every track request.
- Three delivery tiers cover the latency spectrum: timer polling (zero integration), `shared_poll_publish` for instant push from the write path, and the PRO **notification fast path** (instant trigger, polled fetch).
- No inter-node PUB/SUB — each node polls and serves its own clients. A cluster that only uses shared poll needs no Redis or NATS.

:::

## When polling makes more sense than push

Consider a social feed where each post displays a live vote count. The data already lives in your database — the question is how to keep it fresh on every client's screen.

You could use stream subscriptions: publish to Centrifugo on every vote and subscribers see the update in real time. This works well for one feature, but it means every write path touching vote counts — every API endpoint, every background job, every migration script — has to call the publish API. As the number of live-updating fields grows (view counts, comment counts, stock levels, configuration flags), the integration surface grows with it. And it assumes you control the writes — third-party APIs, legacy systems, and databases shared across services often don't expose a hook.

In these cases teams reach for polling. Each client hits an endpoint every few seconds — simple, decoupled from writes, works with any data source. But at scale 10,000 clients per second is 10,000 requests per second, mostly returning unchanged data. That overhead is what usually pushes teams toward push-based systems in the first place.

## The inversion: server-side polling

Shared poll subscriptions move polling from clients to Centrifugo. Clients hold a persistent WebSocket connection (or HTTP-streaming/SSE fallback) and tell Centrifugo which items they care about. Centrifugo asks your backend on a configurable schedule, detects what changed, and pushes updates to interested clients.

Each client sees a different subset of items — different pages, scroll positions, search results — but many subsets overlap. Centrifugo aggregates interest across all connected clients on a node and polls only the union of tracked keys once per cycle. If 10,000 clients are watching overlapping sets that cover 200 unique posts, that's one request for 200 items, fanned out — O(unique items), not O(clients).

<SharedPollDiagram />

Your backend just needs one endpoint that answers "here is the current data for these keys." It's a standard Centrifugo [proxy](/docs/server/proxy) — same shape as subscribe or publish proxies. No publish calls, no event hooks, no coupling to the write path: if you can read the data, you can serve it through shared poll.

## Per-item tracking without per-item channels

Before shared poll, the natural Centrifugo approach would be a channel per item — one for each post's vote count. Channels are lightweight and ephemeral, so creating many is fine server-side. The cost lands on the client: a feed with 50–100 visible posts means 50–100 active subscriptions, each with its own subscribe/unsubscribe frame, signature, recovery state, and position tracking. Across thousands of concurrent users that adds up on both ends of the wire.

A single channel for "all vote updates" solves the overhead problem but creates a different one: every client receives every update, regardless of which posts they're actually viewing. With millions of posts and thousands of clients, most of the data delivered is irrelevant.

Shared poll subscriptions give per-item granularity without per-item channels. The client creates one subscription, then tracks and untracks specific keys as the user scrolls:

```javascript
const sub = client.newSharedPollSubscription('post_votes:feed1', {
  getSignature: async (ctx) => {
    const resp = await fetch('/api/sign-poll', {
      method: 'POST',
      body: JSON.stringify({ keys: ctx.keys }),
    });
    return resp.json();
  },
});

sub.on('update', (ctx) => {
  ctx.removed ? hideVoteWidget(ctx.key) : updateVoteWidget(ctx.key, ctx.data);
});

sub.subscribe();
sub.track(getVisiblePostIds());
```

One subscription, arbitrary number of tracked keys; the server only polls items that at least one client is watching. The SDK exposes a dedicated `SharedPollSubscription` type with `track`, `untrack`, and `trackedKeys` — purpose-built rather than flags on the regular subscription. Server-side, shared poll is configured through the standard [channel namespace](/docs/server/channels) system: set `subscription_type: "shared_poll"` on a namespace and configure the polling interval, batch size, and backend proxy. The internal per-key routing that powers instant `shared_poll_publish` delivery is hidden behind the same `track()` call.

## Authorization with HMAC signatures

Per-item granularity raises an authorization question: how do you control which items a client can track? Centrifugo's existing [connection](/docs/server/authentication) and [channel](/docs/server/channel_token_auth) tokens operate at channel level — but a shared poll client subscribes to one channel and tracks many keys within it.

Shared poll uses HMAC signatures rather than JWTs. Tracked keys are first-class values in the protocol (not buried in a token payload), and HMAC is an order of magnitude faster to generate and verify — which matters when thousands of clients refresh signatures every poll cycle. When the client calls `track()`, the SDK invokes a `getSignature` callback; your backend decides which of the requested keys the user is allowed to see and signs that subset. Centrifugo verifies the HMAC on every track request.

The signature binds user, channel, key set, and a time window — it can't be reused for different keys or different users, and it expires. If `getSignature` returns fewer keys than the client requested, the omitted keys are treated as revoked: the SDK emits removal events and stops tracking them, so access revocation propagates on the next refresh without any server push. Apply your existing RBAC or row-level security inside `getSignature` — Centrifugo enforces whatever decisions your backend makes.

## Versionless and versioned modes

The backend refresh endpoint can be as simple or as sophisticated as your data allows. The simplest integration is versionless mode: your endpoint receives a list of keys and returns `{key, data}` pairs. Centrifugo detects changes by comparing content hashes internally. The backend doesn't need to track versions — it just returns current state.

```json
{
  "result": {
    "items": [
      {"key": "post_123", "data": {"votes": 42}},
      {"key": "post_456", "data": {"votes": 7}}
    ]
  }
}
```

This is enough for most use cases. But if your data already has versions (a database sequence number, a timestamp, a monotonic counter), versioned mode unlocks additional capabilities. Centrifugo includes the last known version in each request, allowing your backend to skip unchanged items — reducing response size and database load. Versioned mode also pairs cleanly with [direct publish](#direct-publish-instant-when-you-have-it-polled-when-you-dont) for instant delivery, since versions coordinate which keys are already fresh.

## Direct publish: instant when you have it, polled when you don't

The polling model accepts a latency trade-off: updates arrive within the polling interval rather than instantly. For vote counts and view counts, seconds of latency are fine. But sometimes your backend already has the data right after a database write and wants instant delivery.

The `shared_poll_publish` server API enables your backend to deliver data directly to tracking clients, bypassing the poll cycle entirely. Centrifugo delivers the data immediately and marks the key as "fresh" so the next poll cycle skips it, avoiding a redundant backend call.

This gives shared poll two delivery speeds: timer-based polling (seconds of latency, zero integration effort) and direct publish (instant, requires a publish call on the write path). The two complement each other — direct publish for speed, polling as the safety net. If a direct publish is missed (process crash, network issue), the next poll cycle picks it up.

<SharedPollPublishDiagram />

[Centrifugo PRO](/docs/pro/shared_poll#notification-fast-path) adds a third option: a **notification fast path**. Your backend sends a lightweight notification — just the channel and the keys that changed, no data — and Centrifugo immediately polls those specific keys from the backend, outside the regular cycle. This is useful when your backend knows *which* keys changed (e.g., from a database trigger or webhook) but doesn't have the data ready to publish directly. The three tiers — timer polling, notification-triggered polling, direct publish — range from zero integration to instant delivery.

## Quick initial data and reconnect resilience

Two design decisions make shared poll feel responsive despite being poll-based.

**Cold key auto-poll.** When a client tracks a key with version 0 ("I have no data") and no other connection on the same node is tracking that key, Centrifugo triggers an immediate backend poll for it — without waiting for the next scheduled cycle. Data arrives within milliseconds. This means the first user to view a post gets its vote count almost instantly, and subsequent users on the same node benefit from the cached state. No additional configuration is needed.

**Reconnect resilience.** Centrifugo has always been designed for graceful reconnection — stream subscriptions catch up from history, and the client SDKs handle the entire reconnect lifecycle transparently. Shared poll follows the same philosophy. When a client disconnects and reconnects, the SDK automatically replays all tracked keys using the existing signature and sends the last-known version for each key. Centrifugo compares versions and only pushes data that changed while the client was offline — avoiding a full data re-delivery. The `getSignature` callback is only invoked when the signature actually expires, not on every reconnect — preventing a mass backend request storm when thousands of clients reconnect simultaneously (e.g., after a load balancer restart).

**Publisher-restart resilience.** Versioned mode relies on monotonic versions — but a publisher process that resets its in-memory counter on restart would emit "stale" versions and connected clients would freeze on their last-seen state. To handle this, the publisher attaches a per-process **epoch** to each publish and refresh response. When Centrifugo sees the epoch change, it treats the channel as fully reset: per-key versions are wiped, current subscribers are unsubscribed with an insufficient-state code, and SDK auto-resubscribe machinery picks up the new epoch and fresh state — typically within milliseconds. The publisher just needs a fresh string at startup (UUID, a timestamp, anything unique per process lifetime). Empty epoch is also valid and means "pure version comparison, no restart protection" — fine when the publisher's lifecycle outlives all subscribers.

The polling cycle guarantees an **eventually consistent view** of your backend data — clients always converge to the latest state. The delivery tiers above only change how fast they converge, not whether they do. Timer polling alone bounds latency by the refresh interval; add direct publish or notifications and updates land in milliseconds. Same correctness, different latency.

A use case that highlights this well is **configuration sync**. Track a single key like `app_settings` with a long refresh interval (say, 30 seconds). All connected clients converge to the current configuration via the regular poll cycle. When an admin changes a setting, your backend calls `shared_poll_publish` — every client receives the update instantly. New clients connecting later get the configuration immediately via cold key auto-poll. You get configuration distribution with just one tracked key and a publish call on write — no Kafka, no extra infrastructure.

## Batch timing: predictable backend load

When a channel tracks thousands of items, polling them all in a single backend request would create periodic load spikes — and Centrifugo has always prioritized [protecting backends](/docs/server/proxy) from thundering herds. Shared poll splits tracked items into batches and spreads them evenly across the polling interval:

```
Refresh cycle (interval=1s, 3000 tracked keys, batch_size=1000)

 Clients            Centrifugo                        Backend
 ───────            ──────────                        ───────
   │                     │                               │
   │  track(keys)        │                               │
   ├────────────────────►│                               │
   │                     │  collect all tracked keys     │
   │                     │  split into batches           │
   │                     │                               │
   │              t=0    │── batch 1 (keys 1-1000) ─────►│
   │                     │                               │
   │            t=333ms  │── batch 2 (keys 1001-2000) ──►│
   │                     │                               │
   │            t=666ms  │── batch 3 (keys 2001-3000) ──►│
   │                     │                               │
   │                     │◄── responses ─────────────────│
   │                     │                               │
   │                     │  compare versions             │
   │                     │  per client                   │
   │                     │                               │
   │  update(key, data)  │                               │
   │◄────────────────────│  push only changed items      │
   │                     │                               │
   │              t≈1s   │  next cycle starts            │
   │                     │                               │
```

The backend sees steady load rather than a spike every second. A global concurrency limit (default 64) caps the number of simultaneous backend calls across all channels, preventing Centrifugo from overwhelming a shared data source when many channels refresh simultaneously.

## Scaling with Centrifugo PRO

The OSS shape we've described works for most deployments. Three patterns start to bite at higher scale, and [Centrifugo PRO](/docs/pro/shared_poll) addresses each:

- **First-paint latency on cold keys.** With long refresh intervals — think a 30-second configuration channel — a new client arriving between cycles waits seconds for first data. PRO's `keep_latest_data` keeps the latest value and version per key in memory; new clients tracking a known key get data straight from cache, with no backend call. The wait drops from "until next cycle" to milliseconds.
- **Bandwidth on slowly-mutating payloads.** When only part of a tracked entry changes each cycle but the whole payload is re-sent, you pay for the unchanged bytes on every fan-out. Paired with `keep_latest_data`, PRO computes [fossil deltas](/docs/server/delta_compression) between successive values per key — clients that negotiated delta receive the patch instead of the full payload. The savings scale with payload size and how rarely it fully changes.
- **Backend load that grows with cluster size.** Each Centrifugo node polls the backend independently — fine at a few nodes, visible at a dozen. The PRO **shared poll relay** is a standalone process that polls once per cycle and serves cached results to all nodes, so backend load stays at one poll per cycle regardless of how many Centrifugo nodes are behind it. The relay also retains version history, providing `prev_data` for delta compression with no changes on your backend side.
- **Cascading failure when the backend lags.** If a refresh cycle takes longer than the configured interval — during a traffic spike, a slow query, a degraded downstream — independent nodes keep stacking calls on top of each other and make recovery harder. PRO's **adaptive backpressure** automatically stretches the interval when responses slow down and shrinks it back as the backend recovers, so a slow backend stays slow but doesn't get pushed over the edge.

## Why this isn't just another PUB/SUB feature

The server-side polling inversion makes shared poll work for use cases push-only systems can't serve: live counters over legacy databases, configuration sync from third-party APIs, data feeds from systems your team doesn't own. These previously sat outside the scope of a WebSocket server.

It depends on Centrifugo being **self-hosted**. The refresh proxy hits your backend over the local network — single-digit milliseconds, not a public-internet round-trip — so per-key HMAC verification stays cheap on the hot path, and you can authorize via the same internal services you already trust. A cloud real-time provider can't poll your backend on your behalf without you exposing it publicly or running a tunnel.

One practical scaling note: shared poll channels don't use inter-node PUB/SUB. Each node polls the backend independently and delivers to its own connected clients. A cluster running only shared poll needs no Redis or NATS for messaging coordination.

## What's next

Shared poll subscriptions are currently experimental — we may adjust configuration, client SDK API, and proxy protocol based on feedback. At this point, only `centrifuge-js` supports shared poll subscriptions on the client side.

We've published two interactive demos.

[Votes](https://github.com/centrifugal/examples/tree/master/v6/shared_poll_demo/votes) — live vote results with dynamic tracking as posts scroll into view:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_votes.mp4"></video>

[Drones](https://github.com/centrifugal/examples/tree/master/v6/shared_poll_demo/drones) — real-time geospatial tracking of 500 simulated drones over a San Francisco map using cell-based spatial partitioning:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_drones.mp4"></video>

Read the full [shared poll documentation](/docs/server/shared_poll) for configuration reference, proxy protocol details, and backend signature generation examples in six languages.
