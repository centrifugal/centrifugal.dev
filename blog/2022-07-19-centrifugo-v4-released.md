---
title: Centrifugo v4 released – a little revolution
tags: [centrifugo, release]
description: Centrifugo v4 provides an optimized client protocol, modern WebSocket emulation, improved channel security, redesigned client SDK behavior, experimental HTTP/3 and WebTransport support.
author: Centrifugal team
authorTitle: Let the Centrifugal force be with you
authorImageURL: /img/logo_animated.svg
image: /img/v4.jpg
hide_table_of_contents: false
---

![Centrifuge](/img/v4.jpg)

Today we are excited to announce the next generation of Centrifugo – Centrifugo v4. The release takes Centrifugo to the next level in terms of client protocol performance, WebSocket fallback simplicity, SDK ecosystem and channel security model. It also comes with a couple of cutting-edge technologies to experiment with such as HTTP/3 and WebTransport.

<!--truncate-->

:::info About Centrifugo

If you've never heard of Centrifugo before, it's an open-source scalable real-time messaging server written in Go language. Centrifugo can instantly deliver messages to application online users connected over supported transports (WebSocket, HTTP-streaming, SSE/EventSource, GRPC, SockJS). Centrifugo has the concept of a channel – so it's a user-facing PUB/SUB server.

Centrifugo is language-agnostic and can be used to build chat apps, live comments, multiplayer games, real-time data visualizations, collaborative tools, etc. in combination with any backend. It is well suited for modern architectures and allows decoupling the business logic from the real-time transport layer.

Several official client SDKs for browser and mobile development wrap the bidirectional protocol. In addition, Centrifugo supports a unidirectional approach for simple use cases with no SDK dependency.

:::

## Centrifugo v3 flashbacks

Let's start from looking back a bit. Centrifugo v3 was released last year. It had a great list of improvements – like unidirectional transports support (EventSource, HTTP-streaming and GRPC), GRPC transport for proxy, history iteration API, faster JSON protocol, super-fast but experimental Tarantool engine implementation, and others.

During the Centrifugo v3 lifecycle we added even more JSON protocol optimizations and introduced a granular proxy mode. Experimental Tarantool engine has also evolved a bit.

But Centrifugo v3 did not contain anything... let's say **revolutional**. Revolutional for Centrifugo itself, community, or even the entire field of open-source real-time messaging.

With this release, we feel that we bring innovation to the ecosystem. Now let's talk about it and introduce all the major things of the brand new v4 release.

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/v4_logo.mp4"></video>

## Unified client SDK API

The most challenging part of Centrifugo project is not a server itself. Client SDKs are the hardest part of the ecosystem. We try to time additional improvements to the SDKs with each major release of the server. But this time the SDKs are the centerpiece of the v4 release.

Centrifugo uses bidirectional asynchronous protocol between client and server. On top of this protocol SDK provides a request-response over an asynchronous connection, reconnection logic, subscription management and multiplexing, timeout and error handling, ping-pong, token refresh, etc. Some of these things are not that trivial to implement. And all this should be implemented in different programming languages. As you may know, we have official real-time SDKs in Javascript, Dart, Swift, Java and Go.

While implementing the same protocol and same functions, all SDKs behaved slightly differently. That was the result of the missing SDK specification. Without a strict SDK spec, it was hard to document things, hard to explain the exact details of the real-time SDK behavior. What we did earlier in the Centrifugo documentation – was pointing users to specific SDK Github repo to look for behaviour details.

The coolest thing about Centrifugo v4 is the next generation SDK API. We now have a [client SDK API specification](/docs/transports/client_api). It's a source of truth for SDKs behavior which try to follow the spec closely.

The new SDK API is the result of several iterations and reflections on possible states, transitions, token refresh mechanism, etc. Users in our Telegram group may remember how it all started:

![Centrifugo scheme](/img/states_prototype.jpg)

And after several iterations these prototypes turned into working mechanisms with well-defined behaviour:

![Centrifugo scheme](/img/client_state.png)

A few things that have been revised from the ground up:

* Client states, transitions, events
* Subscription states, transitions, events
* Connection and subscription token refresh behavior
* Ping-pong behavior (see details below)
* Resubscribe logic (SDKs can now resubscribe with backoff)
* Error handling
* Unified backoff behavior (based on [full jitter technique](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)) 

We now also have a separation between temporary and non-temporary protocol errors – this allows us to handle subscription internal server errors on the SDK level, making subscriptions more resilient, with automatic resubscriptions, and to ensure individual subscription failures do not affect the entire connection.

The mechanics described in the client SDK API specification are now implemented in all of our official SDKs. The SDKs now support all major client protocol features that currently exist. We believe this is a big step forward for the Centrifugo ecosystem and community.

## Modern WebSocket emulation in Javascript

WebSocket is supported almost everywhere these days. But there is a case that we believe is the last one preventing users to connect over WebSocket - corporate proxies. With the root certificate installed on employee computer machines, these proxies can block WebSocket traffic, even if it's wrapped in a TLS layer. That's really annoying, and often developers choose to not support clients connecting from such "broken" environments at all.

Prior to v4, Centrifugo users could use the SockJS polyfill library to fill this gap.

SockJS is great software – stable and field proven. It is still used by some huge real-time messaging players out there to polyfill the WebSocket transport.

But SockJS is an extra frontend dependency with a bunch of legacy transports, and [the future of it is unknown](https://github.com/sockjs/sockjs-client/issues/592).

SockJS comes with a notable overhead – it's an aditional protocol wrapper, consumes more memory per connection on a server (at least when using SockJS-Go library – the only choice for implementing SockJS server in Go language these days). When using SockJS, Centrifugo users were losing the ability to use our main pure WebSocket transport because SockJS uses its own WebSocket implementation on a server side.

SockJS does not support binary data transfer – only JSON format can be used with it. As you know, our main WebSocket transport works fine with binary in case of using Protobuf protocol format. So with SockJS we don't have fallback for WebSocket with a binary data transfer.

And finally, if you want to use SockJS with a distributed backend, you must enable sticky session support on the load-balancer level. This way you can point requests from the client to the server to the correct server node – the one which maintains a persistent unidirectional HTTP connection.

We danced around the idea of replacing SockJS for a long time. But only now we are ready to provide our alternative to it – meet Centrifugo own **bidirectional emulation layer**. It's based on two additional transports:

* HTTP-streaming (using modern browser [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) in JavaScript, supports both binary Protobuf and JSON transfer)
* Eventsource (Server-Sent Events, SSE) – while a bit older choice and works with JSON only EventSource transport is loved by many developers and can provide fallback in slightly older browsers which don't have ReadableStream, so we implemented bidirectional emulation with it too.

So when the fallback is used, you always have a real-time, persistent connection in server -> to -> client direction. Requests in client -> to -> server direction are regular HTTP – similar to how SockJS works. But our bidirectional emulation layer does not require sticky sessions – Centrifugo can proxy client-to-server requests to the correct node in the cluster. **Having sticky sessions is an optimization** for Centrifugo bidirectional emulation layer, **not a requirement**. We believe that this is a game changer for our users – no need to bother about proper load balancing, especially since in most cases 95% or even more users will be able to connect using the WebSocket transport.

Here is a simplified diagram of how it works:

![Scheme](/img/emulation_scheme.png)

The bidirectional emulation layer is only supported by the Javascript SDK (`centrifuge-js`) – as we think fallbacks mostly make sense for browsers. If we find use cases where other SDKs can benefit from HTTP based transport – we can expand on them later.

Let's look at example of using this feature from the Javascript side. To use fallbacks, all you need to do is to set up a list of desired transports with endpoints:

```javascript
const transports = [
    {
        transport: 'websocket',
        endpoint: 'wss://your_centrifugo.com/connection/websocket'
    },
    {
        transport: 'http_stream',
        endpoint: 'https://your_centrifugo.com/connection/http_stream'
    },
    {
        transport: 'sse',
        endpoint: 'https://your_centrifugo.com/connection/sse'
    }
];
const centrifuge = new Centrifuge(transports);
centrifuge.connect()
```

:::note

We are using explicit transport endpoints in the above example due to the fact that transport endpoints can be configured separately in Centrifugo – there is no single entry point for all transports. Like the one in Socket.IO or SockJS when developer can only point client to the base address. In Centrifugo case, we are requesting an explicit transport/endpoint configuration from the SDK user.

:::

By the way, a few advantages of HTTP-based transport over WebSocket:

* Sessions can be automatically multiplexed within a single connection by the browser when the server is running over HTTP/2, while with WebSocket browsers open a separate connection in each browser tab
* Better compression support (may be enabled on load balancer level)
* WebSocket requires special configuration in some load balancers to get started (ex. Nginx)

SockJS is still supported by Centrifugo and `centrifuge-js`, but it's now DEPRECATED.

## No layering in client protocol

Not only the API of client SDK has changed, but also the format of Centrifugo protocol messages. New format is more human-readable (in JSON case, of course), has a more compact ping message size (more on that below).

The client protocol is now one-shot encode/decode compatible. Previously, Centrifugo protocol had a layered structure and we had to encode some messages before appending them to the top-level message. Or decode two or three times to unwrap the message envelope. To achieve good performance when encoding and decoding client protocol messages, Centrifugo had to use various optimization techniques – like buffer memory pools, byte slice memory pools.

By restructuring the message format, we were able to avoid layering, which allowed us to slightly increase the performance of encoding/decoding without additional optimization tricks.

![Scheme](/img/avoid_protocol_nesting.png)

We also simplified the [client protocol](/docs/transports/client_protocol) documentation overview a bit.

## Redesigned PING-PONG

In many cases in practice (when dealing with persistent connections like WebSocket), pings and pongs are the most dominant types of messages passed between client and server. Your application may have many concurrent connections, but only a few of them receive the useful payload. But at the same time, we still need to send pings and respond with pongs. Thus, optimizing the ping-pong process can significantly reduce server resource usage.

One optimization comes from the revised PING-PONG behaviour. Previous versions of Centrifugo and SDKs sent ping/pong in both "client->to->server" and "server->to->client" directions (for WebSocket transport). This allowed finding non-active connections on both client and server sides.

In Centrifugo v4 we only send pings from a server to a client and expect pong from a client. On the client-side, we have a timer which fires if there hasn't been a ping from the server within the configured time, so we still have a way to detect closed connections.

Sending pings only in one direction results in 2 times less ping-pong messages - and this should be really noticable for Centrifugo installations with thousands of concurrent connections. In our experiments with 10k connections, server CPU usage was reduced by 30% compared to Centrifugo v3.

![Scheme](/img/ping_pong_v3_v4.png)

Pings and pongs are application-level messages. Ping is just an empty asynchronous reply – for example in JSON case it's a 2-byte message: `{}`. Pong is an empty command – also, `{}` in JSON case. Having application-level pings from the server also allows unifying the PING format for all unidirectional transports.

Another improvement is that Centrifugo now randomizes the time it sends first ping to the client (but no longer than the configured ping interval). This allows to spread ping-pongs in time, providing a smoother CPU profile, especially after a massive reconnect scenario.

## Secure by default channel namespaces

Data security and privacy are more important than ever in today's world. And as Centrifugo becomes more popular and widely used, the need to be `secure by default` only increases. 

Previously, by default, clients could subcribe to all channels in a namespace (except private channels, which are now revised – see details below). It was possible to use `"protected": true` option to make namespace protected, but we are not sure if everyone did that. This is extra configuration and additional knowledge on how Centrifugo works.

Also, a common confusion we ran into: if server-side subscriptions were dictated by a connection JWT, many users would expect client-side subscriptions to those channels to not work. But without the `protected` option enabled, this was not the case.

In Centrifugo v4, by default, it is not possible to subscribe to a channel in a namespace. The namespace must be configured to allow subscriptions from clients, or token authorization must be used. There are a bunch of new namespace options to tune the namespace behavior. Also the ability to provide a regular expression for channels in the namespace.

The new permission-related channel option names better reflect the purpose of the option. For example, compare `"publish": true` and `"allow_publish_for_client": true`. The second one is more readable and provides a better understanding of the effect once turned on.

Centrifugo is now more strict when checking channel name. Only ASCII symbols allowed – it was already mentioned in docs before, but wasn't actually enforced. Now we are fixing this.

We understand that these changes will make running Centrifugo more of a challenge, especially when all you want is a public access to all the channels without worrying too much about permissions. It's still possible to achieve, but now the intent must be expicitly expressed in the config.

Check out the updated documentation about [channels and namespaces](/docs/server/channels). Our v4 migration guide contains an **automatic converter** for channel namespace options.

## Private channel concept revised

A private channel is a special channel starting with `$` that could not be subscribed to without a subscription JWT. Prior to v4, having a known prefix allowed us to distinguish between public channels and private channels. But since namespaces are now non-public by default, this distinction is not really important.

This means 2 things:

* it's now possible to subscribe to any channel by having a valid subscription JWT (not just those that start with `$`)
* channels beginning with `$` can only be subscribed with a subscription JWT, even if they belong to a namespace where subscriptions allowed for all clients. This is for security compatibility between v3 and v4.

Another notable change in a subscription JWT – `client` claim is now DEPRECATED. There is no need to put it in the subscription token anymore. Centrifugo supports it only for backwards compatibility, but it will be completely removed in the future releases.

The reason we're removing `client` claim is actually interesting. Due to the fact that `client` claim was a required part of the subscription JWT applications could run into a situation where during the [massive reconnect scenario](/blog/2020/11/12/scaling-websocket#massive-reconnect) (say, million connections reconnect) many requests for new subscription tokens can be generated because the subscription token must contain the client ID generated by Centrifugo for the new connection. That could make it unusually hard for the application backend to handle the load. With a connection JWT we had no such problem – as connections could simply reuse the previous token to reconnect to Centrifugo.

Now the subscription token behaves just like the connection token, so we get a scalable solution for token-based subscriptions as well.

What's more, this change paved the way for another big improvement...

## Optimistic subscriptions

The improvement we just mentioned is called optimistic subscriptions. If any of you are familiar with the [QUIC](https://en.wikipedia.org/wiki/QUIC) protocol, then optimistic subscriptions are somewhat similar to the 0-RTT feature in QUIC. The idea is simple – we can include subscription commands to the first frame sent to the server.

Previously, we sent subscriptions only after receiving a successful Connect Reply to a Connect Command from a server. But with the new changes in token behaviour, it seems so logical to put subscribe commands within the initial connect frame. Especially since Centrifugo protocol always supported batching of commands. Even token-based subscriptions can now be included into the initial frame during reconnect process, since the previous token can be reused now.

![](/img/optimistic_subs.png)

The benefit is awesome – in most scenarios, we save one RTT of latency when connecting to Centrifugo and subscribing to channels (which is actually the most common way to use Centrifugo). While not visible on localhost, this is pretty important in real-life. And this is less syscalls for the server after all, resulting in less CPU usage.

Optimistic subscriptions are also great for bidirectional emulation with HTTP, as they avoid the long path of proxying a request to the correct Centrifugo node when connecting.

Optimistic subscriptions are now only part of `centrifuge-js`. At some point, we plan to roll out this important optimization to all other client SDKs.

## Channel capabilities

The channel capabilities feature is introduced as part of [Centrifugo PRO](/docs/pro/overview). Initially, we aimed to make it a part of the OSS version. But the lack of feedback on this feature made us nervous it's really needed. So adding it to PRO, where we still have room to evaluate the idea, seemed like the safer decision at the moment.

Centrifugo allows configuring channel permissions on a per-namespace level. When creating a new real-time feature, it is recommended to create a new namespace for it and configure permissions. But to achieve a better channel permission control within a namespace the Channel capabilities can be used now.

The channel capability feature provides a possibility to set capabilities on an individual connection basis, or an individual channel subscription basis.

For example, in a connection JWT developers can set sth like:

```json
{
    "caps": [
        {
            "channels": ["news", "user_42"],
            "allow": ["sub"]
        }
    ]
}
```

And this tells Centrifugo that the connection is able to subscribe on channels `news` or `user_42` using client-side subscriptionsat any time while the connection is active. Centrifugo also supports wildcard and regex channel matches.

Subscription JWT can provide capabilities for the channel too, so permissions may be controlled on an individual subscription basis, ex. the ability to publish and call history API may be expressed with `allow` claim in subscription JWT:

```json
{
    "allow": ["pub", "hst"]
}
```

Read more about this mechanism in [Channel capabilities](/docs/pro/capabilities) chapter.

## Better connections API

Another addition to Centrifugo PRO is the improved [connection API](/docs/pro/connections). Previously, we could only return all connections from a specific user. 

The API now supports filtering all connections: by user ID, by subscribed channel, by additional meta information attached to the connection.

The filtering works by user ID or with a help of [CEL expressions](https://opensource.google/projects/cel) (Common Expression Language). CEL expressions provide a developer-friendly, fast and secure (as they are not Turing-complete) way to evaluate some conditions. They are used in some Google services (ex. Firebase), in Envoy RBAC configuration, etc. If you've never seen it before – take a look, cool project. We are also evaluating how to use CEL expressions for a dynamic and efficient channel permission checks, but that's an early story.

The `connections` API call result contains more useful information: a list of client's active channels, information about the tokens used to connect and subscribe, meta information attached to the connection.

## Javascript client moved to TypeScript

It's no secret that `centrifuge-js` is the most popular SDK in the Centrifugo ecosystem. We put additional love to it – and `centrifuge-js` is now fully written in Typescript ❤️

This was a long awaited improvement, and it finally happened! The entire public API is strictly typed. The cool thing is that even `EventEmitter` events and event handlers are the subject to type checks - this should drastically simplify and speedup development and also help to reduce error possibility.

## Experimenting with HTTP/3

Centrifugo v4 has an **experimental** [HTTP/3](https://en.wikipedia.org/wiki/HTTP/3) support. Once TLS is enabled and `"http3": true` option is set all the endpoints on an external port will be served by a HTTP/3 server based on [lucas-clemente/quic-go](https://github.com/lucas-clemente/quic-go) implementation.

It's worth noting that WebSocket will still use HTTP/1.1 for its Upgrade request (there is an interesting IETF draft BTW about [Bootstrapping WebSockets with HTTP/3](https://www.ietf.org/archive/id/draft-ietf-httpbis-h3-websockets-02.html)). But HTTP-streaming and EventSource should work just fine with HTTP/3.

HTTP/3 does not currently work with our ACME autocert TLS - i.e. you need to explicitly provide paths to cert and key files [as described here](/docs/server/tls#using-crt-and-key-files).

## Experimenting with WebTransport

Having HTTP/3 on board allowed us to make one more thing. Some of you may remember the post [Experimenting with QUIC and WebTransport](/blog/2020/10/16/experimenting-with-quic-transport) published in our blog before. We danced around the idea to add [WebTransport](https://web.dev/webtransport/) to Centrifugo since then. [WebTransport IETF specification](https://datatracker.ietf.org/doc/draft-ietf-webtrans-http3/) is still a draft, it changed a lot since our first blog post about it. But WebTransport object is already part of Chrome (since v97) and things seem to be very close to the release.

So we added experimental WebTransport support to Centrifugo v4. This is made possible with the help of the [marten-seemann/webtransport-go](https://github.com/marten-seemann/webtransport-go) library.

To use WebTransport you need to run HTTP/3 experimental server and enable WebTransport endpoint with `"webtransport": true` option in the configuration. Then you can connect to that endpoint using `centrifuge-js`. For example, let's enable WebTransport and use WebSocket as a fallback option:

```javascript
const transports = [
    {
        transport: 'webtransport',
        endpoint: 'https://your_centrifugo.com/connection/webtransport'
    },
    {
        transport: 'websocket',
        endpoint: 'wss://your_centrifugo.com/connection/websocket'
    }
];
const centrifuge = new Centrifuge(transports);
centrifuge.connect()
```

Note, that we are using secure schemes here – `https://` and `wss://`. While in WebSocket case you could opt for non-TLS communication, in HTTP/3 and specifically WebTransport non-TLS communication is simply not supported by the specification.

In Centrifugo case, we utilize the bidirectional reliable stream of WebTransport to pass our protocol between client and server. Both JSON and Protobuf communication formats are supported. There are some issues with the proper passing of the disconnect advice in some cases, otherwise it's fully functional.

Obviously, due to the limited WebTransport support in browsers at the moment, possible breaking changes in the WebTransport specification we can not recommended it for production usage for now. At some point in the future, it may become a reasonable alternative to WebSocket, now we are more confident that Centrifugo will be able to provide a proper support of it.

## Migration guide

The [migration guide](/docs/getting-started/migration_v4) contains steps to upgrade your Centrifugo from version 3 to version 4. While there are many changes in the v4 release, it should be possible to migrate to Centrifugo v4 without changing the code on the client side at all. And then, after updating the server, gradually update the client-side to the latest version of the stack.

## Conclusion

![](/img/bg_cat.jpg)

To sum it up, here are some benefits of Centrifugo v4:

* unified experience thoughout application frontend environments
* an optimized protocol which is generally faster, more compact and human-readable in JSON case, provides more resilient behavior for subscriptions
* revised channel namespace security model, more granular permission control
* more efficient and flexible use of subscription tokens
* better initial latency – thanks to optimistic subscriptions and the ability to pre-create subscription tokens (as the `client` claim not needed anymore)
* the ability to use more efficient WebSocket bidirectional emulation in the browser without having to worry about sticky sessions, unless you want to optimize the real-time infrastructure

That's it. We now begin the era of v4 and it is going to be awesome, no doubt.

## Join community

The release contains many changes that strongly affect developing with Centrifugo. And of course you may have some questions or issues regarding new or changed concepts. Join our communities in Telegram (the most active) and Discord:

[![Join the chat at https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ](https://img.shields.io/badge/Telegram-Group-orange?style=flat&logo=telegram)](https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ) &nbsp;[![Join the chat at https://discord.gg/tYgADKx](https://img.shields.io/discord/719186998686122046?style=flat&label=Discord&logo=discord)](https://discord.gg/tYgADKx)

Enjoy Centrifugo v4, and let the Centrifugal force be with you.

## Special thanks

The refactoring of client SDKs and introducing unified behavior based on the common spec was the hardest part of Centrifugo v4 release. Many thanks to [Vitaly Puzrin](https://github.com/puzrin) (who is the author of several popular open-source libraries such as [markdown-it](https://github.com/markdown-it/markdown-it), [fontello](https://github.com/fontello/fontello), and others). We had a series of super productive sessions with him on client SDK API design. Some great ideas emerged from these sessions and the result seems like a huge step forward for Centrifugal projects.

Also, thanks to [Anton Silischev](https://github.com/silischev) who helped a lot with WebTransport prototypes earlier this year, so we could quickly adopt WebTransport for v4.

:::tip

As some of you know, Centrifugo server is built on top of the [Centrifuge](https://github.com/centrifugal/centrifuge) library for Go. Most of the optimizations and improvements described here are now also part of Centrifuge library.

With its new unified SDK behavior and bidirectional emulation layer, it seems a solid alternative to Socket.IO in the Go language ecosystem.

In some cases, Centrifuge library can be a more flexible solution than Centrifugo, since Centrifugo (as a standalone server) dictates some mechanics and rules that must be followed. In the case of Centrifugo, the business logic must live on the application backend side, with Centrifuge library it can be kept closer to the real-time transport layer.

:::

:::note Attributions

This post used images from freepik.com: [background](https://www.freepik.com/free-vector/abstract-background-consisting-colorful-arcs-illustration_14803794.htm#&position=5&from_view=author) by [liuzishan](https://www.freepik.com/author/liuzishan). Also [image](https://www.freepik.com/free-vector/abstract-black-circles-layers-dark-background-paper-cut_17303270.htm) by [kenshinstock](https://www.freepik.com/author/kenshinstock).

:::
