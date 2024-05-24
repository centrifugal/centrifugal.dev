---
id: highlights
title: Main highlights
---

At this point, you know how to build the simplest real-time app with Centrifugo. Beyond the core PUB/SUB functionality, Centrifugo provides more features and primitives to build scalable real-time applications. Let's summarize the main Centrifugo ✨highlights✨ here. Every point is then extended throughout the documentation.

### Seamless integration

Centrifugo was originally designed to be used in conjunction with frameworks without built-in concurrency support (like Django, Laravel, etc.).

It works as a standalone service with well-defined communication contracts. It nicely fits both monolithic and microservice architectures. Application developers should not change the backend philosophy and technology stack at all – just integrate with Centrifugo [HTTP or GRPC API](../server/server_api.md) and let users enjoy real-time updates.

### Great performance

Centrifugo is fast. It's written in the Go language, built on top of fast and battle-tested open-source libraries, has some smart internal optimizations like message queuing on broadcasts, smart batching to reduce the number of RTTs with the broker, connection hub sharding to avoid lock contention, JSON and Protobuf encoding speedups through code generation, and others.

See the [Million WebSocket with Centrifugo](/blog/2020/02/10/million-connections-with-centrifugo) post on our blog to see some real-world numbers.

### Built-in scalability

Centrifugo scales well to many machines with the help of PUB/SUB brokers. So as soon as you have more client connections in the application – you can spread them over different Centrifugo nodes which will be connected together into a cluster.

The main PUB/SUB engine that Centrifugo integrates with is Redis. It supports client-side consistent sharding and Redis Cluster – so a single Redis instance won't be a bottleneck either.

There are other options to scale: KeyDB, Nats, Tarantool. [See docs about available engines](../server/engines.md).

### Strict client protocol

Centrifugo supports JSON and binary Protobuf protocols for client-server communication. The bidirectional protocol is defined by a strict schema and several ready-to-use SDKs wrap this protocol, handle asynchronous message passing, timeouts, reconnects, and various Centrifugo client API features. See detailed information about client real-time transports in a [dedicated section](../transports/overview.md).

### Variety of real-time transports

The main transport in Centrifugo is WebSocket. For web browsers with non-working WebSocket connection, Centrifugo provides its own bidirectional WebSocket emulation layer based on HTTP-streaming (using Fetch and Readable streams browser APIs) and SSE (EventSource). Additionally, WebTransport is supported in an experimental form.

In addition to bidirectional transports, Centrifugo also supports a unidirectional approach for real-time updates: using SSE (EventSource), HTTP-streaming, and GRPC unidirectional stream. Utilizing a unidirectional transport is sufficient for many real-time applications and does not require using our client SDKs – just native standards or GRPC-generated code.

See detailed information about client real-time transports in a [dedicated section](../transports/overview.md).

### Flexible authentication

Centrifugo can authenticate connections by checking [JWT (JSON Web Token)](../server/authentication.md) or by [issuing an HTTP/GRPC](../server/proxy.md) request to your application backend upon a client connection to Centrifugo. It's possible to proxy original request headers or request metadata (in the case of a GRPC connection).

It supports the [JWK specification](https://datatracker.ietf.org/doc/html/rfc7517).

### Connection management

Connections can expire; developers can choose a way to handle connection refresh – using a client-side refresh workflow or a server-side call from Centrifugo to the application backend. Centrifugo provides APIs to disconnect users, unsubscribe users from channels, and inspect active channels. On the client side our SDKs automatically handle reconnections with backoff strategy, and even re-subscriptions with backoff to not disrupt the entire connection on individual subscription request temporary failure.

### Channel (room) concept

Centrifugo is a PUB/SUB server – users subscribe to [channels](../server/channels.md) to receive real-time updates. A message sent to a channel is delivered to all online channel subscribers.

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

Centrifugo works on Linux, MacOS, and Windows.

### Ready to deploy

Centrifugo supports various deployment methods: in Docker, using prepared RPM or DEB packages, via a Kubernetes Helm chart. It supports automatic TLS with Let's Encrypt TLS, outputs Prometheus/Graphite metrics, and has an official Grafana dashboard for the Prometheus data source - read more about [observability](../server/observability.md).

### Open-source

Centrifugo stands on top of the open-source library [Centrifuge](https://github.com/centrifugal/centrifuge) (MIT license). The OSS version of Centrifugo is based on the permissive open-source license (Apache 2.0). All our official client SDKs and API libraries are MIT-licensed.

### PRO features

Centrifugo PRO extends Centrifugo with several unique features which can provide interesting advantages for business adopters. Some amazing features include into PRO version:

* push notifications API – to send mobile and browser pushes over FCM, APNs, HMS
* real-time analytics with ClickHouse for more insights about your real-time ecosystem
* performance optimizations to reduce resource usage and thus reducing overall costs
* many more, refer to the [Centrifugo PRO documentation](../pro/overview.md).
