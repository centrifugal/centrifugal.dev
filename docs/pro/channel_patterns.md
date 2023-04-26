---
id: channel_patterns
sidebar_label: Channel patterns
title: Channel patterns (coming soon)
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
            "name": "/users/$name"
            // namespace options may go here ...
        },
        {
            "name": "/events/$project/$type"
            // namespace options may go here ...
        }
    ]
}
```

As soon as namespace name starts with `/` - it's considered a channel pattern. Just like an HTTP path it consists of segments delimited by `/`. The `$` symbol in the segment beginning defines a variable part – more information below.

In this case a channel to be used must be sth like `/users/mario` - i.e. start with `/` and match one of the patterns defined in the configuration. So this channel pattern matching mechanics behaves mostly like HTTP route matching in many frameworks.

Given the configuration example above:

* if channel is `/users/mario`, then the namespace with the name `/users/$name` will match and we apply all the options defined for it to the channel.
* if channel is `/events/42/news`, then the namespace with the name `/events/$project/$type` will match.
* if channel is `/events/42`, then no namespace will match and the `unknown channel` error will be returned.

```javascript title="Basic example demonstrating use of pattern channels in JS"
const client := new Centrifuge("ws://...", {});
const sub = client.newSubscription('/users/mario');
sub.subscribe();
client.connect();
```

### Implementation details

Some implementation restrictions and details to know about:

* Centrifugo only allows explicit channel patterns which do not result into channel pattern conflicts, this is checked during configuration validation on server start. The logic is inspired by [julienschmidt/httprouter](https://github.com/julienschmidt/httprouter) (though we are not using that lib for the implementation).
* Pattern names can't start with `/$`, `/*` or `//` – Centrifugo requires first segment to be a non-variable part, this should help your routes scale as time goes. Read more about variables below.
* When using channel patterns feature `:` symbol in a channel name is not a namespace separator anymore – the entire channel is matched over the namespace name (over channel pattern). Similar to the HTTP routes semantics.
* There is no analogue of top-level namespace (like we have for standard namespace configuration) for channels starting with `/`. If a channel does not match any explicitly defined pattern then Centrifugo returns the `102: unknown channel` error.
* If you define `channel_regex` inside channel pattern options – then regex matches over the entire channel (since variable parts are located in the namespace name in this case).

### Variables

`$` in the channel pattern name helps to define a variable to match against. Named parameters only match a single segment of the channel:

```
Channel pattern: /users/$name

Channels:
  /users/gordon              match
  /users/mary                match
  /users/gordon/profile      no match
  /users/                    no match
```

The second type is catch-all variable and it has the form of `*path`. Like the name suggests, this variable matches everything. Therefore it must always be at the end of the pattern:

```
Channel pattern: /sources/*path

Channels:
  /sources/           match
  /sources/file       match
  /sources/dir/file   match
```

Additional benefits of using channel patterns may be achieved together with Centrifugo PRO [CEL expressions](./cel_expressions.md). Channel pattern variables are available inside CEL expressions for evaluation in a custom way.
