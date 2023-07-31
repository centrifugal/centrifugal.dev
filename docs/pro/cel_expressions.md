---
id: cel_expressions
sidebar_label: CEL expressions
title: CEL expressions
---

Centrifugo PRO supports [CEL expressions](https://opensource.google/projects/cel) (Common Expression Language) for checking channel operation permissions.

CEL expressions provide a developer-friendly, fast and secure way to evaluate some conditions predefined in the configuration. They are used in some Google services (ex. Firebase), in Envoy RBAC configuration, etc.

For Centrifugo this is a flexible mechanism which can help to avoid using subscription tokens or using subscribe proxy in some cases. This means you can avoid sending an additional HTTP request to the backend for a channel subscription attempt. As the result less resources may be used and smaller latencies may be achieved in the system. This is a way to introduce efficient channel permission mechanics when Centrifugo built-in rules are not enough.

Some good links which may help you dive into CEL expressions are:

* [CEL introduction](https://github.com/google/cel-spec/blob/master/doc/intro.md)
* [CEL language definition](https://github.com/google/cel-spec/blob/master/doc/langdef.md)
* [Docs of Google asset inventory](https://cloud.google.com/asset-inventory/docs/monitoring-asset-changes-with-condition#using_cel) which also uses CEL

Below we will explore some basic expressions and show how they can be used in Centrifugo.

## subscribe_cel

We suppose that the main operation for which developers may use CEL expressions in Centrifugo is a subscribe operation. Let's look at it in detail.

It's possible to configure `subscribe_cel` for a channel namespace (`subscribe_cel` is just an additional namespace [channel option](../server/channels.md#channel-options), with same rules applied). This expression should be a valid CEL expression.

```json title="config.json"
{
    "namespaces": [
        {
            "name": "admin",
            "subscribe_cel": "'admin' in meta.roles"
        }
    ]
}
```

In the example we are using custom `meta` information (must be an object) attached to the connection. As mentioned before in the doc this meta may be attached to the connection:

* when set in the [connect proxy](../server/proxy.md#connect-proxy) result
* or provided in JWT as [meta](../server/authentication.md#meta) claim

An expression is evaluated for every subscription attempt to a channel in a namespace. So if `meta` attached to the connection is sth like this:

```json
{
    "roles": ["admin"]
}
```

– then for every channel in the `admin` namespace defined above expression will be evaluated to `True` and subscription will be accepted by Centrifugo.

:::tip

`meta` must be JSON object (any `{}`) for CEL expressions to work.

:::

### Expression variables

Inside the expression developers can use some variables which are injected by Centrifugo to the CEL runtime. 

Information about current `user` ID, `meta` information attached to the connection, all the variables defined in matched [channel pattern](./channel_patterns.md) will be available for CEL expression evaluation.

Say client with user ID `123` subscribes to a channel `/users/4` which matched the [channel pattern](./channel_patterns.md) `/users/:user`:

| Variable | Type | Example |  Description |
| ------------ | -------------- | ---- | ------------ |
| subscribed | `bool` | `false` |  Whether client is subscribed to channel, always `false` for `subscribe` operation |
| user       | `string`     | `"123"` |  Current authenticated user ID (known from from JWT or connect proxy result) |
| meta     | `map[string]any` | `{"roles": ["admin"]}` | Meta information attached to the connection by the apllication backend (in JWT or over connect proxy result) |
| channel    | `string`     | `"/users/4"` | Channel client tries to subscribe      |
| vars | `map[string]string` | `{"user": "4"}` |  Extracted variables from the matched channel pattern. It's empty in case of using channels without variables. |

In this case, to allow admin to subscribe on any user's channel or allow non-admin user to subscribe only on its own channel, you may construct an expression like this:

```json
{
    ...
    "subscribe_cel": "vars.user == user or 'admin' in meta.roles"
}
```

Let's look at one more example. Say client with user ID `123` subscribes to a channel `/example.com/users/4` which matched the [channel pattern](./channel_patterns.md) `/:tenant/users/:user`. The permission check may be transformed into sth like this (assuming `meta` information has information about current connection tenant):

```json
{
    "namespaces": [
        {
            "name": "/:tenant/users/:user",
            "subscribe_cel": "vars.tenant == meta.tenant && (vars.user == user or 'admin' in meta.roles)"
        }
    ]
}
```

## publish_cel

CEL expression to check permissions to publish into a channel. [Same expression variables](#expression-variables) are available.

## history_cel

CEL expression to check permissions for channel history. [Same expression variables](#expression-variables) are available.

## presence_cel

CEL expression to check permissions for channel presence. [Same expression variables](#expression-variables) are available.
