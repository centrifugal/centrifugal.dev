---
id: client
title: Client API connectors
---

:::danger

This is a documentation for Centrifugo v3 which is not released yet. See [Centrifugo v2 documentation](https://centrifugal.github.io/centrifugo/) instead.

:::

The following libraries allow connecting to Centrifugo from application frontend:

:::info No need in clients for unidirectional approach

Client libraries listed here speak Centrifugo bidirectional protocol (WebSocket). If you aim to use unidirectional approach you don't need client connectors – just use standard APIs. See the difference [here](../transports/overview).

:::

* [centrifuge-js](https://github.com/centrifugal/centrifuge-js) – for browser, NodeJS and React Native
* [centrifuge-go](https://github.com/centrifugal/centrifuge-go) - for Go language
* [centrifuge-mobile](https://github.com/centrifugal/centrifuge-mobile) - for iOS/Android with `centrifuge-go` as basis and [gomobile](https://github.com/golang/mobile)
* [centrifuge-dart](https://github.com/centrifugal/centrifuge-dart) - for Dart and Flutter
* [centrifuge-swift](https://github.com/centrifugal/centrifuge-swift) – for native iOS development
* [centrifuge-java](https://github.com/centrifugal/centrifuge-java) – for native Android development and general Java

See a description of [client protocol](../transports/client_protocol) if you want to write a custom client bidirectional connector.
