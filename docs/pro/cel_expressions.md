---
id: cel_expressions
sidebar_label: CEL expressions
title: CEL expressions (coming soon)
draft: true
---

This PRO feature is under construction, not available in PRO beta 🚧

Centrifugo PRO supports [CEL expressions](https://opensource.google/projects/cel) (Common Expression Language) for checking channel operation permissions. CEL expressions provide a developer-friendly, fast and secure way to evaluate some conditions predefined in the configuration. They are used in some Google services (ex. Firebase), in Envoy RBAC configuration, etc.

For Centrifugo this is a flexible mechanism which can help to avoid using subscription tokens or using subscribe proxy in some cases. This means you can avoid sending an additional HTTP request to the backend for a channel subscription attempt. As the result less resources may be used and smaller latencies may be achieved in the system. This is a way to introduce efficient channel permission mechanics when Centrifugo built-in rules are not enough.

Some good links which may help you dive into CEL expressions are:

* [CEL introduction](https://github.com/google/cel-spec/blob/master/doc/intro.md)
* [CEL language definition](https://github.com/google/cel-spec/blob/master/doc/langdef.md)
* [Docs of Google asset inventory](https://cloud.google.com/asset-inventory/docs/monitoring-asset-changes-with-condition#using_cel) which also uses CEL

Below we will explore some basic expressions and show how they can be used in Centrifugo.

:::tip

CEL expressions in Centrifugo PRO are defined per namespace and may run in two modes:

* together with all other permission checks. If any of the other built-in permission checks allow connection to perform an operation (may be some other rule in the namespace, not necessary CEL expression) – then operation is allowed. So in this case CEL expression just an extra rule to check over.
* as a **middleware** before all other Centrifugo channel permission checks for the operation. Below you will see such expressions – they have `middleware` part in name. If such expression fails, then user won't be able to proceed with operation in any way – execution stops at this point. For example, this may be helpful to prevent HTTP requests on early stage to your app backend when using subscribe proxy.

It's possible to define both types of CEL expressions for the operation inside one namespace.

:::

## subscribe_cel

We suppose that the main operation for which developers may define CEL expressions in Centrifugo is a subscribe operation. Let's look at it in detail.

It's possible to configure `subscribe_cel` for a channel namespace (`subscribe_cel` is just an additional namespace channel option, with same rules applied as for Centrifugo OSS channel options). This expression should be a valid CEL expression.

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

You can also attach custom `meta` information (must be object) to the connection:

* in connect proxy result
* or in JWT `meta` claim

An expression is evaluated for every subscription attempt to a channel in a namespace. So if `meta` attached to the connection is sth like this:

```json
{
    "roles": ["admin"]
}
```

– then for every channel in `admin` namespace defined above expression will be evaluated to True and subscription will be accepted by Centrifugo.

:::tip

`meta` must be JSON object (any `{}`) for CEL expressions to work.

:::

### Expression variables

Inside the expression developers can use some variables which are injected by Centrifugo to CEL runtime. 

Information about current `user` ID, `meta` information attached to the connection, all the variables defined in matched [channel pattern](./channel_patterns.md) will be available for CEL expression evaluation.

Say client with user ID `123` subscribes to a tenant channel `[org_1]/users/4` which matched the pattern channel `/users/$user`:

| Variable | Type | Example |  Description |
| ------------ | -------------- | ---- | ------------ |
| subscribed | bool | `false` |  Whether client is subscribed to channel, always `false` for `subscribe` operation |
| user       | string     | `"123"` |  Current authenticated user ID |
| meta     | `map[string]any` | `{"roles": ["admin"]}` | Meta information attached to the connection by the apllication backend (in token or over connect proxy result) |
| channel    | string     | `"[org_1]/users/4"` | Channel client tries to subscribe      |
| tenant  | string     | `"org_1"` |  Extracted channel tenant part |
| vars | `map[string][]string` | `{"user": ["4"]}` |  Extracted variables from matched channel pattern |

In this case, to allow admin to subscribe on any user's channel or allow non-admin user to subscribe only on its own channel, you may construct expression like this:

```json
{
    ...
    "subscribe_cel": "user == vars.user[0] or 'admin' in meta.roles"
}
```

## subscribe_middleware_cel

CEL expression middleware evaluated before other channel subscribe permission checks.

This expression acts according to "middleware" behaviour described above. The expression must pass for execution to proceed towards other subscribe checks.

So for example, the middleware check to make sure user subscribes to the correct tenant (when subscribing `[org_1]/users/4` as in example above) may look like this:

```json
{
    "namespaces": [
        {
            "name": "admin",
            "subscribe_middleware_cel": "tenant == meta.tenant",
            "subscribe_cel": "user == vars.user[0] or 'admin' in meta.roles"
        }
    ]
}
```

## publish_cel

CEL expression to check permissions to publish into a channel. [Same variables](#expression-variables) are available.

## publish_middleware_cel

CEL expression middleware evaluated before other channel publish permission checks. [Same variables](#expression-variables) are available.

## history_cel

CEL expression to check permissions for channel history. [Same variables](#expression-variables) are available.

## history_middleware_cel

CEL expression middleware evaluated before other channel history permission checks. [Same variables](#expression-variables) are available.

## presence_cel

CEL expression to check permissions for channel presence. [Same variables](#expression-variables) are available.

## presence_middleware_cel

CEL expression middleware evaluated before other channel presence permission checks. [Same variables](#expression-variables) are available.
