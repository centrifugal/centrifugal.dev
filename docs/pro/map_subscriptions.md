---
id: map_subscriptions
title: Map subscriptions enhancements
---

:::caution Experimental

Map subscriptions is an experimental feature. All its parts - configuration options, client SDK API, server API - may change in future releases based on user feedback. At this point only `centrifuge-js` SDK supports map subscriptions on the client side.

:::

Centrifugo PRO extends the [map subscriptions](../server/map_subscriptions.md) feature with several enhancements for production deployments.

## In-memory cache layer

The cache layer keeps channel state in memory on each Centrifugo node, reducing backend reads and improving latency for subscribe operations. Since everything is served from memory, read latencies drop from milliseconds to microseconds range. The trade-off is proportionally increased memory usage on each Centrifugo node — memory consumption grows with the size of cached data.

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

The cache is filled from the backend — both local and remote writes arrive via PUB/SUB, so the cache reflects changes in near real-time. This ensures stream offsets in the cache match the order they were written in the main storage, keeping incremental recovery correct. The `sync_interval` acts as a safety net, periodically polling the backend to catch any publications that may have been missed due to transient PUB/SUB failures.

### Full-state delta sync

When the cache layer is enabled, map channels can optionally produce a **full-state delta stream** — a derived stream channel that delivers the entire map state as a single delta-compressed publication per tick.

Instead of receiving individual per-key updates, subscribers of the derived channel get one compact Fossil delta per tick — the minimum bytes needed to go from the previous state snapshot to the current one. The full state is assembled from the same map channel that clients publish to — the cache already holds all entries in memory, so no extra data source or application-side aggregation is needed.

This is especially efficient for Centrifugo-owned collections where clients publish per-key updates and the UI renders the full collection every frame — cursors, game positions, IoT fleet dashboards. For use cases that react to individual key changes (chat, inventories, CAS operations), use per-key map subscriptions instead.

#### Configuration

Set `full_state_channel_prefix` on the map namespace. You also need a stream namespace for the derived channel with delta compression enabled:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "cursors",
        "subscription_type": "map",
        "map": {
          "mode": "ephemeral",
          "key_ttl": "60s",
          "broker_name": "memory_cached",
          "full_state_channel_prefix": "fullstate:",
          "full_state_tick_interval": "50ms"
        }
      },
      {
        "name": "fullstate",
        "allowed_delta_types": ["fossil"],
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

Map channel `cursors:room1` produces a derived stream channel `fullstate:cursors:room1` — the prefix is prepended to the full channel name (same pattern as [map presence prefixes](/docs/server/map_subscriptions#presence-channels)).

| Option | Description |
|--------|-------------|
| `full_state_channel_prefix` | Derived stream channel prefix. Subscribing to `fullstate:cursors:room1` triggers cache loading for `cursors:room1`. |
| `full_state_tick_interval` | How often to produce a frame. Default: `"250ms"` (4 fps). Set lower for higher-frequency use cases (e.g., `"50ms"` for 20 fps game state). Frames are skipped when the state hasn't changed. |

#### Client usage

Subscribe to the derived channel as a regular stream subscription with delta compression. The current full state is delivered as a publication in the subscribe result — no waiting for the first tick:

```javascript
const sub = client.newSubscription('fullstate:cursors:room1', {
  delta: 'fossil',
});

sub.on('publication', (ctx) => {
  // ctx.data is the full current state as a JSON array of [key, value] pairs,
  // delta-decompressed by the SDK transparently.
  // First publication arrives immediately on subscribe (current snapshot).
  // Subsequent publications arrive on each tick with only the changed bytes.
  renderAllCursors(ctx.data);
});
```

No map subscription SDK APIs needed — it's a standard stream subscription. The SDK handles delta decompression automatically.

#### How it works

1. Clients publish per-key updates to the map channel (`cursors:room1`) as usual
2. The cache on each node mirrors the full state via PUB/SUB
3. When the first subscriber joins the derived channel, the cache loads the source map channel and starts a tick loop
4. Each tick: serialize the cache into a deterministic JSON array, compute Fossil delta against the previous frame, broadcast to local subscribers
5. Unchanged frames are skipped — no bandwidth is used when the state hasn't changed
6. Each node independently produces deltas from its own cache — no cross-node coordination
7. When all subscribers leave, the tick loop stops after 60 seconds of idle time

#### Bandwidth savings

The savings come from two sources: eliminating per-message protocol overhead (channel name, key, offset, tags repeated per publication) and built-in dedup (if the same key changes multiple times between ticks, only the latest value is serialized).

**50 cursors, 20 updates/sec each:**

| Approach | Bytes/sec per subscriber |
|----------|--------------------------|
| Per-key, no delta | 60 KB/s |
| Per-key, Fossil delta | 52 KB/s |
| **Full-state delta, 20fps** | **5 KB/s** |

**1,000 tickers, 200-400 changing every 500ms:**

| Approach | Bytes/sec per subscriber |
|----------|--------------------------|
| Per-key, no delta | 3 MB/s |
| Per-key, Fossil delta | 1.6 MB/s |
| **Full-state delta** | **~200 KB/s** |

The feature works best for small-to-medium collections (up to a few thousand entries) where clients consume the full state every frame.

#### Limitations

- Requires the [in-memory cache layer](#in-memory-cache-layer) — the cache is the source of the full state
- No per-subscriber filtering — all subscribers receive the same state (unlike [server-side tags filter](./server_tags_filter.md) on per-key subscriptions)
- No stream recovery on the derived channel — on reconnect, the subscriber receives a fresh full state snapshot in the subscribe result
- Channels with active full-state tickers are exempt from cache eviction (`max_channels` and `idle_timeout`)

## PostgreSQL enhancements

The following PostgreSQL scaling features apply to both the map broker (`map_broker.postgres`) and the [stream broker](../server/engines.md#postgresql-broker) (`broker.postgres`). Configuration examples below use the map broker; substitute `broker` for the stream broker.

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

:::tip
Automatic daily partitioning with configurable retention is built into the open-source PostgreSQL broker via the `partition_retention_days` and `partition_lookahead_days` settings — see [PostgreSQL map broker configuration](/docs/server/map_subscriptions#postgresql).
:::

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
