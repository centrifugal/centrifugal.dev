---
id: map_subscriptions
title: Map subscriptions enhancements
---

Centrifugo PRO extends the [map subscriptions](../server/map_subscriptions.md) feature with several enhancements for production deployments.

## Debouncing

Debouncing coalesces rapid updates to the same (channel, key) pair, sending only the latest value after a configured interval. This reduces broker load when clients publish high-frequency updates (e.g. cursor positions, sensor readings).

Configure per namespace:

```json title="config.json"
{
  "namespaces": [
    {
      "name": "cursors",
      "subscription_types": ["map"],
      "map_sync_mode": "ephemeral",
      "map_retention_mode": "expiring",
      "map_key_ttl": "60s",
      "debounce_interval": "50ms",
      "allow_subscribe_for_client": true,
      "allow_map_publish_for_subscriber": true,
      "map_client_key": "client_id"
    }
  ]
}
```

When debouncing is active:

- The first publish for a (channel, key) starts a timer
- Subsequent publishes within the interval replace the pending value without resetting the timer
- When the timer fires, only the latest value is sent to the broker
- Remove operations cancel any pending debounced publish for the same key
- Debounced publishes return an empty result immediately — CAS (compare-and-swap) operations are not compatible with debouncing

## In-memory cache layer

The cache layer keeps channel state in memory on each Centrifugo node, reducing backend reads and improving latency for subscribe operations.

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:pass@localhost:5432/app?sslmode=disable"
    },
    "cache": {
      "enabled": true,
      "max_channels": 1000,
      "idle_timeout": "10m",
      "sync_interval": "30s"
    }
  }
}
```

Key options:

| Option | Default | Description |
|--------|---------|-------------|
| `max_channels` | `1000` | Maximum number of channels cached per node |
| `idle_timeout` | `"10m"` | Evict channels with no subscribers after this duration |
| `sync_interval` | `"30s"` | How often to sync cache with the backend |
| `sync_jitter` | `0.1` | Randomize sync interval by +/- this fraction to avoid thundering herd |
| `sync_concurrency` | `64` | Number of parallel sync workers |
| `sync_batch_size` | `1000` | Max entries per sync batch |
| `load_timeout` | `"5s"` | Timeout for loading a channel from backend on first subscribe |
| `stream_size` | `10000` | Max stream entries to keep in cache |

The cache provides read-your-own-writes semantics: local writes are reflected immediately. Writes from other nodes appear within the `sync_interval`.

## PostgreSQL enhancements

### Read replicas

Distribute read load across PostgreSQL replicas:

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:pass@primary:5432/app?sslmode=disable",
      "replica": {
        "enabled": true,
        "dsn": [
          "postgres://user:pass@replica1:5432/app?sslmode=disable",
          "postgres://user:pass@replica2:5432/app?sslmode=disable"
        ]
      }
    }
  }
}
```

Reads from subscribers are distributed across replicas using consistent hashing on the channel name.

### Broker fan-out

By default, every Centrifugo node polls the PostgreSQL outbox independently. With broker fan-out, only one node per shard polls PostgreSQL and publishes updates through an external broker (Redis or NATS). This reduces PostgreSQL polling load proportionally to cluster size.

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:pass@localhost:5432/app?sslmode=disable",
      "broker_fanout": {
        "enabled": true,
        "type": "redis",
        "redis": {
          "address": "localhost:6379"
        }
      }
    }
  }
}
```

Shard leadership is coordinated through PostgreSQL advisory locks — only one node per shard holds the lock and processes outbox entries.

### Stream partitioning

Automatic daily partitioning of the stream table for large-scale deployments:

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:pass@localhost:5432/app?sslmode=disable",
      "stream_partitioning": {
        "enabled": true,
        "retention_days": 3,
        "lookahead_days": 2
      }
    }
  }
}
```

Old partitions are dropped entirely (instant) instead of deleting individual rows — this avoids table bloat and expensive vacuum operations at scale.

## Redis enhancements

Centrifugo PRO enables **Redis Cluster support** for the Redis map broker via sharded PUB/SUB. The open-source version only works with a single Redis instance (or client-side consistent sharding across standalone nodes). With PRO, you can use Redis Cluster as the map broker backend, and the enhancements below further optimize that setup.

### Node-grouped sharded PUB/SUB

When using Redis Cluster with sharded PUB/SUB, Centrifugo creates one PUB/SUB connection per partition by default. With node-grouped PUB/SUB, subscriptions are grouped by Redis Cluster node — reducing the total number of connections from `num_partitions` to `num_redis_nodes`.

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
    "type": "redis",
    "redis": {
      "cluster_addresses": ["localhost:7001", "localhost:7002", "localhost:7003"],
      "group_pub_sub_by_node": true,
      "sharded_pub_sub_partitions": 128
    }
  }
}
```

The coordinator automatically tracks Redis Cluster topology changes. When nodes are added, removed, or slots migrate, the PUB/SUB subscription map is rebuilt transparently.

### Subscribe on replica for Redis Map Broker

Offload PUB/SUB subscriptions to Redis replica nodes, freeing the primary for write operations:

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
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
