---
id: channel_patterns
sidebar_label: Channel patterns
title: Channel patterns (coming soon)
draft: true
---

This PRO feature is under construction, not available in PRO beta 🚧

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

`$` in the segment beginning defines a variable part, more information below.

In this case a channel to be used must be sth like `/users/mario` - i.e. start with `/` and match one of the patterns defined in the configuration. So this channel pattern matching mechanics behaves mostly like HTTP route resolving in many frameworks. Some examples:

* channel is `/users/mario`, then the namespace with the name `/users/$name` will match and we apply all the options defined for it to the channel.
* channel is `/events/42/news`, then the namespace with the name `/events/$project/$type` will match.
* channel is `/events/42`, then no namespace will match and the `unknown channel` error will be returned.

### Limitations

Some limitations to know about:

* Centrifugo only allows explicit channel patterns which do not result into channel pattern conflicts, this is checked during configuration validation on server start.
* Pattern names can't start with `/$`, `/*` or `//` – Centrifugo requires first segment to not be a variable part, this should help your routes scale as time goes. See more about variables below.
* When using channel patterns feature `:` symbol in a channel name is not a namespace separator anymore – the entire channel is matched over the namespace name (over channel pattern). Similar to the HTTP routes semantics.
* There is no analogue of top-level namespace (like we have for standard namespace configuration) for channels starting with `/`. If a channel does not match any explicitly defined pattern then Centrifugo returns the `unknown channel` error.

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
  /sources/:something           match
  /sources/file:something       match
  /sources/dir/file:something   match
```

### Tenant channels

As the next step Centrifugo PRO extends channel name syntax with tenant channels. This is only available when `channel_patterns` feature is used.

Tenant channel format looks very similar to the format used for URLs:

```
cf://org_1/users/test
cf://org_2/posts/test
```

`cf` part is necessary in this case and is called `protocol` part. Protocol must always be `cf` at the moment. The `org_1` is called host (or tenant) part. In general you can choose any string which fits your app for the host part of a channel but we recommend putting something which identifies the particular application instance (tenant) into it. If you only have one tenant in the app – then use sth like app name or just don't use tenant channels at all.

The protocol and host parts are ignored by Centrifugo when resolving a namespace for a channel, namespace is extracted as part of the channel after host (i.e. from the `path` part if we remember about URL convention). For example, in channel `cf://org_15/private/test` the extracted namespace part will be `/private/test`.

Additional benefits of using channel patterns and tenant channels may be achieved together with Centrifugo PRO [CEL expressions](./cel_expressions.md). The host part of tenant channel becomes available for CEL expressions as a separate variable which may be used for rule evaluation in a custom way. For example, may be used as a check that user belongs to a particular tenant of the application. And the channel pattern variables are also available to be used inside CEL expressions. 
