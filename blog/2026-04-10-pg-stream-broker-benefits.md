---
title: Transactional publishing for stream subscriptions with PostgreSQL
tags: [centrifugo, postgresql, streams, outbox]
description: The PostgreSQL stream broker brings the same transactional publishing guarantee to stream subscriptions — notifications, activity feeds, audit logs, order updates — that the map broker brought to keyed state. Publish inside your database transaction, no Redis required.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
hide_table_of_contents: false
---

In [Part 2 of the map subscriptions series](/blog/2026/04/08/map-subscriptions-part-2), we introduced a PostgreSQL map broker that lets your application publish real-time map updates inside a database transaction — eliminating the dual-write problem. That capability applied only to map subscriptions — keyed state like leaderboards, collaborative boards, and inventories.

Today we're extending the same guarantee to **stream subscriptions** — the ordered-event primitive that powers notifications, activity feeds, chat messages, audit logs, and order updates. If you have a database row and you want to announce a change in real time, you can now do it atomically with your write — same `BEGIN / COMMIT`, same outbox architecture, same "no Redis" simplicity.

<!--truncate-->

## The dual-write problem, revisited

If you've integrated a real-time system with a database, you've hit this: your backend writes to the database, then publishes to the real-time layer. Two separate writes. If the process crashes between them — or if the publish fails — the database and your subscribers diverge. Users see stale data until they refresh.

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

## External state for streams

The [external state pattern](/blog/2026/04/07/map-subscriptions#ordering-conditional-writes-and-external-state) we introduced for map subscriptions is arguably an even better fit for streams. Notifications and chat messages already live in your application database with their own retention. The stream broker keeps a thin bridging window in `cf_stream_history` (the partition retention window) while your app DB remains the single source of truth for historical data.

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

On error (network failure, database timeout), the SDK emits an error event and retries with backoff — matching the error handling behavior of `getState` in [map subscriptions](/blog/2026/04/07/map-subscriptions#ordering-conditional-writes-and-external-state).

## Performance

On a local PostgreSQL 16 (Homebrew, Apple M4):

| Operation | Result |
|---|---|
| **Publish** | ~17,000 ops/sec |
| **Publish → delivery latency** | ~2 ms |
| **Partition drop** (10K rows) | ~1 ms |

These numbers are from a single Centrifugo instance. In production, multiple Centrifugo nodes and application instances call `cf_stream_publish` concurrently — aggregate throughput scales with the number of writers up to PostgreSQL's own write capacity. For notification, audit-log, and order-update workloads this is plenty of headroom. For ultra-high-volume telemetry that doesn't need transactional publishing, the Redis broker remains the right choice.

## The complete PostgreSQL story

With the stream broker, both Centrifugo subscription primitives can run entirely on PostgreSQL:

| Use case | Subscription type | PG broker |
|---|---|---|
| Notifications, activity feeds, chat, audit logs, order updates | Stream | `cf_stream_publish` |
| Collaborative documents, inventory, leaderboards, game lobbies | Map | `cf_map_publish` |

Both share the same outbox architecture, the same partitioned-table cleanup model, and the same operational story.

For multi-node deployments, [Centrifugo PRO](/docs/pro/overview) completes the picture with a **[PostgreSQL Controller](/docs/pro/scalability#postgresql-controller)** — the component responsible for cross-node coordination (node discovery, subscribe/unsubscribe propagation, disconnect commands). The controller uses the same outbox pattern: control messages go into a partitioned table, each node polls for new entries, and LISTEN/NOTIFY provides low-latency wakeup.

With the stream broker, the map broker, and the PRO controller all on PostgreSQL, you can run a fully functional multi-node Centrifugo cluster using PostgreSQL as the only infrastructure dependency — no Redis, no Nats. If your application already has PostgreSQL, you already have everything you need for real-time.

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

The broker automatically creates the schema (`cf_stream_history`, `cf_stream_meta`, `cf_stream_publish`, etc.) on startup. Call `cf_stream_publish` from your application's SQL transactions to publish atomically.

Read the full [stream broker documentation](/docs/server/engines#postgresql-broker) for configuration reference, and see the [map subscriptions Part 2](/blog/2026/04/08/map-subscriptions-part-2) post for the outbox architecture deep-dive that both brokers share.
