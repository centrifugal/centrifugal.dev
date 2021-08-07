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

## Supported data formats

JSON

## Pings

Centrifugo uses empty messages (frame with no payload at all) as pings for unidirectional WS.

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