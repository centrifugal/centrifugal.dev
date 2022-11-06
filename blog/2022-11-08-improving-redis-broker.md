---
title: Improving Centrifugo Redis Engine throughput and allocation efficiency with Rueidis Go library
tags: [centrifugo, redis, go]
description: In this post we share some details about Centrifugo Redis engine implementation and its recent performance improvements with the help of Rueidis library
author: Alexander Emelin
authorTitle: Author of Centrifugo
authorImageURL: https://github.com/FZambia.png
image: /img/redis.png
hide_table_of_contents: false
draft: true
---

![Centrifuge](/img/redis.png)

The main goal of Centrifugo is to handle persistent client connections established over various real-time transports (such as WebSocket, HTTP-Streaming, SSE, WebTransport, etc) and provide an API for publishing data towards established connections. Centrifugo is a user-facing PUB/SUB server where client connections may subscribe to different channels.

To achieve a possibility to scale client connections between many server nodes and not worry about subscribers belonging to different nodes Centrifugo uses **[Redis](https://redis.com/) as the main scalability option**. Redis is incredibly mature, simple and fast in-memory storage. Due to various built-in data structures and PUB/SUB support Redis is a perfect fit to be both Centrifugo `Broker` and `PresenceManager`.

In Centrifugo v4.1.0 we introduced an updated implementation of our Redis Engine (`Engine` in Centrifugo == `Broker` + `PresenceManager`) which provides great performance benefits to our users. In this post we are discussing some things which pushed us towards rewriting Redis Engine and giving some insights to numbers we were able to achieve.

<!--truncate-->

## Broker and PresenceManager

Let's provide some glue what is `Broker` and `PresenceManager` in Centrifugo.

`Broker` is responsible for keeping subscriptions coming from different Centrifugo nodes (initiated by client connections), thus connecting channel subscribers on different nodes. This helps to scale connections over many Centrifugo instances and not worry about same channel subscribers being connected to different nodes – all nodes are connected with PUB/SUB.

Another important part of `Broker` is keeping an expiring publication history streams for channels – so that Centrifugo may provide a fast cache for messages missed by clients upon going offline for short and compensate at most once delivery of Redis PUB/SUB using publication incremental offsets. Centrifugo uses STREAM and HASH data structures in Redis to keep channel history and its meta information.

![gopher-broker](https://i.imgur.com/QOJ1M9a.png)

`PresenceManager` is responsible for online presence information - i.e. list of currently active channel subscribers. This data should also expire if not updated by a client connection for some time. Centrifugo uses two Redis data structures for managing presence in channels - HASH and ZSET.

## Redigo

The implementation of Redis Engine was based on [gomodule/redigo](https://github.com/gomodule/redigo) library for a long time. Big kudos to Mr Gary Burd for establishing such a great set of libraries in Go ecosystem.

Redigo library provides a connection [Pool](https://pkg.go.dev/github.com/gomodule/redigo/redis#Pool) to Redis. A simple usage of it is to get the connection from the pool, issuing request to Redis using that connection, and putting the connection to the pool after receiving the result from Redis.

There were several techniques we used to achieve a better throughput for Centrifugo Redis engine:

1. Instead of using `redigo` Pool for each operation we acquired a dedicated connection from the Pool and used Redis pipelining to send commands where possible. Redis pipelining allows improving performance by executing multiple commands using a single client-server-client round trip. Instead of executing 100 commands one by one, you can queue the commands in a pipeline and then execute the queued commands using a single write + read operation as if it is a single command. Also, given a single CPU nature of Redis, reducing number of connections has a good effect on throughput – so pipelining helps in this perspective also.
2. We had a dedicated goroutine responsible for subscribing to channels. This goroutine also used a dedicated connection to Redis to send SUBSCRIBE/UNSUBSCRIBE Redis commands, batching commands to pipeline objects (using smart batching technique, we described the approach in one of the previous posts in this blog).

Redigo is a nice stable library which served us great for a long time.

## Limitations of Redigo

There are three modes in which Centrifugo can work with Redis these days:

1. Connecting to a standalone single Redis instance (with optional client-side consistent sharding)
2. Connecting to Redis in master-replica configuration, where Redis Sentinel controls failover process
3. Connecting to Redis Cluster

Unfortunately with pure Redigo library it's only possible to implement [1] – i.e. connecting to a single standalone Redis instance.

To support scheme with Sentinel you whether need to have a proxy between application and Redis which proxies connection to Redis master. For example, with Haproxy it's possible in this way:

```
listen redis
    server redis-01 127.0.0.1:6380 check port 6380 check inter 2s weight 1 inter 2s downinter 5s rise 10 fall 2 on-marked-down shutdown-sessions on-marked-up shutdown-backup-sessions
    server redis-02 127.0.0.1:6381 check port 6381 check inter 2s weight 1 inter 2s downinter 5s rise 10 fall 2 backup
    bind *:6379
    mode tcp
    option tcpka
    option tcplog
    option tcp-check
    tcp-check send PING\r\n
    tcp-check expect string +PONG
    tcp-check send info\ replication\r\n
    tcp-check expect string role:master
    tcp-check send QUIT\r\n
    tcp-check expect string +OK
    balance roundrobin
```

Or, you need to additionally import [FZambia/sentinel](https://github.com/FZambia/sentinel) library - which provides a communication layer with Redis Sentinel on top of Redigo's connection Pool.

For communicating with Redis Cluster one more library may be used – [mna/redisc](https://github.com/mna/redisc) which is also a layer on top of `redigo` basic functionality.

Combining `redigo` + `FZambia/sentinel` + `mna/redisc` it was possible to implement all three connection modes. This worked, though resulted in rather tricky Redis setup. Also, it was hard to re-use existing pipelining code we had for a standalone Redis with Redis Cluster. So Centrifugo only used pipelining in standalone or Sentinel Redis cases, but when using Redis Cluster Centrifugo simply used connection pool to issue requests. Thus we had some code duplication to issue the same requests in various Redis configurations.

Another thing is that Redigo is fully interface-based. It has `Do` method which accepts name of command and variadic `interface{}` arguments to construct command arguments:

```go
Do(commandName string, args ...interface{}) (reply interface{}, err error)
```

While this works well and you can issue any command to Redis, this adds some allocation overhead.

At some point we felt that removing additional dependencies (even though I am the author of one of them) and reducing allocations in Redis communication layer is a nice step forward for Centrifugo. So we started looking around for `redigo` alternatives.

To summarize what we wanted from Redis library:

* Possibility to work with all three Redis setup options we support: standalone, master-replica(s) with Sentinel, Redis Cluster, so we can depend on one library instead of three
* Less memory allocations, so our users could notice a sufficient CPU reduction on Centrifugo nodes which communicate with Redis a lot
* Work with RESP2-only Redis servers as we need that for backwards compatibility, and some vendors like Redis Enterprise still using only RESP2 protocol
* Well-maintained

## Go-redis

Actually, the most obvious alternative to `redigo` is [go-redis/redis](https://github.com/go-redis/redis) package. It's very popular, regularly gets updates, used by a huge amount of Go projects. I personally successfully used it in several other projects I worked on.

To avoid setup boilerplate for various Redis setup variations `go-redis/redis` has [UniversalClient](https://pkg.go.dev/github.com/go-redis/redis/v9#UniversalClient), from docs:

> UniversalClient is a wrapper client which, based on the provided options, represents either a ClusterClient, a FailoverClient, or a single-node Client. This can be useful for testing cluster-specific applications locally or having different clients in different environments.

In terms of internal implementation `go-redis/redis` also has internal pool of connections, similar to `redigo`.It's also possible to get a dedicated connection from the internal pool and use it for pipelining purposes. So `UniversalClient` reduces boilerplate and dependencies we had and still provides similar approach for the connection management so we could easily re-implement things we had.

At some point [@j178](https://github.com/j178) sent [a pull request](https://github.com/centrifugal/centrifuge/pull/235) with Centrifuge `Broker` and `PresenceManager` implementations based on `go-redis/redis`. The amount of code to cover all the various Redis setups reduced, we got only one dependency instead of three.

But what about performance? Here we will show results for several operations which are typical for Centrifugo:

1. Publish message to a channel without saving it to the history - this is just a PUBLISH command of Redis PUB/SUB system
2. Publish message to a channel with saving it to history - this involves executing LUA script on Redis side where we add publication to STREAM data structure, update meta information HASH and finally PUBLISH to PUB/SUB 
3. Subscribe to a channel - that's a SUBSRIBE Redis command, this is important to have it fast as Centrifugo should be able to re-subscribe to all the channels in the system upon [mass client reconnect scenario](/blog/2020/11/12/scaling-websocket#massive-reconnect)
4. Recovering missed publication state from channel STREAM, this is again may be called lots of times when all clients reconnect at once
5. Updating connection presence information - many connections may periodically update their channel presence information in Redis

Here are the benchmark results we got when comparing `redigo` (v1.8.9) implementation (old) and `go-redis/redis` (v9.0.0-beta.3) implementation (new):

```
name                          old time/op    new time/op    delta
RedisPublish_ManyCh-8         2.82µs ± 2%    2.99µs ± 4%   +5.95%  (p=0.000 n=10+10)
RedisPublish_History_1Ch-8    14.6µs ± 0%    11.3µs ± 1%  -22.83%  (p=0.000 n=9+10)
RedisSubscribe-8              2.19µs ±10%    2.16µs ± 6%     ~     (p=0.315 n=9+10)
RedisRecover_1Ch-8            12.4µs ± 1%    13.0µs ± 8%   +5.49%  (p=0.014 n=10+10)
RedisAddPresence_1Ch-8        6.56µs ± 1%    5.13µs ± 0%  -21.82%  (p=0.000 n=10+10)

name                          old alloc/op   new alloc/op   delta
RedisPublish_ManyCh-8           484B ± 0%      501B ± 0%   +3.43%  (p=0.000 n=10+10)
RedisPublish_History_1Ch-8    1.30kB ± 0%    1.08kB ± 0%  -16.71%  (p=0.000 n=10+10)
RedisSubscribe-8              1.26kB ± 0%    1.08kB ± 2%  -14.57%  (p=0.000 n=10+10)
RedisRecover_1Ch-8            1.24kB ± 0%    1.02kB ± 0%  -18.01%  (p=0.000 n=8+8)
RedisAddPresence_1Ch-8          910B ± 0%      829B ± 0%   -8.90%  (p=0.000 n=8+7)

name                          old allocs/op  new allocs/op  delta
RedisPublish_ManyCh-8           9.00 ± 0%      8.00 ± 0%  -11.11%  (p=0.000 n=10+10)
RedisPublish_History_1Ch-8      29.0 ± 0%      25.0 ± 0%  -13.79%  (p=0.000 n=10+10)
RedisSubscribe-8                25.0 ± 0%      18.5 ± 3%  -26.00%  (p=0.000 n=10+10)
RedisRecover_1Ch-8              29.0 ± 0%      24.0 ± 0%  -17.24%  (p=0.000 n=10+10)
RedisAddPresence_1Ch-8          18.0 ± 0%      17.0 ± 0%   -5.56%  (p=0.000 n=10+10)
```

These benchmarks and many others not presented here convinced us that migration from `redigo` to `go-redis/redis` may provide us with everything we aimed for – all the goals for a `redigo` alternative library outlined above were successfully fullfilled.

One good thing `go-redis/redis` allowed us to do is to use Redis pipelining also in a Redis Cluster case. It's possible due to the fact that `go-redis/redis` [re-maps pipeline objects internally](https://github.com/go-redis/redis/blob/c561f3ca7e5cf44ce1f1d3ef30f4a10a9c674c8a/cluster.go#L1062) based on keys to execute pipeline on the correct node of Redis Cluster. Actually, we could do the same based on `redigo` + `mna/redisc`, but here we got it for free.

Though we have not chosen `go-redis/redis` in the end. And the reason is another library – `rueidis`.

## Rueidis

While results were pretty good with `go-redis/redis` we also made an attempt to implement Redis Engine on top of [rueian/rueidis](https://github.com/rueian/rueidis) library. According to docs, `rueidis` is:

> A fast Golang Redis client that supports Client Side Caching, Auto Pipelining, Generics OM, RedisJSON, RedisBloom, RediSearch, RedisAI, RedisGears, etc.

The readme of `rueidis` contains benchmark results where it hugely outperforms `go-redis/redis` in both single Redis and Redis Custer setups:

![](/img/rueidis_1.png)

![](/img/rueidis_2.png)

`rueidis` lib comes with auto-pipelining, so it helps to always utilize the connection between application and Redis in a most efficient maximum throughput way.

This is a relatively new library, I was following it right from the first announcements. And I did some prototypes with `rueidis` which were super-promising in terms of performance. There were some issues we found during early prototyping – but all were successfuly resolved by `rueidis` author. Until `v0.0.80` release `rueidis` did not support RESP2 though, so we could not replace our Redis Engine implementation with it. But as soon as it got RESP2 support we opened [a pull request with alternative implementation](https://github.com/centrifugal/centrifuge/pull/262).

`rueidis` works with standalone Redis, Sentinel Redis and Redis Cluster out of the box. Just like `UniversalClient` of `go-redis/redis`. So it also allowed us to reduce code boilerplate to work with all these setups.

Regarding performance, here are the benchmark results we got when comparing `redigo` (v1.8.9) implementation (old) and `rueidis` (v0.0.82) implementation (new):

```
name                          old time/op    new time/op    delta
RedisPublish_ManyCh-8         2.82µs ± 2%    0.68µs ± 3%  -75.99%  (p=0.000 n=10+9)
RedisPublish_History-8        14.6µs ± 0%     9.7µs ± 1%  -33.51%  (p=0.000 n=9+10)
RedisSubscribe-8              2.19µs ±10%    1.49µs ± 8%  -31.93%  (p=0.000 n=9+10)
RedisRecover_1Ch-8            12.4µs ± 1%    10.6µs ± 0%  -14.45%  (p=0.000 n=10+8)
RedisAddPresence_1Ch-8        6.56µs ± 1%    3.80µs ± 1%  -42.02%  (p=0.000 n=10+10)

name                          old alloc/op   new alloc/op   delta
RedisPublish_ManyCh-8           484B ± 0%      171B ± 0%  -64.67%  (p=0.000 n=10+9)
RedisPublish_History_1Ch-8    1.30kB ± 0%    0.55kB ± 1%  -57.55%  (p=0.000 n=10+10)
RedisSubscribe-8              1.26kB ± 0%    1.22kB ± 0%   -3.13%  (p=0.000 n=10+8)
RedisRecover_1Ch-8            1.24kB ± 0%    0.59kB ± 1%  -52.78%  (p=0.000 n=8+10)
RedisAddPresence_1Ch-8          910B ± 0%      149B ± 3%  -83.60%  (p=0.000 n=8+10)

name                          old allocs/op  new allocs/op  delta
RedisPublish_ManyCh-8           9.00 ± 0%      3.00 ± 0%  -66.67%  (p=0.000 n=10+10)
RedisPublish_History_1Ch-8      29.0 ± 0%      12.0 ± 0%  -58.62%  (p=0.000 n=10+10)
RedisSubscribe-8                25.0 ± 0%      13.0 ± 0%  -48.00%  (p=0.000 n=10+10)
RedisRecover_1Ch-8              29.0 ± 0%      11.0 ± 0%  -62.07%  (p=0.000 n=10+10)
RedisAddPresence_1Ch-8          18.0 ± 0%       3.0 ± 0%  -83.33%  (p=0.000 n=10+10)
```

Yes, it's 4x times more publication throughput than we had before! Instead of 400k publications per second we went towards 1.6 million publications per second due to drastically decreased publish operation latency (2.82µs -> 0.68µs). The latency of other operations also reduced.

As you can see `rueidis`-based implementation produces sufficiently less allocations for all our Redis requests. Allocation improvements directly affect Centrifugo node CPU usage. So Centrifugo users with Redis Engine may expect CPU usage reduction upon switching to Centrifugo v4.1.0. Of course it's not a two times CPU reduction since Centrifugo node does many other things beyond Redis communication. But on our test stand we observed a 20% overall CPU drop. This number may vary depending on load profile and used Centrifugo features.

For Redis Cluster case we also got benchmark results similar to standalone Redis results above.

Why `rueidis` is that fast? Some insights are provided by its author in a "Writing a High-Performance Golang Client Library" series of posts on Medium:

* [Part 1: Batching on Pipeline](https://betterprogramming.pub/writing-high-performance-golang-client-library-part-1-batching-on-pipeline-97988fe3211)
* [Part 2: Reading Again From Channels?](https://betterprogramming.pub/working-on-high-performance-golang-client-library-reading-again-from-channels-5e98ff3538cf)
* [Part 3: Remove the Bad Busy Loops With the Sync.Cond](https://betterprogramming.pub/working-on-high-performance-golang-client-library-remove-the-bad-busy-loops-with-the-sync-cond-e262b3fcb458)

Since auto-pipelining is used in `rueidis` by default we also were able to remove some of our pipelining management code – so the Engine implementation is more concise now. One more thing to mention is a simpler PUB/SUB code we were able to write with `rueidis`. In `redigo` case we had to periodically PING PUB/SUB connection to maintain it alive, `rueidis` does this automatically.

You may also find other features of `rueidis` useful – like OpenTelemetry integration, client-side caching support to avoid network round trips while accessing an application cache data, integration with popular Redis modules like RediSearch or RedisJSON, etc.

## Conclusion

Migrating from a stable to a relatively new library is a risky step. We spent some time testing various failure scenarios – and new Engine implementation behaved well.

I believe that we will find more projects in Go ecosystem using `rueidis` library in the near future. Not just because its efficiency but also due to a nice type-safe API. I really enjoyed building commands with `rueidis` - all Redis commands may be constructed using a builder approach based on code generation. For example, this is a process of building a PUBLISH Redis command:

<video width="100%" loop="true" autoplay="autoplay" muted controls="" src="/img/rueidis_cmd.mp4"></video>

This drastically reduces a chance to make a stupid mistake while constructing a command. Instead of always opening Redis docs to see a command syntax it's now possible to just start typing - and quickly come to the complete command to send.
