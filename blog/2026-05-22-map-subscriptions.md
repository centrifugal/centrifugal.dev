---
title: Map subscriptions (Part 1) — synchronized key-value state and presence
tags: [centrifugo, websocket, state-sync, presence]
description: A new subscription type in Centrifugo — real-time key-value collections with paginated state delivery, guaranteed convergence on reconnect, per-key TTL, conditional writes, and Fossil delta compression.
author: Alexander Emelin
image: /img/blog_map_subs_01.jpg
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
hide_table_of_contents: false
draft: false
---

import MapSubscriptionDiagram from '@site/src/components/MapSubscriptionDiagram';

A **map subscription** — new in Centrifugo v6.8.0 — is a real-time key-value collection that Centrifugo manages. The map broker stores the entries; the SDK keeps a live/realtime mirror on every subscribed client.

Subscribe – and you get the current snapshot, then live updates as keys updated/removed, then automatic re-sync on reconnect. No separate REST endpoint to load initial state, no race window between HTTP and WebSocket. Convergence is part of the protocol — no `recovered: false` flag to handle in app code.

Centrifugo's original model is **stream subscriptions** — channel-based pub/sub with optional [history and recovery](/docs/server/history_and_recovery) so reconnecting clients catch up on missed publications. They work well for chat, notifications, activity feeds, and anywhere clients need an ordered sequence of events, and they remain the right choice for most real-time features.

For the broad case of "I have data in my own database and want clients to see it live", a stream subscription with a `getState` callback reading from your own tables is usually the natural fit — your schema stays the source of truth. Map subscriptions fit a different shape: collections without an obvious home in the application's database — cursors that exist for a few seconds at a time, presence sets, IoT device state, lobby members, feature flags, live dashboards. Each is conceptually just a key-value collection that should be live in the browser. Building a store, a change feed, and a snapshot endpoint for each one is a lot of infrastructure for that. Map subscriptions are that primitive, baked into Centrifugo.

This post introduces map subscriptions and focuses on cases where Centrifugo owning the collection is exactly what you want. **Map subscriptions can also mirror data you already store elsewhere** — you pay for some duplication into `cf_map_state`, and in return you get the synchronized snapshot, paginated state delivery, per-key TTL, and consistent reads on the client without writing your own initial-state endpoint. A different trade-off, not a forbidden one.

Centrifugo also offers a new presence implementation built on map subscriptions, with all the same benefits — automatic synchronization and a clean SDK API.

<!--truncate-->

## Where state sync gets tricky

Consider two examples. First, shared cursors: each user publishes their cursor position, and every other user sees it move in real time. You can publish coordinates through a stream subscription, and that works — but after a page reload, the new client has no way to get the current position of all cursors. It must wait for each user to move again. Presence gives you the list of who's in the channel, but not their associated state.

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_cursors.mp4"></video>

Second, a live scoreboard. The client doesn't care about the history of score changes — it needs the current state of all matches, and it needs updates as they happen. You can absolutely build this with stream subscriptions — we did exactly that in our [real-time leaderboard tutorial](/blog/2025/04/28/websocket-real-time-leaderboard) using Redis, cache recovery, and delta compression. It works well. The challenge is the initial load: there's a gap between the REST response and the moment the subscription starts, and updates published during that gap can be missed.

We've [explored this problem before](/blog/2024/06/03/real-time-document-state-sync) and even provided a `RealTimeDocument` helper class that manages versioning, re-fetches state on gaps, and reconciles late-arriving updates. It works, but we kept seeing teams building collaborative features, live dashboards, or presence systems implementing similar logic on top. We wanted a more convenient SDK API for this pattern — one where state delivery and recovery are built in, so application code doesn't have to manage them.

## A new subscription type for keyed state

For use cases like scoreboards, presence, or collaborative state, what matters is the current collection of entries — not the ordered sequence of events that stream subscriptions provide. Map subscriptions are a new subscription type for this: instead of an append-only publication stream, a map channel maintains a **synchronized collection** — a set of key-value entries where each entry can be independently published, updated, or removed. When a client subscribes, it receives the full state through a paginated protocol, then transitions to live updates. The SDK handles all of this transparently — the application just reacts to `sync` (full state ready) and `update` (single entry changed) events.

```javascript
const sub = client.newMapSubscription('dashboard:main');

sub.on('sync', (ctx) => {
  renderDashboard(ctx.entries);
});

sub.on('update', (ctx) => {
  ctx.removed ? removeEntry(ctx.key) : upsertEntry(ctx.key, ctx.data);
});

sub.subscribe();
```

The subscription itself delivers the state — there's no separate REST call, no gap to bridge. Compare this with stream subscriptions, where the application receives individual `publication` events and must build state from the event sequence. With map subscriptions, the SDK maintains the collection internally — the application just renders what it's given. After any disconnect, clients always converge to the correct state: the SDK either catches up from the stream or re-syncs from scratch, then emits a fresh `sync` event. There's no `recovered: false` flag to handle — convergence is guaranteed by the protocol.

Map subscriptions are configured through the same [channel namespace](/docs/server/channels) system as stream subscriptions — you set `subscription_type: "map"` on a namespace, configure the mode and options, and channels in that namespace become map channels. The same connection, the same client SDK, the same authentication and authorization flow. Existing stream namespaces are unaffected. The client SDK provides a dedicated `MapSubscription` type with narrowed methods and events — `sync`, `update`, `mapPublish`, `mapRemove` — rather than overloading the existing `Subscription` with mode flags. The same approach applies to presence variants (`MapClientsSubscription`, `MapUsersSubscription`).

## Three-phase sync protocol

Underneath the simple-looking API there's a real protocol challenge: the client must paginate through potentially large state while new updates keep arriving. This is the same race condition that `RealTimeDocument` addressed — but now solved at the protocol level, so application developers don't have to think about it.

The subscription goes through three phases:

1. **State phase** — the client paginates through the current key-value snapshot from the broker
2. **Stream phase** — the client catches up on changes that occurred during state pagination
3. **Live phase** — the client receives real-time updates via PUB/SUB

During the transition from stream to live, the server buffers incoming publications, merges them with recovered stream entries, and checks for continuity — reusing the same buffering and merge infrastructure that powers stream recovery in regular channels. If continuity is broken, the client re-syncs from scratch automatically. The SDK handles all three phases internally — the application never sees pagination cursors or stream offsets.

## Three modes for different lifetimes

Not all state has the same lifecycle. Cursor positions should disappear seconds after a user disconnects. Session data should survive brief network interruptions but not persist forever. Inventory entries should persist until explicitly removed.

Stream subscriptions offer fine-grained control over these concerns — `history_size`, `history_ttl`, `force_recovery` can be configured independently. Map subscriptions take a different approach, bundling them into three modes that cover the most common state sync patterns:

- **Ephemeral** — no stream history, entries expire via TTL. On reconnect, the client gets a full state snapshot. This is the most lightweight option — about 35-40% less work per publish compared to modes with a stream. Best for cursors, typing indicators.

- **Recoverable** — stream history with TTL-expiring entries. On reconnect, the client catches up from the stream instead of re-fetching everything. Best for presence, sessions, polls, game lobbies — data that auto-expires but needs efficient recovery.

- **Persistent** — stream history with permanent entries. Data lives until explicitly removed. Best for inventories, collaborative documents, dashboards — permanent state with efficient reconnect.

The mode determines which phase of the sync protocol is used on reconnect: ephemeral always re-syncs from state, recoverable and persistent attempt stream catch-up first.

<MapSubscriptionDiagram />

Here's the protocol visualizer demo — it shows all three phases in action, including paginated state delivery, stream catch-up, and the transition to live updates:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_visualizer.mp4"></video>

Recoverable and persistent modes support Fossil delta compression — deltas are computed per key, between successive values of the same entry, so clients receive compact patches instead of full payloads when only part of the data changes.

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_scoreboard.mp4"></video>

## Conditional writes

Some patterns need writes that can fail gracefully — two players claiming the last slot in a game lobby, two bidders placing an auction bid at the same instant. Map subscriptions support two forms of conditional writes. Key modes — `if_new` (only insert if key doesn't exist) and `if_exists` (only update if key exists) — cover slot claiming and heartbeat-only updates. For stronger guarantees, compare-and-swap via `ExpectedPosition` checks the channel's stream offset and epoch before writing — if another write happened since the client's last read, the operation is rejected and the client can retry with fresh data.

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_inventory.mp4"></video>

## Scalable presence on top of maps

The same keyed structure applies directly to presence. Centrifugo has had [presence](/docs/server/presence) since the early days — you can query who's in a channel and receive join/leave events. This works well for channels with moderate participant counts. For channels with thousands of participants, though, returning the entire list in a single response becomes expensive. And join/leave events are delivered with at-most-once guarantee — fine for live indicators, but there's no built-in way to catch up on events missed during a disconnect.

Map subscriptions work well for these larger-scale scenarios. Centrifugo provides two presence subscription types:

- **`map_clients`** — one entry per connection (key = client ID). When a client unsubscribes or disconnects, its entry is removed immediately.
- **`map_users`** — one entry per user (key = user ID). A user may have multiple connections, so entries can't be removed on a single disconnect — they expire via TTL after the last connection for that user leaves the channel.

Because these are regular map channels, clients get paginated state on subscribe and live join/leave updates in real time. Recovery works the same way — reconnecting clients catch up from the stream instead of re-fetching everything.

This is configured through channel prefixes. When a client subscribes to `game:abc`, the server can automatically publish presence entries to `clients:game:abc` (per-connection) and `users:game:abc` (per-user). These are separate map channels that other clients can subscribe to independently:

```
Client subscribes to game:abc
       │
       ├──► auto-publish to clients:game:abc  (key = client_id)
       └──► auto-publish to users:game:abc    (key = user_id)

Other clients subscribe to clients:* / users:* to see who's online
```

```json
{
  "channel": {
    "namespaces": [
      {
        "name": "game",
        "map_clients_presence_channel_prefix": "clients:",
        "map_users_presence_channel_prefix": "users:"
      },
      {
        "name": "clients",
        "subscription_type": "map_clients",
        "map": { "mode": "recoverable", "key_ttl": "60s" }
      },
      {
        "name": "users",
        "subscription_type": "map_users",
        "map": { "mode": "recoverable", "key_ttl": "60s" }
      }
    ]
  }
}
```

Here's a game lobby demo that shows presence built on top of map subscriptions — the sidebar tracks connected players in real time using `MapClientsSubscription`:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_lobby.mp4"></video>

A handful of players is the easy case. The same primitive scales much further — here are two browser tabs subscribed to the same `map_clients` channel while the population is being filled to **100,000 connected members**. Each cell in the grid is one connection; green flashes mark joins, red flashes mark leaves. The tabs connect *during* the fill, so they have to reconcile a moving target — paginated initial state plus the joins still happening in real time. Once the population stabilizes both tabs show the same converged 100k. The clip ends with a reconnect: state paginates back at 10k entries per page, the full grid repaints quickly, and the tab is live again:

<video width="100%" controls preload="metadata" src="/img/demo_map_presence.mp4"></video>

To be clear: a hundred thousand members in a single presence channel is **not** a typical production shape and we don't expect most apps to need it. This is a deliberately extreme demo showing what the protocol is capable of — not a recommended pattern. Most real systems work with channels of dozens to a few thousand participants, where the main advantages of map presence are convergence on reconnect and join/leave reliability, rather than raw count. (For the curious: we ran the same setup at **1,000,000 members** and a single browser tab still synchronizes — initial state takes around twenty seconds to paginate, then live updates flow normally. Past that point the bottleneck shifts from the protocol to the cost of streaming the snapshot itself.) Both 100k and 1M variants are runnable from the [`v6/map_presence_demo`](https://github.com/centrifugal/examples/tree/master/v6/map_presence_demo) example.

The `recoverable` mode is what makes map-based presence more capable than Centrifugo's traditional presence. With recoverable mode, reconnecting clients catch up from the stream rather than re-fetching the full participant list. With ephemeral mode, clients would get a full snapshot on every reconnect — which is the same behavior traditional presence already provides, losing the convergence advantage.

## Brokers: memory, Redis, PostgreSQL

Map subscriptions need a backend to store state and coordinate updates. Centrifugo supports three map brokers, each suited to different deployment scenarios.

**Memory** is the default — zero dependencies, single-node, state lost on restart. Good for development and ephemeral data on single-node deployments.

**Redis** adds distribution across nodes. We've invested years into making Centrifugo's [Redis engine](/docs/server/engines) efficient — connection pooling, pipelining, client-side consistent sharding, atomic Lua scripts. The Redis map broker builds on that same foundation, reusing the existing connection infrastructure and following the same patterns. State is stored in Redis hashes, with atomic Lua scripts ensuring that state update, stream append, and PUB/SUB broadcast happen as a single operation — the same atomicity approach we use for stream subscription history. This is the typical choice for ephemeral and recoverable modes in multi-node setups.

**PostgreSQL** goes further. In a recent survey, 86% of Centrifugo users reported having PostgreSQL in their production stack, with 76% using it as their primary database. The PostgreSQL broker stores map state in regular SQL tables and enables transactional publishing — real-time updates that commit or roll back inside your database transactions, eliminating the [dual-write problem](https://thorben-janssen.com/dual-writes/) entirely.

Here's a sprint board demo where cards are moved between columns — each drag-and-drop is a PostgreSQL transaction that updates the board state and publishes to Centrifugo atomically:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_taskboard.mp4"></video>

## Where this fits in the landscape

Most real-time messaging systems are built around PUB/SUB — Pusher, Socket.IO, NATS all center on message delivery. A growing number do offer built-in state synchronization. Firebase Realtime Database and Supabase Realtime sync data to clients directly from their managed databases. Ably has expanded beyond pub/sub with LiveSync and LiveObjects for database-to-client sync and collaborative state primitives. Liveblocks provides collaborative state with CRDTs. But these are either cloud-only services tied to a specific database — where you can only integrate as deeply as the platform allows — or specialized tools for a narrow use case like collaborative editing.

Why not CRDTs? Because we want to stay consistent with what Centrifugo has always been: a generic real-time transport that doesn't interpret the data it carries. Centrifugo delivers JSON or binary payloads without interpreting their contents — it doesn't parse your data, doesn't merge it, doesn't resolve conflicts at the field level. The entire protocol — including map subscriptions — works over both JSON and [Protobuf](/docs/transports/overview#protobuf-protocol), so latency-sensitive or bandwidth-constrained applications can use compact binary encoding end to end. CRDTs require the transport layer to understand the data structure and apply merge semantics, which ties the system to specific data types. Map subscriptions work the same way as stream subscriptions: Centrifugo synchronizes opaque key-value entries — your application decides what they contain and how to interpret them. This keeps the system generic and the design consistent across all three subscription types.

Centrifugo occupies a different spot because it's self-hosted — it runs in your infrastructure, connects to your databases, and calls your backend directly. That proximity opens up features a cloud service sitting between you and your users can't really offer — from transactional publishing (where the publish *is* part of your DB transaction, not an after-the-fact CDC reaction) to the low-latency proxy system that powers subscribe authorization and shared poll refresh.

For scenarios that need per-item access control within a single map channel, [Centrifugo PRO](/docs/pro/server_tags_filter) adds a server-side publication tags filter — your backend assigns tags to entries and sets a filter per subscriber via the subscribe proxy or JWT. Only matching entries are delivered, across all sync phases. This enables RBAC patterns without splitting data into separate channels per access scope.

Stream subscriptions, map subscriptions, and [shared poll subscriptions](/blog/2026/05/21/shared-poll-subscriptions) cover three different ways clients relate to data — ordered events, synchronized collections, and polled read-only state — while staying payload-agnostic across the board. Your application decides what the data means; Centrifugo handles delivery. Switching between primitives is a namespace configuration choice, not an architectural one.

## What's next

Map subscriptions are currently experimental — we may adjust the API, configuration, and protocol based on feedback. At this point, only `centrifuge-js` supports map subscriptions on the client side. We plan to extend support to other SDKs.

We designed map subscriptions to share everything stream subscriptions already have — not a separate system grafted on. Same namespace configuration, same Redis infrastructure, same client SDK connection, proxy system, recovery internals, and [transport layer](/docs/transports/overview). The goal is that adopting map subscriptions should feel like switching a namespace option, not adopting a different system.

And check out the companion post on [shared poll subscriptions](/blog/2026/05/21/shared-poll-subscriptions) — the other new subscription type we're introducing alongside map subscriptions.

We've published a [collection of interactive demos](https://github.com/centrifugal/examples/tree/master/v6/map_demo) covering different map subscription features — from ephemeral cursors to PostgreSQL-backed sprint boards. Each demo runs with Docker Compose and showcases a different aspect of the feature.

Read the full [map subscriptions documentation](/docs/server/map_subscriptions) for configuration reference, broker setup, and client SDK API details.
