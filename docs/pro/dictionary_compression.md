---
description: "Draft of Centrifugo PRO dictionary compression docs. Not released yet."
id: dictionary_compression
title: Dictionary compression
draft: true
---

import DictionaryConnectDiagram from '@site/src/components/DictionaryConnectDiagram';
import DictionaryChoiceDiagram from '@site/src/components/DictionaryChoiceDiagram';
import DictionaryTrainingDiagram from '@site/src/components/DictionaryTrainingDiagram';
import DictionaryBatchingDiagram from '@site/src/components/DictionaryBatchingDiagram';

{/*
Not released. This page is excluded from production builds and is not in the sidebar.

On release, move these two sections back to bandwidth_optimizations.md and restore:
- bandwidth_optimizations.md: the four Dictionary* imports, the feature table row, the "five features" intro, frontmatter description, and the pointer to the comparison. Links here to ./bandwidth_optimizations.md#... become #... again
- server/proxy.md: the `profile` row of ConnectResult
- server/authentication.md: the `profile` JWT claim section
- transports/websocket.md: the link to the measured comparison
- pro/performance.md: the link to the full comparison from the prepared message cache section
- pages/components/ComparisonTable.jsx: the "Dictionary compression" row
- pages/pro/index.jsx: "Dictionary compression" in featureList

Open before release:
- Does a training session learn from delta frames? A patch reaches the collector as a plain JSON string. The delta numbers below need a dictionary trained on delta frames, so check this path.
- The real-feed and delta numbers came from one-off harnesses, not benchsuite. Move them to the repo so they can be reproduced. The delta table is a zlib-style simulation with a raw-traffic dictionary, so measure it through the real pipeline.
- CPU and memory numbers are from generated payloads with batching. Re-measure on real payloads.
- Decide whether to name the public feeds on the released page.
*/}

## Dictionary compression

:::caution Experimental

Dictionary compression is an experimental feature. Configuration options, admin API, and client SDK behaviour may change in future releases.

:::

Real-time applications send many small messages. Each one has little repetition inside it, which is the weakness of compressing messages one by one as `permessage-deflate` does, but messages share field names, the protocol envelope and often a handful of values.

Centrifugo PRO trains a dictionary on real connections, sends it to a client once, and compresses every frame against it. A dictionary costs **no per-connection memory** — every connection shares the same immutable bytes — and one publication is compressed once for all of its subscribers.

There are three kinds of dictionary, in increasing order of what they ask of you:

| dictionary | what it takes |
|---|---|
| structure | one click in the admin UI — a fixed dictionary built from Centrifugo's own protocol, containing none of your data |
| trained on your traffic, shape only | a training session; field names and nesting, no values, so nothing to review |
| trained, with approved values | the same, plus reading a ranked word list |

What each is worth depends on your payloads and your message rate. On real public feeds, a trained dictionary sent about 1.3-1.6x less egress than `permessage-deflate` at the median ([measured here](#on-real-traffic)). That can matter at high volume, but it rarely repays the setup at low volume. If you are not sure, start with `permessage-deflate` and [`client.write_delay`](./client_msg_batching.md#clientwrite_delay), then run a training session to see what a dictionary adds.

### Requirements and limitations

* **WebSocket only.** A compressed frame is arbitrary bytes, which text-framed transports like SSE would have to re-encode, giving the savings back. Connections over other transports are unaffected.
* **Client SDK:** `centrifuge-js` or `centrifuge-go`, and from its next release `centrifuge-dart` on the Dart VM and Flutter native platforms (not browser builds). Other clients receive no dictionary and keep what they had — `permessage-deflate` if [`websocket.compression`](../transports/websocket.md#websocketcompression) is on, otherwise no compression — so a mixed fleet is safe.
* **Published data must be JSON**, over either the JSON or Protobuf client protocol. Binary, Protobuf-encoded or encrypted `data` cannot be learned from: a session counts and skips those payloads and reports a parse rate per channel, so a low rate means this traffic will not benefit. The structure dictionary still works for those profiles.
* **No structure dictionary for Protobuf connections.** Protobuf messages carry numeric field tags instead of repeated field names, so it measured 1.16x against 1.14x with no dictionary, which does not repay the download.
* **Channel names are never put into a dictionary**, since they routinely carry a user or room id. If they dominate your frames, [channel compaction](./bandwidth_optimizations.md#channel-compaction) removes them from the wire instead.

### How a connection gets its dictionary

A client whose SDK supports the feature says so when it connects, and the server sends the dictionary in the **connect reply**. A client that already holds the dictionary names it when connecting, and the reply carries only its id.

<DictionaryConnectDiagram />

The connect reply is never compressed, whether it carries the dictionary or only names it; every frame after it is, and starts with a marker saying so. So no compressed frame can reach a client that does not yet hold the dictionary. A dictionary is chosen at connect and never changes mid-connection. If the client cannot use the dictionary, or a frame fails to decode, that is a protocol error, handled like any other: the client disconnects with code 2 (bad protocol) and a reason saying what failed, and does not reconnect on its own. It forgets the dictionary, so connecting again does not offer it.

How long a client keeps the dictionary depends on the SDK:

* `centrifuge-js` stores it in `localStorage` for up to seven days, checked against its id before use, so even a page reload costs only the id. Where `localStorage` or WebCrypto is missing, it keeps it in memory for the life of the page.
* `centrifuge-go` and `centrifuge-dart` keep it in memory for the life of the client: a reconnect costs only the id, a restarted application downloads it again.

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

Enabling it in the config file makes the feature *available*. Nothing is served until you switch it on in the admin UI. Everything after that is an admin UI operation, stored in the database and applied across the cluster: dictionaries are created, activated and withdrawn without a deploy or a restart.

On a deployment with no profiles yet, the **Compression** page offers **Get started**: one confirmed step that turns serving on, serves the structure dictionary, creates a `default` profile for every connection without one, and starts a shape-only training session for it, 30 minutes unless you choose otherwise. When the session ends, the profile offers the dictionary it made for you to activate.

The structure dictionary on its own is a reasonable place to stop: with none of your data in it, there is nothing to review and nothing to disclose.

### Profiles

A **profile** groups connections whose traffic looks alike — a page, a screen, a kind of client. Dictionaries are trained and served per profile, never per user or per connection. **One profile is a perfectly good configuration**: create it, mark it the default, and every connection gets its dictionary. Profiles start paying when your populations genuinely differ.

A profile is set explicitly, one of two ways:

1. **Your application**, via a `profile` claim in the connection token, or `profile` in the [connect proxy result](../server/proxy.md#connectresult). Needs a change where connections are authenticated, not in clients, so connections can be classified without a client release.
2. **The client**, passing `profile` in SDK options — but only if the profile exists *and* is marked client-declarable. Needs no server-side change.

A name that matches no configured profile is ignored and the connection is left unclassified, so a client can never invent a profile. Names clients declare that you have not configured show up in the admin UI, which is how typos and untrained populations surface.

Unclassified connections get the structure dictionary — or, if you nominate a **default profile**, that profile's dictionary instead. A mismatched trained dictionary is never worse than the structure one, so the default is a cheap way to cover everything you have not classified. Connections classified into some *other* profile never receive it. Marking a profile default widens who its dictionary reaches, so, like making it client-declarable, it invalidates the active version and requires re-approval.

Put together, this is how a connection's dictionary is chosen:

<DictionaryChoiceDiagram />

:::caution Client-declarable profiles

A client-declared profile cannot be verified, so anyone who can connect can claim it. That is a legitimate way to run this and needs no server-side change — but the profile's dictionary is then effectively published to your whole deployment. Turning the flag on invalidates the active version and requires re-approval.

:::

### Training

A dictionary goes through the same cycle every time:

<DictionaryTrainingDiagram />

You start a training session over connections you select the same way you do on the **Inspector** page: by user (one user, or anonymous ones), by a channel they are subscribed to, and by profile (one profile, or connections with none). No profile is needed to start, so you can find out what a dictionary would be worth before classifying anything.

You choose a **duration** — between a minute and 24 hours — and whether to **collect values**. The session collects for that long and stops; you can extend or stop it early. Up to 50 connections are sampled across the cluster at once. Once the shape count it reports stops moving, it has seen the message types this traffic produces. Let it reach its deadline anyway, or at least its last quarter, which measures the result.

By default a session keeps **shape only**: field names, nesting and key order, with every value replaced by a placeholder before anything leaves the node, so there are no values to review. Field names are kept, though, and that matters if your application uses data as JSON keys, like `{"users":{"bob.smith":{...}}}`. A build drops shapes seen on only one connection, once a session has seen at least three, and shapes with field names that look like ids or addresses. A plain name that several connections receive can still pass, so do not use a shape-only dictionary on such traffic without checking what it holds. Enabling **collect values** additionally proposes values for a human to approve; they are filtered first — a denylist of field names (extendable with `denied_value_names`), shape rules that reject anything token-shaped or outside the allowed length, and channel names, which are never admitted — and what survives is ranked so the valuable entries are read first.

A session spends its **last quarter as a control window**: what it observes there is never used to build anything, and the build measures against it. Scored against its own contents, a dictionary reads 4-5x almost regardless of what is in it.

When collection ends:

1. **Build.** Opening the session builds a dictionary at every size on the ladder and at several cut-offs down the ranked value list, and measures each against the control window. It recommends the smallest dictionary within a couple of percent of the best measured ratio, with the selection that achieved it already ticked. A session stopped before its control window has nothing to measure against: its ratios are projected, and the recommended selection is the values that fit. Rebuilding keeps your review decisions, and the newest set is marked current.
2. **Review.** Choose the size at the top of the screen; the ticked selection follows it to the one measured there. Each rung shows its measured ratio, the values it holds and what a cold connect pays, and the recommended rung is marked. Then untick anything that should not be shown to everyone this profile reaches. The panel updates the dictionary's size, saving and download cost as you edit, shows how many ticked values fit, and warns when some do not fit at this size. A dictionary fills to its budget and stops, so a ticked value that does not fit is not sent to clients; it stays allowed, and a larger dictionary later can use it without another review. A shape-only session has no values to review.
3. **Activate.** Approving creates a **version** for the profile, which is preselected when the session was started for one. A version holds two dictionaries made from the same vocabulary, one for JSON connections and one for Protobuf, and they activate together. Activate it in the same step or later from the profile. You can stage it to a percentage of new connections first, split by user so a client keeps its side of the split across reconnects; connections left out of the rollout keep the structure dictionary.
4. **Retrain.** **Retrain** on the profile starts another session over the same connections, filled in from the session its dictionary came from. Nothing activates on its own, so a dictionary only ever changes when an operator says so. When to retrain is what [monitoring](#measured-and-live-ratios) tells you.

### Withdrawal

Deactivating a version drops that profile back to the structure dictionary — immediately for new connections, on reconnect for existing ones. With the structure dictionary off as well, connections that have no active version to receive get no dictionary; **Serve dictionaries** turns the feature off for everyone.

:::caution

Withdrawal stops distribution; it cannot un-disclose. Every client that already received a dictionary has its contents. Approving a vocabulary is a one-way door, and the remedy for a value that should not have been approved is upstream — rotate the credential, invalidate the identifier.

:::

### Which clients get one

By default every client that can decode a dictionary is offered one. **Serve to** on the **Compression** page narrows that by the name a client sends when it connects. Official SDKs send their own name (`js`, `dart`, `swift` and so on) unless the application sets another:

* **Only** offers dictionaries to the clients you list, and to nobody else: a way to try the feature on one platform first. A client name that appears later is left out until you add it.
* **All except** offers them to everyone but the clients you list: a way to take a client out of service if it turns out to decode badly. A client name that appears later is served.

A client that sends no name can be listed as **no name**. Browser, React Native and Node applications all send `js`, so telling them apart needs a [profile](#profiles) or a name the application sets. The name is the client's own claim: this decides who is offered a dictionary and protects nothing.

Like the other switches, it applies to every node within seconds and to new connections only. Connections it leaves out are counted in `centrifugo_dict_compression_excluded_connects_total`.

### Monitoring

The admin UI reports results per **dictionary**, not per profile, because a profile usually serves more than one at a time: connections left out of a staged rollout still hold the structure dictionary, and a replaced version stays with the connections holding it until they reconnect. The same figures are available as Prometheus metrics.

Each row shows:

* **new versus returning connections** — how many arrived already holding the dictionary. This should settle towards returning; those connections pay nothing to receive it.
* **what it is actually saving**, next to what it was measured to save when you approved it — see below.
* **bytes saved**, after subtracting the cost of sending the dictionary out.
* **how often a compressed message was reused** instead of being compressed again.

#### Measured and live ratios

The measured ratio comes from sample messages built from the shapes and values seen in the control window, compressed one message at a time. It compares against no compression, not against what you run today. If you already use `permessage-deflate`, expect a smaller gain: on [real feeds](#on-real-traffic), dictionaries that measured 2.5-3.7x sent 1.4-1.8x less egress than `permessage-deflate`. A dictionary from a session stopped before its control window reads *not measured*.

Live traffic usually lands close to the measured ratio: within about 10% on real feeds with one message per write. It does better when messages are written to a connection together, because they are compressed together. On a single node, a burst of publications often goes out in one write. Across several nodes, publications come through the broker one by one, so live comes out about the same as measured.

<DictionaryBatchingDiagram />

To group messages again on several nodes, set a small [`client.write_delay`](./client_msg_batching.md#clientwrite_delay), such as 10–25 ms: each connection then collects its messages for that long and writes them together. It adds that much latency, and it only helps connections that receive several messages close together — one that gets a message every few seconds has nothing to group.

Live falling well below the measured ratio means your messages have probably changed since training, and it is time to retrain. Batching lifts the live ratio, so on batched connections a drop can stay hidden for longer.

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
| `flush_interval` | `"5s"` | How often a node writes its training progress to the database during a session. Jittered per node. What it observed is written at most once a minute, and always when the session ends or the node stops. |
| `maintenance_interval` | `"60s"` | How often a node re-checks that sampled connections still match the session filter and rotates a fraction of them. |
| `max_concurrent_sessions` | `3` | How many training sessions may collect at once. They share the frame budget. |
| `candidate_ttl` | `"168h"` | How long an unused candidate is kept before deletion. The per-node reports it was built from are cleared on the same schedule. |
| `denied_value_names` | `[]` | Extra field names never admitted as values, on top of the built-in denylist. |

## Which compression to use: measured cost and benefit

Three things make messages smaller:

* **`permessage-deflate`** — the standard WebSocket compression extension, available in Centrifugo OSS via [`websocket.compression`](../transports/websocket.md#websocketcompression). Every browser supports it. It compresses each message on its own, with no memory of the messages before it.
* **[Dictionary compression](#dictionary-compression)** — compresses each message against a dictionary of your own traffic, so the repeated parts of your messages are already known and cost almost nothing to send.
* **[Channel compaction](./bandwidth_optimizations.md#channel-compaction)** — replaces the channel name in each message with a short number.

The first two do the same job, but you do not have to choose between them. With both enabled, each connection uses the best one it supports: one that gets a dictionary is compressed with it, and `permessage-deflate` is switched off for its frames, so nothing is compressed twice. Every other connection keeps `permessage-deflate`. So if you already run `websocket.compression`, keep it on when you enable dictionary compression. Compaction works alongside either.

:::note Why delta compression is not in this comparison

[Delta compression](./bandwidth_optimizations.md#delta-compression-for-at-most-once) answers a different question. It sends only what changed since the previous publication, so it helps when consecutive messages in a channel resemble each other, and it is enabled per channel rather than for everything a connection receives. It does not always add to a dictionary: see [delta and dictionaries](#delta-and-dictionaries).

:::

### On real traffic

These runs use real JSON captured from five public feeds. Each dictionary went through the normal path: a one-minute training session, the build's recommended size and selection, activation, then delivery to a client. The traffic delivered was captured after the training traffic. Bytes were counted on the server's socket, and packet headers were added as described in [what egress metrics show](#what-egress-metrics-show).

Egress per message, with each message in its own write:

| feed | average size | no compression | `permessage-deflate` | structure | trained, shape only | trained, with values |
|---|---|---|---|---|---|---|
| Wikimedia edits | 1 098 B | 1 249 B | 717 B | 635 B | 540 B | **419 B** |
| Bluesky posts | 863 B | 1 004 B | 644 B | 590 B | 508 B | no values recommended |
| Bluesky likes | 542 B | 678 B | 480 B | 443 B | 380 B | **342 B** |
| Coinbase ticker | 401 B | 539 B | 381 B | 339 B | 263 B | **215 B** |
| Kraken trades | 102 B | 235 B | 199 B | 164 B | 147 B | **129 B** |

Egress per message, with five messages in each write, using a 100 ms write delay:

| feed | no compression | `permessage-deflate` | structure | trained, shape only | trained, with values |
|---|---|---|---|---|---|
| Wikimedia edits | 1 222 B | 353 B | 309 B | 283 B | **241 B** |
| Bluesky posts | 980 B | 408 B | 380 B | 350 B | no values recommended |
| Bluesky likes | 634 B | 231 B | 219 B | 204 B | **196 B** |
| Coinbase ticker | 487 B | 139 B | 119 B | 101 B | **88 B** |
| Kraken trades | 175 B | 63 B | 58 B | 50 B | **42 B** |

The gain over `permessage-deflate`, as a median across these feeds:

| dictionary | each message in its own write | five messages per write |
|---|---|---|
| structure | 1.12x | 1.09x |
| trained, shape only | 1.33x | 1.25x |
| trained, with values | 1.63x | 1.49x |

* **A dictionary won on every feed, but by much less than against no compression.** With values, it sent 1.8-3x less egress than no compression in single writes, and 1.4-1.8x less than `permessage-deflate`.
* **Batching narrows the gain.** Messages in one frame share compression context, which helps `permessage-deflate` the most. On these feeds, `permessage-deflate` with batching sent less than a dictionary with no write delay. Using both sent the least.
* **Small savings need volume.** On the Coinbase feed, a dictionary with values saved 166 B per message over `permessage-deflate`. At 10 000 connections receiving one message a second, that is about 4.3 TB a month. Multiply the bytes saved by your own message rate and egress price to see if it is worth running.
* **`permessage-deflate` ran at its default level 1 here, and a dictionary always uses level 7.** With `permessage-deflate` at level 7, the egress gain with values drops by an estimated 0.04-0.11x. Higher levels also cost more CPU.

These runs have limits. They are five public feeds on a single node over loopback, with one channel and one test client at a time, so CPU and fan-out are not covered. They also do not show how quickly a dictionary goes stale. A longer training session may do somewhat better. Your own traffic may differ in either direction, so run a [training session](#training) on it. Remember that its ratio is [against no compression](#measured-and-live-ratios).

### Delta and dictionaries

The two work together: a dictionary compresses the frame after delta has encoded it. They do not simply add up, though. Delta output is mostly offsets and short strings, which a dictionary built from full messages matches poorly.

This is a simulation on the same feeds, not a run through Centrifugo. It shows egress per message, with one message per write and a 16 KB dictionary made from raw traffic. Real dictionaries are filtered, so they do less well, but the comparison between columns is what matters here:

| feed | `permessage-deflate` | delta | dictionary | delta + dictionary trained on full messages | delta + dictionary trained on delta frames |
|---|---|---|---|---|---|
| Coinbase ticker | 363 B | 270 B | 177 B | 203 B | **148 B** |
| Wikimedia edits | 680 B | 451 B | 315 B | 361 B | **296 B** |
| Kraken trades | 192 B | 180 B | **96 B** | 131 B | 98 B |
| Bluesky likes | 483 B | 454 B | **277 B** | 361 B | 282 B |
| Bluesky posts | 624 B | 589 B | **394 B** | 496 B | 412 B |

* **Small independent messages:** use a dictionary alone. Adding delta made the result 2-5% worse here.
* **Small messages that repeat one object with small changes:** test both. Delta added 6-16% here.
* **Large documents with small edits:** delta and a dictionary together should work best, because a dictionary cannot hold the whole document. None of these feeds has such messages, so this comes from generated tests only.

### What to use

| your situation | what to use |
|---|---|
| you want to reduce traffic with the least work | **`permessage-deflate`, with its [prepared message cache](./performance.md#websocket-compression-optimizations)**, and channel compaction if your channel names are long |
| connections receive several messages a second and can accept some latency | add a [`client.write_delay`](./client_msg_batching.md#clientwrite_delay), which often saves more than a dictionary |
| egress is a large bill, messages are JSON with repeating fields, and connections receive few messages or cannot accept latency | **dictionary compression** on top, after a training session on your traffic shows it is worth it |
| CPU is what you are short of | **`permessage-deflate` with its prepared message cache**: in the [generated benchmark](#by-traffic-shape) a dictionary used up to about 12% more CPU at low fan-out |
| messages are small but channel names are long | **channel compaction** first — it costs almost nothing and helps most exactly where compression helps least |
| messages are binary, encrypted or already compact | none of them will help much — try one and measure before committing |
| bandwidth is flat-rate, or traffic stays inside your network | none of them: you would spend CPU to save bytes nobody charges you for |

They also differ in how much work they are to adopt, which no benchmark shows:

* **`permessage-deflate`** is one config option and works with every browser and SDK.
* **Channel compaction** is one namespace option; SDKs that do not support it simply keep receiving channel names.
* **Dictionary compression** needs PostgreSQL. The structure dictionary is then one click, shape-only training adds a session on live traffic, and only a dictionary with values needs a person to review them. It currently works with `centrifuge-js` and `centrifuge-go`, with `centrifuge-dart` to follow; other clients keep `permessage-deflate` or no compression, which is safe but means a mixed fleet gets mixed results.

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

:::caution Generated payloads, and batching

This section and the sections after it use four generated messages, not real traffic. They are more repetitive than the real feeds above, so they show a larger gain. Use them for CPU, memory and the shape of the trade-off, not as a forecast of your savings.

:::

These runs were on a 16-core Linux server, and all send the same message — 652 bytes of JSON from an operations feed, of the kind a dashboard subscribes to:

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

Field names repeat in every message, and several values come from small sets — `status`, `carrier`, `region`, the hub codes — which is what a dictionary lives on. Each message also carries a fresh timestamp, sequence number and correlation id that nothing can compress. The message is generated, and it is more repetitive than most real feeds: several fields never change and shipment ids come from a small pool. With more varied values the same kind of message measured about 5x with a dictionary rather than 6.4x. Expect less if your messages have no repeated vocabulary.

Every connection is subscribed to one channel. CPU is measured against the same load with compression off, and so is the saving.

The 1, 4 and 10 msg/s rows ran with a 200 ms write delay and two publishers, so many frames carried more than one message, and that favours every compression scheme in the table. For comparison, a fan-out run of the same message with no write delay used 742 B per message with no compression, 466 B with `permessage-deflate` (1.6x) and 127 B with a dictionary (5.8x).

| traffic | scheme | CPU vs none | bytes/msg | ratio |
|---|---|---|---|---|
| **2 000 idle connections**, no traffic | `permessage-deflate` + cache | 1.00x | — | — |
| | dictionary | 0.99x | — | — |
| **2 000 connections, 1 msg/s each**<br/>500 channels, 4 subscribers each → 2 000 msg/s delivered | `permessage-deflate` + cache | 1.37x | 306 B | 2.45x |
| | dictionary | 1.45x | 118 B | **6.36x** |
| | dictionary + channel compaction | 1.42x | 100 B | **7.46x** |
| **2 000 connections, 4 msg/s each**<br/>500 channels, 4 subscribers each → 8 000 msg/s delivered | `permessage-deflate` + cache | 1.65x | 305 B | 2.45x |
| | dictionary | 1.84x | 117 B | **6.41x** |
| | dictionary + channel compaction | 1.81x | 100 B | **7.52x** |
| **2 000 connections, 10 msg/s each**<br/>200 ms write delay, so messages batch → 18 000 msg/s delivered | `permessage-deflate` + cache | 1.69x | 239 B | 3.13x |
| | dictionary | 1.80x | 100 B | **7.47x** |
| | dictionary + channel compaction | 1.77x | 88 B | **8.50x** |
| **500 connections on one channel**<br/>500 msg/s published → 250 000 msg/s delivered | `permessage-deflate` + cache | 1.04x | 147 B | 5.02x |
| | dictionary | 1.05x | — | — |
| | dictionary + channel compaction | 1.09x | — | — |

Bytes are counted on the client's socket: everything the WebSocket connection carries, including its framing and pings. With no compression that was 749 bytes per message. The dictionary here is the one Centrifugo PRO builds from this traffic with every value approved; [by payload](#by-payload) below shows the other kinds of dictionary.

Most applications live in the first row: lots of connections, each getting very little. Nothing is being compressed, so nothing is being spent.

The last row is the happiest case for CPU. With 500 subscribers on a channel, the dictionary costs about the same CPU as `permessage-deflate`, because the message is compressed once and reused for everyone. Its bytes are left out: we have not measured that row with a dictionary Centrifugo builds.

In between, a dictionary costs up to about 12% more CPU than `permessage-deflate` and sends fewer bytes. At 10 messages a second frames carry more messages, and every scheme gains from compressing them together.

#### The one-off cost of a dictionary

A dictionary has to reach the client before it can be used. It travels compressed, and in these runs that was **2.2 KB, once per connection**. After that, a reconnect sends only its id, for as long as the client keeps the dictionary — [how long depends on the SDK](#how-a-connection-gets-its-dictionary).

At roughly 630 bytes saved per message, that download pays for itself after about four messages — or about twelve, counted against `permessage-deflate`, which saves most of those bytes too. So it only becomes a problem with very short-lived connections — a client that reconnects every few seconds to receive a single message will spend more than it saves. `permessage-deflate` has no such cost, and this is the one place where it clearly wins.

The admin UI reports this directly, as the split between new and returning connections and as bytes saved after subtracting downloads.

### By payload

All with 2 000 connections receiving 4 messages a second each, so only the message content differs. The four shapes:

* **operations feed** — the 652-byte message above.
* **telemetry** — 257 bytes, almost all numbers: `{"device_id":"dev-0016","metrics":{"cpu_percent":27.3,"memory_bytes":559139331,...},"healthy":true}`. Field names repeat, values almost never do.
* **chat prose** — 308 bytes dominated by a sentence of free text, with a room and author around it.
* **tiny** — 49 bytes: `{"t":1770000000000000000,"v":466,"s":"picked_up"}`. Barely bigger than the frame around it.

Each kind of dictionary was built by Centrifugo PRO from the same sample of this traffic: the structure dictionary is the fixed one, shape only is a training session without values, and the last two columns approve every value that passed the built-in filters, at 16 KB.

| payload | `permessage-deflate` + cache | structure dictionary | trained, shape only | trained, with values | with values + compaction |
|---|---|---|---|---|---|
| operations feed (652 B, structured) | 2.45x | 2.74x | 3.97x | **6.41x** | 7.52x |
| telemetry (257 B, mostly numbers) | 2.01x | 2.34x | 3.23x | **3.62x** | 4.74x |
| chat prose (308 B) | 2.02x | 2.31x | 2.52x | **3.43x** | 4.24x |
| tiny (49 B) | 1.83x | 2.15x | 2.26x | **2.47x** | 4.02x |

* **Shape-only training gets a good part of the way, and needs no review.** Its dictionary holds field names and nesting, and is 300-530 bytes to download.
* **Approved values pay when values repeat.** Carriers, statuses, hubs and regions took the operations feed from 3.97x to 6.41x. On telemetry, where numbers rarely repeat, they added little. A review that rejects some values lands between the two columns.
* **The structure dictionary is a small step over `permessage-deflate`**, 12-17% here. Its job is to cover connections no trained dictionary reaches, not to be the saving.

A dictionary helps most when your messages share field names and repeat the same values, and least when they are short or every message is genuinely different.

Channel compaction works the other way round. It removes the channel name from every message, which is a fixed number of bytes, so it matters most when the message itself is small — on tiny messages it saved 1.58x on its own, and took the dictionary from 2.47x to 4.02x. Its own CPU cost was too small to measure.

### What egress metrics show

The ratios above count WebSocket bytes. Egress metrics count packets, and every write to a connection also carries headers no compression touches: 52 bytes of IPv4 and TCP, and 22 more for a TLS 1.3 record. At 1-10 messages a second we counted 0.6-0.9 writes per message, so about 45-67 bytes per message come on top of everything above. That shrinks every ratio, most of all for small messages, while the bytes saved stay the same:

| traffic | `permessage-deflate` + cache | structure dictionary | trained, shape only | trained, with values | with values + compaction |
|---|---|---|---|---|---|
| operations feed, 1 msg/s | 2.19x | 2.40x | 3.19x | **4.42x** | 4.88x |
| operations feed, 4 msg/s | 2.22x | 2.44x | 3.28x | **4.62x** | 5.13x |
| operations feed, 10 msg/s, batched | 2.79x | 3.14x | 3.95x | **5.46x** | 5.96x |
| telemetry, 4 msg/s | 1.76x | 1.97x | 2.46x | **2.64x** | 3.10x |
| chat prose, 4 msg/s | 1.77x | 1.96x | 2.08x | **2.57x** | 2.92x |
| tiny, 4 msg/s | 1.48x | 1.63x | 1.67x | **1.75x** | 2.18x |

These are the measured bytes and writes with those headers added, for IPv4 and TLS 1.3. IPv6 adds 20 bytes per packet. A load balancer that terminates TLS carries the TLS part on its own egress instead.

On this generated operations feed at 4 messages a second, a dictionary with values sends about 175 bytes per message where `permessage-deflate` sends about 363 and no compression about 807. Real feeds showed a smaller gain: [1.4-1.8x over `permessage-deflate`](#on-real-traffic). These rows include the batching described under [by traffic shape](#by-traffic-shape), and the packet headers are calculated, not captured.

### Memory

Compression needs memory for two things: a working buffer while it compresses a message, and whatever it keeps between messages.

The working buffer is about 1 MB. Buffers get reused — one is borrowed to compress a message and handed straight back — so the memory in use at any moment tracks how many messages are being compressed at that instant, roughly the number of CPUs doing the work. It has nothing to do with how many connections you have: 2 000 idle connections use no buffers at all.

Incidentally, `permessage-deflate` uses a slightly bigger buffer than a dictionary does (about 1.2 MB against 0.8 MB), so a dictionary is the lighter of the two here.

What each keeps between messages:

| | size | grows with |
|---|---|---|
| the dictionary itself | up to 16 KB, the largest size a build offers; one copy shared by every connection using it | nothing |
| dictionary's cache of recently compressed messages | about 0.4 MB by default ([`frame_cache_size`](#configuration)) | nothing — it holds a fixed number of messages |
| `permessage-deflate`'s [prepared message cache](./performance.md#websocket-compression-optimizations) | whatever budget you give it, e.g. 10 MB | how many *different* messages you send |

Both caches exist for the same reason: when one message goes to many subscribers, you want to compress it once and send the same bytes to everyone. They differ in what they keep. The prepared message cache keeps a compressed copy of each distinct message it has seen lately, so how much it helps depends on how repetitive your traffic is. A dictionary is a single shared copy of your vocabulary, and its size never changes with your traffic.

The dictionary used less memory than `permessage-deflate` in every case measured on the generated operations feed:

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
* **Turning up the compression level is not worth much.** Moving `permessage-deflate` from its default level to a much slower one improved the saving from 2.47x to 2.58x while costing more CPU.

:::note How this was measured

An idle 16-core Linux server, with Centrifugo and the load generator running as separate processes on it. Every setting was run three times, alternating between settings rather than finishing one before starting the next, and each result is compared against a no-compression run from the same round. Bytes were counted on the client's socket, so they include everything the WebSocket connection carries; [what egress metrics show](#what-egress-metrics-show) adds the packet headers.

The byte counts were measured in a separate run, with dictionaries built by Centrifugo PRO from 600 sample messages of each payload, and the same settings. At 1 and 4 messages a second its `permessage-deflate` bytes matched the first run to within 1%. At 10 messages a second it batched more messages per write than the first run, which lowers every scheme's bytes in that row, so compare that row's schemes with each other. CPU and memory were measured with a dictionary of the same size built from the same messages.

The savings repeated to within 1% between runs; the CPU figures varied by about 5%.

Expect your own numbers to differ — use the tables for the shape of the trade-off, not the exact digits. One case is missing from them: a 500-subscriber broadcast with message batching turned off, where our load generator ran out of capacity before Centrifugo did. Rather than publish a number that measured our test client, we left it out.

:::
