---
id: channels
title: Channels
---

Channel is a route for publications. Clients can subscribe to a channel to receive real-time messages published to this channel – new publications and join/leave events (if enabled for a channel namespace). Channel subscriber can also ask for channel presence or channel history information (if enabled for a channel namespace).

Channel is just a string - `news`, `comments` are valid channel names. Though this string has some predefined rules as we will see below.

Channel is an ephemeral entity – **you don't need to create it explicitly**. Channel created automatically by Centrifugo as soon as first client subscribes to it. As soon as last subscriber leaves channel - it's automatically cleaned up.

## Channel name rules

**Only ASCII symbols must be used in channel string**.

Channel name length limited by `255` characters by default (can be changed via configuration file option `channel_max_length`).

Several symbols in channel names reserved for Centrifugo internal needs:

* `:` – for namespace channel boundary (see below)
* `$` – for private channel prefix (see below)
* `#` – for user channel boundary (see below)
* `*` – for future Centrifugo needs
* `&` – for future Centrifugo needs
* `/` – for future Centrifugo needs

### namespace boundary (`:`)

``:`` – is a channel namespace boundary. Namespaces used to set custom options to a group of channels. Each channel belonging to the same namespace will have the same channel options. Read more about available [channel options](#channel-options) and more about [namespaces](#channel-namespaces) below.

If channel is `public:chat` - then Centrifugo will apply options to this channel from channel namespace with name `public`.

:::info

Namespace is part of channel name. If a user subscribed to a channel with namespace, like `public:chat` – then you need to publish messages into `public:chat` channel to be delivered to the user. We often see some confusion from developers trying to publish messages into `chat` and thinking that namespace is somehow stripped upon subscription. It's not true.

:::

### private channel prefix (`$`)

If channel starts with `$` then it is considered *private*. Subscription on a private channel must be properly signed by your backend.

Use private channels if you pass sensitive data inside channel and want to control access permissions on your backend.

For example `$secrets` is a private channel, `$public:chat` - is a private channel that belongs namespace `public`.

Subscription request to private channels requires additional JWT from your application backend. Read [detailed chapter about private channels](private_channels.md).

If you need a personal channel for a single user (or maybe a channel for short and stable set of users) then consider using `user-limited` channel (see below) as a simpler alternative which does not require additional subscription token from your backend.

Also consider using server-side subscriptions or subscribe proxy feature of Centrifugo to model channels with restrictive access. 

### user channel boundary (`#`)

`#` – is a user channel boundary. This is a separator to create personal channels for users (we call this *user-limited channels*) without need to provide subscription token.

For example if channel is `news#42` then only user with ID `42` can subscribe on this channel (Centrifugo knows user ID because clients provide it in connection credentials with connection JWT).

If you want to create user-limited channel in namespace `personal` then you can use name like `personal:user#42` for example.

:::tip

Channel like `$personal:user#42` - i.e. channel with both private prefix `$` and user channel boundary `#` does not have lot of sense, most probably you can just use `personal:user#42` as ID of the user protected by authentication JWT or set by application backend when connect proxy feature is used.

:::

Moreover, you can provide several user IDs in channel name separated by a comma: `dialog#42,43` – in this case only user with ID `42` and user with ID `43` will be able to subscribe on this channel.

This is useful for channels with static list of allowed users, for example for single user personal messages channel, for dialog channel between certainly defined users. As soon as you need to manage access to a channel dynamically for many users this channel type does not suit well.

## Channel options

Channel behaviour can be modified by using channel options. Channel options can be defined on configuration top-level and for every namespace.

### publish

`publish` (boolean, default `false`) – when on allows clients to publish messages into channels directly (from a client-side).

Keep in mind that your application will never receive such messages. In idiomatic use case all messages must be published to Centrifugo by an application backend using Centrifugo API (HTTP or GRPC). Or using [publish proxy](proxy.md#publish-proxy). Since in those cases your application has a chance to validate a message, save it into a database and only after that broadcast to all subscribers.

But `publish` option still can be useful to send something without backend-side validation and saving into a database. This option can also be handy for demos and quick prototyping real-time app ideas.

### subscribe_to_publish

`subscribe_to_publish` (boolean, default `false`) - when `publish` option enabled client can publish into a channel without being subscribed to it. This option enables automatic check that client subscribed on a channel before allowing client to publish.

### anonymous

`anonymous` (boolean, default `false`) – this option enables anonymous user access (i.e. for a user with empty user ID). In most situations your application works with authenticated users so every user has its own unique user ID (set inside JWT `sub` claim or provided by backend when using connect proxy). But if you provide real-time features for a public access you may need unauthenticated access to some channels. Turn on this option and use empty string as user ID. See also related global option [client_anonymous](configuration#client_anonymous) which allows anonymous users to connect without JWT. 

### presence

`presence` (boolean, default `false`) – enable/disable presence information for channels. Presence is an information about clients currently subscribed on channel. It contains each subscriber client ID, user ID, connection info and channel info. By default, this option is off so no presence information will be available for channels.

Enabling channel presence adds some overhead since Centrifugo need to maintain an additional data structure (in a process memory or in a broker).

### presence_disable_for_client

`presence_disable_for_client` (boolean, default `false`) – allows making presence calls available only for a server-side API. By default, presence information is available for both client and server-side APIs.

### join_leave

`join_leave` (boolean, default `false`) – enable/disable sending join(leave) messages when client subscribes to a channel (unsubscribes from a channel). Join/leave event includes information about connection that triggered an event – client ID, user ID, connection info and channel info.

:::caution

Keep in mind that join/leave messages can generate a big number of messages in a system if turned on for channels with large number of actibe subscribers. If you have channels with large number of subscribers consider to avoid using this feature or to scale Centrifugo.

:::

### history_size

`history_size` (integer, default `0`) – history size (amount of messages) for channels. As Centrifugo keeps all history messages in a process memory (or in a broker memory) it's very important to limit maximum amount of messages in channel history with a reasonable value. `history_size` defines maximum amount of messages that Centrifugo will keep for **each** channel in namespace. As soon as history has more messages than defined by history size – old messages will be evicted.

By default history size is `0` - this means that channel history is disabled.

Enabling channel history adds some overhead (both memory and CPU) since Centrifugo need to maintain an additional data structure (in a process memory or in a broker).

### history_ttl

`history_ttl` ([duration](configuration#setting-time-duration-options), default `0s`) – interval how long to keep channel history messages (with seconds precision).

As all history is storing in a process memory (or in a broker memory) it is also very important to get rid of old history data for unused (inactive for a long time) channels.

By default history ttl duration is zero – this means that channel history is disabled.

**So to turn on history you should wisely configure both `history_size` and `history_ttl` options**.

For example for top-level channels (which are not belong to a namespace):

```json title="config.json"
{
    ...
    "history_size": 10,
    "history_ttl": "60s"
}
```

### position

`position` (boolean, default `false`) – when `position` feature is on Centrifugo tries to compensate at most once delivery of PUB/SUB messages checking client position inside a stream.

If Centrifugo detects bad position of client (i.e. potential message loss) it disconnect a client with `Insufficient state` disconnect code. Also, when position option is enabled Centrifugo exposes the current stream top `offset` and current `epoch` in subscribe reply making it possible for a client to manually recover its state upon disconnect using history API.

`position` option must be used in conjunction with reasonably configured message history for a channel i.e. `history_size` and `history_ttl` **must be set** (because Centrifugo uses channel history to check client position in a stream).

### recover

`recover` (boolean, default `false`) – when enabled Centrifugo will try to recover missed publications after a client reconnects for some reason (bad internet connection for example). Also when recovery feature is on Centrifugo automatically enables properties of `position` option described above.

`recover` option must be used in conjunction with reasonably configured message history for channel i.e. `history_size` and `history_ttl` **must be set** (because Centrifugo uses channel history to recover messages).

Also note that not all real-time events require this feature turned on so think wisely when you need this. When this option turned on your application should be designed in a way to tolerate duplicate messages coming from a channel (currently Centrifugo returns recovered publications in order and without duplicates but this is implementation detail that can be theoretically changed in the future). See more details about how recovery works in [special chapter](history_and_recovery.md).

### history_disable_for_client

`history_disable_for_client` (boolean, default `false`) – allows making history available only for a server-side API. By default `false` – i.e. history calls are available for both client and server-side APIs.

:::note

History recovery mechanism if enabled will continue to work for clients anyway even if `history_disable_for_client` is on.

:::

### server_side

`server_side` (boolean, default `false`) – when enabled then all client-side subscription requests to channels in a namespace will be rejected with `PermissionDenied` error. Only server-side subscriptions are possible.

### proxy_subscribe

`proxy_subscribe` (boolean, default `false`) – turns on subscribe proxy, more info in [proxy chapter](proxy.md)

### proxy_publish

`proxy_publish` (boolean, default `false`) – turns on publish proxy, more info in [proxy chapter](proxy.md)

## Channel options config example

Let's look how to set some of these options in a config:

```json title="config.json"
{
    "token_hmac_secret_key": "my-secret-key",
    "api_key": "secret-api-key",
    "anonymous": true,
    "publish": true,
    "subscribe_to_publish": true,
    "presence": true,
    "join_leave": true,
    "history_size": 10,
    "history_ttl": "300s",
    "recover": true
}
```

Here we set channel options on config top-level – these options will affect channels without namespace. Below we describe namespaces and how to define channel options for namespace.

## Channel namespaces

It's possible to configure a list of channel namespaces. Namespaces are optional but very useful. 

Namespace allows to set custom options for channels starting with namespace name. This provides a great control over channel behaviour so you have a flexible way to define different channel options for different real-time features in application.

Namespace has a name, and the same channel options (with same defaults) as described above.

* `name` - unique namespace name (name must consist of letters, numbers, underscores or hyphens and be more than 2 symbols length i.e. satisfy regexp `^[-a-zA-Z0-9_]{2,}$`).

If you want to use namespace options for a channel - you must include namespace name into channel name with `:` as separator:

`public:messages`

`gossips:messages`

Where `public` and `gossips` are namespace names. Centrifugo will look for `:` symbol in channel name, will extract namespace name and will apply namespace options whenever required.

All things together here is an example of `config.json` which includes some top-level channel options set and has 2 additional channel namespaces configured:

```json title="config.json"
{
    "token_hmac_secret_key": "very-long-secret-key",
    "api_key": "secret-api-key",
    "anonymous": true,
    "publish": true,
    "presence": true,
    "join_leave": true,
    "history_size": 10,
    "history_lifetime": 30,
    "namespaces": [
        {
          "name": "public",
          "publish": true,
          "anonymous": true,
          "history_size": 10,
          "history_lifetime": 300,
          "history_recover": true
        },
        {
          "name": "gossips",
          "presence": true,
          "join_leave": true
        }
    ]
}
```

* Channel `news` will use globally defined channel options.
* Channel `public:news` will use `public` namespace's options.
* Channel `gossips:news` will use `gossips` namespace's options.
* Channel `xxx:hello` will result into subscription error since there is no `xxx` namespace defined inn configuration above.

**Channel namespaces also work with private channels and user-limited channels**. For example, if you have namespace called `dialogs` then private channel can be constructed as `$dialogs:gossips`, user-limited channel can be constructed as `dialogs:dialog#1,2`.

:::note

There is no inheritance in channel options and namespaces – for example you defined `presence: true` on a top level of configuration and then defined a namespace – that namespace won't have presence enabled - you must enable it for a namespace explicitly. 

:::
