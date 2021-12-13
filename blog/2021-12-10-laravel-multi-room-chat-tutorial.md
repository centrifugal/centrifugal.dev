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

It helps to make the interaction between the laravel and the centrifugo simple.

Step-by-step configuration can be viewed in the readme file of this library.

Pay attention to the `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY` and `CENTRIFUGO_API_KEY` settings. They must match in the file `.env` and `centrifugo.json`.

As an alternative to this library, you can use [phpcent](https://github.com/centrifugal/phpcent) – it allows publishing to Centrifugo directly.

See more information about Laravel broadcasting [here](https://laravel.com/docs/8.x/broadcasting).

### Interaction with Centrifugo
We use a subscription to a personal channel (https://centrifugal.dev/docs/server/server_subs).

This will allow us to scale more easily in the future, as well as reduce overhead compared to a separate subscription for each room.

You can read more about this in the [documentation](https://centrifugal.dev/docs/faq/index#what-about-best-practices-with-the-number-of-channels)

### Models
Based on the migrations, we will create the corresponding models.

Also, we do not forget to prescribe the necessary relationships.

### Proxy controller
To simplify user authentication, we will use [proxy api](https://centrifugal.dev/docs/server/proxy).
In [proxy controller](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/app/app/Http/Controllers/CentrifugoProxyController.php)
We use auth middleware on the [route](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/app/routes/api.php).

In the response from this endpoint in the channel list, we transmit information that the client subscribes to a personal channel.

### Room controller
[Here](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/app/app/Http/Controllers/RoomController.php) 
we perform various actions with rooms: create rooms, add users to them, publish messages.
When we publish a message in a room, we send a message to the personal channel of all users subscribed to this room using the `broadcast` method (https://centrifugal.dev/docs/server/server_api#broadcast).
We also add some fields in the response that will be used by us when dynamically displaying content (see [Client side](#client-side)).

### Client side
To simplify, we use the same [view](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/app/resources/views/rooms/index.blade.php) 
to create rooms, send/receive messages in a specific room.
On the page we have a form for creating rooms.
The user who created the room automatically subscribes to it.
Other users need to subscribe manually (with `join` button).

When sending a message in the form, we make an ajax request that makes a broadcast message to all users subscribed to this room (see [Room controller](#room-controller)):
```js
messageInput.onkeyup = function(e) {
    if (e.keyCode === 13) {
        e.preventDefault();
        const message = messageInput.value;
        if (!message) {
            return;
        }
        const xhttp = new XMLHttpRequest();
        xhttp.open("POST", "/rooms/" + roomId + "/publish");
        xhttp.setRequestHeader("X-CSRF-TOKEN", csrfToken);
        xhttp.send(JSON.stringify({
            message: message
        }));
        messageInput.value = '';
    }
};
```
After the message is processed on the server and enters the centrifugo, we can process it in the event handler
```js
centrifuge.on('publish', function(ctx) {
    if (ctx.data.roomId.toString() === roomId) {
        const isSelf = ctx.data.senderId.toString() === userId;
        addMessage(ctx.data.text, ctx.data.createdAtFormatted, ctx.data.senderName, isSelf);
        scrollToLastMessage();
    }
    const lastRoomMessageText = document.querySelector('#room-' + ctx.data.roomId + ' .status');
    const lastRoomMessageUserName = document.querySelector('#room-' + ctx.data.roomId + ' .user-name');
    var text = ctx.data.text.substr(0, 15);
    if (ctx.data.text.length > 15) {
        text += "..."
    }
    lastRoomMessageText.innerHTML = text;
    lastRoomMessageUserName.innerHTML = ctx.data.senderName;
});
```
Here we check whether the message belongs to the room the user is currently in.
If yes, then we add it to the message history of the room.
We also add this message to the chat in the list on the left as the last chat message.
If necessary, we crop the text for normal display.

### Possible improvements
* User status (online/offline)
* Pagination of the message history and their auto-loading
* Horizontal scaling (using multiple nodes of the centrifugo)
* Replacing the engine with some other supported one (for example, redis) for better scalability (https://centrifugal.dev/docs/server/engines)
* Replacing connect proxy with JWT to reduce HTTP calls from Centrifugo to Laravel (https://centrifugal.dev/docs/server/authentication)