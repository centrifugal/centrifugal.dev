---
id: cache_recovery
sidebar_label: Cache recovery mode 
title: Cache recovery mode
---

Cache recovery mode in channels is designed to quickly deliver the most recent (latest) publication as the first event to the subscriber right after subscription request. This functionality allows Centrifugo channels to behave as a real-time key-value store. The feature is available **since Centrifugo v5.4.0**.

Cache recovery mode works best for channels where every Publication data represents the entire state required to display the real-time element.

Cache recovery mode may eliminate the need for the "fetch initial state" stage in many use cases, reducing server load and application complexity. When a client subscribes to a channel with cache recovery mode, it receives the most recent cached value immediately. Also, on every resubscription (due to network issues for example) the latest publication will be also immediately delivered.

As an example, one of Centrifugo users – [AzuraCast](https://www.azuracast.com/) web radio station server – uses such mode for its `now playing` feature, significantly reducing the load on the backend. As another example, check out [this Twitter/X post](https://x.com/centrifugalabs/status/1790786663884411105).

### Using cache recovery mode

To use cache recovery mode you need to properly configure channel namespace. The following conditions must be met:

* Channels have history configured, in most cases `"history_size": 1` makes the most sense
* Recovery is used, see [history and recovery](./history_and_recovery.md)
* The [force_recovery_mode](./channels.md#force_recovery_mode) string option is set to `cache`

Configuration example:

```json title="config.json"
{
    ..
    "namespaces": [
        {
            "name": "example",
            "force_recovery": true,
            "force_recovery_mode": "cache",
            "history_size": 1,
            "history_ttl": "1h"
        }
    ]
}
```

After that you need to subscribe to a channel and trigger recovery on first connect. With bidirectional SDKs this may be done by providing an empty `since` object when creating a subscription:

```javascript
const sub = centrifuge.newSubscription('example:now-playing-12', {
  since: {}
});

sub.on('publication', (ctx) => {
    console.log(ctx);
})
```

Of course you also need to make sure you properly configured channel permissions. Then after successful subscription client will get latest publication in `publication` event. 

:::caution

Using cache recovery mode may result into indermediary messages being lost and not delivered, only the latest publication in channel is interesting for it.

:::

The rest works very similar to stream recovery described in [history and recovery](./history_and_recovery.md) chapter. If there is an error upon using cache and Centrifugo can't receover state providing latest publication – then `ctx` will contain `recovered: false` flag, and `true` in case of success.

Note, that history has retention TTL set over `history_ttl` option. So in case of retention expired, or maybe in case of restart of Centrifugo node with Memory Engine – the history is cleaned up, so your application should tolerate the missing value in case of insuccessful recovery.

Centrifugo PRO provide a feature to configure channel [cache empty event proxy](../pro/channel_cache_empty.md) to notify your backend about missing publication scenario. So that you can re-populate the channel history with an actual value.

## Conclusion

Cache recovery mode simplifies handling of dynamic data by reducing server requests, ensuring timely updates, and decreasing initial latency.
