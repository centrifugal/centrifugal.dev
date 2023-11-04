---
id: design
title: Design overview
---

Let's discuss some architectural and design topics about Centrifugo.

## Idiomatic usage

Centrifugo is a standalone server which abstracts away the complexity of working with many persistent connections and efficient message broadcasting from the application backend. The fact Centrifugo acts as a separate service dictates some idiomatic patterns how to integrate with Centrifugo for real-time message delivery.

Usually, you want to deliver content created by some user in your app to other users in real time. Each user may have several real-time connections with Centrifugo. For example, user opened several browser tabs, each tab created a separate connection. Or user has two mobile devices and created separate connection to your app from each of them. We call connection a `client` in Centrifugo. So words `connection` and `client` are synonims for us.

All requests from users that generate new data should first go to the application backend – i.e. calling app backend API from the client side. The backend can validate the message, process it, save it into a database for long-term persistence – and then publish an event to a channel using [Centrifugo server API](../server/server_api.md). This event is then efficiently broadcasted by Centrifugo to all active channel subscribers.

The following diagram shows the process (assuming client that generates new content is also a channel subscriber so also receives real-time message):

![diagram_unidirectional_publish](/img/design_3.png)

This is a usually a natural workflow for applications since this is how applications traditionally work (without real-time features) and Centrifugo is fully decoupled from the application in this case.

Centrifugo has a role of real-time transport layer in this case, and you may design the app with graceful degradation in mind – so that removing Centrifugo won't be a fatal problem for the application – it will continue working, just real-time features will be unavailable.

If the original source of events is your app backend (without any user involved) – then the above diagram simplifies to:

![diagram_unidirectional_publish](/img/design_2.png)

So the backend publishes data to channels and if there are active subscribers – events are delivered. If there are no active subscribers then events are dropped by Centrifugo (or, in case of using history features in channels, events may be temporaly kept in Centrifugo history stream).

It's also possible to utilize Centrifugo bidirectional connection for sending requests to the backend. To achieve this Centrifugo provides [event proxy features](../server/proxy.md). It's possible to send RPC (with custom request-response) requests from client to Centrifugo and the request will be then proxied to the application backend (see [RPC proxy](../server/proxy.md#rpc-proxy)). Moreover, proxy provides a way to utilize bidirectional connection for publishing into channels (using [publish proxy](../server/proxy.md#publish-proxy)). But again – in most real scenarios your backend must validate the publication attempt, so the scheme will look like this:

![client generates content](/img/design_1.png)

## Message history considerations

Idiomatic Centrifugo usage requires having the main application database from which initial and actual state can be loaded at any point in time.

While Centrifugo has channel history, it has been mostly designed to be a hot cache to reduce the load on the main application database when all users reconnect at once (in case of load balancer configuration reload, Centrifugo restart, temporary network problems, etc). This allows to radically reduce the load on the application main database during reconnect storm. Since such disconnects are usually pretty short in time having a reasonably small number of messages cached in history is sufficient.

The addition of history iteration API shifts possible use cases a bit. Manually calling history chunk by chunk allows keeping larger number of publications per channel.

Depending on Engine used and configuration of the underlying storage history stream persistence characteristics can vary. For example, with Memory Engine history will be lost upon Centrifugo restart. With Redis or Tarantool engines history will survive Centrifugo restarts but depending on a storage configuration it can be lost upon storage restart – so you should take into account storage configuration and persistence properties as well. For example, consider enabling Redis AOF with fsync for maximum durability, or configure replication for high-availability, use Redis Cluster or maybe synchronous replication with Tarantool.

When using history with automatic recovery Centrifugo provides clients a flag to distinguish whether the missed messages were all successfully restored from Centrifugo history upon recovery or not. If not – client may restore state from the main application database. Centrifugo message history can be used as a complementary way to restore messages and thus reduce a load on the main application database most of the time.

## Message delivery model

By default, the message delivery model of Centrifugo is at most once. With history and the positioning/recovery features enabled it's possible to achieve at least once guarantee within history retention time and size. After abnormal disconnect clients have an option to recover missed messages from the publication channel stream history that Centrifugo maintains.

Without the positioning or recovery features enabled a message sent to Centrifugo can be theoretically lost while moving towards clients. Centrifugo makes its best effort only to prevent message loss on a way to online clients, but the application should tolerate the loss.

As noted Centrifugo has a feature called message recovery to automatically recover messages missed due to short network disconnections. Also, it compensates at most once delivery of broker PUB/SUB system  (Redis, Tarantool) by using additional publication offset checks and periodic offset synchronization. So publication loss missed in PUB/SUB layer will be detected eventually and client may catch up the state loading it from history.

## Message order guarantees

Message order in channels is guaranteed to be the same while you publish messages into a channel one after another or publish them in one request. If you do parallel publications into the same channel then Centrifugo can't guarantee message order since those are processed in parallel.

## Graceful degradation

It is recommended to design an application in a way that users don't even notice when Centrifugo does not work. Use graceful degradation. For example, if a user posts a new comment over AJAX to your application backend - you should not rely only on Centrifugo to receive a new comment from a channel and display it. You should return new comment data in AJAX call response and render it. This way user that posts a comment will think that everything works just fine. Be careful to not draw comments twice in this case because you may also receive the same data from a channel - think about idempotent identifiers for your entities.

## Online presence considerations

Online presence in a channel is designed to be eventually consistent. It will return the correct state most of the time. But when using Redis or Tarantool engines, due to the network failures and unexpected shut down of Centrifugo node, there are chances that clients can be presented in a presence up to one minute more (until presence entry expiration).

Also, channel presence does not scale well for channels with lots of active subscribers. This is due to the fact that presence returns the entire snapshot of all clients in a channel – as soon as the number of active subscribers grows the response size becomes larger. In some cases, `presence_stats` API call can be sufficient to avoid receiving the entire presence state.

## Scalability considerations

Centrifugo can scale horizontally with built-in engines (Redis, Tarantool, KeyDB) or with Nats broker. See [engines](../server/engines.md).

All supported brokers are fast – they can handle hundreds of thousands of requests per second. This should be enough for most applications.

But, if you approach broker resource limits (CPU or memory) then it's possible:

* Use Centrifugo consistent sharding support to balance queries between different broker instances (supported for Redis, KeyDB, Tarantool)
* Use Redis Cluster (it's also possible to consistently shard data between different Redis Clusters)
* Nats broker should scale well itself in cluster setup

All brokers can be set up in highly available way so there won't be a single point of failure.

All Centrifugo data (history, online presence) is designed to be ephemeral and have an expiration time. Due to this fact and the fact that Centrifugo provides hooks for the application to understand history loss makes the process of resharding mostly automatic. As soon as you need to add additional broker shard (when using client-side sharding) you can just add it to the configuration and restart Centrifugo. Since data is sharded consistently part of the data will stay on the same broker nodes. Applications should handle cases that channel data moved to another shard and restore a state from the main application database when needed (i.e. when `recovered` flag provided by SDK is `false`).
