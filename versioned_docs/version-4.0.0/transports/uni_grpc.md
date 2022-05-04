---
id: uni_grpc
title: Unidirectional GRPC
sidebar_label: GRPC
---

It's possible to connect to GRPC unidirectional stream to consume real-time messages from Centrifugo. In this case you need to generate GRPC code for your language on client-side.

Protobuf definitions can be found [here](https://github.com/centrifugal/centrifugo/blob/master/internal/unigrpc/unistream/unistream.proto).

GRPC server will start on port `11000` (default).

## Supported data formats

JSON and binary.

## Options

### uni_grpc

Boolean, default: `false`.

Enables unidirectional GRPC endpoint.

```json title="config.json"
{
    ...
    "uni_grpc": true
}
```

### uni_grpc_port

String, default `"11000"`.

Port to listen on.

### uni_grpc_address

String, default `""` (listen on all interfaces)

Address to bind uni GRPC to.

### uni_grpc_max_receive_message_size

Default: `65536` (64KB)

Maximum allowed size of a first connect message received from GRPC connection in bytes.

### uni_grpc_tls

Boolean, default: `false`

Enable custom TLS for unidirectional GRPC server.

### uni_grpc_tls_cert

String, default: `""`.

Path to cert file.

### uni_grpc_tls_key

String, default: `""`.

Path to key file.

## Example

A basic example can be found [here](https://github.com/centrifugal/examples/tree/master/unidirectional/grpc). It uses Go language, but for other languages approach is mostly the same:

1. Copy Protobuf definitions
1. Generate GRPC client code
1. Use generated code to connect to Centrifugo
1. Process Push messages, drop unknown Push types, handle those necessary for the application.
