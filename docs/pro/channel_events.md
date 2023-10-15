---
id: channel_state_events
sidebar_label: Channel state events
title: Channel state events
---

Centrifugo PRO has a feature to enable channel state event webhooks to be sent to your configured backend endpoint:

* channel `occupied` event - called whenever first subscriber occipies the channel
* channel `vacated` event - called whenever last subscriber leaves the channel

:::info Preview state

This feature is **in the preview state now**. We still need some time before it will be ready for usage in production. But starting from Centrifugo PRO v5.1.1 the feature is avalable for evaluation.

:::

To enable the feature you must use `redis` engine. Also, only channels with `presence` enabled and `channel_state_events` explicitly configured may deliver channel state notifications. When enabling channel state proxy Centrifugo PRO starts using another approach to create Redis keys for presence for namespaces where channel state events enabled, this is an important implementation detail.

So the minimal config can look like this (`occupied` and `vacated` events for channels in `chat` namespace will be sent to `proxy_channel_state_endpoint`):

```json title=config.json
{
    ...
    "engine": "redis",
    "proxy_channel_state_endpoint": "http://localhost:3000/centrifugo/channel_events",
    "namespaces": [
        {
            "name": "chat",
            "presence": true,
            "channel_state_events": ["occupied", "vacated"]
        }
    ]
}
```

The proxy endpoint is an extension of [Centrifugo OSS proxy](../server/proxy.md) and proto definitions may be found in the same [proxy.proto](https://github.com/centrifugal/centrifugo/blob/master/internal/proxyproto/proxy.proto) file - see `NotifyChannelState` rpc. Example of the payload your backend request handler will receive:

```json
{
    "events": [
        {"channel": "chat:index", "type": "occupied", "time_ms": 1697206286533},
    ]
}
```

Payload may contain a batch of events, that's why `events` is an array – this is important for achieving a high event throughput. Your backend must be fast enough to keep up with the events rate and volume, otherwise event queues will grow and eventually new events will be dropped by Centrifugo PRO.

Respond with empty object without `error` set to let Centrifugo PRO know that events were processed successfully.

If last channel client resubscribes to a channel fast (during 5 secs) – then Centrifugo PRO won't send `vacated` events. If client does not resubscribe during 5 secs - event will be sent. So `vacated` events always delivered with a delay. This is implemented in such way to avoid unnecessary webhooks for quick reconnect scenarios.

Centrifugo PRO does the best effort delivering channel state events, making retries when the backend endpoint is unavailable (with exponential backoff), also survives cases when Centrifugo node dies unexpectedly. But there are rare scenarios, when notifications may be lost – like when data lost in Redis. For such cases we recommend syncing the state periodically looking at channel presence information using server API – this depends on the use case though.
