---
id: user_status
title: User status
---

Centrifugo provides a presence feature for channels. It works well (for channels with reasonably small number of active subscribers though), but sometimes you need a bit different functionality.

What if you want to get a specific user status based on its recent activity in application? You can create a personal channel with presence enabled for each user. It will show that user has an active connection with a server. But this won't show whether user did some actions in an appplication recently or just left it open while not actually using it.

User status feature of Centrifugo PRO allows calling a special RPC method from a client side when a user makes a useful action in an application (clicks on buttons, uses a mouse – whatever means that user really uses application at the moment). This call sets a time of last user activity in Redis, and this information can then be queried.

The feature can be useful for chat applications when you need to get online/activity status for a list of buddies (Centrifugo supports batch requests to user active status information).

### Update active status

Centrifugo PRO provides a built-in RPC method called `updateActiveStatus`. Call it without any parameters from a client side whenever user performs a useful action that proves it's active status in your app:

```javascript
await centrifuge.namedRPC('updateActiveStatus')
```

:::note

Don't forget to debounce calling this method on client side to avoid exposing RPC on every mouse move event for example.

:::

This RPC call sets user's last active time value in Redis (with sharding and Cluster support). Information about active status will be kept in Redis for a configured time interval, then expire.

It's also call `updateActiveStatus` using Centrifugo server API RPC extension (for example if you want to force status during application development or you want to proxy status updates over your app backend):

```bash
curl --header "Content-Type: application/json" \
  --header "Authorization: apikey <API_KEY>" \
  --request POST \
  --data '{"method": "rpc", "params": {"method": "updateActiveStatus", "params": {"users": ["42"]}}}' \
  http://localhost:8000/api
```

### Get user status

Now on a backend side you have access to a bulk API to effectively get status of particular users.

Call RPC method of server API (over HTTP or GRPC):

```bash
curl --header "Content-Type: application/json" \
  --header "Authorization: apikey <API_KEY>" \
  --request POST \
  --data '{"method": "rpc", "params": {"method": "getUserStatus", "params": {"users": ["42"]}}}' \
  http://localhost:8000/api
```

You should get a response like this:

```json
{
    "result":{
        "data":{
            "statuses":[
                {
                    "user":"42",
                    "active":1627107289,
                    "online":1627107289
                }
            ]
        }
    }
}
```

In case information about last status update time not available the response will be like this:

```json
{
    "result":{
        "data":{
            "statuses":[
                {
                    "user":"42"
                }
            ]
        }
    }
}
```

I.e. status object will present in a response but `active` field won't be set for status object.

Also note that Centrifugo also maintains `online` field inside user status object. This field updated periodically by Centrifugo itself while user has active connection with a server. So you can draw `away` statuses in your application: i.e. when user connected but not using application for a long time.

### Clear user status

If you need to clear active status information for some reason there is a `deleteUserStatus` RPC call in server API:

```bash
curl --header "Content-Type: application/json" \
  --header "Authorization: apikey <API_KEY>" \
  --request POST \
  --data '{"method": "rpc", "params": {"method": "deleteUserStatus", "params": {"users": ["42"]}}}' \
  http://localhost:8000/api
```

### Configuration

To enable Redis active status feature:

```json title="config.json"
{
    ...
    "redis_active_status": {
        "enabled": true,
        "redis_address": "127.0.0.1:6379"
    }
}
```

Redis configuration for throttling feature matches Centrifugo Redis engine configuration. So Centrifugo supports client-side consistent sharding to scale Redis, Redis Sentinel, Redis Cluster for throttling feature too.

It's also possible to reuse Centrifugo Redis engine by setting `use_redis_from_engine` option instead of custom throttling Redis address declaration, like this:

```json title="config.json"
{
    ...
    "engine": "redis",
    "redis_address": "localhost:6379",
    "redis_active_status": {
        "enabled": true,
        "use_redis_from_engine": true,
    }
}
```

In this case Redis active status will simply connect to Redis instances configured for Centrifugo Redis engine.

`expire_interval` is a [duration](../server/configuration.md#setting-time-duration-options) for how long Redis keys will be kept for each user. Expiration time extended on every update. By default expiration time is 31 day. To set it to 1 day:

```json title="config.json"
{
    ...
    "redis_active_status": {
        ...
        "expire_interval": "24h"
    }
}
```
