---
id: push_notifications
sidebar_label: Push notification API
title: Push notification API
---

Centrifugo excels in delivering real-time in-app messages to online users. Sometimes though you need a way to engage offline users to come back to your app. Or trigger some update in the app while it's running in the background. That's where push notifications may be used. Push notifications delivered over battery-efficient platform-dependent transport.

With Centrifugo PRO push notifications may be delivered to all popular application platforms:

* <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> Android devices
* <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> iOS devices
* <i className="bi bi-globe" style={{color: 'orange'}}></i> Web browsers which support Web Push API (Chrome, Firefox, see <a href="https://caniuse.com/push-api">this matrix</a>)

Centrifugo PRO provides API to manage user device tokens, device topic subscriptions and API to send push notifications towards registered devices and group of devices (subscribed to a topic). API also supports timezone-aware push notifications, push localizations, templating and per user device push rate limiting.

![Push](/img/push_notifications.png)

To deliver push notifications to devices Centrifugo PRO integrates with the following providers:

* [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* [Huawei Messaging Service (HMS) Push Kit](https://developer.huawei.com/consumer/en/hms/huawei-pushkit/) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* [Apple Push Notification service (APNs) ](https://developer.apple.com/documentation/usernotifications) <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i>

FCM, HMS, APNs handle the frontend and transport aspects of notification delivery. Device token storage, management and efficient push notification broadcasting is managed by Centrifugo PRO. Tokens are stored in a PostgreSQL database. To facilitate efficient push notification broadcasting towards devices, Centrifugo PRO includes worker queues based on Redis streams (and also provides and option to use PostgreSQL-based queue).

Integration with FCM means that you can use existing Firebase messaging SDKs to extract push notification token for a device on different platforms (iOS, Android, Flutter, web browser) and setting up push notification listeners. The same for HMS and APNs - just use existing native SDKs and best practices on the frontend. Only a couple of additional steps required to integrate frontend with Centrifugo PRO device token and device topic storage. After doing that you will be able to send push notification towards single device, or towards group of devices subscribed to a topic. For example, with a simple Centrifugo API call like this:

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

We tried to be practical with our Push Notification API, let's look at its design choices and implementation properties we were able to achieve.

### Storage for tokens

To start delivering push notifications in the application, developers usually need to integrate with providers such as FCM, HMS, and APNs. This integration typically requires the storage of device tokens in the application database and the implementation of sending push messages to provider push services.

Centrifugo PRO simplifies the process by providing a backend for device token storage, following best practices in token management. It reacts to errors and periodically removes stale devices/tokens to maintain a working set of device tokens based on provider recommendations.

### Efficient queuing

Additionally, Centrifugo PRO provides an efficient, scalable queuing mechanism for sending push notifications. Developers can send notifications from the app backend to Centrifugo API with minimal latency and let Centrifugo process sending to FCM, HMS, APNs concurrently using built-in workers. In our tests, we achieved several millions pushes per minute.

Centrifugo PRO also supports delayed push notifications feature – to queue push for a later delivery, so for example you can send notification based on user time zone and let Centrifugo PRO send it when needed.

### Unified secure topics

FCM and HMS have a built-in way of sending notification to large groups of devices over [topics](https://firebase.google.com/docs/cloud-messaging/android/topic-messaging) mechanism ([the same for HMS](https://developer.huawei.com/consumer/en/doc/development/HMS-Plugin-Guides-V1/subscribetopic-0000001056797545-V1)). Topics are great since you can create segments and groups of devices and target specific ones with your notifications.

One problem with native FCM or HMS topics though is that client can subscribe to any topic from the frontend side without any permission check. In today's world this is usually not desired. So Centrifugo PRO re-implements FCM, HMS topics by introducing an additional API to manage device subscriptions to topics.

:::tip

In some cases you may have real-time channels and device subscription topics with matching names – to send messages to both online and offline users. Though it's up to you.

:::

Centrifugo PRO device topic subscriptions also add a way to introduce the missing topic semantics for APNs.

Centrifugo PRO additionally provides an API to create persistent bindings of user to notification topics. Then – as soon as user registers a device – it will be automatically subscribed to its own topics. As soon as user logs out from the app and you update user ID of the device - user topics binded to the device automatically removed/switched. This design solves one of the issues with FCM – if two different users use the same device it's becoming problematic to unsubscribe the device from large number of topics upon logout. Also, as soon as user to topic binding added (using `user_topic_update` API) – it will be synchronized across all user active devices. You can still manage such persistent subscriptions on the application backend side if you prefer and provide the full list inside `device_register` call.

### Push personalization

Centrifugo PRO provides several ways to make push notifications individual and take care about better user experience with notifications. This includes:

* [Timezone-aware](#timezone-aware-push) push notifications
* Notification [templating](#templating)
* Notification [localizations](#localizations)
* Per user device [rate limiting](#push-rate-limits)

All these features may be used on individual request basis.

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

This integer option configures the number of days to keep device without updates. By default Centrifugo does not remove inactive devices.

#### push_notifications.dry_run

Boolean option, when `true` Centrifugo PRO does not send push notifications to FCM, APNs, HMS providers but instead just print logs. Useful for development.

#### push_notifications.dry_run_latency

Duration. When set together with `push_notifications.dry_run` every dry-run request will cause some delay in workers emulating real-world latency. Useful for development.

### Use PostgreSQL as queue

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

Queue based on Redis streams is generally more efficient, so if you start with PostgreSQL based queue – you have an option to switch to a more performant implementation later. Though in-flight and currently queued push notifications will be lost during a switch.

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
| `timezone`          | string | No  | Timezone of device user ([IANA time zone identifier](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), ex. `Europe/Nicosia`). See [Timezone aware push](#timezone-aware-push)            |
| `locale`          | string | No  | Locale of device user. Must be IETF BCP 47 language tag - ex. `en-US`, `fr-CA`. See [Localizations](#localizations)            |
| `topics`      | array of strings | No | Device topic subscriptions. This should be a full list which replaces all the topics previously accociated with the device. User topics managed by `UserTopic` model will be automatically attached.  |
| `meta`          | `map<string, string>` | No | Additional custom metadata for the device         |

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
| `user_update`      | `DeviceUserUpdate` | No | Optional user update object |
| `timezone_update`      | `DeviceTimezoneUpdate` | No | Optional timezone update object |
| `locale_update`      | `DeviceLocaleUpdate` | No | Optional locale update object |
| `meta_update`          | `DeviceMetaUpdate` | No | Optional device meta update object            |
| `topics_update`          | `DeviceTopicsUpdate` | No | Optional topics update object  |

`DeviceUserUpdate`:

| Field           | Type     | Required | Description                           |
|-----------------|----------|----|---------------------------------------------|
| `user`            | string | Yes | User to set                                |


`DeviceTimezoneUpdate`:

| Field           | Type     | Required | Description                           |
|-----------------|----------|----|---------------------------------------------|
| `timezone`            | string | Yes | Timezone to set                                |


`DeviceLocaleUpdate`:

| Field           | Type     | Required | Description                           |
|-----------------|----------|----|---------------------------------------------|
| `locale`            | string | Yes | Locale to set                                |

`DeviceMetaUpdate`:

| Field           | Type     | Required | Description                           |
|-----------------|----------|----|---------------------------------------------|
| `meta`            | `map<string, string>` | Yes | Meta to set                   |

`DeviceTopicsUpdate`:

| Field           | Type     | Required | Description                           |
|-----------------|----------|----|---------------------------------------------|
| `op`            | string | Yes | Operation to make: `add`, `remove` or `set` |
| `topics`            | repeated string | Yes | Topics for the operation |

#### device_update result

Empty object.

### device_remove

Removes device from storage. This may be also called when user logs out the app and you don't need its device token after that.

#### device_remove request

| Field Name | Type | Required | Description |
| --- | --- | ----| --- |
| `ids` | repeated string | No | A list of device IDs to be removed |
| `users` | repeated string | No | A list of device user IDs to filter devices to remove |

#### device_remove result

Empty object.

### device_list

Returns a paginated list of registered devices according to request filter conditions.

#### device_list request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `filter`   | `DeviceFilter` | Yes | How to filter results |
| `cursor` | string | No | Cursor for pagination (last device id in previous batch, empty for first page). |
| `limit` | int32 | No | Maximum number of devices to retrieve. |
| `include_total_count` | bool | No | Flag indicating whether to include total count for the current filter. |
| `include_topics` | bool | No | Flag indicating whether to include topics information for each device. |
| `include_meta` | bool | No | Flag indicating whether to include meta information for each device. |

`DeviceFilter`:

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `ids`   | repeated string | No | List of device IDs to filter results. |
| `providers` | repeated string | No | List of device token providers to filter results. |
| `platforms` | repeated string | No | List of device platforms to filter results. |
| `users` | repeated string | No | List of device users to filter results. |
| `topics` | repeated string | No | List of topics to filter results. |

#### device_list result

| Field Name | Type | Required | Description |
| --- | --- | --- | --- |
| `items` | repeated `Device` | Yes | A list of devices |
| `next_cursor` | string | No | Cursor string for retreiving the next page, if not set - then no next page exists |
| `total_count` | integer | No | Total count value (if `include_total_count` used) |

`Device`:

| Field Name | Type | Required | Description |
|------------|------| --- | -------------|
| `id` | string | Yes | The device's ID. |
| `provider` | string | Yes | The device's token provider. |
| `token` | string | Yes | The device's token. |
| `platform` | string | Yes | The device's platform. |
| `user` | string | No | The user associated with the device. |
| `topics` | array of strings | No | Only included if `include_topics` was true |
| `meta` | `map<string, string>` | No | Only included if `include_meta` was true |

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
| `filter`   | `DeviceTopicFilter` | No | List of device IDs to filter results. |
| `cursor` | string | No | Cursor for pagination (last device id in previous batch, empty for first page). |
| `limit` | int32 | No | Maximum number of devices to retrieve. |
| `include_device` | bool | No | Flag indicating whether to include Device information for each object. |
| `include_total_count` | bool | No | Flag indicating whether to include total count info to response. |

`DeviceTopicFilter`:

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `device_ids`   | repeated string | No | List of device IDs to filter results. |
| `device_providers` | repeated string | No | List of device token providers to filter results. |
| `device_platforms` | repeated string | No | List of device platforms to filter results. |
| `device_users` | repeated string | No | List of device users to filter results. |
| `topics` | repeated string | No | List of topics to filter results. |
| `topic_prefix` | string | No | Topic prefix to filter results. |

#### device_topic_list result

| Field Name | Type | Required | Description |
| --- | --- | --- | --- |
| `items` | repeated `DeviceTopic` | Yes | A list of DeviceChannel objects |
| `next_cursor` | string | No | Cursor string for retreiving the next page, if not set - then no next page exists |
| `total_count` | integer | No | Total count value (if `include_total_count` used) |

`DeviceTopic`:

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `id`   | string | Yes | ID of DeviceTopic object |
| `device_id` | string | Yes | Device ID |
| `topic` | string | Yes | Topic |

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
| `flter`   | `UserTopicFilter` | No | Filter object. |
| `cursor` | string | No | Cursor for pagination (last id in previous batch, empty for first page). |
| `limit` | int32 | No | Maximum number of `UserTopic` objects to retrieve. |
| `include_total_count` | bool | No | Flag indicating whether to include total count info to response. |

`UserTopicFilter`:

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `users`   | repeated string | No | List of users to filter results. |
| `topics` | repeated string | No | List of topics to filter results. |
| `topic_prefix` | string | No | Channel prefix to filter results. |

#### user_topic_list result

| Field Name | Type | Description |
| --- | --- | --- |
| `items` | repeated `UserTopic` | A list of UserTopic objects |
| `next_cursor` | string | No | Cursor string for retreiving the next page, if not set - then no next page exists |
| `total_count` | integer | No | Total count value (if `include_total_count` used) |

`UserTopic`:

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `id`   | string | Yes | ID of `UserTopic` |
| `user` | string | Yes | User ID |
| `topic` | string | Yes | Topic |

### send_push_notification

Send push notification to specific `device_ids`, or to `topics`, or native provider identifiers like `fcm_tokens`, or to `fcm_topic`. Request will be queued by Centrifugo, consumed by Centrifugo built-in workers and sent to the provider API.

#### send_push_notification request

| Field name          | Type         | Required |Description |
|-----------------|--------------|-----|--------|
| `recipient`       | `PushRecipient` | Yes | Recipient of push notification      |
| `notification`    | `PushNotification` | Yes | Push notification to send     |
| `uid`             | string       | No | Unique identifier for each push notification request, can be used to cancel push. We recommend using UUID v4 for it. Two different requests must have different `uid` |
| `send_at`             | int64       | No | Optional Unix time in the future (in seconds) when to send push notification, push will be queued until that time. |
| `optimize_for_reliability`             | bool       | No | Makes processing heavier, but tolerates edge cases, like not loosing inflight pushes due to temporary queue unavailability. |
| `limit_strategy`             | `PushLimitStrategy`       | No | Can be used to set push time constraints (based on device timezone) adnd rate limits. Note, when it's used Centrifugo processes pushes one by one instead of batch sending |
| `analytics_uid`             | string       | No | Identifier for push notification analytics, if not set - Centrifugo will use `uid` field. |
| `localizations`             | `map<string, PushLocalization>`       | No | Optional per language localizations for push notification. |
| `use_templating`             | bool       | No | If set - Centrifugo will use templating for push notification. Note that setting localizations enables templating automatically. |
| `use_meta`             | bool       | No | If set - Centrifugo will additionally load device meta during push sending, this meta becomes available in templating. |

`PushRecipient` (you **must set only one of the following fields**):

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `filter`    | `DeviceFilter` | No | Send to device IDs based on Centrifugo device storage filter |
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
| `expire_at`       | int64        | No | Unix timestamp when Centrifugo stops attempting to send this notification. Note, it's Centrifugo specific and does not relate to notification TTL fields. We generally recommend to always set this to a reasonable value to protect your app from old push notifications sending      |
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
| `headers` | `map<string, string>` | No | APNs [headers](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns)  |
| `payload` | JSON object | Yes | APNs [payload](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/generating_a_remote_notification) |

`PushLocalization`:

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `translations` | `map<string, string>` | Yes | Variable name to value for the specific language.  |

`PushLimitStrategy`:

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `rate_limit` | `PushRateLimitStrategy` | No | Set rate limit policies  |
| `time_limit` | `PushTimeLimitStrategy` | No | Set time limit policy  |

`PushRateLimitStrategy`:

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `key` | string | No | Optional key for rate limit policy, supports variables (`devide.id` and `device.user`).  |
| `policies` | repeated `RateLimitPolicy` | No | Set time limit policy  |
| `drop_if_rate_limited` | bool | No | Drop push if rate limited, otherwise queue for later  |
delayed
`RateLimitPolicy`:

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `rate` | int | Yes | Allowed rate  |
| `interval_ms` | int | Yes | Interval over which rate is allowed  |

`PushTimeLimitStrategy`:

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `send_after_time` | string | Yes | Local time in format `HH:MM:SS` after which push must be sent  |
| `send_before_time` | string | Yes | Local time in format `HH:MM:SS` before which push must be sent  |
| `no_tz_send_now` | bool | No | If device does not have timezone send push immediately, be default - will be dropped  |

#### send_push_notification result

| Field Name | Type | Description |
| --- | --- | --- |
| `uid` | string | Unique send id, matches `uid` in request if it was provided |

### cancel_push

Cancel delayed push notification (which was sent with custom `send_at` value).

#### update_push_status request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `uid` | string | Yes | `uid` of push notification to cancel |

#### update_push_status result

Empty object.

### update_push_status

This API call is experimental, some changes may happen here.

Centrifugo PRO also allows tracking status of push notification delivery and interaction. It's possible to use `update_push_status` API to save the updated status of push notification to the `notifications` [analytics table](./analytics.md#notifications-table). Then it's possible to build insights into push notification effectiveness by querying the table.

The `update_push_status` API supposes that you are using `uid` field with each notification sent and you are using Centrifugo PRO generated device IDs (as described in [steps to integrate](#steps-to-integrate)).

This is a part of server API at the moment, so you need to proxy requests to this endpoint over your backend. We can consider making this API suitable for requests from the client side – please reach out if your use case requires it.

#### update_push_status request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `analytics_uid` | string | Yes | `uid` (unique send id) from `send_push_notification` |
| `status`   | string | Yes | Status of push notification - `delivered` or `interacted` |
| `device_id` | string | Yes | Device ID |
| `msg_id` | string | No | Message ID |

#### update_push_status result

Empty object.

## Timezone aware push

Setting `timezone` to a device (see [device_register](#device_register) call) opens a road for timezone-aware push notifications. This is nice because you can send notifications to users in a convenient time of the day. Avoid pushes at night, push at specific time.

To send such push notifications use `time_limit` field of `PushLimitStrategy`. For example, you can send push between `09:00:00` and `09:30:00` – and Centrifugo will send push somewhere during this period of user's local time.

:::tip

Given Centrifugo takes timezone from devices table into account timezone aware pushes only work with requests where `DeviceFilter` is used for sending – i.e. when Centrifugo iterates over devices in the database. If you send using raw tokens and want to inherit possibility to use timezones - reach out to us, this may be supported.

:::

## Templating

It's possible to use templating in the content of your push notifications payloads. By default, Centrifugo does not use templating since this allows broadcasting pushes at max speed. You have to set `use_templating` flag to `true` when sending push to enable template execution. Here is an example of using templating:

```json
{
  ..
  "title": "Hello {{.device.meta.first_name}}"
```

To access device meta content in push template (as shown above) additionally set `use_meta` flag to `true` in send push notification request. Without `use_meta` you only have access to `.device.id` and `.device.user` variables.

:::tip

Given Centrifugo takes timezone from devices table into account timezone aware pushes only work with requests where `DeviceFilter` is used for sending – i.e. when Centrifugo iterates over devices in the database.

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
    }
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

Note, it's required to set default value here (we used English language in the example) for the cases when no locale found in device, or no translations for the device language provided in the request.

## Push rate limits

A good practice when working with push notifications is to avoid sending too many notifications to your users, especially marketing ones. Centrifugo PRO provides a way to rate limit notifications on user's device level.

To do this, use `rate_limit` field of `PushLimitStrategy`. For example, you can configure policies to send push notifications not faster than once per minute and not more pushes than 10 in one hour. I.e. Centrifugo supports several policies for rate limit strategy. If push notification hits provided rate limits then it will be automatically delayed, or dropped if `drop_if_rate_limited` flag set to `true`.

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
- **Description:** Number of inflight jobs being consumed.
- **Usage:** Helps in tracking the load on the job processing system, ensuring that resources are being utilized efficiently.

#### centrifugo_push_job_duration_seconds

- **Type:** Summary
- **Labels:** provider, recipient_type
- **Description:** Duration of push processing job in seconds.
- **Usage:** Useful for monitoring the performance of job processing, helping in performance tuning and issue resolution.

## Further reading and tutorials

Coming soon.
