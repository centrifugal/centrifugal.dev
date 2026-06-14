---
description: "Integrate Centrifugo into a chat app with WebSocket connections, JWT authentication, channel subscriptions, and real-time message broadcasting."
id: centrifugo
sidebar_label: "Integrating Centrifugo"
title: "Integrating Centrifugo for real-time event delivery"
---

It's finally time for the real-time! In some cases you already have an application and when integrating Centrifugo you start from here.

To add Centrifugo let's update `docker-compose.yml` file:

```yaml
centrifugo:
  image: centrifugo/centrifugo:v6
  volumes:
    - ./centrifugo:/centrifugo
  command: centrifugo -c config.json
  expose:
    - 8000
```

And put `config.json` to local `centrifugo` directory with the following content:

```json
{
  "log_level": "debug",
  "client": {
    "token": {
      "hmac_secret_key": "secret"
    },
    "allowed_origins": [
      "http://localhost:9000"
    ]
  },
  "http_api": {
    "key": "api_key"
  },
  "channel": {
    "namespaces": [
      {
        "name": "personal"
      }
    ]
  }
}
```

We will be using the `personal` [namespace](../server/channels.md#channel-namespaces) here for user channels. Using separate namespaces for every real-time feature is a recommended approach when working with Centrifugo. Namespaces allow splitting the channel space and configuring behavior separately for different real-time features.

## Adding Centrifugo connection

Our next goal is to connect to Centrifugo from the frontend app. We will do this right after user authenticated and chat layout loaded.

To add the real-time WebSocket connection you need to install Centrifugo's JavaScript SDK – the package is named `centrifuge` (the project is sometimes referred to as `centrifuge-js`):

```bash
npm install centrifuge
```

Then import it in `App.tsx`:

```typescript
import { Centrifuge, SubscriptionState } from 'centrifuge';
import type { PublicationContext, SubscriptionStateContext, SubscribedContext } from 'centrifuge';
```

We also imported some types we will be using in the app (with `import type`, since they are only used in type positions).

To establish a connection with Centrifugo as soon as user authenticated in the app we can use `useEffect` React hook with the dependency on `userInfo`:

```typescript
useEffect(() => {
  if (!userInfo.id) {
    return;
  }

  // Create the client synchronously (not inside an async function) so the cleanup below
  // always has it to disconnect, even if the effect is torn down quickly.
  const centrifuge = new Centrifuge(WS_ENDPOINT, {
    debug: true
  })
  centrifuge.connect()

  return () => {
    centrifuge.disconnect()
  }
}, [userInfo])
```

When user logs out and `userInfo.id` is not set – the connection to server is closed as we do `centrifuge.disconnect()` in `useEffect` cleanup function. Creating the `Centrifuge` instance directly in the effect body (rather than inside an `async` helper) matters: the cleanup function closes over it, so React can always tear the connection down – otherwise a quick unmount could leak a connection.

But if you run the code like this – the connection won't be established. That's bad news! But we also have good news - this means that Centrifugo supports secure communication and we need to authenticate the connection upon establishing it! Let's do this.

## Adding JWT connection authentication

Change `Centrifuge` constructor to:

```typescript
const centrifuge = new Centrifuge(WS_ENDPOINT, {
    getToken: getConnectionToken,
    debug: true
})
```

Where `getConnectionToken` is function like this:

```javascript
export const getConnectionToken = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/token/connection/`, {})
  return response.data.token;
}
```

I.e. it makes a request to the backend and receives a connection JWT in response. Again – the frontend makes a request to the backend to get the Centrifugo connection token. Of course we should implement the view on the backend which processes such requests and generates tokens for authenticated users.

The token must follow specification described in [Client JWT authentication](../server/authentication.md) chapter. Long story short – it's just a JWT from [rfc7519](https://datatracker.ietf.org/doc/html/rfc7519), we can use any JWT library to generate it.

Let's extend `backend/app/views.py` with this view:

```python title="backend/app/views.py"
import jwt

from django.conf import settings


def get_connection_token(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'unauthorized'}, status=401)

    token_claims = {
        'sub': str(request.user.pk),
        'exp': int(time.time()) + 120
    }
    token = jwt.encode(token_claims, settings.CENTRIFUGO_TOKEN_SECRET)

    return JsonResponse({'token': token})
```

– where `jwt` import is a PyJWT library (`pip install PyJWT`). We generate a JWT where the `sub` claim is set to the current user ID and the token expires in 2 minutes.

Note, we are using `settings.CENTRIFUGO_TOKEN_SECRET` here, we need to include this option to `backend/app/settings.py`:

```python title="backend/app/settings.py"
# CENTRIFUGO_TOKEN_SECRET is used to create connection and subscription JWT.
# SECURITY WARNING: make it strong, keep it in secret, never send to the frontend!
CENTRIFUGO_TOKEN_SECRET = 'secret'
```

It must match the value of the `client.token.hmac_secret_key` option from the Centrifugo configuration.

Don't forget to include this view in the `urls.py` configuration, and then you can finally connect to Centrifugo from the frontend: upon page load the `centrifuge-js` SDK makes a request to the backend to load the connection token, establishes a WebSocket connection with Centrifugo passing the connection token. Centrifugo validates the token and since the secrets match, Centrifugo can be sure the token contains valid information about the user.

## Subscribing on personal channel

Awesome! Though simply being connected is not that useful. We want to receive real-time data from Centrifugo. But how will Centrifugo understand how to route published data? Of course, through the channel concept. A client can subscribe to a channel to receive all messages published to that channel.

As mentioned before – for this sort of app using a single individual channel for each user makes a lot of sense.

You can ask – could we simply subscribe to all room channels the current user is a member of? It may be a good thing if you know that users won't have too many groups, let's say 10-100 max. Going above this number will make the UI less efficient. Consider a user who is a member of a thousand groups – it will require a very heavyweight initial subscribe request. What if the user is a member of 10k groups? So moving all the routing complexity to the backend with a single individual channel on the frontend seems a more reasonable approach for our app. And this will also help us to simplify state recovery later.

We already have namespace `personal` configured in Centrifugo – so let's use it to construct individual channel for each user.

```javascript
const personalChannel = 'personal:' + userInfo.id
```

So for a user with id `1` we will have channel `personal:1`, for user `2` – `personal:2` – and so on. Of course in a messenger app we do not want one user to be able to subscribe to a channel belonging to another user. So we will use [subscription token auth](../server/channel_token_auth.md) for channels here. It's also a JWT loaded from the backend. But this JWT must additionally include `channel` claim. So in React we can create Subscription object this way:

```javascript
export const getSubscriptionToken = async (channel: string) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/token/subscription/`, {
    params: { channel: channel }
  });
  return response.data.token;
}

const sub = centrifuge.newSubscription(personalChannel, {
    getToken: () => getSubscriptionToken(personalChannel)
})
sub.on('publication', (ctx: PublicationContext) => {
    // Used to process incoming channel publications. We will talk about it soon.
    onPublication(ctx.data)
})

sub.subscribe()
```

Note that we additionally attach a `channel` URL query parameter when requesting the backend – so the backend understands which channel to generate the subscription JWT for.

On the backend side we check permission to subscribe and return subscription token:

```python title="backend/app/views.py"
def get_subscription_token(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'unauthorized'}, status=401)

    channel = request.GET.get('channel')
    if channel != f'personal:{request.user.pk}':
        return JsonResponse({'detail': 'permission denied'}, status=403)

    token_claims = {
        'sub': str(request.user.pk),
        'exp': int(time.time()) + 300,
        'channel': channel
    }
    token = jwt.encode(token_claims, settings.CENTRIFUGO_TOKEN_SECRET)

    return JsonResponse({'token': token})
```

Please refer to [client SDK spec](../transports/client_api.md#subscription-token) for more information about error handling scenarios.

Let's also finish up the logic with real-time subscription status now:

```typescript
sub.on('state', (ctx: SubscriptionStateContext) => {
  setConnected(ctx.newState === SubscriptionState.Subscribed)
})
```

We keep a simple `connected` boolean in state and render it as a 🟢 / 🔴 indicator in the navbar.

There are several subscription states in all our SDKs - `unsubscribed`, `subscribing`, `subscribed`. You can also listen for them separately for more granular logic and get more detailed information about the reason of subscription loss. See [client SDK spec](../transports/client_api.md) for more detailed description.

Now we should be able to connect (and authenticate) and subscribe to a channel (with authorization). Try to open the browser tools network tab and see WebSocket frames exchanged between client and server (we showed how to see this in [quickstart](../getting-started/quickstart.md)).

## Publish real-time messages

Now we have a real-time WebSocket connection which is subscribed to the user's individual channel. It's time to start publishing messages upon changes in chat rooms. In our case, we send a real-time message in one of the following scenarios:

* someone sends a message to a chat room
* user joins a room
* user leaves a room

But we want all chat room members to receive events. If user `1` sends a messages to chat room, we need to find all current members of this room and publish real-time message to each personal channel. I.e. if three users with IDs `1`, `2` and `3` are members of some room – then we need to publish message to three channels `personal:1`, `personal:2` and `personal:3`. So all the members will be notified about event in real-time.

To efficiently publish message to many channels Centrifugo provides [broadcast](../server/server_api.md#broadcast) API. Let's use HTTP API of Centrifugo:

```python title="backend/chat/views.py"
import requests

from django.conf import settings


class CentrifugoMixin:
    # A helper method to return the list of channels for all current members of specific room.
    # So that the change in the room may be broadcasted to all the members.
    def get_room_member_channels(self, room_id):
        members = RoomMember.objects.filter(room_id=room_id).values_list('user', flat=True)
        return [f'personal:{user_id}' for user_id in members]

    def broadcast_room(self, room, broadcast_payload):
        room_id = room.pk
        room_name = room.name  # used later when we add push notifications
        # Using Centrifugo HTTP API is the simplest way to send real-time message, and usually
        # it provides the best latency. The trade-off here is that error here may result in
        # lost real-time event. Depending on the application requirements this may be fine or not.  
        def broadcast():
            session = requests.Session()
            retries = Retry(total=1, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
            session.mount('http://', HTTPAdapter(max_retries=retries))
            try:
                session.post(
                    settings.CENTRIFUGO_HTTP_API_ENDPOINT + '/api/broadcast',
                    data=json.dumps(broadcast_payload),
                    headers={
                        'Content-type': 'application/json', 
                        'X-API-Key': settings.CENTRIFUGO_HTTP_API_KEY,
                        'X-Centrifugo-Error-Mode': 'transport'
                    }
                )
            except requests.exceptions.RequestException as e:
                logger.error(e)

        # We need to use on_commit here to not send notification to Centrifugo before
        # changes applied to the database. Since we are inside transaction.atomic block
        # broadcast will happen only after successful transaction commit.
        transaction.on_commit(broadcast)


class MessageListCreateAPIView(ListCreateAPIView, CentrifugoMixin):
    # Same as before

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        room_id = self.kwargs['room_id']
        # Only members of the room may post messages to it.
        get_object_or_404(RoomMember, user=request.user, room_id=room_id)
        room = Room.objects.select_for_update().get(id=room_id)
        room.increment_version()
        channels = self.get_room_member_channels(room_id)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(room=room, user=request.user)
        room.last_message = obj
        room.bumped_at = timezone.now()
        room.save()

        # This is where we add code to broadcast over Centrifugo API.
        broadcast_payload = {
            'channels': channels,
            'data': {
                'type': 'message_added',
                'body': serializer.data
            },
            'idempotency_key': f'message_{serializer.data["id"]}'
        }
        self.broadcast_room(room, broadcast_payload)
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
```

Let's mention some important things.

We do broadcasts only after successful commit, using Django's `transaction.on_commit` hook. Otherwise we could get an error on transaction commit - but have already sent a misleading real-time message.

Here we use `requests` library for making HTTP requests (`pip install requests`) and do some retries which is nice to deal with temporary network issues.

We construct list of channels using `values_list` method of Django queryset to make query more efficient.

Both `settings.CENTRIFUGO_HTTP_API_ENDPOINT` and `settings.CENTRIFUGO_HTTP_API_KEY` are set in `settings.py`. The endpoint points at the Centrifugo service (the `centrifugo` docker compose service name), and the API key must match the `http_api.key` option from the Centrifugo configuration file:

```python title="backend/app/settings.py"
# Base URL of the Centrifugo HTTP API – "centrifugo" is the docker compose service name.
CENTRIFUGO_HTTP_API_ENDPOINT = "http://centrifugo:8000"
# CENTRIFUGO_HTTP_API_KEY is used for auth in Centrifugo server HTTP API.
# SECURITY WARNING: make it strong, keep it in secret!
CENTRIFUGO_HTTP_API_KEY = 'api_key'
```

Note the following:

```
'idempotency_key': f'message_{serializer.data["id"]}'
```

When publishing we provide `idempotency_key` to Centrifugo – this allows effectively dropping duplicate publications during configurable time window on Centrifugo side.

Another important thing is how we designed the data of the real-time event – note we've included event `type` field on top level. In this case `message_added`. This approach allows easily expanding possible event types – so the frontend may distinguish between them and process accordingly.

We can extend `JoinRoomView` and `LeaveRoomView` with similar code to also broadcast room membership events:

```python title="backend/chat/views.py"
class JoinRoomView(APIView, CentrifugoMixin):
    # Some code skipped here ....

    @transaction.atomic
    def post(self, request, room_id):
        # Some code skipped here ....
        obj, _ = RoomMember.objects.get_or_create(user=request.user, room=room)
        channels = self.get_room_member_channels(room_id)
        obj.room.member_count = len(channels)
        body = RoomMemberSerializer(obj).data

        broadcast_payload = {
            'channels': channels,
            'data': {
                'type': 'user_joined',
                'body': body
            },
            'idempotency_key': f'user_joined_{obj.pk}'
        }
        self.broadcast_room(room, broadcast_payload)
        return Response(body, status=status.HTTP_200_OK)


class LeaveRoomView(APIView, CentrifugoMixin):
    # Some code skipped here ....

    @transaction.atomic
    def post(self, request, room_id):
        # Some code skipped here ....
        obj = get_object_or_404(RoomMember, user=request.user, room=room)
        obj.room.member_count = len(channels) - 1
        pk = obj.pk
        obj.delete()
        body = RoomMemberSerializer(obj).data

        broadcast_payload = {
            'channels': channels,
            'data': {
                'type': 'user_left',
                'body': body
            },
            'idempotency_key': f'user_left_{pk}'
        }
        self.broadcast_room(room, broadcast_payload)
        return Response(body, status=status.HTTP_200_OK)

```

We would also like to mention the concept of room `version`. Each room has a version field in our app; we increment it by one every time we make some room updates. We then attach the version to every event we publish. This technique may be useful to avoid processing outdated real-time messages on the client side. This is especially useful if we use outbox or CDC techniques where delivery latency increases and the chance to get a real-time message that is no longer current (i.e. the app has already loaded more "fresh" state from the backend) also increases.

## Handle real-time messages

As we already shown above the entrypoint for incoming real-time messages on the frontend side is the `on('publication')` callback of the Subscription object:

```typescript
sub.on('publication', (ctx: PublicationContext) => {
    onPublication(ctx.data)
})
```

Where `onPublication` simply dispatches to a handler based on the event type:

```typescript
const onPublication = (event: RealTimeEvent) => {
  switch (event.type) {
    case 'message_added':
      processMessageAdded(event.body)
      break
    case 'user_joined':
      processUserJoined(event.body)
      break
    case 'user_left':
      processUserLeft(event.body)
      break
  }
}
```

`RealTimeEvent` is a discriminated union of our three event types, declared in `types.ts`. The `type` field lets TypeScript narrow `body` to the right shape in each branch.

We handle events as they arrive – there's no need to queue them. This works because our reducer updates are idempotent (we dedupe rooms and messages by id) and every event carries the room `version` we discussed above, so duplicate or out-of-order events are handled safely. The idempotent state design is exactly what keeps this real-time layer simple.

There is one subtlety though: the subscription is created once (when we connect) and lives for the whole session, so its callback would otherwise close over a stale `chatState`. We keep the latest state in a ref and read `chatStateRef.current` inside the handlers:

```typescript
const chatStateRef = useRef(chatState);
useEffect(() => {
  chatStateRef.current = chatState;
}, [chatState]);
```

Let's look at each handler.

## Handle message added event

Let's look what's going on inside `processMessageAdded` function:

```typescript
const processMessageAdded = async (body: Message) => {
  const roomId = body.room.id
  if (!chatStateRef.current.roomsById[roomId]) {
    const room = await fetchRoom(String(roomId))
    if (room) {
      dispatch({ type: "ADD_ROOMS", payload: { rooms: [room] } })
    }
  }
  if (!chatStateRef.current.messagesByRoomId[roomId]) {
    // First time we see this room – load its history (which already includes this message).
    const messages = await fetchMessages(String(roomId))
    if (messages) {
      dispatch({ type: "ADD_MESSAGES", payload: { roomId: roomId, messages: messages } })
    }
    return
  }
  dispatch({ type: "ADD_MESSAGES", payload: { roomId: roomId, messages: [body] } })
}
```

We load the room if it was not loaded yet, and load the room's messages if it's the first time we see a message in the room.

## Handle user joined event

```typescript
const processUserJoined = async (body: RoomMembership) => {
  const roomId = body.room.id
  if (!chatStateRef.current.roomsById[roomId]) {
    const room = await fetchRoom(String(roomId))
    if (room) {
      dispatch({ type: "ADD_ROOMS", payload: { rooms: [room] } })
    }
  } else {
    dispatch({
      type: "SET_ROOM_MEMBER_COUNT", payload: {
        roomId: roomId,
        version: body.room.version,
        memberCount: body.room.member_count
      }
    })
  }
}
```

## Handle user left event

```typescript
const processUserLeft = async (body: RoomMembership) => {
  const roomId = body.room.id
  const room = chatStateRef.current.roomsById[roomId]
  if (room) {
    if (body.room.version <= room.version) {
      return // Outdated event – we already have a newer version of this room.
    }
    if (userInfo.id === body.user.id) {
      dispatch({ type: "DELETE_ROOM", payload: { roomId: roomId } })
    } else {
      dispatch({
        type: "SET_ROOM_MEMBER_COUNT", payload: {
          roomId: roomId,
          version: body.room.version,
          memberCount: body.room.member_count
        }
      })
    }
  } else if (userInfo.id !== body.user.id) {
    const room = await fetchRoom(String(roomId))
    if (room) {
      dispatch({ type: "ADD_ROOMS", payload: { rooms: [room] } })
    }
  }
}
```

Here the room `version` check shows its value: if we receive a `user_left` event that is older than the room state we already have (for example a late event arriving after we loaded fresher data), we simply ignore it.

## We did it

Awesome – we now have an application with real-time features powered by Centrifugo! Messages and room membership changes are now delivered to users in real-time. Though, it's not the end of our journey. So please, take a break – and then proceed to the next part.
