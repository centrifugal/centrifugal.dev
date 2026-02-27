---
description: "Centrifugo unidirectional protocol guide: connect requests, push message types, and handling real-time data without bidirectional SDKs."
id: uni_client_protocol
title: Unidirectional client protocol
sidebar_label: Unidirectional protocol
---

As mentioned earlier, you can bypass the need for Centrifugo bidirectional real-time SDKs by opting for the [unidirectional approach](./overview.md#unidirectional). By using unidirectional Centrifugo transports, you can harness the power of native browser APIs while still benefiting of Centrifugo features, including efficient subscription multiplexing, scalability, a ready-to-use publication API, and more. This approach allows you to introduce real-time features with minimal dependencies on the client side, still having scalable and efficient real-time backend.

By sticking with the unidirectional approach, you'll need to implement some basic parsing on the client side to handle the message types sent by Centrifugo over unidirectional connections.

Currently, Centrifugo supports unidirectional transports including WebSocket, HTTP streaming, Server-Sent Events (EventSource), and gRPC. All of these share the same protocol structure, ensuring consistency across different transport methods.

First of all let's look at possible unidirectional transport session (in this example HTTP-streaming) with Centrifugo to show the simplicity and look at general structure before diving into the details.

```bash
❯ curl -X POST http://localhost:8000/connection/uni_http_stream -d '{}'
{"connect":{"client":"bb56837...","version":"0.0.0 OSS","subs":{"#2694":{}},"ping":25,"session":"3159c4f8..."}}
{"channel":"#2694","join":{"info":{"user":"2694","client":"bb56837e-5b93-4478-95b6-98f3d2269b29"}}}
{"channel":"#2694","pub":{"data":{"input":1}}}
{}
{"channel":"#2694","pub":{"data":{"input":2}}}
{"channel":"#2694","pub":{"data":{"input":3}}}
{"disconnect":{"code":3001,"reason":"shutdown"}}
```

## How to connect

Each unidirectional transport must be explicitly enabled in Centrifugo configuration. Once enabled, you can connect using it.

For example, to enable unidirectional SSE transport you need to add the following to your Centrifugo configuration:

```json
{
  "uni_sse": {
    "enabled": true
  }
}
```

Or, for unidirectional HTTP-streaming transport:

```json
{
  "uni_http_stream": {
    "enabled": true
  }
}
```

### Connection endpoint

For establishing the unidirectional connection, you need to use the appropriate transport endpoint, pass connection request payload, and then handle incoming push messages.

The exact endpoint to connect varies depending on the transport you choose, you can find default in the documentation for a specific transport:

* [Unidirectional WebSocket](./uni_websocket.md) - `/connection/uni_websocket`
* [Unidirectional HTTP streaming](./uni_http_stream.md) - `/connection/uni_http_stream`
* [Unidirectional Server-Sent Events (EventSource)](./uni_sse.md) - `/connection/uni_sse`
* [Unidirectional gRPC](./uni_grpc.md) - uses custom GRPC server and port to connect.

Upon connection, you can pass initial connection payload to Centrifugo. The way you send it varies for different unidirectional transports.  But generally the connect request structure is the same and is defined in [Centrifugo protocol Protobuf schema](https://github.com/centrifugal/protocol/blob/master/definitions/client.proto) - see `ConnectRequest` message type. Let's describe it in more detail in relation to unidirectional transports.

### ConnectRequest

| Field name | Field type                    | Required | Description                                                                                              |
|------------|-------------------------------|----------|----------------------------------------------------------------------------------------------------------|
| token      | `string`                      | no       | Connection JWT, not needed when using the connect proxy feature.                                         |
| data       | `bytes`                       | no       | Custom connection data (for JSON protocol just embed JSON object here)                                   |
| name       | `string`                      | no       | Application name                                                                                         |
| version    | `string`                      | no       | Application version                                                                                      |
| subs       | `map[string]SubscribeRequest` | no       | Pass an information about desired subscriptions to a server                                              |
| headers    | `map[string]string`           | no       | Headers for Headers Emulation feature (may be transformed by Centrifugo into proxy request HTTP headers) |

* [Unidirectional WebSocket](./uni_websocket.md) - send as first WebSocket message to a server
* [Unidirectional HTTP streaming](./uni_http_stream.md) - send as JSON body of HTTP-streaming POST request
* [Unidirectional Server-Sent Events (EventSource)](./uni_sse.md) - send in URL parameter `cf_connect` (also possible in JSON body of POST request – but web browsers do not allow that)
* [Unidirectional gRPC](./uni_grpc.md) - send as a part of gRPC unidirectional connect request.

See more details in the corresponding transport documentation.

For example, for HTTP-streaming transport you can send connect command as a JSON body of a POST request:

```
curl -X POST http://localhost:8000/connection/uni_http_stream -d '{"token": "<JWT>"}'
```

### SubscribeRequest

Describes an object client may pass to the server for each desired channel in `subs` map – to give server some hints about how to handle the subscription.

| Field name | Field type | Required | Description                                               |
|------------|------------|----------|-----------------------------------------------------------|
| recover    | `boolean`  | no       | Whether a client wants to recover from a certain position |
| offset     | `integer`  | no       | Known stream position offset when `recover` is used       |
| epoch      | `string`   | no       | Known stream position epoch when `recover` is used        |

Example for HTTP-streaming:

```
curl -X POST http://localhost:8000/connection/uni_http_stream -d \
  '{"token": "<JWT>", "subs": {"user#2694": {"recover": true, "offset": 12, "epoch": "xD5R"}}}'
```

Note, that Centrifugo won't simply accept subscriptions from `subs` – only if current client connection has access to subscribe to them. Following [the channel permission model](../server/channel_permissions.md).

## Unidirectional pushes

Once unidirectional connection is established, Centrifugo will send `Push` frames over the connection. The structure of those `Push` frames is defined in the [client protocol schema](https://github.com/centrifugal/protocol/blob/master/definitions/client.proto), meaning Centrifugo leverages a portion of its bidirectional protocol for unidirectional communication. In bidirectional protocol Centrifugo uses `Command` and `Reply` messages on top level, and when sending asynchronous real-time messages it sends `Reply` message with `push` field (of `Push` type). In unidirectional case command-reply pattern is not possible, so Centrifugo just always sends `Push` types over the connection.

This is how a `Push` message is defined in the schema:

```
message Push {
  string channel = 2;

  Publication pub = 4;
  Join join = 5;
  Leave leave = 6;
  Unsubscribe unsubscribe = 7;
  Message message = 8;
  Subscribe subscribe = 9;
  Connect connect = 10;
  Disconnect disconnect = 11;
  Refresh refresh = 12;
}
```

Every push contains **one of** the following fields with object corresponding to a type from Protobuf schema:

* `connect`
* `pub`
* `join`
* `leave`
* `disconnect`
* `unsubscribe`
* `subscribe`
* `refresh`

Some push messages sent (like publication) belong to a `channel` which may be set on `Push` top level. Pushes without any mentioned field and without `channel` are periodic pings from server.

All you need to do on the client side is look at received `Push`, process messages you are interested in and ignore others. In most cases you will be most interested in pushes which contain `connect` or `pub` (publication).

Some pseudocode you can use to process push messages:

```javascript
const onMessage = (message) => {
    const push = JSON.parse(message);
    if (push.connect) {
        // handle connect push.
    } else if (push.pub) {
        // handle publication push.
    } else if (Object.keys(push).length === 0) {
        // handle ping push.
    } else {
        // Ignore other pushes.
    }
}
```

Just try using any unidirectional transport and you will quickly get the idea.

### connect

Immediately after the unidirectional connection successfully established Centrifugo sends `connect` Push frame.

Example:

```json
{
  "connect":{
    "client":"5c5b6011-b282-447d-8753-cee7269117e6",
    "version":"0.0.0 OSS",
    "subs":{
      "personal:user#2694": {
        "recoverable":true,
        "offset": 12,
        "epoch":"BXLK",
        "positioned":true
      },
      "global": {}
    },
    "ping":25,
    "session":"631a6f6e-02bc-473b-908f-8059a680e74c"
  }
}
```

It contains information about client identifier, established server-side subscriptions (with pos), ping and session identifier information.

### publication

If something was published to the channel the unidirectional connection will receive `pub` Push.

```json
{
  "channel":"test",
  "pub": {
    "data":{"input":1},
    "offset":1
  }
}
```

:::tip

Note, in Protobuf schema `data` field of `Publication` message is represented by `bytes` type, but for JSON protocol case Centrifugo injects JSON (which is actually a sequence of bytes).

:::

### join

Sent if a channel has join/leave features enabled and someone joins (subscribes) to a channel.

Example:

```json
{
  "channel":"#2694",
  "join":{
    "info":{"user":"2694","client":"99288691-e378-4a03-a34d-bf2c0dab6b51"}
  }
}
```

### leave

Sent if a channel has join/leave features enabled and someone leaves (unsubscribes) a channel.

```json
{
  "channel":"#2694",
  "leave":{
    "info":{"user":"2694","client":"99288691-e378-4a03-a34d-bf2c0dab6b51"}
  }
}
```

### disconnect

When connection can't be established or is closed by a server for some reason. Connection is closed by a server after sending this message.

```json
{
  "disconnect":{
    "code":3004,
    "reason":"internal server error"
  }
}
```

### unsubscribe

Sent when connection was unsubscribed from a channel during its lifetime.

```json
{
  "channel":"test",
  "unsubscribe":{}
}
```

### subscribe

Sent when connection was subscribed to a channel during its lifetime.

```json
{
  "channel":"test",
  "subscribe":{}
}
```

### refresh

Sent when connection was refreshed. Generally, it's rarely needed in practice.

### ping

From time to time connection will receive empty pushes - without any fields. Those are server ping frames.
