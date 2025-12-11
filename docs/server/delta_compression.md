---
id: delta_compression
sidebar_label: Delta compression
title: Delta compression in channels
---

Delta compression feature allows a client to subscribe to a channel in a way so that message payloads contain only the differences between the current message and the previous one sent on the channel.

Delta compression is beneficial for channels that send a series of updates to a particular object or document with high similarity between successive publications. A client can apply the delta to the previous message to reconstruct the full payload.

Using delta mode can significantly reduce the size of each message when the differences between successive payloads are small compared to their overall size. This reduction **can lower bandwidth costs**, decrease transit latencies, and increase message throughput on a connection.

![delta frames](/img/delta_abstract.png)

In the scenario we used to evaluate delta compression feature usefullness we were able to achieve x10 reduction of traffic going through the network interface by enabling delta compression in the channel. This heavily depends on the nature of data you publish, but proves that deltas make a perfect sense in some scenarios.

The diff is calculated using [Fossil](https://fossil-scm.org/home/doc/tip/www/delta_format.wiki) delta algorithm. Delta compression via Fossil supports all payloads, whether binary, or JSON-encoded. The delta algorithm processes message payloads as opaque binaries and has no dependency on the structure of the payload.

:::tip

At this point delta compression is only available for bidirectional client-side subscriptions and supported by Centrifugo Javascript SDK [centrifuge-js](https://github.com/centrifugal/centrifuge-js), Java SDK [centrifuge-java](https://github.com/centrifugal/centrifuge-js), Python SDK [centrifuge-python](https://github.com/centrifugal/centrifuge-python). There is also [unfinished PR](https://github.com/centrifugal/centrifuge-swift/pull/104) to Swift SDK. See also [SDK feature matrix](../transports/client_sdk.md#sdk-feature-matrix).

:::

Deltas apply only to the `data` property of a Publication. Publications retrieved via history calls are not compressed – delta applied only for clent protocol publications travelling to real-time connections.

How it may look in practice? Here is a screenshot of WebSocket frames in case of using our JSON protocol format. Note that the connection receives publication push with full payload first, then only deltas are sent which are much smaller in size:

![delta frames](/img/delta_frames.png)

### Subscribe using delta

To successfully negotiate delta compression for a subscriber several conditions should be met:

* subscriber provides `delta: "fossil"` option when creating a client-side Subscription
* server uses `"allowed_delta_types": ["fossil"]` for a channel namespace a client subscribes to
* server uses history for a channel
* positioning or recovery are used for channel subscription

Example of subscription creation on the client side:

```javascript
const sub = centrifuge.newSubscription('example:updates', {
  delta: 'fossil'
});
```

And the example of Centrifugo configuration:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "example",
        "allowed_delta_types": [
          "fossil"
        ],
        "force_positioning": true,
        "history_size": 1,
        "history_ttl": "60s"
      }
    ]
  }
}
```

:::tip

If you want to use delta compression without history, positioning and recovery on, i.e. in at most once scenario – then Centrifugo PRO [provides such a possibility](../pro/delta_at_most_once.md) with its option to keep latest publication in channel in the node's memory.

:::

If all conditions met – subscriber will negotiate compression with a server. If SDK does not support delta compression – it can still subscribe to the channel, but will receive publications with full payload. To let Centrifugo know that delta compression must be used for a particular publication some configuration is required for the publisher also. We will describe it shortly.

### Use delta when publishing

If subscriber successfully negotiated delta compression with Centrifugo, it will start receiving deltas for publications marked with delta flag by the publisher. It's possible to mark channel publications to use delta compression upon broadcasting to subscribers in the following ways:

* enable it for all publications in the channel namespace by setting a boolean channel option [delta_publish](./channels.md#delta_publish)
* `delta` flag may be set on a per call basis (in publish or broadcast server APIs). For example, see `delta` field in [publish request](./server_api.md#publishrequest) description.

For example, this means that to automatically use delta calculation for all publications in the namespace the configuration example above evolves to:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "example",
        "allowed_delta_types": [
          "fossil"
        ],
        "force_positioning": true,
        "history_size": 1,
        "history_ttl": "60s",
        "delta_publish": true
      }
    ]
  }
}
```

Again – subscribers which support delta compression and do not support it can co-exist in one channel.

### Example and further reading

* [Delta compression example](https://github.com/centrifugal/examples/tree/master/v6/delta_compression) - just `docker compose up` and then open https://localhost:8080
* [Delta compression in Centrifugo PRO](../pro/bandwidth_optimizations.md#delta-compression-for-at-most-once) – allows using delta compression in at most once scenario.
* Blog post [Experimenting with real-time data compression by simulating a football match events](/blog/2024/05/30/real-time-data-compression-experiments) showcases benefits which could be achieved with delta compression.
