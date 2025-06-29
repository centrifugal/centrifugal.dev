---
id: analytics
title: Analytics with ClickHouse
---

This feature allows exporting information about channel publications, client connections, channel subscriptions,  client operations and push notifications to [ClickHouse](https://clickhouse.com/) thus providing an integration with a real-time (with seconds delay) analytics storage. ClickHouse is super fast for analytical queries, simple to operate with and it allows effective data keeping for a window of time. Also, it's relatively simple to create a high performance ClickHouse cluster.

![clickhouse](/img/clickhouse.png)

This unlocks a great observability and a way to perform various analytics queries for better connection behavior understanding, check application correctness, building trends, reports, and so on.

As soon as you start using integration with ClickHouse some of mentioned possibilities may be easily accessed with Centrifugo PRO web UI and it's analytics page:

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

All ClickHouse analytics options scoped to `clickhouse_analytics` section of configuration.

Toggle this feature using `clickhouse_analytics.enabled` boolean option.

Centrifugo can export data to different ClickHouse instances, addresses of ClickHouse can be set over `clickhouse_analytics.clickhouse_dsn` option.

You also need to set a ClickHouse cluster name (`clickhouse_analytics.clickhouse_cluster`) and database name `clickhouse_analytics.clickhouse_database`.

`clickhouse_analytics.skip_schema_initialization` - boolean, default `false`. By default Centrifugo tries to initialize table schema on start (if not exists). This flag allows skipping initialization process.

`clickhouse_analytics.skip_ping_on_start` - boolean, default `false`. Centrifugo pings Clickhouse servers by default on start, if any of servers is unavailable – Centrifugo fails to start. This option allow skipping this check thus Centrifugo is able to start even if Clickhouse cluster not working correctly.

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
    `time` DateTime
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{cluster}/{shard}/connections', '{replica}')
PARTITION BY toYYYYMMDD(time)
ORDER BY time
TTL time + toIntervalDay(1)
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
    `time` DateTime
)
ENGINE = Distributed('centrifugo_cluster', 'centrifugo', 'connections', murmurHash3_64(client)) │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

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
TTL time + toIntervalDay(1)
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
    `time` DateTime
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{cluster}/{shard}/operations', '{replica}')
PARTITION BY toYYYYMMDD(time)
ORDER BY time
TTL time + toIntervalDay(1)
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
TTL time + toIntervalDay(1)
SETTINGS index_granularity = 8192 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

And distributed one:

```sql
SHOW CREATE TABLE centrifugo.publications_distributed;

┌─statement──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.operations_distributed
(
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
TTL time + toIntervalDay(1)
SETTINGS index_granularity = 8192 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

And distributed one:

```sql
SHOW CREATE TABLE centrifugo.notifications_distributed;

┌─statement──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.operations_distributed
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

Show number of unique users subscribed to a specific channel in last 5 minutes (this is approximate since subscriptions table contain periodic snapshot entries, clients could unsubscribe in between snapshots – this is reflected in operations table):

```sql
SELECT COUNT(Distinct(user))
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

But during development you may want to run Centrifugo with single instance ClickHouse.

To do this set only one ClickHouse dsn and do not set cluster name:

```json title="config.json"
{
    ...
    "clickhouse_analytics": {
        "enabled": true,
        "clickhouse_dsn": [
            "tcp://127.0.0.1:9000"
        ],
        "clickhouse_database": "centrifugo",
        "clickhouse_cluster": "",
        "export_connections": true,
        "export_subscriptions": true,
        "export_publications": true,
        "export_operations": true,
        "export_http_headers": [
            "Origin",
            "User-Agent"
        ]
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

When ClickHouse analytics enabled Centrifugo nodes start exporting events to ClickHouse. Each node issues insert with events once in 10 seconds (flushing collected events in batches thus making insertion in ClickHouse efficient). Maximum batch size is 100k for each table at the momemt. If insert to ClickHouse failed Centrifugo retries it once and then buffers events in memory (up to 1 million entries). If ClickHouse still unavailable after collecting 1 million events then new events will be dropped until buffer has space. These limits are configurable. Centrifugo PRO uses very efficient code for writing data to ClickHouse, so analytics feature should only add a little overhead for Centrifugo node.

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