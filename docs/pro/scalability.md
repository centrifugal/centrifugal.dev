---
description: "Centrifugo PRO scalability features: singleflight, shared position sync, Redis replica offloading, sharded PUB/SUB, per-namespace engines, and custom controllers (Redis, Nats)."
id: scalability
title: Scalability optimizations
---

Centrifugo PRO comes with several options to reduce load on Engine – specifically on its history and presence API. This may have a positive effect on CPU resource usage on engine side and a positive effect on operation latencies.

## Singleflight

Centrifugo PRO provides an additional boolean option `use_singleflight` (default `false`). When this option is enabled, Centrifugo will automatically try to merge identical requests to history, online presence, or presence stats issued at the same time into one real network request. It will do this by using an in-memory component called `singleflight`.

![Singleflight](/img/singleflight.png)

:::tip

While it can seem similar, singleflight is not a cache. It only combines identical parallel requests into one. If requests come one after another – they will be sent separately to the broker or presence storage.

:::

This option can radically reduce the load on a broker in the following situations:

* Many clients subscribed to the same channel and in case of massive reconnect scenario try to access history simultaneously to restore a state (whether manually using history API or over automatic recovery feature)
* Many clients subscribed to the same channel and positioning feature is on so Centrifugo tracks client position
* Many clients subscribed to the same channel and in case of massive reconnect scenario try to call presence or presence stats simultaneously

Using this option only makes sense with remote engine (such as Redis), it won't provide a benefit in case of using a Memory engine.

To enable:

```json title="config.json"
{
  "singleflight": {
    "enabled": true
  }
}
```

Or via `CENTRIFUGO_USE_SINGLEFLIGHT` environment variable.

## Shared position sync

Shared position synchronization feature allows reducing the load on the broker from position synchronization requests in channels with many subscribers and positioning/recovery enabled.

Centrifugo uses periodic position synchronization requests to make sure there was no message loss between Engine PUB/SUB and Centrifugo. These requests create additional load on broker.

When `shared_position_sync` is enabled, subscribers use an intermediary cache to only send position requests to the broker if another channel subscriber has not done so recently. The benefit here is proportional to the number of channel subscribers on a Centrifugo node.

To enable in the specific channel namespace use boolean channel option `shared_position_sync`:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "example",
        "force_recovery": true,
        "shared_position_sync": true
      }
    ]
  }
}
```

## Leverage Redis replicas

Centrifugo users have Redis setups with replication configured. Replication is usually used in a Redis Sentinel based primary-replica setup, or in Redis Cluster where each cluster shard may consist of a primary and several replicas.

Centrifugo PRO allows utilizing existing replicas for certain operations:

* move all channel subscriptions to replica – thus primary becomes less utilized
* move reading presence information to replica, again making primary more effective since potentially more slow requests are moved out.

This extends scalability options and may be very handy to stay on lower resources. Let's look how to configure those.

### Subscribe on replica

It's supported by Redis Engine, Redis Broker, and Redis Map Broker (only for Redis Sentinel and Redis Cluster setups).

You need to enable `replica_client` in Redis configuration and set `subscribe_on_replica` boolean option:

```json title="config.json"
{
  "engine": {
    "type": "redis",
    "redis": {
      "address": "redis+cluster://localhost:7000",
      "replica_client": {
        "enabled": true
      },
      "subscribe_on_replica": true
    }
  }
}
```

Centrifugo PRO will automatically move channel subscriptions to discovered replica.

The same may be used when configuring a separate Redis Broker.

For Redis Map Broker, the same option offloads PUB/SUB subscriptions to replica nodes, freeing the primary for write operations:

```json title="config.json"
{
  "map_broker": {
    "type": "redis",
    "redis": {
      "address": "localhost:6379",
      "replica": {
        "enabled": true,
        "address": "localhost:6380"
      },
      "subscribe_on_replica": true
    }
  }
}
```

Works with both standalone Redis (with a replica) and Redis Cluster setups.

### Read presence from replica

To read presence information from replica you need to enable `replica_client` in Redis configuration and set `presence_read_from_replica` boolean option:

```json title="config.json"
{
  "engine": {
    "type": "redis",
    "redis": {
      "address": "redis+cluster://localhost:7000",
      "replica_client": {
        "enabled": true
      },
      "presence_read_from_replica": true
    }
  }
}
```

Centrifugo PRO will automatically move presence read operations to discovered replica.

The same may be used when configuring a separate Redis Presence Manager.

## Redis Cluster sharded PUB/SUB

Sharded PUB/SUB [was introduced in Redis 7.0](https://redis.io/docs/latest/develop/interact/pubsub/#sharded-pubsub) as an attempt to fix the problem with PUB/SUB scalability in Redis Cluster. With normal PUB/SUB all publications are spread towards all nodes of cluster. This makes Cluster PUB/SUB throughput less with adding more nodes to the cluster. The utilization of Redis shards is usually unequal when using PUB/SUB in Redis Cluster as subscriptions land to one of the shards. In sharded PUB/SUB case channel keyspace is divided to slots in the same way as normal keys, and PUB/SUB is split over Redis Cluster nodes based on channel name.

![](/img/redis_cluster_sharded_pub_sub.png)

When using Centrifugo PRO with the sharded PUB/SUB feature, there are important considerations to keep in mind. This feature changes how Centrifugo constructs keys and channel names in Redis compared to the standard non-sharded setup. Specifically, Centrifugo divides the channel space into a configurable number of `sharded_pub_sub_partitions`, typically 64 to 128 (but this is up to the developer to decide on the number depending on the load and cluster size). This partitioning is essential to ensure compatibility with Redis Cluster's slot system while keeping the number of connections from Centrifugo to Redis at a manageable level. Each partition uses a dedicated connection for PUB/SUB communication with the Redis Cluster.

Without this partitioning, each Centrifugo node could potentially create up to 16,384 connections to the Redis Cluster — one for each cluster slot — a number that is impractically large. The partitioning strategy avoids this issue, maintaining efficient and scalable communication between Centrifugo and Redis.

:::caution

This means that enabling sharded PUB/SUB changes the key names Centrifugo uses in Redis, so any existing data (history, presence, result cache) is effectively lost on the switch. In many cases Centrifugo data is ephemeral, so if your application is built idiomatically connected subscribers should survive the change without issues.

:::

Here is how to enable sharded PUB/SUB in Centrifugo PRO:

```json title="config.json"
{
  "engine": {
    "type": "redis",
    "redis": {
      "address": "redis+cluster://localhost:7000",
      "sharded_pub_sub_partitions": 64
    }
  }
}
```

### Per-partition sharded PUB/SUB

By default, Centrifugo creates one PUB/SUB connection per partition. Each partition maps to a Redis Cluster slot, and the connection is established to the node owning that slot. This means every Centrifugo node maintains `num_partitions` PUB/SUB connections to the Redis Cluster — one for each partition.

This is the simplest setup and requires no extra configuration beyond `sharded_pub_sub_partitions`. It works well when the partition count is moderate (64–128) and the Centrifugo cluster is moderate size (below ~50 nodes), since the total number of PUB/SUB connections to Redis Cluster is `num_centrifugo_nodes × num_partitions`.

### Node-grouped sharded PUB/SUB

:::caution Experimental

This feature is experimental.

:::

With node-grouped PUB/SUB, subscriptions are grouped by Redis Cluster node — reducing the total number of PUB/SUB connections from one Centrifugo node from `num_partitions` down to `num_redis_nodes`.

As a worked example from a real deployment — 200 Centrifugo nodes, 128 partitions, a 6-node Redis Cluster:

|                                   | Per-partition       | Node-grouped      |
|-----------------------------------|---------------------|-------------------|
| PUB/SUB connections per Centrifugo node | 128            | 6                 |
| Total Centrifugo↔Redis PUB/SUB conns    | `200 × 128 = 25,600` | `200 × 6 = 1,200` |
| Average connections per Redis node      | `25,600 / 6 ≈ 4,267` | `1,200 / 6 = 200` |

The per-Redis-node view is usually the constraint that bites first: at ~4k connections per node you're brushing default `maxclients`, file-descriptor ceilings, and per-connection memory overhead on the Redis side. Node-grouped collapses that to ~200 per node and equalizes load across the cluster.

```json title="config.json"
{
  "engine": {
    "type": "redis",
    "redis": {
      "address": "redis+cluster://localhost:7000",
      "group_sharded_pub_sub_by_node": true,
      "sharded_pub_sub_partitions": 128
    }
  }
}
```

The coordinator automatically tracks Redis Cluster topology changes. When nodes are added, removed, or slots migrate, the PUB/SUB subscription map is rebuilt transparently.

This optimization also applies to Redis Map Broker:

```json title="config.json"
{
  "map_broker": {
    "type": "redis",
    "redis": {
      "address": "localhost:7001",
      "group_sharded_pub_sub_by_node": true,
      "sharded_pub_sub_partitions": 128
    }
  }
}
```

### Even partition distribution with precomputed tags

This option is available since Centrifugo PRO v6.8.3.

By default each partition's hash tag is just its index — `{0}`, `{1}`, ... `{N-1}`. These short numeric strings hash via CRC16 into clustered Redis Cluster slots, so on larger clusters the partitions land very unevenly across nodes. At 16 nodes with 32 partitions, for example, roughly half the cluster nodes end up receiving no sharded PUB/SUB traffic at all.

Setting `use_precomputed_partition_tags` to `true` switches partition hash tags to a precomputed table whose CRC16 slots are chosen to spread evenly across any cluster size. This removes the load skew described above.

```json title="config.json"
{
  "engine": {
    "type": "redis",
    "redis": {
      "address": "redis+cluster://localhost:7000",
      "use_precomputed_partition_tags": true,
      "sharded_pub_sub_partitions": 128
    }
  }
}
```

When enabled, `sharded_pub_sub_partitions` must be one of the supported sizes: `16`, `32`, `64`, `128`, `256`, `512`, `1024`, `2048`, `4096`. Centrifugo refuses to start otherwise.

The option also applies to Redis Map Broker (set it inside `map_broker.redis`) and can be combined with `group_sharded_pub_sub_by_node`.

:::caution

Enabling `use_precomputed_partition_tags` changes the key names Centrifugo uses in Redis, so any existing data (history, presence, result cache) is effectively lost on the switch. In many cases Centrifugo data is ephemeral, so if your application is built idiomatically connected subscribers should survive the change without issues.

:::

## Per-namespace engines

Centrifugo OSS allows [specifying an engine](../server/engines.md). Engine is responsible for PUB/SUB and channel stream/history features (we call this part `Broker`), and for online presence (this part is called `Presence Manager`). Engine in Centrifugo OSS is global for the entire Centrifugo setup – once defined, all channels use it to make operations.

Centrifugo PRO allows redefining brokers and presence managers at the namespace level. This lets you both pick the right backend for each feature and distribute load across separate infrastructure — for example, isolating high-traffic namespaces onto their own Redis instance. Use Redis or Nats for one realtime feature and PostgreSQL for another.

For example:

- **PostgreSQL** for order-update and notification channels — transactional publishing, atomic with your database writes
- **Redis** for high-throughput channels like live scores or telemetry — maximum speed, no transaction overhead
- **Nats** for channels that need wildcard subscriptions or raw topic consumption
- **Memory** for ephemeral channels that don't need persistence or cross-node delivery

You can also separate Redis setups used for broker purposes and online presence purposes.

### Defining brokers

First, you need to create configuration for additional brokers:

```json title="config.json"
{
  ...
  "brokers": [
    {
      "enabled": true,
      "name": "mycustomredis",
      "type": "redis",
      "redis": {
        "address": "127.0.0.1:6379"
      }
    },
    {
      "enabled": true,
      "name": "mycustomnats",
      "type": "nats",
      "nats": {
        "url": "nats://localhost:4222"
      }
    },
    {
      "enabled": true,
      "name": "mycustompg",
      "type": "postgres",
      "postgres": {
        "dsn": "postgres://user:pass@localhost:5432/app?sslmode=disable"
      }
    }
  ]
}
```

At this point Centrifugo PRO supports three broker types:

* `redis` - inherits all the possibilities of Centrifugo OSS [Redis integration](../server/engines.md#redis-engine)
* `nats` –  inherits all the possibilities of Centrifugo OSS [integration with Nats](../server/engines.md#nats-broker).
* `postgres` –  inherits all the possibilities of Centrifugo OSS [integration with PostgreSQL](../server/engines.md#postgresql-broker).

These brokers inherit all options described in the [Engines and scalability](../server/engines.md) chapter. The only difference is that it's possible to specify which custom broker to use inside a channel namespace:

```json title="config.json"
{
  ...
  "channel": {
    "namespaces": [
      {
        "name": "rates",
        "broker_name": "mycustomnats"
      }
    ]
  }
}
```

### Defining presence managers

And for custom Presence Managers a similar approach may be applied. First, define a custom presence manager:

```json title="config.json"
{
  "presence_managers": [
    {
      "enabled": true,
      "name": "mycustomredis",
      "type": "redis",
      "redis": {}
    }
  ]
}
```

Centrifugo PRO only supports `redis` type of Presence Manager.

And then enable it for namespace:

```json title="config.json"
{
  ...
  "channel": {
    "namespaces": [
      {
        "name": "rates",
        "broker_name": "mycustomnats",
        "presence_manager_name": "mycustomredis"
      }
    ]
  }
}
```

## Setting custom Controller

The Controller in Centrifugo is responsible for cross-node communication in the cluster. Centrifugo PRO allows using a custom controller configuration. This may be useful to isolate controller load from channel load (i.e. from the Broker), or to use Redis for channel operations and Nats for controller operations, or to use Redis for channel operations but something like DragonflyDB for controller operations, etc.

To use a custom controller you need to set `controller` configuration option and set `enabled` to `true`. In PRO, `redis` and `nats` controller types are available. The [PostgreSQL controller](../server/engines.md#postgresql-controller) is built into Centrifugo OSS.

### Redis Controller

```json title="config.json"
{
  "controller": {
    "enabled": true,
    "type": "redis",
    "redis": {
      "address": "redis://localhost:6379"
    }
  }
}
```

Redis options are the same as for the Redis Engine configuration (except those which only make sense for Broker or PresenceManager).

### Nats Controller

```json title="config.json"
{
  "controller": {
    "enabled": true,
    "type": "nats",
    "nats": {
      "url": "nats://localhost:4222"
    }
  }
}
```

Nats options are the same as for the Nats Broker configuration (except those which only make sense for Broker).
