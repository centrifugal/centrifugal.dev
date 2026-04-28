---
id: shared_poll
title: "Shared poll 🔮"
sidebar_label: "Shared poll 🔮"
---

import SharedPollDiagram from '@site/src/components/SharedPollDiagram';
import SharedPollPublishDiagram from '@site/src/components/SharedPollPublishDiagram';

:::caution Experimental

Shared poll subscriptions is an experimental feature available since **Centrifugo v6.8.0**. Configuration options, client SDK API, and proxy protocol may change in future releases. At this point only `centrifuge-js` SDK supports shared poll subscriptions on the client side.

:::

Many applications poll the backend to keep data fresh — vote counts, stock prices, live scores, inventory levels, configuration. Polling is simple but wasteful: most requests return unchanged data, backend load grows linearly with the number of clients, and there is an inherent trade-off between update freshness and request rate.

Shared poll subscriptions move the polling from clients to Centrifugo. Clients establish a persistent connection, register their interest in specific items, and Centrifugo polls the backend once on a configurable schedule — collecting current data and pushing only the changes to interested clients. Instead of 10,000 clients each polling your backend every second, Centrifugo makes a single request and fans out updates to all subscribers. The backend load depends on the number of unique items being watched, not on the number of connected clients (O(unique_items) instead of O(clients)).

Your backend just answers one question: "what is the current state of these items?" This works with any data source you can read from: your own database, a third-party API, a legacy system. Since Centrifugo re-polls on a schedule, all clients always converge to the latest data (eventual consistency) — even if something is temporarily missed, the next poll cycle catches up.

## Why shared poll?

Each client sees a different subset of items (different pages, filters, search results), the set changes as users scroll, and the total item universe is large while any single client cares about a small slice.

- **Traditional channels** — one channel per item means 50 visible posts need 50 subscriptions with full lifecycle overhead. A single channel for all posts solves that but delivers every update to every client regardless of what they're watching, and lacks granular per-item authorization. Shared poll combines the best of both: per-item granularity with per-key HMAC authorization, but only a single subscription.

- **Push from the backend** — couples every write path to a publish call, requires the backend to know what's currently tracked, and doesn't work for third-party data sources or legacy systems. Shared poll inverts this: Centrifugo tells the backend which items are watched, and the backend just returns current state.

## Overview

Clients subscribe to a shared poll channel, then **track** specific keys to start receiving data. Centrifugo aggregates tracked keys across all connections and polls the backend periodically, fetching only tracked items in batches. Centrifugo detects changes and pushes only updated items to interested clients.

The trade-off is latency: updates arrive within the polling interval (configurable, default 10s) rather than instantly on write. This is acceptable for use cases like vote counts, view counts, prices, and scores where near-real-time is sufficient. For instant delivery, use [direct publish](#direct-publish) or regular pub/sub channels.

### How it works

<SharedPollDiagram />

1. Clients subscribe to a shared poll channel and **track** specific items by key
2. Centrifugo collects all tracked keys across all connections
3. On a configurable interval, Centrifugo calls your backend proxy with the list of tracked keys
4. Your backend returns current data for each key (and optionally a version)
5. Centrifugo detects changes and pushes only updated items
6. Items returned with `removed: true` are removed from tracking and clients are notified

When items are split into multiple batches, dispatches are spread evenly over the refresh interval to reduce burst load.

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

`subscribe` is lightweight (no data delivery, no recovery) — `track` is where data starts flowing. Shared poll works for both authenticated and anonymous users. Backend load scales with the number of unique tracked items, not connected clients — if many clients watch the same 200 items, those 200 items are polled once per cycle.

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

Where `keys_hash` is the hex-encoded SHA-256 of keys joined with null bytes (`\x00`), and `secret` is the `hmac_secret_key` from the `shared_poll` configuration. The `user_id` is the authenticated user's ID (empty string for anonymous users).

The keys are hashed in the order they appear in the request — no canonical sort. Your backend must sign over the keys in the same order it returns them to the client; the SDK forwards that order verbatim to the server, which verifies against the keys received in the `track()` call.

Your backend generates this signature when the client requests authorization for a set of keys. Centrifugo verifies the HMAC on every `track()` call and rejects requests with invalid or expired signatures (with a 30-second grace period after expiry).

### Backend signature generation

````mdx-code-block
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs
  className="unique-tabs"
  defaultValue="python"
  values={[
    {label: 'Python', value: 'python'},
    {label: 'NodeJS', value: 'node'},
    {label: 'Go', value: 'go'},
    {label: 'Java', value: 'java'},
    {label: 'PHP', value: 'php'},
    {label: 'Ruby', value: 'ruby'},
  ]
}>
<TabItem value="python">

```python
import hashlib
import hmac
import time


def make_shared_poll_signature(
    secret: str, user_id: str, channel: str, keys: list[str], ttl: int
) -> str:
    now = int(time.time())
    exp = now + ttl

    keys_hash = hashlib.sha256("\x00".join(keys).encode()).hexdigest()

    payload = f"{now}:{exp}:{user_id}:{channel}:{keys_hash}"
    mac = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()

    return f"{now}:{exp}:{mac}"
```

</TabItem>
<TabItem value="node">

```javascript
const crypto = require('crypto');

function makeSharedPollSignature(secret, userId, channel, keys, ttl) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl;

  const keysHash = crypto
    .createHash('sha256')
    .update(keys.join('\x00'))
    .digest('hex');

  const payload = `${now}:${exp}:${userId}:${channel}:${keysHash}`;
  const mac = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return `${now}:${exp}:${mac}`;
}
```

</TabItem>
<TabItem value="go">

```go
import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"strings"
	"time"
)

func makeSharedPollSignature(
	secret, userID, channel string, keys []string, ttl int,
) string {
	now := time.Now().Unix()
	exp := now + int64(ttl)

	keysHash := sha256.Sum256([]byte(strings.Join(keys, "\x00")))

	payload := fmt.Sprintf("%d:%d:%s:%s:%x", now, exp, userID, channel, keysHash)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))

	return fmt.Sprintf("%d:%d:%x", now, exp, mac.Sum(nil))
}
```

</TabItem>
<TabItem value="java">

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

public static String makeSharedPollSignature(
        String secret, String userId, String channel,
        String[] keys, int ttl) throws Exception {
    long now = System.currentTimeMillis() / 1000;
    long exp = now + ttl;

    byte[] keysBytes = String.join("\0", keys)
            .getBytes(StandardCharsets.UTF_8);
    String keysHash = HexFormat.of().formatHex(
            MessageDigest.getInstance("SHA-256").digest(keysBytes));

    String payload = String.format(
            "%d:%d:%s:%s:%s", now, exp, userId, channel, keysHash);
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(
            secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String hmacHex = HexFormat.of().formatHex(
            mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));

    return String.format("%d:%d:%s", now, exp, hmacHex);
}
```

</TabItem>
<TabItem value="php">

```php
function makeSharedPollSignature(
    string $secret, string $userId, string $channel,
    array $keys, int $ttl
): string {
    $now = time();
    $exp = $now + $ttl;

    $keysHash = hash('sha256', implode("\x00", $keys));

    $payload = "{$now}:{$exp}:{$userId}:{$channel}:{$keysHash}";
    $mac = hash_hmac('sha256', $payload, $secret);

    return "{$now}:{$exp}:{$mac}";
}
```

</TabItem>
<TabItem value="ruby">

```ruby
require 'openssl'
require 'digest'

def make_shared_poll_signature(secret, user_id, channel, keys, ttl)
  now = Time.now.to_i
  exp = now + ttl

  keys_hash = Digest::SHA256.hexdigest(keys.join("\x00"))

  payload = "#{now}:#{exp}:#{user_id}:#{channel}:#{keys_hash}"
  mac = OpenSSL::HMAC.hexdigest('SHA256', secret, payload)

  "#{now}:#{exp}:#{mac}"
end
```

</TabItem>
</Tabs>
````

### Secret key rotation

To rotate the HMAC secret without disrupting active clients, Centrifugo supports a two-key transition:

1. Set `hmac_previous_secret_key` to your current secret
2. Set `hmac_secret_key` to the new secret
3. Optionally set `hmac_previous_secret_key_valid_until` to a Unix timestamp — signatures issued (by `iat`) after this time must use the new key

During the transition window, Centrifugo accepts signatures signed with either key. Once all clients have refreshed their signatures (which happens automatically via the `getSignature` callback on TTL expiry), remove the previous key from the configuration.

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
          "max_keys_per_connection": 5000
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
| `concurrency_limit` | integer | `64` | Maximum number of concurrent backend proxy calls across all shared poll channels. Prevents Centrifugo from overwhelming your backend when many channels refresh simultaneously. Increase if your backend can handle more parallel load; decrease if you need to protect a rate-limited or shared data source |

### Namespace options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `proxy_name` | string | `"default"` | Name of the proxy to call for refresh. When empty or `"default"`, uses `channel.proxy.shared_poll_refresh` |
| `refresh_interval` | [duration](./configuration.md#duration-type) | `"10s"` | How often to poll the backend for updates |
| `refresh_batch_size` | integer | `1000` | Maximum number of items per proxy call |
| `max_keys_per_connection` | integer | `5000` | Maximum items a single connection can track |
| `mode` | string | `"versionless"` | `"versionless"` or `"versioned"`. See [Refresh modes](#refresh-modes) for details |
| `channel_shutdown_delay` | [duration](./configuration.md#duration-type) | `"1s"` | Delay before cleaning up a channel after the last item is untracked. Useful to prevent teardown/rebuild churn when items are briefly untracked then re-tracked (e.g., during scroll jitter or page navigation). |
| `track_expired_extra_delay` | [duration](./configuration.md#duration-type) | `"25s"` | Extra time given to client to refresh track signature after it expires. Keys not refreshed within this delay are silently removed from server state |
| `publish_enabled` | boolean | `false` | Enable cross-node distribution for [direct publish](#direct-publish). When `true`, Centrifugo subscribes to the Broker for this channel, allowing `shared_poll_publish` API to distribute publications to all nodes |

## Proxy protocol

The shared poll refresh proxy uses the standard Centrifugo proxy protocol (HTTP or gRPC). The proxy operates in one of two modes depending on the `mode` option.

### Refresh modes

| | **Versionless** (default) | **Versioned** |
|---|---|---|
| **Backend returns** | `{key, data}` | `{key, data, version}` |
| **Backend receives** | `{key}` | `{key, version}` |
| **Change detection** | Centrifugo: content hash | Centrifugo: version comparison |

#### Feature comparison

| Feature | Versionless | Versioned |
|---|---|---|
| Delta compression¹ | ★★★ | ★★★ |
| Notification fast path | ★★★ | ★★★ |
| [Direct publish](#direct-publish) | ☆☆☆ | ★★★ |
| Cached initial data ([PRO](../pro/shared_poll.md#instant-initial-data)) | ☆☆☆ | ★★★ |
| Efficient reconnect² | ★★☆ | ★★★ |
| Backend-side bandwidth optimization | ☆☆☆ | ★★★ |

¹ Requires [`keep_latest_data: true`](../pro/shared_poll.md#keep_latest_data) (PRO) and delta enabled on client.

² On reconnect, client sends last received version — only newer items are delivered. In versionless mode, synthetic versions are local to each node, so reconnecting to a different node resets versions and triggers a full data re-delivery. In versioned mode, versions come from the backend and are valid across all nodes.

### Versionless mode (default)

When `mode` is `"versionless"` or `""` (default), Centrifugo sends item keys without versions:

```json
{
  "channel": "post_votes:feed1",
  "items": [
    {"key": "post_123"},
    {"key": "post_456"}
  ]
}
```

The backend returns current data for each item — **no version field needed**:

```json
{
  "result": {
    "items": [
      {
        "key": "post_123",
        "data": {"votes": 42, "title": "Hello"}
      },
      {
        "key": "post_456",
        "data": {"votes": 7, "title": "World"}
      }
    ]
  }
}
```

This is the simplest mode — the backend just returns the current state with no version tracking. Centrifugo detects changes by comparing content hashes internally and only pushes updates to clients when data actually changes.

### Versioned mode

When `mode` is `"versioned"`, Centrifugo includes the last known version for each item in the request:

```json
{
  "channel": "post_votes:feed1",
  "items": [
    {"key": "post_123", "version": 5},
    {"key": "post_456", "version": 0}
  ]
}
```

A version of `0` means the item has never been received. In versioned mode, the backend decides the response size. Always return at least `{key, version}`. Include `data` only when it changed — or always, if simplicity matters more than bandwidth.

The simplest approach — always return all data (ignore received versions):

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

Bandwidth-optimized — skip `data` for unchanged items:

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
        "version": 5
      }
    ]
  }
}
```

Here `post_456` hasn't changed since version 5, so the backend omits `data`.

Centrifugo uses versions for change detection instead of content hashing, and exposes them to clients — unlocking [direct publish](#direct-publish), cached initial data, and efficient reconnect.

In versioned mode, the backend can omit unchanged items from the response — they are treated as unchanged. To remove an item, return it with `removed: true`.

### Epoch (publisher restart resilience)

Versioned mode relies on the publisher keeping per-key versions monotonic forever. If a publisher restart resets in-memory counters, Centrifugo's stored versions stay higher than what the new process emits — version comparison drops the new publishes as stale, and connected clients freeze on their last-seen state.

**Epoch** is the protocol-level fix. The publisher generates a fresh `epoch` string at startup (UUID, `time.Now().UnixNano()`, or any value that's unique per process lifetime) and includes it in every publish and every refresh response. Centrifugo stores it as a per-channel attribute. When an incoming `epoch` differs from the stored one, Centrifugo treats the channel as fully reset:

1. All per-key versions and cached data are wiped.
2. Every current subscriber is unsubscribed with the **insufficient-state** unsubscribe code.
3. SDK auto-resubscribe machinery picks up the new epoch in the subscribe reply, drops cached versions to `0`, and replays its track set — server delivers fresh state via the standard cold-start path.

Empty epoch is a valid value and means "no epoch invalidation" — pure version comparison applies. Acceptable when the publisher process never restarts during the lifetime of any subscriber, or when bandwidth-on-restart is more important than freeze-prevention.

**Refresh response** carries `epoch` at the result level (one per response, not per item):

```json
{
  "result": {
    "epoch": "550e8400-e29b-41d4-a716-446655440000",
    "items": [
      { "key": "post_123", "data": {"votes": 42}, "version": 6 }
    ]
  }
}
```

**Direct publish** carries `epoch` per call:

```bash
curl -X POST http://localhost:8000/api/shared_poll_publish \
  -H "Authorization: apikey YOUR_KEY" \
  -d '{
    "channel": "post_votes:feed1",
    "key": "post_123",
    "data": {"votes": 43},
    "version": 7,
    "epoch": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Recommended practice**: generate the epoch once at process startup and use the same value on every publish and every refresh response from that process. Both paths must agree, or Centrifugo will see thrashing and trigger a flip on every alternating call.

**Misuse to avoid**:

- Hardcoding a stable string (e.g., a deployment version) — defeats the protection. Restarts go undetected, picture freezes again.
- Multiple publisher processes writing to the same channel with *different* epochs — Centrifugo flips on every alternating publish, causing an unsubscribe storm. Either share a single epoch (read from a coordinator/secret), or use separate channels per publisher.
- Setting `epoch` on direct publishes but not on refresh responses (or vice versa) — same thrashing.

**Cost**: a few dozen bytes per publish/refresh response. Cheap, opt-in, no downside if used correctly.

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
| `version` | uint64 | Item version — **required** in versioned mode, **optional** in versionless mode. Must increase monotonically on changes |
| `removed` | boolean | If `true`, item is removed — Centrifugo sends a removal event to tracking clients and stops tracking the key. Items omitted from the response are treated as unchanged |

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

## Direct publish

While shared poll subscriptions normally rely on timer-based polling to deliver data, the `shared_poll_publish` API lets your backend push data directly to clients without waiting for the next poll cycle. This is useful when your backend already has the data (e.g., right after a database write) and wants instant delivery.

:::note
Direct publish requires `versioned` refresh mode — it relies on explicit versions to prevent stale data from overwriting newer data. It is not available in `versionless` mode.
:::

### How it works

<SharedPollPublishDiagram />

When your backend calls `shared_poll_publish`, Centrifugo:

1. Delivers the data immediately to all clients tracking the specified key
2. Marks the key as "fresh" — the next timer-based poll cycle **skips** this key, avoiding a redundant backend call
3. Subsequent poll cycles resume polling the key normally

Direct publish complements (not replaces) the polling model. Polling continues as a safety net — if a publish is missed, the next poll cycle catches up. Notification-triggered polls (via the [notification fast path](../pro/shared_poll.md#notification-fast-path)) are **not** affected by the "fresh" flag and always trigger a backend call.

### Configuration

To distribute publications across multiple Centrifugo nodes, enable `publish_enabled` in the namespace config:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "post_votes",
        "subscription_type": "shared_poll",
        "shared_poll": {
          "refresh_interval": "1s",
          "publish_enabled": true
        },
        "allow_subscribe_for_client": true
      }
    ]
  }
}
```

When `publish_enabled` is `true`, Centrifugo subscribes to the Broker (Redis, NATS, or memory) for each active shared poll channel, enabling cross-node delivery via the existing PUB/SUB infrastructure.

When `publish_enabled` is `false` (default), `shared_poll_publish` only delivers to clients connected to the node that receives the API call. This is sufficient for single-node deployments.

### API

Call `shared_poll_publish` via the [server API](./server_api.md):

```bash
curl -X POST http://localhost:8000/api/shared_poll_publish \
  -H "Authorization: apikey YOUR_KEY" \
  -d '{
    "channel": "post_votes:feed1",
    "key": "post_123",
    "data": {"votes": 43, "title": "Hello"},
    "version": 7
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channel` | string | yes | Shared poll channel name |
| `key` | string | yes | Item key |
| `data` | JSON | yes | Item data (delivered to clients as-is) |
| `b64data` | string | | Base64-encoded data (alternative to `data` for binary payloads) |
| `version` | uint64 | yes | Item version. Must be in the same version space as versions returned by the backend poll handler. Stale versions (≤ current) within the same epoch are ignored |
| `epoch` | string | | Channel-level publisher epoch — see [Epoch](#epoch-publisher-restart-resilience). A change versus the channel's stored epoch resets per-key versions and unsubscribes current subscribers with insufficient-state code |

**Version semantics**: the version you provide must be comparable to versions returned by your `OnSharedPoll` backend handler. If the published version is less than or equal to the version Centrifugo already has for that key, the publication is silently dropped. This prevents stale data from overwriting newer data.

### Example: publish after database write

```python
import httpx

async def update_votes(post_id: str, new_count: int, version: int):
    # 1. Update your database
    await db.execute(
        "UPDATE posts SET votes = $1, version = $2 WHERE id = $3",
        new_count, version, post_id,
    )

    # 2. Push to Centrifugo immediately — no need to wait for next poll
    await httpx.AsyncClient().post(
        "http://localhost:8000/api/shared_poll_publish",
        headers={"Authorization": "apikey YOUR_KEY"},
        json={
            "channel": "post_votes:feed1",
            "key": post_id,
            "data": {"votes": new_count},
            "version": version,
        },
    )
```

### When to use direct publish vs notifications

| Approach | Use when | Latency | Backend calls |
|----------|----------|---------|---------------|
| **Timer-based polling** (default) | Simplicity is priority, seconds of latency is acceptable | Up to `refresh_interval` | One call per cycle |
| **[Notification fast path](../pro/shared_poll.md#notification-fast-path)** (PRO) | You know *which* keys changed but backend still provides data | Milliseconds | One call per notification batch |
| **Direct publish** | You already *have* the data and want instant delivery | Instant | Zero (data provided in API call) |

Direct publish and notifications can be used together. For example, most updates arrive via direct publish, but notifications serve as a fallback when your backend learns about changes it didn't initiate (e.g., from a third-party webhook).

## Quick initial data

Clients don't always have to wait for the next regular poll cycle to receive data after tracking keys. Centrifugo can deliver data faster through two mechanisms:

**Cold key auto-poll** — when a client tracks a key with version `0` ("I have no data") and no other connection on the node is currently tracking that key, Centrifugo automatically triggers an immediate backend poll for that key. Data arrives within milliseconds instead of waiting up to `refresh_interval`. This requires no additional configuration. Clients that track with a non-zero version (already have data) skip the auto-poll — the regular poll cycle will deliver any newer data.

**Cached data on track** — with [Centrifugo PRO's `keep_latest_data`](../pro/shared_poll.md#instant-initial-data) option (requires `versioned` refresh mode), the server caches latest data for each tracked key in memory. When a client tracks keys and the server has a newer version than the client, data is returned directly in the track response — no backend call needed for items already in cache. This is ideal for config sync, reconnect scenarios, and channels with long refresh intervals. See the [PRO documentation](../pro/shared_poll.md#instant-initial-data) for details.

### Version semantics

:::tip
Version semantics apply to `versioned` refresh mode. In `versionless` mode (default), the backend doesn't need to manage versions — Centrifugo handles change detection internally using synthetic versions.
:::

- **Version 0** = "I have no data" — triggers cold key auto-poll and cached data return (with PRO `keep_latest_data`)
- **Version > 0** = client already has data — no special behavior
- Versions **must start at 1** or higher in your backend handler. Version 0 is reserved for the "no data" state

In `versionless` mode, Centrifugo generates internal synthetic versions and sends them to clients. On reconnect, the client sends the stored synthetic version — if it matches the server's current version for that key, the reconnecting client is treated as up-to-date and doesn't trigger extra backend calls or broadcasts for that key.

To handle server restarts or channel state recreation (which reset synthetic version counters), Centrifugo includes an **epoch** in the subscribe reply. When a client reconnects and the epoch has changed, all stored versions are reset — triggering a fresh data load.

:::note
In `versionless` mode, synthetic versions are local to each Centrifugo node. When a client reconnects to a **different node** (e.g., after a deploy or via load balancer), the epoch changes and stored versions are reset, triggering a full data re-delivery. In `versioned` mode, versions come from the backend and are valid across all nodes — no reset occurs on node switches.
:::

### Use case: config sync

Shared poll works well for configuration sync — a single key, long refresh interval, and `shared_poll_publish` for instant updates on admin changes:

```javascript
const sub = client.newSharedPollSubscription('config_sync:app', {
  getSignature: async (ctx) => {
    const resp = await fetch('/api/sign-config', {
      method: 'POST',
      body: JSON.stringify({ keys: ctx.keys }),
    });
    return resp.json();
  },
});

sub.on('update', (ctx) => {
  applyConfig(ctx.key, ctx.data);
});

sub.subscribe();

// Track the config key — data arrives quickly via auto-poll (or instantly from cache with PRO)
sub.track(['app_settings']);
```

When the admin updates settings, your backend calls `shared_poll_publish` — all connected clients receive the update instantly. New clients connecting later get data quickly via the cold key auto-poll, or instantly from cache with [PRO's `keep_latest_data`](../pro/shared_poll.md#instant-initial-data).

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
});

sub.subscribe();
```

### Tracking items

The simplest way to track items is by passing key names as strings. The SDK automatically obtains a signature via the `getSignature` callback and sends the track request:

```javascript
// Simplified API — SDK auto-manages signatures
sub.track(['post_123', 'post_456']);
```

Keys tracked this way use version `0` ("no data"), which means the server will return data quickly via [cold key auto-poll](#quick-initial-data) (or instantly from cache with [PRO's `keep_latest_data`](../pro/shared_poll.md#instant-initial-data)).

Alternatively, you can provide explicit versions and a pre-computed signature:

```javascript
const signature = await getSignatureFromBackend(['post_123', 'post_456']);

sub.track([
  { key: 'post_123', version: 0 },
  { key: 'post_456', version: 0 },
], signature);
```

The `version` should be `0` for newly tracked items. If the client already has a cached version, pass it to avoid receiving data the client already has.

When using the simplified `track(keys)` API, the `getSignature` callback must be provided in the subscription options. If the callback returns fewer keys than requested, the omitted keys are considered revoked (see [Key revocation](#key-revocation)).

### Untracking items

```javascript
sub.untrack(['post_123']);
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

For delta compression to work effectively with shared poll, configure [`keep_latest_data: true`](../pro/shared_poll.md#keep_latest_data) in the namespace ([Centrifugo PRO](../pro/overview.md)) or return `prev_data` from your proxy response.

### Reconnect resilience

When a client disconnects and reconnects, the SDK automatically replays all tracked keys using the existing signature and sends a fresh `track` request. The `getSignature` callback is only invoked when no previous signature exists, the signature's expiration timer fires on the client side, or the server returns an expired error during reconnect — this avoids mass backend requests during large-scale reconnect scenarios. The versions sent are the latest versions the client received before the disconnect — so the server only pushes data that changed while the client was offline. In `versionless` mode, Centrifugo generates synthetic versions and sends them to clients, so reconnect works efficiently too — reconnecting clients with up-to-date versions don't trigger extra backend calls. If the server restarted (epoch changed), the SDK resets all stored versions, triggering a one-time full resync.

Combined with the server-side polling safety net, the client converges to the latest state after reconnect — even if a direct publish or notification was missed during the offline window, the next poll cycle catches up.

### Key revocation

When using the simplified `track(keys)` API or on signature refresh, the `getSignature` callback controls which keys the client is authorized to track. If your backend returns fewer keys than requested, the omitted keys are treated as revoked:

1. The SDK removes revoked keys from local tracking state
2. A removal `update` event is emitted for each revoked key (with `removed: true` and `data: null`)
3. Only authorized keys are sent to the server

This lets your backend revoke access to specific items in real time — for example, when a user's permissions change or content is deleted. The revocation takes effect on the next signature refresh cycle (controlled by the signature TTL) without requiring an explicit unsubscribe.

## Example: live vote results

This example ties together the pieces described above — [configuration](#minimal-example), a backend proxy handler, and client code with viewport-driven tracking.

Backend proxy handler (returns current vote counts in versionless mode):

```python
@app.post("/centrifugo/refresh")
async def shared_poll_refresh(request):
    data = await request.json()
    items = data.get("items", [])

    results = []
    for item in items:
        vote_data = await db.get_votes(item["key"])
        if vote_data:
            results.append({"key": item["key"], "data": vote_data})

    return {"result": {"items": results}}
```

Client — subscribe, handle updates, and track/untrack posts as user scrolls:

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
  ctx.removed ? hideVoteWidget(ctx.key) : updateVoteWidget(ctx.key, ctx.data);
});

sub.subscribe();
sub.track(getVisiblePostIds());

window.addEventListener('scroll', throttle(() => {
  const visible = getVisiblePostIds();
  const current = sub.trackedKeys();
  const toTrack = visible.filter(k => !current.has(k));
  const toUntrack = [...current].filter(k => !visible.includes(k));
  if (toTrack.length) sub.track(toTrack);
  if (toUntrack.length) sub.untrack(toUntrack);
}, 200));
```

## Demos

An interactive demo showcasing shared poll subscriptions is available in the [shared_poll_demo/votes](https://github.com/centrifugal/examples/tree/master/v6/shared_poll_demo/votes) example. It demonstrates live vote results with a Go backend, fossil delta compression, and dynamic item tracking as posts scroll into view.

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_votes.mp4"></video>

Another demo – [shared_poll_demo/drones](https://github.com/centrifugal/examples/tree/master/v6/shared_poll_demo/drones) – demonstrates real-time geospatial tracking of 500 simulated drones over a San Francisco map. It uses versioned shared poll with cell-based spatial partitioning, where each map grid cell (~550m) is a tracked key. As users pan the map, the client dynamically tracks/untracks cells within a search radius, receiving only relevant drone position updates.

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/demo_drones.mp4"></video>
