---
id: client_sdk
title: Client real-time SDKs
---

[In the previous chapter](./client_api.md) we investigated common principles of Centrifugo client SDK API. Here we will provide a list of available bidirectional connectors you can use to communicate with Centrifugo.

:::info No need in clients for unidirectional approach

Client libraries listed here speak Centrifugo bidirectional protocol (WebSocket). If you aim to use unidirectional approach you don't need client connectors – just use standard APIs. See the difference [here](./overview.md).

:::

## List of client SDKs

* [centrifuge-js](https://github.com/centrifugal/centrifuge-js) – for browser, NodeJS and React Native
* [centrifuge-go](https://github.com/centrifugal/centrifuge-go) - for Go language
* [centrifuge-mobile](https://github.com/centrifugal/centrifuge-mobile) - for iOS/Android with `centrifuge-go` as basis and [gomobile](https://github.com/golang/mobile)
* [centrifuge-dart](https://github.com/centrifugal/centrifuge-dart) - for Dart and Flutter
* [centrifuge-swift](https://github.com/centrifugal/centrifuge-swift) – for native iOS development
* [centrifuge-java](https://github.com/centrifugal/centrifuge-java) – for native Android development and general Java

See a description of [client protocol](./client_protocol.md) if you want to write a custom client bidirectional connector.

## SDK feature matrix

Below you can find an information regarding support of different features in our official client SDKs

### Connection related features

<div class="features">

| Client feature  | js  | dart | swift | go | java |
| ------ | ------ | ------ | ------- | ------- | ------- |
| connect to a server | ✅ | ✅  |  ✅  | ✅  |  ✅  |
| setting client options | ✅ | ✅  |  ✅  | ✅  |  ✅  |
| automatic reconnect with backoff algorithm  | ✅  | ✅  | ✅ | ✅  |  ✅  |
| client state changes  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |
| command-reply  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |
| command timeouts  | ✅  | ✅  | ✅ | ✅  |  ✅  |
| async pushes  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |
| ping-pong  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |
| connection token refresh  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |
| handle disconnect advice from server  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |
| server-side subscriptions  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |

</div>

### Client-side subscription related features

<div class="features">

| Client feature  | js  | dart | swift | go | java |
| ------- | ------- | ------- | ------- | ------- | ------- |
| subscrbe to a channel  | ✅  | ✅  | ✅ | ✅  |  ✅  |
| setting subscription options  | ✅  | ✅  | ✅ | ✅  |  ✅  |
| automatic resubscribe with backoff algorithm  | ✅  | ✅  | ✅ | ✅  |  ✅  |
| subscription state changes  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |
| subscription command-reply  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |
| subscription async pushes  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |
| subscription token refresh  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |
| handle unsubscribe advice from server  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |
| manage subscription registry  | ✅  |  ✅  |  ✅  | ✅  |  ✅  |

</div>