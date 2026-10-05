---
description: "Configure operation rate limits in Centrifugo PRO per connection, user, or via Redis. Includes namespace overrides and abusive client disconnection."
id: rate_limiting
title: Operation rate limits
---

The rate limit feature allows limiting the number of operations each connection or user can issue during a configured time interval. This is useful to protect the system from misuse, and for detecting and disconnecting abusive or broken (due to a bug in the frontend application) clients that add unwanted load on a server.

Centrifugo PRO applies these limits with knowledge no network layer has: which command was issued, on which channel and namespace, by which user, on which connection. That is what makes it possible to allow a user their normal subscribe and publish rate while bounding the operations that cost the most.

Infrastructure-level protection remains worthwhile alongside it, and the two are complementary rather than alternatives: a proxy or CDN bounds request and connection volume before it reaches the server, while Centrifugo bounds what an established, authenticated connection may do. Configure both where you can, and read [how limits affect a deployment](#how-limits-affect-a-deployment) before enabling them.

![Throttling](/img/throttling.png)

## Simple configuration

If you just want to protect the server from abusive clients without fine-tuning per-command limits, configure a `default` bucket under `client_command`. The `default` bucket applies to every command that does not have its own explicit bucket. Each command type gets its own limiter built from the `default` buckets:

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

This setting caps every connection to 100 commands per second for each command type (e.g. 100 publishes and 100 history calls per second). The numbers here only illustrate the format – the right values depend on how your application uses Centrifugo, so measure them with [dry run](#try-limits-before-enforcing-them) first.

`default` is not a combined cap. Add a `total` bucket alongside `default` if you want a hard cap on the combined rate regardless of which commands are called:

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

From there you can tighten specific commands by adding explicit buckets — for example, lowering `publish` or `history` limits — without touching the rest. The sections below describe the full per-command configuration.

## Protection layers

:::info Version

`dry_run` and `disconnect_on_accounted_limit` are available since Centrifugo v6.10.0. The `centrifugo_transport_frame_size` metric referenced below is available since v6.9.4.

:::

Rate limits are applied in layers:

* [`client_command`](#in-memory-per-connection-rate-limit) (and the per-user layers) bound the operations a connection or a user may perform.
* [`client_error`](#disconnecting-abusive-or-misbehaving-connections) closes a connection that keeps producing protocol errors, so a misbehaving client stops consuming resources rather than being refused one command at a time.

Each is described in detail below. Connection attempts per client address are best limited in your infrastructure (load balancer or reverse proxy), in front of Centrifugo. There are no universal values for them: start with [dry run](#try-limits-before-enforcing-them) and size the limits against your own traffic.

### How limits affect a deployment

Every limit which is enforced can affect legitimate users, not only abusive ones. Before enabling a layer, consider what your clients will see:

* **Refused commands.** A command over its limit gets the `111` (too many requests) error. SDKs retry a refused subscribe as a temporary error, while for publish, RPC, history and presence the error reaches your application code, which has to handle it.
* **Disconnects.** `client_error` and `disconnect_on_accounted_limit` close the connection with a code which tells SDKs not to reconnect. A legitimate client caught by a limit set too tight stays disconnected until the application reconnects it.
* **Mass reconnects.** After a Centrifugo restart, a deploy or a network incident, many clients reconnect at once. Connection rate limits slow this recovery down – users behind a shared address (a corporate NAT, a mobile carrier gateway, a VPN) are affected first by limits applied per address.
* **Shared user budgets.** `user_command` and `redis_user_command` limit a user across all their connections – tabs and devices of one user draw from the same buckets.

## Try limits before enforcing them

Choosing values is the hardest part of rate limiting: too low and normal users are affected, too high and the limits do little. Every layer supports `dry_run`, so the numbers can be measured against your own traffic first:

```json title="config.json"
{
  "client": {
    "rate_limit": {
      "client_command": {
        "enabled": true,
        "dry_run": true,
        "default": {
          "enabled": true,
          "buckets": [{"interval": "1s", "rate": 100}]
        }
      }
    }
  }
}
```

In dry run Centrifugo evaluates buckets and consumes tokens exactly as it would when enforcing, records every over-limit hit to metrics, and then **allows the operation anyway**. Nothing is ever rejected.

That makes the rollout a measurement rather than a bet:

1. Enable the layer with `dry_run: true` and your candidate buckets.
2. Watch `centrifugo_rate_limit_client_over_limit_count` (see [Metrics](#metrics)) for a representative period — at least one full daily traffic cycle.
3. If real users are producing hits, the limit is too tight. Raise it and keep watching.
4. When the counter only moves for traffic you actually want to stop, remove `dry_run`.

Because dry run drains the same buckets, the counter reports precisely what enforcement would have rejected — switching it off changes the verdict, not the accounting.

`dry_run` is available on `client_command`, `user_command`, `redis_user_command` and `client_error`, and can be set per layer. It defaults to `false`, so existing configurations keep enforcing.

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

`unsubscribe` and `untrack` behave differently from the rest: their buckets are charged and reported, but exceeding them never rejects the command. See [Commands that are counted but never rejected](#commands-that-are-counted-but-never-rejected).

In addition, Centrifugo allows defining two special buckets containers:

* `total` – define it to cap the combined rate of all commands from a connection. Total buckets are checked after the per-command (or `default`) check passes — only allowed commands consume a token from `total`. Rejected commands do not count against `total` of the same limiter. When both `client_command` and user-level limiters (`user_command`, `redis_user_command`) are enabled, `client_command` is checked first – a command it allows has already consumed tokens from its buckets (including `total`) even if a user-level limiter then rejects it. Note: `connect` is not subject to `total` in `client_command` (connect is not throttled at the per-connection level at all). `unsubscribe` and `untrack` are always allowed and therefore always consume `total` — see [Commands that are counted but never rejected](#commands-that-are-counted-but-never-rejected).
* `default` - define it if you don't want to configure some command buckets explicitly, default buckets will be used in case command buckets is not configured explicitly. `default` buckets apply per command type – each command gets a separate limiter, so `default` does not cap the combined rate (use `total` for that).

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

This type of rate limit only checks commands coming from authenticated users – i.e. with a non-empty user ID set. Requests from anonymous users can't be rate limited with it, since there is no user ID to aggregate on. Anonymous connections are covered per connection by `client_command`.

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

The list of operations which can be rate limited is similar to the in-memory user command rate limit described above. But **without** special bucket `total`, and without `unsubscribe` and `untrack` (see [Commands that are counted but never rejected](#commands-that-are-counted-but-never-rejected)):

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
* `map_publish`
* `map_remove`
* `track`

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

**In-memory throttlers** (`client_command` and `user_command`) check token buckets entirely in memory without allocations. Their cost is small compared to processing the command itself, and with rate limits switched off there is practically no overhead.

**Redis throttler** (`redis_user_command`) executes one Lua script call to Redis per command, so it adds a Redis round trip to each limited command. Centrifugo supports the same Redis scaling options as for the engine (Sentinel, Cluster, client-side sharding).

:::tip

Use a dedicated Redis instance for rate limiting rather than reusing the engine Redis via `reuse_from_engine`. The rate limit workload (frequent small Lua script calls) competes with the engine's pub/sub and presence traffic on the same connection pool. A separate Redis instance isolates the two workloads and keeps latency predictable for both.

:::

When all three throttler layers are active they run in sequence, short-circuiting on the first denial. The in-memory layers add little; the Redis layer adds a Redis round trip. Use the in-memory throttlers alone when per-node limits are sufficient, and add the Redis throttler when limits must be consistent across the Centrifugo cluster.

:::tip

Use `user_command` as a cheap front-end filter for `redis_user_command`. Because in-memory checks run first and short-circuit on denial, configuring the same (or slightly looser) limits in `user_command` means that over-limit requests are caught in memory before they ever reach Redis. Only requests that pass the in-memory gate incur a Redis round-trip. This can significantly reduce Redis load from abusive or misbehaving clients hammering a single node.

:::

## Commands that are counted but never rejected

`unsubscribe` and `untrack` are treated differently from other commands: their buckets are charged and reported, but exceeding them does not refuse the command.

This is deliberate. Both commands exist for a client to release state it no longer needs — leaving a channel, dropping a tracked key — so completing them reduces server-side work. Refusing them does not:

* Centrifugo SDKs treat an error reply to `unsubscribe` as fatal and reconnect. Refusing one inexpensive command therefore produces a full reconnect instead: a new transport, a connect handshake, token verification, a connect proxy call if configured, and a resubscribe to every channel.
* A refused `untrack` leaves the server tracking a key the client has already released, so it keeps broadcasting updates that are no longer wanted.

Their buckets remain fully effective. These commands consume tokens like any other — including from `total`, and unlike enforced commands they consume it even when their own bucket is empty. A connection issuing them at a high rate therefore draws down its overall budget, and the commands that ask the server to perform work are limited accordingly.

### Disconnecting a client that exceeds them

For clients that persistently exceed these buckets, `disconnect_on_accounted_limit` closes the connection:

```json title="config.json"
{
  "client": {
    "rate_limit": {
      "client_command": {
        "enabled": true,
        "disconnect_on_accounted_limit": true,
        "unsubscribe": {
          "enabled": true,
          "buckets": [{"interval": "1s", "rate": 50}]
        },
        "untrack": {
          "enabled": true,
          "buckets": [{"interval": "1s", "rate": 50}]
        }
      }
    }
  }
}
```

Disconnecting is not the same as refusing a command. The disconnect code is in the range that instructs SDKs not to reconnect, so the connection is released rather than re-established.

:::tip Limit connection rate as well

Closing a connection is effective when combined with a limit on how quickly a client may open a new one: apply a per-IP connection rate limit in your infrastructure. Centrifugo logs a warning at startup when `disconnect_on_accounted_limit` is set, as a reminder.

:::

The option is off by default and worth sizing carefully: a client legitimately switching channels quickly should not be disconnected by a bucket set too tight. Run with `dry_run: true` first and watch the metric before enabling it. The decision is made per connection — the per-user layer never disconnects, so one session cannot affect a user's other sessions.

These buckets are also a useful signal on their own. Configured at a rate no normal client reaches, over-limit hits appear as `centrifugo_rate_limit_client_over_limit_count{command="unsubscribe"}` and indicate a connection behaving abnormally rather than a command being refused.

:::note

For the same reason, `unsubscribe` and `untrack` are not evaluated by the `redis_user_command` layer. That layer has no `total` bucket and does not refuse these commands, so a Redis round trip for them would add latency without changing any outcome. They are charged by the two in-memory layers. Since v6.10.0 configuring `unsubscribe` or `untrack` in `redis_user_command` is a configuration error, as such buckets would never have an effect.

:::

## Metrics

Rate limit decisions are exported so you can see whether limits fire, which layer fired, and for which command:

```
centrifugo_rate_limit_client_over_limit_count{layer, command, namespace, dry_run}
```

* `layer` – `client_command`, `user_command`, `redis_user_command` or `client_error`.
* `command` – the command that exceeded its bucket (`publish`, `subscribe`, `rpc.my_method`, `error` for `client_error`).
* `namespace` – the channel namespace, populated only when `prometheus.channel_namespace_resolution` is enabled, empty otherwise. It is the name of a configured namespace (empty for channels without a namespace), or `?` for a channel whose namespace is not configured, so cardinality stays bounded by the number of configured namespaces whatever channel names clients send.
* `dry_run` – `true` when the layer is in dry run, so hits recorded while sizing a limit are never confused with traffic that was actually rejected.

The counter is incremented **only** when a bucket denies. Commands that pass their buckets do no metric work at all, so the normal path costs nothing.

Two readings are worth alerting on:

* Sustained hits with `dry_run="false"` mean traffic is being refused. Check whether the limit matches what your application legitimately does before assuming it is unwanted traffic.
* Hits on `command="unsubscribe"` or `command="untrack"` indicate a connection issuing these at an unusual rate. Since these commands are always completed, this is a behavioural signal rather than a record of refused work.

## Message size and large payloads

Command buckets count operations. The size of each command is bounded separately, by `websocket.message_size_limit` and its equivalents on other transports. The two work together: the command rate sets how many operations a connection may perform, and the size limit sets how large each may be.

If your application sends small messages, lowering the size limit is a straightforward way to reduce the volume a single connection can transfer. It needs care, though, for two reasons.

**The limit applies to a whole frame.** Centrifugo's protocol supports batching, and the SDKs use it: on every transport open, `centrifuge-js` sends the `connect` command and every subscribe in a single frame. A client subscribed to many channels with subscription tokens therefore sends a large frame each time it connects. `message_size_limit` is applied as a transport read limit, so it bounds that whole frame — while the protocol decoder additionally bounds each individual command.

**A frame over the limit ends the connection.** It is not a refused command: the connection is closed with WebSocket code 1009, which SDKs report as a message size limit error and do not retry. A client whose reconnect frame exceeds the limit is therefore unable to connect at all, and because frame size grows with subscription count, this affects the users on the most channels first.

Size the limit against your **largest reconnect frame**, not a typical publish, and leave headroom.

### Choosing a value

`centrifugo_transport_frame_size` (available since Centrifugo v6.9.4) is a histogram of received frame sizes. Set the limit from an observed high quantile:

```
histogram_quantile(0.99, sum(rate(centrifugo_transport_frame_size_bucket[5m])) by (le, transport))
```

Two companion signals are useful alongside it:

* `centrifugo_transport_outgoing_close_count{code="1009"}` counts connections closed because a frame exceeded the limit — a non-zero rate means the limit is set below what some clients send.
* Dividing `centrifugo_transport_messages_received` by `centrifugo_transport_frame_size_count` gives the mean number of commands per frame, i.e. how much your clients batch.

### Bandwidth shaping

If you need to limit throughput as a byte rate rather than a per-message size, this is best applied at the proxy in front of Centrifugo. Bandwidth shaping there applies backpressure — a client's writes slow down, without an error or a disconnect — and the traffic is bounded before it reaches the server.

Note that not every proxy can do this for WebSocket. Rate limiting in nginx and Cloudflare acts on HTTP requests, and after the WebSocket upgrade the connection is an opaque byte stream to them, so their request-based rules do not apply to individual frames. HAProxy provides bandwidth limitation filters (`filter bwlim-in` / `bwlim-out`) that operate on the byte stream — verify the behaviour with your version and tunnelling configuration.

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
A namespace override (or RPC method override) with `enabled: true` but no `buckets` array specified uses the `default` buckets, not the base command buckets. If `default` is not configured either, no per-command limit applies to that namespace (or method) – only `total`, if configured.
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

`client_error` also supports `dry_run`, which reports would-be disconnects to metrics (`layer="client_error"`) without ever disconnecting. Since this limit ends in a disconnect rather than a rejected command, sizing it in dry run first is worth the extra step.

## Upgrade notes

Changes in Centrifugo v6.10.0:

* **`unsubscribe` and `untrack` are no longer refused** when over their limit – they are counted and always completed, see [Commands that are counted but never rejected](#commands-that-are-counted-but-never-rejected).
* **`unsubscribe` and `untrack` are now limited in `user_command` too**, so they draw from the per-user `total` and `default` buckets. If those are tight, check with `dry_run` first.
* **Stricter validation.** Centrifugo does not start when a bucket of any channel command (including `map_publish`, `map_remove`, `track`, `unsubscribe`, `untrack`) is invalid – an interval outside `1s`–`1h`, a zero rate, a namespace override without `namespace_name` – even when the layer is disabled, or when `unsubscribe` or `untrack` are set in `redis_user_command`.

New options (`dry_run`, `disconnect_on_accounted_limit`) are off by default.

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
