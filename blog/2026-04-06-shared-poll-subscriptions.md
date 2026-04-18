---
title: Shared poll subscriptions — what push can add to poll
tags: [centrifugo, websocket, state-sync, polling]
description: Shared poll subscriptions move polling from clients to Centrifugo. Instead of 10,000 clients each hitting your backend, Centrifugo makes one request and fans out the changes. This post explains the design and trade-offs.
author: Alexander Emelin
image: /img/blog_shared_poll.jpg
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
hide_table_of_contents: false
---

import SharedPollDiagram from '@site/src/components/SharedPollDiagram';
import SharedPollPublishDiagram from '@site/src/components/SharedPollPublishDiagram';

What if 10,000 clients could stay up to date with just one backend request per second? That's the idea behind shared poll subscriptions.

Centrifugo's core model is push-based: your backend publishes a message to a channel, Centrifugo delivers it to all subscribers over persistent WebSocket connections. With [history and recovery](/docs/server/history_and_recovery), clients even catch up on missed publications after a reconnect. This is what we call **stream subscriptions** — the original and still the most common subscription type in Centrifugo. We've built tutorials around this model — from [Django chat applications](/blog/2021/11/04/integrating-with-django-building-chat-application) to [real-time leaderboards](/blog/2025/04/28/websocket-real-time-leaderboard) — and it works well when your backend controls the write path. They'll remain the foundation of most Centrifugo deployments. But there's a class of use cases where a different approach works better, and provides unique properties for building interactive experiences.

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_drones.mp4"></video>

<!--truncate-->

## When polling makes more sense than push

Consider a social feed where each post displays a live vote count. The data already exists in your database. The question is how to keep it fresh on every client's screen.

You can use stream subscriptions here — publish to Centrifugo on every vote, and subscribers see the update in real time. This works, and for many features it's the best approach. But it does mean that every write path touching vote counts — every API endpoint, every background job, every migration script — needs to call the publish API. For a single feature, this coupling is fine. As the number of live-updating fields grows (view counts, comment counts, stock levels, configuration flags), the integration surface grows with it.

It also assumes you control the write path. With third-party APIs, legacy systems, or databases shared across services, you can't always hook into writes to trigger a publish.

In these cases, teams often choose polling instead. Each client hits an API endpoint every few seconds to check for updates. Polling is simple, decoupled from the write path, and works with any data source. The trade-off is scale: if 10,000 clients each poll every second, that's 10,000 requests per second — and most responses contain unchanged data. This overhead is a common criticism of polling, and it's often what drives teams to adopt push-based real-time systems in the first place.

## The inversion: server-side polling

Shared poll subscriptions move the polling from clients to Centrifugo. Clients maintain a persistent WebSocket connection (or an HTTP-streaming/SSE fallback — the transport is transparent), tell Centrifugo which items they care about, and Centrifugo asks your backend once on a configurable schedule. The backend returns the current state of those items. Centrifugo detects what changed and pushes only the updates to interested clients.

Each client sees a different subset of items — different pages, different search results, different scroll positions — but many of these subsets overlap. Centrifugo aggregates interest across all connected clients and polls only the union of tracked keys once per cycle. The backend load depends on the number of unique items being watched, not on the number of connected clients. If 10,000 clients are all watching overlapping sets that cover 200 unique posts, Centrifugo makes one request for those 200 items and fans out the result. O(unique_items) instead of O(clients).

<SharedPollDiagram />

Your backend just needs one endpoint that answers: "here is the current data for these keys." This endpoint is a standard Centrifugo [proxy](/docs/server/proxy) — if you're already using subscribe or publish proxies, the refresh proxy works the same way. You don't need publish calls or event hooks — there's no coupling to the write path. If you can read the data, you can serve it through shared poll.

Centrifugo already has the hard parts — persistent connections, reconnection, authentication, client SDKs, proxy infrastructure. The connections and fan-out machinery were already there — we just needed to add the server-side polling loop and per-key tracking on top.

## Per-item tracking without per-item channels

Before shared poll, the natural Centrifugo approach would be creating a channel per item — one channel for each post's vote count. Centrifugo channels are lightweight and ephemeral — created on first subscribe, cleaned up on last unsubscribe — so creating many is fine on the server side. The challenge is on the client: a user scrolling through a feed might have 50–100 posts visible at once, meaning 50–100 active stream subscriptions, each with its own lifecycle of subscribe, unsubscribe, signature management, and recovery handling. This is also protocol-expensive — each subscription requires its own subscribe/unsubscribe frame over the WebSocket connection, its own recovery state, its own position tracking. Multiply that across thousands of concurrent users and the cost adds up on both client and server.

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

One subscription, arbitrary number of tracked keys, and the server only polls items that at least one client is watching. A single `track()` call sends one protocol frame over the WebSocket — but on the server side, Centrifugo subscribes to per-key broker channels internally, so that `shared_poll_publish` can deliver updates to the right clients instantly. From the client's perspective, it's one call. On the server side, Centrifugo sets up the routing needed for per-key direct delivery.

The client SDK provides a dedicated `SharedPollSubscription` type with `track`, `untrack`, and `trackedKeys` methods — a narrower, purpose-built API rather than flags on the existing `Subscription` object. On the server side, shared poll is configured through the same [channel namespace](/docs/server/channels) system as everything else in Centrifugo — you set `subscription_type: "shared_poll"` on a namespace and configure the polling interval, batch size, and backend proxy. It fits into the existing configuration model rather than introducing a parallel one.

## Authorization with HMAC signatures

Per-item granularity raises an authorization question: how do you control which items a client can track? Centrifugo's existing authorization — [connection tokens](/docs/server/authentication) and [channel tokens](/docs/server/channel_token_auth) — operates at the channel level. But with shared poll, the client is subscribed to one channel and tracking many keys within it. We needed per-key authorization.

Shared poll solves this with HMAC signatures rather than JWT tokens. We needed tracked keys as first-class values in the protocol, not buried inside a token payload. And HMAC is an order of magnitude faster to generate and verify than JWT — which matters when thousands of clients are refreshing signatures on every poll cycle. When the client calls `track()`, the SDK invokes a `getSignature` callback that requests a signature from your backend. Your backend decides which of the requested keys the client is allowed to see, computes an HMAC over the authorized key set, and returns the signature. Centrifugo verifies the HMAC on every track request.

The signature binds together the user ID, channel, key set, and a time window — so it can't be reused for different keys or different users. Signatures expire, forcing periodic re-authorization. If your backend returns fewer keys than the client requested, the omitted keys are treated as revoked — the SDK emits removal events and stops tracking them. This means access revocation happens automatically on the next signature refresh cycle, without any server-side push.

In practice, your `getSignature` endpoint is where you apply your existing RBAC or row-level security logic — check the user's role, query their permissions, filter the key set accordingly. Centrifugo enforces whatever access decisions your backend makes, at the per-item level.

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

This is enough for most use cases. But if your data already has versions (a database sequence number, a timestamp, a monotonic counter), versioned mode unlocks additional capabilities. Centrifugo includes the last known version in each request, allowing your backend to skip unchanged items — reducing response size and database load. Versioned mode also enables [direct publish](#direct-publish-instant-when-you-have-it-polled-when-you-dont) for instant delivery.

## Direct publish: instant when you have it, polled when you don't

The polling model accepts a latency trade-off: updates arrive within the polling interval rather than instantly. For vote counts and view counts, seconds of latency are fine. But sometimes your backend already has the data right after a database write and wants instant delivery.

The `shared_poll_publish` server API lets your backend push data directly to tracking clients — bypassing the poll cycle entirely. Centrifugo delivers the data immediately and marks the key as "fresh" so the next poll cycle skips it, avoiding a redundant backend call.

This gives shared poll two delivery speeds: timer-based polling (seconds of latency, zero integration effort) and direct publish (instant, requires a publish call on the write path). The two complement each other — direct publish for speed, polling as the safety net. If a direct publish is missed (process crash, network issue), the next poll cycle picks it up.

<SharedPollPublishDiagram />

[Centrifugo PRO](/docs/pro/shared_poll#notification-fast-path) adds a third option: a **notification fast path**. Your backend sends a lightweight notification — just the channel and the keys that changed, no data — and Centrifugo immediately polls those specific keys from the backend, outside the regular cycle. This is useful when your backend knows *which* keys changed (e.g., from a database trigger or webhook) but doesn't have the data ready to publish directly. The three tiers — timer polling, notification-triggered polling, direct publish — range from zero integration to instant delivery.

## Quick initial data and reconnect resilience

Two design decisions make shared poll feel responsive despite being poll-based.

**Cold key auto-poll.** When a client tracks a key with version 0 ("I have no data") and no other connection on the same node is tracking that key, Centrifugo triggers an immediate backend poll for it — without waiting for the next scheduled cycle. Data arrives within milliseconds. This means the first user to view a post gets its vote count almost instantly, and subsequent users on the same node benefit from the cached state. No additional configuration is needed.

**Reconnect resilience.** Centrifugo has always been designed for graceful reconnection — stream subscriptions catch up from history, and the client SDKs handle the entire reconnect lifecycle transparently. Shared poll follows the same philosophy. When a client disconnects and reconnects, the SDK automatically replays all tracked keys using the existing signature and sends the last-known version for each key. Centrifugo compares versions and only pushes data that changed while the client was offline — avoiding a full data re-delivery. The `getSignature` callback is only invoked when the signature actually expires, not on every reconnect — preventing a mass backend request storm when thousands of clients reconnect simultaneously (e.g., after a load balancer restart).

Taken together — timer polling, direct publish, notification fast path, cold key auto-poll, reconnect with version comparison — the result is an **eventually consistent view** of your backend data. All clients always converge to the latest state: the polling cycle guarantees it. How fast they converge depends on how much integration you add. With timer polling alone, latency is bounded by the refresh interval. Add direct publish or notifications, and updates arrive in milliseconds. The consistency guarantee is the same either way — the delivery tiers only affect latency, not correctness.

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

For larger deployments, [Centrifugo PRO](/docs/pro/shared_poll) adds four capabilities:

**Cached initial data.** With `keep_latest_data` enabled, Centrifugo caches the latest value and version for each tracked key in memory. When a new client tracks a key, data is served directly from cache — no backend call, no waiting for the next poll cycle. This is especially valuable for configuration sync channels with long refresh intervals, where new clients would otherwise wait seconds for their first data.

**Delta compression.** When `keep_latest_data` is enabled alongside [fossil delta compression](/docs/server/delta_compression), Centrifugo computes compact diffs between successive values of the same key. Clients that negotiated delta support receive a patch instead of the full payload — which reduces bandwidth when only a small part of the data changes each cycle.

**Shared poll relay.** A standalone Centrifugo process that centralizes backend polling. Instead of every node calling your backend on each refresh cycle, the relay polls once and serves cached results to all nodes. This reduces backend load to exactly one poll per cycle regardless of cluster size. The relay also maintains version history, providing `prev_data` for delta compression without any backend changes.

**Adaptive backpressure.** When your backend responds slower than the refresh interval, backpressure automatically stretches the interval to avoid overloading it. When the backend recovers, the interval gradually shrinks back. This prevents cascading failures during traffic spikes without manual intervention.

## Why this isn't just another PUB/SUB feature

The server-side polling inversion — Centrifugo asks your backend on behalf of all clients, once per cycle — makes possible use cases that push-only real-time systems can't serve: live counters over legacy databases, configuration sync from third-party APIs, data feeds from systems you don't control. These were previously outside the scope of a WebSocket server.

This fundamentally depends on Centrifugo being self-hosted. It sits in your infrastructure and calls your backend over the local network — the refresh proxy adds low single-digit milliseconds of latency, not the round-trip to a cloud service. A cloud real-time provider can't poll your backend on your behalf without you exposing an endpoint to the public internet or setting up a tunnel. With Centrifugo, the backend call stays inside your network, uses the same authentication patterns you already have for other internal services, and gives you full control over the data flow.

The self-hosted model also enabled the per-key HMAC authorization design. Because the signature is verified locally inside Centrifugo — no external auth service call on the hot path — we could make per-key authorization practical at high throughput. Most real-time systems authorize at the channel or topic level. Shared poll authorizes individual keys within a single subscription — so one channel can serve thousands of items with fine-grained, per-item access control, without the overhead of thousands of separate subscriptions.

There's another practical benefit worth noting: shared poll channels don't use PUB/SUB between Centrifugo nodes. Each node polls the backend independently and delivers updates to its own connected clients. This means you can scale Centrifugo to multiple nodes without setting up Redis or NATS as a broker — if your application only uses shared poll subscriptions, no inter-node messaging infrastructure is needed at all.

Together with stream subscriptions and [map subscriptions](/blog/2026/04/07/map-subscriptions), Centrifugo now provides three subscription primitives in one self-hosted system. We're not aware of another real-time messaging server that combines all three.

## What's next

Shared poll subscriptions are currently experimental — we may adjust configuration, client SDK API, and proxy protocol based on feedback. At this point, only `centrifuge-js` supports shared poll subscriptions on the client side.

We've published two interactive demos.

[Votes](https://github.com/centrifugal/examples/tree/master/v6/shared_poll_demo/votes) — live vote results with dynamic tracking as posts scroll into view:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_votes.mp4"></video>

[Drones](https://github.com/centrifugal/examples/tree/master/v6/shared_poll_demo/drones) — real-time geospatial tracking of 500 simulated drones over a San Francisco map using cell-based spatial partitioning:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_drones.mp4"></video>

Read the full [shared poll documentation](/docs/server/shared_poll) for configuration reference, proxy protocol details, and backend signature generation examples in six languages. And check out the companion post on [map subscriptions](/blog/2026/04/07/map-subscriptions) — the other new subscription type we're introducing alongside shared poll.
