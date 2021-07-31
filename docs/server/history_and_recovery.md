---
id: history_and_recovery
title: History and recovery
---

Centrifugo engines can maintain publication stream with configured size and TTL.

## History design

History properties configured on a namespace level, to enable history both `history_size` and `history_ttl` should be set to a value greater than zero. 

Centrifugo is not designed to keep publications streams forever. Streams are ephemeral and can expire or can be lost at any moment. But Centrifugo provides a way for an application or a client to understand that stream history lost. In this case main application database should be the source of truth and state recovery.

When history is on every publication published into a channel saved into a history. Depending on engine used history stream implementation can differ. For example, in case of Memory engine all history stored in process memory. So as soon as Centrifugo restarted all history is cleared. When using Redis engine history is kept in Redis Stream data structure - persistence properties is then inherited from Redis persistence configuration (the same for KeyDB engine). For Tarantool history is kept inside spaces.

Each publication when added to history has `offset` field. This is an incremental `uint64` field. Each stream identified by `epoch` field - which is arbitrary string. As soon as underlying engine looses data epoch field will change for a stream thus letting consumers know that stream can't be used as source of truth anymore.

## History iteration API

Coming soon.

## Automatic message recovery

One of the most interesting features of Centrifugo is automatic message recovery after short network disconnects. This mechanism allows client to automatically restore missed publications on successful resubscribe to a channel after being disconnected for a while.

In general, you could query your application backend for actual state on every client reconnect - but message recovery feature allows Centrifugo to deal with this and restore missed publications from history cache thus radically reducing load on your application backend and your main application database in some scenarios (when many clients reconnect at the same time).

:::danger

Message recovery protocol feature designed to be used together with reasonably small Publication stream size as all missed publications sent towards client in one protocol frame on resubscribe to a channel. Thus, it mostly suitable for short-time disconnects. It helps a lot to survive reconnect storm when many clients reconnect at one moment (balancer reload, network glitch) - but it's not a good idea to recover a long list of missed messages after clients being offline for a long time.

:::

To enable recovery mechanism for channels set `recover` boolean configuration option to `true` on the configuration file top-level or for a channel namespace. Make sure to enable this option in namespaces where history is on.

When re-subscribing on channels Centrifugo will return missed `publications` to client in subscribe `Reply`, also it will return special `recovered` boolean flag to indicate whether all missed publications successfully recovered after disconnect or not.

Centrifugo recovery model based on two fields in protocol: `offset` and `epoch`. All fields managed automatically by Centrifugo client libraries (for bidirectional transport), but it's good to know how recovery works under the hood.

Recovery feature heavily relies on `offset` and `epoch` values descrbed above.

`epoch` handles cases when history storage has been restarted while client was in disconnected state so publication numeration in a channel started from scratch. For example at moment Memory engine does not persist publication sequences on disk so every restart will start numeration from scratch, after each restart new `epoch` field generated, and we can understand in recovery process that client could miss messages thus returning correct `recovered` flag in subscribe `Reply`. This also applies to Redis engine – if you do not use AOF with fsync then sequences can be lost after Redis restart. When using Redis engine you need to use fully in-memory model strategy or AOF with fsync to guarantee reliability of `recovered` flag sent by Centrifugo.

When server receives subscribe command with boolean flag `recover` set to `true` and `offset`, `epoch` set to values last seen by a client (see `SubscribeRequest` type in [protocol definitions](https://github.com/centrifugal/protocol/blob/master/definitions/client.proto)) it will try to find all missed publications from history cache. Recovered publications will be passed to client in subscribe `Reply` in correct order, so your publication handler will be automatically called to process each missed message.

You can also manually implement your own recovery algorithm on top of basic PUB/SUB possibilities that Centrifugo provides. As we said above you can simply ask your backend for an actual state after every client reconnect completely bypassing recovery mechanism described here. Also it's possible to manually iterate over Centrifugo stream using history iteration API described above. 
