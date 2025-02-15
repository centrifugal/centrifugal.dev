---
id: uni_sse
title: Unidirectional Server-Sent Events (SSE)
sidebar_label: Server-Sent Events (SSE)
---

[Server-Sent Events or EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) is a well-known HTTP-based transport available in all modern browsers (over `EventSource` object) and loved by many developers due to its simplicity.

## How to enable

```json title=config.json
{
  "uni_sse": {
    "enabled": true
  }
}
```

## Default endpoint

Default unidirectional SSE (EventSource) connection endpoint in Centrifugo is:

```
/connection/uni_sse
```

:::info

Only parts of EventSource spec that make sense for Centrifugo are implemented. For example `Last-Event-Id` header not supported (since one connection can be subscribed to many channels) and multiline strings (since we are passing JSON-encoded objects to the client) etc.

:::

## Send connect request

Unfortunately SSE specification does not allow POST requests from a web browser, so the only way to pass initial connect command is over URL params. Centrifugo is looking for `cf_connect` URL param for connect command. Connect command value expected to be a JSON-encoded string, properly encoded into URL. For example:

```javascript
const url = new URL('http://localhost:8000/connection/uni_sse');
url.searchParams.append("cf_connect", JSON.stringify({
    'token': '<JWT>'
}));

const eventSource = new EventSource(url);
```

Refer to the full [connect request description](./uni_client_protocol.md#connectrequest).

The length of URL query should be kept less than 2048 characters to work throughout browsers. This should be more than enough for most use cases.  

:::tip

Centrifugo unidirectional SSE endpoint also supports POST requests. While it's not very useful for browsers which only allow GET requests for EventSource this can be useful when connecting from a mobile device. In this case you must send the connect object as a JSON body of a POST request (instead of using `cf_connect` URL parameter), similar to what we have in unidirectional HTTP streaming transport case.

:::

## Supported data formats

JSON

## Ping

SSE data frame with `{}` is used as a ping.

For example, see how unidirectional SSE session may look like after initial establishment and which only receives periodic pings:

```bash
❯ curl http://localhost:8000/connection/uni_sse

data: {"connect":{"client":"c09d1965...","version":"0.0.0 OSS","subs":{"#2694":{}},"ping":25,"session":"1cf6d9f5..."}}

data: {}

data: {}

data: {}

```

## `uni_sse`

### `uni_sse.enabled`

Boolean, default: `false`.

Enables unidirectional SSE (EventSource) endpoint.

```json title="config.json"
{
    ...
    "uni_sse": {
        "enabled": true
    }
}
```

### `uni_sse.max_request_body_size`

Default: 65536 (64KB)

Maximum allowed size of a initial HTTP POST request in bytes when using HTTP POST requests to connect (browsers are using GET so it's not applied).

## Browser example

Here is an example of how to connect to Centrifugo unidirectional SSE endpoint from a browser:

```javascript
const url = new URL('http://localhost:8000/connection/uni_sse');
url.searchParams.append("cf_connect", JSON.stringify({
    'token': '<Centrifugo JWT>'
}))
const eventSource = new EventSource(url);
eventSource.onmessage = function(event) {
    console.log(event.data);
};
```

As always, if you are using [connect proxy](../server/proxy.md#connect-proxy) – then you can go without JWT for authentication. Same concepts as for bidirectional connection here.
