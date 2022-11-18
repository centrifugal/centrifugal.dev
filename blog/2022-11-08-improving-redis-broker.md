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

The main goal of Centrifugo is to handle persistent client connections established over various real-time transports (such as WebSocket, HTTP-Streaming, SSE, WebTransport, etc) and provide an API for publishing data towards established connections. Clients subscribe to channels, so Centrifugo implements PUB/SUB mechanics – data is published to a channel and delivered to all online subscribers.

To achieve the possibility to scale client connections between many server nodes and not worry about channel subscribers belonging to different nodes Centrifugo uses **[Redis](https://redis.com/) as the main scalability option**. Redis is incredibly mature, simple, and fast in-memory storage. Due to various built-in data structures and PUB/SUB support Redis is a perfect fit to be both Centrifugo `Broker` and `PresenceManager`.

In Centrifugo v4.1.0 we introduced an updated implementation of our Redis Engine (`Engine` in Centrifugo == `Broker` + `PresenceManager`) which provides great performance improvements to our users. In this post, we are discussing some things which pushed us towards updating Redis Engine implementation and giving some insights about the numbers we were able to achieve.

<!--truncate-->

## Broker and PresenceManager

Let's provide some glue on what is `Broker` and `PresenceManager` in Centrifugo.

`Broker` is responsible for keeping subscriptions coming from different Centrifugo nodes (initiated by client connections), thus connecting channel subscribers on different nodes. This helps to scale connections over many Centrifugo instances and not worry about the same channel subscribers being connected to different nodes – all nodes are connected with PUB/SUB.

Another important part of `Broker` is keeping expiring publication history streams for channels – so that Centrifugo may provide a fast cache for messages missed by clients upon going offline for a short and compensate at most once delivery of Redis PUB/SUB using publication incremental offsets. Centrifugo uses STREAM and HASH data structures in Redis to keep channel history and its meta information.

Overall Centrifugo architecture may be represented with this awesome picture (Gophers are Centrifugo nodes all connected to `Broker`):

![gopher-broker](https://i.imgur.com/QOJ1M9a.png)

`PresenceManager` is responsible for online presence information - i.e. list of currently active channel subscribers. This data should also expire if not updated by a client connection for some time. Centrifugo uses two Redis data structures for managing presence in channels - HASH and ZSET.

## Redigo

The implementation of Redis Engine was based on [gomodule/redigo](https://github.com/gomodule/redigo) library for a long time. Big kudos to Mr Gary Burd for establishing such a great set of libraries in Go ecosystem.

Redigo provides a connection [Pool](https://pkg.go.dev/github.com/gomodule/redigo/redis#Pool) to Redis. A simple usage of it is to get the connection from the pool, issuing request to Redis using that connection, and putting the connection to the pool after receiving the result from Redis.

To achieve a bigger throughput, instead of using Redigo's `Pool` for each operation we acquired a dedicated connection from the `Pool` and used Redis pipelining to send multiple commands where possible.

Redis pipelining improves performance by executing multiple commands using a single client-server-client round trip. Instead of executing 100 commands one by one, you can queue the commands in a pipeline and then execute the queued commands as if it is a single command. Also, given a single CPU nature of Redis, reducing number of active connections when using pipelining has a good effect on throughput – so pipelining helps in this perspective also.

We are using smart batching technique for collecting pipeline (described in [one of the previous posts](/blog/2020/11/12/scaling-websocket) in this blog). See also some benchmarks which demonstrate the benefit from pipelining and redigo in https://github.com/FZambia/redigo-smart-batching repo.

We also used a dedicated goroutine responsible for subscribing to channels. This goroutine also used a dedicated connection to Redis to send SUBSCRIBE/UNSUBSCRIBE Redis commands, batching commands to pipeline objects.

Redigo is a nice stable library which served us great for a long time.

## Motivation to migrate

There are three modes in which Centrifugo can work with Redis these days:

1. Connecting to a standalone single Redis instance
2. Connecting to Redis in master-replica configuration, where Redis Sentinel controls failover process
3. Connecting to Redis Cluster

All modes additionally can be used with client-side consistent sharding. So it's possible to scale Redis even without Redis Cluster setup. 

Unfortunately, with pure Redigo library, it's only possible to implement [ 1 ] – i.e. connecting to a single standalone Redis instance.

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

Combining `redigo` + `FZambia/sentinel` + `mna/redisc` we were able to implement all three connection modes. This worked, though resulted in rather tricky Redis setup. Also, it was hard to re-use existing pipelining code we had for a standalone Redis with Redis Cluster. So Centrifugo only used pipelining in a standalone or Sentinel Redis cases, but when using Redis Cluster Centrifugo simply used connection pool to issue requests not benefiting from request pipelining. Due to this we had some code duplication to issue the same requests in various Redis configurations.

Another thing is that Redigo is fully interface-based. It has `Do` method which accepts name of command and variadic `interface{}` arguments to construct command arguments:

```go
Do(commandName string, args ...interface{}) (reply interface{}, err error)
```

While this works well and you can issue any command to Redis, this adds some allocation overhead. Also, you need to be very accurate when constructing a command.

At some point we felt that removing additional dependencies (even though I am the author of one of them) and reducing allocations in Redis communication layer is a nice step forward for Centrifugo. So we started looking around for `redigo` alternatives.

To summarize what we wanted from Redis library:

* Possibility to work with all three Redis setup options we support: standalone, master-replica(s) with Sentinel, Redis Cluster, so we can depend on one library instead of three
* Less memory allocations, so our users could notice a sufficient CPU reduction on Centrifugo nodes which communicate with Redis a lot
* More type-safety when constructing Redis commands
* Work with RESP2-only Redis servers as we need that for backwards compatibility. And some vendors like Redis Enterprise still support RESP2 protocol only
* The library should be actively maintained

## Go-redis

Actually, the most obvious alternative to `redigo` is [go-redis/redis](https://github.com/go-redis/redis) package. It's popular, regularly gets updates, used by a huge amount of Go projects (Grafana, Thanos, etc.). I personally successfully used it in several other projects I worked on.

To avoid setup boilerplate for various Redis setup variations `go-redis/redis` has [UniversalClient](https://pkg.go.dev/github.com/go-redis/redis/v9#UniversalClient), from docs:

> UniversalClient is a wrapper client which, based on the provided options, represents either a ClusterClient, a FailoverClient, or a single-node Client. This can be useful for testing cluster-specific applications locally or having different clients in different environments.

In terms of implementation `go-redis/redis` also has internal pool of connections to Redis, similar to `redigo`. It's also possible to get a dedicated connection from the internal pool and use it for pipelining. So `UniversalClient` reduces setup boilerplate for different Redis installation types and number of dependencies we had – and still provides similar approach for the connection management so we could easily re-implement things we had.

At some point [@j178](https://github.com/j178) sent [a pull request](https://github.com/centrifugal/centrifuge/pull/235) to Centrifuge library ([the core of Centrifugo](/docs/ecosystem/centrifuge)) with `Broker` and `PresenceManager` implementations based on `go-redis/redis`. The amount of code to cover all the various Redis setups reduced, we got only one dependency instead of three.

But what about performance? Here we will show results for several operations which are typical for Centrifugo:

1. Publish message to a channel without saving it to the history - this is just a Redis PUBLISH command going through Redis PUB/SUB system (`RedisPublish`)
2. Publish message to a channel with saving it to history - this involves executing LUA script on Redis side where we add publication to STREAM data structure, update meta information HASH and finally PUBLISH to PUB/SUB (`RedisPublish_History`)
3. Subscribe to a channel - that's a SUBSCRIBE Redis command, this is important to have it fast as Centrifugo should be able to re-subscribe to all the channels in the system upon [mass client reconnect scenario](/blog/2020/11/12/scaling-websocket#massive-reconnect) (`RedisSubscribe`)
4. Recovering missed publication state from channel STREAM, this is again may be called lots of times when all clients reconnect at once (`RedisRecover`).
5. Updating connection presence information - many connections may periodically update their channel online presence information in Redis (`RedisAddPresence`)

Here are the benchmark results we got when comparing `redigo` (v1.8.9) implementation (old) and `go-redis/redis` (v9.0.0-beta.3) implementation (new) with Redis v6.2.7:

```
❯ benchstat redigo.txt goredis.txt
name                      old time/op    new time/op    delta
RedisPublish-8            1.45µs ± 6%    1.78µs ± 2%  +22.30%  (p=0.000 n=9+9)
RedisPublish_History-8    12.5µs ± 7%     9.7µs ± 3%  -22.40%  (p=0.000 n=10+10)
RedisSubscribe-8          1.36µs ±26%    1.38µs ± 3%     ~     (p=0.195 n=10+8)
RedisRecover-8            18.2µs ± 3%    14.5µs ± 2%  -20.11%  (p=0.000 n=10+10)
RedisAddPresence-8        3.68µs ± 1%    3.37µs ± 3%   -8.36%  (p=0.000 n=10+10)

name                     old alloc/op   new alloc/op   delta
RedisPublish-8              483B ± 0%      499B ± 0%   +3.31%  (p=0.000 n=10+8)
RedisPublish_History-8    1.30kB ± 0%    1.08kB ± 0%  -16.69%  (p=0.000 n=8+8)
RedisSubscribe-8            893B ± 1%      665B ± 4%  -25.58%  (p=0.000 n=9+10)
RedisRecover-8            1.25kB ± 0%    1.02kB ± 0%  -18.29%  (p=0.000 n=10+10)
RedisAddPresence-8          907B ± 0%      827B ± 0%   -8.78%  (p=0.000 n=10+8)

name                    old allocs/op  new allocs/op  delta
RedisPublish-8              10.0 ± 0%       9.0 ± 0%  -10.00%  (p=0.000 n=10+10)
RedisPublish_History-8      29.0 ± 0%      25.0 ± 0%  -13.79%  (p=0.000 n=10+10)
RedisSubscribe-8            22.0 ± 0%      13.3 ± 5%  -39.55%  (p=0.000 n=8+10)
RedisRecover-8              29.0 ± 0%      24.0 ± 0%  -17.24%  (p=0.000 n=10+10)
RedisAddPresence-8          18.0 ± 0%      17.0 ± 0%   -5.56%  (p=0.000 n=10+10)
```

Or visualized in Grafana:

![](/img/redis_vis01.png)

:::danger

Please note that this benchmark is not a pure performance comparison of two Go libraries for Redis – it's a performance comparison of Centrifugo Engine methods upon switching to a new library.

:::

While the observed performance improvements here are not really mind-blowing – we see a noticeable reduction in allocations in these benchmarks and in some other benchmarks not presented here we observed a 2 times reduced latency.

Go-redis also provides more type-safety when constructing commands compared to Redigo, almost every command in Redis is implemented as a separate method of `Client`, for example `Publish` [defined](https://pkg.go.dev/github.com/go-redis/redis/v9#Client.Publish) as:

```go
func (c Client) Publish(ctx context.Context, channel string, message interface{}) *IntCmd
```

You can see though that we still have `interface{}` here for `message` argument type. I suppose this was implemented in such way for convenience – to pass both `string` or `[]byte`. So it still produces some extra allocations.

Overall, results convinced us that the migration from `redigo` to `go-redis/redis` may provide Centrifugo with everything we aimed for – all the goals for a `redigo` alternative outlined above were successfully fullfilled.

One good thing `go-redis/redis` allowed us to do is to use Redis pipelining also in a Redis Cluster case. It's possible due to the fact that `go-redis/redis` [re-maps pipeline objects internally](https://github.com/go-redis/redis/blob/c561f3ca7e5cf44ce1f1d3ef30f4a10a9c674c8a/cluster.go#L1062) based on keys to execute pipeline on the correct node of Redis Cluster. Actually, we could do the same based on `redigo` + `mna/redisc`, but here we got it for free.

Though we have not migrated to `go-redis/redis` in the end. And the reason is another library – `rueidis`.

## Rueidis

While results were pretty good with `go-redis/redis` we also made an attempt to implement Redis Engine on top of [rueian/rueidis](https://github.com/rueian/rueidis) library written by [@rueian](https://github.com/rueian). According to docs, `rueidis` is:

> A fast Golang Redis client that supports Client Side Caching, Auto Pipelining, Generics OM, RedisJSON, RedisBloom, RediSearch, RedisAI, RedisGears, etc.

The readme of `rueidis` contains benchmark results where it hugely outperforms `go-redis/redis` in both single Redis and Redis Custer setups:

![](/img/rueidis_1.png)

![](/img/rueidis_2.png)

`rueidis` library comes with **automatic implicit pipelining**, so you can send each request in isolated way while `rueidis` makes sure request becomes part of the pipeline sent to Redis – thus utilizing the connection between an application and Redis in the most efficient way with maximized throughput. The idea of implicit pipelining with Redis is not new and Go ecosystem already had [joomcode/redispipe](https://github.com/joomcode/redispipe) library which implemented it (though it comes with some limitations critical for Centrifugo use case).

For Centrifugo we didn't expect such a huge speed-up as shown on the graphs above since we already used pipelining in Redis Engine. I did some prototypes with `rueidis` which were super-promising in terms of performance. There were some issues found during that early prototyping (mostly with PUB/SUB) – but all of them were quickly resolved by Rueian (`rueidis` author).

Until `v0.0.80` release `rueidis` did not support RESP2 though, so we could not replace our Redis Engine implementation with it. But as soon as it got RESP2 support we opened [a pull request with alternative implementation](https://github.com/centrifugal/centrifuge/pull/262).

`rueidis` works with standalone Redis, Sentinel Redis and Redis Cluster out of the box. Just like `UniversalClient` of `go-redis/redis`. So it also allowed us to reduce code boilerplate to work with all these setups.

Since auto-pipelining is used in `rueidis` by default we were able to remove some of our pipelining management code – so the Engine implementation is more concise now. One more thing to mention is a simpler PUB/SUB code we were able to write with `rueidis`. In `redigo` case we had to periodically PING PUB/SUB connection to maintain it alive, `rueidis` does this automatically.

Regarding performance, here are the benchmark results we got when comparing `redigo` (v1.8.9) implementation (old) and `rueidis` (v0.0.83) implementation (new):

```
❯ benchstat redigo.txt rueidis.txt
name                      old time/op    new time/op    delta
RedisPublish-8            1.45µs ± 6%    0.59µs ± 3%  -59.67%  (p=0.000 n=9+8)
RedisPublish_History-8    12.5µs ± 7%     9.7µs ± 0%  -22.28%  (p=0.000 n=10+10)
RedisSubscribe-8          1.36µs ±26%    1.60µs ± 8%  +17.90%  (p=0.007 n=10+10)
RedisRecover-8            18.2µs ± 3%    10.9µs ± 1%  -40.01%  (p=0.000 n=10+10)
RedisAddPresence-8        3.68µs ± 1%    3.54µs ± 0%   -3.86%  (p=0.000 n=10+9)

name                     old alloc/op   new alloc/op   delta
RedisPublish-8              483B ± 0%      171B ± 0%  -64.66%  (p=0.000 n=10+10)
RedisPublish_History-8    1.30kB ± 0%    0.55kB ± 1%  -57.68%  (p=0.000 n=8+10)
RedisSubscribe-8            893B ± 1%      841B ± 6%   -5.85%  (p=0.000 n=9+10)
RedisRecover-8            1.25kB ± 0%    0.59kB ± 1%  -53.08%  (p=0.000 n=10+10)
RedisAddPresence-8          907B ± 0%      149B ± 2%  -83.52%  (p=0.000 n=10+10)

name                    old allocs/op  new allocs/op  delta
RedisPublish-8              10.0 ± 0%       3.0 ± 0%  -70.00%  (p=0.000 n=10+10)
RedisPublish_History-8      29.0 ± 0%      12.0 ± 0%  -58.62%  (p=0.000 n=10+10)
RedisSubscribe-8            22.0 ± 0%      10.0 ± 0%  -54.55%  (p=0.002 n=8+10)
RedisRecover-8              29.0 ± 0%      11.0 ± 0%  -62.07%  (p=0.000 n=10+10)
RedisAddPresence-8          18.0 ± 0%       3.0 ± 0%  -83.33%  (p=0.000 n=10+10)
```

Or visualized in Grafana:

![](/img/redis_vis02.png)

2.5x times more publication throughput than we had before! Instead of 700k publications/sec we went towards 1.7 million publications/sec due to drastically decreased publish operation latency (1.45µs -> 0.59µs). This obviously means that our previous Engine implementations under-utilized Redis, and Rueidis just pushes us towards Redis limits. The latency of most other operations is also reduced (except for `Subscribe`).

Other applications which use pool-based approach may benefit even more dramatic improvements in latency.

The best thing is allocation efficiency of the `rueidis`-based implementation. As you can see `rueidis` helped us to generate sufficiently less memory allocations for all our Redis operations. Allocation improvements directly affect Centrifugo node CPU usage. So Centrifugo users with Redis Engine may expect CPU usage reduction upon switching to Centrifugo v4.1.0. Of course it's not a two times CPU reduction since Centrifugo node does many other things beyond Redis communication. On our test stand we observed a 20% overall CPU drop, but obviously this number will vary in both directions depending on load profile and used Centrifugo features.

For Redis Cluster case we also got benchmark results similar to standalone Redis results above.

Why `rueidis` is that efficient? Insights about this are provided by its author in a "Writing a High-Performance Golang Client Library" series of posts on Medium:

* [Part 1: Batching on Pipeline](https://betterprogramming.pub/writing-high-performance-golang-client-library-part-1-batching-on-pipeline-97988fe3211)
* [Part 2: Reading Again From Channels?](https://betterprogramming.pub/working-on-high-performance-golang-client-library-reading-again-from-channels-5e98ff3538cf)
* [Part 3: Remove the Bad Busy Loops With the Sync.Cond](https://betterprogramming.pub/working-on-high-performance-golang-client-library-remove-the-bad-busy-loops-with-the-sync-cond-e262b3fcb458)

One more thing to mention – I really enjoyed building commands with `rueidis`. All Redis commands may be constructed using a builder approach based on code generation. For example, this is a process of building a PUBLISH Redis command:

<video width="100%" loop="true" autoplay="autoplay" muted controls="" src="/img/rueidis_cmd.mp4"></video>

This drastically reduces a chance to make a stupid mistake while constructing a command. Instead of always opening Redis docs to see a command syntax it's now possible to just start typing - and quickly come to the complete command to send.

You may also find other features of `rueidis` useful – like OpenTelemetry integration, client-side caching support to avoid network round trips while accessing an application cache data, integration with popular Redis modules like RediSearch or RedisJSON, etc.

## Redis 7 performance drop

One thing worth mentioning and which may be helpful for someone is that during our comparison experiments we discovered that Redis 7 has a major latency increase compared to Redis 6. This is definitely true for Lua scripts execution and currently investigated inside [this Redis issue](https://github.com/redis/redis/issues/10981).   

## Conclusion

Migrating from a stable to a relatively new library is a risky step. In this perspective `redigo` and `go-redis/redis` may be more mature options with bigger community behind. We spent some time testing various failure scenarios though – and new `rueidis`-based Engine implementation behaved as expected.

I believe that we will find more projects in Go ecosystem using `rueidis` library in the near future. Not just because its allocation efficiency and out-of-the-box throughput but also due to a handy type-safe command API.

For Centrifugo users this migration means more efficient CPU usage which should be noticable for setups with many publications, or with many history requests, or with many presence requests. 

There were some other improvements in our Redis Engine implementation not outlined in this post – for example, in new implementation we got a sufficiently larger publish and subscribe throughput upon increased latency between Centrifugo and Redis. Also, we supported [sharded PUB/SUB feature](https://redis.io/docs/manual/pubsub/#sharded-pubsub) available in Redis Cluster since Redis v7 – it allows better scaling of PUB/SUB inside Redis Cluster.
