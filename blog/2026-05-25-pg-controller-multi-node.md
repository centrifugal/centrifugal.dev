---
title: Multi-node Centrifugo on PostgreSQL alone
tags: [centrifugo, postgresql, scaling, controller]
description: A new PostgreSQL controller in Centrifugo OSS lets multi-node clusters run without Redis or NATS. If your application already runs PostgreSQL, the messaging plane has everything it needs — one infrastructure dependency for the whole real-time tier.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/blog_pg_controller.jpg
hide_table_of_contents: false
draft: false
---

For most of [Centrifugo](https://centrifugal.dev)'s history, scaling past one node meant adding Redis. The new PostgreSQL controller makes Redis optional. Together with the [stream broker](/blog/2026/05/24/pg-stream-broker-benefits) and [map broker](/blog/2026/05/23/map-subscriptions-part-2) shipped earlier in this release cycle, Centrifugo's full OSS messaging cluster now runs on the PostgreSQL only.

<!--truncate-->

:::info New and evolving

Available in Centrifugo v6.8.0+. The PostgreSQL controller is a recent addition — we're eager for feedback. Configuration keys, schema, and outbox internals may still adjust before they're considered stable.

:::

## Why Redis was the OSS reality

A single Centrifugo node is self-contained — clients connect, the node tracks subscriptions in memory, publishes go straight to subscribers. Once a second node added, that breaks: a publish that arrives at node A needs to reach the clients connected to node B; subscribes, unsubscribes, and disconnects need to propagate; each node needs to know the live cluster topology. Centrifugo solves this with a `Controller` interface that distributes control messages between nodes.

Before v6.8.0, that interface had two implementations: Redis and NATS. NATS, however, is a Centrifugo PRO option. So the OSS reality was effectively *Redis or single-node*. Teams already running Redis for caching paid no extra operational cost. Teams running PostgreSQL as their primary store and nothing else had to provision and operate a Redis instance just to scale Centrifugo horizontally — even small deployments where PG could have handled the messaging traffic just fine.

That gap is what the PostgreSQL controller closes.

## How the controller works

The controller uses the same outbox pattern that powers the [PG stream broker](/blog/2026/05/24/pg-stream-broker-benefits) and the [PG map broker](/blog/2026/05/23/map-subscriptions-part-2):

- Control messages are written to a partitioned PostgreSQL table — one row per message.
- Each Centrifugo node polls the table for new entries and processes them.
- `LISTEN/NOTIFY` provides low-latency wakeup, so polling cadence stays low under quiet load while latency stays in the low single-digit milliseconds when traffic exists.
- Old partitions are dropped whole — vacuum-free cleanup that keeps long-lived deployments tidy without any manual maintenance.

The shape simply mirrors PostgreSQL brokers we described in recent blog posts.

## What flows through the controller

The controller carries cross-node operations Centrifugo needs to coordinate:

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

The same DSN can be reused across all three components, or split across separate PostgreSQL instances if you want to isolate the data plane from the control plane. All three create their own tables, partitions, and SQL functions on startup — there's no manual migration step.

## When to choose what

The PostgreSQL controller doesn't replace Redis or NATS for everyone. A rough way to decide:

- **PostgreSQL controller** — best for OSS deployments that already run PG, expect cluster sizes in the small-to-mid range (a handful of nodes), and want fewer services to manage. Latency under typical load is low single-digit milliseconds with `use_notify`.
- **Redis controller** — best when sub-millisecond control-plane coordination matters more than running fewer services, or when the deployment runs Redis for other reasons. Centrifugo's Redis controller has been the production default for years and remains the right pick for high-throughput control planes.
- **NATS controller** (PRO) — best for very large clusters where Redis pub/sub fan-out becomes the bottleneck, or for deployments already standardized on NATS.

For OSS deployments where Redis was added only to support multi-node Centrifugo, the PG controller is the cleaner option going forward. For deployments already running Redis as a cache or session store, there's no need to migrate off it — no functional reason to switch if Redis is already there for other purposes.

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

For background on the outbox pattern shared with the brokers, see the [PG stream broker post](/blog/2026/05/24/pg-stream-broker-benefits) and the [PG map broker post](/blog/2026/05/23/map-subscriptions-part-2). The full configuration reference lives in the [engines documentation](/docs/server/engines).

## A runnable demo

A working three-node example lives in [`examples/v6/pg_cluster_demo`](https://github.com/centrifugal/centrifugo/tree/master/examples/v6/pg_cluster_demo). It boots a single PostgreSQL container, three local Centrifugo nodes pointing at the same DSN, and a static page that exercises all three components at once:

<img src="/img/demo_pg_only.jpg" /><br /><br />

- The **cluster topology** panel polls `/api/info` and lists every node — that list is built from the heartbeats flowing through the **PG controller**.
- The **online here** panel is a `map_clients` map subscription whose state lives in PostgreSQL via the **PG map broker**, so every tab sees the same presence rows regardless of which node served it. We generally don't recommend PostgreSQL for presence — it's lightweight ephemeral data that fits Redis better. But for use cases with a reasonable number of concurrent clients, it works fine.
- The **chat** panel is a stream subscription on a channel served by the **PG stream broker** — a publish on one node arrives at subscribers on the other two within milliseconds via the `LISTEN/NOTIFY` wakeup.

Each browser tab connects to a specific node via `?n=1|2|3`, which makes the cross-node fan-out visible: type a message in the tab on `node-1` and watch it appear in the tabs on `node-2` and `node-3`.
