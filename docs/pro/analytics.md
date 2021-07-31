---
id: analytics
title: Analytics with ClickHouse
---

This feature allows exporting information about connections, subscriptions and client operations to [ClickHouse](https://clickhouse.tech/) thus providing an integration with a real-time (with seconds delay) analytics storage. ClickHouse is super fast and simple to operate with, and it allows effective data keeping for a window of time.  

This unlocks a great observability and possibility to perform various analytics queries for better user behaviour understanding, check application correctness, building trends, reports and so on.

## Configuration

To enable integration with ClickHouse add the following section to a configuration file:

```json title="config.json"
{
    ...
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
        "export_connections": true,
        "export_operations": true,
        "export_http_headers": [
            "User-Agent",
            "Origin",
            "X-Real-Ip",
        ]
    }
}
```

All Clickhouse analytics options scoped to `clickhouse_analytics` section of configuration.

Toggle this feature using `enabled` boolean option.

Centrifugo can export data to different ClickHouse instances, addresses of ClickHouse can be set over `clickhouse_dsn` option.

You also need to set a Clickhouse cluster name (`clickhouse_cluster`) and database name `clickhouse_database`.

`export_connections` tells Centrifugo to export connection information snapshots. Information about connection will be exported once a connection established and then periodically while connection alive. See below on table structure to see which fields are available.

`export_operations` tells Centrifugo to export individual client operation information. See below on table structure to see which fields are available.

`export_http_headers` is a list of HTTP headers to export for connection information.

`export_grpc_metadata` is a list of metadata keys to export for connection information for GRPC unidirectional transport.

## Connections table

```sql
SHOW CREATE TABLE centrifugo.connections;

┌─statement───────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.connections
(
    `client` FixedString(36),
    `user` String,
    `name` String,
    `version` String,
    `transport` String,
    `channels` Array(String),
    `headers.key` Array(String),
    `headers.value` Array(String),
    `metadata.key` Array(String),
    `metadata.value` Array(String),
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
    `client` FixedString(36),
    `user` String,
    `name` String,
    `version` String,
    `transport` String,
    `channels` Array(String),
    `headers.key` Array(String),
    `headers.value` Array(String),
    `metadata.key` Array(String),
    `metadata.value` Array(String),
    `time` DateTime
)
ENGINE = Distributed('centrifugo_cluster', 'centrifugo', 'connections', murmurHash3_64(client)) │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Operations table

```sql
SHOW CREATE TABLE centrifugo.operations;

┌─statement──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CREATE TABLE centrifugo.operations
(
    `client` FixedString(36),
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
    `client` FixedString(36),
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

Show number of unique users subscribed to a specific channel in last 5 minutes (this is approximate since connections table contain periodic snapshot entries, clients could subscribe/unsubscribe in between snapshots – this is reflected in operations table):

```sql
SELECT COUNT(Distinct(user))
FROM centrifugo.connections_distributed
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

## Development

The recommended way to run ClickHouse in prodiction is with cluster. But during development you may want to run Centrifugo with single instance Clickhouse.

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
docker run -it --rm -v /tmp/clickhouse:/var/lib/clickhouse -p 9000:9000 --name click yandex/clickhouse-server
```

Run ClickHouse client:

```bash
docker run -it --rm --link click:clickhouse-server yandex/clickhouse-client --host clickhouse-server
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
