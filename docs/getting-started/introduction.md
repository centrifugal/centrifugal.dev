---
id: introduction
title: Centrifugo introduction
---

<img src="/img/logo_animated_no_accel.svg" width="100px" height="100px" align="left" style={{'marginRight': '10px', 'float': 'left'}} />

Centrifugo is an open-source real-time messaging server. Centrifugo can instantly deliver messages to application online users connected over supported transports (WebSocket, HTTP-streaming, SSE/EventSource, WebTransport, GRPC). Centrifugo is built around channel concept – clients subscribe to channels to receive publications – so it's a user-facing PUB/SUB server.

:::tip Prefer podcast format? (22 MB)

<audio controls>
  <source src="/img/podcast-0001-introduction.wav" type="audio/wav" />
</audio>

:::

Centrifugo is language-agnostic and can be used to build chat apps, live comments, multiplayer games, real-time data visualizations, collaborative tools, AI streaming responses, etc., in combination with any backend and frontend. It is well suited for modern architectures and allows decoupling of business logic from the real-time transport layer.

Centrifugo scales horizontally, allowing multiple Centrifugo nodes in a cluster to load balance client connections. A message published to any Centrifugo node in this setup will be delivered to online subscribers connected to other nodes. This is achieved through an integration with a set of high-performance PUB/SUB brokers capable of handling millions of concurrent channels.

Several official SDKs for browser and mobile development wrap the bidirectional client-to-server protocol, offering a straightforward API for real-time subscriptions multiplexed over a single connection. These SDKs handle reconnects, manage ping-pong, timeouts, and deal with other complexities of working with real-time connections. Additionally, Centrifugo supports a unidirectional approach for simple use cases with no SDK dependency.

:::info Real-time?

By real-time, we refer to a soft real-time system. This means there are no strict latency timing constraints. Centrifugo does its best to minimize delivery delays, but due to factors like network latencies, garbage collection cycles, and so on, those can't be guaranteed.

:::

## Background and motivation

![](/img/bg_cat.jpg)

Centrifugo was born more than a decade ago to help applications whose server-side code was written in a language or framework lacking built-in concurrency support. In such cases, managing persistent connections can be a real headache, usually resolvable only by altering the technology stack and investing time in developing a production-ready solution.

For instance, frameworks like Django, Flask, Yii, Laravel, Ruby on Rails, and others offer limited or suboptimal support for handling numerous persistent connections for real-time messaging tasks.

Here, Centrifugo provides a straightforward and non-obtrusive way to introduce real-time updates and manage many persistent connections without radical changes in the application backend architecture. Developers can continue to work on the application's backend using their preferred language or framework, and keep the existing architecture. Just let Centrifugo deal with persistent connections and be the real-time messaging transport layer.

These days, Centrifugo offers advanced and unique features that can significantly simplify a developer's workload and save months (if not years) of development time, even if the application's backend is built with an asynchronous concurrent language or framework. The documentation uncovers features step by step.

Centrifugo fits well with modern architectures and can serve as a universal real-time component, regardless of the application's technology stack. It stands as a powerful self-hosted alternative to cloud solutions like Pusher, Ably, or PubNub.
