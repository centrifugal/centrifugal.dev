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

At this moment only JavaScript SDK (`centrifuge-js`) supports this feature (since v5.5.0). Centrifugo PRO supports this since v6.5.0.

## Dictionary compression

:::caution Experimental

Dictionary compression is an experimental feature. Configuration options, admin API, and client SDK behaviour may change in future releases. On the client side it currently requires `centrifuge-js` or `centrifuge-go`.

:::

Real-time applications send small messages, often. Compressing each one on its own finds little to work with — there is barely any repetition *inside* a single message — while the repetition *between* messages is large, since they share field names, the protocol envelope, and often a handful of values. On WebSocket connections the usual answer is the `permessage-deflate` extension, which has exactly this weakness.

Dictionary compression gives the compressor that shared context up front. Centrifugo PRO trains a dictionary from real connections, sends it to a client once, and compresses every frame against it. Measured on JSON WebSocket connections:

| tier | ratio vs uncompressed | what it costs you |
|---|---|---|
| `permessage-deflate` today | 1.15x | — |
| structure dictionary | 1.31-1.50x | one click in the admin UI |
| trained on your traffic, shape only | 1.85-2.46x | a training session in the admin UI |
| plus approved values | 4.02-5.06x | the above, plus reviewing a word list |

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

When collection ends nothing happens until you ask. Building a candidate does the search an operator would otherwise do by hand: it builds a dictionary at every size on the ladder and at several cut-offs down the ranked value list, measures each against the control window, and comes back with a **recommended size and a selection already ticked** — the smallest dictionary within a couple of percent of the best ratio, and the cut-off that was best at that size. More approved values is not better. Past the peak, extra values push the useful fragments out of cheap matching range and the ratio falls, which is why the review screen puts the values that carry the saving first and asks you to read a few dozen rather than a few hundred.

Your job in review is the one a machine cannot do: untick anything that should not be disclosed to this profile's audience. Then pick a destination profile and activate — optionally staged to a percentage of new connections. The size and the selection are one answer, so the approve dialog defaults to the recommended rung; moving to another size changes what the ideal selection would have been. Two dictionaries are generated from every approved vocabulary, one for JSON and one for Protobuf, and they activate together. Retraining is starting another session over the same connections; nothing activates on its own, so a dictionary only ever changes when an operator says so.

### Withdrawal and monitoring

Deactivating a version drops that profile back to the structure dictionary — immediately for new connections, on reconnect for existing ones. Deactivating the structure dictionary as well turns the feature off entirely.

:::caution

Withdrawal stops distribution; it cannot un-disclose. Every client that already received a dictionary has its contents. Approving a vocabulary is a one-way door, and the remedy for a value that should not have been approved is upstream — rotate the credential, invalidate the identifier.

:::

Prometheus metrics and the admin UI report, per profile and protocol: the **cold/warm connect split** (what fraction of connects arrive with a dictionary already cached — this should settle warm), the **realized ratio** against the ratio the version was approved at (a growing gap means it is time to retrain), **bytes saved** net of delivery cost, and the **frame cache hit rate**.

### Configuration

| Option | Default | Description |
|---|---|---|
| `enabled` | `false` | Make the feature available on this node. Requires `database`. |
| `max_sampled_connections` | `50` | Fleet-wide cap on connections a training session observes at once. |
| `candidate_ttl` | `"168h"` | How long an unused candidate is kept before deletion. The per-node reports it was built from are cleared on the same schedule. |
| `snapshot_poll_interval` | `"20s"` | How often nodes poll the database for activation changes. Activating, deactivating or editing a profile also nudges every node immediately, so this is a backstop rather than the usual path. |
| `max_concurrent_sessions` | `3` | How many training sessions may collect at once. |
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
