---
description: "A guided tour of the Centrifugo bidirectional client protocol: the Command/Reply model, async pushes, batching, ping-pong, and error handling — with interactive diagrams."
id: client_protocol
title: Client protocol
---

import ProtocolFormatsDiagram from '@site/src/components/ProtocolFormatsDiagram';
import ProtocolFrameAnatomy from '@site/src/components/ProtocolFrameAnatomy';
import ProtocolPushDiagram from '@site/src/components/ProtocolPushDiagram';
import ProtocolSequenceDiagram from '@site/src/components/ProtocolSequenceDiagram';
import ProtocolBatchingDiagram from '@site/src/components/ProtocolBatchingDiagram';
import ProtocolPingPongDiagram from '@site/src/components/ProtocolPingPongDiagram';

This chapter is a guided tour of the Centrifugo **bidirectional client protocol** at the framing level — the small set of rules that turn a raw real-time connection into something an SDK can build on. If you're looking for the user-facing operations exposed to application code, see the [client API](client_api.md) document instead.

You don't need to read this to *use* Centrifugo — the SDKs hide all of it. But if you want to understand *why* the protocol looks the way it does, write a new SDK, or just satisfy your curiosity, this is the place.

## Why a protocol at all?

A real-time transport like WebSocket gives you exactly one thing: an ordered, bidirectional stream of messages. That's a **pipe**, not a protocol. The pipe says nothing about:

* how to **authenticate** and pass custom data when a session opens;
* how to tell *which response belongs to which request* — WebSocket has no built-in request/response matching;
* how to run **many subscriptions over one physical connection** instead of opening a socket per channel;
* how to distinguish a published message from a join notification from a server disconnect advice;
* how to keep the connection **alive** and notice when it has silently died.

Centrifugo answers all of these with a compact framing layer. The whole thing is built from just two message types travelling over that single pipe. Let's meet them.

## Two wire formats

Before the structure, one early decision that colors everything below: the protocol speaks **two interchangeable encodings**, and a connection picks one for its whole lifetime.

<ProtocolFormatsDiagram />

* **JSON** — text you can read and log, working naturally with the JSON tooling every language already has. The convenient default.
* **Protobuf** — the exact same fields packed into compact binary. Smaller on the wire and faster to parse at scale.

They carry *identical* meaning — every concept in this document exists in both. We use **JSON for all examples** here simply because it's readable; mentally swap in Protobuf bytes and nothing else changes.

:::info A JSON detail

In the JSON encoding, `bytes` fields (like a publication's `data`) are embedded as raw JSON rather than base64. Since application payloads are almost always JSON anyway, this lets them sit *natively* inside the frame — readable end to end, and a natural fit for the JSON tooling every language already has, with none of the extra size and encode/decode cost that base64 would add.

:::

## Two envelopes: Command and Reply

In the bidirectional case, a client sends a **`Command`** to the server, and the server sends a **`Reply`** back. That's the entire vocabulary — every interaction is some arrangement of these two envelopes.

<ProtocolFrameAnatomy />

Both envelopes are deliberately minimal:

* A **`Command`** carries an `id` and exactly one *request* payload — `connect`, `subscribe`, `publish`, `history`, `rpc`, and so on. The server reads the first non-empty field to learn what you're asking for.
* A **`Reply`** carries the same `id` back, plus *either* a result of the matching type *or* an `error`. No error means success — the client can trust the result object.

The `id` is the keystone. It's an incremental `uint32` chosen by the client and **echoed** by the server. Because WebSocket lets both sides send at any moment with no inherent pairing, this id is what lets the SDK match a `Reply` to the `Command` it sent earlier — even with many requests in flight at once.

An `error` is just three fields:

```json
{ "code": 100, "message": "internal server error", "temporary": true }
```

So a failed reply to command `id: 1` looks like:

```json
{"id": 1, "error": {"code": 100, "message": "internal server error"}}
```

We'll come back to `temporary` and error codes [later](#when-things-go-wrong) — they drive how a good SDK reacts.

:::info Why not Protobuf `oneof`?

The schema uses separate numbered fields rather than a `oneof` for the payload. This keeps the wire format friendly to the JSON representation (where the field name *is* the discriminator) and keeps both encodings in lock-step. The server simply takes the first request field that is set.

:::

The full list of commands a client can issue:

| Command | Purpose |
|---|---|
| `connect` | Authenticate and open the session — the "hello", carries a token and optional data |
| `subscribe` / `unsubscribe` | Join / leave a channel |
| `publish` | Publish data into a channel |
| `presence` / `presence_stats` | Ask who is in a channel (full info or just counts) |
| `history` | Fetch a channel's message history |
| `rpc` | Call server-side logic and wait for a result |
| `send` | Fire-and-forget message to the server — **no `id`**, since no reply is expected |
| `refresh` / `sub_refresh` | Renew an expiring connection / subscription token |

A well-behaved SDK understands all of them and the workflow that connects them.

## Walk the wire

Diagrams of fields only get you so far. The protocol is best understood as a *conversation*. Below is a real session's worth of frames, in order. Click any message to see exactly what travels on the wire and what it means — and watch how a `Command` and its `Reply` share an `id`.

<ProtocolSequenceDiagram />

A few things worth noticing from the walk-through:

* The **`connect` handshake comes first** and bootstraps everything: it returns the `client` id and *negotiates the heartbeat* (how often the server will ping, and whether it wants a pong back).
* **Subscriptions are multiplexed.** `subscribe` for `chat:42` rides the same connection as everything else — no new socket. One connection can carry many channels at once.
* **Not every server message answers a command.** The publication arrives with `id: 0` — it's a *push*, which is the next concept.

## Asynchronous pushes

Most server-to-client traffic in a real-time app isn't a reply to anything — it's an event: a new message in a channel, someone joining, the server asking you to reconnect. These reuse the **same `Reply` envelope**, but with **no `id`** (`id == 0`) — the missing id is what marks the frame as unsolicited.

That one field is all the SDK needs to read any incoming frame correctly:

<ProtocolPushDiagram />

(The empty-`id` ping is covered in [Ping-pong](#ping-pong-staying-alive-noticing-death) below.) The push types a client should understand:

| Push | Meaning |
|---|---|
| `pub` | A publication in a channel |
| `join` / `leave` | Someone subscribed to / unsubscribed from a channel |
| `subscribe` / `unsubscribe` | The **server** subscribed or unsubscribed this client (server-side subscriptions) |
| `message` | An async message pushed from the server to this client |
| `disconnect` | The server is about to close the connection, with a code and reason |
| `connect` / `refresh` | Used by unidirectional transports — connection info and credential refresh |

The elegance here is that *one* correlation rule (the `id`) cleanly separates synchronous request/response traffic from the unsolicited event stream, over a single connection, with no extra framing.

## Batching: many messages, one frame

Under load, the expensive part of network I/O is often the number of system calls, not the bytes. So the protocol lets a single transport frame carry **more than one** `Command` (client→server) or `Reply` (server→client). The SDK can drain its outgoing queue in one write, and the server can flush a burst of replies and pushes in one go.

<ProtocolBatchingDiagram />

The two encodings pack messages differently, but the idea is identical:

* **JSON** — each message is encoded independently and joined with a newline (`\n`):

  ```json
  {"id": 1, "subscribe": {"channel": "ch1"}}
  {"id": 2, "subscribe": {"channel": "ch2"}}
  ```

* **Protobuf** — each message is length-prefixed with a `varint`, then concatenated. The reader peels off one length-delimited message at a time until the buffer is drained.

Here is exactly how the JavaScript SDK encodes and decodes the JSON form — note how small it is:

```javascript
// encode: array of commands -> one frame
function encodeCommands(commands) {
  return commands.map(c => JSON.stringify(c)).join('\n');
}

// decode: one frame -> array of replies
function decodeReplies(data) {
  return data.trim().split('\n').map(r => JSON.parse(r));
}
```

:::tip

A single frame can even mix kinds — for example, a reply to a command *and* an asynchronous push, batched together. The reader doesn't care; it just splits the frame and dispatches each message by the `id` rule above.

:::

## Ping-pong: staying alive, noticing death

TCP can keep a connection "open" long after the other side has vanished — a dropped Wi-Fi link, a sleeping laptop, a silently-killed proxy. The protocol detects this with a heartbeat negotiated during `connect`.

<ProtocolPingPongDiagram />

The mechanics are intentionally cheap:

* The server sends a **ping** on a fixed interval (commonly every 25s). A ping is the empty frame we met earlier — no `id`, no payload.
* If the connect handshake asked for it, the client replies with an equally empty **pong** (an empty command).
* The client arms a timer for `interval + slack`. Every frame it receives — ping *or* real data — resets that timer. If the timer ever fires, the link is presumed dead and the client reconnects.

Because *any* incoming traffic resets the timer, a busy connection rarely needs an explicit ping at all — the heartbeat only does work when the line is otherwise quiet. That's the efficiency win: liveness detection that costs almost nothing on an active connection and a single tiny frame on an idle one.

## When things go wrong {#when-things-go-wrong}

A real-time SDK lives or dies by how it handles failure — so the protocol's job is to hand it *signals*, not just errors, and let it react intelligently instead of blindly retrying.

The first signal is the `temporary` flag carried by every error. A temporary error (a server hiccup, rate limiting) is worth retrying; a persistent one — `permission denied`, `bad request` — means a mistake in the application, so the SDK stops and surfaces it to your code instead of looping forever. That one boolean is what separates "try again" from "stop and look at this."

The second signal rides on disconnects. When the server ends a connection it sends a code and a reason — and the code carries a verdict: *reconnect, with backoff* or *don't bother, this won't improve*. So the server can steer the client all the way from "I'm restarting, see you in a moment" to "go away for good," with no out-of-band coordination.

One consequence of being asynchronous is worth calling out, because it shapes how SDKs behave: a **client-side timeout doesn't mean the operation failed.** A `subscribe` that times out locally may well have succeeded on the server. The pragmatic cure is usually to reconnect — simpler than reconciling, and it lands the client on a healthy server. The same caution applies to non-idempotent `publish`: retrying after a timeout can deliver a message twice, so carry an idempotency key when duplicates would matter.

The exhaustive list of error, unsubscribe, and disconnect codes lives in [client protocol codes](../server/codes.md) — you rarely need it to understand the shape of things.

## Recovery, briefly

When a subscription is **recoverable**, its `subscribe` reply includes an `epoch` and an `offset` — a position in the channel's stream. After a reconnect the client sends those back, and the server replays whatever was missed (or tells the client, via a `recovered` flag, that it couldn't). This is what makes a dropped connection a non-event for the application rather than a hole in the message stream. The framing we've covered is what carries it; the [channel history and recovery](../server/history_and_recovery.md) chapter covers the semantics in depth.

## Protobuf schema: the source of truth

Everything above is a narrative. The authoritative definition is the [Protobuf schema](https://github.com/centrifugal/protocol/blob/master/definitions/client.proto) in the `centrifugal/protocol` repository — that's where to look when you need the exact field numbers and types behind every message described here.

## Client name and version

Two options every SDK exposes, both purely for observability — they don't affect protocol behavior:

* **`name`** — identifies the application a connection comes from. Official SDKs default to `js`, `dart`, `swift`, etc., but you can override it. Centrifugo PRO surfaces it in analytics. Max **16** characters.
* **`version`** — the *application's* version (not the SDK version — that's more useful in practice). Also used by Centrifugo PRO analytics. Max **64** characters.

## A couple of footnotes

* A single connection **cannot subscribe to the same channel twice** — the second `subscribe` returns `already subscribed` (code `105`).
* When in doubt about any behavior described here, the [existing client SDKs](./client_sdk.md) are the best worked examples — they implement exactly this protocol.

---

That's the whole framing layer: two envelopes, an `id` to correlate them, an `id == 0` rule to fold in the event stream, batching to amortize I/O, a near-free heartbeat, and a small set of codes that let client and server negotiate failure gracefully. Small surface, but it's enough to efficiently multiplex a connection's channels and survive the messy realities of the network.
