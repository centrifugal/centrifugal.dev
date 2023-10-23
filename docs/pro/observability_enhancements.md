---
id: observability_enhancements
title: Observability enhancements
---

Centrifugo PRO has some enhancements to exposed metrics. At this moment it provides channel namespace resolution to the following metrics:

* centrifugo_transport_messages_sent
* centrifugo_transport_messages_sent_size
* centrifugo_transport_messages_received
* centrifugo_transport_messages_received_size

Since channel namespace resolution may add some overhead (though negligible in most cases), Centrifugo PRO requires it to be explicitly enabled using two boolean config options:

```json title="config.json"
{
    ...
    "channel_namespace_for_transport_messages_sent": true,
    "channel_namespace_for_transport_messages_received": true
}
```

* First option `channel_namespace_for_transport_messages_sent` enables channel namespace label for:
    * `centrifugo_transport_messages_sent`
    * `centrifugo_transport_messages_sent_size`
* Second option `channel_namespace_for_transport_messages_received` enables for:                
    * `centrifugo_transport_messages_received`
    * `centrifugo_transport_messages_received_size`.
