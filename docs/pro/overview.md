---
id: overview
title: Centrifugo PRO overview
---

Centrifugo PRO is an extended version of Centrifugo with some advanced features.

Centrifugo PRO requires a license key which can be purchased to unlock these additional features. At this moment we form an invoice for payment with a payment link manually. Please contact over `centrifugal.dev@gmail.com` to buy a license key or request a trial license key. This process may be automated in the future.

## Pricing

The license key prices have the following gradations:

* Free trial: 1-month key to test out PRO features (**Centrifugo stops working after this key expires so it's only suitable for development**)
* <em>???$</em> for 6 months license key
* <em>???$</em> for 1 year license key

All license keys binded to a unique owner. License key owner can use it in any amount of own projects, but must not share the license key publicly (can be blocked otherwise).

:::info License key expiration

The license key has an expiration date. After the expiration date, Centrifugo PRO continues to work with all PRO features available but you won't be able to update to a newer Centrifugo version (released after key expiration date) until buying a new license key. This means you should not worry that expired license key will result into a broken service at some point. You will also be able to restart Centrifugo without any problem. The only exception is trial license key which is not suitable for production usage.

:::

Also keep in mind that there is no refunding process for purchased license keys. 

## Features

Here is a list of all Pro features available at the moment. The list of PRO features may change with a time.

* Channel and user tracing - [details](./tracing.md)
* Real-time analytics with ClickHouse – [details](./analytics.md)
* User status – [details](./user_status.md)
* Operation throttling – [details](./throttling.md)
* User connections API – [details](./user_connections.md)
* Faster performance – [details](./performance.md)
* Singleflight for presence and history – [details](./singleflight.md)
* Database-driven channel namespace configuration - [details](./db_namespaces.md)
* Near real-time CPU and RSS memory usage stats – [details](./process_stats.md)

:::info

PRO features can change with time. We reserve a right to move features from PRO to OSS version if there is a clear signal that this is required to do for Centrifugo ecosystem.

:::