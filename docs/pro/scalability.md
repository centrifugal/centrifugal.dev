---
id: scalability
title: Scalability optimizations
---

Centrifugo PRO comes with several options to reduce load on Engine – specifically on its history and presence API. This may have a positive effect on CPU resource usage on engine side and a positive effect on operation latencies.

## Singleflight

Centrifugo PRO provides an additional boolean option `use_singleflight` (default `false`). When this option enabled Centrifugo will automatically try to merge identical requests to history, online presence or presence stats issued at the same time into one real network request. It will do this by using in-memory component called `singleflight`.

![Singleflight](/img/singleflight.png)

:::tip

While it can seem similar, singleflight is not a cache. It only combines identical parallel requests into one. If requests come one after another – they will be sent separately to the broker or presence storage.

:::

This option can radically reduce a load on a broker in the following situations:

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

When `shared_position_sync` is enabled subscribers use an intermediary cache to only send position requests to the broker if another channel subscriber have not done it recently. So the benefit here is proportional to the number of channel subscribers on Centrifugo node.

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

Centrifugo users have Redis setups with replication configured. Replication is usually used in Redis Sentinel based primary-replica setup, or Redis Cluster where each cluster shard may consist of primary and several replicas.

Centrifugo PRO allows utilizing existing replicas for certain operations:

* move all channel subscriptions to replica – thus primary becomes less utilized
* move reading presence information to replica, again making primary more effective since potentially more slow requests are moved out.

This extends scalability options and may be very handy to stay on lower resources. Let's look how to configure those.

### Subscribe on replica

It's supported in by Redis Engine and Redis Broker (only for Redis Sentinel and Redis Cluster setups).

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

Sharded PUB/SUB [was introduced in Redis 7.0](https://redis.io/docs/latest/develop/interact/pubsub/#sharded-pubsub) as an attempt to fix the problem with PUB/SUB scalability in Redis Cluster. With normal PUB/SUB all publications are spread towards all nodes of cluster. This makes Cluster PUB/SUB throughput less with adding more nodes to the cluster. The utilization of Redis shards is usually unequal when using PUB/SUB in Redis Cluster as subscriptions land to one of the shards. In sharded PUB/SUB case channel keyspace is devided to slots in the same way as normal keys, and PUB/SUB is splitted over Redis Cluster nodes based on channel name.

When using Centrifugo PRO with the sharded PUB/SUB feature, there are important considerations to keep in mind. This feature changes how Centrifugo constructs keys and channel names in Redis compared to the standard non-sharded setup. Specifically, Centrifugo divides the channel space into a configurable number of `sharded_pub_sub_partitions`, typically 64 to 128 (but this is up to developer to decide on the number depending on the load and cluster size).  This partitioning is essential to ensure compatibility with Redis Cluster's slot system while keeping the number of connections from Centrifugo to Redis at a manageable level. Each partition uses a dedicated connection for PUB/SUB communication with the Redis Cluster.

Without this partitioning, each Centrifugo node could potentially create up to 16384 connections to the Redis Cluster—one for each cluster slot—a number that is impractically large. The partitioning strategy avoids this issue, maintaining efficient and scalable communication between Centrifugo and Redis.

We generally recommend using Redis sharded PUB/SUB only if you are already using a Redis Cluster and are nearing its scalability limits. In such cases, switching to sharded PUB/SUB mode, despite the different keys/channel names in Redis, can significantly enhance the application's ability to handle larger workloads.

Once the scalability limit of a single cluster with sharded PUB/SUB is reached, you can further scale by adding an additional, isolated Redis Cluster. Centrifugo can then be configured to use multiple clusters instead of one, enabling scaling similar to its consistent sharding mechanism over isolated single Redis instances. However, in this setup, the sharding occurs across multiple Redis Clusters.

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

Sharded PUB/SUB support is a powerful feature which will push your Redis Cluster to its PUB/SUB limits, but it requires careful consideration given the implementation details described above.

## Setting custom Controller

Controller in Centrifugo is responsible for cross-node communication in cluster. Centrifugo PRO allows using a custom controller configuration. This may be useful to isolate controller load from channel load, or to use Redis for channel operations and Nats for controller operations, or use Redis for channel operations, but sth like DragonflyDB for controller operations, etc.

To use a custom controller you need to set `controller` configuration option and set `enabled` to `true`. You can use `redis` or `nats` as a controller type. Here is an example of using custom Redis setup as a controller:

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

Same for Nats:

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
