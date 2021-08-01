---
title: Centrifugo v3 released
tags: [centrifugo, release]
description: Centrifugo v3 released with lots of exciting improvements
image: /img/v3_blog.jpg
hide_table_of_contents: false
---

![Centrifuge](/img/v3_blog.jpg)

After almost three years of Centrifugo v2 life cycle we are happy to announce the next major release of Centrifugo. During the last several months deep in our Centrifugal laboratory we had been synthesizing an improved version of the server.

New Centrifugo v3 is targeting to improve Centrifugo adoption for basic real-time application cases, improves server performance and extends existing features with new functionality. It comes with unidirectional real-time transports, protocol speedups, super-fast engine implementation based on Tarantool, new documentation site, GRPC proxy, API extensions and PRO version which provides unique possibilities for business adopters.

<!--truncate-->

### Centrifugo v2 flashbacks

Centrifugo v2 life cycle has come to an end. Before discussing v3 let's look back at what has been done during the last three years.

Centrifugo v2 was a pretty huge refactoring of v1. Since the v2 release, Centrifugo is built on top of  new [Centrifuge library](https://github.com/centrifugal/centrifuge) for Go language. Centrifuge library elolved significantly since its initial release and now powers Grafana v8 real-time streaming among other things.

<div class="vimeo-full-width">
   <iframe src="https://player.vimeo.com/video/570333329?title=0&byline=0&portrait=0" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>
</div>  
<p><a href="https://vimeo.com/570333329">Grafana Racing Telemetry Demo</a> by my collegue <a href="https://vimeo.com/user54793063">Alexander Zobnin</a></p>

Centrifugo integrated with Redis Streams, got Redis Cluster support, can now work with Nats server as a PUB/SUB broker. Notable additions of Centrifugo v2 were [server-side subscriptions](/docs/server/server_subs) with some interesting features on top – like maintaining a single global connection from one user and automatic personal channel subscription upon user connect.

A very good addition which increased Centrifugo adoption a lot was introduction of [proxy to backend](/docs/server/proxy). This made Centrifugo fit many setups where JWT authentication and existing subscription permission model did not suit well before.

Client ecosystem improved significantly. The fact that client protocol migrated to a strict Protobuf schema allowed to introduce binary protocol format (in addition to JSON) and simplify building client connectors. We now have much better and complete client libraries (compared to v1 situation).

We also have an [official Helm chart](https://github.com/centrifugal/helm-charts), [Grafana dashboard](https://grafana.com/grafana/dashboards/13039) for Prometheus datasource, and so on.

![](https://grafana.com/api/dashboards/13039/images/8950/image)

Of course, there are many aspects where Centrifugo can be improved. And v3 addresses some of them. Below we will look at the most notable features and changes of the new major Centrifugo version.

### Backwards compatibility

Let's start with the most important thing – backwards compatibility concerns.

In Centrifugo v3 client protocol mostly stayed the same. We expect that most applications will be able to update without any change on a client-side. This was an important concern for v3 given how painful the update cycle can be on mobile devices and lessons learned from v1 to v2 migration. There is one breaking change though which can affect users who use history API manually from a client-side (we provide a temporary workaround to give apps a chance to migrate smoothly).

On a server-side, much more changes happened, especially in the configuration: some options were renamed, some were removed. We provide a [v2 to v3 configuration converter](/docs/getting-started/migration_v3#v2-to-v3-config-converter) which can help dealing with changes. In most cases, all you should do is adapt Centrifugo configuration to match v3 changes and redeploy Centrifugo using v3 build instead of v2. All features are still there (or a replacement exists, like for `channels` API).

For more details, refer to the [v3 migration guide](/docs/getting-started/migration_v3).

### License change

As some of you know we considered changing Centrifugo license to AGPL v3 for a new release. After thinking a lot about this we decided to not step into this area at the moment.

But the license has been changed: the license of OSS Centrifugo is now Apache 2.0 instead of MIT. Apache 2.0 is also a permissive OSS license, it's just a bit more concrete in some aspects.

![](https://user-images.githubusercontent.com/2097922/91162089-8570e100-e6c3-11ea-8c41-cd8fcfe049d0.png)

### Unidirectional real-time transports

Server-side subscriptions introduced in Centrifugo v2 and recent improvements in the underlying Centrifuge library opened a road for a unidirectional approach.

This means that Centrifugo v3 provides several unidirectional real-time transports where messages flow only in one direction – from a server to a client. Why is this change important?

<img src="/img/atom.svg" align="right" width="25%" />

Centrifugo originally concentrated on using bidirectional transports for client-server communication. Like WebSocket and SockJS. Bidirectional transports allow implementing many great protocol features since a client can communicate with a server in various ways after establishing a persistent connection. While this is a great opportunity this also leads to an increased complexity.

Centrifugo users had to use special client connector libraries which abstracted underlying work into a simple public API. But internally connectors do many things: matching requests to responses, handling timeouts, handling an ordering, queuing operations, error handling. So the client connector is a pretty complex piece of software.

But what if a user just needs to receive real-time updates from a stable set of channels known in connection time? Can we simplify everything and avoid using custom software on a client-side?

With unidirectional transports, the answer is yes. Clients can now connect to Centrifugo using a bunch of unidirectional transports. And the greatest thing is that in this case, developers should not depend on Centrifugo client connectors at all – just use native browser APIs or GRPC-generated code. It's finally possible to consume events from Centrifigo using CURL.

With subscribe server API (see below) it's even possible to subscribe unidirectional client to server-side channels dynamically.

Centrifugo supports the following unidirectional transports:

* [Eventsource (SSE)](/docs/transports/uni_sse)
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

Introducing a new engine to Centrifugo is pretty hard since the engine should provide a very robust PUB/SUB performance, fast history and presence operations, possibility to publish a message to PUB/SUB and save to history atomically. It also should allow dealing with ephemeral frequently changing subscriptions. It's typical for Centrifugo use case to have millions of users each subscribed to their unique channel and constantly connecting/disconnecting.

![](https://www.tadviser.ru/images/thumb/1/1a/Tarantool_%D0%A1%D0%A3%D0%91%D0%94_logo_2020.png/840px-Tarantool_%D0%A1%D0%A3%D0%91%D0%94_logo_2020.png)

In v3 we added experimental support for the [Tarantool](https://www.tarantool.io/en/) engine. It fits nicely all the requirements above and provides a huge performance speedup for history and presence operations compared to Redis. According to our benchmarks, the speedup can be up to 5-10x. The PUB/SUB performance of Tarantool is comparable with Redis (10-20% worse according to our internal benchmarks to be exact, but that's pretty much the same).

Tarantool can provide new storage properties, new adoption. We are pretty excited about adding it as an option.

But you could notice that support is **experimental** for now. The reason for this is that Tarantool integration involves one more moving piece – the [Lua module](https://github.com/centrifugal/tarantool-engine) which should be run by a Tarantool server.

This increases deployment complexity and given the fact that many users have their own best practices in Tarantool deployment we are still evaluating a sufficient way to distribute Lua part. For now, we are targeting standalone and Cartridge Tarantool setups.

Refer to the [Tarantool engine documentation](/docs/server/engines#tarantool-engine) for more details.  

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

Centrifugo now supports API extensions in terms of the new `rpc` method. The purpose of this method is to have a way to quickly introduce JSON extensions for API without a need to update Protobuf definitions and add method implementation to API clients. It now serves a `getChannels` extension to get a list of active channels in a system with a number of connections in each and optionally filter channels by mask.

Admin web UI has been updated too to support new methods, so you can play with new API from its `actions` tab.

// TODO: refactor getChannels result to have a map to be more extensible.

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
* [Error and disconnect codes](/docs/server/codes).

Server API and proxy documentation have been improved significantly.

### Performance improvements

<img src="/img/stopwatch.svg" align="right" width="25%" />

Centrifugo v3 has some notable performance improvements.

JSON client protocol now utilizes a couple of libraries (`easyjson` for encoding and `segmentio/encoding` for unmarshaling). Actually we use a slightly customized version of `easyjson` library to achieve even faster performance than it provides out-of-the-box. Changes allowed to speed up JSON encoding and decoding up to 4-5x for small messages. For large payloads speed up can be even more noticeable – we observed up to 30x performance boost when serializing 5kb messages.

:::tip

Centrifugo Protobuf protocol is still faster than JSON for encoding/decoding on a server-side.

:::

Of course, JSON encoding is only one part of Centrifugo – so you should not expect overall 4x performance improvement. But loaded setups should notice the difference and this should also be a good thing for reducing garbage collection pauses.

Centrifugo also inherited a couple of other improvements from the Centrifuge library. In-memory connection hub is now sharded – this should reduce lock contention between operations in different channels. Also, Centrifugo now allocates less during message broadcasting to a large number of subscribers.

### Centrifugo PRO

The final notable thing is an introduction of Centrifugo PRO. This is an extended version of Centrifugo built on top of the OSS version. It provides some unique features targeting business adopters.

Those who followed Centrifugo for a long time know that there were some attempts to make project development sustainable. Buy me a coffee and Opencollective approaches were not successful, during a year we only got ~300$ of total contributions. While we appreciate these contributions a lot - this does not justify a time spent on Centrifugo maintenance these days and is not very helpful in the long-term. So here is another attempt to monetize Centrifugo.

Centrifugo PRO details and features described [here in docs](/docs/pro/overview). Will see how it goes. We believe that a set of additional functionality can provide great advantages for both small and large-scale Centrifugo setups. PRO features can give useful insights on a system, protect from client API misusing, reduce server resource usage and more.

### Conclusion

There are some other changes introduced in v3 but not mentioned here. The full list can be found in the release notes and the migration guide.

Hope we stepped into an exciting time of the v3 life cycle and many improvements will follow. Join our communities in Telegram and Discord if you have questions or want to follow Centrifugo development.

Enjoy Centrifugo v3, and let the Centrifugal force be with you.

:::note

<div>Icons used here made by <a href="https://www.flaticon.com/authors/wanicon" title="wanicon">wanicon</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>

:::
