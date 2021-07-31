---
id: introduction
title: Centrifugo introduction
---

Centrifugo is an open-source scalable real-time messaging server in language-agnostic way.

:::info Real-time?

By real-time, we indicate a soft real-time. Due to network latencies, garbage collection cycles, and so on, the delay of a delivered message can be up to several hundred milliseconds or higher.

:::

It can be a missing piece in your application architecture to send real-time updates to users. Think chats, live comments, multiplayer games, streaming metrics – you'll be able to build amazing web and mobile real-time apps with a help of Centrifugo server.

Centrifugo works in conjunction with applications written in any programming language – both on backend and frontend sides. It runs as a standalone service hosted on your hardware and fits very well to both monolithic and microservice architectures. 

Centrifugo is fast and scales well to support millions of concurrent client connections. It provides several real-time transports to choose from and a set of features to help building real-time applications.

## Motivation

Centrifugo was originally born to help applications with a server side written in a language or a framework without built-in concurrency support. In this case dealing with persistent connections is a real headache which usually can only be resolved by introducing shift in technology stack and spending enough time to create a production-ready solution.

For example, frameworks like Django, Flask, Yii, Laravel, Ruby on Rails and others have poor or not really performant support of working with many persistent connections for real-time messaging task.

In this case Centrifugo is a very straightforward and non-obtrusive way to introduce real-time updates and handle lots of persistent connections without radical changes in application backend architecture – developers could proceed writing a backend with a favorite language or favorite framework, keep existing architecture – and just let Centrifugo deal with persistent connections.

At the moment Centrifugo provides some advanced and unique features that can simplify developer's life and save months of development even if application backend is written in asynchronous concurrent language. One example is that Centrifugo can scale out-of-the-box to many machines with several supported brokers. And there are more things to mention – see detailed highlights further in the docs.

## Concepts

As already mentioned above Centrifugo runs as a standalone service which takes care of handling persistent connections from application users. Application backend and frontend can be written in any programming language. Clients connect to Centrifugo from a frontend and subscribe to channels.

As soon as some event happens application backend can publish a message with event payload into a channel using Centrifugo API. That message will then be delivered to all clients currently connected and subscribed on a channel.

So Centrifugo is a user-facing PUB/SUB server in a nutshell. Here is a simplified scheme: 

![Centrifugo scheme](/img/scheme_sketch.png)

## Join community

We have rooms in Telegram and Discord:

[![Join the chat at https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ](https://img.shields.io/badge/Telegram-Group-orange?style=flat&logo=telegram)](https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ) &nbsp;[![Join the chat at https://discord.gg/tYgADKx](https://img.shields.io/discord/719186998686122046?style=flat&label=Discord&logo=discord)](https://discord.gg/tYgADKx)

See you there!
