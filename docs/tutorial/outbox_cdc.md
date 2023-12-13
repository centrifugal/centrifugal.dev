---
id: outbox_cdc
sidebar_label: "Broadcast: outbox and CDC"
title: "Broadcast using transactional outbox and CDC"
---

Some of you may notice one possible problem which could happen when publishing messages to Centrifugo API. You are doing this after transaction and over the network call. This means broadcast may return the error.

There are real-time applications which can tolerate real-time message loss. In normal conditions the number of such errors should be small and in most cases fixed by a retry. Moreover, publishing directly over Centrifugo API usually allows achieving the best delivery latency. 

But what if you don't want to think about retries and possible message loss on this stage? Here we can show how to broadcast in different way – asynchronously and transactionally.

## Transactional outbox for publishing events

The first approach is using [Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html) pattern. When you make database changes you open transaction, do required changes and write an event into special outbox table. This event will be written to the outbox table only if transaction successfully commited. Then a separate process reads outbox table and sends events to the external system. In our case - to Centrifugo.

You can implement such approach yourself to publish events to Centrifugo. But here we will show Centrifugo built-in feature to consume PostgreSQL outbox table.

All you need to do is create an outbox table in predefined format (expected by Centrifugo) – and point Centrifugo to it.

Moreover, to reduce the latency of outbox processing Centrifugo supports parallel processing of outbox table using configured partition number. And Centrifugo may be configured to use PostgreSQL LISTEN/NOTIFY mechanism - this reduces the latency of events processing a lot.

First of all, let's create the Outbox model inside `chat` Django app which describes the required outbox table:

```python
class Outbox(models.Model):
    method = models.TextField(default="publish")
    payload = models.JSONField()
    partition = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
```

And make migrations to create it in PostgreSQL:

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

Now, instead of using Centrifugo HTTP API after successful commit, you can create Outbox instance with the required broadcast method and payload:

```python
# In outbox case we can set partition for parallel processing, but
# it must be in predefined range and match Centrifugo PostgreSQL
# consumer configuration.
partition = hash(room_id)%settings.CENTRIFUGO_OUTBOX_PARTITIONS
# Creating outbox object inside transaction will guarantee that Centrifugo will
# process the command at some point. In normal conditions – almost instantly.
Outbox.objects.create(method='broadcast', payload=broadcast_payload, partition=partition)
```

Also, add the following to Centrifugo configuration:

```
TBD
```

If you want to use LISTEN/NOTIFY ... TBD

## Using Kafka Connect for CDC

Let's also look at another approach - usually known as CDC - Change Data Capture (you can learn more about it from [this post](https://www.confluent.io/learn/change-data-capture/), for example). We will use Kafka Connect with Debezium connector to read updates from PostgreSQL WAL and translate them to Kafka. Then we will use built-in Centrifugo possibility to consume Kafka topics.

First of all, we must configure PostgreSQL to use logical replication. To do this let's update `db` service in `docker-compose.yml`:

```
db:
  image: postgres:15
  volumes:
    - ./postgres_data:/var/lib/postgresql/data/
  environment:
    - POSTGRES_USER=fusion
    - POSTGRES_PASSWORD=fusion
    - POSTGRES_DB=fusion
  expose:
    - 5432
  ports:
    - 5432:5432
  command: ["postgres", "-c", "wal_level=logical", "-c", "wal_writer_delay=10ms"]
```

Note – added `command` field where `postgres` is launched with `wal_level=logical` option. We also tune `wal_writer_delay` to be faster.

Then let's add Kafka Connect and Kafka itself to our `docker-compose.yml`:

```yml
zookeeper:
  image: confluentinc/cp-zookeeper:latest
  environment:
    ZOOKEEPER_CLIENT_PORT: 2181
    ZOOKEEPER_TICK_TIME: 2000

kafka:
  image: confluentinc/cp-kafka:latest
  depends_on:
    - zookeeper
  ports:
    - "29092:29092"
  expose:
    - 9092
  environment:
    KAFKA_BROKER_ID: 1
    KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:29092
    KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
    KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
    KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
    KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
    KAFKA_MAX_REQUEST_SIZE: "10485760"  # max.request.size
    KAFKA_MESSAGE_MAX_BYTES: "10485760" # message.max.bytes
    KAFKA_MAX_PARTITION_FETCH_BYTES: "10485760" # max.partition.fetch.bytes

connect:
  image: debezium/connect:latest
  depends_on:
    - kafka
    - db
  ports:
    - "8083:8083"
  environment:
    BOOTSTRAP_SERVERS: kafka:9092
    GROUP_ID: 1
    CONFIG_STORAGE_TOPIC: connect_configs
    OFFSET_STORAGE_TOPIC: connect_offsets
    STATUS_STORAGE_TOPIC: connect_statuses
```

Kafka uses Zookeeper, so we added it here too. Next, we need to configure Debezium to use PostgreSQL plugin:

```json
{
    "name": "fusion-chat-connector",
    "config": {
        "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
        "database.hostname": "db",
        "database.port": "5432",
        "database.user": "fusion",
        "database.password": "fusion",
        "database.dbname": "fusion",
        "database.server.name": "db",
        "table.include.list": "public.chat_cdc",
        "database.history.kafka.bootstrap.servers": "kafka:9092",
        "database.history.kafka.topic": "schema-changes.chat_cdc",
        "plugin.name": "pgoutput",
        "tasks.max": "1",
        "producer.override.max.request.size": "10485760",
        "topic.creation.default.cleanup.policy": "delete",
        "topic.creation.default.partitions": "8",
        "topic.creation.default.replication.factor": "1",
        "topic.creation.default.retention.ms": "604800000",
        "topic.creation.enable": "true",
        "topic.prefix": "postgres",
        "key.converter": "org.apache.kafka.connect.json.JsonConverter",
        "value.converter": "org.apache.kafka.connect.json.JsonConverter",
        "key.converter.schemas.enable": "false",
        "value.converter.schemas.enable": "false",
        "poll.interval.ms": "100",
        "transforms": "extractContent",
        "transforms.extractContent.type": "org.apache.kafka.connect.transforms.ExtractField$Value",
        "transforms.extractContent.field": "after",
        "message.key.columns": "public.chat_cdc:partition",
        "snapshot.mode": "never"
    }
}
```

And we should add one more image to `docker-compose.yml` to apply this configuration on start:

```yaml
connect-config-loader:
  image: appropriate/curl:latest
  depends_on:
    - connect
  volumes:
    - ./debezium/debezium-config.json:/debezium-config.json
  command: >
    /bin/sh -c "
      echo 'Waiting for Kafka Connect to start...';
      while ! curl -f http://connect:8083/connectors; do sleep 1; done;
      echo 'Kafka Connect is up, posting configuration';
      curl -X DELETE -H 'Content-Type: application/json' http://connect:8083/connectors/fusion-chat-connector;
      curl -X POST -H 'Content-Type: application/json' -v --data @/debezium-config.json http://connect:8083/connectors;
      echo 'Configuration posted';
    "
```

Here we recreate Kafka Connect configuration on every start of Docker compose, in real life you won't do this - you will create configuration once and update it only if needed. But for development we want to apply changes in file automatically without the need to use REST API of Kafka Connect manually.

Next step here is configure Centrifugo to consume Kafka topic:

```json
  ...
  "consumers": [
    {
      "name": "my_kafka_consumer",
      "type": "kafka",
      "enabled": true,
      "kafka": {
        "brokers": ["kafka:9092"],
        "topics": ["postgres.public.chat_cdc"],
        "consumer_group": "centrifugo"
      }
    }
  ]
}
```

We will also create new model in Django called `CDC`, it will be used for CDC process:

```python
# While the CDC model here is the same as Outbox it has different partition field semantics,
# also in outbox case we remove processed messages from DB, while in CDC don't. So to not
# mess up with different semantics when switching between broadcast modes of the example app
# we created two separated models here. 
class CDC(models.Model):
    method = models.TextField(default="publish")
    payload = models.JSONField()
    partition = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

```

And use it like this:

```python
# In cdc case Debezium will use this field for setting Kafka partition.
# We should not prepare proper partition ourselves in this case.
partition = hash(room_id)
# Creating outbox object inside transaction will guarantee that Centrifugo will
# process the command at some point. In normal conditions – almost instantly. In this
# app Debezium will perform CDC and send outbox events to Kafka, event will be then
# consumed by Centrifugo. The advantages here is that Debezium reads WAL changes and
# has a negligible overhead on database performance. And most efficient partitioning.
# The trade-off is that more hops add more real-time event delivery latency. May be
# still instant enough though.
CDC.objects.create(method='broadcast', payload=broadcast_payload, partition=partition)
```

It seems very similar to what we had with Outbox model, please take a look at comments in the code snippets above to be aware of the difference in the model semantics.

That's how it is possible to use CDC to stream events to Centrifugo. This approach may come with larger delivery latency but it has some important benefits over transactional outbox approach shown above:

* it may provide better throughput as we are not limited in predefined number of partitions which is expected to be not very large. Here we can rely on Kafka native partitioning which is more scalable than reading SQL table concurrently by partition
* since we are reading WAL here - the load on the database (PostgreSQL) should be mostly negligible. While in outbox case we are constantly polling tables and removing processed rows.
