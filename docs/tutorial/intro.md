---
id: intro
sidebar_label: "Real-time app from scratch"
title: "Building WebSocket chat (messenger) app from scratch"
---

In this tutorial, we show how to build a rather complex real-time application with Centrifugo. It features a modern and responsive frontend, user authentication, channel permission checks, and the main database as a source of truth.

The app we build here is a WebSocket chat called **GrandChat**. The internet is full of chat tutorials, but we promise – here, we go beyond the usual basics. GrandChat is not just a set of isolated chat rooms but more like a messenger application, a simplified version of Discord, Telegram, or Slack. Here is a short demo of our final result:

<video width="100%" loop={true} autoPlay="autoplay" muted controls src="/img/grand-chat-tutorial-demo.mp4"></video>

Note that we have a real-time synchronization across the app – room membership events and room messages are sent in real-time. Our design allows users to be subscribed to many rooms and receive updates from all of them within one screen. To achieve this in a scalable way we use individual channel for each application user. We will show how the app scales when there are thousands of room members to prove that with almost no additional effort it may scale to the size comparable to the largest Slack messenger installations with reasonable latency properties.

## Application tech stack

Centrifugo is completely agnostic to the technology stack, seamlessly integrating with any frontend or backend technologies. However, for the purpose of this tutorial, we needed to choose specific technologies to illustrate the entire process of building a real-time WebSocket app:

* On the frontend, we utilize [React](https://react.dev/) and [Typescript](https://www.typescriptlang.org/), with a help of the tooling provided by [Vite](https://vitejs.dev/). The frontend is designed as a Single-Page Application (SPA) that communicates with the backend through a REST API.
* For the backend, we employ Python's [Django framework](https://www.djangoproject.com/), complemented by [Django REST Framework](https://www.django-rest-framework.org/) to implement the server API. The backend relies on [PostgreSQL](https://www.postgresql.org/) as its primary database.
* Centrifugo will handle WebSocket connections, providing a real-time transport layer for delivering events instantly to users. The backend will communicate with Centrifugo synchronously over Centrifugo HTTP API, and asynchronously using transactional outbox or CDC approach with [Kafka Connect](https://docs.confluent.io/platform/current/connect/index.html).
* [Nginx](https://www.nginx.com/) acts as a reverse proxy for all public endpoints of the app, facilitating the serving of frontend and backend endpoints from the same domain. This configuration is essential for secure HTTP-only cookie authentication of frontend-to-backend communication.
* To handle connection authentication in Centrifugo and perform channel permission checks, we use [JWT](https://auth0.com/docs/secure/tokens/json-web-tokens) (JSON Web Token) in the app. This ensures secure real-time communication and helps the backend to deal with a reconnect storm – a problem which becomes very important at scale in WebSocket applications that deal with many real-time connections.

![](/img/grand-chat-tutorial-tech.png)

The tutorial is quite lengthy, and it will likely grow larger over time. The primary objective here is to illustrate the process of building a real-time app in detail. Even if you are not familiar with Django or React but wish to grasp Centrifugo concepts, consider reading this tutorial. After going through the entire content, you should feel much more comfortable with Centrifugo design and idiomatic approach to integrate with it.

## Straight to the source code

The complete source code for the app we build [may be found on Github](https://github.com). If you have Docker, you will be able to run the app locally quickly using just a few Docker Compose commands.

If certain steps in the tutorial appear unclear, remember that you can refer to the source code.

## Centrifugo vs Django Channels

Before we begin, a brief note about Django and real-time: Python developers are likely familiar with Django's popular framework for building real-time applications – [Django Channels](https://channels.readthedocs.io/en/latest/). However, with Centrifugo, you can gain several important advantages:

🔥 More features out-of-the-box, including a history cache, missed message recovery, online presence, admin web UI, excellent observability, support for more real-time transports, Protobuf protocol, etc.

🔥 Centrifugo serves as a universal real-time component, allowing you to decouple your real-time transport layer from the application core. You can integrate Centrifugo into any of your future projects, regardless of the programming language used in the backend.

🔥 It's possible to use a traditional Django approach for writing application business logic — there's no need to use ASGI if you prefer not to. Centrifugo is easy to integrate into existing Django applications working on top of WSGI.

🔥 You get an amazing scalable performance. Centrifugo is fast and supports sharding by channel to scale further. The use of JWT for authentication and channel authorization enables handling millions of concurrent connections with a reasonable number of Django backend instances. We will demonstrate that achieving chat rooms with tens of thousands of online users and minimal delivery latency is straightforward with Centrifugo. This is something Django Channels users might find challenging without investing considerable time in thinking about how to scale the app properly.
