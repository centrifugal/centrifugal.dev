---
title: Transactional publishing for stream subscriptions with PostgreSQL
tags: [centrifugo, postgresql, streams, outbox]
description: The PostgreSQL stream broker brings transactional publishing to Centrifugo's stream subscriptions. Real-time updates commit alongside the database write that triggers them — same SQL transaction, no application-side outbox, no CDC pipeline, no separate publish API call.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/blog_pg_stream_broker.jpg
hide_table_of_contents: false
draft: false
---

In [Part 2 of the map subscriptions series](/blog/2026/05/23/map-subscriptions-part-2), we introduced a PostgreSQL map broker that lets your application publish real-time map updates inside a database transaction — removing the dual-write problem when you publish via the broker's SQL function from your own transactions. That capability applied only to map subscriptions — keyed state like leaderboards, collaborative boards, and inventories.

Today we're extending the same shape to **stream subscriptions** — the ordered-event primitive that powers notifications, activity feeds, chat messages, audit logs, and order updates. If you have a database row and you want to announce a change in real time, you can now do it atomically with your write — same `BEGIN / COMMIT`, same outbox architecture, same "no Redis" simplicity.

<!--truncate-->

:::info New and evolving

Available in Centrifugo v6.8.0+. The PostgreSQL stream broker is a recent addition — we're eager for feedback. SQL function shapes, configuration keys, and outbox internals may still adjust before they're considered stable.

:::

:::tip TL;DR

- Call `cf_stream_publish(...)` inside the same SQL transaction as your row write — both commit atomically. No outbox table to manage in your app, no CDC pipeline, no dual-write gap.
- The broker shares its outbox infrastructure with the [PG map broker](/blog/2026/05/23/map-subscriptions-part-2) — partitioned table, `LISTEN/NOTIFY` for low-latency wakeup, vacuum-free retention.
- Worked through below: per-tenant channels — one per restaurant over a shared `orders` table — with a runnable kitchen-orders demo.
- The client side of this (loading app-owned state, staying in sync across reconnects via the SDK's `getState` callback) is covered in [App-owned state with stream subscriptions](/blog/2026/07/27/app-owned-state-stream-subscriptions).

:::

## The dual-write problem, revisited

Integrating a real-time system with a relational database creates the same gap: the backend writes to the database, then publishes to the real-time layer as a separate operation. If the process crashes between them — or if the publish fails — the database and subscribers fall out of sync. Users see stale data until they refresh.

We [covered this in depth](/blog/2026/05/23/map-subscriptions-part-2) for map subscriptions. The same problem applies — even more broadly — to stream subscriptions. Every notification system, every audit trail, every order-status feed has the same shape: write a row to your database, then announce the change over WebSocket. The PostgreSQL stream broker lets you combine both into one transaction.

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

## A concrete example: per-tenant channels

A kitchen-orders system shows the shape well: a single `orders` table shared by all restaurants, and one channel per restaurant — `kitchen:{restaurant_id}` — so each kitchen display only sees its own. The demo below is runnable from the [pg_stream_broker example](https://github.com/centrifugal/examples/tree/master/v6/pg_stream_broker) on GitHub:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_kitchen.mp4"></video>

Every write to a restaurant's orders commits atomically with a publish on that restaurant's channel:

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

Status transitions (`received` → `preparing` → `ready` → `served`) do the same — `UPDATE orders` plus `cf_stream_publish(p_channel := 'kitchen:42', …)` in one transaction. The application follows one rule: every code path that mutates a row for restaurant X emits the publish for `kitchen:X` in the same transaction.

Each channel has its own meta row and its own top offset; writes on `kitchen:99` never block or interfere with `kitchen:42`. This scales to thousands of tenants on a single PostgreSQL — each channel is an independent append-only stream, and the shared `cf_stream` partitioned table absorbs the union.

## App-owned state with stream subscriptions

The kitchen demo has a property worth naming: the `orders` table is the only source of truth. There's no duplicate state table and no broker-managed snapshot — Centrifugo streams the change events, and the stream broker keeps just a thin bridging window in `cf_stream` (the partition retention window) while the app database owns everything historical.

The client side of that pattern — loading the current orders and staying in sync across reconnects — is handled by the SDK's `getState` callback for stream subscriptions, and it is a topic of its own. [App-owned state with stream subscriptions](/blog/2026/07/27/app-owned-state-stream-subscriptions) walks through it, including the read path of this kitchen demo and a second shape where an aggregator fronts a Kafka feed.

## Performance

On a local PostgreSQL 16 (Homebrew, Apple M4):

| Operation | Result |
|---|---|
| **Publish** | ~17,000 ops/sec |
| **Publish → delivery latency** | ~2 ms |
| **Partition drop** (10K rows) | ~1 ms |

These numbers are from a single Centrifugo instance running the broker's Go integration tests in benchmark mode against the same machine's PostgreSQL — small JSON payloads, default broker configuration, parallel goroutines exercising `cf_stream_publish`. They're rough estimates, not numbers you can take to production: real workloads vary with payload size, connection pool, network latency, and your PostgreSQL's own write capacity. In production, multiple Centrifugo nodes and application instances call `cf_stream_publish` concurrently — aggregate throughput scales with the number of writers up to PostgreSQL's own write capacity. For notification, audit-log, and order-update workloads this is plenty of headroom. For ultra-high-volume telemetry that doesn't need transactional publishing, the Redis broker remains the right choice.

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

Read the full [stream broker documentation](/docs/server/engines#postgresql-broker) for configuration reference, and see the [map subscriptions Part 2](/blog/2026/05/23/map-subscriptions-part-2) post for the outbox architecture deep-dive that both brokers share.
