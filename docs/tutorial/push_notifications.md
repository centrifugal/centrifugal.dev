---
description: "Add web push notifications to a Centrifugo chat app using Centrifugo PRO push API and Firebase Cloud Messaging (FCM) with service workers."
id: push_notifications
sidebar_label: "Appx #4: Adding push notifications"
title: "Appendix #4: Adding push notifications"
---

:::info Optional appendix – needs Centrifugo PRO and Firebase

Push notifications are an optional feature. They require **Centrifugo PRO** (the push API is PRO-only) and a **Firebase Cloud Messaging (FCM)** project, so unlike the rest of the tutorial this chapter can't be run with just `docker compose up` out of the box. The implementation already ships in the source code but is disabled by default (`PUSH_NOTIFICATIONS_ENABLED = False`). This chapter walks through how it's built, and the [Turning push notifications on](#turning-push-notifications-on) section at the end lists the exact steps to enable it.

:::

At this point our messenger app effectively works in real-time – new messages are delivered to online users over WebSocket, initial data is loaded from the main application database, and sometimes Centrifugo publication history helps to recover after temporary disconnections. But there is one more feature we can add to make the app more engaging - push notifications.

In this appendix, we’ll demonstrate how to integrate Web Push Notifications into the Grand Chat application. Push notifications allow users to receive alerts about new messages even when the application is not open in their browser. This feature helps keep users engaged and informed about important updates.

We'll leverage the [Push Notification API of Centrifugo PRO](../pro/push_notifications.md), specifically its integration with Firebase Cloud Messaging (FCM). In general, Centrifugo PRO is not the only choice here – it's possible to use any other third-party push notification service or your own.

Below is a demonstration of the final result. In this demo notifications are delivered to Chrome (on the left) and Firefox (on the right), and clicking a notification directs users to the chat room:

<video width="100%" loop={true} autoPlay="autoplay" muted controls src="/img/grand-chat-tutorial-demo-push.mp4"></video>

When a user logs out, their token is unregistered from the push notification service, ensuring they no longer receive notifications.

### Use Centrifugo PRO image

Push notifications API is available in Centrifugo PRO only. Centrifugo PRO uses a separate docker image. In `docker-compose.yml` file change Centrifugo image to PRO version:

```yaml
  centrifugo:
    image: centrifugo/centrifugo-pro:v6
    ...
```

* **Note**: Centrifugo PRO offers a sandbox mode for experimentation without a license key
* For production, a valid license key is required, [see pricing section](/docs/pro/overview#pricing) 
* By downloading Centrifugo PRO, you agree to the [license agreement](/license).

### Update Centrifugo configuration

```json title="centrifugo/config.json"
{
  "database": {
    "enabled": true,
    "postgresql": {
      "dsn": "postgresql://grandchat:grandchat@db:5432/grandchat"
    }
  },
  "push_notifications": {
    "enabled": true,
    "queue": {
      "redis": {
        "address": "redis:6379"
      }
    },
    "enabled_providers": [
      "fcm"
    ],
    "fcm": {
      "credentials_file": "fcm.json"
    }
  }
}
```

Key Points:

* Enable `database`: Required for storing device tokens and topics.
* `push_notifications`: Enable push notifications and fcm as the provider. Use Redis for notification queue engine. Provide Centrifugo path to the `fcm.json` file, which you’ll get from Firebase.

### Register project in Firebase

To use FCM the first step would be registering your project in Firebase console. You can find a nice instruction how to do this by following this URL:

👉 [Firebase Registration Guide](https://github.com/Catapush/catapush-docs/blob/master/AndroidSDK/DOCUMENTATION_PLATFORM_GMS_FCM.md)

After registration, download the `fcm.json` credentials file and place it in your `centrifugo` folder (near `config.json` file). In Centrifugo configuration above `push_notifications.fcm.credentials_file` is exactly this file.

### Get the public VAPID key

For Web push notifications you also need to get the public VAPID key.

* Find it in the Firebase Console under your project settings.
* Follow this [Stack Overflow guide](https://stackoverflow.com/questions/54996206/firebase-cloud-messaging-where-to-find-public-vapid-key).

### Get Firebase web config

You also need to get Firebase web config. This is a JavaScript object with Firebase configuration. You can get it in Firebase console in the settings of your project.

It's required to initialize Firebase messaging in the frontend app and to register a Service Worker to handle push notifications while app is closed.

### Designing topics

For the Grand Chat tutorial we will subscribe users to push notification topics corresponding to chat rooms. When a user sends a message to a chat room we will send a push notification to all users subscribed to this chat room topic.

Once user clicks join button in the chat room we will subscribe user to the topic corresponding to this chat room. When user leaves the chat room we will unsubscribe user from this topic. To do this we can use Centrifugo API to manage user subscriptions to topics.

To manage subscriptions to topics reliably we can use CDC approach introduced in the previous tutorial chapters:

```python title="backend/chat/views.py"
def update_user_room_topic(self, user_id, room_id, op):
    if not settings.PUSH_NOTIFICATIONS_ENABLED:
        return
    if 'cdc' not in settings.CENTRIFUGO_BROADCAST_MODE:
        return
    partition = hash(room_id)
    CDC.objects.create(method='user_topic_update', payload={
        'user': str(user_id),
        'topics': ['chat:messages:' + str(room_id)],
        'op': op
    }, partition=partition)
```

Then once user joins room we can call:

```python title="backend/chat/views.py"
self.update_user_room_topic(request.user.pk, room_id, 'add')
```

Once user leaves room we can call:

```python title="backend/chat/views.py"
self.update_user_room_topic(request.user.pk, room_id, 'remove')
```

This way we will get the proper mapping of users to push topics in Centrifugo database.  

We also need to add some options to the backend. They are disabled / empty by default in `settings.py`; you'll fill in the real values in `local_settings.py` when [turning the feature on](#turning-push-notifications-on):

```python title="backend/app/settings.py"
PUSH_NOTIFICATIONS_ENABLED = False
PUSH_NOTIFICATIONS_VAPID_PUBLIC_KEY = ''
PUSH_NOTIFICATIONS_FIREBASE_CONFIG = {}
```

Add the following to `backend/app/urls.py`:

```python title="backend/app/urls.py"
path('api/device/register/', views.device_register_view, name='api-device-register'),
```

Calling the Centrifugo HTTP API looks the same here as it did for broadcasting, so we wrap it in a small helper to avoid repeating ourselves:

```python title="backend/app/views.py"
def centrifugo_api_request(method, payload):
    """Send a command to the Centrifugo HTTP API and return the response."""
    return requests.post(
        f'{settings.CENTRIFUGO_HTTP_API_ENDPOINT}/api/{method}',
        json=payload,
        headers={
            'X-API-Key': settings.CENTRIFUGO_HTTP_API_KEY,
            'X-Centrifugo-Error-Mode': 'transport',
        },
    )
```

Now implement the device registering view:

```python title="backend/app/views.py"
@require_POST
def device_register_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'must be authenticated'}, status=403)

    device_info = json.loads(request.body).get('device')
    if not device_info:
        return JsonResponse({'detail': 'device not found'}, status=400)

    # Attach the current user, and map the frontend's "device_id" to Centrifugo's "id" field
    # so re-registration updates the existing device in place (instead of creating a new one
    # and orphaning the old token).
    device_info['user'] = str(request.user.pk)
    if device_info.get('device_id'):
        device_info['id'] = device_info.pop('device_id')

    try:
        resp = centrifugo_api_request('device_register', device_info)
    except requests.exceptions.RequestException as e:
        logger.error(e)
        return JsonResponse({'detail': 'failed to register device'}, status=500)

    if resp.status_code != 200:
        logger.error(resp.json())
        return JsonResponse({'detail': 'failed to register device'}, status=500)

    return JsonResponse({
        'device_id': resp.json().get('result', {}).get('id')
    })
```

And implement passing additional settings in the login response (in `backend/app/views.py`):

```python title="backend/app/views.py"
def login_view(request):
    ...
    return JsonResponse({
        'id': user.pk,
        'username': user.username,
        'settings': {
            'push_notifications': {
                'enabled': settings.PUSH_NOTIFICATIONS_ENABLED,
                'vapid_public_key': settings.PUSH_NOTIFICATIONS_VAPID_PUBLIC_KEY,
                'firebase_config': settings.PUSH_NOTIFICATIONS_FIREBASE_CONFIG,
            }
        }
    })
```

Also extend logout view:

```python title="backend/app/views.py"
@require_POST
def logout_view(request):
    ...

    # Only relevant when push notifications are enabled (otherwise there are no devices).
    if settings.PUSH_NOTIFICATIONS_ENABLED:
        device_id = json.loads(request.body).get('device_id', '')
        device_ids = [device_id] if device_id else []
        try:
            centrifugo_api_request('device_remove', {
                'users': [str(request.user.pk)],
                'ids': device_ids,
            })
        except requests.exceptions.RequestException as e:
            logger.error(e)
            return JsonResponse({'detail': 'failed to remove device'}, status=500)

    ...
```

So that we can unregister device token from Centrifugo PRO device storage when user logs out.

### Send push notifications

Once a new message is sent to a chat room we can send a push notification to all users subscribed to this chat room topic, using the `send_push_notification` method of the Centrifugo API. We do this right inside `broadcast_room` (the same helper that already broadcasts the real-time event), but only for `message_added` events, only when push is enabled, and only in a CDC mode (since we deliver the command through the CDC outbox):

```python title="backend/chat/views.py"
# ...at the end of CentrifugoMixin.broadcast_room, after the real-time broadcast:
is_message_added = broadcast_payload.get('data', {}).get('type') == 'message_added'
if is_message_added and settings.PUSH_NOTIFICATIONS_ENABLED and 'cdc' in settings.CENTRIFUGO_BROADCAST_MODE:
    partition = hash(room_id)
    payload = {
        "recipient": {
            "filter": {
                "topics": [f'chat:messages:{room_id}']
            }
        },
        "notification": {
            "fcm": {
                "message": {
                    "notification": {
                        "title": room_name,
                        "body": broadcast_payload.get('data', {}).get('body', {}).get('content', '')
                    },
                    "webpush": {
                      "fcm_options": {
                        "link": f'http://localhost:9000/rooms/{room_id}'
                      }
                    }
                }
            }
        }
    }
    CDC.objects.create(method='send_push_notification', payload=payload, partition=partition)
```

Note, here we send a push to all subscribers of the `chat:messages:{room_id}` topic – and Centrifugo PRO will do the rest, iterating over all registered devices which have users subscribed to the topic and sending pushes to them.

But we don't have any devices saved yet – to do this we need to update the frontend to request permission for push notifications and register the device token in Centrifugo PRO device storage. Let's do that.

### Frontend integration

In the frontend we need to add code to request permission for push notifications and register device token in Centrifugo. We also need to register service worker to handle push notifications while the app is not opened.

To request permissions for push notifications we should first add `firebase` SDK to `package.json`. Then let's create a module to work with FCM tokens:

```typescript title="frontend/src/PushNotification.tsx"
import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';
import type { Messaging, MessagePayload } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';
import type { FirebaseOptions } from 'firebase/app';

let messaging: Messaging | undefined;

export const initializeFirebase = (firebaseConfig: FirebaseOptions) => {
    if (!messaging) {
        if (navigator.serviceWorker === undefined) {
            console.error('Service Worker is not available in this browser.');
            return
        }
        const app = initializeApp(firebaseConfig);
        messaging = getMessaging(app);
    }
};

export const requestNotificationToken = async (vapidKey: string): Promise<string | null> => {
    try {
        // Request notification permission.
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Notification permission denied');
            return null;
        }

        // Register Service Worker for background notifications.
        if (!('serviceWorker' in navigator) || navigator.serviceWorker === undefined) {
            console.warn('Service Worker is not supported in this browser.');
            return null;
        }
        try {
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('Service Worker registered with scope:', registration.scope);
        } catch (err) {
            console.error('Service Worker registration failed:', err);
            return null;
        }

        if (!messaging) {
            return null;
        }

        // Get FCM Token.
        const token = await getToken(messaging, {
            vapidKey: vapidKey,
        });
        return token;
    } catch (error) {
        console.error('Failed to get FCM token:', error);
        return null;
    }
};

export const onForegroundNotification = (callback: (payload: MessagePayload) => void) => {
    if (messaging) {
        onMessage(messaging, callback);
    }
};

export const removeNotificationToken = async () => {
    if (messaging) {
        await deleteToken(messaging);
    }
}
```

Once user logs into app – we ask for push notification permission and extract FCM token:

```typescript title="frontend/src/App.tsx"
  useEffect(() => {
    if (!authenticated) {
      return;
    }
    if (!csrf) { // User is authenticated from local storage but CSRF token is not yet fetched.
      return;
    }
    const push = userInfo.settings?.push_notifications;
    if (!push || !push.enabled) {
      return;
    }
    const setupNotifications = async () => {
      initializeFirebase(push.firebase_config);
      const token = await requestNotificationToken(push.vapid_public_key);

      if (!token) {
        console.warn('No token received, cannot proceed.');
        return;
      }

      const deviceInfo: DeviceInfo = {
        provider: 'fcm',
        token: token,
        platform: 'web',
        meta: { 'user-agent': navigator.userAgent },
        // timezone is a first-class device field (IANA name) used for
        // timezone-aware push; Intl gives us exactly that value.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      const storedDeviceId = localStorage.getItem(LOCAL_STORAGE_DEVICE_ID_KEY);
      if (storedDeviceId) {
        deviceInfo.device_id = storedDeviceId;
      }
      try {
        const response = await registerDevice(csrf, deviceInfo);
        localStorage.setItem(LOCAL_STORAGE_DEVICE_ID_KEY, response.device_id);
        onForegroundNotification((payload) => {
          console.log('Message received in foreground:', payload);
          // We ignore foreground messages since we receive them over the Centrifugo WebSocket.
        });
      } catch (error) {
        console.error('Failed to send token to server:', error);
      }
    };

    setupNotifications();
  }, [authenticated, userInfo, csrf]);
```

`DeviceInfo` is a small interface in `types.ts` describing the device payload we send (`provider`, `token`, `platform`, `meta`, `timezone`, and the optional saved `device_id`).

We register this token in Centrifugo PRO using Centrifugo API. To do this we call the new Django endpoint `/api/device/register` and call the Centrifugo `device_register` method from it. On every app load we update the token registration in Centrifugo PRO.

:::tip Device ID lifecycle

This example follows the robust pattern: the first `device_register` omits `id`, the returned device ID is saved in `localStorage`, and that stored ID is sent back on every subsequent registration. Passing the stored ID matters — when FCM rotates the token it updates the existing device in place instead of creating a duplicate (and leaving the old token to be cleaned up only after its next failed push). On logout we drop the stored ID and call `device_remove` (which also removes the device's topics). For topic subscriptions, prefer binding topics to the **user** via `user_topic_update` — Centrifugo applies them to the user's devices immediately (and to any device registered later), so you don't resend them each time. The `device_register` `topics` argument is only for device-specific subscriptions (it is rebuilt on every register). See [Device lifecycle and best practices](../pro/push_notifications.md#device-lifecycle-and-best-practices) for the full rules.

:::

We already extended `logout_view` above to unregister the device from Centrifugo PRO. On the frontend, `onLoggedOut` also drops the saved device id and deletes the local FCM token:

```typescript title="frontend/src/App.tsx"
  const onLoggedOut = async () => {
    ...
    localStorage.removeItem(LOCAL_STORAGE_DEVICE_ID_KEY);
    await removeNotificationToken();
}
```

### Service Worker for background pushes

Note, we also registered `/firebase-messaging-sw.js` as a Service Worker. Service Worker runs in the background and can show notifications even when the app is closed.

The file we're registering as Service Worker looks like this:

```javascript title="frontend/public/firebase-messaging-sw.js"
// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js');
importScripts('/firebase-config.js');

if (!self.firebaseConfig) {
    console.error('Firebase config not found');
} else {
    firebase.initializeApp(self.firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(function (payload) {
        console.log('Received background message ', payload);

        const notification = payload.data;
        if (!notification) {
            return
        }

        // Customize notification here.
        const notificationOptions = {
            ...notification,
        };

        self.registration.showNotification(
            notification.title,
            notificationOptions
        );
    });
}
```

Basically, we are initializing Firebase messaging in the Service Worker and then listening to background messages from Firebase. Once we receive a message we show a notification.

The Service Worker runs outside the app bundle, so it can't read the Firebase config from React. Instead it loads `self.firebaseConfig` from a small file in `frontend/public` that you create with your Firebase web config:

```javascript title="frontend/public/firebase-config.js"
self.firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

### Turning push notifications on

Everything above already ships in the source code, but is gated behind `PUSH_NOTIFICATIONS_ENABLED` (which is `False` by default). Once you have your Firebase project, FCM credentials, VAPID key and web config, enable the feature like this:

1. In `docker-compose.yml`, switch the Centrifugo image to the PRO one: `centrifugo/centrifugo-pro:v6`.
2. Keep `CENTRIFUGO_BROADCAST_MODE` as `cdc` or `api_cdc` – pushes are delivered through the CDC outbox, so a CDC mode is required (the default `api_cdc` already works).
3. Put your FCM credentials in `centrifugo/fcm.json` and set `"push_notifications.enabled": true` (plus the `database` section) in `centrifugo/config.json` as shown above.
4. Create `backend/app/local_settings.py` with your real values (it's imported by `settings.py` and is the right place for secrets you don't want to commit):

   ```python title="backend/app/local_settings.py"
   PUSH_NOTIFICATIONS_ENABLED = True
   PUSH_NOTIFICATIONS_VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY'
   PUSH_NOTIFICATIONS_FIREBASE_CONFIG = {...YOUR FIREBASE WEB CONFIG...}
   ```

5. Create `frontend/public/firebase-config.js` with the same web config (shown above).
6. Restart everything with `docker compose up` and **re-login** – the per-user push settings are delivered in the login response, so an existing session won't pick them up until you log in again.

### Conclusion

Here we showed how to add push notifications to the Grand Chat application. We used Centrifugo PRO push notifications API and Firebase Cloud Messaging to achieve this.

:::tip Web-only? Native Web Push is simpler than FCM

We used **FCM** here because it also covers native mobile apps, but GrandChat is a web app – and Centrifugo PRO also supports [native Web Push (VAPID)](../pro/push_notifications.md#web-push-vapid), recently added. It delivers straight to the browser over the standard Web Push protocol with **no Firebase project, no `fcm.json`, and no `firebase-config.js`** – you generate a VAPID key pair, set a few config values, and call `pushManager.subscribe` on the frontend. One setup covers Chrome, Edge, Firefox, Safari, and installed PWAs on Android/iOS. If you only target browsers, prefer this path over FCM.

:::
