---
title: Scaling Redis Pub/Sub to Millions of Channels and Hundreds of Subscriber Nodes
tags: [redis, pubsub, scalability]
description: How we scaled Redis Pub/Sub — from talking to Redis more efficiently to sharding across isolated Redis instances or with Redis Cluster without drowning in connections.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
image: /img/blog_scaling_redis.jpg
authorImageURL: /img/alexander_emelin.jpeg
hide_table_of_contents: false
draft: true
---

import RedisClusterSlotsDiagram from '@site/src/components/RedisClusterSlotsDiagram';
import PubSubFanoutDiagram from '@site/src/components/PubSubFanoutDiagram';
import PubSubPipelineDiagram from '@site/src/components/PubSubPipelineDiagram';
import PubSubReadLoopDiagram from '@site/src/components/PubSubReadLoopDiagram';
import PubSubShardingDiagram from '@site/src/components/PubSubShardingDiagram';
import ClusterBroadcastDiagram from '@site/src/components/ClusterBroadcastDiagram';
import ClusterShardedPubSubDiagram from '@site/src/components/ClusterShardedPubSubDiagram';
import PubSubClusterPartitionDiagram from '@site/src/components/PubSubClusterPartitionDiagram';
import PubSubPrecomputedTagsDiagram from '@site/src/components/PubSubPrecomputedTagsDiagram';
import PubSubNodeGroupDiagram from '@site/src/components/PubSubNodeGroupDiagram';

[Redis Pub/Sub](https://redis.io/docs/latest/develop/pubsub/) is a popular choice for propagating messages between nodes in real-time messaging systems. It lets a system run many nodes — each holding many real-time client connections — and deliver each message to the nodes that have interested subscribers.

![](/img/blog_redis_scaling_real_time_system.jpg)

This post walks through the gotchas that come up keeping Pub/Sub working across the variety of setups Centrifugo users run — specifically the ones with millions of channels and hundreds of server nodes handling client connections.

[Jump to the end for TLDR](#summing-up)

<!--truncate-->

:::note

This post talks about **Redis**, but everything here applies equally to **[Valkey](https://valkey.io/)** too.

:::

For a general-purpose real-time messaging server, scenarios differ a lot from one deployment to another, so the design has to support a range of them. Two real-time-messaging realities in particular shaped the decisions described in this post:

- **The system can have a lot of active channels** – millions of them. There might be one per user, per document, or per game session, each created and thrown away all the time, so the server is constantly subscribing and unsubscribing. Usually each channel carries fairly light traffic (depends on the real-time feature it serves, only up to 60-100 messages per second in extreme cases); the load is spread across many channels rather than concentrated in a few.
- **There can be a lot of subscriber nodes too.** Any node might care about any channel at any moment, so each one subscribes to whatever its clients need and has to receive everything published there. Once a deployment grows to hundreds of nodes, anything that costs something per node adds up very fast.

## Keeping up with Redis

Redis Pub/Sub is deliberately minimal: a client subscribes to a named *channel*, and a publish to that channel reaches whoever is subscribed at that exact moment. Nothing is stored and nothing is retried, so a subscriber that wasn't connected when a message went out never sees it – at most once delivery.

Before scaling Redis itself, whatever Redis setup you're running – your app needs to keep up with Redis first. Otherwise, your app is the first bottleneck. When we talk about Redis Pub/Sub, application nodes do two things — publishing messages and subscribing to receive messages.

<PubSubFanoutDiagram />

### Efficient publishing

Redis runs every command (in our case PUBLISH and SUBSCRIBE) on a single thread sequentially. Modern Redis and Valkey can spread network I/O across extra threads, which [lifts throughput](https://valkey.io/blog/unlock-one-million-rps/), but command execution itself stays serialized, so one instance still has a ceiling you can hit.

The plain way to write the code is to send a command, wait for the reply, then send the next one. Redis handles a single `PUBLISH` or `SUBSCRIBE` lightning fast — the real overhead is the trip across the network and back — so doing them one by one means you spend almost all your time waiting. The fix is **pipelining**: send many commands one after another and read the replies later, so one trip across the network carries many commands at once. If you're using Go, a client like [rueidis](https://github.com/redis/rueidis) does this for you: commands issued close together go out in one batch, with a small flush delay ([`MaxFlushDelay`](/blog/2022/12/20/improving-redis-engine-performance), about 100µs) marking where a batch ends.

Not only will you get higher throughput with pipelining, but also decreased CPU resource usage on both client and Redis server sides – we demonstrated this earlier in [Improving Centrifugo Redis Engine throughput and allocation efficiency with Rueidis Go library](/blog/2022/12/20/improving-redis-engine-performance) blog post.

<PubSubPipelineDiagram />

### Efficient subscribing

Subscribing works the same way on the command level as `PUBLISH` — so the optimization is the same – send many channels in one `SUBSCRIBE` instead of one per channel, batched in chunks (**512** in our case, but you decide) — so when many clients reconnect at once or application nodes resubscribe after a network glitch, a few large batched commands are far more efficient across the client, protocol, and Redis layers.

Redis [keeps a buffer](https://redis.io/docs/latest/develop/reference/clients/#output-buffer-limits) for each Pub/Sub connection, and if the reader doesn't drain it fast enough, Redis drops the connection. So the reader can never get stuck. The rule that keeps it moving is simple: the part that reads the socket does nothing but read. Everything else should be moved to a dedicated application-level pool of workers. Delivery is at most once anyway, so you have some freedom in how to organize backpressure in the workers. In most cases, workers falling behind is a signal that it's time to scale the application nodes. To keep a channel's messages in order, pick the worker by a hash of the channel name: every message for a channel goes to the same worker, while different channels spread across all the cores. To achieve better application throughput, a few pipeline connections instead of a single one may also help.

<PubSubReadLoopDiagram />

There's a second reason to keep each node fast, and it grows more important the larger you get. Adding more application nodes spreads the messages around, so each node handles fewer of them — which makes it tempting to just add nodes. But every node opens its own connections to Redis, and the connection count may be a concern at scale – we will come back to this soon.

We recommend implementing an application metric that shows the end-to-end lag of a message propagated through Pub/Sub. This can be achieved by recording the publication timestamp on the publisher side and subtracting it from the time the message is received on the subscriber side.

## Single Redis Pub/Sub limit

A single Redis instance is really fast, and I/O threading lets it use several cores for network work — but it still runs every command on one thread, and once that thread saturates there's nothing Redis can do.

In our benchmark on Hetzner, on a machine with dedicated vCPU, a single Redis instance held a load up to about **650,000 messages per second** (not just published, but all delivered to active subscribers, each message 256 bytes). After that, end-to-end latency started to grow fast — a signal of saturation. To be honest, this throughput should be enough for most use cases. But to go further you have to stop using a single Redis instance.

## Client-side Pub/Sub sharding

The simplest solution is to spread the Pub/Sub load across several independent Redis instances. The application decides which Redis instance handles a given channel by hashing the channel's name, for example with a [Jump consistent hash](https://arxiv.org/abs/1406.2294) or any other. Consistent hashing here may help to keep most of the data on the same Redis instances after adding a Redis node and re-sharding.

A publisher and a subscriber both use the same hash function over the channel name, so they always land on the same instance without having to talk to each other, and the instances don't even know about one another — so each instance you add takes a share of the load.

<PubSubShardingDiagram />

In our benchmarks Pub/Sub throughput increased linearly as we added Redis instances — each one took an even share of the load, about 1/N of it, and latency stayed low. So 650k messages per second became around 5M messages per second with 8 Redis instances and 24 subscriber nodes. The instances share nothing, so the total capacity is just one instance's limit times the number of instances.

The number of connections per subscriber node is multiplied by the number of Redis shards. For example, for 8 separate Redis instances and 24 subscriber nodes it's 24 x 8 x (N pipeline conns).

This client-side sharding topology works, but the operational side falls on you. The list of Redis instances lives in the server's own configuration, so adding capacity isn't just starting another Redis — it's a reconfiguration that every node has to pick up.

The obvious next step is to switch to Redis Cluster, which manages the group of nodes for us. But that's where Redis Pub/Sub runs into trouble.

## Classic Redis Cluster Pub/Sub does not scale

So we bring in **Redis Cluster**, which joins a group of Redis nodes into one system.

A single Redis holds everything in one process, while Redis Cluster spreads the data across several nodes. It does this by splitting all possible keys into **16,384 buckets** called *hash slots*: every key belongs to exactly one of them, chosen by `CRC16(key) % 16384`, and each node owns a range of slots. To reach a key, the client hashes it and goes straight to the node that owns that slot.

There's also a handy trick called a **hash tag**. If a key contains braces, Redis only hashes the part inside the `{...}`, which lets you force a group of keys into the same slot — and so onto the same node — whenever you want them to stay together.

<RedisClusterSlotsDiagram />

Because keys are spread across nodes this way, ordinary operations scale beautifully. A `GET` or `SET` goes only to the node that owns the key, so adding nodes spreads both the data and the load, and throughput grows almost linearly — that's the whole appeal of Redis Cluster. Pub/Sub is the exception.

Ordinary Pub/Sub in Redis Cluster sends every published message to *every* node — even the nodes where nobody is subscribed to that channel. It has no real choice: a subscriber could be attached to any node, so the only way to be sure they get the message is to copy it everywhere. That sounds harmless until you see the cost — the more nodes you add, the worse it gets, because each one has to carry every message, including all the ones it has no subscriber for.

<ClusterBroadcastDiagram />

There's a second, less visible problem with this. With classic Pub/Sub you can't choose which node handles your subscriptions — they all go over a single connection to whichever node it happens to point at for the first subscribe operation. So one node can end up tracking every subscription while the rest sit nearly idle – an unfortunate unbalanced situation.

In our benchmarks, a classic Redis Cluster behaved just as the theory above says. Under load in a 3-node Redis Cluster, the delivery latency grew from milliseconds to whole seconds long before the 650k messages per second we achieved with a single instance, somewhere around 400k messages per second. And it got even worse as nodes were added.

## Sharded Pub/Sub to the rescue

Redis 7 introduced **[sharded Pub/Sub](https://redis.io/docs/latest/develop/pubsub/#sharded-pubsub)** (`SSUBSCRIBE` / `SPUBLISH`) to fix exactly this: a message now travels only to the Redis node that owns its channel's slot — no more broadcast to nodes that don't care, which solves the throughput problem.

<ClusterShardedPubSubDiagram />

While for some applications moving to sharded Pub/Sub is a simple move to use new methods of the Redis client driver, for our workloads it was not that simple.

With classic Pub/Sub, subscribing was trivial: take Pub/Sub connection and send `SUBSCRIBE` commands over it. We did not care which Redis node it points to. Now with sharded Pub/Sub and `SSUBSCRIBE` the Pub/Sub connection the `rueidis` driver exposes points to the node which owns a slot of the first channel we subscribed to. `SSUBSCRIBE` also supports a batch of channels, but all must belong to the same hash slot.

To subscribe to a second channel we cannot simply reuse the existing Pub/Sub connection – we need to create another one. If we had only several channels in the app – we could just create several sharded Pub/Sub connections and that's it. But in our use case we may have millions of channels – we simply can't afford that way, as creating a million connections to Redis is not something we would even try. So we have a problem with the number of connections. And it's not clear how we could keep the subscribe batching we previously had in this situation.

## App-level partitions

The way around we found is to stop treating channels individually and group them. Each channel is hashed into a small, fixed number (**N**) of **partitions**, far smaller than the channel count. And the number of partitions must be larger than your Redis Cluster size for better distribution. By default, we use 128. Every channel in a partition gets the same hash-tag, so they all land in the same slot, on the same Redis node. A channel key ends up shaped like `{<partition>}.<channel>`.

A single partition then uses a single connection: when the first channel in a partition is subscribed, the client opens one connection to that partition's node, and every other channel in the partition reuses it. Because those channels share a slot, their subscriptions batch and pipeline on that connection, the way classic Pub/Sub batched.

And because the partitions are spread across the cluster, the connections spread with them instead of piling onto one node. So instead of a connection per channel there's **one per partition** — N per node — and subscribing is back to cheap, batched commands over a handful of steady connections, even as channels come and go.

<PubSubClusterPartitionDiagram />

## Fixing uneven slot distribution

Partitions leave a question skipped over, though: what to actually use as each partition's tag? The obvious answer is the partition's own index — `{0}`, `{1}`, `{2}`, … `{N}` — the natural starting point. It works, but it has a hidden problem. Run those short strings through CRC16 and the slots they hash to aren't evenly spread, so some Redis nodes end up with many more partitions than others.

Take, for example, a 6-node cluster with N = 128 partitions: with naive `{0}`…`{127}` tags the partitions land `[27, 15, 22, 23, 16, 25]` across the six nodes — the busiest carries nearly twice the load of the lightest, and it only gets more lopsided on bigger clusters. No node sits fully idle, but the load is uneven — and uneven is exactly what you don't want after adding nodes to spread it.

So we had to be more deliberate about picking the tags. For a given number of partitions, an offline search finds a set of short tag strings whose CRC16 slots stay balanced across *every* cluster size from one node up to that number — 1, 2, 3, and so on, each size in the range, not just a few picked in advance. So however many Redis nodes you run today, and however you resize the cluster later, the partitions keep spreading evenly. The search (a small [simulated-annealing pass](https://github.com/centrifugal/centrifuge/tree/master/internal/redispartition)) runs once and bakes its result into a static table of **precomputed tags**, so at runtime it's just a lookup. The partitioning scheme doesn't change, and neither does the connection count — only which slot each partition lands on, and now they're spread out properly. On that same 6-node cluster the 128 partitions land `[21, 22, 21, 21, 22, 21]` — near-perfectly even, instead of the lopsided `[27, 15, 22, 23, 16, 25]` the naive tags gave.

The key part: the tags aren't tuned for one cluster size. The search balances the partitions for **every cluster size** from 1 node up to the partition count at once — so with 128 partitions the same set stays even at 3 nodes, 6, 12, 50, anything up to 128. That's the real payoff: whatever size you run today, and whatever you resize to later, no re-tagging is needed and no hot node appears. Take that same setup from 6 nodes to 12 and the tags hold — the 128 partitions now land `[11, 10, 11, 11, 10, 11, 11, 10, 11, 11, 10, 11]`, 10 or 11 on every node. Naive tags go the other way — at 12 nodes they give `[10, 17, 5, 10, 16, 6, 8, 15, 9, 7, 16, 9]`, the busiest node carrying more than three times the lightest. Past 128 nodes you simply have more nodes than partitions, so some would sit empty — but by then you'd raise the partition count.

<PubSubPrecomputedTagsDiagram />

It's a real, measurable improvement on clusters of any decent size — the load evens out instead of piling onto a few nodes. With the traffic spread evenly, one problem is left: the total number of connections keeps growing.

## Reducing connections to cluster

Sharded Pub/Sub got the throughput back — each message reaches a single node, and the cluster scales the way client-side sharding does. But two things about these deployments turn the connection count into a problem: there is a fixed number of partitions, and there are many consumer nodes, each opening its own connection per partition — and those two counts multiply together.

Let's do the math. Under the partition scheme each node opens one connection per partition, so 128 partitions across 200 nodes works out to `200 × 128 = 25,600` connections into the cluster, and spread over a 6-node cluster that's about 4,267 of them landing on each Redis node. That's the point where you start hitting real limits — `maxclients`, file descriptors, the overhead Redis and app have for every connection. We had exactly this case in practice – for the setup with 20M WebSocket connections in AWS.

Those connections are largely redundant. Each Redis node owns a whole *range* of slots, so 20-21 of the 128 partitions live on any given node — and a single connection to that node can subscribe to all of them. In that case the natural unit isn't the partition, it's the Redis node itself – so the idea is to group Pub/Sub connections by nodes instead of partitions.

<PubSubNodeGroupDiagram />

With the same 200 nodes and the same 6-node cluster, the count drops to `200 × 6 = 1,200` connections in total, just 200 per Redis node.

The partition count can then be raised — 1024 or 4096 instead of 128 — without adding connections. A higher count spreads channels across more slots, for a finer, more even distribution on larger clusters.

You might wonder why partitions stay at all now that connections no longer depend on them — why not drop the layer and let each channel hash to its natural slot? The thing is, that's not one slot per channel: channels still fall into Redis Cluster's 16,384 hash slots, so with millions of them many share a slot and `SSUBSCRIBE` still batches. Dropping partitions doesn't lose batching — it just sets the grouping to its finest, up to 16,384 groups. Partitions are a deliberately *coarser* grouping: a few hundred groups instead of up to 16,384. Since every channel in one `SSUBSCRIBE` must share a slot, fewer groups means fatter batches and fewer commands on a bulk subscribe.

That's invisible in steady state — a single subscribe is one `SSUBSCRIBE` either way — and it shows up in a reconnect storm. A network glitch or failover drops connections, and across a large fleet many nodes resubscribe everything they held at the same moment. With a few hundred partitions each node replays its subscriptions in far fewer, fatter commands than it would falling back to raw slots.

As a concrete example, on a 6-node cluster with 128 partitions each Redis node owns about 21 partitions. Drop partitions and that node owns about 2,731 of the 16,384 slots instead. So when a node resubscribes, its connection to one Redis node sends about **21 `SSUBSCRIBE`s with partitions, or about 2,731 without** — 130 times more. The count never goes past 16,384, and it never grows with the number of channels. (Each `SSUBSCRIBE` carries at most the batch size — 512 in our case — so once a partition holds more than that, both cases send about `channels / 512` commands and the gap closes.) So it's tens of commands per Redis node instead of thousands — not millions. Small on its own, but when a whole fleet reconnects at once those thousands add up on every node, right when the cluster is busy recovering.

So partitions may stay — not for the connection count now, but to keep these big resubscribes cheap. Dropping them is a fair choice too: you trade the cheap resubscribe for the most even distribution. It's the same dial either way — more partitions (at the limit, the full 16,384 slots) spread channels more evenly but send more subscribe commands; fewer send fewer, bigger commands but pack more channels into each slot.

## Following the cluster as it moves

Implementing node grouping isn't free and comes with some complexity, mainly around tracking cluster topology. The approach won't be available out-of-the-box in most existing Redis drivers. Luckily, [rueidis](https://github.com/redis/rueidis) library which we use to communicate with Redis provides enough knobs to implement the functionality.

Because the server routes subscriptions to Redis nodes itself, it also has to track the cluster itself. It keeps a small map — each partition to the Redis node that owns its slot — built from `CLUSTER SLOTS` and the client's node list. Each Redis node gets one connection carrying the partitions it owns. A cluster reshuffles this at any time: a node joins, a node leaves, or slots move to rebalance, and the server has to notice each change and rewire.

There are two ways it knows about changes. A background loop re-runs `CLUSTER SLOTS` on a periodic interval — every 30 seconds in our case — and rebuilds the map; if the node count changed, or any partition now points at a different node, the layout changed. But the poll isn't the only signal. When the cluster moves a slot off a node, Redis sends an unsolicited `sunsubscribe` for the sharded channels held there — the node announcing it no longer owns them. The server catches that on the connection and triggers a rebuild right away, so a removed node or a moved slot doesn't wait up to 30 seconds to take effect.

A rebuild recomputes the map and rewires the connections: open one to a Redis node that appeared, drop the one to a node that left, and resubscribe each partition on its new owner. Publishes need no help — a cluster-aware client already sends each `SPUBLISH` to whichever node owns the slot — so once the subscribe side re-points, publisher and subscriber meet on the new node again. One catch: just after a node joins, the client may not know its address yet, so a slot looks unowned. The server sends a throwaway `GET` to a key in that slot, the cluster replies `MOVED`, and the client learns the new node in time for the next rebuild.

## Cluster or client-side sharding?

With node grouping in place, a Redis Cluster ends up working like client-side sharding: every Redis node is an independent single instance, owning its own slots and carrying no cross-node Pub/Sub traffic. Its ceiling is one core — about 650k messages a second in our benchmarks — and in those same benchmarks throughput rose linearly as we added cluster nodes, each node giving about another 650k, the same as adding client-side shards. Run side by side, the two were hard to tell apart: low latency, with the load split evenly and each node carrying its 1/N share.

Let's compare two approaches:

| | Client-side sharding | Node-grouped Redis Cluster |
|---|---|---|
| **Throughput** | N × single-Redis | the same |
| **Connections** | nodes × Redis instances | nodes × Redis instances (similar) |
| **Membership & failover** | you build it yourself | the cluster handles it |
| **Adding capacity** | edit the instance list by hand, every node reloads | add a node, slots rebalance on their own |
| **What you maintain** | a Redis list in config | extra code for node-grouping |

Honestly, client-side sharding is just simpler — it's a list of Redis addresses and a hash function, nothing more — and for a lot of deployments that's plenty, as long as you don't mind editing that list and resharding by hand as you grow. Redis Cluster earns its extra complexity exactly when you would rather not: it manages membership, failover, and resharding itself, and node grouping is what keeps its Pub/Sub scaling while it does.

## Summing up

A single Redis Pub/Sub instance scales well until one core saturates. Past that you need more Redis nodes, either through client-side sharding or Redis Cluster.

Redis Cluster, though, broadcasts every published message to all nodes by default — so adding nodes lowers throughput instead of raising it, and subscriptions can pile unevenly onto one node.

Sharded Pub/Sub fixes that by turning the cluster into a set of independent Redis instances, just like client-side sharding — so capacity scales linearly as you add nodes, but without you having to manage the instance list yourself.

For our specific situation — large amount of active channels, subscribe/unsubscribe rate, reconnect storms and lots of subscriber nodes — we needed a few more tricks to make it actually work:

* App-level partitions using hash tags to restore efficient batching and control connection growth.
* Precomputed tags that deliver near-perfect slot balance across any cluster size without retuning.
* Node-grouped subscriptions that reduce connections from nodes × partitions to nodes × Redis nodes, while preserving fast resubscribes during reconnect storms or failovers.

Pub/Sub is not the only kind of load an application can generate. In many cases, you also have normal GET/SET operations, which scale well in Redis Cluster without additional engineering. A good idea would be to split the load from Pub/Sub and normal GET/SET workflows across different Redis setups to have the flexibility to tune Redis independently.
