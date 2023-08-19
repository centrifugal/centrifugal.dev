---
title: Asynchronous message streaming to Centrifugo with Benthos
tags: [centrifugo, benthos, tutorial]
description: In this post, we'll demonstrate how to asynchronously stream messages into Centrifugo channels from external data providers using Benthos tool. We also highlight some pitfalls which become more important in asynchronous publishing scenario.
author: Alexander Emelin
authorTitle: Author of Centrifugo
authorImageURL: https://github.com/FZambia.png
image: /img/benthos.png
hide_table_of_contents: false
---

<img src="/img/benthos.png" />

Centrifugo provides HTTP and GRPC APIs for publishing messages into channels. Publish server API is very straighforward to use - it's a simple request with a channel and data to be delivered to active WebSocket connections subscribed to a channel.

Sometimes though Centrifugo users want to avoid synchronous calls to Centrifugo API delegating this work to asynchronous tasks. Many companies have convenient infrastructure for messaging processing tasks - like Kafka, Nats Jetstream, Redis, RabbitMQ, etc. Some using transactional outbox pattern to reliably deliver events upon database changes and have a ready infrastructure to push such events to some queue. From which want to re-publish events to Centrifugo.

In this post we get familiar with a tool called [Benthos](https://www.benthos.dev/) and show how it may simplify integrating your asynchronous message flow with Centrifugo. And we discuss some non-obvious pitfalls of asynchronous publishing approach in regards to real-time applications.

<!--truncate-->

## Start Centrifugo

First start Centrifugo (with debug logging to see incoming API requests in logs):

```bash
centrifugo genconfig
centrifugo -c config.json --log_level debug
```

Hope this step is already simple for you, if not - check out [Quickstart tutorial](/docs/getting-started/quickstart).

## Install and run Benthos

Benthos is an awesome tool which allows consuming data from various inputs, process data, then output it into configured outputs. See more detailed description [on Benthos' website](https://www.benthos.dev/docs/about).

The number of inputs supported by Benthos is huge: [check it out here](https://www.benthos.dev/docs/components/inputs/about#categories). Most of the major systems widely used these days are supported. Benthos also supports [many outputs](https://www.benthos.dev/docs/components/outputs/about#categories) – but here we only interested in message transfer to Centrifugo. There is no built-in Centrifugo output in Benthos but it provides a generic `http_client` output which may be used to send requests to any HTTP server. Benthos may also help with retries, provides tools for additional data processing and transformations.

![](/img/benthos.svg)

Just like Centrifugo Benthos written in Go language – so its installation is very straighforward and similar to Centrifugo. See [official instructions](https://www.benthos.dev/docs/guides/getting_started).

Let's assume you've installed Benthos and have `benthos` executable available in your system. Let's create Benthos configuration file:

```bash
benthos create > config.yaml
```

Take a look at generated `config.yaml` - it contains various options for Benthos instance, the most important (for the context of this post) are `input` and `output` sections.

And after that you can start Benthos instance with:

```bash
benthos -c config.yaml
```

Now we need to tell Benthos from where to get data and how to send it to Centrifugo.

## Configure Benthos input and output

For our example here we will user Redis List as an input, won't add any additional data processing and will output messages consumed from Redis List into Centrifugo publish server HTTP API.

To achieve this add the following as input in Benthos `config.yaml`:

```yaml
input:
  label: "centrifugo_redis_consumer"
  redis_list:
    url: "redis://127.0.0.1:6379"
    key: "centrifugo.publish"
```

And configure the output like this:

```yaml
output:
  label: "centrifugo_http_publisher"
  http_client:
    url: "http://localhost:8000/api/publish"
    verb: POST
    headers:
      X-API-Key: "<CENTRIFUGO_API_KEY>"
    timeout: 5s
    max_in_flight: 20
```

The output points to Centrifugo [publish HTTP API](/docs/server/server_api#publish). Replace `<CENTRIFUGO_API_KEY>` with your Centrifugo `api_key` (found in Centrifugo configuration file).

## Push messages to Redis queue

Start Benthos instance:

```bash
benthos -c config.yaml
```

You will see errors while Benthos tries to connect to input Redis source. So start Redis server:

```bash
docker run --rm -it --name redis redis:7
```

Now connect to Redis (using `redis-cli`):

```bash
docker exec -it redis redis-cli
```

And push command to Redis list:

```
127.0.0.1:6379> rpush centrifugo.publish '{"channel": "chat", "data": {"input": "test"}}'
(integer) 1
```

This message will be consumed from Redis list by Benthos and published to Centrifugo HTTP API. If you have active subscribers to channel `chat` – you will see messages delivered to them. That's it!

:::tip

When using Redis List input you can scale out Benthos instances to run several of them if needed.

:::

## Demo

Here is a quick demonstration of the described integration. See how we push messages into Redis List and those are delivered to WebSocket clients:

<video width="100%" controls>
  <source src="/img/benthos.mp4" type="video/mp4" />
  Sorry, your browser doesn't support embedded video.
</video>

## Pitfalls of async publishing

This all seems simple. But publishing messages asynchronously may highlight some pitfalls not visible or not applicable for synchronous publishing to Centrifugo API.

### Late delivery

Most of the time it will work just fine. But one day you can come across intermediate queue growth and increased delivery lag. This may happen due to temporary Centrifugo or worker process unavailability. As soon as system comes back to normal queued messages will be delivered.

Depending on the real-time feature implemented this may be a concern to think about and decide whether this is desired or not. Your application should be designed accordingly to deal with late delivery.

BTW late delivery may be a case even with synchronous publishing – it just almost never strikes. But theoretically client can reload browser page and load initial app state while message flying from the backend to client over Centrifugo. It's not Centrifugo specific actually - it's just a nature of networks and involved latencies.

In general solution to prevent late delivery UX issues completely is using object versioning. Object version should be updated in the database on every change from which the real-time event is generated. Attach object version information to every real-time message. Also get object version on initial state load. This way you can compare versions and drop non-actual real-time messages on client side.

Possible strategy may be using synchronous API for real-time features where at most once delivery is acceptable and use asynchronous delivery where you need to deliver messages with at least once guarantees. In a latter case you most probably designed proper idempotency behaviour on client side anyway. 

### Ordering concerns

Another thing to consider is message ordering. Centrifugo itself [may provide message ordering in channels](/docs/getting-started/design#message-order-guarantees). If you published one message to Centrifugo API, then another one – you can expect that messages will be delivered to a client in the same order. But as soon as you have an intermediary layer like Benthos or any other asynchronous worker process – then you must be careful about ordering. In case of Benthos and example here you can set `max_in_flight` parameter to `1` instead of `20` and keep only one instance of Benthos running to preserve ordering.

In case of streaming from Kafka you can rely on Kafka message partitioning feature to preserve message ordering.

### Throughput when ordering preserved

If you preserved ordering in your asynchronous workers then the next thing to consider is throughput limitations.

You have a limited number of workers, these workers send requests to Centrifugo one by one. In this case throughput is limited by the number of workers and RTT (round-trip time) between worker process and Centrifugo.

If we talk about using Redis List structure as a queue - you can possibly shard data amongst different Redis List queues by some key to improve throughput. In this case you need to push messages where order should be preserved into a specific queue. In this case your get a setup similar to Kafka partitioning.

In case of using manually partitioned queues or using Kafka you can have parallelism equal to the number of partitions.

Let's say you have 20 workers which can publish messages in parallel and 5ms RTT time between worker and Centrifugo. In this case you can publish 20*(1000/5) = 4000 messages per second max.

To improve throughput futher consider increasing worker number or batching publish requests to Centrifugo (using Centrifugo's batch API).

### Error handling

When publishing asynchronously you should also don't forget about error handling. Benthos will handle network errors automatically for you. But there could be internal errors from Centrifugo returned as part of response. It's not very convenient to handle with Benthos out of the box – so we think about [adding transport-level error mode](https://github.com/centrifugal/centrifugo/pull/690) to Centrifugo.

## Conclusion

Sometimes you want to publish to Centrifugo asynchronously using messaging systems convenient for your company. Usually you can write worker process to re-publish messages to Centrifugo. Sometimes it may be simplified using helpful tools like Benthos.

Here we've shown how Benthos may be used to transfer messages from Redis List queue to Centrifugo API. With some modifications you can achieve the same for other input sources - such as Kafka, RabbitMQ, Nats Jetstream, etc.

But publishing messages asynchronously highlights several pifalls - like late delivery, ordering issues,  throughput considerations and error handling – which should be carefully addressed. Different real-time features may require different strategies.
