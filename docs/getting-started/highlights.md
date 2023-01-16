---
id: highlights
title: Main highlights
---

At this point you know how to build the simplest real-time app with Centrifugo. Beyond the core PUB/SUB functionality Centrifugo provides more features and primitives to build scalable real-time applications. Let's summarize main Centrifugo ✨highlights✨ here. Every point is then extended throughout the documentation.

### Simple integration

Centrifugo was originally designed to be used in conjunction with frameworks without built-in concurrency support (like Django, Laravel, etc.).

It works as a standalone service with well-defined communication contracts. It fits very well in both monolithic and microservice architecture. Application developers should not change backend philosophy at all – just integrate with Centrifugo [HTTP or GRPC API](../server/server_api.md) and let users enjoy real-time updates.

### Great performance

Centrifugo is fast. It's written in Go language, built on top of fast and battle-tested open-source libraries, has some smart internal optimizations like message queuing on broadcasts, smart batching to reduce the number of RTT with broker, connection hub sharding to avoid lock contention, JSON and Protobuf encoding speedups over code generation and other.

See a [Million WebSocket with Centrifugo](/blog/2020/02/10/million-connections-with-centrifugo) post in our blog to see some real-world numbers.

### Built-in scalability

Centrifugo scales well to many machines with a help of PUB/SUB brokers. So as soon as you have more client connections in the application – you can spread them over different Centrifugo nodes which will be connected together into a cluster.

The main PUB/SUB engine Centrifugo integrates with is Redis. It supports client-side consistent sharding and Redis Cluster – so a single Redis instance won't be a bottleneck also.

There are other options to scale: KeyDB, Nats, Tarantool. [See docs](../server/engines.md).

### Strict client protocol

Centrifugo supports JSON and binary Protobuf protocol for client-server communication. The bidirectional protocol is defined by a strict schema and several ready-to-use SDKs wrap this protocol, handle asynchronous message passing, timeouts, reconnects, and various Centrifugo client API features. See the detailed information about client real-time transports in a [dedicated section](../transports/overview.md).

### Variety of real-time transports

The main transport in Centrifugo is WebSocket. For browsers that do not support WebSocket Centrifugo provides its own bidirectional WebSocket emulation layer based on HTTP-streaming and SSE (EventSource), and also supports SockJS as an older but battle-tested WebSocket polyfill option, and WebTransport in experimental form.

Centrifugo also supports unidirectional transports for real-time updates: like SSE (EventSource), HTTP streaming, GRPC unidirectional stream. Using unidirectional transport is sufficient for many real-time applications and does not require using our client SDKs – just native standards or GRPC-generated code.

See the detailed information about client real-time transports in a [dedicated section](../transports/overview.md).

### Flexible authentication

Centrifugo can authenticate connections using [JWT (JSON Web Token)](../server/authentication.md) or by [issuing an HTTP/GRPC](../server/proxy.md) request to your application backend upon client connection to Centrifugo. It's possible to proxy original request headers or request metadata (in the case of GRPC connection).

It supports the [JWK specification](https://datatracker.ietf.org/doc/html/rfc7517).

### Connection management

Connections can expire, developers can choose a way to handle connection refresh – using a client-side refresh workflow, or a server-side call from Centrifugo to the application backend.

### Channel (room) concept

Centrifugo is a PUB/SUB server – users subscribe on channels to receive real-time updates. Message sent to a channel is delivered to all online channel subscribers.

### Different types of subscriptions

Centrifugo supports client-side (initiated by a client) and [server-side](../server/server_subs.md) (forced by a server) channel subscriptions.

### RPC over bidirectional connection

You can fully utilize bidirectional connections by sending RPC calls from the client-side to a configured endpoint on your backend. Calling RPC over WebSocket avoids sending headers on each request – thus reducing external traffic and, in most cases, provides better latency characteristics.

### Online presence information

Online presence feature for channels provides information about active channel subscribers. Also, channel join and leave events (when someone subscribes/unsubscribes) can be received on the client side.

### Message history in channels

Optionally Centrifugo allows turning on history for publications in channels. This publication history has a limited size and retention period (TTL). With a channel history, Centrifugo can help to survive the mass reconnect scenario – clients can automatically catch up missed state from a fast cache thus reducing the load on your primary database. It's also possible to manually iterate over a stream from a client or a server-side.

### Embedded admin web UI

Built-in [admin UI](../server/admin_web.md) allows publishing messages to channels, look at Centrifugo cluster information, and more.

### Cross-platform

Centrifugo works on Linux, macOS, and Windows.

### Ready to deploy

Centrifugo supports various deploy ways: in Docker, using prepared RPM or DEB packages, via Kubernetes Helm chart. It supports automatic TLS with Let's Encrypt TLS, outputs Prometheus/Graphite metrics, has an official Grafana dashboard for Prometheus data source.

### Open-source

Centrifugo stands on top of open-source library Centrifuge (MIT license). The OSS version of Centrifugo is based on the permissive open-source license (Apache 2.0). All our official client SDKs and API libraries are MIT-licensed.

### Pro features

Centrifugo PRO extends Centrifugo with several unique features which can give interesting advantages for business adopters. For additional details, refer to the [Centrifugo PRO documentation](../pro/overview.md).
