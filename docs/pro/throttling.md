---
id: throttling
title: Operation throttling
---

The throttling feature allows limiting the number of operations each connection or user can issue during a configured time interval. This is useful to protect the system from misusing, detecting and disconnecting abusive or broken (due to the bug in the frontend application) clients which add unwanted load on a server.

With throttling properly configured you can protect your Centrifugo installation to some degree without sophisticated third-party solution. Centrifugo PRO protection works best in combination with protection on infrastructure level though.

## In-memory per connection throttling

In-memory throttling is an efficient way to limit number of operations allowed on a per-connection basis – i.e. inside each individual real-time connection. Our throttling implementation uses [token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm internally.

The list of operations which can be throttled on a per-connection level is:

* `subscribe`
* `publish`
* `history`
* `presence`
* `presence_stats`
* `refresh`
* `sub_refresh`
* `rpc` (with optional method resolution)

In addition, Centrifugo allows defining two special buckets containers:

* `total` – define it to limit the total number of commands per interval (all commands sent from client count), these buckets will always be checked if defined, every command from the client always consumes token from `total` buckets
* `default` - define it if you don't want to configure some command buckets explicitly, default buckets will be used in case command buckets is not configured explicitly.

```json title="config.json"
{
    ...
    "client_command_throttling": {
        "enabled": true,

        "default": {
            "buckets": [
                {
                    "interval": "1s",
                    "rate": 60
                },
            ]
        },
        "total": {
            "buckets": [
                {
                    "interval": "1s",
                    "rate": 20
                },
                {
                    "interval": "60s",
                    "rate": 50
                },
            ]
        },
        "publish": {
            "buckets": [
                {
                    "interval": "1s",
                    "rate": 1
                },
            ]
        },
        "rpc": {
            "buckets": [
                {
                    "interval": "1s",
                    "rate": 10
                }
            ],
            "method_override": [
                {
                    "method": "updateActiveStatus",
                    "buckets": [
                        {
                            "interval": "20s",
                            "rate": 1
                        }
                    ]
                }
            ]
        }
    }
}
```

:::tip

Centrifugo real-time SDKs written in a way that if client receives an error during connect – it will try to reconnect to a server with backoff algorithm. The same for subscribing to channels (i.e. error from subscribe command) – subscription request will be retried with a backoff. Refresh and subscription refresh will be also retried automatically by SDK upon errors after in several seconds. Retries of other commands should be handled manually from the client side if needed.

:::

## In-memory per user throttling

Another type of throttling in Centrifugo PRO is a per user ID in-memory throttling. Like per client throttling this one is also very efficient since also uses in-memory token buckets. The difference is that instead of throttling per individual client this type of throttling takes user ID into account.

This type of throttling only checks commands coming from authenticated users – i.e. with non-empty user ID set. Requests from anonymous users can't be throttled with it.

The list of operations which can be throttled is similar to the in-memory throttling described above. But with **additional** `connect` method:

* `total`
* `default`
* `connect`
* `subscribe`
* `publish`
* `history`
* `presence`
* `presence_stats`
* `refresh`
* `sub_refresh`
* `rpc` (with optional method resolution)

The configuration is very similar:

```json title="config.json"
{
    ...
    "user_command_throttling": {
        "enabled": true,

        "default": {
            "buckets": [
                {
                    "interval": "1s",
                    "rate": 60
                },
            ]
        },
        "publish": {
            "buckets": [
                {
                    "interval": "1s",
                    "rate": 1
                }
            ]
        },
        "rpc": {
            "buckets": [
                {
                    "interval": "1s",
                    "rate": 10
                }
            ],
            "method_override": [
                {
                    "method": "updateActiveStatus",
                    "buckets": [
                        {
                            "interval": "20s",
                            "rate": 1
                        }
                    ]
                }
            ]
        }
    }
}
```

## Redis per user throttling

The next type of throttling in Centrifugo PRO is a distributed per user ID throttling with Redis as a bucket state storage. In this case limits are global for the entire Centrifugo cluster. If one user executed two commands on different Centrifugo nodes, Centrifugo consumes two tokens from the same bucket kept in Redis. Since this throttling goes to Redis to check limits, it adds some latency to a command processing. Our implementation tries to provide good throughput characteristics though – in our tests single Redis instance can handle more than 100k limit check requests per second. And it's possible to scale Redis in the same ways as for Centrifugo Redis Engine. 

This type of throttling only checks commands coming from authenticated users – i.e. with non-empty user ID set. Requests from anonymous users can't be throttled with it. The implementation also uses [token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm internally.

The list of operations which can be throttled is similar to the in-memory user command throttling described above. But **without** special bucket `total`:

* `default`
* `connect`
* `subscribe`
* `publish`
* `history`
* `presence`
* `presence_stats`
* `refresh`
* `sub_refresh`
* `rpc` (with optional method resolution)

The configuration is very similar:

```json title="config.json"
{
    ...
    "redus_user_command_throttling": {
        "enabled": true,
        "redis_address": "localhost:6379",

        "default": {
            "buckets": [
                {
                    "interval": "1s",
                    "rate": 60
                },
            ]
        },
        "publish": {
            "buckets": [
                {
                    "interval": "1s",
                    "rate": 1
                }
            ]
        },
        "rpc": {
            "buckets": [
                {
                    "interval": "1s",
                    "rate": 10
                }
            ],
            "method_override": [
                {
                    "method": "updateActiveStatus",
                    "buckets": [
                        {
                            "interval": "20s",
                            "rate": 1
                        }
                    ]
                }
            ]
        }
    }
}
```

Redis configuration for throttling feature matches Centrifugo Redis engine configuration. So Centrifugo supports client-side consistent sharding to scale Redis, Redis Sentinel, Redis Cluster for throttling feature too.

It's also possible to reuse Centrifugo Redis engine by setting `use_redis_from_engine` option instead of custom throttling Redis configuration declaration, like this:

```json title="config.json"
{
    ...
    "engine": "redis",
    "redis_address": "localhost:6379",
    "redis_user_command_throttling": {
        "enabled": true,
        "use_redis_from_engine": true,
        ...
    }
}
```

In this case throttling will simply connect to Redis instances configured for an Engine.

## Disconnecting abusive or misbehaving connections

Above we showed how you can define throttling strategies to protect server resources and prevent execution of many commands inside the connection and from certain user.

But there are scenarios when abusive or broken connections may generate a significant load on the server just by calling commands and getting error responses due to throttling or due to other reasons (like malformed command). Centrifugo PRO provides a way to configure error limits per connection to deal with this case.

Error limits are configured as in-memory buckets operating on a per-connection level. When these buckets are full due to lots of errors for an individual connection Centrifugo disconnects the client (with advice to not reconnect, so our SDKs may follow it). This way it's possible to get rid of the connection and rely on HTTP infrastracture tools to deal with client reconnections. Since WebSocket or other our transports (except unidirectional GRPC, but it's usually not available to the public port) are HTTP-based (or start with HTTP request in WebSocket Upgrade case) – developers can use Nginx `limit_req_zone` directive, Cloudflare rules, iptables, and so on, to protect Centrifugo from unwanted connections.

The configuration on error limits per connection may look like this:

```json title="config.json"
{
    ...
    "client_error_limits": {
        "enabled": true,
        "total": {
            "buckets" : [
                {
                    "interval": "5s",
                    "rate": 20
                }
            ]
        }
    }
}
```
