---
id: throttling
title: Operation throttling
---

The throttling feature allows limiting the number of operations each user can issue during a configured time interval. This is useful to protect the system from misusing or protect it from a bug in the application frontend code.

## Redis throttling

At this moment Centrifugo PRO provides throttling over Redis. It's only possible to throttle by the user ID. Requests from anonymous users can't be throttled. Throttling with Redis uses [token bucket algorithm](https://en.wikipedia.org/wiki/Token_bucket) internally.

Here is a list of operations that can be throttled:

* connect
* subscribe
* publish
* history
* presence
* presence_stats
* refresh
* sub_refresh
* rpc (with method resolution)

An example configuration:

```json title="config.json"
{
    ...
    "redis_throttling": {
        "enabled": false,
        "redis_address": "localhost:6379",
        "buckets": {
            "publish": {
                "enabled": true,
                "interval": "1s",
                "rate": 1
            },
            "rpc": {
                "enabled": true,
                "interval": "1s",
                "rate": 10,
                "method_override": [
                    {
                        "method": "updateActiveStatus",
                        "interval": "20s",
                        "rate": 1
                    }
                ]
            }
        }
    }
}
```

This configuration enables throttling and throttles publish attempts in a way that only 1 publication is possible in 1 second from the same user.

Redis configuration for throttling feature matches Centrifugo Redis engine configuration. So Centrifugo supports client-side consistent sharding to scale Redis, Redis Sentinel, Redis Cluster for throttling feature too.

It's also possible to reuse Centrifugo Redis engine by setting `use_redis_from_engine` option instead of custom throttling Redis address declaration, like this:

```json title="config.json"
{
    ...
    "engine": "redis",
    "redis_address": "localhost:6379",
    "redis_throttling": {
        "enabled": false,
        "use_redis_from_engine": true,
        "buckets": {
            "publish": {
                "enabled": true,
                "interval": "1s",
                "rate": 1
            }
        }
    }
}
```

In this case throttling will simply connect to Redis instances configured for an Engine.
