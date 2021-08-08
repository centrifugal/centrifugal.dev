---
id: highlights
title: Main highlights
---

Here is a list with main Centrifugo ✨highlights✨. Every point is then extended throughout documentation.

### Simple integration

Since Centrifugo originally designed to be used in conjunction with frameworks without builtin concurrency support (like Django, Laravel etc.) it works as a standalone service with well-defined communication contracts. It fits very well both monolithic and microservice architecture. Application developers should not change backend philosophy at all – just integrate with Centrifugo HTTP or GRPC API and let users enjoy real-time updates. 

### Great performance

Centrifugo is pretty fast. It's written in Go language, uses fast open-source libraries internally, has some internal optimizations like message queuing on broadcasts, smart batching to reduce number of RTT with broker, connection hub sharding to avoid contention, JSON and Protobuf encoding speedups over code generation and other.

See a [Million WebSocket with Centrifugo](/blog/2020/02/10/million-connections-with-centrifugo) post in our blog to see some real-world numbers.

### Built-in scalability

Centrifugo can scale to many nodes with a help of PUB/SUB brokers. The main PUB/SUB engine Centrifugo integrates with is Redis. It supports client-side consistent sharding and Redis Cluster support so single Redis instance won't be a bottleneck. There are other options to scale: like KeyDB, Nats, Tarantool.

### Strict client protocol

Centrifugo supports JSON and binary Protobuf protocol for client-server communication. Bidirectional protocol is defined by strict schema and there are several ready to use connectors that wrap this protocol, handle asynchronous message passing, timeouts, reconnect and various Centrifugo client API features.

### Variety of real-time transports

The main transport in Centrifugo is WebSocket. It's a bidirectional transport on top of TCP with low-overhead. For browsers which do not support WebSocket Centrifugo provides SockJS support.

Centrifugo v3 also introduced support for unidirectional transports for real-time updates: like SSE (EventSource), HTTP streaming, GRPC unidirectional stream. Using unidirectional transport is sufficient for many real-time applications and does not require using custom client connectors – just native APIs or GRPC-generated code.

### Flexible authentication

Centrifugo can authenticate connections using JWT (JSON Web Tokens) or by issuing a HTTP/GRPC request to your application backend upon connection attempt. It's possible to proxy original request headers or request metadata (in case of GRPC connection). It supports JWK specification.

### Connection management

Connections can expire, developers can choose a way on how to handle connection refresh – using client-side refresh workflow, or server-side call from Centrifugo to backend. 

### Channel (room) concept

Centrifugo is PUB/SUB server – users subscribe to channels to receive real-time updates. Message sent to a channel will be delivered to all active subscribers.

There are several different types of channels to deal with permissions. 

### Different types of subscriptions

Centrifugo is unique in terms of the fact it supports both client-side and server-side channel subscriptions.

### RPC over bidirectional connection

You can fully utilize bidirectional persistent connections by sending RPC calls from client side to a configured endpoint on your backend. Calling RPC over WebSocket avoids sending headers on each request thus reducing external traffic. 

### Presence information

It's possible to turn on presence feature for channels so you will have an information about active channels subscribers. Channel join and leave events (when user subscribes/unsubscribes) can also be sent.

### Message history in channels

Optionally Centrifugo allows turning on history for publications in channels. This publication history has a limited size and retention period (TTL). With this history Centrifugo can help to survive mass reconnect scenario, clients can automatically recover missed messages from a cache thus reducing load on your main database. It's also possible to manually iterate over stream from a client or a server side.

### Embedded admin web UI

Built-in administrative web UI allows publishing messages to channels, looking at Centrifugo cluster state, monitoring stats etc.

### Cross-platform

Centrifugo works on Linux, MacOS and Windows.

### Ready to deploy

Centrifugo supports various deploy ways: in Docker, using prepared RPM or DEB packages, via Kubernetes Helm chart. It supports automatic TLS with Let's Encrypt TLS, outputs Prometheus/Graphite metrics, has official Grafana dashboard for Prometheus data source.

### Open-source

Centrifugo is built on top of open-source library Centrifuge (MIT license), the OSS version of Centrifugo is based on permissive open-source license (Apache 2.0). All client connectors are also MIT-licensed.

### Pro features

Centrifugo PRO extends Centrifugo with several unique features which can give interesting advantages for business adopters. 

With Centrifugo Pro it's possible to trace specific user or specific channel events in real-time. Centrifugo Pro integrates with ClickHouse for real-time connection analytics. This all may help with understanding client behavior, inspect and analyze an application on a very granular level.

Centrifugo Pro offers even more extensions tend to be useful on practice. This includes user active status and throttling features. Active status is useful to build messenger-like applications where you want to show online indicators of users based on last activity time, throttling can help you limit number of operations each user may execute on Centrifugo cluster.

For additional details, refer to the [Centrifugo PRO documentation](../pro/overview.md). 
