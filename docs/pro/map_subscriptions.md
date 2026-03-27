---
id: map_subscriptions
title: Map subscriptions enhancements
---

Centrifugo PRO extends the [map subscriptions](../server/map_subscriptions.md) feature with several enhancements for production deployments.

## In-memory cache layer

The cache layer keeps channel state in memory on each Centrifugo node, reducing backend reads and improving latency for subscribe operations.

```json title="config.json"
{
  "map_broker": {
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

Centrifugo PRO enables **Redis Cluster support** for the Redis map broker via sharded PUB/SUB. The open-source version only works with a single Redis instance (or client-side consistent sharding across standalone nodes). With PRO, you can use Redis Cluster as the map broker backend.

Redis Map Broker also supports [node-grouped sharded PUB/SUB](./scalability.md#node-grouped-sharded-pubsub) and [subscribe on replica](./scalability.md#subscribe-on-replica) — see [Scalability optimizations](./scalability.md) for details.

## Per-namespace map brokers

By default, all map channels use the single map broker configured in `map_broker`. Centrifugo PRO allows defining **named map broker instances** so that different namespaces can use different backends — for example, ephemeral cursor data in Redis and persistent scoreboard state in PostgreSQL.

Named map brokers are defined in the top-level `map_brokers` array. Each entry must have a unique `name`, an `enabled` flag, and a `type` with its backend-specific configuration. Then, a namespace references a named broker via the `map.broker_name` option.

```json title="config.json"
{
  "map_broker": {
    "type": "memory"
  },
  "map_brokers": [
    {
      "name": "redis_cursors",
      "enabled": true,
      "type": "redis",
      "redis": {
        "address": "localhost:6379"
      }
    },
    {
      "name": "pg_scores",
      "enabled": true,
      "type": "postgres",
      "postgres": {
        "dsn": "postgres://user:pass@localhost:5432/app?sslmode=disable"
      }
    }
  ],
  "channel": {
    "namespaces": [
      {
        "name": "cursors",
        "subscription_type": "map",
        "map": {
          "mode": "ephemeral",
          "key_ttl": "60s",
          "broker_name": "redis_cursors",
          "allow_publish_for_subscriber": true,
          "client_key": "client_id"
        },
        "allow_subscribe_for_client": true
      },
      {
        "name": "scoreboard",
        "subscription_type": "map",
        "map": {
          "mode": "persistent",
          "ordered": true,
          "broker_name": "pg_scores"
        },
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

When `map.broker_name` is not set (or empty), the namespace uses the default `map_broker`. If a namespace references a name that is not found or not enabled in `map_brokers`, Centrifugo returns a validation error on startup.
