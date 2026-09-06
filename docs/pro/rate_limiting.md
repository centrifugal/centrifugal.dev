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

## Try limits before enforcing them

The hardest part of rate limiting is picking numbers. Set them too low and you break normal users; set them too high and they protect nothing. Guessing is avoidable — every layer supports `dry_run`:

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

`dry_run` is available on `client_command`, `user_command`, `redis_user_command`, `client_error` and `ip_connect`, and can be set per layer. It defaults to `false`, so existing configurations keep enforcing.

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

* `total` – define it to cap the combined rate of all commands from a connection. Total buckets are checked after the per-command (or `default`) check passes — only allowed commands consume a token from `total`. Rejected commands do not count against `total`. Note: `connect` is not subject to `total` in `client_command` (connect is not throttled at the per-connection level at all; see [Per-IP connect rate limit](#per-ip-connect-rate-limit)). `unsubscribe` and `untrack` are always allowed and therefore always consume `total` — see [Commands that are counted but never rejected](#commands-that-are-counted-but-never-rejected).
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

This type of rate limit only checks commands coming from authenticated users – i.e. with a non-empty user ID set. Requests from anonymous users can't be rate limited with it, since there is no user ID to aggregate on. Anonymous connections are covered per connection by `client_command`, and bounded in aggregate by [Per-IP connect rate limit](#per-ip-connect-rate-limit).

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

This type of rate limit only checks commands coming from authenticated users – i.e. with a non-empty user ID set. Requests from anonymous users can't be rate limited with it; see [Per-IP connect rate limit](#per-ip-connect-rate-limit) for the layer that does cover them. The implementation also uses the [token bucket](https://en.wikipedia.org/wiki/Token_bucket) algorithm internally.

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

**In-memory throttlers** (`client_command` and `user_command`) check token buckets entirely in memory with zero allocations per check. A single bucket check costs around **50 ns** on modern hardware; stacking multiple buckets or adding `total` adds only a few nanoseconds each. A full channel command through one layer — namespace resolution plus a per-command bucket and `total` — costs about **130 ns** with no allocations, and both in-memory layers chained cost about **260 ns**. A build with rate limits switched off pays a single branch, around **4 ns**.

**Per-IP connect limit** (`ip_connect`) is one in-memory bucket check per connection *attempt*, around **43 ns**, and does not touch the per-command path at all.

**Redis throttler** (`redis_user_command`) executes one Lua script call to Redis per command. In production there is always parallelism from many concurrent connections, so the relevant figure is aggregate throughput: benchmarks against a local Redis instance with 64 concurrent goroutines show **~260k checks/s** (~4 µs/op). A single Redis node can comfortably handle this load, and Centrifugo supports the same Redis scaling options as the engine (Sentinel, Cluster, client-side sharding) to go further.

:::tip

Use a dedicated Redis instance for rate limiting rather than reusing the engine Redis via `reuse_from_engine`. The rate limit workload (frequent small Lua script calls) competes with the engine's pub/sub and presence traffic on the same connection pool. A separate Redis instance isolates the two workloads and keeps latency predictable for both.

:::

When all three throttler layers are active they run in sequence, short-circuiting on the first denial. The two in-memory layers contribute under 300 ns combined; the Redis layer contributes one Redis round-trip. Use the in-memory throttlers alone when per-node limits are sufficient, and add the Redis throttler when limits must be consistent across the Centrifugo cluster.

:::tip

Use `user_command` as a cheap front-end filter for `redis_user_command`. Because in-memory checks run first and short-circuit on denial, configuring the same (or slightly looser) limits in `user_command` means that over-limit requests are caught in memory before they ever reach Redis. Only requests that pass the in-memory gate incur a Redis round-trip. This can significantly reduce Redis load from abusive or misbehaving clients hammering a single node.

:::

## Commands that are counted but never rejected

`unsubscribe` and `untrack` are treated differently from every other command: their buckets are charged and reported, but exceeding them **never rejects the command**.

This is deliberate, and it is about load rather than leniency. Both commands exist for a client to shed state it no longer wants — leaving a channel, dropping a tracked key — so server-side work goes *down* when they succeed. Refusing them inverts that:

* Every Centrifugo SDK treats an error reply to `unsubscribe` as fatal and reconnects. So rejecting one cheap command produces a full reconnect instead: a new transport, a connect handshake, token verification, a connect proxy call if configured, and a resubscribe to every channel. Under load that turns a rate limit into a reconnect storm.
* A rejected `untrack` leaves the server tracking a key the client has already forgotten, so it keeps broadcasting updates nobody wants. Load goes up and the two sides disagree permanently.

Protection is not lost, because these commands still consume tokens — including from `total`, and unlike enforced commands they consume it even when their own bucket is empty. A flood of unsubscribes therefore drains the connection's overall budget, and the commands that *do* ask the server to do work (`publish`, `history`, `presence`, `rpc`, `subscribe`) start being rejected instead. Rejection still happens; it happens where an SDK handles it sanely.

That covers an attacker who wants to do something else. It does **not** cover one that sends nothing but `unsubscribe` — see below.

### Disconnecting a client that floods them

Charging `total` protects the commands an attacker is *not* sending. It does nothing about a client that sends nothing but `unsubscribe`: that command is always allowed, always succeeds, and produces no error for the error limit to count, so no other layer sees it either.

Measured against a real server at 1M unsubscribe frames/s offered, with every other limit enabled: **0.1% of the flood was stopped**, server CPU was unchanged, and legitimate users' p99 round trip was **377ms**. The same load as `publish` was 99.8% stopped.

`disconnect_on_accounted_limit` closes a connection that keeps exceeding these buckets:

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

With it, the same flood is 99.8% stopped, server CPU drops from 5.8s to 530ms, and legitimate p99 returns to **744µs**.

Disconnecting is not the same as refusing. The disconnect code is in the range that tells SDKs not to reconnect, so it sheds the load rather than converting it into a reconnect — which is exactly what refusing the command did.

It is off by default, and worth sizing carefully: a client doing legitimate rapid channel churn must not be cut off by a bucket set too tight. Run with `dry_run: true` first and watch the metric before enabling it. The decision is made per connection — the per-user layer never disconnects, since one abusive session must not take down a user's other sessions.

Their buckets are also useful as a pure **detection** signal. Configure `unsubscribe` at a rate no real client should reach and alert on the metric:

```json title="config.json"
{
  "client": {
    "rate_limit": {
      "client_command": {
        "enabled": true,
        "unsubscribe": {
          "enabled": true,
          "buckets": [{"interval": "1s", "rate": 50}]
        }
      }
    }
  }
}
```

Over-limit hits show up as `centrifugo_rate_limit_client_over_limit_count{command="unsubscribe"}` and mean "this connection is behaving abnormally", not "this command was refused".

:::note

For the same reason, `unsubscribe` and `untrack` are not evaluated by the `redis_user_command` layer. That layer has no `total` bucket to accumulate into and never rejects these commands, so a Redis round trip per unsubscribe would buy nothing. They are charged by the two in-memory layers.

:::

## Per-IP connect rate limit

Every layer above keys on a client ID or a user ID, which means none of them can act until a connection exists and — for the per-user layers — until it has authenticated. Two things fall outside that:

* **Anonymous connections.** With `client.allow_anonymous` there is no user ID, so `user_command` and `redis_user_command` skip these connections entirely. `client_command` does apply, but it only sets the cost *per connection* — and the number of connections is the attacker's choice.
* **Connect-time work.** A connect attempt verifies a JWT and, when the connect proxy is configured, makes an HTTP call to your backend. Both happen before there is any user ID to rate limit on, so a flood of unauthenticated connects reaches your backend at full rate.

`ip_connect` closes both. It runs in HTTP middleware, before the connection handler, keyed on the client's address:

```json title="config.json"
{
  "client": {
    "rate_limit": {
      "ip_connect": {
        "enabled": true,
        "buckets": [
          {"interval": "1s", "rate": 10},
          {"interval": "1m", "rate": 200}
        ]
      }
    }
  }
}
```

An address over the limit gets an HTTP `429` before any connect work happens. Unlike a rejection inside the protocol, this is a response to a *connection attempt*, so SDKs apply their normal connect backoff rather than tearing down an established session.

Options:

* `enabled` – turns the layer on. Off by default.
* `buckets` – token buckets, same format as everywhere else. All listed buckets must allow the attempt.
* `dry_run` – evaluate and report without rejecting. Strongly recommended for the first rollout: this layer sits in front of every connection, so a number that is too low locks users out.
* `max_tracked_ips` – how many addresses are tracked at once, default `100000`. Once reached, addresses that are not already tracked are **allowed through** rather than evicting live entries. Failing open is deliberate: rejecting unknown addresses at capacity would let an attacker fill the table with junk and deny service to everybody else.

:::note

Address derivation follows the same rules Centrifugo uses elsewhere: `X-Forwarded-For` and `X-Real-IP` are trusted **only** when the immediate socket peer is a loopback or private address, i.e. a local reverse proxy or load balancer. For a directly connected public client those headers are attacker-controlled and ignored, so a client cannot spoof them to evade its own limit or exhaust somebody else's bucket. If you terminate TLS on a public-IP load balancer that does not appear as a private peer, put a private-address proxy in front or rely on infrastructure-level limits instead.

:::

:::tip

`ip_connect` complements the existing `client.connection_rate_limit`, which caps new connections per node *in aggregate*. An aggregate cap protects the node but treats all callers alike, so one flooding source can consume the whole budget and starve everyone else. A per-IP limit charges the source that is actually responsible. Using both is reasonable: per-IP for fairness, aggregate as a backstop.

:::

## Metrics

Rate limit decisions are exported so you can see whether limits fire, which layer fired, and for which command:

```
centrifugo_rate_limit_client_over_limit_count{layer, command, namespace, dry_run}
```

* `layer` – `client_command`, `user_command`, `redis_user_command`, `client_error` or `ip_connect`.
* `command` – the command that exceeded its bucket (`publish`, `subscribe`, `rpc.my_method`, `connect` for `ip_connect`, `error` for `client_error`).
* `namespace` – the channel namespace, populated only when `prometheus.channel_namespace_resolution` is enabled, empty otherwise. This reuses the existing switch so cardinality stays bounded by the number of configured namespaces.
* `dry_run` – `true` when the layer is in dry run, so hits recorded while sizing a limit are never confused with traffic that was actually rejected.

The counter is incremented **only** when a bucket denies. Commands that pass their buckets do no metric work at all, so the normal path costs nothing.

Two readings are worth alerting on:

* Sustained hits with `dry_run="false"` mean real traffic is being rejected — either an attack, or a limit set too low.
* Hits on `command="unsubscribe"` or `command="untrack"` mean a connection is behaving abnormally, since those commands are never actually rejected.

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

`client_error` also supports `dry_run`, which reports would-be disconnects to metrics (`layer="client_error"`) without ever disconnecting. Since this limit ends in a disconnect rather than a rejected command, sizing it in dry run first is worth the extra step.

## Upgrade notes

Three behaviours changed in the rate limit subsystem. All of them are safe by default — no new limit starts enforcing on upgrade — but two are worth checking if you already have limits configured.

**`unsubscribe` and `untrack` are no longer rejected.** Previously an over-limit `unsubscribe` returned an error, which every SDK turns into a full reconnect. They are now charged and reported but always allowed. If you relied on the rejection, nothing replaces it directly — alert on the metric instead, and let the `total` bucket absorb floods. This strictly reduces rejections, so it cannot break a working deployment.

**`unsubscribe` and `untrack` now work on the `user_command` layer.** They were documented and accepted as configuration but registered no buckets there, so setting them — or relying on `default` to cover them — silently did nothing. They now behave as documented. The practical consequence is that these commands consume the per-user `total` bucket where they previously consumed nothing. If your `user_command.total` is tight and your application swaps channels frequently, check the metric before and after upgrading, or run the layer with `dry_run: true` for a period first.

**Server-initiated refreshes are no longer rate limited.** `refresh` and `sub_refresh` limits previously applied to Centrifugo's own subscription and connection expiry refreshes as well as to client-sent commands. Exhausting those buckets could therefore drop subscriptions or disconnect connections that had sent nothing. Only client-initiated refreshes are limited now. If you had raised these limits to work around unexplained disconnects, you can lower them again.

Nothing in the configuration format changed incompatibly: `dry_run` defaults to `false` on every layer, and `ip_connect` is disabled unless configured.

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
