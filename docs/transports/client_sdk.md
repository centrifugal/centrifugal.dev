---
id: client_sdk
title: Client real-time SDKs
---

[In the previous chapter](./client_api.md) we investigated common principles of Centrifugo client SDK API. Here we will provide a list of available bidirectional connectors you can use to communicate with Centrifugo.

:::tip No need in SDK for unidirectional approach

Real-time SDKs listed here speak Centrifugo bidirectional protocol (with WebSocket as main transport). If you aim to use unidirectional approach you don't need client connector dependency – just use standard APIs. See the difference [here](./overview.md).

:::

## List of client SDKs

Here is a list of SDKs maintained by Centrifugal Labs:

* [centrifuge-js](https://github.com/centrifugal/centrifuge-js) – for a browser, NodeJS and React Native
* [centrifuge-go](https://github.com/centrifugal/centrifuge-go) - for Go language
* [centrifuge-dart](https://github.com/centrifugal/centrifuge-dart) - for Dart and Flutter (mobile and web)
* [centrifuge-swift](https://github.com/centrifugal/centrifuge-swift) – for native iOS development
* [centrifuge-java](https://github.com/centrifugal/centrifuge-java) – for native Android development and general Java
* [centrifuge-python](https://github.com/centrifugal/centrifuge-python) – real-time SDK for Python on top of asyncio

SDKs driven by the community:

* [PlugFox/spinify](https://github.com/PlugFox/spinify) – alternative SDK for Dart/Flutter with faster performance, custom HTTP client, and more
* [charmy/centrifuge-csharp](https://github.com/charmy/centrifuge-csharp) - SDK in C# for .NET and Unity 2022.3+
* [IntrepidAI/tokio-centrifuge](https://github.com/IntrepidAI/tokio-centrifuge) – client SDK for Rust using Tokio

See a description of [client protocol](./client_protocol.md) if you want to write a custom bidirectional connector or eager to learn how Centrifugo protocol internals are structured. In case of any question how protocol works take a look at existing SDK source code or reach out in the community rooms.

## Protobuf and JSON formats in SDKs

Centrifugo real-time SDKs work using two possible serialization formats: JSON and Protobuf. The entire bidirectional client protocol is described by the [Protobuf schema](https://github.com/centrifugal/protocol/blob/master/definitions/client.proto). But those Protobuf messages may be also encoded as JSON objects (in JSON representation `bytes` fields in the Protobuf schema is replaced by the embedded JSON object in Centrifugo case).

Our Javascript SDK - `centrifuge-js` - uses JSON serialization for protocol frames by default. This makes communication with Centrifugo server convenient as we are exchanging human-readable JSON frames between client and server. And it makes it possible to use `centrifuge-js` without extra dependency to `protobuf.js` library. It's possible to switch to Protobuf protocol with `centrifuge-js` SDK though, in case you want more compact Centrifuge protocol representation, faster decode/encode speeds on Centrifugo server side, or payloads you need to pass are custom binary. See more details on how to use `centrifuge-js` with Protobuf serialization in [README](https://github.com/centrifugal/centrifuge-js#protobuf-support).

`centrifuge-go` real-time SDK for Go language also supports both JSON and Protobuf formats when communicating with Centrifugo server.

Other SDKs, like `centrifuge-dart`, `centrifuge-swift`, `centrifuge-java` work using only Protobuf serialization for Centrifuge protocol internally. So they utilize the fastest and the most compact wire representation by default. Note, that while internally in those SDKs the serialization format is Protobuf, you can still send JSON towards these clients as JSON objects may be encoded as UTF-8 bytes. So these SDKs may work with both custom binary and JSON payloads.

There are some important notes about [JSON and Protobuf interoperability](../faq/index.md#can-i-have-both-binary-and-json-clients-in-one-channel) mentioned in our FAQ.

## SDK feature matrix

Below you can find an information regarding support of different features in our official client SDKs

### Connection related features

<div className="features">

| Client feature                             | js | dart | swift | go | java | python |
|--------------------------------------------|----|------|-------|----|------|--------|
| connect to a server                        | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| setting client options                     | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| automatic reconnect with backoff algorithm | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| client state changes                       | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| command-reply                              | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| command timeouts                           | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| async pushes                               | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| ping-pong                                  | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| connection token refresh                   | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| handle disconnect advice from server       | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| server-side subscriptions                  | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| batching API                               | ✅  |      |       |    |      |        |
| bidirectional WebSocket emulation          | ✅  |      |       |    |      |        |
| headers emulation                          | ✅  | ✅    | na    | na | na   | na     |

</div>

### Client-side subscription related features

<div className="features">

| Client feature                               | js | dart | swift | go | java | python |
|----------------------------------------------|----|------|-------|----|------|--------|
| subscrbe to a channel                        | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| setting subscription options                 | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| automatic resubscribe with backoff algorithm | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| subscription state changes                   | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| subscription command-reply                   | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| subscription async pushes                    | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| subscription token refresh                   | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| handle unsubscribe advice from server        | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| manage subscription registry                 | ✅  | ✅    | ✅     | ✅  | ✅    | ✅      |
| optimistic subscriptions                     | ✅  |      |       |    |      |        |
| delta compression                            | ✅  |      |       |    | ✅    | ✅      |

</div>