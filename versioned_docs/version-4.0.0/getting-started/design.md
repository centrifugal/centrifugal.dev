---
id: design
title: Design overview
---

Let's discuss some architectural and design topics about Centrifugo.

## Idiomatic usage

Originally Centrifugo was built with the unidirectional flow as the main approach. Though Centrifugo itself used a bidirectional protocol between a client and a server to allow client dynamically create subscriptions, Centrifugo did not allow using it for sending data from client to server.

With this approach publications travel only from server to a client. All requests that generate new data first go to the application backend (for example over AJAX call of backend API). The backend can validate the message, process it, save it into a database for long-term persistence – and then publish an event from a backend side to Centrifugo API.

This is a pretty natural workflow for applications since this is how applications traditionally work (without real-time features) and Centrifugo is decoupled from the application in this case.

![diagram_unidirectional_publish](/img/diagram_unidirectional_publish.png)

During Centrifugo v2 life cycle this paradigm evolved a bit. It's now possible to send RPC requests from client to Centrifugo and the request will be then proxied to the application backend. Also, connection attempts and publications to channels can now be proxied. So bidirectional connection between client and Centrifugo is now available for utilizing by developers in both directions. For example, here is how publish diagram could look like when using publish request proxy feature:

![](/img/diagram_publish_proxy.png)

So at the moment, the number of possible integration ways increased.

## Message history considerations

Idiomatic Centrifugo usage requires having the main application database from which initial and actual state can be loaded at any point in time.

While Centrifugo has channel history, it has been mostly designed to reduce the load on the main application database when all users reconnect at once (in case of load balancer configuration reload, Centrifugo restart, temporary network problems, etc). This allows to radically reduce the load on the application main database during reconnect storm. Since such disconnects are usually pretty short in time having a reasonably small number of messages cached in history is sufficient.

The addition of history iteration API shifts possible use cases a bit. Calling history chunk by chunk allows keeping larger number of publications per channel. But depending on Engine used and configuration of the underlying storage history stream persistence characteristics can vary. For example, with Memory Engine history will be lost upon Centrifugo restart. With Redis or Tarantool engines history will survive Centrifugo restarts but depending on a storage configuration it can be lost upon storage restart – so you should take into account storage configuration and persistence properties as well. For example, consider enabling Redis RDB and AOF, configure replication for storage high-availability, use Redis Cluster or maybe synchronous replication with Tarantool.

Centrifugo provides ways to distinguish whether the missed messages can't be restored from Centrifugo history upon recovery so a client should restore state from the main application database. So Centrifugo message history can be used as a complementary way to restore messages and thus reduce a load on the main application database most of the time.

## Message delivery model

By default, the message delivery model of Centrifugo is at most once. With history and the position/recovery features enabled it's possible to achieve at least once guarantee within history retention time and size. After abnormal disconnect clients have an option to recover missed messages from the publication stream cache that Centrifugo maintains.

Without the positioning or recovery features enabled a message sent to Centrifugo can be theoretically lost while moving towards clients. Centrifugo tries to do its best to prevent message loss on a way to online clients, but the application should tolerate a loss.

As noted Centrifugo has a feature called message recovery to automatically recover messages missed due to short network disconnections. Also, it compensates at most once delivery of broker (Redis, Tarantool) PUB/SUB by using additional publication offset checks and periodic offset synchronization.

At this moment Centrifugo message recovery is designed for a short-term disconnect period (think no more than one hour for a typical chat application, but this can vary). After this period (which can be configured per channel basis) Centrifugo removes messages from the channel history cache. In this case, Centrifugo may tell the client that some messages can not be recovered, so your application state should be loaded from the main database.

## Message order guarantees

Message order in channels is guaranteed to be the same while you publish messages into channel one after another or publish them in one request. If you do parallel publications into the same channel then Centrifugo can't guarantee message order since those may be processed concurrently by Centrifugo.

## Graceful degradation

It is recommended to design an application in a way that users don't even notice when Centrifugo does not work. Use graceful degradation. For example, if a user posts a new comment over AJAX to your application backend - you should not rely only on Centrifugo to receive a new comment from a channel and display it. You should return new comment data in AJAX call response and render it. This way user that posts a comment will think that everything works just fine. Be careful to not draw comments twice in this case - think about idempotent identifiers for your entities.

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

All Centrifugo data (history, online presence) is designed to be ephemeral and have an expiration time. Due to this fact and the fact that Centrifugo provides hooks for the application to understand history loss makes the process of resharding mostly automatic. As soon as you need to add additional broker shard (when using client-side sharding) you can just add it to the configuration and restart Centrifugo. Since data is sharded consistently part of the data will stay on the same broker nodes. Applications should handle cases that channel data moved to another shard and restore a state from the main application database when needed.
