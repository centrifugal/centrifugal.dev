---
description: "Centrifugo PRO distributed rate limit API provides a Redis-based token bucket with millisecond precision for custom quota management tasks."
id: distributed_rate_limit
title: Distributed rate limit API
---

In addition to connection operation rate limiting features Centrifugo PRO provides a generic high precision rate limiting API. It may be used for custom quota managing tasks not even related to real-time connections. Its distributed nature allows managing quotas across different instances of your application backend.

The original reason why we decided to ship this as part of our PRO version APIs was the desire to simplify our PRO users the implementation of per-user push notification limits when using [Push Notification API](./push_notifications.md). But you are free to use the API for other custom needs as well.

## Overview

Centrifugo distributed rate limiting is a high performance zero-configuration Redis-based token bucket with milliseconds precision. Zero configuration in this case means that you don't have to preconfigure buckets in Centrifugo – bucket configuration is a part of request to check allowed limits.

```bash
curl -X POST http://localhost:8000/api/rate_limit \
-H "Authorization: apikey <KEY>" \
-d @- <<'EOF'

{
    "key": "rate_limit_test",
    "interval": 60000,
    "rate": 10
}
EOF
```

Example result:

```json
{
    "result": {
        "allowed": true,
        "tokens_left": 9
    }
}
```

Or, when no tokens left in a bucket:

```json
{
    "result": {
        "allowed": false,
        "tokens_left": 0,
        "allowed_in": 5208,
        "server_time": 1694627573210,
    }
}
```

In your app code call `rate_limit` API of Centrifugo PRO every time some action is executed and check `allowed` flag to allow or discard the action.

Centrifugo PRO also returns `allowed_in` and `server_time` fields to help understanding when action will be allowed. These two fields are only appended when `tokens_left` are less than requested `score`. `allowed_in` + `server_time` will provide you a timestamp in the future (in milliseconds) when action is possible to be executed. So you can delay next action execution till that time if possible.

## Configuration

To enable distributed rate limiter:

```json title="config.json"
{
  ...
  "distributed_rate_limit": {
    "enabled": true,
    "redis_address": "localhost:6379"
  }  
}
```

Note, that just like most of other features in Centrifugo it's possible to configure Redis shards here or use Redis Cluster.

## API description

Now let's look at API description.

### rate_limit request

| Field | Type | Required | Description |
|-------|------|----|-------------|
| `key`   | `string` | Yes | Key for a bucket - you can construct keys whatever way you like |
| `interval` | `integer` | Yes | Interval in milliseconds |
| `rate` | `integer` | Yes | Allowed rate per provided interval |
| `score` | `integer` | No | Score for the current action, if not provided the default score 1 is used |

### rate_limit result

| Field Name | Type | Required | Description |
| --- | --- | --- | --- |
| `allowed` | `bool` | Yes | Whether desired action is allowed at this point in time |
| `tokens_left` | `integer` | Yes | How many tokens left in a bucket |
| `allowed_in` | `integer` | No | Milliseconds till desired score will be allowed again |
| `server_time` | `integer` | No | Server time as Unix epoch in milliseconds used to calculate result |
