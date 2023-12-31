---
id: introduction
title: Centrifugo introduction
---

<img src="/img/logo_animated_no_accel.svg" width="100px" height="100px" align="left" style={{'marginRight': '10px', 'float': 'left'}} />

Centrifugo is an open-source scalable real-time messaging server. Centrifugo can instantly deliver messages to application online users connected over supported transports (WebSocket, HTTP-streaming, SSE/EventSource, WebTransport, GRPC, SockJS). Centrifugo has the concept of a channel – so it's a user-facing PUB/SUB server.

Centrifugo is language-agnostic and can be used to build chat apps, live comments, multiplayer games, real-time data visualizations, collaborative tools, etc., in combination with any backend. It is well suited for modern architectures and allows decoupling of business logic from the real-time transport layer.

Several official client SDKs for browser and mobile development wrap the bidirectional protocol. In addition, Centrifugo supports a unidirectional approach for simple use cases with no SDK dependency.

:::info Real-time?

By real-time, we mean a soft real-time. Due to network latencies, garbage collection cycles, etc., the delay of a delivered message can be up to several hundred milliseconds or higher.

:::

## Background and motivation

![](/img/bg_cat.jpg)

Centrifugo was born more than a decade ago to help applications whose server-side code was written in a language or framework lacking built-in concurrency support. In such cases, managing persistent connections can be a real headache, usually resolvable only by altering the technology stack and investing time in developing a production-ready solution.

For instance, frameworks like Django, Flask, Yii, Laravel, Ruby on Rails, and others offer limited or suboptimal support for handling numerous persistent connections for real-time messaging tasks.

Here, Centrifugo provides a straightforward and non-obtrusive way to introduce real-time updates and manage many persistent connections without radical changes in the application backend architecture. Developers can continue to work on the application's backend using their preferred language or framework, and keep the existing architecture. Just let Centrifugo deal with persistent connections and be the real-time messaging transport layer.

These days, Centrifugo offers advanced and unique features that can significantly simplify a developer's workload and save months (if not years) of development time, even if the application's backend is built with an asynchronous concurrent language or framework. One example is Centrifugo's built-in support for scaling across numerous machines to accommodate more connections while ensuring that channel subscribers on different Centrifugo nodes receive all publications. Or the fact that Centrifugo has a bunch of real-time SDKs which provide subscription multiplexing over a WebSocket connection, robust reconnect logic, built-in ping-pong, etc. And there are more things to mention: the documentation uncovers features step by step.

Centrifugo fits well with modern architectures and can serve as a universal real-time component, regardless of the application's technology stack. It stands as a viable self-hosted alternative to cloud solutions like Pusher, Ably, or PubNub.
