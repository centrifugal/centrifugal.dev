---
id: faq_index
title: Frequently Asked Questions
---

Answers to popular questions here.

### Disconnected due to client credentials not found

If you connect to Centrifugo first time, and your client disconnected with code `3501` and reason `"bad request"` – then in many cases this means you have not provided authentication credentials. Check out server logs – if you see `credentials not found` message on INFO level – this is exactly it.

When connecting to Centrifugo client must authenticate using one of the supported ways. This may be:

* [JWT authentication](../server/authentication.md)
* [Connect proxy](../server/proxy.md#connect-proxy) authentication
* Using proxy to set [user authentication header](../server/configuration.md#clientuser_id_http_header)

You can also [configure access without token](../server/configuration.md#clientallow_anonymous_connect_without_token) – in this case Centrifugo will consider a connection without provided token anonymous. Or, if you just want to quickly experiment with Centrifugo during development, it's possible to turn on [client.insecure](../server/configuration.md#clientinsecure) option – but it **should never be used in production** since disables most of security checks.

Another possible reason of first time connection problems - not properly configured [allowed_origins](../server/configuration.md#clientallowed_origins). Centrifugo server logs should also clearly indicate such issues on INFO level.

### How many connections can one Centrifugo instance handle?

This depends on many factors. Real-time transport choice, hardware, message rate, size of messages, Centrifugo features enabled, client distribution over channels, compression on/off, etc. So no certain answer to this question exists. Common sense, performance measurements, and monitoring can help here. 

Generally, we suggest not put more than 50-100k clients on one node - but you should measure for your use case.

You can find a description of a test stand with million WebSocket connections in [this blog post](/blog/2020/02/10/million-connections-with-centrifugo). Though the point above is still valid – measure and [monitor](../server/monitoring.md) your setup.

### Memory usage per connection?

Depending on transport used and features enabled the amount of RAM required per each connection can vary.

For example, you can expect that each WebSocket connection will cost about 30-50 KB of RAM, thus a server with 1 GB of RAM can handle about 20-30k connections.

For other real-time transports, the memory usage per connection can differ. So the best way is again – measure for your custom case since depending on Centrifugo transport/features memory usage can vary.

### Can Centrifugo scale horizontally?

Yes, it can do this using built-in Redis engine. Centrifugo also works with Redis-compatible storages such as AWS Elasticache, Google Memorystore, KeyDB, DragonflyDB. It's also possible to use Nats broker (for at most once delivery only).

See [engines](../server/engines.md) and [scalability considerations](../getting-started/design.md#scalability-considerations).

### Message delivery model

See [design overview](../getting-started/design.md#message-delivery-model)

### Message order guarantees

See [design overview](../getting-started/design.md#message-order-guarantees).

### Should I create channels explicitly?

No. By default, channels are created automatically as soon as the first client subscribed to it. And destroyed automatically when the last client unsubscribes from a channel.

When history inside the channel is on then a window of last messages is kept automatically during the retention period. So a client that comes later and subscribes to a channel can retrieve those messages using the call to the history API (or maybe by using the automatic recovery feature which also uses a history internally).

### What about best practices with the number of channels?

Channel is a very lightweight ephemeral entity - Centrifugo can deal with lots of channels, don't be afraid to have many channels in an application.

But keep in mind that one client should be subscribed to a reasonable number of channels at one moment. Client-side subscription to a channel requires a separate frame from client to server – more frames mean more heavy initial connection, more heavy reconnect, etc.

One example which may lead to channel misusing is a messenger app where user can be part of many groups. In this case, using a separate channel for each group/chat in a messenger may be a bad approach. The problem is that messenger app may have chat list screen – a view that displays all user groups (probably with pagination). If you are using separate channel for each group then this may lead to lots of subscriptions. Also, with pagination, to receive updates from older chats (not visible on a screen due to pagination) – user may need to subscribe on their channels too. In this case, using a single personal channel for each user is a preferred approach. As soon as you need to deliver a message to a group you can use Centrifugo `broadcast` API to send it to many users. If your chat groups are huge in size then you may also need additional queuing system between your application backend and Centrifugo to broadcast a message to many personal channels.

### Any way to exclude message publisher from receiving a message from a channel?

Currently, no.

We know that services like Pusher provide a way to exclude current client by providing a client ID (socket ID) in publish request. A couple of problems with this:

* Client can reconnect while message travels over wire/Backend/Centrifugo – in this case client has a chance to receive a message unexpectedly since it will have another client ID (socket ID)
* Client can call a history manually or message recovery process can run upon reconnect – in this case a message will present in a history

Both cases may result in duplicate messages. These reasons prevent us adding such functionality into Centrifugo, the correct application architecture requires having some sort of idempotent identifier which allow dealing with message duplicates.

Once added nobody will think about idempotency and this can lead to hard to catch/fix problems in an application. This can also make enabling channel history harder at some point.

Centrifugo behaves similar to Kafka here – i.e. channel should be considered as immutable stream of events where each channel subscriber simply receives all messages published to a channel.

In the future releases Centrifugo may have some sort of server-side message filtering, but we are searching for a proper and safe way of adding it.

### Can I have both binary and JSON clients in one channel?

No. It's not possible to transparently encode binary data into JSON protocol (without converting binary to base64 for example which we don't want to do due to increased complexity and performance penalties). So if you have clients in a channel which work with JSON – you need to use JSON payloads everywhere.

Most Centrifugo bidirectional connectors are using binary Protobuf protocol between a client and Centrifugo. But you can send JSON over Protobuf protocol just fine (since JSON is a UTF-8 encoded sequence of bytes in the end).

To summarize:

* if you are using binary Protobuf clients and binary payloads everywhere – you are fine.
* if you are using binary or JSON clients and valid JSON payloads everywhere – you are fine.
* if you try to send binary data to JSON protocol based clients – you will get errors from Centrifugo.

### Online presence for chat apps - online status of your contacts

While online presence is a good feature it does not fit well for some apps. For example, if you make a chat app - you may probably use a single personal channel for each user. In this case, you cannot find who is online at moment using the built-in Centrifugo presence feature as users do not share a common channel.

You can solve this using a separate service that tracks the online status of your users (for example in Redis) and has a bulk API that returns online status approximation for a list of users. This way you will have an efficient scalable way to deal with online statuses. This is also available as [Centrifugo PRO feature](../pro/user_status.md).

### Centrifugo stops accepting new connections, why?

The most popular reason behind this is reaching the open file limit. You can make it higher, we described how to do this [nearby in this doc](../server/infra_tuning.md). Also, check out [an article in our blog](/blog/2020/11/12/scaling-websocket) which mentions possible problems when dealing with many persistent connections like WebSocket.

### Can I use Centrifugo without reverse-proxy like Nginx before it?

Yes, you can - Go standard library designed to allow this. Though proxy before Centrifugo can be very useful for load balancing clients.

### Does Centrifugo work with HTTP/2?

Yes, Centrifugo works with HTTP/2. This is provided by built-in Go http server implementation.

You can disable HTTP/2 running Centrifugo server with `GODEBUG` environment variable:

```
GODEBUG="http2server=0" centrifugo -c config.json
```

Keep in mind that when using WebSocket you are working only over HTTP/1.1, so HTTP/2 support mostly makes sense for HTTP based transports such as our WebSocket bidirectional fallbacks (Server-Sent Events (SSE) and HTTP-streaming with bidirectional emulation) and unidirectional transports (unidirectional Server-Sent Events (SSE) and HTTP-streaming).

### Does Centrifugo work with HTTP/3?

Centrifugo v4 added an **experimental** HTTP/3 support. As soon as you enabled TLS and provided `"http3": true` option all endpoints on external port will be served by HTTP/3 server based on [github.com/quic-go/quic-go](https://github.com/quic-go/quic-go) implementation. This (among other benefits which HTTP/3 can provide) is a step towards a proper [WebTransport](https://web.dev/webtransport/) support. For now we [support WebTransport experimentally](../transports/webtransport.md).

It's worth noting that WebSocket transport does not work over HTTP/3, it still starts with HTTP/1.1 Upgrade request (there is an interesting IETF draft BTW about [Bootstrapping WebSockets with HTTP/3](https://www.ietf.org/archive/id/draft-ietf-httpbis-h3-websockets-02.html)). But HTTP-streaming and Eventsource should work just fine with HTTP/3.

HTTP/3 does not work with ACME autocert TLS at the moment - i.e. you need to explicitly provide paths to cert and key files [as described here](../server/tls.md#using-crt-and-key-files).

### Is there a way to use a single connection to Centrifugo from different browser tabs?

If the underlying transport is HTTP-based, and you use HTTP/2 then this will work automatically. For WebSocket, each browser tab creates a new connection.

### What if I need to send push notifications to mobile or web applications?

We provide [push notifications API](/docs/pro/push_notifications) implementation as part of Centrifugo PRO. It allows sending push notifications to devices - to Apple iOS devices via APNS, Android/iOS/Web devices via FCM. Also, Centrifugo PRO covers HMS (Huawei Mobile Services). But in general the task of push notification delivery may be done using another open-source solution, or with Firebase directly.

The reasonable question here is how can you know when you need to send a real-time message to an online client or push notification to its device for an offline client. The solution is pretty simple. You can keep critical notifications for a client in the database. And when a client reads a message you should send an ack to your backend marking the notification as read by the client. Periodically you can check which notifications were sent to clients but have not been read (no read ack received). For such notifications, you can send push notification to the device.

### How can I know a message is delivered to a client?

You can, but Centrifugo does not have such an API. What you have to do to ensure your client has received a message is sending confirmation ack from your client to your application backend as soon as the client processed the message coming from a Centrifugo channel.

### Can I publish new messages over a WebSocket connection from a client?

It's possible to publish messages into channels directly from a client (when `publish` channel option is enabled). But we strongly discourage this in production usage as those messages just go through Centrifugo without any additional control and validation from the application backend.

We suggest using one of the available approaches:

* When a user generates an event it must be first delivered to your app backend using a convenient way (for example AJAX POST request for a web application), processed on the backend (validated, saved into the main application database), and then published to Centrifugo using Centrifugo HTTP or GRPC API.
* Utilize the [RPC proxy feature](../server/proxy.md#client-rpc-proxy) – in this case, you can call RPC over Centrifugo WebSocket which will be translated to an HTTP request to your backend. After receiving this request on the backend you can publish a message to Centrifugo server API. This way you can utilize WebSocket transport between the client and your server in a bidirectional way. HTTP traffic will be concentrated inside your private network.
* Utilize the [publish proxy feature](../server/proxy.md#publish-proxy) – in this case client can call publish on the frontend, this publication request will be transformed into HTTP or GRPC call to the application backend. If your backend allows publishing - Centrifugo will pass the payload to the channel (i.e. will publish message to the channel itself). 

Sometimes publishing from a client directly into a channel (without any backend involved) can be useful though - for personal projects, for demonstrations (like we do in our [examples](https://github.com/centrifugal/examples)) or if you trust your users and want to build an application without backend. In all cases when you don't need any message control on your backend.

### How to create a secure channel for two users only (private chat case)?

There are several ways to achieve it:

* use a private channel (starting with `$`) - every time a user subscribes to it your backend should provide a sign to confirm that subscription request. Read more in [channels chapter](../server/channels.md#private-channel-prefix-)
* next is [user limited channels](../server/channels.md#user-channel-boundary-) (with `#`) - you can create a channel with a name like `dialog#42,567` to limit subscribers only to the user with id `42` and user with ID `567`, this does not fit well for channels with many or dynamic possible subscribers
* you can use subscribe proxy feature to validate subscriptions, see [chapter about proxy](../server/proxy.md)
* finally, you can create a hard-to-guess channel name (based on some secret key and user IDs or just generate and save this long unique name into your main app database) so other users won't know this channel to subscribe on it. This is the simplest but not the safest way - but can be reasonable to consider in many situations

### What's the best way to organize channel configuration?

In most situations, your application needs several different real-time features. We suggest using namespaces for every real-time feature if it requires some option enabled.

For example, if you need join/leave messages for a chat app - create a special channel namespace with this `join_leave` option enabled. Otherwise, your other channels will receive join/leave messages too - increasing load and traffic in the system but not used by clients.

The same relates to other channel options.

### Does Centrifugo support webhooks?

[Proxy feature](../server/proxy.md) allows integrating Centrifugo with your session mechanism (via connect proxy) and provides a way to react to connection events (rpc, subscribe, publish). Also, it opens a road for bidirectional communication with RPC calls. And periodic connection refresh hooks are also there.

Centrifugo does not support unsubscribe/disconnect hooks – see the reasoning below.

### Why Centrifugo does not have disconnect hooks?

:::tip UPDATE

Centrifugo PRO now solves the pitfalls mentioned here with its [Channel State Events](../pro/channel_events.md) feature.

:::

Centrifugo does not support disconnect hooks at this point. We understand that this may be useful for some use cases but there are some pitfalls which prevent us adding such hooks to Centrifugo. 

Let's consider a case when Centrifugo node is unexpectedly killed. In this case there is no chance for Centrifugo to emit disconnect events for connections on that node. While this may be rare thing in practice – it may lead to inconsistent state in your app if you'd rely on disconnect hooks.

Another reason is that Centrifugo designed to scale to many concurrent connections. Think millions of them. As we [mentioned in our blog](https://centrifugal.dev/blog/2020/11/12/scaling-websocket#massive-reconnect) there are cases when all connections start reconnecting at the same time. In this case Centrifugo could potentially generate lots of disconnect events. Even if disconnect events were queued, rate-limited, or suppressed for quickly reconnected clients there could be situations when your app processes disconnect hook after user already reconnected. This is a racy situation which also can lead to the inconsistency if not properly addressed.

Is there a workaround though? If you need to know that client disconnected and program your business logic around this fact then the reasonable approach could be periodically call your backend while client connection is active and update status somewhere on the backend (possibly using Redis for this). Then periodically do clealup logic for connections/users not updated for a configured interval. This is a robust solution where you can't occasionally miss disconnect events. You can also utilize Centrifugo [connect proxy](../server/proxy.md#connect-proxy) + [refresh proxy](../server/proxy.md#refresh-proxy) for getting notified about initial connection and get periodic refresh requests while connection is alive.

The trade-off of the described workaround scenario is that you will notice disconnection only with some delay – this may be a acceptable in many cases though.

Having said that, processing disconnect events may be reasonable – as a best-effort solution while taking into account everything said above. [Centrifuge](https://github.com/centrifugal/centrifuge) library for Go language (which is the core of Centrifugo) supports client disconnect callbacks on a server-side – so technically the possibility exists. If someone comes with a use case which definitely wins from having disconnect hooks in Centrifugo we are ready to discuss this and try to design a proper solution together.

All the pitfalls and workarounds here may be also applied to unsubscribe event hooks.

### Is it possible to listen to join/leave events on the app backend side?

No, join/leave events are only available in the client protocol. In most cases join event can be handled by using [subscribe proxy](../server/proxy.md#subscribe-proxy). Leave events are harder – there is no unsubscribe hook available (mostly the same reasons as for disconnect hook described above). So the workaround here can be similar to one for disconnect – ping an app backend periodically while client is subscribed and thus know that client is currently in a channel with some approximation in time.

### How scalable is the online presence and join/leave features?

Online presence is good for channels with a reasonably small number of active subscribers. As soon as there are tons of active subscribers, presence information becomes very expensive in terms of bandwidth (as it contains full information about all clients in a channel).

There is `presence_stats` API method that can be helpful if you only need to know the number of clients (or unique users) in a channel. But in the case of the Redis engine even `presence_stats` call is not optimized for channels with more than several thousand active subscribers.

You may consider using a separate service to deal with presence status information that provides information in near real-time maybe with some reasonable approximation. Centrifugo PRO provides a [user status](../pro/user_status.md) feature which may fit your needs.

The same is true for join/leave messages - as soon as you turn on join/leave events for a channel with many active subscribers each subscriber starts generating indiviaual join/leave events. This may result in many messages sent to each subscriber in a channel, drastically multiplying amount of messages traveling through the system. Especially when all clients reconnect simulteniously. So be careful and estimate the possible load. There is no magic, unfortunately.

### How to send initial data to channel subscriber?

Sometimes you need to send some initial state towards channel subscriber. Centrifugo provides a way to attach any data to a successful subscribe reply when using [subscribe proxy](../server/proxy.md#subscribe-proxy) feature. See `data` and `b64data` fields. This data will be part of `subscribed` event context. And of course, you can always simply send request to get initial data from the application backend before or after subscribing to a channel without Centrifugo connection involved (i.e. using sth like general AJAX/HTTP call or passing data to the template when rendering an application page).

### Does Centrifugo support multitenancy?

If you want to use Centrifugo with different projects the recommended approach is to have different Centrifugo installations for each project. Multitenancy is better to solve on infrastructure level in case of Centrifugo.

It's possible to share one Redis setup though by setting unique `redis_prefix`. But we recommend having completely isolated setups.

### Is Centrifugo FIPS compliant?

See the [FIPS 140-3 Compliance](https://go.dev/doc/security/fips140) document, which is part of the Go 1.24 release. With this release, it is now possible to use `GODEBUG` runtime toggles to enable FIPS 140-3 compliance mode (Linux only). Centrifugo logs `"fips": true` at startup if FIPS mode is enabled.

Note, Centrifugo uses the SHA-1 digest for two purposes:

* Using SHA-1 as a hex digest for the Redis Lua [`EVALSHA`](https://redis.io/docs/latest/commands/evalsha/) command. SHA-1 is used here only for the digest of the Lua script, not for any cryptographic purposes. The digest is used to identify the script in Redis and is not relied upon for any security properties.
* Using SHA-1 during WebSocket upgrades, as specified in [RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455). The RFC [explicitly states in section 10.8](https://datatracker.ietf.org/doc/html/rfc6455#section-10.8) that SHA-1 usage does not depend on any of SHA-1’s cryptographic security properties.

This means that:

* When running Centrifugo with `GODEBUG=fips140=on`, all functionality will work as expected.
* When running with `GODEBUG=fips140=only`, Centrifugo will panic if it attempts to use Redis integrations or WebSocket transport.

If you also need a FIPS-compliant Docker image, you can create one using the binary from the Centrifugo releases on GitHub.

### I have not found an answer to my question here

Ask in our community rooms:

[![Join the chat at https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ](https://img.shields.io/badge/Telegram-Group-orange?style=flat&logo=telegram)](https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ) &nbsp;[![Join the chat at https://discord.gg/tYgADKx](https://img.shields.io/discord/719186998686122046?style=flat&label=Discord&logo=discord)](https://discord.gg/tYgADKx)
