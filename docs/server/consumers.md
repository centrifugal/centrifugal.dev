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

:::tip

Our [Chat/Messenger tutorial](../tutorial/outbox_cdc.md) shows PostgreSQL outbox and Kafka consumer in action. It also shows techniques to avoid duplicate messages (idempotent publications) and deal with late message delivery (idempotent processing on client side). Whether you need those techniques – depends on the nature of app. Various real-time features may require different ways of sending real-time events. Both synchronous API calls and async calls have its own advantages and trade-offs. We also talk about this in [Asynchronous message streaming to Centrifugo with Benthos](/blog/2023/08/19/asynchronous-message-streaming-to-centrifugo-with-benthos) blog post.

:::

## Common consumer options

Consumers can be set in the configuration using `consumers` array:

```json
{
    ...
    "consumers": [
        {
            "name": "xxx",
            "type": "postgresql",
            "postgresql": {...}
        },
        {
            "name": "yyy",
            "type": "kafka",
            "kafka": {...}
        },
    ]
}
```

On top level each consumer object has the following fields:

* `name` - string (required), described name of consumer. Must be unique for each consumer and match the regex `^[a-zA-Z0-9_]{2,}` - i.e. latin symbols, digits and underscores and be at least 2 symbols. This name will be used for logging purposes, metrics, also to override some options with environment variables. 
* `type` - string (required), type of consumer. At this point can be `postgresql` or `kafka`
* `disabled` - boolean (default: `false`), when set to `true` allows disabling the consumer

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

* `dsn` - string (required), DSN to PostgreSQL database, ex. `"postgresql://user:password@localhost:5432/db"`. To override `dsn` over environment variables use `CENTRIFUGO_CONSUMERS_POSTGRESQL_<CONSUMER_NAME>_DSN`.
* `outbox_table_name` - string (required), the name of outbox table in selected database, ex. `"centrifugo_outbox"`
* `num_partitions` - integer (default: `1`), the number of partitions to use. Centrifugo keeps strict order of commands per-partition by default. This option provides a way to create concurrent consumers each consuming from different partition of outbox table. Note, that partition numbers in start with `0`, so when using `1` as `num_partitions` insert data with `partition` == `0` to the outbox table.
* `partition_select_limit` - integer (default: `100`) – max number of commands to select in one query to outbox table.
* `partition_poll_interval` - duration (default: `"300ms"`) - polling interval for each partition
* `partition_notification_channel` - string (default: `""`) - optional name of LISTEN/NOTIFY channel to trigger consuming upon data added to outbox partition.

## Kafka consumer

Another built-in consumer – is Kafka topics consumer. To configure Centrifugo to consume Kafka topic:

```json
  ...
  "consumers": [
    {
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

* `brokers` - array of strings (required), points Centrifugo to Kafka brokers. To override `brokers` over environment variables use `CENTRIFUGO_CONSUMERS_KAFKA_<CONSUMER_NAME>_BROKERS` – string with broker addresses separated by space.
* `topics` - array of string (required), tells which topics to consume
* `consumer_group` - string (required), sets the name of consumer group to use
* `max_poll_records` - integer (default: `100`) - sets the maximum number of records to fetch from Kafka during a single poll operation.
* `sasl_mechanism` - only `"plain"` is now supported
* `sasl_user` - string, user for plain SASL auth. To override `sasl_user` over environment variables use `CENTRIFUGO_CONSUMERS_KAFKA_<CONSUMER_NAME>_SASL_USER`.
* `sasl_password` - string, password for plain SASL auth. To override `sasl_password` over environment variables use `CENTRIFUGO_CONSUMERS_KAFKA_<CONSUMER_NAME>_SASL_PASSWORD`.
* `tls` - boolean (default: `false`) - enables TLS, if `true` – then all the [TLS options](#kafka-tls-options) may be additionally set.

### Kafka TLS options

- `tls_cert` – `string` representing the path on disk to the TLS certificate. This is typically used for the server certificate in TLS connections.
- `tls_key` – `string` representing the path on disk to the TLS key associated with the certificate.
- `tls_cert_pem` – `string` containing the PEM (Privacy Enhanced Mail) encoded TLS certificate.
- `tls_key_pem` – `string` containing the PEM encoded TLS key.
- `tls_root_ca` – `string` representing the path on disk to the root CA certificate. This is used to verify the server certificate.
- `tls_root_ca_pem` – `string` containing the PEM encoded root CA certificate.
- `tls_client_ca` – `string` representing the path on disk to the client CA certificate. This is used in mutual TLS
- `tls_client_ca_pem` – `string` containing the PEM encoded client CA certificate.
- `tls_insecure_skip_verify` – `boolean` indicating whether to skip verifying the server's certificate chain and host name. If `true`, TLS accepts any certificate presented by the server and any host name in that certificate.
- `server_name` – `string` specifying the server name to use for server certificate verification if `tls_insecure_skip_verify` is false. This is also used in the client's SNI (Server Name Indication) extension in TLS handshake.
