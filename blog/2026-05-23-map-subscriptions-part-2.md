---
title: Map subscriptions (Part 2) — when your PostgreSQL transaction is your real-time publish
tags: [centrifugo, websocket, state-sync, postgresql]
description: The PostgreSQL map broker brings durable persistence to Centrifugo-owned key-value collections and lets your application publish updates atomically inside its own database transactions — no dual-write, no application-side outbox to maintain.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
image: /img/blog_map_subs_02.jpg
authorImageURL: /img/alexander_emelin.jpeg
hide_table_of_contents: false
draft: false
---

import PgTransactionalDiagram from '@site/src/components/PgTransactionalDiagram';
import PgOutboxDiagram from '@site/src/components/PgOutboxDiagram';

In the previous blog post we introduced Map Subscriptions. We mentioned that Centrifugo has PostgreSQL Map Broker, in this post we are providing more details about it. The PostgreSQL map broker allows publishing to a Centrifugo Map within an application SQL transaction:

<!--truncate-->

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

If the transaction rolls back, the real-time update never happened. No outbox table to maintain, no CDC pipeline, no eventual consistency — just one PostgreSQL transaction. The rest of this post unpacks how it works.

[Part 1](/blog/2026/05/22/map-subscriptions) introduced map subscriptions and the memory and Redis brokers. This post focuses on the PostgreSQL broker, new in Centrifugo v6.8.0.

## How the SQL functions work

Centrifugo creates SQL functions (`cf_map_publish`, `cf_map_remove`) that your application calls inside its own database transactions. The map state update and any other writes you do alongside commit or rollback together — atomically (as shown in the opening example).

This guarantee applies to **callers using the SQL function path** — your backend code calling `cf_map_publish` directly inside its own SQL transaction. Publishes that go through Centrifugo's HTTP/GRPC API are still a separate operation from your DB writes (the historic dual-write shape). The SQL function path is what makes them one transaction; it's an additional integration option, not a change to the existing publish APIs.

<PgTransactionalDiagram />

The following demo shows a polls feature where each vote is a PostgreSQL transaction that atomically updates the result and publishes to Centrifugo (one of [many examples](https://github.com/centrifugal/examples/tree/master/v6/map_demo) in the map demo collection):

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_polls.mp4"></video>

## Why outbox, not WAL

A common approach to keeping a database and an external system in sync is CDC — Change Data Capture from the PostgreSQL write-ahead log. Supabase Realtime uses this model: it reads committed changes from the WAL and pushes them to clients. This approach requires either external tooling (Debezium, Kafka Connect) or specialized infrastructure that understands the WAL format. It also means CDC sees changes only after they happen — it can't be part of the write itself.

We initially built a WAL-based version, but removed it. The reason: the main bottleneck in this architecture is PostgreSQL's write throughput — how fast your application can commit transactions. Reading committed changes from an outbox table is cheap by comparison, and PostgreSQL's `LISTEN/NOTIFY` keeps delivery latency low — typically under a few milliseconds. WAL-based CDC solves a read problem we don't actually have here, while adding real complexity — logical replication slots, WAL parsing, schema coupling. It also requires `wal_level = logical` — a setting not every PostgreSQL deployment has enabled, and one that some managed providers restrict or charge extra for. The outbox pattern keeps everything in regular SQL tables — no external dependencies, no additional infrastructure between PostgreSQL and Centrifugo.

The outbox pattern also gives us something WAL-based CDC can't: the ability to write both the real-time state (`cf_map_state`) and the change stream (`cf_map_stream`) atomically within the same SQL function call. With CDC, the system reacts to what was written. With the outbox, Centrifugo's SQL functions control what gets written — including conditional logic like `if_new`, `if_exists`, and compare-and-swap — all inside the transaction.

## Under the hood

When your transaction calls `cf_map_publish`, the function does three things in a single atomic operation:

1. **Upserts the entry** in `cf_map_state` — the current key-value snapshot
2. **Appends a change entry** to `cf_map_stream` — the ordered change log that outbox workers read
3. **Updates the channel position** in `cf_map_meta` — the offset and epoch that track where the stream is

Ordering is the tricky part: if two transactions concurrently publish to the same channel, their stream entries must be ordered consistently — the outbox worker must never see entry N+1 before entry N commits. The function handles this by acquiring a lock on the channel's meta row before assigning the stream offset. This ensures that even with concurrent writers, offsets are assigned and committed in a consistent order. Without this lock, concurrent transactions could receive offsets 5 and 6, but commit in reverse order — the worker would see offset 6 appear while offset 5 is still uncommitted, creating a gap it can't safely skip.

<PgOutboxDiagram />

Centrifugo runs a pool of outbox workers — one per shard (`num_shards`, default 8). Each channel is assigned to a shard by hash, and each worker independently polls its portion of the stream table using a cursor that tracks the last delivered offset. On restart, workers resume from their last known position — no entries are missed.

By default, workers poll every 100ms. Enabling `use_notify` triggers PostgreSQL's `LISTEN/NOTIFY` when new entries are committed, waking the worker immediately — reducing delivery latency to low single-digit milliseconds. Every Centrifugo node runs its own set of workers, so delivery continues even if a node goes down.

In effect, the broker-owned collection lives durably in PostgreSQL with the same operational story as the rest of your data — backups, monitoring, `psql` access — and clients see it live over WebSocket. No additional message broker, no new data pipeline.

## Partitioning and retention

The stream table is automatically partitioned by day. Old partitions are dropped entirely — instant, no row-by-row deletion, no expensive vacuum operations. This is built into the open-source broker via `partition_retention_days` (default 7) and `partition_lookahead_days` (default 2). No manual maintenance needed — the broker pre-creates future partitions and drops old ones on a regular interval.

## Scaling with Centrifugo PRO

The OSS broker works well for single-node and small-cluster deployments. Four patterns start to bite as you grow — more Centrifugo nodes, more channels, higher write throughput, or UIs that render the whole collection every frame — and [Centrifugo PRO](/docs/pro/map_subscriptions) addresses each:

- **PG read load that grows linearly with cluster size.** By default, every Centrifugo node independently polls the outbox. At a few nodes that's fine; at a dozen, the read traffic on PG starts to matter. PRO's **broker fan-out** elects one node per shard to poll (shard leadership coordinated via PostgreSQL advisory locks) and re-broadcasts to peers via Redis or NATS — PG read load stays constant regardless of how many Centrifugo nodes are behind it.
- **Subscribe latency hitting PG on every new client.** As channels and connection churn grow, every new subscriber that wants initial state causes a PG read. PRO's **in-memory cache layer** keeps channel state on each Centrifugo node, fed by PUB/SUB so the cache reflects both local and remote writes in near real-time. Subscribes resolve from memory at microsecond latency instead of hitting PG, and a configurable `sync_interval` periodically reconciles with the backend as a safety net for any PUB/SUB messages that may have been missed.
- **Read load that the primary alone can't carry.** State pagination and stream catch-up reads add up at scale, and on a single primary they compete with writes. PRO's **read-replica routing** distributes those reads across PostgreSQL replicas using consistent hashing on the channel name, while writes still go to the primary — so the primary keeps headroom for the work that actually requires it.
- **Bandwidth on full-state UIs.** For collections where every client renders the entire map every frame — cursor sets, game positions, IoT fleet dashboards — publishing one update per key change is wasteful when subscribers want the whole picture anyway. PRO's **full-state delta mode** (built on top of the cache layer) exposes a derived stream channel that publishes the entire map as a single Fossil-delta-compressed payload per configurable tick. Bandwidth then scales with the size of the change, not with the number of keys touched or the size of the full state.

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

All publish operations go through a single SQL function call (`cf_map_publish`) that atomically updates the state table, appends to the stream, and increments the channel position. ~16,000 publishes per second per broker is enough for collaborative state workloads — boards, inventories, presence.

These numbers come from the broker's Go integration tests in benchmark mode against a same-machine PostgreSQL — small JSON payloads, default broker configuration, parallel goroutines exercising the SQL functions. They're rough estimates, not numbers you can take to production: real workloads vary with payload size, connection pool sizing, network latency, and your PostgreSQL's own write capacity. For context, the Redis map broker on the same hardware would be faster per-operation, but doesn't offer transactional publishing. The numbers above reflect a single Centrifugo instance with parallel goroutines. In production, multiple Centrifugo nodes and application instances publish concurrently — aggregate throughput scales with the number of writers up to PostgreSQL's own write capacity.

## What's next

Transactional publishing is currently experimental — we may adjust the SQL function API and outbox architecture based on feedback. We've published several PostgreSQL-backed demos in the [map demo collection](https://github.com/centrifugal/examples/tree/master/v6/map_demo), including a sprint board that demonstrates transactional publishing with Docker Compose.

[Part 1](/blog/2026/05/22/map-subscriptions) covers the full map subscriptions design — sync protocol, modes, and broker overview. And check out the companion post on [shared poll subscriptions](/blog/2026/05/21/shared-poll-subscriptions) — the other new subscription type we're introducing alongside map subscriptions.

Read the full [map subscriptions documentation](/docs/server/map_subscriptions) for configuration reference, PostgreSQL broker setup, and transactional publishing examples.
