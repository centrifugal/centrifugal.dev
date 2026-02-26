---
description: "Centrifugo PRO client authentication enhancements: extract JWT claims to connection meta and configure multiple JWKS providers for multi-tenant setups."
id: client_authentication
title: Client Authentication Enhancements
sidebar_label: Client authentication
---

Centrifugo OSS provides JWT based client authentication. It's a very powerful mechanism because it helps a lot to reduce load on your session backend when dealing with many concurrent connections and [massive reconnections](/blog/2020/11/12/scaling-websocket#massive-reconnect) from time to time. Centrifugo PRO comes with extra features for more convenient client authentication management.

![](/img/client_auth.png)

## Extracting meta from JWT claims

Centrifugo PRO can automatically extract and populate connection [meta](../server/authentication.md#meta) object from JWT token claims based on the mapping in the configuration. This allows more convenient work with JWTs which are not under user's control, i.e., issued by third-party identity providers.

:::info

This feature is available since Centrifugo PRO v6.5.0, currently in beta status. Beta status means we can tweak some implementation details based on user feedback before marking it as stable.

:::

This metadata is then available throughout the connection lifecycle and can be used in:

- CEL expressions for authorization
- Proxy requests (passed in per-call data)
- Connection introspection

### Example configuration

Meta claims extraction is configured using the `meta_from_claim` [StringKeyValues](../server/configuration.md#stringkeyvalues-type) option in the token configuration:

- **Keys** are the field names to use in the resulting `meta` object (to be placed on `meta` object top level)
- **Values** are paths to extract values from JWT claims (may have `.` for extracting nested objects from JWT claims)

Let's say we have the following configuration:

```json
{
    "client": {
        "token": {
            "hmac_secret_key": "your-secret-key",
            "meta_from_claim": [
                {
                    "key": "role",
                    "value": "user.role"
                },
                {
                    "key": "dept",
                    "value": "user.department"
                },
                {
                    "key": "access_level",
                    "value": "permissions.level"
                },
                {
                    "key": "features",
                    "value": "enabled_features"
                },
                {
                    "key": "info",
                    "value": "custom-info"
                }
            ],
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

* Meta field names (the keys in the `meta_from_claim` map) must follow `^[A-Za-z_][A-Za-z0-9_]*$` regex. This is validated on Centrifugo start.
* Meta claims extraction allows using dots for extracting values from JWT claims nested objects. In `meta_from_claim` values Centrifugo does not allow using special characters like `@#[]{}*?!` by default, but you can use `\` character to escape them if needed. Values are validated on Centrifugo start.
* If a path in `meta_from_claim` value doesn't exist in the JWT token, it will be **silently skipped**. Only claims that exist in the token will be extracted.
* If your JWT token already contains a `meta` claim, the extracted fields will **override** the existing fields.
* Meta claims extraction only works for connection tokens, not subscription tokens. Subscription tokens do not support the `meta` claim.

## Multiple JWKS Providers

Centrifugo PRO supports configuring multiple JWKS (JSON Web Key Set) providers for client connection authentication with automatic token routing based on the issuer (`iss`) claim. This may be useful for multi-tenant scenarios where tokens may come from different identity providers.

:::info

This feature is available since Centrifugo PRO v6.5.0, currently in beta status. Beta status means we can tweak some implementation details based on user feedback before marking it as stable.

:::

While the standard `client.token.jwks_public_endpoint` configuration allows fetching public keys from a single JWKS endpoint, this feature enables you to configure multiple JWKS endpoints, each associated with a specific token issuer. Centrifugo will automatically route token verification to the correct provider based on the `iss` (issuer) claim in the JWT.

**Note:** `client.token.jwks_public_endpoint` and `client.token.jwks.providers` are mutually exclusive at this point - you cannot use both at the same time.

### Configuration

```json
{
    "client": {
        "token": {
            "jwks": {
                "enabled": true,
                "providers": [
                    {
                        "name": "auth0",
                        "enabled": true,
                        "endpoint": "https://tenant.auth0.com/.well-known/jwks.json",
                        "issuer": "https://tenant.auth0.com/",
                        "audience": "centrifugo"
                    },
                    {
                        "name": "keycloak",
                        "enabled": true,
                        "endpoint": "https://keycloak.example.com/realms/myrealm/protocol/openid-connect/certs",
                        "issuer": "https://keycloak.example.com/realms/myrealm",
                        "audience": "centrifugo"
                    }
                ]
            }
        }
    }
}
```

:::note
The `client.token.jwks.enabled` field must be set to `true` to enable multiple JWKS providers feature. Without it, the providers configuration will be ignored.
:::

### Same issuer with different audiences

Starting from Centrifugo PRO v6.5.2, you can configure multiple providers with the same issuer but different audiences. This is useful when:

- A single identity provider issues tokens for multiple applications (web, mobile, API) with different audience claims
- You want to apply different configurations (e.g., different `meta_from_claim` mappings) for tokens from the same issuer but intended for different audiences
- You need to segregate or route tokens based on both issuer and audience

```json
{
    "client": {
        "token": {
            "jwks": {
                "enabled": true,
                "providers": [
                    {
                        "name": "auth0_web",
                        "enabled": true,
                        "endpoint": "https://tenant.auth0.com/.well-known/jwks.json",
                        "issuer": "https://tenant.auth0.com/",
                        "audience": "web-app"
                    },
                    {
                        "name": "auth0_mobile",
                        "enabled": true,
                        "endpoint": "https://tenant.auth0.com/.well-known/jwks.json",
                        "issuer": "https://tenant.auth0.com/",
                        "audience": "mobile-app"
                    },
                    {
                        "name": "auth0_api",
                        "enabled": true,
                        "endpoint": "https://tenant.auth0.com/.well-known/jwks.json",
                        "issuer": "https://tenant.auth0.com/",
                        "audience": "api-service"
                    }
                ]
            }
        }
    }
}
```

In this configuration:
- Tokens with `iss=https://tenant.auth0.com/` and `aud=web-app` will be matched to the `auth0_web` provider
- Tokens with `iss=https://tenant.auth0.com/` and `aud=mobile-app` will be matched to the `auth0_mobile` provider
- Tokens with `iss=https://tenant.auth0.com/` and `aud=api-service` will be matched to the `auth0_api` provider
- Tokens with the same issuer but an unrecognized audience will be rejected

**Validation rules:**
- If the same issuer appears in multiple enabled providers, each provider MUST have a different `audience` set
- Duplicate issuer+audience pairs are not allowed
- Providers with the same issuer cannot have empty audiences

### JWKS configuration

| Field    | Type    | Required | Description                                                               |
|----------|---------|----------|---------------------------------------------------------------------------|
| enabled  | `boolean` | Yes      | Must be `true` to enable multiple JWKS providers functionality          |
| providers | `array`  | Yes      | Array of JWKS provider configurations (see below)                        |

### JWKS provider fields

| Field    | Type    | Required | Description                                                               |
|----------|---------|----------|---------------------------------------------------------------------------|
| name     | `string`  | Yes      | Unique identifier for the provider. Must match pattern `^[a-zA-Z0-9_]{2,}$` |
| enabled  | `boolean` | No      | Whether this provider is active (default `false`)                                       |
| endpoint | `string`  | Yes*     | JWKS endpoint URL (*required if enabled)                                  |
| issuer   | `string`  | Yes*     | Expected issuer claim value (*required if enabled)                        |
| audience | `string`  | No       | Expected audience claim value. **While optional, it's highly recommended to set this in most cases** to prevent client tokens related to other audiences issued by the same issuer from being accepted by Centrifugo. When the same issuer is used by multiple providers, each must have a different audience set to enable issuer+audience matching                                  |
| tls      | [`TLS`](../server/configuration.md#tls-config-object) object  | No       | Custom TLS configuration for the JWKS endpoint HTTP client                            |
| meta_from_claim      | [StringKeyValues](../server/configuration.md#stringkeyvalues-type)  | No       | Config to transform JWT claims to connection meta object. Must be explicitly set for each provider, not inherited from upper config level.                              |

### How It Works

1. **Token Received**: When a client connects with a JWT token, Centrifugo parses it
2. **Issuer Extraction**: The `iss` claim is extracted from the token
3. **Provider Matching**: Centrifugo finds the JWKS provider based on issuer and audience:
   - If a provider has an `audience` configured, both issuer AND audience must match (exact match prioritized)
   - If a provider has no `audience` configured, only the issuer needs to match (fallback match)
   - This enables routing tokens from the same issuer to different providers based on audience
4. **Key Retrieval**: Public keys are fetched from the matched provider's endpoint
5. **Signature Verification**: The token signature is verified using the retrieved keys

If no provider matches the token's issuer (and audience when applicable), the connection is rejected.

### Subscription token

JWKS providers work for both connection tokens and subscription tokens. [As usual](../server/channel_token_auth.md#separate-subscription-token-config), configuration must be separate:

```json
{
    "client": {
        "token": {
            "jwks": {
                "enabled": true,
                "providers": [{
                    "name": "auth0_connection",
                    "enabled": true,
                    "endpoint": "https://tenant.auth0.com/.well-known/jwks.json",
                    "issuer": "https://tenant.auth0.com/",
                    "audience": "centrifugo"
                }]
            }
        },
        "subscription_token": {
            "enabled": true,
            "jwks": {
                "enabled": true,
                "providers": [{
                    "name": "subscription_identity",
                    "enabled": true,
                    "endpoint": "https://tenant.example.com/.well-known/jwks.json",
                    "issuer": "https://tenant.example.com",
                    "audience": "centrifugo"
                }]
            }
        }
    }
}
```

**Notes:**
- `meta_from_claim` is not supported for subscription tokens as subscription tokens do not support `meta` claim at this moment. This is validated on Centrifugo start.
- Issuer+audience matching works the same way for subscription tokens as it does for connection tokens - you can configure multiple providers with the same issuer but different audiences.
