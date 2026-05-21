---
title: "Recreating a Two Million Particle World at 30 Hz with Centrifugo"
tags: [centrifugo, websocket, demo, performance]
description: "Recreating David Gerrells' 2M-particle multiplayer simulation on top of Centrifugo WebSocket protocol. The naive single channel fanout balloons each tick from 129KB to 605KB. We explore how to improve that given Centrifugo nature and good UX in mind."
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/cover_2_million_particles.png
date: 2026-05-21T18:00:00
hide_table_of_contents: false
---

import TileViewportDiagram from '@site/src/components/TileViewportDiagram';

David Gerrells wrote a blog post [*How fast is Go - simulating millions of particles on a smart TV*](https://dgerrells.com/blog/how-fast-is-go-simulating-millions-of-particles-on-a-smart-tv) — describing a Go server that simulates two million particles in a 2200 × 2200 world at 60 Hz, ships frames to clients at 30 Hz over WebSocket, and lets anyone connected pull particles around with their cursor. The transport is hand-written for speed: bit-packed binary frames, manual protocol, raw WebSocket library. The live demo runs at [howfastisgo.dev](https://howfastisgo.dev/) — try it before reading on.

<div class="vimeo-full-width">
   <iframe src="https://www.youtube.com/embed/cGubp-wOt7Q" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
</div>
<p></p>

David's goal was to explore Go performance. Once we saw the demo we immediately wanted to try reproducing it on top of Centrifugo — to see whether a generic real-time transport like Centrifugo could carry this kind of payload. At first glance it looked straightforward: Centrifugo provides a binary WebSocket transport, and the simulation already runs on the server. But along the way we ran into design differences that meant we couldn't quite match the original's per-viewer bytes on the wire. We'll show what we built, what it cost, and why the overhead is worth it for UX and scalability.

Source code of our final demo: [`v6/millions_of_particles`](https://github.com/centrifugal/examples/tree/master/v6/millions_of_particles).

<!--truncate-->

## Recap the original

The "two million particles" lives entirely on the server. What goes to clients is a **density map** — one bit per world cell, answering *"is there any particle in this cell?"*. Several particles in the same cell collapse to one bit. Bytes per frame scale with viewport pixels, not particle count — bumping the simulation to 4M particles wouldn't change the wire size at all, the cells would just get fuller.

The server runs everything in one Go process: the simulation, the WebSocket connections, and per-client camera state. On every tick it walks the connected clients, reads each one's camera `(x, y, width, height)` shipped up from the browser, crops that rectangle from the world buffer, and writes the bit-packed bytes straight to that client's WebSocket. A typical desktop window of 1410 × 730 pixels packs to 1410 × 730 / 8 ≈ **129 KB per tick** — that's all a viewer ever receives. The client sees about 21% of the world and pans by changing the camera; cursor input flows back up the same WebSocket and pulls particles around in the simulation.

That tight coupling — sim, sockets, and per-client cameras all in the same process — is what keeps the original lean per viewer: the server cuts a custom message for each connection because everything it needs is right there. Now let's see what changes when we put a generic broker in the middle.

## How it fits with Centrifugo

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

The backend publishes one binary payload per tick to a single Centrifugo channel; every subscribed browser receives the same WebSocket frame and slides a local camera over the bitmap to render its slice. Cursor input flows back via RPC over WebSocket, proxied to the backend's HTTP endpoint.

The publisher's job is constant: pack the whole 2200 × 2200 world at 1 bit per pixel, send to a channel — and that's it – Centrifugo handles the fan-out. Pan works locally too: each browser has the whole world in memory and just slides a camera over the bitmap.

<video width="100%" controls preload="metadata" src="/img/demo_particles_tiny.mp4"></video>

See in [better quality on YouTube](https://youtu.be/VA3s0iowel4).

It works — but at roughly 5× the bytes the original sends to each viewer (~605 KB vs. ~129 KB). It's by design: Centrifugo is a standalone broker. It doesn't know about user cameras, viewports, or which slice each viewer cares about, so a single channel has to ship bytes useful for any subscriber, and the simplest "useful" is the whole world.

And the gap widens with world size. Bump the world to 10000 × 10000 and the naive port ships ~12.5 MB per viewer per tick, while the original would still send ~129 KB — each viewer only pays for their viewport. The naive approach scales with world size; the original scales with viewport size. So we have a real reason to find a better fit.

We could try one channel per viewer, with the backend tracking each camera and packing an individual crop per tick. That would get us closer to the original's ~129 KB per viewer, but it gives up fan-out — the thing Centrifugo is built for — and turns every viewport change into RPC traffic up plus a per-client publish down. The backend would also need to track camera state per connection — easy in the original's single-process design, awkward when Centrifugo sits in between.

So we want fewer bytes per viewer and keep fan-out.

## Splitting the world into tiles

The idea: split the world into tiles, and let each viewer subscribe only to the tiles its viewport is touching. The publisher still packs the world once per tick; Centrifugo only delivers each tile to viewers tracking it.

A tile is a fixed-rectangle chunk of the world. The grid is set up front — same tiles for every viewer. Every tick the publisher packs each tile in the same bit-packed format used for the whole world before (just smaller, and many of them). Viewers subscribe to the keys for the tiles their viewport currently overlaps; Centrifugo only delivers each tile to viewers tracking it. As the camera moves, the tracked set shifts to follow.

Three things to settle in this design: pan behavior at tile boundaries, what tile size to pick, and how to actually deliver tiles to viewers. In that order.

**Pan.** A viewer's camera can move at any moment, and when the viewport crosses a tile boundary the newly-revealed tile wouldn't be subscribed yet — we'd see a strip of empty pixels until the next publish landed. Visible pop-in on the leading edge of the motion.

The fix is a small **prefetch margin**: pre-track the next ring of tiles around the viewport, so freshly-revealed tiles already have data when they slide into view. Panning stays smooth at the cost of a few extra tiles always being subscribed.

<TileViewportDiagram />

**Tile size.** The savings come from the tiles a viewer *doesn't* receive — so the tile count needs to be high to make a real dent. A 4 × 4 grid barely helps; a 32 × 32 grid (1024 tiles) tracks the viewport tightly enough to land within striking distance of the original's per-viewer bytes.

**Delivery.** The natural first idea is one channel per tile — `tile:0:0`, ..., `tile:31:31`. Each viewer subscribes to the tile channels its viewport currently covers; the publisher publishes to 1024 channels per tick. This works. The cost shows up every time the viewer pans: crossing a tile boundary means sending a subscribe message for each newly-entered tile and an unsubscribe for each one left behind. Each subscribe also goes through its own authorization check, because the channels are independent — there's no way to share auth across them, even though for our purposes all 1024 tiles are really parts of one thing. So even small viewport movements turn into a lot of subscribe/unsubscribe traffic.

But in Centrifugo v6.8.0 we have a mechanism that seems to fit better here — Shared Poll subscriptions.

## Enter shared poll

A subscriber on a [Shared Poll](https://centrifugal.dev/docs/server/shared_poll) channel calls `track(keys)` to declare which keys it cares about. A key is just an identifier tied to some application entity — in our case, a single tile.

What makes Shared Poll fit here is its tracking model, not the polling itself: one channel, many keys, with each viewer declaring which keys it cares about. The name comes from its main delivery mode — Centrifugo aggregates tracked keys and asks the backend for updates on a timer — but it also has a direct publish path (`shared_poll_publish`), which is what we will use here to have low latency world updates. Centrifugo only delivers a key's bytes to viewers currently tracking that key. That's the property we need.

On pan, the client doesn't subscribe to anything new — it just updates its track set with `untrack(leaving)` and `track(entering)`. Centrifugo handles the rest.

For our particle demo it maps cleanly:

- Split the 2200 × 2200 world into a 32 × 32 tile grid. Each tile covers 69 × 69 world pixels (⌈2200/32⌉ = 69; the rightmost and bottom tile columns overhang the world by 8 pixels of off-world margin), packed at 1 bpp into 9 bytes per row × 69 rows = **621 bytes per tile**.
- One channel `tiles:world` with shared-poll subscription type, 1024 keys (`t_<tx>_<ty>`).
- The simulation runs as before, but every tick the publisher packs **all 1024 tiles** and sends them in a single Centrifugo `/api/batch` request — 1024 `shared_poll_publish` commands, one HTTP round-trip instead of 1024.
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

The batch wrapper turns that into one POST `/api/batch` carrying 1024 commands:

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

`applyTile` decodes a single tile's packed bitmap into the client's world buffer at the tile's world position. The buffer is allocated for the full 2200 × 2200 world (`Uint32Array(2200 * 2200)`), but only the regions covered by tracked tiles ever get filled — everywhere else stays zero. A `requestAnimationFrame` loop copies the camera-cropped slice from this buffer onto a window-sized display canvas every paint. Pan handlers (right-mouse drag, arrow keys, WASD) update the camera, call `updateTracking()`, and the broker adjusts which tiles flow to this viewer.

## The result

The result where we also show movement over the world:

<video width="100%" controls preload="metadata" src="/img/demo_particles_2_tiny.mp4"></video>

See in [better quality on YouTube](https://youtu.be/R32qXLu8GOU).

Same simulation, same MacBook 1410 × 730 viewport. Now let's compare:

| Approach | Data Size Per tick | Pan & delivery |
|---|---|---|
| Original (per-client crop, raw WS) | ~129 KB | viewport-only; pan tied to 30 Hz publish rate |
| Single channel `fanout` (whole world) | ~605 KB | whole world cached client-side; pan local at any frame rate |
| **`shared_poll` tiles** | ~186 KB | viewport tiles + prefetch margin; pan local at browser frame rate |

Each tile is its own WebSocket message (Centrifugo can batch them into one frame); the **~186 KB** is the average sum across the tile messages a single viewer receives per 30 Hz tick.

The shared-poll variant lands at 1.44× the original's per-tick bytes on a standard MacBook screen, at full resolution, with full panning support, and with fan-out preserved. Worth unpacking why.

**Where the extra bytes come from.** Three things stack up:

| Component | Bytes/tick | Ratio |
|---|---|---|
| Pure viewport (1410 × 730 / 8) | ~129 KB | 1.00× |
| + Tile alignment (21 × 11 tiles, no prefetch) | ~143 KB | 1.11× |
| **+ 1-tile prefetch margin (23 × 13 tiles tracked)** | **~186 KB** | **1.44×** |

Each tile is 69 px (⌈2200/32⌉). A 1410 × 730 viewport touches ⌈1410/69⌉ × ⌈730/69⌉ = **21 × 11 = 231 tiles**; with a one-tile prefetch ring, **23 × 13 = 299 tiles**. At 621 bytes per tile: 231 × 621 ≈ **143 KB** without prefetch, 299 × 621 ≈ **186 KB** with.

Tile alignment is the small overhead: your viewport rarely lines up with tile edges, so the tiles around its border load in full even when only a strip of each is actually visible (that's the 1.11× row). Prefetch is the bigger cost, and it's a UX choice: without it, panning into a fresh tile would render zeros until `track()` lands and the next publish arrives — visible pop-in on the leading edge.

**Why smaller tiles don't help.** Two effects pull in opposite directions as tile size shrinks:

- **The prefetch ring shrinks in pixels.** A one-tile margin on each side gets smaller as tiles do, so prefetch waste drops linearly with tile size.
- **Per-tile fixed overhead grows in total.** Each tile is its own `shared_poll_publish` frame with key, version, epoch, and framing bytes — plus byte-alignment loss inside the 1bpp packing (a 35-px row still needs 5 bytes, with most of the last byte wasted). Halving tile size yields 4× more tiles, so those fixed costs scale up 4×.

The two roughly cancel — the ratio stays near the same value across a wide range of grid sizes. Going larger makes prefetch waste dominate; going smaller makes per-tile overhead dominate. That ceiling is built into the tile model whenever you also want panning to stay smooth — it's not something you can tune away.

**Why prefetch exists at all — and why pans feel smoother because of it.** The two designs differ in *where the world lives* on the client.

The original has no client-side world cache. Every frame is the server-packed bitmap of exactly the current viewport. Pan is a server roundtrip — new camera up, new viewport down — so pan latency is 1 RTT + 1 tick, and pan smoothness is bounded by the 30 Hz publish rate. Quick pans visibly stutter.

Tile mode puts the world *partially* on the client. Each viewer keeps a local buffer of its tracked tiles and re-crops it on every `requestAnimationFrame` (60+ Hz, well above the publish rate). Pans inside already-loaded tiles paint instantly from this buffer — that's why pan feels smooth, not anything happening on the wire.

The catch: the cache has edges. Pan into a tile you weren't tracking and you'd render zeros until `track()` lands and the next publish delivers the bytes — ~33–66 ms of pop-in. Prefetch fills those edges by keeping the next ring of tiles always subscribed.

So prefetch is the price of having a local cache, and the local cache is what makes pans feel smoother. They come together.

**What the broker model gives you.** That overhead isn't what you pay for the broker — it's the cost of prefetch + alignment *within* the broker model. What the broker actually brings doesn't show up in bytes per viewer at all:

- **Publish work is flat in viewer count.** The publisher packs tiles once per tick and sends them once. One viewer or a thousand, same job; Centrifugo fans out from there. Backend → Centrifugo stays at ~19 MB/s regardless of who's connected.
- **Multi-node is just configuration.** Switch the broker to [Redis or NATS](https://centrifugal.dev/docs/server/engines) and the same setup runs across many Centrifugo nodes — tiles published anywhere reach viewers anywhere, viewers connect to whichever node is least busy, and the publisher doesn't know how many nodes exist. Application code unchanged.

The trade: 1.44× bytes per viewer, in exchange for fan-out that doesn't grow with viewer count and multi-node by configuration. The original was built for a different goal — exploring Go performance in a single-process design — and it's excellent at that. A project that needed both 1.0× per-viewer bytes *and* multi-node would have to build the broker layer itself.

Both modes are wired into a single docker-compose; pick one with the `MODE` env var:

```bash
docker compose up --build                          # default: fanout (whole world)
MODE=shared_poll docker compose up --build         # shared-poll tiles, full-res, panable
```

## What this taught us

We re-implemented the demo in Centrifugo. We didn't match the original's WebSocket bytes — but the trade buys better publish scalability and smoother panning.

The breakdown above pins almost all of the per-viewer overhead on prefetch — drop it and you're at 1.11×, with visible pop-in on the leading edge during fast pans. So the byte overhead is essentially the price of a UX choice we made, not the price of using Centrifugo.

Shared Poll subscriptions are a clean way to track many objects with a single subscription — `track`/`untrack` is one protocol frame for multiple keys, no per-object subscribe handshake. The name comes from the polling delivery mode, but versioned mode also exposes a fast push path (`shared_poll_publish`), which is what gives us low-latency world updates here.

The full source, both modes selectable via env var, is in [`v6/millions_of_particles`](https://github.com/centrifugal/examples/tree/master/v6/millions_of_particles). Again, see David Gerrells' [original post](https://dgerrells.com/blog/how-fast-is-go-simulating-millions-of-particles-on-a-smart-tv) and [repo](https://github.com/dgerrells/how-fast-is-it).
