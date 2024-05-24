---
id: codes
title: Error and disconnect codes
---

This chapter describes error and disconnect codes Centrifugo uses in a client protocol, also error codes which a server API can return in response.

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

Error Already Subscribed returned when client wants to subscribe on channel it already subscribed to.

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

DisconnectInsufficientState issued when server detects wrong client position in channel Publication stream. Disconnect allows client to restore missed publications on reconnect.

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
