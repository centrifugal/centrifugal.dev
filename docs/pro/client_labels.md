---
description: "Centrifugo PRO client labels: a typed string map attached to each connection at authentication time, used across metrics, server API, CEL, analytics, snapshots, and proxy."
id: client_labels
title: Client labels
sidebar_label: Client labels
---

**Client labels** are a small `map[string]string` attached to a connection at connect time. Centrifugo PRO uses them as a first-class connection primitive across many subsystems — metrics, server API ops, listings, CEL authorization, analytics, snapshots, and outgoing proxy requests.

Think of them as Kubernetes labels or Datadog tags for real-time connections: a typed categorical key/value space that operators set once at auth time, then segment, filter, and target on for the connection's lifetime.

## At a glance

| Where labels are set                                                                   | Where labels are used                                                                                          |
|----------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| JWT `labels` claim                                                                     | [Prometheus dimensions](./observability_enhancements.md#client-labels-as-prometheus-dimensions) on per-client metrics |
| JWT `labels_from_claim` mapping ([per token](./client_authentication.md#client-labels) or per JWKS provider) | `label_filter` argument on [server API](./server_api_enhancements.md#targeted-ops-by-client-labels) `subscribe`/`unsubscribe`/`disconnect`/`refresh` |
| Connect proxy response `labels` field                                                  | [Connections API](./connections.md) filtering and listings                                                     |
|                                                                                        | `labels` variable in [CEL expressions](./cel_expressions.md) for channel-permission gates                       |
|                                                                                        | [ClickHouse analytics](./analytics.md) `labels` column on `connections`, `operations`, `snapshot_connections`  |
|                                                                                        | [Snapshot](./connections.md) `label_filter` at gather time                                                     |
|                                                                                        | Always attached on outgoing [proxy requests](./event_hooks.md) (publish, subscribe, RPC, refresh, sub_refresh, map_publish, map_remove) |

## Labels vs `meta`

Centrifugo connections already have a `meta` JSON object that flows from JWT/proxy into per-connection metadata. Labels are a separate primitive with a narrower contract:

|                     | `meta`                                                | `labels`                                                  |
|---------------------|-------------------------------------------------------|-----------------------------------------------------------|
| Shape               | Free-form JSON object                                 | `map[string]string`                                       |
| Set via             | JWT `meta` claim, `meta_from_claim`, connect proxy    | JWT `labels` claim, `labels_from_claim`, connect proxy    |
| Used for            | Per-call data sent to backend proxies; CEL context    | Filtering (server API, listings, snapshots); metrics dimensions; CEL gates; analytics columns |
| Filterable          | No (free-form, no index)                              | Yes — `label_filter` FilterNode language                  |
| Typed in CEL        | `cel.DynType`                                         | `cel.MapType(StringType, StringType)`                     |
| Mutable mid-session | No (also immutable)                                   | No (immutable after connect)                              |

**Rule of thumb**: use `meta` for richer per-connection context that your backend reads. Use `labels` when the value is a categorical key/value pair you want to *filter on, segment by, or target with* an op. The same JWT claim can populate both — use whichever shape fits the consumer.

## Quick example

A connecting client gets labels via JWT:

```json
{
  "sub": "user42",
  "exp": 1799999999,
  "labels": {
    "region": "eu",
    "tier": "pro",
    "app_version": "3.4.1"
  }
}
```

After connect, an operator can:

- See per-region metrics (`prometheus.client_labels: ["region", "tier"]` exports `app_region` and `app_tier` dimensions on every per-client metric).
- Disconnect every EU pro-tier connection fleet-wide: `POST /api/disconnect` with `{"all_users": true, "label_filter": {"op": "and", "nodes": [{"key":"region","cmp":"eq","val":"eu"}, {"key":"tier","cmp":"eq","val":"pro"}]}}`.
- Gate a channel namespace via CEL: `"tier" in labels && labels.tier == "pro"`.
- Query analytics: `SELECT region, count() FROM centrifugo.connections WHERE labels.tier = 'pro' GROUP BY labels.region`.
- Capture a snapshot of just EU connections: `POST /api/snapshots` with a connections filter limited by labels.

Each of these is documented in its own page (linked above) — this page exists to surface that labels are one primitive flowing through all of them.

## Setting labels

See [client authentication](./client_authentication.md#client-labels) for the full reference on the JWT `labels` claim, `labels_from_claim` gjson mapping (global and per-JWKS-provider), and the connect proxy `labels` response field. Quick summary:

- The top-level `labels` JWT claim is a literal `map[string]string`.
- `labels_from_claim` extracts arbitrary JWT claims via gjson paths. Useful when tokens are issued by third-party IDPs whose claim shape you don't control.
- A connect proxy may return a `labels` field on its response. When both a JWT and a connect proxy run for the same connection, the connect proxy's labels win (same precedence as `meta`).

## Constraints

- **Immutable after connect.** Labels cannot be refreshed; if a client's tier changes mid-session, force a reconnect for the new value to take effect.
- **Keep cardinality bounded.** Labels become Prometheus dimensions (when `prometheus.client_labels` is set) and ClickHouse `Map(String, String)` columns. Never put user IDs, session IDs, request IDs, or any unbounded values into labels — they will explode metric series and degrade analytics compression. Use bounded categorical sets: `region` (5–20 values), `tier` (3–5 values), `app_version` (dozens). The same rule applies to label *keys* — they're the column dictionary in ClickHouse.
- **Subscription tokens don't support labels.** Labels are a connection-time primitive (set at the connect-token level). Subscription tokens cannot set or modify them — validated on Centrifugo start.

## Consumers reference

Each linked page documents the labels contract for its subsystem:

- **[Client authentication](./client_authentication.md#client-labels)** — JWT claim, `labels_from_claim` mapping, connect proxy field.
- **[Server API enhancements](./server_api_enhancements.md#targeted-ops-by-client-labels)** — `label_filter` and `all_users` on `subscribe`/`unsubscribe`/`disconnect`/`refresh`.
- **[Connections API](./connections.md)** — `label_filter` on listings; snapshot create endpoint accepts gather-time `label_filter`.
- **[CEL expressions](./cel_expressions.md)** — `labels` variable in channel-permission expressions.
- **[Observability enhancements](./observability_enhancements.md#client-labels-as-prometheus-dimensions)** — `prometheus.client_labels` config option, `app_*` Prometheus dimension prefix, cardinality warning.
- **[ClickHouse analytics](./analytics.md)** — `labels` column on `connections`, `operations`, `snapshot_connections`, plus the one-time `ALTER TABLE` migration for existing deployments.
- **[Event hooks](./event_hooks.md)** — connect proxy `labels` response field; always-attach on outgoing publish/subscribe/RPC/refresh/sub_refresh/map_publish/map_remove proxy requests.
