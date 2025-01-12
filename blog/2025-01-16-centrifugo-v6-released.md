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

We are excited to announce Centrifugo v6 – a new major release that is now live. This release includes fundamental improvements in the configuration to simplify working with Centrifugo from both user and core development perspectives. It also adds several useful features and enhances observability for both Centrifugo OSS and Centrifugo PRO.

:::tip Prefer podcast version of this post? (8.5 MB).

<audio controls>
  <source src="/img/v6.mp3" type="audio/mp3" />
</audio>

:::

For those who never heard about Centrifugo before, it is a scalable real-time messaging server in a self-hosted environment. Centrifugo allows you to build real-time features in your application, such as chat, notifications, live updates, and more. It's modern, fast, reliable and lightweight. Centrifugo is used by many companies worldwide to power real-time features in their applications. Find out more information in [introduction](/docs/getting-started/introduction).

## Why Centrifugo v6 was required?

<img src="/img/v6_most_wanted.jpg" align="left" style={{'marginRight': '15px', 'marginBottom': '5px', 'float': 'left', 'maxWidth': '300px'}} />

In a recent blog post, we talked about [notable Centrifugo v5 milestones](/blog/2024/12/23/centrifugo-v5-milestones). The v5 release was a significant milestone in the Centrifugo project's history, introducing numerous new features and improvements. However, the time for a new major release had come.

Over the years, Centrifugo has evolved into a robust platform packed with numerous features. However, as Centrifugo's capabilities expanded, so did the complexity of its configuration. Settings became increasingly dispersed across various parts of the codebase, making them harder to manage and understand. Adding new features required modifying more areas than it should have. With v6, we are addressing this challenge head-on by restructuring the configuration system and rethinking its organization.

The Centrifugo v6 release introduces a more streamlined configuration layout, reducing code repetition and providing a clear separation of options and their relationships to Centrifugo’s different layers. These improvements are designed to enhance clarity, maintainability, and the overall developer experience, setting a solid foundation for future growth.

Additionally, there were a few areas that required improvement but could not be addressed without breaking changes. A couple of deprecated features were removed in v6. Let's begin our dive into the Centrifugo v6 release with a description of the removed parts.

## Removing SockJS

SockJS is a JavaScript library that provides a WebSocket-like object, but under the hood, it uses various transports to establish a connection (falling back to HTTP instead of WebSocket in case of connection issues).

The SockJS transport was deprecated in the Centrifugal ecosystem [since the v4 release](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#:~:text=SockJS%20is%20still%20supported%20by%20Centrifugo%20and%20centrifuge%2Djs%2C%20but%20it%27s%20now%20DEPRECATED.). We encouraged users to reach out if SockJS was still necessary [in blog posts](https://centrifugal.dev/blog/2023/06/29/centrifugo-v5-released#the-future-of-sockjs) and marked it as deprecated in the documentation. However, nobody reached out during this time.

The SockJS client is poorly maintained these days, with issues not being addressed and some transports becoming outdated.

Since Centrifugo v4, we have [our own WebSocket emulation layer](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#modern-websocket-emulation-in-javascript). Unlike SockJS's HTTP-based fallbacks, our layer:

* does not require sticky sessions in distributed cases (!),
* supports binary in the HTTP-streaming case,
* allows batching of messages in a more efficient wire format,
* is more performant in terms of CPU and memory on the server side, and
* requires fewer round-trips for connection establishment.

In Centrifugo v6, SockJS has been removed. Our JavaScript SDK, `centrifuge-js`, will continue to support the SockJS transport for some time to work with Centrifugo v5, but we plan to remove it from the client SDK eventually.

To enable Centrifugo’s built-in bidirectional emulation, you need to enable [HTTP streaming](/docs/transports/http_stream) or [SSE](/docs/transports/sse) transports in the server configuration, and then configure `centrifuge-js` to use those [as described in its README](https://github.com/centrifugal/centrifuge-js?tab=readme-ov-file#http-based-websocket-fallbacks):

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

The experimental Tarantool engine was introduced in Centrifugo v3, and we had hopes for it to become a good alternative to Redis. Unfortunately, the Tarantool engine implementation has not received many updates since its introduction and now lacks several key features of the engine, such as idempotent publishing and delta compression. These features were added to the memory and Redis engines during the v5 release lifecycle, but Tarantool was left behind.

We were aware of only two setups where the Tarantool engine was used – and both clients eventually moved away from it with our help. Additionally, our usage statistics do not show any notable adoption of the Tarantool engine.

The reality is that while Tarantool provides some interesting technical advantages over Redis, maintaining proper integration with it and keeping it current is impossible given the resources of Centrifugal Labs. Furthermore, there was no significant support from the Centrifugo community to push its development forward.

For these reasons, we decided to remove Tarantool integration from Centrifugo. All Tarantool-related repositories will be moved to read-only mode. For now Centrifugal Labs will focus on Redis, Redis-compatible brokers, and NATS as the main scalability options for Centrifugo.

Sometimes, it's necessary to drop some ballast to continue a beautiful journey...

<img src="/img/ballast.jpg" />

Meanwhile, our Redis integration has been improved. In Centrifugo v4, we migrated to the [redis/rueidis](https://github.com/redis/rueidis) Go library, which enabled the Centrifugo node to achieve better Redis communication throughput. You can find more details in the blog post [Improving Centrifugo Redis Engine throughput and allocation efficiency with Rueidis Go library](/blog/2022/12/20/improving-redis-engine-performance).

We have also put more effort into integrating with Redis-compatible storages, such as [DragonflyDB](https://www.dragonflydb.io/), which may unlock new and interesting capabilities without the need to maintain a separate engine.

## Configuration refactoring

Over the years, Centrifugo's configuration has been built on the approach initially established in its early versions. At the beginning, the number of configuration options was relatively small and manageable. However, with every new version and feature, the configuration became increasingly difficult to maintain and extend.

Refactoring this part is a challenging and not particularly enjoyable process, and it inevitably results in breaking compatibility. Nevertheless, for v6, we decided it was time to make this change.

Centrifugo v6 configuration has been completely restructured and now consists of distinct blocks – with all the options grouped together to clearly indicate the layer they correspond to.

For example, there is a `client` top-level configuration block that contains options related to real-time client connections. To illustrate, let's take the `allowed_origins` option from Centrifugo v5:

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

It is now clear which layer of Centrifugo a given option corresponds to. For instance, the `allowed_origins` option is related to client connections – not to the server API or the admin web interface.

Internally, we eliminated the situation where options were scattered across the Centrifugo codebase, often with unclear defaults and a non-obvious process for adding a new option.

Now, the configuration is represented by a single Go struct. Config sections are organized into nested structs. Defaults are explicitly defined using struct field definition tags, making them easy to identify. This approach is simple to follow and extend – in most cases, adding a new option is as straightforward as introducing a new field in the struct or a nested struct for more complex functionality. Having all options centralized in a single struct also unlocks new possibilities for working with the configuration, as we will explore below.

By the way, remember that Centrifugo supports not only JSON configuration files but also YAML and TOML? Let’s look at another example, this time in YAML format:

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

One aspect we'd like to highlight is that channel options for channels without any namespace prefix are now defined under the `channel -> without_namespace` block. This change ensures that options for channels without a namespace are not mixed with other Centrifugo options at the same level of configuration. Previously, the way namespace options were organized in the codebase led to several bugs – options for channels without a namespace required separate extraction, which was often overlooked. This issue has now been resolved. Additionally, with new config structure we more explicitly encourage users to adopt namespaces as a best practice when working with Centrifugo.

A great feature of Centrifugo is that it warns about unknown options in the configuration file and unknown environment variables at startup. This functionality, which helps users identify configuration mistakes, was already present in previous versions and remains in v6. Now, it also supports keys in deeply nested objects and arrays of objects without requiring excessive copy-paste in the codebase.

Re-structuring the configuration also affects how environment variables are constructed to configure Centrifugo. This will require users to update their environment variable configurations. To assist with this, we have added configuration converters to the v6 migration guide and introduced new CLI commands, which should greatly simplify the process (see more details below). This re-organization has also eliminated the need for manually adding environment variable parsing code inside nested arrays of objects.

## TLS config unification

An important aspect of the new Centrifugo v6 configuration is that it uses the same TLS configuration object consistently across the entire system. Whenever you are configuring TLS now, you can expect the same field names, just at different configuration levels. TLS for the HTTP server, Redis client, NATS client, Kafka client, PostgreSQL client, and even mTLS support – all can be configured in a unified way.

The new [TLS config object](/docs/server/configuration#tls-config-object), which was already used in some places in v5, allows certs and keys to be passed in three different ways:

* as a string in the config with PEM-encoded cert/key content,
* as a base64 encoded string of PEM-encoded cert/key, or
* as a path to a file with PEM-encoded cert/key.

So you can choose the method that is most convenient for you.

## Proxy config improvements

Due to its self-hosted nature, Centrifugo can provide an efficient way to proxy various connection events to the application backend, enabling the backend to respond in a customized manner to control the flow. This feature, called "proxy" is widely used by Centrifugo users. It allows authenticating connections (when the built-in JWT Centrifugo authentication is not suitable), managing channel subscription permissions and publication validations, refreshing client sessions, and handling RPC calls sent by a client over a bidirectional real-time connection.

In v6, there are a couple of notable improvements in the proxy feature configuration.

First, the separation between granular and non-granular proxy modes has been removed. In other words, there is no need to switch to a granular mode and reconfigure everything – proxies may be added gradually in the way which is more suitable for a real-time feature.

The `connect` and `refresh` proxies can now be enabled and configured at the `client` level, while other types of proxies, which relate to channels, are configured within the `channel` block and enabled at the channel namespace level. RPC proxy configuration is now defined under a separate `rpc` section in the configuration.

It is now possible to define default proxies for all event types separately - `connect`, `refresh`, `subscribe`, `publish`, `sub_refresh`, etc, – each with its own set of options. Previously, all proxies inherited the same set of options, and only endpoints and timeouts could be customized for specific proxy types. This new flexibility allows you to configure the desired proxy behavior without needing to use named proxy objects in many cases. For example, you can now define `connect` and `refresh` proxies with different sets of headers for each. While this behavior seems intuitive, it was previously only achievable by using the granular proxy mode and referencing custom proxies by name. Now, named proxy objects may be avoided in many cases where they were required before. So you can postpone using them until a more granular configuration is really required.

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

We already like this feature a lot ourselves when combined with `grep`, to quickly try configuring sth in development and finding out the necessary option:

```bash
centrifugo defaultenv | grep "HMAC"
```

## Headers emulation

The WebSocket API in web browsers does not allow setting custom HTTP headers, which makes implementing authentication for WebSocket connections from browsers more challenging.

Centrifugo’s JWT authentication provides a robust solution by allowing authentication via a JWT token sent internally in the first client protocol message. However, not everyone prefers to use JWT, so many Centrifugo users have configured a connect proxy to authenticate incoming connections.

Unfortunately, in such cases, only cookie-based authentication was available, as web browsers automatically include the `Cookie` header for WebSocket Upgrade requests to the same domain. Other types of authentication, such as appending a `Bearer` token in a header, were only possible by passing the token in URL parameters or with initial custom `data` sent in the connection. While these methods work, they are often inconvenient because the backend cannot easily reuse existing middlewares for authentication.

A useful feature introduced in Centrifugo v6 is called **Headers Emulation**. This feature is available exclusively in our browser SDK, `centrifuge-js` (and only makes sense there, as other platforms allow setting headers natively). With this feature, it is now possible to provide a custom headers map in the `Centrifuge` constructor options. These values are automatically translated into HTTP headers when Centrifugo makes connection proxy requests to the backend. Internally, these custom headers are still passed to Centrifugo via the first client protocol message.

We are not the first offering such a workaround BTW - those familiar with Cloudflare WebSocket API may know that Cloudflare Workers allow setting custom headers for WebSocket connections [in a Sec-WebSocket-Protocol header](https://blog.cloudflare.com/do-it-again/). However, that approach violates WebSocket RFC, and Centrifugo provides a better implementation here moving headers passing to its own client protocol level.

Here is an example of how to use `centrifuge-js` with the headers emulation feature:

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

This feature simplifies browser-based WebSocket authentication, enabling developers to define custom headers in a familiar and efficient way.

## Publication data mode for Kafka consumers

Another feature added in Centrifugo v6 simplifies integrating Centrifugo with Kafka via its asynchronous Kafka consumer. Previously, Centrifugo could integrate with Kafka topics but required a special payload format, where each message in the topic represented a Centrifugo API command. This approach worked well for Kafka topics specifically set up for Centrifugo. 

With Centrifugo v6, a new [**Publication Data Mode**](/docs/server/consumers#kafka-consumer-options) has been introduced for Kafka consumers. When this mode is enabled, Centrifugo expects messages in Kafka topics to contain data ready for direct publication, rather than server API commands. It is also possible to use special Kafka headers to specify the channels to which the data should be published.

The primary goal of this mode is to simplify Centrifugo's integration with existing Kafka topics, making it easier to deliver real-time messages to clients without needing to restructure the topic's payload format.

Additionally, since Centrifugo allows configuring an array of asynchronous consumers, it is possible to use Kafka consumers in different modes simultaneously.

## Separate broker and presence manager

Centrifugo's engine internally consists of two main components: the Broker and the PresenceManager. During the v5 lifecycle, we introduced the ability to set custom brokers and presence managers for different namespaces in Centrifugo PRO. With the v6 release, this separation is now explicit in the OSS edition as well, allowing the Broker and Presence Manager to be configured independently – see more details in [Engines and Scalability](/docs/server/engines#separate-broker-and-presence-manager) documentation chapter.

Configuring the NATS broker as an alternative to Redis is now more straightforward, and adding custom brokers is simpler than before.

One potentially useful application of this flexibility is using separate Redis installations for the Broker and PresenceManager, allowing them to scale independently. Alternatively, you could use NATS for a "at most once" broker implementation while keeping Redis for presence management. This provides more flexibility for Centrifugo OSS users to tailor their setups to their specific needs.

We continue to support configuring the Redis engine in Centrifugo v6, as this approach works well for many users and remains the default recommendation. With the new configuration layout, it looks like this:

```yaml title="config.yaml"
engine:
  type: redis
  redis:
    address: localhost:6379
```

## Observability enhancements

Several useful metrics have been added to Centrifugo in v6 to improve monitoring and observability.

The first one, `centrifugo_client_connections_inflight`, shows the number of inflight connections over a specific transport. This is particularly useful when using WebSocket with fallbacks, as it allows you to easily see the percentage of users who are unable to establish a WebSocket connection.

The next metric, `centrifugo_command_errors_total`, is a counter that tracks API command errors with response code resolution.

Another counter, `centrifugo_api_command_errors_total`, helps identify which API commands return errors, including Centrifugo-specific error codes.

Asynchronous consumers now have dedicated metrics as well, allowing you to monitor the number of messages consumed by each consumer and the number of processing errors.

Centrifugo also provides metrics for the Redis broker PUB/SUB layer, such as the number of errors and the inflight buffered messages in PUB/SUB processor workers. These metrics are invaluable for monitoring the system and gaining a deeper understanding of its state.

For a full description of all available metrics in Centrifugo v6, see the [exposed metrics documentation](/docs/server/observability#exposed-metrics).

## Actualized Grafana dashboard

We understand how important it is to have a solid starting point for monitoring Centrifugo. That's why we updated our [Grafana dashboard](https://grafana.com/grafana/dashboards/13039-centrifugo/) to include all the new metrics added during the Centrifugo v5 lifecycle as well as those introduced in v6. The dashboard now features 42 panels (up from 22) for the OSS edition, providing a much better understanding of what's happening with your installation. 

We also reconsidered how rates are displayed on the dashboard. Instead of summing up rates per minute, we now display rates per second, which aligns more closely with common practices in the Prometheus ecosystem.

<img src="/img/grafana.jpg" alt="Updated Grafana dashboard for Centrifugo" />

Additionally, we've expanded the Grand Chat tutorial to include a [new chapter on integrating a Prometheus and Grafana stack](/docs/tutorial/monitoring) with the tutorial messenger application.

## Other improvements

Other improvements introduced in the v6 release include:

* The ability to set custom [TLS configurations for internal](/docs/server/configuration#internal_tls) HTTP endpoints. Previously, it was only possible to disable TLS for internal endpoints while keeping TLS for external ones.
* Added TLS support for PostgreSQL clients, including support for asynchronous consumers from PostgreSQL outbox tables, database connections, and PostgreSQL-based push notification queue clients.
* The ability to configure custom TLS settings for the proxy HTTP client.
* A new `message_size_limit` option for WebTransport, which effectively limits the maximum size of individual messages sent through a WebTransport connection.
* Improved logging for TLS configuration at the debug level during startup to help diagnose issues with TLS setups.
* Redis Cluster and Sentinel setups can now be fully configured using the Redis `address` option, with support for `redis+cluster://` and `redis+sentinel://` schemes. Previously, the `address` option only supported standalone single Redis setups. A key addition is the ability to set different Redis master names for setups reusing the same Sentinel nodes to manage different Redis shards. This approach also simplifies Redis configuration, especially for sharded setups, as each shard can be represented by a separate address string with its own Redis options in the `address` array. See the updated [Engines and Scalability](/docs/server/engines) documentation chapter.
* Refactored logging throughout the Centrifugo source code, making it more straightforward and concise. This eliminated the dependency on the [Centrifuge](https://github.com/centrifugal/centrifuge) `Node` object in many places where it was used only for logging purposes – an awkward legacy now resolved. This refactor also allowed us to utilize the `zerolog` library for the fastest way to write logs, with strictly typed log values replacing the previously used untyped field maps.
* Centrifugo users from Mayflower needed a way to determine the best Redis setup for their load profile, so we created a [simple benchmarking tool](https://github.com/centrifugal/centrifuge/tree/master/_examples/redis_benchmark) to simulate Centrifugo-specific loads on Redis.

Additionally, a significant amount of work has been done on the documentation:

* All chapters have been reviewed, and configuration samples have been updated.

Finally, we updated our official [Helm chart](https://github.com/centrifugal/helm-charts) and the [source code of the Grand Chat Tutorial](https://github.com/centrifugal/grand-chat-tutorial) to reflect the changes in v6.

## Centrifugo PRO improvements

Centrifugo PRO v6, as usual, inherits all the changes from the OSS edition. The configuration layout refactoring has also affected some parts of the Centrifugo PRO configuration. Notably, the new `defaultconfig` and `defaultenv` CLI commands work seamlessly with Centrifugo PRO as well.

Beyond the configuration layout adjustments, several improvements have been made to Centrifugo PRO features.

### Improved channel state events

In v6, we have taken a step forward with the Centrifugo PRO [channel state events](https://centrifugal.dev/docs/pro/channel_state_events) feature.

We addressed an edge case where the first `occupied` event in a channel might not be delivered due to a race condition. Additionally, the processing of the `vacated` events queue has been made more efficient.

Furthermore, if a channel state proxy is defined in a namespace, it is no longer necessary to explicitly provide an array of events to send. Once the proxy is enabled, Centrifugo PRO will send both `occupied` and `vacated` events by default.

That said, we still consider this feature to be in an alpha state.

### Dedicated PostgreSQL for push notifications queue

A dedicated PostgreSQL [push notifications](https://centrifugal.dev/docs/pro/push_notifications) queue configuration has been added in Centrifugo PRO. This means it is no longer necessary to use the same PostgreSQL instance for the push notifications queue and device management – they can now be separate.

If you are using Centrifugo push notifications solely for broadcasting pushes to known FCM/APNs/HMS tokens, without utilizing the device management API, you can avoid the creation of extra tables in PostgreSQL that Centrifugo would otherwise create for device data storage and related functionality.

### Tutorial for push notifications

We have [extended the Grand Chat tutorial](/docs/tutorial/push_notifications) to include a new appendix chapter on integrating push notifications with Centrifugo PRO. This tutorial will help you understand how to send Web push notifications to mobile devices using Centrifugo PRO and FCM. 

While the chapter is still under construction, it already includes all the necessary parts combined into a working implementation.

<video width="100%" loop={true} muted controls src="/img/grand-chat-tutorial-demo-push.mp4"></video>

### Generalized channel patterns

Centrifugo PRO enhances channel configuration with the [Channel Patterns](https://centrifugal.dev/docs/pro/channel_patterns) feature. This introduces a flexible way to model channels, similar to how developers configure routes for HTTP request processing in HTTP servers.

Previously, PRO users who wanted to use channel patterns had to completely replace the general namespaces mechanism with patterns. In v6, channel patterns can now be used alongside Centrifugo OSS namespaces.

Each channel namespace can include a `pattern` string option to designate it as a **pattern namespace**. Namespaces with patterns will only be resolved if the channel matches the defined pattern. This enables the use of patterns for some channels and simple prefix-based namespacing for others, making it much easier to transition from Centrifugo OSS to Centrifugo PRO. Channel namespace configurations can now be updated gradually.

Additionally, features that were previously unavailable for channel patterns, such as automatic personal channel subscriptions, are now accessible to PRO users. However, the channel patterns feature must still be explicitly enabled, as it is not enabled by default. This avoids introducing unintended side effects for setups transitioning to the PRO version, especially those with channels starting with `/` (used for channels without a namespace).

### Namespace resolution for metrics

Centrifugo PRO already supported channel namespace resolution for transport message sent/received metrics. This feature is very useful for setups with many namespaces, as it helps identify which namespaces consume more bandwidth.

In v6, we’ve expanded this capability by providing channel namespace resolution for all Centrifugo metrics related to channels. This enhancement offers deeper insights into how Centrifugo is being used in your setup and enables data-driven business decisions. 

For example, you can now segment metrics by channel namespace for metrics such as:

* `centrifugo_node_messages_sent_count` / `centrifugo_node_messages_received_count`
* `centrifugo_client_command_duration_seconds`
* `centrifugo_client_num_reply_errors`
* and many more

This extended visibility makes it easier to monitor, analyze, and optimize your Centrifugo setup.

### Clients and subscriptions inflight

Centrifugo PRO's ClickHouse analytics previously enabled building client connection distributions using client name and app version segmentation. This made it possible to understand how many clients from different environments – such as browsers, Android, or iOS devices – were currently connected to your Centrifugo setup. This functionality leveraged the fact that our SDKs pass the SDK name to the server and provide a way to redefine it.

In Centrifugo v6 PRO, this information is now exposed directly as part of Prometheus metrics through the `centrifugo_client_connections_inflight` gauge. To avoid cardinality issues, Centrifugo requires explicit configuration of registered client names and versions.

Additionally, Centrifugo v6 PRO introduces the `centrifugo_client_subscriptions_inflight` metric, which includes both client name and channel namespace resolution. These metrics offer valuable insights into current and historical Centrifugo usage.

While these metrics are extremely useful, the ClickHouse analytics feature still provides a deeper level of resolution for individual connections and channel subscriptions. However, the use of ClickHouse can now be deferred if these new metrics provide sufficient data to address your needs.

Moreover, the metrics mentioned above, including channel namespace resolution and inflight connections/subscriptions, are now integrated into Centrifugo's [official Grafana dashboard](https://grafana.com/grafana/dashboards/13039-centrifugo/).

### Sentry integration

The next improvement for Centrifugo PRO observability is integration with [Sentry](https://sentry.io/).

With just [a couple of lines in the configuration]((/docs/pro/observability_enhancements#sentry-integration)), you can enable this feature:

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

### Leverage Redis replicas

Some Centrifugo users have Redis setups configured with replication. This might be a Redis Sentinel-based primary-replica setup or a Redis Cluster where each shard consists of a primary and several replicas.

Centrifugo PRO v6 [enables leveraging existing replicas](/docs/pro/scalability#leverage-redis-replicas) for specific functionalities:

* **Channel subscriptions**: Move all channel subscriptions to a replica, reducing the load on the primary instance.
* **Presence information**: Read presence data from a replica, again offloading potentially slower requests from the primary.

These enhancements extend Centrifugo's scalability options and can help users optimize resource usage, potentially allowing them to maintain high performance on lower infrastructure resources.

### Redis Cluster sharded PUB/SUB

Another feature now available in Centrifugo PRO is support for sharded PUB/SUB in Redis Cluster. [Sharded PUB/SUB](https://redis.io/docs/latest/develop/interact/pubsub/#sharded-pubsub) was introduced in Redis 7.0 to address the scalability challenges of PUB/SUB in Redis Cluster. In a normal PUB/SUB setup, all publications are propagated to all nodes in the cluster, reducing throughput as more nodes are added. The utilization of Redis shards is usually unequal when using PUB/SUB in Redis Cluster as subscriptions land to one of the shards. With sharded PUB/SUB, the channel keyspace is divided into slots (similar to normal keys), and PUB/SUB operations are distributed across Redis Cluster nodes based on channel names.

#### Custom keyspace partitioning

When using Centrifugo PRO [with the sharded PUB/SUB feature](/docs/pro/scalability#redis-cluster-sharded-pubsub), several important considerations must be kept in mind. This feature changes how Centrifugo constructs keys and channel names in Redis compared to the standard non-sharded setup. Specifically, Centrifugo divides the channel space into a configurable number of "partitions," typically 64 to 128 (though this can be adjusted based on your needs).

Partitioning ensures compatibility with Redis Cluster's slot system while maintaining a manageable number of connections between Centrifugo and Redis. Each partition uses a dedicated connection for PUB/SUB communication with the Redis Cluster.

Without partitioning, each Centrifugo node could potentially create up to 16,384 connections to the Redis Cluster—one for each cluster slot—which is impractical. The partitioning strategy avoids this issue and ensures efficient and scalable communication.

#### When to Use Sharded PUB/SUB

Given implementation details mentioned, we recommend using Redis sharded PUB/SUB only if:
1. You are already using a Redis Cluster.
2. You are approaching the scalability limits of your current setup.

Switching to sharded PUB/SUB mode, despite the changes in keys and channel names in Redis, can significantly improve your system's ability to handle larger workloads.

#### Scaling Beyond a Single Redis Cluster

If you reach the scalability limits of a single Redis Cluster with sharded PUB/SUB, you can scale further by adding additional, isolated Redis Clusters. Centrifugo can be configured to use multiple clusters, enabling scaling similar to its consistent sharding mechanism over isolated single Redis instances. In this setup, sharding occurs across multiple Redis Clusters.

![redis](/img/redis_arch.png)

## What's next?

For those who are not using Tarantool or SockJS, migrating to Centrifugo v6 is primarily a matter of updating the Centrifugo server configuration.

We understand that, given the nature and number of configuration changes, this may not be straightforward. To simplify the migration process, we've prepared an automatic configuration migration tool (which supports both file and environment configuration migration). You can find more details in the [Centrifugo v6 migration guide](/docs/getting-started/migration_v6). 

The client protocol, server API protocol, and proxy event protocol have remained unchanged. Therefore, after running Centrifugo v6 with an updated configuration, you can expect zero issues with your existing integrations.

If you need assistance with the migration process or have any other Centrifugo-related questions, check out our [community channels](https://centrifugal.dev/docs/getting-started/community) for support.

We hope you enjoy the new Centrifugo! It's cleaner, simpler to extend, more developer-friendly, and comes packed with innovative features. As always, let the Centrifugal force be with you 🖲
