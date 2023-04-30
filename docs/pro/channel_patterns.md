---
id: channel_patterns
sidebar_label: Channel patterns
title: Channel patterns
draft: true
---

This PRO feature is under active development, some changes expected here 🚧

Centrifugo PRO enhances a way to configure channels with Channel Patterns feature. This opens a road for building channel model similar to what developers got used to when writing HTTP servers and configuring routes for HTTP request processing.

### Configuration

Let's look at the example:

```json
{
    // rest of the config ...
    "channel_patterns": true, // required to turn on the feature.
    "namespaces": [
        {
            "name": "/users/:name"
            // namespace options may go here ...
        },
        {
            "name": "/events/:project/:type"
            // namespace options may go here ...
        }
    ]
}
```

As soon as namespace name starts with `/` - it's considered a channel pattern. Just like an HTTP path it consists of segments delimited by `/`. The `:` symbol in the segment beginning defines a variable part – more information below.

In this case a channel to be used must be sth like `/users/mario` - i.e. start with `/` and match one of the patterns defined in the configuration. So this channel pattern matching mechanics behaves mostly like HTTP route matching in many frameworks.

Given the configuration example above:

* if channel is `/users/mario`, then the namespace with the name `/users/:name` will match and we apply all the options defined for it to the channel.
* if channel is `/events/42/news`, then the namespace with the name `/events/:project/:type` will match.
* if channel is `/events/42`, then no namespace will match and the `unknown channel` error will be returned.

```javascript title="Basic example demonstrating use of pattern channels in JS"
const client := new Centrifuge("ws://...", {});
const sub = client.newSubscription('/users/mario');
sub.subscribe();
client.connect();
```

### Implementation details

Some implementation restrictions and details to know about:

* When using channel patterns feature `:` symbol in a namespace name defines a variable part. It's not related to a namespace separator anymore – the entire channel is matched over the channel pattern. Similar to the HTTP routes semantics. So namespace separator is not needed at all when using channel patterns.
* Centrifugo only allows explicit channel pattern matching which do not result into channel pattern conflicts in runtime, this is checked during configuration validation on server start. Explicitly defined static patterns (without variables) have precedence over patterns with variables.
* There is no analogue of top-level namespace (like we have for standard namespace configuration) for channels starting with `/`. If a channel does not match any explicitly defined pattern then Centrifugo returns the `102: unknown channel` error.
* If you define `channel_regex` inside channel pattern options – then regex matches over the entire channel (since variable parts are located in the namespace name in this case).
* Channel pattern must only contain ASCII characters.
* Duplicate variable names are not allowed inside an individual pattern, i.e. defining `/users/:user/:user` will result into validation error on start.

### Variables

`:` in the channel pattern name helps to define a variable to match against. Named parameters only match a single segment of the channel:

| Pattern | Channel                 | Match     |
| ------- |-------------------------|-----------|
| `/users/:name` | `/users/mary`         |  ✅  |
| `/users/:name` | `/users/john`         |  ✅  |
| `/users/:name` | `/users/mary/profile` |  ❌  |
| `/users/:name` | `/users/`             |  ❌  |

Another example for channel pattern `/news/:type/:subtype`, i.e. with multiple variables:

| Pattern | Channel                 | Match     |
| ------- |-------------------------|-----------|
| `/news/:type/:subtype` | `/news/sport/football`    |  ✅  |
| `/news/:type/:subtype` | `/news/sport/volleyball`  |  ✅  |
| `/news/:type/:subtype` | `/news/sport`             |  ❌  |
| `/news/:type/:subtype` | `/news`                   |  ❌  |

Channel patterns support mid-segment variables, so the following is possible:

| Pattern | Channel                 | Match     |
| ------- |-------------------------|-----------|
| `/personal/user_:user` | `/personal/user_mary`  |  ✅  |
| `/personal/user_:user` | `/personal/user_john`  |  ✅  |
| `/personal/user_:user` | `/personal/user_`      |  ❌  |

### Using varibles

Additional benefits of using channel patterns may be achieved together with Centrifugo PRO [CEL expressions](./cel_expressions.md). Channel pattern variables are available inside CEL expressions for evaluation in a custom way.
