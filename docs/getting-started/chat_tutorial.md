---
id: chat_tutorial
sidebar_label: "Chat/Messenger tutorial"
title: "Tutorial: building WebSocket chat (messenger) app"
---

Let's also show how to build a more difficult application with Centrifugo. With a modern frontend, proper user authentication, real-time channel permission checks and the main application database as a source of truth for application data. The app we are building here is a WebSocket chat.

This tutorial is quite lengthy — we don't want to cut it short because the goal is to demonstrate the process in detail. To make it possible for Centrifugo users to extrapolate it on their prefferred technology stack. After reading it full, you should be much more comfortable with Centrifugo design and the idiomatic ways to integrate it – so you can apply the knowledge within your own applicaion.

## What we build

Here is a short demo which demonstrates our final result.

![Chat example](https://raw.githubusercontent.com/centrifugal/centrifuge/master/_examples/chat_json/demo.gif "Chat Demo")

For the frontend we will use Vite with React anf Typescript. The frontend will be a single page app (SPA) that communicates with the backend over REST API.

For the backend we will use [Django framework](https://www.djangoproject.com/). But it could be any framework in any programming language since Centrifugo is absolutely backend agnostic.

And Centrifugo will keep WebSocket connections and provide a real-time transport layer for delivering messages to users instantly.

Python developers know that Django has a framework for building real-time applications called [Django Channels](https://channels.readthedocs.io/en/latest/). But with Centrifugo you can get some imporant advantages:

* Centrifugo is a universal real-time component, your real-time transport layer will be decoupled from application core, you can take Centrifugo to any of you projects in the future – no matter which programming language the backend will be built on top of.
* You get amazing scalable performance. And we will use JWT for authentication and channel authorization to have a possibility to handle millions of concurrent connections with reasonable number of Django backend instances.

## Setting up backend

```
python3 -m venv env
./env/bin/activate
python -m pip install Django
python -m django --version
django-admin startproject django_slowstart
```

This will create a mysite directory in your current directory with the following contents:

```
mysite/
    manage.py
    mysite/
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

## Creating chat models

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

## Prepare for JWT authentication

```bash
pip install djangorestframework-simplejwt
```

Update your Django project settings:

Add 'rest_framework_simplejwt.authentication.JWTAuthentication' to the DEFAULT_AUTHENTICATION_CLASSES in your REST_FRAMEWORK settings in settings.py.

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # ... other settings
}
```

```python
from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    # ... other url patterns
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
```

```
python manage.py makemigrations
python manage.py migrate
```

```
python manage.py createsuperuser
```

## Enabling CORS

```
python -m pip install django-cors-headers
```

```
INSTALLED_APPS = [
    ...,
    "corsheaders",
    ...,
]

MIDDLEWARE = [
    ...,
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    ...,
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
]
```

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

Still no Centrifugo! We continue building chat app without Centrifugo involved – as in this app we demonstrate one of the principles mentioned in the [design overview](./design.md) – app should gracefully degrade if no real-time layer is present or is working.

Our app with have 3 screens:

* Login screen
* Chat room list screen
* Chat room detail (chat messages) screen

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
