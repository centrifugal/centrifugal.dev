---
id: tenant_channels
sidebar_label: Tenant channels
title: Tenant channels (coming soon)
draft: true
---

Rejected 🚫

Centrifugo PRO extends channel name syntax with a tenant part. This is only available when `tenant_channels` boolean option is set to `true` in the configuration:

```json title="config.json"
{
    // rest of the config ...
    "tenant_channels": true
}
```

Tenant channel format looks like this:

```
[org_1]news
[org_1]posts:42
```

Or in case of using [channel patterns](./channel_patterns.md) approach:

```
[org_1]/users/mario
[org_1]/posts/42
```

The `org_1` wrapped in `[` `]` is called `tenant` part. It must always be in the beginning of the channel. In general you can choose any string which fits your app for the tenant part of a channel but we recommend putting something which identifies the particular application instance (tenant) into it. If you only have one tenant in the app – then use sth like app name or simply don't use tenant channels at all.

**The tenant part is ignored by Centrifugo when resolving a namespace for a channel**, namespace is extracted as part of the channel after `[tenant]`. For example, in channel `[org_15]mynamespace:test` the extracted namespace part will be `mynamespace`. In case of using channel patterns and channel like `[org_15]/posts/42` the namespace part is `/posts/42` and it will be matched over configured channel patterns.

:::tip

Note, that as always in Centrifugo - channel name is just a string, so when using tenant channels remember to publish messages into exact same channel, including tenant part.

:::

Additional benefits of using tenant channels may be achieved together with Centrifugo PRO [CEL expressions](./cel_expressions.md). The tenant part becomes available for CEL expressions as a separate variable which may be used for rule evaluation in a custom way. For example, it may be used for a check that user belongs to a particular tenant of the application.

:::tip

Note, that when using [channels](../server/server_api.md#channels) server API call and want to query tenant channels you need to escape `[` and `]` symbols in pattern as they have special meaning in `glob` library we are using internally. So that pattern to query all active channels in a particular tenant may look like this: `\[mytenant\]*`.

:::
