---
id: bandwidth_optimizations
title: Bandwidth optimizations
---

In high-volume scenarios, bandwidth optimizations can be crucial for reducing network traffic costs and improving performance. Here you can see features of Centrifugo PRO which help optimize bandwidth usage.

## Delta compression for at most once

Centrifugo OSS supports [delta compression](./../server/delta_compression.md) only in channels with recovery and positioning on. To support delta compression for the case when subscribers do not use recovery and positioning Centrifugo PRO provides a boolean namespace option called `keep_latest_publication`. When it's on – Centrifugo saves latest publication in channels to node's memory and uses it to construct delta updates. The publication lives in node's memory while there are active channel subscribers. This allows dealing with at most once guarantee of Broker's PUB/SUB layer and send deltas properly. So you get efficient at most once broadcast and the reduced bandwidth (of course if delta compression makes sense for data in a channel).

All you need to do is enable `keep_latest_publication` for the desired namespace:

```json title="config.json"
{
    "channel": {
        "namespaces": [{
            "name": "example",
            "allowed_delta_types": [
                "fossil"
            ],
            "keep_latest_publication": true
        }]
    }
}
```

Everything else stays the same as described in [delta compression](../server/delta_compression.md) chapter:

* clients need to negotiate delta compression when subscribing
* publishers need to indicate the desire to use delta compression by using API `delta` field, or by using `delta_publish` channel namespace option.

## Channel compaction

:::note

This is a beta feature. We suggest testing it carefully in your environment before using in production.

:::

Channel compaction is a feature that allows reducing the size of messages sent to clients by replacing full channel names with shorter numeric IDs. This can be particularly beneficial in scenarios where channel names are long as it helps to minimize the amount of data transmitted over the network. In protobuf protocol this allows using varint channel identifier type instead of string channel name.

To enable channel compaction, set the `allow_channel_compaction` option to `true` in your Centrifugo configuration for the desired namespace:

```json title="config.json"
{
    "channel": {
        "namespaces": [{
            "name": "example",
            "allow_channel_compaction": true
        }]
    }
}
```

After that client SDKs which support channel compaction will automatically negotiate it during the subscription, no additional steps required.

At this moment only JavaScript SDK (`centrifuge-js`) supports this feature (since v5.5.0). Centrifugo PRO supports this since v6.5.0.

## Drop intermediary publications

Another optimization related to bandwidth is the ability to drop intermediary publications in channels using [Message batching control](./client_msg_batching.md) features of Centrifugo PRO. Specifically, see [batch_flush_latest](./client_msg_batching.md#batch_flush_latest) option.
