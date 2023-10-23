---
title: Discovering the benefits of Centrifugo PRO
tags: [centrifugo, pro]
description: In this post we would like to share some thoughts about .
author: Centrifugal Labs
authorTitle: TBD
authorImageURL: https://github.com/FZambia.png
image: /img/rabbitx.png
hide_table_of_contents: false
draft: true
---

<img src="/img/centrifugo_pro_benefits_cover.png" />

In our v5 release post we shared some information about the upcoming launch of Centrifugo PRO. Since that time we got several customers of PRO version and now want to look at the current state of PRO version and finally start talking more about its benefits.

<!--truncate-->

## A step beyond the basics

When Centrifugo was originally created more than a decade ago its main goal was to help introducing real-time messaging features to existing systems, written in traditional frameworks which work based on worker/thread model. Serving many concurrent connections is a non-trivial task in general, and without good built-in concurrency it becomes mostly imposible without shift in the technology stack.

As time went Centrifugo got some unique features which now justify its usage even in conjunction with language/frameworks with good concurrency support. Even without all those unique features using Centrifugo for simple at most once PUB/SUB may save a lot of development time. The task which seems trivial at first glance has a lot of challenges on practice: client SDKs with reconnect and channel multiplexing, scalability to many nodes, websocket fallbacks.

This all always made Centrifugo a very attractive component for building enterprise-level applications. Let's be honest - for pet projects developers often choose to write websocket communications themselves. But in corporate environment the decision which technology to use should take into account a lot of factors, like those we just mentioned above.

With PRO version our goal is to provide even more value for established businesses when switching to Centrifugo. We want to solve tricky cases and simplify them for our customers, we want to step in some related areas where we can provide a sufficient value. In this post we will take a look at some existing features of PRO version, and try to describe why they are practical and useful.

One rule we have for PRO features - we are not trying to repeat some feature existing in other systems, but try to improve it in some ways. To provide unique value for our customers. I'll share several such examples throughout this post.

## Push notifications API like no one provides

Centrifugo PRO is a unique player in the push notification game. It doesn't just stop at sending messages in real-time to users who are online; it also takes care of those who are offline, ensuring they're brought back into the loop with minimal fuss.

Think of it this way. When you use Centrifugo PRO, you're not just getting a service that can talk to Android, iOS, and web browsers. You're getting a robust system that handles device tokens and topic subscriptions with ease, something that’s often a pain point with other solutions.

Managing device tokens is usually tricky. With most services, you'd need to build something from scratch to handle this, which can be a huge task. Centrifugo PRO, however, makes this simple. It offers APIs that let you manage device tokens and subscriptions efficiently, ensuring that stale tokens are cleaned up and removed based on provider recommendations. This means your push notification system stays in top shape, without extra work from your end.

Here’s a real-world scenario for you. Let’s say a user leaves your shopping app without completing their purchase. With Centrifugo PRO, you can send them a push notification to remind them about their abandoned cart. And you can do this for users on any platform - Android, iOS, or web browser. Sending this notification is straightforward and doesn’t require jumping through hoops.

Centrifugo PRO stands out because of its thoughtful design and its ability to scale. It’s not just about sending notifications; it’s about sending them in the most efficient way possible.

One of the standout features of Centrifugo PRO is its approach to topics. While other services like FCM and HMS offer topics, they don’t provide a secure way of managing them. Centrifugo PRO takes this a step further by offering secure topics, ensuring that subscriptions are handled in a way that protects user privacy.

Another unique aspect of Centrifugo PRO is its ability to handle delayed push notifications. This means you can schedule a notification to be sent out at a later time, something that’s not commonly found in other self-hosted push notification services.

In summary, when you choose Centrifugo PRO, you're not just choosing a push notification service. You're choosing a solution that’s designed to handle the complexities of push notifications in a straightforward, efficient manner. It’s a tool that ensures your users, whether they are online or offline, stay connected and engaged.

## Granular observability

Navigating through the intricate world of real-time applications demands a deep understanding of every interaction and message exchange happening within the system. Centrifugo PRO stands out in this regard, offering unparalleled granular observability to developers and teams who strive for excellence. The platform introduces two distinctive features that make all of this possible: User and Channel Tracing, and Real-time Analytics with ClickHouse.

Debugging can sometimes feel like finding a needle in a haystack, especially when dealing with complex, real-time interactions. Centrifugo PRO's User and Channel Tracing feature is the lifeline developers need in these critical moments.

You can seamlessly trace the journey of messages and events, either by diving deep into a particular user's interactions or by scrutinizing the messages flowing through a specific channel. The ability to attach to trace streams via the Centrifugo admin UI or directly from the terminal using CURL and an admin token provides flexibility and power in your hands. This feature becomes indispensable for unraveling hard-to-debug cases, ensuring that no issue remains unsolved and that your application performs flawlessly.

With the integration of ClickHouse, a fast and reliable analytics database, Centrifugo PRO transforms your data into actionable insights. The platform streams a wealth of information, including channel publications, client connections, subscriptions, and push notifications, directly into ClickHouse, facilitating real-time analytics with minimal delay.

This capability is pivotal for understanding connection behaviors, confirming application correctness, and building trends over time. The analytics page within the Centrifugo PRO web UI becomes a powerful tool, granting you immediate access to a plethora of data and trends, all crucial for making informed decisions and driving your application forward.

In essence, Centrifugo PRO's granular observability features are more than just tools; they are allies in the constant battle for perfection in application performance and user experience. User and Channel Tracing provide a lifeline for debugging, especially in those perplexing scenarios where issues seem elusive. The Real-time Analytics with ClickHouse feature transforms data into a strategic asset, enabling trend analysis and actionable insights. With Centrifugo PRO, the path to transparency, control, and informed decision-making has never been clearer.

For hard-to-debug cases
For trending

## Fine-grained rate limiting 

TBD
How it may help in real app.

## Simple and efficient user status API

TBD

## More control over channel permissions

TBD

## Performance optimizations

TBD

## Ongoing features

OIDC for admin UI
Channel occupied/vacated events
Distributed generic rate limiting
More granular metrics resolution
More enhancements for push notifications API

## Conclusion

TBD
