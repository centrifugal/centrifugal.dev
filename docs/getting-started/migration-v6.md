---
id: migration_v6
title: Migrating to v6
---

In this chapter we help to migrate from Centrifugo v5 to Centrifugo v6.

## Migrating server configuration

Server configuration refactoring was the main focus of Centrifugo v6 development, and below we concentrate on helping you with the process of adopting the new configuration layout in your application.

### Configuration file converter

The number of changes in configuration is too big to describe, so to help you with the migration process of configuration file we provide a configuration converter tool.

Paste the JSON config of Centrifugo v5 in the textarea below – and you will get the JSON config for Centrifugo v6.

:::caution

Do not blindly deploy things to production – test your system first, go through the possible usage scenarios, run test cases. The converter is best-effort and does not cover some configuration cases.

:::

:::tip

If you are using TOML or YAML configuration formats – you can transform them to JSON using some third-party converters, then put JSON here, then convert the new configuration back to YAML or TOML.

There are many online converters. For example, convert [YAML to JSON](https://onlineyamltools.com/convert-yaml-to-json) or [TOML to JSON](https://toml-to-json.matiaskorhonen.fi/).

:::

:::tip

This converter is fully client-side: your data won't be sent anywhere.

:::

import ConfigConverter from "@site/src/components/converterv6"

<ConfigConverter />


### Environment variable converter

In addition to configuration file converter we are trying to help migrating environment configuration using the converter below. The converter is also **just a best-effort, fully client-side**.

Insert environment configuration in a format

```
CENTRIFUGO_OPTION1="value"
CENTRIFUGO_OPTION2="value"
```

import EnvConfigConverter from "@site/src/components/converterv6_env"

<EnvConfigConverter />

## SockJS transport migration

Deprecated SockJS transport [was removed in Centrifugo v6](/blog/2025/01/16/centrifugo-v6-released#removing-sockjs), you need to switch to [supported transports](../transports/overview.md). Note, Centrifugo also provides its own WebSocket emulation layer (which is more effective than SockJS and natively supported by our Javascript SDK without third-party requirements) – so you still have an option for automatic WebSocket fallback with Centrifugo.

To enable Centrifugo built-in bidirectional emulation you need to enable [HTTP streaming](/docs/transports/http_stream) or [SSE](/docs/transports/sse) transports in server configuration, then configure `centrifuge-js` to use those [as described here](https://github.com/centrifugal/centrifuge-js?tab=readme-ov-file#http-based-websocket-fallbacks):

```javascript
const transports = [
    {
        transport: 'websocket',
        endpoint: 'ws://localhost:8000/connection/websocket'
    },
    {
        transport: 'http_stream',
        endpoint: 'http://localhost:8000/connection/http_stream'
    },
    {
        transport: 'sse',
        endpoint: 'http://localhost:8000/connection/sse'
    }
];
const centrifuge = new Centrifuge(transports);
centrifuge.connect()
```

## Tarantool engine migration

Tarantool experimental engine [was removed in Centrifugo v6](/blog/2025/01/16/centrifugo-v6-released#removing-tarantool), so you need to migrate to supported engines described in [Engines and Scalability](../server/engines.md) doc, i.e. choose from:

* In memory Engine – ultrafast, but keeps data in Centrifugo process memory so publication history is lost on restart. And only one Centrifugo node can be used.
* Redis Engine (Redis-compatible storages are supported also) - allows scaling Centrifugo nodes, data is kept in Redis so survives Centrifugo restarts.
* Nats broker (supports at most once PUB/SUB, but does not support history/recovery features of Centrifugo).
