---
id: client_api_v2
title: Client API V2
---

Centrifugo has several client SDKs to establish a realtime connection with a server. Most of our libraries use WebSocket transport and send messages encoded with our own bidirectional protocol. That protocol allows asynchronous communication, sending RPC, multiplexing subscriptions to channels.

For Centrifugo v4 we are introducing a new generation of SDKs for Javascript, Dart, Go, Swift and Java.

This chapter describes core concepts of client SDKs which work according new concepts. Here we show examples using our Javascript client (`centrifuge-js`), but all other connectors now have similar semantics and API.

### Client connection states

Client connection has 4 states:

* `disconnected`
* `connecting`
* `connected`
* `closed`

:::note

`closed` state is only implemented by SDKs where it makes sense (need to clean up allocated resources when app gracefully shuts down – for example in Java SDK we close thread executors used internally).

:::

When new Client created it has `disconnected` state. To connect to a server `connect()` method should be called. After calling connect Client moves to `connecting` state. If Client can't connect to a server it attempts to create a connection with exponential backoff algorithm (with jitter). If connection to a server is successful then the state becomes `connected`.

If connection is lost (due to missing network for example, or due to reconnect advice received from a server, or due to some client-side error which can't be recovered without reconnect) Client goes to `connecting` state again. In this state Client tries to reconnect (again, with exponential backoff algorithm).

Client state can become `disconnected`. This happens when Client's `disconnect()` method was called by a developer, also this can happen due to advice from a server, or due to terminal problem happened on client side.

```javascript
const centrifuge = new Centrifuge('ws://localhost:8000/connection/websocket', {});

centrifuge.on('connecting', function(ctx) {
    console.log('connecting');
});

centrifuge.on('connected', function(ctx) {
    console.log('connected');
});

centrifuge.on('disconnected', function(ctx) {
    console.log('disconnected');
});

centrifuge.connect();
```

In case of successful connection client states will transition like this: `disconnected` (initial) -> `connecting` (`on('connecting')` callback called) -> `connected` (`on('connected')` callback called).

You can listen for all errors happening internally while client works by using `error` event:

```javascript
centrifuge.on('error', function(ctx) {
    console.log('client error', ctx);
});
```

If you want to disconnect from a server call `.disconnect()` method:

```javascript
centrifuge.disconnect();
```

In this case `on('disconnected')` will be called. You can call `connect()` again when you need to establish connection.

`closed` state implemented in SDKs where resources like internal queues, thread executors, etc must be cleaned up when client is not needed anymore. 

### Client common options

There are several common options available when creating Client instance.

### Client methods

* `send`
* `rpc`
* `publish`
* `history`
* `presence`
* `presenceStats`

### Client connection token

Can be set.

Will be refreshed.

### Client-server PING/PONG

PINGs sent by a server, client should answer with PONGs upon receivng PING. If client does not receive PING from a server for a long time (ping interval + configured delay) – then connection is considered broken and will be re-established.

### Subscription states

Client allows subscribing on channels. This can be done by creating `Subscription` object.

```javascript
const sub = centrifuge.newSubscription(channel);
sub.subscribe();
```

When `newSubscription` called Client allocates new Subscription instance and saves it in internal subscription registry. Having registry of allocated subscriptions allows SDK to manage resubscribes upon reconnect to a server. Centrifugo connectors do not allow creating two subscrptions to the same channel – in this case `newSubscription` can throw exception.

Subscription has 3 states:

* `unsubscribed`
* `subscribing`
* `subscribed`

When new Subscription created it has `unsubscribed` state.

To initiate actual process of subscribing to a channel `subscribe()` method of Subscription instance should be called. After calling `subscribe()` Subscription moves to `subscribing` state.

If subscription to a channel is not successful then depending on error type subscription can automatically resubscribe (with exponential backoff) or go to `unsubscribed` state (upon non-temporary error). If subscription to a channel is successful then the state becomes `subscribed`.

```javascript
const sub = centrifuge.newSubscription(channel);

sub.on('subscribing', function(ctx) {
    console.log('subscribing');
});

sub.on('subscribed', function(ctx) {
    console.log('subscribed');
});

sub.on('unsubscribed', function(ctx) {
    console.log('unsubscribed');
});

sub.subscribe();
```

Subscriptions also go to `subscribing` state when Client connection (i.e. transport) becomes unavailable. Upon connection re-establishement all subscriptions which are not in `unsubscribed` state will resubscribe automatically.

You can listen for all errors happening internally in Subscription by using `error` event:

```javascript
sub.on('error', function(ctx) {
    console.log("subscription error", ctx);
});
```

If you want to unsubscribe from a channel call `.unsubscribe()` method:

```javascript
sub.unsubscribe();
```

In this case `on('unsubscribed')` will be called. Subscription still kept in Client's registry, but no resubscription attempts will be made. You can call `subscribe()` again when you need Subscription again. Or you can remove Subscription from Client's registry (see below).

### Subscription management

Client provides several methods to manage internal registry of client-side subscriptions.

`newSubscription(channel, options)` allocates new Subscription in registry of throws exception if Subscription already there. We will discuss common Subscription options below. 

`getSubscription(channel)` returns existing Subscription by channel from registry (or null if it does not exist).

`removeSubscription(sub)` removes Subscription from Client's registry. Subscription is automatically unsubscribed before being removed. Use this to free resources if you don't need Subscription to a channel anymore.

`subscriptions()` returns all registered subscriptions, so you can iterate over all and do some action if required (for example, you want to unsubscribe/remove all subscriptions).

### Listen to channel publications

Of course the main point of having Subscriptions is the ability to listen for publications (i.e. messages published to a channel).

```javascript
sub.on('publication', function(ctx) {
    console.log("received publication", ctx);
});
```

Publication context has several fields:

* `data` - publication payload, this can be JSON or binary data
* `offset` - optional offset inside history stream, this is an incremental number
* `tags` - optional tags, this is a map with string keys and string values
* `info` - optional information about client connection who published this (only exists if publication comes from client-side `publish()` API).

So minimal code where we connect to a server and listen for messages published into `example` channel may look like:

```javascript
const centrifuge = new Centrifuge('ws://localhost:8000/connection/websocket', {});

const sub = centrifuge.newSubscription('example').on('publication', function(ctx) {
    console.log("received publication from a channel", ctx.data);
});

sub.subscribe();

centrifuge.connect();
```

Note, that we can call `subscribe()` before making a connection to a server – at this will work just fine, subscription goes to `subscribing` state and will be subscribed upon succesfull connection.

### Subscription recovery state

Subscriptions to channels with `recover` option enabled maintain stream position information internally. On every publication received this information updated and used to recover missed publications upon resubscribe (caused by reconnect for example).

When you call `unsubscribe()` Subscription position state is not cleared. So it's possible to call `subscribe()` later and catch up a state.

The recovery process result – i.e. whether all missed publications recovered or not – can be found in `on('subscribed')` event context. Centrifuge protocol provides two fields:

* `wasRecovering` - boolean flag that tells whether recovery was used during subscription process resulted into subscribed state. Can be useful if you want to distinguish first subscribe attempt (when subscription does not have any position information yet)
* `recovered` - boolean flag that tells whether Centrifugo thinks that all missed publications can be successfully recovered and there is no need to load state from the main application database. It's always `false` when `wasRecovering` is `false`.

### Subscription common options

There are several common options available when creating Subscription instance.

### Subscription methods

* `publish`
* `history`
* `presence`
* `presenceStats`

### Subscription token

Can be set.

Will be refreshed.

### Best practices working with SDKs

* Callbacks must be fast. Avoid blocking operations inside event handlers.
* Log `error` events of Client and Subscription
* Do not blindly rely on current Client or Subscription state when making API call – state can change at any moment, so handle errors
* Disconnect from a server when mobile application goes to background since mobile OS can kill the connection at some point without any callbacks called.
