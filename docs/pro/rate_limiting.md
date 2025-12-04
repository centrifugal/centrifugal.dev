---
id: rate_limiting
title: Operation rate limits
---

The rate limit feature allows limiting the number of operations each connection or user can issue during a configured time interval. This is useful to protect the system from misusing, detecting and disconnecting abusive or broken (due to the bug in the frontend application) clients which add unwanted load on a server.

With rate limit properly configured you can protect your Centrifugo installation to some degree without sophisticated third-party solution. Centrifugo PRO protection works best in combination with protection on infrastructure level though.

![Throttling](/img/throttling.png)

## In-memory per connection rate limit

In-memory rate limit is an efficient way to limit number of operations allowed on a per-connection basis – i.e. inside each individual real-time connection. Our rate limit implementation uses [token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm internally.

The list of operations which can be rate limited on a per-connection level is:

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
  "client": {
    "rate_limit": {
      "client_command": {
        "enabled": true,
        "total": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 20
            }
          ]
        },
        "default": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 60
            }
          ]
        },
        "publish": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 1
            }
          ]
        },
        "rpc": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 10
            }
          ],
          "method_overrides": [
            {
              "method": "update_user_status",
              "enabled": true,
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
  }
}
```

:::tip

Centrifugo real-time SDKs written in a way that if client receives an error during connect – it will try to reconnect to a server with backoff algorithm. The same for subscribing to channels (i.e. error from subscribe command) – subscription request will be retried with a backoff. Refresh and subscription refresh will be also retried automatically by SDK upon errors after in several seconds. Retries of other commands should be handled manually from the client side if needed – though usually you should choose rate limit limits in a way that normal users of your app never hit the limits.

:::

## In-memory per user rate limit

Another type of rate limit in Centrifugo PRO is a per user ID in-memory rate limit. Like per client rate limit this one is also very efficient since also uses in-memory token buckets. The difference is that instead of rate limit per individual client this type of rate limit takes user ID into account.

This type of rate limit only checks commands coming from authenticated users – i.e. with non-empty user ID set. Requests from anonymous users can't be rate limited with it.

The list of operations which can be rate limited is similar to the in-memory rate limit described above. But with **additional** `connect` method:

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
  "client": {
    "rate_limit": {
      "user_command": {
        "enabled": true,
        "default": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 60
            }
          ]
        },
        "publish": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 1
            }
          ]
        },
        "rpc": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 10
            }
          ],
          "method_overrides": [
            {
              "method": "update_user_status",
              "enabled": true,
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
  }
}
```

## Redis per user rate limit

The next type of rate limit in Centrifugo PRO is a distributed per user ID rate limit with Redis as a bucket state storage. In this case limits are global for the entire Centrifugo cluster. If one user executed two commands on different Centrifugo nodes, Centrifugo consumes two tokens from the same bucket kept in Redis. Since this rate limit goes to Redis to check limits, it adds some latency to a command processing. Our implementation tries to provide good throughput characteristics though – in our tests single Redis instance can handle more than 100k limit check requests per second. And it's possible to scale Redis in the same ways as for Centrifugo Redis Engine. 

This type of rate limit only checks commands coming from authenticated users – i.e. with non-empty user ID set. Requests from anonymous users can't be rate limited with it. The implementation also uses [token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm internally.

The list of operations which can be rate limited is similar to the in-memory user command rate limit described above. But **without** special bucket `total`:

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
  "client": {
    "rate_limit": {
      "redis_user_command": {
        "enabled": true,
        "default": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 60
            }
          ]
        },
        "publish": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 1
            }
          ]
        },
        "rpc": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 10
            }
          ],
          "method_overrides": [
            {
              "method": "update_user_status",
              "enabled": true,
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
  }
}
```

Redis configuration for rate limit feature matches Centrifugo Redis engine configuration. So Centrifugo supports client-side consistent sharding to scale Redis, Redis Sentinel, Redis Cluster for rate limit feature too.

It's also possible to reuse Centrifugo Redis engine by setting `use_redis_from_engine` option instead of custom rate limit Redis configuration declaration, like this:

```json title="config.json"
{
  "engine": {
    "redis": {
      "address": "localhost:6379"
    },
    "type": "redis"
  },
  "client": {
    "rate_limit": {
      "redis_user_command": {
        "enabled": true,
        "redis": {
          "reuse_from_engine": true
        }
      }
    }
  }
}
```

In this case rate limit will simply connect to Redis instances configured for an Engine.

## Channel namespace overrides

Centrifugo PRO allows defining rate limit overrides on a per-namespace basis for channel operations. **Namespace overrides take priority over base rate limits** – when a namespace override is configured and enabled, it replaces the base configuration for operations on channels within that namespace.

This allows you to have different rate limiting policies for different parts of your application. For example, you might want to allow higher publish rates for public chat channels but stricter limits for private notifications.

### Using namespace_overrides

Channel namespace overrides are configured using the `namespace_overrides` array, similar to how RPC `method_overrides` work. This keeps all rate limiting configuration in one place at the client level while allowing namespace-specific customization.

Available channel operations that support namespace overrides:

* `subscribe`
* `publish`
* `history`
* `presence`
* `presence_stats`
* `sub_refresh`

**Note:** `connect`, `refresh`, and `rpc` operations don't support namespace overrides as they are not channel namespace-specific.

Example configuration for per-connection rate limits with namespace overrides:

```json title="config.json"
{
  "client": {
    "rate_limit": {
      "client_command": {
        "enabled": true,
        "default": {
          "enabled": true,
          "buckets": [{"interval": "1s", "rate": 10}]
        },
        "publish": {
          "enabled": true,
          "buckets": [{"interval": "1s", "rate": 5}],
          "namespace_overrides": [
            {
              "namespace_name": "chat",
              "enabled": true,
              "buckets": [{"interval": "1s", "rate": 20}]
            },
            {
              "namespace_name": "notifications",
              "enabled": true,
              "buckets": [{"interval": "10s", "rate": 1}]
            }
          ]
        },
        "subscribe": {
          "enabled": true,
          "buckets": [{"interval": "1s", "rate": 3}],
          "namespace_overrides": [
            {
              "namespace_name": "chat",
              "enabled": true,
              "buckets": [{"interval": "1s", "rate": 10}]
            }
          ]
        }
      }
    }
  }
}
```

In this example:
- Default publish rate is 5 per second
- For `chat:*` channels, publish rate is increased to 20 per second
- For `notifications:*` channels, publish rate is reduced to 1 per 10 seconds
- Default subscribe rate is 3 per second
- For `chat:*` channels, subscribe rate is increased to 10 per second

Similar for `user_command` and `redis_user_command` limiter types.

When a channel operation is performed, Centrifugo:

1. Extracts the namespace from the channel name (e.g., `chat` from `chat:room123`)
2. Checks if a namespace override exists for that operation and namespace
3. If found and enabled, uses the namespace override buckets
4. Otherwise, falls back to the base operation buckets

This means you can selectively override only specific operations for specific namespaces, while other operations use the base configuration. You don't need to duplicate your entire rate limiting configuration – just override what's different.

## Disconnecting abusive or misbehaving connections

Above we showed how you can define rate limit strategies to protect server resources and prevent execution of many commands inside the connection and from certain user.

But there are scenarios when abusive or broken connections may generate a significant load on the server just by calling commands and getting error responses due to rate limit or due to other reasons (like malformed command). Centrifugo PRO provides a way to configure error limits per connection to deal with this case.

Error limits are configured as in-memory buckets operating on a per-connection level. When these buckets are full due to lots of errors for an individual connection Centrifugo disconnects the client (with advice to not reconnect, so our SDKs may follow it). This way it's possible to get rid of the connection and rely on HTTP infrastracture tools to deal with client reconnections. Since WebSocket or other our transports (except unidirectional GRPC, but it's usually not available to the public port) are HTTP-based (or start with HTTP request in WebSocket Upgrade case) – developers can use Nginx `limit_req_zone` directive, Cloudflare rules, iptables, and so on, to protect Centrifugo from unwanted connections.

:::tip

Centrifugo PRO does not count internal errors for the error limit buckets – as internal errors is usually not a client's fault.

:::

The configuration on error limits per connection may look like this:

```json title="config.json"
{
  "client": {
    "rate_limit": {
      "client_error": {
        "enabled": true,
        "total": {
          "enabled": true,
          "buckets": [
            {
              "interval": "5s",
              "rate": 20
            }
          ]
        }
      }
    }
  }
}
```

If a client will have more than 20 protocol errors per 5 second – it will be disconnected.

## RPC method overrides format change in v6.6.0

Starting from Centrifugo v6.6.0, the format for RPC method-specific rate limit overrides has been updated to use an array format (`method_overrides`) instead of the previous map format (`method_override`).

### New format (v6.6.0+)

The new format uses `method_overrides` as an array of objects:

```json title="config.json"
{
  "client": {
    "rate_limit": {
      "client_command": {
        "enabled": true,
        "rpc": {
          "enabled": true,
          "buckets": [{"interval": "1s", "rate": 10}],
          "method_overrides": [
            {
              "method": "update_user_status",
              "enabled": true,
              "buckets": [{"interval": "20s", "rate": 1}]
            },
            {
              "method": "get_user_data",
              "enabled": true,
              "buckets": [{"interval": "5s", "rate": 5}]
            }
          ]
        }
      }
    }
  }
}
```

### Old format (before v6.6.0)

The old format used `method_override` as a map/object:

```json title="config.json"
{
  "client": {
    "rate_limit": {
      "client_command": {
        "enabled": true,
        "rpc": {
          "enabled": true,
          "buckets": [{"interval": "1s", "rate": 10}],
          "method_override": {
            "update_user_status": {
              "enabled": true,
              "buckets": [{"interval": "20s", "rate": 1}]
            },
            "get_user_data": {
              "enabled": true,
              "buckets": [{"interval": "5s", "rate": 5}]
            }
          }
        }
      }
    }
  }
}
```

### Backward compatibility

The old `method_override` map format is still supported for backward compatibility. If you have existing configurations using `method_override`, they will continue to work in v6.6.0 and later versions. However, you cannot use both `method_override` and `method_overrides` at the same time – if both are present, Centrifugo will return a validation error on startup.

We recommend migrating to the new `method_overrides` array format when possible, as it provides better tooling support and is more consistent with other array-based configurations in Centrifugo.
