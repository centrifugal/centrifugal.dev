---
title: Centrifugo v6 released 
tags: [centrifugo, release]
description: We are excited to tell the world about Centrifugo v6 – a new major release, which is now live. This release contains fundamental changes in the configuration and adds several useful features and more observability to Centrifugo OSS and Centrifugo PRO.
author: Centrifugal team
authorTitle: 💻✨🔮✨💻
authorImageURL: /img/logo_animated.svg
image: /img/v6.jpg
hide_table_of_contents: false
draft: true
---

<!--truncate-->

<img src="/img/v6.jpg" />

We are excited to tell the world about Centrifugo v6 – a new major release, which is now live. This release contains fundamental improvements in the configuration to simplify working with Centrifugo from users and core development perspectives, adds several useful features and more observability to Centrifugo OSS and Centrifugo PRO.

## Why Centrifugo v6 was required?

<img src="/img/v6_most_wanted.jpg" align="left" style={{'marginRight': '15px', 'marginBottom': '5px', 'float': 'left', 'maxWidth': '300px'}} />

In recent blog post we talked about [notable Centrifugo v5 milestones](/blog/2024/12/23/centrifugo-v5-milestones). The v5 release was a significant milestone in the Centrifugo project's history, introducing a number of new features and improvements. The time for a new major release had come though.

Over the years, Centrifugo has evolved into a robust platform packed with numerous features. However, as the capabilities of Centrifugo expanded, so did the complexity of its configuration. Settings became increasingly dispersed across various parts of the codebase, making them harder to manage and understand. Adding new features required touching more places than it should have. With v6, we are addressing this head-on by restructuring the configuration system and rethinking its organization.

The Centrifugo v6 release introduces a more streamlined configuration layout, reducing code repetition and providing a clear separation of options and their relationships to Centrifugo’s different layers. These improvements are designed to enhance clarity, maintainability, and overall developer experience, setting a solid foundation for future growth.

Additionally, there were a few areas that required improvement but could not be addressed without breaking changes. A couple of deprecated features were removed in v6. Let's begin our dive into the Centrifugo v6 release with a description of the removed parts.

## Removing SockJS

SockJS was deprecated in the Centrifugal ecosystem [since v4 release](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#:~:text=SockJS%20is%20still%20supported%20by%20Centrifugo%20and%20centrifuge%2Djs%2C%20but%20it%27s%20now%20DEPRECATED.). We asked users to reach out if SockJS was still necessary [in blog posts](https://centrifugal.dev/blog/2023/06/29/centrifugo-v5-released#the-future-of-sockjs), marked it as deprecated in the documentation. However, nobody reached out during this time.

The SockJS client is poorly maintained these days, with issues not being addressed and some transports becoming archaic.

We now have [our own WebSocket emulation layer](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#modern-websocket-emulation-in-javascript). Unlike SockJS's HTTP-based fallbacks, our layer does not require sticky sessions in distributed cases (!), supports binary in the HTTP-streaming case, allows batching, is more performant in terms of CPU and memory on the server side, and requires fewer round-trips for connection establishment.

That's why SockJS was removed in Centrifugo v6. Our Javascript SDK `centrifuge-js` will support SockJS transport for some time to work with Centrifugo v5, but we will remove it at some point from the client SDK also.

To enable Centrifugo built-in bidirectional emulation you need to enable [HTTP streaming](/docs/transports/http_stream) or [SSE](/docs/transports/sse) transports in server configuration, then configure `centrifuge-js` to use those [as described here](https://github.com/centrifugal/centrifuge-js?tab=readme-ov-file#http-based-websocket-fallbacks):

```javascript
const transports = [
    {
        transport: 'websocket',
        endpoint: 'ws://localhost:8000/connection/websocket'
    },
    {
        transport: 'http_stream',
        endpoint: 'http://localhost:8000/connection/http_stream'
    },
    {
        transport: 'sse',
        endpoint: 'http://localhost:8000/connection/sse'
    }
];
const centrifuge = new Centrifuge(transports);
centrifuge.connect()
```

## Removing Tarantool

The experimental Tarantool engine was introduced in Centrifugo v3, and we had hopes for it to be a good alternative to Redis. Unfortunately, Tarantool engine implementation has not received many updates since it was introduced, and it now lacks several features of engine, such as idempotent publishing or delta compression. These features were added to memory and Redis engines during v5 release life cycle, but Tarantool was left behind.

We were aware of only two setups where it was used – and both clients eventually moved away from the Tarantool engine with our help. Also, our usage stats do not show any notable usage of the Tarantool engine.

The truth is – while Tarantool provides some interesting technical advantages over Redis, it's impossible to properly maintain integration with it and keep it current given the resources of Centrifugal Labs. In addition, there was no help from the Centrifugo community to push it forward.

That's why we decided to remove Tarantool integration from Centrifugo. All Tarantool-related repositories will be moved to read-only mode. Now we will concentrate on Redis, Redis-compatible brokers, and NATS as the main scalability options for Centrifugo.

Sometimes, it's necessary to drop some ballast to continue the beautiful journey...

<img src="/img/ballast.jpg" />

Meanwhile, our Redis integration was improved, in Centrifugo v4 we migrated to [redis/rueidis](https://github.com/redis/rueidis) Go library which allowed Centrifugo node to have a better Redis communication throughput. See more details in [Improving Centrifugo Redis Engine throughput and allocation efficiency with Rueidis Go library](/blog/2022/12/20/improving-redis-engine-performance) blog post. We've put more effort to integrate with Redis-compatible storages, like [DragonflyDB](https://www.dragonflydb.io/) which may open new interesting properties without the need to maintain a separate engine.

## Configuration refactoring

All these years we've been building Centrifugo configuration on top of the approach initially established in early versions. At the beginning the number of configuration options was rather small and manageable. With every new version and every new feature configuration became harder and harder to maintain and extend.

Refactoring that part is a difficult and not a fun process, and comes with compatibility break, but for v6 we've decided that it's time to do it.

Centrifugo v6 configuration was re-built from scratch and now consists from different blocks – all the options are grouped together to make it clear to which layer they correspond.

For example, there is a `client` top-level configuration block which contains options related to real-time client connections. To give one example let's take `allowed_origins` option of Centrifugo v5:

```json title="Centrifugo v5 config example"
{
    "allowed_origins": ["https://example.com"]
}
```

It was moved under `client` section in v6:

```json title="config.json"
{
    "client": {
        "allowed_origins": ["https://example.com"]
    }
}
```

It's now obvious which layer of Centrifugo it corresponds. Not to server API, not to admin web interface, but to client connections.

Internally we got rid of the situation when options were spread over Centrifugo code base, sometimes with unclear defaults and non-obvious way of adding a new option to Centrifugo.

Now the configuration is represented by a single Go struct. Config sections represented by nested structs. Defaults are visible – they are set in the field definition struct tags. It's simple to follow, simple to extend – in most cases just a new field in the struct or a nested struct for more complex functionality. And having all options inside a single struct opens new ways to work with the configuration as we will see below.

BTW, remember that Centrifugo supports not only JSON config files, but also YAML and TOML? Let's look on one more example, now in YAML format:

```yaml title="Centrifugo v5 YAML config example"
token_hmac_secret_key: XXX
admin_password: XXX
admin_secret: XXX
api_key: XXX
allowed_origins:
- http://localhost:3000
presence: true
namespaces:
- name: ns
  presence: true
```

In v6 becomes:

```yaml title="config.yaml"
client:
  token:
    hmac_secret_key: XXX
  allowed_origins:
  - http://localhost:3000
admin:
  password: XXX
  secret: XXX
http_api:
  key: XXX
channel:
  without_namespace:
    presence: true
  namespaces:
  - name: ns
    presence: true
```

One aspect we'd like to mention is that channel options for channels which do not have any namespace prefix are now defined under `channel -> without_namespace` block. So channel namespace options for channels without namespace are not mixed together with other Centrifugo options on the same level of configuration. We had several bugs previously due to the fact how namespace options were organized in the code base – options for channels without namespace required separate extraction, often forgotten. Now this was eliminated. And here we push users a bit to use namespaces when working with Centrifugo as the best practice.

The cool thing about Centrifugo is that on start it warns about unknown options in configuration file and unknown environment variables. This was already there before, helps to find configuration mistakes, and we keep it in v6 – now supporting keys in deeply nested objects and arrays of objects without a lot of copy-paste in the code base.

Re-structuring configuration also affects how environment variables are built to configure Centrifugo. This will require our users to update their environment variables configuration. To help with this we added configuration converters to the v6 migration guide and new CLI commands which should help a lot with this (see more details below). The re-organization helped us to avoid situation when we had to manually add environment variable parsing in the code inside nested array of objects.

## TLS config unification

The important part of new Centrifugo v6 configuration is that it uses the same TLS configuration object everywhere to configure TLS. Whenever you are configuring TLS now – you can expect the same field names, just on a different configuration level. TLS for HTTP server, for Redis client, Nats client, Kafka client, PostgreSQL client, including mTLS support – all can be configured in the unified way.

The new [TLS config object](/docs/server/configuration#tls-config-object) which was already used in some places in v5 allows passing certs and keys in 3 different ways:

* as a string in config with PEM-encoded cert/key content
* as a base64 encoded string of PEM-encoded cert/key
* as a path to a file with PEM-encoded cert/key

You can choose the way which is more convenient for you.

## Proxy config improvements

Due to its self-hosted nature, Centrifugo can offer an efficient way to proxy various connection events to the application backend, enabling the backend to respond in a customized manner to control the flow. This Centrifugo feature is called "proxy", and it's used massively by Centrifugo users. It helps authenticating connections in cases when built-in JWT Centrifugo auth is not suitable, managing channel subscribe permissions and publication validations, refreshing client sessions, and handling RPC calls sent by a client over a bidirectional real-time connection.

In v6, there are a couple of notable improvements made in the proxy feature configuration.

First, there is no more granular and non-granular proxy mode separation – `connect` and `refresh` proxies can now be enabled and configured on `client` level, and other types of proxy which relate to channels inside `channel` configuration block and enabled on channel namespace level. RPC proxy configuration can be defined under a separate `rpc` section in the config.

Second, it's now possible to define default proxies for all event types now separately – each with its own set of options. Previously all proxies inherited the same set of options – only endpoints and timeouts could be set for each specific proxy type. For many cases, this should help to configure desired proxy behaviour without the need to use named proxy objects. One example - you can define `connect` and `refresh` proxies now, and configure different set of headers passed for `connect` and `refresh`. While it seems natural – previously it was only possible by using a granular proxy mode and referencing custom proxies by name. Now named proxy objects must be used only for channel and rpc namespaces, and in many cases it's not necessary to use them at all.

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

Another feature which can simplify integrating Centrifugo was added to asynchronous Kafka consumer. Before, Centrifugo could integrate with Kafka topics but expected a special payload format representing Centrifugo API command in each messages of the topic. It works great when you have a Kafka topic specific for Centrifugo. Centrifugo v6 introduced `publication data mode` for Kafka consumer. After enabling such a mode Centrifugo expects that messages in Kafka topics represent not a server API commands, but a data ready to publish. It's possible to use special Kafka headers to tell Centrifugo which channels the data must be published to.

The main idea here is that publication data mode may simplify Centrifugo integration with existing Kafka topics for real-time message delivery to clients.

Since Centrifugo allows configuring an array of async consumers – it's possible to use Kafka consumers in different modes at the same time.

## Separate broker and presence manager

Centrifugo engine internally consists of two parts: Broker and PresenceManager. At some point during v5 life cycle we've added the possibility to set custom brokers and presence managers for different namespaces in Centrifugo PRO. Now in v6 release we make the separation explicit in OSS edition too – it's possible to configure Broker and Presence Manager separately.

The configuration of Nats broker to use instead of Redis is more straightforward to do now, and custom brokers are simpler to be added.

One possibly useful application is using separate Redis installations for broker part and for presence manager parts, which may scale independently. Or use Nats for at most once broker implementation, and Redis for presence. So giving a bit more flexibility for Centrifugo OSS users now.

We still support configuring Redis Engine in Centrifugo v6 as the approach works well for many users and is still recommended by default, with new configuration layout it looks like this:

```yaml title="config.yaml"
engine:
  type: redis
  redis:
    address: localhost:6379
```

## Observability enhancements

Several useful metrics were added to Centrifugo.

The first one – `centrifugo_client_connections_inflight` – shows the number of inflight connections over a specific transport. So when you are using WebSocket with fallbacks you can easily see the percentage of your users which can't establish WebSocket connection.

Next, `centrifugo_command_errors_total`, is a counter to track API command errors with response code resolution.

The counter `centrifugo_api_command_errors_total` will help to find out which API commands return an error with Centrifugo error code resolution.

Asynchronous consumers metrics were added – now it's possible to see the number of messages consumed by each consumer and number of processing errors.

Centrifugo now provides metrics for Redis broker PUB/SUB layer – like number of errors or the inflight buffered messages in PUB/SUB processor workers. These metrics are very helpful for monitoring and general understanding of system state. 

See [exposed metrics](/docs/server/observability#exposed-metrics) for the description of all metrics available in Centrifugo v6.

## Actualized Grafana dashboard

We understand that it's important to have a good starting point for monitoring Centrifugo. That's why we updated our [Grafana dashboard](https://grafana.com/grafana/dashboards/13039-centrifugo/) to include all new metrics added during lifetime of Centrifugo v5 and added in Centrifugo v6. Instead of 22 panels it now includes 39 for the OSS edition and provides a better understanding of what's going on with your installation. We also re-considered how we display rate on a dashboard – instead of summing up rates per minute we now show rates per second which is more expected for most Prometheus users.

<img src="/img/grafana.jpg" />

We've also extended Grand Chat tutorial with a [new chapter on how to include Prometheus and Grafana stack](/docs/tutorial/monitoring) to our tutorial messenger application.

## Other improvements

Other improvements done in v6 release include:

* Possibility to set custom [TLS configuration for internal](/docs/server/configuration#internal_tls) HTTP endpoints, previously it was only possible to disable TLS for them keeping TLS only for external endpoints. 
* Added TLS support for PostgreSQL clients: for async consumer from PostgreSQL outbox table, for database connection and for PostgreSQL-based push notifications queue client.
* New option `message_size_limit` for WebTransport – it effectively limits the maximum size of individual message through the WebTransport connection.
* Better logging for TLS configuration on start on debug level to help to understand what's wrong with a TLS setup.
* Possibility to set Redis Cluster and Sentinel configurations using Redis address configuration option – by using Redis URL with `redis+cluster://` and `redis+sentinel://` schemes correspondingly. Previously `address` only supported a standalone single Redis setup. A notable addition here is that with new approach it's possible to set different Redis master names in setup which wants to re-use the same Sentinel nodes for managing different Redis shards. And it generally simplifies Redis configuration, especially for sharded setup – each shard may be represented just by a separate address string with its own Redis options in `address` array. See updated [Engines and scalability](/docs/server/engines) doc chapter.
* We refactored logging approach throughout Centrifugo source code, making it more straightforward and consise. This allowed to remove dependency to [Centrifuge](https://github.com/centrifugal/centrifuge) `Node` object in many places where it lived only for logging purposes – a bit awkward legacy in source code which is now eliminated. And this opened a way to utilize the fastest way to write logs with `zerolog` library – writing strictly typed log values in many places where we previously used untyped field maps.
* Centrifugo users from Mayflower company needed to figure out the best Redis setup for their load profile – we now have a [simple tool](https://github.com/centrifugal/centrifuge/tree/master/_examples/redis_benchmark) to put Centrifugo specific load on Redis.

A huge work has been done in the documentation – all chapters were reviewed, config samples updated.

We also updated our official [Helm chart](https://github.com/centrifugal/helm-charts) and the [source code of Grand Chat Tutorial](https://github.com/centrifugal/grand-chat-tutorial) for v6 changes.

## Centrifugo PRO improvements

Centrifugo PRO v6 as usual inherits all the changes of the OSS edition. The configuration layout refactoring also affected some parts of Centrifugo PRO configuration. And worth mentioning, you can expect new `defaultconfig` and `defaultenv` CLI commands to work properly for Centrifugo PRO also.

Outside the configuration layout tweaks, there were several improvements for Centrifugo PRO features.

### Improved channel state events

In v6 we've made a step forward with Centrifugo PRO [channel state events](https://centrifugal.dev/docs/pro/channel_state_events) feature.

We handled an edge case when first `occupied` event in channel could be not delivered due to the race condition and made the processing of `vacated` events queue more effective.

Also, now if channel state proxy is defined in the namespace – it's not necessary to explicitly provide array of events to send, once proxy enabled Centrifugo PRO will send both `occupied` and `vacated` events by default.

We still consider this feature to be alpha state though.

### Dedicated PostgreSQL for push notifications queue

Dedicated PostgreSQL [push notifications](https://centrifugal.dev/docs/pro/push_notifications) queue config was added in Centrifugo PRO. Now it's not necessary to use the same PostgreSQL for push notifications queue as for device management – it can be separate.

If you are using Centrifugo push notifications without a device management API, just for broadcasting pushes to known FCM/APNs/HMS tokens, extra tables in PostgreSQL which Centrifugo creates for device data storage and other functionality may be avoided.

### Tutorial for push notifications

We [extended Grand Chat tutorial](/docs/tutorial/push_notifications) to include a new appendix chapter on how to integrate push notifications with Centrifugo PRO. This tutorial will help you to understand how to send Web push notifications to mobile devices using Centrifugo PRO and FCM. The chapter is still under construction, but already has all the parts combined into a working implementation:

<video width="100%" loop={true} muted controls src="/img/grand-chat-tutorial-demo-push.mp4"></video>

### Generalized channel patterns

Centrifugo PRO enhances a way to configure channels with [Channel Patterns](https://centrifugal.dev/docs/pro/channel_patterns) feature. This opens a road for building channel model similar to what developers got used to when writing HTTP servers and configuring routes for HTTP request processing.

Previously, if PRO users wanted to use channel patterns – they had to use patterns instead of general namespaces mechanism. In v6, channel patterns can be used together with Centrifugo OSS namespaces.

Now each channel namespace can have a `pattern` string option to indicate it to be a **pattern namespace**, each namespace which defines a pattern will be resolved only if channel matches the pattern. This allows to use patterns for some channels and simple prefix-based namespacing for others – thus making it much simpler to transition from Centrifugo OSS to Centrifugo PRO, channel namespace configuration may be updated gradually now.

Also, due to this change, some features which could be not available for channel patterns, like automatic personal channel subscription, now available for PRO users. It's still required to enable channel patterns feature explicitly though – it's not enabled by default to not introduce unwanted side effects for setups which transitioning to PRO version and already have channels starting with `/` (for channels without namespace).

### Namespace resolution for metrics

Centrifugo PRO already supported channel namespace resolution for transport messages sent/received metrics. This is very useful for setups with many namespaces to understand which namespaces consume more bandwidth.

In v6, we extend this and provide channel namespace resolution to all Centrifugo metrics related to channels. This should provide even more insights into how Centrifugo is used in your setup and make business decisions based on this data. For example, you will be able to segment metrics like this by channel namespace:

* `centrifugo_node_messages_sent_count`/`centrifugo_node_messages_received_count`
* `centrifugo_client_command_duration_seconds`
* `centrifugo_client_num_reply_errors`
* and so on

### Clients and subscriptions inflight

Centrifugo PRO ClickHouse analytics provided a way to build client connection distributions using client name and app version segmentation – so that it's possible to understand how many clients from different environments are currently connected to your Centrifugo. I.e. from browser, from Android, iOS devices. This is possible because our SDKs pass the name of SDK to a server, and provide a way to redefine it.

Centrifugo v6 PRO exposes this information simply as part of Prometheus metrics, as a gauge `centrifugo_client_connections_inflight`. To avoid cardinality issues, Centrifugo requires explicit configuration of registered client names and versions.

But it's not the end, and it also provides `centrifugo_client_subscriptions_inflight` now with client name and channel namespace resolution. This may help to get very useful insights into current and historical Centrifugo usage.

While these metrics are great to have, ClickHouse analytics provides an individual connection and channel subscription resolution. But its usage may be now postponed if metrics provide enough information to answer your questions.

Moreover, metrics of Centrifugo PRO with channel namespace resolution mentioned above and inflight connections/subscriptions are now part of Centrifugo [official Grafana dashboard](https://grafana.com/grafana/dashboards/13039-centrifugo/).

### Sentry integration

The next improvement for Centrifugo PRO observability is an integration with [Sentry](https://sentry.io/). Just a couple of lines in the configuration:

```json
{
  ...
  "sentry": {
    "enabled": true,
    "dsn": "your-project-public-dsn"
  }
}
```

– and you will see Centrifugo PRO errors collected by your self-hosted or cloud Sentry installation.

<img src="/img/sentry.jpg" />

### Redis Cluster sharded PUB/SUB

Another feature which is now available in Centrifugo PRO is sharded PUB/SUB support in Redis Cluster. Sharded PUB/SUB [was introduced in Redis 7.0](https://redis.io/docs/latest/develop/interact/pubsub/#sharded-pubsub) as an attempt to fix the problem with PUB/SUB scalability in Redis Cluster. With normal PUB/SUB all publications are spread towards all nodes of cluster. This makes Cluster PUB/SUB throughput less with adding more nodes to the cluster. In sharded PUB/SUB case channel keyspace is devided to slots in the same way as normal keys, and PUB/SUB is splitted over Redis Cluster nodes based on channel name.

When using Centrifugo PRO [with the sharded PUB/SUB feature](/docs/pro/scalability#redis-cluster-sharded-pubsub), there are important considerations to keep in mind. This feature changes how Centrifugo constructs keys and channel names in Redis compared to the standard non-sharded setup. Specifically, Centrifugo divides the channel space into a configurable number of "partitions", typically 64 to 128 (though this can be adjusted as needed).

This partitioning is essential to ensure compatibility with Redis Cluster's slot system while keeping the number of connections from Centrifugo to Redis at a manageable level. Each partition uses a dedicated connection for PUB/SUB communication with the Redis Cluster.

Without this partitioning, each Centrifugo node could potentially create up to 16,384 connections to the Redis Cluster—one for each cluster slot—a number that is impractically large. The partitioning strategy avoids this issue, maintaining efficient and scalable communication between Centrifugo and Redis.

We generally recommend using Redis sharded PUB/SUB only if you are already using a Redis Cluster and are nearing its scalability limits. In such cases, switching to sharded PUB/SUB mode, despite the different keys/channel names in Redis, can significantly enhance the application's ability to handle larger workloads.

Once the scalability limit of a single cluster with sharded PUB/SUB is reached, you can further scale by adding an additional, isolated Redis Cluster. Centrifugo can then be configured to use multiple clusters instead of one, enabling scaling similar to its consistent sharding mechanism over isolated single Redis instances. However, in this setup, the sharding occurs across multiple Redis Clusters.

We will continue exploring other possible ways to integrate with Redis Cluster sharded PUB/SUB without reducing slot number to the configured partitions number. This may involve more complexity in the code and connection management, but we see the potential of improving the integration with Redis sharded PUB/SUB further as time goes.

### Leverage Redis replicas

Some Centrifugo users have Redis setups with replication configured. This may be Redis Sentinel based primary-replica setup, or Redis Cluster where each cluster shard may consist of primary and several replicas.

Centrifugo PRO v6 [allows utilizing existing replicas](/docs/pro/scalability#leverage-redis-replicas) for a couple of functionality:

* move all channel subscriptions to replica – thus primary becomes less utilized 
* move reading presence information from replica, again making primary more effective since potentially more slow requests are moved out.

This extends scalability options and may be very handy to stay on lower resources.

## What's next?

For those who are not using Tarantool or SockJS – migration to Centrifugo v6 is mainly the matter of Centrifugo server configuration update.

Given the nature and the number of configuration changes it's not that easy, we understand. To simplify the migration process we've prepared the automatic configuration migration tool (which supports both file and environment configuration migration). You can find more details in [Centrifugo v6 migration guide](/docs/getting-started/migration_v6). Client protocol, server API protocol, proxy event protocol stayed the same – so after running Centrifugo v6 with correctly updated configuration you can expect zero issues with existing integrations.

Check out Centrifugo [community channels](https://centrifugal.dev/docs/getting-started/community) where you can find help for the migration process, or any other Centrifugo-related question.

Hope you will enjoy the new Centrifugo – it's cleaner and simpler to extend, more developer-friendly and innovates with several nice features. As usual, let the Centrifugal force be with you 🖲
