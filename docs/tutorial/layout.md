---
id: layout
sidebar_label: "App layout and behavior"
title: "App layout and behavior"
---

Before we start, we would like the reader to be more familiar with the layout and behavior of the application we are creating here. Let's look at it screen by screen, describe the behavior, and explain which parts will be endowed with real-time superpowers.

## App screens

We tried to find a good balance which screens to include into the app. So that the result was minimal, but still showing ideas we aim to cover in the tutorial. Our final app has 4 screens. 

### Login Screen

One of the goals for the tutorial is showing the app with user authentication. To show how to tell Centrifugo which user connects and build permissions for channels around the particular user.

Nothing too special here – we will use native Django user/password authentication. Django already has built-in User model and functions to support user login/logout workflow. So we just use this.
![](/img/grand-chat-login.png)
It does not include any real-time features. How about this one BTW: as soon as some other user logs into the app we can show notification about this on the login screen and write sth like "Hey, user X just logged in, so what are you waiting for?". Joking! But for those interested in implementing some useless thing like this – it's possible to do with Centrifugo!

As soon as user logs into the app with its username/password pair we see the Chat Room List Screen.

### Chat Room List Screen

This one shows rooms current user joined. So user can click on any to go to Chat Room Detail Screen.
![](/img/grand-chat-room-list.png)
This screen includes a couple of elements to emphasize. First one is a green circle on top right. This is a Centrifugo real-time subscription status. As soon as user connected to Centrifugo and subscribed to the personal message stream (personal channel) - the indicator is green 🟢. Otherwise - it's red 🔴.

The next element - the number of ~~cats~~ users who joined to the specific room. This counter is synchronized in real-time. For example, if someone joins the room from Chat Room Search Screen (at which we will look shortly) – the counter will be instantly synchronized. We also automatically add/remove rooms if current user joins/leaves some room from within Chat Room Search Screen opened in another browser tab or another device.

Upon receiving real-time message we re-order rooms to put the one with latest message on top.

### Chat Room Search Screen

This screen allows user to discover new rooms to join. In our app we decided to not provide a functionality to user to create chat rooms. Rooms must be pre-created by admin – it's actually possible to do using Django built-in admin web UI - so to keep tutorial shorter (not the ideal justification for this tutorial which is freaking large, probably we were just lazy...) we decided to skip it for now.
![](/img/grand-chat-search.png)
We distinguish rooms current user joined and not using color scheme. The information about current user membership is synchronized between browser tabs and different devices. After user joins the room – it appears on Chat Room List Screen.

### Chat Room Detail Screen

Finally, a page with room name, list of messages and a possibility to send a new one:
![](/img/grand-chat-room-detail.png)
Of course messages are sent in real-time to all users participating in chat. Also, the counter with number of users right to the room name is also updated in real-time.

## 2-column layout in mind 

Often in messenger apps you can see the layout where a list of chats is the left column, and chat details shown on the right. Like this one in Slack:

![TBD](https://www.cnet.com/a/img/hub/2023/08/08/f4e09832-9f2b-4967-ac66-53fc8dfc6588/slack-redesign-2023-before-home.png)

While we use a slightly simplified layout in the app with a separate chat room list and chat detail screens (more often seen on mobile devices), we keep in mind the possibility to switch to the 2-column layout if needed - just with a change of React component arrangement and some CSS. With our implementation user may be theoretically a member of hundreds or thousands of rooms and receive updates from all of them on one screen. Like in Telegram, Discord or Slack messengers.

This predetermined the fact we are using individual user channels in the app to receive real-time updates from all the rooms, instead of subscribing to each individual chat room channel. We will talk about this decision later, for now let's say simply: using individual channels drastically simplifies frontend implementation, leaving the complexity for the backend side.
