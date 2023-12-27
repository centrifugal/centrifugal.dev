---
id: outro
sidebar_label: "Wrapping up – things learnt"
title: "Wrapping up – things learnt"
---

At this point, we have a working real-time app, so the tutorial comes to an end. We've covered some concepts of Centrifugo, such as:

* Using channel namespaces to configure channel behavior granularly for a specific real-time feature.
* Employing user authentication over connection JWT to mitigate the load on your backend's session layer during a mass reconnect scenario.
* Channel authorization using subscription JWT to ensure users can only subscribe to channels allowed by business logic.
* Automatic recovery of missed messages from the history cache to restore state upon short-term disconnects.
* Utilizing the Centrifugo HTTP API for publishing (broadcasting) messages to channels.
* Implementing a publication idempotency key for safer and more efficient retries.
* Leveraging Centrifugo's built-in ability to consume events from PostgreSQL and Kafka.

It's worth noting that these concepts can be applied beyond building a messenger-like application. Centrifugo is not limited to chats; it serves as a generic-purpose real-time messaging server. Some approaches here may not perfectly suit your specific use case, so be sure to explore the rest of the documentation for additional possibilities.

Messenger is quite a complex type of application, for simpler use cases your integration with Centrifugo and handling real-time events may not require all the techniques demonstrated here.

Remember that the entire [source code of the app](https://github.com/centrifugal/grand-chat-tutorial) is available on GitHub under the permissive MIT license. We would appreciate it if you forked it and adapted it for another tech stack, whether by replacing frontend or backend technologies, or both. If you do so, feel free to share your work in [our communities](../getting-started/community.md).

:::tip Please share

At the beginning of the tutorial, we promised to go beyond the basics usually shown in chat tutorials. Do you agree we did? If yes, please share [the link](https://centrifugal.dev/docs/tutorial/intro) to the tutorial on your social networks to help Centrifugo grow 🙏

:::
