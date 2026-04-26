---
title: Transactional publishing for stream subscriptions with PostgreSQL
tags: [centrifugo, postgresql, streams, outbox]
description: The PostgreSQL stream broker brings transactional publishing to Centrifugo's stream subscriptions. Real-time updates commit alongside the database write that triggers them — same SQL transaction, no application-side outbox, no CDC pipeline, no separate publish API call.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/blog_pg_stream_broker.jpg
hide_table_of_contents: false
draft: true
---

In [Part 2 of the map subscriptions series](/blog/2026/04/30/map-subscriptions-part-2), we introduced a PostgreSQL map broker that lets your application publish real-time map updates inside a database transaction — removing the dual-write problem for callers that publish via the broker's SQL function from their own transactions. That capability applied only to map subscriptions — keyed state like leaderboards, collaborative boards, and inventories.

Today we're extending the same shape to **stream subscriptions** — the ordered-event primitive that powers notifications, activity feeds, chat messages, audit logs, and order updates. If you have a database row and you want to announce a change in real time, you can now do it atomically with your write — same `BEGIN / COMMIT`, same outbox architecture, same "no Redis" simplicity.

<!--truncate-->

:::info New and evolving

The PostgreSQL stream broker is a recent addition — we're eager for production feedback. SQL function shapes, configuration keys, and outbox internals may still adjust before they're considered stable.

:::

:::tip TL;DR

- Call `cf_stream_publish(...)` inside the same SQL transaction as your row write — both commit atomically. No outbox table to manage in your app, no CDC pipeline, no dual-write gap.
- The broker shares its outbox infrastructure with the [PG map broker](/blog/2026/04/30/map-subscriptions-part-2) — partitioned table, `LISTEN/NOTIFY` for low-latency wakeup, vacuum-free retention.
- Pairs with a `getState` callback in the SDK: load app-owned state plus a stream position in one shot; the SDK subscribes from there and recovers automatically on reconnect.
- Two concrete shapes worked through below: an aggregator-as-publisher fronting a Kafka feed, and per-tenant channels (one per restaurant) over a shared `orders` table.

:::

## The dual-write problem, revisited

Integrating a real-time system with a relational database creates the same gap: the backend writes to the database, then publishes to the real-time layer as a separate operation. If the process crashes between them — or if the publish fails — the database and subscribers fall out of sync. Users see stale data until they refresh.

We [covered this in depth](/blog/2026/04/30/map-subscriptions-part-2#the-dual-write-problem) for map subscriptions. The same problem applies — arguably more broadly — to stream subscriptions. Every notification system, every audit trail, every order-status feed has the same shape: write a row to your database, then announce the change over WebSocket. The PostgreSQL stream broker lets you combine both into one transaction.

## Publishing inside your transaction

Centrifugo creates a `cf_stream_publish` SQL function when the PostgreSQL stream broker initializes. Your application calls it inside its own transaction:

```sql
BEGIN;
  -- Business logic: update order status
  UPDATE orders SET status = 'shipped', updated_at = NOW()
  WHERE id = 42;

  -- Publish to real-time channel (same transaction)
  SELECT * FROM cf_stream_publish(
    p_channel := 'orders:42',
    p_data    := '{"status": "shipped"}'::jsonb
  );
COMMIT;
```

If the transaction rolls back, the real-time update never happened. No outbox table to manage in your application, no CDC pipeline, no eventual consistency — just a single transaction. The architecture is the same outbox pattern we use for map subscriptions: all writes land in PostgreSQL tables atomically, and Centrifugo's outbox workers pick up new entries and deliver them to subscribers. When `use_notify` is enabled, delivery latency drops to low single-digit milliseconds.

The transactional guarantee applies to **callers using the SQL function path** — i.e. your backend code calling `cf_stream_publish` directly inside its own SQL transaction alongside the row write. Publishes that go through Centrifugo's HTTP/GRPC API remain a separate operation from your DB write (the historic dual-write shape) — same as before. The SQL function path is what removes that gap; it's an additional integration option, not a change to existing publish APIs.

## One infrastructure for both primitives

The stream broker shares the same infrastructure as the map broker:

- **Same outbox pattern** — per-shard workers poll a partitioned stream table, coordinate via shard locks, wake via LISTEN/NOTIFY
- **Same daily partitioning** — the stream table is `PARTITION BY RANGE (created_at)` with automatic lookahead and retention. Old partitions are dropped whole — vacuum-free cleanup at scale
- **Same configuration shape** — `dsn`, `num_shards`, `use_notify`, `partition_retention_days`, `partition_lookahead_days`
- **Same PRO scaling features** — at higher cluster sizes, every Centrifugo node polling PG independently adds visible read load, and history queries on busy channels begin contending with writes on the primary. PRO's broker fan-out and read-replica routing apply identically to stream channels (the in-memory cache layer is map-broker-specific) — see the [PG map broker post](/blog/2026/04/30/map-subscriptions-part-2#scaling-with-centrifugo-pro) for the full breakdown of when each kicks in

If you're already running the PostgreSQL map broker, the stream broker is the same operational model. If you're not — the stream broker is a clean entry point to the "Centrifugo + PostgreSQL" stack without needing to understand map subscriptions first.

## What's different from the map broker

The stream broker is simpler — it has no state table, no keyed entries, no CAS operations. Streams are append-only. The key differences from the map broker:

**Two independent TTLs.** Stream subscriptions have `HistoryTTL` (how long publications are queryable) and `HistoryMetaTTL` (how long the channel's epoch survives). The map broker has a single `MetaTTL`. The two-TTL model lets you keep a channel's identity alive for reconnection (long MetaTTL) while limiting queryable history to a short window (short HistoryTTL).

**Read-time TTL filter.** History queries apply a `WHERE created_at > NOW() - history_ttl` filter at read time, so the result is always correct regardless of when cleanup last ran. Cleanup is purely a storage optimization, not a correctness requirement.

**HistorySize at read time.** The broker doesn't enforce HistorySize at write time (no MAXLEN-style trim). Instead, History() clamps the result window to the most recent N entries. This means a forward recovery query from an old position correctly detects the gap and triggers a fresh subscribe — matching Redis broker semantics.

## App-owned state with stream subscriptions

The differences above reflect a distinction in data ownership. For applications where the data already lives in your own tables — orders, notifications, activity feeds, chat — the stream broker is enough on its own. No duplicate state table, no broker-managed snapshot. Your app database is the source of truth; Centrifugo streams only the change events. The stream broker keeps a thin bridging window in `cf_stream` (the partition retention window) while your app DB owns historical data.

The client SDK now supports a `getState` callback for stream subscriptions that automates this pattern. We [previously described](/blog/2024/06/03/real-time-document-state-sync) the challenge of synchronizing a document state loaded from a REST API with a real-time subscription — the race window between the HTTP response and the subscription start, the need to handle `recovered: false` on reconnects, the manual position tracking. The `getState` callback solves all of this natively:

```javascript
const sub = client.newSubscription('orders:user_42', {
  getState: async () => {
    // 1. Capture stream position FIRST
    const pos = await api.getStreamPosition('orders:user_42');
    // 2. Then load your data
    const orders = await api.getOrders(42);
    renderOrders(orders);
    // 3. Return the position — SDK recovers from here
    return { offset: pos.offset, epoch: pos.epoch };
  },
});

sub.on('publication', (ctx) => {
  // Incremental updates — applied after getState on initial load,
  // and after each reconnect where recovery succeeds.
  applyOrderUpdate(ctx.data);
});

sub.subscribe();
```

The callback is called on initial subscribe and when recovery fails after a reconnect. On normal reconnects where the server successfully recovers missed publications, `getState` is not called — recovered publications simply arrive as `publication` events. When recovery fails (history expired, epoch changed), the SDK calls `getState` again automatically: the app refreshes from its source of truth, and the SDK resubscribes from the fresh position.

The position should come from `cf_stream_top_position`, called inside the same transaction (or before) your data read. Reading position first ensures it's a lower bound — recovered publications may overlap with your loaded data, but you'll never have gaps. This works correctly when updates are idempotent (e.g. "set status to shipped"). For non-idempotent updates, deduplicate by publication offset — the same consideration we described in [Proper real-time document state synchronization](/blog/2024/06/03/real-time-document-state-sync), but now handled by the SDK rather than application code.

On error (network failure, database timeout), the SDK emits an error event and retries with backoff.

## A concrete example: Kafka aggregator + live snapshot

One concrete integration pattern this design handles particularly well: a service that consumes a Kafka topic and maintains aggregated views in PostgreSQL — say, a price board built from a market-data topic. The browser client needs to fetch the current aggregate and then receive live updates. With Centrifugo as a separate Kafka consumer fanning the same topic out to WebSocket subscribers, you end up bridging two unrelated offset spaces — the snapshot row stores a Kafka offset, the live subscription speaks Centrifugo offsets, and the client has to subscribe with a recent stream position and discard everything older than the snapshot's Kafka offset. It works, but the bridging logic is awkward and easy to get subtly wrong.

```
─── Write path (single PG txn ties snapshot + publish) ───────────

   Kafka topic
       │ batch
       ▼
  ┌────────────┐
  │ Aggregator │
  └─────┬──────┘
        │   BEGIN
        │     UPDATE snapshot SET aggregate = ...
        │     cf_stream_publish(channel, event)
        │   COMMIT              ← both land atomically
        ▼
  ┌──────────────────────────────┐
  │          PostgreSQL          │
  │   ┌──────────┐ ┌──────────┐  │
  │   │ snapshot │ │cf_stream │  │
  │   │   row    │ │  outbox  │  │
  │   └──────────┘ └────┬─────┘  │
  └────────────────────┬┴────────┘
                       │ LISTEN/NOTIFY + poll
                       ▼
                 ┌──────────────┐
                 │  Centrifugo  │
                 │ (PG broker)  │
                 └──────────────┘


─── Read path (position first; catch-up applied idempotently) ────

  Browser ──1. GET /state──► App server
                                 │ pos  = cf_stream_top_position(ch)
                                 │ snap = SELECT aggregate FROM ...
  Browser ◄──── (snap, pos) ─────┘

  Browser ──2. subscribe(ch, since=pos)──► Centrifugo
  Browser ◄─── catch-up from pos → live ──┘
             (events committed between the two reads
              arrive here; idempotent apply reconciles)
```

The PG stream broker collapses this if you make the aggregator the publisher to Centrifugo (instead of Centrifugo reading Kafka in parallel). For each Kafka batch the aggregator processes, it does — in one PG transaction — both the snapshot UPDATE *and* a `cf_stream_publish(...)` for the new event(s). Snapshot mutation and broker publish commit together; they can never disagree about what's been observed. The snapshot row stays minimal — just the aggregate, no offset bookkeeping.

The client's `getState` follows the same recipe shown earlier: read `cf_stream_top_position` first, then read the snapshot, return the captured position. Position first makes it a lower bound — events committed between the two reads arrive as stream catch-up on top of the snapshot, and the application applies them idempotently (the same assumption `getState` requires in general). For a price-board aggregate this is natural: each event is an absolute price, not a delta.

If you'd rather eliminate that replay window entirely — for example, when events are non-idempotent deltas and you don't want to add offset-based dedup — wrap both reads in a single `REPEATABLE READ` transaction. Both reads then see the same MVCC snapshot: the returned position is the exact watermark baked into the snapshot, and catch-up delivers only events committed strictly after it — no overlap to reconcile at all.

This shape — aggregator-as-publisher, single-tx atomicity for the snapshot update + the publish — is the natural fit whenever you have an upstream feed (Kafka, NATS, CDC, anything else) being shaped into stored views. The PG stream broker removes the cross-system offset bridge by making one process responsible for both the stored aggregate and the broker stream that describes its evolution.

## A second shape: per-tenant channels

The Kafka example is one flavor — an upstream feed shaped into a single aggregate. A second, very common flavor is internal writes partitioned by tenant: one shared table, many independent consumers. A kitchen-orders system is a clean example — a single `orders` table across all restaurants, but each restaurant's kitchen display only cares about its own channel. The demo below is runnable from the [pg_stream_broker example](https://github.com/centrifugal/examples/tree/master/v6/pg_stream_broker) on GitHub:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_kitchen.mp4"></video>

The channel shape is `kitchen:{restaurant_id}`. Every write to a restaurant's orders commits atomically with a publish on that restaurant's channel:

```sql
BEGIN;
  INSERT INTO orders (id, restaurant_id, status, items, updated_at)
  VALUES (7001, 42, 'received', $1, NOW());

  SELECT cf_stream_publish(
    p_channel := 'kitchen:42',
    p_data    := '{"order_id":7001,"status":"received",...}'::jsonb
  );
COMMIT;
```

Status transitions (`received` → `preparing` → `ready` → `served`) do the same — `UPDATE orders` + `cf_stream_publish('kitchen:42', …)` in one transaction. The invariant the application must preserve is: every code path that mutates a row for restaurant X emits the publish for `kitchen:X` in the same transaction.

The read path is the position-first recipe from earlier, with the snapshot filtered by restaurant:

```sql
SELECT * FROM cf_stream_top_position('kitchen:42');

SELECT id, status, items, updated_at
FROM orders
WHERE restaurant_id = 42
  AND status IN ('received','preparing','ready');
```

Each channel has its own meta row and its own `top_offset`; writes on `kitchen:99` never block or interfere with `kitchen:42`. This scales naturally to thousands of tenants on a single PostgreSQL — each channel is an independent append-only stream, and the shared `cf_stream` partitioned table just absorbs the union. For the kitchen scenario, events carry `order_id` plus `updated_at`, so the client applies them as upserts with last-write-wins — any catch-up replay between the two reads is reconciled automatically.

## Performance

On a local PostgreSQL 16 (Homebrew, Apple M4):

| Operation | Result |
|---|---|
| **Publish** | ~17,000 ops/sec |
| **Publish → delivery latency** | ~2 ms |
| **Partition drop** (10K rows) | ~1 ms |

These numbers are from a single Centrifugo instance running the broker's Go integration tests in benchmark mode against the same machine's PostgreSQL — small JSON payloads, default broker configuration, parallel goroutines exercising `cf_stream_publish`. They're rough indicators of order-of-magnitude, not portable production guarantees: real workloads vary with payload size, connection pool, network latency, and your PostgreSQL's own write capacity. In production, multiple Centrifugo nodes and application instances call `cf_stream_publish` concurrently — aggregate throughput scales with the number of writers up to PostgreSQL's own write capacity. For notification, audit-log, and order-update workloads this is plenty of headroom. For ultra-high-volume telemetry that doesn't need transactional publishing, the Redis broker remains the right choice.

## Getting started

Configure the PostgreSQL stream broker as your Centrifugo broker:

```json title="config.json"
{
  "broker": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:pass@localhost:5432/app?sslmode=disable",
      "use_notify": true,
      "partition_retention_days": 7
    }
  }
}
```

The broker automatically creates the required tables and SQL functions on startup. Call `cf_stream_publish` from your application's SQL transactions to publish atomically.

Read the full [stream broker documentation](/docs/server/engines#postgresql-broker) for configuration reference, and see the [map subscriptions Part 2](/blog/2026/04/30/map-subscriptions-part-2) post for the outbox architecture deep-dive that both brokers share.
