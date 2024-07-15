---
id: history_and_recovery
title: History and recovery
---

Centrifugo engines can maintain publication history for channels with configured history size and TTL.

## History design

History properties configured on a namespace level, to enable history both [history_size](./channels.md#history_size) and [history_ttl](./channels.md#history_ttl) should be set to a value greater than zero. 

Centrifugo is designed with an idea that history streams are ephemeral (can be created on the fly without explicit create call from Centrifugo users) and can expire or can be lost at any moment. Centrifugo provides a way for a client to understand that channel history lost. In this case, the main application database should be the source of truth and state recovery.

When history is on every message published into a channel is saved into a history stream. The persistence properties of history are dictated by a Centrifugo engine used. For example, in the case of the Memory engine, all history is stored in process memory. So as soon as Centrifugo restarted all history is cleared. When using Redis engine history is kept in Redis Stream data structure - persistence properties are then inherited from Redis persistence configuration (the same for KeyDB engine). For Tarantool history is kept inside Tarantool spaces.

Each publication when added to history has an `offset` field. This is an incremental `uint64` field. Each stream is identified by the `epoch` field - which is an arbitrary string. As soon as the underlying engine loses data epoch field will change for a stream thus letting consumers know that stream can't be used as the source of state recovery anymore.

:::tip

History in channels is not enabled by default. See how to enable it over [channel options](./channels.md#channel-options). History is available in both server and client API.

:::

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

Here is an example program in Go which endlessly iterates over stream both ends (using [gocent](https://github.com/centrifugal/gocent) API library), upon reaching the end of stream the iteration goes in reversed direction (not really useful in real world but fun): 

```go
// Iterate by 10.
limit := 10
// Paginate in reversed order first, then invert it.
reverse := true
// Start with nil StreamPosition, then fill it with value while paginating.
var sp *gocent.StreamPosition

for {
	historyResult, err = c.History(
        ctx,
        channel,
		gocent.WithLimit(limit),
		gocent.WithReverse(reverse),
        gocent.WithSince(sp),
	)
	if err != nil {
		log.Fatalf("Error calling history: %v", err)
	}
	for _, pub := range historyResult.Publications {
		log.Println(pub.Offset, "=>", string(pub.Data))
		sp = &gocent.StreamPosition{
			Offset: pub.Offset,
			Epoch:  historyResult.Epoch,
		}
	}
	if len(historyResult.Publications) < limit {
		// Got all pubs, invert pagination direction.
		reverse = !reverse
		log.Println("end of stream reached, change iteration direction")
	}
}
```

## Automatic message recovery

One of the most interesting features of Centrifugo is automatic message recovery after short network disconnects. This mechanism allows a client to automatically restore missed publications on successful resubscribe to a channel after being disconnected for a while.

In general, you could query your application backend for the actual state on every client reconnect - but the message recovery feature allows Centrifugo to deal with this and restore missed publications from the history cache thus radically reducing the load on your application backend and your main application database in some scenarios (when many clients reconnect at the same time).

:::danger

Message recovery protocol feature designed to be used together with reasonably small history stream size as all missed publications sent towards the client in one protocol frame on resubscribing to a channel. Thus, it is mostly suitable for short-time disconnects. It helps a lot to survive a reconnect storm when many clients reconnect at one moment (balancer reload, network glitch) - but it's not a good idea to recover a long list of missed messages after clients being offline for a long time.

:::

To enable recovery mechanism for channels set the [force_recovery](./channels.md#force_recovery) boolean configuration option to `true` on the configuration file top-level or for a channel namespace. Make sure to enable this option in namespaces where history is on. It's also possible to ask for enabling recovery from the client-side when configuring Subscription object – in this case client must have a permission to call history API.

When re-subscribing on channels Centrifugo will return missed `publications` to a client in a subscribe `Reply`, also it will return a special `recovered` boolean flag to indicate whether all missed publications successfully recovered after a disconnect or not.

The number of publications that is possible to automatically recover is controlled by the `client_recovery_max_publication_limit` option which is `300` by default. 

Centrifugo recovery model based on two fields in the protocol: `offset` and `epoch`. All fields are managed automatically by Centrifugo client SDKs (for bidirectional transport).

The recovery process works this way:

1. Let's suppose client subscribes on a channel with recovery on.
2. Client receives subscribe reply from Centrifugo with two values: stream `epoch` and stream top `offset`, those values are saved by an SDK implementation.
3. Every received publication has incremental `offset`, client SDK increments locally saved offset on each publication from a channel.
4. Let's say at this point client disconnected for a while.
5. Upon resubscribing to a channel SDK provides last seen `epoch` anf `offset` to Centrifugo.
6. Centrifugo tries to load all the missed publications starting from the stream position provided by a client.
7. If Centrifugo decides it can successfully recover client's state – then all missed publications returned in subscribe reply and client receives `recovered: true` in subscribed event context, and `publication` event handler of Subscription is called for every missed publication. Otherwise no publications returned and `recovered` flag of subscribed event context is set to `false`.

`epoch` is useful for cases when history storage is temporary and can lose the history stream entirely. In this case comparing epoch values gives Centrifugo a tip that while publications exist and theoretically have same offsets as before - the stream is actually different, so it's impossible to use it for the recovery process.

To summarize, here is a list of possible scenarios when Centrifugo can't recover client's state for a channel and provides `recovered: false` flag in subscribed event context:

* number of missed publications exceeds `client_recovery_max_publication_limit` option
* number of missed publications exceeds `history_size` namespace option
* client was away for a long time and history stream expired according to `history_ttl` namespace option
* storage used by Centrifugo engine lost the stream (restart, number of shards changed, cleared by the administrator, etc.)

Having said this all, Centrifugo recovery is nice to keep the continuity of the connection and subscription. This speed-ups resubscribe in many cases and helps the backend to survive mass reconnect scenario since you avoid lots of requests for state loading. For setups with millions of connections this can be a life-saver. But we recommend applications to always have a way to load the state from the main application database. For example, on app reload.

You can also manually implement your own recovery logic on top of the basic PUB/SUB possibilities that Centrifugo provides. As we said above you can simply ask your backend for an actual state after every client resubscribe completely bypassing the recovery mechanism described here. Also, it's possible to manually iterate over the Centrifugo stream using the history iteration API described above.
