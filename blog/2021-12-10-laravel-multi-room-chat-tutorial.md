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

Users of our chat app will be able to create new rooms, join existing rooms and instantly communicate inside rooms with the help of Centrifugo WebSocket transport.

<!--truncate-->

The result will look like this:

<video width="100%" controls>
  <source src="/img/laravel_chat.mp4" type="video/mp4" />
  Sorry, your browser doesn't support embedded video.
</video>

For the backend, we are using Laravel (version 8.65) as one of the most popular PHP frameworks. Centrifugo v3 will accept WebSocket client connections. And we will implement an integration layer between Laravel and Centrifugo.

For CSS styles we are using recently released Bootstrap 5. And some vanilla JS instead of frameworks like React/Vue/whatever to make frontend code simple to understand for most developers out there. We also using a bit old-fashioned approach here where server renders pages for different rooms/URLs (not a SPA app) mostly for the same reasons – to not overcomplicate things and let you focus on Centrifugo and Laravel integration parts.

To generate fake user avatars we are asking images from https://robohash.org/ which can generate unique robot puctures based on some input string (username in our case). Robots like to chat with each other!

<img src="https://robohash.org/1.png" width="30%" />
<img src="https://robohash.org/2.png" width="30%" />
<img src="https://robohash.org/4.png" width="30%" />
<br /><br /><br />

:::tip

We also have some ideas on furher possible app improvements at the end of this post.

:::

## Why integrate Laravel with Centrifugo?

Why would Laravel developers want to integrate a project with Centrifugo for real-time messaging functionality? That's a good question. There are several points which could be a good motivation:

* Centrifugo is [open-source](https://github.com/centrifugal/centrifugo) and **self-hosted**. So you can run it on your own infrastructure. Popular Laravel real-time broadcasting intergrations (Pusher and Ably) are paid cloud solutions. At scale Centrifugo will cost you less than cloud solutions. Of course cloud solutions do not require additional server setup – but everything is a trade-off right? So you should decide for youself.
* Centrifugo is fast and scales well. It has an optimized Redis Engine with client-side sharding and Redis Cluster support. Centrifugo can also scale with KeyDB, Nats, or Tarantool. So it's possible to handle millions of connections distributed over different server nodes.
* Centrifugo provides a variety of features out-of-the-box – some of them are unique, especially for self-hosted real-time servers that scale to many nodes (like fast message history cache, or maintaining single user connection).
* Centrifugo works as a separate service – so can be a universal tool in the developer's pocket, can migrate from one project to another, no matter what programming language or framework is used for business logic.

Hope this makes sense as a good motivation to give Centrifugo a try. Let's get started!

## Setup and start a project

For the convenience of working with the example, we [wrapped the end result into docker compose](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/docker-compose.yml).

To start the app clone [examples repo](https://github.com/centrifugal/examples), cd into `php_laravel_chat_tutorial` directory and run:

```bash
docker compose up
```

At the first launch, the necessary images will be downloaded (will take some time and network bytes). When the main service is started, you should see something like this in container logs:

```
...
app           | Database seeding completed successfully.
app           | [10-Dec-2021 12:25:05] NOTICE: fpm is running, pid 112
app           | [10-Dec-2021 12:25:05] NOTICE: ready to handle connections
```

Then go to [http://localhost/](http://localhost/) – you should see:

![Image](/img/laravel_main_page.jpg)

Register (using some fake credentials) or sign up – and test the app.

Pay attention to the [configuration](https://github.com/centrifugal/examples/tree/master/php_laravel_chat_tutorial/docker/conf) of Centrifugo and Nginx. Also, on [entrypoint](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/docker/entrypoints/app.sh) which does some things:

- dependencies are installed via composer
- copying settings from .env.example
- db migrations are performed and the necessary npm packages are installed
- php-fpm starts

## Application structure

### Environment settings

After the first launch of the application, all settings will be copied from the file [`.env.example`](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/app/.env.example) to `.env`. Next, we will take a closer look at some settings.

### Database migrations and models

You can view the database structure [here](https://github.com/centrifugal/examples/tree/master/php_laravel_chat_tutorial/app/database/migrations).

We will use the following tables which will be then translated to application models:

- tables related to standard user authentication in Laravel. See https://laravel.com/docs/8.x/authentication
- [rooms](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/app/database/migrations/2021_11_21_000001_create_rooms_table.php) table. Basically - describes different rooms in the app every user can create.
- rooms [many-to-many relation](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/app/database/migrations/2021_11_21_000002_create_users_rooms_table.php) to users. Allows to add users into rooms.
- [messages](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/app/database/migrations/2021_11_21_000003_create_messages_table.php). Keeps message history in rooms.

### Authentication

In the service we are using Laravel Breeze. For more information [see official docs](https://laravel.com/docs/8.x/starter-kits#laravel-breeze).

### Broadcasting

For broadcasting we are using [laravel-centrifugo](https://github.com/denis660/laravel-centrifugo) library. It helps to simplify interaction between Laravel and Centrifugo by providing some convenient wrappers.

Step-by-step configuration can be viewed in the readme file of this library.

Pay attention to the `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY` and `CENTRIFUGO_API_KEY` settings. They must match in the file `.env` and `centrifugo.json`.

:::tip

As an alternative to `laravel-centrifugo`, you can use [phpcent](https://github.com/centrifugal/phpcent) – it allows publishing to Centrifugo directly.

:::

See more information about Laravel broadcasting [here](https://laravel.com/docs/8.x/broadcasting).

### Interaction with Centrifugo

We use a subscription to a personal channel (https://centrifugal.dev/docs/server/server_subs).

This will allow us to scale more easily in the future, as well as reduce overhead compared to a separate subscription for each room.

You can read more about this in the [documentation](https://centrifugal.dev/docs/faq/index#what-about-best-practices-with-the-number-of-channels)

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

## Possible improvements

* Transform to a single page app
* User status (online/offline)
* Message read statuses
* Pagination for the message history
* Horizontal scaling (using multiple nodes of Centrifugo, for example with [Redis Engine](https://centrifugal.dev/docs/server/engines#redis-engine))
* Replacing connect proxy with JWT to reduce HTTP calls from Centrifugo to Laravel (https://centrifugal.dev/docs/server/authentication)

## Credits

The app layout is based on [this bootstrap chat app template](https://www.bootdey.com/snippets/view/chat-app  ).
