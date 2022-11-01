---
title: Improving Centrifugo Redis Engine implementation – the battle between three Go Redis libraries
tags: [centrifugo, redis, go]
description: In this post we want to share some details about Centrifugo Redis engine implementation and its recent improvements
author: Alexander Emelin
authorTitle: Author of Centrifugo
authorImageURL: https://github.com/FZambia.png
image: /img/101-way.png
hide_table_of_contents: false
---

![Centrifuge](/img/101-way.png)

To achieve possibility to scale client connections between many nodes Centrifugo uses Redis. Redis is incredibly mature, relatively simple and super-fast in-memory storage. Due to many various built-in data structures and PUB/SUB support Redis is a perfect choice to be both Centrifugo `Broker` and `PresenceManager`.

To give you some glue what is `Broker` and `PresenceManager` in Centrifugo, `Broker` is responsible for keeping subscriptions coming from different Centrifugo nodes (initiated by client connections), thus connecting channel subscribers on different nodes. This allows scale connections over many Centrifugo nodes and not worry about same channel subscribers being connected to different nodes – all nodes are connected with PUB/SUB. Another important part of Broker is keeping expiring publication history streams for channels – so that Centrifugo may provide a fast cache for messages missed by clients and compensate at most once delivery of Redis PUB/SUB using incremental offsets. Centrifugo uses HASH and STREAM data structures in Redis to keep channel history.

Presence manager is responsible for online presence information - i.e. list of currently active channel subscribers. This data should also expire if not updated by client connection for some time. Centrifugo uses two Redis data structures for managing presence in channels - HASH and ZSET.

## Popular Redis libraries in Go

In this post we will compare three popular Redis libraries for Go:

1. Redigo
2. Go-redis
3. Rueidis

As a small disclaimer, this post is not a direct performance comparison of all these libraries, this is mostly the story behind recent refactoring we did. Some numbers here may give you insights about performance too – but you better measure for your own use case.

## Redigo

The implementation of Redis Engine (`Engine` in Centrifugo == `Broker` + `PresenceManager`) was based on `redigo` library for a long time.

Redigo library provides a Redis connection pool. A simple usage if it is to get the connection from the pool, issuing request to Redis using that connection, and putting the connection to the pool after receiving the result from Redis.

Redigo is a very nice stable library which served us well. There are several techniques we used to achieve a better performance for Centrifugo engine:

1. Instead of using Redigo pool for each operation we acquired a dedicated connection from the pool and used Redis pipelining to send commands where possible. Redis pipelines allow to improve performance by executing multiple commands using a single client-server-client round trip. Instead of executing 100 commands one by one, you can queue the commands in a pipeline and then execute the queued commands using a single write + read operation as if it is a single command. Also, given a single CPU nature of Redis, reducing number of connections has a good effect on throughput.
2. We had a dedicated goroutine responsible for subscribing to channels. This goroutine also used a dedicated connection to Redis to send SUBSCRIBE/UNSUBSCRIBE Redis commands, batching commands to utilize pipeline object (using smart batching technique, we described the approach in one of the previous posts in this blog).

## Limitations of Redigo

There are three modes in which Centrifugo can work with Redis these days:

1. Connecting to a standalone single Redis instance (with optional client-side sharding)
2. Connecting to Redis in leader-follower configuration, where separate Redis Sentinel controls failover process
3. Connecting to Redis Cluster

Unfortunately with pure Redigo library it's only possible to implement [1] – i.e. connecting to a single standalone Redis instance.

To support scheme with Sentinel you whether need to have proxy between application and Redis which proxies connection to Redis master. For example, with Haproxy it's possible in this way:

```

```

Or, you need to additionally import FZambia/sentinel library - which provides communication with Redis Sentinel on top of Redigo connection Pool.

For communicating with Redis Cluster one more library may be used – mna/redisc.

Combining Redigo + FZambia/sentinel + mna/redisc it was possible to implement all three connection modes. This resulted in quite tricky Redis setup, also it was hard to re-use existing pipelining code we had for a standalone Redis with Redis Cluster. So Centrifugo only used pipelining in standalone or Sentinel Redis cases, but when using Redis Cluster Centrifugo simply used connection pool to issue requests. Thus we had some code duplication to issue the same requests in various Redis configurations.

Another thing is that Redigo is fully interface-based. It has `Do` method which accepts name of command and variadic `interface{}` arguments to construct command arguments. While this works well and you can issue any command to Redis, this adds some allocation overhead.

At some point we felt that removing additional dependencies and reducing allocations is a nice improvement for Centrifugo. So we started looking around for `redigo` alternatives.

To summarize what we wanted from Redis library:

* Possibility to work with all three Redis setup options we support: standalone, master-replica(s) with Sentinel, Redis Cluster, so we can depend on one library instead of three
* Less memory allocations, so our users could notice a sufficient CPU reduction on Centrifugo nodes
* Well-maintained

## Go-redis

Actually, the most obvious alternative to `redigo` we found was `go-redis` package. It's very popular, regularly gets updates, used by a huge amount of Go projects.

To avoid setup boilerplate for various Redis setup variations `go-redis` has `UniversalClient`, from docs:

> UniversalClient is a wrapper client which, based on the provided options, represents either a ClusterClient, a FailoverClient, or a single-node Client. This can be useful for testing cluster-specific applications locally or having different clients in different environments.

In terms of internal implementation `go-redis` also has internal pool of connections, similar to `redigo`, but it's also possible to get dedicated connection from the internal pool and use it for pipelining purposes. So `UniversalClient` reduces boilerplate and dependencies we had and still provides similar approach for the connection management.

At some point @j178 [sent pull request](https://github.com/centrifugal/centrifuge/pull/235) with Centrifuge `Broker` and `PresenceManager` implementations based on `go-redis`. The amount of code to cover all the various Redis setups reduced, we got only one dependency instead of three.

But what about performance? We will compare several operations which are typical for Centrifugo:

1. Publish message to a channel without saving to history - this is just a Redis PUBLISH command
2. Publish message to a channel with saving to history - this involves executing LUA script on Redis side where we add publication to STREAM, update meta information HASH and PUBLISH to PUB/SUB 
3. Subscribe to a channel - that's a SUBSRIBE Redis command, this is important to have it fast as Centrifugo should be able to re-subscribe to all the channels in the system upon mass client reconnect scenario
4. Updating connection presence information - many connections may periodically update their presence info if enabled for a channel

The comparison between `redigo` implementation and `go-redis` implementation:

For 1:

```
name                                         old time/op    new time/op    delta
RedisPublish-16                    10.0µs ± 3%     9.4µs ± 1%    -5.90%  (p=0.008 n=5+5)

name                                         old allocs/op  new allocs/op  delta
RedisPublish-16                      10.8 ±11%      10.0 ± 0%      ~     (p=0.095 n=5+4)
```

For 2:

```
RedisPublish_History-16            48.5µs ± 1%    38.7µs ± 2%   -20.30%  (p=0.008 n=5+5)
```

For 3:

```

```

For 4:

```

```

One good thing `go-redis` allowed us to do is to use Redis pipelining also in Redis Cluster case. It's possible due to the fact that `go-redis` [re-maps pipeline objects internally](https://github.com/go-redis/redis/blob/c561f3ca7e5cf44ce1f1d3ef30f4a10a9c674c8a/cluster.go#L1062) based on keys to execute pipeline on the correct node of Redis Cluster.

The benchmarks for cluster were comparable in `redigo` case and in `go-redis` case. Seems like Redis pipelining does not provide a huge benefit. But thats on `localhost`. What if we add some latency between application and Redis?

To simulate latency we won't do complex things with network, but just add `time.Sleep` to our methods where Redis is called. This way we efficiently adding delay between getting the connection from pool and putting it back.

TODO.
