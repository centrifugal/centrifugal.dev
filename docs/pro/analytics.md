---
description: "Export real-time analytics to ClickHouse with Centrifugo PRO. Track connections, subscriptions, operations, and publications for observability."
id: analytics
title: Analytics with ClickHouse
---

This feature allows exporting information about channel publications, client connections, channel subscriptions, client operations and push notifications to [ClickHouse](https://clickhouse.com/), providing an integration with a real-time (with seconds delay) analytics storage. ClickHouse is super fast for analytical queries, simple to operate with, and it allows effective data keeping for a window of time. Also, it's relatively simple to create a high-performance ClickHouse cluster.

![clickhouse](/img/clickhouse.png)

This unlocks a great observability and a way to perform various analytics queries for better connection behavior understanding, check application correctness, building trends, reports, and so on.

As soon as you start using the integration with ClickHouse, some of the mentioned possibilities may be easily accessed with the Centrifugo PRO web UI and its analytics page:

![Admin analytics](/img/pro_analytics.png)

## Configuration

To enable integration with ClickHouse add the following section to a configuration file:

```json title="config.json"
{
  "clickhouse_analytics": {
    "enabled": true,
    "clickhouse_dsn": [
      "tcp://127.0.0.1:9000",
      "tcp://127.0.0.1:9001",
      "tcp://127.0.0.1:9002",
      "tcp://127.0.0.1:9003"
    ],
    "clickhouse_database": "centrifugo",
    "clickhouse_cluster": "centrifugo_cluster",
    "export": {
      "connections": {
        "enabled": true,
        "http_headers": [
          "User-Agent",
          "Origin",
          "X-Real-Ip"
        ]
      },
      "subscriptions": {
        "enabled": true
      },
      "operations": {
        "enabled": true
      },
      "publications": {
        "enabled": true
      },
      "notifications": {
        "enabled": true
      }
    }
  }
}
```

:::caution

Centrifugo PRO supports data export only over ClickHouse native TCP protocol these days.

:::

All ClickHouse analytics options are scoped to the `clickhouse_analytics` section of the configuration.

Toggle this feature using `clickhouse_analytics.enabled` boolean option.

Centrifugo can export data to different ClickHouse instances, addresses of ClickHouse can be set over `clickhouse_analytics.clickhouse_dsn` option.

You also need to set a ClickHouse cluster name (`clickhouse_analytics.clickhouse_cluster`) and database name `clickhouse_analytics.clickhouse_database`.

`clickhouse_analytics.skip_schema_initialization` - boolean, default `false`. By default Centrifugo tries to initialize table schema on start (if not exists). This flag allows skipping initialization process.

`clickhouse_analytics.skip_ping_on_start` - boolean, default `false`. Centrifugo pings ClickHouse servers by default on start; if any server is unavailable – Centrifugo fails to start. This option allows skipping this check, so Centrifugo is able to start even if the ClickHouse cluster is not working correctly.

`clickhouse_analytics.tls` - [TLS object](../server/configuration.md#tls-config-object) (available since v6.6.4). By default, no TLS is used. When enabled, TLS is applied to both data export and query connections to ClickHouse.

The `export` section allows configuring which data to export to ClickHouse:

* `clickhouse_analytics.export.connections.enabled` – enables exporting connection information.
* `clickhouse_analytics.export.subscriptions.enabled` – enables exporting subscription information.
* `clickhouse_analytics.export.operations.enabled` – enables exporting individual client operation information.
* `clickhouse_analytics.export.publications.enabled` – enables exporting publications for channels.
* `clickhouse_analytics.export.notifications.enabled` – enables exporting push notifications.

Additionally:

* `clickhouse_analytics.export.connections.http_headers` is a list of HTTP headers to export for connection information.
* `clickhouse_analytics.export.connections.grpc_metadata` is a list of metadata keys to export for connection information for GRPC unidirectional transport.
* `clickhouse_analytics.export.connections.export_users` - list of strings. Option `export_users` is a list of users for which Centrifugo will export connections data to ClickHouse. If not set, all users will be exported. Allows enabling ClickHouse analytics for a subset of users which is generally simpler/safer/more effective than enabling connections analytics for all users.
* `clickhouse_analytics.export.subscriptions.export_users` - list of strings. Option `export_users` is a list of users for which Centrifugo will export subscriptions data to ClickHouse. If not set, all users will be exported. Allows enabling ClickHouse analytics for a subset of users which is generally simpler/safer/more effective than enabling subscriptions analytics for all users.
* `clickhouse_analytics.export.operations.export_users` - list of strings. Option `export_users` is a list of users for which Centrifugo will export operations data to ClickHouse. If not set, all users will be exported. Allows enabling ClickHouse analytics for a subset of users which is generally simpler/safer/more effective than enabling operations analytics for all users.
* `clickhouse_analytics.export.publications.export_channels` - list of strings. Option `export_channels` is a list of channels for which Centrifugo will export publications data to ClickHouse. If not set, all channels will be exported. Allows enabling ClickHouse analytics for a subset of channels which is generally simpler/safer/more effective than enabling publications analytics for all channels.

### DSN format

The `clickhouse_dsn` values use the following format:

```
tcp://user:password@host:port
```

Examples:

* `tcp://127.0.0.1:9000` – connect with defaults
* `tcp://user:pass@127.0.0.1:9000` – connect with credentials

### Per-export tuning options

Each export type (connections, subscriptions, operations, publications, notifications) supports the following tuning options:

* `max_buffer_size` – maximum number of events to buffer in memory, default `1000000`. Events are dropped when the buffer is full.
* `flush_interval` – interval between flush attempts, default `"10s"`.
* `flush_size` – maximum batch size per flush, default `100000`.
* `ttl` – ClickHouse table TTL for the `time` column, default `"7 DAY"`.

Example:

```json
"export": {
  "connections": {
    "enabled": true,
    "max_buffer_size": 500000,
    "flush_interval": "5s",
    "flush_size": 50000,
    "ttl": "30 DAY"
  }
}
```

### Snapshots TTL

When snapshots are enabled (`clickhouse_analytics.snapshots.enabled`), snapshot data in ClickHouse expires after a configurable period. Use `clickhouse_analytics.snapshots.ttl` to control this, default is `"14 DAY"`.

## Connections table

```sql
SHOW CREATE TABLE centrifugo.connections;

┌─statement───────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.connections
(
    `client` String,
    `user` String,
    `name` String,
    `version` String,
    `transport` String,
    `headers` Map(String, Array(String)),
    `metadata` Map(String, Array(String)),
    `labels` Map(String, String),
    `time` DateTime
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{cluster}/{shard}/connections', '{replica}')
PARTITION BY toYYYYMMDD(time)
ORDER BY time
TTL time + toIntervalDay(7)
SETTINGS index_granularity = 8192 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

And distributed one:

```sql
SHOW CREATE TABLE centrifugo.connections_distributed;

┌─statement───────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.connections_distributed
(
    `client` String,
    `user` String,
    `name` String,
    `version` String,
    `transport` String,
    `headers` Map(String, Array(String)),
    `metadata` Map(String, Array(String)),
    `labels` Map(String, String),
    `time` DateTime
)
ENGINE = Distributed('centrifugo_cluster', 'centrifugo', 'connections', murmurHash3_64(client)) │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

The `labels` column carries [client labels](./client_authentication.md#client-labels) attached to the connection. Available since the labels feature shipped — see [Migration](#migration) below for the one-time `ALTER` to add the column to existing deployments.

## Subscriptions table

```sql
SHOW CREATE TABLE centrifugo.subscriptions

┌─statement──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.subscriptions
(
    `client` String,
    `user` String,
    `channels` Array(String),
    `time` DateTime
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(time)
ORDER BY time
TTL time + toIntervalDay(7)
SETTINGS index_granularity = 8192 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

And distributed one:

```sql
SHOW CREATE TABLE centrifugo.subscriptions_distributed;

┌─statement───────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.subscriptions_distributed
(
    `client` String,
    `user` String,
    `channels` Array(String),
    `time` DateTime
)
ENGINE = Distributed('centrifugo_cluster', 'centrifugo', 'subscriptions', murmurHash3_64(client)) │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Operations table

```sql
SHOW CREATE TABLE centrifugo.operations;

┌─statement──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.operations
(
    `client` String,
    `user` String,
    `op` String,
    `channel` String,
    `method` String,
    `error` UInt32,
    `disconnect` UInt32,
    `duration` UInt64,
    `labels` Map(String, String),
    `time` DateTime
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{cluster}/{shard}/operations', '{replica}')
PARTITION BY toYYYYMMDD(time)
ORDER BY time
TTL time + toIntervalDay(7)
SETTINGS index_granularity = 8192 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

And distributed one:

```sql
SHOW CREATE TABLE centrifugo.operations_distributed;

┌─statement──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.operations_distributed
(
    `client` String,
    `user` String,
    `op` String,
    `channel` String,
    `method` String,
    `error` UInt32,
    `disconnect` UInt32,
    `duration` UInt64,
    `labels` Map(String, String),
    `time` DateTime
)
ENGINE = Distributed('centrifugo_cluster', 'centrifugo', 'operations', murmurHash3_64(client)) │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Publications table

```sql
SHOW CREATE TABLE centrifugo.publications

┌─statement──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.publications
(
    `uid` String,
    `channel` String,
    `source` String,
    `size` UInt64,
    `client` String,
    `user` String,
    `time` DateTime
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(time)
ORDER BY time
TTL time + toIntervalDay(7)
SETTINGS index_granularity = 8192 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

And distributed one:

```sql
SHOW CREATE TABLE centrifugo.publications_distributed;

┌─statement──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.publications_distributed
(
    `uid` String,
    `channel` String,
    `source` String,
    `size` UInt64,
    `client` String,
    `user` String,
    `time` DateTime
)
ENGINE = Distributed('centrifugo_cluster', 'centrifugo', 'publications', murmurHash3_64(channel)) │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Notifications table

```sql
SHOW CREATE TABLE centrifugo.notifications

┌─statement──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.notifications
(
    `uid` String,
    `provider` String,
    `type` String,
    `recipient` String,
    `device_id` String,
    `platform` String,
    `user` String,
    `msg_id` String,
    `status` String,
    `error_message` String,
    `error_code` String,
    `time` DateTime
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(time)
ORDER BY time
TTL time + toIntervalDay(7)
SETTINGS index_granularity = 8192 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

And distributed one:

```sql
SHOW CREATE TABLE centrifugo.notifications_distributed;

┌─statement──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.notifications_distributed
(
    `uid` String,
    `provider` String,
    `type` String,
    `recipient` String,
    `device_id` String,
    `platform` String,
    `user` String,
    `msg_id` String,
    `status` String,
    `error_message` String,
    `error_code` String,
    `time` DateTime
)
ENGINE = Distributed('centrifugo_cluster', 'centrifugo', 'notifications', murmurHash3_64(uid)) │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Snapshot tables

When `clickhouse_analytics.snapshots.enabled` is set, two additional tables are created for point-in-time snapshots created via the [admin connections](./connections.md) snapshot endpoint:

- `snapshot_channels` — one row per (snapshot_id, channel, node).
- `snapshot_connections` — one row per (snapshot_id, client). Includes the same `labels Map(String, String)` column as the [connections table](#connections-table). The snapshot create API accepts a `label_filter` argument; matching is applied at gather time on each node's hub, so the table only ever stores the filtered subset.

## Migration

When upgrading from a pre-labels Centrifugo PRO release with existing analytics tables, run the following `ALTER` statements **before** starting the new binary. The labels column must be present for inserts to succeed; on startup, Centrifugo refuses to start with an actionable error pointing back to this section if any required column is missing on a table whose ingestion is enabled.

`ALTER TABLE ... ADD COLUMN ... DEFAULT map()` is a metadata-only operation on MergeTree (no data rewrite) — fast even on large tables.

For standalone ClickHouse:

```sql
ALTER TABLE centrifugo.connections          ADD COLUMN IF NOT EXISTS labels Map(String, String) DEFAULT map();
ALTER TABLE centrifugo.operations           ADD COLUMN IF NOT EXISTS labels Map(String, String) DEFAULT map();
ALTER TABLE centrifugo.snapshot_connections ADD COLUMN IF NOT EXISTS labels Map(String, String) DEFAULT map();
```

For a ClickHouse cluster (replace `'centrifugo_cluster'` with your `clickhouse_cluster` config value):

```sql
ALTER TABLE centrifugo.connections          ON CLUSTER 'centrifugo_cluster' ADD COLUMN IF NOT EXISTS labels Map(String, String) DEFAULT map();
ALTER TABLE centrifugo.operations           ON CLUSTER 'centrifugo_cluster' ADD COLUMN IF NOT EXISTS labels Map(String, String) DEFAULT map();
ALTER TABLE centrifugo.snapshot_connections ON CLUSTER 'centrifugo_cluster' ADD COLUMN IF NOT EXISTS labels Map(String, String) DEFAULT map();
```

Replace `centrifugo` with your `clickhouse_database` if it differs. Apply only the lines for tables you actually have enabled (the startup probe only checks tables with ingestion enabled, so skipped ALTERs for disabled tables are harmless).

If you use the `_distributed` companion tables (set when `clickhouse_cluster` is configured), apply the same column addition there as well so distributed inserts succeed:

```sql
ALTER TABLE centrifugo.connections_distributed          ON CLUSTER 'centrifugo_cluster' ADD COLUMN IF NOT EXISTS labels Map(String, String) DEFAULT map();
ALTER TABLE centrifugo.operations_distributed           ON CLUSTER 'centrifugo_cluster' ADD COLUMN IF NOT EXISTS labels Map(String, String) DEFAULT map();
ALTER TABLE centrifugo.snapshot_connections_distributed ON CLUSTER 'centrifugo_cluster' ADD COLUMN IF NOT EXISTS labels Map(String, String) DEFAULT map();
```

### Downgrade safety

After the migration, rolling back to an older Centrifugo build is safe — the column has `DEFAULT map()` so inserts from the older binary (which omit the `labels` column from `INSERT VALUES`) get an empty map and continue to succeed. There is no need to roll back the schema.

### Greenfield deployments

New deployments (no existing tables) need no action — the `CREATE TABLE IF NOT EXISTS` issued by Centrifugo on first start already includes the labels column.

### Cardinality warning

The `labels` column is a `Map(String, String)` — every unique label key/value combination adds to the column's dictionary. Putting unbounded values into labels (session IDs, request IDs, user IDs) bloats the column and degrades compression. The same concern applies to the Prometheus dimensions exported via [`prometheus.client_labels`](./observability_enhancements.md#client-labels-as-prometheus-dimensions) — keep labels bounded at the source.

## Query examples

Show unique users which were connected:

```sql
SELECT DISTINCT user
FROM centrifugo.connections_distributed;

┌─user─────┐
│ user_1   │
│ user_2   │
│ user_3   │
│ user_4   │
│ user_5   │
└──────────┘
```

Show total number of publication attempts which were throttled by Centrifugo (received `Too many requests` error with code `111`):

```sql
SELECT COUNT(*)
FROM centrifugo.operations_distributed
WHERE (error = 111) AND (op = 'publish');

┌─count()─┐
│    4502 │
└─────────┘
```

The same for a specific user:

```sql
SELECT COUNT(*)
FROM centrifugo.operations_distributed
WHERE (error = 111) AND (op = 'publish') AND (user = 'user_200');

┌─count()─┐
│    1214 │
└─────────┘
```

Show the number of unique users subscribed to a specific channel in the last 5 minutes (this is approximate since the subscriptions table contains periodic snapshot entries; clients could unsubscribe between snapshots – this is reflected in the operations table):

```sql
SELECT uniqExact(user)
FROM centrifugo.subscriptions_distributed
WHERE arrayExists(x -> (x = 'chat:index'), channels) AND (time >= (now() - toIntervalMinute(5)));

┌─uniqExact(user)─┐
│             101 │
└─────────────────┘
```

Show top 10 users which called `publish` operation during last one minute:

```sql
SELECT
    COUNT(op) AS num_ops,
    user
FROM centrifugo.operations_distributed
WHERE (op = 'publish') AND (time >= (now() - toIntervalMinute(1)))
GROUP BY user
ORDER BY num_ops DESC
LIMIT 10;

┌─num_ops─┬─user─────┐
│      56 │ user_200 │
│      11 │ user_75  │
│       6 │ user_87  │
│       6 │ user_65  │
│       6 │ user_39  │
│       5 │ user_28  │
│       5 │ user_63  │
│       5 │ user_89  │
│       3 │ user_32  │
│       3 │ user_52  │
└─────────┴──────────┘
```

Show total number of push notifications to iOS devices sent during last 24 hours:

```sql
SELECT COUNT(*)
FROM centrifugo.notifications
WHERE (time > (now() - toIntervalHour(24))) AND (platform = 'ios')

┌─count()─┐
│   31200 │
└─────────┘
```

## Development

The recommended way to run ClickHouse in production is with cluster. See [an example of such cluster configuration](https://github.com/centrifugal/centrifugo/tree/master/misc/clickhouse_cluster) made with Docker Compose.

But during development you may want to run Centrifugo with a single ClickHouse instance.

To do this, set only one ClickHouse DSN and do not set a cluster name:

```json title="config.json"
{
    ...
    "clickhouse_analytics": {
        "enabled": true,
        "clickhouse_dsn": [
            "tcp://127.0.0.1:9000"
        ],
        "clickhouse_database": "centrifugo",
        "export": {
            "connections": {
                "enabled": true,
                "http_headers": [
                    "Origin",
                    "User-Agent"
                ]
            },
            "subscriptions": {
                "enabled": true
            },
            "operations": {
                "enabled": true
            },
            "publications": {
                "enabled": true
            }
        }
    }
}
```

Run ClickHouse locally:

```bash
docker run -it --rm -v /tmp/clickhouse:/var/lib/clickhouse -p 9000:9000 --name click clickhouse/clickhouse-server
```

Run ClickHouse client:

```bash
docker run -it --rm --link click:clickhouse-server --entrypoint clickhouse-client clickhouse/clickhouse-server --host clickhouse-server
```

Issue queries:

```
:) SELECT * FROM centrifugo.operations

┌─client───────────────────────────────┬─user─┬─op──────────┬─channel─────┬─method─┬─error─┬─disconnect─┬─duration─┬────────────────time─┐
│ bd55ae3a-dd44-47cb-a4cc-c41f8e33803b │ 2694 │ connecting  │             │        │     0 │          0 │   217894 │ 2021-07-31 08:15:09 │
│ bd55ae3a-dd44-47cb-a4cc-c41f8e33803b │ 2694 │ connect     │             │        │     0 │          0 │        0 │ 2021-07-31 08:15:09 │
│ bd55ae3a-dd44-47cb-a4cc-c41f8e33803b │ 2694 │ subscribe   │ $chat:index │        │     0 │          0 │    92714 │ 2021-07-31 08:15:09 │
│ bd55ae3a-dd44-47cb-a4cc-c41f8e33803b │ 2694 │ presence    │ $chat:index │        │     0 │          0 │     3539 │ 2021-07-31 08:15:09 │
│ bd55ae3a-dd44-47cb-a4cc-c41f8e33803b │ 2694 │ subscribe   │ test1       │        │     0 │          0 │     2402 │ 2021-07-31 08:15:12 │
│ bd55ae3a-dd44-47cb-a4cc-c41f8e33803b │ 2694 │ subscribe   │ test2       │        │     0 │          0 │      634 │ 2021-07-31 08:15:12 │
│ bd55ae3a-dd44-47cb-a4cc-c41f8e33803b │ 2694 │ subscribe   │ test3       │        │     0 │          0 │      412 │ 2021-07-31 08:15:12 │
└──────────────────────────────────────┴──────┴─────────────┴─────────────┴────────┴───────┴────────────┴──────────┴─────────────────────┘
```

## How export works

When ClickHouse analytics is enabled, Centrifugo nodes start exporting events to ClickHouse. Each node issues an insert with events once every 10 seconds (flushing collected events in batches, thus making insertion into ClickHouse efficient). The maximum batch size is 100k for each table at the moment. If an insert to ClickHouse fails, Centrifugo retries it once and then buffers events in memory (up to 1 million entries). If ClickHouse is still unavailable after collecting 1 million events, new events will be dropped until the buffer has space. These limits are configurable. Centrifugo PRO uses very efficient code for writing data to ClickHouse, so the analytics feature should only add a little overhead for a Centrifugo node.

## Exposed metrics

Several metrics are exposed to monitor export process health:

#### centrifugo_clickhouse_analytics_drop_count

- **Type:** Counter
- **Labels:** type
- **Description:** Total count of drops.
- **Usage:** Useful for tracking the number of data drops in ClickHouse analytics, helping identify potential issues with data processing.

#### centrifugo_clickhouse_analytics_flush_duration_seconds

- **Type:** Summary
- **Labels:** type, retries, result
- **Description:** Duration of ClickHouse data flush in seconds.
- **Usage:** Helps in monitoring the performance of data flush operations in ClickHouse, aiding in performance tuning and issue resolution.

#### centrifugo_clickhouse_analytics_batch_size

- **Type:** Summary
- **Labels:** type
- **Description:** Distribution of batch sizes for ClickHouse flush.
- **Usage:** Useful for understanding the size of data batches being flushed to ClickHouse, helping optimize performance.