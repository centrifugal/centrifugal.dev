---
id: map_subscriptions
title: "Data sync: Map subscriptions 🔮"
sidebar_label: "Data sync: Map subscriptions 🔮"
---

:::caution Experimental

Map subscriptions is an experimental feature. All its parts - configuration options, client SDK API, server API - may change in future releases based on user feedback. At this point only `centrifuge-js` SDK supports map subscriptions on the client side.

:::

Map subscriptions enable real-time **data synchronization** of keyed state over channels. Instead of a traditional append-only publication stream, channels with map subscriptions maintain a **key-value state** where each entry can be independently published, updated, or removed — and all changes are automatically synchronized to subscribed clients.

Typical use cases:

- **Cursor positions** — each user publishes their cursor; key = client/user ID, value = coordinates
- **Collaborative state** — shared documents, whiteboards, inventories with per-object entries
- **Persistent state sync** — sync your persistent state with tight PostgreSQL integration, using transactional publishing within your application's database transactions

A standout capability of map subscriptions is the **PostgreSQL map broker** with **transactional publishing**. It lets you update real-time state and execute business logic in a single database transaction — eliminating the [dual-write problem](https://thorben-janssen.com/dual-writes/) entirely. Your application calls Centrifugo's SQL functions inside its own `BEGIN`/`COMMIT` block, so the real-time state pushed to client UIs and your database state are always atomically consistent. If the transaction rolls back, the real-time update never happened. This is a unique property for a real-time messaging system — see [PostgreSQL map broker](#postgresql) and [Transactional publishing](#transactional-publishing) sections below for details.

import PgTransactionalDiagram from '@site/src/components/PgTransactionalDiagram';

<PgTransactionalDiagram />

Map subscriptions also introduce a **built-in map presence** mechanism (`map_clients` and `map_users` subscription types) that improves on the traditional Centrifugo presence — it uses the same sync model with paginated state, so clients reliably recover presence after reconnects even in channels with many participants.

## When to use map vs stream subscriptions

The core difference: a **stream subscription** gives each client an ordered sequence of events on a channel, while a **map subscription** gives each client a synchronized **collection of keyed entries** — a live key-value state that Centrifugo keeps synchronized across all subscribers.

| You need… | Use |
|---|---|
| Ordered events (chat, notifications, activity feeds) | Stream subscription |
| Latest value of a single thing (e.g. with [cache recovery](/docs/server/cache_recovery)) | Stream subscription + cache recovery |
| A keyed collection of entries synced to clients (cursors, polls, presence) | Map subscription (in-memory or Redis) |
| Database-consistent state pushed to UIs | Map subscription + PostgreSQL (or Redis for softer durability) |

Without map subscriptions, synchronizing a keyed collection typically means fetching initial state via REST, applying stream updates, and handling race conditions between the two — map subscriptions handle all of this internally.

- **Transient shared state** — cursor positions, typing indicators, live poll results. Centrifugo holds the state for you (in memory or Redis) with automatic expiration. Your backend doesn't need to store or serve it.

- **Persistent state** — scoreboards, inventories, collaborative documents. With the PostgreSQL map broker you update the real-time map and your business data in a single database transaction, eliminating the [dual-write problem](https://thorben-janssen.com/dual-writes/). Redis can also be used when you want durability without transactional guarantees.

## Design overview

Map channels add a **data synchronization layer** on top of regular channels: a set of key-value entries that clients can query, paginate, and receive incremental updates for.

### Client subscription protocol

When a client subscribes to a map channel, it goes through phases to build consistent state:

import MapSubscriptionDiagram from '@site/src/components/MapSubscriptionDiagram';

<MapSubscriptionDiagram />

1. **State phase** — client paginates through the current key-value state from the broker
2. **Stream phase** — client catches up on changes that occurred during state pagination (durable/persistent modes only)
3. **Live phase** — client receives real-time updates via PUB/SUB

The SDK handles all phases transparently — the application receives `sync` (full state ready) and `update` (incremental change) events.

### Subscription types

Each namespace must declare which subscription type it supports. The client specifies the matching type when subscribing:

| Type | Description |
|------|-------------|
| `stream` | Traditional PUB/SUB with optional history stream, automatic recovery from stream, and cache recovery mode (default type, Centrifugo always had it) |
| `map` | Map subscription — keyed state with real-time updates, configurable sync and retention via mode (ephemeral/durable/persistent) with stream-based catch-up in durable/persistent modes, per-key TTL support, and paginated state sync protocol |
| `map_clients` | A special type of map subscription for presence — one entry per client connection, automatically managed by the server. Both joins and leaves are delivered immediately. The system is eventually consistent: if a remove operation to the broker fails (e.g. due to a transient network error), the stale entry will expire after `map.key_ttl` (60s by default) rather than lingering indefinitely |
| `map_users` | A special type of map subscription for presence — one entry per user ID, automatically managed by the server. New users appear immediately, but removals are driven by key TTL — so a disconnected user's entry remains in the state for up to `map.key_ttl` (60s by default) |

The `map_clients` and `map_users` types are automatically managed by the server for presence tracking. The `map` type is the general-purpose map subscription where the application controls keys and values. It's like real-time map which is synchronized to clients.

### Map modes

Each map namespace requires a **mode** setting that determines the synchronization and retention behavior:

| Mode | Sync | Retention | Description |
|------|------|-----------|-------------|
| `ephemeral` | Snapshot on reconnect | Entries auto-expire after `key_ttl` | No stream history is kept. On reconnect the client receives a full state snapshot. Best for high-frequency, short-lived data. |
| `durable` | Stream-based catch-up | Entries auto-expire after `key_ttl` | A change stream is maintained. On reconnect the client catches up from the stream (falls back to snapshot if too far behind). Best for data that auto-expires but needs efficient recovery. |
| `persistent` | Stream-based catch-up | Entries persist until explicitly removed | Same stream-based catch-up as `durable`, but entries live forever until removed. Best for permanent state. |

**Which mode to pick:**

| Use case | Mode | Why |
|----------|------|-----|
| Cursors, typing indicators | `ephemeral` | Positions are short-lived, no need for stream history |
| Presence, heartbeats | `ephemeral` | Entries should auto-disappear when stale |
| Time-limited polls, sessions | `durable` | Entries auto-expire, but clients still recover from stream |
| Scoreboards, leaderboards | `persistent` | Data persists, clients recover missed updates efficiently |
| Inventories, collaborative docs | `persistent` | Need permanent state with efficient reconnect recovery |

### External state

By default, the map broker manages both the key-value **state** and the **change stream**. With **external state** mode, the broker manages only the stream and PUB/SUB — your application's database is the single source of truth for state.

**When to use it:** your data already lives in an application database (project boards, order lists, product catalogs) and you don't want to duplicate it into a broker-managed state table. Clients load the initial snapshot from your HTTP API, then receive live updates over WebSocket.

**How it works:**

1. The SDK calls a `getState` callback you provide — typically an HTTP fetch to your backend that queries the app DB.
2. Your backend returns the current entries **plus** the broker's stream position (`offset` and `epoch`). The position must be captured **before** reading state — this ensures the stream covers all mutations during and after the state read.
3. The SDK opens a WebSocket subscription starting from that position, catches up on any changes that occurred during the HTTP call, and transitions to live mode.

Duplicates (an entry present in both the state snapshot and the stream) are resolved by key — the latest value wins.

**Configuration:**

External state requires `persistent` mode and is enabled per namespace:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "boards",
        "subscription_type": "map",
        "map": {
          "mode": "persistent",
          "external_state": true
        },
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

**Constraints:**

- Requires `mode: "persistent"` — ephemeral and durable modes are not supported
- No delta compression — the broker does not store previous values, so it cannot compute deltas
- No CAS (compare-and-swap) — the broker has no state to compare against
- No key TTL — entry lifecycle is managed by your application
- No ordered mode — score-based ordering is not supported

**Comparison with regular map mode:**

| | Broker-managed state | External state |
|---|---|---|
| State storage | Broker (Redis/PG/memory) | App database |
| State duplication | Yes — data in both app DB and broker | None — app DB only |
| Initial state load | SDK paginates from broker via WebSocket | SDK calls `getState` (your HTTP endpoint) |
| Stream + PUB/SUB | Broker-managed | Broker-managed |
| Delta compression | Supported | Not supported |
| CAS / key modes | Supported | Not supported |
| Key TTL | Supported | Not supported (app manages lifecycle) |
| Ordered mode | Supported | Not supported |
| Bootstrap problem | First subscriber may see empty state until populated | None — state comes from app DB directly |

How to capture the stream position and publish mutations depends on which broker you use — see the broker-specific sections below for details ([PostgreSQL](#stream-only-functions-external-state), [Redis / Memory](#redis)).

## Map brokers

Map subscriptions require a **map broker** — a backend that stores the keyed state and coordinates updates. By default Centrifugo uses an in-memory map broker. Centrifugo supports three map broker types.

[Centrifugo PRO](../pro/overview.md) allows configuring [different map brokers for different channel namespaces](../pro/map_subscriptions.md#per-namespace-map-brokers) — for example, ephemeral cursor data in Redis and persistent scoreboard state in PostgreSQL.

### Memory

In-memory storage. Single-node only. State is lost on restart (even when `persistent` mode is used).

```json title="config.json"
{
  "map_broker": {
    "type": "memory"
  }
}
```

Good for development and single-node setups. Memory is the default map broker type, so you don't need to configure it explicitly.

### Redis

Redis-backed storage for distributed multi-node deployments. Uses atomic Lua scripts for all operations.

Redis Cluster is supported only with sharded PUB/SUB enabled, which is a [Centrifugo PRO](../pro/overview.md) feature. The open-source version works with a single Redis instance. Client-side consistent sharding across multiple standalone Redis nodes is still an option for OSS users.

```json title="config.json"
{
  "map_broker": {
    "type": "redis",
    "redis": {
      "address": "localhost:6379"
    }
  }
}
```

Key options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cleanup_interval` | [duration](./configuration.md#duration-type) | `"1s"` | How often to remove expired entries. Set to `"-1"` to disable |
| `cleanup_batch_size` | integer | `100` | Max entries processed per channel per cleanup cycle |
| `idempotent_result_ttl` | [duration](./configuration.md#duration-type) | `"5m"` | TTL for idempotent operation result cache |

Redis map broker supports the same connection options as the Redis engine (address, cluster addresses, Sentinel, TLS, etc.).

When using [external state](#external-state) with Redis (or Memory) broker, your backend captures the stream position by calling the Centrifugo server API [`map_read_stream`](#map_read_stream) with `limit: 0` — this returns only the current offset and epoch without any stream entries:

```bash
curl -X POST http://localhost:8000/api/map_read_stream \
  -H "Authorization: apikey YOUR_KEY" \
  -d '{"channel": "boards:123", "limit": 0}'
```

Your backend calls this first, captures the returned offset/epoch, then reads the state from your own database.

:::caution Avoid Redis eviction policies with durable/persistent modes

When using `durable` or `persistent` mode, Redis must retain all stream data for recovery to work. If Redis evicts keys due to memory pressure, clients will be unable to catch up from the stream — making stream-based catch-up impossible. Configure Redis with `maxmemory-policy noeviction`, carefully monitor memory usage, and plan capacity accordingly.

:::

### PostgreSQL

PostgreSQL-backed storage for durable, persistent state. Centrifugo creates the required tables automatically on startup (unless `skip_schema_init` is set).

```json title="config.json"
{
  "map_broker": {
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:pass@localhost:5432/dbname?sslmode=disable"
    }
  }
}
```

Key options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dsn` | string | | PostgreSQL connection string (required) |
| `pool_size` | integer | `32` | Maximum connection pool size |
| `num_shards` | integer | `16` | Number of delivery worker shards. Use the default for now — more guidance will be provided later |
| `ttl_check_interval` | [duration](./configuration.md#duration-type) | `"1s"` | How often to check for expired keys |
| `cleanup_interval` | [duration](./configuration.md#duration-type) | `"1m"` | How often to clean up expired stream/meta entries |
| `idempotent_result_ttl` | [duration](./configuration.md#duration-type) | `"5m"` | TTL for idempotency results |
| `binary_data` | boolean | `false` | Use BYTEA instead of JSONB for data columns |
| `stream_retention` | [duration](./configuration.md#duration-type) | `"24h"` | How long stream entries are kept |
| `use_notify` | boolean | `false` | Enable LISTEN/NOTIFY for low-latency delivery |
| `skip_schema_init` | boolean | `false` | Skip automatic table creation on startup |

[Centrifugo PRO](../pro/overview.md) extends the PostgreSQL map broker with:

- [**In-memory cache layer**](../pro/map_subscriptions.md#in-memory-cache-layer) — keeps channel state in memory on each node, reducing backend reads and improving subscribe latency
- [**Read replicas**](../pro/map_subscriptions.md#read-replicas) — distributes read load across PostgreSQL replicas
- [**Broker fan-out**](../pro/map_subscriptions.md#broker-fan-out) — only one node per shard polls PostgreSQL, then publishes updates through Redis or NATS. Reduces PostgreSQL load proportionally to cluster size — essential for running many Centrifugo nodes

#### Transactional publishing

A unique advantage of the PostgreSQL map broker is that your application can call Centrifugo's SQL functions directly within your own database transactions. This guarantees atomicity — the map state update and your business logic commit or rollback together.

The architecture uses an **outbox pattern** — all writes go into PostgreSQL tables atomically, and Centrifugo's outbox workers pick up new entries and deliver them to clients:

import PgOutboxDiagram from '@site/src/components/PgOutboxDiagram';

<PgOutboxDiagram />

When your transaction commits, the state table (`cf_map_state`) and the stream/outbox table (`cf_map_stream`) are updated atomically. Centrifugo runs a pool of outbox workers (one per shard) that poll the stream table for new entries and deliver them to subscribed clients via WebSocket. When `use_notify` is enabled, PostgreSQL's `LISTEN/NOTIFY` wakes the workers immediately — otherwise they poll every 50ms. This eliminates the [dual-write problem](https://thorben-janssen.com/dual-writes/): if the transaction rolls back, no real-time update is ever sent.

Centrifugo automatically creates these SQL functions when the PostgreSQL map broker initializes the schema:

| Function | Description |
|----------|-------------|
| `cf_map_publish(...)` | Publish or update a key. Returns `suppressed`/`suppress_reason` for conditional checks |
| `cf_map_publish_strict(...)` | Same as `cf_map_publish`, but raises a PostgreSQL exception on suppression (e.g. CAS conflict, key exists) instead of returning a flag |
| `cf_map_remove(...)` | Remove a key. Returns `suppressed`/`suppress_reason` |
| `cf_map_remove_strict(...)` | Same as `cf_map_remove`, but raises an exception if the key is not found |
| `cf_map_publish_stream(...)` | Stream-only publish for [external state](#external-state) mode — writes to the stream and meta tables only, skips the state table entirely |
| `cf_map_remove_stream(...)` | Stream-only remove for [external state](#external-state) mode — writes a removal entry to the stream, skips the state table |
| `cf_map_stream_top_position(channel)` | Returns the current stream position (`top_offset`, `epoch`) for a channel — use in [external state](#external-state) to capture position before reading app state |

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

#### Stream-only functions (external state)

When using [external state mode](#external-state), your application manages state in its own database tables and only needs to write to the Centrifugo change stream. Use `cf_map_publish_stream` and `cf_map_remove_stream` instead of the regular `cf_map_publish` / `cf_map_remove` — they skip the `cf_map_state` table entirely and only write to `cf_map_stream` + `cf_map_meta`.

`cf_map_publish_stream` accepts the same parameters as `cf_map_publish` except for state-related ones (`p_score`, `p_key_mode`, `p_key_ttl`) which are not applicable. `cf_map_remove_stream` accepts the same parameters as `cf_map_remove`.

**Capturing the stream position** — use `cf_map_stream_top_position(channel)` to get the current `top_offset` and `epoch` for a channel. Your `getState` endpoint should call this **before** reading app state, within the same transaction:

```sql
BEGIN;
  -- 1. Capture stream position FIRST.
  SELECT * FROM cf_map_stream_top_position('boards:123');
  -- 2. Then read state from your app tables.
  SELECT item_id, data FROM board_items WHERE board_id = 123;
COMMIT;
```

The function always returns exactly one row — `(0, '')` if the channel has no stream yet.

**Publishing mutations** — update your app state and write to the Centrifugo stream in the same transaction:

```sql
BEGIN;
  -- 1. Update your application state.
  UPDATE board_items SET data = '{"text": "Updated card"}'::jsonb
  WHERE board_id = 123 AND item_id = 'card_42';

  -- 2. Write to Centrifugo stream (no state table interaction).
  SELECT * FROM cf_map_publish_stream(
    p_channel := 'boards:123',
    p_key     := 'card_42',
    p_data    := '{"text": "Updated card"}'::jsonb
  );
COMMIT;
```

If the transaction rolls back, neither the app state nor the stream entry is written — preserving atomicity. Centrifugo's outbox worker picks up the stream entry and delivers it to subscribers.

## Channel namespace configuration

Map subscriptions are configured per channel namespace. A namespace must declare which subscription types it supports.

All subscribers to the same channel must use the same subscription type. A single channel cannot have some subscribers using `stream` and others using `map` — the subscription type is a property of the channel (determined by namespace configuration), not of individual subscribers.

### Minimal example

```json title="config.json"
{
  "map_broker": {
    "type": "memory"
  },
  "channel": {
    "namespaces": [
      {
        "name": "cursors",
        "subscription_type": "map",
        "map": {
          "mode": "ephemeral",
          "key_ttl": "60s",
          "allow_publish_for_subscriber": true,
          "client_key": "client_id"
        },
        "publication_data_format": "json_object",
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

:::note
When allowing direct client publishing, use [`publication_data_format`](channels.md#publication_data_format) set to `"json_object"` to enforce that data payloads are valid JSON objects. This provides lightweight server-side validation without requiring a proxy roundtrip — important for high-frequency updates like cursor positions. For stricter validation (checking specific fields, value ranges, etc.), use a [map publish proxy](#map-publishremove-proxy).
:::

### Namespace options

#### Subscription type

```json
"subscription_type": "map"
```

Declares the subscription type for the namespace — one of the [supported types](#subscription-types). Each namespace supports exactly one type — use separate namespaces for presence tracking (see [Presence channels](#presence-channels)).

#### Mode

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `map.mode` | string | | `"ephemeral"`, `"durable"`, or `"persistent"`. Required when using map types |
| `map.key_ttl` | [duration](./configuration.md#duration-type) | | Required for `"ephemeral"` and `"durable"` modes |
| `map.ordered` | boolean | `false` | Enable score-based ordering of entries |
| `map.external_state` | boolean | `false` | Enable [external state mode](#external-state) — broker manages only the stream, app DB is the source of truth. Requires `persistent` mode. Incompatible with `ordered`, `key_ttl` |
| `map.stream_size` | integer | | Max stream entries (auto-derived for durable/persistent: 100) |
| `map.stream_ttl` | [duration](./configuration.md#duration-type) | | Stream entry retention (auto-derived for durable/persistent: "1m") |
| `map.meta_ttl` | [duration](./configuration.md#duration-type) | | Metadata retention (auto-derived) |

#### Map publish permissions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `map.allow_publish_for_client` | boolean | `false` | Authenticated clients can map-publish to channels in this namespace |
| `map.allow_publish_for_subscriber` | boolean | `false` | Clients subscribed to the channel can map-publish |
| `map.allow_publish_for_anonymous` | boolean | `false` | Anonymous clients can map-publish (requires one of the above) |
| `map.publish_proxy_enabled` | boolean | `false` | Route map publish through a proxy |
| `map.publish_proxy_name` | string | `"default"` | Name of the proxy to use |

#### Map remove permissions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `map.allow_remove_for_client` | boolean | `false` | Authenticated clients can map-remove from channels in this namespace |
| `map.allow_remove_for_subscriber` | boolean | `false` | Clients subscribed to the channel can map-remove |
| `map.allow_remove_for_anonymous` | boolean | `false` | Anonymous clients can map-remove (requires one of the above) |
| `map.remove_proxy_enabled` | boolean | `false` | Route map remove through a proxy |
| `map.remove_proxy_name` | string | `"default"` | Name of the proxy to use |

#### Server-driven key assignment

```json
"map": {
  "client_key": "client_id"
}
```

| Value | Behavior |
|-------|----------|
| `""` (empty/default) | Client-provided key is used as-is. In most cases you should validate it — enable `map.publish_proxy_enabled` to route through a [map publish proxy](#map-publishremove-proxy) |
| `"client_id"` | Key is overridden with the client's connection ID |
| `"user_id"` | Key is overridden with the client's user ID |

This applies to both map publish and map remove operations. When set, the client-provided key is ignored.

#### Automatic cleanup on unsubscribe

```json
"map": {
  "remove_client_on_unsubscribe": true
}
```

When a client unsubscribes or disconnects, the entry with key = client ID is automatically removed. Useful for cursor-like scenarios.

#### Presence channels

Subscriptions can automatically track client and user presence in separate map channels. The presence channel is constructed as `prefix + channel` — you configure a channel prefix that determines which namespace (or pattern) the presence data is published to. This works with any subscription type (stream, map, shared_poll):

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "game",
        "subscription_type": "map",
        "map_clients_presence_channel_prefix": "clients:",
        "map_users_presence_channel_prefix": "users:",
        "map": {
          "mode": "ephemeral",
          "key_ttl": "60s"
        },
        "allow_subscribe_for_client": true
      },
      {
        "name": "clients",
        "subscription_type": "map_clients",
        "map": {
          "mode": "ephemeral",
          "key_ttl": "60s"
        },
        "allow_subscribe_for_client": true
      },
      {
        "name": "users",
        "subscription_type": "map_users",
        "map": {
          "mode": "ephemeral",
          "key_ttl": "60s"
        },
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

When a client subscribes to `game:abc`:
- An entry with key = client ID is automatically published to `clients:game:abc` (client presence)
- An entry with key = user ID is automatically published to `users:game:abc` (user presence)

The client can then separately subscribe to `clients:game:abc` or `users:game:abc` to track presence for that game channel.

This also works with Centrifugo PRO channel patterns. For example, with prefix `"/clients"` and a pattern channel `/games/abc`, presence is published to `/clients/games/abc`.

### Map publish/remove proxy

When `map.publish_proxy_enabled` or `map.remove_proxy_enabled` is set, the operation is forwarded to your application backend before execution. The proxy can:

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
        "subscription_type": "map",
        "map": {
          "mode": "persistent",
          "publish_proxy_enabled": true,
          "publish_proxy_name": "backend"
        },
        "allow_subscribe_for_client": true
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

When the proxy returns a successful result, Centrifugo executes the map publish on the broker and returns the result to the client. If the proxy is configured, the permission flags (`map.allow_publish_for_*`) are not checked — the proxy is fully responsible for authorization.

## Pagination and catch-up tuning

The following options are configured per channel namespace inside the `map` block:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `default_page_size` | integer | `100` | Default entries per page when the client does not specify a page size |
| `min_page_size` | integer | `100` | Minimum entries per page for state/stream pagination |
| `max_page_size` | integer | `1000` | Maximum entries per page for state/stream pagination |
| `live_transition_max_publication_limit` | integer | `max_page_size` | Max stream publications to recover during live transition |
| `subscribe_catch_up_timeout` | [duration](./configuration.md#duration-type) | `"5s"` | Max time for state/stream catch-up before disconnecting |

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

:::note Pagination page sizes with Redis

When using the Redis map broker with **unordered** state (the default), pagination uses Redis `HSCAN` with `COUNT` as a hint. Redis may return more entries than the requested `limit` on some pages, especially for small hashes stored in listpack encoding. Do not rely on exact page sizes for unordered state reads. **Ordered** state (`ordered: true`) uses `ZRANGEBYSCORE` with `LIMIT` and returns exact page sizes.

:::

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

Unlike regular stream subscriptions, where the application must handle `publication` events and deal with recovery flags and stream positions, map subscriptions expose dedicated `sync` and `update` events. These events completely hide the recovery protocol inside the SDK — the application never needs to think about pagination, catch-up, or reconnect logic. It simply reacts to state snapshots and incremental changes.

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

Under the hood, the SDK manages state automatically: on initial subscribe it builds state from paginated reads, and on reconnect it attempts to catch up from the change stream (durable/persistent modes). If catch-up is not possible (e.g. too many changes accumulated), the SDK transparently falls back to a full state re-sync from the broker — the application simply receives another `sync` event with the complete state.

Standard subscription events (`publication`, `subscribing`, `subscribed`, `unsubscribed`, `error`) also work on map subscriptions.

### Publishing

```javascript
// Publish to a key (key may be empty if server assigns it via map.client_key)
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
| `getState` | | Callback for [external state mode](#external-state) — see below |

### External state (`getState` callback)

When the namespace has `external_state: true`, the SDK must load the initial state from your application instead of paginating it from the broker. Provide a `getState` callback that fetches the current entries and the broker's stream position:

```typescript
const sub = centrifuge.newMapSubscription('boards:123', {
  getState: async () => {
    const resp = await fetch('/api/boards/123/state');
    const data = await resp.json();
    // entries: array of { key, data } objects
    // offset, epoch: stream position from the broker
    return { entries: data.entries, offset: data.offset, epoch: data.epoch };
  }
});

sub.on('sync', (ctx) => {
  renderBoard(ctx.entries);
});

sub.on('update', (ctx) => {
  if (ctx.removed) {
    removeBoardItem(ctx.key);
  } else {
    upsertBoardItem(ctx.key, ctx.data);
  }
});

sub.subscribe();
```

The callback must return an object with:

| Field | Type | Description |
|-------|------|-------------|
| `entries` | `Array<{ key: string, data: any }>` | Current state entries from your app DB |
| `offset` | `number` | Stream offset from the broker (captured **before** reading state) |
| `epoch` | `string` | Stream epoch from the broker |

The SDK calls `getState` on initial subscribe and on reconnect when stream catch-up is not possible. After loading external state, the SDK opens a WebSocket subscription starting from the returned position to catch up on any changes that occurred during the HTTP call, then transitions to live mode. The `sync` and `update` events work the same as with regular map subscriptions.

**Error handling:**

- **`getState` throws or rejects** (network error, HTTP failure, etc.) — the SDK retries the subscribe from the beginning with exponential backoff, same as any other subscribe failure. The subscription stays in `subscribing` state.
- **Stale or invalid position** (e.g. epoch mismatch, offset too far behind) — the server returns an unrecoverable position error during stream catch-up. The SDK resets the position and calls `getState` again to get a fresh snapshot and position.
- **Empty position** (`offset: 0`, `epoch: ""`) on a channel with no prior publications — the first stream catch-up may fail with an epoch mismatch (the server creates the stream with a new epoch). The SDK automatically retries `getState`, which now returns the real epoch, and the second attempt succeeds.

## Examples

### Cursor tracking

A common pattern: each user publishes their cursor position, the server assigns the key to the client ID, and positions auto-expire after 60 seconds.

Server configuration:

```json title="config.json"
{
  "map_broker": {
    "type": "memory"
  },
  "channel": {
    "namespaces": [
      {
        "name": "cursors",
        "subscription_type": "map",
        "map": {
          "mode": "ephemeral",
          "key_ttl": "60s",
          "remove_client_on_unsubscribe": true,
          "allow_publish_for_subscriber": true,
          "client_key": "client_id"
        },
        "publication_data_format": "json_object",
        "allow_subscribe_for_client": true
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

A scoreboard with ordered entries, server-side publishing, and persistent mode for recovery support.

Server configuration:

```json title="config.json"
{
  "map_broker": {
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:pass@localhost:5432/app?sslmode=disable"
    }
  },
  "channel": {
    "namespaces": [
      {
        "name": "scoreboard",
        "subscription_type": "map",
        "map": {
          "mode": "persistent",
          "ordered": true
        },
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

### Persistent board with app-backed state

A project board where items live in your PostgreSQL database. The app DB is the source of truth — Centrifugo only manages the change stream for real-time delivery.

Server configuration:

```json title="config.json"
{
  "map_broker": {
    "type": "postgres",
    "postgres": {
      "dsn": "postgres://user:pass@localhost:5432/app?sslmode=disable"
    }
  },
  "channel": {
    "namespaces": [
      {
        "name": "boards",
        "subscription_type": "map",
        "map": {
          "mode": "persistent",
          "external_state": true
        },
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

Backend endpoint — returns board items + stream position (same transaction):

```python
@app.get("/api/boards/<board_id>/state")
def get_board_state(board_id):
    with db.transaction():
        # 1. Capture stream position FIRST.
        pos = db.execute(
            "SELECT * FROM cf_map_stream_top_position(%s)",
            [f"boards:{board_id}"]
        ).fetchone()

        # 2. Read state from app tables.
        items = db.execute(
            "SELECT item_id, data FROM board_items WHERE board_id = %s",
            [board_id]
        ).fetchall()

    return {
        "entries": [{"key": r["item_id"], "data": r["data"]} for r in items],
        "offset": pos["top_offset"],
        "epoch": pos["epoch"],
    }
```

Backend mutation — update app DB + Centrifugo stream atomically:

```python
@app.post("/api/boards/<board_id>/items/<item_id>")
def update_board_item(board_id, item_id):
    data = request.json
    with db.transaction():
        db.execute(
            "UPDATE board_items SET data = %s WHERE board_id = %s AND item_id = %s",
            [Json(data), board_id, item_id]
        )
        db.execute(
            "SELECT * FROM cf_map_publish_stream(p_channel := %s, p_key := %s, p_data := %s)",
            [f"boards:{board_id}", item_id, Json(data)]
        )
    return {"ok": True}
```

Client code:

```javascript
const sub = client.newMapSubscription('boards:project1', {
  getState: async () => {
    const resp = await fetch('/api/boards/project1/state');
    return resp.json();
  }
});

const items = new Map();

sub.on('sync', (ctx) => {
  items.clear();
  for (const entry of ctx.entries) {
    items.set(entry.key, entry.data);
  }
  renderBoard(items);
});

sub.on('update', (ctx) => {
  if (ctx.removed) {
    items.delete(ctx.key);
  } else {
    items.set(ctx.key, ctx.data);
  }
  renderBoard(items);
});

sub.subscribe();
```

## Demos

A collection of interactive demos showcasing map subscriptions is available in the [map_demo](https://github.com/centrifugal/examples/tree/master/v6/map_demo) example. It includes 10 scenarios covering different map subscription features:

![map demo](/img/map_demo.jpg)

- **Sync Protocol Visualizer** — step through the STATE → STREAM → LIVE sync phases with interactive sequence diagrams and frame inspection
- **Ephemeral Cursors** — real-time cursor positions using ephemeral sync with auto-cleanup on disconnect
- **Game Lobby** — 2-player lobby with slot claiming, live updates, and automatic game start using durable sync
- **Inventory (CAS)** — compare-and-swap for safe concurrent updates with conflict handling
- **Stock Tickers** — real-time price feed with sector filtering using tags filter
- **Live Scoreboard (Delta)** — 6 concurrent football matches with fossil delta compression and live bandwidth stats
- **Sprint Board (PostgreSQL)** — Kanban board with drag-and-drop using native PostgreSQL `cf_map_*` functions for transactional publishing
- **Live Polls (PostgreSQL)** — server-driven polls with real-time voting, bot participants, and auto-rotation using `cf_map_*` functions
- **Leaderboard (PostgreSQL)** — persistent ordered leaderboard using `cf_map_*` functions
- **Kitchen Orders (External State)** — restaurant order board using app-backed state with `getState` callback, `cf_map_publish_stream` / `cf_map_stream_top_position` for transactional publishing

The demo runs with Docker Compose (PostgreSQL + Python backend + Nginx) and requires Centrifugo v6.7+ with `centrifuge-js`.
