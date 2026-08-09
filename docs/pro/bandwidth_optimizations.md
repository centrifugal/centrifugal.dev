---
description: "Reduce network traffic costs with Centrifugo PRO bandwidth optimizations including dictionary compression, delta compression for at most once delivery and channel compaction."
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

After that, client SDKs which support channel compaction will automatically negotiate it during the subscription; no additional steps are required.

Channel compaction is supported by the official SDKs — see the [client SDK feature matrix](../transports/client_sdk.md). `centrifuge-js` has it since v5.5.0. Centrifugo PRO supports it since v6.5.0. An SDK that does not negotiate it simply keeps receiving channel names, so a mixed fleet needs no coordination.

## Dictionary compression

:::caution Experimental

Dictionary compression is an experimental feature. Configuration options, admin API, and client SDK behaviour may change in future releases. On the client side it currently requires `centrifuge-js` or `centrifuge-go`.

:::

Real-time applications send small messages, often. Compressing each one on its own finds little to work with — there is barely any repetition *inside* a single message — while the repetition *between* messages is large, since they share field names, the protocol envelope, and often a handful of values. On WebSocket connections the usual answer is the `permessage-deflate` extension, which has exactly this weakness.

Dictionary compression gives the compressor that shared context up front. Centrifugo PRO trains a dictionary from real connections, sends it to a client once, and compresses every frame against it. There are three tiers, in increasing order of what they ask of you:

| tier | what it costs you |
|---|---|
| structure dictionary | one click in the admin UI — a fixed artifact holding the protocol envelope, no application data |
| trained on your traffic, shape only | a training session; field names and nesting, no values, so nothing to review |
| plus approved values | the same, plus reading a ranked word list |

What each is worth depends on your payloads and your message rate; [the measured comparison](#which-compression-to-use-measured-cost-and-benefit) below puts numbers on it.

Unlike streaming compression, a dictionary costs **no per-connection memory** — every connection shares the same immutable bytes — and one publication is compressed once for all of its subscribers.

The dictionary travels in the **connect reply**. The client caches it under a content hash and sends only that hash next time, so a returning client pays nothing for it — and since both sides already hold the bytes, that connection's connect reply is compressed too. A client receiving a dictionary for the first time has one uncompressed frame, the reply carrying it; everything after that is compressed. Either way no compressed frame can reach a client that does not yet hold the dictionary, and every frame carries a marker saying which it is. A dictionary is chosen at connect and never changes mid-connection.

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

The **structure dictionary** is the free tier: a fixed artifact holding the Centrifugo protocol envelope and no application data, so there is nothing to review. Turning it on is one click. It is not served to Protobuf connections — that envelope is field tags rather than repeated key strings, where a structure dictionary measured 1.16x against 1.14x for no dictionary at all, which does not pay for its own delivery.

### Profiles

A **profile** groups connections whose traffic looks alike — a page, a screen, a kind of client. Dictionaries are trained and served per profile, never per user or per connection. **One profile is a perfectly good configuration**: create it, mark it the default, and every connection gets its dictionary. Profiles start paying when your populations genuinely differ.

A profile is set explicitly, one of two ways:

1. **Your application**, via a `profile` claim in the connection token, read in `OnConnecting`. Needs a change where tokens are issued.
2. **The client**, passing `profile` in SDK options — but only if the profile exists *and* is marked client-declarable. Needs no server-side change.

A name that matches no configured profile is ignored and the connection is left unclassified, so a client can never invent a profile. Names clients declare that you have not configured show up in the admin UI, which is how typos and untrained populations surface.

Unclassified connections get the structure dictionary — or, if you nominate a **default profile**, that profile's dictionary instead. A mismatched trained dictionary is never worse than the structure one, so the default is a cheap way to cover everything you have not classified. Connections classified into some *other* profile never receive it.

:::caution Client-declarable profiles

A client-declared profile cannot be verified, so anyone who can connect can claim it. That is a legitimate way to run this and needs no server-side change — but the profile's dictionary is then effectively published to your whole deployment. Turning the flag on invalidates the active version and requires re-approval.

:::

### Training

Everything in this section happens in the **admin UI** — there is no configuration to write and no code to deploy. You start a training session over connections you select the same way you do on the **Inspector** page: by channel, user, labels or client name. No profile is needed to start, so you can find out what a dictionary would be worth before classifying anything.

You choose a **duration** — between a minute and 24 hours — and whether to **collect values**. The session collects for that long and stops; you can extend or stop it early. Up to 50 connections are sampled across the cluster at once. While it runs it shows what it observed: connections sampled, distinct users, protocols seen, which frame types it did and did not see, payload parse rate, and how many distinct shapes, keys and values it has found. That last group is what tells you when to stop — once the shape count stops moving, the session has seen the message types this traffic produces and longer mostly adds repetition.

By default a session keeps **shape only**: field names, nesting and key order, with every value replaced by a placeholder before anything leaves the node. Nothing a user typed can reach a dictionary, so there is nothing to review. Enabling **collect values** additionally proposes values for a human to approve; they are filtered first — a denylist of field names (extendable with `denied_value_names`), shape rules that reject anything token-shaped or outside the allowed length, and channel names, which are never admitted — and what survives is ranked so the valuable entries are read first.

A session spends its **last quarter as a control window**: what it observes there is kept aside and never used to build anything. That held-back traffic is what the build measures against, and it is the difference between a number you can trust and one you cannot — scored against its own contents a dictionary reads 4-5x almost regardless of what is in it, including in the cases where it does worst on the wire.

When collection ends nothing happens until you ask. Building a candidate does the search an operator would otherwise do by hand: it builds a dictionary at every size on the ladder and at several cut-offs down the ranked value list, measures each against the control window, and comes back with a **recommended size and a selection already ticked** — the smallest dictionary within a couple of percent of the best measured ratio, and the selection that achieved it there.

That selection is exactly what the dictionary will hold. A dictionary fills to its budget and stops, so a longer list of approved values does not make a bigger dictionary — it makes the same dictionary out of better material, until the budget runs out and the remainder is simply left over. Values approved but not held are the worst of both: disclosed to everyone the profile reaches, and contributing nothing. So the build settles on the set that actually lands, and the review screen ranks it so the values carrying the saving are the ones you read first.

The size is chosen at the top of the review screen rather than after it, because it decides how many values are worth approving: change the size and the ticked selection follows it to the one measured there. Every rung shows what it was measured at, how many values it holds and what a cold connect pays for it, and the recommended rung is marked.

Your job in review is the one a machine cannot do: untick anything that should not be disclosed to this profile's audience. The panel measures your selection as you edit it — the dictionary you would get, its ratio, its cold-connect cost, and how many of your ticked values the artifact actually has room for. That last number matters: a value that does not fit is disclosed as an approved decision and buys nothing, so the recommendation never proposes one, and the panel says plainly when your own selection does.

Then pick a destination profile and activate — optionally staged to a percentage of new connections, split by user so a client keeps its side of the split across reconnects. Two dictionaries are generated from every approved vocabulary, one for JSON and one for Protobuf, and they activate together. Building does not replace what it built before: an operator halfway through a review can rebuild without losing their decisions, and the newest set is marked current. Retraining is starting another session over the same connections; nothing activates on its own, so a dictionary only ever changes when an operator says so.

### Withdrawal and monitoring

Deactivating a version drops that profile back to the structure dictionary — immediately for new connections, on reconnect for existing ones. Deactivating the structure dictionary as well turns the feature off entirely.

:::caution

Withdrawal stops distribution; it cannot un-disclose. Every client that already received a dictionary has its contents. Approving a vocabulary is a one-way door, and the remedy for a value that should not have been approved is upstream — rotate the credential, invalidate the identifier.

:::

The admin UI reports delivery per **dictionary**, not per profile: one row for each tier and artifact a profile is really serving. That matters because a profile usually serves more than one at a time — connections outside a staged rollout hold the structure dictionary, and a version you just replaced stays with the connections that hold it until they reconnect. Blending those into a single ratio produces a number comparable with nothing.

Each row carries the **cold/warm connect split** (what fraction of connects arrive with the dictionary already cached — this should settle warm), the **realized ratio** against the ratio that version was approved at (both measured on traffic held back from training, so a growing gap really does mean retrain), **bytes saved** net of delivery cost, and the **frame cache hit rate**. Prometheus exposes the same counters per profile and protocol.

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

## Which compression to use: measured cost and benefit

`permessage-deflate`, dictionary compression and channel compaction all reduce bytes on the wire, and they are not simple alternatives to one another: the first two compress the same frame and are mutually exclusive, while compaction shortens what is in it and combines with either. This section is the measured comparison, so the choice can be made on numbers rather than on intuition.

Two rules of thumb come out of it, and everything else is detail:

* **What you send decides the ratio.** A dictionary is worth 7.6x on a structured operations feed and 2.6x on a tiny payload, against 2.5x and 1.8x for `permessage-deflate`.
* **How often you send decides the cost.** Compression costs nothing on a connection that is not receiving anything, and its CPU multiple *falls* as fan-out widens, because one compressed frame is reused for every subscriber holding the same dictionary.

### By traffic shape

The same operations-feed payload (~600 B of JSON) at the rates real deployments run at. CPU is the server process, relative to the same run with compression off; ratio is wire bytes per delivered message against that same baseline.

| traffic | scheme | CPU vs none | bytes/msg | ratio |
|---|---|---|---|---|
| **2 000 idle connections**, no traffic | `permessage-deflate` + cache | 1.04x | — | — |
| | dictionary | 1.04x | — | — |
| **1 msg/s per channel**<br/>(500 channels, 2 000 conns) | `permessage-deflate` + cache | 1.70x | 303 B | 2.47x |
| | dictionary | 3.56x | 99 B | **7.60x** |
| | dictionary + channel compaction | 3.55x | 81 B | **9.25x** |
| **4 msg/s per channel**<br/>(500 channels, 2 000 conns) | `permessage-deflate` + cache | 1.43x | 304 B | 2.47x |
| | dictionary | 3.03x | 98 B | **7.61x** |
| | dictionary + channel compaction | 3.29x | 81 B | **9.28x** |
| **10 msg/s per channel**<br/>200 ms write delay, so frames batch | `permessage-deflate` + cache | 1.62x | 245 B | 3.06x |
| | dictionary | 2.81x | 86 B | **8.72x** |
| | dictionary + channel compaction | 3.07x | 73 B | **10.24x** |
| **500 msg/s, one channel**<br/>500 subscribers, 10 ms write delay | `permessage-deflate` + cache | 1.44x | 146 B | 5.07x |
| | dictionary | 1.73x | 59 B | **12.53x** |
| | dictionary + channel compaction | 1.19x | 52 B | **14.17x** |

The first row is the one most deployments live in. **Enabling compression on connections that are not receiving messages costs nothing measurable** — 2 000 idle connections came out at 1.04x CPU with a dictionary installed, and 8 000 at 0.99x.

The last row is where the frame cache earns its keep. At a 500-subscriber fan-out the dictionary's CPU multiple drops to 1.73x while its ratio *rises* to 12.5x, because one publication is compressed once and every subscriber holding that dictionary gets the same bytes. Batching helps every scheme for the same reason a dictionary does — a frame holding several publications has repetition inside it — which is why the 10 msg/s row compresses better than the 4 msg/s row for all of them.

At 1–4 msg/s per channel a write delay batches nothing: there is never a second message waiting when the first is written. That is the regime the first three rows measure, and it is where a preset dictionary is worth most relative to `permessage-deflate`, because it is the only one of the two that has any context to work with.

### By payload

All at 4 msg/s per channel, so only the payload differs.

| payload | `permessage-deflate` + cache | dictionary | dictionary + compaction |
|---|---|---|---|
| operations feed (~600 B, structured) | 2.52x | **7.60x** | 9.26x |
| telemetry (mostly numbers) | 2.03x | **3.68x** | 4.76x |
| chat prose | 2.08x | **3.51x** | 4.31x |
| tiny (~60 B) | 1.82x | **2.64x** | 4.24x |

A dictionary is worth most where messages share structure and vocabulary and least where they are short or genuinely novel. Channel compaction moves in the opposite direction — it removes a fixed number of bytes per push, so it matters most when the payload is small: on the tiny payload it is worth 1.57x on its own and lifts the dictionary from 2.64x to 4.24x.

### What this costs in memory

A dictionary is shared by every connection that holds it, so its memory does not scale with connection count:

| idle connections | RSS without | RSS with a dictionary | difference |
|---|---|---|---|
| 2 000 | 77.6 MB | 82.1 MB | +4.5 MB |
| 8 000 | 239.6 MB | 246.7 MB | +7.1 MB |

Four times the connections, and the difference grows 1.6x rather than 4x — one artifact, plus the codecs a node keeps built (`max_live_codecs`), plus small per-connection bookkeeping. Under load both schemes add tens of MB of pooled compressor state, which tracks concurrent compressions rather than connections.

### Two settings that matter more than the choice of scheme

* **If you run `permessage-deflate` on fan-out, turn on the prepared message cache** ([`websocket.compression_prepared_message_cache_size`](./performance.md#websocket-compression-optimizations)). Without it, every subscriber compresses the same frame again: at the 500-subscriber fan-out it cost 3.48x CPU against 1.44x with the cache, and it could not sustain delivery. The dictionary has the equivalent switch on by default (`frame_cache_size`); turning it off cost 4.5x CPU instead of 3.2x at 4 msg/s.
* **Compression level is not the lever it looks like.** Raising `permessage-deflate` from level 1 to level 6 bought 2.47x → 2.57x. The dictionary codec is pinned at level 6 and cannot go lower: Go's DEFLATE switches to a fast encoder at level 1 that accepts a preset dictionary and then ignores it, so a lower level would pay to carry a dictionary it never consults. The gap between the two schemes is therefore not a level difference — at the same level 6, `permessage-deflate` gives 2.57x and a dictionary 7.6x.

:::note How this was measured

Two processes on one machine (macOS, 10 cores), server and load generator separate, native — no containers. Every arm ran interleaved with the others and repeated three times; CPU is paired against the baseline **from the same round**, because absolute CPU on a laptop drifted up to 40% over an hour and taking medians across rounds would report that drift as a difference between settings. Bytes are counted at the client socket, so they include WebSocket framing and whatever compression actually negotiated. Ratios reproduced to within 1% across rounds; CPU multiples carry roughly ±20%.

Your numbers will differ — the point of the tables is the shape, not the digits. One regime is missing because it could not be measured honestly here: a 500-subscriber fan-out with batching off saturated the load generator rather than the server, so those runs are excluded rather than reported.

:::

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
