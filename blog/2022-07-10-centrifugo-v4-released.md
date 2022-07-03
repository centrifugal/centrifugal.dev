---
title: Centrifugo v4 released
tags: [centrifugo, release]
description: Centrifugo v4 released – providing modern bidirectional emulation layer, improved channel security, and redesigned client SDK behavior.
author: Centrifugal team
authorTitle: Let the Centrifugal force be with you
authorImageURL: /img/logo_animated.svg
image: /img/v3_blog.jpg
hide_table_of_contents: false
draft: true
---

![Centrifuge](/img/v4.jpg)

Today we are happy to announce the next generation of Centrifugo – Centrifugo v4. The release puts Centrifugo to the next level in terms of client protocol performance, WebSocket fallback simplicity, SDK ecosystem and channel security model.

<!--truncate-->

If you've never heard about Centrifugo before – it's a scalable **soft real-time messaging** server written in Go language. It can deliver messages to online application users super-fast. It has channel concept – so it's actually a **user-facing PUB/SUB server**. Centrifugo is **language-agnostic** and can be used to implement chat applications, live comments, multiplayer games, streaming metrics, etc in conjunction with any backend. It's especially useful when your backend does not have built-in concurrency support or dealing with many persistent connections is a challenge you are not going to take part in. Centrifugo has a **variety of real-time transports** and several official client SDKs for popular application environments (for **browser and mobile development**).

## Centrifugo v3 flashbacks

Let's start from looking back a bit. Centrifugo v3 was released last year. It had a great list of improvements – like unidirectional transports support (EventSource, HTTP-streaming and GRPC), GRPC transport for proxy, history iteration API, faster JSON protocol, super-fast but experimental Tarantool engine implementation, and others.

![Centrifuge](/img/v3_blog.jpg)

During Centrifugo v3 lifecycle we added even more JSON protocol optimizations and introduced a granular proxy mode. Experimental Tarantool engine evolved a bit also.

But Centrifugo v3 did not contain nothing... let's say **revolutional**. Revolutional for Centrifugo itself, community, or even for the entire open-source real-time messaging area.

In this release we feel that the revolution in some aspects had happened. Let's talk about it and introduce all the major things of v4 release.

## Unified client SDK API

The most difficult part of Centrifugo project is not a server itself. Client SDKs – that's the hardest thing in the ecosystem. We are trying to time the additional improvements in SDKs to the every major release of a server. But this time SDKs are the central part of v4 release.

Centrifugo uses bidirectional asynchronous protocol between a client and a server. This protocol provides reconnection logic, subscription multiplexing, timeout and error handling, ping-pong and token refresh. And all these things should be implemented in different programming languages. As you may know we have official SDKs in Javascript, Dart, Swift, Java and Go.

While implementing the same protocol all SDKs behaved in a slightly different way. That was the result of missing SDK specification. Without strict SDK spec it was hard to document things, hard to explain exact details of SDK behavior. What we did before in Centrifugo docs – pointed users to SDK Github repo to look for behaviour details.

The most exciting thing about Centrifugo v4 is a new generation of SDK API. We now have an [client SDK API specification](/docs/next/transports/client_api). It's a source of truth for SDKs behavior which try to follow the spec closely.

New SDK API is a result of several iterations and thinking on possible states, transitions, token refresh API, etc. Users in our Telegram group may remember how it started:

![Centrifugo scheme](/img/states_prototype.jpg)

And after several iterations those prototypes transformed into working mechanisms with well-defined behaviour:

![Centrifugo scheme](/img/client_state.png)

A few things that have been revised from scratch:

* Client states, transitions, events
* Subscription states, transitions, events
* Connection and subscription token refresh behavior
* Ping-pong behavior (see details below)
* Resubscribe logic (SDKs can now resubscribe with backoff)
* Error handling
* Unified backoff behavior (based on [full jitter technique](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)) 

We now have a separation between temporary and non-temporary prrotocol errors – this allows handling internal server errors during subscribing making subscriptions more resilient with automatic resubscribtions and make individual subscription failures to not affect the entire connection.  

The mechanics described in the client SDK API spec is now implemented by all our official SDKs. SDKs now support all the core client protocol features existing at this point – without exception. We believe this is a great step forward for Centrifugo ecosystem and community.

## Modern bidirectional emulation in Javascript

WebSocket is supported almost everywhere these days. But, there is a case which we believe is the last one preventing users to connect over WebSocket - corporate proxies. With installed root certificate on an employee's machines those proxies can block WebSocket traffic, even if it's wrapped into TLS layer. That's really annoying and often developers choose to not support clients connecting from such "broken" environments at all.

Till v4 Centrifugo users could use SockJS polyfill library to fill that gap.

SockJS is a great piece of software – stable and battle-tested. It's still used by some huge real-time messaging players out there for polyfilling WebSocket transport – for example, in [Spring](https://docs.spring.io/spring-framework/docs/4.3.x/spring-framework-reference/html/websocket.html#websocket-fallback).

But SockJS is rather old, it's an extra frontend dependency with a bunch of legacy transports, and [the future of it is undefined](https://github.com/sockjs/sockjs-client/issues/592).

SockJS comes with noticable overhead – it's an aditional protocol wrapper, has much bigger memory usage per connection on a server (at least when using SockJS-Go library – the only choice for implementing SockJS server in Go language these days). When using SockJS Centrifugo users were loosing the possibility to utilize our main pure WebSocket transport - as SockJS used its own WebSocket implementation.

SockJS does not support binary data transfer – only JSON format may be used with it.

And finally, if you want to use SockJS with distributed backend you must enable sticky session support on your load-balancer level. This way you can point requests from a client to a server to the correct server node – the one which keeps persistent unidirectional HTTP connection.

We were dancing around the idea to replace SockJS for a long time. But only now we are ready to provide our alternative to it – meet Centrifugo own **bidirectional emulation layer**. It's based on two additional transports:

* HTTP-streaming (using modern browser [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream), supports both binary Protobuf and JSON transfer)
* Eventsource (Server-Sent Events, SSE) – while a bit older choice and works with JSON only EventSource transport is loved by many developers, so we implemented bidirectional emulation with it too.

So when the fallback is used you always have a persistent real-time connection in server -> to -> client direction. Requests in client -> to -> server direction are ordinary HTTP – similar to how SockJS works. But our bidirectional emulation layer does not require sticky session at all – Centrifugo can proxy client-to-server requests to the correct node in a cluster. **Having sticky sessions is an optimization** for Centrifugo bidirectional emulation layer, **not a requirement**. We believe that this is a game changer – no need to bother about proper load balancing, especially due to the fact that in most cases 95% or even more users will be able to connect with WebSocket transport.

Here is a simplified scheme of how this works:

![Scheme](/img/emulation_scheme.png)

Bidirectional emulation layer supported only by Javascript SDK (`centrifuge-js`) – as we believe that fallbacks mostly make sense for browsers these days. If we find use cases where other SDKs can benefit from having HTTP-based transports – we can extend them later. At least several additional HTTP-based transport advantages over WebSocket:

* Sessions can be automatically multiplexed inside single connection by a browser when server works over HTTP/2
* Better compression support (may be enabled on load balancer level)
* WebSocket requires special configuration in some load balancers to start working (ex. Nginx)

To use fallbacks configure a list of desired transports with endpoints:

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

We are using explicit transport endpoints in the example above due to the fact that transport endpoints can be configured separately in Centrifugo – there is no single entry point for all transports. Like the one in Socket.IO or SockJS when developer can only point client to base address. In this case we ask for explicit endpoint configuration.

:::

SockJS is still supported by Centrifugo and `centrifuge-js`, but it's now DEPRECATED.

## No layering in client protocol

Not only API of client SDK has been changed, but also the format of Centrifugo protocol messages. New format is more human-readable (in JSON case, of course), has more compact ping message size (which is important as pings are usually the most frequently sent type of message).

And what is more important – the protocol is now one-shot encode/decode compatible. Previously Centrifugo protocol had layering and we had to encode some messages before appending them to a top layer message. Or decode two times to unwrap the message envelope. To achieve good performance Centrifugo had to use various optimization techniques – like buffer memory pools, byte slice memory pools. By re-structuring message format we were able to avoid layering – thus have even better encode/decode performance without additional optimization tricks.

![Scheme](/img/avoid_protocol_nesting.png)

We also simplified [client protocol](/docs/transports/client_protocol) docs overview a bit.

## Redesigned PING-PONG

In many cases in practice when dealing with persistent connections like WebSocket pings and pongs are the most dominant types of messages travelling between a client and a server. Your app can have many concurrent connections, but only few of them are getting useful payload. But at the same time we still need to send pings and respon with pongs. So optimizing ping-pong process may reduce server resource usage significantly.

One more optimization comes from revised PING-PONG behaviour. Previous Centrifugo versions sent ping/pong in both directions (for WebSocket transport). This allowed finding non-active connections on both client and server sides.

In Centrifugo v4 we only send pings from a server to a client and expect pong from a client. On the client-side we have a timer which fires if there were no pings from a server for a configured amount of time.

Sending pings only in one direction results in 2 times less ping-pong messages - and this should be really noticable for Centrifugo setups with thousands of concurrent connections. In our experiments with 10k connections server CPU usage dropped on up to 30% compared to Centrifugo v3.

![Scheme](/img/ping_pong_v3_v4.png)

Pings and pongs are application-level messages. Ping is just an empty asynchronous reply – for example in JSON case it's a 2-byte message: `{}`. Pong is an empty command – also, `{}` in JSON case. Having application-level pings from a server also allows unifying PING format for all unidirectional transports.

One more improvement is that Centrifugo now randomizes the time it sends first ping to a client (but no more than a configured ping interval). This allows to spread ping-pongs in time, providing a smoother CPU profile, especially after massive reconnect scenario.

## Secure by default channel namespaces

Security and data privacy are important in the modern world, more than ever. And as Centrifugo becomes more popular and widely-used the need to be `secure by default` only increases. 

Previously clients could subcribe to all channels in a namespace by default (except private channels, which are now removed - see below). It was possible to use `"protected": true` option to make namespace protected – but not sure everyone did it though. It's an extra configuration and extra knowledge about how Centrifugo works.

Also, a common confusion we met: if server-side subscriptions were dictated by JWT many users expected that client-side subscriptions to those channels won't work. But without `protected` option enabled that was not actually true.

In Centrifugo v4 it's not possible to subscribe on a channel in a namespace by default. Namespace must be configured to allow subscriptions from clients or token authorization should be used. There are a bunch of new namespace options to tune namespace behavior. Also a possibility to provide a regular expression for channels in a namespace.

New permission-related channel option names now better reflect the purpose of option. For example, compare `"publish": true` and `"allow_publish_for_client": true`. The second one is more readable and provides a better understanding of the effect after enabling.

Centrifugo is now more strict when checking channel name by default. Only ASCII symbols allowed – it was already mentioned in docs before, but wasn't actually enforced. Now we are fixing this.

We understand that these changes will make starting with Centrifugo a more complex task when all you want is a public access to all the channels without worrying too much about permissions. It's still possible to achieve – but now the intent should be explicitly expressed in the configuration.

Check out updated documentation about [channels and namespaces](/docs/server/channels). Our v4 migration guide contains an **automatic converter** for channel namespace options.

## Private channel concept revised

Private channel is a special channel starting with `$` which could not be subscribed without subscription JWT. Before v4 having a known prefix allowed us to distinguish between general channels and private channels. But since namespaces are now not-public by default this distinction is not really important.

This means 2 things:

* it's now possible to subscribe to any channel by having valid subscription JWT (not only those starting with `$`)
* channels starting with `$` can only be subscribed using subscription JWT, even if they belong to a namespace where subscriptions allowed for all clients. This is done for security compatibility.

One more notable change in subscription JWT – `client` claim now DEPRECATED. It's not necessary to put it into the subscription token. Centrifugo supports it only for backwards compatibility, but it will be entirely removed in the next releases. The reason why we removed it is interesting actually.

Due to the fact `client` claim was a required part of subscription JWT applications could come across the situation when during [massive reconnect scenario](/blog/2020/11/12/scaling-websocket#massive-reconnect) (say million connections reconnect) a ton of requests to get new subscription tokens could be generated – thus making it unusually hard for a backend to handle the load. With connection JWT we had no such problem – as connections could simply reuse previous token to reconnect to Centrifugo.

Now subscription token behaves just like the connection token – so we get a scalable solution for token-based subscriptions too.

Moreover, this change opened a road to one more great improvement...

## Optimistic subscriptions

The improvement we just mentioned is called optimistic subscriptions. If some of you familar with QUIC protocol then optimistic subscriptions is somewhat similar to 0-rtt feature in QUIC. The idea is simple – we can include subscription commands to the first frame sent to a server.

Previously we we sending subscriptions only after receiving a successful connect reply from a server. But with new changes in token behaviour it seems so logical to put subscribe commands to connect frame. Especially since Centrifugo protocol always supported batching of commands. Even token-based subscriptions may be now included into connect frame during reconnect process since previous token can be reused now.

![](/img/optimistic_subs.png)

The benefit is super-cool – in most scenarios we are saving one RTT of latency when connecting to Centrifugo. While not visible on localhost – this may be pretty important in real-life. And this is less syscalls for a server after all – which leads to less CPU usage.

Optimistic subscriptions are now part of `centrifuge-js` only. At some point we are planning to extend this important optimization to all other client SDKs. 

## Channel capabilities

Channel capabilities feature is introduced as part of [Centrifugo PRO](/docs/pro/overview). Initially we aimed to make it a part of the OSS version. But the lack of feedback about the feature made us nervous it's really needed. So adding it to PRO seemed a safer decision for a moment.

Centrifugo allows configuring channel permissions on a per-namespace level. When creating a new real-time feature it's recommended to create a new namespace for it and configure permissions. But to achieve a better channel permission control inside a namespace Channel capabilities can be used now.

Channel capability feature provides a possibility to set capabilities on individual connection basis, or individual channel subscription basis.

For example, in connection JWT developers can set sth like:

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

And this tells Centrifugo that the connection is able to subscribe on channels `news` or `user_42` using client-side subscriptions at any point while token is active.

Subscription JWT can provide capabilities for the channel too, Centrifugo also supports wildcard and regex channel matches. See more details about this mechanism in [Channel capabilities](/docs/pro/capabilities) chapter.

## Better connections API

One more addition to Centrifugo PRO is an improved connection API. Previously we could only return all connections from a certain user. 

Now API supports filtering all connections: by user ID, by subscribed channel, by additional meta information attached to a connection.

The filtering works with a help of [CEL expressions](https://opensource.google/projects/cel) (Common Expression Language). CEL expressions provide a developer-friendly, fast and secure (as they are not Turing-complete) way to evaluate some conditions. They are used in some Google services (ex. Firebase), in Envoy RBAC configuration, etc. If you've never seen it before – take a look, pretty cool project. And now it helps us to filter connections in a flexible way.

The connections API call result contains more useful information: list of client's active channels, information about tokens used to connect and subscribe.

## Javascript client moved to Typescript

No secret that `centrifuge-js` is the most popular SDK in Centrifugo ecosystem. We put some additional love to it – and `centrifuge-js` is now fully written in Typescript ❤️

This was a long-awaited improvement, and it finally happened! The entire public API is strictly typed. The cool thing is that even EventEmitter events and event handlers is a subject to type checks - this should drastically simplify and speedup development and also help to reduce error possibility.

## Start experimenting with HTTP/3

Centrifugo v4 has an **experimental** HTTP/3 support. As soon as you enabled TLS and provided `"http3": true` option all endpoints on external port will be served by HTTP/3 server based on [lucas-clemente/quic-go](https://github.com/lucas-clemente/quic-go) implementation. This (among other benefits which HTTP/3 can provide) is a first step towards [WebTransport](https://web.dev/webtransport/) support in the future.

It's worth noting that WebSocket transport does not work over HTTP/3, it still starts with HTTP/1.1 Upgrade request (there is an interesting IETF draft BTW about [Bootstrapping WebSockets with HTTP/3](https://www.ietf.org/archive/id/draft-ietf-httpbis-h3-websockets-02.html)). But HTTP-streaming and Eventsource should work just fine with HTTP/3.

HTTP/3 does not work with ACME autocert TLS at the moment - i.e. you need to explicitly provide paths to cert and key files [as described here](/docs/server/tls#using-crt-and-key-files).

## Migration guide

[Migration guide](/docs/next/getting-started/migration_v4) contains all the steps to upgrade your Centrifugo from v3 to v4. While there are many changes it v4 release it should be possible to migrate to Centrifugo v4 without changing the client-side code at all. And then after updating a server gradually upgrade the client-side to the latest stack.

## Centrifuge library for Go

As some of you know Centrifugo server is built on top of [Centrifuge](https://github.com/centrifugal/centrifuge) library for Go. Most of the things described here are now also part of Centrifuge library.

With new unified SDK behavior and bidirectional emulation layer it seems a robust alternative to Socket.IO in Go language ecosystem. It's generic enough to build real-time applications of any kind and comes with Redis broker support to scale connections to many machines – the feature usually not available in other open-source real-time messaging libraries.

In some cases Centrifuge library can be a more flexible solution than Centrifugo since Centrifugo (as a standalone server) dictates some mechanics and rules to follow.

## Special thanks

The refactoring of client SDKs and introducing unified behavior based on the common spec was the hardest part of Centrifugo v4 release. Many thanks to [Vitaly Puzrin](https://github.com/puzrin) (who is an author of several popular open-source libraries – like [markdown-it](https://github.com/markdown-it/markdown-it), [fontello](https://github.com/fontello/fontello), and others). We had a series of super-productive sessions with him regarding client SDK API design. Several great ideas araised from those sessions, and the result seems a huge step forward for Centrifugal projects.

## Join community

That's it. We now begin the era of v4 and it is going to be awesome. We believe that with v4 release Centrifugo has further strengthened its position in the open-source real-time messaging market and still provides a clear cost benefits comparing to paid cloud solutions in the area while being mature and robust enough for a production usage.

The release contains many changes that strongly affect developing with Centrifugo. And of course you may have some questions regarding new or changed concepts. Don't hesitate to join our communities in Telegram (most active) and Discord:

[![Join the chat at https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ](https://img.shields.io/badge/Telegram-Group-orange?style=flat&logo=telegram)](https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ) &nbsp;[![Join the chat at https://discord.gg/tYgADKx](https://img.shields.io/discord/719186998686122046?style=flat&label=Discord&logo=discord)](https://discord.gg/tYgADKx)

Enjoy Centrifugo v4, and let the Centrifugal force be with you.

:::note Attributions

This post used images from freepik.com: by [liuzishan](https://www.freepik.com/author/liuzishan).

:::