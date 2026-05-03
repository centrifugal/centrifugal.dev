---
title: "Beyond PUB/SUB: new foundations, and a real-time companion for PostgreSQL"
tags: [centrifugo, postgresql, websocket, real-time, architecture]
description: v6.8.0 release wrap-up — new subscription primitives for state-sync shapes pub/sub doesn't cover, plus first-class PostgreSQL integration for transactional publishing and Redis-free clustering. From channel pub/sub to a real-time state sync layer.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/blog_release_wrap_up.jpg
hide_table_of_contents: false
draft: true
---

import SharedPollDiagram from '@site/src/components/SharedPollDiagram';
import PgOutboxDiagram from '@site/src/components/PgOutboxDiagram';

For over a decade, [Centrifugo](https://centrifugal.dev) has been a channel-based pub/sub server: clients subscribe, the backend publishes, messages fan out over WebSocket (or SSE / HTTP-streaming when WebSocket isn't available). Over the years, certain problems kept coming up that pub/sub couldn't solve well on its own — and teams ended up working around them.

Two recurring patterns show where pub/sub alone falls short. The first is **ephemeral state nobody wants in their main database** — cursor positions in a collaborative editor, typing indicators, presence rosters, in-flight match state. The values are short-lived and worthless after the client disconnects; putting them in your application schema is overkill, but rolling them on Redis fronted by hand-built initial-state, TTL, and reconnect logic is the same wheel every team reinvents.

The second is **persistent state where the real-time update should commit with the database write** — order status, document edits, ticket transitions. The database is the right home; the dual-write problem becomes a cost you keep paying.

Pure pub/sub, even with stream history and message recovery on reconnect — which Centrifugo has had for years — doesn't cover either case on its own.

Centrifugo v6.8.0 bakes those patterns into the core: two new subscription primitives — **[map subscriptions](/blog/2026/05/13/map-subscriptions)** for synchronized key-value collections and **[shared poll subscriptions](/blog/2026/05/12/shared-poll-subscriptions)** for read-only state the application doesn't write directly — and three Postgres-backed components: a **[stream broker](/blog/2026/05/15/pg-stream-broker-benefits)**, **[map broker](/blog/2026/05/14/map-subscriptions-part-2)**, and **[controller](/blog/2026/05/16/pg-controller-multi-node)**. The Postgres path lets multi-node clusters drop their Redis dependency.

<!--truncate-->

## Map subscriptions — synchronized state as a primitive

Stream subscriptions give you events; the client reconstructs state by replaying them. For features built around a *collection* — cursors, presence, scoreboards, live dashboards — that means subscribing to a stream **and** loading initial state from a REST endpoint, then carefully merging the two without dropping or duplicating updates that arrive during the load. Every team writes that glue. It's the wheel real-time engineering reinvents most often.

A **map subscription** is a real-time key-value collection delivered as a protocol primitive. Subscribe once; the server ships the current entries (paginated for large collections), then per-key updates as they happen. Per-key TTL handles cleanup. CAS-style conditional writes handle concurrent updates. On reconnect, the SDK reconciles silently.

The canonical example is a collaborative editor's cursor map: every connected user contributes one entry — their current position — keyed by user ID, with a short TTL so disconnects clean up automatically. The client API is two events:

```javascript
const sub = client.newMapSubscription('cursors:room1');

sub.on('sync',   (ctx) => renderCursors(ctx.entries));   // initial state ready
sub.on('update', (ctx) => ctx.removed
  ? removeCursor(ctx.key)
  : upsertCursor(ctx.key, ctx.data));                    // single key changed

sub.subscribe();
```

No separate REST call. No race-condition glue between snapshot and stream. The application reacts to two events; the SDK handles the rest.

**Three-phase sync protocol.** The hard part of synchronized state delivery is the race between paginated initial state and concurrent updates: while the client paginates through the current entries, new updates keep arriving. Map subscriptions resolve this with a three-phase protocol — paginated state from a frozen offset, then a catch-up of updates that committed during the load, then live:

```
Client                            Server
──────                            ──────

subscribe('cursors:room1') ─────►

  ┌─ Phase 1: State ──────────────────────────────┐
  │  Server freezes offset at N.                  │
  │  Client paginates through current entries.    │
  │                                               │
  │   ◄──── batch 1  (entries 1..50)              │
  │   ◄──── batch 2  (entries 51..100)            │
  │   ◄──── batch 3  (entries 101..150)           │
  │   ...                                         │
  └───────────────────────────────────────────────┘

  ┌─ Phase 2: Catch-up ───────────────────────────┐
  │  Updates that committed during Phase 1.       │
  │                                               │
  │   ◄──── update at offset N+1                  │
  │   ◄──── update at offset N+2                  │
  │   ◄──── ... up to current top (offset M)      │
  └───────────────────────────────────────────────┘

  on('sync') fires  ◄────  state is ready

  ┌─ Phase 3: Live ───────────────────────────────┐
  │   ◄──── update at offset M+1                  │
  │   ◄──── update at offset M+2                  │
  │   ...                                         │
  └───────────────────────────────────────────────┘
```

Convergence is guaranteed by the protocol's offset tracking, not by application-side dedup. The SDK handles all transitions silently; the application only sees `sync` (state ready) and `update` (live entries). On reconnect, the same offset comparison decides whether to ship missed updates or re-sync from scratch — convergence is guaranteed either way.

**Not CRDTs, by choice.** CRDTs are powerful, but they're a heavy commitment for an application: the server has to understand and merge entries, the data has to fit specific algorithm shapes (counters, OR-sets, Yjs documents), and debugging means reasoning about merge semantics. That trade is right for a collaborative editor with field-level conflict resolution. It's overkill for a presence map, a leaderboard, or a feature-flag set. Centrifugo stays a transport: map subscriptions deliver synchronized opaque key-value entries — JSON, Protobuf, anything — with convergence on reconnect guaranteed by offset/epoch tracking, not by merge semantics. The application decides what's in each entry; Centrifugo doesn't try to model it.

**Storage matches state lifetime.** Different collections have different lifetime needs, and the same protocol works on three storage tiers:

- **Memory or Redis** for ephemeral state — cursors, typing indicators, in-flight matches. Nothing touches your application database; values are worthless after the client leaves.
- **Redis with history** for time-bounded state — in-progress games, live scoreboards, lobby rosters. Reconnects within the window deliver missed updates rather than re-sending the snapshot.
- **Postgres** for long-lifetime collections — feature flags, configuration, catalog state. Durable, queryable from `psql`, survives restarts.

The broker is a configuration choice on the server. The protocol on the wire is identical.

**Presence is a map subscription.** Centrifugo has had presence (who's connected to a channel) for years — historically a parallel API with its own semantics. Map subscriptions express presence as a special case: the broker tracks per-client entries with TTL keyed on connection ID. One protocol primitive, presence scales the same way map subscriptions do.

How far does that go? Two browser tabs subscribed to a single `map_clients` channel with **100,000 connected members**, joining mid-fill, converging to the same state, then surviving page reloads (the demo from [Part 1 of the map subscriptions post](/blog/2026/05/13/map-subscriptions)):

<video width="100%" controls preload="metadata" src="/img/demo_map_presence.mp4"></video>

While we don't expect 100k keys in most map subscription use cases and don't recommend it for production, it's good to see that the protocol is capable.

## Shared poll subscriptions — inverting the polling model

Shared poll is the answer when the backend doesn't control writes. The client subscribes to a channel and calls `track(keys)` for the items it cares about. Centrifugo aggregates tracked keys across all clients on a node, polls the backend once per cycle (a configurable interval, typically 1–5 seconds) for the union, and pushes only the changed entries back. When the application *does* control the write — and wants instant delivery for that path — it can also publish directly via `shared_poll_publish`, bypassing the cycle. The two paths combine: polling is the baseline, direct publish layers on top.

<SharedPollDiagram />

If 10,000 clients are watching overlapping sets covering 200 unique posts, the backend sees one request for those 200 items per cycle — not 10,000. Backend load scales with `O(unique items tracked)`, not `O(connected clients)`. The client API is one subscription with dynamic per-key tracking:

```javascript
const sub = client.newSharedPollSubscription('post_votes:feed', {
  // Backend signs the subset of keys this user is allowed to track.
  getSignature: async ({ keys }) => api.signKeys(keys),
});

sub.on('update', (ctx) => updateVoteWidget(ctx.key, ctx.data));

sub.subscribe();
sub.track(getVisiblePostIds());     // call again on scroll to add/remove keys
```

The demo shows the polling + direct-publish combination at work: timer polling delivers the baseline refresh cadence, while `shared_poll_publish` from the write path delivers fresh votes in milliseconds. You get the scale story of shared polling (one backend request per cycle for the union of tracked items) *and* low-latency delivery when the application can publish on the write — not a choice between them. Each vote count is a tracked key, and the set updates dynamically as the user scrolls:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_votes.mp4"></video>

**HMAC, not JWT, for per-item authorization.** A shared poll client tracks many keys within a single channel subscription. Authorizing each key would be expensive with JWT verification (asymmetric crypto, larger token payloads). HMAC is roughly an order of magnitude faster to generate and verify. Tracked keys are first-class values in the protocol rather than buried in a token; when the client calls `track(keys)`, the backend signs only the authorized subset and returns the signature. Centrifugo verifies the HMAC locally on every track request — no auth-service round-trip on the hot path. If the backend returns fewer keys than requested, the omitted keys are treated as revoked, propagating access changes on the next signature refresh.

**Latency varies by integration; correctness doesn't.** Polling alone is enough to keep every tracked key in sync at the configured cadence, regardless of what else is wired in. Direct publish via `shared_poll_publish` lowers latency on application write paths; if a publish is missed for any reason, the next poll cycle catches up.

## Postgres as a first-class integration

For state that needs durability — map subscriptions backed by Postgres, stream subscriptions where atomicity matters — Centrifugo now ships three Postgres-backed components: a **stream broker**, a **map broker**, and a **controller** for cross-node coordination. They share one operational pattern — partitioned outbox tables, shard locks for write serialization, LISTEN/NOTIFY for wakeup, daily retention — so an operator who learns the model once knows how all three behave.

**Outbox, not WAL/CDC.** The straightforward way to bridge a database to a real-time layer is logical replication: read the WAL, fan changes out. Tools like Debezium make that work. We chose a different approach — an explicit outbox table that the application writes to transactionally, with Centrifugo workers polling it:

- The application controls *what* gets published. WAL-based CDC turns every row change into a candidate publication; an outbox is opt-in per row.
- Outbox writes commit with the application transaction. If the transaction rolls back, the publish disappears with it. WAL-based publish-after-commit can drift from application semantics in subtle ways — especially around constraint violations and rollbacks.
- Outbox is portable. No replication slots, no special PG configuration, no operator privileges. A regular database with `INSERT` permission is enough. Works on managed Postgres (RDS, Cloud SQL, Supabase, Neon) without configuration changes.

**LISTEN/NOTIFY for low-latency wakeup, polling for correctness.** Pure polling has predictable latency, bounded by the polling interval. Pure LISTEN/NOTIFY is fast but lossy: notifications can be dropped if listeners fall behind, and the queue is bounded. Centrifugo combines them. NOTIFY wakes the worker; polling reads what's actually there. Worst case, NOTIFY misses a wakeup — the next poll catches up. Best case, end-to-end latency stays in low single-digit milliseconds.

**Daily partitioning, drop-partition cleanup.** Outbox tables grow continuously. Instead of `DELETE` plus VACUUM (millions of dead tuples to chase), we partition by daily date ranges and drop whole partitions on retention boundaries. One DDL per day, vacuum-free at scale.

<PgOutboxDiagram />

Together these decisions enable transactional publishing — a real-time update commits inside the same SQL transaction as the database write that triggers it:

```sql
BEGIN;
  UPDATE orders SET status = 'shipped', updated_at = NOW()
  WHERE id = 42;

  SELECT cf_stream_publish(
    p_channel := 'orders:42',
    p_data    := '{"status": "shipped"}'::jsonb
  );
COMMIT;
```

If the transaction rolls back, the real-time update never happened. No application-side outbox to maintain, no CDC pipeline, no dual-write window. The same shape works for map subscriptions via `cf_map_publish`.

When state already lives in your tables, the broker carries only the change events. The SDK loads initial state from your API and re-syncs against the live stream:

```javascript
const sub = client.newSubscription('orders:42', {
  getState: async () => {
    // Read the stream position FIRST — it becomes a lower bound.
    const pos = await api.getStreamPosition('orders:42');

    // Then load the snapshot from your own API.
    const orders = await api.getOrders(42);
    renderOrders(orders);

    return pos;   // SDK subscribes from here
  },
});

sub.on('publication', (ctx) => applyOrderUpdate(ctx.data));
sub.subscribe();
```

On normal reconnects, the SDK replays missed publications from stream history transparently — `getState` doesn't fire. It's only called when the gap exceeds what history covers (long disconnects, retention boundaries); the SDK switches paths automatically. The application database stays the source of truth; the broker carries only what changed.

A concrete example: a kitchen-orders system with one channel per restaurant. Every order write commits with a publish to `kitchen:{restaurant_id}` in the same transaction; each channel has its own offset space; writes on different restaurants are independent. Thousands of tenants on a single Postgres instance:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_kitchen.mp4"></video>

## Running the whole stack on Postgres

Multi-node Centrifugo has always needed a control-message bus — for subscribe propagation, disconnects, presence pings, and node surveys. Until this release, Redis was the practical default. The third Postgres-backed component is a **controller** that implements the same bus on the same outbox-on-Postgres foundation as the brokers — so the entire messaging plane can run on Postgres alone:

```json title="config.json — multi-node, Postgres-only messaging plane"
{
  "broker": {
    "enabled": true,
    "type": "postgres",
    "postgres": { "dsn": "...", "use_notify": true }
  },
  "map_broker": {
    "type": "postgres",
    "postgres": { "dsn": "...", "use_notify": true }
  },
  "controller": {
    "enabled": true,
    "type": "postgres",
    "postgres": { "dsn": "...", "use_notify": true }
  }
}
```

For applications already running Postgres for everything else, the messaging plane has what it needs. No Redis, no NATS, no separate pub/sub broker.

## Where this leaves Centrifugo

For more than a decade, Centrifugo has been a channel-based pub/sub server. With v6.8.0, it evolves into a realtime backend with general-purpose primitives. Different subscription types address different shapes of realtime applications.

Stream subscriptions remain the primary primitive for most deployments—chat, notifications, activity feeds, audit logs, and other event-shaped workloads—with or without history and recovery. Map and shared poll sit alongside, covering patterns that traditional pub/sub alone does not handle well. The brokers behind all of them can run on memory, Redis, or Postgres; for teams already using Postgres, the database becomes a first-class option.

While the new subscription types expand the surface area, we’ve reused the existing protocol wherever possible and preserved established channel behavior. The transport remains generic. The protocol stays payload-agnostic. Your data stays yours.
