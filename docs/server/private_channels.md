---
id: private_channels
title: Private channels
---

In the [channels](channels.md) chapter we mentioned private channels. This chapter has more information about private channel mechanism in Centrifugo.

All channels starting with `$` considered private. Your backend should additionally provide a token for every subscription request to a private channel. This way you can control subscription permissions and only allow certain users to subscribe to a channel.

The way how this token obtained varies depending on a client connector implementation. 

For example in Javascript client AJAX POST request is automatically sent to `/centrifuge/subscribe` endpoint on every private channel subscription attempt. Other client libraries provide a hook for your custom code that will obtain a private channel subscription token from the application backend (so you need manually implement HTTP call to your backend for example).

Private channel subscription token is also JWT (like connection token described in [authentication chapter](authentication.md)). But it has its own specific claims.

:::note

Connection token and private channel subscription token are both JWT and both can be generated with any JWT library.

:::

:::note

Even when authorizing subscription to private channel with private subscription JWT you should set a proper connection JWT for a client as it provides user authentication details to Centrifugo.

:::

:::note

When you need to use namespace for a private channel then the name of a namespace should be written after a `$` symbol, i.e. if you have a namespace name `chat` – then private channel which belongs to that namespace must be written as sth like `$chat:stream`.

:::

Supported JWT algorithms for private subscription tokens match algorithms to create connection JWT. The same HMAC secret key, RSA and ECDSA public keys set for aiithentication tokens are re-used to check subscription JWT.

## Claims

Private channel subscription token claims are: `client`, `channel`, `info`, `b64info`, `exp` and `expire_at`. What do they mean? Let's describe in detail.

### client

Required. Client ID which wants to subscribe on a channel (**string**).

:::note

Centrifugo server generates a unique client ID for each incoming connection. This client ID regenerated for a client on every reconnect. You must use this client ID for private channel subscription token. If you are using [centrifuge-js](https://github.com/centrifugal/centrifuge-js) library then Client ID and channels that user wants to subscribe will be automaticaly added to AJAX POST request to application backend. In other cases refer to specific client documentation (in most cases you will have client ID and channel in private subscription event context).

:::

### channel

Required. Channel that client tries to subscribe to (**string**).

### info

Optional. Additional information for connection inside this channel (**valid JSON**).

### b64info

Optional. Additional information for connection inside this channel in base64 format (**string**). Will be decoded by Centrifugo to raw bytes.

### exp

Optional. This is a standard JWT claim that allows setting private channel subscription token expiration time (a UNIX timestamp in the future, in seconds, as integer) and configure subscription expiration time.

At the moment if subscription expires client connection will be closed and client will try to reconnect. In most cases you don't need this and should prefer using expiration of connection token to deactivate connection (see [authentication](authentication.md)). But if you need more granular per-channel control this may fit your needs.

Once `exp` set in token every subscription token must be periodically refreshed. This refresh workflow happens on client-side. Refer to the specific client documentation in order to see how to refresh subscriptions.

### expire_at

Optional. By default Centrifugo looks on `exp` claim to both check token expiration and configure subscription expiration time. In most cases this is fine, but there could be situations where you want to decouple subscription token expiration check with subscription expiration time. As soon as `expire_at` claim provided (set) in subscription JWT Centrifugo relies on it for setting subscription expiration time (JWT expiration still checked over `exp` though).

`expire_at` is a UNIX timestamp seconds when subscription should expire.

* Set in to the future time for expiring subscription at some point
* Set it to `0` to disable subscription expiration (but since check token `exp`). This allows implementing one-time subcription tokens. 

## Example

So to generate subscription token you can use something like this in Python (assuming client ID is `xxxx-xxx-xxx-xxxx` and private channel is `$gossips`):

```python
import jwt

token = jwt.encode({
    "client": "xxxx-xxx-xxx-xxxx",
    "channel": "$gossips"
}, "secret", algorithm="HS256").decode()

print(token)
```

Where `"secret"` is the `token_hmac_secret_key` from Centrifugo configuration (we use HMAC tokens in this example which relies on shared secret key, for RSA or ECDSA tokens you need to use private key known only by your backend).
