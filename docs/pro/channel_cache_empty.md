---
id: channel_cache_empty
sidebar_label: Cache empty events
title: Channel cache empty events
---

Centrifugo PRO can notify the backend when a client subscribes to the channel using [cache recovery mode](../server/cache_recovery.md), but there is no latest publication found in the history stream to load the initial state – i.e. in the case of "cache miss" event. The backend may react to the event and populate the cache by publishing the current state to the channel.

This is done by configuring "cache empty" proxy. It's similar to proxies described in [Proxy events to the backend](../server/proxy.md) chapter, but acts without client connection context – because it's related to a channel in general, and a particular client who triggered the cache miss is not important.

### Cache empty proxy

Add the following options to the configuration file:

```json
{
  ...
  "proxy_cache_empty_endpoint": "http://localhost:3000/centrifugo/cache_empty",
  "proxy_cache_empty_timeout":  "1s"
}
```

– to configure proxy endpoint and timeout.

To actually enable proxy for desired channels you must use `proxy_cache_empty` channel namespace option.

For example, to enable cache empty proxy for channels without namespace define `proxy_cache_empty` boolean flag on a top configuration level:

```json
{
  ...
  "proxy_cache_empty_endpoint": "http://localhost:3000/centrifugo/subscribe",
  "proxy_cache_empty_timeout":  "1s",
  "proxy_cache_empty": true
}
```

Or if you want to use it in the namespace `example`:

```json
{
  ...
  "proxy_cache_empty_endpoint": "http://localhost:3000/centrifugo/subscribe",
  "proxy_cache_empty_timeout":  "1s",
  "namespaces": [{
    "name": "example",
    "proxy_cache_empty": true
  }]
}
```

Payload example sent to app backend in cache empty notification request:

```json
{
  "channel": "example:index"
}
```

Expected response example:

```json
{
    "result": {}
}
```

If cache empty proxy is defined, but Centrifugo can't reach it – then subscription request which triggered the event will be rejected with the internal error.

#### Cache empty request fields

| Field | Type | Required | Description |
| ------------ | -------------- | ------------ | ---- |
| channel         | string     | yes |  A channel in which cache miss occurred         |

#### Cache empty result fields

| Field | Type | Required | Description |
| ------------ | -------------- | ------------ | ---- |
| populated     | boolean     | no | Notify Centrifugo that channel cache was populated by the app backend – in this case Centrifugo will try to recover state one more time   |

#### Options

`proxy_cache_empty_timeout` (duration) config option controls timeout of HTTP POST request sent to app backend. By default `1s`.

:::tip

It's also possible to use cache empty proxy with in [granular proxy mode](../server/proxy.md#granular-proxy-mode). In this case use `cache_empty_proxy_name` namespace option instead of `proxy_cache_empty` to point Centrifugo to the name of proxy to use for the channel namespace.

:::
