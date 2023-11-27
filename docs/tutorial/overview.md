---
id: overview
sidebar_label: Overview
title: "Building WebSocket chat (messenger) app with Centrifugo"
---

Let's show how to build a more complex application with Centrifugo. With a modern frontend, user authentication, real-time channel permission checks and the main application database as a source of truth for application data. The app we are building here is a WebSocket chat. The internet is full of chat tutorials, what we show here goes beyond usually shown basics.

This tutorial is quite lengthy. We don't want to cut it short because the main goal is to demonstrate the process in detail. To make it possible for Centrifugo users to extrapolate the example to their prefferred technology stack. After reading this full, you should be much more comfortable with Centrifugo design and the idiomatic ways to integrate with it – so you can apply the knowledge within your own applicaion.

## What we are building here

Here is a short demo which demonstrates our final result.

![Chat example](https://raw.githubusercontent.com/centrifugal/centrifuge/master/_examples/chat_json/demo.gif "Chat Demo")

Note, that we have real-time synchronization across all the app, to achieve this in scalable way we will use personal user channels for messages delivery having both user authentication and channel permission checks in the final app. 

For the frontend we will use Vite with React anf Typescript. The frontend will be a single page app (SPA) that communicates with the backend over REST API.

For the backend we will use Python's [Django framework](https://www.djangoproject.com/) and use [Django REST Framework](https://www.django-rest-framework.org/) for making server API.

Centrifugo will handle WebSocket connections and provide a real-time transport layer for delivering chat 
messages to users instantly.

:::tip

We've chosen Django for the backend and React for the frontend here but these could be any other frameworks since Centrifugo is absolutely technology stack agnostic. We had to select sth to show the full process of building real-time WebSocket app – hope details here will help to extrapolate knowledge to another tech stack too. So even if you are not familiar with Django or React but want to understand Centrifugo concepts – consider reading this tutorial full anyway.

:::

## Centrifugo vs Django channels

A little disclaimer about Django and real-time. Python developers know that Django has a popular framework for building real-time applications called [Django Channels](https://channels.readthedocs.io/en/latest/). With Centrifugo you can get some imporant advantages:

* It's possible to use a traditional Django approach for writing application buisiness logic – no need to use ASGI at all if you prefer not to. Simple to integrate into existing Django application.
* You get amazing scalable performance. We will use JWT for authentication and channel authorization to have a possibility to handle millions of concurrent connections with reasonable number of Django backend instances. We will show that having chat rooms with tens of thousands online users is simple to achieve with Centrifugo.
* Centrifugo is a universal real-time component, your real-time transport layer will be decoupled from application core, you can take Centrifugo to any of you projects in the future – no matter which programming language the backend will be built on top of.

## Setting up backend

```
python3 -m venv env
./env/bin/activate
python -m pip install Django
python -m django --version
django-admin startproject app
mv app backend
```

This will create a mysite directory in your current directory with the following contents:

```
backend/
    manage.py
    app/
        __init__.py
        asgi.py
        settings.py
        urls.py
        wsgi.py
```

```
python manage.py startapp chat
```

```
chat/
    __init__.py
    admin.py
    apps.py
    migrations/
        __init__.py
    models.py
    tests.py
    views.py    
```

We need to tell our project that the chat app is installed. Edit the mysite/settings.py file and add 'chat' to the INSTALLED_APPS setting. It’ll look like this:

```
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

## Adding REST to the backend

```
pip install djangorestframework
```

```
# mysite/settings.py
INSTALLED_APPS = [
    'rest_framework',
    'chat',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]
```

## Creating models

Django will help us to quickly create models required for our chat system:

* **User**
* **Room**
* **Room Member** (many to many relationship between **User** and **Room**)
* **Message** (belongs to **Room**, has **User** author)

Add the following to `chat/models.py`

```python
from django.db import models
from django.contrib.auth.models import User

class Room(models.Model):
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, auto_now_add=True)

class RoomMember(models.Model):
    room = models.ForeignKey(Room, related_name='memberships', on_delete=models.CASCADE)
    user = models.ForeignKey(User, related_name='rooms', on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('room', 'user')

class Message(models.Model):
    room = models.ForeignKey(Room, related_name='messages', on_delete=models.CASCADE)
    user = models.ForeignKey(User, related_name='messages', on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
```

## SPA approach and Django

TBD

## Adding React frontend

On the frontend we will use Vite with React and Typescript.

```
npm create vite@latest
```

Call the app `frontend`, select React + Typescript

```
cd frontend
npm install
npm run dev
```

## Chat app layout

We continue building chat app without Centrifugo involved – as in this app we demonstrate one of the principles mentioned in the [design overview](../getting-started/design.md) – app should gracefully degrade if no real-time layer is present or is working.

Our app with have 3 screens:

* Login screen – this will support native Django user/password auth
* Chat room list screen which shows room current user joined to
* Chat room detail screen - i.e. a page with chat messages and possibility to send new one
* Chat room search page to discover new rooms to join

Often in messenger apps you can see the layout where a list of chats is the left column, and chat details shown on the right. We will build a slightly simplified layout here, but we will keep in mind the possibility to switch to the mentioned layout if needed.

## Login screen

TBD

## Chat room list screen

TBD

## Chat room detail screen

TBD

## Send message to chat room

TBD

## Adding Centrifugo connection

TBD

## Subscribing on personal channel

TBD

## Publish real-time message

TBD

## Handle real-time message

TBD

## Transactional outbox for publishing events

TBD

## Using Debezium and Kafka for CDC capture

TBD

## Conclusion

Now look at this guide and notice that Centrifugo integration takes just a small part of it. If you already have the working app with business logic but without real-time events – then adding Centrifugo may take just several hours for the MVP of the real-time feature.

Of course, there are difficulties on the way:

* Decide on authentication and channel permission model – approach mentioned here can't fir every use case, and Centrifugo provide more instruments to choose from
* Decide on Centrifugo configuration regarding message delivery guarantees. Probably move publishing logic to asynchronous task and use outbox pattern

And more! But the core idea is shown here. And we have some cool ideas as an exersize for readers:

* Show how many users are in the chat room using Centrifugo [online presence](../server/presence.md)
* Save message delivery statuses to the application database
* Add typing notifications for even more interactivity
* Introduce chat bots with AI skills

The possibilities are limitless!
