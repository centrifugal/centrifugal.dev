---
id: client
title: Client real-time SDKs
---

The following SDKs allow connecting to Centrifugo from the application frontend:

:::info No need in clients for unidirectional approach

Client libraries listed here speak Centrifugo bidirectional protocol (WebSocket). If you aim to use unidirectional approach you don't need client connectors – just use standard APIs. See the difference [here](../transports/overview.md).

:::

* [centrifuge-js](https://github.com/centrifugal/centrifuge-js) – for browser, NodeJS and React Native
* [centrifuge-go](https://github.com/centrifugal/centrifuge-go) - for Go language
* [centrifuge-mobile](https://github.com/centrifugal/centrifuge-mobile) - for iOS/Android with `centrifuge-go` as basis and [gomobile](https://github.com/golang/mobile)
* [centrifuge-dart](https://github.com/centrifugal/centrifuge-dart) - for Dart and Flutter
* [centrifuge-swift](https://github.com/centrifugal/centrifuge-swift) – for native iOS development
* [centrifuge-java](https://github.com/centrifugal/centrifuge-java) – for native Android development and general Java

See a description of [client protocol](../transports/protocol.md) if you want to write a custom client bidirectional connector.
