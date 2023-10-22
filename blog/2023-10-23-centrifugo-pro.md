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

TBD

## Granular observability

For hard-to-debug cases
For trends

TBD

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
