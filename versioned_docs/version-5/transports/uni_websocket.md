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

Centrifugo uses empty commands (`{}` in JSON case) as pings for unidirectional WS. You can ignore such messages or use them to detect broken connections (nothing received from a server for a long time).

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

Let's connect to a unidirectional WebSocket endpoint using [wscat](https://github.com/websockets/wscat) tool – it allows connecting to WebSocket servers interactively from a terminal.

First, run Centrifugo with `uni_websocket` enabled. Also let's enable automatic personal channel subscriptions for users. Configuration example:

```json title="config.json"
{
  "token_hmac_secret_key": "secret",
  "uni_websocket":true,
  "user_subscribe_to_personal": true
}
```

Run Centrifugo:

```
./centrifugo -c config.json
```

In another terminal:

```
❯ ./centrifugo gentoken -c config.json -u test_user
HMAC SHA-256 JWT for user test_user with expiration TTL 168h0m0s:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXIiLCJleHAiOjE2MzAxMzAxNzB9.u7anX-VYXywX1p1lv9UC9CAu04vpA6LgG5gsw5lz1Iw
```

Install [wscat](https://github.com/websockets/wscat) and run:

```
wscat -c "ws://localhost:8000/connection/uni_websocket"
```

This will establish a connection with a server and you then can send connect command to a server:

```
❯ wscat -c "ws://localhost:8000/connection/uni_websocket"

Connected (press CTRL+C to quit)
> {"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXIiLCJleHAiOjE2NTY1MDMwNDV9.3UYL-UCUBp27TybeBK7Z0OenwdsKwCMRe46fuEjJnzI", "subs": {"abc": {}}}
< {"connect":{"client":"bfd28799-b958-4791-b9e9-b011eaef68c1","version":"0.0.0","subs":{"#test_user":{}},"expires":true,"ttl":604407,"ping":25,"session":"57b1287b-44ec-45c8-93fc-696c5294af25"}}
```

The connection will receive server pings (empty commands `{}`) periodically. You can try to publish something to `#test_user` or `abc` channels (using Centrifugo server API or using admin UI) – and the message should come to the connection we just established.
