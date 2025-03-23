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

## `client.write_delay`

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

## `client.max_messages_in_frame`

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

## `client.reply_without_queue`

The `client.reply_without_queue` is a boolean option to not use client queue for replies to commands. When `true` replies are written to the transport without going through the connection message queue.
