---
title: "Discovering Centrifugo PRO: push notifications API"
tags: [centrifugo, pro, push notifications]
description: In this post we would like to share some thoughts about .
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: https://github.com/FZambia.png
image: /img/rabbitx.png
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
* Access to the Latest Features: As platform providers roll out new features or enhancements, native SDKs are usually the first to get updated. This ensures that our application can leverage the latest functionalities without waiting for third-party SDKs to catch up.
* Reduced Overhead: Introducing an additional layer, like a custom SDK, can introduce overhead in terms of performance. Using native SDKs ensures direct communication with the platform, reducing potential performance bottlenecks.

It was not possible with our real-time SDKs since WebSocket communication is very low-level and Centrifugo's main goal was to provide some high-level features on top of it. But with push notifications going forward with no custom SDK is a very reasonable choice.

## Server implementation

The main work we did was for on server side.

### How we keep tokens

To start delivering push notifications in the application, developers usually need to integrate with providers such as FCM, HMS, and APNs. This integration typically requires the storage of device tokens in the application database and the implementation of sending push messages to provider push services.

Centrifugo PRO simplifies the process by providing a backend for device token storage, following best practices in token management. It reacts to errors and periodically removes stale devices/tokens to maintain a working set of device tokens based on provider recommendations.

### How we queue notifications

Additionally, Centrifugo PRO provides an efficient, scalable queuing mechanism for sending push notifications. Developers can send notifications from the app backend to Centrifugo API with minimal latency and let Centrifugo process sending to FCM, HMS, APNs concurrently using built-in workers. In our tests, we achieved several millions pushes per minute.

Centrifugo PRO also supports delayed push notifications feature – to queue push for a later delivery, so for example you can send notification based on user time zone and let Centrifugo PRO send it when needed.

### How we integrate with notification services

Unlike other solutions that combine different provider push sending APIs into a unified API, Centrifugo PRO provides a non-obtrusive proxy for all the mentioned providers. Developers can send notification payloads in a format defined by each provider.

It's also possible to send notifications into native FCM, HMS topics or send to raw FCM, HMS, APNs tokens using Centrifugo PRO's push API, allowing them to combine native provider primitives with those added by Centrifugo (i.e., sending to a list of device IDs or to a list of topics).

### Secure unified topics

FCM and HMS have a built-in way of sending notification to large groups of devices over topics mechanism (the same for HMS). One problem with native FCM or HMS topics though is that client can subscribe to any topic from the frontend side without any permission check. In today's world this is usually not desired. So Centrifugo PRO re-implements FCM, HMS topics by introducing an additional API to manage device subscriptions to topics.

TIP
In some cases you may have real-time channels and device subscription topics with matching names – to send messages to both online and offline users. Though it's up to you.

Centrifugo PRO device topic subscriptions also add a way to introduce the missing topic semantics for APNs.

Centrifugo PRO additionally provides an API to create persistent bindings of user to notification topics. Then – as soon as user registers a device – it will be automatically subscribed to its own topics. As soon as user logs out from the app and you update user ID of the device - user topics binded to the device automatically removed/switched. This design solves one of the issues with FCM – if two different users use the same device it's becoming problematic to unsubscribe the device from large number of topics upon logout. Also, as soon as user to topic binding added (using user_topic_update API) – it will be synchronized across all user active devices. You can still manage such persistent subscriptions on the application backend side if you prefer and provide the full list inside device_register call.

### Our approach to analytics

Furthermore, Centrifugo PRO offers the ability to inspect sent push notifications using ClickHouse analytics. Providers may also offer their own analytics, such as FCM, which provides insight into push notification delivery. Centrifugo PRO also offers a way to analyze push notification delivery and interaction using the update_push_status API.

### Push notifications UI

TBD

### Other features

* Delayed push notification sending
* Possibility to cancel push notification sending
* Solving user switching on device

## Conclusion

Hopefully this was convincing enough. We bet a lot on push notifications and plan to improve them further as time goes. We already provide an API which serves well to cover common use cases, but we definitely can do better and improve it. One area for improvements is extending our push analytics to provide user friendly UI for the insights about push delivery and engagement. We already have a ground for this as we showed above.

We will try to follow the rule we always used in Centrifugo: when providing some feature we do this in a way which scales well, solves practical issues, provides a unique value for our customers.  

We try to provide features in the practical way. Not only PRO, we always tried to do this in the OSS version. That's why we are currently in quite unique position and will keep up with it.
