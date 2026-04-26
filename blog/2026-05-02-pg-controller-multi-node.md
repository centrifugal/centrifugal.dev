---
title: Multi-node Centrifugo on PostgreSQL alone
tags: [centrifugo, postgresql, scaling, controller]
description: A new PostgreSQL controller in Centrifugo OSS lets multi-node clusters run without Redis or NATS. If your application already runs PostgreSQL, the messaging plane has everything it needs — one infrastructure dependency for the whole real-time tier.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/blog_pg_controller.jpg
hide_table_of_contents: false
draft: true
---

[Centrifugo](https://centrifugal.dev) is an open-source real-time messaging server that delivers updates to clients over WebSocket (or SSE / HTTP-streaming). For most of its history, scaling an OSS deployment past a single node has meant running Redis — even when PostgreSQL was already there for everything else. The new PostgreSQL controller removes that asymmetry. If your application already runs PG, the messaging plane has what it needs.

<!--truncate-->

:::info New and evolving

The PostgreSQL controller is a recent addition — we're eager for production feedback. Configuration keys, schema, and outbox internals may still adjust before they're considered stable.

:::

## Why Redis was the OSS reality

A single Centrifugo node is self-contained — clients connect, the node tracks subscriptions in memory, publishes go straight to subscribers. Add a second node and that breaks: a publish that arrives at node A needs to reach the clients connected to node B; subscribes, unsubscribes, and disconnects need to propagate; each node needs to know the live cluster topology. Centrifugo solves this with a `Controller` interface that distributes control messages between nodes.

For most of Centrifugo's history, that interface had two implementations: Redis and NATS. NATS, however, is a Centrifugo PRO option. So the OSS reality was effectively *Redis or single-node*. Teams already running Redis for caching paid no extra operational cost. Teams running PostgreSQL as their primary store and nothing else had to provision and operate a Redis instance just to scale Centrifugo horizontally — even small deployments where the messaging traffic would have been comfortable on PG.

That asymmetry is what the PostgreSQL controller removes.

## How the controller works

The controller uses the same outbox pattern that powers the [PG stream broker](/blog/2026/05/01/pg-stream-broker-benefits) and the [PG map broker](/blog/2026/04/30/map-subscriptions-part-2):

- Control messages are written to a partitioned PostgreSQL table — one row per message.
- Each Centrifugo node polls the table for new entries and processes them.
- `LISTEN/NOTIFY` provides low-latency wakeup, so polling cadence stays low under quiet load while latency stays in the low single-digit milliseconds when traffic exists.
- Old partitions are dropped whole — vacuum-free cleanup that keeps long-lived deployments tidy without any manual maintenance.

The shape mirrors the brokers, so an operator already familiar with one already knows how the other behaves. Configuration keys, retention semantics, partition lookahead — all the same vocabulary.

## What flows through the controller

The controller carries cross-node operations the centrifuge node abstraction needs to coordinate:

- **Subscribe propagation** — when a node subscribes a connected client to a channel, peer nodes need to know so future publications addressed to that client reach it even if they originate elsewhere.
- **Unsubscribe and disconnect** — server-issued disconnects targeting a specific user or client fan out across the cluster so the right connection terminates regardless of which node holds it.
- **Presence pings** — periodic heartbeats so each node knows the live cluster topology and can detect peer failures.
- **Surveys** — broadcast queries (e.g. "how many connections to this channel cluster-wide") and their responses.

Publication delivery itself does **not** flow through the controller — that's the broker's job. Stream and map brokers each have their own outbox tables and their own delivery paths. The controller is purely the cross-node coordination layer.

## The messaging plane on PostgreSQL alone

With the stream broker, the map broker, and the controller all on PostgreSQL, an OSS cluster can run with one infrastructure dependency for the entire messaging plane:

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

The same DSN can be reused across all three components, or split across separate PostgreSQL instances if the deployment wants isolation between the data plane and control plane. All three create their own tables, partitions, and SQL functions on startup — there's no manual migration step.

## When to choose what

The PostgreSQL controller doesn't replace Redis or NATS for everyone. A rough decision frame:

- **PostgreSQL controller** — best for OSS deployments that already run PG, expect cluster sizes in the small-to-mid range (a handful of nodes), and want to consolidate infrastructure dependencies. Latency under typical load is low single-digit milliseconds with `use_notify`.
- **Redis controller** — best when sub-millisecond control-plane coordination matters more than infrastructure consolidation, or when the deployment runs Redis for other reasons. Centrifugo's Redis controller has been the production default for years and remains the right pick for high-throughput control planes.
- **NATS controller** (PRO) — best for very large clusters where Redis pub/sub fan-out becomes the bottleneck, or for deployments already standardized on NATS.

For OSS deployments where Redis was provisioned solely to support multi-node Centrifugo, the PG controller is the cleaner option going forward. For deployments already running Redis as a cache or session store, the migration off it is optional — there's no functional reason to switch if Redis is already there for other purposes.

## Scaling beyond plain PostgreSQL

The controller's load profile is much lighter than a broker — control messages are typically a small fraction of publication traffic — so plain PostgreSQL carries it for clusters of many nodes. When the primary or the broker side starts to feel limits, [Centrifugo PRO](/docs/pro/overview) layers on:

- **Read-replica routing for outbox polling.** Both the controller and the broker can route their outbox polling reads to a PostgreSQL replica via PRO's **read-replica support**, while writes stay on the primary — useful when the primary becomes the bottleneck and you have replicas available.
- **Broker-side scaling levers.** At higher cluster sizes, broker traffic dominates messaging-plane load. PRO's **broker fan-out** (one node per shard polls PG and re-broadcasts to peers via Redis or NATS) and the map-broker **in-memory cache layer** apply to the broker plane and are described in the [PG map broker](/blog/2026/04/30/map-subscriptions-part-2#scaling-with-centrifugo-pro) post.

These are layered enhancements, not requirements. The cluster runs on plain PostgreSQL out of the box, and most deployments will not need them.

## Getting started

Enable the PostgreSQL controller alongside any existing broker configuration:

```json title="config.json"
{
  "controller": {
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

The controller creates its required tables, partitions, and SQL functions on startup. Bring up two or more Centrifugo nodes pointing at the same PostgreSQL, and they'll coordinate without further setup.

For background on the outbox pattern shared with the brokers, see the [PG stream broker post](/blog/2026/05/01/pg-stream-broker-benefits) and the [PG map broker post](/blog/2026/04/30/map-subscriptions-part-2). The full configuration reference lives in the [engines documentation](/docs/server/engines).
