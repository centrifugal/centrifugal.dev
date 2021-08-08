---
id: uni_grpc
title: Unidirectional GRPC
sidebar_label: GRPC
---

It's possible to connect to GRPC unidirectional stream to consume real-time messages from Centrifugo. In this case you need to generate GRPC code for your language on client-side.

Protobuf definitions can be found here: TODO.

See a Go based example that connects to a server: TODO.

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

## Example

Coming soon.
