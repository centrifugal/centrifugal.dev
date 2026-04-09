---
id: shared_poll
title: Shared poll enhancements
---

Centrifugo PRO extends the [shared poll subscriptions](../server/shared_poll.md) feature with [cached latest data](#cached-latest-data) and [delta compression](#delta-compression), [adaptive backpressure](#adaptive-backpressure), a [notification fast path](#notification-fast-path) for near-instant updates, and a standalone [relay server](#shared-poll-relay) for reducing backend load.

## Cached latest data

When `keep_latest_data` is enabled in the namespace's `shared_poll` config, Centrifugo caches the latest data and version for each tracked item in memory. This unlocks two capabilities: instant data for new clients without waiting for the next poll cycle, and delta compression for bandwidth savings.

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "post_votes",
        "subscription_type": "shared_poll",
        "shared_poll": {
          "refresh_interval": "1s",
          "keep_latest_data": true
        },
        "allowed_delta_types": ["fossil"],
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

### Instant data for new clients

:::note
Instant data via `keep_latest_data` requires `versioned` refresh mode. In `versionless` mode, `keep_latest_data` enables delta compression but not cached latest data.
:::

When a client tracks keys with version `0` ("I have no data yet"), Centrifugo returns cached data directly in the track response — the client receives data without any backend call and without waiting for the next poll cycle.

1. The track response includes cached items where the server has a newer version than the client
2. The client receives these items immediately as `update` events
3. Per-connection versions are updated to prevent duplicate delivery via subsequent broadcasts

This is particularly valuable for:

- **Config sync** — a single key with a long refresh interval (30s+). New clients get the current configuration instantly on connect, while admin changes propagate immediately via `shared_poll_publish`. A simpler alternative to Kafka compacted topics or similar infrastructure for distributing configuration to application instances
- **Reconnect and page navigation** — a user navigates away and returns, or reconnects after a network drop. Tracked items are served from cache immediately, then the polling safety net catches any changes that happened in between
- **Low-frequency polling channels** — when `refresh_interval` is long to minimize backend load, cached data bridges the gap for new clients

:::tip
Without `keep_latest_data`, the open-source version still reduces cold-start delay via [**cold key auto-poll**](../server/shared_poll.md#quick-initial-data): when a key is tracked for the first time across all connections, an immediate backend poll is triggered. But with `keep_latest_data`, data for already-cached keys is served directly from memory — no backend call needed.
:::

### Delta compression

Shared poll subscriptions support [fossil delta compression](../server/delta_compression.md) to minimize bandwidth when item data changes by small amounts. Add `"fossil"` to `allowed_delta_types` in the namespace (in addition to `keep_latest_data`).

When enabled, Centrifugo computes fossil deltas between the previous and current versions. Clients that negotiated delta compression receive a compact patch instead of the full data payload.

## Notification fast path

By default, shared poll subscriptions rely on timer-based polling — clients see backend data changes only after the next refresh cycle (up to `refresh_interval` latency). The notification fast path lets your application push lightweight signals when data changes, triggering an immediate backend poll for just the affected keys. This reduces update latency from seconds to milliseconds without abandoning the simplicity of the polling model.

Notifications are **not data** — they are just channel + key hints. The existing backend poll mechanism fetches the actual data, so your publish path stays simple (no need to serialize and send full payloads through the notification channel).

### How it works

Your application publishes a small JSON message to a Redis or NATS pub/sub channel whenever data changes:

```json
{
  "items": [
    {
      "channel": "post_votes:feed1",
      "key": "post_123"
    },
    {
      "channel": "post_votes:feed1",
      "key": "post_456"
    }
  ]
}
```

Centrifugo subscribes to this channel and:

1. Batches incoming notifications (configurable by `batch_max_size` and `batch_max_delay`)
2. Triggers an immediate backend poll for just the notified keys
3. Pushes updates to clients as usual (version comparison, delta compression, etc.)

The timer-based polling continues running in parallel — notifications are an acceleration layer, not a replacement.

### Without relay

```
 App ──publish──► Redis/NATS ──subscribe──► Centrifugo nodes ──poll backend──► deliver to clients
```

Each Centrifugo node subscribes to the notification channel. When a notification arrives, the node immediately polls the backend for the specified keys and delivers updates to connected clients.

### With relay

```
 App ──publish──► Redis/NATS     ──subscribe──► Relay ──poll backend──► cache
                  (notify channel)                        │
                                                          ▼
 Centrifugo nodes ◄──subscribe── Redis/NATS ◄──publish── Relay
                   (ready channel)           (ready signal)
```

When using the [shared poll relay](#shared-poll-relay), the two-hop path works as follows:

1. Your app publishes to the **notify channel** (default `shared_poll_notify`)
2. The relay process subscribes, calls the backend for the notified keys, caches the result
3. The relay publishes a **ready signal** to the **ready channel** (default `shared_poll_ready`)
4. Normal nodes subscribe to the ready channel, then query the relay for the already-cached fresh data

This happens automatically — when `shared_poll_relay.enabled` is `true`, normal nodes subscribe to the ready channel instead of the notify channel.

### Configuration

Enable notifications in the `shared_poll.notification` section:

```json title="config.json"
{
  "shared_poll": {
    "hmac_secret_key": "your-secret-key",
    "notification": {
      "enabled": true,
      "type": "redis",
      "redis": {
        "address": "redis://localhost:6379"
      },
      "batch_max_size": 50,
      "batch_max_delay": "50ms"
    }
  },
  "channel": {
    "namespaces": [
      {
        "name": "post_votes",
        "subscription_type": "shared_poll",
        "shared_poll": {
          "refresh_interval": "10s"
        },
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

When using the relay, also configure notifications on the relay side in `shared_poll_relay.notification`:

```json title="config.json"
{
  "shared_poll_relay": {
    "enabled": true,
    "endpoint": "http://localhost:9090",
    "http_server": {
      "enabled": true,
      "port": 9090
    },
    "notification": {
      "enabled": true,
      "type": "redis",
      "redis": {
        "address": "redis://localhost:6379"
      }
    }
  },
  "shared_poll": {
    "notification": {
      "enabled": true,
      "type": "redis",
      "redis": {
        "address": "redis://localhost:6379"
      }
    }
  }
}
```

### Notification options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable notification-driven fast path |
| `type` | string | `"redis"` | Pub/sub backend: `"redis"` or `"nats"` |
| `redis` | object | | Redis connection config (same format as other Redis configs, with optional `prefix`) |
| `nats` | object | | NATS connection config (with optional `prefix`) |
| `channel` | string | `"shared_poll_notify"` | Notification channel/subject name |
| `batch_max_size` | integer | `0` | Maximum notified keys per batch before triggering backend poll |
| `batch_max_delay` | [duration](../server/configuration.md#duration-type) | `"0s"` | Maximum time to wait before triggering backend poll |

### Notification batching

Batching is configured **per namespace** in the `shared_poll.notification` block inside the namespace config. The top-level `shared_poll.notification.batch_max_size` and `batch_max_delay` serve as global defaults — they apply to any namespace that doesn't set its own values.

```json title="config.json"
{
  "shared_poll": {
    "notification": {
      "enabled": true,
      "type": "redis",
      "redis": { "address": "redis://localhost:6379" },
      "batch_max_size": 50,
      "batch_max_delay": "100ms"
    }
  },
  "channel": {
    "namespaces": [
      {
        "name": "post_votes",
        "subscription_type": "shared_poll",
        "shared_poll": {
          "refresh_interval": "10s",
          "notification": {
            "batch_max_size": 100,
            "batch_max_delay": "200ms"
          }
        }
      }
    ]
  }
}
```

In this example, `post_votes` uses its own batch settings (100 / 200ms). Other namespaces without explicit notification config inherit the global defaults (50 / 100ms).

Batching behavior depends on which parameters are set:

| `batch_max_size` | `batch_max_delay` | Behavior |
|------------------|-------------------|----------|
| 0 | 0 | No batching — each notification triggers an immediate backend poll |
| > 0 | 0 | Size-based batching, `refresh_interval` used as delay cap |
| 0 | > 0 | Timer-based batching only |
| > 0 | > 0 | Whichever threshold is reached first triggers the poll |

The batching logic is the same for both relay and non-relay modes. When using the relay, the relay process performs per-channel batching using namespace config, and normal nodes fire immediately on ready signals (no double-batching).

### Publishing notifications

Your application publishes directly to the notification Redis/NATS channel — no Centrifugo API call needed. The message is a JSON object with an `items` array:

```json
{"items":[{"channel":"post_votes:feed1","key":"post_123"}]}
```

Example with Redis CLI:

```bash
redis-cli PUBLISH shared_poll_notify '{"items":[{"channel":"post_votes:feed1","key":"post_123"}]}'
```

Example with Python (redis-py):

```python
import json
import redis

r = redis.Redis()

def notify_shared_poll(channel: str, keys: list[str]):
    items = [{"channel": channel, "key": key} for key in keys]
    r.publish("shared_poll_notify", json.dumps({"items": items}))

# After updating vote counts:
notify_shared_poll("post_votes:feed1", ["post_123", "post_456"])
```

Example with NATS:

```python
import json
import nats

async def notify_shared_poll(nc, channel: str, keys: list[str]):
    items = [{"channel": channel, "key": key} for key in keys]
    await nc.publish("shared_poll_notify", json.dumps({"items": items}).encode())
```

You can batch multiple notifications in a single message to reduce pub/sub overhead.

## Shared poll relay

The shared poll relay is a standalone Centrifugo process that centralizes backend polling. Instead of every Centrifugo node calling your backend independently on each refresh cycle, the relay polls the backend once and serves cached results to all nodes.

```
                    +---------------+
                    |   Backend     |
                    |  (your app)   |
                    +-------+-------+
                            |
                            | polls on schedule
                            |
                    +-------v-------+
                    |  Centrifugo   |
                    |  Poll Relay   |  <-- centrifugo --mode=shared_poll_relay
                    +-------+-------+
                            |
                            | serves cached data (same protocol)
                    +-------+-------+
              +-----v-----+ +------v----+
              | Centrifugo | | Centrifugo |
              |   node 1   | |   node 2  |
              +------------+ +-----------+
```

Benefits:

- **Reduces backend load** — backend is called once per refresh cycle, not once per node
- **Provides `prev_data` for delta compression** — the relay maintains version history and returns the previous data for each item, enabling fossil deltas without backend changes
- **Same protocol** — the relay speaks the standard `SharedPollRefresh` proxy protocol

The relay works with all refresh modes. In `versionless` mode, the relay detects changes via content hash (same as nodes do without relay) and provides centralized polling and cold key read-through. In `versioned` mode, the relay passes backend versions through.

### Configuration

The relay uses the same config file as regular Centrifugo nodes. All shared poll relay settings are in the `shared_poll_relay` section:

```json title="config.json"
{
  "channel": {
    "proxy": {
      "shared_poll_refresh": {
        "endpoint": "http://localhost:3001/centrifugo/refresh",
        "timeout": "5s"
      }
    },
    "namespaces": [
      {
        "name": "post_votes",
        "subscription_type": "shared_poll",
        "shared_poll": {
          "refresh_interval": "1s",
          "refresh_batch_size": 1000,
          "keep_latest_data": true
        },
        "allowed_delta_types": ["fossil"],
        "allow_subscribe_for_client": true
      }
    ]
  },
  "shared_poll_relay": {
    "enabled": true,
    "endpoint": "http://localhost:9090",
    "http_server": {
      "enabled": true,
      "port": 9090
    },
    "grpc_server": {
      "enabled": false
    }
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | When `true`, normal nodes redirect shared poll refresh requests to the relay endpoint |
| `endpoint` | string | | Relay address used by normal nodes (e.g. `"http://localhost:9090"` or `"grpc://localhost:9091"`) |
| `http_server.enabled` | boolean | `false` | Enable the HTTP server on the relay process |
| `http_server.address` | string | `""` | Interface to bind the HTTP server to |
| `http_server.port` | integer | `9090` | HTTP server port |
| `grpc_server.enabled` | boolean | `false` | Enable the gRPC server on the relay process |
| `grpc_server.address` | string | `""` | Interface to bind the gRPC server to |
| `grpc_server.port` | integer | `9091` | gRPC server port |
| `history_size` | integer | `3` | Number of version history entries per item (for `prev_data` computation) |
| `item_ttl` | [duration](../server/configuration.md#duration-type) | `"90s"` | How long to keep items not requested by any node |
| `notification` | object | | [Notification fast path](#notification-fast-path) config for the relay process (same options as `shared_poll.notification`) |

### Running the relay

Start the relay process with the `--mode` flag:

```bash
centrifugo --config config.json --mode=shared_poll_relay
```

The relay reads `channel.proxy.shared_poll_refresh` (or named proxies via `proxy_name`) to find the backend endpoint, and starts polling on the schedule defined in namespace config.

Start normal nodes with the same config:

```bash
centrifugo --config config.json
```

When `shared_poll_relay.enabled` is `true`, normal nodes automatically redirect all shared poll refresh requests to the relay endpoint instead of calling the backend directly. The relay server takes backend addresses from existing Centrifugo refresh proxy configuration – so you only need to set `shared_poll_relay` section.

### How it works

1. The relay process discovers all `shared_poll` namespaces from the config
2. It creates backend proxy connections using the configured `proxy_name` or default proxy
3. As nodes make refresh requests, the relay tracks which items are being requested
4. The relay polls the backend on the configured `refresh_interval` with all tracked items
5. It caches item data with a version history ring buffer (`history_size` entries)
6. When nodes request a refresh, the relay returns cached data with `prev_data` from the version history
7. Items not requested by any node for `item_ttl` are cleaned up
8. For newly tracked keys not yet in the relay cache, the relay fetches data from the backend synchronously — nodes receive data on their first request rather than waiting for the next poll cycle

When [notification fast path](#notification-fast-path) is enabled on the relay, the relay also subscribes to the notification channel and triggers immediate backend polls for notified keys — bypassing the timer interval. After polling, it publishes a ready signal so normal nodes know fresh data is available.


## Adaptive backpressure

When a refresh cycle takes longer than the configured `refresh_interval`, backpressure automatically extends the interval to prevent overloading your backend. Enable it by setting `backpressure_max_interval` in the namespace's `shared_poll` config:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "post_votes",
        "subscription_type": "shared_poll",
        "shared_poll": {
          "refresh_interval": "1s",
          "backpressure_max_interval": "10s"
        },
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `backpressure_max_interval` | [duration](../server/configuration.md#duration-type) | `"0s"` | Maximum refresh interval under backpressure. When set to a value greater than `0`, adaptive backpressure is enabled |

When enabled, the refresh interval dynamically adjusts based on the actual work time of the previous cycle. Since Centrifugo [spreads batch dispatches](../server/shared_poll.md#how-it-works) evenly over the refresh interval, backpressure measures only the backend call time (excluding spread delays) to accurately assess backend load.

### How backpressure works

Backpressure computes **utilization** as the ratio of work time to the current effective interval, then adjusts:

- **Utilization < 50%** — healthy. The effective interval recovers toward the configured value (×0.75 per cycle)
- **Utilization 50–100%** — stretching. The interval increases proportionally to the load
- **Utilization > 100%** — falling behind. The interval doubles (up to `backpressure_max_interval`)

```
Example: interval=1s, 10 batches, dispatch delay=100ms between batches

── Healthy backend (10ms/batch) ──────────────────────────────

 t=0    100   200   300   400   500   600   700   800   900
 ├──────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
 │▓│    │▓│   │▓│   │▓│   │▓│   │▓│   │▓│   │▓│   │▓│   │▓│
 b0     b1    b2    b3    b4    b5    b6    b7    b8    b9

 wall time ≈ 910ms, spread delay = 900ms
 work time = 910 - 900 = 10ms
 utilization = 10ms / 1s = 1%  →  healthy, no adjustment


── Slow backend (500ms/batch) ────────────────────────────────

 t=0    100   200   300   400   500   600   700   800   900  1400
 ├──────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼────┤
 │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│                                │
 │      │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│                          │
 │      │     │  ...concurrent batches...                      │
 │      │     │     │     │     │     │     │     │▓▓▓▓▓▓▓▓▓▓▓▓│

 wall time ≈ 1400ms, spread delay = 900ms
 work time = 500ms
 utilization = 500ms / 1s = 50%  →  borderline, slight increase


── Overloaded backend (2s/batch) ─────────────────────────────

 t=0    100        900                                    2900
 ├──────┼── ... ───┼──────────────────────────────────────┤
 │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│          │
 │      │  ...                                             │
 │      │          │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│

 wall time ≈ 2900ms, spread delay = 900ms
 work time = 2000ms
 utilization = 2000ms / 1s = 200%  →  falling behind, interval doubles
```

When the backend recovers, the effective interval gradually shrinks back to the configured value.
