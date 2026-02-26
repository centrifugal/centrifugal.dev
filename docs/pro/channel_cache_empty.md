---
id: channel_cache_empty
sidebar_label: Cache empty events
title: Channel cache empty events
---

Centrifugo PRO can notify the backend when a client subscribes to the channel using [cache recovery mode](../server/cache_recovery.md), but there is no latest publication found in the history stream to load the initial state – i.e. in the case of "cache miss" event. The backend may react to the event and populate the cache by publishing the current state to the channel.

This is done by configuring "cache empty" proxy. It's similar to proxies described in [Proxy events to the backend](../server/proxy.md) chapter, but acts without client connection context – because it's related to a channel in general, and a particular client who triggered the cache miss is not important.

### Cache empty proxy

Add the following options to the configuration file:

```json title="config.json"
{
  "channel": {
    "proxy": {
      "cache_empty": {
        "endpoint": "http://localhost:3000/centrifugo/cache_empty",
        "timeout": "1s"
      }
    }
  }
}
```

– to configure proxy endpoint and timeout of cache empty proxy event.

To actually enable proxy for desired channels you must use `cache_empty_proxy_name` channel namespace option and point it to the name of proxy to use, for example `unified` which we just configured. Let's enable for channels without namespace:

For example, to enable cache empty proxy for channels without namespace define `proxy_cache_empty` boolean flag on a top configuration level:

```json title="config.json"
{
  "channel": {
    "proxy": {
      "cache_empty": {
        "endpoint": "http://localhost:3000/centrifugo/cache_empty",
        "timeout": "1s"
      }
    },
    "without_namespace": {
      "cache_empty_proxy_enabled": true
    }
  }
}
```

Or if you want to use it in the namespace `example`:

```json title="config.json"
{
  "channel": {
    "proxy": {
      "cache_empty": {
        "endpoint": "http://localhost:3000/centrifugo/cache_empty",
        "timeout": "1s"
      }
    },
    "namespaces": [{
      "name": "example",
      "cache_empty_proxy_enabled": true
    }]
  }
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

#### CacheEmptyRequest

| Field     | Type     | Required | Description                            |
|-----------|----------|----------|----------------------------------------|
| `channel` | `string` | yes      | A channel in which cache miss occurred |

#### CacheEmptyResult

| Field       | Type      | Required | Description                                                                                                                             |
|-------------|-----------|----------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `populated` | `boolean` | no       | Notify Centrifugo that channel cache was populated by the app backend – in this case Centrifugo will try to recover state one more time |
