---
description: "Centrifugo key features: scalable real-time messaging, WebSocket and SSE transports, JWT authentication, channel history, presence, delta compression, and more."
id: highlights
title: Main highlights
---

At this point, you know how to build the simplest real-time app with Centrifugo. We also provide [a mode advanced tutorial](../tutorial/intro.md) which you can refer to when working with Centrifugo.

Beyond the core PUB/SUB functionality, Centrifugo provides more features and primitives to build scalable real-time applications. Let's summarize the main Centrifugo ✨highlights✨ here. Every point is then extended throughout the documentation.

### Seamless integration

Centrifugo is purpose-built to integrate effortlessly with your existing backend, regardless of its architecture or concurrency model. Whether you're using frameworks like Django, Laravel, or others with or without native concurrency support, Centrifugo slides right in without disrupting your workflow.

Designed as a standalone service with clear and well-defined communication contracts, Centrifugo seamlessly supports both monolithic and microservice architectures. You don’t need to rethink your backend philosophy, rewrite your codebase, or adopt new paradigms.

Simply connect your application to Centrifugo via its [HTTP or GRPC API](../server/server_api.md), or [built-in asynchronous consumers](../server/consumers.md) and let your users enjoy real-time updates.

### Great performance

Centrifugo is engineered for exceptional speed and efficiency, leveraging the power of the Go programming language and built on top of battle-tested open-source libraries. Its architecture incorporates smart optimizations to handle real-time communication at scale. To name some:

* Message queuing for broadcasts: ensures efficient distribution of messages to large numbers of subscribers.
* Intelligent batching on all levels: to minimize the number of Round-Trip Times (RTTs) and the number of system calls.
* Subscription hub sharding: reduces lock contention for smoother performance under heavy loads.
* Optimized encoding: Utilizes JSON and Protobuf encoding with code generation for faster serialization.
* And more!

These optimizations, combined with Go's natural concurrency strengths, allow Centrifugo to deliver unmatched real-time performance.

Check out our blog post, [Million WebSocket with Centrifugo](/blog/2020/02/10/million-connections-with-centrifugo), to explore real-world benchmarks and performance numbers. 🚀

### Built-in scalability

Centrifugo is designed to scale well across multiple machines using PUB/SUB brokers. As your application grows and the number of client connections increases, Centrifugo allows you to distribute the load across multiple nodes, which are connected into a cluster.

With Centrifugo, you can easily scale horizontally by adding more nodes to your cluster. Once you publish message to a channel over some Centrifugo node – it will be delivered to all subscribers across the cluster.

At the core of this scalability lies Redis, Centrifugo's primary PUB/SUB engine. Redis supports client-side consistent sharding and Redis Cluster, ensuring that no single Redis instance becomes a bottleneck—even under heavy loads.

But Redis isn’t the only option. Centrifugo also supports Redis-compatible databases (Valkey, AWS Elasticache, Google Memorystore, KeyDB, DragonflyDB, etc.) and Nats, giving you the flexibility to choose the engine that best fits your infrastructure. 👉 [See dedicated docs](../server/engines.md).

### Variety of real-time transports

The main transport in Centrifugo is WebSocket. For web browsers with non-working WebSocket connection, Centrifugo provides its own bidirectional WebSocket emulation layer based on HTTP-streaming (using Fetch and Readable streams browser APIs) and SSE (EventSource). Additionally, WebTransport is supported in an experimental form.

In addition to bidirectional transports, Centrifugo also supports a unidirectional approach for real-time updates: using SSE (EventSource), HTTP-streaming, and GRPC unidirectional stream. Utilizing unidirectional transport is sufficient for many real-time applications and does not require using our client SDKs – just native standards or GRPC-generated code.

See detailed information about client real-time transports in a [dedicated section](../transports/overview.md).

### Strict client protocol

Centrifugo supports JSON and binary Protobuf protocols for client-server communication. The bidirectional protocol is defined by a strict schema and several ready-to-use SDKs wrap this protocol, handle asynchronous message passing, channel subscription multiplexing, timeouts, reconnects, and various Centrifugo client API features. See detailed information about client real-time transports in a [dedicated section](../transports/overview.md).

### Flexible authentication

Centrifugo can authenticate connections by checking [JWT (JSON Web Token)](../server/authentication.md) or by [issuing an HTTP/GRPC](../server/proxy.md) request to your application backend upon a client connection to Centrifugo. It's possible to proxy original request headers or request metadata (in the case of a GRPC connection).

Centrifugo supports the [JWK specification](https://datatracker.ietf.org/doc/html/rfc7517) which solves the problem of rotating JWT secret keys.

### Connection management

Connections can expire; developers can choose a way to handle connection refresh – using a client-side refresh workflow or a server-side call from Centrifugo to the application backend. Centrifugo provides APIs to disconnect users, unsubscribe users from channels, and inspect active channels. On the client side our SDKs automatically handle reconnections with backoff strategy, and even re-subscriptions with backoff to not disrupt the entire connection on individual subscription request temporary failure.

### Channel (room) concept

Centrifugo is a PUB/SUB server – users subscribe to [channels](../server/channels.md) to receive real-time updates. A message sent to a channel is delivered to all online channel subscribers.

Subscriptions to channels may be authorized in different ways, including individual JWT or based on configuration rules.

### Different types of subscriptions

Centrifugo supports client-side (initiated by the client) and [server-side](../server/server_subs.md) (forced by the server) channel subscriptions.

### Message history in channels

Optionally, Centrifugo allows turning on history for publications in channels. This publication history has a limited size and retention period (TTL). With channel history, Centrifugo can help to survive the mass reconnect scenario – clients can automatically catch up on missed state from a fast cache thus reducing the load on your primary database. It's also possible to manually iterate over a history stream from the client or from the application backend side. See [history and recovery](../server/history_and_recovery.md) and also a special [cache recovery mode](../server/cache_recovery.md) which allows using Centrifugo as a real-time key-value cache.

### Delta compression

[Delta compression](../server/delta_compression.md) feature may help reducing bandwidth costs significantly if you publish similar messages.

### RPC over bidirectional connection

You can fully utilize bidirectional connections by sending RPC calls from the client-side to a configured endpoint on your backend. Calling RPC over WebSocket avoids sending headers on each request – thus reducing incoming traffic.

### Online presence information

The online presence feature for channels provides information about active channel subscribers. Also, channel join and leave events (when someone subscribes/unsubscribes) can be received on the client side.

### Embedded admin web UI

The built-in [admin UI](../server/admin_web.md) allows publishing messages to channels, looking at Centrifugo cluster information, and more.

### Cross-platform

Centrifugo works on Linux, macOS, and Windows.

### Ready to deploy

Centrifugo supports various deployment methods: in Docker, using prepared RPM or DEB packages, via a Kubernetes Helm chart. It supports automatic TLS with Let's Encrypt TLS, outputs Prometheus/Graphite metrics, and has an official Grafana dashboard for the Prometheus data source - read more about [observability](../server/observability.md).

### Open-source

Centrifugo stands on top of the open-source library [Centrifuge](https://github.com/centrifugal/centrifuge) (MIT license). The OSS version of Centrifugo is based on the permissive open-source license (Apache 2.0). All our official client SDKs and API libraries are MIT-licensed.

### PRO features

Centrifugo PRO extends Centrifugo with several unique features which can provide interesting advantages for business adopters. Some amazing features include into PRO version:

* push notifications API – to send mobile and browser pushes over FCM, APNs, HMS
* real-time analytics with ClickHouse for more insights about your real-time ecosystem
* performance, compression, scalability optimizations to reduce resource usage and thus reducing overall costs
* and many more, refer to the [Centrifugo PRO documentation](../pro/overview.md).
