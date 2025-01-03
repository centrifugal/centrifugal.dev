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

* Consumer [from PostgreSQL outbox table](#postgresql-outbox-consumer) (since Centrifugo v5.2.0)
* Consumer [from Kafka topics](#kafka-consumer) (since Centrifugo v5.2.0)

## How it works

Consumers expect to consume messages which represent Centrifugo [server API commands](../server/server_api.md). I.e. while in synchronous server API you are using HTTP or GRPC to send commands – with asynchronous consumers you are inserting API command to PostgreSQL outbox table, or delivering to Kafka topic – and it will be soon consumed and processed asynchronously by Centrifugo.

Async consumers only process commands which modify state – such as [publish](./server_api.md#publish), [broadcast](./server_api.md#broadcast), [unsubscribe](../server/server_api.md#unsubscribe), [disconnect](../server/server_api.md#disconnect), etc. Sending read commands for async execution simply does not make any sense and they will be ignored. Also, [batch](../server/server_api.md#batch) method is not supported.

Centrifugo **only supports JSON payloads for asynchronous commands coming to consumers for now**. If you need binary format – reach out with your use case.

If Centrifugo encounters an error while processing consumed messages – then internal errors will be retried, all other errors logged on `error` level – and the message will be marked as processed. The processing logic for [broadcast](./server_api.md#broadcast) API is special: if any of the publications to any channel from broadcast `channels` array failed – then the entire broadcast command will be retried. To prevent duplicate messages being published during such retries – consider using `idempotency_key` in the broadcast command.

:::tip

Our [Chat/Messenger tutorial](../tutorial/outbox_cdc.md) shows PostgreSQL outbox and Kafka consumer in action. It also shows techniques to avoid duplicate messages (idempotent publications) and deal with late message delivery (idempotent processing on client side). Whether you need those techniques – depends on the nature of app. Various real-time features may require different ways of sending real-time events. Both synchronous API calls and async calls have its own advantages and trade-offs. We also talk about this in [Asynchronous message streaming to Centrifugo with Benthos](/blog/2023/08/19/asynchronous-message-streaming-to-centrifugo-with-benthos) blog post.

:::

## Common consumer options

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

On top level each consumer object has the following fields:

* `enabled` - boolean (default: `false`), when set to `true` allows enabling the configured consumer
* `name` - string (required), described name of consumer. Must be unique for each consumer and match the regex `^[a-zA-Z0-9_]{2,}` - i.e. latin symbols, digits and underscores and be at least 2 symbols. This name will be used for logging purposes, metrics, also to override some options with environment variables. 
* `type` - string (required), type of consumer. At this point can be `postgresql` or `kafka`

To provide `consumers` over environment variable provide `CENTRIFUGO_CONSUMERS` var with JSON array serialized to string. It's also possible to override some specific consumer options over environment variables – see below. 

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

### PostgreSQL consumer options

* `consumers.postgresql.dsn` - string (required), DSN to PostgreSQL database, ex. `"postgresql://user:password@localhost:5432/db"`. To override `dsn` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_POSTGRESQL_DSN`.
* `consumers.postgresql.outbox_table_name` - string (required), the name of outbox table in selected database, ex. `"centrifugo_outbox"`
* `consumers.postgresql.num_partitions` - integer (default: `1`), the number of partitions to use. Centrifugo keeps strict order of commands per-partition by default. This option provides a way to create concurrent consumers each consuming from different partition of outbox table. Note, that partition numbers in start with `0`, so when using `1` as `num_partitions` insert data with `partition` == `0` to the outbox table.
* `consumers.postgresql.partition_select_limit` - integer (default: `100`) – max number of commands to select in one query to outbox table.
* `consumers.postgresql.partition_poll_interval` - duration (default: `"300ms"`) - polling interval for each partition
* `consumers.postgresql.partition_notification_channel` - string (default: `""`) - optional name of LISTEN/NOTIFY channel to trigger consuming upon data added to outbox partition.
* `consumers.postgresql.tls` - [TLSConfig](./tls.md#unified-tls-config-object) to configure PostgreSQL client TLS.

## Kafka consumer

Another built-in consumer – is Kafka topics consumer. To configure Centrifugo to consume Kafka topic:

```json
  ...
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

### Kafka consumer options

* `consumers.kafka.brokers` - `array[string]` (required), points Centrifugo to Kafka brokers. To override `brokers` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_KAFKA_BROKERS` – string with broker addresses separated by space.
* `consumers.kafka.topics` - array of string (required), tells which topics to consume
* `consumers.kafka.consumer_group` - string (required), sets the name of consumer group to use
* consumers.kafka.`max_poll_records` - integer (default: `100`) - sets the maximum number of records to fetch from Kafka during a single poll operation.
* `consumers.kafka.sasl_mechanism` - only `"plain"` is now supported
* `consumers.kafka.sasl_user` - string, user for plain SASL auth. To override `sasl_user` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_KAFKA_SASL_USER`.
* `consumers.kafka.sasl_password` - string, password for plain SASL auth. To override `sasl_password` over environment variables use `CENTRIFUGO_CONSUMERS_<CONSUMER_NAME>_KAFKA_SASL_PASSWORD`.
* `consumers.kafka.tls` - [TLSConfig](./tls.md#unified-tls-config-object) to configure Kafka client TLS.
