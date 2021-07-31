---
id: singleflight
title: Singleflight
---

Centrifugo PRO provides an additional boolean option `use_singleflight` (default `false`). When this option enabled Centrifugo will automatically try to merge identical requests to history, presence or presence stats issued at the same time into one real network request.

This option can radically reduce a load on a broker in the following situations:

* Many clients subscribed to the same channel and in case of massive reconnect scenario try to access history simulteniously to restore a state (whether manually using history API or over automatic recovery feature)
* Many clients subscribed to the same channel and positioning feature is on so Centrifugo tracks client position
* Many clients subscribed to the same channel and in case of massive reconnect scenario try to call presense or presence stats simulteniously

Using this option only makes sense with remote engine (Redis, KeyDB, Tarantool), it won't provide a benefit in case of using a Memory engine.

To enable:

```json title="config.json"
{
    ...
    "use_singleflight": true
}
```

Or via `CENTRIFUGO_USE_SINGLEFLIGHT` environment variable.
