---
description: "Configure operation rate limits in Centrifugo PRO per connection, user, or via Redis. Includes namespace overrides and abusive client disconnection."
id: rate_limiting
title: Operation rate limits
---

The rate limit feature allows limiting the number of operations each connection or user can issue during a configured time interval. This is useful to protect the system from misuse, and for detecting and disconnecting abusive or broken (due to a bug in the frontend application) clients that add unwanted load on a server.

With rate limit properly configured, you can protect your Centrifugo installation to some degree without a sophisticated third-party solution. Centrifugo PRO protection works best in combination with protection at the infrastructure level though.

![Throttling](/img/throttling.png)

## Simple configuration

If you just want to protect the server from abusive clients without fine-tuning per-command limits, configure a `default` bucket under `client_command`. The `default` bucket applies to every command that does not have its own explicit bucket — which means it covers everything:

```json title="config.json"
{
  "client": {
    "rate_limit": {
      "client_command": {
        "enabled": true,
        "default": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 100
            }
          ]
        }
      }
    }
  }
}
```

This single setting caps every connection to 100 commands per second across all command types — a reasonable starting point that allows normal interactive usage while cutting off clients that loop or misbehave.

Add a `total` bucket alongside `default` if you want a hard cap on the combined rate regardless of which commands are called:

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
              "rate": 100
            }
          ]
        },
        "default": {
          "enabled": true,
          "buckets": [
            {
              "interval": "1s",
              "rate": 100
            }
          ]
        }
      }
    }
  }
}
```

From this baseline you can tighten specific commands by adding explicit buckets — for example, lowering `publish` or `history` limits — without touching the rest. The sections below describe the full per-command configuration.

## In-memory per connection rate limit

In-memory rate limit is an efficient way to limit the number of operations allowed on a per-connection basis – i.e. inside each individual real-time connection. Our rate limit implementation uses the [token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm internally.

The list of operations which can be rate limited on a per-connection level is:

* `subscribe`
* `unsubscribe`
* `publish`
* `history`
* `presence`
* `presence_stats`
* `refresh`
* `sub_refresh`
* `rpc` (with optional method resolution)
* `map_publish`
* `map_remove`
* `track`
* `untrack`

In addition, Centrifugo allows defining two special buckets containers:

* `total` – define it to cap the combined rate of all commands from a connection. Total buckets are checked after the per-command (or `default`) check passes — only allowed commands consume a token from `total`. Rejected commands do not count against `total`. Note: `connect` is not subject to `total` in `client_command` (connect is not throttled at the per-connection level at all).
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

Centrifugo real-time SDKs are written in a way that if a client receives an error during connect – it will try to reconnect to a server with a backoff algorithm. The same applies to subscribing to channels (i.e. error from a subscribe command) – the subscription request will be retried with a backoff. Refresh and subscription refresh will also be retried automatically by the SDK upon errors after several seconds. Retries of other commands should be handled manually from the client side if needed – though usually you should choose rate limit values in a way that normal users of your app never hit the limits.

:::

## In-memory per user rate limit

Another type of rate limit in Centrifugo PRO is a per-user-ID in-memory rate limit. Like the per-client rate limit, this one is also very efficient since it also uses in-memory token buckets. The difference is that instead of rate limiting per individual client, this type of rate limit takes the user ID into account.

This type of rate limit only checks commands coming from authenticated users – i.e. with a non-empty user ID set. Requests from anonymous users can't be rate limited with it.

The list of operations which can be rate limited is similar to the in-memory rate limit described above. But with **additional** `connect` method:

* `total`
* `default`
* `connect`
* `subscribe`
* `unsubscribe`
* `publish`
* `history`
* `presence`
* `presence_stats`
* `refresh`
* `sub_refresh`
* `rpc` (with optional method resolution)
* `map_publish`
* `map_remove`
* `track`
* `untrack`

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

The next type of rate limit in Centrifugo PRO is a distributed per-user-ID rate limit with Redis as a bucket state storage. In this case, limits are global for the entire Centrifugo cluster. If one user executed two commands on different Centrifugo nodes, Centrifugo consumes two tokens from the same bucket kept in Redis. Since this rate limit goes to Redis to check limits, it adds some latency to command processing. Our implementation tries to provide good throughput characteristics though – in our tests a single Redis instance can handle more than 100k limit check requests per second. And it's possible to scale Redis in the same ways as for the Centrifugo Redis Engine.

This type of rate limit only checks commands coming from authenticated users – i.e. with a non-empty user ID set. Requests from anonymous users can't be rate limited with it. The implementation also uses the [token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm internally.

The list of operations which can be rate limited is similar to the in-memory user command rate limit described above. But **without** special bucket `total`:

* `default`
* `connect`
* `subscribe`
* `unsubscribe`
* `publish`
* `history`
* `presence`
* `presence_stats`
* `refresh`
* `sub_refresh`
* `rpc` (with optional method resolution)
* `map_publish`
* `map_remove`
* `track`
* `untrack`

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

It's also possible to reuse Centrifugo Redis engine by setting `reuse_from_engine` option instead of custom rate limit Redis configuration declaration, like this:

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

In this case the rate limit will simply connect to Redis instances configured for the Engine.

## Performance

**In-memory throttlers** (`client_command` and `user_command`) check token buckets entirely in memory with zero allocations per check. A single bucket check costs around **50 ns** on modern hardware; stacking multiple buckets or adding `total` adds only a few nanoseconds each. The overhead is negligible compared to normal command processing.

**Redis throttler** (`redis_user_command`) executes one Lua script call to Redis per command. In production there is always parallelism from many concurrent connections, so the relevant figure is aggregate throughput: benchmarks against a local Redis instance with 64 concurrent goroutines show **~260k checks/s** (~4 µs/op). A single Redis node can comfortably handle this load, and Centrifugo supports the same Redis scaling options as the engine (Sentinel, Cluster, client-side sharding) to go further.

:::tip

Use a dedicated Redis instance for rate limiting rather than reusing the engine Redis via `reuse_from_engine`. The rate limit workload (frequent small Lua script calls) competes with the engine's pub/sub and presence traffic on the same connection pool. A separate Redis instance isolates the two workloads and keeps latency predictable for both.

:::

When all three throttler layers are active they run in sequence, short-circuiting on the first denial. The two in-memory layers contribute under 200 ns combined; the Redis layer contributes one Redis round-trip. Use the in-memory throttlers alone when per-node limits are sufficient, and add the Redis throttler when limits must be consistent across the Centrifugo cluster.

:::tip

Use `user_command` as a cheap front-end filter for `redis_user_command`. Because in-memory checks run first and short-circuit on denial, configuring the same (or slightly looser) limits in `user_command` means that over-limit requests are caught in memory before they ever reach Redis. Only requests that pass the in-memory gate incur a Redis round-trip. This can significantly reduce Redis load from abusive or misbehaving clients hammering a single node.

:::

## Channel namespace overrides

Centrifugo PRO allows defining rate limit overrides on a per-namespace basis for channel operations. A namespace override **completely replaces** the base command bucket for channels in that namespace — the base bucket is not checked alongside the override, only the override buckets are used. This means overrides can both relax and tighten limits relative to the base.

Available channel operations that support namespace overrides:

* `subscribe`
* `unsubscribe`
* `publish`
* `history`
* `presence`
* `presence_stats`
* `sub_refresh`
* `map_publish`
* `map_remove`
* `track`
* `untrack`

`connect`, `refresh`, and `rpc` are not channel-scoped so they don't support namespace overrides.

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
- Default publish rate is 5 per second for all channels
- For `chat:*` channels, publish rate is **replaced** with 20 per second (higher — the 5/s base no longer applies)
- For `notifications:*` channels, publish rate is **replaced** with 1 per 10 seconds (lower — the 5/s base no longer applies)
- Default subscribe rate is 3 per second
- For `chat:*` channels, subscribe rate is **replaced** with 10 per second

The same override support applies to `user_command` and `redis_user_command` limiter types.

When a channel operation is performed, Centrifugo:

1. Extracts the namespace from the channel name (e.g., `chat` from `chat:room123`)
2. Checks if a namespace override exists for that operation and namespace
3. If found and enabled, uses **only** the namespace override buckets (base command buckets are not checked)
4. Otherwise, falls back to the base operation buckets (or `default` if no base is configured)

:::note
A namespace override with `enabled: true` but no `buckets` array specified is treated the same as no override — Centrifugo falls back to `default` buckets if configured.
:::

:::note
The `total` bucket is always checked regardless of whether a base or namespace override bucket is active — it is appended after the per-command check and only consumes a token when the per-command check passes.
:::

## Disconnecting abusive or misbehaving connections

Above we showed how you can define rate limit strategies to protect server resources and prevent execution of many commands inside the connection and from a certain user.

But there are scenarios where abusive or broken connections may generate a significant load on the server just by calling commands and getting error responses due to rate limits or other reasons (like a malformed command). Centrifugo PRO provides a way to configure error limits per connection to deal with this case.

Error limits are configured as in-memory buckets operating on a per-connection level. When these buckets are full due to lots of errors for an individual connection, Centrifugo disconnects the client (with advice to not reconnect, so our SDKs may follow it). This way it's possible to get rid of the connection and rely on HTTP infrastructure tools to deal with client reconnections. Since WebSocket and other transports (except unidirectional GRPC, which is usually not available on the public port) are HTTP-based (or start with an HTTP request in the WebSocket Upgrade case) – developers can use the Nginx `limit_req_zone` directive, Cloudflare rules, iptables, and so on, to protect Centrifugo from unwanted connections.

:::tip

Centrifugo PRO does not count internal errors for the error limit buckets – as internal errors are usually not a client's fault.

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

## RPC method overrides format change

Starting from Centrifugo v6.8.0, the format for RPC method-specific rate limit overrides has been updated to use an array format (`method_overrides`) instead of the previous map format (`method_override`).

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

Before v6.8.0, the old format used `method_override` as a map/object:

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

The old `method_override` map format is still supported for backward compatibility. If you have existing configurations using `method_override`, they will continue to work in v6.8.0 and later versions until Centrifugo v7. However, you cannot use both `method_override` and `method_overrides` at the same time – if both are present, Centrifugo will return a validation error on startup.

We recommend migrating to the new `method_overrides` array format when possible, as it provides better tooling support and is more consistent with other array-based configurations in Centrifugo.
