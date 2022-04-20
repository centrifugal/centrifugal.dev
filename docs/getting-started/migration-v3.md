---
id: migration_v3
title: Migrating to v3
---

This chapter aims to help developers migrate from Centrifugo v2 to Centrifugo v3. Migration should mostly affect the backend part only, so you won't need to change the code of your frontend applications at all. In most cases, all you should do is adapt Centrifugo configuration to match v3 changes and redeploy Centrifugo using v3 build instead of v2.

There are a couple of exceptions - read carefully about client-side changes below.

In any case – don't forget to test your application before running in production.

## Client-side changes

Client protocol has some backward incompatible changes regarding working with history API and removing deprecated fields.

### No unlimited history by default

Call to `history` API from client-side now does not return all publications from history cache. It returns only information about a stream with zero publications. Clients should explicitly provide a limit when calling history API. Also, the maximum allowed limit can be set by `client_history_max_publication_limit` option (by default `300`).

We provide a boolean flag `use_unlimited_history_by_default` on configuration file top level to enable previous behavior while you migrate client applications to use explicit limit.

### Publication limit for recovery

The maximum number of messages that can be recovered is now limited by `client_recovery_max_publication_limit` option which is by default `300`.

### Seq/Gen fields removed

Deprecated seq/gen now removed and Centrifugo uses `offset` field for a position in a stream. This means that there is no need for `v3_use_offset` option anymore – it's not used in Centrifugo v3.

## Server-side changes

### Time interval options are duration

In Centrifugo v3 all time intervals should be configured using [duration](../server/configuration.md#setting-time-duration-options).

For example `"proxy_connect_timeout": 1` should be changed to `"proxy_connect_timeout": "1s"`.

We provide a [configuration converter](#v2-to-v3-config-converter) which takes this change into account.

### Channel options changes

In Centrifugo v3 `history_recover` option becomes `recover`.

Option `history_lifetime` renamed to `history_ttl` and it's now a [duration](../server/configuration.md#setting-time-duration-options).

Option `server_side` removed, see [protected](../server/channels.md#protected) option as a replacement.

We provide a [configuration converter](#v2-to-v3-config-converter) which takes these changes into account.

### Some command-line flags removed

Configuring over command-line flags is not very convenient for production deployments, Centrifugo v3 reduced the number of command-line flags available – it mostly has flags frequently useful for development now. 

### Enforced request Origin check

In Centrifugo v3 you should explicitly [set a list of allowed origins](../server/configuration.md#allowed_origins) which are allowed to connect to client transport endpoints.

```json title="config.json"
{
    ...
    "allowed_origins": ["https://mysite.com"]
}
```

There is a way to disable origin check, but it's discouraged and **insecure** in case you are using connect proxy feature.

```json title="config.json"
{
    ...
    "allowed_origins": ["*"]
}
```

### Updated GRPC API Protobuf package

In Centrifugo v3 we addressed an [issue](https://github.com/centrifugal/centrifugo/issues/379) where package name in Protobuf definitions resulted in some inconvenience and attempts to rename it. But it's not possible to rename it since GRPC uses it as part of RPC methods internally. Now GRPC API package looks like this:

```
package centrifugal.centrifugo.api;
```

This means you need to regenerate your GRPC code which communicates with Centrifugo using the latest Protobuf definitions. Refer to the [GRPC API doc](../server/server_api.md#grpc-api).

### Channels API method changed

The response format of `channels` API call changed in v3. See description in [API doc](../server/server_api.md#channels). 

The channels method has new additional possibilities like showing the number of connections in a channel and filter channels by pattern.

:::info

Channels API call still has the same concern as before: this method does not scale well for many active channels in a system and is mostly recommended for administrative/debug purposes.

:::

### HTTP proxy changes

When using HTTP proxy you should now set an explicit list of headers you want to proxy. To mimic the behavior of Centrifugo v2 add to your configuration:

```json title=config.json
{
    "proxy_http_headers": [
        "Origin",
        "User-Agent",
        "Cookie",
        "Authorization",
        "X-Real-Ip",
        "X-Forwarded-For",
        "X-Request-Id"
    ]
}
```

If you had a list of extra HTTP headers using `proxy_extra_http_headers` then additionally extend list above with values from `proxy_extra_http_headers`. Then you can remove `proxy_extra_http_headers` - it's not used anymore.

Another important change is how Centrifugo proxies binary data over HTTP JSON proxy. Previously proxy mode (whether to use base64 fields or not) could be configured using `encoding=binary` URL param of connection. With Centrifugo v3 it's only possible to use binary mode by enabling `"proxy_binary_encoding": true` option. BTW according to our community poll only 2% of Centrifugo users used binary mode in HTTP proxy. If you have problems with new behavior – write about your situation to our community chats – and we will see what's possible.

### JWT changes

`eto` claim of subscription JWT removed. But since Centrifugo v3 introduced an additional `expire_at` claim it's still possible to implement one-time subscription tokens without enabling subscription expiration workflow by setting `"expire_at: 0"` in subscription JWT claims.

### Redis configuration changes

Redis configuration was a bit messy - especially in the Redis sharding case, in v3 we decided to clean up it a bit. Make it more explicit and reduce the number of possible ways to configure.

Refer to the [Redis Engine docs](../server/engines.md#redis-engine) for the new configuration details. The important thing is that there is no separate `redis_host` and `redis_port` option anymore – those are replaced with single `redis_address` option.

### Redis streams used by default

Centrifugo v3 will use Redis Stream data structure to keep history instead of lists.

:::danger

This requires Redis >= 5.0.1 to work. If you still need List data structure or have an old Redis version you can use `"redis_use_lists": true` to mimic the default behavior of Centrifugo v2.

:::

### SockJS disabled by default

Our poll showed that most Centrifugo users do not use SockJS transport. In v3 it's disabled by default. You can enable it by setting `"sockjs": true` in configuration.

### Other configuration changes

Here is a full list of configuration option changes. We provide a best-effort [configuration converter](#v2-to-v3-config-converter).

`allowed_origins` is now required to be set to authorize requests with `Origin` header

`v3_use_offset` removed

`redis_streams` removed

`tls_autocert_force_rsa` removed

`redis_pubsub_num_workers` removed

`sockjs_disable` removed

`secret` renamed to `token_hmac_secret_key`

`history_lifetime` renamed to `history_ttl`

`history_recover` renamed to `recover`

`client_presence_ping_interval` renamed to `client_presence_update_interval`

`client_ping_interval` renamed to `websocket_ping_interval`

`client_message_write_timeout` renamed to `websocket_write_timeout`

`client_request_max_size` renamed to `websocket_message_size_limit`

`client_presence_expire_interval` renamed to `presence_ttl`

`memory_history_meta_ttl` renamed to `history_meta_ttl`

`redis_history_meta_ttl` renamed to `history_meta_ttl`

`redis_sequence_ttl` renamed to `history_meta_ttl`

`redis_presence_ttl` renamed to `presence_ttl`

`presence_ttl` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`websocket_write_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`websocket_ping_interval` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`client_presence_update_interval` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`history_ttl` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`history_meta_ttl` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`nats_dial_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`nats_write_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`graphite_interval` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`shutdown_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`shutdown_termination_delay` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`proxy_connect_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`proxy_refresh_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`proxy_rpc_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`proxy_subscribe_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`proxy_publish_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`client_expired_close_delay` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`client_expired_sub_close_delay` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`client_stale_close_delay` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`client_channel_position_check_delay` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`node_info_metrics_aggregate_interval` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`websocket_ping_interval` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`websocket_write_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`sockjs_heartbeat_delay` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`redis_idle_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`redis_connect_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`redis_read_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`redis_write_timeout` should be converted to [duration](../server/configuration.md#setting-time-duration-options)

`redis_cluster_addrs` renamed to `redis_cluster_address`

`redis_sentinels` renamed to `redis_sentinel_address`

`redis_master_name` renamed to `redis_sentinel_master_name`

### v2 to v3 config converter

Here is a converter between Centrifugo v2 and v3 JSON configuration. It can help to translate most of the things automatically for you.

If you are using Centrifugo with TOML format then you can use [online converter](https://pseitz.github.io/toml-to-json-online-converter/) as initial step. Or [yaml-to-json](https://jsonformatter.org/yaml-to-json) and [json-to-yaml](https://jsonformatter.org/json-to-yaml) for YAML.

:::tip

It's fully client-side: your data won't be sent anywhere.

:::

:::danger

Unfortunately, we can't migrate environment variables and command-line flags automatically - so if you are using env vars or command-line flags to configure Centrifugo you still need to migrate manually. Also, be aware: this converter tool is the best effort only – we can not guarantee it solves all corner cases, especially in Redis configuration. You may still need to fix some things manually, for example - properly fill `allowed_origins`.

:::

import ConfigConverter from "@site/src/components/converter"

<ConfigConverter />
