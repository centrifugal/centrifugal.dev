---
title: Centrifugo v3 released
tags: [centrifugo, release]
description: Centrifugo v3 released with lots of exciting improvements
author: Centrifugal team
authorTitle: Let the Centrifugal force be with you
authorImageURL: /img/logo_animated.svg
image: /img/v3_blog.jpg
hide_table_of_contents: false
draft: true
---

![Centrifuge](/img/v3_blog.jpg)

After almost three years of Centrifugo v2 life cycle we are happy to announce the next major release of Centrifugo. During the last several months deep in our Centrifugal laboratory we had been synthesizing an improved version of the server.

New Centrifugo v3 is targeting to improve Centrifugo adoption for basic real-time application cases, improves server performance and extends existing features with new functionality. It comes with unidirectional real-time transports, protocol speedups, super-fast engine implementation based on Tarantool, new documentation site, GRPC proxy, API extensions and PRO version which provides unique possibilities for business adopters.

<!--truncate-->

### Centrifugo v2 flashbacks

Centrifugo v2 life cycle has come to an end. Before discussing v3 let's look back at what has been done during the last three years.

Centrifugo v2 was a pretty huge refactoring of v1. Since the v2 release, Centrifugo is built on top of  new [Centrifuge library](https://github.com/centrifugal/centrifuge) for Go language. Centrifuge library evolved significantly since its initial release and now powers Grafana v8 real-time streaming among other things.

Here is an awesome demo made by my colleague <a href="https://github.com/alexanderzobnin">Alexander Zobnin</a> that demonstrates real-time telemetry of Assetto Corsa sports car streamed in real-time to Grafana dashboard: 

<div class="vimeo-full-width">
   <iframe src="https://player.vimeo.com/video/570333329?title=0&byline=0&portrait=0" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>
</div>
<p></p>

Centrifugo integrated with Redis Streams, got Redis Cluster support, can now work with Nats server as a PUB/SUB broker. Notable additions of Centrifugo v2 were [server-side subscriptions](/docs/server/server_subs) with some interesting features on top – like maintaining a single global connection from one user and automatic personal channel subscription upon user connect.

A very good addition which increased Centrifugo adoption a lot was introduction of [proxy to backend](/docs/server/proxy). This made Centrifugo fit many setups where JWT authentication and existing subscription permission model did not suit well before.

Client ecosystem improved significantly. The fact that client protocol migrated to a strict Protobuf schema allowed to introduce binary protocol format (in addition to JSON) and simplify building client connectors. We now have much better and complete client libraries (compared to v1 situation).

We also have an [official Helm chart](https://github.com/centrifugal/helm-charts), [Grafana dashboard](https://grafana.com/grafana/dashboards/13039) for Prometheus datasource, and so on.

![](https://grafana.com/api/dashboards/13039/images/8950/image)

Centrifugo is becoming more noticeable in a wider real-time technology community. For example, it was included in a [periodic table of real-time](https://ably.com/periodic-table-of-realtime) created by Ably.com (one of the most powerful real-time messaging cloud services at the moment):

![](https://ik.imagekit.io/ably/ghost/prod/2021/08/periodic-table-screenshots-combined-without-banner-no-legend.jpg?tr=w-1520)

Of course, there are many aspects where Centrifugo can be improved. And v3 addresses some of them. Below we will look at the most notable features and changes of the new major Centrifugo version.

### Backwards compatibility

Let's start with the most important thing – backwards compatibility concerns.

In Centrifugo v3 client protocol mostly stayed the same. We expect that most applications will be able to update without any change on a client-side. This was an important concern for v3 given how painful the update cycle can be on mobile devices and lessons learned from v1 to v2 migration. There is one breaking change though which can affect users who use history API manually from a client-side (we provide a temporary workaround to give apps a chance to migrate smoothly).

On a server-side, much more changes happened, especially in the configuration: some options were renamed, some were removed. We provide a [v2 to v3 configuration converter](/docs/getting-started/migration_v3#v2-to-v3-config-converter) which can help dealing with changes. In most cases, all you should do is adapt Centrifugo configuration to match v3 changes and redeploy Centrifugo using v3 build instead of v2. All features are still there (or a replacement exists, like for `channels` API).

For more details, refer to the [v3 migration guide](/docs/getting-started/migration_v3).

### License change

As some of you know we considered changing Centrifugo license to AGPL v3 for a new release. After thinking a lot about this we decided to not step into this area.

But the license has been changed: the license of OSS Centrifugo is now Apache 2.0 instead of MIT. Apache 2.0 is also a permissive OSS license, it's just a bit more concrete in some aspects.

![](https://user-images.githubusercontent.com/2097922/91162089-8570e100-e6c3-11ea-8c41-cd8fcfe049d0.png)

### Unidirectional real-time transports

Server-side subscriptions introduced in Centrifugo v2 and recent improvements in the underlying Centrifuge library opened a road for a unidirectional approach.

This means that Centrifugo v3 provides a set of unidirectional real-time transports where messages flow only in one direction – from a server to a client. Why is this change important?

Centrifugo originally concentrated on using bidirectional transports for client-server communication. Like WebSocket and SockJS. Bidirectional transports allow implementing some great protocol features since a client can communicate with a server in various ways after establishing a persistent connection. While this is a great opportunity this also leads to an increased complexity.

Centrifugo users had to use special client connector libraries which abstracted underlying work into a simple public API. But internally connectors do many things: matching requests to responses, handling timeouts, handling an ordering, queuing operations, error handling. So the client connector is a pretty complex piece of software.

But what if a user just needs to receive real-time updates from a stable set of channels known in connection time? Can we simplify everything and avoid using custom software on a client-side?

With unidirectional transports, the answer is yes. Clients can now connect to Centrifugo using a bunch of unidirectional transports. And the greatest thing is that in this case, developers should not depend on Centrifugo client connectors at all – just use native browser APIs or GRPC-generated code. It's finally possible to consume events from Centrifugo using CURL (see [an example](/docs/transports/uni_http_stream#connecting-using-curl)).

Using unidirectional transports you can still benefit from Centrifugo built-in scalability with various engines, utilize built-in authentication over JWT or the connect proxy feature.

With subscribe server API (see below) it's even possible to subscribe unidirectional client to server-side channels dynamically. With refresh server API or the refresh proxy feature it's possible to manage a connection expiration.

Centrifugo supports the following unidirectional transports:

* [EventSource (SSE)](/docs/transports/uni_sse)
* [HTTP streaming](/docs/transports/uni_http_stream)
* [Unidirectional WebSocket](/docs/transports/uni_websocket)
* [Unidirectional GRPC stream](/docs/transports/uni_grpc)

We expect that introducing unidirectional transports will significantly increase Centrifugo adoption.

### History iteration API

<img src="/img/centrifuge.svg" align="right" width="25%" />

There was a rather important limitation of Centrifugo history API – it was not very suitable for keeping large streams because a call to a history could only return the entire channel history.

Centrifugo v3 introduces an API to iterate over a stream. It's possible to do from the current stream beginning or end, in both directions – forward and backward, with configured limit. Also with certain starting stream position if it's known.

This, among other things, can help to implement manual missed message recovery on a client-side to reduce the load on the application backend.

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

:::caution

This new API does not remove the need in having the main application database – that's still mandatory for idiomatic Centrifugo usage.

:::

### Redis Streams by default

In Centrifugo v3 Redis engine uses Redis Stream data structure by default for keeping channel history. Before v3 Redis Streams were supported by not enabled by default so almost nobody used them. This change is important in terms of introducing history iteration API described above – since Redis Streams allow doing iteration effectively. 

### Tarantool engine

As you may know, Centrifugo has several built-in engines that allow scaling Centrifugo nodes (using PUB/SUB) and keep shared history and presence state. Before v3 Centrifugo had in-memory and Redis (or KeyDB) engines available.

Introducing a new engine to Centrifugo is pretty hard since the engine should provide a very robust PUB/SUB performance, fast history and presence operations, possibility to publish a message to PUB/SUB and save to history atomically. It also should allow dealing with ephemeral frequently changing subscriptions. It's typical for Centrifugo use case to have millions of users each subscribed to a  unique channel and constantly connecting/disconnecting (thus subscribing/unsubscribing).

![](https://www.tadviser.ru/images/thumb/1/1a/Tarantool_%D0%A1%D0%A3%D0%91%D0%94_logo_2020.png/840px-Tarantool_%D0%A1%D0%A3%D0%91%D0%94_logo_2020.png)

In v3 we added **experimental** support for the [Tarantool](https://www.tarantool.io/en/) engine. It fits nicely all the requirements above and provides a huge performance speedup for history and presence operations compared to Redis. According to our benchmarks, the speedup can be up to 4-10x depending on operation. The PUB/SUB performance of Tarantool is comparable with Redis (10-20% worse according to our internal benchmarks to be exact, but that's pretty much the same).

For example, let's look at Centrifugo benchmark where we recover zero messages (i.e. emulate a situations when many connections disconnected for a very short time interval due to load balancer reload).

For Redis engine:

```bash title="Redis engine, single Redis instance"
BenchmarkRedisRecover       26883 ns/op	    1204 B/op	   28 allocs/op
```

Compare it with the same operation measured with Tarantool engine:

```bash title="Tarantool engine, single Tarantool instance"
BenchmarkTarantoolRecover    6292 ns/op	     563 B/op	   10 allocs/op
```

Tarantool can provide new storage properties (like synchronous replication), new adoption. We are pretty excited about adding it as an option.

The reason why Tarantool support is experimental is because Tarantool integration involves one more moving piece – the [Centrifuge Lua module](https://github.com/centrifugal/tarantool-centrifuge) which should be run by a Tarantool server.

This increases deployment complexity and given the fact that many users have their own best practices in Tarantool deployment we are still evaluating a sufficient way to distribute Lua part. For now, we are targeting standalone (see examples in [centrifugal/tarantool-centrifuge](https://github.com/centrifugal/tarantool-centrifuge)) and Cartridge Tarantool setups (with [centrifugal/rotor](https://github.com/centrifugal/rotor)).

Refer to the [Tarantool Engine documentation](/docs/server/engines#tarantool-engine) for more details.

### GRPC proxy

Centrifugo can now transform events received over persistent connections from users into GRPC calls to the application backend (in addition to the HTTP proxy available in v2).

GRPC support should make Centrifugo ready for today's microservice architecture where GRPC is a huge player for inter-service communication.

So we mostly just provide more choices for Centrifugo users here. GRPC has some good advantages – for example an application backend RPC layer which is responsible for communication with Centrifugo can now be generated from Protobuf definitions for all popular programming languages.

### Server API improvements

<img src="/img/test-tube.svg" align="right" width="25%" />

Centrifugo v3 has some valuable server API improvements.

The new `subscribe` API method allows subscribing connection to a channel at any point in time. This works by utilizing server-side subscriptions. So it's not only possible to subscribe connection to a list of server-side channels during the connection establishment phase – but also later during the connection lifetime. This may be very useful for the unidirectional approach - by emulating client-side subscribe call over request to application backend which in turn calls subscribe Centrifugo server API.

Publish API now returns the current top stream position (offset and epoch) for channels with history enabled.

Server history API inherited iteration possibilities described above.

Channels command now returns a number of clients in a channel, also supports channel filtering by a pattern. Since we changed how channels call implemented internally there is no limitation anymore to call it when using Redis cluster.

Admin web UI has been updated too to support new API methods, so you can play with new API from its `actions` tab.

### Better clustering

Centrifugo behaves a bit better in cluster mode: as soon as a node leaves a cluster gracefully (upon graceful termination) it sends a shutdown signal to the control channel thus giving other nodes a chance to immediately delete that node from the local registry.

### Client improvements

While preparing the v3 release we improved client connectors too. All existing client connectors now actualized to the latest protocol, support server-side subscriptions, history API.

One important detail is that it's not required to set `?format=protobuf` URL param now when connecting to Centrifugo from mobile devices - this is now managed internally by using the WebSocket subprotocol mechanism (requires using the latest client connector version and Centrifugo v3).

### New documentation site

You are reading this post on a new project site. It's built with amazing [Docusaurus](https://docusaurus.io/).

A lot of documents were actualized, extended, and rewritten. We also now have new chapters like:

* [Main highlights](/docs/getting-started/highlights)
* [Design overview](/docs/getting-started/design)
* [History and recovery](/docs/server/history_and_recovery)
* [Error and disconnect codes](/docs/server/codes).

Server API and proxy documentation have been improved significantly.

### Performance improvements

<img src="/img/stopwatch.svg" align="right" width="25%" />

Centrifugo v3 has some notable performance improvements.

JSON client protocol now utilizes a couple of libraries (`easyjson` for encoding and `segmentio/encoding` for unmarshaling). Actually we use a slightly customized version of `easyjson` library to achieve even faster performance than it provides out-of-the-box. Changes allowed to speed up JSON encoding and decoding up to 4-5x for small messages. For large payloads speed up can be even more noticeable – we observed up to 30x performance boost when serializing 5kb messages.

For example, let's look at a JSON serialization benchmark result for 256 byte payload. Here is what we had before:

```bash title="Centrifugo v2 JSON encoding/decoding"
cpu: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
BenchmarkMarshal-12              	 5883 ns/op	    1121 B/op	    6 allocs/op
BenchmarkMarshalParallel-12      	 1009 ns/op	    1121 B/op	    6 allocs/op
BenchmarkUnmarshal-12            	 1717 ns/op	    1328 B/op	   16 allocs/op
BenchmarkUnmarshalParallel-12    	492.2 ns/op	    1328 B/op	   16 allocs/op
```

And what we have now with mentioned JSON optimizations:

```bash title="Centrifugo v3 JSON encoding/decoding"
cpu: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
BenchmarkMarshal-12              	 461.3 ns/op	 928 B/op	    3 allocs/op
BenchmarkMarshalParallel-12      	 250.6 ns/op	 928 B/op	    3 allocs/op
BenchmarkUnmarshal-12            	 476.5 ns/op	 136 B/op	    3 allocs/op
BenchmarkUnmarshalParallel-12    	 107.2 ns/op	 136 B/op	    3 allocs/op
```

:::tip

Centrifugo Protobuf protocol is still faster than JSON for encoding/decoding on a server-side.

:::

Of course, JSON encoding is only one part of Centrifugo – so you should not expect overall 4x performance improvement. But loaded setups should notice the difference and this should also be a good thing for reducing garbage collection pauses.

Centrifugo inherited a couple of other improvements from the Centrifuge library.

In-memory connection hub is now sharded – this should reduce lock contention between operations in different channels. In [our artificial benchmarks](https://github.com/centrifugal/centrifuge/pull/184) we noticed a 3x better hub throughput, but in reality the benefit is heavily depends on the usage pattern.

Centrifugo now allocates less during message broadcasting to a large number of subscribers.

Also, an upgrade to Go 1.17 for builds results in ~5% performance boost overall, thanks to a new way of passing function arguments and results using registers instead of the stack introduced in Go 1.17.

### Centrifugo PRO

The final notable thing is an introduction of Centrifugo PRO. This is an extended version of Centrifugo built on top of the OSS version. It provides some unique features targeting business adopters.

Those who followed Centrifugo for a long time know that there were some attempts to make project development sustainable. Buy me a coffee and Opencollective approaches were not successful, during a year we got ~300$ of total contributions. While we appreciate these contributions a lot - this does not fairly justify a time spent on Centrifugo maintenance these days and does not allow bringing it to the next level. So here is an another attempt to monetize Centrifugo.

Centrifugo PRO details and features described [here in docs](/docs/pro/overview). Let's see how it goes. We believe that a set of additional functionality can provide great advantages for both small and large-scale Centrifugo setups. PRO features can give useful insights on a system, protect from client API misusing, reduce server resource usage, and more.

PRO version will be released soon after Centrifugo v3 OSS.

### Conclusion

There are some other changes introduced in v3 but not mentioned here. The full list can be found in the release notes and the migration guide.

Hope we stepped into an exciting time of the v3 life cycle and many improvements will follow. Join our communities in Telegram and Discord if you have questions or want to follow Centrifugo development:

[![Join the chat at https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ](https://img.shields.io/badge/Telegram-Group-orange?style=flat&logo=telegram)](https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ) &nbsp;[![Join the chat at https://discord.gg/tYgADKx](https://img.shields.io/discord/719186998686122046?style=flat&label=Discord&logo=discord)](https://discord.gg/tYgADKx)

Enjoy Centrifugo v3, and let the Centrifugal force be with you.

:::note Special thanks

Special thanks to [Anton Silischev](https://github.com/silischev) for the help with v3 tests, examples and CI. To [Leon Sorokin](https://github.com/leeoniya) for the spinning CSS Centrifugo logo. To [Michael Filonenko](https://github.com/filonenko-mikhail) for the help with Tarantool. To [German Saprykin](https://github.com/mogol) for Dart magic.

Thanks to the community members who tested out Centrifugo v3 beta, found bugs and sent improvements.

<div>Icons used here made by <a href="https://www.flaticon.com/authors/wanicon" title="wanicon">wanicon</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>

:::
