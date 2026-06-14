---
description: "Centrifugo key features: scalable real-time messaging, WebSocket and SSE transports, JWT authentication, channel history, presence, delta compression, and more."
id: highlights
title: Main highlights
---

At this point, you know how to build the simplest real-time app with Centrifugo. We also provide [a more advanced tutorial](../tutorial/intro.md) which you can refer to when working with Centrifugo.

Beyond core PUB/SUB messaging, Centrifugo provides primitives for real-time state synchronization and more to build scalable real-time applications. Let's summarize the main Centrifugo highlights here. Every point is extended throughout the documentation.

### Integration

Centrifugo is a standalone service with well-defined communication contracts. It integrates with your existing backend via [HTTP or GRPC API](../server/server_api.md), or via [built-in asynchronous consumers](../server/consumers.md). It works regardless of the backend language or framework and supports both monolithic and microservice architectures without requiring changes to your existing code structure.

### Performance

Centrifugo is written in Go and built on battle-tested open-source libraries. Various optimizations are applied to handle real-time communication at scale:

* Message queuing for broadcasts — efficient distribution to large numbers of subscribers
* Batching on all levels — reduces round-trip counts and system call overhead
* Subscription hub sharding — reduces lock contention under heavy load
* Optimized encoding — JSON and Protobuf with code generation for faster serialization
* And many more.

See real-world benchmarks in the [Million WebSocket with Centrifugo](/blog/2020/02/10/million-connections-with-centrifugo) blog post.

### Scalability

Centrifugo scales horizontally across multiple nodes connected into a cluster. Publishing a message to a channel on any node delivers it to all subscribers across the cluster via a PUB/SUB broker.

The primary broker is Redis, with support for client-side consistent sharding and Redis Cluster. Redis-compatible databases (Valkey, AWS ElastiCache, Google Memorystore, KeyDB, DragonflyDB) and NATS are also supported.

The [PostgreSQL broker](../server/engines.md#postgresql-broker) is an alternative for teams already running PostgreSQL who want to eliminate Redis as a dependency. It implements stream and map subscription storage on PostgreSQL and enables transactional publishing — `cf_stream_publish` or `cf_map_publish` called inside your own SQL transaction commits the real-time event atomically with your business write, eliminating the dual-write problem. Requires PostgreSQL 16 or later.

See [engines documentation](../server/engines.md).

### Variety of real-time transports

The primary transport is WebSocket. For environments where WebSocket is unavailable, Centrifugo provides a bidirectional emulation layer using HTTP streaming (Fetch and Readable Streams API) and SSE (EventSource). WebTransport is supported experimentally.

For applications that only need server-to-client updates, Centrifugo supports unidirectional transports: SSE, HTTP streaming, and GRPC unidirectional streams. These work with native browser APIs or GRPC-generated code without requiring Centrifugo client SDKs.

See [transports overview](../transports/overview.md).

### Strict client protocol

Centrifugo supports JSON and binary Protobuf protocols for client-server communication. The bidirectional protocol has a strict schema. Client SDKs wrap the protocol and handle asynchronous message passing, subscription multiplexing, timeouts, reconnects, and the full client API.

### Client SDKs and backend integrations

Official real-time SDKs cover web and mobile — [JavaScript, Go, Dart/Flutter, Swift, Java, Python, and C# (WIP)](../transports/client_sdk.md) — wrapping the protocol and handling reconnects, resubscriptions, and message recovery. On the backend, [framework integrations](./ecosystem.md) provide a native experience for Laravel, Symfony, Django, and others.

### Flexible authentication

Centrifugo authenticates connections via [JWT](../server/authentication.md) or by making an [HTTP/GRPC request](../server/proxy.md) to your backend on client connect. Original request headers or GRPC metadata can be proxied. [JWK](https://datatracker.ietf.org/doc/html/rfc7517) is supported for rotating JWT signing keys.

### Channel authorization

Beyond connection authentication, Centrifugo controls what each client may do **per channel** — subscribe, publish, read history, and query presence. Permissions come from namespace configuration, a connection JWT, a subscribe proxy response, or a dedicated [subscription token](../server/channel_token_auth.md). See the [channel permission model](../server/channel_permissions.md).

### Connection management

Connections can expire with a configurable refresh workflow — either client-side or via a server-side call to your backend. Centrifugo provides APIs to disconnect users, unsubscribe users from channels, and inspect active channels. Client SDKs handle reconnection and re-subscription with backoff automatically.

### Channel concept

Centrifugo is a PUB/SUB server — clients subscribe to [channels](../server/channels.md) to receive real-time updates. A message published to a channel is delivered to all online subscribers. Channel subscriptions can be authorized via individual JWTs or configuration-based rules.

### Rich subscription mechanics

**Stream subscriptions** are the standard type — ordered publications delivered to all channel subscribers. Subscriptions can be initiated by the client or [forced by the server](../server/server_subs.md). They support optional [history with recovery](../server/history_and_recovery.md): clients catch up on missed messages after a reconnect from a fast in-memory cache, without hitting the primary database. A [cache recovery mode](../server/cache_recovery.md) is also available, where the latest publication is delivered immediately on subscribe or resubscribe — useful when a channel represents a single piece of state rather than an event stream.

**Map subscriptions** are Centrifugo's real-time state synchronization primitive — a real-time key-value collection managed by Centrifugo. Clients receive a full snapshot on subscribe, catch up after disconnects, and receive incremental per-key updates as they happen. The application does not need a separate "fetch initial state" endpoint or reconciliation logic between an HTTP read and a live stream. See [map subscriptions](../server/map_subscriptions.md).

**Proxy subscription streams** allow the backend to push data to a client channel subscription individually over a GRPC stream, established on demand when the client subscribes. This is useful for integrating with third-party streaming sources (log systems, market data feeds, MQTT brokers) or for generating per-client streams that are torn down when the client unsubscribes. Centrifugo acts as a WebSocket-to-GRPC (or SSE-to-GRPC, WebTransport-to-GRPC) proxy, multiplexing many client connections over a pool of HTTP/2 connections to the backend. See [proxy subscription streams](../server/proxy_streams.md).

**Shared poll subscriptions** move polling from clients to Centrifugo. Clients track specific keys over a single subscription; Centrifugo polls the backend once per interval, collects current values, and fans out only the changes. Backend load depends on the number of unique tracked items rather than the number of connected clients — suitable for vote counts, prices, scores, or any data where delivery within a polling interval is acceptable. See [shared poll](../server/shared_poll.md).

### Delta compression

[Delta compression](../server/delta_compression.md) reduces bandwidth by sending only the diff between consecutive publications rather than full payloads. Centrifugo applies it where supported — the details of which subscription types and SDKs have support are covered in the dedicated documentation.

### Publication filtering

Clients can subscribe to a channel with a filter so the server delivers only publications whose tags match the requested criteria — reducing bandwidth and client-side processing. See [publication filtering](../server/publication_filtering.md).

### RPC over bidirectional connection

Clients can send RPC calls over a bidirectional connection to a configured backend endpoint. This avoids sending HTTP headers on each request, reducing incoming traffic compared to individual HTTP calls.

### Online presence

The presence feature provides information about active channel subscribers. Join and leave events (subscribe/unsubscribe) can also be delivered to clients in real time.

### Embedded admin web UI

The [admin UI](../server/admin_web.md) allows publishing messages to channels, inspecting cluster state, and more.

### Asynchronous event consumers

Beyond the synchronous HTTP/GRPC API, Centrifugo can consume API commands asynchronously from external queues and storages — a [PostgreSQL outbox table](../server/consumers.md#postgresql-outbox-consumer), Kafka, NATS JetStream, Redis Streams, Google Cloud Pub/Sub, AWS SQS, and Azure Service Bus. This enables reliable real-time event delivery tied to your database writes without writing a custom worker. See [async consumers](../server/consumers.md).

### Cross-platform

Centrifugo runs on Linux, macOS, and Windows.

### Configuration and operations

Centrifugo is configured via a single file (JSON, YAML, or TOML), environment variables, or command-line flags. Console commands assist operations — `genconfig`, `checkconfig`, `gentoken`, and others for generating and validating configuration and tokens. See [configuration](../server/configuration.md) and [console commands](../server/console_commands.md).

### Deployment

Centrifugo supports Docker, RPM/DEB packages, and a Kubernetes Helm chart. It handles automatic TLS via Let's Encrypt, exposes Prometheus and Graphite metrics, and includes an official Grafana dashboard. See [observability docs](../server/observability.md).

### Open-source

Centrifugo OSS edition is built on top of the [Centrifuge](https://github.com/centrifugal/centrifuge) library (MIT license) and is itself Apache 2.0 licensed. All official client SDKs and API libraries are MIT licensed.

### PRO features

[Centrifugo PRO](../pro/overview.md) extends the open-source version with capabilities aimed at corporate and enterprise environments — for example a push notifications API (FCM/APNs/HMS/WebPush), real-time analytics with ClickHouse, connection tracing, a user status API, and performance, compression, and scalability optimizations. See the [full PRO overview](../pro/overview.md) for the complete list.
