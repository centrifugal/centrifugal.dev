---
description: "Centrifugo PRO observability enhancements: client name metrics, channel namespace resolution, transport protocol labels, and Sentry integration."
id: observability_enhancements
title: Observability enhancements
---

Centrifugo PRO provides enhanced observability, as when the business grows it's crucial to have deep insight into the system.

## Client name resolution in metrics

Centrifugo PRO has some enhancements to exposed metrics.

It's possible to understand how many clients from different environments are currently connected to your Centrifugo — i.e. from a browser, from Android, iOS devices. This is possible because our SDKs pass the name of the SDK to a server and provide a way to redefine it.

Names of clients you are using in SDKs must be registered in Centrifugo configuration. This is done to avoid cardinality issues in Prometheus.

```json title="config.json"
{
  "prometheus": {
    "enabled": true,
    "additional_client_names": [
      "my-name1",
      "my-name2"
    ]
  }
}
```

Centrifugo PRO is already aware of some names used by our official SDKs, so out of the box you will get segmentation by those.

## Channel namespace resolution for metrics

Centrifugo PRO supports channel namespace resolution for many metrics related to channel. One application could be for setups with many namespaces, to understand which namespaces consume more bandwidth, or which namespace generates more frames or errors. Or the number of inflight subscriptions with channel namespace resolution!

To enable:

```json title="config.json"
{
  "prometheus": {
    "enabled": true,
    "channel_namespace_resolution": true
  }
}
```

Centrifugo PRO requires a separate flag to enable channel namespace resolution for metrics because it may have some overhead (in most cases negligible though).

## Transport accept protocol resolution

Centrifugo PRO can expose the accept protocol used by client's transport in metric labels. This allows you to understand which protocols clients are using to establish connections - for example, distinguishing between WebSocket connections that were established via HTTP/1.1 versus HTTP/2 or HTTP/3, or tracking HTTP-streaming and SSE connections by their underlying HTTP protocol version.

To enable:

```json title="config.json"
{
  "prometheus": {
    "enabled": true,
    "expose_transport_accept_protocol": true
  }
}
```

When enabled, the following metrics will include the `accept_protocol` label:
- `centrifugo_client_connections_accepted` - counter of accepted connections
- `centrifugo_client_connections_inflight` - gauge of current connections

The `accept_protocol` label can have the following values:
- `h1` - HTTP/1.1
- `h2` - HTTP/2
- `h3` - HTTP/3

This helps in understanding the protocol distribution across your infrastructure and can be useful for performance analysis and infrastructure planning.

## Client labels as Prometheus dimensions

Centrifugo PRO can export selected [client labels](./client_authentication.md#client-labels) as additional Prometheus dimensions on per-client metrics. Combined with labels set from JWT or the connect proxy, this gives per-tier, per-region, per-app-version breakdowns of connection-level metrics without operating multiple Centrifugo deployments.

To enable, list the label keys to export under `prometheus.client_labels`:

```json title="config.json"
{
  "prometheus": {
    "enabled": true,
    "client_labels": ["region", "tier", "app_version"]
  }
}
```

Exported dimension names are prefixed with `app_` to guarantee they cannot collide with built-in metric labels — for example, `client_labels: ["region", "tier"]` becomes the Prometheus dimensions `app_region` and `app_tier`. Your application code reads the unprefixed keys via `labels.region` / `labels.tier` (e.g., in CEL expressions or proxy requests) — the prefix is applied only on the metric export path.

When a configured key is missing on a particular client, the empty string is used as the dimension value (so all metric series stay shape-consistent).

:::warning Cardinality

Every unique combination of exported label values creates a new Prometheus time series. Keep the value set **bounded and small** — region (5–20 values), tier (3–5 values), app version (dozens, not millions). **Do not export user IDs, session IDs, request IDs, or any unbounded input.** Combined with built-in labels like transport and op, even a few high-cardinality keys can multiply your time series count rapidly.

The same caveat applies to the [analytics labels column](./analytics.md) — different storage, same cardinality concern.

:::

When `client_labels` is empty (the default), no label dimensions are exported and there is zero overhead on the metric emission path.

## Sentry integration

Centrifugo PRO comes with an integration with [Sentry](https://sentry.io/). Just a couple of lines in the configuration:

```json
{
  ...
  "sentry": {
    "enabled": true,
    "dsn": "your-project-public-dsn"
  }
}
```

– and you will see Centrifugo PRO errors collected by your self-hosted or cloud Sentry installation.

<img src="/img/sentry.jpg" />

### Sentry options

#### sentry.enabled

Boolean flag to enable Sentry integration.

#### sentry.dsn

Sentry DSN to use for error reporting.

#### sentry.environment

Environment name to set for Sentry events.

#### sentry.sample_rate

Sample rate to set for Sentry events. By default, all events are sent to Sentry. You can set a sample rate to send only a fraction of events to Sentry. For example, to send 1/10 of events set this to `0.1`.
