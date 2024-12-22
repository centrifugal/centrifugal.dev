---
id: scalability
title: Scalability optimizations
---

Centrifugo PRO comes with several options to reduce load on Engine – specifically on its history and presence API. This may have a positive effect on CPU resource usage on engine side and a positive effect on operation latencies.

## Singleflight

Centrifugo PRO provides an additional boolean option `use_singleflight` (default `false`). When this option enabled Centrifugo will automatically try to merge identical requests to history, online presence or presence stats issued at the same time into one real network request. It will do this by using in-memory component called `singleflight`.

![Singleflight](/img/singleflight.png)

:::tip

While it can seem similar, singleflight is not a cache. It only combines identical parallel requests into one. If requests come one after another – they will be sent separately to the broker or presence storage.

:::

This option can radically reduce a load on a broker in the following situations:

* Many clients subscribed to the same channel and in case of massive reconnect scenario try to access history simultaneously to restore a state (whether manually using history API or over automatic recovery feature)
* Many clients subscribed to the same channel and positioning feature is on so Centrifugo tracks client position
* Many clients subscribed to the same channel and in case of massive reconnect scenario try to call presence or presence stats simultaneously

Using this option only makes sense with remote engine (such as Redis), it won't provide a benefit in case of using a Memory engine.

To enable:

```json title="config.json"
{
  "singleflight": {
    "enabled": true
  }
}
```

Or via `CENTRIFUGO_USE_SINGLEFLIGHT` environment variable.

## Shared position sync

Shared position synchronization feature allows reducing the load on the broker from position synchronization requests in channels with many subscribers and positioning/recovery enabled.

Centrifugo uses periodic position synchronization requests to make sure there was no message loss between Engine PUB/SUB and Centrifugo. These requests create additional load on broker.

When `shared_position_sync` is enabled subscribers use an intermediary cache to only send position requests to the broker if another channel subscriber have not done it recently. So the benefit here is proportional to the number of channel subscribers on Centrifugo node.

To enable in the specific channel namespace use boolean channel option `shared_position_sync`:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "example",
        "force_recovery": true,
        "shared_position_sync": true
      }
    ]
  }
}
```

## Redis Cluster sharded PUB/SUB

TBD

## Leverage Redis replicas

TBD
