---
description: "Centrifugo channel permission model for subscribe, publish, history, and presence operations. Configure access via JWT tokens, proxies, and namespace options — with interactive explorers to validate your model before writing code."
id: channel_permissions
title: Channel permission model
---

import PermissionExplorer from '@site/src/components/permissions/PermissionExplorer';

When using the Centrifugo [server API](./server_api.md) you don't need to think about channel permissions at all – everything is allowed. In the server API case, the request to Centrifugo is issued by your application backend – so you already have all the power to check any required permissions before issuing the API request.

The situation is different when we talk about the **client** real-time API – subscribing to channels and calling publish, history and presence from a connection established over one of the bidirectional real-time transports. Centrifugo gives you several ways to control what a client may do, and this document is the single place that describes all of them.

There are many individual options, so before the reference sections below let's build a **mental model** that makes them fit together.

## The mental model

Every client permission decision comes down to two questions: **who decides**, and **when**. There are only three mechanisms, and everything else is a variation on them:

| Mechanism | Who decides | When | Scope |
| --- | --- | --- | --- |
| **Namespace options** (`allow_*` flags, user-limited channels) | You, in config | Once, at config time | Everyone in the namespace |
| **Tokens** (connection JWT, subscription JWT) | Your backend, when it issues the token | At token-issue time, re-checked on token expiry | Per user / per subscription |
| **Proxies** (connect, subscribe, publish proxy) | Your backend, on every relevant event | At the moment of the event | Per event |

The same three mechanisms apply to all four operations – **subscribe**, **publish**, **history**, **presence**. In Centrifugo PRO, tokens and proxies can additionally carry a **capability** object that grants fine-grained permissions for several channels at once (more on that in [Capabilities](#capabilities-pro) below).

So instead of memorizing dozens of options, remember the grid: *three mechanisms × four operations*, plus capabilities as the PRO way to batch permissions.

### Choosing an approach

For the common case – "let a specific user access a specific channel" – this is the quick guide:

| If you want… | Use |
| --- | --- |
| A public channel (any authenticated connection may subscribe) | `allow_subscribe_for_client` |
| A per-user channel, checked at your backend, cached on the client | **subscription token** (recommended default) |
| To be notified on every subscribe / revoke access instantly / deliver initial data | **subscribe proxy** |
| One channel per user with almost no code | [automatic personal channel](./server_subs.md#automatic-personal-channel-subscription) |
| Fine-grained, multi-channel grants without per-channel tokens | **capabilities** in connection JWT / connect proxy <span className="pro-tag">PRO</span> |

For a deeper tour of the options for a single personal channel, see the [101 ways to subscribe](/blog/2022/07/29/101-way-to-subscribe) post.

### Validate before you build

Permissions are easiest to get wrong at the *interaction* level – "this user, this channel, this config: allowed or not, and **why**?". Each section below embeds an **interactive explorer** that mirrors Centrifugo's real decision order. Toggle the options, pick a token/proxy outcome, and watch the exact order of checks that leads to `ALLOWED` or `DENIED`. Use it to confirm your permission model before writing a line of code.

:::note

The explorers run entirely in your browser and reproduce the server's decision *order* for teaching purposes. A few advanced knobs (CEL expressions, the bidirectional subscribe-stream proxy) are omitted for clarity. The authoritative behavior is always the server itself.

:::

## Subscribe permission model

By default, a client's attempt to subscribe to a channel is rejected with a `103: permission denied` error. Centrifugo evaluates the following mechanisms **in order** and the first one that grants access wins:

1. **Private-prefix gate** — if the channel name starts with `channel.private_prefix` (`$` by default), a subscription **without a token is rejected immediately**, regardless of any option below. This helps avoid accidentally exposing channels.
2. **Subscription token** — if a token is supplied, it alone decides the subscription (all mechanisms below are skipped). A valid token accepts; an invalid one rejects.
3. **User-limited channel** (`#`) — if the namespace enables `allow_user_limited_channels` and the user ID matches, the subscription is accepted. For user-limited channels the proxy and `allow_subscribe_for_client` are **not** consulted.
4. **Subscribe proxy** — if enabled (and the channel is not user-limited), your backend decides.
5. **Connection capabilities** <span className="pro-tag">PRO</span> — a `sub` capability from the connection token / connect proxy that matches the channel.
6. **`allow_subscribe_for_client`** — allows all authenticated (non-anonymous) connections; add `allow_subscribe_for_anonymous` to also allow anonymous ones. Not consulted for user-limited channels.

If none grant access, the subscription is denied.

<PermissionExplorer op="subscribe" />

Below are the details of each mechanism.

#### Provide subscription token

A client can provide a subscription token in the subscribe request. See [the format of the token](channel_token_auth.md). If a client provides a valid token then the subscription is accepted. In Centrifugo PRO, a subscription token can additionally grant `publish`, `history` and `presence` permissions to a client via the `allow` claim.

:::caution

For namespaces with `allow_subscribe_for_client` ON, Centrifugo does not allow subscribing to channels starting with `channel.private_prefix` (`$` by default) without a token. This limitation exists to help users migrate to Centrifugo v4 without security risks.

:::

#### Configure subscribe proxy

If a client subscribes to a namespace with a configured subscribe proxy (`subscribe_proxy_enabled`), then depending on the proxy response the subscription is accepted or not.

If a namespace has a configured subscribe proxy, but the client came with a token – then the subscribe proxy is not used; the token decides. If a client subscribes to a user-limited channel – the subscribe proxy is not used either.

#### Use user-limited channels

If a client subscribes to a user-limited channel and there is a user ID match, then the subscription is accepted. A user-limited channel contains a `#` followed by a comma-separated list of allowed user IDs, e.g. `personal:#17` or `chat:#17,42`.

:::caution

User-limited channels must be enabled in a namespace using the `allow_user_limited_channels` channel option.

:::

#### Use allow_subscribe_for_client namespace option

`allow_subscribe_for_client` allows all authenticated non-anonymous connections to subscribe to all channels in a namespace.

:::caution

Turning this option on effectively makes the namespace public – no per-user subscribe permissions are checked (only that the connection is authenticated, i.e. has a non-empty user ID). Make sure this is really what you want in terms of channel security.

:::

To additionally allow subscribing for anonymous connections take a look at the `allow_subscribe_for_anonymous` option.

#### Subscribe capabilities in connection token

<p><mark>Centrifugo PRO only</mark></p>

A connection token can contain a capability object to allow the user to subscribe to channels. See [Capabilities](#capabilities-pro).

#### Subscribe capabilities in connect proxy

<p><mark>Centrifugo PRO only</mark></p>

A connect proxy can return a capability object to allow the user to subscribe to channels.

## Publish permission model

:::tip

In the idiomatic Centrifugo use case, data is published to channels from the application backend (over the server API). The backend can validate data and save it to persistent storage before publishing in real-time. When publishing from the client-side the backend does not receive the publication data at all – it just goes through Centrifugo (except when using a publish proxy). Direct publications from the client-side are still useful in some cases (like typing indicators in chat).

:::

By default, a client's attempt to publish to a channel is rejected with a `103: permission denied` error. Centrifugo evaluates the following **in order**, first match wins:

1. **Publish proxy** — if `publish_proxy_enabled`, the proxy **takes precedence over everything else**. The built-in `allow_publish_*` flags and token capabilities are not consulted; the proxy response alone decides.
2. **`allow_publish_for_client`** — allows all authenticated connections (add `allow_publish_for_anonymous` for anonymous ones).
3. **`allow_publish_for_subscriber`** — allows connections currently subscribed to the channel they publish into.
4. **Connection capabilities** <span className="pro-tag">PRO</span> — a `pub` capability from the connection token / connect proxy.
5. **Subscription capabilities** <span className="pro-tag">PRO</span> — a `pub` capability from the subscription token `allow` / subscribe proxy for this channel.

If none grant access, the publication is denied.

<PermissionExplorer op="publish" />

#### Use allow_publish_for_client namespace option

`allow_publish_for_client` allows publications to channels of a namespace for all authenticated client connections. Add `allow_publish_for_anonymous` to also allow anonymous connections.

#### Use allow_publish_for_subscriber namespace option

`allow_publish_for_subscriber` allows publications to channels of a namespace for all connections currently subscribed to the channel they want to publish into.

#### Configure publish proxy

If a client publishes to a namespace with a configured publish proxy, then depending on the proxy response the publication is accepted or not.

When a publish proxy is enabled for a namespace it takes precedence: all client publishes to channels in that namespace are routed to the proxy, and the proxy response alone decides whether the publication is accepted. The built-in `allow_publish_for_client` / `allow_publish_for_subscriber` flags and token publish capabilities are not consulted in this case.

#### Publish capabilities in connection token

<p><mark>Centrifugo PRO only</mark></p>

A connection token can contain a capability object to allow the client to publish to channels.

#### Publish capability in subscription token

<p><mark>Centrifugo PRO only</mark></p>

A subscription token can contain a `pub` capability in its `allow` claim to allow the client to publish to that channel.

#### Publish capabilities in connect proxy

<p><mark>Centrifugo PRO only</mark></p>

A connect proxy can return a capability object to allow the client to publish to certain channels.

#### Publish capability in subscribe proxy

<p><mark>Centrifugo PRO only</mark></p>

A subscribe proxy can return an `allow` list containing `pub` to allow the subscriber to publish to the channel.

## History permission model

By default, a client's attempt to call history for a channel is rejected with a `103: permission denied` error. History must first be configured for the namespace (`history_size` and `history_ttl` greater than zero) – otherwise the call returns `108: not available` before any permission check. When history is configured, Centrifugo evaluates the following **in order**, first match wins:

1. **`allow_history_for_client`** — allows all authenticated connections (add `allow_history_for_anonymous` for anonymous ones).
2. **`allow_history_for_subscriber`** — allows connections currently subscribed to the channel.
3. **Connection capabilities** <span className="pro-tag">PRO</span> — an `hst` capability from the connection token / connect proxy.
4. **Subscription capabilities** <span className="pro-tag">PRO</span> — an `hst` capability from the subscription token `allow` / subscribe proxy for this channel.

<PermissionExplorer op="history" />

#### Use allow_history_for_client namespace option

`allow_history_for_client` allows history requests to all channels in a namespace for all authenticated client connections. Add `allow_history_for_anonymous` to also allow anonymous connections.

#### Use allow_history_for_subscriber namespace option

`allow_history_for_subscriber` allows history requests for all connections currently subscribed to the channel they want to call history for.

#### History capabilities in connection token

<p><mark>Centrifugo PRO only</mark></p>

A connection token can contain a capability object to allow the user to call history for channels.

#### History capability in subscription token

<p><mark>Centrifugo PRO only</mark></p>

A subscription token can contain an `hst` capability in its `allow` claim to allow the user to call history for that channel.

#### History capabilities in connect proxy

<p><mark>Centrifugo PRO only</mark></p>

A connect proxy can return a capability object to allow the client to call history for certain channels.

#### History capability in subscribe proxy

<p><mark>Centrifugo PRO only</mark></p>

A subscribe proxy can return an `allow` list containing `hst` to allow the subscriber to call history for the channel.

## Presence permission model

By default, a client's attempt to call presence for a channel is rejected with a `103: permission denied` error. Presence must first be enabled for the namespace – otherwise the call returns `108: not available` before any permission check. When presence is enabled, Centrifugo evaluates the following **in order**, first match wins:

1. **`allow_presence_for_client`** — allows all authenticated connections (add `allow_presence_for_anonymous` for anonymous ones).
2. **`allow_presence_for_subscriber`** — allows connections currently subscribed to the channel.
3. **Connection capabilities** <span className="pro-tag">PRO</span> — a `prs` capability from the connection token / connect proxy.
4. **Subscription capabilities** <span className="pro-tag">PRO</span> — a `prs` capability from the subscription token `allow` / subscribe proxy for this channel.

<PermissionExplorer op="presence" />

#### Use allow_presence_for_client namespace option

`allow_presence_for_client` allows presence requests to all channels in a namespace for all authenticated client connections. Add `allow_presence_for_anonymous` to also allow anonymous connections.

#### Use allow_presence_for_subscriber namespace option

`allow_presence_for_subscriber` allows presence requests for all connections currently subscribed to the channel they want to call presence for.

#### Presence capabilities in connection token

<p><mark>Centrifugo PRO only</mark></p>

A connection token can contain a capability object to allow the user to call presence for channels.

#### Presence capability in subscription token

<p><mark>Centrifugo PRO only</mark></p>

A subscription token can contain a `prs` capability in its `allow` claim to allow the user to call presence for that channel.

#### Presence capabilities in connect proxy

<p><mark>Centrifugo PRO only</mark></p>

A connect proxy can return a capability object to allow the client to call presence for certain channels.

#### Presence capability in subscribe proxy

<p><mark>Centrifugo PRO only</mark></p>

A subscribe proxy can return an `allow` list containing `prs` to allow the subscriber to call presence for the channel.

## Capabilities <span className="pro-tag">PRO</span> {#capabilities-pro}

Capabilities are the Centrifugo PRO way to grant several permissions at once, instead of using a per-channel flag or token. They come in two shapes:

- **Connection capabilities** live in the connection JWT `caps` claim (or the connect proxy result). Each entry grants a set of operations for a set of channels, with an optional matching mode:

  ```json
  "caps": [
    {"channels": ["personal:17"], "allow": ["sub"]},
    {"channels": ["news:*"], "match": "wildcard", "allow": ["sub", "hst"]}
  ]
  ```

  The `match` field selects how each channel string is compared to the requested channel: `""` (default) exact match, `wildcard`, or `regex`.

- **Subscription capabilities** live in the subscription JWT `allow` claim (or the subscribe proxy result). This is a flat list of operations for the single channel of that subscription:

  ```json
  {"channel": "personal:17", "allow": ["pub", "hst", "prs"]}
  ```

The valid operation strings are `sub` (subscribe), `pub` (publish), `hst` (history) and `prs` (presence). Connection capabilities are checked before subscription capabilities in every operation's decision order.

## Positioning permission model

The server can turn on positioning for all channels in a namespace using the `force_positioning` option, or a client can create positioned subscriptions (in which case the client must have access to the `history` capability).

## Recovery permission model

The server can turn on automatic recovery for all channels in a namespace using the `force_recovery` option, or a client can create recoverable subscriptions (in which case the client must have access to the `history` capability).

## Join/Leave permission model

The server can force sending join/leave messages to all subscribers for all channels in a namespace using the `force_push_join_leave` option, or a client can ask the server to include join/leave messages upon subscribing (in which case the client must have access to the `presence` capability).
