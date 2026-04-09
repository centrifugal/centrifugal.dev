---
description: "Centrifugo PRO is the enhanced commercial version with push notifications, real-time analytics, rate limiting, SSO, tracing, and enterprise features."
id: overview
title: Centrifugo PRO
sidebar_label: Centrifugo PRO overview
---

Centrifugo PRO is the enhanced version of Centrifugo offered by Centrifugal Labs under a commercial license. It's packed with a unique set of features designed to fit requirements of corporate and enterprise environments, decrease costs at scale, and benefit from additional features such as push notifications support, real-time analytics, and so on. We have leveraged our extensive experience to build Centrifugo PRO, ensuring its extra powers are practical and ready for production workloads. See information about [pricing](#pricing) and [try for free](#try-for-free-in-sandbox-mode) in sandbox mode.

## Features

Centrifugo PRO is packed with the following features:

* Everything from Centrifugo OSS
* 🔥 [Push notification API](./push_notifications.md) to manage device tokens and send mobile and browser push notifications.
* 🔍 [Channel and user tracing](./tracing.md) allows watching client protocol frames in channel or per user ID in real time.
* 💹 [Real-time analytics with ClickHouse](./analytics.md) for a great system observability, reporting and trending.
* 🛡️ [Operation rate limits](./rate_limiting.md) to protect server from the real-time API misusing and frontend bugs.
* 🔐 [SSO for admin UI](./admin_ui.md) using OpenID Connect (OIDC) protocol. Also, more data about the system state.
* 📸 [Channels and connections snapshots](./admin_ui.md#channels-and-connections-snapshots) to drill down into the system state right from admin UI.
* 🪪 [Extracting meta from JWT claims](./client_authentication.md#extracting-meta-from-jwt-claims). And [Multiple JWKS providers](./client_authentication.md#multiple-jwks-providers) for client authentication.
* 🔑 [Server API JWKS auth](./server_api_auth.md) to protect HTTP API with JWT tokens validated against JWKS endpoint.
* 🟢 [User status API](./user_status.md) feature allows understanding activity state for a list of users.
* 🔌 [Connections API](./connections.md) to query, filter and inspect active connections.
* ✋ [User blocking and token revocation API](./access_revoke.md) to block/unblock abusive users and revoke tokens by ID or invalidate user's tokens based on issue time.
* 🔔 [Additional event hooks](event_hooks.md) — channel state events (`occupied`/`vacated`) and cache empty events for lazy state population.
* 💪 [Channel capabilities](./capabilities.md) for controlling channel permissions per connection or per subscription.
* 📜 [Channel patterns](./channel_patterns.md) allow defining channel configuration like HTTP routes with parameters.
* ✍️ [Channel CEL expressions](./cel_expressions.md) to write custom efficient permission rules for channel operations.
* 🚀 [Faster performance](./performance.md) to reduce resource usage on server side.
* 🔮 [Scalability optimizations](./scalability.md) with singleflight technique and shared position synchronization.
* 📚 [Per-namespace engines](./scalability.md#per-namespace-engines) to configure various PUB/SUB brokers and presence managers on namespace level.
* 🕹️ [Setting custom Controller](./scalability.md#setting-custom-controller) to isolate controller load from channel load (i.e. from Broker)
* 🗜️ [Bandwidth optimizations](./bandwidth_optimizations.md) to reduce network costs. [Delta compression for at most once](./bandwidth_optimizations.md#delta-compression-for-at-most-once), [channel compaction](./bandwidth_optimizations.md#channel-compaction), [publish debouncing](./bandwidth_optimizations.md#publish-debouncing).
* 🍔 [Message batching control](./client_msg_batching.md) for advanced tuning of client connection write behaviour.
* 🏷️ [Server-side publication tags filter](./server_tags_filter.md) for per-subscriber access control via publication tags — works for stream and map subscriptions.
* 🗺️ [Map subscriptions enhancements](./map_subscriptions.md) with in-memory cache layer, PostgreSQL enhancements, Redis Cluster support, and per-namespace map brokers.
* 🔄 [Shared poll enhancements](./shared_poll.md) with instant initial data, delta compression, notification fast path, adaptive backpressure, and shared poll relay.
* 🧐 [Observability enhancements](./observability_enhancements.md) for additional more granular system state insights.

And more to come!

## Pricing

Centrifugo PRO requires a license key to run. The pricing information for the license key is available upon request over `sales@centrifugal.dev` e-mail. Our services are exclusively available to corporate and business clients at this time.

The license key allows running Centrifugo PRO without any limits for organization projects, includes 1 year of prioritized support and updates. Our pricing is flat and based on your company size and Centrifugo role. Please contact us for more details and a quote.

We would be happy to learn more about your real-time challenges and how Centrifugo can help you address them. Don't hesitate to ask for an online meeting to discuss the use case in-person.

## Try for free in sandbox mode

You can try out Centrifugo PRO for free. When you start Centrifugo PRO without license key then it's running in a sandbox mode. Sandbox mode limits the usage of Centrifugo PRO in several ways. For example:

* Centrifugo handles up to 20 concurrent connections
* up to 2 server nodes supported
* up to 5 API requests per second allowed

This mode should be enough for development and trying out PRO features, but must not be used in production environment.

:::caution Centrifugo PRO license agreement

Centrifugo PRO is distributed by Centrifugal Labs LTD under [commercial license](/license) which is different from OSS version. By downloading Centrifugo PRO you automatically accept commercial license terms.

:::
