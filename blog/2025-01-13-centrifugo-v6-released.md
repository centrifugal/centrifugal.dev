---
title: Centrifugo v6 released
tags: [centrifugo, release]
description: We are excited to announce a new version of Centrifugo. This release contains fundamental improvements to simplify working with Centrifugo from usage and core development perspectives.
author: Centrifugal team
authorTitle: 💻✨🔮✨💻
authorImageURL: /img/logo_animated.svg
image: /img/v6.jpg
hide_table_of_contents: false
---

<!--truncate-->

<img src="/img/v6.jpg" />

We are excited to tell the world about the release of Centrifugo v6, marking a significant milestone in Centrifugo development. This release contains fundamental improvements to simplify working with Centrifugo from users' and core developers' perspectives.

## Features added during v5 life cycle

Before diving into the details of the v6 release, let's take a look at the most notable features and improvements introduced during Centrifugo v5 lifecycle.

#### gRPC Proxy Subscription Streams

We introduced an experimental support for gRPC proxy subscription streams. This feature enables developers to handle subscription events using gRPC-based proxies, providing a way to integrate with third-party existing streams using GRPC streaming between Centrifugo and backend.

Technically, this is quite an interesting concept – Centrifugo can multiplex different streams within a single WebSocket connection (or any other supported transport like SSE or HTTP-streaming), and the communication between Centrifugo and the backend is multiplexed withing a single HTTP/2 connection (used by GRPC internally).

#### Grand Tutorial – the most advanced chat app tutorial in the wild

We launched the **Grand Tutorial**, an official step-by-step guide to building a complex real-time application with Centrifugo. This comprehensive tutorial walks developers through the entire process, implementing client side, server side and integrating with Centrifugo. Moreover, it gives answers to robust message delivery and provides performance estimation you can expect to achieve with Centrifugo.

#### Built-in asynchronous consumers

While working on Grand chat tutorial, we realized that Centrifugo could natively consume external queues to to simplify integration with the existing backends. Thus built-in asynchronous consumers were introduced:

- **PostgreSQL Outbox Table**: Enables seamless integration with transactional outbox pattern for reliable  messaging. Save you model and emit event to Centrifugo in one transaction.
- **Kafka Topics**: Native Kafka topic consumption makes Centrifugo even more versatile for real-time event streaming.

In v6 we continue improving async consumers and adding a new mode for Kafka consumer. More details below!

#### Idempotency key for publish API

The addition of `idempotency_key` in publish and broadcast server API methods provides robust mechanisms to prevent duplicate messages and ensure consistency in a distributed system.

#### Connection stability, optimizations

Significant efforts were made to improve the stability of client connection management. We reproduced and fixed several hard to narrow down race conditions.

We optimized the WebSocket upgrade process, significantly improving performance during high connection rates and providing a better experience for real-time app users.

#### Delta Compression in Channels

Delta compression was introduced to minimize data transfer overhead in channels, optimizing performance and bandwidth usage during real-time message delivery. It's quite unique for self-hosted real-time messaging systems. And we'd like to note that now we not only support delta compression in JavaScript SDK, but recently the community contributed support for it to our Java and Python SDKs. And there is an ongoing PR to Swift SDK.

Centrifugo PRO got a prepared message cache for WebSocket compression. Check out the blog post how this helped our customer to save thousands USD of monthly bandwidth bill.

#### Cache recovery mode for channels

With the new cache recovery mode, Centrifugo allows channels to act as real-time cache by delivering only last message upon resubscriptions. This feature played well for AzuraCast radio and its "now playing" feature. With Centrifugo and cache recovery mode it works super effective now.

#### Expanded observability

Several new metrics were added to provide deeper insights into Centrifugo operations. A couple of examples:

- `centrifugo_node_pub_sub_lag_seconds`: tracks lag in pub/sub processing – may be very important for server monitoring.
- `centrifugo_client_ping_pong_duration_seconds`: measures client latency distribution on top of existing ping-pong mechanism with transport type resolution.

In Centrifugo PRO version we also added namespace segmentation for in/out message size metrics which was very helpful for our PRO customers to identify namespaces which consume a lot of bandwidth.

#### Nats integration improvements

- **Raw Mode**: Offers more direct message processing with the NATS broker for specialized use cases.
- **Wildcard Subscriptions**: Simplifies subscription handling for broader NATS topic patterns.

The interesting addition in Centrifugo PRO was a possibility to use per-namespace brokers and presence managers. So it's possible to use wildcard subscriptions with Nats in one channel namespace, and benefit from Redis features, like presence and history cache, in others.

#### Redis integration improvements

- Redis 7.4 Hash Field TTL for Presence. Added support for Redis 7.4 hash field TTL to handle online presence more efficiently, allowing fine-grained control over presence data expiration.
- Global Redis Presence User Mapping. A new `global_redis_presence_user_mapping` option drastically improves presence performance for channels with a large number of active subscribers, making Redis-backed deployments more scalable and efficient.

## Why Centrifugo v6 was required?

A new major release was required though.

Over the years, Centrifugo has evolved into a robust platform packed with numerous features. However, as the capabilities of Centrifugo expanded, so did the complexity of its configuration. Settings became increasingly dispersed across various parts of the codebase, making it harder to manage and understand. Adding new features required more places to touch than it could be. With v6, we are addressing this head-on by re-structuring the configuration system and re-thinking its organization.

Centrifugo v6 release introduces a more streamlined configuration layout, reducing code repetition and providing a clear separation of options and their relationships to Centrifugo’s different layers. These improvements are designed to enhance clarity, maintainability, and overall developer experience, setting a solid foundation for future growth.

Also, there were a couple of places which required improvement which could not be achieved without breaking changes. And a couple of deprecated features were removed in v6. Let's start our dive into Centrifugo v6 release with the description of removed parts.

## Removing SockJS

SockJS was deprecated in Centrifugal ecosystem [since v4 release](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#:~:text=SockJS%20is%20still%20supported%20by%20Centrifugo%20and%20centrifuge%2Djs%2C%20but%20it%27s%20now%20DEPRECATED.). We asked to reach out if SockJS is still necessary [in blog posts](https://centrifugal.dev/blog/2023/06/29/centrifugo-v5-released#the-future-of-sockjs), marked it deprecated in docs. Nobody reached during all this time.

SockJS client is poorly maintained these days, issues not addressed, and some transports becoming archaic.

We now have [our own WebSocket emulation layer](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#modern-websocket-emulation-in-javascript). Unlike SockJS HTTP-based fallbacks, our layer does not require sticky sessions in distributed case (!), supports binary in HTTP-streaming case, batching, more performant from CPU and memory perspectives on the server side, requires less round-trips for connection establishement.

That's why the decision was made to remove SockJS from Centrifugo.

## Removing Tarantool

Experimental Tarantool engine was introduced in Centrifugo v3, and we had some hopes on it to be a good alternative to Redis. Unfortunately it does not receive a lot of updates since it was introduced, and it now lacks several features - such as idempotent publishing, delta compression. We were aware only about 2 setups where it was used – and both clients eventually moved away from Tarantool engine with our help. Also, our usage stats do not show any notable usage of Tarantool engine.

The truth is – while Tarantool provides some interesting technical advantages over Redis, it's impossible to properly maintain it and keep actual given the current Centrifugal Labs resources. In addition to that, there was no help from the community side regarding Tarantool integration.

That's why we decided to remove Tarantool integration from Centrifugo. All related repos were archived and now in read-only mode. Now we concentrate on Redis, Redis-compatible brokers and Nats as main scalability options for Centrifugo.

## Configuration restructurization

We were building Centrifugo configuration on top of the approach initially utilized in early versions – based on Viper framework for Go language. While it worked well – with every new version and every new feature configuration became harder and harder to maintain and extend.

Fixing that is a difficult and not very fun process, but for v6 we decided that it's time to do it.

Centrifugo v6 configuration was re-built from scratch and now consists from different blocks – all the options were grouped together to make it clearer to which layer they correspond.

For example, there is a `client` top-level configuration block which contains options related to real-time client connections. To give one example let's take `allowed_origins` option of Centrifugo v5. It's now under `client` section:

```json title="config.json"
{
    "client": {
        "allowed_origins": ["https://example.com"]
    }
}
```

It's now obvious which layer of Centrifugo it corresponds. Not to server API, not to admin web interface, but to client connections. 

But the main reason of configuration refactoring was different. We wanted to get rid of the situation when all options were spread over Centrifugo code base, sometimes with unclear defaults and non-straightforward way of adding a new option to Centrifugo.

Now the configuration is represented by Go structs. Defaults are visible. It's simple to follow, simple to extend. And it opens new ways to work with the configuration as we will see below.

One aspect we'd like to mention separately is that channel options for channels which do not have any namespace prefix are now defined under `channel -> without_namespace` block. So channel namespace options for channels without namespace are not mixed together with other Centrifugo options on top level of configuration object. We had several bugs previously due to the fact how namespace options were organized in the code base – as options for channels without namespace required separate extraction, often forgotten. Now this was eliminated.

One cool thing about Centrifugo is that on start it warns about unknown options in configuration file and unknown environment variables. This was already there before, helps to find configuration mistakes, and we keep it in v6 – now supporting keys in deeply nested objects and arrays of objects without a lot of copy-paste in the code base.

## TLS config unification

The important part of new Centrifugo v6 configuration is that it uses the same TLS configuration object everywhere to configure TLS. Whenever you are configuring TLS now – you can expect the same field names, just on a different configuration level. TLS for HTTP server, for Redis client, Nats client, Kafka client, PostgreSQL client – all configured in the same way.

## Proxy config improvements

Regarding proxy configuration there were a couple of notable improvements were made:

* no more granular and non-granular proxy mode separation – `connect` and `refresh` proxies can now be enabled and configured on `client` level, and other types of proxy which relate to channels inside `channel` configuration block and enabled on channel namespace level. RPC proxy configuration can be defined under a separate `rpc` section in the config.
* it's now possible to define default proxies for all event types now separately – each with its own set of options. Previously all proxies inherited the same set of options – only endpoints and timeouts could be set for each specific proxy type. For many cases, this should help to configure desired proxy behaviour without the need to use named proxy objects. One example - you can define `connect` and `refresh` proxies now, and configure different set of headers passed for `connect` and `refresh`. While it seems natural – previously it was only possible by using a granular proxy mode and referencing custom proxies by name. Now named proxy objects must be used only for channel and rpc namespaces, and in many cases it's not necessary to use them at all.

## defaultconfig cli helper

To simplify the process of creating a new configuration file or discovering available options, we added a new CLI command `defaultconfig`.

The `defaultconfig` command provides a way to get the configuration file with all defaults for all available configuration options. It will be possible using the command like:

```bash
centrifugo defaultconfig -c config.json
centrifugo defaultconfig -c config.yaml
centrifugo defaultconfig -c config.toml
```

Also, in dry-run mode it will be posted to STDOUT instead of file:

```bash
centrifugo defaultconfig -c config.json --dry-run
```

Finally, it's possible to provide this command a base configuration file - so the result will inherit option values from base file and will extend it with defaults for everything else:

```
centrifugo defaultconfig -c config.json --dry-run --base existing_config.json
```

## defaultenv cli helper

In addition to `defaultconfig` added `defaultenv` command which prints all config options as environment vars with default values to STDOUT:

```bash
$ centrifugo defaultenv
CENTRIFUGO_ADDRESS=""
CENTRIFUGO_ADMIN_ENABLED=false
CENTRIFUGO_ADMIN_EXTERNAL=false
CENTRIFUGO_ADMIN_HANDLER_PREFIX=""
CENTRIFUGO_ADMIN_INSECURE=false
CENTRIFUGO_ADMIN_PASSWORD=""
CENTRIFUGO_ADMIN_SECRET=""
...
```

It also supports the base config file to inherit values from:

```bash
centrifugo defaultenv -b config.json
```

## Headers emulation

WebSocket API in web browsers does not allow setting custom HTTP headers which makes implementing authentication for WebSocket connections from browsers harder.

Centrifugo JWT authentication provides a good solution to that giving answers on how to implement authentication, internally sending a JWT token in the first client protocol message. But not everyone wants to use JWT, so many Centrifugo users configured connect proxy to authenticate incoming connections.

Unfortunately, in that case only Cookie-based authentication was available for the authentication process – because web browsers can automatically add Cookie header for WebSocket Upgrade requests to the same domain. All other types of auth, like appending header with Bearer token was only possible by passing the token in URL params, or with initial custom `data` sent. While it works, it's often not very handy since the backend can't easily re-use exising middlewares for auth.

A useful feature added in Centrifugo v6 is called `headers emulation`. It's only available in our browser SDK `centrifuge-js` (and it only makes sense there, since other platforms allow setting headers natively). Now it's possible to provide custom headers map in `Centrifuge` constructor options – and values from that map are then automatically translated to HTTP headers when making connection proxy requests from Centrifugo to the backend. Internally, these custom headers still utilize the first client protocol message for passing headers map to Centrifugo.

Here is an example how to use `centrifuge-js` with headers emulation feature:

```javascript
const centrifuge = new Centrifuge(
    "wss://example.com/connection/websocket",
    {
        "headers": {
            "Authorization": "Bearer XXX"
        }
    }
)
```

There is also a setter method in SDK to update headers later on.

Note, that Centrifugo proxy configuration requires a white list of headers to proxy to the backend, the white list will still be used when working with headers sent in such a way.

This should help Centrifugo users avoid using non-obvious ways to pass auth data when working with WebSocket connections.

## Publication data mode for Kafka consumers

Another feature which can simplify integrating Centrifugo was added to asynchronous Kafka consumer. Centrifugo v6 introduced `publication data mode` for Kafka consumer. After enabling such a mode Centrifugo expects that Kafka topics contain not server API commands, but a ready-to-publish data. It's possible to use Kafka headers to tell Centrifugo which channels the data must be published to.

The main idea here is that publication data mode may simplify Centrifugo integration with existing Kafka topics for real-time message delivery to clients.

Since Centrifugo allows configuring an array of async consumers – it's possible to use Kafka consumers in different modes at the same time.

## Separate broker and presence managers

Centrifugo engine is internally contains from two parts: Broker and PresenceManager. At some point during v5 life cycle we added possibility to set custom Brokers and Presence Managers for different namespaces. Now in v6 release we make the separation explicit in OSS edition too.

The most useful application of that is using separate Redis installations for broker part and for presence manager parts, which in general may scale separately. So giving a bit more flexibility for Centrifugo OSS users now.

## Other improvements

Other improvements done in v6 release include:

* Possibility to set custom TLS configuration for internal HTTP endpoints, previously it was only possible to disable TLS for them keeping TLS only for external endpoints. 
* Added TLS support for PostgreSQL clients: for async consumer from PostgreSQL outbox table, for database connection and for PostgreSQL-based push notifications queue client.
* New option `message_size_limit` for WebTransport – it effectively limits the maximum size of individual message through the WebTransport connection.

A huge work has been done in the documentation – all chapters were reviewed, config samples updated.

We also updated our official [Helm chart](https://github.com/centrifugal/helm-charts) and the [source code of Grand Chat Tutorial](https://github.com/centrifugal/grand-chat-tutorial) for v6 changes.

## Centrifugo PRO improvements

Centrifugo PRO v6 as usual inherits all the changes of the OSS edition. The configuration layout refactoring also affected some parts of Centrifugo PRO configuration. And worth mentioning, you can expect new `defaultconfig` and `defaultenv` CLI commands to work properly for Centrifugo PRO also.

Outside the configuration layout tweaks, there were several improvements for Centrifugo PRO features:

* Step forward for Centrifugo PRO [channel state events](https://centrifugal.dev/docs/pro/channel_state_events) feature, we handled an edge case when first `occupied` event in channel could be not delivered due to the race condition and made the processing of `vacated` events queue more effective. We still consider this feature to be alpha state though. Also, now if channel state proxy is defined in the namespace – it's not necessary to explicitly provide array of events to send, once proxy enabled Centrifugo PRO will send both `occupied` and `vacated` events by default.
* Dedicated PostgreSQL [push notifications](https://centrifugal.dev/docs/pro/push_notifications) queue config was added in Centrifugo PRO. Now it's not necessary to use the same PostgreSQL for push notifications queue as for device management – it can be separate. If you are using Centrifugo push notifications without a device management API, just for broadcasting pushes to known FCM/APNs/HMS tokens, extra tables in PostgreSQL which Centrifugo creates for device data storage and other functionality may be avoided.
* [Channel patterns](https://centrifugal.dev/docs/pro/channel_patterns) feature of Centrifugo PRO can now be used together with Centrifugo OSS namespaces – now each channel namespace can have `pattern` string option to indicate it to be a **pattern namespace**, each namespace which defines a pattern will be resolved only if channel matches the pattern. This allows to use patterns for some channels and simple prefix-based namespacing for others – thus making it much simpler to transition from Centrifugo OSS to Centrifugo PRO, channel namespace configuration may be updated gradually now. Also, some features which could be not available for channel patterns, like automatic personal channel subscription, now available for PRO users. It's still required to enable channel patterns feature explicitly though – it's not enabled by default to not introduce unwanted side effects for setups which transitioning to PRO version and already have channels starting with `/` (for channels without namespace).

## What's next?

For those who are not using Tarantool or SockJS – migration to Centrifugo v6 is mainly the matter of Centrifugo configuration update. There are many changes in the config layout, so to simplify the migration process we prepared the automatic configuration migration tool (which supports both file and environment configuration migration). You can find more details in [Centrifugo v6 migration guide](https://centrifugal.dev/docs/getting-started/migration_v6). Client protocol, server API protocol, proxy event protocol stayed the same – so after running Centrifugo v6 with correctly updated configuration you can expect zero issues with existing integrations. 

Check out Centrifugo [community channels](https://centrifugal.dev/docs/getting-started/community) where you can find help for the migration process, or any other Centrifugo-related question.

Hope you will enjoy the new Centrifugo – it's cleaner and simpler to extend, more developer-friendly and innovates with its headers emulation feature. As usual, let the Centrifugal force be with you!
