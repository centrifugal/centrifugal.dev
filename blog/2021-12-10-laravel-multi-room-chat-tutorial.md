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

The design is based on a free example - https://www.bootdey.com/snippets/view/chat-app  
For the backend, we used Laravel (version 8.65) as one of the most popular php frameworks.

Let's get started!

## Setup and start a project
For the convenience of working with the code, we will use docker.  
You can see all the necessary services [here](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/docker-compose.yml)
Also pay attention to the [configuration](https://github.com/centrifugal/examples/tree/master/php_laravel_chat_tutorial/docker/conf) of the centrifugo and nginx.  
We use a subscription to a personal channel (https://centrifugal.dev/docs/server/server_subs)  
In the nginx configuration, you need to add proxying of the web-socket connection (https://www.nginx.com/blog/websocket-nginx/)  
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

If all the services starts correctly, then when you go to the main page [http://localhost/](http://localhost/) you will see:
![Image](/img/laravel_main_page.png)

## Service structure
### Environment
After the first launch of the application, all settings will be copied 
from the file [`.env.example`](https://github.com/centrifugal/examples/blob/master/php_laravel_chat_tutorial/app/.env.example) to `.env`
Next, we will take a closer look at some settings.  

### Database migrations
You can view the database structure [here](https://github.com/centrifugal/examples/tree/master/php_laravel_chat_tutorial/app/database/migrations)  
We will use the following tables:
- tables related to standard user authentication in Laravel (https://laravel.com/docs/8.x/authentication)
- users rooms with many-to-many table (users <=> rooms)
- messages

### Authentication
In the service we use laravel breeze.  
For more information see official docs (https://laravel.com/docs/8.x/starter-kits#laravel-breeze) 

### Broadcasting
For broadcasting as library we use https://github.com/denis660/laravel-centrifugo  
Pay attention to the `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY` and `CENTRIFUGO_API_KEY` settings.  
They must match in the file `.env` and `centrifugo.json`    
As an alternative to this library, you can use https://github.com/centrifugal/phpcent  
See more information about laravel broadcasting [here](https://laravel.com/docs/8.x/broadcasting)

### Proxy controller
### Room controller
### View (some js description)
