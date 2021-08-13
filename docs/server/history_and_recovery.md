---
id: history_and_recovery
title: History and recovery
---

Centrifugo engines can maintain publication stream with configured size and TTL.

## History design

History properties configured on a namespace level, to enable history both `history_size` and `history_ttl` should be set to a value greater than zero. 

Centrifugo is not designed to keep publications streams forever. Streams are ephemeral and can expire or can be lost at any moment. But Centrifugo provides a way for an application or a client to understand that stream history lost. In this case, the main application database should be the source of truth and state recovery.

When history is on every publication is published into a channel saved into history. Depending on the engine used history stream implementation can differ. For example, in the case of the Memory engine, all history is stored in process memory. So as soon as Centrifugo restarted all history is cleared. When using Redis engine history is kept in Redis Stream data structure - persistence properties are then inherited from Redis persistence configuration (the same for KeyDB engine). For Tarantool history is kept inside spaces.

Each publication when added to history has an `offset` field. This is an incremental `uint64` field. Each stream is identified by the `epoch` field - which is an arbitrary string. As soon as the underlying engine loses data epoch field will change for a stream thus letting consumers know that stream can't be used as the source of truth anymore.

## History iteration API

History iteration based on three fields:

* `limit`
* `since`
* `reverse`

Combining these fields you can iterate over a stream in both directions.

Get current stream top offset and epoch:

```
history(limit: 0, since: null, reverse: false)
```

Get full history from the current beginning (but up to `client_history_max_publication_limit`, which is `300` by default):

```
history(limit: -1, since: null, reverse: false)
```

Get full history from the current end (but up to `client_history_max_publication_limit`, which is `300` by default):

```
history(limit: -1, since: null, reverse: true)
```

Get history from the current beginning (up to 10):

```
history(limit: 10, since: null, reverse: false)
```

Get history from the current end in reversed direction (up to 10):

```
history(limit: 10, since: null, reverse: true) 
```

Get up to 10 publications since known stream position (described by offset and epoch values):

```
history(limit: 10, since: {offset: 0, epoch: "epoch"}, reverse: false)
```

Get up to 10 publications since known stream position (described by offset and epoch values) but in reversed direction (from last to earliest):

```
history(limit: 10, since: {offset: 11, epoch: "epoch"}, reverse: true)
```

## Automatic message recovery

One of the most interesting features of Centrifugo is automatic message recovery after short network disconnects. This mechanism allows a client to automatically restore missed publications on successful resubscribe to a channel after being disconnected for a while.

In general, you could query your application backend for the actual state on every client reconnect - but the message recovery feature allows Centrifugo to deal with this and restore missed publications from the history cache thus radically reducing the load on your application backend and your main application database in some scenarios (when many clients reconnecting at the same time).

:::danger

Message recovery protocol feature designed to be used together with reasonably small Publication stream size as all missed publications sent towards the client in one protocol frame on resubscribing to a channel. Thus, it is mostly suitable for short-time disconnects. It helps a lot to survive a reconnect storm when many clients reconnect at one moment (balancer reload, network glitch) - but it's not a good idea to recover a long list of missed messages after clients being offline for a long time.

:::

To enable recovery mechanism for channels set the `recover` boolean configuration option to `true` on the configuration file top-level or for a channel namespace. Make sure to enable this option in namespaces where history is on.

When re-subscribing on channels Centrifugo will return missed `publications` to a client in a subscribe `Reply`, also it will return a special `recovered` boolean flag to indicate whether all missed publications successfully recovered after a disconnect or not.

The number of publications that is possible to automatically recover is controlled by the `client_recovery_max_publication_limit` option which is `300` by default. 

Centrifugo recovery model based on two fields in the protocol: `offset` and `epoch`. All fields are managed automatically by Centrifugo client libraries (for bidirectional transport), but it's good to know how recovery works under the hood.

The recovery feature heavily relies on `offset` and `epoch` values described above.

`epoch` handles cases when history storage has been restarted while the client was in a disconnected state so publication numeration in a channel started from scratch. For example at the moment Memory engine does not persist publication sequences on disk so every restart will start numeration from scratch. After each restart a new `epoch` field is generated, and we can understand in the recovery process that the client could miss messages thus returning the correct `recovered` flag in a subscribe `Reply`. This also applies to the Redis engine – if you do not use AOF with fsync then sequences can be lost after Redis restart. When using the Redis engine you need to use a fully in-memory model strategy or AOF with fsync to guarantee the reliability of the `recovered` flag sent by Centrifugo.

When a server receives subscribe command with the boolean flag `recover` set to `true` and `offset`, `epoch` set to values last seen by a client (see `SubscribeRequest` type in [protocol definitions](https://github.com/centrifugal/protocol/blob/master/definitions/client.proto)) it will try to find all missed publications from history cache. Recovered publications will be passed to the client in a subscribe `Reply` in the correct order, so your publication handler will be automatically called to process each missed message.

You can also manually implement your recovery algorithm on top of the basic PUB/SUB possibilities that Centrifugo provides. As we said above you can simply ask your backend for an actual state after every client reconnects completely bypassing the recovery mechanism described here. Also, it's possible to manually iterate over the Centrifugo stream using the history iteration API described above. 
