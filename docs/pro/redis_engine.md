---
id: redis_engine
title: Optimized Redis engine
---

Centrifugo PRO has an optimized version of Redis Engine which provides two important benefits:

* Drastically reduced memory allocations which transforms to less CPU usage of Centrifugo node
* Support Redis Cluster [sharded PUB/SUB](https://redis.io/docs/manual/pubsub/#sharded-pubsub) (introduced in Redis v7)

## Enable optimized Redis engine

By default, Centrifugo PRO uses the same Redis Engine as the OSS version. You need to explicily enable an optimized version of Redis engine. This is done due to some limitations of the optimized version:

* It requires Redis >= 6
* It works only over the latest Redis protocol RESP 3
* It does not support keeping history in Redis Lists – only in Stream data structure

If you are OK with all these limitations then:

```json title="config.json"
{
    "redis_optimized": true
}
```

– will enable using an optimized Redis Engine by Centrifugo PRO.

## Sharded PUB/SUB

As you may know default PUB/SUB does not scale well in Redis Cluster as publications in channels propagate to all nodes in Redis Cluster. So PUB/SUB scalability is limited by network and reduces as soon as number of nodes in Redis Cluster increases. See more detailed description [in this issue](https://github.com/redis/redis/issues/2672). Redis v7 introduced [sharded PUB/SUB](https://redis.io/docs/manual/pubsub/#sharded-pubsub) to fix this.

Centrifugo PRO provides an integer option called `redis_num_cluster_shards`. By default it's `0` – which means that Centrifugo uses global PUB/SUB in Redis Cluster. If you set `redis_num_cluster_shards` to the value greater than zero then Centrifugo will split PUB/SUB to the configured number of shards.

For example, you can set the value to `32` – and this tells Centrifugo to split key space and channel space to `32` parts spread over Redis Cluster. And will use separate sharded PUB/SUB routines for each shard. This way it's possible to avoid limitations of PUB/SUB in a single Redis Cluster.
