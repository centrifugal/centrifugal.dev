---
id: namespace_engines
title: Per-namespace engines
---

Centrifugo OSS allows [specifying an engine](../server/engines.md). Engine is responsible for PUB/SUB and channel stream/history features (we call this part `Broker`), and for online presence (this part is called `Presence Manager`). Engine in Centrifugo OSS is global for the entire Centrifugo setup – once defined, all channels use it to make operations.

Centrifugo PRO allows redefining brokers and presence managers on a namespace level. This may help with individual scaling based on channel activity, using different properties inside different channel namespaces within a single Centrifugo setup. This feature significantly enhances Centrifugo's adaptability, making it easier to meet diverse and evolving application demands.

For example, you can configure Centrifugo to use Redis engine by default, but for some specific namespace use Nats for PUB/SUB – this may be handy if you need wildcard subscriptions for one of the features in the app, or maybe you want to consume from raw Nats topics for some app feature, but for other features you still need functionality implemented by Centrifugo Redis Engine - like history in channels, automatic recovery. Or, maybe you want to separate Redis setups used for broker purposes and online presence purposes.

## Defining brokers

First, you need create configuration for additional brokers:

```json title="config.json"
{
  ...
  "brokers": [
    {
      "enabled": true,
      "name": "mycustomredis",
      "type": "redis",
      "redis": {
        "address": "127.0.0.1:6379"
      }
    },
    {
      "enabled": true,
      "name": "mycustomnats",
      "type": "nats",
      "nats": {
        "url": "nats://localhost:4222"
      }
    }
  ]
}
```

At this point Centrifugo PRO supports two broker types:

* `redis` - inherits all the possibilities of Centrifugo [built-in Redis Engine](../server/engines.md#redis-engine)
* `nats` –  inherits all the possibilities of Centrifugo [integration with Nats broker](../server/engines.md#nats-broker).

These brokers inherit all options described in [Engines and scalability](../server/engines.md) chapter. The only difference that it's possible to specify which custom broker to use inside a channel namespace:

```json title="config.json"
{
  ...
  "namespaces": [
    {
        "name": "rates",
        "broker_name": "mycustomnats"
    }
  ]
```

## Defining presence managers

And for custom Presence Managers a similar approach may be applied. First, define a custom presence manager:

```json title="config.json"
{
  ...
  "presence_managers": [
    {
      "enabled": true,
      "name": "mycustomredis",
      "type": "redis",
      "redis": {}
    }
  ]
}
```

Centrifugo PRO only supports `redis` type of Presence Manager.

And then enable it for namespace:

```json title="config.json"
{
  ...
  "namespaces": [
    {
        "name": "rates",
        "broker_name": "mycustomnats",
        "presence_manager_name": "mycustomredis"
    }
  ]
```
