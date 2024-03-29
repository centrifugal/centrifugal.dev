---
id: introduction
title: Centrifugo introduction
---

<img src="/img/logo_animated_no_accel.svg" width="100px" height="100px" align="left" style={{'marginRight': '10px', 'float': 'left'}} />

Centrifugo is an open-source scalable real-time messaging server. Centrifugo can instantly deliver messages to application online users connected over supported transports (WebSocket, HTTP-streaming, SSE/EventSource, WebTransport, GRPC, SockJS). Centrifugo has the concept of a channel – so it's a user-facing PUB/SUB server.

Centrifugo is language-agnostic and can be used to build chat apps, live comments, multiplayer games, real-time data visualizations, collaborative tools, etc. in combination with any backend. It is well suited for modern architectures and allows decoupling the business logic from the real-time transport layer.

Several official client SDKs for browser and mobile development wrap the bidirectional protocol. In addition, Centrifugo supports a unidirectional approach for simple use cases with no SDK dependency.

:::info Real-time?

By real-time, we indicate a soft real-time. Due to network latencies, garbage collection cycles, and so on, the delay of a delivered message can be up to several hundred milliseconds or higher.

:::

## Background

![](/img/bg_cat.jpg)

Centrifugo was born a decade ago to help applications with a server-side written in a language or a framework without built-in concurrency support. In this case, dealing with persistent connections is a real headache that usually can only be resolved by introducing a shift in the technology stack and spending time to create a production-ready solution.

For example, frameworks like Django, Flask, Yii, Laravel, Ruby on Rails, and others have poor or not really performant support of working with many persistent connections for the real-time messaging tasks.

In this case, Centrifugo is a straightforward and non-obtrusive way to introduce real-time updates and handle lots of persistent connections without radical changes in the application backend architecture. Developers could proceed writing the application backend with a favorite language or favorite framework, keep existing architecture – and just let Centrifugo deal with persistent connections and be a real-time messaging transport layer.

These days Centrifugo provides some advanced and unique features that can simplify a developer's life and save months of development. Even if the application backend is built with the asynchronous concurrent language. One example is that Centrifugo has built-in support for scalability to many machines to handle more connections and still making sure channel subscribers on different Centrifugo nodes receive all the publications.

Centrifugo fits well modern architectures and may be a universal real-time component regardless of the application technology stack. There are more things to mention, the documentation uncovers them step by step.
