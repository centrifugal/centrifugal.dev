---
description: "Centrifugo PRO scalability features: singleflight, shared position sync, Redis replica offloading, sharded PUB/SUB, per-namespace engines, and custom controllers (Redis, Nats, PostgreSQL)."
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

We generally recommend using Redis sharded PUB/SUB only if you are already using a Redis Cluster and are nearing its scalability limits. In such cases, switching to sharded PUB/SUB mode, despite the different keys/channel names in Redis, can significantly enhance the application's ability to handle larger workloads.

Once the scalability limit of a single cluster with sharded PUB/SUB is reached, you can further scale by adding an additional isolated Redis Cluster. Centrifugo can then be configured to use multiple clusters instead of one, enabling scaling similar to its consistent sharding mechanism over isolated single Redis instances. However, in this setup, the sharding occurs across multiple Redis Clusters.

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

Sharded PUB/SUB support is a powerful feature which will push your Redis Cluster to its PUB/SUB limits, but it requires careful consideration given the implementation details described above.

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
      "type": "postgresql",
      "postgresql": {
        "dsn": "postgresql://..."
      }
    }
  ]
}
```

At this point Centrifugo PRO supports three broker types:

* `redis` - inherits all the possibilities of Centrifugo OSS [Redis integration](../server/engines.md#redis-engine)
* `nats` –  inherits all the possibilities of Centrifugo OSS [integration with Nats](../server/engines.md#nats-broker).
* `postgresql` –  inherits all the possibilities of Centrifugo OSS [integration with PostgreSQL](../server/engines.md#postgresql-broker).

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

To use a custom controller you need to set `controller` configuration option and set `enabled` to `true`. You can use `redis`, `nats`, or `postgres` as a controller type.

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

### PostgreSQL Controller

:::caution Experimental

PostgreSQL controller is experimental. We appreciate early feedback but the API may change.

:::

The PostgreSQL controller completes the "Centrifugo + PostgreSQL, no Redis" story for multi-node deployments. When combined with [PostgreSQL stream broker](../server/engines.md#postgresql-broker) and/or [PostgreSQL map broker](../server/map_subscriptions.md#postgresql), you can run a fully functional Centrifugo cluster using only PostgreSQL as the infrastructure dependency — no Redis or Nats required.

The controller uses the same outbox-based approach as the PostgreSQL broker: control messages are INSERT-ed into a partitioned table with daily retention, and each node polls for new rows. LISTEN/NOTIFY provides low-latency wakeup so messages are typically delivered within a few milliseconds.

Requires **PostgreSQL 16** or later.

```json title="config.json"
{
  "controller": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:password@localhost:5432/centrifugo?sslmode=disable",
      "use_notify": true
    }
  }
}
```

Centrifugo automatically manages the required database schema (tables, functions, partitions) on startup.

#### Configuration options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dsn` | string | — | PostgreSQL connection string (required) |
| `pool_size` | int | 8 | Maximum connections in the primary pool |
| `num_shards` | int | 1 | Number of shards for serialized publishing |
| `table_prefix` | string | `"cf"` | Namespace prefix for table names (e.g. `cf_controller_messages`) |
| `poll_interval` | duration | `"50ms"` | Idle poll interval for the outbox worker |
| `use_notify` | bool | false | Enable LISTEN/NOTIFY for low-latency delivery. See [connection pooler note](../server/engines.md#listennotify-and-connection-poolers) |
| `notify_dsn` | string | `""` | Separate DSN for the LISTEN connection. Use a direct PostgreSQL URL when `dsn` points at PGBouncer or another pooler incompatible with LISTEN/NOTIFY |
| `partition_retention_days` | int | 1 | Days to keep old partitions before dropping |
| `partition_lookahead_days` | int | 2 | Future daily partitions to pre-create |
| `partition_cleanup_interval` | duration | `"1m"` | How often to run partition maintenance |
| `skip_schema_init` | bool | false | Skip automatic schema creation on startup |

#### Read replica support

The controller supports routing read operations (outbox polling) to a PostgreSQL replica while keeping writes on the primary:

```json title="config.json"
{
  "controller": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:password@primary:5432/centrifugo?sslmode=disable",
      "use_notify": true,
      "replica": {
        "dsn": ["postgres://user:password@replica:5432/centrifugo?sslmode=disable"],
        "pool_size": 4
      }
    }
  }
}
```

LISTEN/NOTIFY always uses the primary connection (PostgreSQL limitation), but the outbox polling query runs on the replica, reducing primary load.

#### Multi-tenant table prefix

For multi-tenant setups where several Centrifugo clusters share the same PostgreSQL database, use distinct `table_prefix` values:

```json title="config.json"
{
  "controller": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:password@localhost:5432/shared_db?sslmode=disable",
      "table_prefix": "prod_us_cf"
    }
  }
}
```

This produces tables like `prod_us_cf_controller_messages`, `prod_us_cf_controller_shard_lock`, etc.

#### Database objects created

The controller creates and manages the following objects (shown with default `cf` prefix):

| Object | Type | Description |
|--------|------|-------------|
| `cf_controller_messages` | partitioned table | Control message outbox, partitioned by `created_at` (daily) |
| `cf_controller_shard_lock` | table | Per-shard serialization lock rows |
| `cf_controller_schema_version` | table | Schema version tracking |
| `cf_controller_publish` | function | Atomic INSERT + NOTIFY with shard lock serialization |

#### PostgreSQL-only multi-node deployment

With the PostgreSQL controller, stream broker, and map broker, you can run a multi-node Centrifugo cluster using PostgreSQL as the only infrastructure dependency:

```json title="config.json"
{
  "broker": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:password@localhost:5432/centrifugo?sslmode=disable",
      "use_notify": true
    }
  },
  "map_broker": {
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:password@localhost:5432/centrifugo?sslmode=disable",
      "use_notify": true
    }
  },
  "controller": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:password@localhost:5432/centrifugo?sslmode=disable",
      "use_notify": true
    }
  }
}
```

All three components can share the same PostgreSQL database — they use separate table namespaces (`cf_stream_*`, `cf_map_*`, `cf_controller_*`). Each manages its own schema, partitions, and cleanup independently.
