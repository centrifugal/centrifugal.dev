---
id: push_notifications
sidebar_label: "Appx #4: Adding push notifications"
title: "Appendix #4: Adding push notifications"
---

:::info Under construction 🚧

This chapter is under construction.

The tutorial source code already has working implementation for push notifications, but may have some polishing. To enable push notifications some adjustments to the tutorial source code should be made. These adjustments are mentioned in this tutorial and listed in the tutorial source code in comment for PUSH_NOTIFICATIONS_ENABLED option in backend/app/settings.py. 

:::

At this point our messenger app effectively works in real-time – new messages are delivered to online users over WebSocket, initial data is loaded from the main application database, and sometimes Centrifugo publication history helps to recover after temporary disconnections. But there is one more feature we can add to the app more engaging - push notifications. 

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

We also need to add some options to the backend:

```python title="backend/app/settings.py"
PUSH_NOTIFICATIONS_ENABLED = False
PUSH_NOTIFICATIONS_VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY'
PUSH_NOTIFICATIONS_FIREBASE_CONFIG = {...YOUR FIREBASE CONFIG}
```

Add the following to `backend/app/urls.py`:

```python title="backend/app/urls.py"
path('api/device/register/', views.device_register_view, name='api-device-register'),
```

Implement device registering view:

```python title="backend/app/views.py"
@require_POST
def device_register_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'must be authenticated'}, status=403)

    device_info = json.loads(request.body).get('device')
    if not device_info:
        return JsonResponse({'detail': 'device not found'}, status=400)

    # Attach user ID to device info.
    device_info["user"] = str(request.user.pk)

    session = requests.Session()
    try:
        resp = session.post(
            settings.CENTRIFUGO_HTTP_API_ENDPOINT + '/api/device_register',
            data=json.dumps(device_info),
            headers={
                'Content-type': 'application/json',
                'X-API-Key': settings.CENTRIFUGO_HTTP_API_KEY,
                'X-Centrifugo-Error-Mode': 'transport'
            }
        )
    except requests.exceptions.RequestException as e:
        logging.error(e)
        return JsonResponse({'detail': 'failed to register device'}, status=500)

    if resp.status_code != 200:
        logging.error(resp.json())
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
    
    device_ids = []
    device_id = json.loads(request.body).get('device_id', '')
    if device_id:
        device_ids = [device_id]

    session = requests.Session()
    try:
        resp = session.post(
            settings.CENTRIFUGO_HTTP_API_ENDPOINT + '/api/device_remove',
            data=json.dumps({
                'users': [str(request.user.pk)],
                'ids': device_ids
            }),
            headers={
                'Content-type': 'application/json',
                'X-API-Key': settings.CENTRIFUGO_HTTP_API_KEY,
                'X-Centrifugo-Error-Mode': 'transport'
            }
        )
    except requests.exceptions.RequestException as e:
        logging.error(e)
        return JsonResponse({'detail': 'failed to register device'}, status=500)
    
    ...
```

So that we can unregister device token from Centrifugo PRO device storage when user logs out.

### Send push notifications

Once a new message is sent to a chat room we can send a push notification to all users subscribed to this chat room topic. To do this we can use `send_push_notification` method of Centrifugo API:

```python title="backend/chat/views.py"
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

Note, here we send push to all subscribers of `chat:messages:{room_id}` topic – and Centrifugo PRO will do the rest iterating over all registered devices which have users subscribed to the topic and send push to them.

But we don't have any devices saved yet – to do this we need to update frontend to request permission for push notifications and register device token in Centrifugo PRO device storage. Let's do that.

### Frontend integration

In the frontend we need to add code to request permission for push notifications and register device token in Centrifugo. We also need to register service worker to handle push notifications while the app is not opened.

To request permissions for push notifications we should first add `firebase` SDK to `package.json`. Then let's create a module to work with FCM tokens:

```javascript title="frontend/src/PushNotification.tsx"
import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';

let messaging;

export const initializeFirebase = (firebaseConfig: any) => {
    if (!messaging) {
        if (navigator.serviceWorker === undefined) {
            return
        }
        const app = initializeApp(firebaseConfig);
        messaging = getMessaging(app);
    }
};

export const requestNotificationToken = async (firebaseConfig: any, vapidKey: string): Promise<string | null> => {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return null;
        }

        if ('serviceWorker' in navigator) {
            if (navigator.serviceWorker === undefined) {
                return null;
            }
            try {
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            } catch (err) {
                return null;
            }
        } else {
            return null;
        }
        const token = await getToken(messaging, {
            vapidKey: vapidKey,
        });
        return token;
    } catch (error) {
        return null;
    }
};

export const onForegroundNotification = (callback) => {
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

```javascript title="frontend/src/App.tsx"
  useEffect(() => {
    if (!authenticated || !csrf) return;
    if (!userInfo.settings || !userInfo.settings.push_notifications || !userInfo.settings.push_notifications.enabled) {
        return;
    }
    const setupNotifications = async () => {
        initializeFirebase(userInfo.settings.push_notifications.firebase_config);
        const token = await requestNotificationToken(userInfo.settings.push_notifications.firebase_config, userInfo.settings.push_notifications.vapid_public_key);

        if (token) {
            const deviceInfo = {
                provider: 'fcm',
                token: token,
                platform: 'web',
                meta: { 'user-agent': navigator.userAgent },
                tags: {
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
            };
            if (localStorage.getItem(LOCAL_STORAGE_DEVICE_ID_KEY)) {
                deviceInfo['device_id'] = localStorage.getItem(LOCAL_STORAGE_DEVICE_ID_KEY);
            }
            try {
                const response = await registerDevice(csrf, deviceInfo);
                console.log('Token sent to server:', response);
                const deviceId = response.device_id;
                localStorage.setItem(LOCAL_STORAGE_DEVICE_ID_KEY, deviceId);
                onForegroundNotification((payload) => {
                    console.log('Message received in foreground:', payload);
                    // We are ignoring foreground messages since we receive them over Centrifugo WebSocket.
                });
            } catch (error) {
                console.error('Failed to send token to server:', error);
            }
        } else {
            console.warn('No token received, cannot proceed.');
        }
    };

    setupNotifications();
}, [authenticated, userInfo, csrf]);
```

We register this token in Centrifugo PRO using Centrifugo API. To do this we call new Django endpoint `/api/device/register` and call Centrifugo `device_register` method from it. On every app load we are updating token registration in Centrifugo PRO.

Once user logs out we unregister device token from Centrifugo PRO and remove token from FCM:

And on frontend:

```javascript title="frontend/src/App.tsx"
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
importScripts('https://www.gstatic.com/firebasejs/9.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.16.0/firebase-messaging-compat.js');
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

Basically, we are initializing Firebase messaging in the Service Worker and then listen to background messages from Firebase. Once we receive a message we show a notification.

### Conclusion

Here we showed how to add push notifications to the Grand Chat application. We used Centrifugo PRO push notifications API and Firebase Cloud Messaging to achieve this.
