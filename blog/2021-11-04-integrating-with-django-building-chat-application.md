---
title: Centrifugo integration with Django – building a basic chat application
tags: [centrifugo, tutorial, django]
description: In this tutorial, we are integrating Django with Centrifugo to make a basic chat application. We are using Centrifugo proxy feature to proxy WebSocket connection events to a Django backend.
author: Alexander Emelin
authorTitle: Ex-Pythonista
authorImageURL: https://github.com/FZambia.png
image: /img/django_tutorial.jpg
hide_table_of_contents: false
---

![Centrifuge](/img/django_tutorial.jpg)

In this tutorial, we will create a basic chat server using the [Django framework](https://www.djangoproject.com/) and [Centrifugo](https://centrifugal.dev/). Our chat application will have two pages:

1. A page that lets you type the name of a chat room to join.
1. A room view that lets you see messages posted in a chat room you joined.

The room view will use a WebSocket to communicate with the Django server (with help from Centrifugo) and listen for any messages that are published to the room channel.

<!--truncate-->

The result will look like this:

![demo](/img/django_chat.gif)

:::tip

Some of you will notice that this tutorial looks very similar to [Chat app tutorial of Django Channels](https://channels.readthedocs.io/en/stable/tutorial/index.html). This is intentional to let Pythonistas already familiar with Django Channels feel how Centrifugo compares to Channels in terms of the integration process.

:::

## Why integrate Django with Centrifugo

Why would Django developers want to integrate a project with Centrifugo for real-time messaging functionality? This is a good question especially since there is a popular Django Channels project which solves the same task.

I found several points which could be a good motivation:

* Centrifugo is fast and scales well. We have an optimized Redis Engine with client-side sharding and Redis Cluster support. Centrifugo can also scale with KeyDB, Nats, or Tarantool. So it's possible to handle millions of connections distributed over different server nodes.
* Centrifugo provides a variety of features out-of-the-box – some of them are unique, especially for real-time servers that scale to many nodes. Check out our doc!
* With Centrifugo you don't need to rewrite the existing application to introduce real-time messaging features to your users.
* Centrifugo works as a separate service – so can be a universal tool in the developer's pocket, can migrate from one project to another, no matter what programming language or framework is used for business logic.

## Prerequisites

We assume that you are already familiar with basic Django concepts. If not take a look at the official [Django tutorial](https://docs.djangoproject.com/en/stable/intro/tutorial01/) first and then come back to this tutorial.

Also, make sure you read a bit about Centrifugo – [introduction](https://centrifugal.dev/docs/getting-started/introduction) and [quickstart tutorial](https://centrifugal.dev/docs/getting-started/quickstart).

We also assume that you have [Django installed](https://docs.djangoproject.com/en/stable/intro/install/) already.

One possible way to quickly install Django locally is to create virtualenv, activate it, and install Django:

```bash
python3 -m venv env
. env/bin/activate
pip install django
```

Alos, make sure you have Centrifugo v3 [installed](/docs/getting-started/installation) already.

This tutorial also uses Docker to run Redis. We use Redis as a Centrifugo engine – this allows us to have a scalable solution in the end. Using Redis is optional actually, Centrifugo uses a Memory engine by default (but it does not allow scaling Centrifugo nodes). We will also run Nginx with Docker to serve the entire app. [Install Docker](https://www.docker.com/get-started) from its official website but I am sure you already have one.

## Creating a project

First, let's create a Django project.

From the command line, `cd` into a directory where you’d like to store your code, then run the following command:

```bash
django-admin startproject mysite
```

This will create a mysite directory in your current directory with the following contents:

```
❯ tree mysite
mysite
├── manage.py
└── mysite
    ├── __init__.py
    ├── asgi.py
    ├── settings.py
    ├── urls.py
    └── wsgi.py
```

## Creating the chat app

We will put the code for the chat server inside `chat` app.

Make sure you’re in the same directory as `manage.py` and type this command:

```bash
python3 manage.py startapp chat
```

That’ll create a directory chat, which is laid out like this:

```
❯ tree chat
chat
├── __init__.py
├── admin.py
├── apps.py
├── migrations
│   └── __init__.py
├── models.py
├── tests.py
└── views.py
```

For this tutorial, we will only be working with `chat/views.py` and `chat/__init__.py`. Feel free to remove all other files from the chat directory.

After removing unnecessary files, the chat directory should look like this:

```
❯ tree chat
chat
├── __init__.py
└── views.py
```

We need to tell our project that the chat app is installed. Edit the `mysite/settings.py` file and add 'chat' to the `INSTALLED_APPS` setting. It’ll look like this:

```python
# mysite/settings.py
INSTALLED_APPS = [
    'chat',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]
```

## Add the index view

We will now create the first view, an index view that lets you type the name of a chat room to join.

Create a templates directory in your chat directory. Within the templates directory, you have just created, create another directory called `chat`, and within that create a file called `index.html` to hold the template for the index view.

Your chat directory should now look like this:

```
❯ tree chat
chat
├── __init__.py
├── templates
│   └── chat
│       └── index.html
└── views.py
```

Put the following code in chat/templates/chat/index.html:

```html title="chat/templates/chat/index.html"
<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8" />
    <title>Select a chat room</title>
</head>

<body>
    <div class="center">
        <div class="input-wrapper">
            <input type="text" id="room-name-input" />
        </div>
        <div class="input-help">
            Type a room name to <a id="room-name-submit" href="#">JOIN</a>
        </div>
    </div>
    <script>
        const nameInput = document.querySelector('#room-name-input');
        const nameSubmit = document.querySelector('#room-name-submit');
        nameInput.focus();
        nameInput.onkeyup = function (e) {
            if (e.keyCode === 13) {  // enter, return
                nameSubmit.click();
            }
        };
        nameSubmit.onclick = function (e) {
            e.preventDefault();
            var roomName = nameInput.value;
            if (!roomName) {
                return;
            }
            window.location.pathname = '/chat/room/' + roomName + '/';
        };
    </script>
</body>

</html>
```

Create the view function for the room view. Put the following code in `chat/views.py`:

```python title="chat/views.py"
from django.shortcuts import render

def index(request):
    return render(request, 'chat/index.html')
```

To call the view, we need to map it to a URL - and for this, we need a URLconf.

To create a URLconf in the chat directory, create a file called `urls.py`. Your app directory should now look like this:

```
❯ tree chat
chat
├── __init__.py
├── templates
│   └── chat
│       └── index.html
└── views.py
└── urls.py
```

In the `chat/urls.py` file include the following code:

```python title="chat/urls.py"
from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
]
```

The next step is to point the root URLconf at the `chat.urls` module. In `mysite/urls.py`, add an import for `django.conf.urls.include` and insert an include() in the urlpatterns list, so you have:

```python title="mysite/urls.py"
from django.conf.urls import include
from django.urls import path
from django.contrib import admin

urlpatterns = [
    path('chat/', include('chat.urls')),
    path('admin/', admin.site.urls),
]
```

Let’s verify that the index view works. Run the following command:

```bash
python3 manage.py runserver
```

You’ll see the following output on the command line:

```
Watching for file changes with StatReloader
Performing system checks...

System check identified no issues (0 silenced).

You have 18 unapplied migration(s). Your project may not work properly until you apply the migrations for app(s): admin, auth, contenttypes, sessions.
Run 'python manage.py migrate' to apply them.
October 21, 2020 - 18:49:39
Django version 3.1.2, using settings 'mysite.settings'
Starting development server at http://localhost:8000/
Quit the server with CONTROL-C.
```

Go to [http://localhost:8000/chat/](http://localhost:8000/chat/) in your browser and you should see the a text input to provide a room name.

Type in "lobby" as the room name and press Enter. You should be redirected to the room view at [http://localhost:8000/chat/room/lobby/](http://localhost:8000/chat/room/lobby/) but we haven’t written the room view yet, so you’ll get a "Page not found" error page.

Go to the terminal where you ran the runserver command and press Control-C to stop the server.

## Add the room view

We will now create the second view, a room view that lets you see messages posted in a particular chat room.

Create a new file `chat/templates/chat/room.html`. Your app directory should now look like this:

```
chat
├── __init__.py
├── templates
│   └── chat
│       ├── index.html
│       └── room.html
├── urls.py
└── views.py
```

Create the view template for the room view in `chat/templates/chat/room.html`:

```html title="chat/templates/chat/room.html"
<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8" />
    <title>Chat Room</title>
    <script src="https://cdn.jsdelivr.net/gh/centrifugal/centrifuge-js@2.8.3/dist/centrifuge.min.js"></script>
</head>

<body>
    <ul id="chat-thread" class="chat-thread"></ul>
    <div class="chat-message">
        <input id="chat-message-input" class="chat-message-input" type="text" autocomplete="off" autofocus />
    </div>
    {{ room_name|json_script:"room-name" }}
    <script>
        const roomName = JSON.parse(document.getElementById('room-name').textContent);
        const chatThread = document.querySelector('#chat-thread');
        const messageInput = document.querySelector('#chat-message-input');

        const centrifuge = new Centrifuge("ws://" + window.location.host + "/connection/websocket");

        centrifuge.on('connect', function (ctx) {
            console.log("connected", ctx);
        });

        centrifuge.on('disconnect', function (ctx) {
            console.log("disconnected", ctx);
        });

        const sub = centrifuge.subscribe('rooms:' + roomName, function (ctx) {
            const chatNewThread = document.createElement('li');
            const chatNewMessage = document.createTextNode(ctx.data.message);
            chatNewThread.appendChild(chatNewMessage);
            chatThread.appendChild(chatNewThread);
            chatThread.scrollTop = chatThread.scrollHeight;
        });

        centrifuge.connect();

        messageInput.focus();
        messageInput.onkeyup = function (e) {
            if (e.keyCode === 13) {  // enter, return
                e.preventDefault();
                const message = messageInput.value;
                if (!message) {
                    return;
                }
                sub.publish({ 'message': message });
                messageInput.value = '';
            }
        };
    </script>
</body>

</html>
```

Create the view function for the room view in `chat/views.py`:

```python title="chat/views.py"
from django.shortcuts import render


def index(request):
    return render(request, 'chat/index.html')


def room(request, room_name):
    return render(request, 'chat/room.html', {
        'room_name': room_name
    })
```

Create the route for the room view in `chat/urls.py`:

```python
# chat/urls.py
from django.urls import path, re_path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    re_path('room/(?P<room_name>[A-z0-9_-]+)/', views.room, name='room'),
]
```

Start the development server:

```
python3 manage.py runserver
```

Go to [http://localhost:8000/chat/](http://localhost:8000/chat/) in your browser and to see the index page.

Type in "lobby" as the room name and press enter. You should be redirected to the room page at [http://localhost:8000/chat/lobby/](http://localhost:8000/chat/lobby/) which now displays an empty chat log.

Type the message "hello" and press Enter. Nothing happens! In particular, the message does not appear in the chat log. Why?

The room view is trying to open a WebSocket connection with Centrifugo using the URL `ws://localhost:8000/connection/websocket` but we haven’t started Centrifugo to accept WebSocket connections yet. If you open your browser’s JavaScript console, you should see an error that looks like this:

```
WebSocket connection to 'ws://localhost:8000/connection/websocket' failed
```

And since port 8000 has already been allocated we will start Centrifugo at a different port actually.

## Starting Centrifugo server

As promised we will use Centrifugo with Redis engine. So first thing to do before running Centrifugo is to start Redis:

```bash
docker run -it --rm -p 6379:6379 redis:6
```

Then create a configuration file for Centrifugo:

```json
{
    "port": 8001,
    "engine": "redis",
    "redis_address": "redis://localhost:6379",
    "allowed_origins": "http://localhost:9000",
    "proxy_connect_endpoint": "http://localhost:8000/chat/centrifugo/connect/",
    "proxy_publish_endpoint": "http://localhost:8000/chat/centrifugo/publish/",
    "proxy_subscribe_endpoint": "http://localhost:8000/chat/centrifugo/subscribe/",
    "proxy_http_headers": ["Cookie"],
    "namespaces": [
        {
            "name": "rooms",
            "publish": true,
            "proxy_publish": true,
            "proxy_subscribe": true
        }
    ]
}
```

And run Centrifugo with it like this:

```bash
centrifugo -c config.json
```

Let's describe some options we used here:

* `port` - sets the port Centrifugo runs on since we are running everything on localhost we make it different (8001) from the port allocated for the Django server (8000).
* `engine` - as promised we are using Redis engine so we can easily scale Centrifigo nodes to handle lots of WebSocket connections
* `redis_address` allows setting Redis address
* `allowed_origins` - we will connect from `http://localhost:9000` so we need to allow it
* `namespaces` – we are using `rooms:` prefix when subscribing to a channel, i.e. using Centrifugo `rooms` namespace. Here we define this namespace and tell Centrifigo to proxy subscribe and publish events for channels in the namespace. 

:::tip

It's a good practice to use different namespaces in Centrifugo for different real-time features as this allows enabling only required options for a specific task. 

:::

Also, config has some options related to [Centrifugo proxy feature](/docs/server/proxy). This feature allows proxying WebSocket events to the configured endpoints. We will proxy three types of events:

1. Connect (called when a user establishes WebSocket connection with Centrifugo)
1. Subscribe (called when a user wants to subscribe on a channel)
1. Publish (called when a user tries to publish data to a channel)

## Adding Nginx

In Centrifugo config we set endpoints which we will soon implement inside our Django app. You may notice that the allowed origin has a URL with port `9000`. That's because we want to proxy Cookie headers from a persistent connection established with Centrifugo to the Django app and need Centrifugo and Django to share the same origin (so browsers can send Django session cookies to Centrifugo).

While not used in this tutorial (we will use fake `tutorial-user` as user ID here) – this can be useful if you decide to authenticate connections using Django native sessions framework later. To achieve this we should also add Nginx with a configuration like this:

```text title="nginx.conf"
events {
    worker_connections 1024;
}

error_log /dev/stdout info;

http {
    access_log /dev/stdout;

    server {
        listen 9000;

        server_name localhost;

        location / {
            proxy_pass http://host.docker.internal:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /connection/websocket {
            proxy_pass http://host.docker.internal:8001;
            proxy_http_version 1.1;
            proxy_buffering off;
            keepalive_timeout 65;
            proxy_read_timeout 60s;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

Start Nginx (replace the path to `nginx.conf` to yours):

```bash
docker run -it --rm -v /path/to/nginx.conf:/etc/nginx/nginx.conf:ro -p 9000:9000 --add-host=host.docker.internal:host-gateway nginx
```

Note that we are exposing port 9000 to localhost and use a possibility to use `host.docker.internal` host to communicate from inside Docker network with services which are running on localhost (on the host machine). See [this answer on SO](https://stackoverflow.com/questions/31324981/how-to-access-host-port-from-docker-container).

Open [http://localhost:9000](http://localhost:9000). Nginx should now properly proxy requests to Django server and to Centrifugo, but we still need to do some things.

## Implementing proxy handlers

Well, now if you try to open a chat page with Nginx, Centrifugo, Django, and Redis running you will notice some errors in Centrifugo logs. That's because Centrifugo tries to proxy WebSocket connect events to Django to authenticate them but we have not created event handlers in Django yet. Let's fix this.

Extend chat/urls.py:

```python title="chat/urls.py"
from django.urls import path, re_path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    re_path('room/(?P<room_name>[A-z0-9_-]+)/', views.room, name='room'),
    path('centrifugo/connect/', views.connect, name='connect'),
    path('centrifugo/subscribe/', views.subscribe, name='subscribe'),
    path('centrifugo/publish/', views.publish, name='publish'),
]
```

Extend chat/views.py:

```python title="chat/views.py"
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def connect(request):
    # In connect handler we must authenticate connection.
    # Here we return a fake user ID to Centrifugo to keep tutorial short.
    # More details about connect result format can be found in proxy docs:
    # https://centrifugal.dev/docs/server/proxy#connect-proxy
    logger.debug(request.body)
    response = {
        'result': {
            'user': 'tutorial-user'
        }
    }
    return JsonResponse(response)

@csrf_exempt
def publish(request):
    # In publish handler we can validate publication request initialted by a user.
    # Here we return an empty object – thus allowing publication.
    # More details about publish result format can be found in proxy docs:
    # https://centrifugal.dev/docs/server/proxy#publish-proxy
    response = {
        'result': {}
    }
    return JsonResponse(response)

@csrf_exempt
def subscribe(request):
    # In subscribe handler we can validate user subscription request to a channel.
    # Here we return an empty object – thus allowing subscription.
    # More details about subscribe result format can be found in proxy docs:
    # https://centrifugal.dev/docs/server/proxy#subscribe-proxy
    response = {
        'result': {}
    }
    return JsonResponse(response)        
```

`connect` view will accept all connections and return user ID as `tutorial-user`. In real app you most probably want to use Django sessions and return real authenticated user ID instead of `tutorial-user`. Since we told Centrifugo to proxy connection `Cookie` headers native Django user authentication will work just fine. 

Restart Django and try the chat app again. You should now successfully connect. Open a browser tab to the room page at [http://localhost:9000/chat/room/lobby/](http://localhost:9000/chat/room/lobby/). Open a second browser tab to the same room page.

In the second browser tab, type the message "hello" and press Enter. You should now see "hello" echoed in the chat log in both the second browser tab and in the first browser tab.

You now have a basic fully-functional chat server!

## What could be improved

The list is large, but it's fun to do. To name some possible improvements:

* Replace `tutorial-user` used here with native Django session framework. We already proxying the `Cookie` header to Django from Centrifugo, so you can reuse native Django authentication. Only allow authenticated users to join rooms.
* Create `Room` model and add users to it – thus you will be able to check permissions inside subscribe and publish handlers.
* Create `Message` model to display chat history in `Room`.
* Replace Django devserver with something more suitable for production like [Gunicorn](https://gunicorn.org/).
* Check out Centrifugo possibilities like presence to display online users.
* Use [cent](https://github.com/centrifugal/cent) Centrifugo HTTP API library to publish something to a user on behalf of a server. In this case you can avoid using publish proxy, publish messages to Django over convinient AJAX call - and then call Centrifugo HTTP API to publish message into a channel.
* You can replace connect proxy (which is an HTTP call from Centrifugo to Django on each connect) with JWT authentication. JWT authentication may result in a better application performance (since no additional proxy requests will be issued on connect). It can allow your Django app to handle millions of users on a reasonably small hardware and survive mass reconnects from all those users. More details can be found in [Scaling WebSocket in Go and beyond](https://centrifugal.dev/blog/2020/11/12/scaling-websocket) blog post.
* Instead of using subscribe proxy you can put channel into connect proxy result or into JWT – thus using [server-side subscriptions](/docs/server/server_subs) and avoid subscribe proxy HTTP call.

One more thing I'd like to note is that if you aim to build a chat application like WhatsApp or Telegram where you have a screen with list of chats (which can be pretty long!) you should not create a separate channel for each room. In this case using separate channel per room does not scale well and you better use personal channel for each user to receive all user-related messages. And as soon as message published to a chat you can send message to each participant's channel. In this case, take a look at Centrifugo [broadcast API](/docs/server/server_api#broadcast).

## Tutorial source code with docker-compose

The full example which can run by issuing a single `docker compose up` [can be found on Github](https://github.com/centrifugal/examples/tree/master/v3/python_django_chat_tutorial). It also has some CSS styles so that the chat looks like shown in the beginning.

## Conclusion

Here we implemented a basic chat app with Django and Centrifugo.

While a chat still requires work to be suitable for production this example can help understand core concepts of Centrifugo - specifically channel namespaces and proxy features.

It's possible to use unidirectional Centrifugo transports instead of bidirectional WebSocket used here – in this case, you can go without using `centrifuge-js` at all.

Centrifugo scales perfectly if you need to handle more connections – thanks to Centrifugo built-in PUB/SUB engines.

It's also possible to use server-side subscriptions, keep channel history cache, use JWT authentication instead of connect proxy, enable channel presence, and more. All the power of Centrifugo is in your hands.

Hope you enjoyed this tutorial. And let the Centrifugal force be with you!

Join our [community channels](/docs/getting-started/introduction#join-community) in case of any questions left after reading this.
