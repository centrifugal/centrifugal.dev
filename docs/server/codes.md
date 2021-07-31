---
id: codes
title: Error and disconnect codes
---

This chapter describes error and disconnect codes Centrifugo uses in a client protocol, also error codes which a server API can return in response.

## Client error codes

Client errors are errors that can be returned to a client in replies to commands. This is specific for bidirectional client protocol only. For example, an error can be returned inside a reply to a subscribe command issued by a client.

Here is the list of Centrifugo built-in client error codes (with proxy feature you have a way to use custom error codes in replies or reuse existing).

### Internal

Code:    100,
Message: "internal server error".

Error Internal means server error, if returned this is a signal that something went wrong with a server itself and client most probably not guilty.

### Unauthorized

Code:    101,
Message: "unauthorized".

Error Unauthorized says that request is unauthorized.

### Unknown Channel

Code:    102,
Message: "unknown channel".

Error Unknown Channel means that channel name does not exist.

Usually this is returned when client uses channel with a namespace which is not defined in Centrifugo configuration.

### Permission Denied

Code:    103,
Message: "permission denied".

Error Permission Denied means that access to resource not allowed.

### Method Not Found

Code:    104,
Message: "method not found".

Error Method Not Found means that method sent in command does not exist.

### Already Subscribed

Code:    105,
Message: "already subscribed".

Error Already Subscribed returned when client wants to subscribe on channel it already subscribed to.

### Limit Exceeded

Code:    106,
Message: "limit exceeded".

Error Limit Exceeded says that some sort of limit exceeded, server logs should give more detailed information. See also ErrorTooManyRequests which is more specific for rate limiting purposes.

### Bad Request 

Code:    107,
Message: "bad request".

Error Bad Request says that server can not process received data because it is malformed. Retrying request does not make sense.

### Not Available

Code:    108,
Message: "not available".

Error Not Available means that resource is not enabled.

For example, this can be returned when trying to access history or presence in a channel that is not configured for having history or presence features.

### Token Expired

Code:    109,
Message: "token expired".

Error Token Expired indicates that connection token expired.

### Expired

Code:    110,
Message: "expired".

Error Expired indicates that connection expired (no token involved).

### Too Many Requests

Code:    111,
Message: "too many requests".

Error Too Many Requests means that server rejected request due to rate limiting strategies.

### Unrecoverable Position

Code:    112,
Message: "unrecoverable position".

Error Unrecoverable Position means that stream does not contain required range of publications to fulfill a history query.

This can happen due to wrong epoch passed.

## Client disconnect codes

Client can be disconnected by a Centrifugo server with custom code and string reason. Here is the list of Centrifugo built-in disconnect codes (with proxy feature you have a way to use custom disconnect codes).

:::note

We expect that in most situations developers don't need to programatically deal with handling various disconnect codes, but since Centrifugo sends them and codes shown in server metrics – they are documented. Actually most client connectors don't provide access to reading a disconnect code these days (only a reason). This is what we are [planning to improve](https://github.com/centrifugal/centrifuge/issues/149).

:::

### Normal

Code:      3000.

DisconnectNormal is clean disconnect when client cleanly closed connection. This is mostly useful for server metrics, since client never receives this disconnect code (since already gone).

### Shutdown

Code:      3001,
Reason:    "shutdown",
Reconnect: true.

Disconnect Shutdown sent when node is going to shut down.

### Invalid Token

Code:      3002,
Reason:    "invalid token",
Reconnect: false.

Disconnect Invalid Token sent when client came with invalid token.

### Bad Request

Code:      3003,
Reason:    "bad request",
Reconnect: false.

Disconnect Bad Request sent when client uses malformed protocol

### Server Error

Code:      3004,
Reason:    "internal server error",
Reconnect: true.

Disconnect Server Error sent when internal error occurred on server.

### Expired

Code:      3005,
Reason:    "expired",
Reconnect: true.

Disconnect Expired sent when client connection expired.

### Subscription Expired

Code:      3006,
Reason:    "subscription expired",
Reconnect: true.

Disconnect Subscription Expired sent when client subscription expired.

### Stale

Code:      3007,
Reason:    "stale",
Reconnect: false.

Disconnect Stale sent to close connection that did not become authenticated in configured interval after dialing. Usually this means a broken client implementation.

### Slow

Code:      3008,
Reason:    "slow",
Reconnect: true.

Disconnect Slow sent when a client can't read messages fast enough.

### Write Error

Code:      3009,
Reason:    "write error",
Reconnect: true.

Disconnect Write Error sent when an error occurred while writing to client connection.

### Insufficient State

Code:      3010,
Reason:    "insufficient state",
Reconnect: true.

Disconnect Insufficient State sent when server detects wrong client position in channel Publication stream. Disconnect allows client to restore missed publications on reconnect.

### Force Reconnect

Code:      3011,
Reason:    "force reconnect",
Reconnect: true.

Disconnect Force Reconnect sent when server disconnects connection but want it to return back shortly.

### Force No Reconnect

Code:      3012,
Reason:    "force disconnect",
Reconnect: false.

Disconnect Force No Reconnect sent when server disconnects connection and asks it to not reconnect again.

### Connection Limit

Code:      3013,
Reason:    "connection limit",
Reconnect: false.

Disconnect Connection Limit can be sent when client connection exceeds a configured connection limit (per user ID or due to other rule).

## Server API error codes

Server API errors are errors that can be returned to a API caller in replies to commands (in both HTTP and GRPC server APIs).

### Internal

Code:    100,
Message: "internal server error".

ErrorInternal means server error, if returned this is a signal that something went wrong with Centrifugo itself.

### Unknown channel

Code:    102,
Message: "unknown channel".

Error Unknown Channel means that namespace in channel name does not exist.

### Method Not Found

Code:    104,
Message: "method not found".

Error Method Not Found means that method sent in command does not exist in Centrifugo.

### Bad Request

Code:    107,
Message: "bad request".

Error Bad Request says that Centrifugo can not parse received data because it is malformed or there are required fields missing.

### Not Available   

Code:    108,
Message: "not available".

Error Not Available means that resource is not enabled.

### Unrecoverable Position

Code:    112,
Message: "unrecoverable position".

ErrorUnrecoverablePosition means that stream does not contain required range of publications to fulfill a history query.

This can happen due to wrong epoch.
