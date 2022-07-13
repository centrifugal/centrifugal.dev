---
id: webtransport
title: WebTransport
---

WebTransport is an API offering low-latency, bidirectional, client-server messaging on top of HTTP/3. See [Using WebTransport](https://web.dev/webtransport/) article that gives a good overview of it.

:::danger

WebTransport support in Centrifugo is EXPERIMENTAL and not recommended for production usage. [WebTransport IETF specification](https://datatracker.ietf.org/doc/draft-ietf-webtrans-http3/) is not even finished yet.

:::

To use WebTransport you first need to run HTTP/3 experimental server and enable `webtransport` endpoint:

```json title="config.json"
{
    "http3": true,
    "tls": true,
    "tls_cert": "path/to/crt",
    "tls_key": "path/to/key",
    "webtransport": true
}
```

In HTTP3 and WebTransport case TLS is required.

:::tip

At the time of writing only Chrome supports WebTransport API. If you are experimenting with self-signed certificates you may need to run Chrome with flags to force HTTP/3 on origin and ignore certificate errors:

```
/path/to/your/Chrome --origin-to-force-quic-on=localhost:8000 --ignore-certificate-errors-spki-list=TSZTiMjLG+DNjESXdJh3f+S8C+RhsFCav7T24VNuCPQ=
```

Where the value of `--ignore-certificate-errors-spki-list` is a certificate fingerprint obtained this way:

```
openssl x509 -in server.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64
```

With not self-signed certs things should work just fine in Chrome.

:::

Then you can connect to that endpoint using `centrifuge-js`. For example, let's enable WebTransport and will use WebSocket as a fallback option:

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

:::tip

Make sure you run Centrifugo without load balancer or reverse proxy in front, or make sure your proxy can proxy HTTP/3 traffic to Centrifugo.

:::

In Centrifugo case, we utilize the bidirectional stream of WebTransport to pass our protocol between client and server. Both JSON and Protobuf communication are supported. There are some issues with the proper passing of the disconnect advice in some cases, otherwise it's fully functional.

Obviously, due to the limited WebTransport support in browsers at the moment, possible breaking changes in the WebTransport specification it's an **experimental** feature. And it's not recommended for production usage for now. At some point in the future it may become a reasonable alternative to WebSocket, now we are more confident that Centrifugo will be able to provide a proper support of it.
