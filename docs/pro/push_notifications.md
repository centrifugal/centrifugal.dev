---
description: "Centrifugo PRO push notification API manages device tokens and sends notifications via FCM, APNs, and HMS to Android, iOS, and web platforms."
id: push_notifications
sidebar_label: Push notification API
title: Push notification API
---

Centrifugo excels in delivering real-time in-app messages to online users. Sometimes though you need a way to engage offline users to come back to your app, or to trigger some update in the app while it's running in the background. That's where push notifications may be used. Push notifications are delivered over a battery-efficient, platform-dependent transport.

With Centrifugo PRO push notifications may be delivered to all popular application platforms:

* <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> Android devices
* <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> iOS devices
* <i className="bi bi-globe" style={{color: 'orange'}}></i> Web browsers which support Web Push API (Chrome, Firefox, see <a href="https://caniuse.com/push-api">this matrix</a>)

Centrifugo PRO provides an API to manage user device tokens and device topic subscriptions, and an API to send push notifications to registered devices and groups of devices (subscribed to a topic). The API also supports timezone-aware push notifications, push localizations, templating, and per-user device push rate limiting. You can also use your own device token storage and use Centrifugo PRO as a high-performance way to send push notifications to supported providers.

![Push](/img/push_notifications.png)

To deliver push notifications to devices Centrifugo PRO integrates with the following providers:

* [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* [Huawei Messaging Service (HMS) Push Kit](https://developer.huawei.com/consumer/en/hms/huawei-pushkit/) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* [Apple Push Notification service (APNs) ](https://developer.apple.com/documentation/usernotifications) <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i>
* [Web Push (VAPID)](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) <i className="bi bi-globe" style={{color: 'orange'}}></i>

FCM, HMS, APNs, and Web Push handle the frontend and transport aspects of notification delivery. Device token storage, management, and efficient push notification broadcasting are managed by Centrifugo PRO. Tokens are stored in a PostgreSQL database. To facilitate efficient push notification broadcasting to devices, Centrifugo PRO includes worker queues based on Redis streams (and also provides an option to use a PostgreSQL-based queue).

Integration with FCM means that you can use existing Firebase messaging SDKs to extract a push notification token for a device on different platforms (iOS, Android, Flutter, web browser) and set up push notification listeners. The same applies to HMS and APNs - just use existing native SDKs and best practices on the frontend. Only a couple of additional steps are required to integrate the frontend with Centrifugo PRO device token and device topic storage. After doing that you will be able to send push notifications to a single device, or to a group of devices subscribed to a topic. For example, with a simple Centrifugo API call like this:

```bash
curl -X POST http://localhost:8000/api/send_push_notification \
-H "Authorization: apikey <KEY>" \
-d @- <<'EOF'

{
    "recipient": {
        "filter": {
            "topics": ["test"]
        }
    },
    "notification": {
        "fcm": {
            "message": {
                "notification": {"title": "Hello", "body": "How are you?"}
            }
        }
    }
}
EOF
```

In addition, Centrifugo PRO includes a helpful web UI for inspecting registered devices and sending push notifications:

![](/img/push_ui.png)

## Motivation and design choices

Centrifugo PRO tries to be practical with its Push Notification API, let's look at its design choices and implementation properties.

### Storage for tokens

To start delivering push notifications in the application, developers usually need to integrate with providers such as FCM, HMS, and APNs. This integration typically requires the storage of device tokens in the application database and the implementation of sending push messages to provider push services.

Centrifugo PRO simplifies the process by providing a backend for device token storage, following best practices in token management. It reacts to errors and periodically removes inactive devices/tokens to keep the stored set healthy, based on provider recommendations.

### Efficient queuing

Additionally, Centrifugo PRO provides an efficient, scalable queuing mechanism for sending push notifications. Developers can send notifications from the app backend to Centrifugo API with minimal latency and let Centrifugo process sending to FCM, HMS, APNs concurrently using built-in workers. In our tests, we achieved several millions pushes per minute.

Centrifugo PRO also supports a delayed push notifications feature – to queue a push for later delivery, so for example you can send a notification based on user time zone and let Centrifugo PRO send it when needed.

### Unified secure topics

FCM and HMS have a built-in way of sending notification to large groups of devices over [topics](https://firebase.google.com/docs/cloud-messaging/android/topic-messaging) mechanism ([the same for HMS](https://developer.huawei.com/consumer/en/doc/development/HMS-Plugin-Guides-V1/subscribetopic-0000001056797545-V1)). Topics are great since you can create segments and groups of devices and target specific ones with your notifications.

One problem with native FCM or HMS topics though is that clients can subscribe to any topic from the frontend side without any permission check. In today's world this is usually not desired. So Centrifugo PRO re-implements FCM and HMS topics by introducing an additional API to manage device subscriptions to topics.

:::tip

In some cases you may have real-time channels and device subscription topics with matching names – to send messages to both online and offline users. Though it's up to you.

:::

Centrifugo PRO device topic subscriptions also add a way to introduce the missing topic semantics for APNs.

Centrifugo PRO additionally lets you keep a per-user list of topics (`user_topic_update`). This is the list you manage; Centrifugo **copies it onto a device when the device registers** — registering (or re-registering) a device for a user subscribes that device to the user's current topics (and only those, plus any `topics` you pass in the call). This solves one of the pains with FCM – if two different users share one device it's hard to unsubscribe the device from a large number of topics on logout: registering the device for the new user (or removing it) switches the whole set in one call, with no need for your backend to track topics one by one.

Changing a user's topics with `user_topic_update` takes effect on that user's **already-registered devices immediately** — Centrifugo applies the change to those devices as part of the call. Two exceptions catch up at the next `device_register` instead: a brand-new device that hasn't registered yet, and the global `""` binding (which applies to every user and would otherwise touch every device at once). See [Device lifecycle and best practices](#device-lifecycle-and-best-practices) for the exact rules, including that `device_update`'s `user_update` changes the user field **without** re-copying topics. You can also skip the per-user list entirely and pass the full topic list in each `device_register` call.

### Push personalization

Centrifugo PRO provides several ways to make push notifications individual and take care about better user experience with notifications. This includes:

* [Timezone-aware](#timezone-aware-push) push notifications
* Notification [templating](#templating)
* Notification [localizations](#localizations)
* Per user device [rate limiting](#push-rate-limits)

All these features may be used on individual request basis.

### Send in each provider's own format

Unlike solutions that merge every provider's API into one combined format, Centrifugo PRO passes your notification straight through to each provider. You write the notification in the format each provider already defines, so there's no extra format to learn in between.

It's also possible to send notifications into native FCM, HMS topics or send to raw FCM, HMS, APNs tokens using Centrifugo PRO's push API, allowing them to combine native provider primitives with those added by Centrifugo (i.e., sending to a list of device IDs or to a list of topics).

### Builtin analytics

Furthermore, Centrifugo PRO offers the ability to inspect sent push notifications using [ClickHouse analytics](./analytics.md#notifications-table). Providers may also offer their own analytics, [such as FCM](https://firebase.google.com/docs/cloud-messaging/understand-delivery?platform=web), which provides insight into push notification delivery. Centrifugo PRO also offers a way to analyze push notification delivery and interaction using the `update_push_status` API.

## Steps to integrate

1. Add provider SDK on the frontend side, follow provider instructions for your platform to obtain a push token for a device. For example, for FCM see instructions for [iOS](https://firebase.google.com/docs/cloud-messaging/ios/client), [Android](https://firebase.google.com/docs/cloud-messaging/android/client), [Flutter](https://firebase.google.com/docs/cloud-messaging/flutter/client), [Web Browser](https://firebase.google.com/docs/cloud-messaging/js/client)). The same for HMS or APNs – frontend part should be handled by their native SDKs.
2. Call the Centrifugo PRO backend API with the obtained token. From the application backend, call the Centrifugo `device_register` API to register the device in Centrifugo PRO storage. Optionally provide a list of topics to subscribe the device to.
3. Centrifugo returns a registered device object. Pass the generated device ID to the frontend and save it on the frontend together with a token received from FCM.
4. Call the Centrifugo `send_push_notification` API whenever it's time to deliver a push notification.

At any moment you can inspect the device storage by calling the `device_list` API.

Once a user logs out from the app, remove the device with the `device_remove` API, or re-register it with an empty `user` to keep the device but drop the user's topics. See [Device lifecycle and best practices](#device-lifecycle-and-best-practices) below for the exact rules (and why `device_update` is not the way to switch a device's user when you rely on user-bound topics).

## Device lifecycle and best practices

Getting the device ID flow right is what keeps your device storage clean (no duplicates, no orphaned tokens). Device IDs are **generated by Centrifugo** — they embed a timestamp and the provider, and a client cannot choose an arbitrary ID (registering with a wrongly-formatted `id` is rejected). The robust pattern:

Who calls what (the `device_register` API is **server-side** — it needs your API key, so your backend calls it; never the frontend directly):

```text
 [frontend]     get a push token from FCM / APNs / Web Push
                   │   also read the device_id you saved earlier, if any
                   ▼
 [frontend]     send the token (+ saved device_id, if any) to your backend
                   │
                   ▼
 [your backend] call Centrifugo  device_register  (authenticated, API key)
                   │     • no device_id sent  → Centrifugo creates a new device
                   │     • device_id sent     → Centrifugo updates that device
                   ▼
 [Centrifugo]   stores the device, returns its device_id
                   │
                   ▼
 [your backend] send the device_id back to the frontend
                   │
                   ▼
 [frontend]     save the device_id on the device

 ↻  Repeat all of this on every app start, and whenever the push token
    changes. Because you send the saved device_id, the SAME device is
    updated — so you never create duplicates or leave a dead token behind.

 On logout:
 [your backend] device_remove { id }   → the device (and its topics) is deleted

 Centrifugo also deletes a device on its own when the push provider reports
 the token is dead (app uninstalled, notifications revoked, …).
```

:::caution `device_register` writes the device's **whole** state, not just the fields you change

Every call replaces the device record. `provider`, `platform` and `token` are required (empty values are rejected). Anything you leave out of `user`, `timezone`, `locale` or `topics` is **reset to empty**, and the device's topic list is rebuilt from the `topics` you pass **plus** the current user's bound topics. So always send the complete device state you want — and include the saved `id` so the existing device is updated instead of a duplicate being created.

This is intentional: declaring the full state (especially the owner) on every registration is what keeps shared devices safe — there's no way to accidentally leave a device attached to a previous user. To change one field *without* re-sending the token, use [`device_update`](#device_update) (metadata) or [`device_topic_update`](#device_topic_update) (topics) — those are the partial-update methods; `device_register` is the full-state one.

:::

**1. First registration — omit `id`.** Call `device_register` with `provider`, `token`, `platform` (and optionally `user`, `topics`, `timezone`, `locale`) and **no `id`**. Centrifugo creates the device and returns its `id`. Persist that `id` on the client together with the push token.

**2. Re-registration — pass the stored `id` with the full device state.** On app start, and **especially when the provider rotates the push token**, call `device_register` again with the **stored `id`** plus the complete state (`provider`, `token`, `platform`, `user`, and `timezone`/`locale`/`topics` if you use them — see the full-replace note above). This updates the same device. The behavior to understand:

- Re-register **with** the stored `id` (token same or refreshed) → the existing device is updated. No duplicate. ✅ Recommended.
- Re-register **without** `id`, token **unchanged** → Centrifugo recognizes the token (`provider` + `token` is unique) and returns the same device. Also fine.
- Re-register **without** `id`, token **changed** → Centrifugo can't match the old device and creates a **new** one; the old token sticks around until its next push fails and is removed automatically. Passing the stored `id` avoids this temporary duplicate.

If the client lost its stored `id` (fresh install, cleared storage), just omit `id` — Centrifugo recognizes the token and returns the existing device, as long as the token is still valid.

**3. Topics: prefer user-bound, and know that `device_register` rebuilds the device's set.** A device gets topics from two sources, and each `device_register` rebuilds the device's topic set as the `topics` argument **∪** the topics currently bound to the device's user:

- **User-bound topics (recommended, convenient).** Keep a topic list per user with [`user_topic_update`](#user_topic_update). Then on every (re-)register you pass only the `user` — Centrifugo copies that user's topics onto the device for you. **You never resend the topic list.** This is usually all you need: subscribe a *user* to topics once, and all their devices pick them up. (Changes apply to the user's already-registered devices immediately; a device that hasn't registered yet picks them up when it does.)
- **Device-specific topics.** The `topics` argument (and [`device_topic_update`](#device_topic_update)) attach topics to *one device* regardless of user. Because register rebuilds the set, these are dropped if you re-register without them — so either pass the full device-specific list on every `device_register`, or manage them via `device_topic_update` and don't re-register without including them. Most apps don't need this; reach for user-bound topics first.

**4. Logout / user switch.** To switch a device to a different user (and its topics), **re-register** the device with the new `user` — this re-syncs topics in one call. To log out: either `device_remove` (deletes the device and its topics) or re-register with an empty `user` (keeps the device, drops the user's topics). Note: `device_update`'s `user_update` changes only the user field — it does **not** re-sync user-bound topics, so don't use it to switch users if you rely on user-bound topics; combine it with an explicit `topics_update`, or use `device_register`.

**5. Automatic cleanup.** When a provider reports a token/subscription is no longer valid (FCM `UNREGISTERED`, APNs `410`, Web Push `404`/`410`), Centrifugo removes that device automatically — this alone keeps the table healthy and is always on. You may *additionally* set [`max_inactive_device_interval`](#push_notificationsmax_inactive_device_interval) to drop **abandoned installs** — devices whose app hasn't re-registered within the interval (`updated_at` reflects registration/update, not sends, so it measures app activity, not delivery). Use it for engagement apps that register on each app open; **leave it unset for notification-centric apps** (rarely opened, but you still want to reach them) and rely on the automatic dead-token cleanup instead.

Using Centrifugo-issued device IDs end to end also lets you correlate delivery/interaction analytics via [`update_push_status`](#update_push_status).

:::note Notes on scale

- **Sending to a filter** goes through matching devices page by page, so sending to large groups of users or topics stays fast even with many devices.
- **`user_topic_update` applies the change to the user's current devices in one transaction**, so its cost grows with that user's device count (normally a handful). The global `""` binding is the exception — it applies to every user, so it's left for each device's next registration rather than touching every device at once.
- **Each `device_register` rebuilds that device's topic list**, so its cost grows with the number of topics on the device — keep per-device topic counts (and the number of topics every user gets via the empty-user `""` list) reasonable if devices register often.
- **If two first-time registrations for the same token arrive at the same moment**, one may get a conflict error; retrying it succeeds, because the retry finds and reuses the device the first one created.

:::

## Configuration

In Centrifugo PRO you can configure one push provider or use all of them – this choice is up to you.

### Enabling push notifications

To enable push notifications, set `push_notifications.enabled` to `true` and specify which providers to use in `push_notifications.enabled_providers` list.

### FCM

As mentioned above, Centrifugo uses PostgreSQL for token storage. To enable push notifications make sure `database` section defined in the configuration and `fcm` is in the `push_notifications.enabled_providers` list. Centrifugo PRO uses Redis Streams (default) or PostgreSQL for queuing push notification requests. Finally, to integrate with FCM a path to the credentials file must be provided (see how to create one [in this instruction](https://github.com/Catapush/catapush-docs/blob/master/AndroidSDK/DOCUMENTATION_PLATFORM_GMS_FCM.md)). So the full configuration to start sending push notifications over FCM may look like this:

```json title="config.json"
{
  "database": {
    "enabled": true,
    "postgresql": {
      "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres"
    }
  },
  "push_notifications": {
    "enabled": true,
    "queue": {
      "redis": {
        "address": "localhost:6379"
      }
    },
    "enabled_providers": [
      "fcm"
    ],
    "fcm": {
      "credentials_file": "/path/to/service/account/credentials.json"
    }
  }
}
```

:::tip

Actually, PostgreSQL database configuration is optional here – you can use push notifications API without it. In this case you will be able to send notifications to FCM, HMS, APNs raw tokens, FCM and HMS native topics and conditions. I.e. using Centrifugo as an efficient way to send push notifications (for example if you already keep tokens in your database). But sending to device ids and topics, and token/topic management APIs won't be available for usage.

:::

### HMS

```json
{
  "database": {
    "enabled": true,
    "postgresql": {
      "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres"
    }
  },
  "push_notifications": {
    "enabled": true,
    "queue": {
      "redis": {
        "address": "localhost:6379"
      }
    },
    "enabled_providers": [
      "hms"
    ],
    "hms": {
      "app_id": "<your_app_id>",
      "app_secret": "<your_app_secret>"
    }
  }
}
```

:::tip

See example how to get app id and app secret [here](https://github.com/Catapush/catapush-docs/blob/master/AndroidSDK/DOCUMENTATION_PLATFORM_HMS_PUSHKIT.md).

:::

### APNs

```json
{
  "database": {
    "enabled": true,
    "postgresql": {
      "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres"
    }
  },
  "push_notifications": {
    "enabled": true,
    "queue": {
      "redis": {
        "address": "localhost:6379"
      }
    },
    "enabled_providers": [
      "apns"
    ],
    "apns": {
      "endpoint": "development",
      "bundle_id": "com.example.your_app",
      "auth_type": "token",
      "token_key_file": "/path/to/auth/key/file.p8",
      "token_key_id": "<your_key_id>",
      "token_team_id": "your_team_id"
    }
  }
}
```

Instead of `token_key_file`, you can provide the key content inline using `token_key_pem`:

```json
{
  "push_notifications": {
    "apns": {
      "token_key_pem": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
    }
  }
}
```

We also support auth over p12 certificates (set `auth_type` to `"cert"`) with the following options:

* `push_notifications.apns.cert_p12_file` - path to .p12 certificate file
* `push_notifications.apns.cert_p12_b64` - base64-encoded .p12 certificate content
* `push_notifications.apns.cert_p12_password` - password for .p12 certificate

### Web Push (VAPID)

Native Web Push delivers notifications directly to browsers using the standard [Web Push protocol](https://datatracker.ietf.org/doc/html/rfc8030) with [VAPID](https://datatracker.ietf.org/doc/html/rfc8292) — no Firebase required. A single configuration reaches Chrome, Edge, Firefox, and Safari (16.4+).

First generate a VAPID key pair (for example with `npx web-push generate-vapid-keys`, or the helper in our [Web Push example](https://github.com/centrifugal/centrifugo/tree/master/misc/examples/webpush)). Then configure:

```json title="config.json"
{
  "database": {
    "enabled": true,
    "postgresql": {
      "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres"
    }
  },
  "push_notifications": {
    "enabled": true,
    "queue": {
      "redis": {
        "address": "localhost:6379"
      }
    },
    "enabled_providers": [
      "webpush"
    ],
    "webpush": {
      "vapid_public_key": "<your_vapid_public_key>",
      "vapid_private_key": "<your_vapid_private_key>",
      "subject": "mailto:you@example.com"
    }
  }
}
```

On the frontend, use the same `vapid_public_key` as the `applicationServerKey` when calling `pushManager.subscribe`, then register the resulting `PushSubscription` object as the device token (pass the whole subscription JSON as `token` in `device_register`).

:::tip

FCM can also deliver to browsers (via its `webpush` message config), but that requires Firebase. Native Web Push is the FCM-free path and the only way to reach Safari without Apple push certificates. Pick one path per browser device.

:::

:::note

Each browser uses a different push service endpoint (Chrome → `fcm.googleapis.com`, Firefox → Mozilla autopush, Safari → `web.push.apple.com`), but Centrifugo speaks the standard Web Push protocol to all of them, so no per-browser configuration is needed. Web Push has no native topics/conditions — use Centrifugo [device topics](#device_topic_update) for grouping. Safari additionally requires the web app to be installed (added to Dock / Home Screen) before push works.

:::

:::note Token lifecycle and cleanup

The subscription **endpoint** is stored as the device token (its stable identity, like an FCM/APNs token); the encryption keys are stored alongside it. Registration validates the subscription per [RFC 8291](https://datatracker.ietf.org/doc/html/rfc8291) (P-256 `p256dh` point, 16-byte `auth`) and rejects invalid ones. When a push service reports a subscription is gone (`404`/`410`), Centrifugo removes that device automatically. When a browser re-subscribes (new endpoint) the app should call `device_register` again with the new subscription; the obsolete one is cleaned up on its next failed send. As with other providers, the always-on dead-token cleanup (`404`/`410`) keeps the table healthy; the optional `max_inactive_device_interval` drops abandoned installs by registration recency, so enable it only for apps that re-register on each open (see the cleanup note under [Device lifecycle](#device-lifecycle-and-best-practices)).

:::

### Use PostgreSQL as queue

Centrifugo PRO utilizes Redis Streams as the default queue engine for push notifications. However, it also offers the option to employ PostgreSQL for queuing. Set `push_notifications.queue.type` to `"postgresql"`:

```json title="config.json"
{
  "database": {
    "postgresql": {
      "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres"
    },
    "enabled": true
  },
  "push_notifications": {
    "enabled": true,
    "queue": {
      "type": "postgresql",
      "postgresql": {
        "reuse_from_database": true
      }
    }
  }
}
```

:::tip

Queue based on Redis streams is generally more efficient, so if you start with PostgreSQL based queue – you have the option to switch to a faster one later. Note that pushes currently being sent or waiting in the queue will be lost during the switch.

:::

You can also use separate PostgreSQL instance for push notification queue, which may be beneficial:

```json title="config.json"
{
  ...
  "push_notifications": {
    "enabled": true,
    "queue": {
      "type": "postgresql",
      "postgresql": {
        "dsn": "postgresql://postgres:pass@127.0.0.1:5432/push_queue"
      }
    }
  }
}
```

## Configuration reference

This section provides a comprehensive reference for all push notification configuration options.

### push_notifications.enabled

Master switch to enable or disable the push notifications feature.

- **Type:** `bool`
- **Default:** `false`

### push_notifications.enabled_providers

List of push notification providers to enable.

- **Type:** `array[string]`
- **Valid values:** `"fcm"`, `"hms"`, `"apns"`, `"webpush"`

### push_notifications.dry_run

When `true`, Centrifugo PRO does not send push notifications to providers but prints logs instead. Useful for development.

- **Type:** `bool`
- **Default:** `false`

### push_notifications.dry_run_latency

When set together with `dry_run`, adds artificial delay to workers emulating real-world latency.

- **Type:** `duration`
- **Default:** `0s`
- **Example:** `"100ms"`, `"1s"`

### push_notifications.max_inactive_device_interval

Maximum time interval to keep a device without updates. Devices inactive longer than this will be automatically removed. Set to `0s` (default) to keep devices indefinitely.

- **Type:** `duration`
- **Default:** `0s`
- **Example:** `"720h"` (30 days)

### push_notifications.read_from_replica

When true, Centrifugo will use PostgreSQL replicas for read operations where possible. Requires `database.postgresql.replica_dsn` to be configured.

- **Type:** `bool`
- **Default:** `false`

### push_notifications.queue

Queue configuration object. Centrifugo PRO supports Redis Streams (default) or PostgreSQL for push notification queuing.

### push_notifications.queue.type

Specifies the queue backend type.

- **Type:** `string`
- **Valid values:** `"redis"`, `"postgresql"`
- **Default:** `"redis"`

### push_notifications.queue.redis

Redis queue configuration object. Supports all standard Redis configuration options (address, Sentinel, Cluster, TLS, etc.). See [Redis Engine](../server/engines.md#redis-engine) for common Redis options.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `address` | string | | Redis server address, e.g. `"localhost:6379"` |
| `reuse_from_engine` | bool | `false` | Reuse Redis connection from the engine configuration |
| `consumer_concurrency` | int | `64` | Number of concurrent consumer workers processing push notification jobs |
| `max_stream_length` | int64 | `100000` | Maximum length of the Redis Stream. Older entries may be trimmed when limit is reached |

### push_notifications.queue.postgresql

PostgreSQL queue configuration object. Supports DSN, replica DSN, and TLS configuration.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dsn` | string | | PostgreSQL connection string, e.g. `"postgresql://user:pass@localhost:5432/dbname"` |
| `reuse_from_database` | bool | `false` | Reuse PostgreSQL connection from the database configuration |
| `consumer_concurrency` | int | `16` | Number of concurrent consumer workers |
| `scheduler_consumer_concurrency` | int | `16` | Number of concurrent scheduler consumer workers for delayed pushes |
| `prefix` | string | `""` | Table name prefix for queue-related tables |

### push_notifications.fcm

FCM (Firebase Cloud Messaging) provider configuration object.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `credentials_file` | string | | **Required.** Path to Firebase service account credentials JSON file |
| `tokens_batch_size` | int | `500` | Maximum number of tokens in a single batch request to FCM |

### push_notifications.hms

HMS (Huawei Messaging Service) provider configuration object.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `app_id` | string | | **Required.** Your HMS application ID |
| `app_secret` | string | | **Required.** Your HMS application secret |
| `auth_endpoint` | string | | Custom HMS authentication endpoint. Uses HMS default if not set |
| `push_endpoint` | string | | Custom HMS push endpoint. Uses HMS default if not set |
| `tokens_batch_size` | int | `1000` | Maximum number of tokens in a single batch request to HMS |

### push_notifications.apns

APNs (Apple Push Notification service) provider configuration object.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `endpoint` | string | `"development"` | APNs endpoint: `"development"`, `"production"`, or custom `https://` URL |
| `bundle_id` | string | | **Required.** iOS application bundle identifier |
| `auth_type` | string | | **Required.** Authentication method: `"token"` or `"cert"` |
| `tokens_batch_size` | int | `100` | Maximum number of tokens to process in parallel |

**Token-based authentication (`auth_type: "token"`, recommended):**

| Field | Type | Description |
|-------|------|-------------|
| `token_key_file` | string | Path to .p8 authentication key file from Apple Developer portal. Mutually exclusive with `token_key_pem` |
| `token_key_pem` | string | PEM-encoded authentication key content (inline). Mutually exclusive with `token_key_file` |
| `token_key_id` | string | **Required.** 10-character Key ID from Apple Developer account |
| `token_team_id` | string | **Required.** 10-character Team ID from Apple Developer account |

**Certificate-based authentication (`auth_type: "cert"`):**

| Field | Type | Description |
|-------|------|-------------|
| `cert_p12_file` | string | Path to .p12 certificate file. Mutually exclusive with `cert_p12_b64` |
| `cert_p12_b64` | string | Base64-encoded .p12 certificate content. Mutually exclusive with `cert_p12_file` |
| `cert_p12_password` | string | Password for .p12 certificate (if encrypted) |

### push_notifications.webpush

Web Push (VAPID) provider configuration object.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `vapid_public_key` | string | | **Required.** base64url-encoded VAPID public (application server) key. Must match the `applicationServerKey` used on the frontend |
| `vapid_private_key` | string | | **Required.** base64url-encoded VAPID private key. Keep it secret |
| `subject` | string | | **Required.** VAPID subject (JWT `sub` claim) — a `mailto:` or `https:` URL identifying the application server contact |
| `tokens_batch_size` | int | `100` | Maximum number of subscriptions to send to concurrently |

### Complete configuration example

Here's a comprehensive example showing all providers configured together:

```json title="config.json"
{
  "database": {
    "enabled": true,
    "postgresql": {
      "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres",
      "replica_dsn": [
        "postgresql://postgres:pass@replica-host:5432/postgres"
      ]
    }
  },
  "push_notifications": {
    "enabled": true,
    "enabled_providers": ["fcm", "hms", "apns", "webpush"],
    "dry_run": false,
    "max_inactive_device_interval": "720h",
    "read_from_replica": true,
    "queue": {
      "type": "redis",
      "redis": {
        "address": "localhost:6379",
        "consumer_concurrency": 64,
        "max_stream_length": 100000
      }
    },
    "fcm": {
      "credentials_file": "/path/to/fcm-credentials.json",
      "tokens_batch_size": 500
    },
    "hms": {
      "app_id": "your_app_id",
      "app_secret": "your_app_secret",
      "tokens_batch_size": 500
    },
    "apns": {
      "endpoint": "production",
      "bundle_id": "com.example.app",
      "auth_type": "token",
      "token_key_file": "/path/to/AuthKey.p8",
      "token_key_id": "ABCDE12345",
      "token_team_id": "TEAM123456",
      "tokens_batch_size": 100
    },
    "webpush": {
      "vapid_public_key": "<your_vapid_public_key>",
      "vapid_private_key": "<your_vapid_private_key>",
      "subject": "mailto:you@example.com",
      "tokens_batch_size": 100
    }
  }
}
```

## API description

Push notifications of Centrifugo PRO come with a set of additional server API methods.

### device_register

Registers or updates device information.

#### device_register request

| Field      | Type                | Required | Description                                                                                                                                                                                          |
|------------|---------------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`       | `string`            | No       | Device ID. Omit on first registration — Centrifugo generates one and returns it. Pass the stored value on re-registration to update the same device. See [Device lifecycle](#device-lifecycle-and-best-practices). |
| `provider` | `string`            | Yes      | Provider of the device token (valid choices: `fcm`, `hms`, `apns`, `webpush`).                                                                                                                       |
| `token`    | `string`            | Yes      | Push notification token for the device. For `webpush`, this is the browser `PushSubscription` object serialized as a JSON string.                                                                    |
| `platform` | `string`            | Yes      | Platform of the device (valid choices: `ios`, `android`, `web`).                                                                                                                                     |
| `user`     | `string`            | No       | User associated with the device.                                                                                                                                                                     |
| `timezone` | `string`            | No       | Timezone of device user ([IANA time zone identifier](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), ex. `Europe/Nicosia`). See [Timezone aware push](#timezone-aware-push)           |
| `locale`   | `string`            | No       | Locale of device user. Must be IETF BCP 47 language tag - ex. `en-US`, `fr-CA`. See [Localizations](#localizations)                                                                                  |
| `topics`   | `array[string]`     | No       | Device topic subscriptions. This should be a full list which replaces all the topics previously associated with the device. User topics managed by `UserTopic` model will be automatically attached. |
| `meta`     | `map[string]string` | No       | Additional custom metadata for the device                                                                                                                                                            |

#### device_register result

| Field Name | Type     | Required | Description                                |
|------------|----------|----------|--------------------------------------------|
| `id`       | `string` | Yes      | The device ID that was registered/updated. |

### device_update

Call this method to update a device. For example, when a user logs out of the app and you need to detach the user ID from the device.

#### device_update request

| Field             | Type                   | Required | Description                        |
|-------------------|------------------------|----------|------------------------------------|
| `ids`             | `array[string]`        | No       | Device ids to filter               |
| `users`           | `array[string]`        | No       | Device users filter                |
| `user_update`     | `DeviceUserUpdate`     | No       | Optional user update object        |
| `timezone_update` | `DeviceTimezoneUpdate` | No       | Optional timezone update object    |
| `locale_update`   | `DeviceLocaleUpdate`   | No       | Optional locale update object      |
| `meta_update`     | `DeviceMetaUpdate`     | No       | Optional device meta update object |
| `topics_update`   | `DeviceTopicsUpdate`   | No       | Optional topics update object      |

`DeviceUserUpdate`:

| Field  | Type     | Required | Description |
|--------|----------|----------|-------------|
| `user` | `string` | Yes      | User to set |

:::note When to use `user_update`

`user_update` rewrites the user **identifier** on the matched devices — it's meant for administrative/bulk changes where the same person keeps the same device but their user ID string changes (account-ID migration, account merge, backfilling a user onto anonymously-registered devices). It updates the `user` field only and does **not** re-sync user-bound topics (the device's topic rows aren't tied to the user identifier, and you'd migrate `user_topics` bindings separately).

To assign a device to a **different user** (e.g. a different person logs in on a shared device), use [`device_register`](#device_register) with the new `user` instead — that copies the new user's topics onto the device in one call. See [Device lifecycle and best practices](#device-lifecycle-and-best-practices).

:::


`DeviceTimezoneUpdate`:

| Field      | Type     | Required | Description     |
|------------|----------|----------|-----------------|
| `timezone` | `string` | Yes      | Timezone to set |


`DeviceLocaleUpdate`:

| Field    | Type     | Required | Description   |
|----------|----------|----------|---------------|
| `locale` | `string` | Yes      | Locale to set |

`DeviceMetaUpdate`:

| Field  | Type                 | Required | Description |
|--------|----------------------|----------|-------------|
| `meta` | `map[string]string` | Yes      | Meta to set |

`DeviceTopicsUpdate`:

| Field    | Type            | Required | Description                                 |
|----------|-----------------|----------|---------------------------------------------|
| `op`     | `string`        | Yes      | Operation to make: `add`, `remove` or `set` |
| `topics` | `array[string]` | Yes      | Topics for the operation                    |

#### device_update result

Empty object.

### device_remove

Removes a device from storage. This may also be called when a user logs out of the app and you no longer need the device token.

#### device_remove request

| Field Name | Type            | Required | Description                                           |
|------------|-----------------|----------|-------------------------------------------------------|
| `ids`      | `array[string]` | No       | A list of device IDs to be removed                    |
| `users`    | `array[string]` | No       | A list of device user IDs to filter devices to remove |

#### device_remove result

Empty object.

### device_list

Returns a paginated list of registered devices according to request filter conditions.

#### device_list request

| Field                 | Type           | Required | Description                                                                     |
|-----------------------|----------------|----------|---------------------------------------------------------------------------------|
| `filter`              | `DeviceFilter` | Yes      | How to filter results                                                           |
| `cursor`              | `string`       | No       | Cursor for pagination (last device id in previous batch, empty for first page). |
| `limit`               | `int32`        | No       | Maximum number of devices to retrieve.                                          |
| `include_total_count` | `bool`         | No       | Flag indicating whether to include total count for the current filter.          |
| `include_topics`      | `bool`         | No       | Flag indicating whether to include topics information for each device.          |
| `include_meta`        | `bool`         | No       | Flag indicating whether to include meta information for each device.            |
| `include_webpush_keys`| `bool`         | No       | Flag indicating whether to include `webpush_keys` for each device (webpush only).|

`DeviceFilter`:

| Field       | Type            | Required | Description                                       |
|-------------|-----------------|----------|---------------------------------------------------|
| `ids`       | `array[string]` | No       | List of device IDs to filter results.             |
| `providers` | `array[string]` | No       | List of device token providers to filter results. |
| `platforms` | `array[string]` | No       | List of device platforms to filter results.       |
| `users`     | `array[string]` | No       | List of device users to filter results.           |
| `topics`    | `array[string]` | No       | List of topics to filter results.                 |

#### device_list result

| Field Name    | Type            | Required | Description                                                                       |
|---------------|-----------------|----------|-----------------------------------------------------------------------------------|
| `items`       | `array[Device]` | Yes      | A list of devices                                                                 |
| `next_cursor` | `string`        | No       | Cursor string for retrieving the next page, if not set - then no next page exists |
| `total_count` | `integer`       | No       | Total count value (if `include_total_count` used)                                 |

`Device`:

| Field Name | Type                | Required | Description                                |
|------------|---------------------|----------|--------------------------------------------|
| `id`       | `string`            | Yes      | The device's ID.                           |
| `provider` | `string`            | Yes      | The device's token provider.               |
| `token`    | `string`            | Yes      | The device's token. For `webpush` this is the subscription **endpoint** (its stable identity). |
| `platform` | `string`            | Yes      | The device's platform.                     |
| `user`     | `string`            | No       | The user associated with the device.       |
| `topics`   | `array[string]`     | No       | Only included if `include_topics` was true |
| `meta`     | `map[string]string` | No       | Only included if `include_meta` was true   |
| `webpush_keys` | `string`        | No       | Web Push subscription keys JSON (`{p256dh, auth}`). Only included if `include_webpush_keys` was true |

### Two kinds of topic lists

There are two separate topic lists, and it's important to know which is which:

- **User topics** (`user_topic_update` / `user_topic_list`) — the list of topics a **user** should follow. Think of this as your intent: "this user wants these topics."
- **Device topics** (`device_topic_update` / `device_topic_list`) — the list of topics a **specific device** is actually subscribed to. **This is the list Centrifugo reads when you send to a topic** — it decides who gets the push.

How they relate: when a device is registered for a user, Centrifugo **copies** that user's topics into the device's list (along with any `topics` you pass in the `device_register` call). So the user list is the convenient place to manage subscriptions once per user, and the device list is the result that actually drives delivery.

How they stay in sync: `user_topic_update` updates the per-user list **and** immediately applies the change to that user's already-registered devices, so the device list reflects it right away. Two cases catch up at the next `device_register` instead: a device that hasn't registered yet, and the global `""` binding that applies to every user. A topic send always follows the **device** list.

So: use **user topics** to manage "who follows what", and use **device topics** (especially `device_topic_list`) to check or debug what a given device will really receive.

### device_topic_update

Manage mapping of device to topics.

#### device_topic_update request

| Field       | Type            | Required | Description                |
|-------------|-----------------|----------|----------------------------|
| `device_id` | `string`        | Yes      | Device ID.                 |
| `op`        | `string`        | Yes      | `add` or `remove` or `set` |
| `topics`    | `array[string]` | No       | List of topics.            |
| `user`      | `string`        | No       | Optional ownership guard. If set, the update is applied only if the device currently belongs to this user. If the device exists but is owned by someone else, the request fails with a `conflict` error; if the device doesn't exist, it fails with a `not found` error. Nothing is changed in either case. Use it to avoid landing one user's topics on a device that has changed hands. |

#### device_topic_update result

Empty object.

:::tip

Manage topics that belong to a *user* via [`user_topic_update`](#user_topic_update) — those follow the device's current owner automatically. Use `device_topic_update` for topics that belong to the *device itself* regardless of who is logged in. If you do target a device directly for user-specific topics, pass `user` as a guard so a stale device→user assumption can't leak topics across users.

:::

### device_topic_list

List device to topic mapping.

#### device_topic_list request

| Field                 | Type                | Required | Description                                                                     |
|-----------------------|---------------------|----------|---------------------------------------------------------------------------------|
| `filter`              | `DeviceTopicFilter` | No       | List of device IDs to filter results.                                           |
| `cursor`              | `string`            | No       | Cursor for pagination (last device id in previous batch, empty for first page). |
| `limit`               | `int32`             | No       | Maximum number of devices to retrieve.                                          |
| `include_device`      | `bool`              | No       | Flag indicating whether to include Device information for each object.          |
| `include_total_count` | `bool`              | No       | Flag indicating whether to include total count info to response.                |

`DeviceTopicFilter`:

| Field              | Type            | Required | Description                                       |
|--------------------|-----------------|----------|---------------------------------------------------|
| `device_ids`       | `array[string]` | No       | List of device IDs to filter results.             |
| `device_providers` | `array[string]` | No       | List of device token providers to filter results. |
| `device_platforms` | `array[string]` | No       | List of device platforms to filter results.       |
| `device_users`     | `array[string]` | No       | List of device users to filter results.           |
| `topics`           | `array[string]` | No       | List of topics to filter results.                 |
| `topic_prefix`     | `string`        | No       | Topic prefix to filter results.                   |

#### device_topic_list result

| Field Name    | Type                 | Required | Description                                                                       |
|---------------|----------------------|----------|-----------------------------------------------------------------------------------|
| `items`       | `array[DeviceTopic]` | Yes      | A list of DeviceTopic objects                                                   |
| `next_cursor` | `string`             | No       | Cursor string for retrieving the next page, if not set - then no next page exists |
| `total_count` | `integer`            | No       | Total count value (if `include_total_count` used)                                 |

`DeviceTopic`:

| Field       | Type     | Required | Description              |
|-------------|----------|----------|--------------------------|
| `id`        | `string` | Yes      | ID of DeviceTopic object |
| `device_id` | `string` | Yes      | Device ID                |
| `topic`     | `string` | Yes      | Topic                    |

### user_topic_update

Manage the per-user topic list. Updating it **immediately** applies the change to the user's already-registered devices (and a device registered later picks up the current list at registration). The global `""` binding — which applies to every user — is the one case applied at registration rather than immediately. See [Device lifecycle](#device-lifecycle-and-best-practices).

#### user_topic_update request

| Field    | Type            | Required | Description                |
|----------|-----------------|----------|----------------------------|
| `user`   | `string`        | Yes      | User ID.                   |
| `op`     | `string`        | Yes      | `add` or `remove` or `set` |
| `topics` | `array[string]` | No       | List of topics.            |

#### user_topic_update result

Empty object.

### user_topic_list

List user to topic mapping.

#### user_topic_list request

| Field                 | Type              | Required | Description                                                              |
|-----------------------|-------------------|----------|--------------------------------------------------------------------------|
| `filter`              | `UserTopicFilter` | No       | Filter object.                                                           |
| `cursor`              | `string`          | No       | Cursor for pagination (last id in previous batch, empty for first page). |
| `limit`               | `int32`           | No       | Maximum number of `UserTopic` objects to retrieve.                       |
| `include_total_count` | `bool`            | No       | Flag indicating whether to include total count info to response.         |

`UserTopicFilter`:

| Field          | Type            | Required | Description                       |
|----------------|-----------------|----------|-----------------------------------|
| `users`        | `array[string]` | No       | List of users to filter results.  |
| `topics`       | `array[string]` | No       | List of topics to filter results. |
| `topic_prefix` | `string`        | No       | Topic prefix to filter results.   |

#### user_topic_list result

| Field Name    | Type               | Required | Description                                                                       |
|---------------|--------------------|----------|-----------------------------------------------------------------------------------|
| `items`       | `array[UserTopic]` | Yes      | A list of UserTopic objects                                                       |
| `next_cursor` | `string`           | No       | Cursor string for retrieving the next page, if not set - then no next page exists |
| `total_count` | `integer`          | No       | Total count value (if `include_total_count` used)                                 |

`UserTopic`:

| Field   | Type     | Required | Description       |
|---------|----------|----------|-------------------|
| `id`    | `string` | Yes      | ID of `UserTopic` |
| `user`  | `string` | Yes      | User ID           |
| `topic` | `string` | Yes      | Topic             |

### send_push_notification

Send push notification to specific `device_ids`, or to `topics`, or native provider identifiers like `fcm_tokens`, or to `fcm_topic`. The request will be queued by Centrifugo, consumed by Centrifugo built-in workers, and sent to the provider API.

#### send_push_notification request

| Field name                 | Type                          | Required | Description                                                                                                                                                                |
|----------------------------|-------------------------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `recipient`                | `PushRecipient`               | Yes      | Recipient of push notification                                                                                                                                             |
| `notification`             | `PushNotification`            | Yes      | Push notification to send                                                                                                                                                  |
| `uid`                      | `string`                      | No       | Unique identifier for each push notification request, can be used to cancel push. We recommend using UUID v4 for it. Two different requests must have different `uid`      |
| `send_at`                  | `int64`                       | No       | Optional Unix time in the future (in seconds) when to send push notification, push will be queued until that time.                                                         |
| `optimize_for_reliability` | `bool`                        | No       | Makes processing heavier, but handles edge cases — for example, it avoids losing pushes that are mid-send if the queue is briefly unavailable.                            |
| `limit_strategy`           | `PushLimitStrategy`           | No       | Can be used to set push time constraints (based on device timezone) and rate limits. Note, when it's used Centrifugo processes pushes one by one instead of batch sending |
| `analytics_uid`            | `string`                      | No       | Identifier for push notification analytics, if not set - Centrifugo will use `uid` field.                                                                                  |
| `localizations`            | `map[string]PushLocalization` | No       | Optional per language localizations for push notification.                                                                                                                 |
| `use_templating`           | `bool`                        | No       | If set - Centrifugo will use templating for push notification. Note that setting localizations enables templating automatically.                                           |
| `use_meta`                 | `bool`                        | No       | If set - Centrifugo will additionally load device meta during push sending, this meta becomes available in templating.                                                     |

`PushRecipient` (you **must set only one of the following fields**):

| Field           | Type            | Required | Description                                                  |
|-----------------|-----------------|----------|--------------------------------------------------------------|
| `filter`        | `DeviceFilter`  | No       | Send to device IDs based on Centrifugo device storage filter |
| `fcm_tokens`    | `array[string]` | No       | Send to a list of FCM native tokens                          |
| `fcm_topic`     | `string`        | No       | Send to a FCM native topic                                   |
| `fcm_condition` | `string`        | No       | Send to a FCM native condition                               |
| `hms_tokens`    | `array[string]` | No       | Send to a list of HMS native tokens                          |
| `hms_topic`     | `string`        | No       | Send to a HMS native topic                                   |
| `hms_condition` | `string`        | No       | Send to a HMS native condition                               |
| `apns_tokens`   | `array[string]` | No       | Send to a list of APNs native tokens                         |
| `webpush_tokens`| `array[string]` | No       | Send to a list of raw Web Push subscriptions (each item is a `PushSubscription` JSON string) |

`PushNotification`:

| Field       | Type                   | Required | Description                                                                                                                                                                                                                                                                       |
|-------------|------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `expire_at` | `int64`                | No       | Unix timestamp when Centrifugo stops attempting to send this notification. Note, it's Centrifugo specific and does not relate to notification TTL fields. We generally recommend to always set this to a reasonable value to protect your app from old push notifications sending |
| `fcm`       | `FcmPushNotification`  | No       | Notification for FCM                                                                                                                                                                                                                                                              |
| `hms`       | `HmsPushNotification`  | No       | Notification for HMS                                                                                                                                                                                                                                                              |
| `apns`      | `ApnsPushNotification` | No       | Notification for APNs                                                                                                                                                                                                                                                             |
| `webpush`   | `WebPushPushNotification` | No    | Notification for Web Push                                                                                                                                                                                                                                                         |

`FcmPushNotification`:

| Field     | Type          | Required | Description                                                                                                            |
|-----------|---------------|----------|------------------------------------------------------------------------------------------------------------------------|
| `message` | `JSON` object | Yes      | FCM [Message](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#Message) described in FCM docs. |

`HmsPushNotification`:

| Field     | Type          | Required | Description                                                                                                                                                                                             |
|-----------|---------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `message` | `JSON` object | Yes      | HMS [Message](https://developer.huawei.com/consumer/en/doc/development/HMSCore-References/https-send-api-0000001050986197#EN-US_TOPIC_0000001134031085__p1324218481619) described in HMS Push Kit docs. |

`ApnsPushNotification`:

| Field     | Type                | Required | Description                                                                                                                                               |
|-----------|---------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `headers` | `map[string]string` | No       | APNs [headers](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns) |
| `payload` | `JSON` object       | Yes      | APNs [payload](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/generating_a_remote_notification)      |

`WebPushPushNotification`:

| Field     | Type                | Required | Description                                                                                                                                               |
|-----------|---------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `headers` | `map[string]string` | No       | Web Push HTTP headers. Recognized keys: `TTL` (seconds to retain for offline devices, default 4 weeks), `Urgency` (`very-low`/`low`/`normal`/`high`), `Topic` (collapse key) |
| `payload` | `JSON` object       | Yes      | Arbitrary JSON payload delivered to the browser service worker (received via `event.data.json()` in the `push` event)                                     |

`PushLocalization`:

| Field          | Type                | Required | Description                                       |
|----------------|---------------------|----------|---------------------------------------------------|
| `translations` | `map[string]string` | Yes      | Variable name to value for the specific language. |

`PushLimitStrategy`:

| Field        | Type                    | Required | Description             |
|--------------|-------------------------|----------|-------------------------|
| `rate_limit` | `PushRateLimitStrategy` | No       | Set rate limit policies |
| `time_limit` | `PushTimeLimitStrategy` | No       | Set time limit policy   |

`PushRateLimitStrategy`:

| Field                  | Type                     | Required | Description                                                                             |
|------------------------|--------------------------|----------|-----------------------------------------------------------------------------------------|
| `key`                  | `string`                 | No       | Optional key for rate limit policy, supports variables (`device.id` and `device.user`). |
| `policies`             | `array[RateLimitPolicy]` | No       | Array of rate limit policies to apply                                                   |
| `drop_if_rate_limited` | `bool`                   | No       | Drop push if rate limited, otherwise queue for later                                    |

`RateLimitPolicy`:

| Field         | Type  | Required | Description                         |
|---------------|-------|----------|-------------------------------------|
| `rate`        | `int` | Yes      | Allowed rate                        |
| `interval_ms` | `int` | Yes      | Interval over which rate is allowed |

`PushTimeLimitStrategy`:

| Field              | Type     | Required | Description                                                                          |
|--------------------|----------|----------|--------------------------------------------------------------------------------------|
| `send_after_time`  | `string` | Yes      | Local time in format `HH:MM:SS` after which push must be sent                        |
| `send_before_time` | `string` | Yes      | Local time in format `HH:MM:SS` before which push must be sent                       |
| `no_tz_send_now`   | `bool`   | No       | If device does not have timezone send push immediately, by default - will be dropped |

#### send_push_notification result

| Field Name | Type     | Description                                                 |
|------------|----------|-------------------------------------------------------------|
| `uid`      | `string` | Unique send id, matches `uid` in request if it was provided |

### cancel_push

Cancel delayed push notification (which was sent with custom `send_at` value).

#### cancel_push request

| Field | Type     | Required | Description                          |
|-------|----------|----------|--------------------------------------|
| `uid` | `string` | Yes      | `uid` of push notification to cancel |

#### cancel_push result

Empty object.

### update_push_status

This API call is experimental, some changes may happen here.

Centrifugo PRO also allows tracking status of push notification delivery and interaction. It's possible to use `update_push_status` API to save the updated status of push notification to the `notifications` [analytics table](./analytics.md#notifications-table). Then it's possible to build insights into push notification effectiveness by querying the table.

The `update_push_status` API supposes that you are using `uid` field with each notification sent and you are using Centrifugo PRO generated device IDs (as described in [steps to integrate](#steps-to-integrate)).

This is part of the server API at the moment, so you need to send these requests from your backend. We can consider making this API suitable for requests from the client side – please reach out if your use case requires it.

#### update_push_status request

| Field           | Type     | Required | Description                                                      |
|-----------------|----------|----------|------------------------------------------------------------------|
| `analytics_uid` | `string` | Yes      | `analytics_uid` from `send_push_notification`                    |
| `status`        | `string` | Yes      | Status of push notification - `delivered` or `interacted`        |
| `device_id`     | `string` | Yes      | Device ID                                                        |
| `msg_id`        | `string` | No       | Optional Message ID of push notification issued by the provider |

#### update_push_status result

Empty object.

## Timezone aware push

Setting `timezone` on a device (see [device_register](#device_register) call) opens the way for timezone-aware push notifications. This is nice because you can send notifications to users at a convenient time of day — avoid pushes at night, push at a specific time.

To send such push notifications use `time_limit` field of `PushLimitStrategy`. For example, you can send push between `09:00:00` and `09:30:00` – and Centrifugo will send push somewhere during this period of user's local time.

:::tip

Given Centrifugo takes timezone from devices table into account timezone aware pushes only work with requests where `DeviceFilter` is used for sending – i.e. when Centrifugo iterates over devices in the database. If you send using raw tokens and want to inherit possibility to use timezones - reach out to us, this may be supported.

:::

## Templating

It's possible to use templating in the content of your push notification payloads. By default, Centrifugo does not use templating since this allows broadcasting pushes at maximum speed. You have to set the `use_templating` flag to `true` when sending a push to enable template execution. Here is an example of using templating:

```json
{
  ..
  "title": "Hello {{.device.meta.first_name}}"
```

To access device meta content in a push template (as shown above), additionally set the `use_meta` flag to `true` in the send push notification request. Without `use_meta` you only have access to `.device.id` and `.device.user` variables.

:::tip

Templating only works with requests where `DeviceFilter` is used for sending – i.e. when Centrifugo iterates over devices in the database.

:::

## Localizations

Templating also allows us to localize push notification content based on device `locale` (see [device_register](#device_register) call).

When sending push notification use `localizations` field of [send_push_notification request](#send_push_notification-request):

```json
{
  ..
  "localizations": {
    "pt": {
        "translations": {
            "greeting": "Olá",
            "question": "Como tá indo"
        }
    },
    "fr": {
        "translations": {
            "greeting": "Bonjour",
            "question": "Comment ça va"
        }
    }
  }
}
```

In push payload you can then use templating and `l10n` object will be set to a proper translation map based on device `locale`:

```json
{
  ..
  "title": "{{default [[hello]] .l10n.greeting}}! {{ default [[How is it going]] .l10n.question }} ?"
```

So that a device with `pt-BR` locale will get a push notification with title `Olá! Como tá indo?`.

Note, it's required to set a default value here (we used English in the example) for cases when no locale is found for the device, or no translations for the device language are provided in the request.

## Push rate limits

A good practice when working with push notifications is to avoid sending too many notifications to your users, especially marketing ones. Centrifugo PRO provides a way to rate limit notifications at the user's device level.

To do this, use the `rate_limit` field of `PushLimitStrategy`. For example, you can configure policies to send push notifications no faster than once per minute and no more than 10 pushes in one hour. Centrifugo supports several policies for a rate limit strategy. If a push notification hits the provided rate limits, it will be automatically delayed, or dropped if the `drop_if_rate_limited` flag is set to `true`.

:::tip

Given Centrifugo takes timezone from devices table into account timezone aware pushes only work with requests where `DeviceFilter` is used for sending – i.e. when Centrifugo iterates over devices in the database. If you send using raw tokens and want to inherit possibility to use rate limits - reach out to us, this may be supported.

:::

## Exposed metrics

Several metrics are available to monitor the state of Centrifugo push worker system:

#### centrifugo_push_notification_count

- **Type:** Counter
- **Labels:** provider, recipient_type, platform, success, err_code
- **Description:** Total count of push notifications.
- **Usage:** Helps in tracking the number and success rate of push notifications sent, providing insights for optimization and troubleshooting.

#### centrifugo_push_queue_consuming_lag

- **Type:** Gauge
- **Labels:** provider, queue
- **Description:** Queue consuming lag in seconds.
- **Usage:** Useful for monitoring the delay in processing jobs from the queue, helping identify potential bottlenecks and ensuring timely processing.

#### centrifugo_push_consuming_inflight_jobs

- **Type:** Gauge
- **Labels:** provider, queue
- **Description:** Number of jobs currently being processed.
- **Usage:** Helps in tracking the load on the job processing system, ensuring that resources are being utilized efficiently.

#### centrifugo_push_job_duration_seconds

- **Type:** Summary
- **Labels:** provider, recipient_type
- **Description:** Duration of push processing job in seconds.
- **Usage:** Useful for monitoring the performance of job processing, helping in performance tuning and issue resolution.

## Further reading and tutorials

Some additional materials include:

* Blog post [Discovering Centrifugo PRO: push notifications API](/blog/2023/10/29/discovering-centrifugo-pro-push-notifications)
* Adding push notifications to our [Grand Messenger Tutorial](../tutorial/push_notifications.md)
