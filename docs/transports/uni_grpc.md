---
description: "Connect to Centrifugo via unidirectional gRPC streaming for real-time messages. Setup, Protobuf definitions, TLS config, and usage examples."
id: uni_grpc
title: Unidirectional GRPC
sidebar_label: GRPC
---

It's possible to connect to GRPC unidirectional stream to consume real-time messages from Centrifugo. In this case you need to generate GRPC code for your language on client-side.

Protobuf definitions can be found [here](https://github.com/centrifugal/centrifugo/blob/master/internal/unigrpc/unistream/unistream.proto).

:::tip

We publish [Centrifugo GRPC uni stream Protobuf definitions](https://buf.build/centrifugo/unistream/docs/main:centrifugal.centrifugo.unistream) to [Buf Schema Registry](https://buf.build/product/bsr). This means that it's possible to depend on pre-generated Protobuf definitions for your programming language instead of manually generating them from the schema file (see [SDKs supported by Buf registry here](https://buf.build/centrifugo/unistream/sdks)).

:::

## How to enable

```json title=config.json
{
  "uni_grpc": {
    "enabled": true
  }
}
```

## Default endpoint

Centrifugo runs uni GRPC server on port `11000` (by default).

## Supported data formats

JSON and binary.

## `uni_grpc`

### `uni_grpc.enabled`

Boolean, default: `false`.

Enables unidirectional GRPC endpoint.

```json title="config.json"
{
    ...
    "uni_grpc": {
        "enabled": true
    }
}
```

### `uni_grpc.port`

String, default `"11000"`.

Port to listen on.

### `uni_grpc.address`

String, default `""` (listen on all interfaces)

Address to bind uni GRPC to.

### `uni_grpc.max_receive_message_size`

Default: `65536` (64KB)

Maximum allowed size of a first connect message received from GRPC connection in bytes.

### `uni_grpc.tls`

[TLSConfig](../server/configuration.md#tls-config-object).

Allows configuring TLS for unidirectional GRPC server.

## Example

We have [example for Go](https://github.com/centrifugal/examples/tree/master/v4/unidirectional/grpc) language. In general, the algorithm is like this: 

1. Copy Protobuf definitions
2. Generate GRPC client code
3. Use generated code to connect to Centrifugo
4. Process Push messages, drop unknown Pushes, handle those necessary for the application.
