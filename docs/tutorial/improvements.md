---
description: "Ideas to improve the GrandChat tutorial app: pagination, typing indicators, push notifications, markdown support, AI chatbots, and more."
id: improvements
sidebar_label: "Appx #1: Possible improvements"
title: "Appendix #1: Possible Improvements"
---

There are still many areas for improvement in GrandChat, but we had to halt at a certain point to prevent the tutorial from becoming a book. If you enjoyed the tutorial and wish to enhance GrandChat further, here are some bright ideas:

💡 Implement a 2-column layout on wide desktop screens – a list of chat rooms on the left and room details on the right. As mentioned in the beginning, this is already achievable with some rearrangement of React components and CSS.

💡 Provide non-admin users with the ability to create new rooms, perhaps creating private rooms for one-to-one communication that are not visible on the "Discover" page. One-to-one chats may just be a subset of our current chat room implementation. At some point, you may add a property to the room defining the room type, allowing for different behavior in rooms of different types.

💡 Enhance the frontend by adding more strict types – leveraging the full power of TypeScript. While using any in some places helped us evolve quickly during the tutorial, strict typing in production will eventually save you time.

💡 Introduce "system" messages, such as displaying messages about users who joined/left inside the room detail view. In this case, the message won't have a user author. We've already made the user field of the `Message` model nullable to support this scenario.

💡 Pagination was left out of scope here - loading 100 rooms and 100 last messages in rooms. Ideally, we want to lazily load more items too (if scrolled to the end). The backend API implemented here already supports pagination, making it a nice challenge to add it to the app.

💡 Display the number of users in the chat room who are currently online using Centrifugo [online presence](../server/presence.md). For rooms with many active members, consider using a parallel batch request to Centrifugo to get online presence or opt for an implementation using some approximation, like we provide in Centrifugo PRO [user status](../pro/user_status.md) feature.

💡 Save message delivery/read statuses to the application database and show them in the UI. On the chat list screen, highlight chat rooms with unread messages.

💡 Add typing notifications for more interactivity. While this may seem simple, it's actually not – you have to think about debouncing and probably use room-specific channels for efficient publishing.

💡 We are not handling errors everywhere on the client side to prevent further complexity in the tutorial. However, for production, proper error handling is necessary. The basic thing to do is to show an `Unrecoverable Error` screen, which we already have for some errors in the example. Users can reload the page after encountering it to start from scratch.

💡 Support markdown as message content and add the ability to attach media to messages. Remember that messages should only have a link to media files; do not attempt to pass file content over WebSocket.

💡 [Add push notifications](./push_notifications.md) to engage offline users to come back to the app or notify them about important messages, such as when someone mentions a user in the room. Centrifugo PRO provides a [push notifications API](../pro/push_notifications.md), but you can also use any third-party service.

💡 There is one more possible issue in application state sync we've decided not to solve here – it may occur during the initial load of data from the backend upon page load. If a real-time message comes after the state is loaded but before a real-time subscription is established for the first time, the message won't be shown until page reload. There are multiple ways to fix this, such as establishing a real-time connection/subscription first and then loading the initial chat state and applying messages received while the state was loading. Or get stream top offset from Centrifigo history API before initial state load, then use it for the initial subscribe. Alternatively, silently re-sync the state in the background after setting up a real-time subscription to a personal channel.

💡 Integrate with the ChatGPT API and introduce chatbots with AI skills. In this case, you may additionally send all the messages in chat rooms to Kafka to create an extensible chatbot platform that can be a completely isolated service from the chat core.

The possibilities are limitless!
