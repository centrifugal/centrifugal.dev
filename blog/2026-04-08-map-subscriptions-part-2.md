---
title: Map subscriptions (Part 2) — PostgreSQL integration and transactional publishing
tags: [centrifugo, websocket, state-sync, postgresql]
description: The PostgreSQL map broker lets you publish real-time updates inside your database transactions — eliminating the dual-write problem entirely. This post covers the motivation, the design, the outbox architecture, and why this is only possible with a self-hosted real-time server.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
image: /img/blog_map_subs_02.jpg
authorImageURL: /img/alexander_emelin.jpeg
hide_table_of_contents: false
---

import PgTransactionalDiagram from '@site/src/components/PgTransactionalDiagram';
import PgOutboxDiagram from '@site/src/components/PgOutboxDiagram';

In [Part 1](/blog/2026/04/07/map-subscriptions), we introduced map subscriptions — a new subscription type in Centrifugo for synchronizing keyed collections with paginated state delivery, stream-based recovery, and three modes for different state lifetimes. We covered the sync protocol, the memory and Redis brokers, and capabilities like ordered state, conditional writes, and scalable presence. In this post, we go deeper into the PostgreSQL broker and a capability it enables: transactional publishing — real-time updates that commit or roll back with your database transactions.

<!--truncate-->

## The dual-write problem

Publishing to Centrifugo has always been a separate step from updating your database — your backend writes to the database, then calls the Centrifugo API. This works well, but it means two separate writes. The hardest problem in real-time systems isn't delivering messages — it's keeping these two writes in sync. If the publish fails (or the process crashes between the two operations), the database and the real-time state diverge. This is the [dual-write problem](https://thorben-janssen.com/dual-writes/).

This isn't a hypothetical concern. If you've integrated a real-time system with a database, you've probably hit this: a user moves a card on a project board, the database write succeeds, the publish to the real-time layer fails, and collaborators see the card in its old position until they refresh. Most teams work around this with outbox tables and background workers, CDC pipelines from database WAL, or eventually-consistent retry mechanisms — all of which add operational complexity and introduce their own failure modes.

## Transactional publishing

The PostgreSQL map broker solves this. Centrifugo creates SQL functions (`cf_map_publish`, `cf_map_remove`) that your application calls inside its own database transactions. The real-time state update and your business logic commit or rollback together — atomically.

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

If the transaction rolls back, the real-time update never happened. No outbox table to manage, no CDC pipeline, no eventual consistency — just a single transaction.

<PgTransactionalDiagram />

Here is a polls demo, one of [many](https://github.com/centrifugal/examples/tree/master/v6/map_demo) we prepared for map subscriptions release — each vote is a PostgreSQL transaction that updates the result and publishes to Centrifugo atomically:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_polls.mp4"></video>

## Why outbox, not WAL

A common approach to keeping a database and an external system in sync is CDC — Change Data Capture from the PostgreSQL write-ahead log. Supabase Realtime uses this model: it reads committed changes from the WAL and pushes them to clients. It works, but it requires either external tooling (Debezium, Kafka Connect) or specialized infrastructure that understands the WAL format. It also means observing changes after the fact — the CDC layer can't participate in the write itself.

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

In effect, Centrifugo becomes a real-time view layer for your database — clients see an eventually consistent projection of your PostgreSQL state, delivered over WebSocket, with the guarantee that every update is backed by a committed transaction. Your existing PostgreSQL handles both persistence and real-time delivery — no additional message broker, no new data pipeline.

## External state: your database as the source of truth

The examples above use `cf_map_publish`, which writes to both the state table and the stream. But if your data already lives in application tables — project boards, order lists, product catalogs — duplicating it into `cf_map_state` is unnecessary. [External state mode](/docs/server/map_subscriptions#external-state) (covered in [Part 1](/blog/2026/04/07/map-subscriptions)) tells the broker to manage only the stream and PUB/SUB, skipping the state table entirely.

For PostgreSQL, this means using separate functions: `cf_map_stream_publish` and `cf_map_stream_remove`. They write only to `cf_map_stream` and `cf_map_meta` — your app database remains the single source of truth.

```sql
BEGIN;
  -- 1. Update your application state.
  UPDATE board_items SET data = '{"text": "Updated card"}'::jsonb
  WHERE board_id = 123 AND item_id = 'card_42';

  -- 2. Write to Centrifugo stream only (no state table).
  SELECT * FROM cf_map_stream_publish(
    p_channel := 'boards:123',
    p_key     := 'card_42',
    p_data    := '{"text": "Updated card"}'::jsonb
  );
COMMIT;
```

When clients subscribe, the SDK loads the initial state from your HTTP API via a `getState` callback. Your endpoint must capture the stream position *before* reading state — within the same transaction — so the SDK knows where to start catching up:

```sql
BEGIN;
  -- 1. Capture stream position FIRST.
  SELECT * FROM cf_map_stream_top_position('boards:123');
  -- 2. Then read state from your app tables.
  SELECT item_id, data FROM board_items WHERE board_id = 123;
COMMIT;
```

The three-phase sync protocol handles the rest — catching up on any changes that happened during the HTTP call, then transitioning to live updates.

The kitchen orders demo illustrates this — order state lives in application tables, and Centrifugo streams only the changes. The initial state is loaded from the backend API, then live updates arrive through the map subscription:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_kitchen.mp4"></video>

## Scaling with Centrifugo PRO

The open-source PostgreSQL broker works well for single-node and small-cluster deployments. As you scale — more Centrifugo nodes, more channels, higher write throughput — [Centrifugo PRO](/docs/pro/map_subscriptions) adds four optimizations:

**Broker fan-out.** By default, every Centrifugo node independently polls the outbox. With broker fan-out, only one node per shard polls PostgreSQL (shard leadership is coordinated via PostgreSQL advisory locks), then publishes updates through Redis or NATS. This reduces database polling load proportionally to cluster size — essential when running many Centrifugo nodes.

**In-memory cache layer.** Keeps channel state in memory on each node, so subscribe operations don't hit PostgreSQL for every new client. The cache provides read-your-own-writes semantics: local writes are reflected immediately, while writes from other nodes appear within a configurable sync interval.

**Read replicas.** Distributes read load (state pagination, stream catch-up) across PostgreSQL replicas using consistent hashing on the channel name. Writes still go to the primary.

**Stream partitioning.** Automatic daily partitioning of the stream table. Old partitions are dropped entirely — instant, no row-by-row deletion, no expensive vacuum operations. This avoids table bloat at scale without manual maintenance.

## Why this requires self-hosting

Centrifugo occupies a different spot — not just because it's self-hosted, but because of what self-hosting makes possible. It runs in your infrastructure, connects to your databases, and calls your backend directly. That proximity enables features that are architecturally impossible for a cloud service sitting between you and your users — not just inconvenient, but structurally ruled out by the deployment model.

Transactional publishing is the clearest example. A cloud real-time service can't participate in your database transactions — it doesn't share your database. Even CDC-based cloud services that react to database changes deliver updates eventually, with no guarantee that the real-time update arrives before the HTTP response reaches the client. Because Centrifugo runs alongside your PostgreSQL instance, it can offer the atomicity [described above](#transactional-publishing) — something architecturally impossible for a remote service.

The same applies to the proxy system. Centrifugo calls your backend over your local network — for subscribe authorization, map publish validation, and [shared poll](/blog/2026/04/06/shared-poll-subscriptions) refresh — with latency measured in low single-digit milliseconds. With a cloud service, every backend call would cross the public internet.

Combined with stream subscriptions for ordered event delivery and shared poll subscriptions for scalable polling, Centrifugo now offers three distinct subscription primitives in one system — each suited to different use cases, all sharing the same connection, SDKs, authentication, and proxy infrastructure.

## What's next

Transactional publishing is currently experimental — we may adjust the SQL function API and outbox architecture based on feedback. We've published several PostgreSQL-backed demos in the [map demo collection](https://github.com/centrifugal/examples/tree/master/v6/map_demo), including a sprint board that demonstrates transactional publishing with Docker Compose.

If you haven't read it yet, start with [Part 1](/blog/2026/04/07/map-subscriptions) for the full map subscriptions design — sync protocol, modes, and broker overview. And check out the companion post on [shared poll subscriptions](/blog/2026/04/06/shared-poll-subscriptions) — the other new subscription type we're introducing alongside map subscriptions.

Read the full [map subscriptions documentation](/docs/server/map_subscriptions) for configuration reference, PostgreSQL broker setup, and transactional publishing examples.
