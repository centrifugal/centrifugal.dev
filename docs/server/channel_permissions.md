---
id: channel_permissions
title: Channel permission model
---

When using Centrifugo server API you don't need to think about channel permissions at all – everything is allowed. In server API case, request to Centrifugo must be issued by your application backend – so you have all the power to check any required permissions before issuing API request to Centrifugo.

The situation is different when we are talking about client real-time API.

In order to configure which client (i.e. connection established using one of supported bidirectional real-time transports) can subscribe to channels and call publish, history and presence real-time APIs Centrifugo provides several ways to configure the desired behavior.

Let's start from looking at Centrifugo subscribe permission model.

### Subscribe permission model

By default, client's attempt to subscribe on a channel will be rejected by a server with `103: permission denied` error. There are several approaches how to control channel subscribe permissions:

* [Provide subscription token](#provide-subscription-token)
* [Configure subscribe proxy](#configure-subscribe-proxy)
* [Use user-limited channels](#use-user-limited-channels)
* [Use subscribe_allowed_for_client namespace option](#use-subscribeallowedforclient-namespace-option)
* [Subscribe capabilities in connection token](#subscribe-capabilities-in-connection-token)
* [Subscribe capabilities in connect proxy](#subscribe-capabilities-in-connect-proxy)

Below, we are describing those in detail.

#### Provide subscription token

A client can provide a subscription token in subscribe request. See [the format of the token](channel_token_auth.md).

If client provides a valid token then subscription will be accepted. In Centrifugo PRO subscription token can additionally grant `publish`, `history` and `presence` permissions to a client.

:::caution

For namespaces with `allow_subscribe_for_client` option ON Centrifugo does not allow subscribing on channels starting with `private_channel_prefix` (`$` by default) without token. This limitation exists to help users migrate to Centrifugo v4 without security risks. You can disable this limitation by setting `private_channel_prefix` option to `""` (empty string).

:::

#### Configure subscribe proxy

If client subscribes on a namespace with configured subscribe proxy then depending on proxy response subscription will be accepted or not.

If a namespace has configured subscribe proxy, but user came with a token – then subscribe proxy is not used, we are relying on token in this case. If a namespace has subscribe proxy, but user subscribes on a user-limited channel – then subscribe proxy is not used also.

#### Use user-limited channels

If client subscribes on a user-limited channel and there is a user ID match then subscription will be accepted.

:::caution

User-limited channels must be enabled in a namespace using `allow_user_limited_channels` option.

:::

#### Use allow_subscribe_for_client namespace option

`allow_subscribe_for_client` allows all connections to subscribe on all channels in a namespace.

:::caution

Turning this option on effectively makes namespace public – no subscribe permissions will be checked. Make sure this is really what you want in terms of channels security. 

:::

#### Subscribe capabilities in connection token

<p><mark>Centrifugo PRO only</mark></p>

Connection token can contain a capability object to allow user subscribe to channels.

#### Subscribe capabilities in connect proxy

<p><mark>Centrifugo PRO only</mark></p>

Connect proxy can return capability object to allow user subscribe to channels.

### Publish permission model

:::tip

In idiomatic Centrifugo use case data should be published to channels from the application backend (over server API). In this case backend can validate data, save it into persistent storage before publishing in real-time towards connections. When publishing from the client-side backend does not receive publication data at all – it just goes through Centrifugo (except using publish proxy). There are cases when direct publications from the client-side are desired (like typing indicators in chat applications) though.

:::

By default, client's attempt to publish data into a channel will be rejected by a server with `103: permission denied` error. There are several approaches how to control channel publish permissions:

* [Configure publish proxy](#configure-publish-proxy)
* [Use allow_publish_for_subscriber namespace option](#use-allowpublishforsubscriber-namespace-option)
* [Use allow_publish_for_client namespace option](#use-allowpublishforclient-namespace-option)
* [Publish capabilities in connection token](#publish-capabilities-in-connection-token)
* [Publish capability in subscription token](#publish-capability-in-subscription-token)
* [Publish capabilities in connect proxy](#publish-capabilities-in-connect-proxy)
* [Publish capability in subscribe proxy](#publish-capability-in-subscribe-proxy)

#### Use allow_publish_for_client namespace option

`allow_publish_for_client` allows publications to channels of a namespace for all client connections. 

#### Use allow_publish_for_subscriber namespace option

`allow_publish_for_subscriber` allows publications to channels of a namespace for all connections subscribed on a channel they want to publish data into.

#### Configure publish proxy

If client publishes to a namespace with configured publish proxy then depending on proxy response publication will be accepted or not.

Configured publish proxy always used??? (what if user has permission in token or allow_publish_for_client?)

#### Publish capabilities in connection token

<p><mark>Centrifugo PRO only</mark></p>

Connection token can contain a capability object to allow client to publish to channels.

#### Publish capability in subscription token

<p><mark>Centrifugo PRO only</mark></p>

Connection token can contain a capability object to allow client to publish to a channel.

#### Publish capabilities in connect proxy

<p><mark>Centrifugo PRO only</mark></p>

Connect proxy can return capability object to allow client publish to certain channels.

#### Publish capability in subscribe proxy

<p><mark>Centrifugo PRO only</mark></p>

Subscribe proxy can return capability object to allow subscriber publish to channel.

### History permission model

By default, client's attempt to call history from a channel (with history retention configured) will be rejected by a server with `103: permission denied` error. There are several approaches how to control channel history permissions.

#### Use allow_history_for_subscriber namespace option

`allow_history_for_subscriber` allows history requests to all channels in a namespace for all client connections subscribed on a channel they want to call history for.

#### Use allow_history_for_client namespace option

`allow_history_for_client` allows history requests to all channels in a namespace for all client connections.

#### History capabilities in connection token

<p><mark>Centrifugo PRO only</mark></p>

Connection token can contain a capability object to allow user call history for channels.

#### History capabilities in subscription token

<p><mark>Centrifugo PRO only</mark></p>

Connection token can contain a capability object to allow user call history from a channel.

#### History capabilities in connect proxy

**This is a Centrifugo PRO feature.**

Connect proxy can return capability object to allow client call history from certain channels.

#### History capability in subscribe proxy response

<p><mark>Centrifugo PRO only</mark></p>

Subscribe proxy can return capability object to allow subscriber call history from channel.

### Presence permission model

By default, client's attempt to call presence from a channel (with channel presence configured) will be rejected by a server with `103: permission denied` error. There are several approaches how to control channel presence permissions.

#### Presence capability in subscribe proxy response

Subscribe proxy can return capability object to allow subscriber call presence from channel.

#### Use allow_presence_for_subscriber namespace option

`allow_presence_for_subscriber` allows presence requests to all channels in a namespace for all client connections subscribed on a channel they want to call presence for.

#### Use allow_presence_for_client namespace option

`allow_presence_for_client` allows presence requests to all channels in a namespace for all client connections. 

#### Presence capabilities in connection token

<p><mark>Centrifugo PRO only</mark></p>

Connection token can contain a capability object to allow user call presence for channels.

#### Presence capabilities in subscription token

<p><mark>Centrifugo PRO only</mark></p>

Connection token can contain a capability object to allow user call presence of a channel.

#### Presence capabilities in connect proxy

<p><mark>Centrifugo PRO only</mark></p>

Connect proxy can return capability object to allow client call presence from certain channels.

### Positioning permission model

Server can whether turn on positioning for all channels in a namespace using `"force_positioning": true` option or client can create positioned subscriptions (in namespaces with `"allow_possitioning": true` or if client has `history` capability).

### Recovery permission model

Server can whether turn on automatic recovery for all channels in a namespace using `"force_recovery": true` option or client can create recoverable subscriptions (in namespaces with `"allow_possitioning": true` or if client has `history` capability).
