---
id: overview
title: Centrifugo PRO overview
---

Centrifugo PRO is an extended version of Centrifugo with a set of additional features. These features can provide your business with unique benefits – drastically save development time, reduce resource usage on a server, protect your backend from misusing, and put the system observability to the next level.

## Features

Here is a list of all Pro features available at the moment.

* [Channel and user tracing](./tracing.md) provides a way to look at all client protocol frames in the specified channel or per user ID.
* [Real-time analytics with ClickHouse](./analytics.md) for a great system observability, reporting and trending.
* [User status](./user_status.md) feature to understand activity state for a list of users.
* [Operation throttling](./throttling.md) to protect client API from misusing and frontend bugs.
* [User connections API](./user_connections.md) to query for all active user sessions with additional information.
* Even [faster performance](./performance.md) to reduce resource usage on server side.
* [Singleflight](./singleflight.md) for presence and history to reduce load on broker.
* Near real-time [CPU and RSS memory usage stats](./process_stats.md).

:::info

PRO features can change with time. We reserve a right to move features from PRO to OSS version if there is a clear signal that this is required to do for the Centrifugo ecosystem.

:::

## Sandbox mode

You can try out Centrifugo PRO for free. When you start Centrifugo PRO without license key then it's running in a sandbox mode. Sandbox mode limits the usage of Centrifigo PRO in several ways. For example:

* Centrifugo handles up to 50 concurrent connections
* up to 2 server nodes supported
* up to 20 API requests per second allowed

This mode should be enough for development, but must not be used in production environment.

## Pricing

To run without limits Centrifugo PRO requires a license key that can be purchased. At this moment we form an invoice for a payment with a payment link manually. Please contact over `centrifugal.dev@gmail.com` to buy a license key or request a trial license key. This process may be automated in the future.

The license key prices have the following gradations:

* Free trial key: a 2-month key to test out PRO features without sandbox limitations (**Centrifugo stops working after this key expires**)
* <em>950$</em> for 1 year license key

License keys are bound to a unique owner. License key owner can use it in any amount of own projects, but must not share the license key publicly (can be blocked otherwise).

:::info License key expiration

The license key has an expiration date. After the expiration date, Centrifugo PRO continues to work with all PRO features available but you won't be able to update to a newer Centrifugo version (released after key expiration date) until buying a new license key. This means you should not worry that an expired license key will result in a broken service at some point. You will also be able to restart Centrifugo without any problem. The only exception is the trial license key which is not suitable for production usage.

:::

Also, keep in mind that there is no refunding process for purchased license keys.
