---
description: "Monitor Centrifugo with Prometheus and Graphite metrics. Includes official Grafana dashboard for visualizing connections, messages, and performance data."
id: monitoring
title: Metrics monitoring
---

Centrifugo supports reporting metrics in Prometheus format and can automatically export metrics to Graphite. For the full list of exposed metrics, OpenTelemetry export, and native histograms see the [Observability](./observability.md) chapter.

### Prometheus

To enable Prometheus endpoint set `prometheus.enabled` to `true`:

```json title="config.json"
{
  "prometheus": {
    "enabled": true
  }
}
```

This will enable `/metrics` endpoint so the Centrifugo instance can be monitored by your Prometheus server.

### Graphite

To enable automatic export to Graphite (via TCP):

```json title="config.json"
{
  "graphite": {
    "enabled": true,
    "host": "localhost",
    "port": 2003
  }
}
```

By default, stats will be aggregated over 10 seconds intervals inside Centrifugo and then pushed to Graphite over TCP connection.

If you need to change this aggregation interval use the `graphite.interval` option (a [duration](./configuration.md#duration-type), default `"10s"`).

### Grafana dashboard

Check out Centrifugo [official Grafana dashboard](https://grafana.com/grafana/dashboards/13039) for Prometheus storage. You can import that dashboard to your Grafana, point to Prometheus storage – and enjoy visualized metrics.

![](https://grafana.com/api/dashboards/13039/images/8950/image)

:::tip

Centrifugo PRO adds [observability enhancements](../pro/observability_enhancements.md) like user/channel [tracing](../pro/tracing.md) and [analytics with ClickHouse](../pro/analytics.md).

:::
