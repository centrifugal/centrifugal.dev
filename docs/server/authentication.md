---
id: authentication
title: Client authentication
---

Centrifugo should know the ID of a user who is connecting. This chapter describes a mechanism of authenticating users over JSON Web Token (JWT) passing.

:::tip

If you prefer to avoid using JWT then look at [the proxy feature](proxy.md). It allows proxying connection requests from Centrifugo to your application backend for authentication details.

:::

Upon connecting to Centrifugo client should provide a connection JWT with several predefined credential claims. If you've never heard about JWT before - refer to [jwt.io](https://jwt.io/) page.

![](/img/diagram_jwt_authentication.png)

At the moment Centrifugo supports HMAC, RSA and ECDSA JWT algorithms - i.e. HS256, HS384, HS512, RSA256, RSA384, RSA512, EC256, EC384, EC512.

We will use Javascript Centrifugo client here for example snippets for client-side and [PyJWT](https://github.com/jpadilla/pyjwt) Python library to generate a connection token on the backend side.

To add HMAC secret key to Centrifugo add `token_hmac_secret_key` to configuration file:

```json title="config.json"
{
    ...
    "token_hmac_secret_key": "<YOUR-SECRET-STRING-HERE>"
}
```

To add RSA public key (must be PEM encoded string) add `token_rsa_public_key` option, ex:

```json title="config.json"
{
    ...
    "token_rsa_public_key": "-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZ..."
}
```

To add ECDSA public key (must be PEM encoded string) add `token_ecdsa_public_key` option, ex:

```json title="config.json"
{
    ...
    "token_ecdsa_public_key": "-----BEGIN PUBLIC KEY-----\nxyz23adf..."
}
```

## Claims

Centrifugo uses the following claims in a JWT: `sub`, `exp`, `iat`, `jti`, `info`, `b64info`, `channels`, `subs`.

### sub

This is a standard JWT claim which must contain an ID of the current application user (**as string**). 

If a user is not currently authenticated in an application, but you want to let him connect to Centrifugo anyway – you can use an empty string as a user ID in `sub` claim. This is called anonymous access. In this case, the `anonymous` option must be enabled in Centrifugo configuration for channels that the client will subscribe to.

### exp

This is a UNIX timestamp seconds when the token will expire. This is a standard JWT claim - all JWT libraries for different languages provide an API to set it.

If `exp` claim is not provided then Centrifugo won't expire connection. When provided special algorithm will find connections with `exp` in the past and activate the connection refresh mechanism. Refresh mechanism allows connection to survive and be prolonged. In case of refresh failure, the client connection will be eventually closed by Centrifugo and won't be accepted until new valid and actual credentials are provided in the connection token.

You can use the connection expiration mechanism in cases when you don't want users of your app to be subscribed on channels after being banned/deactivated in the application. Or to protect your users from token leakage (providing a reasonably short time of expiration).

Choose `exp` value wisely, you don't need small values because the refresh mechanism will hit your application often with refresh requests. But setting this value too large can lead to slow user connection deactivation. This is a trade-off.

Read more about connection expiration [below](#connection-expiration).

### iat

This is a UNIX time when token was issued (seconds). See [definition in RFC](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.6). This claim is optional but can be useful together with [Centrifugo PRO token revocation features](../pro/token_revocation.md).

### jti

This is a token unique ID. See [definition in RFC](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.7). This claim is optional but can be useful together with [Centrifugo PRO token revocation features](../pro/token_revocation.md). 

### info

This claim is optional - this is additional information about client connection that can be provided for Centrifugo. This information will be included in presence information, join/leave events, and channel publication if it was published from a client-side.

### b64info

If you are using binary Protobuf protocol you may want info to be custom bytes. Use this field in this case.

This field contains a `base64` representation of your bytes. After receiving Centrifugo will decode base64 back to bytes and will embed the result into various places described above.

### channels

An optional array of strings with server-side channels to subscribe a client to. See more details about [server-side subscriptions](server_subs.md).

:::caution

By providing a list of channels in JWT with `channels` claim you are not making them automatically unaccessible by other users. Other users can still call a client-side `.subscribe()` method and subscribe to these channels if channel permissions allow doing this. If you need to protect channels from being subscribed by other connections then you can use private channels inside this `channels` array (i.e. starting with `$`) or turn on [protected](channels.md#protected) option for channels namespaces.

:::

### subs

An optional map of channels with options. This is like a `channels` claim but allows more control over server-side subscription since every channel can be annotated with info, data, and so on using options.

:::tip

This claim is called `subs` as a shortcut from subscriptions. The claim `sub` described above is a standart JWT claim to provide a user ID (it's a shortcut from subject). While claims have similar names they have different purpose in a connection JWT.

:::

:::caution

By providing a map of channels in JWT with `subs` claim you are not making channels automatically unaccessible by other users. Other users can still call a client-side `.subscribe()` method and subscribe to these channels if channel permissions allow doing this. If you need to protect channels from being subscribed by other connections then you can use private channels inside this `subs` map (i.e. starting with `$`) or turn on [protected](channels.md#protected) option for channels namespaces.

:::

Example:

```json
{
  ...
  "subs": {
    "channel1": {
      "data": {"welcome": "welcome to channel1"}
    },
    "channel2": {
      "data": {"welcome": "welcome to channel2"}
    }
  }
}
```

#### Subscribe options:

| Field | Type | Optional | Description  |
| -------------- | -------------- | ------------ | ---- |
| info       | JSON object       | yes | Custom channel info   |
| b64info       | string       | yes | Custom channel info in Base64 - to pass binary channel info   |
| data       | JSON object       | yes | Custom JSON data to return in subscription context inside Connect reply    |
| b64data       | string       | yes |  Same as `data` but in Base64 to send binary data   |
| override       | Override object       | yes |  Allows dynamically override some channel options defined in Centrifugo configuration on a per-connection basis (see below available fields)  |

#### Override object

| Field | Type | Optional | Description  |
| -------------- | -------------- | ------------ | ---- |
| presence       | BoolValue       | yes | Override presence   |
| join_leave       | BoolValue       | yes | Override join_leave   |
| position       | BoolValue       | yes | Override position   |
| recover       | BoolValue       | yes |  Override recover   |

BoolValue is an object like this:

```json
{
  "value": true/false
}
```

### meta

Meta is an additional JSON object (ex. `{"key": "value"}`) that will be attached to a connection. Unlike `info` it's never exposed to clients and only accessible on a backend side. It will be included in proxy calls from Centrifugo to the application backend. Also, there is a `get_user_connections` API method in Centrifugo PRO that returns this data in the user connection object.

### expire_at

By default, Centrifugo looks on `exp` claim to configure connection expiration. In most cases this is fine, but there could be situations where you wish to decouple token expiration check with connection expiration time. As soon as the `expire_at` claim is provided (set) in JWT Centrifugo relies on it for setting connection expiration time (JWT expiration still checked over `exp` though).

`expire_at` is a UNIX timestamp seconds when the connection should expire.

* Set it to the future time for expiring connection at some point
* Set it to `0` to disable connection expiration (but still check token `exp` claim).

## Connection expiration

As said above `exp` claim in a connection token allows expiring client connection at some point in time. Let's look in detail at what happens when Centrifugo detects that the connection is going to expire.

First, you should do is enable client expiration mechanism in Centrifugo providing a connection JWT with expiration:

```python
import jwt
import time

token = jwt.encode({"sub": "42", "exp": int(time.time()) + 10*60}, "secret").decode()

print(token)
```

Let's suppose that you set `exp` field to timestamp that will expire in 10 minutes and the client connected to Centrifugo with this token. During 10 minutes the connection will be kept by Centrifugo. When this time passed Centrifugo gives the connection some time (configured, 25 seconds by default) to refresh its credentials and provide a new valid token with new `exp`.

When a client first connects to Centrifugo it receives the `ttl` value in connect reply. That `ttl` value contains the number of seconds after which the client must send the `refresh` command with new credentials to Centrifugo. Centrifugo clients must handle this `ttl` field and automatically start the refresh process.

For example, a Javascript browser client will send an AJAX POST request to your application when it's time to refresh credentials. By default, this request goes to `/centrifuge/refresh` URL endpoint. In response your server must return JSON with a new connection JWT:

```python
{
    "token": token
}
```

So you must just return the same connection JWT for your user when rendering the page initially. But with actual valid `exp`. Javascript client will then send them to Centrifugo server and connection will be refreshed for a time you set in `exp`.

In this case, you know which user wants to refresh its connection because this is just a general request to your app - so your session mechanism will tell you about the user.

If you don't want to refresh the connection for this user - just return 403 Forbidden on refresh request to your application backend.

Javascript client also has options to hook into a refresh mechanism to implement your custom way of refreshing. Other Centrifugo clients also should have hooks to refresh credentials but depending on client API for this can be different - see specific client docs.

## Examples

Let's look at how to generate connection HS256 JWT in Python:

### Simplest token

````mdx-code-block
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs
  className="unique-tabs"
  defaultValue="python"
  values={[
    {label: 'Python', value: 'python'},
    {label: 'NodeJS', value: 'node'},
  ]
}>
<TabItem value="python">

```python
import jwt

token = jwt.encode({"sub": "42"}, "secret").decode()

print(token)
```

</TabItem>
<TabItem value="node">

```javascript
var jwt = require('jsonwebtoken');

var token = jwt.sign({ sub: '42' }, 'secret');

console.log(token);
```

</TabItem>
</Tabs>
````

Note that we use the value of `token_hmac_secret_key` from Centrifugo config here (in this case `token_hmac_secret_key` value is just `secret`). The only two who must know the HMAC secret key is your application backend which generates JWT and Centrifugo. You should never reveal the HMAC secret key to your users.

Then you can pass this token to your client side and use it when connecting to Centrifugo:

```javascript title="Using centrifuge-js lib"
var centrifuge = new Centrifuge("ws://localhost:8000/connection/websocket");
centrifuge.setToken(token);
centrifuge.connect();
```

### Token with expiration

HS256 token that will be valid for 5 minutes:

````mdx-code-block
<Tabs
  className="unique-tabs"
  defaultValue="python"
  values={[
    {label: 'Python', value: 'python'},
    {label: 'NodeJS', value: 'node'},
  ]
}>
<TabItem value="python">

```python
import jwt
import time

claims = {"sub": "42", "exp": int(time.time()) + 5*60}
token = jwt.encode(claims, "secret", algorithm="HS256").decode()
print(token)
```

</TabItem>
<TabItem value="node">

```javascript
var jwt = require('jsonwebtoken');

var token = jwt.sign({ sub: '42' }, 'secret', { expiresIn: 5 * 60 });

console.log(token);
```

</TabItem>
</Tabs>
````

### Token with additional connection info

Let's attach user name:

````mdx-code-block
<Tabs
  className="unique-tabs"
  defaultValue="python"
  values={[
    {label: 'Python', value: 'python'},
    {label: 'NodeJS', value: 'node'},
  ]
}>
<TabItem value="python">

```python
import jwt

claims = {"sub": "42", "info": {"name": "Alexander Emelin"}}
token = jwt.encode(claims, "secret", algorithm="HS256").decode()
print(token)
```

</TabItem>
<TabItem value="node">

```javascript
var jwt = require('jsonwebtoken');

var token = jwt.sign({ sub: '42', info: {"name": "Alexander Emelin"} }, 'secret');

console.log(token);
```

</TabItem>
</Tabs>
````

### Investigating problems with JWT

You can use [jwt.io](https://jwt.io/) site to investigate the contents of your tokens. Also, server logs usually contain some useful information.

## JSON Web Key support

Centrifugo supports JSON Web Key (JWK) [spec](https://tools.ietf.org/html/rfc7517). This means that it's possible to improve JWT security by providing an endpoint to Centrifugo from where to load JWK (by looking at `kid` header of JWT).

A mechanism can be enabled by providing `token_jwks_public_endpoint` string option to Centrifugo (HTTP address).

As soon as `token_jwks_public_endpoint` set all tokens will be verified using JSON Web Key Set loaded from JWKS endpoint. This makes it impossible to use non-JWK based tokens to connect and subscribe to private channels.

At the moment Centrifugo caches keys loaded from an endpoint for one hour.

Centrifugo will load keys from JWKS endpoint by issuing GET HTTP request with 1 second timeout and one retry in case of failure (not configurable at the moment).

Only `RSA` algorithm is supported.

JWKS support enabled both connection and private channel subscription tokens.
