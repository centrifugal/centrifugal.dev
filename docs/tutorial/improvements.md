---
id: improvements
sidebar_label: "Appx #1: possible improvements"
title: "Appendix #1: Possible Improvements"
---

There are still many things to improve in GrandChat. But we had to stop at some point to not turn the tutorial into a book. If you liked the tutorial and want to extend GrandChat further, we have some bright ideas:

💡 Implement 2-column layout on wide desktop screens – list of chat rooms on the left, room detail on the right. As we mentioned in the beginning – this is already possible with some re-arrangements of React components and CSS.

💡 Add the possibility for non-admin users to create new rooms, probably create private rooms for 1 to 1 communication which are not visible on the "Discover" page. One-to-one chats may be just a subset of our current chat room implementation. At some point, you may add a property for the room which defines the room type – for having different behavior in rooms of different types.

💡 Add more strict types to the frontend part – i.e. use the all power of Typescript, while using `any` in some places here helped us to evolve quickly while making the tutorial, but in production strict typing will save you time eventually.

💡 Introduce "system" messages. For example, to display messages about users joined/left inside the room detail view. In this case, the message won't have a user author. We already made the user field of the `Message` model nullable to support this scenario.

💡 Here we left pagination out of scope - loading 100 rooms and 100 last messages in rooms, but ideally, we want to lazily load more items too (if scrolled to the end). The backend API implemented here already supports pagination, adding it to the app is a nice challenge.

💡 Show how many users in the chat room are currently online using Centrifugo [online presence](../server/presence.md). For rooms with many active members, consider using a parallel batch request of Centrifugo to get online presence, or go with an implementation that uses some approximation like we provide in Centrifugo PRO [user status](../pro/user_status.md) feature.

💡 Save message delivery/read statuses to the application database and show them in the UI, on the chat list screen highlight chat rooms with unread messages.

💡 Add typing notifications for even more interactivity, while this may seem simple it's actually not – you have to think about debouncing, probably use room-specific channels for efficient publishing.

💡 We are not handling errors everywhere on the client side. Otherwise, it could increase the complexity of the tutorial even more. But as step to production – some proper error handling is necessary. The basic thing to do is show `Unrecoverable Error` screen which we already have for some errors in the example. User can reload page after it to start from scratch.

💡 Support markdown as message content, add the possibility to attach media to messages. Don't forget that messages should only have a link to media files, do not try to pass file content over WebSocket.

💡 Add push notifications to engage offline users to come back to the app or notify them about important messages, like when someone mentions a user in the room. Centrifugo PRO provides a [push notifications API](../pro/push_notifications.md), but you can also use any third-party service too.

💡 There is one more possible issue in application state sync we've decided to not solve here – it may happen during the first load of data from the backend upon page load. If real-time message comes after state loaded but before a real-time subscription is established for the first time – message won't be shown until page reload. There are multiple ways to fix this. Like establish a real-time connection/subscription first and then load initial chat state and apply messages received while state was loading. Or silently re-sync state in the background after setting up a real-time subscription to a personal channel.

💡 Integrate with the ChatGPT API, introduce chatbots with AI skills. In this case, you may additionally send all the messages in chat rooms to Kafka to make an extensible chatbot platform which can be a completely isolated service from the chat core.

The possibilities are limitless!
