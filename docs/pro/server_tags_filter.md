---
id: server_tags_filter
title: Server-side publication tags filter
description: "Server-controlled publication filtering in Centrifugo PRO for per-subscriber access control within channels — works with both stream and map subscriptions."
---

import TagsFilterEvaluator from '@site/src/components/tagsfilter/TagsFilterEvaluator';

Centrifugo PRO supports **server-controlled publication filtering** — a mechanism for per-subscriber access control within channels. Unlike the [client-side tags filter](/docs/server/publication_filtering) (a bandwidth optimization the client controls), the server-side filter is set by your backend and cannot be overridden by the client.

When a server publication filter is set, only publications with matching tags are delivered to that subscriber. Publications that don't match are silently dropped — the subscriber never sees them.

When both a server filter and a [client-side filter](/docs/server/publication_filtering) are set on the same subscription, both must pass for a publication to be delivered. The server filter is applied first — it acts as the security boundary. The client filter is applied second — it can only narrow the result further, never widen it. For example, if the server filter allows `team=engineering` and the client filter requests `role=admin`, only publications with both `team=engineering` AND `role=admin` are delivered.

The feature works for both **stream subscriptions** and **map subscriptions**.

## Setting the filter

The filter is set per subscriber at subscribe time — via the subscribe proxy response, JWT subscription token, or connection token.

### Via subscribe proxy

Return a `server_tags_filter` in the subscribe proxy response:

```json
{
  "result": {
    "server_tags_filter": {
      "op": "and",
      "nodes": [
        {"key": "team", "cmp": "eq", "val": "engineering"},
        {"key": "level", "cmp": "gte", "val": "5"}
      ]
    }
  }
}
```

Your backend decides the filter based on the subscriber's identity — role, team, permissions — and Centrifugo enforces it for the lifetime of the subscription.

### Via JWT subscription token

Include `server_tags_filter` in the subscription token claims:

```json
{
  "sub": "user123",
  "channel": "notifications",
  "server_tags_filter": {
    "key": "role",
    "cmp": "in",
    "vals": ["editor", "admin"]
  }
}
```

### Via connection token

For server-side subscriptions, include `server_tags_filter` in the `subs` claim of the connection token:

```json
{
  "sub": "user123",
  "subs": {
    "notifications": {
      "server_tags_filter": {
        "key": "team",
        "cmp": "eq",
        "val": "engineering"
      }
    }
  }
}
```

### Via connect proxy

The connect proxy can return `server_tags_filter` per channel in its `subs` response — useful when your backend decides subscriptions and their filters at connection time:

```json
{
  "result": {
    "user": "user123",
    "subs": {
      "notifications": {
        "server_tags_filter": {
          "key": "team",
          "cmp": "eq",
          "val": "engineering"
        }
      }
    }
  }
}
```

## Filter expression language

The server-side filter uses the same expression language as the [client-side tags filter](/docs/server/publication_filtering). See the full [FilterNode reference](/docs/server/publication_filtering#filternode-structure) for the complete specification. A brief summary:

**Comparison operators:** `eq`, `neq`, `in`, `nin`, `ex` (exists), `nex` (not exists), `sw` (starts with), `ew` (ends with), `ct` (contains), `gt`, `gte`, `lt`, `lte`.

**Logical operators:** `and`, `or`, `not` — combine conditions into expressions:

```json
{
  "op": "or",
  "nodes": [
    {"key": "role", "cmp": "eq", "val": "admin"},
    {
      "op": "and",
      "nodes": [
        {"key": "team", "cmp": "eq", "val": "engineering"},
        {"key": "level", "cmp": "gte", "val": "5"}
      ]
    }
  ]
}
```

## Try it: server tags-filter simulator

Set a publication's `tags`, a **server** filter (your backend's security boundary), and an optional **client** filter, then see whether the publication is delivered — and which filter dropped it. The server filter is always evaluated first; the client filter can only narrow the result further.

<TagsFilterEvaluator server />

## Stream subscriptions

For stream subscriptions, the server publication filter applies to:

- **Live publications** — only matching publications are delivered in real time.
- **History recovery** — on reconnect, only matching publications are included in the recovery result.
- **Cache recovery** — only the latest matching publication is returned.

History API calls from a client are not filtered, so a client can't call `history` for a channel it is subscribed to with a server filter – such calls are refused with a permission denied error. Recovery on subscribe (above) still works, since it is filtered.

:::caution

The server filter is a property of the subscription. A client which calls `history` without being subscribed to the channel is checked by the usual history permissions and receives unfiltered history. Don't give clients history access to channels which rely on a server filter to hide publications.

:::

### Publishing with tags

Include tags when publishing via the [server API](/docs/server/server_api#publishrequest):

```bash
curl --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{
    "channel": "notifications",
    "data": {"text": "Deploy completed", "service": "api"},
    "tags": {"team": "platform", "severity": "info"}
  }' \
  http://localhost:8000/api/publish
```

A subscriber with filter `{"key": "team", "cmp": "eq", "val": "platform"}` receives this publication. A subscriber with filter `{"key": "team", "cmp": "eq", "val": "frontend"}` does not.

## Map subscriptions

For map subscriptions, the server publication filter applies to all three sync phases:

- **State phase** — only entries with matching tags are included in paginated state delivery.
- **Stream phase** — only matching entries are delivered during stream catch-up on reconnect.
- **Live phase** — only matching publications are delivered in real time.

### Publishing with tags

Include tags when publishing to a map channel:

```sql
SELECT * FROM cf_map_publish(
  p_channel := 'board:main',
  p_key     := 'card_42',
  p_data    := '{"text": "Card data"}'::jsonb,
  p_tags    := '{"team": "engineering", "visibility": "internal"}'::jsonb
);
```

Or via the centrifuge library:

```go
node.MapPublish(ctx, "board:main", "card_42", centrifuge.MapPublishOptions{
    Data: []byte(`{"text": "Card data"}`),
    Tags: map[string]string{"team": "engineering", "visibility": "internal"},
})
```

### Removal events

Removal publications carry the original entry's tags, so subscribers only receive removal notifications for keys they were authorized to see. The broker reads tags from the state entry before deletion — no extra work is needed from the application.

### Changing tags on existing keys

To change a key's tags (e.g., moving an item to a different team), use a remove + re-publish pattern. With PostgreSQL, wrap both in a single transaction for atomicity:

```sql
BEGIN;
  SELECT * FROM cf_map_remove(p_channel := 'board:main', p_key := 'card_42');
  SELECT * FROM cf_map_publish(p_channel := 'board:main', p_key := 'card_42',
    p_data := '{"text": "Card data"}'::jsonb,
    p_tags := '{"team": "sales"}'::jsonb);
COMMIT;
```

Subscribers with the old filter see the removal. Subscribers with the new filter see the new entry. No visibility gap.

## Updating the filter

The server tags filter can be updated for an active subscription in two ways.

### Via subscription token refresh

When the subscription refresh handler returns a new `server_tags_filter` – the [sub refresh proxy](../server/proxy.md#sub-refresh-proxy) in its result, or a refreshed subscription token in its claims – Centrifugo compares it with the current filter:

- **Stream subscriptions** — the filter is hot-swapped. Future publications use the new filter immediately, no interruption. A subscription using delta compression is an exception: as delta compression is not used together with the filter, it is resubscribed without delta (a server-side subscription reconnects instead).
- **Map subscriptions** — the client is automatically unsubscribed and re-subscribes to get a full state re-sync matching the new filter. The SDK handles this transparently.

Return the new filter wherever the subscription gets its filter on subscribe too – the subscribe proxy or the subscription token, or, for server-side subscriptions, the connect proxy or the connection token. Otherwise a resubscribed or reconnected subscription starts with the old filter, or without one.

If the refresh handler returns no filter, the existing filter is left unchanged – a filter can't be removed by refresh, resubscribe for that.

### Via token revocation

Use the [`invalidate_user_tokens`](/docs/pro/access_revoke#invalidate_user_tokens) or [`revoke_token`](/docs/pro/access_revoke#revoke_token) API to make the client load a fresh token carrying the updated filter. Revoking or invalidating a connection token reconnects the whole connection. Revoking a subscription token, or invalidating with `channel`, affects only that subscription: it is unsubscribed, its resubscribe gets a token expired error, and the client loads a new subscription token.

## Limitations

- **Delta compression** is incompatible with the server-side publication filter (same constraint as the client-side tags filter): delta compression is not negotiated for such subscriptions.
