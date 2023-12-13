---
id: backend
sidebar_label: "Setting up backend and database"
title: "Setting up backend and database"
---

Let's start building the app. As the first step, create a directory for the new app, let's call it `fusionchat`:

```bash
mkdir fusionchat
cd fusionchat
touch docker-compose.yml
```

We will use `docker compose` to build the app. It will include several services at the end. If you are not familiar with Docker and Docker Compose - we recommend to [learn it first](https://www.simplilearn.com/tutorials/docker-tutorial/docker-compose).

## Start Django project

To start with Django project you will need Python 3. As soon as you have it run:

```bash
python3 -m venv env
./env/bin/activate
python -m pip install Django
python -m django --version
django-admin startproject app
mv app backend
```

This will create `backend` directory in your current directory with the following contents:

```bash
backend/
    manage.py
    app/
        __init__.py
        asgi.py
        settings.py
        urls.py
        wsgi.py
```

For the main chat business logic let's create a new Django `app`:

```bash
cd backend
python manage.py startapp chat
```

This will create `chat` with sth like this inside:

```bash
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

We need to tell our project that the chat app is installed. Edit the `app/settings.py` file and add `'chat'` to the `INSTALLED_APPS` setting. It'll look like this:

```python
# app/settings.py
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

Our backend service will expose REST API for the frontend. The simplest way to add REST in Django is to use [Django Rest framework](https://www.django-rest-framework.org/):

```bash
pip install djangorestframework
pip freeze > requirements.txt
```

Update `INSTALLED_APPS`:

```python
# app/settings.py
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

For the main database we will use [PostgreSQL](https://www.postgresql.org/) here. Add `db` to `docker-compose.yml`:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    volumes:
      - ./postgres_data:/var/lib/postgresql/data/
    environment:
      - POSTGRES_USER=fusion
      - POSTGRES_PASSWORD=fusion
      - POSTGRES_DB=fusion
    expose:
      - 5432
    ports:
      - 5432:5432
```

And properly set `DATABASES` in Django app settings:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'fusion',
        'USER': 'fusion',
        'PASSWORD': 'fusion',
        'HOST': 'db',
        'PORT': '5432',
    }
}
```

Note that in this example we are running everything in Docker, that's why database host is `db` - it matches the service name in `docker-compose.yml`.

Let's also serve Django application when we are running docker compose. We will serve Django using [Gunicorn](https://gunicorn.org/) web server. To achieve that create custom Dockerfile inside `backend` directory:

```Dockerfile title="backend/Dockerfile"
FROM python:3.11.4-slim-buster

WORKDIR /usr/src/app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN pip install --upgrade pip
COPY ./requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["gunicorn",  "app.wsgi", "--reload", "--access-logfile", "-", \
    "--workers", "2", "--bind", "0.0.0.0:8000"]
```

Here we are using `gunicorn` with hot reload here to simplify development, of course you won't do this in production.

Now add `backend` service to `docker-compose.yml`:

```yaml
backend:
  build: ./backend
  volumes:
    - ./backend:/usr/src/app
  expose:
    - 8000
  depends_on:
    - db
```

Note that we pass backend dir to the container, also passing and installing dependencies, as a result we will get Django app served and with hot reload upon source code changes.

## Creating models

Django is great to quickly create domain models required for our chat system. Here is what we need:

* **User** – for user model we will use Django's built-in User model here
* **Room** - the model that describes chat room with unique name
* **RoomMember** – users can join and leave rooms, so this model contains many to many relationship between **User** and **Room**
* **Message** - this describes a message sent to room by some user (belongs to **Room**, has **User** – the author of message)

Add the following to `chat/models.py`:

```python
from django.db import models
from django.contrib.auth.models import User


class Room(models.Model):
    name = models.CharField(max_length=100, unique=True)
    version = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_message = models.ForeignKey(
        'Message', related_name='last_message_rooms',
        on_delete=models.SET_NULL, null=True, blank=True,
    )

    def increment_version(self):
        self.version += 1
        self.save()
        return self.version

    def __str__(self):
        return self.name


class RoomMember(models.Model):
    room = models.ForeignKey(Room, related_name='memberships', on_delete=models.CASCADE)
    user = models.ForeignKey(User, related_name='rooms', on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('room', 'user')

    def __str__(self):
        return f"{self.user.username} in {self.room.name}"


class Message(models.Model):
    room = models.ForeignKey(Room, related_name='messages', on_delete=models.CASCADE)
    # Note, message may have null user – we consider such messages "system". These messages
    # initiated by the backend and have no user author. We are not using such messages in
    # the example currently, but leave the opportunity to extend.
    user = models.ForeignKey(
        User, related_name='messages', on_delete=models.CASCADE, null=True)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
```

Having the models we now need to make database migrations and create tables for them. First run the app:

```bash
docker compose up --build
```

And from another terminal tab run:

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

Let's also create an admin user (or better two!):

```bash
docker compose exec backend python manage.py createsuperuser
```

At this point we have a Django app with a configured database that has all the required tables for our app core entities. To access the app we will add one more element – Nginx reverse proxy. It's usually optional while developing, but in our case it's super-useful since we are building SPA-application and want to serve both frontend and backend from the same domain. But before moving to Nginx configuration we need to add some views to Django app – for user login/logout, and api for rooms, membership and messages. 

## Adding backend API

We need to create some APIs for the application:

* An endpoint to return CSRF token
* Endpoints for user login/logout
* Endpoints for chat API – listing and searching rooms, listing and creating messages, joining/leaving chat rooms.

CSRF and login/logout endpoints are rather trivial to implement with Django. For chat API using Django Rest Framework (DRF) simplifies the task for us drastically. We already defined models above, with DRF we just need to define serializers and viewsets for the desired routes.

### GET /api/csrf/

```python title="backend/app/views.py"
from django.http import JsonResponse
from django.middleware.csrf import get_token


def get_csrf(request):
    return JsonResponse({}, headers={'X-CSRFToken': get_token(request)})
```

### POST /api/login/

```python title="backend/app/views.py"
import json

from django.contrib.auth import authenticate, login
from django.http import JsonResponse
from django.views.decorators.http import require_POST


@require_POST
def login_view(request):
    credentials = json.loads(request.body)
    username = credentials.get('username')
    password = credentials.get('password')

    if not username or not password:
        return JsonResponse({'detail': 'provide username and password'}, status=400)

    user = authenticate(username=username, password=password)
    if not user:
        return JsonResponse({'detail': 'invalid credentials'}, status=400)

    login(request, user)
    return JsonResponse({'user': {'id': user.pk, 'username': user.username}})
```

### POST /api/logout/


```python title="backend/app/views.py"
import json

from django.contrib.auth import logout
from django.http import JsonResponse
from django.views.decorators.http import require_POST


@require_POST
def logout_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'must be authenticated'}, status=403)

    logout(request)
    return JsonResponse({})
```

### GET /api/rooms/search/

For rooms search we will simply return all the rooms sorted by name. As mentioned before for the restful layer we work with models using Django Rest framework. This means we need to tell DRF how to serialize models describing `Serializer` class and then we can use serializers in DRF predefined viewsets to create views.

```python
class RoomSearchSerializer(serializers.ModelSerializer):

    is_member = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Room
        fields = ['id', 'name', 'created_at', 'updated_at', 'is_member']
```

And:

```python
class RoomSearchViewSet(viewsets.ModelViewSet):
    serializer_class = RoomSearchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_membership = RoomMember.objects.filter(
            room=OuterRef('pk'),
            user=user
        )
        return Room.objects.annotate(
            is_member=Exists(user_membership)
        ).order_by('name')
```

### GET /api/rooms/

```python
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']


class LastMessageSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'content', 'user', 'created_at']

class RoomSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    last_message = LastMessageSerializer(read_only=True)

    def get_member_count(self, obj):
        return obj.member_count

    class Meta:
        model = Room
        fields = ['id', 'name', 'version', 'member_count', 'last_message']
```

And:

```python
class RoomListViewSet(ListModelMixin, GenericViewSet):
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Room.objects.annotate(
            member_count=Count('memberships')
        ).filter(
            memberships__user_id=self.request.user.pk
        ).prefetch_related('last_message', 'last_message__user').order_by('-memberships__joined_at')
```

### GET /api/rooms/:room_id/messages/

```python
class MessageRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'version']


class MessageSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    room = MessageRoomSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'content', 'user', 'room', 'created_at']

```

```python
class MessageListCreateAPIView(ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        room_id = self.kwargs['room_id']
        get_object_or_404(RoomMember, user=self.request.user, room_id=room_id)
        return Message.objects.filter(
            room_id=room_id).prefetch_related('user', 'room').order_by('-created_at')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        # Will be shown below.
```

### POST /api/rooms/:room_id/messages/

```python
class MessageListCreateAPIView(ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Shown above.

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        room_id = self.kwargs['room_id']
        room = Room.objects.select_for_update().get(id=room_id)
        room.increment_version()
        channels = self.get_room_member_channels(room_id)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(room=room, user=request.user)
        room.last_message = obj
        room.save()
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
```

### POST /api/rooms/:room_id/join/

```python
class RoomMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    room = RoomSerializer(read_only=True)
    
    class Meta:
        model = RoomMember
        fields = ['room', 'user']
```

```python
class JoinRoomView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, room_id):
        room = Room.objects.select_for_update().get(id=room_id)
        room.increment_version()
        if RoomMember.objects.filter(user=request.user, room=room).exists():
            return Response({"message": "already a member"}, status=status.HTTP_409_CONFLICT)
        obj, _ = RoomMember.objects.get_or_create(user=request.user, room=room)
        channels = self.get_room_member_channels(room_id)
        obj.room.member_count = len(channels)
        body = RoomMemberSerializer(obj).data
        return Response(body, status=status.HTTP_200_OK)
```

### POST /api/rooms/:room_id/leave/

```python
class LeaveRoomView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, room_id):
        room = Room.objects.select_for_update().get(id=room_id)
        room.increment_version()
        channels = self.get_room_member_channels(room_id)
        obj = get_object_or_404(RoomMember, user=request.user, room=room)
        obj.room.member_count = len(channels) - 1
        pk = obj.pk
        obj.delete()
        body = RoomMemberSerializer(obj).data
        return Response(body, status=status.HTTP_200_OK)
```

### Register urls

After serializers and view written, we just need to add urls to route requests to views:

```python title="backend/chat/urls.py"
from django.urls import path

from .views import RoomListViewSet, RoomDetailViewSet, RoomSearchViewSet, \
    MessageListCreateAPIView, JoinRoomView, LeaveRoomView


urlpatterns = [
    path('rooms/', RoomListViewSet.as_view({'get': 'list'}), name='room-list'),
    path('rooms/<int:pk>/', RoomDetailViewSet.as_view({'get': 'retrieve'}), name='room-detail'),
    path('search/', RoomSearchViewSet.as_view({'get': 'list'}), name='room-search'),
    path('rooms/<int:room_id>/messages/', MessageListCreateAPIView.as_view(), name='room-messages'),
    path('rooms/<int:room_id>/join/', JoinRoomView.as_view(), name='join-room'),
    path('rooms/<int:room_id>/leave/', LeaveRoomView.as_view(), name='leave-room')
]
```

And in `app/urls.py`:

```python title="backend/app/urls.py"
from django.contrib import admin
from django.urls import path, include
from django.contrib.staticfiles.urls import staticfiles_urlpatterns

from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/csrf/', views.get_csrf, name='api-csrf'),
    path('api/token/connection/', views.get_connection_token, name='api-connection-token'),
    path('api/token/subscription/', views.get_subscription_token, name='api-subscription-token'),
    path('api/login/', views.login_view, name='api-login'),
    path('api/logout/', views.logout_view, name='api-logout'),
    path('api/', include('chat.urls')),
]

urlpatterns += staticfiles_urlpatterns()
```

So we included all the views we wrote, included chat application urls.

We also serving Django built-in admin - it will allow us to create some rooms to play with. In the example source code you may find some additional code in `chat/admin.py` which registers models in Django admin – we skip it here to save some traffik for you in the response with this page.
