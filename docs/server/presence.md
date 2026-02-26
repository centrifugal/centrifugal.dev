---
description: "Centrifugo online presence feature for tracking active channel subscribers in real-time. Includes join/leave events, custom info, and client-side retrieval."
id: presence
title: Online presence
---

The online presence feature in Centrifugo is a powerful tool for monitoring and managing active users within a specific channel. It provides a real-time view of users currently subscribed to that channel. Additionally, Centrifugo can emit join and leave events to all channel subscribers whenever clients subscribe to or unsubscribe from a channel, allowing you to track user activity more effectively.

## Enabling online presence

To enable online presence, you need to set the `presence` option to `true` for the specific channel namespace in your Centrifugo configuration.

```json
{
  "channel": {
    "namespaces": [
      {
        "name": "public",
        "presence": true
      }
    ]
  }
}
```

After enabling this you can query presence information over server HTTP/GRPC presence call:

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: YOUR_API_KEY" \
  --request POST \
  --data '{"channel": "public:test"}' \
  http://localhost:8000/api/presence
```

See [description of presence API](./server_api.md#presence).

Also, a shorter version of presence which only contains two counters - number of clients and number of unique users in channel - may be called:

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: YOUR_API_KEY" \
  --request POST \
  --data '{"channel": "public:test"}' \
  http://localhost:8000/api/presence_stats
```

See [description of presence stats API](./server_api.md#presence_stats).

## Retrieving presence on the client side

Once presence enabled, you can retrieve the presence information on the client side too by calling the presence method on the channel.

To do this you need to [give the client permission to call presence](./channel_permissions.md#presence-permission-model). Once done, presence may be retrieved from the subscription: 

```javascript
const resp = await subscription.presence(channel);
```

It's also available on the top-level of the client (for example, if you need to call presence for server-side subscription):

```javascript
const resp = await client.presence(channel);
```

If the permission check has passed successfully – both methods will return an object containing information about currently subscribed clients.

Also, `presenceStats` method is avalable:

```javascript
const resp = await subscription.presenceStats(channel);
```

## Connection and channel custom info

It's possible to extend presence information with `info` (connection-wide) and `chan_info` (channel specific) additional information.

For connection wide `info` data may be taken by Centrifugo from:

* connection token [info](https://centrifugal.dev/docs/server/authentication#info) claim
* connect proxy [result](https://centrifugal.dev/docs/server/proxy#connect-result-fields) `info` field

For channel-specific `chan_info`:

* from subscription token [info](https://centrifugal.dev/docs/server/channel_token_auth#info) claim
* from subscribe proxy [result](https://centrifugal.dev/docs/server/proxy#subscribe-result-fields) `info` field

After adding additional information you will receive `info` and `chan_info` in presence responses.

:::tip

Be careful to not expose specific connection sensitive data with all other users in channel.

:::

Both `info` and `chan_info` once specified will be also attached to join and leave events.

## Join and leave events

It's also possible to enable real-time tracking of users joining or leaving a channel by listening to `join` and `leave` events on the client side.

By default, Centrifugo does not send these events and they must be explicitly turned on for channel namespace:

```json
{
  "channel": {
    "namespaces": [
      {
        "name": "public",
        "presence": true,
        "join_leave": true,
        "force_push_join_leave": true
      }
    ]
  }
}
```

Then on the client side:

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

You can combine join/leave events with presence information and maintain a list of currently active subscribers - for example show the list of online players in the game room updated in real-time.

## Implementation notes

The online presence feature might increase the load on your Centrifugo server, since Centrifugo need to maintain an addition data structure. Therefore, it is recommended to use this feature judiciously based on your server's capability and the necessity of real-time presence data in your application.

Always make sure to secure the presence data, as it could expose sensitive information about user activity in your application. Ensure appropriate security measures are in place.

Join and leave events delivered with at most once guarantee.

See [more about presence design](../getting-started/design.md#online-presence-considerations) in design overview chapter.

Also [check out FAQ](../faq/index.md#how-scalable-is-the-online-presence-and-joinleave-features) which mentions scalability concerns for presence data and join/leave events.

## Conclusion

The online presence feature of Centrifugo is a highly useful tool for real-time applications. It provides instant and live data about user activity, which can be critical for interactive features in chats, collaborative tools, multiplayer games, or live tracking systems. Make sure to configure and use this feature appropriately to get the most out of your real-time application.
