---
id: uni_http_stream
title: Unidirectional HTTP streaming
sidebar_label: HTTP streaming
---

HTTP streaming is a technique based on using a long-lived HTTP connection between a client and a server with a chunked transfer encoding. These days it's possible to use it from the web browser using modern [Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [Readable Streams](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) API.

Can be enabled using:

```json title=config.json
{
  "uni_http_stream": {
    "enabled": true
  }
}
```

Default unidirectional HTTP streaming connection endpoint in Centrifugo is:

```
/connection/uni_http_stream
```

Streaming endpoint accepts HTTP POST requests and sends JSON messages to a connection. These JSON messages can have different meaning according to Centrifuge protocol Protobuf definitions. But in most cases you will be interested in Publication push types.

## Connect command

It's possible to pass initial connect command by posting a JSON body to a streaming endpoint. 

Refer to the full Connect command description – it's [the same as for unidirectional WebSocket](./uni_websocket.md#connect-command).

## Supported data formats

JSON

## Pings

Centrifugo will send different message types to a connection. Every message is JSON encoded. A special JSON value `null` used as a PING message. You can simply ignore it on a client side upon receiving. You can ignore such messages or use them to detect broken connections (nothing received from a server for a long time).

## Options

### uni_http_stream.enabled

Boolean, default: `false`.

Enables unidirectional HTTP streaming endpoint.

```json title="config.json"
{
    ...
    "uni_http_stream": {
        "enabled": true
    }
}
```

### uni_http_stream.max_request_body_size

Default: 65536 (64KB)

Maximum allowed size of a initial HTTP POST request in bytes.

## Connecting using CURL

Let's look how simple it is to connect to Centrifugo using HTTP streaming.

We will start from scratch, generate new configuration file:

```
centrifugo genconfig
```

Turn on uni HTTP stream and automatically subscribe users to personal channel upon connect:

```json title="config.json"
{
  "client": {
    "subscribe_to_user_personal_channel": {
      "enabled": true
    }
  },
  "uni_http_stream": {
    "enabled": {
      "enabled": true
    }
  }
}
```

Run Centrifugo:

```
centrifugo -c config.json
```

In separate terminal window create token for a user:

```bash
❯ go run main.go gentoken -u user12
HMAC SHA-256 JWT for user user12 with expiration TTL 168h0m0s:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIiLCJleHAiOjE2MjUwNzMyODh9.BxmS4R-X6YXMxLfXNhYRzeHvtu_M2NCaXF6HNu7VnDM
```

Then connect to Centrifugo uni HTTP stream endpoint with simple CURL POST request:

```bash
curl -X POST http://localhost:8000/connection/uni_http_stream \
    -d '{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIiLCJleHAiOjE2MjUwNzMyODh9.BxmS4R-X6YXMxLfXNhYRzeHvtu_M2NCaXF6HNu7VnDM"}'
```

Open one more terminal window and publish message to a personal user channel:

```bash
curl -X POST http://localhost:8000/api/publish \
    -d '{"channel": "#user12", "data": {"input": "hello"}}' \
    -H "Authorization: apikey 9230f514-34d2-4971-ace2-851c656e81dc"
```

You should see this messages coming from server.

`{}` messages are pings from a server.

That's all, happy streaming!

## Browser example

A basic browser will come soon as we update docs for v4.
