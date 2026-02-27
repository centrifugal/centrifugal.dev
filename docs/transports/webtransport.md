---
description: "Experimental WebTransport support in Centrifugo for low-latency bidirectional messaging over HTTP/3 and QUIC. Configuration and usage guide."
id: webtransport
title: WebTransport
---

WebTransport is an API offering low-latency, bidirectional, client-server messaging on top of [HTTP/3](https://developer.mozilla.org/en-US/docs/Glossary/HTTP_3) (with [QUIC](https://developer.mozilla.org/en-US/docs/Glossary/QUIC) under the hood). See [Using WebTransport](https://web.dev/webtransport/) article that gives a good overview of it.

:::danger

WebTransport support in Centrifugo is EXPERIMENTAL and not recommended for production usage. [WebTransport IETF specification](https://datatracker.ietf.org/doc/draft-ietf-webtrans-http3/) is not finished yet and may have breaking changes.

:::

To use WebTransport you first need to run HTTP/3 experimental server and enable `webtransport` endpoint:

```json title="config.json"
{
  "http_server": {
    "tls": {
      "enabled": true,
      "key_pem": "path/to/key",
      "cert_pem": "path/to/crt"
    },
    "http3": {
      "enabled": true
    }
  },
  "webtransport": {
    "enabled": true
  }
}
```

In HTTP/3 and WebTransport case TLS is required.

:::tip

At the time of writing only Chrome (since v97) supports WebTransport API. If you are experimenting with self-signed certificates you may need to run Chrome with flags to force HTTP/3 on origin and ignore certificate errors:

```
/path/to/your/Chrome --origin-to-force-quic-on=localhost:8000 --ignore-certificate-errors-spki-list=TSZTiMjLG+DNjESXdJh3f+S8C+RhsFCav7T24VNuCPQ=
```

Where the value of `--ignore-certificate-errors-spki-list` is a certificate fingerprint obtained this way:

```
openssl x509 -in server.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64
```

With not self-signed certs things should work just fine in Chrome.

Here is a video tutorial that shows this in action:

<iframe width="560" height="315" src="https://www.youtube.com/embed/RmhggpXPncU" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>

:::

After starting Centrifugo with HTTP/3 and WebTransport endpoint you can connect to that endpoint (by default – `/connection/webtransport`) using `centrifuge-js`. For example, let's enable WebTransport and will use WebSocket as a fallback option:

```javascript
const transports = [
    {
        transport: 'webtransport',
        endpoint: 'https://localhost:8000/connection/webtransport'
    },
    {
        transport: 'websocket',
        endpoint: 'wss://localhost:8000/connection/websocket'
    }
];
const centrifuge = new Centrifuge(transports);
centrifuge.connect()
```

Note, that we are using secure schemes here – `https://` and `wss://`. While in WebSocket case you could opt for non-TLS communication, in WebTransport case non-TLS `http://` scheme is simply not supported by the specification.

Also, Chrome may not automatically close WebTransport sessions upon browser window reload, so consider adding:

```javascript
addEventListener("beforeunload", (event) => { centrifuge.disconnect() });
```

:::tip

Make sure you run Centrifugo without load balancer or reverse proxy in front, or make sure your proxy can proxy HTTP/3 traffic to Centrifugo.

:::

In Centrifugo case, we utilize a single bidirectional stream of WebTransport to pass our protocol between client and server. Both JSON and Protobuf communication are supported. There are some issues with the proper passing of the disconnect advice in some cases, otherwise it's fully functional.

Obviously, due to the limited WebTransport support in browsers at the moment, possible breaking changes in the WebTransport specification it's an **experimental** feature. And it's not recommended for production usage for now. At some point in the future, it may become a reasonable alternative to WebSocket.
