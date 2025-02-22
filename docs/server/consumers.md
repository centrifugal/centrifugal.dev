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

* Consumer [from PostgreSQL outbox table](#postgresql-outbox-consumer)
* Consumer [from Kafka topics](#kafka-consumer)

## How it works

By default, consumers expect to consume messages which represent Centrifugo [server API commands](../server/server_api.md). I.e. while in synchronous server API you are using HTTP or GRPC to send commands – with asynchronous consumers you are inserting API command to PostgreSQL outbox table, or delivering to Kafka topic – and it will be soon consumed and processed asynchronously by Centrifugo.

Async consumers only process commands which modify state – such as [publish](./server_api.md#publish), [broadcast](./server_api.md#broadcast), [unsubscribe](../server/server_api.md#unsubscribe), [disconnect](../server/server_api.md#disconnect), etc. Sending read commands for async execution simply does not make any sense, and they will be ignored. Also, [batch](../server/server_api.md#batch) method is not supported.

Some consumers also provide a way to listen for raw publications – i.e. when payload already contains a data ready to publish into channels. This can be useful when you have a system that already produces messages in a format ready to be published into channels. For example, Kafka consumer has [a special mode](#publication-data-mode) for this.

Centrifugo **only supports JSON payloads for asynchronous commands coming to consumers for now**. If you need binary format – reach out with your use case.

If Centrifugo encounters an error while processing consumed messages – then internal errors will be retried, all other errors logged on `error` level – and the message will be marked as processed. The processing logic for [broadcast](./server_api.md#broadcast) API is special: if any of the publications to any channel from broadcast `channels` array failed – then the entire broadcast command will be retried. To prevent duplicate messages being published during such retries – consider using `idempotency_key` in the broadcast command.

:::tip

Our [Chat/Messenger tutorial](../tutorial/outbox_cdc.md) shows PostgreSQL outbox and Kafka consumer in action. It also shows techniques to avoid duplicate messages (idempotent publications) and deal with late message delivery (idempotent processing on client side). Whether you need those techniques – depends on the nature of app. Various real-time features may require different ways of sending real-time events. Both synchronous API calls and async calls have its own advantages and trade-offs. We also talk about this in [Asynchronous message streaming to Centrifugo with Benthos](/blog/2023/08/19/asynchronous-message-streaming-to-centrifugo-with-benthos) blog post.

:::

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

## `consumers[N]`

On top level each consumer object in the `consumers` array has the following configuration options.

### `consumers[N].enabled`

Boolean. Default: `false`.

When set to `true` allows enabling the configured consumer.

### `consumers[N].name`

String. Default: `""`. Required.

Describes name of consumer. Must be unique for each consumer and match the regex `^[a-zA-Z0-9_]{2,}` - i.e. latin symbols, digits and underscores and be at least 2 symbols. This name will be used for logging purposes, metrics, also to override some options with environment variables.

### `consumers[N].type`

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

### `postgresql.dsn`

String. Default: `""`. Required.

DSN to PostgreSQL database, ex. `"postgresql://user:password@localhost:5432/db"`. To override `dsn` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_POSTGRESQL_DSN`.

### `postgresql.outbox_table_name`

String. Default: `""`. Required.

The name of outbox table in selected database, ex. `"centrifugo_outbox"`.

### `postgresql.num_partitions`

Integer. Default: `1`.

The number of partitions to use. Centrifugo keeps strict order of commands per-partition by default. This option provides a way to create concurrent consumers each consuming from different partition of outbox table. Note, that partition numbers in start with `0`, so when using `1` as `num_partitions` insert data with `partition` == `0` to the outbox table.

### `postgresql.partition_select_limit`

Integer. Default: `100`.

Max number of commands to select in one query to outbox table.

### `postgresql.partition_poll_interval`

[Duration](./configuration.md#setting-time-duration-options). Default: `"300ms"`.

Polling interval for each partition.

### `postgresql.partition_notification_channel`

String. Default: `""`.

Optional name of LISTEN/NOTIFY channel to trigger consuming upon data added to outbox partition.

### `postgresql.tls`

[TLS object](./configuration.md#tls-config-object). By default, no TLS is used.

Client TLS configuration for PostgreSQL connection.

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

### `kafka.brokers`

Array of string. Required.

Points Centrifugo to Kafka brokers. To override `brokers` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_KAFKA_BROKERS` – string with broker addresses separated by space.

### `kafka.topics`

Array of string. Required.

Tells which topics to consume.

### `kafka.consumer_group`

String. Required.

Sets the name of consumer group to use.

### `kafka.max_poll_records`

Integer. Default: `100`.

Sets the maximum number of records to fetch from Kafka during a single poll operation.

### `kafka.fetch_max_bytes`

Integer. Default: `52428800` (50MB).

Sets the maximum number of bytes to fetch from Kafka in a single request. In many cases setting this to lower value can help with aggressive Kafka client memory usage under load.

### `kafka.sasl_mechanism`

String. Default: `""`.

SASL mechanism to use: `"plain"`, `"scram-sha-256"`, `"scram-sha-512"`, `"aws-msk-iam"` are supported. Note, in case of `"aws-msk-iam"` Centrifugo uses `sasl_user` and `sasl_password` options as `access key` and `secret key` when configuring AWS auth.

### `kafka.sasl_user`

String. Default: `""`.

User for plain SASL auth. To override `sasl_user` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_KAFKA_SASL_USER`.

### `kafka.sasl_password`

String. Default: `""`.

Password for plain SASL auth. To override `sasl_password` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_KAFKA_SASL_PASSWORD`.

### `kafka.tls`

[TLSConfig](./tls.md#unified-tls-config-object) to configure Kafka client TLS.

### `kafka.publication_data_mode`

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

### `kafka.publication_data_mode.enabled`

Boolean. Default: `false`.

Enables Kafka publication data mode for the Kafka consumer.

### `kafka.publication_data_mode.channels_header`

String. Default: `""`.

Header name to extract channels to publish data into (channels must be comma-separated). Ex. of value: `"channel1,channel2"`.

### `kafka.publication_data_mode.idempotency_key_header`

String. Default: `""`.

Header name to extract Publication idempotency key from Kafka message. See [PublishRequest](./server_api.md#publishrequest).

### `kafka.publication_data_mode.delta_header`

String. Default: `""`.

Header name to extract Publication delta flag from Kafka message which tells Centrifugo whether to use delta compression for message or not. See [delta compression](./delta_compression.md) and [PublishRequest](./server_api.md#publishrequest).
