---
title: "Two million particles with Centrifugo — the bandwidth we thought we'd lose"
tags: [centrifugo, websocket, demo, performance]
description: "Recreating David Gerrells' 2M-particle multiplayer simulation on top of Centrifugo. The naive port balloons each frame from ~129 KB to ~605 KB. But we were able to reduce the size back to comparable ~135 KB with the help of shared poll subscription."
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/cover_2_million_particles.png
date: 2026-04-28T18:00:00
hide_table_of_contents: false
---

import TileViewportDiagram from '@site/src/components/TileViewportDiagram';

David Gerrells wrote a blog post [*How fast is Go - simulating millions of particles on a smart TV*](https://dgerrells.com/blog/how-fast-is-go-simulating-millions-of-particles-on-a-smart-tv) — describing a Go server that simulates two million particles in a 2200 × 2200 world at 60 Hz, ships frames to clients at 30 Hz over WebSocket, and lets anyone connected pull particles around with their cursor. The transport is hand-written for speed: bit-packed binary frames, manual protocol, raw WebSocket library. The live demo runs at [howfastisgo.dev](https://howfastisgo.dev/) — try it before reading on.

<div class="vimeo-full-width">
   <iframe src="https://www.youtube.com/embed/cGubp-wOt7Q" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
</div>
<p></p>

David's goal was to explore the performance of the Go runtime. Once we saw the demo we immediately wanted to try reproducing it on top of Centrifugo — to find out whether a standalone server that aims to be a generic real-time transport can carry this kind of payload. In the beginning it seemed straightforward: Centrifugo provides a binary WebSocket transport, the simulation already runs on the server, the plan was to publish state on a single PUB/SUB channel that every viewer subscribes to.

What we originally missed is that the original uses **per-client camera boundaries** to ship only the slice of the particle world each viewer is actually looking at — bytes adapt to each client's window. With Centrifugo's pub/sub fan-out, a single channel ships the same bytes to every subscriber. To make those bytes useful for any viewer we ended up sending the whole world in every frame. That came out to **~605 KB per frame** instead of the **~129 KB** a typical viewer gets from the original on a MacBook-sized window.

The numbers along the way: **~129 KB** original → **~605 KB** naive port → **~135 KB** with a [shared-poll subscription](https://centrifugal.dev/blog/2026/04/28/shared-poll-subscriptions) (new in Centrifugo v6.8) — within 5% of the original, at full resolution, with the original's pan UX, and with fan-out preserved.

The story below is how we got there. Source: [`v6/millions_of_particles`](https://github.com/centrifugal/examples/tree/master/v6/millions_of_particles).

<!--truncate-->

A quick note on what's actually on the wire. The "two million particles" lives entirely on the server. What goes to clients is a **density map** — one bit per world cell, answering *"is there any particle in this cell?"*. Several particles in the same cell collapse to one bit. Bytes per frame scale with viewport pixels, not particle count — bumping the simulation to 4M particles wouldn't change the wire size at all, the cells would just get fuller.

The mechanism behind the per-client crop is simple. The server keeps a per-client camera `(x, y, width, height)` taken from `canvas.getBoundingClientRect()` at runtime, crops that rectangle from the world buffer, and writes the bytes straight to that client's WebSocket. A typical desktop window of 1410 × 730 CSS pixels packs to 1410 × 730 / 8 ≈ 129 KB. The client sees about 21% of the world and pans by changing the camera.

That bandwidth-adapts-to-the-window property is what the original gets for free from owning the socket — it talks to *each* client about *that* client's window. Put a fan-out transport in the middle and that property goes away. Getting it back without losing fan-out is what the rest of this post is about.

## How it fits together

```
   ┌────────────────────────────────┐
   │  Go backend (particle sim)     │
   │  60 Hz sim · 30 Hz publish     │
   └────┬──────────────────────▲────┘
        │                      │
        │ POST /api/publish    │ HTTP RPC proxy
        │ (frame bytes)        │ (cursor input)
        ▼                      │
   ┌────────────────────────────────┐
   │          Centrifugo            │
   │  single channel · WS fan-out   │
   └────┬──────────────────────▲────┘
        │ binary WS frames     │ WS RPC (cursor)
        ▼                      │
       ┌───┐ ┌───┐ ┌───┐ ┌───┐ │
       │ B │ │ B │ │ B │ │ B │─┘   browsers
       └───┘ └───┘ └───┘ └───┘
```

Frames flow down: the backend publishes one binary payload per tick to a single Centrifugo channel; every subscribed browser receives the same WebSocket frame. Cursor input flows back up: each browser sends an RPC over its WebSocket, and Centrifugo proxies it to the backend's HTTP RPC endpoint.

And it worked pretty well — particles flowing, multiple browsers in sync, cursor input pulling particles around just like the original:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_particles.mp4"></video>

## The naive port packs 605 KB per frame

Two different models meet here. The original sends **different bytes to each client** — its own viewport crop. Centrifugo's model is **pub/sub fan-out**: the backend publishes once, every subscriber on that channel gets the same bytes. That's the property that lets a single node broadcast efficiently to thousands of viewers from one publish.

Given those two models, two ways out come to mind.

The first is **one channel per client** — `viewport:<id>` for every connection. For the backend to keep its per-client crop, each browser also has to ship its current viewport up to the backend. That part is manageable through Centrifugo RPC — but every viewport change now crosses a process boundary in both directions: at 30 fps × 1000 clients you'd have 30,000 backend → Centrifugo publishes per second going down *and* a viewport-RPC stream coming up. In the original, this is just memory access: the viewport is a field on the connection struct, the crop is a loop over the world buffer, no network involved. Centrifugo can't match that — it's a separate process, and the network sits in between. And on top of that, every publish now goes to exactly one subscriber, so we've also given up fan-out — the thing Centrifugo is built for. Wrong way to use the system.

The second is **one channel, one publish, with bytes sufficient for any viewer** — and that's what we picked. The simplest "sufficient" is the entire world: 2200 × 2200 packed at 1 bit per pixel works out to ~**605 KB per frame**. Every viewer gets the same bytes; each browser decides what to render. Backend pack work goes from `O(viewers × per_client_slice)` to `O(world_size)` — flat regardless of how many viewers are connected. Only the fan-out hop scales with viewers, and that's exactly what Centrifugo is built for.

The cost: 605 KB at 30 Hz is ~18 MB/s per WebSocket. Pan still works — each browser has the whole world locally and just slides a camera over the bitmap — but the bandwidth-adapts-to-the-window property is gone: every viewer pays for the whole world regardless of what slice they're actually looking at. We'll come back to that.

## Splitting the world into tiles

The fix has to give us back **per-client adaptive bandwidth** — bytes that scale with each viewer's slice — without giving up Centrifugo's fan-out. The idea: carve the 2200 × 2200 world into a grid and let every viewer subscribe to only the tiles its viewport touches. The savings come from the tiles a viewer *doesn't* receive — so the tile count needs to be high to make a real dent. A 4 × 4 grid barely helps; a 16 × 16 grid (256 tiles) gets us close to the original's per-viewer bytes.

<TileViewportDiagram />

The natural first idea is one channel per tile — `tile:0:0`, ..., `tile:15:15`. Each viewer subscribes to the tile channels its viewport currently covers; the publisher publishes to 256 channels per tick. This works. The cost shows up every time the viewer pans: crossing a tile boundary means sending a subscribe message for each newly-entered tile and an unsubscribe for each one left behind. Each subscribe also goes through its own authorization check, because the channels are independent — there's no way to share auth across them, even though for our purposes all 256 tiles are really parts of one thing. So even small viewport movements turn into a lot of subscribe/unsubscribe traffic.

But in Centrifugo v6.8.0 we have a mechanism that seems to fit better here — shared poll.

## Enter shared-poll

A subscriber on a [shared-poll](https://centrifugal.dev/docs/server/shared_poll) channel calls `track(keys)` to declare which keys it cares about. A key is just an identifier tied to some application entity — in our case, a single tile. While the main idea of shared poll is coordinated aggregated polling, it also gives a fast low-latency path for publications: the server can publish per-key updates via the `shared_poll_publish` API, and Centrifugo only delivers each publication to subscribers currently tracking that key.

On pan, the client doesn't subscribe to anything new — it just updates its track set with `untrack(leaving)` and `track(entering)`. Centrifugo handles the rest.

For our particle demo it maps cleanly:

- Split the 2200 × 2200 world into a 16 × 16 tile grid. Each tile covers 138 × 138 world pixels, packed at 1 bpp into 18 bytes per row × 138 rows ≈ **2.5 KB per tile**.
- One channel `tiles:world` with shared-poll subscription type, 256 keys (`t_<tx>_<ty>`).
- The simulation runs as before, but every tick the publisher packs **all 256 tiles** and sends them in a single Centrifugo `/api/batch` request — 256 `shared_poll_publish` commands, one HTTP round-trip instead of 256.
- Each viewer tracks the tiles its viewport intersects, plus a 1-tile prefetch margin so freshly-entered tiles already have data when they slide into view.

The publisher side. A single monotonic version counter for all tiles, and a per-process epoch generated on startup so that a backend restart triggers Centrifugo to invalidate connected subscribers (they auto-resubscribe and pick up fresh state without a page reload):

```go
channelEpoch := uuid.NewString()
var globalVersion uint64

// On every tick:
v := atomic.AddUint64(&globalVersion, 1)
items := make([]SharedPollItem, 0, len(tilePayloads))
for i, payload := range tilePayloads {
    items = append(items, SharedPollItem{
        Key:     TileKey(i % TilesPerSide, i / TilesPerSide),
        Data:    payload,
        Version: v,
    })
}
api.BatchSharedPollPublish(ctx, "tiles:world", channelEpoch, items)
```

The batch wrapper turns that into one POST `/api/batch` carrying 256 commands:

```go
func (c *CentrifugoAPI) BatchSharedPollPublish(ctx context.Context, channel, epoch string, items []SharedPollItem) error {
    commands := make([]map[string]any, 0, len(items))
    for _, it := range items {
        commands = append(commands, map[string]any{
            "shared_poll_publish": map[string]any{
                "channel": channel,
                "key":     it.Key,
                "b64data": base64.StdEncoding.EncodeToString(it.Data),
                "version": it.Version,
                "epoch":   epoch,
            },
        })
    }
    return c.call(ctx, "batch", map[string]any{"commands": commands})
}
```

For per-key authorization the SDK calls a `getSignature` callback whenever the tracked key set changes. The callback hits a backend endpoint that returns an HMAC over `(channel, keys, expiry)` — the same shape the [drones demo](https://github.com/centrifugal/examples/tree/master/v6/shared_poll_demo/drones) uses:

```go
func MakeTrackSignature(secret, channel string, keys []string, user string, ttlSec int) string {
    now := time.Now().Unix()
    expiry := now + int64(ttlSec)
    keysHash := sha256.Sum256([]byte(strings.Join(keys, "\x00")))
    payload := fmt.Sprintf("%d:%d:%s:%s:%x", now, expiry, user, channel, keysHash)
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(payload))
    return fmt.Sprintf("%d:%d:%x", now, expiry, mac.Sum(nil))
}
```

The viewer ties it together. One subscription, a track set that follows the camera, and pan reduces to changing the set:

```javascript
const sub = centrifuge.newSharedPollSubscription('tiles:world', {
    getSignature: async (ctx) => {
        const resp = await fetch('/api/track_refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keys: ctx.keys, channel: 'tiles:world' }),
        });
        return resp.json();
    },
});

sub.on('update', (ctx) => {
    const m = /^t_(\d+)_(\d+)$/.exec(ctx.key);
    const tx = +m[1], ty = +m[2];
    applyTile(tx, ty, ctx.data);  // decode this tile's bytes into the world buffer
});

function updateTracking() {
    const want = visibleTileKeys();   // viewport ∩ tile grid + 1-tile margin
    const toTrack = [...want].filter(k => !trackedKeys.has(k));
    const toUntrack = [...trackedKeys].filter(k => !want.has(k));
    if (toUntrack.length) sub.untrack(toUntrack);
    if (toTrack.length)   sub.track(toTrack.map(k => ({ key: k, version: 0 })));
}
```

`applyTile` decodes a single tile's packed bitmap into a `Uint32Array(2200 * 2200)` world buffer at the tile's world position. A `requestAnimationFrame` loop blits the camera-cropped slice into a window-sized display canvas every paint. Pan handlers (right-mouse drag, arrow keys, WASD) update the camera, call `updateTracking()`, and the broker adjusts which tiles flow to this viewer.

The result where we also show movement over the world:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_particles_2.mp4"></video>

## The result

Same simulation, same MacBook 1410 × 730 viewport. Bytes per frame, per viewer:

| Approach | Per frame | Visibility |
|---|---|---|
| Original (per-client crop, raw WS) | ~129 KB | viewport-sampled, panable |
| Single channel `fanout` (whole world) | ~605 KB | whole world shipped to everyone; viewer pans client-side |
| **`shared_poll` tiles** | **~135 KB** | only the tiles a viewer's pan-window touches |

The shared-poll variant lands within 5% of the original's bytes-per-frame on a standard MacBook screen, at full per-pixel resolution, with the original's pan-the-world UX, *and* with fan-out preserved. Two viewers looking at overlapping regions share the publish for tiles in the overlap; ten viewers all looking at the same area cost the same outbound bandwidth from Centrifugo as one viewer.

The work between the backend and Centrifugo doesn't grow with viewer count: 256 tiles × 2.5 KB × 30 Hz ≈ 19 MB/s, no matter how many viewers are connected or where they're looking. The original kept bandwidth low by cropping per client; ours keeps it low by delivering each tile only to the viewers tracking it. Different mechanism, same result.

One more thing comes for free: horizontal scaling. The demo runs on a single Centrifugo node, but switching the broker to [Redis or NATS](https://centrifugal.dev/docs/server/engines) lets the same shared-poll setup run across many Centrifugo nodes. Both engines forward tile publications between nodes, so a tile published on any node reaches viewers connected to any other node. Viewers can connect to whichever node is least busy, and the application code doesn't change. None of this comes for free with a hand-written socket server.

```bash
docker compose up --build                          # default: fanout (whole world)
MODE=shared_poll docker compose up --build         # shared-poll tiles, full-res, panable
```

## What this taught us

When your application doesn't own each WebSocket directly, there are trade-offs. Centrifugo is a separate server with a generic transport — that's a lot of what makes it useful, but it also means you can't shape what each viewer sees the way you can when you own the socket. We hit exactly that here: we initially missed that the original keeps bandwidth low by cropping per client, and a naive single-channel port had every viewer pay for the whole world.

Shared-poll subscriptions turned out to fit well: tracking keys per subscriber gave us back the per-client bandwidth without giving up fan-out. And with that piece in place, the rest comes from Centrifugo for free — SDKs, scaling across nodes, and an efficient broadcast core.

The full source, both modes selectable via env var, is in [`v6/millions_of_particles`](https://github.com/centrifugal/examples/tree/master/v6/millions_of_particles). Again, see David Gerrells' [original post](https://dgerrells.com/blog/how-fast-is-go-simulating-millions-of-particles-on-a-smart-tv) and [repo](https://github.com/dgerrells/how-fast-is-it).
