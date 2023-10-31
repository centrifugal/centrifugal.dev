---
title: "Discovering Centrifugo PRO: push notifications API"
tags: [centrifugo, pro, push notifications]
description: We start talking more about recently launched Centrifugo PRO. In this post, we share details about Centrifugo PRO push notification API implementation - how it works and what makes it special and practical.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/blog_push_notifications_cover_thumb.jpg
hide_table_of_contents: false
---

<img src="/img/blog_push_notifications_cover.jpg" />

In our [v5 release post](/blog/2023/06/29/centrifugo-v5-released), we announced the upcoming launch of Centrifugo PRO. We are happy to say that it was released soon after that, and at this point, we already have several customers of the PRO version.

I think it's time to look at the current state of the PRO version and finally start talking more about its benefits. In this post, we will talk more about one of the coolest PRO features we have at this point: the push notifications API.

<!--truncate-->

## Centrifugo PRO goals

When Centrifugo was originally created, its main goal was to help introduce real-time messaging features to existing systems, written in traditional frameworks which work on top of the worker/thread model. Serving many concurrent connections is a non-trivial task in general, and without native efficient concurrency support, it becomes mostly impossible without a shift in the technology stack. Integrating with Centrifugo makes it simple to introduce an efficient real-time layer, while keeping the existing application architecture.

As time went on, Centrifugo got some unique features which now justify its usage even in conjunction with languages/frameworks with good concurrency support. Simply using Centrifugo for at-most-once PUB/SUB may already save a lot of development time. The task, which seems trivial at first glance, has a lot of challenges in practice: client SDKs with reconnect and channel multiplexing, scalability to many nodes, WebSocket fallbacks, etc.

The combination of useful possibilities has made Centrifugo an attractive component for building enterprise-level applications. Let's be honest here - for pet projects, developers often prefer writing WebSocket communications themselves, and Centrifugo may be too heavy and an extra dependency. But in a corporate environment, the decision on which technology to use should take into account a lot of factors, like those we just mentioned above. Using a mature technology is often preferred to building from scratch and making all the mistakes along the way.

With the PRO version, our goal is to provide even more value for established businesses when switching to Centrifugo. We want to solve tricky cases and simplify them for our customers; we want to step into related areas where we see we can provide sufficient value.

One rule we try to follow for PRO features that extend Centrifugo’s scope is this: we are not trying to replicate something that already exists in other systems, but rather, we strive to improve upon it. We focus on solving practical issues that we observe, providing a unique value proposition for our customers. This post describes one such example — we will demonstrate our approach to push notifications, which is [one the features](/docs/pro/overview#features) of Centrifugo PRO.

## Why providing push notifications API

<img src="/img/push_characters.jpg" />

Why provide a push notifications API at all? Well, actually, real-time messages and push notifications are so close that many developers hardly see the difference before starting to work with both more closely.

I’ve heard several stories where chat functionality on mobile devices was implemented using only native push notifications — without using a separate real-time transport like WebSocket while the app is in the foreground. While this is not a recommended approach due to the delivery properties of push notifications, it proves that real-time messages and push notifications are closely related concepts and sometimes may interchange with each other.

When developers introduce WebSocket communication in an application, they often ask the question—what should I do next to deliver some important messages to a user who is currently not actively using the application? WebSockets are great when the app is in the foreground, but when the app goes to the background, the recommended approach is to close the WebSocket connection. This is important to save battery, and operating systems force the closing of connections after some time anyway.

The delivery of important app data is then possible over push notifications. See a [good overview of them on web.dev](https://web.dev/articles/push-notifications-overview).

Previously, Centrifugo positioned itself solely as a transport layer for real-time messages. In our FAQ, we emphasized this fact and suggested using separate software products to send push notifications.

Now, with Centrifugo PRO, we provide this functionality to our customers. We have extended our server API with methods to manage and send push notifications. I promised to tell you why we believe our implementation is super cool. Let’s dive into the details.

## Push notifications API like no one provides

Push notifications are super handy, but there’s a bit to do to get them working right. Let's break it down!

#### On the user's side (frontend)

* Request permission from the user to receive push notifications.
* Integrate with the platform-specific notification service (e.g., Apple Push Notification Service for iOS, Firebase Cloud Messaging for Android) to obtain the device token.
* Send the device token to the server for storage and future use.
* Integrate with the platform-specific notification handler to listen for incoming push notifications
* Handle incoming push notifications: display the notification content to the user, either as a banner, alert, or in-app message, depending on the user's preferences and the type of notification. Handle user actions on the notification, such as opening the app, dismissing the notification, or taking a specific action related to the notification content.

#### On the server (backend)

* Store device tokens in a database when received from the client side
* Regularly clean up the database to remove stale or invalid device tokens. and handle scenarios where a device token becomes invalid or is revoked by the user, ensuring that no further notifications are sent to that device.
* Integrate with platform-specific notification services (e.g., APNS, FCM) to send notifications to devices. Handle errors or failures in sending notifications and implement retry mechanisms if necessary.
* Track the delivery status of each push notification sent out. Monitor the open rates, click-through rates, and other relevant metrics for the notifications.
* Use analytics to understand user behavior in response to notifications and refine the notification strategy based on insights gained.

We believe that we were able to achieve a unique combination of design decisions which allows us to provide push notification support like no one else provides. Let’s dive into what makes our approach special!

## Frontend decisions

When providing the push notification feature, other solutions like Pusher or Ably also offer their own SDKs for managing notifications on the client side.

What we've learned, though, during the Centrifugo life cycle, is that creating and maintaining client SDKs for various environments (iOS, Android, Web, Flutter) is one of the hardest parts of the Centrifugo project.

So the decision here was simple and natural: Centrifugo PRO does not introduce any client SDKs for push notifications on the client side.

When integrating with Centrifugo, you can simply use the native SDKs provided by each platform. We bypass the complexities of SDK development and concentrate on server-side improvements. With this decision, we are not introducing any limitations to the client side.

You get:

* Wealthy documentation and community support. Platforms like APNs provide comprehensive documentation, tutorials, and best practices, making the integration process smoother.
* Stability and reliability: native SDKs are rigorously tested and frequently updated by the platform providers. This ensures that they are stable, reliable, and free from critical bugs.
* Access to the latest features. As platform providers roll out new features or enhancements, native SDKs are usually the first to get updated. This ensures that your application can leverage the latest functionalities without waiting for SDKs to catch up.

This approach was not possible with our real-time SDKs, as WebSocket communication is very low-level, and Centrifugo’s main goal was to provide some high-level features on top of it. However, with push notifications, proceeding without a custom SDK seems like a choice beneficial for everyone.

## Server implementation

The main work we did was on the server side. Let's go through the entire workflow of push notification delivery and describe what Centrifugo PRO provides for each step.

### How we keep tokens

Let's suppose you got the permission from the user and received the device push token. At this point you must save it to database for sending notifications later using this token. Centrifugo PRO provides API called [device_register](/docs/pro/push_notifications#device_register) to do exactly this.

At this point, we use PostgreSQL for storing tokens – which is a very popular SQL database. Probably we will add more storage backend options in the future.

When calling Centrifugo `device_register` API you can provide user ID, list of topics to subscribe, platform from which the user came from (ios, android, web), also push notifications provider. To deliver push notifications to devices Centrifugo PRO integrates with the following push notification providers:

* fcm - [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* hms - [Huawei Messaging Service (HMS) Push Kit](https://developer.huawei.com/consumer/en/hms/huawei-pushkit/) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* apns - [Apple Push Notification service (APNs) ](https://developer.apple.com/documentation/usernotifications) <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i>

![Push](/img/push_notifications.png)

So we basically cover all the most popular platforms out of the box.

After registering the device token, Centrifugo PRO returns a `device_id` to you. This device ID must be stored on the client device. As long as the frontend has this `device_id`, it can update the device's push token information from time to time to keep it current (by just calling `device_register` again, but with `device_id` attached).

After saving the token, your backend can start sending push notifications to devices.

### How we send notifications

To send push notifications we provide another API called [send_push_notification](/docs/pro/push_notifications#send_push_notification). You need to provide some filter in the API request to tell Centrifugo who you want to send notification. You also need to provide push notification payload. For example, using Centrifugo HTTP API:

```bash
curl -X POST http://localhost:8000/api/send_push_notification \
-H "Authorization: apikey <KEY>" \
-d @- <<'EOF'

{
    "recipient": {
        "filter": {
            "topics": ["test"]
        }
    },
    "notification": {
        "fcm": {
            "message": {
                "notification": {"title": "Hello", "body": "How are you?"}
            }
        }
    }
}
EOF
```


Here is another important decision we made: Centrifugo PRO allows you to specify raw JSON objects for each provider we support. In other words, we do not wrap the push notifications API for FCM, APNS, HMS - we give you a way to construct the entire push notification message.

This means the Centrifugo push API supports all the fields of push notification payloads out-of-the-box, for all push providers. You can simply use the documentation of FCM, APNs, and send the constructed requests to Centrifugo. There is no need for us to update Centrifugo PRO in any way to support new fields added by providers to push APIs.

When you send a push notification with a filter and push payload for each provider you want, it's queued by Centrifugo. We use Redis Streams for queuing and optionally a queue based on PostgreSQL (less efficient, but still robust enough).

The fact that the notification is being queued means a very fast response time – so you can integrate with Centrifugo from within the hot paths of your application backend. You may additionally provide a push expiration time and a unique push identifier. If you have not provided a unique identifier, Centrifugo generates one for you and returns it in the response. The unique identifier may later be used to track push status in Centrifugo PRO's push notification analytics.

We then have efficient workers which process the queue with minimal latency and send push notifications using batch requests for each provider - i.e., we do this in the most effective way possible. We conducted a benchmark of our worker system with FCM – and we can easily send **several million pushes per minute**.

Another decision we made - Centrifugo PRO supports sending push notifications to a raw list of tokens. This makes it possible for our customers to use their own token storage. For example, such storage could already exist before you started using Centrifugo, or you might need a different storage/schema. In such cases, you can use Centrifugo just as an effective push sender server.

Finally, Centrifugo PRO supports sending delayed push notification - to queue push for a later delivery, so for example you can send notification based on user time zone and let Centrifugo PRO send it when needed. Or you may send slightly delayed push notification together with real-time message and if client provided an ack to real-time message - [cancel push notification](/docs/pro/push_notifications#cancel_push).

### Secure unified topics

FCM and HMS have a built-in way of sending notification to large groups of devices over topics mechanism (the same for HMS). One problem with native FCM or HMS topics though is that device can subscribe to any topic from the frontend side without any permission check. In today's world this is usually not desired. So Centrifugo PRO re-implements FCM and HMS topics by introducing an additional API to manage device subscriptions to topics.

Centrifugo PRO device topic subscriptions also **add a way to introduce the missing topic semantics for APNs**.

Centrifugo PRO additionally provides an API to create persistent bindings of user to notification topics. See [user_topic_list](/docs/pro/push_notifications#user_topic_list) and [user_topic_update](/docs/pro/push_notifications#user_topic_update). As soon as user registers a device – it will be automatically subscribed to its own topics pre-created over the API. As soon as user logs out from the app and you update user ID of the device - user topics binded to the device automatically removed/switched.

This design solves one of the issues with push notifications (with FCM in particular) – if two different users use the same device it's becoming problematic to unsubscribe the device from large number of topics upon logout. Also, as soon as user to topic binding added (using `user_topic_update` API) – it will be synchronized across all user active devices. You can still manage such persistent subscriptions on the application backend side if you prefer and provide the full list inside `device_register` call - Centrifugo PRO API gives you freedom here.

### Push analytics

Centrifugo PRO offers the ability to inspect sent push notifications using [ClickHouse analytics](/docs/pro/analytics). Push providers may also offer their own analytics, such as FCM, which provides insight into push notification delivery. Centrifugo PRO also offers a way to analyze push notification delivery and interaction using the [update_push_status](/docs/pro/push_notifications#update_push_status) API. This API allows updating ClickHouse table and add status for each push sent:

* `delivered`
* or `interacted`

It's then possible to make queries to ClickHouse and build various analytical reports. Or use ClickHouse for real-time graphs - for example, from Grafana.

### Push notifications UI

Finally, Centrifugo PRO provides a simple web UI for inspecting registered devices. It can simplify development, provide a way to look at live data, and send simple push notification alerts to users or topics.

![](/img/push_ui.png)

## Conclusion

We really believe in our push notifications and will be working hard to make them even better. The API we already have serves well to cover common push notification delivery use cases, but we won't stop here. Some areas for improvements are: functionality of built-in push notifications web UI, extending push analytics by providing user friendly UI for the insights about push delivery and engagement. The good thing is that we already have a ground for making this.

Take a look at the documentation of [Centrifugo PRO push notification API](/docs/pro/push_notifications) for more formal details and some things not mentioned here. Probably at the time you are reading this we already added something great to the API.

Even though Centrifugo PRO is pretty new, it already has a lot of helpful features, and we have plans to add even more. You can see what’s coming up next on our [Centrifugo PRO planned features board](https://github.com/orgs/centrifugal/projects/3/views/1). We're excited to share more blog posts like this one in the future.
