---
id: client_authentication
title: Client Authentication Enhancements
sidebar_label: Client authentication
---

Centrifugo OSS provides JWT based client authentication. It's a very powerful mechanism because it helps a lot to reduce load on your session backend when dealing with many concurrent connections and [massive reconnections](/blog/2020/11/12/scaling-websocket#massive-reconnect) from time to time. Centrifugo PRO comes with extra features for more convenient client authentication management.

![](/img/client_auth.png)

## Extracting meta from JWT claims

Centrifugo PRO can extract and populate connection [meta](../server/authentication.md#meta) object from JWT token claims based on the mapping in the configuration. This allows more convenient work with JWTs which are not under user's control, i.e., issued by third-party identity providers.

When a client connects with a JWT token, Centrifugo PRO extracts specified claims from the token and maps them to fields in the connection `meta` object.

This metadata is then available throughout the connection lifecycle and can be used in:

- CEL expressions for authorization
- Proxy requests (passed in per-call data)
- Connection introspection

### Example configuration

Meta claims extraction is configured using the `claim_to_meta` option in the token configuration. This option accepts a map where:

- **Keys** are paths to extract values from JWT claims (may have `.` for nested objects)
- **Values** are the field names to use in the resulting `meta` object (nesting is not supported - you need to use flat field names for the resulting `meta`)

Let's say we have the following configuration:

```yaml
{
    "client": {
        "token": {
            "hmac_secret_key": "your-secret-key",
            "claim_to_meta": {
                "user.role": "role",
                "user.department": "dept",
                "permissions.level": "access_level",
                "features": "enabled_features",
                "custom-info": "info"
            }
        }
    }
}
```

Given a connection JWT with the following claims:

```json
{
    "sub": "user123",
    "exp": 1234567890,
    "user": {
        "role": "admin",
        "department": "engineering"
    },
    "permissions": {
        "level": 5
    },
    "features": ["dashboard", "api"],
    "custom-info": "some info"
}
```

With the [example configuration](#example-configuration) above, Centrifugo will:

1. Extract `user.role` and map it to `role` in meta
2. Extract `user.department` and map it to `dept` in meta
3. Etc.

The connection will have the following `meta` object:

```json
{
    "role": "admin",
    "dept": "engineering",
    "access_level": 5,
    "enabled_features": ["dashboard", "api"],
    "info": "some info"
}
```

### Implementation notes

* Meta claims extraction allows using dots for extracting values from JWT claims nested objects. In `claim_to_meta` keys Centrifugo does not allow using special characters like `@#[]{}*?!` by default, but you can use `\` character to escape them if needed. Keys are validated on Centrifugo start.
* Meta field names (the values in the `claim_to_meta` map) must follow `^[A-Za-z_][A-Za-z0-9_]*$` regex. This is validated on Centrifugo start.
* If a path in `claim_to_meta` doesn't exist in the JWT token, it will be **silently skipped**. Only claims that exist in the token will be extracted.
* If your JWT token already contains a `meta` claim, the extracted fields will **override** the existing fields.
* Meta claims extraction only works for connection tokens, not subscription tokens. Subscription tokens do not support the `meta` claim.

## Multiple JWKS Providers

Centrifugo PRO supports configuring multiple JWKS (JSON Web Key Set) providers for client connection authentication with automatic token routing based on the issuer (`iss`) claim. This may be useful for multi-tenant scenarios where tokens may come from different identity providers.

While the standard `jwks_public_endpoint` configuration allows fetching public keys from a single JWKS endpoint, this feature enables you to configure multiple JWKS endpoints, each associated with a specific token issuer. Centrifugo will automatically route token verification to the correct provider based on the `iss` (issuer) claim in the JWT.

**Note:** `jwks_public_endpoint` and `jwks_providers` are mutually exclusive - you cannot use both at the same time.

### Configuration

```json
{
    "client": {
        "token": {
            "jwks_providers": [
                {
                    "name": "auth0",
                    "enabled": true,
                    "endpoint": "https://tenant.auth0.com/.well-known/jwks.json",
                    "issuer": "https://tenant.auth0.com/"
                },
                {
                    "name": "keycloak",
                    "enabled": true,
                    "endpoint": "https://keycloak.example.com/realms/myrealm/protocol/openid-connect/certs",
                    "issuer": "https://keycloak.example.com/realms/myrealm"
                }
            ]
        }
    }
}
```

### JWKS provider fields

| Field    | Type    | Required | Description                                                               |
|----------|---------|----------|---------------------------------------------------------------------------|
| name     | `string`  | Yes      | Unique identifier for the provider. Must match pattern `^[a-zA-Z0-9_]{2,}$` |
| enabled  | `boolean` | No      | Whether this provider is active (default `false`)                                       |
| endpoint | `string`  | Yes*     | JWKS endpoint URL (*required if enabled)                                  |
| issuer   | `string`  | Yes*     | Expected issuer claim value (*required if enabled)                        |
| audience | `string`  | No       | Expected audience claim value (optional)                                  |
| tls      | [`TLS`](../server/configuration.md#tls-config-object) object  | No       | Custom TLS configuration for the JWKS endpoint HTTP client                            |
| claim_to_meta      | `map[string]string`  | No       | Config to transform JWT claims to connection meta object                             |

How It Works

1. Token Received: When a client connects with a JWT token, Centrifugo parses it
2. Issuer Extraction: The `iss` claim is extracted from the token
3. Provider Matching: Centrifugo finds the JWKS provider with matching issuer
4. Key Retrieval: Public keys are fetched from the provider's endpoint
5. Signature Verification: The token signature is verified using the retrieved keys
6. Audience Validation: If audience is configured for the provider, it's validated against the token's aud claim

If no provider matches the token's issuer, the connection is rejected.

### Subscription token

JWKS providers work for both connection tokens and subscription tokens. [As usual](../server/channel_token_auth.md#separate-subscription-token-config), configuration must be separate:

```json
{
    "client": {
        "token": {
            "jwks_providers": [{
                "name": "auth0_connection",
                "enabled": true,
                "endpoint": "https://tenant.auth0.com/.well-known/jwks.json",
                "issuer": "https://tenant.auth0.com/"
            }]
        },
        "subscription_token": {
            "enabled": true,
            "jwks_providers": [{
                "name": "auth0_subscription",
                "enabled": true,
                "endpoint": "https://tenant.auth0.com/.well-known/jwks.json",
                "issuer": "https://tenant.auth0.com/subs"
            }]
        }
    }
}
```

Note, `claim_to_meta` is not supported for subscription tokens as subscription tokens do not support `meta` claim at this moment. This is validated on Centrifugo start.
