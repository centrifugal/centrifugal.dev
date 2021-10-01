---
id: index
title: Frequently Asked Questions
---

Answers to popular questions here.

### How many connections can one Centrifugo instance handle?

This depends on many factors. Real-time transport choice, hardware, message rate, size of messages, Centrifugo features enabled, client distribution over channels, compression on/off, etc. So no certain answer to this question exists. Common sense, performance measurements, and monitoring can help here. 

Generally, we suggest not put more than 50-100k clients on one node - but you should measure for your use case.

You can find a description of a test stand with million WebSocket connections in [this blog post](/blog/2020/02/10/million-connections-with-centrifugo). Though the point above is still valid – measure and [monitor](../server/monitoring.md) your setup.

### Memory usage per connection?

Depending on transport used and features enabled the amount of RAM required per each connection can vary.

For example, you can expect that each WebSocket connection will cost about 30-50 KB of RAM, thus a server with 1 GB of RAM can handle about 20-30k connections.

For other real-time transports, the memory usage per connection can differ. So the best way is again – measure for your custom case since depending on Centrifugo transport/features memory usage can vary.

### Can Centrifugo scale horizontally?

Yes, it can do this using built-in engines: Redis, KeyDB, Tarantool, or Nats broker.

See [engines](../server/engines.md) and [scalability considerations](../getting-started/design.md#scalability-considerations).

### Message delivery model

See [design overview](../getting-started/design.md#message-delivery-model)

### Message order guarantees

See [design overview](../getting-started/design.md#message-order-guarantees).

### Should I create channels explicitly?

No. By default, channels are created automatically as soon as the first client subscribed to it. And destroyed automatically when the last client unsubscribes from a channel.

When history inside the channel is on then a window of last messages is kept automatically during the retention period. So a client that comes later and subscribes to a channel can retrieve those messages using the call to the history API (or maybe by using the automatic recovery feature which also uses a history internally).

### What about best practices with the number of channels?

Channel is a very lightweight ephemeral entity - Centrifugo can deal with lots of channels, don't be afraid to have many channels.

But keep in mind that one client should not be subscribed to lots of channels at the same moment (since this makes the connection process heavy for a client). Using no more than several channels for a client is what you should try to achieve. A good analogy here is writing SQL queries – you need to make sure you return content using a fixed amount of database queries, as soon as more entries on your page result in more queries - your pages start working very slow at some point. The same for channels - you better deliver real-time events over a fixed amount of channels. It takes a separate frame for a client to subscribe to a single channel – more frames mean a more heavy initial connection.

For example, when building a chat app where user can be part of many groups using a separate channel for each group is usually a bad approach. This does not scale well since user can have lots of active groups on chat list screen – thus lots of subscriptions. Also, to receive updates from old chats (not visible on a screen) – user will need to subscribe on them too (i.e. even more subscriptions). In this case using a single personal channel for each user is a preferred approach. As soon as you need to deliver a message to a group you can use Centrifugo `broadcast` API to send it to many users. If your chat groups are huge in size then you may also need additional queuing system between your application backend and Centrifugo to broadcast a message to many personal channels.

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

### Presence for chat apps - online status of your contacts

While presence is a good feature it does not fit well for some apps. For example, if you make a chat app - you may probably use a single personal channel for each user. In this case, you cannot find who is online at moment using the built-in Centrifugo presence feature as users do not share a common channel.

You can solve this using a separate service that tracks the online status of your users (for example in Redis) and has a bulk API that returns online status approximation for a list of users. This way you will have an efficient scalable way to deal with online statuses. This is also available as [Centrifugo PRO feature](../pro/user_status.md).

### Centrifugo stops accepting new connections, why?

The most popular reason behind this is reaching the open file limit. You can make it higher, we described how to do this [nearby in this doc](../server/infra_tuning.md). Also, check out [an article in our blog](/blog/2020/11/12/scaling-websocket) which mentions possible problems when dealing with many persistent connections like WebSocket.

### Can I use Centrifugo without reverse-proxy like Nginx before it?

Yes, you can - Go standard library designed to allow this. Though proxy before Centrifugo can be very useful for load balancing clients.

### Does Centrifugo work with HTTP/2?

Yes, Centrifugo works with HTTP/2.

You can disable HTTP/2 running Centrifugo server with `GODEBUG` environment variable:

```
GODEBUG="http2server=0" centrifugo -c config.json
```

Keep in mind that when using WebSocket you are working only over HTTP/1.1, so HTTP/2 support mostly makes sense for SockJS HTTP transports and unidirectional transports: like EventSource (SSE) and HTTP-streaming.

### Is there a way to use a single connection to Centrifugo from different browser tabs?

If the underlying transport is HTTP-based, and you use HTTP/2 then this will work automatically. For WebSocket, each browser tab creates a new connection.

### What if I need to send push notifications to mobile or web applications?

Sometimes it's confusing to see a difference between real-time messages and push notifications. Centrifugo is a real-time messaging server. It can not send push notifications to devices - to Apple iOS devices via APNS, Android devices via GCM, or browsers over Web Push API. This is a goal for another software.

But the reasonable question here is how can you know when you need to send a real-time message to an online client or push notification to its device for an offline client. The solution is pretty simple. You can keep critical notifications for a client in the database. And when a client reads a message you should send an ack to your backend marking that notification as read by the client. Periodically you can check which notifications were sent to clients but they have not read it (no read ack received). For such notifications, you can send push notifications to its device using your own or another open-source solution. Look at Firebase for example.

### How can I know a message is delivered to a client?

You can, but Centrifugo does not have such an API. What you have to do to ensure your client has received a message is sending confirmation ack from your client to your application backend as soon as the client processed the message coming from a Centrifugo channel.

### Can I publish new messages over a WebSocket connection from a client?

It's possible to publish messages into channels directly from a client (when `publish` channel option is enabled). But we strongly discourage this in production usage as those messages just go through Centrifugo without any additional control and validation from the application backend.

We suggest using one of the available approaches:

* When a user generates an event it must be first delivered to your app backend using a convenient way (for example AJAX POST request for a web application), processed on the backend (validated, saved into the main application database), and then published to Centrifugo using Centrifugo HTTP or GRPC API.
* Utilize the [RPC proxy feature](../server/proxy.md#rpc-proxy) – in this case, you can call RPC over Centrifugo WebSocket which will be translated to an HTTP request to your backend. After receiving this request on the backend you can publish a message to Centrifugo server API. This way you can utilize WebSocket transport between the client and your server in a bidirectional way. HTTP traffic will be concentrated inside your private network.
* Utilize the [publish proxy feature](../server/proxy.md#publish-proxy) – in this case client can call publish on the frontend, this publication request will be transformed into HTTP or GRPC call to the application backend. If your backend allows publishing - Centrifugo will pass the payload to the channel (i.e. will publish message to the channel itself). 

Sometimes publishing from a client directly into a channel (without any backend involved) can be useful though - for personal projects, for demonstrations (like we do in our [examples](https://github.com/centrifugal/examples)) or if you trust your users and want to build an application without backend. In all cases when you don't need any message control on your backend.

### How to create a secure channel for two users only (private chat case)?

There are several ways to achieve it:

* use a private channel (starting with `$`) - every time a user subscribes to it your backend should provide a sign to confirm that subscription request. Read more in [channels chapter](../server/channels.md#private-channel-prefix)
* next is [user limited channels](../server/channels.md#user-channel-boundary) (with `#`) - you can create a channel with a name like `dialog#42,567` to limit subscribers only to the user with id `42` and user with ID `567`, this does not fit well for channels with many or dynamic possible subscribers
* you can use subscribe proxy feature to validate subscriptions, see [chapter about proxy](../server/proxy.md)
* finally, you can create a hard-to-guess channel name (based on some secret key and user IDs or just generate and save this long unique name into your main app database) so other users won't know this channel to subscribe on it. This is the simplest but not the safest way - but can be reasonable to consider in many situations

### What's the best way to organize channel configuration?

In most situations, your application needs several different real-time features. We suggest using namespaces for every real-time feature if it requires some option enabled.

For example, if you need join/leave messages for a chat app - create a special channel namespace with this `join_leave` option enabled. Otherwise, your other channels will receive join/leave messages too - increasing load and traffic in the system but not used by clients.

The same relates to other channel options.

### Does Centrifugo support webhooks?

[Proxy feature](../server/proxy.md) allows integrating Centrifugo with your session mechanism (via connect proxy) and provides a way to react to connection events (rpc, subscribe, publish). Also, it opens a road for bidirectional communication with RPC calls.

A tricky thing is disconnects hooks. Centrifugo does not support them. There is no guarantee that the disconnect code will have a time to execute on the client-side (as the client can just switch off its device or simply lose internet connection). Also Centrifugo node can unexpectedly be killed. In both cases there is a chance that disconnect event will not be delivered to the backend. If you need to know that client disconnected and program your business logic around this fact then the only reasonable approach is periodically call your backend from the client-side and update user status somewhere on the backend (use Redis maybe). This is a pretty robust solution where you can't occasionally miss disconnect events. You can also utilize Centrifugo refresh proxy for the task of periodic backend pinging.

### Is it possible to listen to join/leave events on the app backend side?

No, join/leave events are only available in the client protocol. In most cases join event can be handled by using [subscribe proxy](../server/proxy.md#subscribe-proxy). Leave events are harder – there is no unsubscribe hook availeble (mostly the same reasons as for disconnect hook described above). So the workaround here can be similar as for disconnect – ping app backend periodically while client is subscribed and thus know that client is currently in channel with some approximation in time.

### How scalable is the presence and join/leave features?

Presence is good for channels with a reasonably small number of active subscribers. As soon as there are tons of active subscribers, presence information becomes very expensive in terms of bandwidth (as it contains full information about all clients in a channel).

There is `presence_stats` API method that can be helpful if you only need to know the number of clients (or unique users) in a channel. But in the case of the Redis engine even `presence_stats` call is not optimized for channels with more than several thousand active subscribers.

You may consider using a separate service to deal with presence status information that provides information in near real-time maybe with some reasonable approximation. Centrifugo PRO provides a [user status](../pro/user_status.md) feature which may fit your needs.

The same is true for join/leave messages - as soon as you turn on join/leave events for a channel with many active subscribers each subscriber starts generating indiviaual join/leave events. This may result in many messages sent to each subscriber in a channel, drastically multiplying amount of messages traveling through the system. Especially when all clients reconnect simulteniously. So be careful and estimate the possible load. There is no magic, unfortunately.

### I have not found an answer to my question here:

Ask in our community rooms:

[![Join the chat at https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ](https://img.shields.io/badge/Telegram-Group-orange?style=flat&logo=telegram)](https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ) &nbsp;[![Join the chat at https://discord.gg/tYgADKx](https://img.shields.io/discord/719186998686122046?style=flat&label=Discord&logo=discord)](https://discord.gg/tYgADKx)
