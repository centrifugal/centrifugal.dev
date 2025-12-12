---
id: channels
title: Channels and namespaces
---

Centrifugo operates on a PUB/SUB model. Upon connecting to a server, clients can subscribe to channels. A channel is one of the core concepts of Centrifugo. Most of the time when integrating Centrifugo, you will work with channels and determine the optimal channel configuration for your application.

## What is a channel?

Centrifugo operates on a PUB/SUB model - it has publishers and subscribers. A channel serves as a pathway for messages. Clients can subscribe to a channel to receive all the real-time messages published there. Subscribers to a channel may also request information about the channel's online presence or its history.

![pub_sub](/img/pub_sub.png)

A channel is simply a string - names like `news`, `comments`, `personal_feed` are examples of valid channel names. However, there are [predefined rules](#channel-name-rules) for these strings, as we will discuss later. You can define different behaviors for a channel using a range of available [channel options](#channel-options).

Channels are ephemeral – there is no need to create them explicitly. Channels are automatically created by Centrifugo as soon as the first client subscribes. Similarly, when the last subscriber leaves, the channel is automatically cleaned up. Channels with history enabled additionally maintain the list of publications for a configured retention window.

A channel can be part of a channel namespace. [Channel namespacing](#channel-namespaces) is a mechanism to define different behaviors for various channels within Centrifugo. Using namespaces is the recommended approach to manage channels – enabling only those channel options which are necessary for the specific real-time feature you are implementing with Centrifugo.

:::caution

Ensure you have defined a namespace in the configuration when using channel namespaces. Attempts to subscribe to a channel within an undefined namespace will result in [102: unknown channel](codes.md#unknown-channel) errors.

:::

## Channel name rules

**Only ASCII symbols must be used in a channel string**.

Channel name length limited by `255` characters by default (controlled by configuration option `channel_max_length`).

Several symbols in channel names reserved for Centrifugo internal needs:

* `:` – for namespace channel boundary (see below)
* `#` – for user channel boundary (see below)
* `$` – for private channel prefix (see below)
* `/` – for [Channel Patterns](../pro/channel_patterns.md) in Centrifugo PRO
* `*` – for the future Centrifugo needs
* `&` – for the future Centrifugo needs

### namespace boundary (`:`)

``:`` – is a channel namespace boundary. Namespaces are used to set custom options to a group of channels. Each channel belonging to the same namespace will have the same channel options. Read more about [namespaces](#channel-namespaces) and [channel options](#channel-options) below.

If the channel is `public:chat` - then Centrifugo will apply options to this channel from the channel namespace with the name `public`.

:::info

A namespace is an inalienable component of the channel name. If a user is subscribed to a channel with a namespace, such as `public:chat`, then you must publish messages to the `public:chat` channel for them to be delivered to the user. There is often confusion among developers who try to publish messages to `chat`, mistakenly believing that the namespace is stripped upon subscription. This is not the case. You must publish exactly to the same channel string you used for subscribing.

:::

### user channel boundary (`#`)

The `#` symbol serves as the user channel boundary. It acts as a separator to create personal channels for users, known as *user-limited channels*, without requiring a subscription token.

For instance, if the channel is named `news#42`, then only the user with ID `42` can subscribe to this channel. Centrifugo identifies the user ID from the connection credentials provided in the connection JWT.

To create a user-limited channel within the `personal` namespace, you might use a name such as `personal:user#42`.

Furthermore, it's possible to specify multiple user IDs in the channel name, separated by a comma: `dialog#42,43`. In this case, only users with IDs `42` and `43` are permitted to subscribe to this channel.

This setup is ideal for channels that have a static list of allowed users, such as channels for personal messages to a single user or dialogue channels between specific users. However, for dynamic access management of a channel for numerous users, this type of channel is not appropriate.

:::tip

User-limited channels must be enabled for a channel namespace using [allow_user_limited_channels](#allow_user_limited_channels) option. See below more information about channel options and channel namespaces. 

:::

### private channel prefix (`$`)

Centrifugo maintains compatibility with its previous versions which had concept of private channels. In earlier versions — specifically Centrifugo v1, v2, and v3—only – only channels beginning with `$` required a subscription JWT for subscribing. With Centrifugo v4, this is no longer the case; clients can subscribe to any channel if they have a valid subscription token.

However, for namespaces where the `allow_subscribe_for_client` option is activated, Centrifugo prohibits subscriptions to channels that start with the `channel_private_prefix` (which defaults to `$`) unless a subscription token is provided. This restriction is designed to facilitate a secure migration to Centrifugo v4 or later versions.

### Channel is just a string

Remember that a channel is uniquely identified by its string name. Do not assume that `$news` and `news` are the same; they are different because their names are not identical. Therefore, if a user is subscribed to `$news`, they will not receive messages published to `news`.

The channels `dialog#42,43` and `dialog#43,42` are considered different as well. Centrifugo only applies permission checks when a user subscribes to a channel. So if user-limited channels are enabled then the user with ID `42` will be able to subscribe on both `dialog#42,43` and `dialog#43,42`. But Centrifugo does no magic regarding channel strings when keeping channel->to->subscribers map. So if the user subscribed on `dialog#42,43` you must publish messages to exactly that channel: `dialog#42,43`.

The same reasoning applies to channels within namespaces. Channels `chat:index` and `index` are not the same — they are distinct and, moreover, they belong to different namespaces. The concept of channel namespaces in Centrifugo will be discussed shortly.

## Channel namespaces

Centrifugo allows configuring a list of channel namespaces. Namespaces are optional but super-useful.

A namespace is a container for options applied to channels that start with the namespace name + `:` separator. For example, if you define a namespace named `personal` in the configuration, all channels starting with `personal:` (such as `personal:1` or `personal:2`) will inherit the options defined for the `personal` namespace. This gives you great control over channel behavior, allowing you to set different options for various real-time features in your application.

Namespace has a name, and can contain all the [channel options](#channel-options). Namespace `name` is required to be set. Name of namespace must be unique, must consist of letters, numbers, underscores, or hyphens and be more than 2 symbols length i.e. satisfy regexp `^[-a-zA-Z0-9_]{2,}$`.

When you want to use specific namespace options your channel must be prefixed with namespace name and `:` separator: `public:messages`, `gossips:messages` are two channels in `public` and `gossips` namespaces.

Centrifugo looks for `:` symbol in the channel name, if found – extracts the namespace name, and applies all the configured namespace channel options while processing protocol commands from a client or server API calls.

All things together here is an example of `config.json` which includes some top-level (without namespace) channel options set and has 2 additional channel namespaces configured:

```json title="config.json"
{
  "channel": {
    "without_namespace": {
      "presence": true,
      "history_size": 10,
      "history_ttl": "30s"
    },
    "namespaces": [
      {
        "name": "facts",
        "history_size": 10,
        "history_ttl": "300s"
      },
      {
        "name": "gossips"
      }
    ]
  }
}
```

* Channel `news` will use channel options from `channel.without_namespace`.
* Channel `facts:sport` will use options from `facts` namespace.
* Channel `gossips:sport` will use options from `gossips` namespace.
* Channel `xxx:hello` will result into `102: unknown channel` subscription error since it belongs to `xxx` namespace but there is no `xxx` namespace defined in the configuration above.

**Channel namespaces also work with private channels and user-limited channels**. For example, if you have a namespace called `dialogs` then the private channel can be constructed as `$dialogs:gossips`, user-limited channel can be constructed as `dialogs:dialog#1,2`.

:::note

There is **no inheritance** in channel options and namespaces – for example, you defined `presence: true` on a top level of configuration and then defined a namespace – that namespace won't have online presence enabled - you must enable it for a namespace explicitly.

:::

There are many options which can be set for channel namespace (on top-level and to named one) to modify behavior of channels belonging to a namespace. Below we describe all these options. 

## Channel options

Channel behavior can be modified by using channel options. Channel options can be defined on configuration top-level and for every namespace.

### presence

`presence` (boolean, default `false`) – enable/disable online presence information for channels in a namespace. 

Online presence is information about clients currently subscribed to the channel. It contains each subscriber's client ID, user ID, connection info, and channel info. By default, this option is off so no presence information will be available for channels.

Let's say you have a channel `chat:index` with two users subscribed (IDs `2694` and `56`). User `56` has one connection to Centrifugo. User `2694` has two connections to Centrifugo from different browser tabs. The presence data might look like this:


```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{"channel": "chat:index"}' \
  http://localhost:8000/api/presence
{
    "result": {
        "presence": {
            "66fdf8d1-06f0-4375-9fac-db959d6ee8d6": {
                "user": "2694",
                "client": "66fdf8d1-06f0-4375-9fac-db959d6ee8d6",
                "conn_info": {"name": "Alex"}
            },
            "d4516dd3-0b6e-4cfe-84e8-0342fd2bb20c": {
                "user": "2694",
                "client": "d4516dd3-0b6e-4cfe-84e8-0342fd2bb20c",
                "conn_info": {"name": "Alex"}
            }
            "g3216dd3-1b6e-tcfe-14e8-1342fd2bb20c": {
                "user": "56",
                "client": "g3216dd3-1b6e-tcfe-14e8-1342fd2bb20c",
                "conn_info": {"name": "Alice"}
            }
        }
    }
}
```

To call presence API from the client connection side client must have permission to do so. See [presence permission model](./channel_permissions.md#presence-permission-model).

:::caution

Enabling channel online presence adds some overhead since Centrifugo needs to maintain an additional data structure (in a process memory or in a broker memory/disk). So only use it for channels where presence is required.

:::

See more details about [online presence design](../getting-started/design.md#online-presence-considerations).

### join_leave

`join_leave` (boolean, default `false`) – enable/disable sending join and leave messages when the client subscribes to a channel (unsubscribes from a channel). Join/leave event includes information about the connection that triggered an event – client ID, user ID, connection info, and channel info (similar to entry inside presence information).

Enabling `join_leave` means that Join/Leave messages will start being emitted, but by default they are not delivered to clients subscribed to a channel. You need to force this using namespace option [force_push_join_leave](#force_push_join_leave) or explicitly provide intent from a client-side (in this case client must have permission to call presence API).

:::caution

Keep in mind that join/leave messages can generate a huge number of messages in a system if turned on for channels with a large number of active subscribers. If you have channels with a large number of subscribers consider avoiding using this feature. It's hard to say what is "large" for you though – just estimate the load based on the fact that each subscribe/unsubscribe event in a channel with N subscribers will result into N messages broadcasted to all. If all clients reconnect at the same time the amount of generated messages is N^2.

:::

Join/leave messages distributed only with at most once delivery guarantee. 

### force_push_join_leave

Boolean, default `false`.

When on all clients will receive join/leave events for a channel in a namespace automatically – without explicit intent to consume join/leave messages from the client side.

If pushing join/leave is not forced then client can provide a corresponding Subscription option to enable it – but it should have permissions to access channel presence (by having an explicit capability or if allowed on a namespace level).

### history_size

`history_size` (integer, default `0`) – history size (amount of messages) for channels. As Centrifugo keeps all history messages in process memory (or in a broker memory) it's very important to limit the maximum amount of messages in channel history with a reasonable value. `history_size` defines the maximum amount of messages that Centrifugo will keep for **each** channel in the namespace. As soon as history has more messages than defined by history size – old messages will be evicted.

Setting only `history_size` **is not enough to enable history in channels** – you also need to wisely configure `history_ttl` option (see below). 

:::caution

Enabling channel history adds some overhead (both memory and CPU) since Centrifugo needs to maintain an additional data structure (in a process memory or a broker memory/disk). So only use history for channels where it's required.

:::

### history_ttl

`history_ttl` ([duration](./configuration.md#duration-type), default `0s`) – interval how long to keep channel history messages (with seconds precision).

As all history is storing in process memory (or in a broker memory) it is also very important to get rid of old history data for unused (inactive for a long time) channels.

By default, history TTL duration is zero – this means that channel history is disabled.

**Again – to turn on history you should wisely configure both `history_size` and `history_ttl` options**.

Also note, that `history_ttl` must be less than [history_meta_ttl](#history_meta_ttl).

For example for top-level channels (which do not belong to a namespace):

```json title="config.json"
{
  ...
  "channel": {
    "without_namespace": {
      "history_size": 10,
      "history_ttl": "60s"
    }
  }
}
```

Here's an example. You enabled history for the `chat` namespace and sent two messages in the `chat:index` channel. The history will look like this:

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{"channel": "chat:index", "limit": 100}' \
  http://localhost:8000/api/history
{
    "result": {
        "publications": [
            {
                "data": {
                    "input": "1"
                },
                "offset": 1
            },
            {
                "data": {
                    "input": "2"
                },
                "offset": 2
            }
        ],
        "epoch": "gWuY",
        "offset": 2
    }
}
```

To call the history API from the client side, the client must have the necessary permissions. For more details, see the [history permission model](./channel_permissions.md#history-permission-model).

See additional information about offsets and epoch in [History and recovery](./history_and_recovery.md) chapter.

:::tip

The persistence properties of history data depend on the Centrifugo engine in use. For instance, with the Memory engine (default), history is retained only until the Centrifugo node restarts. In contrast, with the Redis engine, persistence is determined by the Redis server's configuration (similarly for Redis-compatible storages).

:::

### history_meta_ttl

`history_meta_ttl` ([duration](./configuration.md#duration-type)) – sets a time of history stream metadata expiration (with seconds precision).

If not specified Centrifugo namespace inherits value from `global_history_meta_ttl` ([duration](./configuration.md#duration-type)) option which is 30 days by default (`"720h"`). This should be a good default for most use cases to avoid tweaking `history_meta_ttl` on a namespace level at all. If you have `history_ttl` greater than 30 days – then increase `history_meta_ttl` for namespace (recommended) or increase `global_history_meta_ttl` to be larger than `history_ttl`.

The motivation to have history meta information TTL is as follows. When using a history in a channel, Centrifugo keeps some metadata for each channel stream. Metadata includes the latest stream offset and its epoch value. In some cases, when channels are created for а short time and then not used anymore, created metadata can stay in memory while not useful. For example, you can have a personal user channel but after using your app for a while user left it forever. From a long-term perspective, this can be an unwanted memory growth. Setting a reasonable value to this option can help to expire metadata faster (or slower if you need it). The rule of thumb here is to keep this value larger than history TTL used.

### force_positioning

`force_positioning` (boolean, default `false`) – when the `force_positioning` option is on Centrifugo forces all subscriptions in a namespace to be `positioned`. I.e. Centrifugo will try to compensate at most once delivery of PUB/SUB broker checking client position inside a stream.

If Centrifugo detects a bad position of the client (i.e. potential message loss) it disconnects a client with the `Insufficient state` disconnect code. Also, when the position option is enabled Centrifugo exposes the current stream top `offset` and current `epoch` in subscribe reply making it possible for a client to manually recover its state upon disconnect using history API.

`force_positioning` option must be used in conjunction with reasonably configured message history for a channel i.e. `history_size` and `history_ttl` **must be set** (because Centrifugo uses channel history to check client position in a stream).

If positioning is not forced then client can provide a corresponding Subscription option to enable it – but it should have permissions to access channel history (by having an explicit capability or if allowed on a namespace level).

### force_recovery

`force_recovery` (boolean, default `false`) – when the `force_recovery` option is on Centrifugo forces all subscriptions in a namespace to be `recoverable`. When enabled Centrifugo will try to recover missed publications in channels after a client reconnects for some reason (bad internet connection for example). Also when the recovery feature is on Centrifugo automatically enables properties of the `force_positioning` option described above.

`force_recovery` option must be used in conjunction with reasonably configured message history for channel i.e. `history_size` and `history_ttl` **must be set** (because Centrifugo uses channel history to recover messages).

If recovery is not forced then client can provide a corresponding Subscription option to enable it – but it should have permissions to access channel history (by having an explicit capability or if allowed on a namespace level).

:::tip

Not all real-time events require this feature turned on so think wisely when you need this. When this option is turned on your application should be designed in a way to tolerate duplicate messages coming from a channel (currently Centrifugo returns recovered publications in order and without duplicates but this is an implementation detail that can be theoretically changed in the future). See more details about how recovery works in [special chapter](history_and_recovery.md).

:::

### force_recovery_mode

`force_recovery_mode` (string, possible values are `stream` or `cache`, when not specified Centrifugo uses `"stream"`). Allows setting recovery mode for all connections which use recovery in the namespace. By default, Centrifugo uses `stream` recovery mode – a mode where subscriber interested in all messages to be delivered. The alternative recovery mode which may be forced by using this option is `cache` – see the detailed description in [Cache recovery mode](./cache_recovery.md) chapter.

### allow_subscribe_for_client

`allow_subscribe_for_client` (boolean, default `false`) – when on all non-anonymous clients will be able to subscribe to any channel in a namespace. To additionally allow anonymous users to subscribe turn on `allow_subscribe_for_anonymous` (see below).

:::caution

Turning this option on effectively makes namespace public – no subscribe permissions will be checked (only the check that current connection is authenticated - i.e. has non-empty user ID). Make sure this is really what you want in terms of channels security.

:::

### allow_subscribe_for_anonymous

`allow_subscribe_for_anonymous` (boolean, default `false`) – turn on if anonymous clients (with empty user ID) should be able to subscribe on channels in a namespace.

### allow_publish_for_subscriber

`allow_publish_for_subscriber` (boolean, default `false`) - when the `allow_publish_for_subscriber` option is enabled client can publish into a channel in namespace directly from the client side over real-time connection but only if client subscribed to that channel.

:::danger

Keep in mind that in this case subscriber can publish any payload to a channel – Centrifugo does not validate input at all. Your app backend won't receive those messages - publications just go through Centrifugo towards channel subscribers. Consider always validate messages which are being published to channels (i.e. using server API to publish after validating input on the backend side, or using [publish proxy](proxy.md#publish-proxy) - see [idiomatic usage](../getting-started/design.md#idiomatic-usage)).

:::

`allow_publish_for_subscriber` (or `allow_publish_for_client` mentioned below) option still can be useful to send something without backend-side validation and saving it into a database – for example, this option may be handy for demos and quick prototyping real-time app ideas.

### allow_publish_for_client

`allow_publish_for_client` (boolean, default `false`) – when on allows clients to publish messages into channels directly (from a client-side). It's like `allow_publish_for_subscriber` – but client should not be a channel subscriber to publish.

:::danger

Keep in mind that in this case client can publish any payload to a channel – Centrifugo does not validate input at all. Your app backend won't receive those messages - publications just go through Centrifugo towards channel subscribers. Consider always validate messages which are being published to channels (i.e. using server API to publish after validating input on the backend side, or using [publish proxy](proxy.md#publish-proxy) - see [idiomatic usage](../getting-started/design.md#idiomatic-usage)).

:::

### allow_publish_for_anonymous

`allow_publish_for_anonymous` (boolean, default `false`) – turn on if anonymous clients should be able to publish into channels in a namespace.

### allow_history_for_subscriber

`allow_history_for_subscriber` (boolean, default `false`) – allows clients who subscribed on a channel to call history API from that channel.

### allow_history_for_client

`allow_history_for_client` (boolean, default `false`) – allows all clients to call history information in a namespace.

### allow_history_for_anonymous

`allow_history_for_anonymous` (boolean, default `false`) – turn on if anonymous clients should be able to call history from channels in a namespace.

### allow_presence_for_subscriber

`allow_presence_for_subscriber` (boolean, default `false`) – allows clients who subscribed on a channel to call presence information from that channel.

### allow_presence_for_client

`allow_presence_for_client` (boolean, default `false`) – allows all clients to call presence information in a namespace.

### allow_presence_for_anonymous

`allow_presence_for_anonymous` (boolean, default `false`) – turn on if anonymous clients should be able to call presence from channels in a namespace.

### allow_user_limited_channels

`allow_user_limited_channels` (boolean, default `false`) - allows using user-limited channels in a namespace for checking subscribe permission.

:::note

If client subscribes to a user-limited channel while this option is off then server rejects subscription with `103: permission denied` error.

:::

### channel_regex

`channel_regex` (string, default `""`) – is an option to set a regular expression for channels allowed in the namespace. By default Centrifugo does not limit channel name variations. For example, if you have a namespace `chat`, then channel names inside this namespace are not really limited, it can be `chat:index`, `chat:1`, `chat:2`, `chat:zzz` and so on. But if you want to be strict and know possible channel patterns you can use `channel_regex` option. This is especially useful in namespaces where all clients can subscribe to channels. 

For example, let's only allow digits after `chat:` for channel names in a `chat` namespace:

```json
{
  "channel": {
    "namespaces": [
      {
        "name": "chat",
        "allow_subscribe_for_client": true,
        "channel_regex": "^[\d+]$"
      }
    ]
  }
}
```

:::danger

Note, that we are skipping `chat:` part in regex. Since namespace prefix is the same for all channels in a namespace we only match the rest (after the prefix) of channel name.

:::

Channel regex only checked for client-side subscriptions, if you are using server-side subscriptions Centrifugo won't check the regex.

Centrifugo uses Go language [regexp](https://pkg.go.dev/regexp) package for regular expressions.

### delta_publish

`delta_publish` (boolean, default `false`) allows marking all publications in the namespace with `delta` flag, i.e. all publications will result into delta updates for subscribers which negotiated delta compression for a channel.

### allowed_delta_types

`allowed_delta_types` (array of strings, the only allowed value now is `fossil`) - provide an array of allowed delta compression types in the namespace. If not specified – client won't be able to negotiate delta compression in channels.

### publication_data_format

Available since Centrifugo v6.5.2

`publication_data_format` (string, default `""`) – enforces validation rules for publication data in channels. Possible values:

* `""` (empty, default) – keeps the default behavior of Centrifugo v6 where empty data is rejected and no data validation checks are made on publish stage (leaving this to developer to control). 
* `"json"` – validates that all published data is valid JSON, rejecting invalid JSON with a bad request error
* `"binary"` – tells Centrifugo that the format of data is arbitrary binary, this allows publishing empty payloads to channels.

When set to `"json"`, Centrifugo validates publication data on both server API and client publish operations, ensuring data integrity across all publish sources. This is useful when you want to guarantee that only valid JSON messages flow through specific channels.

When set to `"binary"`, Centrifugo allows empty data to be published, which can be useful for channels where you need to send signals or work with arbitrary binary payloads.

This option can be set globally for all channels at the top level of channel configuration, and can be overridden per namespace if needed.

Example configuration with global format that applies to all channels:

```json
{
  "channel": {
    "publication_data_format": "json",
    "without_namespace": {
      "history_size": 10,
      "history_ttl": "60s"
    }
  }
}
```

Example configuration with namespace-specific format:

```json
{
  "channel": {
    "namespaces": [
      {
        "name": "json_only",
        "publication_data_format": "json",
        "history_size": 10,
        "history_ttl": "60s"
      }
    ]
  }
}
```

Example configuration with global format and namespace override:

```json
{
  "channel": {
    "publication_data_format": "json",
    "namespaces": [
      {
        "name": "binary_data",
        "publication_data_format": "binary"
      },
      {
        "name": "json_data"
        // Inherits global "json" format
      }
    ]
  }
}
```

:::tip

Use `"json"` format when you want to ensure data consistency and prevent invalid data from being published to channels. Use `"binary"` format when working with channels that need to support empty payloads or arbitrary binary data. Set it globally if you want the same behavior for all channels, and override in specific namespaces when needed.

:::

### allow_tags_filter

Available since Centrifugo v6.4.0.

`allow_tags_filter` (boolean, default `false`) - allows using tags filter when subscribing to channels in a namespace. See [Channel publication filtering](./publication_filtering.md) chapter for more details.

### subscribe_proxy_enabled

`subscribe_proxy_enabled` (boolean, default `false`) – turns on subscribe proxy, more info in [proxy chapter](proxy.md)

### subscribe_proxy_name

`subscribe_proxy_name` (string, default `""`) – allows setting custom subscribe proxy to use by name. More info in [proxy chapter](proxy.md).

### publish_proxy_enabled

`publish_proxy_enabled` (boolean, default `false`) – turns on publish proxy, more info in [proxy chapter](proxy.md).

### publish_proxy_name

`publish_proxy_name` (string, default `""`) – allows setting custom publish proxy to use by name. More info in [proxy chapter](proxy.md).

### sub_refresh_proxy_enabled

`sub_refresh_proxy_enabled` (boolean, default `false`) – turns on sub refresh proxy, more info in [proxy chapter](proxy.md).

### sub_refresh_proxy_name

`sub_refresh_proxy_name` (string, default `""`) – allows setting custom sub refresh proxy to use by name. More info in [proxy chapter](proxy.md).

### subscribe_stream_proxy_enabled

`subscribe_stream_proxy_enabled` (boolean, default `false`) - turns on subscribe stream proxy, see [subscription streams](./proxy_streams.md).

### subscribe_stream_proxy_name

`subscribe_stream_proxy_name` (string, default `""`) – allows setting custom subscribe stream proxy to use by name. See [subscription streams](./proxy_streams.md).

### subscribe_stream_proxy_bidirectional

`subscribe_stream_proxy_bidirectional` (boolean, default `false`) – allows using bidirectional subscribe stream. See [subscription streams](./proxy_streams.md).

### cache_empty_proxy_enabled

`cache_empty_proxy_enabled` (boolean, default `false`, Centrifugo PRO only) – turns on [cache empty proxy](../pro/channel_cache_empty.md).

### cache_empty_proxy_name

`cache_empty_proxy_name` (string, default `""`, Centrifugo PRO only) – allows setting custom cache empty proxy to use by name.

### state_proxy_enabled

`state_proxy_enabled` (boolean, default `false`, Centrifugo PRO only) - allows enabling [channel state proxy](../pro/channel_events.md)

### state_events

`state_events` (array of strings, empty by default, Centrifugo PRO only) - can help configuring notifications about channel's `occupied` and `vacated` state. See [more details](../pro/channel_events.md) in Centrifugo PRO docs.

### shared_position_sync

`shared_position_sync` (boolean, default `false`, Centrifugo PRO only) - can help reducing the number of position synchronization requests from Centrifugo to Broker's history API, see [more details](../pro/scalability.md#shared-position-sync) in Centrifugo PRO docs.

### subscribe_cel

`subscribe_cel` (string, default `""`, Centrifugo PRO only) – CEL expression for subscribe permission, see more details in [Channel CEL expressions](../pro/cel_expressions.md) of Centrifugo PRO.

### publish_cel

`publish_cel` (string, default `""`, Centrifugo PRO only) – CEL expression for publish permission, see more details in [Channel CEL expressions](../pro/cel_expressions.md) of Centrifugo PRO.

### history_cel

`history_cel` (string, default `""`, Centrifugo PRO only) – CEL expression for history permission, see more details in [Channel CEL expressions](../pro/cel_expressions.md) of Centrifugo PRO.

### presence_cel

`presence_cel` (string, default `""`, Centrifugo PRO only) – CEL expression for presence permission, see more details in [Channel CEL expressions](../pro/cel_expressions.md) of Centrifugo PRO.

### batch_max_size

`batch_max_size` (integer, default `0`) – maximum batch size when using per-channel batching. See more details in Centrifugo PRO [Message batching control](../pro/client_msg_batching.md) documentation.

### batch_max_delay

`batch_max_delay` ([duration](./configuration.md#duration-type), default `0s`) – maximum delay time when using per-channel batching. See more details in Centrifugo PRO [Message batching control](../pro/client_msg_batching.md) documentation.

### batch_flush_latest

`batch_flush_latest` (bool, default `false`) – allows sending only the latest message in collected batch. See more details in Centrifugo PRO [Message batching control](../pro/client_msg_batching.md) documentation.

### allow_channel_compaction

Available since Centrifugo v6.4.0.

`allow_channel_compaction` (boolean, default `false`, Centrifugo PRO only) – allows real-time SDKs to negotiate [channel compaction](../pro/bandwidth_optimizations.md#channel-compaction) in a namespace.

## Channel config examples

Let's look at how to set some of these options in a config. In this example we turning on presence, history features, forcing publication recovery. Also allowing all client connections (including anonymous users) to subscribe to channels and call publish, history, presence APIs if subscribed.

```json title="config.json"
{
  "client": {
    "token": {
      "hmac_secret_key": "my-secret-key"
    }
  },
  "channel": {
    "without_namespace": {
      "presence": true,
      "history_size": 10,
      "history_ttl": "300s",
      "force_recovery": true,
      "allow_subscribe_for_anonymous": true,
      "allow_subscribe_for_client": true,
      "allow_publish_for_anonymous": true,
      "allow_publish_for_subscriber": true,
      "allow_presence_for_anonymous": true,
      "allow_presence_for_subscriber": true,
      "allow_history_for_anonymous": true,
      "allow_history_for_subscriber": true
    }
  },
  "http_api": {
    "key": "secret-api-key"
  }
}
```

Here we set channel options on config top-level – these options will affect channels without namespace. In many cases defining namespaces is a recommended approach so you can manage options for every real-time feature separately. With namespaces the above config may transform to:

```json title="config.json"
{
  "client": {
    "token": {
      "hmac_secret_key": "my-secret-key"
    }
  },
  "http_api": {
    "key": "secret-api-key"
  },
  "channel": {
    "namespaces": [
      {
        "name": "feed",
        "presence": true,
        "history_size": 10,
        "history_ttl": "300s",
        "force_recovery": true,
        "allow_subscribe_for_client": true,
        "allow_subscribe_for_anonymous": true,
        "allow_publish_for_subscriber": true,
        "allow_publish_for_anonymous": true,
        "allow_history_for_subscriber": true,
        "allow_history_for_anonymous": true,
        "allow_presence_for_subscriber": true,
        "allow_presence_for_anonymous": true
      }
    ]
  }
}
```

In this case channels should be prefixed with `feed:` to follow the behavior configured for a `feed` namespace.
