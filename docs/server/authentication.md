---
description: "Centrifugo JWT authentication for client connections. Supports HMAC, RSA, ECDSA algorithms, JWK/JWKS, token expiration, and key rotation mechanisms."
id: authentication
title: Client JWT authentication
---

To securely authenticate incoming real-time client connections, Centrifugo can use a [JSON Web Token](https://jwt.io/introduction) (JWT) issued by your application backend. This process allows Centrifugo to identify the user's ID in your application securely. Additionally, your application can include extra information within the JWT claims, which Centrifugo can then utilize. This chapter will explain how such connection token may be created and used.

:::tip

If you prefer not to use JWTs, consider the [proxy feature](proxy.md). It enables the proxying of connection requests from Centrifugo to your application's backend endpoint for authentication.

:::

:::tip

Using JWT for authentication can be beneficial in scenarios involving massive reconnects. As the authentication information is encoded in the token, this can significantly reduce the load on your application's session backend. For more details, refer to our [blog post](/blog/2020/11/12/scaling-websocket#massive-reconnect).

:::

Upon connection, the client should supply a connection JWT containing several predefined credential claims. Below is a diagram illustrating this:

![](/img/connection_token.png)

For more information about handling connection tokens on the client side, see the [client SDK specification](../transports/client_api.md#client-connection-token).

Currently, Centrifugo supports HMAC, RSA, and ECDSA JWT algorithms - specifically HS256, HS384, HS512, RSA256, RSA384, RSA512, EC256, EC384, and EC512.

Here, we will demonstrate example snippets using the Javascript Centrifugo client for the client-side and the [PyJWT](https://github.com/jpadilla/pyjwt) Python library to generate a connection token on the backend side.

To add an HMAC secret key to Centrifugo, insert `client.token.hmac_secret_key` into the configuration file:

```json title="config.json"
{
  ...
  "client": {
    "token": {
      "hmac_secret_key": "<YOUR-SECRET-STRING-HERE>"
    }
  }
}
```

To add RSA public key (must be PEM encoded string) add `client.token.rsa_public_key` option, ex:

```json title="config.json"
{
  ...
  "client": {
    "token": {
      "rsa_public_key": "-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZ..."
    }
  }
}
```

To add ECDSA public key (must be PEM encoded string) add `client.token.ecdsa_public_key` option, ex:

```json title="config.json"
{
  ...
  "client": {
    "token": {
      "ecdsa_public_key": "-----BEGIN PUBLIC KEY-----\nxyz23adf..."
    }
  }
}
```

## Connection JWT Claims

For connection JWT, Centrifugo uses some standard claims defined in [RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519), as well as custom Centrifugo-specific claims.

### sub

This standard JWT claim must contain the ID of the current application user (**as a string**).

If a user is not authenticated in the application but you wish to allow them to connect to Centrifugo, an empty string can be used as the user ID in the `sub` claim. This facilitates anonymous access. In such cases, you might need to enable the corresponding channel namespace options that allow protocol features for anonymous users.

### exp

This claim specifies the UNIX timestamp (in seconds) when the token will expire. It is a standard JWT claim - all JWT libraries across different programming languages provide an API to set it.

If the `exp` claim is not included, Centrifugo will not expire the connection. When included, a special algorithm will identify connections with an `exp` in the past and initiate the connection refresh mechanism. The refresh mechanism allows a connection to be extended. If the refresh fails, Centrifugo will eventually close the client connection, which will not be accepted again until new valid and current credentials are provided in the connection token.

The connection expiration mechanism can be utilized in scenarios where you do not want users to remain subscribed to channels after being banned or deactivated in the application. It also serves to protect users from token leakage by setting a reasonably short expiration time.

Choose the `exp` value judiciously; too short a value can lead to frequent application hits with refresh requests, whereas too long a value can result in delayed user connection deactivation. It's a matter of balance.

Further details on connection expiration can be found [below](#connection-expiration).

### iat

This represents the UNIX time when the token was issued (in seconds). Refer to the [definition in RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.6). This claim is optional but can be advantageous in conjunction with [Centrifugo PRO's token revocation features](../pro/token_revocation.md).

### jti

This is a unique identifier for the token. Refer to the [definition in RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.7). This claim is optional but can be beneficial in conjunction with [Centrifugo PRO's token revocation features](../pro/token_revocation.md).

### aud

By default, Centrifugo does not check JWT audience ([rfc7519 aud](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3) claim).

:::tip

While optional, it's highly recommended to configure audience validation to prevent tokens intended for other services from being accepted by Centrifugo. This adds an important layer of security by ensuring that only tokens explicitly issued for Centrifugo can be used to establish connections.

When using external Identity Providers (such as Auth0, Keycloak, or other third-party IdPs), configuring audience validation is not just recommended but a necessary security requirement. External IdPs typically issue tokens for multiple services and applications, making audience validation critical to ensure that tokens intended for other services cannot be misused to authenticate with Centrifugo.

:::

But you can force this check by setting `client.token.audience` string option:

```json title="config.json"
{
  "client": {
    "token": {
      ...
      "audience": "centrifugo"
    }
  }
}
```

:::caution

Setting `client.token.audience` will also affect subscription tokens (used for [channel token authorization](channel_token_auth.md)). If you need to separate connection token configuration and subscription token configuration check out [separate subscription token config](./channel_token_auth.md#separate-subscription-token-config) feature.

:::

### iss

By default, Centrifugo does not check JWT issuer ([rfc7519 iss](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.1) claim).

But you can force this check by setting `client.token.issuer` string option:

```json title="config.json"
{
  "client": {
    "token": {
      ...
      "issuer": "my_app"
    }
  }
}
```

:::caution

Setting `client.token.issuer` will also affect subscription tokens (used for [channel token authorization](channel_token_auth.md)). If you need to separate connection token configuration and subscription token configuration check out [separate subscription token config](./channel_token_auth.md#separate-subscription-token-config) feature.

:::

### info

This optional claim provides additional information about the client's connection for Centrifugo. This information will be included:

* in online presence data
* join/leave events
* and into client-side channel publications

### b64info

For those utilizing the binary Protobuf protocol and requiring the `info` to be custom bytes, this field should be used.

It contains a `base64` encoded representation of your bytes. Centrifugo will decode the base64 back into bytes upon receipt and incorporate the result into the various places described above.

### channels

This is an optional array of strings identifying the server-side channels to which the client will be subscribed. Further details can be found in the documentation on [server-side subscriptions](server_subs.md).

:::tip

It's important to note that the `channels` claim is sometimes **misinterpreted** by users as a list of channel permissions. It does not serve that purpose. Instead, using this claim causes the client to be automatically subscribed to the specified channels upon connection, making it unnecessary to invoke the `subscribe` API from the client side. More information can be found in the [server-side subscriptions](server_subs.md) documentation.

:::

### subs

This optional claim is a map of channels with options, providing a more detailed approach to server-side subscriptions compared to the `channels` claim, as it allows for the annotation of each channel with additional information and data through options.

:::tip

The term `subs` is shorthand for subscriptions. It should not be confused with the `sub` claim mentioned earlier, which is a standard JWT claim used to provide a user ID (short for subject). Despite their similar names, these claims serve distinct purposes within a connection JWT.

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

| Field    | Type                      | Optional | Description                                                                                                                                 |
|----------|---------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------|
| info     | JSON object               | yes      | Custom channel info                                                                                                                         |
| b64info  | string                    | yes      | Custom channel info in Base64 - to pass binary channel info                                                                                 |
| data     | JSON object               | yes      | Custom JSON data to return in subscription context inside Connect reply                                                                     |
| b64data  | string                    | yes      | Same as `data` but in Base64 to send binary data                                                                                            |
| override | `SubscribeOptionOverride` | yes      | Allows dynamically override some channel options defined in Centrifugo configuration on a per-connection basis (see below available fields) |

#### SubscribeOptionOverride

Allow per-connection overrides of some channel namespace options:

| Field                 | Type        | Optional | Description                                             |
|-----------------------|-------------|----------|---------------------------------------------------------|
| presence              | `BoolValue` | yes      | Override `presence` from namespace options              |
| join_leave            | `BoolValue` | yes      | Override `join_leave` from namespace options            |
| force_recovery        | `BoolValue` | yes      | Override `force_recovery` from namespace options        |
| force_positioning     | `BoolValue` | yes      | Override `force_positioning` from namespace options     |
| force_push_join_leave | `BoolValue` | yes      | Override `force_push_join_leave` from namespace options |

`BoolValue` is an object like this:

```json
{
  "value": true/false
}
```

### meta

`meta` is an additional JSON object (e.g., `{"key": "value"}`) that is attached to a connection. It differs from `info` as it is never disclosed to clients within presence and join/leave events; it is only accessible on the server side. It can be included in proxy calls from Centrifugo to the application backend (refer to the `include_connection_meta` option of [proxy configuration object](./proxy.md#proxy-configuration-object)). In Centrifugo PRO, there is a `connections` API method that returns this metadata within the connection description object.

### expire_at

Although Centrifugo typically uses the `exp` claim to manage connection expiration, there may be scenarios where you want to separate the token expiration check from the connection expiration time. When the `expire_at` claim is included in the JWT, Centrifugo uses it to determine the connection expiration time, while the JWT expiration is still verified using the `exp` claim.

`expire_at` is a UNIX timestamp indicating when the connection should expire.

* To expire the connection at a specific future time, set it to that time.
* To prevent connection expiration, set it to `0` (token `exp` claim will still be checked).

## Connection expiration

As mentioned, the `exp` claim in a connection token is designed to expire the client connection at some point in time. Here's a detailed look at the process when Centrifugo identifies that the connection is going to expire.

First, activate the client expiration mechanism in Centrifugo by providing a connection JWT with an `exp` claim:

```python
import jwt
import time

token = jwt.encode({"sub": "42", "exp": int(time.time()) + 10*60}, "secret", algorithm="HS256")

print(token)
```

Assuming the `exp` claim is set to expire in 10 minutes, the client connects to Centrifugo with this token. Centrifugo will maintain the connection for the specified duration. Once the time elapses, Centrifugo allows a grace period (default is 25 seconds) for the client to refresh its credentials with a new valid token containing an updated `exp`.

Upon initial connection, the client receives a `ttl` value in the connect response, indicating the seconds remaining before it must initiate a refresh command with new credentials. Centrifugo SDKs handle this `ttl` internally and automatically begin the refresh process.

SDKs provide mechanisms to hook into this process and provide a function to get new token. It's up to developer to decide how to load new token from the backend – in web browser this is usually a simple `fetch` request and response may look like this:

```python
{
    "token": token
}
```

You should provide the same connection JWT you issued when the page was initially rendered, but with an updated and valid `exp`. Our SDKs will then send this token to the Centrifugo server, and the connection will be extended for the period set in the new `exp`.

When you load new token from your app backend user authentication must be facilitated by your app's session mechanism. So you know for whom you are are going to generate an updated token.

## Examples: create connection JWT

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
const jose = require('jose');

(async function main() {
  const secret = new TextEncoder().encode('secret')
  const alg = 'HS256'

  const token = await new jose.SignJWT({ sub: '42' })
    .setProtectedHeader({ alg })
    .sign(secret)

  console.log(token);
})();
```

</TabItem>
</Tabs>
````

Note that we use the value of `token_hmac_secret_key` from Centrifugo config here (in this case `token_hmac_secret_key` value is just `secret`). The only two who must know the HMAC secret key is your application backend which generates JWT and Centrifugo. You should never reveal the HMAC secret key to your users.

Then you can pass this token to your client side and use it when connecting to Centrifugo:

```javascript title="Using centrifuge-js v3"
var centrifuge = new Centrifuge("ws://localhost:8000/connection/websocket", {
  token: token
});
centrifuge.connect();
```

See more details about working with connection tokens and handling token expiration on the client-side in the [real-time SDK API spec](../transports/client_api.md#client-connection-token).

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
const jose = require('jose')

(async function main() {
  const secret = new TextEncoder().encode('secret')
  const alg = 'HS256'

  const token = await new jose.SignJWT({ sub: '42' })
    .setProtectedHeader({ alg })
    .setExpirationTime('5m')
    .sign(secret)

  console.log(token);
})();
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
const jose = require('jose')

(async function main() {
  const secret = new TextEncoder().encode('secret')
  const alg = 'HS256'

  const token = await new jose.SignJWT({ sub: '42', info: {"name": "Alexander Emelin"} })
    .setProtectedHeader({ alg })
    .setExpirationTime('5m')
    .sign(secret)

  console.log(token);
})();
```

</TabItem>
</Tabs>
````

## Example: connect with JWT

To connect with JWT it should be passed to Centrifugo from the client-side upon establishing real-time connection.

Our bidirectional SDKs provide options to set initial token as well as an option to set the function to load new connection token (required to handle refresh of expiring tokens). See [examples in client SDK spec](../transports/client_api.md#client-connection-token).

Our unidirectional transports accept JWT as part of the connect payload. The way how connect payload is passed to Centrifugo differs for each unidirectional transport.

## Investigating problems with JWT

You can use [jwt.io](https://jwt.io/) site to investigate the contents of your tokens. Also, server logs usually contain some useful information.

## JSON Web Key support

Centrifugo supports JSON Web Key (JWK) [spec](https://tools.ietf.org/html/rfc7517). This means that it's possible to improve JWT security by providing an endpoint to Centrifugo from where to load JWK (by looking at `kid` header of JWT).

A mechanism can be enabled by providing `client.token.jwks_public_endpoint` string option to Centrifugo (HTTP address).

As soon as `client.token.jwks_public_endpoint` set all tokens will be verified using JSON Web Key Set loaded from JWKS endpoint. This makes it impossible to use non-JWK based tokens to connect and subscribe to private channels.

:::tip

Read a tutorial in our blog about [using Centrifugo with Keycloak SSO](/blog/2023/03/31/keycloak-sso-centrifugo). In that case connection tokens are verified using public key loaded from the JWKS endpoint of Keycloak.

:::

At the moment Centrifugo caches keys loaded from an endpoint for one hour.

Centrifugo will load keys from JWKS endpoint by issuing GET HTTP request with 1 second timeout and one retry in case of failure (not configurable at the moment).

Centrifugo supports the following key types (`kty`) for JWKs tokens:

* `RSA`
* `EC`
* `OKP` based on Ed25519

Once enabled JWKS used for both connection and channel subscription tokens.

## HMAC key rotation

Available since v6.6.1

When you need to rotate the HMAC secret key, Centrifugo supports a smooth transition using a previous secret key. This avoids mass disconnects when the primary key changes – tokens signed with the old key will continue to be accepted during the rotation period.

Configure `client.token.hmac_previous_secret_key` to specify the old secret key, and optionally `client.token.hmac_previous_secret_key_valid_until` to set a Unix timestamp after which the previous key will no longer be accepted:

```json title="config.json"
{
  ...
  "client": {
    "token": {
      "hmac_secret_key": "<NEW-SECRET-KEY>",
      "hmac_previous_secret_key": "<OLD-SECRET-KEY>",
      "hmac_previous_secret_key_valid_until": 1735689600
    }
  }
}
```

The rotation workflow:

1. Set your new secret as `hmac_secret_key` and move the old secret to `hmac_previous_secret_key`
2. Update your backend to issue tokens with the new secret
3. Optionally set `hmac_previous_secret_key_valid_until` to a Unix timestamp – after this time, tokens signed with the old key will be rejected
4. Once all old tokens have expired or the `valid_until` timestamp has passed, remove `hmac_previous_secret_key` from the configuration

:::tip

The same `hmac_previous_secret_key` and `hmac_previous_secret_key_valid_until` options are available for subscription tokens when using a separate subscription token configuration.

:::

## Dynamic JWKs endpoint

It's possible to extract variables from `iss` and `aud` JWT claims using [Go regexp](https://pkg.go.dev/regexp) named groups, then use variables extracted during `iss` or `aud` matching to construct a JWKS endpoint dynamically upon token validation. In this case JWKS endpoint may be set in config as template.

To achieve this Centrifugo provides two additional options:

* `client.token.issuer_regex` - match JWT issuer (`iss` claim) against this regex, extract named groups to variables, variables are then available for jwks endpoint construction.
* `client.token.audience_regex` - match JWT audience (`aud` claim) against this regex, extract named groups to variables, variables are then available for jwks endpoint construction.

Let's look at the example:

```json
{
  "client": {
    "token": {
      ...
      "jwks_public_endpoint": "https://keycloak:443/{{realm}}/protocol/openid-connect/certs",
      "issuer_regex": "https://example.com/auth/realms/(?P<realm>[A-z]+)"
    }
  }
}
```

To use variable in `client.token.jwks_public_endpoint` it must be wrapped in `{{` `}}`.

When using `client.token.issuer_regex` and `client.token.audience_regex` make sure `client.token.issuer` and `client.token.audience` not used in the config - otherwise and error will be returned on Centrifugo start.

:::caution

Setting `client.token.issuer_regex` and `client.token.audience_regex` will also affect subscription tokens (used for [channel token authorization](channel_token_auth.md)). If you need to separate connection token configuration and subscription token configuration check out [separate subscription token config](./channel_token_auth.md#separate-subscription-token-config) feature.

:::

## Custom token user id claim

It's possible to use alternative claim in token to pass user ID: with `client.token.user_id_claim` option (string, by default `""` – i.e. not used).

```json title=config.json
{
  "client": {
    "token": {
      "user_id_claim": "user_id"
    }
  }
}
```

By default, Centrifugo uses `sub` claim of JWT to extract user ID - this is defined in JWT spec and is the recommended way to pass user ID.

Custom claim set by `client.token.user_id_claim` must follow the following regexp at this point: `^[a-zA-Z_]+$`.

Setting alternative user id claim also affects subscription tokens, like any other token options. To use different config for subscription tokens Centrifugo provides [separate_subscription_token_config](./channel_token_auth.md#separate-subscription-token-config) option.
