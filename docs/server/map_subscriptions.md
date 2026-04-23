---
id: map_subscriptions
title: "Map subscriptions 🔮"
sidebar_label: "Map subscriptions 🔮"
---

:::caution Experimental

Map subscriptions is an experimental feature. All its parts - configuration options, client SDK API, server API - may change in future releases based on user feedback. At this point only `centrifuge-js` SDK supports map subscriptions on the client side.

:::

A **map subscription** delivers a **real-time key-value collection whose lifecycle is managed by Centrifugo**. The map broker stores the entries, tracks per-key updates, and synchronizes them to every subscribed client — clients receive a complete snapshot on subscribe, catch up after disconnects, and get live updates in real time. The application doesn't need to maintain its own snapshot table, write a separate "fetch initial state" endpoint, or reconcile race conditions between an HTTP read and a WebSocket stream. That's the whole point: Centrifugo owns the collection, the SDK keeps a live mirror.

Typical use cases — workloads where Centrifugo *is* the natural store for the data:

- **Cursor positions, typing indicators** — short-lived per-client entries, no need for an external DB.
- **Map presence** — `map_clients` (one entry per connection) and `map_users` (one entry per user) are server-managed presence built on this same sync model.
- **Lobby members, IoT device fleet, feature flags, live polls** — collections that are naturally key-shaped, where having Centrifugo hold the canonical entries (with per-key TTL, optional persistence) avoids building a separate small-store + change-feed yourself.
- **Scoreboards, inventories** — persistent keyed state with efficient reconnect recovery.

import PgTransactionalDiagram from '@site/src/components/PgTransactionalDiagram';

<PgTransactionalDiagram />

Map subscriptions also introduce a **built-in map presence** mechanism (`map_clients` and `map_users` subscription types) that translates map subscription properties to presence tracking — paginated state delivery, stream-based catch-up on reconnect, and per-key TTL expiration. This opens a road to larger presence state and convergence after reconnects.

## When to use map subscriptions — and when not to

Map subscriptions are the natural fit when **the broker should be the canonical store** for a keyed collection — your application is comfortable letting Centrifugo own the entries and reads them back through subscriptions (or, for backends that need it, the server `map_read_state` API).

When your data already lives in your own application database (orders, documents, tickets, notifications), there's an alternative shape worth knowing about: a **stream subscription with a `getState` callback**, backed by the [PostgreSQL stream broker](./engines.md). You write to your own tables and call `cf_stream_publish` in the same SQL transaction — clients render state from your own schema and receive events for incremental changes, with no duplicate state in the broker. See [Transactional publishing for stream subscriptions with PostgreSQL](/blog/2026/04/10/pg-stream-broker-benefits) and the [pg_stream_broker example](https://github.com/centrifugal/examples/tree/master/v6/pg_stream_broker).

That said, **map subscriptions can still be the right answer even when the data has a home elsewhere** — if the convenience matters more to you than the duplication. With map subscriptions you get the synchronized snapshot, paginated state delivery, and per-key TTL with auto-removal out of the box. With stream + `getState` you have to build the snapshot endpoint yourself and reason about what your subscription consumer rebuilds on the client. Neither is universally better — pick by what you'd rather own.

| You need… | Natural fit |
|---|---|
| Ordered events (chat, notifications, activity feeds) | Stream subscription |
| Latest value of a single thing (with [cache recovery](/docs/server/cache_recovery)) | Stream subscription + cache recovery |
| Real-time sync of data already in your app DB, app DB stays the only source of truth | Stream subscription + `getState` ([pattern](/blog/2026/04/10/pg-stream-broker-benefits)) |
| A Centrifugo-managed keyed collection (cursors, presence, IoT fleet, feature flags, lobbies) | **Map subscription** |
| Centrifugo-managed keyed collection backed by transactional PostgreSQL | **Map subscription + PostgreSQL map broker** |
| Real-time sync of data in your app DB, where the convenience of map subscriptions outweighs the cost of mirroring entries into `cf_map_state` | **Map subscription + PostgreSQL map broker** (mirror via transactional `cf_map_publish` from your own SQL transactions) |

The PostgreSQL map broker is for the last row — it makes the broker-owned collection durable and queryable, and lets your backend update it inside its own SQL transactions when the data lives in `cf_map_state` rather than in your own table.

## Design overview

Map channels add a **state synchronization layer** on top of regular channels: a set of key-value entries that clients can query, paginate, and receive incremental updates for.

### Client subscription protocol

When a client subscribes to a map channel, it goes through phases to build consistent state:

import MapSubscriptionDiagram from '@site/src/components/MapSubscriptionDiagram';

<MapSubscriptionDiagram />

1. **State phase** — client paginates through the current key-value state from the broker
2. **Stream phase** — client catches up on changes that occurred during state pagination (recoverable/persistent modes only)
3. **Live phase** — client receives real-time updates via PUB/SUB

The SDK handles all phases transparently — the application receives `sync` (full state ready) and `update` (incremental change) events.

### Subscription types

Each namespace must declare which subscription type it supports. The client specifies the matching type when subscribing:

| Type | Description |
|------|-------------|
| `stream` | Traditional PUB/SUB with optional history stream, automatic recovery from stream, and cache recovery mode (default type, Centrifugo always had it) |
| `map` | Map subscription — keyed state with real-time updates, configurable sync and retention via mode (ephemeral/recoverable/persistent) with stream-based catch-up in recoverable/persistent modes, per-key TTL support, and paginated state sync protocol |
| `map_clients` | A special type of map subscription for presence — one entry per client connection, automatically managed by the server. Both joins and leaves are delivered immediately. The system is eventually consistent: if a remove operation to the broker fails (e.g. due to a transient network error), the stale entry will expire after `map.key_ttl` (60s by default) rather than lingering indefinitely |
| `map_users` | A special type of map subscription for presence — one entry per user ID, automatically managed by the server. New users appear immediately, but removals are driven by key TTL — since a single user may have multiple connections, the entry can't be removed when one connection disconnects. Instead, it expires after `map.key_ttl` (60s by default) once the last connection for that user leaves the channel |

The `map_clients` and `map_users` types are automatically managed by the server for presence tracking. The `map` type is the general-purpose map subscription where the application controls keys and values. It's like real-time map which is synchronized to clients.

### Map modes

Each map namespace requires a **mode** setting. Modes control two things: whether entries auto-expire and whether a change stream exists for efficient reconnect recovery.

| Mode | Entries expire? | Change stream? | On reconnect |
|------|----------------|----------------|--------------|
| `ephemeral` | Yes (`key_ttl`) | No | Full state snapshot |
| `recoverable` | Yes (`key_ttl`) | Yes | Catch up from stream (falls back to snapshot if too far behind) |
| `persistent` | No (until explicitly removed) | Yes | Catch up from stream (falls back to snapshot if too far behind) |

Each step adds capability: `ephemeral` is the lightest — no stream overhead. `recoverable` adds a change stream so clients recover efficiently on reconnect instead of re-fetching everything. `persistent` is the same as `recoverable` but entries live forever instead of expiring.

**Which mode to pick:**

| Use case | Mode | Why |
|----------|------|-----|
| Cursors, typing indicators | `ephemeral` | Short-lived data, no need for stream overhead |
| Presence, heartbeats | `recoverable` | Entries auto-expire, but reconnecting clients catch up from stream instead of re-fetching |
| Time-limited polls, sessions | `recoverable` | Entries auto-expire, efficient reconnect recovery |
| Scoreboards, inventories | `persistent` | Permanent state with efficient reconnect recovery |
| Inventories, collaborative docs | `persistent` | Permanent state with efficient reconnect recovery |

:::tip When your app already owns state

Map subscriptions fit "key-value real-time collection" use cases where the broker *is* the store — presence, cursors, feature flags, IoT device fleet, lobby members. If your data already lives in your own database (orders, documents, tickets) and you want Centrifugo to just deliver change events, use a **stream subscription with a `getState` callback** backed by the [PostgreSQL stream broker](./engines.md) — your writes and publishes commit together in one SQL transaction, and clients render state from your own schema. See [Transactional publishing for stream subscriptions with PostgreSQL](/blog/2026/04/10/pg-stream-broker-benefits) and the [pg_stream_broker example](https://github.com/centrifugal/examples/tree/master/v6/pg_stream_broker).

:::

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

:::caution Avoid Redis eviction policies with recoverable/persistent modes

When using `recoverable` or `persistent` mode, Redis must retain all stream data for recovery to work. If Redis evicts keys due to memory pressure, clients will be unable to catch up from the stream — making stream-based catch-up impossible. Configure Redis with `maxmemory-policy noeviction`, carefully monitor memory usage, and plan capacity accordingly.

:::

### PostgreSQL

PostgreSQL-backed storage for durable, persistent state. Requires **PostgreSQL 16** or later. Centrifugo creates the required tables automatically on startup (unless `skip_schema_init` is set).

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
| `pool_size` | integer | `16` | Maximum connection pool size |
| `num_shards` | integer | `16` | Number of delivery worker shards. Use the default for now — more guidance will be provided later |
| `ttl_check_interval` | [duration](./configuration.md#duration-type) | `"1s"` | How often to check for expired keys |
| `cleanup_interval` | [duration](./configuration.md#duration-type) | `"1m"` | How often to clean up expired stream/meta entries |
| `idempotent_result_ttl` | [duration](./configuration.md#duration-type) | `"5m"` | TTL for idempotency results |
| `binary_data` | boolean | `false` | Use BYTEA instead of JSONB for data columns |
| `table_prefix` | string | `"cf"` | Namespace prefix for table and function names. Default produces `cf_map_*` tables and `cf_map_publish(...)` functions. Use distinct prefixes for multi-tenant deployments sharing one PostgreSQL instance |
| `stream_retention` | [duration](./configuration.md#duration-type) | `"24h"` | How long stream entries are kept |
| `use_notify` | boolean | `false` | Enable LISTEN/NOTIFY for low-latency delivery. See [connection pooler note](../server/engines.md#listennotify-and-connection-poolers) |
| `notify_dsn` | string | `""` | Separate DSN for the LISTEN connection. Use a direct PostgreSQL URL when `dsn` points at PGBouncer or another pooler incompatible with LISTEN/NOTIFY |
| `skip_schema_init` | boolean | `false` | Skip automatic table creation on startup |
| `partition_lookahead_days` | integer | `2` | Number of future daily partitions to pre-create |
| `partition_retention_days` | integer | `7` | Partitions older than this are dropped automatically. Set to `0` for unlimited retention |

The stream table is always partitioned by `created_at` (daily). Old partitions are dropped entirely — this is instant and avoids the table bloat and expensive vacuum operations that row-level `DELETE` produces at scale. The `partition_retention_days` setting controls how many days of partitions to keep; the `partition_lookahead_days` setting controls how many future partitions to pre-create (to avoid write failures at the day boundary).

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

:::note

`cf_map_expire_keys` function is also created but is for Centrifugo internal use only — do not call it from application code.

:::

When `binary_data` option is enabled, the schema uses BYTEA columns instead of JSONB for data fields, and all tables and functions use the `cf_binary_map_` prefix (e.g. `cf_binary_map_publish`, `cf_binary_map_state`). This is useful when data payloads are not valid JSON (e.g. Protobuf-encoded).

When a custom `table_prefix` is configured (e.g. `"myapp"`), all table and function names use that prefix instead of the default `cf` — for example, `myapp_map_publish(...)`, `myapp_map_state`, etc.

Common parameters for `cf_map_publish`:

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_channel` | `TEXT` | Channel name (required) |
| `p_key` | `TEXT` | Entry key (required) |
| `p_data` | `JSONB` | Entry data (required) |
| `p_key_mode` | `TEXT` | `'if_new'` (insert only) or `'if_exists'` (update only) |
| `p_key_ttl` | `INTERVAL` | Per-key TTL |
| `p_meta_ttl` | `INTERVAL` | Channel metadata TTL |

The function returns a row with `channel_offset`, `epoch`, `suppressed`, and `suppress_reason` fields.

**Example** — recording a vote atomically (dedup + data update in one transaction):

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

  -- 2. Publish updated vote count.
  SELECT * FROM cf_map_publish(
    p_channel := 'poll:results',
    p_key     := 'poll1_opt_0',
    p_data    := '{"optionId": "poll1_opt_0", "label": "Option A", "votes": 42}'::jsonb
  );
COMMIT;
```

Centrifugo's outbox worker picks up new stream entries and delivers them to subscribers. This pattern eliminates the dual-write problem: instead of publishing to Centrifugo and updating your database separately (risking inconsistency), both happen in a single transaction.

:::caution Consistent TTLs across publishes

When calling `cf_map_publish` directly, use the same `p_key_ttl` for all publishes on a given channel. Mixing expiring keys with permanent keys (`p_key_ttl = NULL`) on the same channel can lead to metadata being expired while some keys remain — breaking recovery for connected clients.

Centrifugo's own publish path (via HTTP/GRPC API or the SDK) uses the channel namespace's configured `map.key_ttl` for all publishes, so this is only a concern when calling SQL functions directly. The validation `MetaTTL >= KeyTTL` catches the common case, but can't detect per-channel history when `p_key_ttl = NULL` is mixed with prior expiring keys.

:::

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
| `map.mode` | string | | `"ephemeral"`, `"recoverable"`, or `"persistent"`. Required when using map types |
| `map.key_ttl` | [duration](./configuration.md#duration-type) | | Required for `"ephemeral"` and `"recoverable"` modes |
| `map.stream_size` | integer | | Max stream entries (auto-derived for recoverable/persistent: 100) |
| `map.stream_ttl` | [duration](./configuration.md#duration-type) | | Stream entry retention (auto-derived for recoverable/persistent: "1m") |
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
          "mode": "recoverable",
          "key_ttl": "60s"
        },
        "allow_subscribe_for_client": true
      },
      {
        "name": "users",
        "subscription_type": "map_users",
        "map": {
          "mode": "recoverable",
          "key_ttl": "60s"
        },
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

:::tip Use recoverable mode for presence channels

The `recoverable` mode is recommended for `map_clients` and `map_users` namespaces. It enables stream-based catch-up on reconnect — clients receive only the join/leave changes they missed, rather than re-fetching the full participant list. With `ephemeral` mode, every reconnect triggers a full state snapshot, which is the same behavior as Centrifugo's traditional [presence](/docs/server/presence) — you lose the convergence advantage that map-based presence provides.

:::

When a client subscribes to `game:abc`:
- An entry with key = client ID is automatically published to `clients:game:abc` (client presence)
- An entry with key = user ID is automatically published to `users:game:abc` (user presence)

The client can then separately subscribe to `clients:game:abc` or `users:game:abc` to track presence for that game channel.

This also works with Centrifugo PRO channel patterns. For example, with prefix `"/clients"` and a pattern channel `/games/abc`, presence is published to `/clients/games/abc`.

### Map publish/remove proxy

When `map.publish_proxy_enabled` or `map.remove_proxy_enabled` is set, the corresponding client-originated operation is forwarded to your application backend before execution. The proxy is the single trust boundary that can:

- Allow or deny the operation, or disconnect the client
- Validate that the client has permission to publish/remove for the specific key
- Override the key (e.g. force it to a server-derived value)
- Override the data and provide a separate stream payload
- Stamp server-controlled metadata on the resulting publication — tags, version, key mode, idempotency key, delta hint

This makes the publish proxy the natural place to combine authorization with **RBAC tag enrichment** for client-originated publishes: clients cannot send tags themselves, so the proxy is the only path that can attach tags read by [server-side publication tags filter](../pro/server_tags_filter.md).

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
          "publish_proxy_name": "backend",
          "remove_proxy_enabled": true,
          "remove_proxy_name": "backend"
        },
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

When the proxy is configured for a namespace, the `map.allow_publish_for_*` / `map.allow_remove_for_*` flags are not checked — the proxy is fully responsible for authorization.

#### Map publish proxy request

The proxy receives a JSON request with these fields:

| Field       | Type     | Description                                                                                          |
|-------------|----------|------------------------------------------------------------------------------------------------------|
| `client`    | `string` | unique client ID generated by Centrifugo for the connection                                          |
| `transport` | `string` | transport name (e.g. `websocket`)                                                                    |
| `protocol`  | `string` | protocol type (`json` or `protobuf`)                                                                 |
| `encoding`  | `string` | protocol encoding (`json` or `binary`)                                                               |
| `user`      | `string` | the connection's user ID from authentication                                                         |
| `channel`   | `string` | the map channel the client is publishing to                                                          |
| `key`       | `string` | the key sent by the client (may be empty when the namespace uses server-driven `client_key`)         |
| `data`      | `JSON`   | the data sent by the client                                                                          |
| `b64data`   | `string` | base64-encoded data, used instead of `data` when binary proxy mode is enabled                        |
| `meta`      | `JSON`   | the connection's attached meta (off by default, enable with `"include_connection_meta": true`)       |

#### Map publish proxy response

| Field        | Type                                            | Description                                                            |
|--------------|-------------------------------------------------|------------------------------------------------------------------------|
| `result`     | [`MapPublishResult`](#mappublishresult)         | the result of the operation when allowed                               |
| `error`      | `Error`                                         | reject the operation with a custom error                               |
| `disconnect` | `Disconnect`                                    | disconnect the client                                                  |

##### MapPublishResult

All fields are optional. Any field left unset falls back to the value sent by the client (for `key`/`data`) or to the default behaviour.

| Field              | Type                  | Description                                                                                                                                                                                       |
|--------------------|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `key`              | `string`              | Override the key used for the publish. Useful for forcing keys to server-derived values (e.g. user ID, deal ID).                                                                                  |
| `data`             | `JSON`                | Replace the publication data the client sent.                                                                                                                                                     |
| `b64data`          | `string`              | Binary data encoded in base64, used instead of `data` in binary proxy mode.                                                                                                                       |
| `tags`             | `map<string, string>` | Server-stamped publication tags. Clients cannot send tags themselves — the proxy is the only path that can attach tags read by [server-side publication tags filter](../pro/server_tags_filter.md) for per-subscriber RBAC. |
| `key_mode`         | `string`              | `"if_new"` to publish only when the key does not yet exist, `"if_exists"` to publish only when it already exists. Useful for enforcing insert-only or update-only access patterns.                |
| `stream_data`      | `JSON`                | Separate payload to publish to the stream/PUB-SUB while keeping `data` in the state. Use when state and stream payloads should differ (e.g. state is the full snapshot, stream carries deltas).   |
| `b64stream_data`   | `string`              | Binary equivalent of `stream_data` for binary proxy mode.                                                                                                                                         |
| `idempotency_key`  | `string`              | Idempotency key for safe retries — duplicates within the broker's idempotent result TTL window are suppressed.                                                                                    |
| `delta`            | `bool`                | Enable delta compression for this publication.                                                                                                                                                    |
| `version`          | `uint64`              | Per-key version used by Centrifugo to drop non-actual publications.                                                                                                                               |
| `version_epoch`    | `string`              | Scopes `version` — use when version may be reused.                                                                                                                                                |

#### Map remove proxy request

| Field       | Type     | Description                                                                                          |
|-------------|----------|------------------------------------------------------------------------------------------------------|
| `client`    | `string` | unique client ID generated by Centrifugo for the connection                                          |
| `transport` | `string` | transport name                                                                                       |
| `protocol`  | `string` | protocol type (`json` or `protobuf`)                                                                 |
| `encoding`  | `string` | protocol encoding (`json` or `binary`)                                                               |
| `user`      | `string` | the connection's user ID from authentication                                                         |
| `channel`   | `string` | the map channel the client is removing from                                                          |
| `key`       | `string` | the key the client wants to remove                                                                   |
| `meta`      | `JSON`   | the connection's attached meta (off by default, enable with `"include_connection_meta": true`)       |

#### Map remove proxy response

| Field        | Type                                  | Description                              |
|--------------|---------------------------------------|------------------------------------------|
| `result`     | [`MapRemoveResult`](#mapremoveresult) | the result of the operation when allowed |
| `error`      | `Error`                               | reject the operation with a custom error |
| `disconnect` | `Disconnect`                          | disconnect the client                    |

##### MapRemoveResult

| Field             | Type                  | Description                                                                                                                                                                                                                            |
|-------------------|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `key`             | `string`              | Override the key being removed.                                                                                                                                                                                                        |
| `tags`            | `map<string, string>` | Tags attached to the removal publication. When unset, the broker reads the removed entry's stored tags automatically. Set explicitly only to override. |
| `idempotency_key` | `string`              | Idempotency key for safe retries on removal.                                                                                                                                                                                           |

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

Options: `cursor` (pagination), `limit`, `key` (filter to single key).

:::note Redis map broker: page sizes may vary

State is stored in a Redis `HASH` and paginated with `HSCAN`, where `COUNT` is a hint, not a guarantee. Redis may return more entries than the requested `limit` on some pages, especially for small hashes stored in listpack encoding. Do not rely on exact page sizes for state reads.

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
  // ctx.entries is the full state (array of { key, data, removed })
  renderFullState(ctx.entries);
});
```

**`update`** — emitted when a single entry changes:

```javascript
sub.on('update', (ctx) => {
  // ctx.key, ctx.data, ctx.removed
  if (ctx.removed) {
    removeEntry(ctx.key);
  } else {
    upsertEntry(ctx.key, ctx.data);
  }
});
```

Under the hood, the SDK manages state automatically: on initial subscribe it builds state from paginated reads, and on reconnect it attempts to catch up from the change stream (recoverable/persistent modes). If catch-up is not possible (e.g. too many changes accumulated), the SDK transparently falls back to a full state re-sync from the broker — the application simply receives another `sync` event with the complete state.

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

A scoreboard with persistent entries, server-side publishing, and efficient recovery on reconnect.

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
          "mode": "persistent"
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
    "data": {"name": "Alice", "score": 1500}
  }'
```

Client code:

```javascript
const sub = client.newMapSubscription('scoreboard:main', {
  limit: 50,
});

sub.on('sync', (ctx) => {
  renderScoreboard(ctx.entries);
});

sub.on('update', (ctx) => {
  if (ctx.removed) {
    removeEntry(ctx.key);
  } else {
    upsertEntry(ctx.key, ctx.data);
  }
});

sub.subscribe();
```

## Demos

A collection of interactive demos showcasing map subscriptions is available in the [map_demo](https://github.com/centrifugal/examples/tree/master/v6/map_demo) example. It includes 9 scenarios covering different map subscription features:

![map demo](/img/map_demo.jpg)

- **Sync Protocol Visualizer** — step through the STATE → STREAM → LIVE sync phases with interactive sequence diagrams and frame inspection
- **Ephemeral Cursors** — real-time cursor positions using ephemeral sync with auto-cleanup on disconnect
- **Game Lobby** — 2-player lobby with slot claiming, live updates, and automatic game start using recoverable sync
- **Inventory (CAS)** — compare-and-swap for safe concurrent updates with conflict handling
- **Stock Tickers** — real-time price feed with sector filtering using tags filter
- **Live Scoreboard (Delta)** — 6 concurrent football matches with fossil delta compression and live bandwidth stats
- **Sprint Board (PostgreSQL)** — Kanban board with drag-and-drop using native PostgreSQL `cf_map_*` functions for transactional publishing
- **Live Polls (PostgreSQL)** — server-driven polls with real-time voting, bot participants, and auto-rotation using `cf_map_*` functions

The demo runs with Docker Compose (PostgreSQL + Python backend + Nginx) and requires Centrifugo v6.7+ with `centrifuge-js`.

For the app-owned state pattern (app DB as source of truth + transactional publishing via the PostgreSQL stream broker + stream subscription `getState`), see the [pg_stream_broker kitchen orders demo](https://github.com/centrifugal/examples/tree/master/v6/pg_stream_broker) and the blog post [Transactional publishing for stream subscriptions with PostgreSQL](/blog/2026/04/10/pg-stream-broker-benefits).
