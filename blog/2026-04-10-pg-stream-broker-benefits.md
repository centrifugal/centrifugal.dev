---
title: Transactional publishing for stream subscriptions with PostgreSQL
tags: [centrifugo, postgresql, streams, outbox]
description: The PostgreSQL stream broker brings transactional publishing to Centrifugo traditional subscription type. Combined with the new PostgreSQL controller, OSS Centrifugo now runs a multi-node messaging cluster on PostgreSQL alone — no Redis, no NATS.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/blog_pg_stream.jpg
hide_table_of_contents: false
---

In [Part 2 of the map subscriptions series](/blog/2026/04/08/map-subscriptions-part-2), we introduced a PostgreSQL map broker that lets your application publish real-time map updates inside a database transaction — removing the dual-write problem for callers that publish via the broker's SQL function from their own transactions. That capability applied only to map subscriptions — keyed state like leaderboards, collaborative boards, and inventories.

Today we're extending the same shape to **stream subscriptions** — the ordered-event primitive that powers notifications, activity feeds, chat messages, audit logs, and order updates. If you have a database row and you want to announce a change in real time, you can now do it atomically with your write — same `BEGIN / COMMIT`, same outbox architecture, same "no Redis" simplicity.

A more significant change accompanies this: with a new PostgreSQL controller, an OSS Centrifugo cluster can now run with PostgreSQL as the only messaging-plane dependency — no Redis, no NATS. Details below.

<!--truncate-->

:::caution Experimental

The PostgreSQL stream broker and the PostgreSQL controller (covered later in this post) are recent additions. The SQL function shapes, configuration keys, and outbox internals may change based on feedback before they're considered stable.

:::

## The dual-write problem, revisited

Integrating a real-time system with a relational database creates the same gap: the backend writes to the database, then publishes to the real-time layer as a separate operation. If the process crashes between them — or if the publish fails — the database and subscribers fall out of sync. Users see stale data until they refresh.

We [covered this in depth](/blog/2026/04/08/map-subscriptions-part-2#the-dual-write-problem) for map subscriptions. The same problem applies — arguably more broadly — to stream subscriptions. Every notification system, every audit trail, every order-status feed has the same shape: write a row to your database, then announce the change over WebSocket. The PostgreSQL stream broker lets you combine both into one transaction.

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
- **Same PRO scaling features** — read replicas and broker fan-out work identically for stream channels

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

The PG stream broker collapses this if you make the aggregator the publisher to Centrifugo (instead of Centrifugo reading Kafka in parallel). For each Kafka batch the aggregator processes, it does — in one PG transaction — both the snapshot UPDATE *and* a `cf_stream_publish(...)` for the new event(s). Snapshot mutation and broker publish commit together; they can never disagree about what's been observed. The snapshot row stays minimal — just the aggregate, no offset bookkeeping. The client's `getState` follows the same recipe shown above: open a `REPEATABLE READ` transaction, read `cf_stream_top_position` first, then read the snapshot, return the captured position. The SDK subscribes from there, and any publications committed after the position read arrive as stream catch-up — no overlap with what's in the snapshot row to reconcile.

This shape — aggregator-as-publisher, single-tx atomicity for the snapshot update + the publish — is the natural fit whenever you have an upstream feed (Kafka, NATS, CDC, anything else) being shaped into stored views. The PG stream broker removes the cross-system offset bridge by making one process responsible for both the stored aggregate and the broker stream that describes its evolution.

## Performance

On a local PostgreSQL 16 (Homebrew, Apple M4):

| Operation | Result |
|---|---|
| **Publish** | ~17,000 ops/sec |
| **Publish → delivery latency** | ~2 ms |
| **Partition drop** (10K rows) | ~1 ms |

These numbers are from a single Centrifugo instance running the broker's Go integration tests in benchmark mode against the same machine's PostgreSQL — small JSON payloads, default broker configuration, parallel goroutines exercising `cf_stream_publish`. They're rough indicators of order-of-magnitude, not portable production guarantees: real workloads vary with payload size, connection pool, network latency, and your PostgreSQL's own write capacity. In production, multiple Centrifugo nodes and application instances call `cf_stream_publish` concurrently — aggregate throughput scales with the number of writers up to PostgreSQL's own write capacity. For notification, audit-log, and order-update workloads this is plenty of headroom. For ultra-high-volume telemetry that doesn't need transactional publishing, the Redis broker remains the right choice.

## Multi-node messaging cluster on PostgreSQL alone

This is the part that changes the deployment story for OSS users. Until recently, running Centrifugo across multiple nodes required Redis for cross-node coordination — propagating control messages between nodes (subscribes/unsubscribes, disconnect commands, node-presence pings). NATS is also possible, but **only as a Centrifugo PRO option**, so the OSS reality was effectively "Redis or nothing". That made Redis a hard dependency for any horizontally scaled OSS deployment, even when the actual real-time workload would have been comfortable on PostgreSQL.

The new **PostgreSQL Controller** in Centrifugo OSS removes that dependency. It implements the centrifuge `Controller` interface as a PG-backed control-message bus, using the same outbox pattern as the brokers: control messages go into a partitioned table, each node polls for new entries, and `LISTEN/NOTIFY` provides low-latency wakeup. Whatever the centrifuge node abstraction layer needs to broadcast or target between nodes — subscribe propagation, disconnect commands, peer pings — flows through that bus. No new pub/sub infrastructure beyond the PG you already have.

With the stream broker, the map broker, and the controller all on PostgreSQL, you can run a **multi-node Centrifugo messaging cluster with PostgreSQL as the only infrastructure dependency for the messaging plane** — no Redis, no NATS. If your application already runs PostgreSQL, you already have what you need for the messaging tier at typical cluster sizes.

```json title="config.json — multi-node, PG-only messaging"
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

For teams that previously required Redis to scale Centrifugo horizontally, this consolidates the messaging tier to a single, already-present dependency. For larger fleets, [Centrifugo PRO](/docs/pro/overview) adds optimizations on top — broker fan-out (one node per shard polls PostgreSQL and re-broadcasts via Redis or NATS), in-memory caches, and read-replica support for the data plane — but the cluster works on plain PostgreSQL out of the box.

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

Read the full [stream broker documentation](/docs/server/engines#postgresql-broker) for configuration reference, and see the [map subscriptions Part 2](/blog/2026/04/08/map-subscriptions-part-2) post for the outbox architecture deep-dive that both brokers share.
