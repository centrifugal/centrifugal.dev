---
id: presence
title: Online presence
---

The online presence feature of Centrifugo is a powerful tool that allows you to monitor and manage active users in real-time on a specific channel. It provides live data about which users are currently connected to your application.

## Overview

Online presence provides an instantaneous snapshot of users currently connected to a specific channel. This information includes the user's unique ID and the connection timestamp.

## Enabling Online Presence

To enable Online Presence, you need to set the `presence` option to `true` for the specific channel in your server configuration.

```javascript
{
    "namespaces": [{
        "namespace": "public",
        "presence": true
    }]
}
```

After enabling this you can query presence information over server HTTP/GRPC presence call:

```bash
curl --header "Content-Type: application/json" \
  --header "Authorization: apikey YOUR_API_KEY" \
  --request POST \
  --data '{"method": "presence", "params": {"channel": "public:test"}}' \
  http://localhost:8000/api
```

See [description of presence API](./server_api.md#presence).

## Retrieving presence on the client side

Once presence enabled, you can retrieve the presence information on the client side too by calling the presence method on the channel.

To do this you need to [give the client permission to call presence](./channel_permissions.md#presence-permission-model). Once done, presence may be retrieved from the subscription: 

```javascript
const presenceData = await subscription.presence(channel);
```

It's also available on the top-level of the client (for example, if you need to call presence for server-side subscription):

```javascript
const presenceData = await client.presence(channel);
```

If the permission check has passed successfully – both methods will return an object containing information about currently subscribed clients.

## Join and leave events

Online Presence feature also allows real-time tracking of users joining or leaving a channel by subscribing to `join` and `leave` events:

```javascript
subscription.on('join', function(joinCtx) {
    console.log('client joined:', joinCtx);
});

subscription.on('leave', function(leaveCtx) {
    console.log('client left:', leaveCtx);
});
```

And the same on `client` top-level for the needs of server-side subscriptions (analogous to the presence call described above).

These events provide real-time updates and can be used to keep track of user activity and manage live interactions.

## Implementation notes

The Online Presence feature might increase the load on your Centrifugo server, since Centrifugo need to maintain an addition data structure. Therefore, it is recommended to use this feature judiciously based on your server's capability and the necessity of real-time presence data in your application.

Always make sure to secure the presence data, as it could expose sensitive information about user activity in your application. Ensure appropriate security measures are in place.

Join and leave events delivered with at most once guarantee.

See [more about presence design](../getting-started/design.md#online-presence-considerations) in design overview chapter.

Also [check out FAQ](../faq/index.md#how-scalable-is-the-online-presence-and-joinleave-features).

## Conclusion

The Online Presence feature of Centrifugo is a highly useful tool for real-time applications. It provides instant and live data about user activity, which can be critical for interactive features like chats, collaborative tools, multiplayer games, or live tracking systems. Make sure to configure and use this feature appropriately to get the most out of your real-time application.
