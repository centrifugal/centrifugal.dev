---
id: uni_http_stream
title: Unidirectional HTTP streaming
sidebar_label: HTTP streaming
---

HTTP streaming is a technique based on using a long-lived HTTP connection between a client and a server with a chunked transfer encoding. These days it's possible to use it from the web browser using modern [Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [Readable Streams](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) API. See [example](#browser-example) below.

## How to enable

```json title=config.json
{
  "uni_http_stream": {
    "enabled": true
  }
}
```

## Default endpoint

Default unidirectional HTTP streaming connection endpoint in Centrifugo is:

```
/connection/uni_http_stream
```

Streaming endpoint accepts HTTP POST requests and sends JSON messages to a connection. These JSON messages can have different meaning according to Centrifuge protocol Protobuf definitions. But in most cases you will be interested in Publication push types.

## Send connect request

It's possible to pass initial [ConnectRequest](./uni_client_protocol.md#connectrequest) by posting a JSON body to a streaming endpoint. 

## Supported data formats

JSON

## Ping

Centrifugo will send different message types to a connection. Every message is JSON encoded. A special JSON value `null` used as a PING message. You can simply ignore it on a client side upon receiving. You can ignore such messages or use them to detect broken connections (nothing received from a server for a long time).

## `uni_http_stream`

### `uni_http_stream.enabled`

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

### `uni_http_stream.max_request_body_size`

Default: 65536 (64KB)

Maximum allowed size of a initial HTTP POST request in bytes.

## Example connect with CURL

Let's look how simple it is to connect to Centrifugo using HTTP streaming.

We will start from scratch, generate new configuration file:

```
centrifugo genconfig
```

Turn on uni HTTP stream and automatically subscribe users to personal channel upon connect:

```json title="config.json"
{
  "client": {
    "token": {
      "hmac_secret_key": "secret"
    },
    "subscribe_to_user_personal_channel": {
      "enabled": true
    }
  },
  "uni_http_stream": {
    "enabled": true
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

It's possible to connect to HTTP-streaming from web browser and use Readable Streams API to process incoming messages.

Here is an example using `fetch` and using Readable Streams API to parse new line delimited JSON messages:

```javascript
const token = 'CENTRIFUGO_JWT_TOKEN_HERE';

fetch('http://localhost:8000/connection/uni_http_stream', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token })
})
    .then(response => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        function read() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    console.log('Stream complete');
                    return;
                }

                // Decode the new chunk and append to the buffer.
                buffer += decoder.decode(value, { stream: true });

                // Split the buffer on newlines.
                const lines = buffer.split('\n');

                // The last element may be an incomplete message; keep it in the buffer.
                buffer = lines.pop();

                // Process each complete line.
                for (const line of lines) {
                    if (!line.trim()) continue; // Skip empty lines (e.g., ping messages could be null)

                    try {
                        const message = JSON.parse(line);
                        // Process your message here.
                        console.log('Received message:', message);
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                    }
                }

                // Continue reading the next chunk.
                read();
            });
        }

        read();
    })
    .catch(error => {
        console.error('Fetch error:', error);
    });
```

How it works:

* **Fetch request**: a POST request is sent to the Centrifugo uni HTTP stream endpoint with the JWT token in the body. As always, if you are using [connect proxy](../server/proxy.md#connect-proxy) – then you can go without JWT for authentication. Same concepts as for bidirectional connection here.
* **Readable Stream**: the response's body is a `ReadableStream`. We obtain a reader via `response.body.getReader()`.
* **Buffer and Decoding**: Data chunks are decoded into a string and appended to a buffer. The buffer is split by newline characters to get complete JSON messages.
* **Processing Lines**: Each complete line is parsed using JSON.parse. You can handle parsed [push messages](./uni_client_protocol.md#unidirectional-pushes) as needed.
* **Recursive Read**: The function read continues to pull new data until the stream is complete.
