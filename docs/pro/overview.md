---
id: overview
title: Centrifugo PRO ♻️
sidebar_label: Centrifugo PRO
---

Centrifugo PRO is the enhanced version of Centrifugo offered by Centrifugal Labs LTD under a commercial license. It's packed with a unique set of features designed to fit requirements of corporate and enterprise environments, decrease costs at scale, and benefit from additional features such as push notifications support, real-time analytics, and so on. We have leveraged our extensive experience to build Centrifugo PRO, ensuring its extra powers are practical and ready for production workloads. See information about [pricing](#pricing) and [try for free](#try-for-free-in-sandbox-mode) in sandbox mode.

## Features

Centrifugo PRO is packed with the following features:

* Everything from Centrifugo OSS
* 🔥 [Push notification API](./push_notifications.md) to manage device tokens and send mobile and browser push notifications.
* 🔍 [Channel and user tracing](./tracing.md) allows watching client protocol frames in channel or per user ID in real time.
* 💹 [Real-time analytics with ClickHouse](./analytics.md) for a great system observability, reporting and trending.
* 🛡️ [Operation rate limits](./rate_limiting.md) to protect server from the real-time API misusing and frontend bugs.
* 📚 [Per-namespace engines](./namespace_engines.md) to configure various PUB/SUB brokers and presence managers on namespace level.
* 🔐 [SSO for admin UI](./admin_ui.md) using OpenID Connect (OIDC) protocol. Also, more data about the system state.
* 🟢 [User status API](./user_status.md) feature allows understanding activity state for a list of users.
* 🔌 [Connections API](./connections.md) to query, filter and inspect active connections.
* ✋ [User blocking API](./user_block.md) to block/unblock abusive users by ID.
* 🛑 [JWT revoking and invalidation API](./token_revocation.md) to revoke tokens by ID and invalidate user's tokens based on issue time.
* 🔔 [Channel state events](channel_events.md) to be notified on the backend about channel `occupied` and `vacated` events.
* 🥣 [Channel cache empty events](channel_cache_empty.md) to react on cache misses in channels with cache recovery mode.
* 💪 [Channel capabilities](./capabilities.md) for controlling channel permissions per connection or per subscription.
* 📜 [Channel patterns](./channel_patterns.md) allow defining channel configuration like HTTP routes with parameters.
* ✍️ [Channel CEL expressions](./cel_expressions.md) to write custom efficient permission rules for channel operations.
* 🗜️ [Delta compression for at most once](./delta_at_most_once.md) scenario.
* 🚀 [Faster performance](./performance.md) to reduce resource usage on server side.
* 🔮 [Scalability optimizations](./scalability.md) with singleflight technique and shared position synchronization.
* 🍔 [Message batching control](./client_msg_batching.md) for advanced tuning of client connection write behaviour.
* 🧐 [Observability enhancements](./observability_enhancements.md) for additional more granular system state insights.
* 🪵 [CPU and RSS memory](./process_stats.md) usage stats of Centrifugo nodes in admin UI.

Also, explore our [Centrifugo PRO planned features](https://github.com/orgs/centrifugal/projects/3/views/1) board for a concise overview of upcoming features which are currently in progress and enhancements planned for a future.

## Pricing

Centrifugo PRO requires a license key to run. The pricing information for the license key is available upon request over `sales@centrifugal.dev` e-mail. Our services are exclusively available to corporate and business clients at this time.

The license key allows running Centrifugo PRO without any limits for organization projects, includes 1 year of prioritized support and updates. Our pricing is flat and based on your company size and Centrifugo role. Please contact us for more details and a quote.

We would be happy to learn more about your real-time challenges and how Centrifugo can help you address them. Don't hesitate to ask for an online meeting to discuss the use case in-person.

## Try for free in sandbox mode

You can try out Centrifugo PRO for free. When you start Centrifugo PRO without license key then it's running in a sandbox mode. Sandbox mode limits the usage of Centrifigo PRO in several ways. For example:

* Centrifugo handles up to 20 concurrent connections
* up to 2 server nodes supported
* up to 5 API requests per second allowed

This mode should be enough for development and trying out PRO features, but must not be used in production environment.

:::caution Centrifugo PRO license agreement

Centrifugo PRO is distributed by Centrifugal Labs LTD under [commercial license](/license) which is different from OSS version. By downloading Centrifugo PRO you automatically accept commercial license terms.

:::
