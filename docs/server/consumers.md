---
id: consumers
sidebar_label: Async consumers
title: Built-in API command async consumers
---

In [server API](./server_api.md) chapter we've shown how to execute various Centrifugo server API commands (publish, broadcast, etc.) over HTTP or GRPC. In many cases you will call those APIs from your application business logic synchronously. But to deal with temporary network and availability issues, and achieve reliable execution of API commands upon changes in your primary application database you may want to use queuing techniques and call Centrifugo API asynchronously.

Asynchronous delivery of real-time events upon changes in primary database may be done is several ways. Some companies use transactional outbox pattern, some using techniques like Kafka Connect with CDC (Change Data Capture) approach. The fact Centrifugo provides API allows users to implement any of those techniques and build worker which will send API commands to Centrifugo reliably.

But Centrifugo also provides some built-in asynchronous consumers to simplify the integration process.

## Supported consumers

The following built-in async consumers are available at this point:

* [from PostgreSQL outbox table](#postgresql-outbox-consumer)
* [from Kafka topics](#kafka-consumer)
* [from Nats Jetstream](#nats-jetstream)
* [from Redis Streams](#redis-stream)
* [from Google Cloud PUB/SUB](#google-cloud-pubsub)
* [from AWS SQS](#aws-sqs)
* [from Azure Service Bus](#azure-service-bus)

Again, while built-in consumers can simplify integration, you still can use whatever queue system you need and integrate your own consumer with Centrifugo sending requests to [server API](./server_api.md).

We also recommend looking at [Pitfalls of async publishing](/blog/2023/08/19/asynchronous-message-streaming-to-centrifugo-with-benthos#pitfalls-of-async-publishing) part in our previous blog post – while in many cases you get reliable at least once processing, you may come across some pitfalls in the process, being prepared and understanding them is important. Then depending on the real-time feature you can decide which approach is better – synchronous publishing or asynchronous integration.

## How consumers work

By default, consumers expect to consume messages which represent Centrifugo [server API commands](../server/server_api.md). I.e. while in synchronous server API you are using HTTP or GRPC to send commands – with asynchronous consumers you are inserting API command to PostgreSQL outbox table, or delivering to Kafka topic – and it will be soon consumed and processed asynchronously by Centrifugo.

Async consumers only process commands which modify state – such as [publish](./server_api.md#publish), [broadcast](./server_api.md#broadcast), [unsubscribe](../server/server_api.md#unsubscribe), [disconnect](../server/server_api.md#disconnect), etc. Sending read commands for async execution simply does not make any sense, and they will be ignored. Also, [batch](../server/server_api.md#batch) method is not supported.

Centrifugo **only supports JSON payloads for asynchronous commands coming to consumers for now**. If you need binary format – reach out with your use case.

If Centrifugo encounters an error while processing consumed messages – then internal errors will be retried, all other errors logged on `error` level – and the message will be marked as processed. The processing logic for [broadcast](./server_api.md#broadcast) API is special: if any of the publications to any channel from broadcast `channels` array failed – then the entire broadcast command will be retried. To prevent duplicate messages being published during such retries – consider using `idempotency_key` in the broadcast command.

:::tip

Our [Chat/Messenger tutorial](../tutorial/outbox_cdc.md) shows PostgreSQL outbox and Kafka consumer in action. It also shows techniques to avoid duplicate messages (idempotent publications) and deal with late message delivery (idempotent processing on client side). Whether you need those techniques – depends on the nature of app. Various real-time features may require different ways of sending real-time events. Both synchronous API calls and async calls have its own advantages and trade-offs. We also talk about this in [Asynchronous message streaming to Centrifugo with Benthos](/blog/2023/08/19/asynchronous-message-streaming-to-centrifugo-with-benthos) blog post.

:::

## Publication data mode

As mentioned, Centrifugo expects server API commands in received message content. Once the command consumed – it's processed in the same way as HTTP or GRPC server APIs process the request.

Sometimes though, you may have a system that already produces messages in a format ready to be published into Centrifugo channels. Most Centrifugo async consumers have a special mode to consume publications – called **Publication Data Mode**. In that case, payload of message must contain a data ready to be published into Centrifugo channels. Users can provide Centrifugo-specific publication fields like a list of channels to publish into in message headers/attributes. See documentation of each specific consumer to figure out exact option names. For example, Kafka consumer [has publication data mode](#publication-data-mode). And similar for other consumers.

Note, since you can provide many consumers in Centrifugo configuration - it's totally possible to have consumers working in different modes.

## Ordering guarantees

Carefully read specific consumer documentation for understanding message processing ordering properties – ordered processing can be achieved with some of them, and can not with others.

## How to enable

Consumers can be set in the configuration using `consumers` array:

```json title="config.json"
{
  "consumers": [
    {
      "enabled": true,
      "name": "xxx",
      "type": "postgresql",
      "postgresql": {...}
    },
    {
      "enabled": true,
      "name": "yyy",
      "type": "kafka",
      "kafka": {...}
    }
  ]
}
```

## `consumers[]`

So consumers may be configured using `consumers` array on configuration top level.

On top level each consumer object in the `consumers` array has the following configuration options.

### `consumers[].enabled`

Boolean. Default: `false`.

When set to `true` allows enabling the configured consumer.

### `consumers[].name`

String. Default: `""`. Required.

Describes name of consumer. Must be unique for each consumer and match the regex `^[a-zA-Z0-9_]{2,}` - i.e. latin symbols, digits and underscores and be at least 2 symbols. This name will be used for logging purposes, metrics, also to override some options with environment variables.

### `consumers[].type`

String. Default: `""`. Required.

Type of consumer. At this point can be:

* `postgresql`
* `kafka`

## Configure via env vars

To provide `consumers` over environment variable provide `CENTRIFUGO_CONSUMERS` var with JSON array serialized to string.

It's also possible to override consumer options over environment variables by using the name of consumer. For example:

```
CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_<OPTION_NAME>="???"
```

Or for specific type configuration:

```
CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_POSTGRESQL_<OPTION_NAME2>="???"
```

## PostgreSQL outbox consumer

Centrifugo can natively integrate with PostgreSQL table for [Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html) pattern. The table in PostgreSQL must have predefined format Centrifugo expects:

```sql
CREATE TABLE IF NOT EXISTS centrifugo_outbox (
	id BIGSERIAL PRIMARY KEY,
	method text NOT NULL,
	payload JSONB NOT NULL,
	partition INTEGER NOT NULL default 0,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
```

Then configure consumer of `postgresql` type in Centrifugo config:

```json
{
  ...
  "consumers": [
    {
      "enabled": true,
      "name": "my_postgresql_consumer",
      "type": "postgresql",
      "postgresql": {
        "dsn": "postgresql://user:password@localhost:5432/db",
        "outbox_table_name": "centrifugo_outbox",
        "num_partitions": 1,
        "partition_select_limit": 100,
        "partition_poll_interval": "300ms"
      }
    }
  ]
}
```

Here is how you can insert row in outbox table to publish into Centrifugo channel:

```SQL
INSERT INTO centrifugo_outbox (method, payload, partition)
VALUES ('publish', '{"channel": "updates", "data": {"text": "Hello, world!"}}', 0);
```

Centrifugo supports LISTEN/NOTIFY mechanism of PostgreSQL to be notified about new data in the outbox table. To enable it you need first create a trigger in PostgreSQL:

```sql
CREATE OR REPLACE FUNCTION centrifugo_notify_partition_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('centrifugo_partition_change', NEW.partition::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER centrifugo_notify_partition_trigger
AFTER INSERT ON chat_outbox
FOR EACH ROW
EXECUTE FUNCTION centrifugo_notify_partition_change();
```

And then update consumer config – add `"partition_notification_channel"` option to it:

```json
{
  ...
  "consumers": [
    {
      "enabled": true,
      "name": "my_postgresql_consumer",
      "type": "postgresql",
      "postgresql": {
        ...
        "partition_notification_channel": "centrifugo_partition_change"
      }
    }
  ]
}
```

## `consumers[].postgresql`

Options for consumer of `postgresql` type.

### `consumers[].postgresql.dsn`

String. Default: `""`. Required.

DSN to PostgreSQL database, ex. `"postgresql://user:password@localhost:5432/db"`. To override `dsn` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_POSTGRESQL_DSN`.

### `consumers[].postgresql.outbox_table_name`

String. Default: `""`. Required.

The name of outbox table in selected database, ex. `"centrifugo_outbox"`.

### `consumers[].postgresql.num_partitions`

Integer. Default: `1`.

The number of partitions to use. Centrifugo keeps strict order of commands per-partition by default. This option provides a way to create concurrent consumers each consuming from different partition of outbox table. Note, that partition numbers in start with `0`, so when using `1` as `num_partitions` insert data with `partition` == `0` to the outbox table.

### `consumers[].postgresql.partition_select_limit`

Integer. Default: `100`.

Max number of commands to select in one query to outbox table.

### `consumers[].postgresql.partition_poll_interval`

[Duration](./configuration.md#duration-type). Default: `"300ms"`.

Polling interval for each partition.

### `consumers[].postgresql.partition_notification_channel`

String. Default: `""`.

Optional name of LISTEN/NOTIFY channel to trigger consuming upon data added to outbox partition.

### `consumers[].postgresql.tls`

[TLS object](./configuration.md#tls-config-object). By default, no TLS is used.

Client TLS configuration for PostgreSQL connection.

### `consumers[].postgresql.use_try_lock`

Boolean. Default: `false`.

Use `pg_try_advisory_xact_lock` instead of `pg_advisory_xact_lock` for locking outbox table. This may help to reduce the number of longer-running transactions on PG side.

## Kafka consumer

Another built-in consumer – is Kafka topics consumer. To configure Centrifugo to consume Kafka topic:

```json title="config.json"
{
  "consumers": [
    {
      "enabled": true,
      "name": "my_kafka_consumer",
      "type": "kafka",
      "kafka": {
        "brokers": ["localhost:9092"],
        "topics": ["postgres.public.chat_cdc"],
        "consumer_group": "centrifugo"
      }
    }
  ]
}
```

Then simply put message in the following format to Kafka topic:

```json
{
  "method": "publish",
  "payload": {
    "channel": "mychannel",
    "data": {}
  }
}
```

– and it will be consumed by Centrifugo and reliably processed.

Centrifugo preserves processing order within Kafka partitions.

## `consumers[].kafka`

Options for consumer of `kafka` type.

### `consumers[].kafka.brokers`

Array of string. Required.

Points Centrifugo to Kafka brokers. To override `brokers` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_KAFKA_BROKERS` – string with broker addresses separated by space.

### `consumers[].kafka.topics`

Array of string. Required.

Tells which topics to consume.

### `consumers[].kafka.consumer_group`

String. Required.

Sets the name of consumer group to use.

### `consumers[].kafka.max_poll_records`

Integer. Default: `100`.

Sets the maximum number of records to fetch from Kafka during a single poll operation.

### `consumers[].kafka.fetch_max_bytes`

Integer. Default: `52428800` (50MB).

Sets the maximum number of bytes to fetch from Kafka in a single request. In many cases setting this to lower value can help with aggressive Kafka client memory usage under load.

### `consumers[].kafka.fetch_max_wait`

Type: `Duration`. Default: `500ms`. New in Centrifugo v6.2.3

Sets the maximum time to wait for records when polling.

### `consumers[].kafka.fetch_read_uncommitted`

Boolean. Default: `false`. New in Centrifugo v6.2.3

If set to `true`, the consumer will read uncommitted messages from Kafka. By default, it uses `ReadCommitted` mode.

### `consumers[].kafka.sasl_mechanism`

String. Default: `""`.

SASL mechanism to use: `"plain"`, `"scram-sha-256"`, `"scram-sha-512"`, `"aws-msk-iam"` are supported. Note, in case of `"aws-msk-iam"` Centrifugo uses `sasl_user` and `sasl_password` options as `access key` and `secret key` when configuring AWS auth.

### `consumers[].kafka.sasl_user`

String. Default: `""`.

User for plain SASL auth. To override `sasl_user` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_KAFKA_SASL_USER`.

### `consumers[].kafka.sasl_password`

String. Default: `""`.

Password for plain SASL auth. To override `sasl_password` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_KAFKA_SASL_PASSWORD`.

### `consumers[].kafka.tls`

[TLSConfig](./tls.md#unified-tls-config-object) to configure Kafka client TLS.

### `consumers[].kafka.publication_data_mode`

Publication data mode for Kafka consumer simplifies integrating Centrifugo with existing Kafka topics. By default, Centrifugo can integrate with Kafka topics but requires a special payload format, where each message in the topic represented a Centrifugo API command. This approach works well for Kafka topics specifically set up for Centrifugo.

When **Publication Data Mode** is enabled, Centrifugo expects messages in Kafka topics to contain data ready for direct publication, rather than server API commands. It is also possible to use special Kafka headers to specify the channels to which the data should be published.

The primary goal of this mode is to simplify Centrifugo's integration with existing Kafka topics, making it easier to deliver real-time messages to clients without needing to restructure the topic's payload format.

BTW, don't forget that since Centrifugo allows configuring an array of asynchronous consumers, it is possible to use Kafka consumers in different modes simultaneously.

To enable publication data mode:

```json title="config.json"
{
  "consumers": [
    {
      "enabled": true,
      "name": "my_kafka_consumer",
      "type": "kafka",
      "kafka": {
        "brokers": ["localhost:9092"],
        "topics": ["my_topic"],
        "consumer_group": "centrifugo",
        "publication_data_mode": {
          "enabled": true,
          "channels_header": "x-centrifugo-channels"
          "idempotency_key_header": "x-centrifugo-idempotency-key"
        }
      }
    }
  ]
}
```

As you can see, channels to forward publication to may be provided as a value of a configured header. So you don't need to change payloads in topic to transform them to real-time messages with Centrifugo.

### `consumers[].kafka.publication_data_mode.enabled`

Boolean. Default: `false`.

Enables Kafka publication data mode for the Kafka consumer.

### `consumers[].kafka.publication_data_mode.channels_header`

String. Default: `""`.

Header name to extract channels to publish data into (channels must be comma-separated). Ex. of value: `"channel1,channel2"`.

### `consumers[].kafka.publication_data_mode.idempotency_key_header`

String. Default: `""`.

Header name to extract Publication idempotency key from Kafka message. See [PublishRequest](./server_api.md#publishrequest).

### `consumers[].kafka.publication_data_mode.delta_header`

String. Default: `""`.

Header name to extract Publication delta flag from Kafka message which tells Centrifugo whether to use delta compression for message or not. See [delta compression](./delta_compression.md) and [PublishRequest](./server_api.md#publishrequest).

### Compatibility with Redpanda

Our local test suite for Kafka consumer passed with [Redpanda](https://www.redpanda.com/) v24.3.6, so it's generally compatible.

## Nats Jetstream

Consumer from [Nats Jetstream](https://docs.nats.io/nats-concepts/jetstream).

Note, message processing is unordered in case you have multiple Centrifugo instances consuming from Nats Jetstream (but possible if only one instance of Centrifugo consumes).

:::warning

Keep in mind, that Centrifugo does not create Nats Jetstream streams, it consumes from pre-created streams. Pay attention to a situation when Nats Jetstream streams are created in-memory or inside temporary directory of operating system. In such cases Nats streams may be unexpectedly lost at some point – this is a common mistake when working with Nats Jetstream.

:::

## `consumers[].nats_jetstream`

Type: `NatsJetStreamConsumerConfig` object

`nats_jetstream` allows defining options for consumer of `nats_jetstream` type.

### `consumers[].nats_jetstream.url`

Type: `string`. Default: `nats://127.0.0.1:4222`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_URL`

`url` is the address of the NATS server.

### `consumers[].nats_jetstream.credentials_file`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_CREDENTIALS_FILE`

`credentials_file` is the path to a NATS credentials file used for authentication (nats.UserCredentials).
If provided, it overrides username/password and token.

### `consumers[].nats_jetstream.username`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_USERNAME`

`username` is used for basic authentication (along with Password) if CredentialsFile is not provided.

### `consumers[].nats_jetstream.password`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_PASSWORD`

`password` is used with Username for basic authentication.

### `consumers[].nats_jetstream.token`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_TOKEN`

`token` is an alternative authentication mechanism if CredentialsFile and Username are not provided.

### `consumers[].nats_jetstream.stream_name`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_STREAM_NAME`

`stream_name` is the name of the NATS JetStream stream to use.

### `consumers[].nats_jetstream.subjects`

Type: `[]string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_SUBJECTS`

`subjects` is the list of NATS subjects (topics) to filter.

### `consumers[].nats_jetstream.durable_consumer_name`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_DURABLE_CONSUMER_NAME`

`durable_consumer_name` sets the name of the durable JetStream consumer to use.

### `consumers[].nats_jetstream.deliver_policy`

Type: `string`. Default: `new`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_DELIVER_POLICY`

`deliver_policy` is the NATS JetStream delivery policy for the consumer. By default, it is set to "new". Possible values: `new`, `all`.

### `consumers[].nats_jetstream.max_ack_pending`

Type: `int`. Default: `100`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_MAX_ACK_PENDING`

`max_ack_pending` is the maximum number of unacknowledged messages that can be pending for the consumer.

### `consumers[].nats_jetstream.method_header`

Type: `string`. Default: `centrifugo-method`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_METHOD_HEADER`

`method_header` is the NATS message header used to extract the method name for dispatching commands.
If provided in message, then payload must be just a serialized API request object.

### `consumers[].nats_jetstream.publication_data_mode`

Type: `NatsJetStreamPublicationDataModeConfig` object

`publication_data_mode` configures extraction of pre-formatted publication data from message headers.

#### `consumers[].nats_jetstream.publication_data_mode.enabled`

Type: `bool`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_PUBLICATION_DATA_MODE_ENABLED`

`enabled` toggles publication data mode.

#### `consumers[].nats_jetstream.publication_data_mode.channels_header`

Type: `string`. Default: `centrifugo-channels`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_PUBLICATION_DATA_MODE_CHANNELS_HEADER`

`channels_header` is the name of the header that contains comma-separated channel names.

#### `consumers[].nats_jetstream.publication_data_mode.idempotency_key_header`

Type: `string`. Default: `centrifugo-idempotency-key`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_PUBLICATION_DATA_MODE_IDEMPOTENCY_KEY_HEADER`

`idempotency_key_header` is the name of the header that contains an idempotency key for deduplication.

#### `consumers[].nats_jetstream.publication_data_mode.delta_header`

Type: `string`. Default: `centrifugo-delta`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_PUBLICATION_DATA_MODE_DELTA_HEADER`

`delta_header` is the name of the header indicating whether the message represents a delta (partial update).

#### `consumers[].nats_jetstream.publication_data_mode.version_header`

Type: `string`. Default: `centrifugo-version`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_PUBLICATION_DATA_MODE_VERSION_HEADER`

`version_header` is the name of the header that contains the version of the message.

#### `consumers[].nats_jetstream.publication_data_mode.version_epoch_header`

Type: `string`. Default: `centrifugo-version-epoch`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_PUBLICATION_DATA_MODE_VERSION_EPOCH_HEADER`

`version_epoch_header` is the name of the header that contains the version epoch of the message.

#### `consumers[].nats_jetstream.publication_data_mode.tags_header_prefix`

Type: `string`. Default: `centrifugo-tag-`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_NATS_JETSTREAM_PUBLICATION_DATA_MODE_TAGS_HEADER_PREFIX`

`tags_header_prefix` is the prefix used to extract dynamic tags from message headers.

### `consumers[].nats_jetstream.tls`

Type: `TLSConfig` object

[TLS object](./configuration.md#tls-config-object). By default, no TLS is used.

## Redis Stream

Note, message processing is unordered in case you have multiple Centrifugo instances consuming from Redis Stream (but possible if only one instance of Centrifugo consumes and `num_workers` is `1`).

## `consumers[].redis_stream`

Type: `RedisStreamConsumerConfig` object

`redis_stream` allows defining options for consumer of redis_stream type.

### `consumers[].redis_stream.address`

Type: `[]string`. Default: `redis://127.0.0.1:6379`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_ADDRESS`

`address` is a list of Redis shard addresses. In most cases a single shard is used. But when many
addresses provided Centrifugo will distribute keys between shards using consistent hashing.

### `consumers[].redis_stream.connect_timeout`

Type: `Duration`. Default: `1s`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_CONNECT_TIMEOUT`

`connect_timeout` is a timeout for establishing connection to Redis.

### `consumers[].redis_stream.io_timeout`

Type: `Duration`. Default: `4s`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_IO_TIMEOUT`

`io_timeout` is a timeout for all read/write operations against Redis (can be considered as a request timeout).

### `consumers[].redis_stream.db`

Type: `int`. Default: `0`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_DB`

`db` is a Redis database to use. Generally it's not recommended to use non-zero DB. Note, that Redis
PUB/SUB is global for all databases in a single Redis instance. So when using non-zero DB make sure
that different Centrifugo setups use different prefixes.

### `consumers[].redis_stream.user`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_USER`

`user` is a Redis user.

### `consumers[].redis_stream.password`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_PASSWORD`

`password` is a Redis password.

### `consumers[].redis_stream.client_name`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_CLIENT_NAME`

`client_name` allows changing a Redis client name used when connecting.

### `consumers[].redis_stream.force_resp2`

Type: `bool`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_FORCE_RESP2`

`force_resp2` forces use of Redis Resp2 protocol for communication.

### `consumers[].redis_stream.cluster_address`

Type: `[]string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_CLUSTER_ADDRESS`

`cluster_address` is a list of Redis cluster addresses. When several provided - data will be sharded
between them using consistent hashing. Several Cluster addresses within one shard may be passed
comma-separated.

### `consumers[].redis_stream.tls`

Type: `TLSConfig` object

[TLS object](./configuration.md#tls-config-object). By default, no TLS is used.

### `consumers[].redis_stream.sentinel_address`

Type: `[]string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_SENTINEL_ADDRESS`

`sentinel_address` allows setting Redis Sentinel addresses. When provided - Sentinel will be used.
When multiple addresses provided - data will be sharded between them using consistent hashing.
Several Sentinel addresses within one shard may be passed comma-separated.

### `consumers[].redis_stream.sentinel_user`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_SENTINEL_USER`

`sentinel_user` is a Redis Sentinel user.

### `consumers[].redis_stream.sentinel_password`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_SENTINEL_PASSWORD`

`sentinel_password` is a Redis Sentinel password.

### `consumers[].redis_stream.sentinel_master_name`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_SENTINEL_MASTER_NAME`

`sentinel_master_name` is a Redis master name in Sentinel setup.

### `consumers[].redis_stream.sentinel_client_name`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_SENTINEL_CLIENT_NAME`

`sentinel_client_name` is a Redis Sentinel client name used when connecting.

### `consumers[].redis_stream.sentinel_tls`

Type: `TLSConfig` object

[TLS object](./configuration.md#tls-config-object). By default, no TLS is used.

### `consumers[].redis_stream.streams`

Type: `[]string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_STREAMS`

`streams` to consume.

### `consumers[].redis_stream.consumer_group`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_CONSUMER_GROUP`

`consumer_group` name to use.

### `consumers[].redis_stream.visibility_timeout`

Type: `Duration`. Default: `30s`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_VISIBILITY_TIMEOUT`

`visibility_timeout` is the time to wait for a message to be processed before it is re-queued.

### `consumers[].redis_stream.num_workers`

Type: `int`. Default: `1`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_NUM_WORKERS`

`num_workers` is the number of message workers to use for processing for each stream.

### `consumers[].redis_stream.payload_value`

Type: `string`. Default: `payload`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_PAYLOAD_VALUE`

`payload_value` is used to extract data from Redis Stream message.

### `consumers[].redis_stream.method_value`

Type: `string`. Default: `method`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_METHOD_VALUE`

`method_value` is used to extract a method for command messages.
If provided in message, then payload must be just a serialized API request object.

### `consumers[].redis_stream.publication_data_mode`

Type: `RedisStreamPublicationDataModeConfig` object

`publication_data_mode` configures publication data mode.

#### `consumers[].redis_stream.publication_data_mode.enabled`

Type: `bool`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_PUBLICATION_DATA_MODE_ENABLED`

`enabled` toggles publication data mode.

#### `consumers[].redis_stream.publication_data_mode.channels_value`

Type: `string`. Default: `centrifugo-channels`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_PUBLICATION_DATA_MODE_CHANNELS_VALUE`

`channels_value` is used to extract channels to publish data into (channels must be comma-separated).

#### `consumers[].redis_stream.publication_data_mode.idempotency_key_value`

Type: `string`. Default: `centrifugo-idempotency-key`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_PUBLICATION_DATA_MODE_IDEMPOTENCY_KEY_VALUE`

`idempotency_key_value` is used to extract Publication idempotency key from Redis Stream message.

#### `consumers[].redis_stream.publication_data_mode.delta_value`

Type: `string`. Default: `centrifugo-delta`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_PUBLICATION_DATA_MODE_DELTA_VALUE`

`delta_value` is used to extract Publication delta flag from Redis Stream message.

#### `consumers[].redis_stream.publication_data_mode.version_value`

Type: `string`. Default: `centrifugo-version`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_PUBLICATION_DATA_MODE_VERSION_VALUE`

`version_value` is used to extract Publication version from Redis Stream message.

#### `consumers[].redis_stream.publication_data_mode.version_epoch_value`

Type: `string`. Default: `centrifugo-version-epoch`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_PUBLICATION_DATA_MODE_VERSION_EPOCH_VALUE`

`version_epoch_value` is used to extract Publication version epoch from Redis Stream message.

#### `consumers[].redis_stream.publication_data_mode.tags_value_prefix`

Type: `string`. Default: `centrifugo-tag-`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_REDIS_STREAM_PUBLICATION_DATA_MODE_TAGS_VALUE_PREFIX`

`tags_value_prefix` is used to extract Publication tags from Redis Stream message.

## Google Cloud PUB/SUB

Consumer from [Google Cloud PUB/SUB](https://cloud.google.com/pubsub/docs).

Ordered processing is possible if OrderingKey is used and subscription created with ordering enabled. See in [Google PUB/SUB docs](https://cloud.google.com/pubsub/docs/ordering)

## `consumers[].google_pub_sub`

Type: `GooglePubSubConsumerConfig` object

`google_pub_sub` allows defining options for consumer of google_pub_sub type.

### `consumers[].google_pub_sub.project_id`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_PROJECT_ID`

Google Cloud project ID.

### `consumers[].google_pub_sub.subscriptions`

Type: `[]string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_SUBSCRIPTIONS`

`subscriptions` is the list of Pub/Sub subscription ids to consume from.

### `consumers[].google_pub_sub.max_outstanding_messages`

Type: `int`. Default: `100`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_MAX_OUTSTANDING_MESSAGES`

`max_outstanding_messages` controls the maximum number of unprocessed messages.

### `consumers[].google_pub_sub.max_outstanding_bytes`

Type: `int`. Default: `1000000`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_MAX_OUTSTANDING_BYTES`

`max_outstanding_bytes` controls the maximum number of unprocessed bytes.

### `consumers[].google_pub_sub.auth_mechanism`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_AUTH_MECHANISM`

`auth_mechanism` specifies which authentication mechanism to use:
"default", "service_account".

### `consumers[].google_pub_sub.credentials_file`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_CREDENTIALS_FILE`

`credentials_file` is the path to the service account JSON file if required.

### `consumers[].google_pub_sub.method_attribute`

Type: `string`. Default: `centrifugo-method`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_METHOD_ATTRIBUTE`

`method_attribute` is an attribute name to extract a method name from the message.
If provided in message, then payload must be just a serialized API request object.

### `consumers[].google_pub_sub.publication_data_mode`

Type: `GooglePubSubPublicationDataModeConfig` object

`publication_data_mode` holds settings for the mode where message payload already contains data
ready to publish into channels.

#### `consumers[].google_pub_sub.publication_data_mode.enabled`

Type: `bool`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_PUBLICATION_DATA_MODE_ENABLED`

`enabled` enables publication data mode.

#### `consumers[].google_pub_sub.publication_data_mode.channels_attribute`

Type: `string`. Default: `centrifugo-channels`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_PUBLICATION_DATA_MODE_CHANNELS_ATTRIBUTE`

`channels_attribute` is the attribute name containing comma-separated channel names.

#### `consumers[].google_pub_sub.publication_data_mode.idempotency_key_attribute`

Type: `string`. Default: `centrifugo-idempotency-key`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_PUBLICATION_DATA_MODE_IDEMPOTENCY_KEY_ATTRIBUTE`

`idempotency_key_attribute` is the attribute name for an idempotency key.

#### `consumers[].google_pub_sub.publication_data_mode.delta_attribute`

Type: `string`. Default: `centrifugo-delta`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_PUBLICATION_DATA_MODE_DELTA_ATTRIBUTE`

`delta_attribute` is the attribute name for a delta flag.

#### `consumers[].google_pub_sub.publication_data_mode.version_attribute`

Type: `string`. Default: `centrifugo-version`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_PUBLICATION_DATA_MODE_VERSION_ATTRIBUTE`

`version_attribute` is the attribute name for a version.

#### `consumers[].google_pub_sub.publication_data_mode.version_epoch_attribute`

Type: `string`. Default: `centrifugo-version-epoch`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_PUBLICATION_DATA_MODE_VERSION_EPOCH_ATTRIBUTE`

`version_epoch_attribute` is the attribute name for a version epoch.

#### `consumers[].google_pub_sub.publication_data_mode.tags_attribute_prefix`

Type: `string`. Default: `centrifugo-tag-`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_GOOGLE_PUB_SUB_PUBLICATION_DATA_MODE_TAGS_ATTRIBUTE_PREFIX`

`tags_attribute_prefix` is the prefix for attributes containing tags.

## AWS SQS

Consumer from Amazon [Simple Queue Service](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html).

Ordered processing is possible with FIFO queue and when using group IDs. See [in AWS docs](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues-understanding-logic.html).

## `consumers[].aws_sqs`

Type: `AwsSqsConsumerConfig` object

`aws_sqs` allows defining options for consumer of aws_sqs type.

### `consumers[].aws_sqs.queues`

Type: `[]string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_QUEUES`

`queues` is a list of SQS queue URLs to consume.

### `consumers[].aws_sqs.sns_envelope`

Type: `bool`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_SNS_ENVELOPE`

`sns_envelope`, when true, expects messages to be wrapped in an SNS envelope – this is required when
consuming from SNS topics with SQS subscriptions.

### `consumers[].aws_sqs.region`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_REGION`

`region` is the AWS region.

### `consumers[].aws_sqs.max_number_of_messages`

Type: `int32`. Default: `10`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_MAX_NUMBER_OF_MESSAGES`

`max_number_of_messages` is the maximum number of messages to receive per poll.

### `consumers[].aws_sqs.wait_time_time`

Type: `Duration`. Default: `20s`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_WAIT_TIME_TIME`

`wait_time_time` is the long-poll wait time. Rounded to seconds internally.

### `consumers[].aws_sqs.visibility_timeout`

Type: `Duration`. Default: `30s`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_VISIBILITY_TIMEOUT`

`visibility_timeout` is the time a message is hidden from other consumers. Rounded to seconds internally.

### `consumers[].aws_sqs.max_concurrency`

Type: `int`. Default: `1`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_MAX_CONCURRENCY`

`max_concurrency` defines max concurrency during message batch processing.

### `consumers[].aws_sqs.credentials_profile`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_CREDENTIALS_PROFILE`

`credentials_profile` is a shared credentials profile to use.

### `consumers[].aws_sqs.assume_role_arn`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_ASSUME_ROLE_ARN`

`assume_role_arn`, if provided, will cause the consumer to assume the given IAM role.

### `consumers[].aws_sqs.method_attribute`

Type: `string`. Default: `centrifugo-method`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_METHOD_ATTRIBUTE`

`method_attribute` is the attribute name to extract a method for command messages.
If provided in message, then payload must be just a serialized API request object.

### `consumers[].aws_sqs.localstack_endpoint`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_LOCALSTACK_ENDPOINT`

`localstack_endpoint` if set enables using localstack with provided URL.

### `consumers[].aws_sqs.publication_data_mode`

Type: `AWSPublicationDataModeConfig` object

`publication_data_mode` holds settings for the mode where message payload already contains data
ready to publish into channels.

#### `consumers[].aws_sqs.publication_data_mode.enabled`

Type: `bool`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_PUBLICATION_DATA_MODE_ENABLED`

`enabled` enables publication data mode.

#### `consumers[].aws_sqs.publication_data_mode.channels_attribute`

Type: `string`. Default: `centrifugo-channels`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_PUBLICATION_DATA_MODE_CHANNELS_ATTRIBUTE`

`channels_attribute` is the attribute name containing comma-separated channel names.

#### `consumers[].aws_sqs.publication_data_mode.idempotency_key_attribute`

Type: `string`. Default: `centrifugo-idempotency-key`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_PUBLICATION_DATA_MODE_IDEMPOTENCY_KEY_ATTRIBUTE`

`idempotency_key_attribute` is the attribute name for an idempotency key.

#### `consumers[].aws_sqs.publication_data_mode.delta_attribute`

Type: `string`. Default: `centrifugo-delta`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_PUBLICATION_DATA_MODE_DELTA_ATTRIBUTE`

`delta_attribute` is the attribute name for a delta flag.

#### `consumers[].aws_sqs.publication_data_mode.version_attribute`

Type: `string`. Default: `centrifugo-version`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_PUBLICATION_DATA_MODE_VERSION_ATTRIBUTE`

`version_attribute` is the attribute name for a version of publication.

#### `consumers[].aws_sqs.publication_data_mode.version_epoch_attribute`

Type: `string`. Default: `centrifugo-version-epoch`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_PUBLICATION_DATA_MODE_VERSION_EPOCH_ATTRIBUTE`

`version_epoch_attribute` is the attribute name for a version epoch of publication.

#### `consumers[].aws_sqs.publication_data_mode.tags_attribute_prefix`

Type: `string`. Default: `centrifugo-tag-`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AWS_SQS_PUBLICATION_DATA_MODE_TAGS_ATTRIBUTE_PREFIX`

`tags_attribute_prefix` is the prefix for attributes containing tags.

## Azure Service Bus

Consumer from [Azure Service Bus](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-messaging-overview).

Ordered processing is possible when using message sessions.

## `consumers[].azure_service_bus`

Type: `AzureServiceBusConsumerConfig` object

`azure_service_bus` allows defining options for consumer of `azure_service_bus` type.

### `consumers[].azure_service_bus.connection_string`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_CONNECTION_STRING`

`connection_string` is the full connection string used for connection-string–based authentication.

### `consumers[].azure_service_bus.use_azure_identity`

Type: `bool`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_USE_AZURE_IDENTITY`

`use_azure_identity` toggles Azure Identity (AAD) authentication instead of connection strings.

### `consumers[].azure_service_bus.fully_qualified_namespace`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE`

`fully_qualified_namespace` is the Service Bus namespace, e.g. "your-namespace.servicebus.windows.net".

### `consumers[].azure_service_bus.tenant_id`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_TENANT_ID`

`tenant_id` is the Azure Active Directory tenant ID used with Azure Identity.

### `consumers[].azure_service_bus.client_id`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_CLIENT_ID`

`client_id` is the Azure AD application (client) ID used for authentication.

### `consumers[].azure_service_bus.client_secret`

Type: `string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_CLIENT_SECRET`

`client_secret` is the secret associated with the Azure AD application.

### `consumers[].azure_service_bus.queues`

Type: `[]string`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_QUEUES`

`queues` is the list of the Azure Service Bus queues to consume from.

### `consumers[].azure_service_bus.use_sessions`

Type: `bool`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_USE_SESSIONS`

`use_sessions` enables session-aware message handling.
All messages must include a SessionID; messages within the same session will be processed in order.

### `consumers[].azure_service_bus.max_concurrent_calls`

Type: `int`. Default: `1`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_MAX_CONCURRENT_CALLS`

`max_concurrent_calls` controls the maximum number of messages processed concurrently.

### `consumers[].azure_service_bus.max_receive_messages`

Type: `int`. Default: `1`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_MAX_RECEIVE_MESSAGES`

`max_receive_messages` sets the batch size when receiving messages from the queue.

### `consumers[].azure_service_bus.method_property`

Type: `string`. Default: `centrifugo-method`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_METHOD_PROPERTY`

`method_property` is the name of the message property used to extract the method (for API command).
If provided in message, then payload must be just a serialized API request object.

### `consumers[].azure_service_bus.publication_data_mode`

Type: `AzureServiceBusPublicationDataModeConfig` object

`publication_data_mode` configures how structured publication-ready data is extracted from the message.

#### `consumers[].azure_service_bus.publication_data_mode.enabled`

Type: `bool`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_PUBLICATION_DATA_MODE_ENABLED`

`enabled` toggles the publication data mode.

#### `consumers[].azure_service_bus.publication_data_mode.channels_property`

Type: `string`. Default: `centrifugo-channels`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_PUBLICATION_DATA_MODE_CHANNELS_PROPERTY`

`channels_property` is the name of the message property that contains the list of target channels.

#### `consumers[].azure_service_bus.publication_data_mode.idempotency_key_property`

Type: `string`. Default: `centrifugo-idempotency-key`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_PUBLICATION_DATA_MODE_IDEMPOTENCY_KEY_PROPERTY`

`idempotency_key_property` is the property that holds an idempotency key for deduplication.

#### `consumers[].azure_service_bus.publication_data_mode.delta_property`

Type: `string`. Default: `centrifugo-delta`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_PUBLICATION_DATA_MODE_DELTA_PROPERTY`

`delta_property` is the property that represents changes or deltas in the payload.

#### `consumers[].azure_service_bus.publication_data_mode.version_property`

Type: `string`. Default: `centrifugo-version`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_PUBLICATION_DATA_MODE_VERSION_PROPERTY`

`version_property` is the property that holds the version of the message.

#### `consumers[].azure_service_bus.publication_data_mode.version_epoch_property`

Type: `string`. Default: `centrifugo-version-epoch`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_PUBLICATION_DATA_MODE_VERSION_EPOCH_PROPERTY`

`version_epoch_property` is the property that holds the version epoch of the message.

#### `consumers[].azure_service_bus.publication_data_mode.tags_property_prefix`

Type: `string`. Default: `centrifugo-tag-`

Env: `CENTRIFUGO_CONSUMERS_<NAME>_AZURE_SERVICE_BUS_PUBLICATION_DATA_MODE_TAGS_PROPERTY_PREFIX`

`tags_property_prefix` defines the prefix used to extract dynamic tags from message properties.
