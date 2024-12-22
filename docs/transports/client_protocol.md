---
id: client_protocol
title: Client protocol
---

This chapter describes the core concepts of Centrifugo bidirectional client protocol – concentrating on framing level. If you want to find out details about exposed client API then look at [client API](client_api.md) document.

We need our own protocol on top of real-time transport due to various reasons:

* Pass authentication and custom data to the server
* Implement request-response semantics (our main transport – WebSocket – does not provide this out of the box)
* Multiplex many subscriptions over a single physical connection
* Push different types of messages – publications, join/leave notifications
* Efficient ping-pong support
* Handle server disconnect advices

:::tip

In case of questions on how client protocol works/structured you can always look at [existing client SDKs](../transports/client_sdk.md).

:::

## Protobuf schema

Centrifugo is built on top of Centrifuge library for Go. Centrifuge library uses its own framing for wrapping Centrifuge-specific messages – synchronous commands from a client to a server (which expect replies from a server) and asynchronous pushes.  

Centrifuge client protocol is defined by a [Protobuf schema](https://github.com/centrifugal/protocol/blob/master/definitions/client.proto). This is the source of truth.

:::tip

At the moment Protobuf schema contains some fields which are only used in client protocol v1. This is for backwards compatibility – server supports clients connecting over both client protocol v2 and client protocol v1. Client protocol v1 is considered deprecated and will be removed at some point in the future (giving enough time to our users to migrate). 

:::

## Command-Reply

In bidirectional case client sends `Command` to a server and server sends `Reply` to a client. I.e. all communication between client and server is a bidirectional exchange of `Command` and `Reply` messages.

Each `Command` has `id` field. This is an incremental `uint32` field. This field will be echoed in a server replies to commands so client could match a certain `Reply` to `Command` sent before. This is important since Websocket is an asynchronous transport where server and client both send messages at any moment and there is no builtin request-response matching. Having `id` allows matching a reply with a command send before on SDK level.

In JSON case client can send command like this:

```json
{"id": 1, "subscribe": {"channel": "example"}}
```

And client can expect something like this in response:

```json
{"id": 1, "subscribe": {}}
```

`Reply` for different commands has corresponding field with command result (`"subscribe"` in example above).

`Reply` can also contain `error` if `Command` processing resulted into an error on a server. `error` is optional and if `Reply` does not have `error` then it means that `Command` processed successfully and client can handle result object appropriately.

`error` looks like this in JSON case:

```json
{
    "code": 100,
    "message": "internal server error",
    "temporary": true
}
```

I.e. reply with error may look like this:

```json
{"id": 1, "error": {"code": 100, "message": "internal server error"}}
```

We will talk more about error handling below.

Centrifuge library defines several command types client can issue. A well-written client must be aware of all those commands and client workflow.

Current commands:

* `connect` – sent to authenticate connection, sth like hello from a client which can carry authentication token and arbitrary data.
* `subscribe` – sent to subscribe to a channel
* `unsubscribe` - sent to unsubscribe from a channel
* `publish` - sent to publish data into a channel
* `presence` - sent to request presence information from a channel
* `presence_stats` - sent to request presence stats information from a channel
* `history` - sent to request history information for a channel
* `send` - sent to send async message to a server (this command is a bit special since it must not contain `id` - as we don't wait for any response from a server in this case).
* `rpc` - sent to send RPC to a channel (execute arbitrary logic and wait for response)
* `refresh` - sent to refresh connection token
* `sub_refresh` - sent to refresh channel subscription token

## Asynchronous pushes

The special type of `Reply` is **asynchronous** `Reply`. Such replies have no `id` field set (or `id` can be equal to zero). Async replies can come to a client at any moment - not as reaction to issued `Command` but as a message from a server to a client at arbitrary time. For example, this can be a message published into channel.

There are several types of asynchronous messages that can come from a server to a client.

* `pub` is a message published into channel
* `join` messages sent when someone joined (subscribed on) channel.
* `leave` messages sent when someone left (unsubscribed from) channel.
* `unsubscribe` message sent when a server unsubscribed current client from a channel:
* `subscribe` may be sent when a server subscribes client to a channel.
* `disconnect` may be sent be a server before closing connection and contains disconnect code/reason
* `message` may be sent when server sends asynchronous message to a client
* `connect` push can be sent in unidirectional transport case
* `refresh` may be sent when a server refreshes client credentials (useful in unidirectional transports)

## Top level batching

To reduce number of system calls one request from a client to a server and one response from a server to a client can have more than one `Command` or `Reply`. This allows reducing number of system calls for writing and reading data.

When JSON format used then many `Command` can be sent from client to server in JSON streaming line-delimited format. I.e. each individual `Command` encoded to JSON and then commands joined together using new line symbol `\n`:

```json
{"id": 1, "subscribe": {"channel": "ch1"}}
{"id": 2, "subscribe": {"channel": "ch2"}}
```

Here is an example how we do this in Javascript client when JSON format used:

```javascript
function encodeCommands(commands) {
    const encodedCommands = [];
    for (const i in commands) {
      if (commands.hasOwnProperty(i)) {
        encodedCommands.push(JSON.stringify(commands[i]));
      }
    }
    return encodedCommands.join('\n');
}
```

:::info

This doc uses JSON format for examples because it's human-readable. Everything said here for JSON is also true for Protobuf encoded case. There is a difference how several individual `Command` or server `Reply` joined into one request – see details below. Also, in JSON format `bytes` fields transformed into embedded JSON by Centrifugo.

:::

When Protobuf format used then many `Command` can be sent from a client to a server in a length-delimited format where each individual `Command` marshaled to bytes prepended by `varint` length. See existing client implementations for encoding example.

The same rules relate to many `Reply` in one response from server to client. Line-delimited JSON and varint-length prefixed Protobuf also used there.

:::tip

Server can even send reply to a command and asynchronous message batched together in a one frame.

:::

For example here is how we read server response and extracting individual replies in Javascript client when JSON format used:

```javascript
function decodeReplies(data) {
    const replies = [];
    const encodedReplies = data.split('\n');
    for (const i in encodedReplies) {
      if (encodedReplies.hasOwnProperty(i)) {
        if (!encodedReplies[i]) {
          continue;
        }
        const reply = JSON.parse(encodedReplies[i]);
        replies.push(reply);
      }
    }
    return replies;
}
```

For Protobuf case see existing client implementations for decoding example.

## Ping Pong

To maintain connection alive and detect broken connections server periodically sends empty commands to clients and expects empty replies from them.

When client does not receive ping from a server for some time it can consider connection broken and try to reconnect. Usually a server sends pings every 25 seconds.

## Handle disconnects

Client should handle disconnect advices from server. In websocket case disconnect advice is sent in CLOSE Websocket frame. Disconnect advice contains `uint32` `code` and human-readable `string` `reason`.

## Handle errors

This section contains advices to error handling in client implementations.

Errors can happen during various operations and can be handled in special way in context of some commands to tolerate network and server problems.

Errors during `connect` must result in full client reconnect with exponential backoff strategy. The special case is error with code `110` which signals that connection token already expired. As we said above client should update its connection JWT before connecting to server again.  

Errors during `subscribe` must result in full client reconnect in case of internal error (code `100`). And be sent to subscribe error event handler of subscription if received error is persistent. Persistent errors are errors like `permission denied`, `bad request`, `namespace not found` etc. Persistent errors in most situation mean a mistake from developers side.

The special corner case is client-side timeout during `subscribe` operation. As protocol is asynchronous it's possible in this case that server will eventually subscribe client on channel but client will think that it's not subscribed. It's possible to retry subscription request and tolerate `already subscribed` (code `105`) error as expected. But the simplest solution is to reconnect entirely as this is simpler and gives client a chance to connect to working server instance.

Errors during rpc-like operations can be just returned to caller - i.e. user javascript code. Calls like `history` and `presence` are idempotent. You should be accurate with non-idempotent operations like `publish` - in case of client timeout it's possible to send the same message into channel twice if retry publish after timeout - so users of libraries must care about this case – making sure they have some protection from displaying message twice on client side (maybe some sort of unique key in payload).

## Additional notes

Client protocol does not allow one client connection to subscribe to the same channel twice. In this case client will receive `already subscribed` error in a reply to a subscribe command.