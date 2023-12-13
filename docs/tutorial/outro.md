---
id: outro
sidebar_label: "Wrapping up"
title: "Wrapping up"
---

At this point, we have a working real-time app, so the tutorial comes to an end. We've covered some concepts of Centrifugo, such as:

* using channel namespaces to granularly configure channel behavior for a specific real-time feature
* user authentication over connection JWT to avoid huge load on your backend's session layer during a mass reconnect scenario
* channel authorization using subscription JWT to make sure users can only subscribe to channels allowed by business logic
* automatic recovery of missed messages from the history cache – to recover state upon short-term disconnects
* using the Centrifugo HTTP API for publishing (broadcasting) messages to channels
* utilizing a publication idempotency key for safer and more efficient retries
* Centrifugo's built-in ability to consume events from PostgreSQL and Kafka.

Messenger is quite a complex type of application, for simpler use cases your integration with Centrifugo and handling real-time events may not require using all the techniques shown here.

Of course, you can apply this all not only when building a messenger-like application. Centrifugo is not a tool to build chats, it's a generic-purpose real-time messaging server. Some approaches here may not be a perfect fit for your particular use case – so please check out the rest of the docs for all the possibilities.

Don't forget that the entire [source code of the app](https://github.com) is on Github under permissive MIT license. We will appreciate it if you fork it and adapt it for another tech stack – by replacing frontend or backend technologies, or both. In this case, don't hesitate to share your work in [our communities](../getting-started/community.md).

:::tip Don't hesitate to share

At the beginning of the tutorial, we promised to go beyond basics usually shown in chat tutorials. Do you agree we did? If yes, please share [the link](https://centrifugal.dev/docs/getting-started/chat_tutorial_intro) to the tutorial on your social networks to help the Centrifugo project grow 🙏

:::

## Appendix #1. Possible Improvements

There are still many things to improve in FusionChat. But we had to stop at some point to not turn the tutorial into a book. If you liked the tutorial and want to extend FusionChat further, we have some bright ideas:

💡 Here we left pagination out of scope - loading 100 rooms and 100 last messages in rooms, but ideally, we want to lazily load more items too (if scrolled to the end). The backend API implemented here already supports pagination, adding it to the app is a nice challenge.

💡 We are not handling errors everywhere on the client side. Otherwise, it could increase the complexity of the tutorial even more. But as step to production – some proper error handling is necessary. The basic thing to do is show `Unrecoverable Error` screen which we already have for some errors in the example. User can reload page after it to start from scratch.

💡 Add the possibility for non-admin users to create new rooms, probably create private rooms for 1 to 1 communication which are not visible on the "Discover" page. One-to-one chats may be just a subset of our current chat room implementation. At some point, you may add a property for the room which defines the room type – for having different behavior in rooms of different types.

💡 Introduce "system" messages. For example, to display messages about users joined/left inside the room detail view. In this case, the message won't have a user author. We already made the user field of the `Message` model nullable to support this scenario.

💡 Show how many users in the chat room are currently online using Centrifugo [online presence](../server/presence.md). For rooms with many active members, consider using a parallel batch request of Centrifugo to get online presence, or go with an implementation that uses some approximation like we provide in Centrifugo PRO [user status](../pro/user_status.md) feature.

💡 Save message delivery/read statuses to the application database and show them in the UI, on the chat list screen highlight chat rooms with unread messages.

💡 Add typing notifications for even more interactivity, while this may seem simple it's actually not – you have to think about debouncing, probably use room-specific channels for efficient publishing.

💡 Support markdown as message content, add the possibility to attach media to messages. Don't forget that messages should only have a link to media files, do not try to pass file content over WebSocket.

💡 Add push notifications to engage offline users to come back to the app or notify them about important messages, like when someone mentions a user in the room. Centrifugo PRO provides a [push notifications API](../pro/push_notifications.md), but you can also use any third-party service too.

💡 Integrate with the ChatGPT API, introduce chatbots with AI skills. In this case, you may additionally send all the messages in chat rooms to Kafka to make an extensible chatbot platform which can be a completely isolated service from the chat core.

The possibilities are limitless!
