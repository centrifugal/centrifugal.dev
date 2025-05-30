---
id: client_message_batching
sidebar_label: Message batching control
title: Message batching control
---

Centrifugo PRO provides advanced options to tweak connection message write behaviour.

By default, Centrifugo tries to write messages to clients as fast as possible. Centrifugo also does best effort combining different protocol messages into one transport frame (to reduce system calls and thus reduce CPU usage) without sacrificing delivery latency.

But still in this model if you have a lot of messages sent to each individual connection, you may have a lot of write system calls. These system calls have an huge impact on the server CPU utilization. Sometimes you want to trade-off delivery latency in favour of lower CPU consumption by Centrifugo node. It's possible to do by telling Centrifugo to slow down message delivery and collect messages to larger batches before sending them towards individual client. To achieve that Centrifugo PRO exposes additional configuration options.

We have customer reports showing that enabling options described here reduced total CPU usage of Centrifugo cluster by half. This may be a significant cost reduction at scale.

:::tip

Note, this is only useful when you have lots of messages per client. This specific feature won't be helpful with a case when the message is broadcasted towards many different connections as the feature described here only batches message writing it terms of a single socket.

:::

## Client level controls

### `client.write_delay`

The `client.write_delay` is a duration option, it is a time Centrifugo will try to collect messages inside each connection message write loop before sending them towards the connection.

Enabling `client.write_delay` may reduce CPU usage of both server and client in case of high message rate inside individual connections. The reduction happens due to the lesser number of system calls to execute. Enabling `client.write_delay` limits the maximum throughput of messages towards the connection which may be achieved. For example, if `client.write_delay` is 100ms then the max throughput per second will be `(1000 / 100) * client.max_messages_in_frame` (16 by default), i.e. 160 messages per second. Though this should be more than enough for target Centrifugo use cases (frontend apps).

Example:

```json title="config.json"
{
  "client": {
    "write_delay": "100ms"
  }
}
```

### `client.max_messages_in_frame`

The `client.max_messages_in_frame` is an integer option which controls the maximum number of messages which may be joined by Centrifugo into one transport frame. By default, 16. Use -1 for unlimited number.

Example:

```json title="config.json"
{
  "client": {
    "write_delay": "100ms",
    "max_messages_in_frame": -1
  }
}
```

### `client.reply_without_queue`

The `client.reply_without_queue` is a boolean option to not use client queue for replies to commands. When `true` replies are written to the transport without going through the connection message queue.

## Channel level controls

### `batch_max_size` and `batch_max_delay`

Centrifugo PRO provides a couple of additional channel namespace options to control message batching on the channel level.

This may be useful if you want to reduce number of system calls (thus improve CPU) using latency trade-off for specific channels only.

Two available options are [batch_max_size](../server/channels.md#batch_max_size) and [batch_max_delay](../server/channels.md#batch_max_delay).

Here is an example how you can configure these options for a channel namespace:

```json title="config.json"
{
  "channel": {
    "without_namespace": {
      "batch_max_size": 10,
      "batch_max_delay": "200ms"
    }
  }
}
```

Or for some namespace:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "example",
        "batch_max_size": 10,
        "batch_max_delay": "200ms"
      }
    ]
  }
}
```

These options can be set independently:

* if only `batch_max_delay` is set – then there is no max size limit for batching algorithm, it will always flush upon reaching `batch_max_delay`.
* if only `batch_max_size` is set – then there is no max delay limit for batching algorithm, it will flush only upon reaching `batch_max_size`. Can make sense in channels with stable high rate of messages.

Note, that channel batching is applied for each individual channel in namespace separately. Batching may introduce memory overhead, which depends on the load profile in your setup. If batching is not effective (for example due to low rate in channels) – then it can also come with CPU overhead.

### `batch_flush_latest`

One more option related to per-channel batching algorithm is `batch_flush_latest` (boolean, default `false`). Once you enable it then Centrifugo only sends the latest message in the collected batch to the client connection. This is useful for channels where each message contains the entire state, so skipping intermediary messages is beneficial to reduce CPU utilization, bandwidth and the processing work required on the client side.

Example of configuration:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "example",
        "batch_max_size": 10,
        "batch_max_delay": "200ms",
        "batch_flush_latest": true
      }
    ]
  }
}
```
