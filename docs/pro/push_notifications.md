---
id: push_notifications
sidebar_label: Push notification API
title: Push notification API (coming soon)
---

Centrifugo excels in delivering real-time in-app messages to online users. Sometimes though you need a way to engage offline users to come back to your app. Or trigger some update in the app while it's running in the background. That's where push notifications may be used. Push notifications delivered over battery-efficient platform-dependent transport.

With Centriufugo PRO push notifications may be delivered to all popular application platforms:

* <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> Android devices
* <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> iOS devices
* <i className="bi bi-globe" style={{color: 'orange'}}></i> Web browsers which support Web Push API (Chrome, Firefox, see <a href="https://caniuse.com/push-api">this matrix</a>)

Centrifugo PRO provides API to manage user device tokens, device channel subscriptions and API to send push notifications towards registered devices and group of devices (subscribed to a channel).

![Push](/img/push_notifications.png)

To deliver push notifications to devices Centrifugo PRO integrates with the following providers:

* [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* [Huawei Messaging Service (HMS) Push Kit](https://developer.huawei.com/consumer/en/hms/huawei-pushkit/) <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> <i className="bi bi-globe" style={{color: 'orange'}}></i>
* [Apple Push Notification service (APNs) ](https://developer.apple.com/documentation/usernotifications) <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i>

This means that Centrifugo PRO covers full flow of push notification integration including frontend SDKs (provided by FCM, HMS, Apple SDKs).

All these push notification providers only manage frontend and transport part of notification delivery. Device token management and effective push notification broadcasting are parts to be solved by the application backend. Centrifugo PRO provides an API to store tokens in database (PostgreSQL), manage device subscriptions to channels in a unified way.

Centrifugo PRO comes with super efficient worker queues (based on Redis streams) which allow broadcasting push notifications towards devices in a very efficient way.

Integration with FCM means that you can use existing Firebase messaging SDKs to extract push notification token for a device on different platforms (iOS, Android, Flutter, web browser) and setting up push notification listeners. Only a couple of additional steps required to integrate frontend with Centrifugo PRO device token and device subscription storage. After doing that you will be able to send push notification towards single device, or towards devices subscribed to a channel. For example, with a simple Centrifugo API call like this:

```bash
curl -X POST http://localhost:8000/api \
-H "Authorization: apikey <KEY>" \
-d @- <<'EOF'

{
    "method": "send_push_notification",
    "params": {
        "recipient": {"channels": ["test"]},
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

Usually the first thing you'd do in the app to start delivering push notifications is integrating with huge providers like FCM, HMS, APNs. Integrating with these providers usually mean you need to keep device tokens in the application database and implement sending push messages to provider Push Services.

Centrifugo PRO provides the required backend for device tokens, and tries to follow best practices when working with tokens. It follows provider advices to keep only a working set of device tokens by reacting on errors and periodically removing stale devices/tokens.

Centrifugo PRO provides an efficient and scalable queuing mechanism for sending push notifications. Developers can send notifications from the app backend to Centrifugo API with a minimal latency, and let Centrifugo process sending to FCM, HMS, APNs concurrently from the built-in workers.

FCM and HMS have a built-in way of sending notification to large groups of devices over [topics](https://firebase.google.com/docs/cloud-messaging/android/topic-messaging) mechanism ([the same for HMS](https://developer.huawei.com/consumer/en/doc/development/HMS-Plugin-Guides-V1/subscribetopic-0000001056797545-V1)). One problem with native FCM or HMS topics though is that client can subscribe to any topic from the frontend side without any permission check. In today's world this is usually not desired. So Centrifugo PRO re-implements FCM, HMS topics by introducing an additional API to manage device subscriptions to channels. We intentionally called it `channels` to make the concept closer to our real-time API. In some cases you may have real-time channels and device subscription channels with matching names – to send messages to both online and offline users. Though it's up to you. Centrifugo PRO device subscriptions also add a way to introduce topic semantics for APNs.

Centrifugo PRO tries to avoid combining push notifications APIs for all supported providers into one unified API – just gives a way to send notification payloads in a format defined by each provider. This allows Centrifugo PRO to be a non-obtrusive proxy for all the mentioned providers. 

Apart from this you get a possibility to inspect sent push notifications over our [ClickHouse analytics](./analytics.md#notifications-table). Also, providers may provide their own analytics. For example, [FCM provides analytics](https://firebase.google.com/docs/cloud-messaging/understand-delivery?platform=web) from which you can get insight into push notification delivery.

One more thing – in our push API we left a possibility to send notifications into FCM, HMS topics or sending to raw FCM, HMS, APNs tokens, so you can combine native provider primitives with those added by Centrifugo (i.e. sending to a list of device IDs or to a list of channels).

## Steps to integrate

1. Add provider SDK on the frontend side, follow provider instructions for your platform to obtain a push token for a device. For example, for FCM see instructions for [iOS](https://firebase.google.com/docs/cloud-messaging/ios/client), [Android](https://firebase.google.com/docs/cloud-messaging/android/client), [Flutter](https://firebase.google.com/docs/cloud-messaging/flutter/client), [Web Browser](https://firebase.google.com/docs/cloud-messaging/js/client)). The same for HMS or APNs – frontend part should be handled by their native SDKs.
2. Call Centrifugo PRO backend API with the obtained token. From the application backend call Centrifugo `device_register` API to register the device in Centrifugo PRO storage.
3. Centrifugo returns a registered device object, pass a generated device ID to the frontend and save it on the frontend together with a token received from FCM.
4. Subscribe device to the required set of channels, first by calling your backend with device ID and list of channels, check channel permissions and then call Centrifugo `device_subscription_set` or `device_subscription_add` APIs.
5. Call Centrifugo `send_push_notification` API whenever it's time to deliver a push notification.

At any moment you can inspect device and subscription storage by calling `device_list` or `device_subscription_list` APIs.

Also, you can remove unnecessary by using `device_remove` or `device_subscription_remove` APIs.

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

Actually, PostgreSQL database configuration is optional here – you can use push notifications API without it. In this case you will be able to send notifications to FCM, HMS, APNs raw tokens, FCM and HMS native topics and conditions. I.e. using Centrifugo as an efficient proxy for push notifications (for example if you already keep tokens in your database). But sending to device ids and channels, and token/subscription management APIs won't be available for usage. 

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

TBD

#### push_notifications.max_inactive_device_subscription_days

TBD

## API description

### device_register

Registers or updates device information.

#### device_register params

| Field           | Type     | Required | Description                                 |
|-----------------|----------|----|---------------------------------------------|
| `id`            | string | No | ID of the device being registered (only provide when updating).          |
| `provider`      | string | Yes | Provider of the device token (valid choices: `fcm`, `hms`, `apns`). |
| `token`         | string | Yes | Push notification token for the device.     |
| `platform`      | string | Yes | Platform of the device (valid choices: `ios`, `android`, `web`). |
| `user`          | string | No | User associated with the device.            |
| `meta`          | map<string, string> | No | Additional metadata for the device.         |

#### device_register result

| Field Name | Type | Description |
|------------|------|-------------|
| `device` | `Device` | The device that was registered. |

`Device`:

| Field Name | Type | Description |
|------------|------|-------------|
| `id` | string | The device's ID. |
| `provider` | string | The device's token provider. |
| `token` | string | The device's token. |
| `platform` | string | The device's platform. |
| `user` | string | The user associated with the device. |
| `meta` | map<string, string> | Additional metadata about the device. |

### device_remove

Removes device from storage.

#### device_remove params

| Field Name | Type | Required | Description |
| --- | --- | ----| --- |
| `ids` | repeated string | No | A list of device IDs to be removed |
| `provider_tokens` | `ProviderTokens` | No | Provider tokens to remove |

#### device_remove result

Empty object.

### device_list

Returns a paginated list of registered devices according to request filter conditions.

#### device_list params

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `ids`   | repeated string | No | List of device IDs to filter results. |
| `providers` | repeated string | No | List of device token providers to filter results. |
| `tokens` | repeated string | No | List of device tokens to filter results. |
| `platforms` | repeated string | No | List of device platforms to filter results. |
| `users` | repeated string | No | List of device users to filter results. |
| `since` | string | No | Cursor for pagination (last device id in previous batch). |
| `limit` | int32 | No | Maximum number of devices to retrieve. |
| `include_meta` | bool | No | Flag indicating whether to include meta information for each device. |

#### device_list result

| Field Name | Type | Description |
| --- | --- | --- |
| `items` | repeated `Device` | A list of devices |
| `has_more` | bool | A flag indicating whether there are more devices available |

### device_subscription_add

Subscribes device to the provided list of channels.

#### device_subscription_add params

| Field name | Type | Required | Description |
|-----------|-------|----|-------------|
| `device_id` | string | Yes | ID of the device to add subscriptions for |
| `channels` | repeated string | No | List of channels to add subscriptions for |

#### device_subscription_add result

Empty object.

### device_subscription_remove

Unsubscribes device from the provided list of channels.

#### device_subscription_remove params

| Field Name | Type | Required | Description |
| --- | --- | ---- | --- |
| `device_id` | string | Yes | ID of the device to remove the subscription from |
| `channels` | repeated string | No | List of channels to remove |

#### device_subscription_remove result

Empty object.

### device_subscription_set

Set device subscriptions to the provided list of channels (clearing all other not provided).

#### device_subscription_set params

| Field name | Type | Required | Description |
|-----------|-------|----|-------------|
| `device_id` | string | Yes | ID of the device to add subscriptions for |
| `channels` | repeated string | No | List of channels to subscribe the device to |

#### device_subscription_set result

Empty object.

### device_subscription_list

Returns a paginated list of device subscriptions according to request filter conditions.

#### device_subscription_list params

| Field Name   | Type         | Required | Description                                                           |
|--------------|--------------|----|-----------------------------------------------------------------------|
| `device_ids`   | repeated string | No | List of device IDs to filter results                                                  |
| `device_providers` | repeated string | No | List of device providers to filter results                 |
| `device_tokens` | repeated string | No | List of device tokens to filter results                |
| `device_platforms` | repeated string | No | List of device platforms to filter results                 |
| `device_users` | repeated string | No | List of device users to filter results                             |
| `channels`     | repeated string | No | Filter by list of channels the devices are subscribed to                        |
| `since`        | string        | No | Cursor for pagination (last device subscription id in the previous batch).   |
| `limit`        | int32        | No | Maximum number of devices to return in response                        |

#### device_subscription_list result

| Field Name | Type | Description |
| --- | --- | --- |
| `items` | repeated `DeviceSubscription` | An array of `DeviceSubscription` items. |
| `has_more` | bool | Indicates if there are more items to be fetched. |

`DeviceSubscription`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier of the device subscription. |
| `device_id` | string | Unique identifier of the device. |
| `device_provider` | string | Device provider. |
| `device_token` | string | Token used by the device to receive push notifications. |
| `device_platform` | string | Platform of the device |
| `device_user` | string | Unique identifier of the user associated with the device. |
| `channel` | string | Channel the device is subscribed to. |

### send_push_notification

Send push notification to specific `device_ids`, or to `channels`, or native provider identifiers like `fcm_tokens`, or to `fcm_topic`. Request will be queued by Centrifugo, consumed by Centrifugo built-in workers and sent to the provider API.

#### send_push_notification params

| Field name          | Type         | Required |Description |
|-----------------|--------------|-----|--------|
| `recipient`       | `PushRecipient` | Yes | Recipient of push notification      |
| `notification`    | `PushNotification` | Yes | Push notification to send     |

`PushRecipient` (you **must set only one of the following fields**):

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `device_ids`    | repeated string | No | Send to a list of device IDs     |
| `channels`      | repeated string | No | Send to channels     |
| `fcm_tokens`    | repeated string | No | Send to a list of FCM tokens     |
| `fcm_topic`     | string     | No | Send to a FCM topic     |
| `fcm_condition`     | string     | No | Send to a FCM condition     |
| `hms_tokens`    | repeated string | No | Send to a list of HMS tokens     |
| `hms_topic`     | string     | No | Send to a HMS topic     |
| `hms_condition`     | string     | No | Send to a HMS condition     |
| `apns_tokens`    | repeated string | No | Send to a list of APNs tokens     |

`PushNotification`:

| Field         | Type      |  Required | Description |
|---------------|-----------|-----------|--------|
| `fcm`       | `FcmPushNotification` | No | Notification for FCM      |
| `hms`       | `HmsPushNotification` | No | Notification for HMS      |
| `apns`       | `ApnsPushNotification` | No | Notification for APNs   |
| `uid`             | string       | No | Unique send id      |
| `expire_at`       | int64        | No | Unix timestamp when Centrifugo stops attempting to send this notification (this does not relate to notification TTL fields)      |

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

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L712)

## Metrics

Several metrics are available to monitor the state of Centrifugo push worker system:

* `centrifugo_push_notification_count` - counter, shows total count of push notifications sent to providers (splitted by provider, recipient type, platform, success, error code).
* `centrifugo_push_queue_consuming_lag` - gauge, shows the lag of queues, should be close to zero most of the time. Splitted by provider and name of queue.
* `centrifugo_push_consuming_inflight_jobs` - gauge, shows immediate number of workers proceccing pushes. Splitted by provider and name of queue.
* `centrifugo_push_job_duration_seconds` - summary, provides insights about worker job duration timings. Splitted by provider and recipient type.

## Tutorial

Coming soon.
