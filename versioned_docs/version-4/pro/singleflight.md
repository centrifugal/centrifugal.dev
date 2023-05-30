---
id: singleflight
title: Singleflight
---

Centrifugo PRO provides an additional boolean option `use_singleflight` (default `false`). When this option enabled Centrifugo will automatically try to merge identical requests to history, online presence or presence stats issued at the same time into one real network request. It will do this by using in-memory component called `singleflight`.

![Singleflight](/img/singleflight.png)

:::tip

While it can seem similar, singleflight is not a cache. It only combines identical parallel requests into one. If requests come one after another – they will be sent separately to the broker or presence storage.

:::

This option can radically reduce a load on a broker in the following situations:

* Many clients subscribed to the same channel and in case of massive reconnect scenario try to access history simultaneously to restore a state (whether manually using history API or over automatic recovery feature)
* Many clients subscribed to the same channel and positioning feature is on so Centrifugo tracks client position
* Many clients subscribed to the same channel and in case of massive reconnect scenario try to call presence or presence stats simultaneously

Using this option only makes sense with remote engine (Redis, KeyDB, Tarantool), it won't provide a benefit in case of using a Memory engine.

To enable:

```json title="config.json"
{
    ...
    "use_singleflight": true
}
```

Or via `CENTRIFUGO_USE_SINGLEFLIGHT` environment variable.
