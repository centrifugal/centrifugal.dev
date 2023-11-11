---
id: overview
title: Centrifugo PRO
---

<img src="/img/pro_icon.png" width="110px" height="110px" align="left" style={{'marginRight': '10px', 'float': 'left'}} />

Centrifugo PRO is the enhanced version of Centrifugo provided by Centrifugal Labs LTD under commercial license. It's packed with a set of unique features that offer exceptional benefits to your business. It provides granular channel permission control, lower CPU utilization on Centrifugo nodes, backend protection from misusing, next level system observability, additional APIs (like push notifications), and more.

All the features of Centrifugo PRO come with a decent scalable performance. Some reuse Centrifugo super fast Redis communication capabilities. ClickHouse analytics built on top of efficient approach with the minimal overhead. We've put a lot of love into all of the extra powers of Centrifugo to make sure they are practical and ready for production workloads.

## Features

Centrifugo PRO is packed with the following features:

* Everything from Centrifugo OSS
* 🔍 [Channel and user tracing](./tracing.md) allows watching client protocol frames in channel or per user ID in real time.
* 💹 [Real-time analytics with ClickHouse](./analytics.md) for a great system observability, reporting and trending.
* 🛡️ [Operation rate limits](./rate_limiting.md) to protect server from the real-time API misusing and frontend bugs.
<!-- * 🌐 [Distributed rate limit API](./distributed_rate_limit.md) provides a generic way to implement high-precision rate limiting in your app. -->
* 🔥 [Push notification API](./push_notifications.md) to manage device tokens and send mobile and browser push notifications.
* 🟢 [User status API](./user_status.md) feature allows understanding activity state for a list of users.
* 🔌 [Connections API](./connections.md) to query, filter and inspect active connections.
* ✋ [User blocking API](./user_block.md) to block/unblock abusive users by ID.
* 🛑 [JWT revoking and invalidation API](./token_revocation.md) to revoke tokens by ID and invalidate user's tokens based on issue time.
* 🔔 [Channel state events](channel_events.md) to be notified on the backend about channel `occupied` and `vacated` events.
* 💪 [Channel capabilities](./capabilities.md) for controlling channel permissions per connection or per subscription.
* 📜 [Channel patterns](./channel_patterns.md) allow defining channel configuration like HTTP routes with parameters.
* ✍️ [CEL expressions](./cel_expressions.md) to write custom efficient permission rules for channel operations.
* 🚀 [Faster performance](./performance.md) to reduce resource usage on server side.
* 🔮 [Singleflight](./singleflight.md) for online presence and history to reduce load on the broker.
* 🍔 [Message batching control](./client_msg_batching.md) for advanced tuning of client connection write behaviour.
* 🧐 [Observability enhancements](./observability_enhancements.md) for additional more granular system state insights.
* 🪵 [CPU and RSS memory](./process_stats.md) usage stats of Centrifugo nodes in admin UI.

Also, explore our [Centrifugo PRO planned features](https://github.com/orgs/centrifugal/projects/3/views/1) board for a concise overview of upcoming features which are currently in progress and enhancements planned for a future.

:::info

PRO features can change with time. We reserve a right to move features from PRO to OSS version if there is a clear signal that this is required to do for the ecosystem.

:::

## Pricing

Centrifugo PRO requires a license key to run.

The price for a license key is 3,499 EUR. A license key has an expiration date — six months since the purchase. Once your key expires, Centrifugo PRO will continue to work, but you will lose access to updates for versions released after the expiration date of your key. This model is like subscription, yet provides the flexibility to delay subsequent payments until an upgrade is required.

Our services are exclusively available to corporate and business clients at this time. To purchase the license key, please reach out to us at `sales@centrifugal.dev`. We kindly ask that your email includes specific information about your company, such as its name and address. We would also value a brief description of how you plan to utilize Centrifugo PRO.

The purchase is just an online payment by card (or other available method) in Centrifugal Labs store on Lemon Squeezy platform. We will share a payment link in response to your request – and everything else is automated.

## Try for free in sandbox mode

You can try out Centrifugo PRO for free. When you start Centrifugo PRO without license key then it's running in a sandbox mode. Sandbox mode limits the usage of Centrifigo PRO in several ways. For example:

* Centrifugo handles up to 20 concurrent connections
* up to 2 server nodes supported
* up to 5 API requests per second allowed

This mode should be enough for development and trying out PRO features, but must not be used in production environment as we can introduce additional limitations in the future.

:::caution Centrifugo PRO license agreement

Centrifugo PRO is distributed by Centrifugal Labs LTD under [commercial license](/license) which is different from OSS version. By downloading Centrifugo PRO you automatically accept commercial license terms.

:::
