---
id: intro
sidebar_label: "Real-time app from scratch"
title: "Building WebSocket chat (messenger) app from scratch"
---

In this tutorial, we show how to build a rather complex real-time application with Centrifugo. It features a modern and responsive frontend, user authentication, channel permission checks, and the main database as a source of truth.

The app we build here is a WebSocket chat called **GrandChat**. The internet is full of chat tutorials, but we promise – here, we go beyond the usual basics. GrandChat is not just a set of isolated chat rooms but more like a messenger application, a simplified version of Discord, Telegram, or Slack. Here is a short demo of our final result:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/grand-chat-tutorial-demo.mp4"></video>

Note that we have a real-time synchronization across the app – room membership events and room messages are sent in real-time. Our design allows users to be subscribed to many rooms and receive updates from all of them within one screen. To achieve this in a scalable way we use individual channel for each application user. We will show how the app scales when there are thousands of room members to prove that with almost no additional effort it may scale to the size comparable to the largest Slack messenger installations with reasonable latency properties.

## Application tech stack

Centrifugo is absolutely technology stack agnostic. It integrates with any tech on the app frontend side and anything on the backend side. But for this tutorial we had to select something to show the full process of building real-time WebSocket app:

* For the frontend we use [React](https://react.dev/) and [Typescript](https://www.typescriptlang.org/) with a help of tooling provided by [Vite](https://vitejs.dev/). The frontend will be a Single-Page Application (SPA) that communicates with the backend over REST API.
* For the backend we use Python's [Django framework](https://www.djangoproject.com/) here together with [Django REST Framework](https://www.django-rest-framework.org/) for implementing server API. Backend uses [PostgreSQL](https://www.postgresql.org/) as the primary database.
* Centrifugo will handle WebSocket connections and provide a real-time transport layer for delivering events to users instantly. The backend will communicate with Centrifugo synchronously over Centrifugo HTTP API, and then asynchronously using transactional outbox or CDC approach with [Kafka Connect](https://docs.confluent.io/platform/current/connect/index.html). 
* [Nginx](https://www.nginx.com/) will be a reverse proxy for all the public endpoints of the app and help us to serve the frontend and backend endpoints from the same domain, which is required for a secure HTTP-only cookie authentication of frontend-to-backend communication.
* For connection authentication in Centrifugo and for channel permission checks we will use [JWT](https://auth0.com/docs/secure/tokens/json-web-tokens) (JSON Web Token) in the app to make real-time communication secure and make it easier for the backend to deal with a reconnect storm – a problem which becomes very important at scale in WebSocket applications that deal with many real-time connections.

![](/img/grand-chat-tutorial-tech.png)

The tutorial is quite lengthy. Most probably it will only become larger as time goes. The main goal here is to demonstrate the process of building real-time app in detail. Even if you are not familiar with Django or React but want to understand Centrifugo concepts – consider reading this tutorial anyway. After reading this full, you should be much more comfortable with Centrifugo design and idiomatic approach to integrate with it.

## Straight to the source code

The full source code of the app we build here [may be found on Github](https://github.com). If you have Docker then you will be able to quickly run the app locally with just several docker compose commands.

If some steps in the tutorial will seem unobvious - don't forget you have the source code.

## Centrifugo vs Django channels

Before we start, a little disclaimer about Django and real-time. Python developers know that Django has a popular framework for building real-time applications called [Django Channels](https://channels.readthedocs.io/en/latest/). With Centrifugo you can get some imporant advantages:

🔥 More features out-of-the-box – history cache, missed message recovery, online presence, admin web UI, great observability, more supported real-time transports, Protobuf protocol, etc.

🔥 Centrifugo is a universal real-time component, your real-time transport layer will be decoupled from the application core, you can take Centrifugo to any of your projects in the future – no matter which programming language the backend will be built on top of.

🔥 It's possible to use a traditional Django approach for writing application buisiness logic – no need to use ASGI at all if you prefer not to. Simple to integrate into existing Django application working on top of WSGI.

🔥 You get an amazing scalable performance. The approach with JWT for authentication and channel authorization to have a possibility to handle millions of concurrent connections with a reasonable number of Django backend instances. We will show that having chat rooms with tens of thousands online users and small delivery latency is simple to achieve with Centrifugo. Something Django Channels users can't even imagine without long hours thinking how to scale the app properly.
