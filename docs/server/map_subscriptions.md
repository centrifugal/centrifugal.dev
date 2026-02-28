---
id: map_subscriptions
title: Map subscriptions ✨
---

:::caution Experimental

Map subscriptions is an experimental feature. All its parts - configuration options, client SDK API, server API - may change in future releases based on user feedback. At this point only `centrifuge-js` SDK supports map subscriptions on the client side.

:::

Map subscriptions enable real-time **data synchronization** of keyed state over channels. Instead of a traditional append-only publication stream, channels with map subscriptions maintain a **key-value state** where each entry can be independently published, updated, or removed — and all changes are automatically synchronized to subscribed clients.

Typical use cases:

- **Cursor positions** — each user publishes their cursor; key = client/user ID, value = coordinates
- **Live scoreboards** — each player has a row; updates replace previous state
- **Collaborative state** — shared documents, whiteboards, inventories with per-object entries
- **Presence-like features** — who's online, with typed structured data per participant
- **Persistent state sync** — sync your persistent state with tight PostgreSQL integration, using transactional publishing within your application's database transactions

## Design overview

Traditional Centrifugo channels deliver an ordered stream of publications. Map channels add a **data synchronization layer**: a set of key-value entries that clients can query, paginate, and receive incremental updates for.

### Subscription types

When a client subscribes to a channel, it can now specify a subscription type:

| Type | Description |
|------|-------------|
| `stream` | Traditional PUB/SUB with optional history stream (default type, Centrifugo always had it) |
| `map` | Map subscription — keyed state with real-time updates |
| `map_clients` | Presence subscription — one entry per client connection |
| `map_users` | Presence subscription — one entry per user ID |

The `map_clients` and `map_users` types are automatically managed by the server for presence tracking. The `map` type is the general-purpose map subscription where the application controls keys and values. It's like real-time map which is synchronized to clients.

### Sync and retention modes

Each map namespace requires two mode settings: **sync mode** (how clients recover after reconnect) and **retention mode** (how long entries live).

| | **Expiring** retention | **Permanent** retention |
|---|---|---|
| **Ephemeral** sync | Entries auto-expire after TTL. On reconnect — full state snapshot. No stream history kept. | Entries persist until removed. On reconnect — full state snapshot. No stream history kept. |
| **Converging** sync | Entries auto-expire after TTL. On reconnect — catch up from change stream (falls back to snapshot if too far behind). | Entries persist until removed. On reconnect — catch up from change stream (falls back to snapshot if too far behind). |

**Which combination to pick:**

| Use case | Sync mode | Retention mode | Why |
|----------|-----------|----------------|-----|
| Cursors, typing indicators | ephemeral | expiring | Positions are short-lived, no need for stream history |
| Presence, heartbeats | ephemeral | expiring | Entries should auto-disappear when stale |
| Scoreboards, leaderboards | converging | permanent | Data persists, clients recover missed updates efficiently |
| Inventories, collaborative docs | converging | permanent | Need durable state with efficient reconnect recovery |
| Time-limited polls, sessions | converging | expiring | Entries auto-expire, but clients still recover from stream |

### Client subscription protocol

When a client subscribes to a map channel, it goes through phases to build consistent state:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Map Subscription Lifecycle                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│        ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│        │    STATE    │────▶│    STREAM   │────▶│     LIVE    │       │
│        │    phase    │     │    phase    │     │    phase    │       │
│        └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                      │
│        STATE:   Paginate full key-value state from broker            │
│        STREAM:  Catch up on changes during state pagination          │
│                 (converging only)                                    │
│        LIVE:    Real-time PUB/SUB updates                            │
│                                                                      │
│        ────────────────────────────────────────────────────────      │
│                                                                      │
│        Ephemeral mode:   STATE ───────────────────────────▶ LIVE     │
│        Converging mode:  STATE ─────────▶ STREAM ─────────▶ LIVE     │
│                                                                      │
│        ────────────────────────────────────────────────────────      │
│                                                                      │
│        SDK events:                                                   │
│            ◀── sync (full state)                                     │
│            ◀── update (incremental)                                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

1. **State phase** — client paginates through the current key-value state from the broker
2. **Stream phase** — client catches up on changes that occurred during state pagination (converging mode only)
3. **Live phase** — client receives real-time updates via PUB/SUB

The SDK handles all phases transparently — the application receives `sync` (full state ready) and `update` (incremental change) events.

## Map brokers

Map subscriptions require a **map broker** — a backend that stores the keyed state and coordinates updates. Centrifugo supports three map broker types.

### Memory

In-memory storage. Single-node only. State is lost on restart.

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
    "type": "memory"
  }
}
```

Good for development and single-node setups.

### Redis

Redis-backed storage for distributed multi-node deployments. Uses atomic Lua scripts for all operations.

Redis Cluster is supported only with sharded PUB/SUB enabled, which is a [Centrifugo PRO](../pro/overview.md) feature. The open-source version works with a single Redis instance. Client-side consistent sharding across multiple standalone Redis nodes is still an option for OSS users.

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
    "type": "redis",
    "redis": {
      "address": "localhost:6379"
    }
  }
}
```

Key options:

| Option | Default | Description |
|--------|---------|-------------|
| `cleanup_interval` | `"1s"` | How often to remove expired entries. Set to `"-1"` to disable |
| `cleanup_batch_size` | `100` | Max entries processed per channel per cleanup cycle |
| `idempotent_result_ttl` | `"5m"` | TTL for idempotent operation result cache |

Redis map broker supports the same connection options as the Redis engine (address, cluster addresses, Sentinel, TLS, etc.).

:::caution Avoid Redis eviction policies with converging mode

When using converging sync mode, Redis must retain all stream data for recovery to work. If Redis evicts keys due to memory pressure, clients will be unable to catch up from the stream — making state convergence impossible. Configure Redis with `maxmemory-policy noeviction`, carefully monitor memory usage, and plan capacity accordingly.

:::

### PostgreSQL

PostgreSQL-backed storage for durable, persistent state. Centrifugo creates the required tables automatically on startup (unless `skip_schema_init` is set).

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:pass@localhost:5432/dbname?sslmode=disable"
    }
  }
}
```

Key options:

| Option | Default | Description |
|--------|---------|-------------|
| `dsn` | | PostgreSQL connection string (required) |
| `pool_size` | `32` | Maximum connection pool size |
| `num_shards` | `16` | Number of delivery worker shards. Use the default for now — more guidance will be provided later |
| `ttl_check_interval` | `"1s"` | How often to check for expired keys |
| `cleanup_interval` | `"1m"` | How often to clean up expired stream/meta entries |
| `idempotent_result_ttl` | `"5m"` | TTL for idempotency results |
| `binary_data` | `false` | Use BYTEA instead of JSONB for data columns |
| `stream_retention` | `"24h"` | How long stream entries are kept |
| `use_notify` | `false` | Enable LISTEN/NOTIFY for low-latency delivery |
| `skip_schema_init` | `false` | Skip automatic table creation on startup |

[Centrifugo PRO](../pro/overview.md) extends the PostgreSQL map broker with read replica support for distributing read load, and broker fan-out — the ability to delegate PUB/SUB delivery to Redis or NATS instead of having every node poll PostgreSQL independently. Broker fan-out is important for improving performance in large Centrifugo clusters. See [Map subscriptions enhancements](../pro/map_subscriptions.md) for details.

#### Transactional publishing

A unique advantage of the PostgreSQL map broker is that your application can call Centrifugo's SQL functions directly within your own database transactions. This guarantees atomicity — the map state update and your business logic commit or rollback together.

Centrifugo automatically creates these SQL functions when the PostgreSQL map broker initializes the schema:

| Function | Description |
|----------|-------------|
| `cf_map_publish(...)` | Publish or update a key. Returns `suppressed`/`suppress_reason` for conditional checks |
| `cf_map_publish_strict(...)` | Same as `cf_map_publish`, but raises a PostgreSQL exception on suppression (e.g. CAS conflict, key exists) instead of returning a flag |
| `cf_map_remove(...)` | Remove a key. Returns `suppressed`/`suppress_reason` |
| `cf_map_remove_strict(...)` | Same as `cf_map_remove`, but raises an exception if the key is not found |

:::note

`cf_map_expire_keys` function is also created but is for Centrifugo internal use only — do not call it from application code.

:::

When `binary_data` option is enabled, the schema uses BYTEA columns instead of JSONB for data fields, and all tables and functions use the `cf_binary_map_` prefix (e.g. `cf_binary_map_publish`, `cf_binary_map_state`). This is useful when data payloads are not valid JSON (e.g. Protobuf-encoded).

Common parameters for `cf_map_publish`:

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_channel` | `TEXT` | Channel name (required) |
| `p_key` | `TEXT` | Entry key (required) |
| `p_data` | `JSONB` | Entry data (required) |
| `p_score` | `BIGINT` | Sort score for ordered maps |
| `p_key_mode` | `TEXT` | `'if_new'` (insert only) or `'if_exists'` (update only) |
| `p_key_ttl` | `INTERVAL` | Per-key TTL |
| `p_meta_ttl` | `INTERVAL` | Channel metadata TTL |

The function returns a row with `channel_offset`, `epoch`, `suppressed`, and `suppress_reason` fields.

**Example** — recording a vote atomically (dedup + score increment in one transaction):

```sql
BEGIN;
  -- 1. Dedup: only allow one vote per user per option.
  SELECT * FROM cf_map_publish(
    p_channel := 'poll:votes',
    p_key     := 'poll1:opt_0:user42',
    p_data    := '{"voted": true}'::jsonb,
    p_key_mode := 'if_new'
  );
  -- Check suppressed = true → user already voted, ROLLBACK.

  -- 2. Increment option score (read current, then publish updated).
  SELECT * FROM cf_map_publish(
    p_channel := 'poll:results',
    p_key     := 'poll1_opt_0',
    p_data    := (SELECT data FROM cf_map_state WHERE channel = 'poll:results' AND key = 'poll1_opt_0'),
    p_score   := (SELECT score + 1 FROM cf_map_state WHERE channel = 'poll:results' AND key = 'poll1_opt_0')
  );
COMMIT;
```

Centrifugo's outbox worker picks up new stream entries and delivers them to subscribers. This pattern eliminates the dual-write problem: instead of publishing to Centrifugo and updating your database separately (risking inconsistency), both happen in a single transaction.

## Channel namespace configuration

Map subscriptions are configured per channel namespace. A namespace must declare which subscription types it supports.

All subscribers to the same channel must use the same subscription type. A single channel cannot have some subscribers using `stream` and others using `map` — the subscription type is a property of the channel (determined by namespace configuration), not of individual subscribers.

### Minimal example

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
    "type": "memory"
  },
  "channel": {
    "namespaces": [
      {
        "name": "cursors",
        "subscription_types": ["map"],
        "map_sync_mode": "ephemeral",
        "map_retention_mode": "expiring",
        "map_key_ttl": "60s",
        "publication_data_format": "json_object",
        "allow_subscribe_for_client": true,
        "allow_map_publish_for_subscriber": true,
        "map_client_key": "client_id"
      }
    ]
  }
}
```

:::note
When allowing direct client publishing, use [`publication_data_format`](channels.md#publication_data_format) set to `"json_object"` to enforce that data payloads are valid JSON objects. This provides lightweight server-side validation without requiring a proxy roundtrip — important for high-frequency updates like cursor positions. For stricter validation (checking specific fields, value ranges, etc.), use a [map publish proxy](#map-publishremove-proxy).
:::

### Namespace options

#### Subscription types

```json
"subscription_types": ["map"]
```

Declares that the namespace supports map subscriptions. A namespace can support multiple types simultaneously:

```json
"subscription_types": ["map", "map_clients", "map_users"]
```

#### Sync and retention

| Option | Values | Description |
|--------|--------|-------------|
| `map_sync_mode` | `"ephemeral"`, `"converging"` | Required when using map types |
| `map_retention_mode` | `"expiring"`, `"permanent"` | Required when using map types |
| `map_key_ttl` | duration string | Required for `"expiring"` retention |
| `map_ordered` | `true`/`false` | Enable score-based ordering of entries |
| `map_stream_size` | integer | Max stream entries (auto-derived for converging: 100) |
| `map_stream_ttl` | duration string | Stream entry retention (auto-derived for converging: "1m") |
| `map_meta_ttl` | duration string | Metadata retention (auto-derived) |

#### Map publish permissions

| Option | Description |
|--------|-------------|
| `allow_map_publish_for_client` | Authenticated clients can map-publish to channels in this namespace |
| `allow_map_publish_for_subscriber` | Clients subscribed to the channel can map-publish |
| `allow_map_publish_for_anonymous` | Anonymous clients can map-publish (requires one of the above) |
| `map_publish_proxy_enabled` | Route map publish through a proxy |
| `map_publish_proxy_name` | Name of the proxy to use (default: `"default"`) |

#### Map remove permissions

| Option | Description |
|--------|-------------|
| `allow_map_remove_for_client` | Authenticated clients can map-remove from channels in this namespace |
| `allow_map_remove_for_subscriber` | Clients subscribed to the channel can map-remove |
| `allow_map_remove_for_anonymous` | Anonymous clients can map-remove (requires one of the above) |
| `map_remove_proxy_enabled` | Route map remove through a proxy |
| `map_remove_proxy_name` | Name of the proxy to use (default: `"default"`) |

#### Server-driven key assignment

```json
"map_client_key": "client_id"
```

| Value | Behavior |
|-------|----------|
| `""` (empty/default) | Client-provided key is used as-is |
| `"client_id"` | Key is overridden with the client's connection ID |
| `"user_id"` | Key is overridden with the client's user ID |

This applies to both map publish and map remove operations. When set, the client-provided key is ignored.

#### Automatic cleanup on unsubscribe

```json
"map_remove_on_unsubscribe": true
```

When a client unsubscribes or disconnects, the entry with key = client ID is automatically removed. Useful for cursor-like scenarios.

#### Presence namespaces

Map subscriptions can automatically track client and user presence in separate namespaces. Each subscription type (`map`, `map_clients`, `map_users`) lives in its own namespace — you need to define all three:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "game",
        "subscription_types": ["map"],
        "map_sync_mode": "ephemeral",
        "map_retention_mode": "expiring",
        "map_key_ttl": "60s",
        "map_client_presence_namespace": "clients",
        "map_user_presence_namespace": "users",
        "allow_subscribe_for_client": true
      },
      {
        "name": "clients",
        "subscription_types": ["map_clients"],
        "map_sync_mode": "ephemeral",
        "map_retention_mode": "expiring",
        "map_key_ttl": "60s",
        "allow_subscribe_for_client": true
      },
      {
        "name": "users",
        "subscription_types": ["map_users"],
        "map_sync_mode": "ephemeral",
        "map_retention_mode": "expiring",
        "map_key_ttl": "60s",
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

When a client subscribes to `game:abc`:
- An entry with key = client ID is automatically published to `clients:abc` (client presence)
- An entry with key = user ID is automatically published to `users:abc` (user presence)

The client can then separately subscribe to `clients:abc` or `users:abc` to track presence for that game channel.

### Map publish/remove proxy

When `map_publish_proxy_enabled` or `map_remove_proxy_enabled` is set, the operation is forwarded to your application backend before execution. The proxy can:

- Allow or deny the operation
- Validate that the client has permission to publish/remove for the specific key
- Override the key
- Override the data (for map publish)

```json title="config.json"
{
  "proxies": [
    {
      "name": "backend",
      "endpoint": "http://localhost:3001",
      "timeout": "3s"
    }
  ],
  "channel": {
    "namespaces": [
      {
        "name": "game",
        "subscription_types": ["map"],
        "map_sync_mode": "converging",
        "map_retention_mode": "permanent",
        "allow_subscribe_for_client": true,
        "map_publish_proxy_enabled": true,
        "map_publish_proxy_name": "backend"
      }
    ]
  }
}
```

The proxy receives a request with `user`, `channel`, `key`, and `data` fields. It returns a response that can contain:

- `error` — reject the operation with an error
- `disconnect` — disconnect the client
- `result.key` — override the key
- `result.data` — override the data

When the proxy returns a successful result, Centrifugo executes the map publish on the broker and returns the result to the client. If the proxy is configured, the permission flags (`allow_map_publish_for_*`) are not checked — the proxy is fully responsible for authorization.

## Client tuning

Several options in the `client` configuration section control map subscription behavior:

| Option | Default | Description |
|--------|---------|-------------|
| `map_pagination_min_limit` | `100` | Minimum entries per page for state/stream pagination |
| `map_pagination_max_limit` | `1000` | Maximum entries per page for state/stream pagination |
| `map_live_transition_max_publication_limit` | `300` | Max stream publications to recover during live transition (0 = no limit) |
| `map_subscribe_catch_up_timeout` | `"5s"` | Max time for state/stream catch-up before disconnecting |

## Server API

Centrifugo provides six API methods for map operations, available via both HTTP and gRPC:

### map_publish

Publish or update a key in a map channel.

```bash
curl -X POST http://localhost:8000/api/map_publish \
  -H "Authorization: apikey YOUR_KEY" \
  -d '{"channel": "scoreboard:main", "key": "player1", "data": {"score": 100}}'
```

Options:
- `key_mode` — `"if_new"` (only if key doesn't exist) or `"if_exists"` (only if key exists)
- `idempotency_key` — duplicate detection key
- `tags` — key-value metadata for filtering
- `version` / `version_epoch` — per-key version for ordering
- `score` — sort value for ordered state
- `delta` — enable delta compression
- `stream_data` — separate data for the stream (when state and stream payloads differ)

### map_remove

Remove a key from a map channel.

```bash
curl -X POST http://localhost:8000/api/map_remove \
  -H "Authorization: apikey YOUR_KEY" \
  -d '{"channel": "scoreboard:main", "key": "player1"}'
```

### map_read_state

Read the current state with optional pagination.

```bash
curl -X POST http://localhost:8000/api/map_read_state \
  -H "Authorization: apikey YOUR_KEY" \
  -d '{"channel": "scoreboard:main", "limit": 100}'
```

Options: `cursor` (pagination), `limit`, `key` (filter to single key), `asc` (ascending sort for ordered state).

### map_read_stream

Read the change stream (history).

```bash
curl -X POST http://localhost:8000/api/map_read_stream \
  -H "Authorization: apikey YOUR_KEY" \
  -d '{"channel": "scoreboard:main", "limit": 100}'
```

Options: `since_offset` / `since_epoch` (read from position), `limit`, `reverse`.

### map_stats

Get statistics about a map channel.

```bash
curl -X POST http://localhost:8000/api/map_stats \
  -H "Authorization: apikey YOUR_KEY" \
  -d '{"channel": "scoreboard:main"}'
```

Returns `num_keys` — the number of entries in the channel's state.

### map_clear

Clear all state and stream data for a channel.

```bash
curl -X POST http://localhost:8000/api/map_clear \
  -H "Authorization: apikey YOUR_KEY" \
  -d '{"channel": "scoreboard:main"}'
```

## Client SDK API

:::info

At this point only `centrifuge-js` SDK supports map subscriptions. Support for other SDKs is planned.

:::

### Creating a map subscription

Use `newMapSubscription` instead of `newSubscription`:

```javascript
const sub = client.newMapSubscription('cursors:room1', {
  limit: 100,             // Page size for state/stream pagination
});
```

### Events

Map subscriptions emit two high-level events for state management:

**`sync`** — emitted when the complete state is available (initial subscribe or full resync):

```javascript
sub.on('sync', (ctx) => {
  // ctx.entries is the full state (array of { key, data, removed, score })
  renderFullState(ctx.entries);
});
```

**`update`** — emitted when a single entry changes:

```javascript
sub.on('update', (ctx) => {
  // ctx.key, ctx.data, ctx.removed, ctx.score
  if (ctx.removed) {
    removeEntry(ctx.key);
  } else {
    upsertEntry(ctx.key, ctx.data);
  }
});
```

The `sync`/`update` pair provides a simplified state management model — there is no need to handle recovery flags or stream positions manually. Under the hood, the SDK manages state automatically: on initial subscribe it builds state from paginated reads, and on reconnect it attempts to catch up from the change stream (converging mode). If catch-up is not possible (e.g. too many changes accumulated), the SDK transparently falls back to a full state re-sync from the broker — the application simply receives another `sync` event with the complete state.

Standard subscription events (`publication`, `subscribing`, `subscribed`, `unsubscribed`, `error`) also work on map subscriptions.

### Publishing

```javascript
// Publish to a key (key may be empty if server assigns it via map_client_key)
await sub.mapPublish('mykey', { x: 100, y: 200 });

// Remove a key
await sub.mapRemove('mykey');
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `limit` | `100` | Page size for state/stream pagination |
| `unrecoverableStrategy` | `"from_scratch"` | `"from_scratch"` or `"fatal"` — handle unrecoverable position errors |
| `delta` | | Set to `"fossil"` to enable delta compression (applied per-key — deltas are computed between successive values of the same key, not across the entire map) |

## Examples

### Cursor tracking

A common pattern: each user publishes their cursor position, the server assigns the key to the client ID, and positions auto-expire after 60 seconds.

Server configuration:

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
    "type": "memory"
  },
  "channel": {
    "namespaces": [
      {
        "name": "cursors",
        "subscription_types": ["map"],
        "map_sync_mode": "ephemeral",
        "map_retention_mode": "expiring",
        "map_key_ttl": "60s",
        "publication_data_format": "json_object",
        "map_remove_on_unsubscribe": true,
        "allow_subscribe_for_client": true,
        "allow_map_publish_for_subscriber": true,
        "map_client_key": "client_id"
      }
    ]
  }
}
```

Client code:

```javascript
const sub = client.newMapSubscription('cursors:room1');

const cursors = new Map();

sub.on('sync', (ctx) => {
  cursors.clear();
  for (const entry of ctx.entries) {
    cursors.set(entry.key, entry.data);
  }
  renderAll(cursors);
});

sub.on('update', (ctx) => {
  if (ctx.removed) {
    cursors.delete(ctx.key);
  } else {
    cursors.set(ctx.key, ctx.data);
  }
  renderAll(cursors);
});

sub.subscribe();

// Publish cursor position (key is auto-assigned to client ID by server)
document.addEventListener('mousemove', throttle((e) => {
  sub.mapPublish('', { x: e.clientX, y: e.clientY });
}, 50));
```

### Persistent scoreboard

A scoreboard with ordered entries, server-side publishing, and converging sync mode for recovery support.

Server configuration:

```json title="config.json"
{
  "map_broker": {
    "enabled": true,
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:pass@localhost:5432/app?sslmode=disable"
    }
  },
  "channel": {
    "namespaces": [
      {
        "name": "scoreboard",
        "subscription_types": ["map"],
        "map_sync_mode": "converging",
        "map_retention_mode": "permanent",
        "map_ordered": true,
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

Publishing from your backend (via server API):

```bash
curl -X POST http://localhost:8000/api/map_publish \
  -H "Authorization: apikey YOUR_KEY" \
  -d '{
    "channel": "scoreboard:main",
    "key": "player1",
    "data": {"name": "Alice", "score": 1500},
    "score": 1500
  }'
```

Client code:

```javascript
const sub = client.newMapSubscription('scoreboard:main', {
  limit: 50,
});

sub.on('sync', (ctx) => {
  // entries are ordered by score (descending by default)
  renderLeaderboard(ctx.entries);
});

sub.on('update', (ctx) => {
  updateLeaderboardEntry(ctx.key, ctx.data, ctx.score, ctx.removed);
});

sub.subscribe();
```
