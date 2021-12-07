---
title: Building a multi-room chat application with Laravel and Centrifugo
tags: [centrifugo, tutorial, laravel, php]
description: In this tutorial, we are integrating Laravel framework with Centrifugo to make a multi-room chat application.
author: Anton Silischev
authorTitle: Centrifugo contributor
authorImageURL: https://github.com/silischev.png
image: /img/laravel_centrifugo.png
hide_table_of_contents: false
---

![Image](/img/laravel_centrifugo.png)

In this tutorial, we will create a multi-room chat server using the [Laravel framework](https://laravel.com/) and [Centrifugo](https://centrifugal.dev/).

Users of our app will be able to create new rooms, join existing rooms and instantly communicate inside rooms with the help of Centrifugo WebSocket transport.

<!--truncate-->

The result will look like this:

<video width="100%" controls>
  <source src="/img/laravel_chat.mp4" type="video/mp4" />
  Sorry, your browser doesn't support embedded video.
</video>

Let's get started!
