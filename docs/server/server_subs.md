---
id: server_subs
title: Server-side subscriptions
---

Centrifugo clients can initiate a subscription to a channel by calling the `subscribe` method of client API. We call it client-side subscriptions. In most cases, client-side subscriptions is a flexible and recommended approach to subscribe to channels. A frontend usually knows which channels it needs to consume at a concrete moment.

But in some situations, all you need is to subscribe your connections to several channels on a server-side at the moment of connection establishment. So client effectively starts receiving publications from those channels without calling the `subscribe` API at all. Centrifugo allows doing this with its server-side subscriptions feature.

It's possible to set a list of channels for a connection in several ways:

* over connection JWT using `channels` claim, which is an array of strings
* over connect proxy returning `channels` field in result (also an array of strings)
* providing channels as part of unidirectional transport connect payload – if client has enough permissions subscriptions will be created
* dynamically over server subscribe API

On the client-side, when using bidirectional transport and our SDKs you need to listen for publications from server-side channels using a top-level client event handler. For example with `centrifuge-js`:

```javascript
const centrifuge = new Centrifuge(address);

centrifuge.on('publication', function(ctx) {
    const channel = ctx.channel;
    const payload = JSON.stringify(ctx.data);
    console.log('Publication from server-side channel', channel, payload);
});

centrifuge.connect();
```

I.e. listen for publications without any usage of subscription objects. You can get a channel publication relates to by using field in the callback context as shown in the example above.

:::tip

The same [best practices](../faq/index.md#what-about-best-practices-with-the-number-of-channels) of working with channels and client-side subscriptions equally applicable to server-side subscription. 

:::

### Dynamic server-side subscriptions

See subscribe and unsubscribe [server API](server_api.md)

### Automatic personal channel subscription

It's possible to automatically subscribe a user to a personal server-side channel.

To enable this you need to enable the `client.subscribe_to_user_personal_channel.enabled` boolean option (by default `false`). As soon as you do this every connection with a non-empty user ID will be automatically subscribed to a personal user-limited channel. Anonymous users with empty user IDs won't be subscribed to any channel.

For example, if you set this option and the user with ID `87334` connects to Centrifugo it will be automatically subscribed to channel `#87334` and you can process personal publications on the client-side in the same way as shown above.

As you can see by default generated personal channel name belongs to the default namespace (i.e. no explicit namespace used). To set custom namespace name use `client.subscribe_to_user_personal_channel.personal_channel_namespace` option (string, default `""`) – i.e. the name of namespace from configured configuration namespaces array. In this case, if you set `client.subscribe_to_user_personal_channel.personal_channel_namespace` to `personal` for example – then the automatically generated personal channel will be `personal:#87334` – user will be automatically subscribed to it on connect and you can use this channel name to publish personal notifications to the online user.

### Maintain single user connection

Usage of personal channel subscription also opens a road to enable one more feature: maintaining only a single connection for each user globally around all Centrifugo nodes.

`client.subscribe_to_user_personal_channel.single_connection` boolean option (default `false`) turns on a mode in which Centrifugo will try to maintain only a single connection for each user at the same moment. As soon as the user establishes a connection other connections from the same user will be closed with connection limit reason (client won't try to automatically reconnect).

This feature works with a help of presence information inside a personal channel. So **presence should be turned on in a personal channel**.

Example config:

```json title="config.json"
{
  "client": {
    "subscribe_to_user_personal_channel": {
      "enabled": true,
      "personal_channel_namespace": "personal",
      "single_connection": true
    }
  },
  "channel": {
    "namespaces": [
      {
        "name": "personal",
        "presence": true
      }
    ]
  }
}
```

:::note

Centrifugo can't guarantee that other user connections will be closed – since Disconnect messages are distributed around Centrifugo nodes with at most once guarantee. So don't add critical business logic based on this feature to your application. Though this should work just fine most of the time if the connection between the Centrifugo node and PUB/SUB broker is OK.

:::
