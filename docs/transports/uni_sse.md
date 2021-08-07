---
id: uni_sse
title: Unidirectional SSE (Eventsource)
sidebar_label: SSE (Eventsource)
---

Default unidirectional SSE (Eventsource) connection endpoint in Centrifugo is:

```
/connection/uni_sse
```

:::note

Only parts of Eventsource spec that make sense for Centrifugo are implemented. For example `Last-Event-Id` header not supported (since one connection can be subscribed to many channels) and multiline strings (since we are passing JSON-encoded objects to the client) etc.

:::

## Connect command

Unfortunately SSE specification does not allow POST requests from a web browser, so the only way to pass initial connect command is over URL params. Centrifugo is looking for `connect` URL param for connect command. Connect command value expected to be a JSON-encoded string, properly encoded into URL. For example:

```javascript
const url = new URL('http://localhost:8000/connection/uni_sse');
url.searchParams.append("connect", JSON.stringify({
    'token': '<JWT>'
}));

const eventSource = new EventSource(url);
```

The length of URL query should be kept less than 2048 characters to work throughout browsers. This should be more than enough for most use cases.  

## Supported data formats

JSON

## Pings

Centrifugo sends SSE data like this as pings:

```
event: ping
data:
```

I.e. with event name `ping` and empty data.

## Options

### uni_sse

Boolean, default: `false`.

Enables unidirectional SSE (EventSource) endpoint.

```json title="config.json"
{
    ...
    "uni_sse": true
}
```

## Example

Coming soon.