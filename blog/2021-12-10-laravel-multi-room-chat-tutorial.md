---
title: Building a multi-room chat application with Laravel and Centrifugo
tags: [centrifugo, tutorial, laravel, php]
description: In this tutorial, we are integrating Laravel framework with Centrifugo to make a multi-room chat application.
author: Anton Silischev
authorTitle: Centrifugo contributor
authorImageURL: https://github.com/silischev.png
image: /img/laravel_centrifugo.jpg
hide_table_of_contents: false
---

![Image](/img/laravel_centrifugo.jpg)

In this tutorial, we will create a multi-room chat server using the [Laravel framework](https://laravel.com/) and [Centrifugo](https://centrifugal.dev/).

Users of our app will be able to create new rooms, join existing rooms and instantly communicate inside rooms with the help of Centrifugo WebSocket transport.

<!--truncate-->

The result will look like this:

<video width="100%" controls>
  <source src="/img/laravel_chat.mp4" type="video/mp4" />
  Sorry, your browser doesn't support embedded video.
</video>

The layout is based on [this bootstrap chat app template](https://www.bootdey.com/snippets/view/chat-app  ).

For the backend, we are using Laravel (version 8.65) as one of the most popular PHP frameworks. Centrifugo will accept WebSocket client connections and we will implement an integration layer between Laravel and Centrifugo.

## Why integrate Laravel with Centrifugo?

Why would Laravel developers want to integrate a project with Centrifugo for real-time messaging functionality? Well, there are several points which could be a good motivation:

* Centrifugo is [open-source](https://github.com/centrifugal/centrifugo) and self-hosted. So you can run it on your infrastructure. Popular Laravel real-time broadcasting intergrations (Pusher and Ably) are paid cloud solutions. In the scale it will cost you much less than cloud solutions. Of course cloud solutions do not require setup – but everything is a trade-off right? So you should decide for youself.
* Centrifugo is fast and scales well. It has an optimized Redis Engine with client-side sharding and Redis Cluster support. Centrifugo can also scale with KeyDB, Nats, or Tarantool. So it's possible to handle millions of connections distributed over different server nodes.
* Centrifugo provides a variety of features out-of-the-box – some of them are unique, especially for self-hosted real-time servers that scale to many nodes.
* Centrifugo works as a separate service – so can be a universal tool in the developer's pocket, can migrate from one project to another, no matter what programming language or framework is used for business logic.

Hope this makes sense as a good motivation to give Centrifugo a try. Let's get started!

## Setup and start a project

For the convenience of working with the code, we will use docker.  

You can see all the necessary services [here](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/docker-compose.yml)
Also pay attention to the [configuration](https://github.com/centrifugal/examples/tree/master/php_laravel_chat_tutorial/docker/conf) of the centrifugo and nginx.  
We use a subscription to a personal channel (https://centrifugal.dev/docs/server/server_subs)  
In the nginx configuration, you need to add proxying of the web-socket connection (https://www.nginx.com/blog/websocket-nginx/).

Launching containers with services:

```bash
docker-compose up -d
```

At the first launch, the necessary images will be downloaded (if you do not have them).
To make sure that the main service is running, you can look at the container logs:

```bash
docker-compose logs -f app
```

You should see something like this:

```
...
app           | Database seeding completed successfully.
app           | [10-Dec-2021 12:25:05] NOTICE: fpm is running, pid 112
app           | [10-Dec-2021 12:25:05] NOTICE: ready to handle connections
```

In our service there is an [entrypoint](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/docker/entrypoints/app.sh):  
- dependencies are installed via composer
- copying settings from .env.example
- db migrations are performed and the necessary npm packages are installed
- php-fpm starts

As soon as all the services start, go to the main page [http://localhost/](http://localhost/) where you should see:

![Image](/img/laravel_main_page.png)

## Service structure

### Environment

After the first launch of the application, all settings will be copied from the file [`.env.example`](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/app/.env.example) to `.env`. Next, we will take a closer look at some settings.

### Database migrations

You can view the database structure [here](https://github.com/centrifugal/examples/tree/master/php_laravel_chat_tutorial/app/database/migrations).

We will use the following tables:

- tables related to standard user authentication in Laravel (https://laravel.com/docs/8.x/authentication)
- rooms table with many-to-many relation to users
- messages

### Authentication

In the service we are using Laravel breeze. For more information see official docs (https://laravel.com/docs/8.x/starter-kits#laravel-breeze).

### Broadcasting

For broadcasting as library we are using [laravel-centrifugo](https://github.com/denis660/laravel-centrifugo)

Pay attention to the `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY` and `CENTRIFUGO_API_KEY` settings. They must match in the file `.env` and `centrifugo.json`.

As an alternative to this library, you can use [phpcent](https://github.com/centrifugal/phpcent) – it allows publishing to Centrifugo directly.

See more information about Laravel broadcasting [here](https://laravel.com/docs/8.x/broadcasting).

### Proxy controller
### Room controller
### Interaction with Centrifugo (???) proxy, personal channel, etc. 
### View (some js description)
### Possible improvements
