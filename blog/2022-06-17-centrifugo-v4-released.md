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

Today we are happy to announce the next generation of Centrifugo – Centrifugo v4. We believe that this release puts Centrifugo to the next level in terms of ease of adoption, SDK ecosystem and channel security model.

<!--truncate-->

## Centrifugo v3 flashbacks

Let's start from looking back a bit. Centrifugo v3 was released last year. It had a great list of improvements – like unidirectional transports support (EventSource, HTTP-streaming and GRPC), GRPC transport for proxy, history iteration API, faster JSON protocol, and more.

During Centrifugo v3 lifecycle we added even more JSON protocol optimizations and support for granular proxy mode.

But Centrifugo v3 did not contain nothing... let's say **revolutional**. Revolutional for Centrifugo itself, or even for the entire open-source real-time messaging area.

In this release we feel that the revolution in some aspects had happened. Let's talk about it and introduce all the major things of v4 release.

## Unified client SDK API

The most difficult part of Centrifugo project is not a server itself. The server part is... well, mostly straightforward to be honest. Client SDKs – that's the hardest thing in the ecosystem.

Centrifugo uses bidirectional asynchronous protocol between a client and a server. This protocol provides reconnection logic, subscription multiplexing, timeout and error handling, ping-pong and token refresh. And all these things should be implemented in different programming languages. As you may know we have official SDKs in Javascript, Dart, Swift, Java and Go.

While implementing the same protocol all SDKs behaved in a slightly different way. That was the result of missing SDK specification. Without strict SDK spec it was hard to document things, hard to explain exact details of SDK behavior. What we did before in Centrifugo docs – pointed users to SDK Github repo to look for behaviour details.

In Centrifugo v4 we introduced a new generation of SDK API. And we now have an [client SDK API spec](/docs/next/transports/client_api). It's a source of truth for SDKs behavior which try to follow the spec closely.

New SDK API is a result of several iterations and thinking on possible states, transitions, token refresh API, etc. Users in our Telegram group may remember how it started:

![Centrifugo scheme](/img/states_prototype.jpg)

And after several iterations those prototypes transformed into working mechanisms with well-defined behaviour:

![Centrifugo scheme](/img/client_state.png)

A few things that have been revised from scratch:

* Client states and transitions
* Subscription states and transitions
* Connection and subscription token refresh behavior
* Ping-pong behavior (see details below)
* Resubscribe logic (SDKs can now resubscribe with backoff)
* Error handling

The mechanics described in the spec is now implemented by all our official SDKs. SDKs now support all the core protocol features existing at this point – without exception. We believe this is a great step for Centrifugo ecosystem.

## Modern bidirectional emulation in Javascript

WebSocket is supported almost everywhere these days. But, there is a case which we believe is the last one preventing users to connect over WebSocket - corporate proxies. With installed root certificate on an employee's machines those proxies can block WebSocket traffic, even if it's wrapped into TLS layer. That's really annoying and often developers choose to not support clients connecting from such "broken" environment at all.

Till v4 Centrifugo users could use SockJS polyfill library to fill that gap.

SockJS is a great piece of software – stable and battle-tested. It's still used by some huge real-time messaging players out there for polyfilling WebSocket transport.

But SockJS is rather old, it's an extra frontend dependency with a bunch of legacy transports, and [the future of it is undefined](https://github.com/sockjs/sockjs-client/issues/592).

SockJS comes with noticable overhead – it's an aditional protocol wrapper, has much bigger memory usage per connection on a server (at least when using SockJS-Go library – the only choice for implementing SockJS server in Go language these days). When using SockJS before Centrifugo users lost the possibility to utilize our pure WebSocket transport - as SockJS used its own WebSocket implementation. 

SockJS does not support binary data transfer – so Centrifugo users could only use JSON format with it.

And finally, if you want to use SockJS with distributed backend you must enable sticky session support on your load-balancer level. This way you can point requests from client to server to the correct server node – the one which keeps persistent unidirectional client connection.

We were dancing around the idea to replace SockJS for a long time. But only now we are ready to provide our alternative to it – Centrifugo own bidirectional emulation layer. It's based on two additional transports:

* HTTP-streaming (using modern browser [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream), supports both binary Protobuf and JSON transfer)
* Eventsource (Server-Sent Events, SSE) – while a bit older choice and works with JSON only EventSource transport is loved by many developers, so we implemented bidirectional emulation with it too.

So when the fallback is used you always have a persistent real-time connection in server -> to -> client direction. Requests in client -> to -> server direction are ordinary HTTP – similar to how SockJS works. But our bidirectional emulation layer does not require sticky session at all – Centrifugo can proxy client-to-server requests to the correct node in a cluster. **Sticky session is an optimization for Centrifugo bidirectional emulation layer, not a requirement**. We believe that this is a game changer – no need to bother about proper load balancing, especially due to the fact that in most cases 95% or even more users will be able to connect with WebSocket transport.

Bidirectional emulation layer supported only by Javascript SDK (`centrifuge-js`) – as we believe that fallbacks mostly make sense for browsers these days. If we find use cases where other SDKs can benefit from having HTTP-based transports – we can extend them later. At least several additional HTTP-based transport advantages over WebSocket:

* Sessions can be automatically multiplexed inside single connection by a browser when server works over HTTP/2
* Better compression support (may be enabled on load balancer level)

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

SockJS is still supported by Centrifugo and `centrifuge-js`. For how long? Not sure – but now we have a good alternative to offer.

:::tip

BTW, it's worth mentioning that our Javascript SDK is now fully written in Typescript. This was a long-awaited improvement, glad it finally happened! The entire public API (including EventEmitter events and event handlers) is strictly typed.

:::

## No layering in client protocol

Not only API of client SDK has been changed, but also the format of Centrifugo protocol messages. New format is more human-readable (in JSON case, of course), has more compact ping message size (which is important as pings are usually the most frequently sent type of message).

And what is more important – the protocol is now one-shot encode/decode compatible. Previously Centrifugo protocol had layering and we had to encode some messages before appending them to a top layer message. Or decode two times to unwrap the message envelope. To achieve good performance Centrifugo had to use various optimization techniques – like buffer memory pools, byte slice memory pools. By re-structuring message format we were able to avoid layering – thus have even better encode/decode performance without additional optimization tricks.

We also simplified [client protocol](/docs/transports/client_protocol) docs overview a bit.

## Redesigned PING-PONG

One more optimization comes from revised PING-PONG behaviour. Previous Centrifugo versions sent ping/pong in both directions (for WebSocket transport). This allowed finding non-active connections on both client and server sides.

In Centrifugo v4 we only send pings from a server to a client and expect pong from a client. On the client-side we have a timer which fires if there were no pings from a server for a configured amount of time. Sending pings only in one direction results in 2 times less ping-pong messages - and this should be really noticable for Centrifugo setups with thousands of concurrent connections. In our experiments with 10k connections server CPU usage dropped on up to 30% compared to Centrifugo v3.

Pings and pongs are application-level messages, just an empty command – for example in JSON case it's a 2-byte message: `{}`.

## Secure by default channel namespaces

Security and data privacy are important in the modern world, more than ever. And as Centrifugo becomes more popular and widely-used the need to be `secure by default` only increases. 

Previously clients could subcribe to all channels in a namespace by default (except private channels, which are now removed - see below). It was possible to use `"protected": true` option to make namespace protected – but not sure everyone did it though. It's an extra configuration and extra knowledge about how Centrifugo works.

Also, a common confusion we met: if server-side subscriptions were dictated by JWT many users expected that client-side subscriptions to those channels won't work. But without `protected` option enabled that was not actually true.

In Centrifugo v4 it's not possible to subscribe on a channel in a namespace by default. Namespace must be configured to allow subscriptions from clients or token authorization should be used. There are a bunch of new namespace options to tune namespace behavior. Also a possibility to provide a regular expression for channels in a namspace.

Centrifugo is now more strict when checking channel name by default. Only ASCII symbols allowed – it was already mentioned in docs before, but never actually enforced. Now we are fixing this.

Check out updated documentation about [channels and namespaces](/docs/server/channels).

## Private channel concept revised

Private channel was a special channel starting with `$` which could not be subscribed without subscription JWT. Having a known prefix allowed us to distinguish between general channels and private channels. But since namespaces are now not-public by default it seems...

TODO: actually we still have private channels, but token can be used to subscribe on any channel. Need to describe this better.

## Channel capabilities

Channel capabilities feature was introduced as part of Centrifugo PRO. Initially we thought to make it a part of the OSS version. But the lack of feedback from the community made us nervous it's really needed. So adding it to PRO seemed the safest first step.

Centrifugo allows configuring channel permissions on a per-namespace level. When creating a new real-time feature it's recommended to create a new namespace for it and configure permissions. But to achieve a better channel permission control inside a namespace Channel capabilities feature can be used. It provides a possibility to set capabilities on individual connection basis, or individual channel subscription basis.

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

And this tells Centrifugo that the connection is able to subscribe on channels `news` or `user_42` using client-side subscriptions at any point while token is active. See more details about this mechanism in [Channel capabilities](/docs/pro/capabilities) chapter.

## Better connections API

One more addition to Centrifugo PRO is an improved connection API. Previously we could only return all connections from a certain user. Now API supports filtering all connections: by user ID, by subscribed channel, by additional meta information attached to a connection.

The filtering works with a help of [CEL expressions](https://opensource.google/projects/cel) (Common Expression Language). CEL expressions provide a developer-friendly, fast and secure (as they are not Turing-complete) way to evaluate some conditions. They are used in some Google services (ex. Firebase), in Envoy RBAC configuration, etc. If you've never seen it before – take a look, pretty cool project. 

## Migration guide

[Migration guide](/docs/next/getting-started/migration_v4) contains all the steps to upgrade your Centrifugo from v3 to v4. While there are many changes it v4 release it should be possible to migrate to Centrifugo v4 without changing the client-side code at all. And then after updating a server gradually upgrade the client-side to the latest stack.

## Conclusion

Join our communities in Telegram and Discord if you have questions or want to follow Centrifugo development:

[![Join the chat at https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ](https://img.shields.io/badge/Telegram-Group-orange?style=flat&logo=telegram)](https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ) &nbsp;[![Join the chat at https://discord.gg/tYgADKx](https://img.shields.io/discord/719186998686122046?style=flat&label=Discord&logo=discord)](https://discord.gg/tYgADKx)

Enjoy Centrifugo v4, and let the Centrifugal force be with you.

## Special thanks

The refactoring of client SDKs and introducing unified behavior based on the common spec was the hardest part of Centrifugo v4 release. Many thanks to [Vitaly Puzrin](https://github.com/puzrin) (who is an author of several popular open-source libraries – like [markdown-it](https://github.com/markdown-it/markdown-it), [fontello](https://github.com/fontello/fontello), and others). We had several super-productive sessions with him regarding client SDK API design. Several great ideas araised from those sessions, and the end result seems a huge step forward for Centrifugal projects.

:::note Attributions

This post used images from freepik.com: by [liuzishan](https://www.freepik.com/author/liuzishan).

:::