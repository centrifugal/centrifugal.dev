---
id: observability_enhancements
title: Observability enhancements
---

Centrifugo PRO version provides an enhanced observability as when the business grows it's crucial to have a deep insight into the system.

## Additional metrics insights

Centrifugo PRO has some enhancements to exposed metrics.

It's possible to understand how many clients from different environments are currently connected to your Centrifugo. I.e. from browser, from Android, iOS devices. This is possible because our SDKs pass the name of SDK to a server, and provide a way to redefine it.

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

And Centrifugo PRO already aware of some names used by our official SDKs, so out of the box you will get segmentation by those.

## Channel namespace resolution for metrics

Centrifugo PRO supports channel namespace resolution for many metrics related to channel. One application could be for setups with many namespaces to understand which namespaces consume more bandwidth. Or which namespace generates more frames, or errors. Or number inflight subscriptions with channel namespace resolution!

To enable:

```json title="config.json"
{
  "prometheus": {
    "enabled": true,
    "channel_namespace_resolution": true
  }
}
```

Centrifugo PRO requires separate flag to enable channel namespace resolution for metrics because it may have some overhead (in most cases negligible though).

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
