---
description: "Centrifugo ecosystem overview. Centrifuge Go library for custom servers and framework integrations for Laravel, Symfony, Django, and more."
id: ecosystem
title: Ecosystem notes
---

Some additional notes about our ecosystem which may help you develop with our tech.

## Centrifuge library for Go

Centrifugo is built on top of the [Centrifuge](https://github.com/centrifugal/centrifuge) library for the Go language.

Due to its standalone language-agnostic nature, Centrifugo dictates some rules developers should follow when integrating. If you need more freedom and a tighter integration of a real-time server with application business logic, you may consider using the Centrifuge library to build something similar to Centrifugo but with customized behavior. The Centrifuge library can be considered as an analogue of Socket.IO in the Go language ecosystem.

The library's [README](https://github.com/centrifugal/centrifuge#readme) has a detailed description, a link to examples, and an [introduction post](/blog/2021/01/15/centrifuge-intro).

Many Centrifugo features should be re-implemented when using Centrifuge - like the API layer, admin web UI, proxy, etc. (if you need those of course). And you need to write in the Go language. But the core functionality like a client-server protocol (all Centrifugo client SDKs work with a Centrifuge library-based server) and Redis engine to scale come out of the box – in most cases, this is enough to start building an app.

:::tip

Many things said in the Centrifugo doc can be considered as extra documentation for the Centrifuge library (for example, parts about infrastructure tuning or transport description). But not all of them.

:::

## Framework integrations

There are some community-driven projects that provide integration with frameworks for more native experience.

:::tip

In general, integrating Centrifugo can be done in several steps even without third-party libraries – see our [integration guide](integration.md). Integrating directly may allow using all Centrifugo features without limitations which can be introduced by third-party wrapper.

:::

* [laravel-centrifugo](https://github.com/denis660/laravel-centrifugo) integration with Laravel framework
* [laravel-centrifugo-broadcaster](https://github.com/opekunov/laravel-centrifugo-broadcaster) one more integration with Laravel framework to consider
* [CentrifugoBundle](https://github.com/fre5h/CentrifugoBundle) integration with Symfony framework
* [Django-instant](https://github.com/synw/django-instant) integration with Django framework
* [roadrunner-php/centrifugo](https://github.com/roadrunner-php/centrifugo) integration with [RoadRunner](https://roadrunner.dev)
* [spiral/roadrunner-bridge](https://github.com/spiral/roadrunner-bridge) integration with [Spiral Framework](https://spiral.dev)
