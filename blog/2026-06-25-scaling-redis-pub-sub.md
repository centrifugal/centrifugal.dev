---
title: Scaling Redis Pub/Sub to Millions of Channels and Hundreds of Subscriber Nodes
tags: [redis, pubsub, scalability]
description: "How Centrifugo scaled Redis Pub/Sub — talking to Redis efficiently, sharding across isolated Redis instances, and making Pub/Sub work on Redis Cluster: sharded Pub/Sub, slot balance, connection count, and efficient resubscribes."
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
image: /img/blog_scaling_redis.jpg
authorImageURL: /img/alexander_emelin.jpeg
hide_table_of_contents: false
draft: true
---

import RedisClusterSlotsDiagram from '@site/src/components/RedisClusterSlotsDiagram';
import PubSubFanoutDiagram from '@site/src/components/PubSubFanoutDiagram';
import PubSubReadLoopDiagram from '@site/src/components/PubSubReadLoopDiagram';
import PubSubShardingDiagram from '@site/src/components/PubSubShardingDiagram';
import ClusterBroadcastDiagram from '@site/src/components/ClusterBroadcastDiagram';
import ClusterShardedPubSubDiagram from '@site/src/components/ClusterShardedPubSubDiagram';
import PubSubClusterPartitionDiagram from '@site/src/components/PubSubClusterPartitionDiagram';
import PubSubPrecomputedTagsDiagram from '@site/src/components/PubSubPrecomputedTagsDiagram';
import PubSubNodeGroupDiagram from '@site/src/components/PubSubNodeGroupDiagram';
import ThroughputScalingDiagram from '@site/src/components/ThroughputScalingDiagram';
import BroadcastAmplificationDiagram from '@site/src/components/BroadcastAmplificationDiagram';
import SlotBalanceDiagram from '@site/src/components/SlotBalanceDiagram';
import ConnectionCalculatorDiagram from '@site/src/components/ConnectionCalculatorDiagram';
import ResubscribeStormDiagram from '@site/src/components/ResubscribeStormDiagram';
import ResubscribeWorkerShardingDiagram from '@site/src/components/ResubscribeWorkerShardingDiagram';
import ClusterTopologyRebuildDiagram from '@site/src/components/ClusterTopologyRebuildDiagram';

[Redis Pub/Sub](https://redis.io/docs/latest/develop/pubsub/) is a popular choice for passing messages between nodes in real-time messaging systems. It lets a system run many nodes — each holding many real-time client connections — and deliver each message to the nodes that have interested subscribers.

![](/img/blog_redis_scaling_real_time_system.jpg)

That simplicity holds at small scale. But at millions of channels and hundreds of subscriber nodes — the scale some Centrifugo users run at — Pub/Sub stops being simple: a single Redis instance is limited by one CPU core, and switching to Redis Cluster can make throughput *worse* instead of better. This post walks through those gotchas, and the techniques that get from a single instance's ceiling to millions of messages per second — across isolated Redis shards or a Redis Cluster.

[Jump to the end for TLDR](#summing-up)

<!--truncate-->

:::tip Applies to Valkey too

This post talks about **Redis**, but everything here applies equally to **[Valkey](https://valkey.io/)** too.

:::

For a general-purpose real-time messaging server, every deployment looks different, so the design has to handle many cases. Two facts about real-time messaging specifics shaped the decisions in this post:

- **The system can have a lot of active channels** — millions of them. There might be one per user, per document, or per game session, each created and thrown away all the time, so the server is constantly subscribing and unsubscribing. Usually each channel carries fairly light traffic (up to 60-100 messages per second); the load is spread across many channels rather than concentrated in a few.
- **There can be a lot of subscriber nodes too.** Any node might care about any channel at any moment, so each one subscribes to whatever its clients need and has to receive everything published there. Once a deployment grows to hundreds of nodes, anything that costs something per node adds up very fast. In Centrifugo's case, one node usually serves up to 100k-200k connections – so setups which aim to have millions of real-time connections end up with hundreds of connection nodes, each subscribed to the channels its users care about.

## Keeping up with Redis

Redis Pub/Sub is intentionally simple: a client subscribes to a named *channel*, and a publish to that channel reaches whoever is subscribed at that exact moment. Nothing is stored and nothing is retried, so a subscriber that wasn't connected when a message went out never sees it — delivery is at most once.

<PubSubFanoutDiagram />

Redis runs every command (in this case PUBLISH and SUBSCRIBE) on a single thread sequentially. Modern Redis and Valkey can spread network I/O across extra threads, which [lifts throughput](https://valkey.io/blog/unlock-one-million-rps/), but command execution itself stays serialized, so one instance still has a ceiling you can hit.

Whatever Redis setup you run, your app has to keep up with Redis first — otherwise it's the first bottleneck, before Redis itself is even reached. With Redis Pub/Sub, each application node — also called a *subscriber node* here — does two things: it publishes messages and subscribes to receive them.

### Efficient publishing

Centrifugo publishes over a **pipelined** connection instead of the connection-pool approach, where each command takes its own network round trip. The [rueidis](https://github.com/redis/rueidis) client gathers commands issued close together and writes them as a single batch, with a small flush delay ([`MaxFlushDelay`](/blog/2022/12/20/improving-redis-engine-performance), about 100µs) marking a batch boundary. One round trip then carries many publishes, so the publisher feeds Redis instead of stalling on the wire.

Pipelining lifts the overall throughput and surprisingly cuts CPU usage on both the client and Redis sides due to reduced READ/WRITE syscalls — these gains were shown in detail before in [Improving Centrifugo Redis Engine throughput and allocation efficiency with Rueidis Go library](/blog/2022/12/20/improving-redis-engine-performance).

### Efficient subscribing

The `SUBSCRIBE` command supports subscribing to many channels at once. When many clients reconnect at once or application nodes resubscribe after a network glitch, a few large commands with batched channels are far more efficient across the client, protocol, and Redis layers.

Redis [keeps a buffer](https://redis.io/docs/latest/develop/reference/clients/#output-buffer-limits) for each Pub/Sub connection, and if the reader doesn't drain it fast enough, Redis drops the connection. So the application has to drain the socket as fast as it can and **delegate processing to a dedicated pool of workers**. Because Pub/Sub delivery is at most once, the workers have some freedom in how they handle overload — including dropping messages at the application level.

It's worth tracking an application metric for the end-to-end lag of a message sent through Pub/Sub — record the publication timestamp on the publisher side and subtract it from the time the message is received on the subscriber side. In most cases, workers falling behind is a signal that it's time to scale the application nodes.

To keep a channel's messages in order, pick the worker by a hash of the channel name: every message for a channel goes to the same worker, while different channels spread across all the available cores. Also, using a few pipelined connections instead of one can further raise read throughput.

<PubSubReadLoopDiagram />

Adding more application nodes helps absorb higher throughput, but keeping each node fast still matters. Every node opens its own connections to Redis, and at scale the total connection count becomes a concern of its own — more on that later.

## Single Redis Pub/Sub limit

A single Redis instance is very fast, and I/O threading lets it use several cores for network work — but it still runs every command on one thread, and once that thread saturates there's nothing Redis can do.

In a Centrifugo benchmark on Hetzner, on a machine with dedicated vCPU, a single Redis instance handled up to about **650,000 messages per second** (not just published, but all delivered to active subscribers, each message 256 bytes). After that, end-to-end latency started to grow fast — a signal of saturation. This throughput should be enough for most use cases. But to go further you have to stop using a single Redis instance.

## Client-side Pub/Sub sharding

The simplest solution is to spread the Pub/Sub load across several independent Redis instances. The application decides which Redis instance handles a given channel by hashing the channel's name, for example with a [Jump consistent hash](https://arxiv.org/abs/1406.2294) or any other. Consistent hashing here may help to keep most of the data on the same Redis instances after adding a Redis node and re-sharding. In Centrifugo case, we keep channel history in Redis in addition to Pub/Sub – the protocol is designed to tolerate the loss of it and provide a signal to real-time clients, so the loss during re-sharding is tolerable. 

In such a setup, a publisher and a subscriber should use the same hash function over the channel name, so they always land on the same instance without having to talk to each other, and the instances don't even know about one another — so each instance you add takes a share of the load.

<PubSubShardingDiagram />

In our benchmarks Pub/Sub throughput increased linearly as more Redis instances were added — each one took an even share of the load, and latency stayed low. So 650k messages per second became around 5M messages per second with 8 Redis instances. The instances share nothing, so the total capacity is just one instance's limit times the number of instances. Connection count naturally grows with the number of shards.

<ThroughputScalingDiagram />

The number of connections per subscriber node is multiplied by the number of Redis shards. For example, for 8 separate Redis instances and 24 subscriber nodes it's 24 x 8 x (N pipeline conns).

Client-side sharding works, but requires manual configuration. The list of Redis instances lives in the server's own configuration, so adding capacity isn't just starting another Redis — every node has to reload the new list.

The obvious next step is to switch to Redis Cluster, which manages the group of nodes for you. But it's not that simple.

## Classic Redis Cluster Pub/Sub does not scale

A single Redis holds everything in one process, while Redis Cluster spreads the data across several nodes. It does this by splitting all possible keys into **16,384 buckets** called *hash slots*: every key belongs to exactly one of them, chosen by `CRC16(key) % 16384`, and each node owns a range of slots. To reach a key, the client hashes it and goes straight to the node that owns that slot.

There's also a handy trick called a **hash tag**. If a key contains braces, Redis only hashes the part inside the `{...}`, which lets you force a group of keys into the same slot — and so onto the same node — whenever you want them to stay together.

<RedisClusterSlotsDiagram />

Because keys are spread across nodes this way, ordinary operations scale cleanly. A `GET` or `SET` goes only to the node that owns the key, so adding nodes spreads both the data and the load, and throughput grows almost linearly — this is the main benefit of Redis Cluster. Pub/Sub is the exception.

Ordinary Pub/Sub in Redis Cluster sends every published message to *every* node — even the nodes where nobody is subscribed to that channel. It has no real choice: a subscriber could be attached to any node, so the only way to be sure they get the message is to copy it everywhere. That sounds harmless until you see the cost — the more nodes you add, the worse it gets, because each one has to carry every message, including all the ones it has no subscriber for.

<ClusterBroadcastDiagram />

There's a second, less visible problem with this. With classic Pub/Sub you can't choose which node handles your subscriptions — they all go over a single connection to whichever node it happens to point at for the first subscribe operation. So one node can end up tracking every subscription while the rest sit nearly idle — a subscription imbalance.

In our benchmarks, a classic Redis Cluster behaved just as the theory above says. Under load in a 3-node Redis Cluster, the delivery latency grew from milliseconds to whole seconds long before the 650k messages per second a single instance reached, somewhere around 400k messages per second. And it got even worse as nodes were added.

## Sharded Pub/Sub

Redis 7 introduced **[sharded Pub/Sub](https://redis.io/docs/latest/develop/pubsub/#sharded-pubsub)** (`SSUBSCRIBE` / `SPUBLISH` commands) to fix exactly this. Within these new commands a Pub/Sub channel respects hash slots and behaves like a normal key: a message goes only to the Redis node that owns the channel's slot, instead of being copied to every node — which solves the throughput problem. The price is that Pub/Sub now has to be coordinated by the Redis client driver: each subscribe and publish must go to the node that owns the slot, instead of one shared connection to any Redis Cluster node.

<ClusterShardedPubSubDiagram />

This visualization shows the benefit of sharded Pub/Sub and why classic Pub/Sub fails to increase Pub/Sub throughput:

<BroadcastAmplificationDiagram />

For some applications, moving to sharded Pub/Sub is easy — just call the new methods in the Redis client driver. For Centrifugo's workloads it was not that simple, here is why.

With classic Pub/Sub, subscribing was easy: take a Pub/Sub connection and send `SUBSCRIBE` commands over it, without caring which Redis node it points to. With sharded Pub/Sub, the connection returned by the `rueidis` driver points to the node that owns the slot of the first channel subscribed to. `SSUBSCRIBE` also supports a batch of channels, but all must belong to the same hash slot.

Subscribing to a second channel can't reuse the existing Pub/Sub connection — it needs another one. With only a handful of channels that's fine: open a few sharded Pub/Sub connections and you're done. But with millions of channels that approach no longer works — a million connections to Redis isn't something anyone would attempt. So there's a problem with connection count, and also it's not obvious how to keep the subscribe batching that helped to keep the system effective.

## App-level partitions

The way around it is to stop treating channels individually and group them on application level. Each channel is hashed into a small, fixed number (**N**) of **partitions**, far smaller than the channel count. And the number of partitions must be larger than the Redis Cluster size for better distribution. By default, Centrifugo uses 128. Every channel in a partition gets the same hash tag, so they all land in the same slot, on the same Redis node. A channel key ends up shaped like `{<partition>}.<channel>`:

```
SSUBSCRIBE news sports            # rejected if they hash to different slots
SSUBSCRIBE {42}.news {42}.sports  # shared {42} tag → one slot → one connection, batched
```

A single partition then uses a single connection: when the first channel in a partition is subscribed, the client opens one connection to that partition's node, and every other channel in the partition reuses it. Because those channels share a slot, their subscriptions batch and pipeline on that connection, the way classic Pub/Sub batched.

And because the partitions are spread across the cluster, the connections spread with them instead of piling onto one node. So instead of a connection per channel there's **one per partition** — N per node — and subscribing is back to cheap, batched commands over a handful of steady connections per node, even as channels come and go. That settles the count on a single node; multiplied across a large fleet the cluster-wide total is another matter — more on that below.

<PubSubClusterPartitionDiagram />

## Fixing uneven slot distribution

The partition scheme skips over one important detail: what to use as each partition's tag. The obvious answer is the partition's own index — `{0}`, `{1}`, `{2}`, … `{N}` — the natural starting point. It works, but it has a hidden problem. Run those short strings through CRC16 and the slots they hash to aren't evenly spread, so some Redis nodes end up with many more partitions than others.

Take, for example, a 6-node cluster with N = 128 partitions: with naive `{0}`…`{127}` tags the partitions land `[27, 15, 22, 23, 16, 25]` across the six nodes — the busiest node gets nearly twice as many as the lightest, and the gap only grows on bigger clusters. That skew has a real cost: Pub/Sub throughput is capped by the busiest node, so it saturates first while the lightest still has headroom — you pay for all six nodes but leave capacity unused, and that's the opposite of what you add nodes for.

So the tags need to be chosen more carefully. For a given number of partitions, we've implemented a small [simulated-annealing search script](https://github.com/centrifugal/centrifuge/tree/master/internal/redispartition) — it finds a set of short tag strings whose CRC16 slots stay balanced across *every* cluster size from one node up to the partition count, not just a few sizes picked in advance. It runs once and bakes the result into a static table of string **precomputed tags** Centrifugo can then use, so at runtime it's just a lookup in that table.

On that same 6-node cluster the 128 partitions now land `[21, 22, 21, 21, 22, 21]` — near-even, instead of the uneven spread the naive tags gave. Move to 12 nodes in Redis Cluster, and the tags still hold — `[11, 10, 11, 11, 10, 11, 11, 10, 11, 11, 10, 11]`, while naive tags would give `[10, 17, 5, 10, 16, 6, 8, 15, 9, 7, 16, 9]`. Past 128 nodes you'd have more nodes than partitions, so some would sit empty — but by then you'd raise the partition count.

Here is a visualization of that:

<SlotBalanceDiagram />

## Reducing connections to cluster

Sharded Pub/Sub, combined with app-level partitions, solved the throughput problem — each message reaches a single node, and the cluster scales the way client-side sharding does. Redis nodes get balanced load. But a new problem shows up as the system grows: the connection count. There's a fixed number of partitions and many subscriber nodes, each opening its own connection per partition — and those two counts multiply together.

Here's the math. Under the partition scheme each node opens one subscribe connection per partition, so 128 partitions across 200 nodes works out to `200 × 128 = 25,600` connections into the cluster, and spread over a 6-node cluster that's about 4,267 of them landing on each Redis node. That's the point where you start hitting real limits — `maxclients`, ephemeral ports, file descriptors, the overhead Redis and the app carry for every connection. This comes from a real setup — a Centrifugo user running 20 million WebSocket connections on AWS.

Most of those connections are unnecessary. Each Redis node owns a whole *range* of slots, so 20-21 of the 128 partitions live on any given node — and a single connection to that node can subscribe to all of them. So it makes sense to **group subscribe connections by Redis node**.

<PubSubNodeGroupDiagram />

With the same 200 nodes and the same 6-node cluster, the count then drops to `200 × 6 = 1,200` connections in total, just 200 per Redis node instead of 4,267.

<ConnectionCalculatorDiagram />

With this decision, the partition count can then be raised — 1024 or 4096 instead of 128 — without adding connections. A higher count spreads channels across more slots, for a finer, more even distribution on larger clusters.

## Keeping reconnect storms cheap

Connections are under control now. But the partitions earn their keep a second time, in a different place — reconnect storms.

Partition grouping makes no difference during normal work: subscribing to one new channel is a single `SSUBSCRIBE`, no matter how channels are grouped. A network glitch or a failover, though, drops the connections, and across a large fleet many nodes resubscribe everything they hold at the same moment — that's when replaying all those subscriptions in as few commands as possible starts to count.

There's a catch in how a node sends those resubscribes, and it's easy to get wrong. To resubscribe quickly the node splits its channels across several workers that run at the same time — say 16 of them. The obvious way to split the work is to give each worker a share of the channels. But one `SSUBSCRIBE` can only carry channels from a single partition, and if each worker holds a mix of channels from every partition, each worker has to send a separate `SSUBSCRIBE` per partition. With 21 partitions and 16 workers that's 16 × 21 = 336 commands, each carrying a thin slice of a partition.

Split the work by partition instead — give each worker a few whole partitions to subscribe — and every partition is one `SSUBSCRIBE` again: 21 commands, not 336. The channels and the workers are the same — only the way the work is divided changes. On a real cluster this one change took a node's resubscribe from a few hundred commands down to a couple dozen.

<ResubscribeWorkerShardingDiagram />

Partitions are why that command count is 21 and not thousands in the first place. On a 6-node cluster with 128 partitions each Redis node owns about 21 partitions. Drop partitions and that node owns about 2,731 of the 16,384 slots instead. So when a node resubscribes, its connection to one Redis node sends about **21 `SSUBSCRIBE`s with partitions, or about 2,731 without** — 130 times more. The count never goes past 16,384, and it never grows with the number of channels. (Each `SSUBSCRIBE` carries at most the batch size — 512 in Centrifugo's case — so once a partition holds more than that, both cases send about `channels / 512` commands and the gap closes.) That's nothing on its own, but in a fleet-wide reconnect every subscriber node fires its commands at each Redis node at once — right when the cluster is busy recovering — so keeping the per-node count low matters most exactly then.

<ResubscribeStormDiagram />

So partitions stay — not for the connection count any more, but to keep these big resubscribes cheap. Dropping them is a fair choice too: you get the finest, most even distribution, but each resubscribe costs more. That's the trade-off you control.

## Following the cluster as it moves

Grouping subscriptions by node isn't free — it adds complexity, mostly around tracking the cluster topology. This mechanism won't be available out of the box in most Redis drivers. Luckily the [rueidis](https://github.com/redis/rueidis) library Centrifugo uses to talk to Redis exposes enough low-level Redis Cluster knobs to build it.

Because the application node decides which Redis node each subscription goes to, it has to track the cluster's layout itself. It keeps a small map — each partition to the Redis node that owns its slot — built from `CLUSTER SLOTS` and the client's node list. Each Redis node gets one connection carrying the partitions it owns. The cluster can reshuffle this at any time — a node joins, a node leaves, or slots move to rebalance — and the app has to notice each change and rewire.

There are two ways it knows about changes. A background loop re-runs `CLUSTER SLOTS` every 30 seconds (in Centrifugo's case) and rebuilds the map; if the node count has changed, or any partition now points at a different node, the layout has changed. But the poll isn't the only signal. When the cluster moves a slot off a node, Redis sends a `sunsubscribe` for the sharded channels held there on its own — the node announcing it no longer owns them. The subscriber node catches that signal on the subscribe connection and triggers a rebuild right away, so a removed node or a moved slot doesn't wait up to 30 seconds to take effect.

A rebuild recomputes the map and rewires the connections: open one to a Redis node that appeared, drop the one to a node that left, and resubscribe each partition on its new owner. Publishes need no help — a cluster-aware client already sends each `SPUBLISH` to whichever node owns the slot — so once the subscribe side re-points, publisher and subscriber meet on the new node again.

<ClusterTopologyRebuildDiagram />

:::tip

One catch: just after a node joins, the rueidis client may not have a connection to it yet. Until it does, the slots that new node owns don't map to any node the client knows about, so the partition-to-node map can't be completed. To push the client to update, the subscriber node issues a throwaway `GET` for a probe key to provoke a `MOVED` redirect — that makes rueidis re-read the cluster layout and pick up the new node in time for the next rebuild.

:::

## Cluster or client-side sharding?

With node grouping in place, a Redis Cluster ends up working like client-side sharding: every Redis node is an independent single instance, owning its own slots and carrying no cross-node Pub/Sub traffic. Each node's ceiling is a single core — about 650k messages a second in these benchmarks — and throughput scaled linearly as cluster nodes were added, each one giving about another 650k, the same as adding client-side shards. Run side by side, the two were hard to tell apart: low latency, with the load split evenly and each node carrying its 1/N share.

Here are the two approaches compared:

| | Client-side sharding | Node-grouped Redis Cluster |
|---|---|---|
| **Throughput** | N × single-Redis | the same |
| **Connections** | nodes × Redis instances | nodes × Redis instances (similar) |
| **Membership & failover** | you build it yourself | the cluster handles it |
| **Adding capacity** | edit the instance list by hand, every node reloads | add a node, slots rebalance on their own |
| **What you maintain** | a Redis list in config | extra code for node-grouping |

Client-side sharding is simpler — it's a list of Redis addresses and a hash function, nothing more — and for a lot of deployments that's plenty, as long as you don't mind editing that list and resharding by hand as you grow. Redis Cluster is worth its extra complexity when you'd rather not do that by hand: it manages membership, failover, and resharding itself, and node grouping is what keeps its Pub/Sub scaling while it does.

## Summing up

A single Redis Pub/Sub instance scales well until one core saturates. Past that you need more Redis nodes, either through client-side sharding or Redis Cluster.

Redis Cluster, though, broadcasts every published message to all nodes by default — so adding nodes lowers throughput instead of raising it, and subscriptions can pile unevenly onto one node.

Sharded Pub/Sub fixes that by turning the cluster into a set of independent Redis instances, just like client-side sharding — so capacity scales linearly as you add nodes, but without you having to manage the instance list yourself.

For Centrifugo's specific situation — a large number of active channels, a high subscribe/unsubscribe rate, reconnect storms, and lots of subscriber nodes — a few more tricks were needed to make it actually work:

* App-level partitions using hash tags to restore efficient batching and control connection growth.
* Precomputed tags that keep slot balance even across any cluster size without retuning.
* Node-grouped subscriptions that cut connections from nodes × partitions down to nodes × Redis nodes — one connection per Redis node instead of one per partition.
* Partition-grouped resubscribes that keep reconnect storms cheap: after a drop, each node replays its subscriptions in a handful of `SSUBSCRIBE`s per Redis node instead of hundreds.
* Topology tracking that follows slot moves and resubscribes affected partitions on their new owner.

None of this is a recipe for endless scale. What it gives is a good state to grow from: the Pub/Sub layer stays balanced as the cluster gets larger, and the connection count no longer grows out of control. So you can move to a bigger Redis Cluster and run more subscriber nodes without the number of connections becoming the thing you hit first. Where the real ceiling lands after that depends on the rest of the system — the publishers, the application nodes, the traffic per channel — not on the Pub/Sub itself.

Pub/Sub is not the only load an application generates. You usually also have plain GET/SET operations, which scale well in Redis Cluster without extra engineering. It's often worth running Pub/Sub and GET/SET on separate Redis setups, so each one can be tuned independently.

Thank you for your attention!
