---
id: uni_websocket
title: Unidirectional WebSocket
sidebar_label: WebSocket
---

Default unidirectional WebSocket connection endpoint in Centrifugo is:

```
/connection/uni_websocket
```

While WebSocket is bidirectional transport in its nature Centrifugo provides its unidirectional version too to give developers more choice in transports when using unidirectional approach.

## Connect command

It's possible to send connect command as first WebSocket message (as JSON).

| Field name | Field type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| token       | string  | no | Connection JWT, not required when using the connect proxy feature.       |
| data       | any JSON       | no | Custom JSON connection data        |
| name  | string       | no |   Application name         |
| version  | string       | no |   Application version         |
| subs  | map of channel to SubscribeRequest       | no |   Pass an information about desired subscriptions to a server |

### SubscribeRequest

| Field name | Field type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| recover       | boolean  | no | Whether a client wants to recover from a certain position       |
| offset       | integer       | no | Known stream position offset when `recover` is used        |
| epoch  | string       | no |   Known stream position epoch when `recover` is used         |

## Supported data formats

JSON

## Pings

Centrifugo uses empty messages (frame with no payload at all) as pings for unidirectional WS. You can ignore such messages or use them to detect broken connections (nothing received from a server for a long time).

## Options

### uni_websocket

Boolean, default: `false`.

Enables unidirectional WebSocket endpoint.

```json title="config.json"
{
    ...
    "uni_websocket": true
}
```

### uni_websocket_message_size_limit

Default: 65536 (64KB)

Maximum allowed size of a first connect message received from WebSocket connection in bytes.

## Example

Coming soon.
