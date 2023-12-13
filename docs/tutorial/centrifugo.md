---
id: centrifugo
sidebar_label: "Integrating Centrifugo"
title: "Integrating Centrifugo for real-time event delivery"
---

It's finally time for the real-time! In some cases you already have an application and when integrating Centrifugo you start from here. 

To add Centrifugo let's update `docker-compose.yml` file:

```yaml
centrifugo:
  image: centrifugo/centrifugo:v5.1.1
  volumes:
    - ./centrifugo/config.json:/centrifugo/config.json
  command: centrifugo -c config.json
  expose:
    - 8000
```

And put `config.json` to local `centrifugo` directory with the following content:

```json
{
    "log_level": "debug",
    "allowed_origins": ["http://localhost:9000"],
    "token_hmac_secret_key": "secret",
    "api_key": "api_key",
    "namespaces": [{
        "name": "personal"
    }]
}
```

We will be using `personal` namespace here for user channels. Using separate namespaces for every real-time feature is a recommended approach when working with Centrifugo. Namespace allow splitting channel space and configure behavior separately for different real-time features.

## Adding Centrifugo connection

Our next goal is to connect to Centrifugo from the frontend app. We will do this right after user authenticated and chat layout loaded.

To add real-time WebSocket connection you need to install `centrifuge-js` - Centrifugo SDK for Javascript.

```bash
npm install centrifuge
```

Then import it in `App.jsx`:

```
import {
  Centrifuge, PublicationContext, State, StateContext,
  SubscribedContext } from 'centrifuge';
```

We also imported some types we will be using in the app.

To establish a connection with Centrifugo as soon as user authenticated in the app we can use `useEffect` React hook with the dependency on `userInfo`:

```javascript
useEffect(() => {
  if (!userInfo.id) {
    return;
  }

  let centrifuge: Centrifuge | null = null;

  const init = async () => {
    centrifuge = new Centrifuge(WS_ENDPOINT, {
      debug: true
    })

    centrifuge.on('state', (ctx: StateContext) => {
      if (ctx.newState == State.Connected) {
        setConnected(true)
      } else {
        setConnected(false)
      }
    })

    centrifuge.connect()
  }

  // As soon as we get authenticated user – init our app.
  init()

  return () => {
    if (centrifuge) {
      console.log("disconnect Centrifuge")
      centrifuge.disconnect()
    }
  }
}, [userInfo])
```

When user logs out and `userInfo.id` is not set – the connection to server is closed as we do `centrifuge.disconnect()` in `useEffect` cleanup function.

Note, that we've also implemented changing connection status here – as soon as we connected to Centrifugo we call `setConnected` state hook and this allows us to draw 🟢. Otherwise - we draw 🔴. To do this we addded listener to `state` event. There are several connection states in all our SDKs - `disconnected`, `connecting`, `connected`. You can also listen for them separately and ge more detailed information abput the reason of connecting lost, or about client id set by Centrifugo when client is connected. See [client SDK spec](../transports/client_api.md) for more detailed description.

But if you run the code like this – connection won't be established. That's bad news! But we also have good news - this means that Centrifugo supports secure communication and we need to authenticate connection upon establishing! Let's do this.

## Adding JWT connection authentication

Change `Centrifuge` constructor to:

```javascript
centrifuge = new Centrifuge(WS_ENDPOINT, {
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

I.e. it makes request to the backend and receives connection JWT in response. Again – frontend makes request to the backend to get Centrifugo connection token. Of course we should implement the view on the backend which processes such requests and generates tokens for authenticated users.

The token must follow specification described in [Client JWT authentication](../server/authentication.md) chapter. Long story short – it's just a JWT from [rfc7519](https://datatracker.ietf.org/doc/html/rfc7519), we can use any JWT library to generate it.

Let's extend `backend/app/view.py` with this view:

```python
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

– where `jwt` import is a PyJWT library (`pip install PyJWT`). We generate JWT where `sub` claim is set to current user ID and token expires in 2 minutes.

Note, we are using `settings.CENTRIFUGO_TOKEN_SECRET` here, we need to include this option to `backend/app/settings.py`:

```python
# CENTRIFUGO_TOKEN_SECRET is used to create connection and subscription JWT.
# SECURITY WARNING: make it strong, keep it in secret, never send to the frontend!
CENTRIFUGO_TOKEN_SECRET = 'secret'
```

It must match the value of `"token_hmac_secret_key"` option from Centrifugo configuration.

Don't forget to include this view to `urls.py` configuration, and then you can finally connect to Centrifugo from the frontend: upon page load `centrifuge-js` SDK makes request to the backend to load connection token, establishes WebSocket connection with Centrifugo passing connection token. Centrifugo validates token and since secrets match Centrifugo may be sure the token contains valid information about user.

## Subscribing on personal channel

Awesome! Though simply being connecting is not that useful. We want to receive real-time data from Centrifugo. But how Centrifugo will understand how to route published data? Of course due to channel concept. Client can subscribe to channel to receive all messages published to that channel.

As mention before – for this sort of app using a single individual channel for each user makes a lot of sense. We already have namespace `personal` configured in Centrifugo – so let's use it to construct individual channel for each user.

```javascript
const personalChannel = 'personal:' + userInfo.id
```

So for user with id `1` we will have channel `personal:1`, for user `2` – `personal:2` – and so on. Of course in messenger app we do not want one user to be able to subscribe on the channel belonging to another user. So we will use [subscription token auth](../server/channel_token_auth.md) for channels here. It's also a JWT loaded from the backend. But this JWT must additionally include `channel` claim. So in React we can create Subscription object this way:

```javascript
export const getSubscriptionToken = async (channel: string) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/token/subscription/`, {
    params: { channel: channel }
  });
  return response.data.token;
}

const getPersonalChannelSubscriptionToken = async () => {
    return getSubscriptionToken(personalChannel)
}

const sub = centrifuge.newSubscription(personalChannel, {
    getToken: getPersonalChannelSubscriptionToken
})
sub.on('publication', (ctx: PublicationContext) => {
    // Used to process incoming channel publications. We will talk about it soon.
    onPublication(ctx.data)
})
sub.subscribe()
```

Note that we additionally attach `channel` URL query param when requesting backend – so the backend understands which channel to generate subscription JWT for.

On the backend side we check permission to subscribe and return subscription token:

```python
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

Now we should be able to connect (and authenticate!) and subscribe to channel (with authorization!). Try to open browser tools network tab and see WebSocket frames exchanged between client and server (we showed how to see this in [quickstart](../getting-started/quickstart.md)).

## Publish real-time messages

Now we have real-time WebSocket connection which is subscribed to user individual channel. It's time to start publishing messages upon changes in chat rooms. In out case, we send a real-time message in one of the following scenarios:

* someone sends a message to a chat room
* user joins a room
* user leaves a room

But we want all chat room members to receive events. If user `1` sends a messages to chat room, we need to find all current members of this room and publish real-time message to each personal channel. I.e. if three users with IDs `1`, `2` and `3` are members of some room – then we need to publish message to three channels `personal:1`, `personal:2` and `personal:3`. So all the members will be notified about event in real-time.

To efficiently publish message to many channels Centrifugo provides [broadcast](../server/server_api.md#broadcast) API. Let's use HTTP API of Centrifugo:

```python
import requests

from django.conf import settings


class CentrifugoMixin:
    # A helper method to return the list of channels for all current members of specific room.
    # So that the change in the room may be broadcasted to all the members.
    def get_room_member_channels(self, room_id):
        members = RoomMember.objects.filter(room_id=room_id).values_list('user', flat=True)
        return [f'personal:{user_id}' for user_id in members]

    def broadcast_room(self, room_id, broadcast_payload):
        # Using Centrifugo HTTP API is the simplest way to send real-time message, and usually
        # it provides the best latency. The trade-off here is that error here may result in
        # lost real-time event. Depending on the application requirements this may be fine or not.  
        def broadcast():
            session = requests.Session()
            retries = Retry(total=1, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
            session.mount('http://', HTTPAdapter(max_retries=retries))
            try:
                session.post(
                    "http://centrifugo:8000/api/broadcast",
                    data=json.dumps(broadcast_payload),
                    headers={
                        'Content-type': 'application/json', 
                        'X-API-Key': settings.CENTRIFUGO_HTTP_API_KEY,
                        'X-Centrifugo-Error-Mode': 'transport'
                    }
                )
            except requests.exceptions.RequestException as e:
                logging.error(e)

        # We need to use on_commit here to not send notification to Centrifugo before
        # changes applied to the database. Since we are inside transaction.atomic block
        # broadcast will happen only after successful transaction commit.
        transaction.on_commit(broadcast)


class MessageListCreateAPIView(ListCreateAPIView, CentrifugoMixin):
    # Same as before

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

        # This is where we add code to broadcast over Centrifugo API.
        broadcast_payload = {
            'channels': channels,
            'data': {
                'type': 'message_added',
                'body': serializer.data
            },
            'idempotency_key': f'message_{serializer.data["id"]}'
        }
        self.broadcast_room(room_id, broadcast_payload)
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
```

Let's mention some important things.

We do broadcasts only after successful commit, using Django's `transaction.on_commit` hook. Otherwise transaction we could get an error on transaction commit - but send misleading real-time message.

Here we use `requests` library for making HTTP requests (`pip install requests`) and do some retries which is nice to deal with temporary network issues.

We construct list of channels using `values_list` method of Djanfo queryset to make query more efficient.

We also using `settings.CENTRIFUGO_HTTP_API_KEY` which is set in `settings.py` and matches `api_key` option from Centrifugo configuration file:

```
# CENTRIFUGO_HTTP_API_KEY is used for auth in Centrifugo server HTTP API.
# SECURITY WARNING: make it strong, keep it in secret!
CENTRIFUGO_HTTP_API_KEY = 'api_key'
```

Note the following:

```
'idempotency_key': f'message_{serializer.data["id"]}'
```

When publishing we provide `idempotency_key` to Centrifugo – this allows effectively dropping duplicate publications during configurable time window on Centrifugo side.

We can extend `JoinRoomView` and `LeaveRoomView` with similar code to also broadcast room membership events:

```python
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
        self.broadcast_room(room_id, broadcast_payload)
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
        self.broadcast_room(room_id, broadcast_payload)
        return Response(body, status=status.HTTP_200_OK)

```

We also would like to mention the concept of room `version`. Each room has version field in our app, we increment it by one every time we make some room updates. We then attach version to every event we publish. This technique may be useful to avoid processing non-actual real-time messages on the client side. This is especially useful if we use outbox or CDC techniques where delivery latency increases and a chance to get real-time message which is not actual (i.e. app already loaded more "fresh" state from the backend) increases. 

## Handle real-time messages

As we already shown above the entrypoint for incoming real-time messages on the frontend side is `on('publication')` callback of Subscription object.

```javascript
sub.on('publication', (ctx: PublicationContext) => {
    onPublication(ctx.data)
})
```

In our app example we process the messages using asynchronous queue. To be honest, it's hard to give the universal receipt here – it seems to be a good approach for our example, but probably in your own app you will organise message processing differently.

```javascript
const [chatState, dispatch] = useReducer(reducer, initialChatState);
const [messageQueue, setMessageQueue] = useState<any[]>([]);

useEffect(() => {
  if (messageQueue.length === 0) {
    return; // Return if no messages to process.
  }

  const processUserJoined = async (body: any) => {
    // We will describe this very soon.
  }

  const processUserLeft = async (body: any) => {
    // We will describe this very soon.
  }

  const processMessageAdded = async (body: any) => {
    // We will describe this very soon.
  };

  const processMessage = async () => {
    const message = messageQueue[0];

    const { type, body } = message
    switch (type) {
      case 'message_added': {
        await processMessageAdded(body);
        break
      }
      case 'user_joined': {
        await processUserJoined(body);
        break
      }
      case 'user_left': {
        await processUserLeft(body);
        break
      }
      default:
        console.log('unsupported message type', type, body)
    }

    // Remove the processed message from the queue
    setMessageQueue(prevQueue => prevQueue.slice(1));
  };

  processMessage();
}, [messageQueue, chatState]);
```

## Handle message added event

TBD

## Handle user joined event

TBD

## Handle user left event

TBD

## Adding message recovery

TBD
