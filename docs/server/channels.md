---
id: channels
title: Channels
---

One of the core concepts of Centrifugo is a `channel`. Most of the time you will work with them and decide what is the best channel configuration for your application.

## What is channel

Channel is a route for publications. Clients can subscribe to a channel to receive real-time messages published to a channel – new publications and join/leave events. In other PUB/SUB systems similar concept can be called a `topic`. A channel subscriber can also ask for a channel presence or channel history information.

Channel is just a string - `news`, `comments`, `personal_feed` are valid channel names. Though this string has some [predefined rules](#channel-name-rules) as we will see below. You can define different channel behavior using a set of available [channel options](#channel-options).

Channels are ephemeral – you don't need to create them explicitly. Channels created automatically by Centrifugo as soon as the first client subscribes to a channel. As soon as the last subscriber leaves a channel - it's automatically cleaned up.

Channel can belong to a channel namespace. [Channel namespacing](#channel-namespaces) is a mechanism to define different behavior for different channels in Centrifugo. Using namespaces is a recommended way to manage channels – to turn on only those channel options which are required for a specific real-time feature you are implementing on top of Centrifugo.

:::caution

When using channel namespaces make sure you defined a namespace in configuration. Subscription attempts to a channel within a non-defined namespace will result into [102: unknown channel](codes.md#unknown-channel) errors.

:::

## Channel name rules

**Only ASCII symbols must be used in a channel string**.

Channel name length limited by `255` characters by default (can be changed via configuration file option `channel_max_length`).

Several symbols in channel names reserved for Centrifugo internal needs:

* `:` – for namespace channel boundary (see below)
* `$` – for private channel prefix (see below)
* `#` – for user channel boundary (see below)
* `*` – for the future Centrifugo needs
* `&` – for the future Centrifugo needs
* `/` – for the future Centrifugo needs

### namespace boundary (`:`)

``:`` – is a channel namespace boundary. Namespaces are used to set custom options to a group of channels. Each channel belonging to the same namespace will have the same channel options. Read more about available [channel options](#channel-options) and more about [namespaces](#channel-namespaces) below.

If the channel is `public:chat` - then Centrifugo will apply options to this channel from the channel namespace with the name `public`.

:::info

A namespace is part of the channel name. If a user subscribed to a channel with namespace, like `public:chat` – then you need to publish messages into `public:chat` channel to be delivered to the user. We often see some confusion from developers trying to publish messages into `chat` and thinking that namespace is somehow stripped upon subscription. It's not true.

:::

### user channel boundary (`#`)

`#` – is a user channel boundary. This is a separator to create personal channels for users (we call this *user-limited channels*) without the need to provide a subscription token.

For example, if the channel is `news#42` then the only user with ID `42` can subscribe to this channel (Centrifugo knows user ID because clients provide it in connection credentials with connection JWT).

If you want to create a user-limited channel in namespace `personal` then you can use a name like `personal:user#42` for example.

Moreover, you can provide several user IDs in channel name separated by a comma: `dialog#42,43` – in this case only the user with ID `42` and user with ID `43` will be able to subscribe on this channel.

This is useful for channels with a static list of allowed users, for example for single user personal messages channel, for dialog channel between certainly defined users. As soon as you need to manage access to a channel dynamically for many users this channel type does not suit well.

User-limited channels must be enabled for a channel namespace using `enable_user_limit_channels` option. See below more information about channel options and channel namespaces. 

### private channel prefix (`$`)

Centrifugo v4 has this option to achieve compatibility with previous Centrifugo versions. Previously (in Centrifugo v1, v2 and v3) only channels starting with `$` could be subscribed using a subscription token. In Centrifugo v4 that's not the case anymore – clients can subscribe to any channel with a subscription token (and if the token is valid – then subscription is accepted).

But for namespaces with `allow_subscribe_for_client` option enabled Centrifugo does not allow subscribing on channels starting with `private_channel_prefix` (`$` by default) without a subscription token. This limitation exists to help users migrate to Centrifugo v4 without security risks. You can disable this limitation by setting `private_channel_prefix` option to `""` (empty string).

<!-- If the channel starts with `$` then it is considered *private*. The subscription on a private channel must be properly signed by your backend.

Use private channels if you pass sensitive data inside the channel and want to control access permissions on your backend.

For example `$secrets` is a private channel, `$public:chat` - is a private channel that belongs to namespace `public`.

Subscription request to private channels requires additional JWT from your application backend. Read [detailed chapter about private channels](private_channels.md).

If you need a personal channel for a single user (or maybe a channel for a short and stable set of users) then consider using a `user-limited` channel (see below) as a simpler alternative that does not require an additional subscription token from your backend.

Also, consider using server-side subscriptions or subscribe proxy feature of Centrifugo to model channels with restrictive access.  -->

## Channel options

Channel behavior can be modified by using channel options. Channel options can be defined on configuration top-level and for every namespace.

### presence

`presence` (boolean, default `false`) – enable/disable online presence information for channels in a namespace. 

Online presence is information about clients currently subscribed to the channel. It contains each subscriber's client ID, user ID, connection info, and channel info. By default, this option is off so no presence information will be available for channels.

:::caution

Enabling channel online presence adds some overhead since Centrifugo needs to maintain an additional data structure (in a process memory or in a broker memory/disk). So only use it for channels where presence is required.

:::

### join_leave

`join_leave` (boolean, default `false`) – enable/disable sending join and leave messages when the client subscribes to a channel (unsubscribes from a channel). Join/leave event includes information about the connection that triggered an event – client ID, user ID, connection info, and channel info (similar to entry inside presence information).

:::caution

Keep in mind that join/leave messages can generate a huge number of messages in a system if turned on for channels with a large number of active subscribers. If you have channels with a large number of subscribers consider avoiding using this feature. It's hard to say what is "large" for you though – just estimate the load based on the fact that each subscribe/unsubscribe event in a channel with N subscribers will result into N messages broadcasted to all. If all clients reconnect at the same time the amount of generated messages is N^2.

:::

### history_size

`history_size` (integer, default `0`) – history size (amount of messages) for channels. As Centrifugo keeps all history messages in process memory (or in a broker memory) it's very important to limit the maximum amount of messages in channel history with a reasonable value. `history_size` defines the maximum amount of messages that Centrifugo will keep for **each** channel in the namespace. As soon as history has more messages than defined by history size – old messages will be evicted.

Setting only `history_size` **is not enough to enable history in channels** – you also need to wisely configure `history_ttl` option (see below). 

:::caution

Enabling channel history adds some overhead (both memory and CPU) since Centrifugo needs to maintain an additional data structure (in a process memory or a broker memory/disk). So only use history for channels where it's required.

:::

### history_ttl

`history_ttl` ([duration](./configuration.md#setting-time-duration-options), default `0s`) – interval how long to keep channel history messages (with seconds precision).

As all history is storing in process memory (or in a broker memory) it is also very important to get rid of old history data for unused (inactive for a long time) channels.

By default history TTL duration is zero – this means that channel history is disabled.

**Again – to turn on history you should wisely configure both `history_size` and `history_ttl` options**.

For example for top-level channels (which do not belong to a namespace):

```json title="config.json"
{
    ...
    "history_size": 10,
    "history_ttl": "60s"
}
```

### force_positioning

`force_positioning` (boolean, default `false`) – when the `force_positioning` option is on Centrifugo forces all subscriptions in a namespace to be `positioned`. I.e. Centrifugo will try to compensate at most once delivery of PUB/SUB broker checking client position inside a stream.

If Centrifugo detects a bad position of the client (i.e. potential message loss) it disconnects a client with the `Insufficient state` disconnect code. Also, when the position option is enabled Centrifugo exposes the current stream top `offset` and current `epoch` in subscribe reply making it possible for a client to manually recover its state upon disconnect using history API.

`force_positioning` option must be used in conjunction with reasonably configured message history for a channel i.e. `history_size` and `history_ttl` **must be set** (because Centrifugo uses channel history to check client position in a stream).

### force_recovery

`force_recovery` (boolean, default `false`) – when the `position` option is on Centrifugo forces all subscriptions in a namespace to be `recoverable`. When enabled Centrifugo will try to recover missed publications in channels after a client reconnects for some reason (bad internet connection for example). Also when the recovery feature is on Centrifugo automatically enables properties of the `force_positioning` option described above.

`force_recovery` option must be used in conjunction with reasonably configured message history for channel i.e. `history_size` and `history_ttl` **must be set** (because Centrifugo uses channel history to recover messages).

:::tip

Not all real-time events require this feature turned on so think wisely when you need this. When this option is turned on your application should be designed in a way to tolerate duplicate messages coming from a channel (currently Centrifugo returns recovered publications in order and without duplicates but this is an implementation detail that can be theoretically changed in the future). See more details about how recovery works in [special chapter](history_and_recovery.md).

:::

### enable_user_limited_channels

TBD

### allow_subscribe_for_client

TBD

<!-- `protected` (boolean, default `false`) – when on will prevent a client to subscribe to arbitrary channels in a namespace. In this case, Centrifugo will only allow a client to subscribe on user-limited channels, on channels returned by the proxy response, or channels listed inside JWT. Client-side subscriptions to arbitrary channels will be rejected with PermissionDenied error. Server-side channels belonging to the protected namespace passed by the client itself during connect will be ignored. -->

### allow_anonymous_access

`allow_anonymous_access` (boolean, default `false`) – this option enables anonymous user access (i.e. for a user with an empty user ID). In most situations, your application works with authenticated users so every user has its unique user ID (set inside JWT `sub` claim or provided by backend when using connect proxy). But if you provide real-time features for public access you may need unauthenticated access to some channels. Turn on this option and use an empty string as a user ID. See also related global option [client_anonymous](./configuration.md#client_anonymous) which allows anonymous users to connect without JWT. 

### allow_publish_for_subscriber

`subscribe_to_publish` (boolean, default `false`) - when the `publish` option is enabled client can publish into a channel without being subscribed to it. This option enables an automatic check that the client subscribed to a channel before allowing a client to publish.

### allow_publish_for_client

`publish` (boolean, default `false`) – when on allows clients to publish messages into channels directly (from a client-side).

Keep in mind that your application will never receive such messages. In an idiomatic use case, all messages must be published to Centrifugo by an application backend using Centrifugo API (HTTP or GRPC). Or using [publish proxy](proxy.md#publish-proxy). Since in those cases your application has a chance to validate a message, save it into a database, and only after that broadcast to all subscribers.

But the `publish` option still can be useful to send something without backend-side validation and saving it into a database. This option can also be handy for demos and quick prototyping real-time app ideas.

### allow_history_for_subscriber

`history_disable_for_client` (boolean, default `false`) – allows making history available only for a server-side API. By default `false` – i.e. history calls are available for both client and server-side APIs.

:::note

History recovery mechanism if enabled will continue to work for clients anyway even if `history_disable_for_client` is on.

:::

### allow_history_for_client

TBD

### allow_presence_for_subscriber

TBD

### allow_presence_for_client

`presence_disable_for_client` (boolean, default `false`) – allows making presence calls available only for a server-side API. By default, presence information is available for both client and server-side APIs.


### proxy_subscribe

`proxy_subscribe` (boolean, default `false`) – turns on subscribe proxy, more info in [proxy chapter](proxy.md)

### proxy_publish

`proxy_publish` (boolean, default `false`) – turns on publish proxy, more info in [proxy chapter](proxy.md)

### subscribe_proxy_name

`subscribe_proxy_name` (string, default `""`) – turns on subscribe proxy when [granular proxy mode](proxy.md#granular-proxy-mode) is used. Note that `proxy_subscribe` option defined above is ignored in granular proxy mode.

### publish_proxy_name

`publish_proxy_name` (string, default `""`) – turns on publish proxy when [granular proxy mode](proxy.md#granular-proxy-mode) is used. Note that `proxy_publish` option defined above is ignored in granular proxy mode.

### Config example

Let's look at how to set some of these options in a config:

```json title="config.json"
{
    "token_hmac_secret_key": "my-secret-key",
    "api_key": "secret-api-key",
    "presence": true,
    "history_size": 10,
    "history_ttl": "300s",
    "recover": true,
    "allow_subscribe_for_client": true,
    "allow_anonymous_access": true,
    "allow_publish_for_subscriber": true,
}
```

Here we set channel options on config top-level – these options will affect channels without namespace. Below we describe namespaces and how to define channel options for a namespace.

## Channel namespaces

It's possible to configure a list of channel namespaces. Namespaces are optional but very useful. 

A namespace allows setting custom options for channels starting with the namespace name. This provides great control over channel behavior so you have a flexible way to define different channel options for different real-time features in the application.

Namespace has a name, and the same channel options (with the same defaults) as described above.

* `name` - unique namespace name (name must consist of letters, numbers, underscores, or hyphens and be more than 2 symbols length i.e. satisfy regexp `^[-a-zA-Z0-9_]{2,}$`).

If you want to use namespace options for a channel - you must include namespace name into channel name with `:` as a separator:

`public:messages`

`gossips:messages`

Where `public` and `gossips` are namespace names. Centrifugo will look for `:` symbol in the channel name, will extract the namespace name, and will apply namespace options whenever required.

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
    "history_ttl": "30s",
    "namespaces": [
        {
          "name": "public",
          "publish": true,
          "anonymous": true,
          "history_size": 10,
          "history_ttl": "300s",
          "recover": true
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
* Channel `public:news` will use `public` namespace options.
* Channel `gossips:news` will use `gossips` namespace options.
* Channel `xxx:hello` will result into subscription error since there is no `xxx` namespace defined inn configuration above.

**Channel namespaces also work with private channels and user-limited channels**. For example, if you have a namespace called `dialogs` then the private channel can be constructed as `$dialogs:gossips`, user-limited channel can be constructed as `dialogs:dialog#1,2`.

:::note

There is no inheritance in channel options and namespaces – for example, you defined `presence: true` on a top level of configuration and then defined a namespace – that namespace won't have online presence enabled - you must enable it for a namespace explicitly. 

:::

## Channel permissions for server API

When using Centrifugo server API you don't need to think about channel permissions at all – everything is allowed. In case of server API request to Centrifugo must be issued by your application backend – so you have all the power to check any required permissions before issuing API request to Centrifugo.

The situation is different when we are talking about client real-time API. See details below.

## Channel permissions for client API

In order to configure which client (i.e. connection established using one of supported bidirectional real-time transports) can subscribe to channels and call publish, history and presence real-time APIs Centrifugo provides several ways to configure the desired behavior.

Let's start from looking at Centrifugo subscribe permission model.

### Subscribe permission model

By default, client's attempt to subscribe on a channel will be rejected by a server with `103: permission denied` error. There are several approaches how to control channel subscribe permissions:

* [Provide subscription token](#provide-subscription-token)
* [Configure subscribe proxy](#configure-subscribe-proxy)
* [Subscribe capabilities in connection token](#subscribe-capabilities-in-connection-token)
* [Subscribe capabilities in connect proxy](#subscribe-capabilities-in-connect-proxy)
* [Use user-limited channels](#use-user-limited-channels)
* [Use subscribe CEL expression](#use-subscribe-cel-expression)
* [Use subscribe_allowed_for_client namespace option](#use-subscribeallowedforclient-namespace-option)

Below, we are describing those in detail.

#### Provide subscription token

A client can provide a subscription token in subscribe request. See the format of the token.

If client provides a valid token then subscription will be accepted. Token can additionally grant `publish`, `history` and `presence` permissions to a client.

:::caution

For namespaces with `allow_subscribe_for_client` option ON Centrifugo does not allow subscribing on channels starting with `private_channel_prefix` (`$` by default) without token. This limitation exists to help users migrate to Centrifugo v4 without security risks. You can disable this limitation by setting `private_channel_prefix` option to `""` (empty string).

:::

#### Configure subscribe proxy

If client subscribes on a namespace with configured subscribe proxy then depending on proxy response subscription will be accepted or not.

If a namespace has configured subscribe proxy, but user came with a token – then subscribe proxy is not used, we are relying on token in this case. If a namespace has subscribe proxy, but user subscribes on a user-limited channel – then subscribe proxy is not used also.

#### Use user-limited channels

If client subscribes on a user-limited channel and there is a user ID match then subscription will be accepted.

:::caution

User-limited channels must be enabled in a namespace using `enable_user_limited_channels` option.

:::

#### Subscribe capabilities in connection token

Connection token can contain a capability object to allow user subscribe to channels.

#### Subscribe capabilities in connect proxy

Connect proxy can return capability object to allow user subscribe to channels.

#### Use subscribe CEL expression

If namespace contains subscribe expression then it's checked to return `true`

#### Use subscribe_allowed_for_client namespace option

`subscribe_allowed_for_client` allows all connections to subscribe on all channels in a namespace.

### Publish permission model

:::tip

In idiomatic Centrifugo use case data should be published to channels from the application backend (over server API). In this case backend can validate data, save it into persistent storage before publishing in real-time towards connections. When publishing from the client-side backend does not receive publication data at all – it just goes through Centrifugo (except using publish proxy). There are cases when direct publications from the client-side are desired (like typing indicators in chat applications) though.

:::

By default, client's attempt to publish data into a channel will be rejected by a server with `103: permission denied` error. There are several approaches how to control channel publish permissions:

* [Publish capabilities in connection token](#publish-capabilities-in-connection-token)
* [Publish capability in subscription token](#publish-capability-in-subscription-token)
* [Publish capabilities in connect proxy](#publish-capabilities-in-connect-proxy)
* [Publish capability in subscribe proxy](#publish-capability-in-subscribe-proxy)
* [Configure publish proxy](#configure-publish-proxy)
* [Use publish_allowed_for_subscriber namespace option](#use-publishallowedforsubscriber-namespace-option)
* [Use publish_allowed_for_client namespace option](#use-publishallowedforclient-namespace-option)

#### Publish capabilities in connection token

Connection token can contain a capability object to allow client to publish to channels.

#### Publish capability in subscription token

Connection token can contain a capability object to allow client to publish to a channel.

#### Publish capabilities in connect proxy

Connect proxy can return capability object to allow client publish to certain channels.

#### Publish capability in subscribe proxy

Subscribe proxy can return capability object to allow subscriber publish to channel.

#### Use publish_allowed_for_client namespace option

`publish_allowed_for_client` allows publications to channels of a namespace for all client connections. 

#### Use publish_allowed_for_subscriber namespace option

`publish_allowed_for_subscriber` allows publications to channels of a namespace for all connections subscribed on a channel they want to publish data into.

#### Configure publish proxy

If client publishes to a namespace with configured publish proxy then depending on proxy response publication will be accepted or not.

Configured publish proxy always used??? (what if user has permission in token or publish_allowed_for_client?)

### History permission model

By default, client's attempt to call history from a channel (with history retention configured) will be rejected by a server with `103: permission denied` error. There are several approaches how to control channel history permissions.

#### Use history_allowed_for_client namespace option

`history_allowed_for_client` allows history requests to all channels in a namespace for all client connections. 

#### Use history_allowed_for_subscriber namespace option

`history_allowed_for_subscriber` allows history requests to all channels in a namespace for all client connections subscribed on a channel they want to call history for.

#### History capabilities in connection token

Connection token can contain a capability object to allow user call history for channels.

#### History capabilities in subscription token

Connection token can contain a capability object to allow user call history from a channel.

#### History capabilities in connect proxy

Connect proxy can return capability object to allow client call history from certain channels.

#### History capability in subscribe proxy response

Subscribe proxy can return capability object to allow subscriber call history from channel.

### Presence permission model

By default, client's attempt to call presence from a channel (with channel presence configured) will be rejected by a server with `103: permission denied` error. There are several approaches how to control channel presence permissions.

#### Presence capabilities in connection token

Connection token can contain a capability object to allow user call presence for channels.

#### Presence capabilities in subscription token

Connection token can contain a capability object to allow user call presence of a channel.

#### Presence capabilities in connect proxy

Connect proxy can return capability object to allow client call presence from certain channels.

#### Presence capability in subscribe proxy response

Subscribe proxy can return capability object to allow subscriber call presence from channel.

#### Use presence_allowed_for_client namespace option

`presence_allowed_for_client` allows presence requests to all channels in a namespace for all client connections. 

#### Use presence_allowed_for_subscriber namespace option

`presence_allowed_for_subscriber` allows presence requests to all channels in a namespace for all client connections subscribed on a channel they want to call presence for.

### Positioning permission model

Server can whether turn on positioning for all channels in a namespace using `"position": true` option or client can create positioned subscriptions (but in this case it should have `history` capability).

### Recovery permission model

Server can whether turn on automatic recovery for all channels in a namespace using `"recover": true` option or client can create recoverable subscriptions (but in this case it should have `history` capability).
