---
id: push_notifications
sidebar_label: Push notification API
title: Push notification API (coming soon)
---

Centrifugo excels in delivering real-time in-app messages to online users. Sometimes though you need a way to engage offline users to come back to your app. Or trigger some update in the app when it's running in the background. That's where push notifications may be used. Push notifications delivered over battery-efficient platform-dependent transport. Integrating push notifications into an app can be a time-consuming process, but popular cloud services simplify it. However, the situation can be a bit more challenging with self-hosted solutions.

Centrifugo PRO provides API to manage user device tokens, device channel subscriptions and to send push notifications towards registered devices and group of devices (subscribed on a channel). Centrifugo PRO integrates with the [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging) API to send push notifications, making the process seamless and efficient.

FCM is **free to use** and provides a way to send notifications to the following platforms in a unified way:

* <i className="bi bi-apple" style={{'color': 'cornflowerblue'}}></i> iOS devices (over APNs)
* <i className="bi bi-android2" style={{'color': 'yellowgreen'}}></i> Android devices (over FCM)
* <i className="bi bi-globe" style={{color: 'orange'}}></i> Web browsers which support Web Push API (Chrome, Firefox, see <a href="https://caniuse.com/push-api">this matrix</a>)

FCM is only a transport for push notifications, tokens should be stored in the application database. Centrifugo PRO provides an API to store tokens in database (PostgreSQL), manage device subscriptions to channels (replacing native FCM topics functionality – see motivation below).

Centrifugo PRO comes with super efficient worker queues (based on Redis streams) which allow broadcasting push notifications towards devices in a very efficient way.

Integration with FCM means that you can use existing Firebase messaging SDKs to extract push notification token for a device on different platforms (iOS, Android, Flutter, web browser) and setting up push notification listeners. Only a couple of additional steps required to integrate frontend with Centrifugo PRO device token and device subscription storage. After doing that you will be able to send push notification towards single device, or towards devices subscribed to a channel with a simple API call like this:

```bash
curl -X POST http://localhost:8000/api -d \
'{"method": "send_push_notification", "params": {"recipient": {"channels": ["test"]}, "notification": {"fcm": {"notification": {"title": "Hello", "body": "How are you?"}}}}}'
```

## Motivation

Our goals introducing push notification API in Centrifugo PRO were:

* Simplify adding push notifications to the project. FCM SDKs solve the frontend part – giving a unified way to load push token for all popular platforms and a way to set notification handlers. FCM also provides a unified transport layer for all the platforms. But the backend part (token storage and management) is still need to be implemented by application. Centrifugo PRO provides the required backend, it tries to follow best practices when working with FCM maintaining only an actual set of device tokens, reacting on FCM errors and periodically removing stale devices.
* FCM provides API to send push notifications. Centrifugo just wraps it, but at the same time provides efficient queuing. So you can send notifications from your app with minimal latency, and let Centrifugo process sending to FCM for you.
* FCM has a built-in way of sending notification to large groups of devices over [topics](https://firebase.google.com/docs/cloud-messaging/android/topic-messaging) mechanism. The problem with native FCM topics though is that client can subscribe to any topic from the frontend side without any permission check. In today's world this is usually not desired. So Centrifugo PRO re-implements FCM topics by introducing an additional API to manage device subscriptions to channels. We intentionally called it `channels` to make the concept closer to our real-time API. In some cases you may have real-time channels and device subscription channels with matching names – to send messages to both online and offline users. Though it's up to you.

Apart from this you get a possibility to inspect sent push notifications over our ClickHouse analytics. Also, FCM provides [its own analytics](https://firebase.google.com/docs/cloud-messaging/understand-delivery?platform=web) from which you can get insight into push notification delivery.

BTW, in our API we left a possibility to publish notifications into FCM topics or sending to raw FCM tokens, so you can combine native FCM primitives with those provided by Centrifugo.

## Steps to integrate

1. Add FCM SDK on the frontend side, follow FCM instructions for your platform to obtain a push token for a device (see [iOS](https://firebase.google.com/docs/cloud-messaging/ios/client), [Android](https://firebase.google.com/docs/cloud-messaging/android/client), [Flutter](https://firebase.google.com/docs/cloud-messaging/flutter/client), [Web Browser](https://firebase.google.com/docs/cloud-messaging/js/client)). So all the frontend part is left to FCM libraries.
2. Call your backend API with the obtained token, from the backend call Centrifugo `device_register` API to register the device in Centrifugo PRO storage.
3. Centrifugo returns a registered device object, pass a generated device ID to the frontend and save it on the frontend together with a token received from FCM.
4. Subscribe device to the required set of channels, first by calling your backend with device ID and list of channels, check channel permissions and then call Centrifugo `device_subscription_add` API.
5. Call Centrifugo `send_push_notification` API whenever it's time to deliver a push notification.

At any moment you can inspect device and subscription storage by calling `device_list` or `device_subscription_list` APIs.

Also, you can remove unnecessary by using `device_remove` or `device_subscription_remove` APIs.

## Configuration

Coming soon.

## Tutorial

Coming soon.

## API description

### device_register

Registers or updates device information.

#### device_register params

| Field           | Type     | Required | Description                                 |
|-----------------|----------|----|---------------------------------------------|
| `id`            | string | No | ID of the device being registered (only provide when updating).          |
| `platform`      | string | Yes | Platform of the device (valid choices: `apns`, `android`, `web`). |
| `token`         | string | Yes | Push notification token for the device.     |
| `user`          | string | No | User associated with the device.            |
| `meta`          | map<string, string> | No | Additional metadata for the device.         |

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L485).

#### device_register result

| Field Name | Type | Description |
|------------|------|-------------|
| `device` | `Device` | The device that was registered. |

`Device`:

| Field Name | Type | Description |
|------------|------|-------------|
| `id` | string | The device's ID. |
| `platform` | string | The device's platform. |
| `token` | string | The device's token. |
| `user` | string | The user associated with the device. |
| `meta` | map<string, string> | Additional metadata about the device. |

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/master/internal/apiproto/api.proto#L558).

### device_remove

Removes device from storage.

#### device_remove params

| Field Name | Type | Required | Description |
| --- | --- | ----| --- |
| `ids` | repeated string | No | A list of device IDs to be removed |
| `tokens` | repeated string | No | A list of device tokens to be removed |

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L493).

#### device_remove result

Empty object.

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L562).

### device_list

Returns a paginated list of registered devices according to request filter conditions.

#### device_list params

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `ids`   | repeated string | No | List of device IDs to filter results. |
| `platforms` | repeated string | No | List of device platforms to filter results. |
| `tokens` | repeated string | No | List of device tokens to filter results. |
| `users` | repeated string | No | List of device users to filter results. |
| `since` | string | No | Cursor for pagination (last device id in previous batch). |
| `limit` | int32 | No | Maximum number of devices to retrieve. |
| `include_meta` | bool | No | Flag indicating whether to include meta information for each device. |

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L498).

#### device_list result

| Field Name | Type | Description |
| --- | --- | --- |
| `items` | repeated `Device` | A list of devices |
| `has_more` | bool | A flag indicating whether there are more devices available |

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L565).

### device_subscription_add

Subscribes device to the provided list of channels.

#### device_subscription_add params

| Field name | Type | Required | Description |
|-----------|-------|----|-------------|
| `device_id` | string | Yes | ID of the device to add subscriptions for |
| `channels` | repeated string | No | List of channels to subscribe the device to |

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L508).

#### device_subscription_add result

Empty object.

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L579).

### device_subscription_remove

Unsubscribes device from the provided list of channels.

#### device_subscription_remove params

| Field Name | Type | Required | Description |
| --- | --- | ---- | --- |
| device_id | string | Yes | ID of the device to remove the subscription from |
| channels | repeated string | No | List of channels to remove |

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L513)

#### device_subscription_remove result

Empty object.

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L582)

### device_subscription_list

Returns a paginated list of device subscriptions according to request filter conditions.

#### device_subscription_list params

| Field Name   | Type         | Required | Description                                                           |
|--------------|--------------|----|-----------------------------------------------------------------------|
| device_ids   | repeated string | No | List of device IDs to filter results                                                  |
| device_platforms | repeated string | No | List of device platforms to filter results                 |
| device_tokens | repeated string | No | List of device tokens to filter results                |
| device_users | repeated string | No | List of device users to filter results                             |
| channels     | repeated string | No | Filter by list of channels the devices are subscribed to                        |
| since        | string        | No | Cursor for pagination (last device subscription id in the previous batch).   |
| limit        | int32        | No | Maximum number of devices to return in response                        |

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L518)

#### device_subscription_list result

| Field Name | Type | Description |
| --- | --- | --- |
| `items` | repeated `DeviceSubscription` | An array of `DeviceSubscription` items. |
| `has_more` | bool | Indicates if there are more items to be fetched. |

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L585)

`DevideSubscription`:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier of the device subscription. |
| device_id | string | Unique identifier of the device. |
| device_token | string | Token used by the device to receive push notifications. |
| device_platform | string | Platform of the device |
| device_user | string | Unique identifier of the user associated with the device. |
| channel | string | Channel the device is subscribed to. |

### send_push_notification

Send push notification to specific `device_ids`, or to `channels`, or `fcm_tokens`, or to `fcm_topic`. Request will be queued by Centrifugo, consumed by Centrifugo built-in workers and sent to FCM API.

#### send_push_notification params

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L700)

#### send_push_notification result

[Proto definitions](https://github.com/centrifugal/centrifugo/blob/157d3a7da9bdae5b6274da99473deee25f158e40/internal/apiproto/api.proto#L712)
