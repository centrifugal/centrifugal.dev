---
description: "Centrifugo PRO channel state events send occupied and vacated webhooks when subscribers join or leave channels. Requires Redis engine."
id: channel_state_events
sidebar_label: Channel state events
title: Channel state events
---

Centrifugo PRO has a feature to enable channel state event webhooks to be sent to your configured backend endpoint:

* channel `occupied` event - called whenever first subscriber occupies the channel
* channel `vacated` event - called whenever last subscriber leaves the channel

:::info Preview state

This feature is **in the preview state now**. We still need some time before it will be ready for usage in production. But the feature is available for evaluation.

:::

To enable the feature you must use the `redis` engine. Also, only channels with `presence` enabled may deliver channel state notifications. When enabling the channel state proxy, Centrifugo PRO starts using another approach to create Redis keys for presence for namespaces where channel state events are enabled; this is an important implementation detail.

:::caution

When using client-side Redis sharding (multiple Redis shard addresses), changing the number of shards while the system has active state will result in temporary event loss. Some partitions will be routed to different shards after the change, but their data (presence entries, pending vacated events, event streams) remains on the old shards. This leads to missed `vacated` events and orphaned state. The system will recover as clients reconnect and re-establish presence, but channels where all clients have already disconnected will never receive a `vacated` event. If this is acceptable, the change can be made while the system operates. Otherwise, consider using Redis Cluster instead — it handles slot migration transparently and is fully compatible with this feature.

:::

So the minimal config can look like this (`occupied` and `vacated` events for channels in the `chat` namespace will be sent to `channel.proxy.state.endpoint`):

```json title=config.json
{
  "engine": {
    "type": "redis"
  },
  "channel": {
    "proxy": {
      "state": {
        "endpoint": "http://localhost:3000/centrifugo/channel_events"
      }
    },
    "namespaces": [
      {
        "name": "chat",
        "presence": true,
        "state_proxy_enabled": true
      }
    ]
  }
}
```

The proxy endpoint is an extension of [Centrifugo OSS proxy](../server/proxy.md) and supports both HTTP and GRPC transports. For GRPC, use the `grpc://` prefix in the endpoint URL. Proto definitions may be found in the [proxy.proto](https://github.com/centrifugal/centrifugo/blob/master/internal/proxyproto/proxy.proto) file - see `NotifyChannelState` rpc. Example of the payload your backend HTTP request handler will receive:

```json
{
    "events": [
        {"channel": "chat:index", "type": "occupied", "time_ms": 1697206286533, "version": 1697206286533000}
    ]
}
```

The payload may contain a batch of events, that's why `events` is an array – this is important for achieving high event throughput. Your backend must be fast enough to keep up with the events rate and volume, otherwise event queues will grow. Event queues are bounded (`max_queue_length` events per partition, see below) – if too many events are waiting for delivery, the oldest undelivered events are dropped, while new events are still accepted. Centrifugo PRO logs an error and increments the [`centrifugo_channel_state_events_queue_dropped_checks_total`](./observability_enhancements.md#centrifugo_channel_state_events_queue_dropped_checks_total) metric when this happens – it's a signal to make the backend faster, and to sync channel state as described at the end of this page.

Respond with an empty result object, without an `error` object set, to let Centrifugo PRO know that events were processed successfully. If the request to the backend fails or the response contains an `error` object, Centrifugo PRO will retry sending events with exponential backoff and jitter. The same event may occasionally be delivered more than once – for example, after a retry of a request your backend has already processed, or a repeated `vacated` for a channel which is already vacated. Make your handler idempotent: process an event so that receiving it again changes nothing.

Rarely, an older event of a channel may also arrive after a newer one – for example, when your backend handles a request only after Centrifugo PRO timed it out and sent the events again. To apply events in order, use `version`: versions of a channel's events grow over time, also after Redis lost data – as long as the clock of a new Redis primary is not behind the old one's by more than the failover took, which holds for servers with synchronized clocks. With `detect_lost_writes` enabled, the clock of a new primary may be behind by up to 10 minutes more. Keep the version of the last event you applied for each channel, and skip an event whose `version` is not above it. With SQL this is one condition:

```sql
UPDATE channels SET state = $type, version = $version
WHERE name = $channel AND version < $version;
```

Versions are not consecutive: do not expect them to grow by one. During a rolling upgrade from a Centrifugo PRO version without event versions, events may come with `version` 0 – apply those without comparing, and keep the version you stored. A backend which ignores `version` and treats each event as the channel's current state works too: it only sees a repeat or a rare older event as described.

Here is an example of an HTTP handler for processing channel state events using Flask:

```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/centrifugo/channel_events', methods=['POST'])
def channel_events():
    body = request.get_json()
    for event in body.get('events', []):
        channel = event['channel']
        event_type = event['type']
        time_ms = event['time_ms']
        if event_type == 'occupied':
            print(f'Channel {channel} occupied at {time_ms}')
            # First subscriber joined the channel - allocate resources, etc.
        elif event_type == 'vacated':
            print(f'Channel {channel} vacated at {time_ms}')
            # Last subscriber left the channel - clean up resources, etc.
    return jsonify({'result': {}})

if __name__ == '__main__':
    app.run(port=3000)
```

When the last subscriber leaves a channel, Centrifugo PRO delays the `vacated` event by a configurable interval (default `5s`) before sending it. If a client resubscribes during this interval, the `vacated` event is cancelled. This avoids unnecessary webhooks for quick reconnect scenarios. These are configurable via `channel_state` options. `num_partitions` (default `128`) sets the number of isolated partitions used to serialize channel state events in the system. `max_queue_length` (default `100000`) is the number of events which may wait for delivery per partition: increase it to survive a longer slowdown or outage of your backend without dropping events. `detect_lost_writes` (default `false`) is described below.

:::caution

`num_partitions` must not be changed after the system is already operating with active channels. Changing it alters the channel-to-partition mapping, which means existing state in Redis (presence data, pending vacated events, event streams) becomes orphaned on old partitions. This will result in missed `vacated` events for currently occupied channels and possible spurious `occupied`/`vacated` pairs as clients reconnect. The system will recover as clients reconnect and rebuild presence state, but channels where all clients have already disconnected will never receive a `vacated` event. If this is acceptable, the change can be made while the system operates. Otherwise, plan the value before going to production and keep it fixed.

:::

```json title="config.json"
{
  "engine": {
    "type": "redis",
    "redis": {
      "channel_state": {
        "vacated_event_delay": "10s",
        "max_queue_length": 100000,
        "detect_lost_writes": true,
        "num_partitions": 128
      }
    }
  }
}
```

:::caution

Redis used for channel state events should be configured with `maxmemory-policy noeviction` (or a `volatile-*` policy). The feature relies on several Redis keys without TTL (event streams, pending vacated queues, expiration tracking sets). If Redis evicts these keys under memory pressure, events will be permanently lost — occupied channels may never receive `vacated` events. Consider using a [separate presence manager](../server/engines.md#presence_manager) with a dedicated Redis instance for namespaces with channel state events enabled — this isolates memory usage from the main engine Redis and gives you full control over eviction policy.

:::

For example, to use a dedicated Redis instance for presence with channel state events:

```json title="config.json"
{
  "engine": {
    "type": "redis"
  },
  "presence_manager": {
    "enabled": true,
    "type": "redis",
    "redis": {
      "address": "localhost:6380"
    }
  },
  "channel": {
    "proxy": {
      "state": {
        "endpoint": "http://localhost:3000/centrifugo/channel_events"
      }
    },
    "namespaces": [
      {
        "name": "chat",
        "presence": true,
        "state_proxy_enabled": true
      }
    ]
  }
}
```

When a separate presence manager is enabled, `channel_state` options are read from `presence_manager.redis.channel_state` instead of `engine.redis.channel_state`.

With `detect_lost_writes` enabled, Centrifugo PRO detects that Redis lost data of channel state – after a failover to a replica which missed the latest writes, or a restart without persistence – and sends the current state of the affected channels again: `occupied` for every channel which still has subscribers. Without it, as in earlier versions, such a loss may leave a channel `vacated` for your backend while it has subscribers. The detection needs Redis 7+ or Valkey, with no proxy between Centrifugo and Redis. On other servers, or when the Redis ACL does not permit `SCRIPT LOAD`, nothing is detected and Centrifugo PRO logs a warning at start. Expect repeated `occupied` events after every Redis restart or failover, also a planned one which lost nothing, and sometimes after resharding a Redis Cluster. They are sent gradually, so that your backend is not flooded and other events are not delayed behind them. The option is separate from the Redis engine's [`detect_lost_writes`](../server/engines.md#engineredisdetect_lost_writes), which makes subscribers resync – enable each where you need it.

Centrifugo PRO does the best effort delivering channel state events, making retries when the backend endpoint is unavailable (with exponential backoff), also survives cases when Centrifugo node dies unexpectedly. But there are scenarios when events may be lost — some of them are described above (Redis eviction, configuration changes). Others:

* Your backend falls behind until an event queue is full: the oldest undelivered events are dropped (see the metric above).
* Redis loses data before the events were delivered, or shortly after a channel became empty – a channel may then stay `occupied` for your backend. With `detect_lost_writes`, a channel which has subscribers is always reported `occupied` again; a channel which became empty around the loss may still be missed.
 Even as best-effort notifications, channel state events can be very useful for applications — for example, to lazily clean up resources or update external state when channels become empty. For cases where stronger consistency is required, we recommend periodically syncing state by querying channel presence information using the server API.
