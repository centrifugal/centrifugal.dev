---
draft: true
title: Benefits of a PostgreSQL stream broker for Centrifugo
tags: [centrifugo, postgresql, streams, outbox]
description: A draft exploration of why a PostgreSQL-backed broker for stream subscriptions would extend Centrifugo's transactional publishing story from collaborative state to ordered event delivery, and what it would reuse from the existing map broker infrastructure.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
hide_table_of_contents: false
---

## Benefits of a PG stream broker

**Transactional publishing for stream channels** — the headline win. Your application writes business data and publishes a stream-channel message in the same `BEGIN / COMMIT`, so the real-time update either happens together with the write or not at all. Kills the dual-write problem for the use cases where stream subs are the natural primitive: notifications, audit logs, workflow events, order updates, activity feeds. Today that story only exists for map subs (via `cf_map_publish`); extending it to stream subs covers the much wider "I have a DB row and I want to announce a change" audience.

**One-infrastructure story** — "Centrifugo + PostgreSQL, no Redis" becomes true across every subscription primitive (streams, maps, and eventually controller). Many Centrifugo users already have PostgreSQL as their primary DB and would prefer not to run Redis just for real-time. The map broker starts this story; the stream broker completes it. Operationally: one fewer moving part, one fewer failure domain, one fewer thing to monitor, one fewer dependency to upgrade.

<!--truncate-->

**External-state mode for event-shaped data** — the pattern we discussed earlier is arguably a better fit for streams than maps. Notifications and chat messages already live in the app's own table with long retention; Centrifugo's stream broker would keep a tiny bridging window in `cf_stream_history` (seconds to minutes) while the app DB remains the single source of truth for past events. Position handoff via `cf_stream_top_position` eliminates the REST + WebSocket race window that every collaborative app reinvents badly. The broker becomes a thin delivery layer over the user's existing data, not a second store.

**Durable publish path with survives-a-crash guarantees** — with Redis, a publish issued mid-crash is lost. With the outbox pattern, the publish is in the table and the outbox worker picks it up after the node restarts. Recovery is built in, not bolted on.

**Per-publication version ordering inside a transaction** — stream subs already support version-based dropping via `version` / `version_epoch`. With a PG broker, the application can compute the version from its own DB state (e.g. `UPDATE ... RETURNING version`) and pass it into the same transaction's publish call. That's a level of consistency between app state and real-time delivery that's effectively impossible to achieve with an out-of-process broker.

**Reuses everything we just built** — pgoutbox's Worker, LockWorker, NotificationListener, and Partitioner are all directly reusable. pgfanout's `CreateFanoutBroker` is reusable in PRO. The runtime-prefix refactor means the stream broker slots in with `TablePrefix: "cf"` defaulting to `cf_stream_*` tables alongside `cf_map_*` with zero collision. Most of the hard structural work is already done; the stream broker adds a schema file and a `processOutboxBatch` implementation.

**Broker fan-out for multi-node scale** — inherits the advisory-lock + Redis/NATS fan-out pattern already proven for the map broker. Large clusters don't bottleneck on primary Postgres polling because only one node per shard reads.

**Read replicas for state catch-up** — inherits the existing replica-routing infrastructure. Reconnecting clients' history catch-up can hit read replicas without touching the write primary.

**Partitioning for retention at scale** — inherits the `pgoutbox.Partitioner`. Daily partitions of `cf_stream_history`, old partitions dropped by `DROP TABLE` (instant) instead of row-by-row DELETE. Standard trick, free via reuse.

**PG-level RBAC via row-level security** — pre-existing Postgres RLS policies on `cf_stream_history` apply automatically to catch-up reads (state-phase equivalent), because Centrifugo queries under the subscriber's identity. Note: doesn't help live-phase delivery (per the earlier thread), but gives a real RBAC story for history retrieval that Redis simply cannot match.

**Operationally familiar for PG-heavy shops** — monitoring, backup, replication, TLS, connection pooling, IAM authentication (AWS RDS IAM, GCP Cloud SQL IAM) are all already wired up for the app's primary PG. The stream broker just inherits all of it. No separate Redis hardening story.

**Sets up the PG controller** — once brokers and streams both live in PG, a PG controller (for cluster coordination) becomes a natural third piece that shares the same infra, the same reliability story, the same operational model. The "Centrifugo + Postgres only" pitch lands cleanly.

## The tradeoffs (not benefits, but worth remembering)

- Latency is higher than Redis (low single-digit ms with NOTIFY vs sub-ms Redis PUB/SUB). Fine for notifications/audit, bad for trading tickers.
- Load lands on the application's primary Postgres — real capacity-planning implication.
- Target audience is narrower than "everyone who uses stream subs" — specifically users whose stream publications correspond to DB writes. Probably 50-70% of stream use cases, not 100%.
- Doubles the PG-broker surface area to maintain. Mitigated heavily by pgoutbox reuse.

## The one-line pitch

**Stream subscriptions gain atomic-with-your-database publishing, durable recovery, and full reuse of the map broker's PostgreSQL infrastructure — extending Centrifugo's unique "real-time updates that commit with your transaction" property from collaborative state to ordered event delivery.**

That's the product story. Everything else is technical detail that falls out of the pgoutbox refactor we just landed.
