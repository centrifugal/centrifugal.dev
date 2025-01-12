---
id: comparisons
title: Comparing with others
---

Let's compare Centrifugo with various systems. These comparisons arose from popular questions raised in our communities. Here we are emphasizing things that make Centrifugo special.

## Centrifugo vs Socket.io

Socket.io is a library; you need to write your own server on top of it. Centrifugo is a ready-to-use standalone server.

Because of this, Socket.io may give you more flexibility, but you are mostly limited to writing code in JavaScript on the backend to get the most out of it.

Since Centrifugo is a standalone server, it's a universal, language-agnostic element that integrates well with a backend written in any language. But because it's universal, it comes with integration rules, its own mechanics, and limitations of such a design.

## Centrifugo vs Pusher, Ably, Pubnub

The main difference is that Centrifugo is a self-hosted solution, while the mentioned technologies are all cloud SaaS platforms.

So, when using Centrifugo, you need to configure and run it on your own; you need to be skilled in engineering. The benefit is obvious – it's much cheaper once the integration is done. And all the data stays within your organization.

With cloud services, all the hard work of setting up an infrastructure for a WebSocket server and its maintenance is done for you. But it's more expensive, and the data flows through an external network.

Another bonus Centrifugo may provide due to its self-hosted nature is a deaper integration with your backend with connection event hooks. During Centrifugo to backend communication the traffic stays within your network infrastructure, which means no additional costs and great latencies.

## Centrifugo vs Redis

A popular question from newcomers – does Centrifugo provide the same as Redis PUB/SUB? The answer is that Centrifugo and Redis can't be directly compared at all. Centrifugo uses Redis internally for PUB/SUB scalability, keeping channel message history, and online presence.

You can build a system similar to Centrifugo on top of Redis – but you would need to write a lot of code, i.e., replicate everything that Centrifugo provides out of the box – like real-time client SDKs, client protocol, re-implement all the transport endpoints, write efficient Redis integration, etc.

## Centrifugo vs Kafka

At first glance, Centrifugo provides concepts similar to Apache Kafka - it has channels which seem similar to Kafka's topics, channel history with time and size retention policies. So sometimes people ask whether Centrifugo may be used as a lightweight Kafka replacement.

But Centrifugo and Kafka were designed for different purposes.

Centrifugo is a real-time messaging system with push semantics. It provides a lightweight PUB/SUB with ephemeral in-memory channels, designed to be exposed to frontend real-time apps. It has limited guarantees about message persistence in channel history, though it provides client hooks to be notified about message loss and recover the state from the main application database.

Kafka is a persistent disk-based message bus that you can't easily expose to frontend users. It won't work well with millions of topics where users connect and disconnect constantly – this would cause constant repartitioning and eventually require much more resources. Kafka fits well for service-to-service communication where topics may be pre-created and under control; Centrifugo fits well for frontend-to-backend real-time communication.

## Centrifugo vs Nats

This is also a popular comparison request. Especially since both Centrifugo and Nats are written in the Go language, and Nats also supports connections from the application client side over the WebSocket protocol.

Nats is a very powerful messaging system, and it also has a built-in Jetstream system to provide at least once delivery guarantees. It has a larger community, more SDKs for various languages, incredible performance.

How Centrifugo is special:

* Centrifugo actually uses Nats as one of the options for a PUB/SUB broker, i.e., as a PUB/SUB scalability backend.
* Centrifugo was originally designed to be exposed to application frontend clients, providing various convenient authentication and channel authorization mechanisms for client-side integration.
* It supports more transports, including WebSocket fallbacks.
* It provides many unique features that are out of scope for Nats – like online presence, individual GRPC subscription streams, or some of Centrifugo PRO features like push notifications support, real-time analytics with ClickHouse, etc.
* Topics in Jetstream still should be pre-created, while Centrifugo has ephemeral channels – created on the fly, even when using a channel history cache. I.e. no need to explicitly create streams.
* Centrifugo provides client connection event proxy features - it's possible to delegate authentication, channel authorization to the application backend, and provides channel state events (when a channel is occupied or vacated) in the PRO version.

Nats is great, and we are constantly looking for tighter integration with Nats. But both systems have unique sets of features and may be better or worse for various tasks.
