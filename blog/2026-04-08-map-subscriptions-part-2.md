---
title: Map subscriptions (Part 2) — when your PostgreSQL transaction is your real-time publish
tags: [centrifugo, websocket, state-sync, postgresql]
description: In this post we tell about PostgreSQL map broker which brings real persistence to Centrifugo-owned key-value collections and lets application publish updates inside its own database transactions.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
image: /img/blog_map_subs_02.jpg
authorImageURL: /img/alexander_emelin.jpeg
hide_table_of_contents: false
---

import PgTransactionalDiagram from '@site/src/components/PgTransactionalDiagram';
import PgOutboxDiagram from '@site/src/components/PgOutboxDiagram';

In [Part 1](/blog/2026/04/07/map-subscriptions) we introduced map subscriptions — a Centrifugo-managed real-time key-value collection — and covered the sync protocol, the memory and Redis brokers, and capabilities like conditional writes and scalable presence. This post is about the PostgreSQL map broker: when it makes sense, what makes it different, and the transactional publishing it enables.

<!--truncate-->

Here's what that looks like in practice:

```sql
BEGIN;
  -- Update application data
  UPDATE board_items SET data = '{"text": "Updated card"}'::jsonb
  WHERE board_id = 123 AND item_id = 'card_42';

  -- Publish to real-time channel (same transaction)
  SELECT * FROM cf_map_publish(
    p_channel := 'boards:123',
    p_key     := 'card_42',
    p_data    := '{"text": "Updated card"}'::jsonb
  );
COMMIT;
```

If the transaction rolls back, the real-time update never happened. No outbox table, no CDC pipeline, no eventual consistency — just one PostgreSQL transaction.

This example uses `persistent` mode — board items live until explicitly removed, with no TTL. The namespace configuration would look like:

```json
{
  "name": "boards",
  "subscription_type": "map",
  "map": {
    "mode": "persistent"
  }
}
```

The `stream_size`, `stream_ttl`, and `meta_ttl` settings are auto-derived when not specified (defaults: 100 entries, 1 minute, permanent metadata). See [map modes](/docs/server/map_subscriptions#map-modes) for the full reference.

## When the PostgreSQL map broker is the right tool

The PostgreSQL map broker stores `cf_map_state` and `cf_map_stream` in your PostgreSQL database. The data lives in `cf_map_*` tables that Centrifugo owns. The application's `cf_map_publish` calls write to those tables inside SQL transactions — the broker treats them as the canonical store for the collection.

This fits when **Centrifugo is the natural store for the data**: a feature-flag set, an IoT device fleet's last telemetry per device, a lobby's player roster, a collaborative cursor map for "who's editing what". The collection has no separate home in your application's schema — it exists *because* clients need to see it live. PostgreSQL just gives that broker-owned collection durability, queryability from `psql`, and the same operational model as the rest of your stack.

When the data already lives in your own application tables (`orders`, `documents`, `tickets`, etc.), there's an alternative shape worth knowing about: a **stream subscription with a `getState` callback** backed by the [PostgreSQL stream broker](/blog/2026/04/10/pg-stream-broker-benefits). Your INSERT/UPDATE and the real-time publish commit together, clients render state from your own schema, the broker holds only the change events. We covered that pattern in detail in the [PG stream broker post](/blog/2026/04/10/pg-stream-broker-benefits).

That doesn't make the map broker the wrong choice for app-state cases. Mirroring rows from your own tables into `cf_map_state` (via `cf_map_publish` inside the same transaction as the original write) gives you everything map subscriptions provide on the client — paginated snapshot delivery, per-key TTL with auto-removal, no `getState` endpoint to write — at the cost of carrying a duplicate copy of each row in `cf_map_*`. Some teams will happily pay that cost; others would rather keep their schema as the only source of truth. Both deployments work; the trade is real and worth being deliberate about.

The rest of this post applies to either deployment style — the `cf_map_publish` semantics and the outbox machinery don't care whether your collection has a separate home in your schema or not.

## The dual-write problem

Publishing to Centrifugo has historically been a separate step from updating any related state — your backend wrote to one place, then called the Centrifugo API to publish. With the PostgreSQL map broker, both are PostgreSQL writes, so they can share a transaction. If the rest of your business logic in that transaction rolls back (constraint violation, retry conflict, deliberate abort), the map update never gets visible to subscribers. No outbox to maintain in your code, no eventual-consistency drift between the broker and other related rows that you wrote alongside it.

```sql
BEGIN;
  -- Update related application data (audit log, an aggregated counter, etc.)
  INSERT INTO board_audit (item_id, actor, action) VALUES ('card_42', 'alice', 'edit');

  -- Publish to the broker-owned map (same transaction)
  SELECT * FROM cf_map_publish(
    p_channel := 'boards:123',
    p_key     := 'card_42',
    p_data    := '{"text": "Updated card"}'::jsonb
  );
COMMIT;
```

If the transaction rolls back, neither the audit row nor the real-time map entry change. No outbox table to manage in your application, no CDC pipeline, no eventual consistency — just a single transaction.

## How the SQL functions work

Centrifugo creates SQL functions (`cf_map_publish`, `cf_map_remove`) that your application calls inside its own database transactions. The map state update and any other writes you do alongside commit or rollback together — atomically (as shown in the opening example).

This guarantee applies to **callers using the SQL function path** — your backend code calling `cf_map_publish` directly inside its own SQL transaction. Publishes that go through Centrifugo's HTTP/GRPC API are still a separate operation from your DB writes (the historic dual-write shape). The SQL function path is what makes them one transaction; it's an additional integration option, not a change to the existing publish APIs.

<PgTransactionalDiagram />

The following demo shows a polls feature where each vote is a PostgreSQL transaction that atomically updates the result and publishes to Centrifugo (one of [many examples](https://github.com/centrifugal/examples/tree/master/v6/map_demo) in the map demo collection):

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_polls.mp4"></video>

## Why outbox, not WAL

A common approach to keeping a database and an external system in sync is CDC — Change Data Capture from the PostgreSQL write-ahead log. Supabase Realtime uses this model: it reads committed changes from the WAL and pushes them to clients. This approach requires either external tooling (Debezium, Kafka Connect) or specialized infrastructure that understands the WAL format. It also means observing changes after the fact — the CDC layer can't participate in the write itself.

We initially built a WAL-based version, but removed it. The reasoning: the main bottleneck in this architecture is PostgreSQL's write throughput — how fast your application can commit transactions. Reading committed changes from an outbox table is cheap by comparison, and PostgreSQL's `LISTEN/NOTIFY` keeps delivery latency low — typically under a few milliseconds. WAL-based CDC solves a read problem that doesn't exist here, while adding complexity (logical replication slots, WAL parsing, schema coupling) that does. It also requires `wal_level = logical` — a setting not every PostgreSQL deployment has enabled, and one that some managed providers restrict or charge extra for. The outbox pattern keeps everything in regular SQL tables — no external dependencies, no additional infrastructure between PostgreSQL and Centrifugo.

The outbox pattern also gives us something WAL-based CDC can't: the ability to write both the real-time state (`cf_map_state`) and the change stream (`cf_map_stream`) atomically within the same SQL function call. With CDC, the system reacts to what was written. With the outbox, Centrifugo's SQL functions control what gets written — including conditional logic like `if_new`, `if_exists`, and compare-and-swap — all inside the transaction.

## Under the hood

When your transaction calls `cf_map_publish`, the function does three things in a single atomic operation:

1. **Upserts the entry** in `cf_map_state` — the current key-value snapshot
2. **Appends a change entry** to `cf_map_stream` — the ordered change log that outbox workers read
3. **Updates the channel position** in `cf_map_meta` — the offset and epoch that track where the stream is

The ordering challenge is subtle: if two transactions concurrently publish to the same channel, their stream entries must be ordered consistently — the outbox worker must never see entry N+1 before entry N commits. The function handles this by acquiring a lock on the channel's meta row before assigning the stream offset. This ensures that even with concurrent writers, offsets are assigned and committed in a consistent order. Without this lock, concurrent transactions could receive offsets 5 and 6, but commit in reverse order — the worker would see offset 6 appear while offset 5 is still uncommitted, creating a gap it can't safely skip.

<PgOutboxDiagram />

Centrifugo runs a pool of outbox workers — one per shard (`num_shards`, default 16). Each channel is assigned to a shard by hash, and each worker independently polls its portion of the stream table using a cursor that tracks the last delivered offset. On restart, workers resume from their last known position — no entries are missed.

By default, workers poll every 50ms. Enabling `use_notify` triggers PostgreSQL's `LISTEN/NOTIFY` when new entries are committed, waking the worker immediately — reducing delivery latency to low single-digit milliseconds. Every Centrifugo node runs its own set of workers, so delivery continues even if a node goes down.

In effect, the broker-owned collection lives durably in PostgreSQL with the same operational story as the rest of your data — backups, monitoring, `psql` access — and clients see it live over WebSocket. No additional message broker, no new data pipeline.

## Two PG-backed brokers, two natural shapes

The PostgreSQL map broker is the natural fit when Centrifugo holds the collection. When your data already lives in your own application tables — orders, notifications, documents, activity feeds — there's a complementary tool: the **PostgreSQL stream broker** paired with a `getState` callback on a regular stream subscription. Same transactional-publish guarantee for your INSERT/UPDATE alongside `cf_stream_publish`, no duplicate state in the broker, clients render from your own schema. See [Transactional publishing for stream subscriptions with PostgreSQL](/blog/2026/04/10/pg-stream-broker-benefits) and the [pg_stream_broker example](https://github.com/centrifugal/examples/tree/master/v6/pg_stream_broker).

Two natural shapes, two PG-backed brokers, sharing the same operational primitives (outbox + partitioned tables + LISTEN/NOTIFY) — though configured and deployed independently:

| Shape | Broker | What's stored in PG |
|---|---|---|
| Centrifugo owns the keyed collection (presence, fleet, lobbies, feature flags, cursors) | **PostgreSQL map broker** | `cf_map_state` (canonical KV) + `cf_map_stream` (changes) |
| App owns the data in its own tables; clients should see live changes; app DB stays the only source of truth | **PostgreSQL stream broker + stream sub `getState`** | `cf_stream` (changes only); state stays in your own tables |

Both publish transactionally. The pick is usually about who naturally owns the data — but the line isn't strict. Some teams will choose the map broker even for app-state cases, mirroring rows into `cf_map_state` to get the synchronized snapshot, paginated state delivery, and per-key TTL on the client without writing a `getState` endpoint. The trade is the duplicated row in `cf_map_*`. Worth being deliberate about; not categorically wrong either way.

## Partitioning and retention

The stream table is automatically partitioned by day. Old partitions are dropped entirely — instant, no row-by-row deletion, no expensive vacuum operations. This is built into the open-source broker via `partition_retention_days` (default 7) and `partition_lookahead_days` (default 2). No manual maintenance needed — the broker pre-creates future partitions and drops old ones on a regular interval.

## Scaling with Centrifugo PRO

The open-source PostgreSQL broker works well for single-node and small-cluster deployments. As you scale — more Centrifugo nodes, more channels, higher write throughput — [Centrifugo PRO](/docs/pro/map_subscriptions) adds three optimizations:

**Broker fan-out.** By default, every Centrifugo node independently polls the outbox. With broker fan-out, only one node per shard polls PostgreSQL (shard leadership is coordinated via PostgreSQL advisory locks), then publishes updates through Redis or NATS. This reduces database polling load proportionally to cluster size — essential when running many Centrifugo nodes.

**In-memory cache layer.** Keeps channel state in memory on each node, so subscribe operations don't hit PostgreSQL for every new client. The cache provides read-your-own-writes semantics: local writes are reflected immediately, while writes from other nodes appear within a configurable sync interval.

**Read replicas.** Distributes read load (state pagination, stream catch-up) across PostgreSQL replicas using consistent hashing on the channel name. Writes still go to the primary.

## Performance

On PostgreSQL 16 (Apple M4, native install — not Docker):

| Operation | Result |
|---|---|
| **Map publish** | ~16,000 ops/sec |
| **Map publish with CAS** | ~11,000 ops/sec |
| **Idempotent publish** | ~17,500 ops/sec |
| **Read state (full)** | ~10,800 ops/sec |
| **Read state (paginated)** | ~50,000 ops/sec |
| **Remove** | ~42,000 ops/sec |
| **Publish → delivery latency** | ~1.3 ms |

All publish operations go through a single SQL function call (`cf_map_publish`) that atomically updates the state table, appends to the stream, and increments the channel position. ~16,000 publishes per second per broker is sufficient for collaborative state workloads — boards, inventories, presence.

These numbers come from the broker's Go integration tests in benchmark mode against a same-machine PostgreSQL — small JSON payloads, default broker configuration, parallel goroutines exercising the SQL functions. They're rough order-of-magnitude indicators, not portable production guarantees: real workloads vary with payload size, connection pool sizing, network latency, and your PostgreSQL's own write capacity. For context, the Redis map broker on the same hardware would be faster per-operation, but doesn't offer transactional publishing. The numbers above reflect a single Centrifugo instance with parallel goroutines. In production, multiple Centrifugo nodes and application instances publish concurrently — aggregate throughput scales with the number of writers up to PostgreSQL's own write capacity.

## Why this requires self-hosting

Centrifugo runs in your infrastructure, connects to your databases, and calls your backend directly. That proximity enables capabilities that are structurally outside the reach of a cloud service sitting between you and your users — not merely inconvenient, but ruled out by the deployment model.

Transactional publishing is the clearest example. A cloud real-time service can't participate in your database transactions — it doesn't share your database. Cloud services built on CDC (e.g. WAL-tail) can deliver every committed change after the fact, which is a strong consistency story in its own right — but it's not the same as having the publish be part of *your* transaction. With Centrifugo running alongside your PostgreSQL instance, the publish *is* your transaction; the real-time visibility decision is made before commit, not derived from the WAL afterwards. That's the property a remote-by-definition service can't offer.

The same applies to the proxy system. Centrifugo calls your backend over your local network — for subscribe authorization, map publish validation, and [shared poll](/blog/2026/04/06/shared-poll-subscriptions) refresh — with latency measured in low single-digit milliseconds. With a cloud service, every backend call would cross the public internet.


## What's next

Transactional publishing is currently experimental — we may adjust the SQL function API and outbox architecture based on feedback. We've published several PostgreSQL-backed demos in the [map demo collection](https://github.com/centrifugal/examples/tree/master/v6/map_demo), including a sprint board that demonstrates transactional publishing with Docker Compose.

[Part 1](/blog/2026/04/07/map-subscriptions) covers the full map subscriptions design — sync protocol, modes, and broker overview. For the alternative shape — Centrifugo delivering live changes against state your own application database owns — read [Transactional publishing for stream subscriptions with PostgreSQL](/blog/2026/04/10/pg-stream-broker-benefits). And check out the companion post on [shared poll subscriptions](/blog/2026/04/06/shared-poll-subscriptions) — the other new subscription type we're introducing alongside map subscriptions.

Read the full [map subscriptions documentation](/docs/server/map_subscriptions) for configuration reference, PostgreSQL broker setup, and transactional publishing examples.
