---
description: "SockJS transport in Centrifugo: HTTP-based WebSocket fallback with sticky sessions support. Removed in Centrifugo v6 — use modern alternatives."
id: sockjs
title: SockJS
---

:::danger

SockJS transport was **REMOVED** in Centrifugo v6.

:::

SockJS is a polyfill browser library which provides HTTP-based fallback transports in case when it's not possible to establish Websocket connection. This can happen in old client browsers or because of some proxy behind client and server that cuts of Websocket traffic. You can find more information on [SockJS project Github page](https://github.com/sockjs/sockjs-client).

If you have a requirement to work everywhere SockJS is the solution. SockJS will automatically choose best fallback transport if Websocket connection failed for some reason. Some of the fallback transports are:

* EventSource (SSE)
* XHR-streaming
* Long-polling
* And more (see [SockJS docs](https://github.com/sockjs/sockjs-client))

SockJS connection endpoint in Centrifugo is:

```
/connection/sockjs
```

## SockJS caveats

:::caution

There are several important caveats to know when using SockJS – see below.

:::

### Sticky sessions

First is that you need to use sticky sessions mechanism if you have **more than one** Centrifugo nodes running behind a load balancer. This mechanism usually supported by load balancers (for example Nginx). Sticky sessions mean that all requests from the same client will come to the same Centrifugo node. This is necessary because SockJS maintains connection session in process memory thus allowing bidirectional communication between a client and a server. Sticky mechanism not required if you only use one Centrifugo node on a backend.

For example, with Nginx sticky support can be enabled with `ip_hash` directive for upstream:

```
upstream centrifugo {
    ip_hash;
    server 127.0.0.1:8000;
    server 127.0.0.2:8000;
}
```

With this configuration Nginx will proxy connections with the same ip address to the same upstream backend.

But `ip_hash;` is not the best choice in this case, because there could be situations
where a lot of different connections are coming with the same IP address (behind proxies)
and the load balancing system won't be fair.

So the best solution would be using something like [nginx-sticky-module](https://bitbucket.org/nginx-goodies/nginx-sticky-module-ng/overview) which uses setting a special cookie to track the upstream server for a client.

### Browser only

SockJS is only supported by centrifuge-js – i.e. our browser client. There is no much sense to use SockJS outside of a browser these days.

### JSON only

One more thing to be aware of is that SockJS does not support binary data, so there is no option to use Centrifugo Protobuf protocol on top of SockJS (unlike WebSocket). Only JSON payloads can be transferred.

## Options

### sockjs

Boolean, default: `false`.

Enables SockJS transport.

### sockjs_url

Default: `https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js`

Link to SockJS url which is required when iframe-based HTTP fallbacks are in use. 
