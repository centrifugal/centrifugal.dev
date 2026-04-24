---
description: "Control channel permissions per connection or subscription in Centrifugo PRO using capabilities with wildcard and regex matching support."
id: capabilities
title: Channel capabilities
---

At this point you know that Centrifugo allows configuring channel permissions on a per-namespace level. When creating a new real-time feature it's recommended to create a new namespace for it and configure permissions. To achieve better channel permission control inside a namespace, Centrifugo PRO provides the possibility to set capabilities on an individual connection basis, or on an individual channel subscription basis.

Let's start by looking at connection-wide capabilities first.

## Connection capabilities

Connection capabilities can be set:

* in connection JWT (in `caps` claim)
* in connect proxy result (`caps` field)

For example, here we are issuing permissions to subscribe on channel `news` and channel `user_42` to a client:

```json
{
    "caps": [
        {
            "channels": ["news", "user_42"],
            "allow": ["sub"]
        }
    ]
}
```

Known capabilities:

* `sub` - subscribe to a channel to receive publications from it
* `pub` - publish into a channel (your backend won't be able to process the publication in this case)
* `prs` - call presence and presence stats API, also consume join/leave events upon subscribing
* `hst` - call history API, also make Subscription positioned or recoverable upon subscribing

### Caps processing behavior

Centrifugo processes caps objects until it finds a match for a channel. At that point it applies permissions in the matched object and stops processing remaining caps. If no match is found – then `103 permission denied` is returned to a client (of course if the namespace does not have other permission-related options enabled). Let's consider an example like this:

```json title="WRONG!"
{
    "caps": [
        {
            "channels": ["news"],
            "allow": ["pub"]
        },
        {
            "channels": ["news"],
            "allow": ["sub"]
        },
    ]
}
```

Here we have two entries for channel `news`, but when client subscribes on `news` only the first entry will be taken into consideration by Centrifugo – so Subscription attempt will be rejected (since first cap object does not have `sub` capability). In real life you don't really want to have cap objects with identical channels – but below we will introduce wildcard matching where understanding how caps processed becomes important.

Another example:

```json title="WRONG!"
{
    "caps": [
        {
            "channels": ["news", "user_42"],
            "allow": ["sub"]
        },
        {
            "channels": ["user_42"],
            "allow": ["pub", "hst", "prs"]
        },
    ]
}
```

One could expect that the client will have `["sub", "pub", "hst", "prs"]` capabilities for channel `user_42`. But this is not true since Centrifugo processes caps objects and channels inside the caps object in order – it finds a match to `user_42` in the first caps object, which contains only the `"sub"` capability, and processing stops. So the user can subscribe to a channel, but cannot publish, cannot call history and presence APIs even though those capabilities are mentioned in the `caps` object. The correct way to give all caps to the channel `user_42` would be to split channels into different caps objects:

```json title="CORRECT"
{
    "caps": [
        {
            "channels": ["news"],
            "allow": ["sub"]
        },
        {
            "channels": ["user_42"],
            "allow": ["sub", "pub", "hst", "prs"]
        },
    ]
}
```

The processing behaves like this to avoid potential problems with possibly conflicting matches (mostly when using wildcard and regex matching – see below) and to still allow overriding capabilities for specific channels.

### Expiration considerations

* In the JWT auth case – capabilities in the JWT will work until token expiration, that's why it's important to keep reasonably small token expiration times. We can recommend using something like 5–10 minutes as a good expiration value, but of course this is application specific.
* In the connect proxy case – capabilities will work until client connection close (disconnect) or connection refresh is triggered (with refresh proxy you can provide an updated set of capabilities).

### Revoking connection caps

If at some point you need to revoke some capability from a client:

* Simplest way is to wait for a connection expiration, then upon refresh:
    * if using proxy – provide new caps in refresh proxy result, Centrifugo will update caps and unsubscribe a client from channels it does not have permissions anymore (**only those obtained due to previous connection-wide capabilities**).
    * if JWT auth - provide new caps in connection token, Centrifugo will update caps and unsubscribe a client from channels it does not have permissions anymore (**only those obtained due to previous connection-wide capabilities**).
* In the case of using connect proxy – you can disconnect a user (or client) with a reconnect code. New capabilities will be requested upon reconnection.
* In the case of using token auth – revoke the token (Centrifugo PRO feature) and disconnect the user (or client) with a reconnect code. Upon reconnection the user will receive an error that the token was revoked and will try to load a new one.

### Example: wildcard match

It's possible to use wildcards in channel resource names. For example, let's give a permission to subscribe on all channels in `news` namespace.

```json
{
    "caps": [
        {
            "channels": ["news:*"],
            "match": "wildcard",
            "allow": ["sub"]
        }
    ]
}
```

:::note

Match type is used for all `channels` in the caps object. If you need different matching behavior for different channels, then split them into different caps objects.

:::

### Example: regex match

Or regex:

```json
{
    "caps": [
        {
            "channels": ["^posts_[\d]+$"],
            "match": "regex",
            "allow": ["sub"]
        }
    ]
}
```

### Example: different types of match

Of course it's possible to combine different types of match inside one `caps` array:

```json
{
    "caps": [
        {
            "channels": ["^posts_[\d]+$"],
            "match": "regex",
            "allow": ["sub"]
        },
        {
            "channels": ["user_42"],
            "allow": ["sub"]
        }
    ]
}
```

### Example: full access to all channels

Let's look how to allow all permissions to a client:

```json
{
    "caps": [
        {
            "channels": ["*"],
            "match": "wildcard",
            "allow": ["sub", "pub", "hst", "prs"]
        }
    ]
}
```

:::danger Full access warn

Should we mention that giving full access to a client is something to wisely consider? 🤔

:::

## Subscription capabilities

Subscription capabilities can be set:

* in subscription JWT (in `allow` claim)
* in subscribe proxy result (`allow` field)

A subscription token already belongs to a channel (it has a `channel` claim). So users with a valid subscription token can subscribe to a channel. But it's possible to additionally grant channel permissions to a user for publishing and calling presence and history using the `allow` claim:

```json
{
    "allow": ["pub", "hst", "prs"]
}
```

Putting the `sub` permission in the subscription token does not make much sense – Centrifugo only expects a valid token for a subscription permission check.

### Expiration considerations

* In the JWT auth case – capabilities in the subscription JWT will work until token expiration, that's why it's important to keep reasonably small token expiration times. We can recommend using something like 5–10 minutes as a good expiration value, but of course this is application specific.
* In the subscribe proxy case – capabilities will work until the client unsubscribes (or the connection closes).

### Revoking subscription permissions

If at some point you need to revoke some capability from a client:

* Simplest way is to wait for a subscription expiration, then upon refresh:
    * provide new caps in subscription token, Centrifugo will update channel caps.
* In the case of using subscribe proxy – you can unsubscribe a user (or client) with a resubscribe code. Or disconnect with a reconnect code. New capabilities will be set up upon resubscription/reconnection.
* In the case of using JWT auth – revoke the token (Centrifugo PRO feature) and unsubscribe/disconnect the user (or client) with a resubscribe/reconnect code. Upon resubscription/reconnection the user will receive an error that the token was revoked and will try to load a new one.
