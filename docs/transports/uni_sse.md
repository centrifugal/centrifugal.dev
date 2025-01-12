---
id: uni_sse
title: Unidirectional SSE (EventSource)
sidebar_label: SSE (EventSource)
---

[Server-Sent Events or EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) is a well-known HTTP-based transport available in all modern browsers and loved by many developers. 

Can be enabled using:

```json title=config.json
{
  "uni_sse": {
    "enabled": true
  }
}
```

Default unidirectional SSE (EventSource) connection endpoint in Centrifugo is:

```
/connection/uni_sse
```

:::info

Only parts of EventSource spec that make sense for Centrifugo are implemented. For example `Last-Event-Id` header not supported (since one connection can be subscribed to many channels) and multiline strings (since we are passing JSON-encoded objects to the client) etc.

:::

## Connect command

Unfortunately SSE specification does not allow POST requests from a web browser, so the only way to pass initial connect command is over URL params. Centrifugo is looking for `cf_connect` URL param for connect command. Connect command value expected to be a JSON-encoded string, properly encoded into URL. For example:

```javascript
const url = new URL('http://localhost:8000/connection/uni_sse');
url.searchParams.append("cf_connect", JSON.stringify({
    'token': '<JWT>'
}));

const eventSource = new EventSource(url);
```

Refer to the full Connect command description – it's [the same as for unidirectional WebSocket](./uni_websocket.md#connect-command).

The length of URL query should be kept less than 2048 characters to work throughout browsers. This should be more than enough for most use cases.  

:::tip

Centrifugo unidirectional SSE endpoint also supports POST requests. While it's not very useful for browsers which only allow GET requests for EventSource this can be useful when connecting from a mobile device. In this case you must send the connect object as a JSON body of a POST request (instead of using `cf_connect` URL parameter), similar to what we have in unidirectional HTTP streaming transport case.

:::

## Supported data formats

JSON

## Options

### uni_sse.enabled

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

### uni_sse.max_request_body_size

Default: 65536 (64KB)

Maximum allowed size of a initial HTTP POST request in bytes when using HTTP POST requests to connect (browsers are using GET so it's not applied).

## Browser example

Coming soon.
