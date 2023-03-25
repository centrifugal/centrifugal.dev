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
* as a **middleware** before all other Centrifugo channel permission checks for the operation. Below you will see such expressions – they have `_middleware` suffix when configured. If such expression fails, then user won't be able to proceed with operation in any way – execution stops at this point. For example, this may be helpful to prevent HTTP requests on early stage to your app backend when using subscribe proxy.

It's possible to define both types of CEL expressions for the operation inside one namespace.

:::

## subscribe_expression

We suppose that the main operation for which developers may define CEL expressions in Centrifugo is a subscribe operation. Let's look at it in detail.

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

Say client with user ID `123` subscribes to a tenant channel `cf://org_1/users/14` which matched the pattern channel `/users/$user`:

| Variable | Type | Example |  Description |
| ------------ | -------------- | ---- | ------------ |
| user       | string     | `"123"` |  Current user ID |
| meta     | `map[string]any` | `{"roles": ["admin"]}` | Meta information attached to the connection by the apllication backend |
| channel    | string     | `"cf://org_1/users/14"` | Channel client tries to subscribe      |
| instance  | string     | `"org_1"` |  Extracted channel instance (host) part |
| vars | `map[string][]string` | `"{"user": ["14"]}"` |  Extracted variables from matched channel pattern |

In this case, to allow admin to subscribe on any user's channel or allow non-admin user to subscribe only on its own channel, you may construct expression like this:

```json
{
    ...
    "subscribe_expression": "user == vars.user[0] or 'admin' in meta.roles"
}
```

## subscribe_expression_middleware

This expression acts according "middleware" behaviour described above. The expression must pass for execution to proceed.

So for example, the middleware check to make sure user subscribes to the correct tenant (when subscribing `cf://org_1/users/14` as in example above) may look like this:

```json
{
    "namespaces": [
        {
            "name": "admin",
            "subscribe_expression_middleware": "instance == meta.tenant",
            "subscribe_expression": "user == vars.user[0] or 'admin' in meta.roles"
        }
    ]
}
```

## publish_expression

TBD

## publish_expression_middleware

TBD

## history_expression

TBD

## history_expression_middleware

TBD

## presence_expression

TBD

## presence_expression_middleware

TBD

### Channel labels

To make expression concept even more powerful Centrifugo PRO extends channel name syntax with channel labels.

Channel labels are the pairs of `key=value` separated by comma and put inside curly `{}` brackets.

:::note

Note that both key and value of channel label must be in [URL-encoded format](https://en.wikipedia.org/wiki/Percent-encoding) (i.e. escaped). Below we show several examples for different programming languages. 

:::

For example, here is a channel with channel labels set:

```
admin:events{instance=42,project=x1}
```

Labels can be placed only at the end of channel name.

These labels are extracted from the channel name by Centrifugo before evaluating CEL expression and passed to the expression context.

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

For the expression above to evaluate to `True` for channel `admin:events{instance=42&project=x1}`, `meta` should be like:

```json
{
    "instance": "42",
    "projects": ["x1"]
}
```

Let's take a look on one more example. Here is how we could implement [user-limited](../server/channels.md#user-channel-boundary-) channels functionality using CEL expression and channel labels. We could have channel like:

```
users{user=user1,user=user2}
```

Then by using `subscribe_expression` like `"user in labels.user"` we can make sure that only user which is part of channel labels will be able to subscribe on this channel. `user` variable is the current user ID and it's available in a subscribe expression context, see [all available variables](#subscribe-expression-variables) you can use.

:::danger

Note that the order of labels in a channel name is important. In Centrifugo channel is just a string, so channels `events{instance=42,project=x1}` and `events{project=x1,instance=42}` are totally different! Channel labels are just part of a channel string, not stripped or modified in any way by Centrifugo. The ordering concern was the reason why we decided to not use `&` to separate key/value pairs in channel labels. Because this could lead to many mistakes when using URL query string builders which behave differently in various programming languages and libraries.

:::

Here we show label construction examples for different languages (note, we avoid using maps since in many languages maps do not guarantee iteration order):

````mdx-code-block
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs
  className="unique-tabs"
  defaultValue="python"
  values={[
    {label: 'Python', value: 'python'},
    {label: 'Javascript', value: 'javascript'},
  ]
}>
<TabItem value="python">

```python
from urllib.parse import quote
values = [("project", "p1"), ("project", "p2"), ("instance", "42")]
labels = "{" + ",".join(quote(k) + "=" + quote(v) for k, v in values) + "}"
print(labels)
# {project=p1,project=p2,instance=42}
```

</TabItem>
<TabItem value="javascript">

```javascript
let parts = [];
const values = [["project", "p1"], ["project", "p2"], ["instance", "42"]]
values.forEach(function(i) { parts.push(encodeURIComponent(i[0]) + "=" + encodeURIComponent(i[1]));})
const labels = "{" + parts.join(",") + "}";
console.log(labels)
// {project=p1,project=p2,instance=42}
```

</TabItem>
</Tabs>
````