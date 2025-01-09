---
title: Notable Centrifugo v5 milestones in 2024
tags: [centrifugo]
description: While we concentrate our main efforts on Centrifugo v6 development, let's recap the most notable features and improvements introduced during Centrifugo v5 lifecycle.
author: Centrifugal team
authorTitle: 💻✨🔮✨💻
authorImageURL: /img/logo_animated.svg
image: /img/v5_milestones.jpg
hide_table_of_contents: false
---

<!--truncate-->

<img src="/img/v5_milestones.jpg" />

While we concentrate our main efforts on Centrifugo v6 development, let's recap the most notable features and improvements introduced during Centrifugo v5 lifecycle.

We are excited about how many things done in 2024 we can be proud of. Also, we are grateful to our community for the feedback, support and love towards the project we see.

Let's start remembering what had happened with the project over the year.

## Grand Tutorial – the most advanced WebSocket chat app tutorial

We launched the [**Grand Tutorial**](/docs/tutorial/intro), an official step-by-step guide how to build a complex real-time application with Centrifugo. This comprehensive tutorial walks developers through the entire process, implementing client side, server side and Centrifugo integration. Moreover, it gives answers to robust message delivery and provides performance estimation you can expect to achieve with Centrifugo.

<video width="100%" loop={true} muted controls src="/img/grand-chat-tutorial-demo.mp4"></video> 

## Built-in asynchronous consumers

While working on the Grand Chat Tutorial, we realized that Centrifugo could natively consume external queues to simplify integration with the existing backends. Thus, at some point of v5 life cycle built-in asynchronous consumers were introduced. At this point we have two types of them:

- [PostgreSQL Outbox Table](/docs/server/consumers#postgresql-outbox-consumer). Enables seamless integration with transactional outbox pattern for reliable  messaging. Save your model and emit event to Centrifugo in one transaction.
- [Kafka Topics](/docs/server/consumers#kafka-consumer). Native Kafka topic consumption makes Centrifugo even more versatile for real-time event streaming.

You can find examples how both can be used in [Broadcast using transactional outbox and CDC](/docs/tutorial/outbox_cdc) chapter of the tutorial.

In v6 we continue improving asynchronous consumers and adding a new mode for Kafka consumer – more details very soon! During v6 life cycle we can add more built-in integrations with popular queue systems.

## Idempotency key for publish API

The addition of `idempotency_key` in publish and broadcast [server API methods](/docs/server/server_api#api-methods) provides an effective way to prevent duplicate messages and ensure consistency in a distributed system as it gives a way to safely make publication retries upon network failures.

## gRPC Proxy Subscription Streams

Centrifugo v5.1.0 introduced an experimental support for [gRPC proxy subscription streams](/docs/server/proxy_streams). This feature allows developers to send individual stream of events to the client using gRPC-streaming based proxies (bidirectional or unidirectional), providing a way to integrate with third-party existing streams using GRPC streaming between Centrifugo and backend.

Technically, this is quite an interesting concept – Centrifugo can multiplex different streams within a single WebSocket connection (or any other supported transport like SSE or HTTP-streaming), and the communication between Centrifugo and the backend is multiplexed within a single HTTP/2 connection (used by GRPC internally).

![](/img/on_demand_stream_connections.png)

This feature makes it possible to integrate with external streams in munutes. If you've ever heard about [WebSocketd](http://websocketd.com/) – then the idea is very similar, but over the network! With multiplexing, authentication, authorization, scalabilty Centrifugo features coming with the concept out-of-the-box.

See also [Stream logs from Loki to browser with Centrifugo Websocket-to-GRPC subscriptions](/blog/2024/03/18/stream-loki-logs-to-browser-with-websocket-to-grpc-subscriptions) relevant blog post.

## Delta Compression in Channels

[Delta compression](/docs/server/delta_compression) based on Fossil algorithm was introduced to minimize data transfer overhead in channels, optimizing performance and bandwidth usage during real-time message delivery. The feature is quite unique for self-hosted real-time messaging systems. And we'd like to note that now we not only support delta compression in JavaScript SDK, but recently the community contributed support for it to our Java and Python SDKs. And there is an ongoing PR to Swift SDK.

![delta frames](/img/delta_abstract.png)

See example where delta compression can be very beneficial in [Experimenting with real-time data compression by simulating a football match events
](/blog/2024/05/30/real-time-data-compression-experiments) blog post.

## Cache recovery mode for channels

The new [cache recovery mode](/docs/server/cache_recovery) in Centrifugo transforms channels into real-time caches by delivering only the most recent message upon resubscription. This feature has proven highly effective for [AzuraCast's "Now Playing"](https://www.azuracast.com/docs/developers/now-playing-data/#high-performance-updates) functionality, ensuring effective updates for users. With Centrifugo’s cache recovery mode, the system now operates more efficiently, significantly reducing the load on the backend.

## Expanded observability

Several new metrics were added to provide deeper insights into Centrifugo operations. A couple of examples:

- `centrifugo_node_pub_sub_lag_seconds`: tracks lag in pub/sub processing – may be very important for server monitoring.
- `centrifugo_client_ping_pong_duration_seconds`: measures client latency distribution on top of existing ping-pong mechanism with transport type resolution.

Metrics would be one of the main focuses of Centrifugo v6, so we will continue working hard on better observability of Centrifugo.

## Nats integration improvements

- [Raw mode](/docs/server/engines#nats-raw-mode). Offers a way to consume existing Nats topics with 1-to-1 matching to Centrifugo channels
- It's now possible to have [wildcard subscriptions](/docs/server/engines#nats_allow_wildcards) with Nats – i.e. a way to consume from many channels having only one subscription.

The useful addition in Centrifugo PRO was a possibility to use [per-namespace brokers and presence managers](/docs/pro/namespace_engines). So it's possible to use wildcard subscriptions with Nats in one channel namespace, and benefit from Redis broker features (presence, history cache and automatic recovery) in other channel namespaces.

## Redis integration improvements

- [Redis 7.4 added possibility](https://redis.io/blog/announcing-redis-community-edition-and-redis-stack-74/#:~:text=You%20can%20now%20set%20an%20expiration%20for%20hash%20fields.) to set per field TTL in HASH data structure. We [utilized this](/docs/server/engines#redis_presence_hash_field_ttl) for Centrifugo presence to handle online presence more efficiently and reducing the overhead of presence requests.
- Global Redis Presence User Mapping. We've [provided an option](/docs/server/engines#optimize-getting-presence-stats) to drastically improve `presence_stats` performance for channels with a large number of active subscribers, making Redis-backed deployments more efficient.
- Centrifugo works gracefully with Redis eviction algorithms now. It degrades in a way that clients lose their positions in channel streams, but they can [recover in idiomatic way](/docs/server/history_and_recovery#automatic-message-recovery).

## Better SDKs

Several improvements were made in client SDKs. Among others, we'd like to highlight the following:

* some important connection stability and correctness improvements in Javascript SDK, for example [this one](https://github.com/centrifugal/centrifuge-js/pull/281) where we fixed `WebSocket is closed before the connection is established` error preventing reconnect after long offline period, or [this one](https://github.com/centrifugal/centrifuge-js/pull/278) where we worked on the correctness of quick subscribe/unsubscribe scenarios.
* at some point we brought back to life our [Python realtime SDK](https://github.com/centrifugal/centrifuge-python). For many years we did not have enough resources to do this, but now we are happy to see it alive again.
* delta compression support in Javascript SDK. And later the support for it was added in Java and Python SDKs, and that [was contributed](https://github.com/centrifugal/centrifuge-java/pull/74) by Centrifugal community members which is simply great.
* a method to [reset reconnecting state](https://github.com/centrifugal/centrifuge-swift/issues/106) in Swift SDK, which can be expanded to other SDKs in the future. Previously, we only had similar functionality in Javascript SDK where browser online/offline notifications are available.
* we now have a high-quality alternative to our official Dart/Flutter SDK – see https://github.com/PlugFox/spinify made by [PlugFox](https://github.com/PlugFox). An alternative may provide more idiomatic API for Dart developers, more performance and customization. 

## Centrifugo PRO milestones

In v5 release post we [introduced Centrifugal Labs](/blog/2023/06/29/centrifugo-v5-released#introducing-centrifugal-labs-ltd) – a company around Centrifugo PRO product, the enhanced version of Centrifugo. It was operational since then. During the year we found new PRO customers, and generally passed very important milestones as a company.

The most important for this post is that we continued to improve Centrifugo PRO with new features. Let's recap!

### Compression improvements

The first thing to mention regarding Centrifugo PRO is compression performance optimizations. We introduced the cache for prepared WebSocket messages to reduce CPU usage and improve compression ratio. This feature [was very helpful for our customers](/blog/2024/08/19/optimizing-websocket-compression) who have a lot of data to send over WebSocket connections. Also, [delta compression for channels with at most once delivery guarantees](/docs/pro/delta_at_most_once) is available for Centrifugo PRO users.

### Better observability

We believe that PRO version should provide an [enhanced observability](/docs/pro/observability_enhancements) as when the business grows it's crucial to have a deep insight into the system. One notable feature is namespace segmentation for in/out message size metrics. This allows identifying namespaces which consume a lot of bandwidth. In Centrifugo v6 we will make a step forward here, stay tuned!

### New features for push notifications

One of the most attractive features of Centrifugo PRO is [push notifications](/docs/pro/push_notifications) support. During the year several notable improvements were made regarding it. Let's recap.

[Timezone-aware push notifications](/docs/pro/push_notifications#timezone-aware-push) – Centrifugo PRO can now send push notifications based on device timezone. Or [notification templating](/docs/pro/push_notifications#templating) - allows using variables and substitute them to values based on particular device metadata. Also, [notification localizations](/docs/pro/push_notifications#localizations) - for providing translations of push content based on particular device locale. Next, [per user device rate limiting](/docs/pro/push_notifications#push-rate-limits) - lets app developers be more careful about the number and rate of push notifications on per user device basis.

And finally, better scalability of push notification device/topic storage by using reads from PostgreSQL replicas.

### Channel state events preview

We published a [Channel state events](/docs/pro/channel_state_events) feature preview – to be notified about channel occupied and channel vacated events on the app backend. Note that we do not recommend this feature for production usage yet. While it may seem simple - the implementation is quite complex under the hood, because we try to solve important issues like event ordering, avoiding event race conditions, making sure we survive Centrifugo node restarts, scalability with Redis Cluster. This all requires a careful approach, so we want to step-by-step improve the feature based on the customer feedback. In Centrifugo v6, we make a little step forward with channel state events, will share more details very soon.

### SSO for admin UI

We added [SSO for admin UI](/docs/pro/admin_idp_auth) using OpenID connect (OIDC)protocol, this is a very natural feature to have for corporate users who want to use their existing identity provider to authenticate in Centrifugo admin UI instead of custom password management.

![](/img/admin_idp_auth.png)

## Centrifugo v6 is coming

There were more improvements and features introduced during Centrifugo v5 lifecycle, here we tried to highlight the most notable ones. This year was quite productive for the project, and we hope your work was more productive due to the help of Centrifugo.

We are looking forward to the upcoming year and the release of Centrifugo v6 very soon. Stay tuned for the upcoming announcement where we will introduce the new features and improvements of the new major release.

Merry Christmas and Happy New Year everyone! 🎄
