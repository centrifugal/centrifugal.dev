---
id: outro
sidebar_label: "Wrapping up – things learnt"
title: "Wrapping up – things learnt"
---

At this point, we have a working real-time app, so the tutorial comes to an end. We've covered some concepts of Centrifugo, such as:

* using channel namespaces to granularly configure channel behavior for a specific real-time feature
* user authentication over connection JWT to avoid huge load on your backend's session layer during a mass reconnect scenario
* channel authorization using subscription JWT to make sure users can only subscribe to channels allowed by business logic
* automatic recovery of missed messages from the history cache – to recover state upon short-term disconnects
* using the Centrifugo HTTP API for publishing (broadcasting) messages to channels
* utilizing a publication idempotency key for safer and more efficient retries
* Centrifugo's built-in ability to consume events from PostgreSQL and Kafka.

Of course, you can apply this all not only when building a messenger-like application. Centrifugo is not a tool to build chats, it's a generic-purpose real-time messaging server. Some approaches here may not be a perfect fit for your particular use case – so please check out the rest of the docs for all the possibilities.

Messenger is quite a complex type of application, for simpler use cases your integration with Centrifugo and handling real-time events may not require using all the techniques shown here.

Don't forget that the entire [source code of the app](https://github.com) is on Github under permissive MIT license. We will appreciate it if you fork it and adapt it for another tech stack – by replacing frontend or backend technologies, or both. In this case, don't hesitate to share your work in [our communities](../getting-started/community.md).

:::tip Please share

At the beginning of the tutorial, we promised to go beyond the basics usually shown in chat tutorials. Do you agree we did? If yes, please share [the link](https://centrifugal.dev/docs/tutorial/intro) to the tutorial on your social networks to help Centrifugo grow 🙏

:::
