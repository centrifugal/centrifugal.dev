---
title: "Discovering Centrifugo PRO: push notifications API"
tags: [centrifugo, pro, push notifications]
description: We start talking more about recently launched Centrifugo PRO. In this post, we would like to share details about implementation of Centrifugo PRO push notifications API feature.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: https://github.com/FZambia.png
image: /img/centrifugo_pro_benefits_cover.jpg
hide_table_of_contents: false
draft: true
---

<img src="/img/centrifugo_pro_benefits_cover.jpg" />

In our [v5 release post](/blog/2023/06/29/centrifugo-v5-released) we announced the upcoming launch of Centrifugo PRO. We are happy to say that it was released soon after that and at this point we already have several customers of PRO version. I think it's time to look at the current state of PRO version and finally start talking more about its benefits.

In this post I'll start describing the positioning of Centrifugo PRO and its goals. And will talk about one of the coolest PRO features we have at this moment: push notifications API.

<!--truncate-->

## Centrifugo PRO goals

When Centrifugo was originally created its main goal was to help introducing real-time messaging features to existing systems, written in traditional frameworks which work on top of worker/thread model. Serving many concurrent connections is a non-trivial task in general, and without native efficient concurrency support it becomes mostly imposible without a shift in the technology stack. Integrating with Centrifugo makes it simple to introduce an efficient real-time layer, while keeping the existing application architecture.

As time went Centrifugo got some unique features which now justify its usage even in conjunction with language/frameworks with good concurrency support. Simply using Centrifugo for at most once PUB/SUB may already save a lot of development time. The task which seems trivial at first glance has a lot of challenges on practice: client SDKs with reconnect and channel multiplexing, scalability to many nodes, websocket fallbacks, etc.

The combination of useful possibilities made Centrifugo an attractive component for building enterprise-level applications. Let's be honest here - for pet projects developers often prefer writing websocket communications themselves, and Centrifugo may be too heavy and an extra dependency. But in corporate environment the decision which technology to use should take into account a lot of factors, like those we just mentioned above. Using a mature technology is often prefferred than building from scratch and making all the mistakes along the way.

With PRO version our goal is to provide even more value for established businesses when switching to Centrifugo. We want to solve tricky cases and simplify them for our customers, we want to step in some related areas where we see we can provide a sufficient value.

One rule we try to follow for PRO features which extend Centrifugo scope - we are not trying to repeat something existing in other systems, but try to improve it in some way. Solving practical issues we observe and provide a unique position for our customers. This post describes one such example - we will demonstrate our approach to push notifications, which is [one the features](/docs/pro/overview#features) of Centrifugo PRO.

We will describe why our implementation is practical and useful and may serve well for many use cases involving sending push notifications to users. And you'll see how it provides more than simple API by thinking about push notification workflows and providing answers to non-obvious questions. 

## Why providing push notifications API

<img src="/img/push_characters.jpg" />

Why providing push notifications API at all? Well, actually real-time messages and push notifivations are so close that many developers hardly see the difference before starting work with both more closely. Moreover, I've heard several stories when messenger functionality on mobile devices was implemented using only native push notifications – without using a separate real-time transport like WebSocket while the app is in foreground. While it's not a recommended approach due to push notifications delivery properties this proves that real-time messages and push notifications are super related and sometimes may interchange each other.

When developers introduce WebSocket communication in the application they often ask the question – what should I do next to deliver some important messages to a user currently not actively using an application? WebSockets are great when app is in foreground, but when app goes to the background - the recommended approach is to close WebSocket connection. To save battery and to not deal with cases when operational system decided to free some resources closing connections in background applications.

Push notifications work over native mechanism on each device. They use very battery efficient transport and approach to let device to receive important information from all apps over that single connection. For example, iOS devices use ... TBD.

Previously Centrifugo positioned itself only as a transport layer for real-time messages. In our FAQ we emphasized this fact and suggested to use separate software products to send push notifications.

But now with Centrifugo PRO we provide this functionality to our customers. We extended our server API with several methods to manage and send push notifications. I promised to tell why we beleive our implementation is super cool. So let's dive into details.

## Push notifications API like no one provides

When dealing with push notifications there are several main areas to solve:

That's what you usually do on frontend (client) side:

* Request permission from the user to receive push notifications.
* Integrate with the platform-specific notification service (e.g., Apple Push Notification Service for iOS, Firebase Cloud Messaging for Android) to obtain the device token.
* Send the device token to the server for storage and future use.
* Integrate with the platform-specific notification handler to listen for incoming push notifications
* Handle incoming push notifications: display the notification content to the user, either as a banner, alert, or in-app message, depending on the user's preferences and the type of notification. Handle user actions on the notification, such as opening the app, dismissing the notification, or taking a specific action related to the notification content.

And this is what you do on server side:

* Store device tokens in a database when received from the client side
* Regularly clean up the database to remove stale or invalid device tokens. and handle scenarios where a device token becomes invalid or is revoked by the user, ensuring that no further notifications are sent to that device.
* Integrate with platform-specific notification services (e.g., APNS, FCM) to send notifications to devices. Handle errors or failures in sending notifications and implement retry mechanisms if necessary.
* Track the delivery status of each push notification sent out. Monitor the open rates, click-through rates, and other relevant metrics for the notifications.
* Use analytics to understand user behavior in response to notifications and refine the notification strategy based on insights gained.

We believe that we were able to achieve a unique combination of design decisions which allowed us to provide push notification support like no one else provides. Let me describe these decisions now. 

## Frontend decisions

What we've learned during Centrifugo life cycle is that creating and maintaining client SDKs for various environments (iOS, Android, Web, Flutter) is one of the hardest parts of Centrifugo project.

So the decision here was simple and natural: Centrifugo PRO does not introduce any client SDKs for push noifications on the client side. When integrating with Centrifugo you can simply use native SDKs provided by platforms. So we bypass the complexities of SDK development and concentrate on the server side improvements. With this decision we are not introducing any limitations to the client side.

You also get:

* Wealthy documentation and community support. Platforms like APNs provide comprehensive documentation, tutorials, and best practices, making the integration process smoother.
* Stability and reliability: native SDKs are rigorously tested and frequently updated by the platform providers. This ensures that they are stable, reliable, and free from critical bugs.
* Access to the latest features. As platform providers roll out new features or enhancements, native SDKs are usually the first to get updated. This ensures that your application can leverage the latest functionalities without waiting for SDKs to catch up.

It was not possible with our real-time SDKs since WebSocket communication is very low-level and Centrifugo's main goal was to provide some high-level features on top of it. But with push notifications going forward with no custom SDK is a very reasonable choice.

## Server implementation

The main work we did was for on server side. Let's go through the entire workflow of push notification delivery and describe what Centrifigo PRO provides for each step.

### How we keep tokens

Let's suppose you got the permission from the user and received device push token. At this point you must save it to database for sending notifications later. Centrifugo PRO provides API called `device_register` to to exactly this. We use PostgreSQL for storing tokens – which is a very common SQL database.

When calling Centrifugo `device_register` API you can also provide user ID, list of topics to subscribe (we will discuss this more below), platform from which the user came from, also push notifications provider. To deliver push notifications to devices Centrifugo PRO integrates with the following providers:

* [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* [Huawei Messaging Service (HMS) Push Kit](https://developer.huawei.com/consumer/en/hms/huawei-pushkit/) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* [Apple Push Notification service (APNs) ](https://developer.apple.com/documentation/usernotifications) <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i>

![Push](/img/push_notifications.png)

After registering device token Centrifugo PRO returns `device_id` to you. This device may be stored on client device. While frontend has this `device_id` it can update push token information from time to time to maintain it actual (just calling `device_register` again but with `device_id` attached).

After saving token your backend can start sending push notifications to devices.

### How we send notifications

To send push notifications we provide another API called `send_push_notification`. You need to provide some filter in the API request to tell Centrifugo who you want to send notification. You also need to provide push notification payload. Here is another important decision we made: Centrifigo PRO allows you to specify raw JSON objects for each provider we support. I.e. we do not wrap push notifications API for FCM, APNS, HMS - we give you a way to construct the entire push notification message.

This means Centrifugo push API supports all the fields of push notification payload out-of-the-box. And there is no need for us to update Centrifugo in any way to support new fields added by providers to push APIs.

When you send push notification with filter and push payload for each provider you want – it's queued by Centrifugo. The fact it's being queue means a very fast response time – so you can integrate with Centrifugo from within hot paths of your application backend. You may additionally provide push expiration time and unique push identifier. If you have not provided unique identifier - Centrifugo generates one for you and returns in response. This may be later used to track push notification analytics.

We then have efficient workers which process queue with minimal latency and send push notifications using batch requests for each provider - i.e. we do this in the most effective way possible. We did the benchmark of our worker system with FCM – and we can easily send several millions of pushes in minute.

Another decision we made - Centrifugo PRO supports sending push notifications to raw list of tokens. This makes it possible for our customers to use there own token storage (in some case it can already exist) and use Centrifugo just as an effective push sender software. 

Finally, Centrifugo PRO supports sending delayed push notification - to queue push for a later delivery, so for example you can send notification based on user time zone and let Centrifugo PRO send it when needed. Or you may send slightly delayed push notification together with real-time message and if client provided an ack to real-time message - [cancel push notification](/docs/pro/push_notifications#cancel_push).

### Secure unified topics

FCM and HMS have a built-in way of sending notification to large groups of devices over topics mechanism (the same for HMS). One problem with native FCM or HMS topics though is that client can subscribe to any topic from the frontend side without any permission check. In today's world this is usually not desired. So Centrifugo PRO re-implements FCM, HMS topics by introducing an additional API to manage device subscriptions to topics.

Centrifugo PRO device topic subscriptions also add a way to introduce the missing topic semantics for APNs.

Centrifugo PRO additionally provides an API to create persistent bindings of user to notification topics. Then – as soon as user registers a device – it will be automatically subscribed to its own topics. As soon as user logs out from the app and you update user ID of the device - user topics binded to the device automatically removed/switched. This design solves one of the issues with FCM – if two different users use the same device it's becoming problematic to unsubscribe the device from large number of topics upon logout. Also, as soon as user to topic binding added (using user_topic_update API) – it will be synchronized across all user active devices. You can still manage such persistent subscriptions on the application backend side if you prefer and provide the full list inside device_register call.

### Built-in analytics

Furthermore, Centrifugo PRO offers the ability to inspect sent push notifications using ClickHouse analytics. Providers may also offer their own analytics, such as FCM, which provides insight into push notification delivery. Centrifugo PRO also offers a way to analyze push notification delivery and interaction using the update_push_status API.

### Push notifications UI

And we also providing simple web UI for inspecting registered devices. It can simplify development, provides a way to look at production data, send simple push notification alert to user or topic.

## Conclusion

Hopefully this was convincing enough. We bet a lot on push notifications and plan to improve them further as time goes.

We already provide an API which serves well to cover common push notification delivery use cases, but we definitely can do better and improve further. Some areas for improvements are: functionality of built-in push notifications web UI, extending push analytics by providing user friendly UI for the insights about push delivery and engagement. The good thing is that we already have a ground for making this.

Take a look at the documentation of [Centrifugo PRO push notification API](/docs/pro/push_notifications) for more formal details and some things not mentioned here. Probably at the time you are reading this we already added something great to the API.

While just launched, Centrifugo PRO already provides quite a lot of useful features, and will have more – see our [Centrifugo PRO planned features board](https://github.com/orgs/centrifugal/projects/3/views/1). We hope to add more posts like this one to the blog in the future.
