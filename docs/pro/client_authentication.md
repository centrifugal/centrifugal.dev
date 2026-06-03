---
description: "Centrifugo PRO client authentication enhancements: extract JWT claims to connection meta and configure multiple JWKS providers for multi-tenant setups."
id: client_authentication
title: Client Authentication Enhancements
sidebar_label: Client authentication
---

Centrifugo OSS provides JWT-based client authentication. It's a very powerful mechanism because it helps a lot to reduce load on your session backend when dealing with many concurrent connections and [massive reconnections](/blog/2020/11/12/scaling-websocket#massive-reconnect) from time to time. Centrifugo PRO comes with extra features for more convenient client authentication management.

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
* Meta claims extraction allows using dots for extracting values from nested JWT claim objects. In `meta_from_claim` values, Centrifugo does not allow using special characters like `@#[]{}*?!` by default, but you can use the `\` character to escape them if needed. Values are validated on Centrifugo start.
* If a path in `meta_from_claim` value doesn't exist in the JWT token, it will be **silently skipped**. Only claims that exist in the token will be extracted.
* If your JWT token already contains a `meta` claim, the extracted fields will **override** the existing fields.
* Meta claims extraction only works for connection tokens, not subscription tokens. Subscription tokens do not support the `meta` claim.

## Client labels

Client labels are a small string-to-string map (`map[string]string`) attached to a connection at connect time. Once set, labels are **immutable** for the connection's lifetime. Centrifugo PRO uses them as a first-class connection primitive across many subsystems — think of them as Kubernetes labels or Datadog tags for real-time connections: a categorical key/value space operators set once at auth time, then segment, filter, and target on for the connection's lifetime.

### At a glance

| Where labels are set                                                                   | Where labels are used                                                                                          |
|----------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| JWT `labels` claim                                                                     | [Prometheus dimensions](./observability_enhancements.md#client-labels-as-prometheus-dimensions) on per-client metrics |
| JWT `labels_from_claim` mapping ([per token](#extracting-labels-from-jwt-claims) or per JWKS provider) | `label_filter` argument on [server API](./server_api_enhancements.md#targeted-ops-by-client-labels) `subscribe`/`unsubscribe`/`disconnect`/`refresh` |
| [Connect proxy](#from-the-connect-proxy-response) response `labels` field              | [Connections API](./connections.md) filtering and listings                                                     |
|                                                                                        | `labels` variable in [CEL expressions](./cel_expressions.md) for channel-permission gates                       |
|                                                                                        | [ClickHouse analytics](./analytics.md) `labels` column on `connections`, `operations`, `snapshot_connections`  |
|                                                                                        | [Snapshot](./connections.md) `label_filter` at gather time                                                     |
|                                                                                        | Always attached on outgoing [proxy requests](./event_hooks.md) (publish, subscribe, RPC, refresh, sub_refresh, map_publish, map_remove) |

### Labels vs `meta`

Centrifugo connections already have a `meta` JSON object that flows from JWT/proxy into per-connection metadata. Labels are a separate primitive with a narrower contract:

- **`meta`** is free-form JSON. Use it when your backend needs richer per-connection context — nested objects, arrays, app-specific shapes. Not filterable on the server side.
- **`labels`** is a typed `map[string]string`. Use it when the value is a categorical key/value pair you want to *filter on, segment by, or target with* an op (metrics dimensions, server-API `label_filter`, listings, CEL gates, analytics columns).

Rule of thumb: tier/region/app-version → `labels`. Anything richer than a string-keyed string value → `meta`. The same JWT claim can populate both — use whichever shape fits the consumer. Both are immutable after connect.

### Sources

Centrifugo PRO accepts client labels from two sources:

1. A top-level `labels` claim in the connection JWT.
2. The `labels_from_claim` mapping (see [Extracting labels from JWT claims](#extracting-labels-from-jwt-claims) below), analogous to `meta_from_claim`.

When both are present, mapped entries from `labels_from_claim` override entries from the top-level `labels` claim on key collisions.

### Top-level `labels` claim

The simplest path — put a `labels` object on your JWT:

```json
{
    "sub": "user42",
    "exp": 1799999999,
    "labels": {
        "region": "eu",
        "tier": "pro",
        "app_version": "3.4.1"
    }
}
```

All string keys and string values are accepted.

### Extracting labels from JWT claims

When the labels you want live on existing JWT claims (often the case with third-party identity providers), use `labels_from_claim` — same shape and semantics as [`meta_from_claim`](#extracting-meta-from-jwt-claims). Keys become label keys in the resulting map; values are gjson paths into the JWT claims.

```json
{
    "client": {
        "token": {
            "hmac_secret_key": "your-secret-key",
            "labels_from_claim": [
                { "key": "region", "value": "deployment.region" },
                { "key": "tier", "value": "subscription.tier" }
            ]
        }
    }
}
```

Given a JWT with claims `{"deployment": {"region": "eu"}, "subscription": {"tier": "pro"}, "sub": "user42"}`, the connection labels become `{"region": "eu", "tier": "pro"}`.

### Implementation notes

* `labels_from_claim` is configured per-token (`client.token.labels_from_claim`) and optionally per-JWKS-provider (`client.token.jwks.providers[].labels_from_claim`). Per-provider config wins over global config when a provider matches a token's issuer.
* Missing JWT paths are silently skipped — no empty-string insertion.
* Non-string scalar values from JWT claims are stringified with Go's `fmt.Sprint` semantics.
* `labels_from_claim` only works for connection tokens. Subscription tokens do not carry connection labels (validated on Centrifugo start).
* Labels are immutable post-connect. To change a label value, the client must reconnect with a new token.
* Avoid putting high-cardinality values (user IDs, session IDs) into labels — they end up as Prometheus dimensions (when `prometheus.client_labels` is set) and as a ClickHouse `Map(String, String)` column (when analytics is enabled). See the corresponding sections for the cardinality discussion.

### From the connect proxy response

When authentication is delegated to your backend via the [connect proxy](../server/proxy.md), the proxy response may include a top-level `labels` field with the same shape (`map<string, string>`). Centrifugo PRO attaches those labels to the connection just like the JWT path. When both a JWT and a connect proxy run for the same connection, the connect proxy wins (same precedence as `meta`).

```json
{
  "result": {
    "user": "user42",
    "labels": {"region": "eu", "tier": "pro"}
  }
}
```

### Outgoing proxy requests always carry labels

For every outgoing proxy request that already carries `meta` (publish, subscribe, RPC, refresh, sub_refresh, map publish, map remove), Centrifugo PRO **always** attaches the connection's `labels` as a top-level `labels` map. Unlike `meta`, this has no configuration toggle — labels are PRO-only and small, so opt-in adds friction without protecting against bloat (keep label cardinality low at the source instead).

```json
{
  "client": "abc123",
  "user": "user42",
  "channel": "chat:room",
  "data": {"text": "hi"},
  "labels": {"region": "eu", "tier": "pro"}
}
```

Backends can use the labels for routing, authorization, or correlation without a separate lookup against your session store.

### Consumers

Labels are one primitive flowing through many subsystems. This page is the reference for *setting* them; each consumer documents its own contract:

- **[Server API enhancements](./server_api_enhancements.md#targeted-ops-by-client-labels)** — `label_filter` and `all_users` on `subscribe`/`unsubscribe`/`disconnect`/`refresh` (including fleet-wide targeting).
- **[Connections API](./connections.md)** — `label_filter` on listings; the snapshot create endpoint accepts a gather-time `label_filter`.
- **[CEL expressions](./cel_expressions.md)** — the `labels` variable in channel-permission expressions.
- **[Observability enhancements](./observability_enhancements.md#client-labels-as-prometheus-dimensions)** — the `prometheus.client_labels` option, the `app_*` Prometheus dimension prefix, and the cardinality warning.
- **[ClickHouse analytics](./analytics.md)** — the `labels` column on `connections`, `operations`, and `snapshot_connections`, plus the one-time `ALTER TABLE` migration for existing deployments.
- **[Event hooks](./event_hooks.md)** — the connect proxy `labels` response field and the always-attached labels on outgoing proxy requests.

:::caution Keep cardinality bounded

Labels become Prometheus dimensions (when `prometheus.client_labels` is set) and ClickHouse `Map(String, String)` columns (when analytics is enabled). Never put user IDs, session IDs, request IDs, or other unbounded values into labels — they explode metric series and degrade analytics compression. Use bounded categorical sets: `region` (5–20 values), `tier` (3–5 values), `app_version` (dozens). The same rule applies to label *keys* — they are the column dictionary in ClickHouse.

:::

## Multiple JWKS Providers

Centrifugo PRO supports configuring multiple JWKS (JSON Web Key Set) providers for client connection authentication with automatic token routing based on the issuer (`iss`) claim. This may be useful for multi-tenant scenarios where tokens may come from different identity providers.

:::info

This feature is available since Centrifugo PRO v6.5.0, currently in beta status. Beta status means we can tweak some implementation details based on user feedback before marking it as stable.

:::

While the standard `client.token.jwks_public_endpoint` configuration allows fetching public keys from a single JWKS endpoint, this feature enables you to configure multiple JWKS endpoints, each associated with a specific token issuer. Centrifugo will automatically route token verification to the correct provider based on the `iss` (issuer) claim in the JWT.

**Note:** `client.token.jwks_public_endpoint` and `client.token.jwks.providers` are mutually exclusive at this point — you cannot use both at the same time.

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
- If the same issuer appears in multiple enabled providers, each provider MUST have a different `audience` set.
- Duplicate issuer+audience pairs are not allowed.
- Providers with the same issuer cannot have empty audiences.

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
| labels_from_claim    | [StringKeyValues](../server/configuration.md#stringkeyvalues-type)  | No       | Config to transform JWT claims to [connection labels](#client-labels). Must be explicitly set for each provider, not inherited from upper config level.                  |

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
- `meta_from_claim` is not supported for subscription tokens, as subscription tokens do not support the `meta` claim at this moment. This is validated on Centrifugo start.
- `labels_from_claim` is also not supported for subscription tokens — connection labels are a connect-time primitive only.
- Issuer+audience matching works the same way for subscription tokens as it does for connection tokens — you can configure multiple providers with the same issuer but different audiences.
