---
id: observability_enhancements
title: Observability enhancements
---

Centrifugo PRO version provides an enhanced observability as when the business grows it's crucial to have a deep insight into the system.

## Additional metrics

Centrifugo PRO has some enhancements to exposed metrics. At this moment it provides channel namespace resolution to the following metrics:

* `centrifugo_transport_messages_sent`
* `centrifugo_transport_messages_sent_size`
* `centrifugo_transport_messages_received`
* `centrifugo_transport_messages_received_size`

Since channel namespace resolution may add some overhead (though negligible in most cases), Centrifugo PRO requires it to be explicitly enabled using two additional boolean config options (available since Centrifugo PRO v5.1.1):

```json title="config.json"
{
  "prometheus": {
    "enabled": true,
    "channel_namespace_for_transport_messages_sent": true,
    "channel_namespace_for_transport_messages_received": true
  }
}
```

* First option `prometheus.channel_namespace_for_transport_messages_sent` enables channel namespace label for:
    * `centrifugo_transport_messages_sent`
    * `centrifugo_transport_messages_sent_size`
* Second option `prometheus.channel_namespace_for_transport_messages_received` enables for:                
    * `centrifugo_transport_messages_received`
    * `centrifugo_transport_messages_received_size`.


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
