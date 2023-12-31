---
id: client_api
title: Client API showcase
---

This chapter showcases the capabilities of Centrifugo's bidirectional client API – i.e., the real-time messaging primitives available on the front end (which can be a browser or a mobile device).

:::tip

It is also possible to avoid using the client library at all with unidirectional transports (../transports/overview.md).

:::

This is a formal description – we use the JavaScript client `centrifuge-js` for examples here. Refer to each specific client implementation for concrete method names and possibilities. See the [full list of Centrifugo client SDKs](../transports/client_sdk.md). This description does not cover all protocol possibilities – just the most important ones to start with.

If you are looking for detailed information about the client-server protocol internals, then the [client protocol description](../transports/client_protocol.md) chapter can help.

## Connecting to a server

Each Centrifugo client allows connecting to a server.

```javascript
const centrifuge = new Centrifuge('ws://localhost:8000/connection/websocket');
centrifuge.connect();
```

In most cases you will need to pass JWT (JSON Web Token) for authentication, so the example above transforms to:

```javascript
const centrifuge = new Centrifuge('ws://localhost:8000/connection/websocket');
centrifuge.setToken('<USER-JWT>')
centrifuge.connect();
```

See [authentication](../server/authentication.md) chapter for more information on how to generate connection JWT.

If you are using [connect proxy](../server/proxy.md#connect-proxy) then you may go without setting JWT.

## Disconnecting from a server

After connecting you can disconnect from a server at any moment.

```javascript
centrifuge.disconnect();
```

## Reconnecting to a server

Centrifugo clients automatically reconnect to a server in case of temporary connection loss, also clients periodically ping the server to detect broken connections.

## Connection lifecycle events

All client implementations allow setting handlers on connect and disconnect events.

For example:

```javascript
centrifuge.on('connect', function(connectCtx){
    console.log('connected', connectCtx)
});

centrifuge.on('disconnect', function(disconnectCtx){
    console.log('disconnected', disconnectCtx)
});
```

## Subscribe to a channel

Another core functionality of client API is the possibility to subscribe to a channel to receive all messages published to that channel.

```javascript
centrifuge.subscribe('channel', function(messageCtx) {
    console.log(messageCtx);
})
```

Clients can subscribe to [different channels](../server/channels.md). The subscribe method returns the `Subscription` object. It's also possible to react to different Subscription events: join and leave events, subscribe success and subscribe error events, unsubscribe events.

In the idiomatic case, messages are published to channels from the application backend [over the Centrifugo server API](../server/server_api.md). However, this is not always the case.

Centrifugo also provides a message recovery feature to restore missed publications in channels. Publications can be missed due to temporary disconnects (bad network) or server reloads. Recovery happens automatically on reconnect (due to bad network or server reloads) as soon as recovery in the channel is [properly configured](../server/channels.md#channel-options). The client keeps the last seen Publication offset and restores missed publications since the known offset upon reconnecting. If recovery fails, then the client implementation provides a flag inside the subscribe event to let the application know that some publications were missed – so you may need to load the state from scratch from the application backend. Not all Centrifugo clients implement a recovery feature – refer to specific client implementation docs. More details about recovery can be found in [a dedicated chapter](../server/history_and_recovery.md).

## Server-side subscriptions

To handle publications coming from [server-side subscriptions](../server/server_subs.md) client API allows listening publications simply on Centrifuge client instance:

```javascript
centrifuge.on('publish', function(messageCtx) {
    console.log(messageCtx);
});
```

It's also possible to react on different server-side Subscription events: join and leave events, subscribe success, unsubscribe event. There is no subscribe error event here since the subscription was initiated on the server-side.

## Send RPC

A client can send an RPC to the server. RPC is a call that is not related to channels at all. It's just a way to call a server method from the client side over the WebSocket or SockJS connection. RPC is only available when an [RPC proxy](../server/proxy.md#rpc-proxy) is configured.

```javascript
const rpcRequest = {'key': 'value'};
const data = await centrifuge.namedRPC('example_method', rpcRequest);
```

## Call channel history

Once subscribed client can call publication history inside a channel (only for channels where [history configured](../server/channels.md#channel-options)) to get last publications in channel:

Get stream current top position:

```javascript
const resp = await subscription.history();
console.log(resp.offset);
console.log(resp.epoch);
```

Get up to 10 publications from history since known stream position:

```javascript
const resp = await subscription.history({limit: 10, since: {offset: 0, epoch: '...'}});
console.log(resp.publications);
```

Get up to 10 publications from history since current stream beginning:

```javascript
const resp = await subscription.history({limit: 10});
console.log(resp.publications);
```

Get up to 10 publications from history since current stream end in reversed order (last to first):

```javascript
const resp = await subscription.history({limit: 10, reverse: true});
console.log(resp.publications);
```

## Presence and presence stats

Once subscribed client can call presence and presence stats information inside channel (only for channels where [presence configured](../server/channels.md#channel-options)):

For presence (full information about active subscribers in channel):

```javascript
const resp = await subscription.presence();
// resp contains presence information - a map client IDs as keys 
// and client information as values.
```

For presence stats (just a number of clients and unique users in a channel):

```javascript
const resp = await subscription.presenceStats();
// resp contains a number of clients and a number of unique users.
```
