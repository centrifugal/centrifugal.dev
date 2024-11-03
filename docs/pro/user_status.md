---
id: user_status
title: User status API
---

Centrifugo OSS provides a presence feature for channels. It works well (for channels with reasonably small number of active subscribers though), but sometimes you may need a bit different functionality.

What if you want to get a specific user status based on its recent activity in application? You can create a personal channel with a presence enabled for each user. It will show that user has an active connection with a server. But this won't show whether user did some actions in an application recently or just left it open while not actually using it.

![user status](/img/user_status.png)

User status feature of Centrifugo PRO allows calling a special RPC method from a client side when a user makes a useful action in an application (clicks on buttons, uses a mouse – whatever means that user really uses application at the moment). This call sets a time of last user activity in Redis, and this information can then be queried over Centrifugo PRO server API.

The feature can be useful for chat applications when you need to get online/activity status for a list of buddies (Centrifugo supports batch requests to user status information – i.e. ask for many users in one call).

### Client-side status update RPC

Centrifugo PRO provides a built-in RPC method of client API called `update_user_status`. Call it with empty parameters from a client side whenever user performs a useful action that proves it's active status in your app. For example, in Javascript:

```javascript
await centrifuge.rpc('update_user_status', {});
```

:::note

Don't forget to debounce this method calls on a client side to avoid exposing RPC on every mouse move event for example.

:::

This RPC call sets user's last active time value in Redis (with sharding and Cluster support). Information about active status will be kept in Redis for a configured time interval, then expire.

## Server API methods

### update_user_status

It's also possible to call `update_user_status` using Centrifugo server API (for example if you want to force status during application development or you want to proxy status updates over your app backend when using unidirectional transports):

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

I.e. status object will present in a response but `active` field won't be set for status object.

Note that Centrifugo also maintains `online` field inside user status object. This field updated periodically by Centrifugo itself while user has active connection with a server. So you can draw `away` statuses in your application: i.e. when user connected (`online` time) but not using application for a long time (`active` time).

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

#### DeleteUserStatusResult

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

It's also possible to reuse Centrifugo Redis engine by setting `use_redis_from_engine` option instead of custom throttling Redis address declaration, like this:

```json title="config.json"
{
  "engine": {
    "type": "redis"
  },
  "user_status": {
    "enabled": true,
    "use_redis_from_engine": true
  }
}
```

In this case Redis active status will simply connect to Redis instances configured for Centrifugo Redis engine.

`expire_interval` is a [duration](../server/configuration.md#setting-time-duration-options) for how long Redis keys will be kept for each user. Expiration time extended on every update. By default expiration time is 31 day. To set it to 1 day:

```json title="config.json"
{
  ...
  "user_status": {
    ...
    "expire_interval": "24h"        
  }
}
```
