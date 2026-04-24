---
description: "Track user online and activity status in Centrifugo PRO with the Redis-backed User Status API. Query bulk statuses for chat presence indicators."
id: user_status
title: User status API
---

Centrifugo OSS provides a presence feature for channels. It works well (for channels with reasonably small number of active subscribers though), but sometimes you may need a bit different functionality.

What if you want to get a specific user's status based on their recent activity in the application? You can create a personal channel with presence enabled for each user. It will show that the user has an active connection with a server. But this won't show whether the user performed some actions in the application recently or just left it open while not actually using it.

![user status](/img/user_status.png)

The user status feature of Centrifugo PRO allows calling a special RPC method from the client side when a user performs a useful action in the application (clicks on buttons, uses a mouse – whatever indicates that the user is really using the application at the moment). This call sets the time of last user activity in Redis, and this information can then be queried via the Centrifugo PRO server API.

The feature can be useful for chat applications when you need to get online/activity status for a list of buddies (Centrifugo supports batch requests for user status information – i.e. asking for many users in one call).

### Client-side status update RPC

Centrifugo PRO provides a built-in RPC method of client API called `update_user_status`. Call it with empty parameters from a client side whenever user performs a useful action that proves it's active status in your app. For example, in Javascript:

```javascript
await centrifuge.rpc('update_user_status', {});
```

:::note

Don't forget to debounce these method calls on the client side to avoid triggering the RPC on every mouse move event, for example.

:::

This RPC call sets the user's last active time value in Redis (with sharding and Cluster support). Information about active status will be kept in Redis for a configured time interval, then expire.

## Server API methods

### update_user_status

It's also possible to call `update_user_status` using the Centrifugo server API (for example if you want to force a status during application development or you want to proxy status updates via your app backend when using unidirectional transports):

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{"users": ["42"]}' \
  http://localhost:8000/api/update_user_status
```

#### UpdateUserStatusRequest

| Parameter name | Parameter type  | Required | Description                        |
|----------------|-----------------|----------|------------------------------------|
| `users`        | `array[string]` | yes      | List of users to update status for |

#### UpdateUserStatusResult

Empty object at the moment.

### get_user_status

Now on a backend side you have access to a bulk API to effectively get status of particular users.

Call RPC method of server API (over HTTP or GRPC):

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{"users": ["42"]}' \
  http://localhost:8000/api/get_user_status
```

You should get a response like this:

```json
{
    "result":{
        "statuses":[
            {
                "user":"42",
                "active":1627107289,
                "online":1627107289
            }
        ]
    }
}
```

In case information about last status update time not available the response will be like this:

```json
{
    "result":{
        "statuses":[
            {
                "user":"42"
            }
        ]
    }
}
```

I.e. the status object will be present in the response but the `active` field won't be set for the status object.

Note that Centrifugo also maintains the `online` field inside the user status object. This field is updated periodically by Centrifugo itself while the user has an active connection with a server. So you can draw `away` statuses in your application: i.e. when a user is connected (`online` time) but has not been using the application for a long time (`active` time).

#### GetUserStatusRequest

| Parameter name | Parameter type  | Required | Description                     |
|----------------|-----------------|----------|---------------------------------|
| `users`        | `array[string]` | yes      | List of users to get status for |

#### GetUserStatusResult

| Field name | Field type          | Optional | Description                                   |
|------------|---------------------|----------|-----------------------------------------------|
| `statuses` | `array[UserStatus]` | no       | Statuses for each user in params (same order) |

#### UserStatus

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| user       | string  | no | User ID        |
| active       | integer  | yes | Last active time (Unix seconds)    |
| online       | integer  | yes | Last online time (Unix seconds)    |

### delete_user_status

If you need to clear user status information for some reason there is a `delete_user_status` server API call:

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{"users": ["42"]}' \
  http://localhost:8000/api/delete_user_status
```

#### DeleteUserStatusRequest

| Parameter name | Parameter type  | Required | Description                        |
|----------------|-----------------|----------|------------------------------------|
| `users`        | `array[string]` | yes      | List of users to delete status for |

#### DeleteUserStatusResult

Empty object at the moment.

## Configuration

To enable Redis user status feature:

```json title="config.json"
{
  "user_status": {
    "enabled": true,
    "redis": {
      "address": "localhost:6379"
    }
  }
}
```

Redis configuration for user status feature matches Centrifugo Redis engine configuration. So Centrifugo supports client-side consistent sharding to scale Redis, Redis Sentinel, Redis Cluster for user status feature too.

It's also possible to reuse Centrifugo Redis engine by setting `reuse_from_engine` option instead of custom Redis address declaration, like this:

```json title="config.json"
{
  "engine": {
    "type": "redis"
  },
  "user_status": {
    "enabled": true,
    "redis": {
      "reuse_from_engine": true
    }
  }
}
```

In this case the Redis active status will simply connect to Redis instances configured for the Centrifugo Redis engine.

`expire_interval` is a [duration](../server/configuration.md#duration-type) for how long Redis keys will be kept for each user. The expiration time is extended on every update. By default the expiration time is 30 days. To set it to 1 day:

```json title="config.json"
{
  ...
  "user_status": {
    ...
    "expire_interval": "24h"        
  }
}
```
