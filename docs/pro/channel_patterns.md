---
id: channel_patterns
sidebar_label: Channel patterns
title: Channel patterns
---

Centrifugo PRO enhances a way to configure channels with Channel Patterns feature. This opens a road for building channel model similar to what developers got used to when writing HTTP servers and configuring routes for HTTP request processing.

### Configuration

Let's look at the example:

```json title="config.json"
{
  "channel": {
    "patterns": true,
    "namespaces": [
      {
        "name": "users_name",
        "pattern": "/users/:name"
      },
      {
        "name": "events_project_type",
        "pattern": "/events/:project/:type"
      }
    ]
  }
}
```

To enable the feature `channel.patterns` option must be set to `true` (Centrifugo PRO requires explicit intent to use channel patterns because theoretically channels with `/` may be already in use for channels without namespace – in that case enabling channel patterns will result into wrong namespace resolution).

Once feature flag enabled, a namespace with `pattern` key which starts with `/` is considered a channel pattern namespace. Just like an HTTP path pattern consists of segments delimited by `/`. The `:` symbol in the segment beginning defines a variable part – more information below.

In this case a channel to be used must be sth like `/users/mario` - i.e. start with `/` and match one of the patterns defined in the configuration. So this channel pattern matching mechanics behaves mostly like HTTP route matching in many frameworks.

Given the configuration example above:

* if channel is `/users/mario`, then the namespace with the pattern `/users/:name` will match and we apply all the options defined for it to the channel.
* if channel is `/events/42/news`, then the namespace with the pattern `/events/:project/:type` will match.
* if channel is `/events/42`, then no namespace will match and the `unknown channel` error will be returned.

```javascript title="Basic example demonstrating use of pattern channels in JS"
const client := new Centrifuge("ws://...", {});
const sub = client.newSubscription('/users/mario');
sub.subscribe();
client.connect();
```

### Implementation details

Some implementation restrictions and details to know about:

* When using channel patterns feature `:` symbol in a namespace pattern defines a variable part. The entire channel starting with `/` is matched over the configured channel patterns, namespace name does not participate in matching at all.
* Centrifugo only allows explicit channel pattern matching which do not result into channel pattern conflicts in runtime, this is checked during configuration validation on server start. Explicitly defined static patterns (without variables) have precedence over patterns with variables.
* There is no analogue of top-level namespace (like we have for standard namespace configuration) for channels starting with `/`. If a channel starting with `/` does not match any explicitly defined pattern then Centrifugo returns the `102: unknown channel` error. And Centrifugo prohibits defining pattern for channels without namespace (i.e. inside `channel.without_namespace` section).
* If you define `channel_regex` inside channel pattern options – then regex matches over the entire channel (since variable parts are located in the namespace name in this case).
* Channel pattern must only contain ASCII characters.
* Duplicate variable names are not allowed inside an individual pattern, i.e. defining `/users/:user/:user` will result into validation error on start.

### Variables

`:` in the channel pattern name helps to define a variable to match against. Named parameters only match a single segment of the channel:

```
Channel pattern "/users/:name":

/users/mary         ✅ match
/users/john         ✅ match
/users/mary/info    ❌ no match 
/users              ❌ no match
```

Another example for channel pattern `/news/:type/:subtype`, i.e. with multiple variables:

```
Channel pattern "/news/:type/:subtype":

/news/sport/football       ✅ match
/news/sport/volleyball     ✅ match
/news/sport                ❌ no match
/news                      ❌ no match
```

Channel patterns support mid-segment variables, so the following is possible:

```
Channel pattern "/personal/user_:user":

/personal/user_mary     ✅ match
/personal/user_john     ✅ match
/personal/user_         ❌ no match
```

### Using varibles

Additional benefits of using channel patterns may be achieved together with Centrifugo PRO [CEL expressions](./cel_expressions.md). Channel pattern variables are available inside CEL expressions for evaluation in a custom way.
