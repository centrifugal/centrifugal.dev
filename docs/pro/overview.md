---
id: overview
title: Centrifugo PRO overview
---

Centrifugo PRO is an extended version of Centrifugo with some advanced features.

Centrifugo PRO requires a license key that can be purchased to unlock these additional features. At this moment we form an invoice for payment with a payment link manually. Please contact over `centrifugal.dev@gmail.com` to buy a license key or request a trial license key. This process may be automated in the future.

## Features

Here is a list of all Pro features available at the moment.

* [Channel and user tracing](./tracing.md) provides a way to look at all client protocol frames in the specified channel or per user ID.
* [Real-time analytics with ClickHouse](./analytics.md) for a great system observability, reporting and trending. [Details]().
* [User status](./user_status.md) feature to understand activity state for a list of users.
* [Operation throttling](./throttling.md) to protect client API from misusing and frontend bugs.
* [User connections API](./user_connections.md) to query for all active user sessions with additional information.
* Even [faster performance](./performance.md) to reduce resource usage on server side.
* [Singleflight](./singleflight.md) for presence and history to reduce load on broker.
* Near real-time [CPU and RSS memory usage stats](./process_stats.md).

:::info

PRO features can change with time. We reserve a right to move features from PRO to OSS version if there is a clear signal that this is required to do for the Centrifugo ecosystem.

:::

## Pricing

The license key prices have the following gradations:

* Free trial: a 2-month key to test out PRO features (**Centrifugo stops working after this key expires so it's only suitable for development**)
* <em>950$</em> for 1 year license key

All license keys are bound to a unique owner. License key owner can use it in any amount of own projects, but must not share the license key publicly (can be blocked otherwise).

:::info License key expiration

The license key has an expiration date. After the expiration date, Centrifugo PRO continues to work with all PRO features available but you won't be able to update to a newer Centrifugo version (released after key expiration date) until buying a new license key. This means you should not worry that an expired license key will result in a broken service at some point. You will also be able to restart Centrifugo without any problem. The only exception is the trial license key which is not suitable for production usage.

:::

Also, keep in mind that there is no refunding process for purchased license keys.
