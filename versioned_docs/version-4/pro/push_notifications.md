---
id: push_notifications
sidebar_label: Push notification API
title: Push notification API
---

This PRO feature is under active development, some changes expected here 🚧

Centrifugo excels in delivering real-time in-app messages to online users. Sometimes though you need a way to engage offline users to come back to your app. Or trigger some update in the app while it's running in the background. That's where push notifications may be used. Push notifications delivered over battery-efficient platform-dependent transport.

With Centrifugo PRO push notifications may be delivered to all popular application platforms:

* <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> Android devices
* <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> iOS devices
* <i className="bi bi-globe" style={{color: 'orange'}}></i> Web browsers which support Web Push API (Chrome, Firefox, see <a href="https://caniuse.com/push-api">this matrix</a>)

Centrifugo PRO provides API to manage user device tokens, device topic subscriptions and API to send push notifications towards registered devices and group of devices (subscribed to a topic).

![Push](/img/push_notifications.png)

To deliver push notifications to devices Centrifugo PRO integrates with the following providers:

* [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* [Huawei Messaging Service (HMS) Push Kit](https://developer.huawei.com/consumer/en/hms/huawei-pushkit/) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* [Apple Push Notification service (APNs) ](https://developer.apple.com/documentation/usernotifications) <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i>

Centrifugo PRO provides a comprehensive solution for sending push notifications by incorporating frontend SDKs from FCM, HMS, and Apple SDKs.

While these push notification providers handle the frontend and transport aspects of notification delivery, device token management and efficient push notification broadcasting still need to be addressed by the application backend. Centrifugo PRO offers an API for storing tokens in a PostgreSQL database and managing device subscriptions to topics in a secure, unified manner.

To facilitate efficient push notification broadcasting towards devices, Centrifugo PRO includes worker queues based on Redis streams.

Integration with FCM means that you can use existing Firebase messaging SDKs to extract push notification token for a device on different platforms (iOS, Android, Flutter, web browser) and setting up push notification listeners. The same for HMS and APNs - just use existing native SDKs and best practices on the frontend. Only a couple of additional steps required to integrate frontend with Centrifugo PRO device token and device topic storage. After doing that you will be able to send push notification towards single device, or towards group of devices subscribed to a topic. For example, with a simple Centrifugo API call like this:

```bash
curl -X POST http://localhost:8000/api \
-H "Authorization: apikey <KEY>" \
-d @- <<'EOF'

{
    "method": "send_push_notification",
    "params": {
        "recipient": {"topics": ["test"]},
        "notification": {
            "fcm": {
                "message": {
                    "notification": {"title": "Hello", "body": "How are you?"}
                }
            }
        }
    }
}
EOF
```

## Motivation and design choices

We tried to be practical with our Push Notification API, let's look at its design choices and implementation properties we were able to achieve.

### Storage for tokens

To start delivering push notifications in the application, developers usually need to integrate with providers such as FCM, HMS, and APNs. This integration typically requires the storage of device tokens in the application database and the implementation of sending push messages to provider push services.

Centrifugo PRO simplifies the process by providing a backend for device token storage, following best practices in token management. It reacts to errors and periodically removes stale devices/tokens to maintain a working set of device tokens based on provider recommendations.

### Efficient queuing

Additionally, Centrifugo PRO provides an efficient, scalable queuing mechanism for sending push notifications. Developers can send notifications from the app backend to Centrifugo API with minimal latency and let Centrifugo process sending to FCM, HMS, APNs concurrently using built-in workers. In our tests, we achieved hundreds of thousands of pushes in tens of seconds.

### Unified secure topics

FCM and HMS have a built-in way of sending notification to large groups of devices over [topics](https://firebase.google.com/docs/cloud-messaging/android/topic-messaging) mechanism ([the same for HMS](https://developer.huawei.com/consumer/en/doc/development/HMS-Plugin-Guides-V1/subscribetopic-0000001056797545-V1)). One problem with native FCM or HMS topics though is that client can subscribe to any topic from the frontend side without any permission check. In today's world this is usually not desired. So Centrifugo PRO re-implements FCM, HMS topics by introducing an additional API to manage device subscriptions to topics.

:::tip

In some cases you may have real-time channels and device subscription topics with matching names – to send messages to both online and offline users. Though it's up to you.

:::

Centrifugo PRO device topic subscriptions also add a way to introduce the missing topic semantics for APNs.

Centrifugo PRO additionally provides an API to create persistent bindings of user to notification topics. Then – as soon as user registers a device – it will be automatically subscribed to its own topics. As soon as user logs out from the app and you update user ID of the device - user topics binded to the device automatically removed/switched. This design solves one of the issues with FCM – if two different users use the same device it's becoming problematic to unsubscribe the device from large number of topics upon logout. Also, as soon as user to topic binding added (using `user_topic_update` API) – it will be synchronized across all user active devices. You can still manage such persistent subscriptions on the application backend side if you prefer and provide the full list inside `device_register` call.

### Non-obtrusive proxying

Unlike other solutions that combine different provider push sending APIs into a unified API, Centrifugo PRO provides a non-obtrusive proxy for all the mentioned providers. Developers can send notification payloads in a format defined by each provider.

It's also possible to send notifications into native FCM, HMS topics or send to raw FCM, HMS, APNs tokens using Centrifugo PRO's push API, allowing them to combine native provider primitives with those added by Centrifugo (i.e., sending to a list of device IDs or to a list of topics).

### Builtin analytics

Furthermore, Centrifugo PRO offers the ability to inspect sent push notifications using [ClickHouse analytics](./analytics.md#notifications-table). Providers may also offer their own analytics, [such as FCM](https://firebase.google.com/docs/cloud-messaging/understand-delivery?platform=web), which provides insight into push notification delivery. Centrifugo PRO also offers a way to analyze push notification delivery and interaction using the `update_push_status` API.

## Steps to integrate

1. Add provider SDK on the frontend side, follow provider instructions for your platform to obtain a push token for a device. For example, for FCM see instructions for [iOS](https://firebase.google.com/docs/cloud-messaging/ios/client), [Android](https://firebase.google.com/docs/cloud-messaging/android/client), [Flutter](https://firebase.google.com/docs/cloud-messaging/flutter/client), [Web Browser](https://firebase.google.com/docs/cloud-messaging/js/client)). The same for HMS or APNs – frontend part should be handled by their native SDKs.
2. Call Centrifugo PRO backend API with the obtained token. From the application backend call Centrifugo `device_register` API to register the device in Centrifugo PRO storage. Optionally provide list of topics to subscribe device to.
3. Centrifugo returns a registered device object. Pass a generated device ID to the frontend and save it on the frontend together with a token received from FCM.
5. Call Centrifugo `send_push_notification` API whenever it's time to deliver a push notification.

At any moment you can inspect device storage by calling `device_list` API.

Once user logs out from the app, you can detach user ID from device by using `device_update` or remove device with `device_remove` API.

## Configuration

In Centrifugo PRO you can configure one push provider or use all of them – this choice is up to you.

### FCM

As mentioned above Centrifigo uses PostgreSQL for token storage. To enable push notifications make sure `database` section defined in the configration and `fcm` is in the `push_notifications.enabled_providers` list. Centrifugo PRO uses Redis for queuing push notification requests, so Redis address should be configured also. Finally, to integrate with FCM a path to the credentials file must be provided (see how to create one [in this instruction](https://github.com/Catapush/catapush-docs/blob/master/AndroidSDK/DOCUMENTATION_PLATFORM_GMS_FCM.md)). So the full configuration to start sending push notifications over FCM may look like this:

```json
{
    ...
    "database": {
        "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres"
    },
    "push_notifications": {
        "redis_address": "localhost:6379",
        "enabled_providers": ["fcm"],
        "fcm_credentials_file_path": "/path/to/service/account/credentials.json"
    }
}
```

:::tip

Actually, PostgreSQL database configuration is optional here – you can use push notifications API without it. In this case you will be able to send notifications to FCM, HMS, APNs raw tokens, FCM and HMS native topics and conditions. I.e. using Centrifugo as an efficient proxy for push notifications (for example if you already keep tokens in your database). But sending to device ids and topics, and token/topic management APIs won't be available for usage.

:::

### HMS

```json
{
    ...
    "database": {
        "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres"
    },
    "push_notifications": {
        "redis_address": "localhost:6379",
        "enabled_providers": ["hms"],
        "hms_app_id": "<your_app_id>",
        "hms_app_secret": "<your_app_secret>",
    }
}
```

:::tip

See example how to get app id and app secret [here](https://github.com/Catapush/catapush-docs/blob/master/AndroidSDK/DOCUMENTATION_PLATFORM_HMS_PUSHKIT.md).

:::

### APNs

```json
{
    ...
    "database": {
        "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres"
    },
    "push_notifications": {
        "redis_address": "localhost:6379",
        "enabled_providers": ["apns"],
        "apns_endpoint": "development",
        "apns_bundle_id": "com.example.your_app",
        "apns_auth": "token",
        "apns_token_auth_key_path": "/path/to/auth/key/file.p8",
        "apns_token_key_id": "<your_key_id>",
        "apns_token_team_id": "your_team_id",
    }
}
```

We also support auth over p12 certificates with the following options:

* `push_notifications.apns_cert_p12_path`
* `push_notifications.apns_cert_p12_b64`
* `push_notifications.apns_cert_p12_password`

### Other options

#### push_notifications.max_inactive_device_days

This option configures the number of days to keep device without updates. By default Centrifugo does not remove inactive devices.

### Use PostgreSQL as queue

Coming soon 🚧

Centrifugo PRO utilizes Redis Streams as the default queue engine for push notifications. However, it also offers the option to employ PostgreSQL for queuing. It's as simple as:

```json title="config.json"
{
    ...
    "database": {
        "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres"
    },
    "push_notifications": {
        "queue_engine": "database",
        // rest of the options...
    }
}
```

:::tip

Queue based on Redis streams is faster, so if you start with PostgreSQL based queue – you have an option to switch to a more performant implementation later. Though active push notifications will be lost during a switch.

:::

## API description

### device_register

Registers or updates device information.

#### device_register request

| Field           | Type     | Required | Description                           |
|-----------------|----------|----|---------------------------------------------|
| `id`            | string | No | ID of the device being registered (provide it when updating).      |
| `provider`      | string | Yes | Provider of the device token (valid choices: `fcm`, `hms`, `apns`). |
| `token`         | string | Yes | Push notification token for the device.     |
| `platform`      | string | Yes | Platform of the device (valid choices: `ios`, `android`, `web`). |
| `user`          | string | No  | User associated with the device.            |
| `topics`      | array of strings | No | Device topic subscriptions. This should be a full list which replaces all the topics previously accociated with the device. User topics managed by `UserTopic` model will be automatically attached.  |
| `tags`          | map<string, string> | No | Additional tags for the device (indexed key-value data).  |
| `meta`          | map<string, string> | No | Additional metadata for the device (not indexed).         |

#### device_register result

| Field Name | Type | Required | Description |
|------------|------|----|-------------|
| `id` | string | Yes | The device ID that was registered/updated. |

### device_update

Call this method to update device. For example, when user logs out the app and you need to detach user ID from the device.

#### device_update request

| Field           | Type     | Required | Description                           |
|-----------------|----------|----|---------------------------------------------|
| `ids`            | repeated string | No | Device ids to filter       |
| `users`      | repeated string | No | Device users filter |
| `provider_tokens`         | repeated DeviceProviderTokens | No | Provider tokens filter     |
| `user_update`      | DeviceUserUpdate | No | Optional user update object |
| `meta_update`          | DeviceMetaUpdate | No | Optional device meta update object            |
| `tags_update`          | DeviceTagsUpdate | No | Optional device tags update object         |
| `topics_update`          | DeviceChannelsUpdate | No | Optional topics update object  |

`DeviceUserUpdate`:

| Field           | Type     | Required | Description                           |
|-----------------|----------|----|---------------------------------------------|
| `user`            | string | Yes | User to set                                |

`DeviceMetaUpdate`:

| Field           | Type     | Required | Description                           |
|-----------------|----------|----|---------------------------------------------|
| `meta`            | map<string, string> | Yes | Meta to set                   |

`DeviceTagsUpdate`:

| Field           | Type     | Required | Description                           |
|-----------------|----------|----|---------------------------------------------|
| `tags`            | map<string, string> | Yes | Tags to set                   |

`DeviceChannelsUpdate`:

| Field           | Type     | Required | Description                           |
|-----------------|----------|----|---------------------------------------------|
| `topics`            | repeated string | Yes | Channels to set               |

#### device_update result

Empty object.

### device_remove

Removes device from storage. This may be also called when user logs out the app and you don't need its device token after that.

#### device_remove request

| Field Name | Type | Required | Description |
| --- | --- | ----| --- |
| `ids` | repeated string | No | A list of device IDs to be removed |
| `users` | repeated string | No | A list of device user IDs to filter devices to remove |
| `provider_tokens` | `ProviderTokens` | No | Provider tokens to remove |

#### device_remove result

Empty object.

### device_list

Returns a paginated list of registered devices according to request filter conditions.

#### device_list request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `ids`   | repeated string | No | List of device IDs to filter results. |
| `providers` | repeated string | No | List of device token providers to filter results. |
| `provider_tokens` | repeated `ProviderTokens` | No | Provider tokens to filter results. |
| `platforms` | repeated string | No | List of device platforms to filter results. |
| `users` | repeated string | No | List of device users to filter results. |
| `since` | string | No | Cursor for pagination (last device id in previous batch, empty for first page). |
| `limit` | int32 | No | Maximum number of devices to retrieve. |
| `include_topics` | bool | No | Flag indicating whether to include topics information for each device. |
| `include_tags` | bool | No | Flag indicating whether to include tags information for each device. |
| `include_meta` | bool | No | Flag indicating whether to include meta information for each device. |

#### device_list result

| Field Name | Type | Required | Description |
| --- | --- | --- | --- |
| `items` | repeated `Device` | Yes | A list of devices |
| `has_more` | bool | Yes | A flag indicating whether there are more devices available |

`Device`:

| Field Name | Type | Description |
|------------|------|-------------|
| `id` | string | The device's ID. |
| `provider` | string | The device's token provider. |
| `token` | string | The device's token. |
| `platform` | string | The device's platform. |
| `user` | string | The user associated with the device. |
| `topics` | array of strings | Only included if `include_topics` was true |
| `tags` | map<string, string> | Only included if `include_tags` was true |
| `meta` | map<string, string> | Only included if `include_meta` was true |

### device_topic_update

Manage mapping of device to topics.

#### device_topic_update request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `device_id`   | string | Yes | Device ID. |
| `op` | string | Yes | `add` or `remove` or `set` |
| `topics` | repeated string | No | List of topics. |

#### device_topic_update result

Empty object.

### device_topic_list

List device to topic mapping.

#### device_topic_list request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `device_ids`   | repeated string | No | List of device IDs to filter results. |
| `device_providers` | repeated string | No | List of device token providers to filter results. |
| `device_provider_tokens` | repeated `ProviderTokens` | No | Provider tokens to filter results. |
| `device_platforms` | repeated string | No | List of device platforms to filter results. |
| `device_users` | repeated string | No | List of device users to filter results. |
| `topics` | repeated string | No | List of topics to filter results. |
| `topic_prefix` | string | No | Channel prefix to filter results. |
| `since` | string | No | Cursor for pagination (last device id in previous batch, empty for first page). |
| `limit` | int32 | No | Maximum number of devices to retrieve. |
| `include_device` | bool | No | Flag indicating whether to include Device information for each object. |

#### device_topic_list result

| Field Name | Type | Required | Description |
| --- | --- | --- | --- |
| `items` | repeated `DeviceChannel` | Yes | A list of DeviceChannel objects |
| `has_more` | bool | Yes | A flag indicating whether there are more devices available |

`DeviceChannel`:

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `id`   | string | Yes | ID of DeviceChannel |
| `device_id` | string | Yes | Device ID |
| `topic` | string | Yes | Channel |

### user_topic_update

Manage mapping of topics with users. These user topics will be automatically attached to user devices upon registering. And removed from device upon deattaching user.

#### user_topic_update request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `user`   | string | Yes | User ID. |
| `op` | string | Yes | `add` or `remove` or `set` |
| `topics` | repeated string | No | List of topics. |

#### user_topic_update result

Empty object.

### user_topic_list

List user to topic mapping.

#### user_topic_list request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `users`   | repeated string | No | List of users to filter results. |
| `topics` | repeated string | No | List of topics to filter results. |
| `topic_prefix` | string | No | Channel prefix to filter results. |
| `since` | string | No | Cursor for pagination (last id in previous batch, empty for first page). |
| `limit` | int32 | No | Maximum number of `UserTopic` objects to retrieve. |

#### user_topic_list result

| Field Name | Type | Description |
| --- | --- | --- |
| `items` | repeated `UserTopic` | A list of UserTopic objects |
| `has_more` | bool | A flag indicating whether there are more devices available |

`UserTopic`:

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `id`   | string | Yes | ID of `UserTopic` |
| `user` | string | Yes | User ID |
| `topic` | string | Yes | Channel |

### send_push_notification

Send push notification to specific `device_ids`, or to `topics`, or native provider identifiers like `fcm_tokens`, or to `fcm_topic`. Request will be queued by Centrifugo, consumed by Centrifugo built-in workers and sent to the provider API.

#### send_push_notification request

| Field name          | Type         | Required |Description |
|-----------------|--------------|-----|--------|
| `recipient`       | `PushRecipient` | Yes | Recipient of push notification      |
| `notification`    | `PushNotification` | Yes | Push notification to send     |

`PushRecipient` (you **must set only one of the following fields**):

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `device_ids`    | repeated string | No | Send to a list of device IDs (managed by Centrifugo) |
| `topics`      | repeated string | No | Send to topics (managed by Centrifugo)     |
| `fcm_tokens`    | repeated string | No | Send to a list of FCM native tokens     |
| `fcm_topic`     | string     | No | Send to a FCM native topic     |
| `fcm_condition`     | string     | No | Send to a FCM native condition     |
| `hms_tokens`    | repeated string | No | Send to a list of HMS native tokens     |
| `hms_topic`     | string     | No | Send to a HMS native topic     |
| `hms_condition`     | string     | No | Send to a HMS native condition     |
| `apns_tokens`    | repeated string | No | Send to a list of APNs native tokens     |

`PushNotification`:

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `uid`             | string       | No | Unique send id, used for Centrifugo builtin analytics |
| `expire_at`       | int64        | No | Unix timestamp when Centrifugo stops attempting to send this notification (this does not relate to notification TTL fields)      |
| `fcm`       | `FcmPushNotification` | No | Notification for FCM      |
| `hms`       | `HmsPushNotification` | No | Notification for HMS      |
| `apns`       | `ApnsPushNotification` | No | Notification for APNs   |

`FcmPushNotification`:

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `message` | JSON object | Yes | FCM [Message](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#Message) described in FCM docs.  |

`HmsPushNotification`:

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `message` | JSON object | Yes | HMS [Message](https://developer.huawei.com/consumer/en/doc/development/HMSCore-References/https-send-api-0000001050986197#EN-US_TOPIC_0000001134031085__p1324218481619) described in HMS Push Kit docs. |

`ApnsPushNotification`:

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `headers` | map<string, string> | No | APNs [headers](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns)  |
| `payload` | JSON object | Yes | APNs [payload](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/generating_a_remote_notification) |

#### send_push_notification result

| Field Name | Type | Description |
| --- | --- | --- |
| `uid` | string | Unique send id, matches `uid` in request if it was provided |

### update_push_status

This API call is experimental, some changes may happen here.

Centrifugo PRO also allows tracking status of push notification delivery and interaction. It's possible to use `update_push_status` API to save the updated status of push notification to the `notifications` [analytics table](./analytics.md#notifications-table). Then it's possible to build insights into push notification effectiveness by querying the table.

The `update_push_status` API supposes that you are using `uid` field with each notification sent and you are using Centrifugo PRO generated device IDs (as described in [steps to integrate](#steps-to-integrate)).

This is a part of server API at the moment, so you need to proxy requests to this endpoint over your backend. We can consider making this API suitable for requests from the client side – please reach out if your use case requires it.

#### update_push_status request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `uid` | string | Yes | `uid` (unique send id) from `send_push_notification` |
| `status`   | string | Yes | Status of push notification - `delivered` or `interacted` |
| `device_id` | string | Yes | Device ID |
| `msg_id` | string | No | Message ID |

#### update_push_status result

Empty object.

## Metrics

Several metrics are available to monitor the state of Centrifugo push worker system:

* `centrifugo_push_notification_count` - counter, shows total count of push notifications sent to providers (splitted by provider, recipient type, platform, success, error code).
* `centrifugo_push_queue_consuming_lag` - gauge, shows the lag of queues, should be close to zero most of the time. Splitted by provider and name of queue.
* `centrifugo_push_consuming_inflight_jobs` - gauge, shows immediate number of workers proceccing pushes. Splitted by provider and name of queue.
* `centrifugo_push_job_duration_seconds` - summary, provides insights about worker job duration timings. Splitted by provider and recipient type.

## Further reading and tutorials

Coming soon.
