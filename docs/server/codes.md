---
id: codes
title: Client protocol codes
---

This chapter describes error, unsubscribe and disconnect codes Centrifugo uses in a client protocol, also error codes which a server API can return in response.

## Client error codes

Client errors are errors that can be returned to a client in replies to commands. This is specific for bidirectional client protocol only. For example, an error can be returned inside a reply to a subscribe command issued by a client.

Here is the list of Centrifugo built-in client error codes (with proxy feature you have a way to use custom error codes in replies or reuse existing).

### Internal

```
Code:    100
Message: "internal server error"
Temporary: true
```

Error Internal means server error, if returned this is a signal that something went wrong with a server itself and client most probably not guilty.

### Unauthorized

```
Code:    101
Message: "unauthorized"
```

Error Unauthorized says that request is unauthorized.

### Unknown Channel

```
Code:    102
Message: "unknown channel"
```

Error Unknown Channel means that channel name does not exist.

Usually this is returned when client uses channel with a namespace which is not defined in Centrifugo configuration.

### Permission Denied

```
Code:    103
Message: "permission denied"
```

Error Permission Denied means that access to resource not allowed.

### Method Not Found

```
Code:    104
Message: "method not found"
```

Error Method Not Found means that method sent in command does not exist.

### Already Subscribed

```
Code:    105
Message: "already subscribed"
```

Error Already Subscribed returned when a client attempts to subscribe to a channel to which it is already subscribed.

In Centrifugo, a client can only have one subscription to a specific channel.

When using client-side subscriptions, this error may signal a bug in the SDK or the SDK being used in a way that was not planned. This error may also be returned by the server when a client tries to subscribe to a channel but is already subscribed to it using [server-side subscriptions](./server_subs.md).

### Limit Exceeded

```
Code:    106
Message: "limit exceeded"
```

Error Limit Exceeded says that some sort of limit exceeded, server logs should give more detailed information. See also ErrorTooManyRequests which is more specific for rate limiting purposes.

### Bad Request 

```
Code:    107
Message: "bad request"
```

Error Bad Request says that server can not process received data because it is malformed. Retrying request does not make sense.

### Not Available

```
Code:    108
Message: "not available"
```

Error Not Available means that resource is not enabled.

For example, this can be returned when trying to access history or presence in a channel that is not configured for having history or presence features.

### Token Expired

```
Code:    109
Message: "token expired"
```

Error Token Expired indicates that connection token expired. Our SDKs handle it in a special way by updating token.

### Expired

```
Code:    110
Message: "expired"
```

Error Expired indicates that connection expired (no token involved).

### Too Many Requests

```
Code:    111
Message: "too many requests"
Temporary: true
```

Error Too Many Requests means that server rejected request due to rate limiting strategies.

### Unrecoverable Position

```
Code:    112
Message: "unrecoverable position"
```

Error Unrecoverable Position means that stream does not contain required range of publications to fulfill a history query.

This can happen due to wrong epoch passed.

## Client unsubscribe codes

Client can be unsubscribed by a Centrifugo server with custom code and string reason. Here is the list of Centrifugo built-in unsubscribe codes.

:::note

We expect that in most situations developers don't need to programmatically deal with handling various unsubscribe codes, but since Centrifugo sends them and codes are shown in server metrics – they are documented. We expect these codes are mostly useful for logs and metrics. Increase in these metrics can be a signal of some problem in Centrifugo installation – the need to scale, network issues, an so on. 

:::

Unsubscribe codes >= 2500 coming from server to client must result into automatic resubscribe attempt (i.e. client goes to subscribing state). Codes < 2500 result into going to unsubscribed state. Our bidirectional SDKs handle this.

### UnsubscribeCodeServer

```
Code:   2000
Reason: "server unsubscribe"
```

UnsubscribeCodeServer set when unsubscribe event was initiated by an explicit server-side unsubscribe API call. No resubscribe will be made.

### UnsubscribeCodeInsufficient

```
Code:   2500
Reason: "insufficient state"
```

UnsubscribeCodeInsufficient is sent to unsubscribe client from a channel due to insufficient state in a stream. We expect client to resubscribe after receiving this code since it's still may be possible to recover a state since a known stream position.

Insufficient state in channel only happens in channels with positioning/recovery on – where Centrifugo detects message loss and message order issues.

Insufficient state in a stream means that Centrifugo detected message loss from the broker. Generally, rare cases of getting such unsubscribe code are OK, but if there is an increase in the amount of such codes – then this can be a signal of Centrifugo-to-Broker communication issue. The root cause should be investigated – it may be an unstable connection between Centrifugo and broker, or Centrifugo can't keep up with a message stream in a channel, or a broker skips messages for some reason.

### UnsubscribeCodeExpired

```
Code:   2501
Reason: "subscription expired"
```

UnsubscribeCodeExpired is sent when client subscription expired. We expect client to re-subscribe with updated subscription token.

## Client disconnect codes

Client can be disconnected by a Centrifugo server with custom code and string reason. Here is the list of Centrifugo built-in disconnect codes (with proxy feature you have a way to use custom disconnect codes).

:::note

We expect that in most situations developers don't need to programmatically deal with handling various disconnect codes, but since Centrifugo sends them and codes shown in server metrics – they are documented. We expect these codes are mostly useful for logs and metrics.

:::

### DisconnectConnectionClosed

```
Code: 3000
Reason: "connection closed"
```

DisconnectConnectionClosed is a special Disconnect object used when client connection was closed without any advice from a server side. This can be a clean disconnect, or temporary disconnect of the client due to internet connection loss. Server can not distinguish the actual reason of disconnect.

### Non-terminal disconnect codes

Client will reconnect after receiving such codes.

#### Shutdown

```
Code:      3001
Reason:    "shutdown"
```

Disconnect Shutdown may be sent when node is going to shut down.

#### DisconnectServerError

```
Code:   3004
Reason: "internal server error"
```

DisconnectServerError issued when internal error occurred on server.

#### DisconnectExpired

```
Code:   3005
Reason: "connection expired"
```

#### DisconnectSubExpired

```
Code:   3006
Reason: "subscription expired"
```

DisconnectSubExpired issued when client subscription expired.

#### DisconnectSlow

```
Code:   3008
Reason: "slow"
```

DisconnectSlow issued when client can't read messages fast enough.

#### DisconnectWriteError

```
Code:   3009
Reason: "write error"
```

DisconnectWriteError issued when an error occurred while writing to client connection.

#### DisconnectInsufficientState

```
Code:   3010
Reason: "insufficient state"
```

DisconnectInsufficientState issued when Centrifugo detects wrong client position in a channel stream. Disconnect allows client to restore missed publications on reconnect.

Insufficient state in channel only happens in channels with positioning/recovery on – where Centrifugo detects message loss and message order issues.

Insufficient state in a stream means that Centrifugo detected message loss from the broker. Generally, rare cases of getting such disconnect code are OK, but if there is an increase in the amount of such codes – then this can be a signal of Centrifugo-to-Broker communication issue. The root cause should be investigated – it may be an unstable connection between Centrifugo and broker, or Centrifugo can't keep up with a message stream in a channel, or a broker skips messages for some reason.


#### DisconnectForceReconnect

```
Code:   3011
Reason: "force reconnect"
```

DisconnectForceReconnect issued when server disconnects connection for some reason and whants it to reconnect.

#### DisconnectNoPong

```
Code:   3012
Reason: "no pong"
```

DisconnectNoPong may be issued when server disconnects bidirectional connection due to no pong received to application-level server-to-client pings in a configured time.

#### DisconnectTooManyRequests

```
Code:   3013
Reason: "too many requests"
```

DisconnectTooManyRequests may be issued when client sends too many commands to a server.

### Terminal disconnect codes

Client won't reconnect upon receiving such code.

#### DisconnectInvalidToken

```
Code:   3500
Reason: "invalid token"
```

DisconnectInvalidToken issued when client came with invalid token.

#### DisconnectBadRequest

```
Code:   3501
Reason: "bad request"
```

DisconnectBadRequest issued when client uses malformed protocol frames.

#### DisconnectStale

```
Code:   3502
Reason: "stale"
```

DisconnectStale issued to close connection that did not become authenticated in configured interval after dialing.

#### DisconnectForceNoReconnect

```
Code:   3503
Reason: "force disconnect"
```

DisconnectForceNoReconnect issued when server disconnects connection and asks it to not reconnect again.

#### DisconnectConnectionLimit

```
Code:   3504
Reason: "connection limit"
```

DisconnectConnectionLimit can be issued when client connection exceeds a configured connection limit (per user ID or due to other rule).

#### DisconnectChannelLimit

```
Code:   3505
Reason: "channel limit"
```

DisconnectChannelLimit can be issued when client connection exceeds a configured channel limit.

#### DisconnectInappropriateProtocol

```
Code:   3506
Reason: "inappropriate protocol"
```

DisconnectInappropriateProtocol can be issued when client connection format can not handle incoming data. For example, this happens when JSON-based clients receive binary data in a channel. This is usually an indicator of programmer error, JSON clients can not handle binary.

#### DisconnectPermissionDenied

```
Code:   3507
Reason: "permission denied"
```

DisconnectPermissionDenied may be issued when client attempts accessing a server without enough permissions.

#### DisconnectNotAvailable

```
Code:   3508
Reason: "not available"
```

DisconnectNotAvailable may be issued when ErrorNotAvailable does not fit message type, for example we issue DisconnectNotAvailable when client sends asynchronous message without MessageHandler set on server side.

#### DisconnectTooManyErrors

```
Code:   3509
Reason: "too many errors"
```

DisconnectTooManyErrors may be issued when client generates too many errors.
