---
id: monitoring
title: Monitoring
---

Centrifugo supports reporting metrics in Prometheus format and can automatically export metrics to Graphite.

### Prometheus

To enable Prometheus endpoint start Centrifugo with `prometheus` option on:

```json title="config.json"
{
    ...
    "prometheus": true
}
```

This will enable `/metrics` endpoint so the Centrifugo instance can be monitored by your Prometheus server.

### Graphite

To enable automatic export to Graphite (via TCP):

```json title="config.json"
{
    ...
    "graphite": true,
    "graphite_host": "localhost",
    "graphite_port": 2003
}
```

By default, stats will be aggregated over 10 seconds intervals inside Centrifugo and then pushed to Graphite over TCP connection.

If you need to change this aggregation interval use the `graphite_interval` option (in seconds, default `10`).

### Grafana dashboard

Check out Centrifugo [official Grafana dashboard](https://grafana.com/grafana/dashboards/13039) for Prometheus storage. You can import that dashboard to your Grafana, point to Prometheus storage – and enjoy visualized metrics.

![](https://grafana.com/api/dashboards/13039/images/8950/image)
