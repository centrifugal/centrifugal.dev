---
description: "Define channel configuration using URL-like patterns with variables in Centrifugo PRO, similar to HTTP route matching in web frameworks."
id: channel_patterns
sidebar_label: Channel patterns
title: Channel patterns
---

Centrifugo PRO enhances the way to configure channels with the Channel Patterns feature. This opens the way to building a channel model similar to what developers are used to when writing HTTP servers and configuring routes for HTTP request processing.

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

To enable the feature, the `channel.patterns` option must be set to `true` (Centrifugo PRO requires explicit intent to use channel patterns because theoretically channels with `/` may already be in use for channels without a namespace – in that case enabling channel patterns will result in wrong namespace resolution).

Once feature flag enabled, a namespace with `pattern` key which starts with `/` is considered a channel pattern namespace. Just like an HTTP path pattern consists of segments delimited by `/`. The `:` symbol in the segment beginning defines a variable part – more information below.

In this case a channel to be used must be something like `/users/mario` - i.e. start with `/` and match one of the patterns defined in the configuration. So this channel pattern matching mechanic behaves mostly like HTTP route matching in many frameworks.

Given the configuration example above:

* if channel is `/users/mario`, then the namespace with the pattern `/users/:name` will match and we apply all the options defined for it to the channel.
* if channel is `/events/42/news`, then the namespace with the pattern `/events/:project/:type` will match.
* if channel is `/events/42`, then no namespace will match and the `unknown channel` error will be returned.

```javascript title="Basic example demonstrating use of pattern channels in JS"
const client = new Centrifuge("ws://...", {});
const sub = client.newSubscription('/users/mario');
sub.subscribe();
client.connect();
```

### Implementation details

Some implementation restrictions and details to know about:

* When using the channel patterns feature, the `:` symbol in a namespace pattern defines a variable part. The entire channel starting with `/` is matched against the configured channel patterns; the namespace name does not participate in matching at all.
* Centrifugo only allows explicit channel pattern matching that does not result in channel pattern conflicts at runtime; this is checked during configuration validation on server start. Explicitly defined static patterns (without variables) take precedence over patterns with variables.
* There is no analogue of a top-level namespace (like we have for standard namespace configuration) for channels starting with `/`. If a channel starting with `/` does not match any explicitly defined pattern, Centrifugo returns the `102: unknown channel` error. Centrifugo also prohibits defining a pattern for channels without a namespace (i.e. inside the `channel.without_namespace` section).
* If you define `channel_regex` inside channel pattern options – then the regex matches over the entire channel (since variable parts are located in the namespace name in this case).
* Channel pattern must only contain ASCII characters.
* Duplicate variable names are not allowed inside an individual pattern, i.e. defining `/users/:user/:user` will result in a validation error on start.

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

### Using variables

Additional benefits of using channel patterns may be achieved together with Centrifugo PRO [CEL expressions](./cel_expressions.md). Channel pattern variables are available inside CEL expressions for evaluation in a custom way.
