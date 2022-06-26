---
id: overview
title: Centrifugo PRO overview
---

Centrifugo PRO is an extended version of Centrifugo with a set of additional features. These features can provide your business with unique benefits – granular channel permission control, lower CPU utilization on Centrifugo nodes, backend protection from misusing, next level system observability, and more.

## Features

Centrifugo PRO includes the following features:

* Everything from Centrifugo OSS
* [Channel and user tracing](./tracing.md) provides a way to look at all client protocol frames in the specified channel or per user ID.
* [Real-time analytics with ClickHouse](./analytics.md) for a great system observability, reporting and trending.
* [Channel capabilities](./capabilities.md) for controlling channel permissions per connection or per subscription.
* [User status](./user_status.md) feature to understand activity state for a list of users.
* [Operation throttling](./throttling.md) to protect client API from misusing and frontend bugs.
* [Connections API](./connections.md) to filter and inspect active connections.
* [User blocking API](./user_block.md) to block/unblock abusive users by ID.
* [JWT revoking and invalidation](./token_revocation.md) to revoke tokens by token ID (JTI) and invalidate user's tokens on issue time basis.
* [Faster performance](./performance.md) to reduce resource usage on server side.
* [Singleflight](./singleflight.md) for online presence and history to reduce load on the broker.
* Near real-time [CPU and RSS memory usage stats](./process_stats.md).

:::info

PRO features can change with time. We reserve a right to move features from PRO to OSS version if there is a clear signal that this is required to do for the Centrifugo ecosystem.

:::

## Sandbox mode

You can try out Centrifugo PRO for free. When you start Centrifugo PRO without license key then it's running in a sandbox mode. Sandbox mode limits the usage of Centrifigo PRO in several ways. For example:

* Centrifugo handles up to 20 concurrent connections
* up to 2 server nodes supported
* up to 20 API requests per second allowed

This mode should be enough for development and trying out PRO features, but must not be used in production environment as we can introduce additional limitations in the future.

:::caution

Centrifugo PRO is distributed under [commercial license](/pro_license) which is different from OSS version. By downloading Centrifugo PRO you automatically accept license terms.

:::

## Pricing

To run without limits Centrifugo PRO requires a license key. At this point we are not issuing license keys for Centrifugo PRO as we are in the process of defining pricing and distribution strategy for it. Please contact us over `centrifugal.dev@gmail.com`, we can add you to the list of interested customers and will appreciate if you share which PRO features you are mostly interested in.
