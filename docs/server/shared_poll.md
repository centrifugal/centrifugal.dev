---
id: shared_poll
title: Shared poll subscriptions
sidebar_label: Shared poll subscriptions ✨
---

import SharedPollDiagram from '@site/src/components/SharedPollDiagram';

:::caution Experimental

Shared poll subscriptions is an experimental feature. Configuration options, client SDK API, and proxy protocol may change in future releases. At this point only `centrifuge-js` SDK supports shared poll subscriptions on the client side.

:::

Many applications need to keep **visible items** up to date in real time: vote counts on a post list, stock prices in a watchlist, live scores on a sports page, inventory counts in a product catalog. Sometimes applications use a polling technique for near real-time updates — each client periodically fetches fresh data from the backend. Polling is simple but wasteful: most requests return unchanged data, backend load grows linearly with the number of clients, and there is an inherent trade-off between update freshness and request rate.

Shared poll subscriptions let Centrifugo revolutionize the polling. Centrifugo can act as a proxy layer between clients and your backend — clients establish persistent connection with Centrifugo, register their interest in items, Centrifugo then polls the backend once on a configurable schedule, collects current data, and pushes only the changes to interested clients over persistent connections that are already established. Instead of 10,000 clients each polling your backend every second (10,000 req/s), Centrifugo makes a single (!) request and fans out updates to all subescribers. The backend load drops from O(clients) to O(unique_items) regardless of how many users are watching.

## Why shared poll?

Each client sees a different subset of items (different pages, filters, search results), items enter and leave the viewport as the user scrolls, and the total item universe can be very large while any single client cares about a small slice. Alternative approaches have limitations:

**Why not one channel per item?** A user viewing 50 posts would need 50 subscriptions — 50 subscribe commands and replies, 50 entries in the server's subscription registry, and recovery state for each. This works, but the task is different from normal subscriptions: items are transient (they scroll in and out of view), the set changes frequently, and the client needs lightweight tracking rather than full subscription lifecycle per item.

**Why not publish to a shared channel?** A single `post_updates` channel means every client receives every update, even for items not on their screen. With 100K posts and 1% changing per second, every client gets 1000 messages/second when they only need updates for their 30 visible items. Server-side filtering per client would require per-connection state management within the channel — which is exactly what shared poll provides, but with a simpler model.

**Why not push from the application backend?** The backend could publish to Centrifugo on every data change. This works well for low-frequency updates but has drawbacks: (1) every write path must include a publish call, adding coupling and latency; (2) services that don't control the data source (third-party APIs, shared databases, legacy systems) can't easily add publish hooks; (3) the backend must know which items are currently tracked to avoid publishing updates nobody needs — without that knowledge, it publishes everything. Shared poll inverts this: Centrifugo tells the backend exactly which items are being watched, and the backend only needs to return current state — no publish integration required.

## Overview

Shared poll subscriptions use a keyed channel mode where clients explicitly track specific keys (with token-based authorization) to receive data. Centrifugo aggregates tracked keys across all clients and polls the backend periodically, fetching only tracked items in batches. Per-key version comparison ensures only changed items are delivered to the right clients.

The trade-off is latency: updates arrive within the polling interval (configurable, default 10s) rather than instantly on write. This is acceptable for use cases like vote counts, view counts, prices, and scores where near-real-time (seconds) is sufficient and the simplicity of not integrating publish calls into every write path is valuable. For instant delivery, use regular pub/sub channels with application-driven publish.

### How it works

<SharedPollDiagram />

1. Clients subscribe to a shared poll channel and **track** specific items by key
2. Centrifugo collects all tracked keys across all connections
3. On a configurable interval, Centrifugo calls your backend proxy with the list of tracked keys
4. Your backend returns current data and version for each key
5. Centrifugo compares versions with what clients already have and pushes only changed items
6. Items not returned by the backend for several consecutive cycles are marked as **removed**

Your backend is called once per refresh cycle regardless of how many clients are tracking the same items — Centrifugo handles the fan-out. When items are split into multiple batches, Centrifugo spreads batch dispatches evenly over the refresh interval rather than issuing them all at once, reducing burst load on your backend.

```
Refresh cycle (interval=1s, 3000 tracked keys, batch_size=1000)

 Clients            Centrifugo                        Backend
 ───────            ──────────                        ───────
   │                     │                               │
   │  track(keys)        │                               │
   ├────────────────────►│                               │
   │                     │  collect all tracked keys     │
   │                     │  split into batches           │
   │                     │                               │
   │              t=0    │── batch 1 (keys 1-1000) ─────►│
   │                     │                               │
   │            t=333ms  │── batch 2 (keys 1001-2000) ──►│
   │                     │                               │
   │            t=666ms  │── batch 3 (keys 2001-3000) ──►│
   │                     │                               │
   │                     │◄── responses ─────────────────│
   │                     │                               │
   │                     │  compare versions             │
   │                     │  per client                   │
   │                     │                               │
   │  update(key, data)  │                               │
   │◄────────────────────│  push only changed items      │
   │                     │                               │
   │              t≈1s   │  next cycle starts            │
   │                     │                               │
```

**Key design principle**: `subscribe` is lightweight (no data delivery, no recovery). The `track` command is where data starts flowing. This ensures the server has the tracked key set atomically — no race window between subscribe and first data delivery.

**Authentication**: shared poll channels work for both authenticated and anonymous users. An empty user ID is a valid case — common for public content like product prices or post vote counts where no login is required.

### Authorization with HMAC signatures

Shared poll uses HMAC signatures to authorize which items a client can track. Your backend generates a signature over the list of keys, and the client presents it when calling `track()`. This ensures clients can only track items your backend has explicitly authorized.

The signature string has the format:

```
iat:exp:hmac_hex
```

Where:

- `iat` — issued-at Unix timestamp (seconds)
- `exp` — expiry Unix timestamp (seconds), `0` for no expiry
- `hmac_hex` — hex-encoded HMAC-SHA256

The HMAC is computed over the following payload:

```
HMAC-SHA256(secret, "iat:exp:user_id:channel:keys_hash")
```

Where `keys_hash` is the hex-encoded SHA-256 of sorted keys joined with null bytes (`\x00`), and `secret` is the `hmac_secret_key` from the `shared_poll` configuration. The `user_id` is the authenticated user's ID (empty string for anonymous users).

Your backend generates this signature when the client requests authorization for a set of keys. Centrifugo verifies the HMAC on every `track()` call and rejects requests with invalid or expired signatures (with a 30-second grace period after expiry).

## Configuration

Shared poll subscriptions are configured per channel namespace using `subscription_type: "shared_poll"`.

### Minimal example

```json title="config.json"
{
  "shared_poll": {
    "hmac_secret_key": "your-secret-key"
  },
  "channel": {
    "proxy": {
      "shared_poll_refresh": {
        "endpoint": "http://localhost:3001/centrifugo/refresh",
        "timeout": "5s"
      }
    },
    "namespaces": [
      {
        "name": "post_votes",
        "subscription_type": "shared_poll",
        "shared_poll": {
          "refresh_interval": "1s",
          "max_keys_per_connection": 5000,
          "max_consecutive_absences": 2
        },
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

### Proxy configuration

The shared poll refresh proxy defines how Centrifugo calls your backend to fetch item data. It can be configured in two ways:

**Default proxy** — set in `channel.proxy.shared_poll_refresh` (used when `proxy_name` is not specified in namespace config):

```json
{
  "channel": {
    "proxy": {
      "shared_poll_refresh": {
        "endpoint": "http://localhost:3001/centrifugo/refresh",
        "timeout": "5s"
      }
    }
  }
}
```

**Named proxy** — reference a proxy from the `proxies` array by name:

```json
{
  "proxies": [
    {
      "name": "poll_backend",
      "endpoint": "http://localhost:3001/centrifugo/refresh",
      "timeout": "5s"
    }
  ],
  "channel": {
    "namespaces": [
      {
        "name": "post_votes",
        "subscription_type": "shared_poll",
        "shared_poll": {
          "proxy_name": "poll_backend"
        },
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

### Top-level options

Top-level `shared_poll` configuration section:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `hmac_secret_key` | string | | **Required.** Secret key for HMAC signature verification of tracked items |
| `hmac_previous_secret_key` | string | | Previous secret key, used during key rotation. Signatures signed with this key are still accepted |
| `hmac_previous_secret_key_valid_until` | integer | `0` | Unix timestamp. Signatures with `iat` after this value are rejected even if they match the previous key. `0` means no time limit |
| `concurrency_limit` | integer | `64` | Maximum number of concurrent backend proxy calls across all shared poll channels |

### Namespace options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `proxy_name` | string | `"default"` | Name of the proxy to call for refresh. When empty or `"default"`, uses `channel.proxy.shared_poll_refresh` |
| `refresh_interval` | [duration](./configuration.md#duration-type) | `"10s"` | How often to poll the backend for updates |
| `refresh_batch_size` | integer | `1000` | Maximum number of items per proxy call |
| `max_keys_per_connection` | integer | `5000` | Maximum items a single connection can track |
| `refresh_mode` | string | `"full"` | Refresh request format. `"full"` (default): backend returns all items. `"diff"`: item versions included in request, backend returns only changed items |
| `max_consecutive_absences` | integer | `2` | Number of consecutive refresh cycles an item can be absent before it's marked removed |
| `channel_shutdown_delay` | [duration](./configuration.md#duration-type) | `"0s"` | Delay before cleaning up a channel after the last item is untracked |
| `track_expired_extra_delay` | [duration](./configuration.md#duration-type) | `"25s"` | Extra time given to client to refresh track signature after it expires. Keys not refreshed within this delay are silently removed from server state |

## Proxy protocol

The shared poll refresh proxy uses the standard Centrifugo proxy protocol (HTTP or gRPC). The proxy operates in one of two modes depending on the `refresh_mode` option.

### Full mode (default)

When `refresh_mode` is `"full"` (default), Centrifugo sends item keys without versions:

```json
{
  "channel": "post_votes:feed1",
  "items": [
    {"key": "post_123"},
    {"key": "post_456"}
  ]
}
```

The backend must return full data for every requested item on every cycle. This is the simplest mode — the backend doesn't need to track versions or detect changes, it just returns the current state. Centrifugo compares versions internally and only pushes updates to clients when a version changes.

### Diff mode

When `refresh_mode` is `"diff"`, Centrifugo includes the last known version for each item:

```json
{
  "channel": "post_votes:feed1",
  "items": [
    {"key": "post_123", "version": 5},
    {"key": "post_456", "version": 0}
  ]
}
```

A version of `0` means the item has never been received. The backend can use versions to skip data for unchanged items — return the item with `key` and `version` but without `data`. This reduces response payload size when most items haven't changed.

**Important:** the backend must still include every requested item in the response (at minimum `key` + `version`). Items completely omitted from the response are counted toward `max_consecutive_absences` and will eventually trigger removal events.

### Response

Your backend responds with a `SharedPollRefreshResponse`:

```json
{
  "result": {
    "items": [
      {
        "key": "post_123",
        "data": {"votes": 42, "title": "Hello"},
        "version": 6
      },
      {
        "key": "post_456",
        "data": {"votes": 7, "title": "World"},
        "version": 1
      }
    ]
  }
}
```

Each item in the response:

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Item key |
| `data` | JSON | Current item data |
| `version` | uint64 | Item version (must increase on changes) |
| `removed` | boolean | If `true`, item is explicitly removed |

In full mode, items not included in the response are counted toward the `max_consecutive_absences` threshold. After reaching the threshold, Centrifugo sends a removal event to tracking clients.

### Error response

Return an error to signal a problem:

```json
{
  "error": {
    "code": 1000,
    "message": "backend unavailable"
  }
}
```

When an error is returned, Centrifugo skips the refresh cycle and retries on the next interval.

## Client SDK API

:::info

At this point only `centrifuge-js` SDK supports shared poll subscriptions.

:::

### Creating a shared poll subscription

```javascript
const sub = client.newSharedPollSubscription('post_votes:feed1', {
  getSignature: async (ctx) => {
    // Request signature from your backend for the tracked keys
    const resp = await fetch('/api/sign-poll', {
      method: 'POST',
      body: JSON.stringify({ channel: ctx.channel, keys: ctx.keys }),
    });
    const { signature, keys } = await resp.json();
    return { signature, keys };
  },
  delta: 'fossil',  // optional: enable delta compression
});

sub.subscribe();
```

### Tracking items

After subscribing, track items by key with an HMAC signature:

```javascript
const signature = await getSignatureFromBackend(['post_123', 'post_456']);

await sub.track([
  { key: 'post_123', version: 0 },
  { key: 'post_456', version: 0 },
], { signature });
```

The `version` should be `0` for newly tracked items. If the client already has a cached version, pass it to avoid receiving data the client already has.

### Untracking items

```javascript
await sub.untrack(['post_123']);
```

### Events

**`update`** — emitted when an item changes:

```javascript
sub.on('update', (ctx) => {
  if (ctx.removed) {
    removeItem(ctx.key);
  } else {
    upsertItem(ctx.key, ctx.data, ctx.version);
  }
});
```

Standard subscription events (`subscribing`, `subscribed`, `unsubscribed`, `error`) also work.

### Delta compression

When `delta: 'fossil'` is enabled, Centrifugo sends [fossil delta](./delta_compression.md) patches instead of full data when the change is small. The SDK applies the patch automatically — the `update` event always contains the full reconstructed data.

For delta compression to work effectively with shared poll, configure `keep_latest_data: true` in the namespace (this is a [Centrifugo PRO](../pro/overview.md) feature) or return `prev_data` from your proxy response.

## Example

### Live vote results

Server configuration:

```json title="config.json"
{
  "shared_poll": {
    "hmac_secret_key": "demo-poll-secret"
  },
  "channel": {
    "proxy": {
      "shared_poll_refresh": {
        "endpoint": "http://localhost:3001/centrifugo/refresh",
        "timeout": "5s"
      }
    },
    "namespaces": [
      {
        "name": "post_votes",
        "subscription_type": "shared_poll",
        "shared_poll": {
          "refresh_interval": "1s",
          "refresh_batch_size": 1000,
          "max_keys_per_connection": 5000,
          "max_consecutive_absences": 2
        },
        "allowed_delta_types": ["fossil"],
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

Backend proxy handler (returns current vote counts):

```python
@app.post("/centrifugo/refresh")
async def shared_poll_refresh(request):
    data = await request.json()
    channel = data["channel"]
    items = data.get("items", [])

    results = []
    for item in items:
        key = item["key"]
        # Fetch current vote data from your database
        vote_data = await db.get_votes(key)
        if vote_data:
            results.append({
                "key": key,
                "data": vote_data,
                "version": vote_data["version"],
            })

    return {"result": {"items": results}}
```

Client code:

```javascript
const sub = client.newSharedPollSubscription('post_votes:feed1', {
  getSignature: async (ctx) => {
    const resp = await fetch('/api/sign-poll', {
      method: 'POST',
      body: JSON.stringify({ keys: ctx.keys }),
    });
    return resp.json();
  },
});

sub.on('update', (ctx) => {
  if (ctx.removed) {
    hideVoteWidget(ctx.key);
  } else {
    updateVoteWidget(ctx.key, ctx.data);
  }
});

sub.subscribe();

// Track posts visible on screen
const postKeys = getVisiblePostIds();
const signature = await getSignature(postKeys);
await sub.track(
  postKeys.map(key => ({ key, version: 0 })),
  { signature }
);

// On scroll, track/untrack as posts enter/leave viewport
window.addEventListener('scroll', throttle(async () => {
  const visible = getVisiblePostIds();
  const current = sub.trackedKeys();
  const toTrack = visible.filter(k => !current.has(k));
  const toUntrack = [...current].filter(k => !visible.includes(k));

  if (toTrack.length > 0) {
    const sig = await getSignature(toTrack);
    await sub.track(toTrack.map(k => ({ key: k, version: 0 })), { signature: sig });
  }
  if (toUntrack.length > 0) {
    await sub.untrack(toUntrack);
  }
}, 200));
```

## Demos

An interactive demo showcasing shared poll subscriptions is available in the [shared_poll_demo](https://github.com/centrifugal/examples/tree/master/v6/shared_poll_demo) example. It demonstrates live vote results with a Go backend, fossil delta compression, and dynamic item tracking as posts scroll into view.
