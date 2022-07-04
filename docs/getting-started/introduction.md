---
id: introduction
title: Centrifugo introduction
---

Centrifugo is an open-source scalable real-time messaging server in a language-agnostic way.

:::info Real-time?

By real-time, we indicate a soft real-time. Due to network latencies, garbage collection cycles, and so on, the delay of a delivered message can be up to several hundred milliseconds or higher.

:::

It can be a missing piece in your application architecture to send real-time updates to users. Think chats or messengers, live comments, multiplayer games, collaborative tools, streaming metrics – you'll be able to build amazing web and mobile real-time apps with a help of Centrifugo as a real-time transport layer.

Centrifugo works in conjunction with applications written in any programming language – both on the backend and frontend sides. It runs as a standalone service hosted on your hardware and fits well to both monolithic and microservice architectures.

Centrifugo is fast and scales well to support millions of concurrent client connections. It provides several real-time transports to choose from and a set of features to simplify building real-time applications.

## Background

Centrifugo was born a decade ago to help applications with a server-side written in a language or a framework without built-in concurrency support. In this case, dealing with persistent connections is a real headache that usually can only be resolved by introducing a shift in the technology stack and spending enough time to create a production-ready solution.

For example, frameworks like Django, Flask, Yii, Laravel, Ruby on Rails, and others have poor and not really performant support of working with many persistent connections for the real-time messaging tasks.

In this case, Centrifugo is a straightforward and non-obtrusive way to introduce real-time updates and handle lots of persistent connections without radical changes in application backend architecture. Developers could proceed writing a backend with a favorite language or favorite framework, keep existing architecture – and just let Centrifugo deal with persistent connections.

At the moment, Centrifugo provides some advanced and unique features that can simplify a developer's life and save months of development, even if the application backend is built with the asynchronous concurrent language. One example is that Centrifugo can scale out-of-the-box to many machines with several supported brokers. And there are more things to mention – see detailed highlights further in the docs.

## Concepts

As mentioned above, Centrifugo runs as a standalone service that cares about handling persistent connections from application users. Application backend and frontend can be written in any programming language. Clients connect to Centrifugo and subscribe to channels.

As soon as some event happens application backend can publish a message with event payload into a channel using Centrifugo API. The message will be delivered to all clients currently connected and subscribed to a channel.

So Centrifugo is a user-facing PUB/SUB server in a nutshell. Here is a simplified scheme: 

![Centrifugo scheme](/img/scheme_sketch.png)

## Join community

We have rooms in Telegram and Discord:

[![Join the chat at https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ](https://img.shields.io/badge/Telegram-Group-orange?style=flat&logo=telegram)](https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ) &nbsp;[![Join the chat at https://discord.gg/tYgADKx](https://img.shields.io/discord/719186998686122046?style=flat&label=Discord&logo=discord)](https://discord.gg/tYgADKx)

See you there!
