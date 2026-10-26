---
description: "Reduce network traffic costs with Centrifugo PRO bandwidth optimizations including dictionary compression, delta compression for at most once delivery and channel compaction."
id: bandwidth_optimizations
title: Bandwidth optimizations
---

In high-volume scenarios, bandwidth optimizations can be crucial for reducing network traffic costs and improving performance. Here you can see features of Centrifugo PRO which help optimize bandwidth usage.

This page covers five features. The first three make each message smaller; the last two reduce how many messages there are.

| feature | what it does |
|---|---|
| [Delta compression for at most once](#delta-compression-for-at-most-once) | sends what changed since the previous publication, without requiring recovery |
| [Channel compaction](#channel-compaction) | replaces channel names in messages with short numeric ids |
| [Dictionary compression](#dictionary-compression) | compresses every message against a dictionary trained on your traffic |
| [Client publish debouncing](#client-publish-debouncing) | coalesces bursts of publications coming from a client |
| [Drop intermediary publications](#drop-intermediary-publications) | keeps only the newest publication for a subscriber that fell behind |

If you are deciding between the compression options rather than reading about them one by one, skip to [which compression to use](#which-compression-to-use-measured-cost-and-benefit) at the end — it compares them on measured CPU, memory and bandwidth.

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

After that, client SDKs which support channel compaction will automatically negotiate it during the subscription; no additional steps are required.

Channel compaction is supported by the official SDKs — see the [client SDK feature matrix](../transports/client_sdk.md). `centrifuge-js` has it since v5.5.0. Centrifugo PRO supports it since v6.5.0. An SDK that does not negotiate it simply keeps receiving channel names, so a mixed fleet needs no coordination.

## Dictionary compression

:::caution Experimental

Dictionary compression is an experimental feature. Configuration options, admin API, and client SDK behaviour may change in future releases. On the client side it currently requires `centrifuge-js` or `centrifuge-go`.

:::

Real-time applications send small messages, often. Compressing each one on its own finds little to work with — there is barely any repetition *inside* a single message — while the repetition *between* messages is large, since they share field names, the protocol envelope, and often a handful of values. On WebSocket connections the usual answer is the `permessage-deflate` extension, which has exactly this weakness.

Dictionary compression gives the compressor that shared context up front. Centrifugo PRO trains a dictionary from real connections, sends it to a client once, and compresses every frame against it. There are three levels, in increasing order of what they ask of you:

| level | what it costs you |
|---|---|
| structure dictionary | one click in the admin UI — a fixed dictionary built from Centrifugo's own protocol, containing none of your data |
| trained on your traffic, shape only | a training session; field names and nesting, no values, so nothing to review |
| plus approved values | the same, plus reading a ranked word list |

What each is worth depends on your payloads and your message rate; [the measured comparison](#which-compression-to-use-measured-cost-and-benefit) below puts numbers on it.

Unlike streaming compression, a dictionary costs **no per-connection memory** — every connection shares the same immutable bytes — and one publication is compressed once for all of its subscribers.

The dictionary travels in the **connect reply**. The client caches it under a content hash and sends only that hash next time, so a returning client pays nothing for it. The connect reply itself is never compressed, whether it carries the dictionary or only names it; every frame after it is. So no compressed frame can reach a client that does not yet hold the dictionary, and every frame carries a marker saying which it is. A dictionary is chosen at connect and never changes mid-connection.

**WebSocket only.** A compressed frame is arbitrary bytes, which a WebSocket connection carries natively as a binary message; text-framed transports like SSE would have to re-encode it and give the savings straight back. Connections over other transports are unaffected and stay exactly as they are today.

Both the JSON and Protobuf client protocols are supported, but the data you publish must be JSON. Clients whose SDK does not support the feature receive no dictionary and stay uncompressed, so a mixed fleet is safe.

### Enabling

Dictionary compression needs a PostgreSQL database — profiles, training sessions and dictionaries live there, in the same `database` section other PRO features use.

```json title="config.json"
{
  "dictionary_compression": {
    "enabled": true
  },
  "database": {
    "enabled": true,
    "postgresql": {
      "dsn": "postgres://user:pass@localhost:5432/centrifugo?sslmode=disable"
    }
  }
}
```

Enabling it in the config file makes the feature *available*. Nothing is served until you switch it on in the admin UI, and everything after that is an admin UI operation rather than a config change — dictionaries are created, activated and withdrawn without a deploy or a restart.

The **structure dictionary** is the free level: a fixed dictionary made from Centrifugo's own protocol, with none of your data in it, so there is nothing to review and nothing to disclose. Turning it on is one click.

On a deployment with no profiles yet, the **Compression** page offers **Get started**: one confirmed step that turns serving on, serves the structure dictionary, creates a `default` profile for every connection without one, and starts a shape-only training session for it, 30 minutes unless you choose otherwise. When the session ends, the profile offers the dictionary it made, and nothing trained serves until you activate it.

It is not sent to Protobuf connections. Protobuf messages carry numeric field tags instead of repeated field names, so there is little for this dictionary to match: it measured 1.16x against 1.14x with no dictionary at all, which does not repay the cost of downloading it.

### Profiles

A **profile** groups connections whose traffic looks alike — a page, a screen, a kind of client. Dictionaries are trained and served per profile, never per user or per connection. **One profile is a perfectly good configuration**: create it, mark it the default, and every connection gets its dictionary. Profiles start paying when your populations genuinely differ.

A profile is set explicitly, one of two ways:

1. **Your application**, via a `profile` claim in the connection token, or `profile` in the [connect proxy result](../server/proxy.md#connectresult). Needs a change where connections are authenticated, not in clients, so connections can be classified without a client release.
2. **The client**, passing `profile` in SDK options — but only if the profile exists *and* is marked client-declarable. Needs no server-side change.

A name that matches no configured profile is ignored and the connection is left unclassified, so a client can never invent a profile. Names clients declare that you have not configured show up in the admin UI, which is how typos and untrained populations surface.

Unclassified connections get the structure dictionary — or, if you nominate a **default profile**, that profile's dictionary instead. A mismatched trained dictionary is never worse than the structure one, so the default is a cheap way to cover everything you have not classified. Connections classified into some *other* profile never receive it.

:::caution Client-declarable profiles

A client-declared profile cannot be verified, so anyone who can connect can claim it. That is a legitimate way to run this and needs no server-side change — but the profile's dictionary is then effectively published to your whole deployment. Turning the flag on invalidates the active version and requires re-approval.

:::

### Training

Everything in this section happens in the **admin UI** — there is no configuration to write and no code to deploy. You start a training session over connections you select the same way you do on the **Inspector** page: by user (one user, or anonymous ones), by a channel they are subscribed to, and by profile (one profile, or connections with none). No profile is needed to start, so you can find out what a dictionary would be worth before classifying anything.

You choose a **duration** — between a minute and 24 hours — and whether to **collect values**. The session collects for that long and stops; you can extend or stop it early. Up to 50 connections are sampled across the cluster at once. While it runs it shows what it observed: connections sampled, distinct users, protocols seen, which frame types it did and did not see, payload parse rate, and how many distinct shapes, keys and values it has found. That last group tells you the session is seeing your traffic: once the shape count stops moving, it has seen the message types this traffic produces. Let it reach its deadline anyway, or at least its last quarter, which measures the result (see below).

By default a session keeps **shape only**: field names, nesting and key order, with every value replaced by a placeholder before anything leaves the node. Nothing a user typed can reach a dictionary, so there is nothing to review. Enabling **collect values** additionally proposes values for a human to approve; they are filtered first — a denylist of field names (extendable with `denied_value_names`), shape rules that reject anything token-shaped or outside the allowed length, and channel names, which are never admitted — and what survives is ranked so the valuable entries are read first.

A session spends its **last quarter as a control window**: what it observes there is kept aside and never used to build anything. That held-back traffic is what the build measures against, and it is the difference between a number you can trust and one you cannot — scored against its own contents a dictionary reads 4-5x almost regardless of what is in it, including in the cases where it does worst on the wire.

When collection ends, opening the session builds its candidates. Building does the search an operator would otherwise do by hand: it builds a dictionary at every size on the ladder and at several cut-offs down the ranked value list, measures each against the control window, and comes back with a **recommended size and a selection already ticked** — the smallest dictionary within a couple of percent of the best measured ratio, and the selection that achieved it there. A session stopped before its control window has nothing to measure against: its ratios are projected, and the recommended selection is simply the values that fit.

That selection is exactly what the dictionary will hold. A dictionary fills to its budget and stops, so a longer list of approved values does not make a bigger dictionary — it makes the same dictionary out of better material, until the budget runs out and the remainder is simply left over. Values approved but not held are the worst of both: disclosed to everyone the profile reaches, and contributing nothing. So the build settles on the set that actually lands, and the review screen ranks it so the values carrying the saving are the ones you read first.

The size is chosen at the top of the review screen rather than after it, because it decides how many values are worth approving: change the size and the ticked selection follows it to the one measured there. Every rung shows what it was measured at, how many values it holds and what a cold connect pays for it, and the recommended rung is marked.

Your job in review is the part no machine can do: untick anything that should not be shown to everyone this profile reaches. As you edit, the panel measures what you have ticked and shows the dictionary you would get — its size, how much it saves, what a new connection pays to download it, and how many of your ticked values actually fit inside it.

Pay attention to that last number. A dictionary fills up and stops, so a value that does not fit still counts as approved — and therefore disclosed — without ever being used. Centrifugo never recommends such a value, and the panel warns you if your own choices include one.

Then create the version for its profile, which is preselected when the session was started for one, and activate it, in the same step or later from the profile — optionally staged to a percentage of new connections, split by user so a client keeps its side of the split across reconnects. Two dictionaries are generated from every approved vocabulary, one for JSON and one for Protobuf, and they activate together. Building does not replace what it built before: an operator halfway through a review can rebuild without losing their decisions, and the newest set is marked current. Retraining is starting another session over the same connections — **Retrain** on the profile fills one in from the session its dictionary came from; nothing activates on its own, so a dictionary only ever changes when an operator says so.

### Withdrawal and monitoring

Deactivating a version drops that profile back to the structure dictionary — immediately for new connections, on reconnect for existing ones. Deactivating the structure dictionary as well turns the feature off entirely.

:::caution

Withdrawal stops distribution; it cannot un-disclose. Every client that already received a dictionary has its contents. Approving a vocabulary is a one-way door, and the remedy for a value that should not have been approved is upstream — rotate the credential, invalidate the identifier.

:::

The admin UI reports results per **dictionary**, not per profile — one row for each dictionary a profile is actually serving. A profile usually serves more than one at a time: connections left out of a staged rollout still hold the structure dictionary, and a version you have just replaced stays with the connections holding it until they reconnect. Averaging those together would give you a number that describes nothing.

Each row shows:

* **new versus returning connections** — how many arrived already holding the dictionary. This should settle towards returning; those connections pay nothing to receive it.
* **what it is actually saving**, next to what it was measured to save when you approved it. The measured ratio comes from traffic the dictionary was not built from, compressed one message at a time. Live traffic usually does better, because messages sent to a connection together are compressed together. Treat the measured ratio as a floor: live falling below it means your messages changed and it is time to retrain. A dictionary from a session stopped before its control window has no measured ratio and reads *not measured*.
* **bytes saved**, after subtracting the cost of sending the dictionary out.
* **how often a compressed message was reused** instead of being compressed again.

The same figures are available as Prometheus metrics.

### Configuration

| Option | Default | Description |
|---|---|---|
| `enabled` | `false` | Make the feature available on this node. Requires `database`. |
| `frame_cache_size` | `1024` | Compressed frames cached per dictionary. Compressing a frame costs far more than sending it, so this is what makes fan-out viable: subscribers holding the same dictionary share one compression. |
| `max_live_codecs` | `32` | How many compression codecs a node keeps built at once, across all dictionaries. A codec holds a preset dictionary in its window, so this bounds the memory the feature can occupy however many dictionaries are served. |
| `max_sampled_connections` | `50` | Fleet-wide cap on connections a training session observes at once. |
| `frame_budget_per_second` | `14000` | Upper bound on frames a node extracts per second while training, shared across concurrent sessions. Exceeding it lowers the sample size rather than the fidelity. |
| `size_ladder_bytes` | `[512, 2048, 4096, 8192, 16384]` | Dictionary sizes built and scored during a build, so the size curve shows what each one buys. |
| `snapshot_poll_interval` | `"20s"` | How often nodes poll the database for activation changes. Activating, deactivating or editing a profile also nudges every node immediately, so this is a backstop rather than the usual path. |
| `flush_interval` | `"5s"` | How often a node writes what it observed during a training session to the database. Jittered per node. |
| `maintenance_interval` | `"60s"` | How often a node re-checks that sampled connections still match the session filter and rotates a fraction of them. |
| `max_concurrent_sessions` | `3` | How many training sessions may collect at once. They share the frame budget. |
| `candidate_ttl` | `"168h"` | How long an unused candidate is kept before deletion. The per-node reports it was built from are cleared on the same schedule. |
| `denied_value_names` | `[]` | Extra field names never admitted as values, on top of the built-in denylist. |

Everything else — profiles, sessions, review, activation — is managed in the admin UI and stored in the database, so it survives restarts and applies across the cluster.

### Limitations

* **Application payloads must be JSON.** Binary, Protobuf-encoded or encrypted `data` cannot be learned from: a session counts and skips those payloads rather than failing, and reports a parse rate per channel — a low rate is how you find out this traffic will not benefit. The structure dictionary still works for those profiles.
* **No structure dictionary for Protobuf connections**, as described above.
* **Channel names are never put into a dictionary**, since they routinely carry a user or room id. If channel names dominate your frames, [channel compaction](#channel-compaction) removes them from the wire instead — the two features are complementary.
* **WebSocket connections only.** Other transports are unaffected.
* **Client SDK support** is limited to `centrifuge-js` and `centrifuge-go` at the moment.

## Client publish debouncing

:::info SDK support

At this moment, client publish debouncing is only supported by `centrifuge-js`. See the [SDK feature matrix](/docs/transports/client_sdk#sdk-feature-matrix) for the current status.

:::

Debouncing reduces upstream traffic by coalescing rapid client publishes to the same channel. When configured, the server returns the debounce interval in the subscribe result — the client SDK holds back subsequent publishes locally, sending only the latest value after the interval expires.

The `client_publish_debounce_interval` namespace option controls the debounce interval. The server includes this value in the subscribe result. The debounce is applied when publishing via the subscription object — `sub.publish(data)` on a stream subscription and `sub.publish(key, data)` on a map subscription.

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "cursors",
        "client_publish_debounce_interval": "50ms"
      }
    ]
  }
}
```

Behavior:

- The first publish is never debounced — it goes through immediately
- Subsequent publishes within the debounce window are held locally in the SDK — only the latest value is kept
- When the timer fires, the SDK sends the latest pending value to the server
- For map subscriptions, debouncing is per key — different keys are debounced independently
- For stream subscriptions, debouncing is per channel
- On unsubscribe or disconnect, the SDK drops all pending publishes — nothing to clean up on the server
- From the application's perspective, every `publish()` call resolves immediately

:::info Fire-and-forget only

Client publish debouncing is designed for ephemeral, fire-and-forget data — cursor positions, typing indicators, sensor readings. Pending data is lost on disconnect or unsubscribe. Do not use debouncing for data that must reliably reach the server.

:::

## Drop intermediary publications

Another optimization related to bandwidth is the ability to drop intermediary publications in channels using [Message batching control](./client_msg_batching.md) features of Centrifugo PRO. Specifically, see [batch_flush_latest](./client_msg_batching.md#batch_flush_latest) option.

## Which compression to use: measured cost and benefit

Three things make messages smaller:

* **`permessage-deflate`** — the standard WebSocket compression extension, available in Centrifugo OSS via [`websocket.compression`](../transports/websocket.md#websocketcompression). Every browser supports it. It compresses each message on its own, with no memory of the messages before it.
* **[Dictionary compression](#dictionary-compression)** — compresses each message against a dictionary of your own traffic, so the repeated parts of your messages are already known and cost almost nothing to send.
* **[Channel compaction](#channel-compaction)** — replaces the channel name in each message with a short number.

The first two do the same job, so you pick one. Compaction works alongside either.

:::note Why delta compression is not in this comparison

[Delta compression](#delta-compression-for-at-most-once) answers a different question. It sends only what changed since the previous publication, so it helps when consecutive messages in a channel resemble each other, and it is enabled per channel rather than for everything a connection receives. If that describes your traffic it stacks with anything below.

:::

We measured all of them on a 16-core Linux server, sending JSON:

* **Connections that aren't receiving anything cost nothing.** With 2 000 and 8 000 idle connections, every option measured the same as no compression. Turning compression on does not tax connections that are sitting quiet.
* **What you send decides how much you save.** On a structured JSON feed a dictionary cut traffic 7.5x, where `permessage-deflate` managed 2.5x. On 49-byte messages it was 2.6x against 1.8x.
* **How many subscribers share a channel decides the CPU.** With a handful of subscribers per channel a dictionary used 1.8x the CPU of no compression. With 500 subscribers on one channel it used 1.05x — practically free — because the message is compressed once and the result is reused for everyone.

To put those multiples in absolute terms: on this 16-core server, 2 000 connections receiving 4 messages a second used **0.58 of one core** with no compression and **1.05 cores** with a dictionary. The multiples below are all against numbers of that size, so "1.8x the CPU" is half a core, not half a server.

Putting that together:

| your situation | what to use |
|---|---|
| you pay for outbound traffic, and your messages are JSON with repeating fields | **dictionary compression**, plus channel compaction if your channel names are long |
| CPU is what you are short of | **`permessage-deflate`, with its [prepared message cache](./performance.md#websocket-compression-optimizations) turned on** — cuts traffic by around 60% where a dictionary cuts it by around 87%, for slightly less CPU and nothing to set up |
| messages are small but channel names are long | **channel compaction** first — it costs almost nothing and helps most exactly where compression helps least |
| messages are binary, encrypted or already compact | none of them will help much — try one and measure before committing |
| bandwidth is flat-rate, or traffic stays inside your network | none of them: you would spend CPU to save bytes nobody charges you for |

They also differ in how much work they are to adopt, which no benchmark shows:

* **`permessage-deflate`** is one config option and works with every browser and SDK.
* **Channel compaction** is one namespace option; SDKs that do not support it simply keep receiving channel names.
* **Dictionary compression** needs PostgreSQL, a training session on live traffic, and a person to review the words that go into the dictionary before it is served. It currently works with `centrifuge-js` and `centrifuge-go`; other clients stay uncompressed, which is safe but means a mixed fleet gets mixed results.

### Turning them on

```json title="permessage-deflate (Centrifugo OSS, cache is PRO)"
{
  "websocket": {
    "compression": true,
    "compression_prepared_message_cache_size": 10485760
  }
}
```

```json title="channel compaction, per namespace"
{
  "channel": {
    "namespaces": [{ "name": "example", "allow_channel_compaction": true }]
  }
}
```

```json title="dictionary compression — then train and activate in the admin UI"
{
  "dictionary_compression": { "enabled": true },
  "database": {
    "enabled": true,
    "postgresql": { "dsn": "postgres://user:pass@localhost:5432/centrifugo?sslmode=disable" }
  }
}
```

Whichever you turn on, Centrifugo reports what it actually achieved on your traffic rather than leaving you to infer it. `permessage-deflate` and dictionary compression both count bytes in and out per connection, and dictionary compression also reports what each dictionary saved after subtracting the cost of sending it out.

**On Protobuf connections**, `permessage-deflate` and channel compaction work as they do on JSON. Dictionary compression works too, but the payloads you publish must still be JSON for a dictionary to be trained from them — and the free structure dictionary is not served to Protobuf connections, since there are no repeated field names in a Protobuf frame for it to match. The measurements below are all JSON.

### By traffic shape

These runs all send the same message — 652 bytes of JSON from an operations feed, of the kind a dashboard subscribes to:

```json
{
  "event_type": "shipment.status_changed",
  "emitted_at": "2026-08-09T12:00:00Z",
  "shipment": {
    "shipment_id": "SHP-1000003",
    "status": "at_hub",
    "carrier": "northwind_logistics",
    "service_level": "express",
    "progress_percent": 96,
    "exception_reason": "",
    "route": {
      "origin": { "hub_code": "FRA-3", "country": "DE" },
      "destination": { "hub_code": "AMS-1", "country": "NL" },
      "estimated_arrival": "2026-08-11T04:12:00Z"
    },
    "parcel": { "pieces": 3, "weight_kg": 36.8, "temperature": 3.7, "handling": "standard" }
  },
  "metadata": {
    "producer": "tracking-service",
    "version": "4.2.0",
    "region": "ap-southeast-2",
    "environment": "production",
    "sequence": 12345,
    "correlation_id": "996bc002-3031"
  }
}
```

We picked a middle-of-the-road message rather than a flattering one. Field names repeat in every message, and several values come from small sets — `status`, `carrier`, `region`, the hub codes — which is what a dictionary lives on. But each message also carries a fresh timestamp, sequence number and correlation id that nothing can compress. Expect less if your messages have no repeated vocabulary, more if they are more repetitive than this.

Every connection is subscribed to one channel. CPU is measured against the same load with compression off, and so is the saving.

| traffic | scheme | CPU vs none | bytes/msg | ratio |
|---|---|---|---|---|
| **2 000 idle connections**, no traffic | `permessage-deflate` + cache | 1.00x | — | — |
| | dictionary | 0.99x | — | — |
| **2 000 connections, 1 msg/s each**<br/>500 channels, 4 subscribers each → 2 000 msg/s delivered | `permessage-deflate` + cache | 1.37x | 304 B | 2.47x |
| | dictionary | 1.45x | 100 B | **7.49x** |
| | dictionary + channel compaction | 1.42x | 82 B | **9.10x** |
| **2 000 connections, 4 msg/s each**<br/>500 channels, 4 subscribers each → 8 000 msg/s delivered | `permessage-deflate` + cache | 1.65x | 302 B | 2.48x |
| | dictionary | 1.84x | 100 B | **7.50x** |
| | dictionary + channel compaction | 1.81x | 82 B | **9.13x** |
| **2 000 connections, 10 msg/s each**<br/>200 ms write delay, so messages batch → 18 000 msg/s delivered | `permessage-deflate` + cache | 1.69x | 300 B | 2.50x |
| | dictionary | 1.80x | 98 B | **7.64x** |
| | dictionary + channel compaction | 1.77x | 81 B | **9.25x** |
| **500 connections on one channel**<br/>500 msg/s published → 250 000 msg/s delivered | `permessage-deflate` + cache | 1.04x | 147 B | 5.02x |
| | dictionary | 1.05x | 61 B | **12.18x** |
| | dictionary + channel compaction | 1.09x | 55 B | **13.35x** |

Most applications live in the first row: lots of connections, each getting very little. Nothing is being compressed, so nothing is being spent.

The last row is the happiest case. With 500 subscribers on a channel, the dictionary costs about the same CPU as `permessage-deflate` but saves more than twice as much, because the message is compressed once and reused for everyone.

In between, a dictionary costs roughly 10-20% more CPU than `permessage-deflate` and saves three times as much. Note that at 1-4 messages per second per channel, a write delay doesn't batch anything — the next message is never waiting when the current one goes out — so each frame carries a single message. That is the hardest case for ordinary compression, and the one a dictionary is designed for.

#### The one-off cost of a dictionary

A dictionary has to reach the client before it can be used. In these runs that was **2.3 KB, once per connection** — after which the client caches it and reconnects cost nothing, even across restarts, because it is identified by its content.

At roughly 650 bytes saved per message, that download pays for itself after about four messages. So it only becomes a problem with very short-lived connections — a client that reconnects every few seconds to receive a single message will spend more than it saves. `permessage-deflate` has no such cost, and this is the one place where it clearly wins.

The admin UI reports this directly, as the split between new and returning connections and as bytes saved after subtracting downloads.

### By payload

All with 2 000 connections receiving 4 messages a second each, so only the message content differs. The four shapes:

* **operations feed** — the 652-byte message above.
* **telemetry** — 257 bytes, almost all numbers: `{"device_id":"dev-0016","metrics":{"cpu_percent":27.3,"memory_bytes":559139331,...},"healthy":true}`. Field names repeat, values almost never do.
* **chat prose** — 308 bytes dominated by a sentence of free text, with a room and author around it.
* **tiny** — 49 bytes: `{"t":1770000000000000000,"v":466,"s":"picked_up"}`. Barely bigger than the frame around it.

| payload | `permessage-deflate` + cache | dictionary | dictionary + compaction |
|---|---|---|---|
| operations feed (652 B, structured) | 2.47x | **7.52x** | 9.12x |
| telemetry (257 B, mostly numbers) | 2.03x | **3.66x** | 4.73x |
| chat prose (308 B) | 2.06x | **3.47x** | 4.22x |
| tiny (49 B) | 1.79x | **2.55x** | 4.00x |

A dictionary helps most when your messages share field names and repeat the same values, and least when they are short or every message is genuinely different.

Channel compaction works the other way round. It removes the channel name from every message, which is a fixed number of bytes, so it matters most when the message itself is small — on tiny messages it saved 1.57x on its own, and took the dictionary from 2.55x to 4.00x. Its own CPU cost was too small to measure.

### Memory

Compression needs memory for two things: a working buffer while it compresses a message, and whatever it keeps between messages.

The working buffer is about 1 MB. Buffers get reused — one is borrowed to compress a message and handed straight back — so the memory in use at any moment tracks how many messages are being compressed at that instant, roughly the number of CPUs doing the work. It has nothing to do with how many connections you have: 2 000 idle connections use no buffers at all.

Incidentally, `permessage-deflate` uses a slightly bigger buffer than a dictionary does (about 1.2 MB against 0.8 MB), so a dictionary is the lighter of the two here.

What each keeps between messages:

| | size | grows with |
|---|---|---|
| the dictionary itself | 16 KB, shared by every connection using it | nothing |
| dictionary's cache of recently compressed messages | about 0.4 MB by default ([`frame_cache_size`](#configuration)) | nothing — it holds a fixed number of messages |
| `permessage-deflate`'s [prepared message cache](./performance.md#websocket-compression-optimizations) | whatever budget you give it, e.g. 10 MB | how many *different* messages you send |

Both caches exist for the same reason: when one message goes to many subscribers, you want to compress it once and send the same bytes to everyone. They differ in what they keep. The prepared message cache keeps a compressed copy of each distinct message it has seen lately, so how much it helps depends on how repetitive your traffic is. A dictionary is a single shared copy of your vocabulary, and its size never changes with your traffic.

The dictionary used less memory than `permessage-deflate` in every case we measured, while compressing three times as hard:

| traffic | `permessage-deflate` + cache | dictionary |
|---|---|---|
| 1 msg/s per channel | 87 MB | 82 MB |
| 4 msg/s per channel | 116 MB | 88 MB |
| 10 msg/s per channel | 138 MB | 95 MB |
| 500-subscriber fan-out | 93 MB | 72 MB |

And a dictionary does not get more expensive as you add connections, because they all share the same copy of it:

| idle connections | without | with a dictionary | difference |
|---|---|---|---|
| 2 000 | 34 MB | 35 MB | +1 MB |
| 8 000 | 114 MB | 116 MB | +2 MB |

Four times the connections, and the difference barely moved.

### Two settings worth getting right

These two matter more than which feature you pick:

* **If you use `permessage-deflate` and broadcast to many subscribers, turn on the prepared message cache** ([`websocket.compression_prepared_message_cache_size`](./performance.md#websocket-compression-optimizations)). Without it, the same message is compressed again for every single subscriber. With 500 subscribers on a channel that was the difference between 2.4x and 1.04x the CPU, and between 133 MB and 93 MB of memory. Watch the units: the setting is a size in bytes, not a number of messages, so a small value caches almost nothing.
* **Turning up the compression level is not worth much.** Moving `permessage-deflate` from its default level to a much slower one improved the saving from 2.47x to 2.58x while costing more CPU. And the difference between the two features is not about levels: compared at the *same* level, `permessage-deflate` saved 2.58x and a dictionary 7.50x.

:::note How this was measured

An idle 16-core Linux server, with Centrifugo and the load generator running as separate processes on it. Every setting was run three times, alternating between settings rather than finishing one before starting the next, and each result is compared against a no-compression run from the same round. Bytes were counted on the client's socket, so they include everything the network actually carries.

The savings repeated to within 1% between runs; the CPU figures varied by about 5%.

Expect your own numbers to differ — use the tables for the shape of the trade-off, not the exact digits. One case is missing from them: a 500-subscriber broadcast with message batching turned off, where our load generator ran out of capacity before Centrifugo did. Rather than publish a number that measured our test client, we left it out.

:::
