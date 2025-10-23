---
id: client_authentication
title: Client Authentication Improvements
sidebar_label: Client authentication
---

Centrifugo PRO comes with extra features for more convenient client authentication management.

## Multiple JWKS Providers

Centrifugo PRO supports configuring multiple JWKS (JSON Web Key Set) providers with automatic token routing based on the issuer claim. This is may be useful for multi-tenant scenarios where tokens may come from different identity providers.

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

### Provider Configuration Fields

| Field    | Type    | Required | Description                                                               |
|----------|---------|----------|---------------------------------------------------------------------------|
| name     | string  | Yes      | Unique identifier for the provider. Must match pattern `^[a-zA-Z0-9_]{2,}$` |
| enabled  | boolean | Yes      | Whether this provider is active                                           |
| endpoint | string  | Yes*     | JWKS endpoint URL (*required if enabled)                                  |
| issuer   | string  | Yes*     | Expected issuer claim value (*required if enabled)                        |
| audience | string  | No       | Expected audience claim value (optional)                                  |
| tls      | object  | No       | Custom TLS configuration for the JWKS endpoint                            |

How It Works

1. Token Received: When a client connects with a JWT token, Centrifugo parses it
2. Issuer Extraction: The `iss` claim is extracted from the token
3. Provider Matching: Centrifugo finds the JWKS provider with matching issuer
4. Key Retrieval: Public keys are fetched from the provider's endpoint
5. Signature Verification: The token signature is verified using the retrieved keys
6. Audience Validation: If audience is configured for the provider, it's validated against the token's aud claim

If no provider matches the token's issuer, the connection is rejected.

### Subscription Token

JWKS providers work for both connection tokens and subscription tokens. Configure them separately:

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

Validation Rules

Centrifugo validates JWKS provider configuration at startup:

- Unique names: All provider names must be unique
- Valid name pattern: Names must match `^[a-zA-Z0-9_]{2,}$`
- Required fields: Enabled providers must have both `endpoint` and `issuer` set
- Unique issuers: Each enabled provider must have a unique issuer value
- Mutual exclusivity: Cannot use both `jwks_providers` and `jwks_public_endpoint`

## Custom meta from JWT claims

TODO.