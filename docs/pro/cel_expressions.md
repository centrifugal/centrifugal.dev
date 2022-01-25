---
id: cel_expressions
title: CEL expressions
---

Centrifugo PRO supports [CEL expressions](https://opensource.google/projects/cel) (Common Expression Language) for checking subscription permissions. CEL expressions provide a developer-friendly, fast and secure way to evaluate some conditions predefined in the configuration. They are used in some Google services (ex. Firebase), in Envoy RBAC configuration, etc.

For Centrifugo this is a flexible mechanism which can help to avoid using private subscriptions or using subscribe proxy in some cases. This means you can avoid sending an additional HTTP request to the backend for a channel subscription attempt. As the result less resources may be used and smaller latencies may be achieved.

Some good links which may help you dive into CEL expressions are:

* [CEL introduction](https://github.com/google/cel-spec/blob/master/doc/intro.md)
* [CEL language definition](https://github.com/google/cel-spec/blob/master/doc/langdef.md)
* [Docs of Google asset inventory](https://cloud.google.com/asset-inventory/docs/monitoring-asset-changes-with-condition#using_cel) which also uses CEL

Below we will explore some basic expressions and how they can be used in Centrifugo.

## Subscribe expression

Available since Centrifugo PRO v3.2.0.

It's possible to configure `subscribe_expression` for a channel namespace (`subscribe_expression` is just an additional namespace channel option, with same rules applied as for Centrifugo OSS channel options). This expression should be a valid CEL expression.

```json title="config.json"
{
    "namespaces": [
        {
            "name": "admin",
            "subscribe_expression": "'admin' in meta.roles"
        }
    ]
}
```

You can also attach custom `meta` information to the connection:

* in connect proxy result
* or in JWT `meta` claim.

An expression is evaluated for every subscription attempt to a channel in a namespace. So if `meta` attached to the connection is sth like this:

```json
{
    "roles": ["admin"]
}
```

– then for every channel in `admin` namespace expression will be evaluated to True and subscription will be accepted by Centrifugo.

:::tip

`meta` must be JSON object (any `{...}`) for CEL expressions to work.

:::

### Channel labels

To make expression concept even more powerful Centrifugo PRO extends channel name syntax with channel labels.

Channel labels are the pairs of key=value (where key and value must be urlencoded), separated by comma.

:::tip

Note that both key and value of channel label must be in [URL-encoded format](https://en.wikipedia.org/wiki/Percent-encoding) (i.e. escaped). 

:::

These labels are extracted from the channel name by Centrifugo before evaluating CEL expression and passed to the expression context.

For example, here is a channel with channel labels set:

```
admin:events{instance=42,project=x1}
```

Labels must be put into curly brackets. Labels can be placed at any place after namespace separator (i.e. after `:` symbol).

Each label key can have multiple values:

```
admin:events{project=x1,project=x2}
```

In CEL expression you can then make decisions based on channel labels:

```json title="config.json"
{
    "namespaces": [
        {
            "name": "admin",
            "subscribe_expression": "labels.instance[0] == meta.instance && labels.project[0] in meta.projects"
        }
    ]
}
```

The reason why we use `[0]` in an expression is because labels decoded by Centrifugo into `map[string][]string`, as the same key can have several values.

For the expression above to evaluate to True for channel `admin:events{instance=42&project=x1}`, `meta` should be like:

```json
{
    "instance": "42",
    "projects": ["x1"]
}
```

:::danger

Note that the order of labels in a channel name is important. In Centrifugo channel is just a string, so channels `events{instance=42,project=x1}` and `events{project=x1,instance=42}` are totally different! Channel labels are just part of a channel string, not stripped or modified in any way by Centrifugo. The ordering concern was the reason why we decided to not use `&` to separate key/value pairs in channel labels. Because this could lead to many mistakes when using URL query string builders which behave differently in various programming languages and libraries.

:::

Let's take a look on one more example. Here is how we could implement [user-limited](../server/channels.md#user-channel-boundary-) channels functionality using CEL expression and channel labels. We could have channel like:

```
users{user=user1,user=user2}
```

Then by using `subscribe_expression` like `"user in labels.user"` we can make sure that only user which is part of channel labels will be able to subscribe on this channel. `user` variable is the current user ID and it's available in a subscribe expression context, see below all available variables you can use.

### Subscribe expression variables

| Variable | Type | Example |  Description |
| ------------ | -------------- | ---- | ------------ |
| user       | string     | `"facebook:12121612"` |  Current user ID |
| channel    | string     | `"admin:events{env=42,env=43}"` | Channel client tries to subscribe      |
| labels     | `map[string][]string` | `{"env": ["42", "43"]}`  | Labels extracted from channel name |
| meta     | `map[string]any` | `{"env": "42"}` | Meta attached to the connection by the apllication backend |
