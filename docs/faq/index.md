---
id: index
title: Frequently Asked Questions
---

Answers to popular questions here.

### How many connections can one Centrifugo instance handle?

This depends on many factors. Real-time transport choice, hardware, message rate, size of messages, Centrifugo features enabled, client distribution over channels, compression on/off, etc. So no certain answer to this question exists. Common sense, performance measurements, and monitoring can help here. Generally, we suggest not put more than 50-100k clients on one node - but you should measure for your use case.

You can find a description of a test stand with million WebSocket connections in [this blog post](/blog/2020/02/10/million-connections-with-centrifugo) – though the point above is still valid, measure and monitor your setup.

### Memory usage per connection?

Depending on transport used and features enabled the amount of RAM required per each connection can vary.

For example, you can expect that each WebSocket connection will cost about 30-50 KB of RAM, thus a server with 1 GB of RAM can handle about 20-30k connections.

For other real-time transports, the memory usage per connection can differ. So the best way is again – measure for your case since depending on Centrifugo features used memory usage can vary.

### Can Centrifugo scale horizontally?

Short answer: yes, it can. It can do this using built-in engines: Redis, KeyDB, Tarantool, or Nats broker.

See [engines](../server/engines.md) and [scalability considerations](../getting-started/design.md#scalability-considerations).

### Message delivery model

See [design overview](../getting-started/design.md#message-delivery-model)

### Message order guarantees

See [design overview](../getting-started/design.md#message-order-guarantees).

### Should I create channels explicitly?

No. By default, channels are created automatically as soon as the first client subscribed to it. And destroyed automatically when the last client unsubscribes from a channel.

When history inside the channel is on then a window of last messages is kept automatically during the retention period. So a client that comes later and subscribes to a channel can retrieve those messages using the call to history (or maybe by using the automatic recovery feature).

### What about best practices with the number of channels?

Channel is a very lightweight ephemeral entity - Centrifugo can deal with lots of channels, don't be afraid to use many channels.

**But** keep in mind that one client should not be subscribed to lots of channels at the same moment (since this makes the connection process heavy for a client). Using no more than several channels for a client is what you should try to achieve. A good analogy here is writing SQL queries – you need to make sure you return content using a fixed amount of database queries, as soon as more entries on your page result in more queries - your pages start working very slow at some point. The same for channels - you better deliver real-time events over a fixed amount of channels. It takes a separate frame for a client to subscribe to a single channel – more frames mean a more heavy initial connection.

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

Keep in mind that when using WebSocket you are working only over HTTP/1.1, so HTTP/2 support mostly makes sense for SockJS HTTP transports.

### Is there a way to use a single connection to Centrifugo from different browser tabs?

If the underlying transport is HTTP-based, and you use HTTP/2 then this will work automatically. For WebSocket, each browser tab creates a new connection.

### What if I need to send push notifications to mobile or web applications?

Sometimes it's confusing to see a difference between real-time messages and push notifications. Centrifugo is a real-time messaging server. It can not send push notifications to devices - to Apple iOS devices via APNS, Android devices via GCM, or browsers over Web Push API. This is a goal for another software.

But the reasonable question here is how can you know when you need to send a real-time message to an online client or push notification to its device for an offline client. The solution is pretty simple. You can keep critical notifications for a client in the database. And when a client reads a message you should send an ack to your backend marking that notification as read by the client. Periodically you can check which notifications were sent to clients but they have not read it (no read ack received). For such notifications, you can send push notifications to its device using your own or another open-source solution. Look at Firebase for example.

### How can I know a message is delivered to a client?

You can, but Centrifugo does not have such an API. What you have to do to ensure your client has received a message is sending confirmation ack from your client to your application backend as soon as the client processed the message coming from the Centrifugo channel.

### Can I publish new messages over a WebSocket connection from a client?

Centrifugo is designed to stream messages from server to client. Even though it's possible to publish messages into channels directly from a client (when `publish` channel option is enabled) - we strongly discourage this in production usage as those messages just go through Centrifugo without any additional control.

Theoretically, Centrifugo could resend messages published from the client to your application backend endpoint (i.e. having some sort of webhook built-in) but it does not seem beneficial in terms of overall performance and application architecture. And this will require an extra layer of conventions about Centrifugo-to-backend communication. 

So in general when a user generates an event it must be first delivered to your app backend using a convenient way (for example AJAX POST request for web application), processed on the backend (validated, saved into main application database), and then published to Centrifugo using Centrifugo HTTP or GRPC API.

Sometimes publishing from a client directly into a channel can be useful though - for personal projects, for demonstrations (like we do in our [examples](https://github.com/centrifugal/examples)) or if you trust your users and want to build an application without backend. In all cases when you don't need any message control on your backend.

It's also possible to utilize the RPC proxy feature – in this case, you can call RPC over Centrifugo WebSocket which will be translated to an HTTP request to your backend. After receiving this request on the backend you can publish a message to Centrifugo server API. This way you can utilize WebSocket transport between the client and your server in a bidirectional way. HTTP traffic will be concentrated inside your private network.

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

### How scalable is the presence and join/leave features?

Presence is good for small channels with a reasonable number of subscribers, as soon as there are tons of subscribers presence information becomes very expensive in terms of bandwidth (as it contains full information about all clients in a channel). There is `presence_stats` API method that can be helpful if you only need to know the number of clients (or unique users) in a channel. But in the case of the Redis engine even `presence stats` are not optimized for channels with more than several thousand active subscribers. You may consider using a separate service to deal with presence status information that provides information in near real-time maybe with some reasonable approximation.

The same is true for join/leave messages - as soon as you turn on join/leave events for a channel with many subscribers every join/leave event (which generally happen relatively frequently) result in many messages sent to each subscriber in a channel, drastically multiplying amount of messages traveling through the system. So be careful and estimate possible load. There is no magic, unfortunately.

### I have not found an answer to my question here:

Ask in our community rooms:

[![Join the chat at https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ](https://img.shields.io/badge/Telegram-Group-orange?style=flat&logo=telegram)](https://t.me/joinchat/ABFVWBE0AhkyyhREoaboXQ) &nbsp;[![Join the chat at https://discord.gg/tYgADKx](https://img.shields.io/discord/719186998686122046?style=flat&label=Discord&logo=discord)](https://discord.gg/tYgADKx)
