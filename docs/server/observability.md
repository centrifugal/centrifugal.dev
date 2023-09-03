---
id: observability
title: Server observability
---

To provide a better server observability Centrifugo supports reporting metrics in Prometheus format and can automatically export metrics to Graphite.

## Metrics

### Prometheus metrics

To enable Prometheus endpoint start Centrifugo with `prometheus` option on:

```json title="config.json"
{
    ...
    "prometheus": true
}
```

This will enable `/metrics` endpoint so the Centrifugo instance can be monitored by your Prometheus server.

### Graphite metrics

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

## Traces

### OpenTelemetry

At this point Centrifugo can export traces for HTTP and GRPC server API requests in OpenTelemetry format.

To enable:

```json
{
  ...
  "opentelemetry": true,
  "opentelemetry_api": true
}
```

OpenTelemetry must be explicitly turned on to avoid tracing overhead when it's not needed.

To configure OpenTelemetry export behaviour we are relying on [OpenTelemetry environment vars](https://opentelemetry.io/docs/concepts/sdk-configuration/otlp-exporter-configuration/) supporting only HTTP export endpoints for now.

So a simple example to run Centrifugo with server API tracing would be running Jaeger with `COLLECTOR_OTLP_ENABLED`:

```bash
docker run --rm -it --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

Then start Centrifugo:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318" CENTRIFUGO_OPENTELEMETRY=1 CENTRIFUGO_OPENTELEMETRY_API=1 ./centrifugo
```

Send some API requests - and open [http://localhost:16686](http://localhost:16686) to see traces in Jaeger UI.

By default, Centrifugo exports traces in `http/protobuf` format. If you want to use GRPC exporter then it's possible to turn on by setting environment variable `OTEL_EXPORTER_OTLP_PROTOCOL` to `grpc` (GRPC exporter format supported since Centrifugo v5.0.3).

## Logs

Logging may be configured using `log_level` option. It may have the following values:

* `none`
* `trace`
* `debug`
* `info` (default)
* `warn`
* `error`

We generally do not recommend anything below info to be used in production.

By default Centrifugo logs to STDOUT. Usually this is what you need when running servers on modern infrastructures. Logging into file may be configured using `log_file` option.
