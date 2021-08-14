---
id: server_subs
title: Server-side subscriptions
---

Centrifugo clients can initiate a subscription to a channel by calling the `Subscribe` method of client protocol. In most cases, this is the most flexible approach since a client-side usually knows which channels it needs to consume at a concrete moment. But in some situations, all you need is to subscribe your connections to several channels on a server-side at the moment of connection establishment. So client effectively starts receiving publications from those channels without calling the `Subscribe` method at all.

You can set a list of channels for a connection in two ways at the moment:

* over connection JWT using `channels` claim, which is an array of strings
* over connect proxy returning `channels` field in result (also an array of strings)
* dynamically over server subscribe API

On the client-side, you need to listen for publications from server-side channels using a top-level client event handler. For example with `centrifuge-js`:

```javascript
var centrifuge = new Centrifuge(address);

centrifuge.on('publish', function(ctx) {
    const channel = ctx.channel;
    const payload = JSON.stringify(ctx.data);
    console.log('Publication from server-side channel', channel, payload);
});

centrifuge.connect();
```

I.e. listen for publications without any usage of subscription objects. You can look at channel publication relates to using field in callback context as shown in the example.

:::tip

The same [best practices](../faq/index.md#what-about-best-practices-with-amount-of-channels) of working with channels and client-side subscriptions equally applicable to server-side subscription. 

:::

### Dynamic server-side subscriptions

See subscribe and unsubscribe [server API](server_api.md)

### Automatic personal channel subscription

It's possible to automatically subscribe a user to a personal server-side channel.

To enable this you need to enable the `user_subscribe_to_personal` boolean option (by default `false`). As soon as you do this every connection with a non-empty user ID will be automatically subscribed to a personal user-limited channel. Anonymous users with empty user IDs won't be subscribed to any channel.

For example, if you set this option and the user with ID `87334` connects to Centrifugo it will be automatically subscribed to channel `#87334` and you can process personal publications on the client-side in the same way as shown above.

As you can see by default generated personal channel name belongs to the default namespace (i.e. no explicit namespace used). To set custom namespace name use `user_personal_channel_namespace` option (string, default `""`) – i.e. the name of namespace from configured configuration namespaces array. In this case, if you set `user_personal_channel_namespace` to `personal` for example – then the automatically generated personal channel will be `personal:#87334` – user will be automatically subscribed to it on connect and you can use this channel name to publish personal notifications to the online user.

### Maintain single user connection

Usage of personal channel subscription also opens a road to enable one more feature: maintaining only a single connection for each user globally around all Centrifugo nodes.

`user_personal_single_connection` boolean option (default `false`) turns on a mode in which Centrifugo will try to maintain only a single connection for each user at the same moment. As soon as the user establishes a connection other connections from the same user will be closed with connection limit reason (client won't try to automatically reconnect).

This feature works with a help of presence information inside a personal channel. So **presence should be turned on in a personal channel**.

Example config:

```
{
  "user_subscribe_to_personal": true,
  "user_personal_single_connection": true,
  "user_personal_channel_namespace": "personal",
  "namespaces": [
    {
      "name": "personal",
      "presence": true
    }
  ]
}
```

:::note

Centrifugo can't guarantee that other user connections will be closed – since Disconnect messages are distributed around Centrifugo nodes with at most once guarantee. So don't add critical business logic based on this feature to your application. Though this should work just fine most of the time if the connection between the Centrifugo node and PUB/SUB broker is OK.

:::
