---
description: "Centrifugo PRO server API enhancements: JWKS-based authentication for HTTP and GRPC server APIs, and client-label-based filtering for targeted server-API operations and connection listings."
id: server_api_enhancements
sidebar_label: Server API enhancements
title: Server API enhancements
---

Centrifugo PRO extends the OSS [server API](../server/server_api.md) with extra authentication options and request arguments. This page documents the additions; everything else (transport, base method semantics) is inherited from OSS unchanged.

## JWKS authentication

Centrifugo PRO supports protecting HTTP API and GRPC API with JWKS (JSON Web Key Set) based authentication. This allows you to use JWT tokens issued by your identity provider (like Keycloak, Auth0, or any other OIDC-compliant provider) to authenticate server API requests.

### Overview

Instead of using the traditional API key authentication with `X-API-Key` header (for HTTP API) or metadata (for GRPC API), you can configure Centrifugo to validate JWT tokens signed by keys from a JWKS endpoint. This provides a more flexible and standardized way to protect your server API, especially when integrating with existing identity and access management systems.

![server API JWKS](/img/server_api_jwks.png)

The feature is available since Centrifugo PRO v6.3.2

### Configuration

#### HTTP API

JWKS authentication is configured under the `http_api.jwks` section:

```json title="config.json"
{
  "http_api": {
    "jwks": {
      "enabled": true,
      "endpoint": "https://keycloak.test.env/auth/realms/myrealm/protocol/openid-connect/certs",
      "audience": "https://centrifugo.test.env",
      "issuer": "https://keycloak.test.env/auth/realms/myrealm",
      "scope": "centrifugo:api"
    }
  }
}
```

#### GRPC API

JWKS authentication is configured under the `grpc_api.jwks` section:

```json title="config.json"
{
  "grpc_api": {
    "enabled": true,
    "port": 10000,
    "key": "optional-api-key",
    "jwks": {
      "enabled": true,
      "endpoint": "https://keycloak.example.com/.well-known/jwks.json",
      "audience": "my-audience",
      "issuer": "https://keycloak.example.com",
      "scope": "centrifugo:api",
      "tls": {
        "enabled": true
      }
    }
  }
}
```

#### Configuration options

##### `http_api.jwks.enabled` / `grpc_api.jwks.enabled`

Boolean. Default: `false`.

Turns on JWKS authentication for HTTP API or GRPC API. When enabled, Centrifugo will validate JWT tokens from the `Authorization: Bearer <TOKEN>` header (for HTTP API) or from gRPC metadata (for GRPC API) against the JWKS endpoint.

##### `http_api.jwks.endpoint` / `grpc_api.jwks.endpoint`

String. Required when JWKS is enabled.

URL to fetch JWKS from. This is typically the OIDC provider's JWKS endpoint.

Examples:
- Keycloak: `https://keycloak.example.com/realms/myrealm/protocol/openid-connect/certs`
- Auth0: `https://YOUR_DOMAIN.auth0.com/.well-known/jwks.json`
- Custom OIDC provider: `https://identity.example.com/.well-known/jwks.json`

##### `http_api.jwks.audience` / `grpc_api.jwks.audience`

String. Optional; when not set, audience check is skipped. It's recommended to set it.

The expected audience claim (`aud`) in the JWT token. This should match the audience configured in your identity provider for Centrifugo.

Example: `https://centrifugo.test.env`

##### `http_api.jwks.issuer` / `grpc_api.jwks.issuer`

String. Optional; when not set, issuer check is skipped. It's recommended to set it.

The expected issuer claim (`iss`) in the JWT token. This should match the issuer of tokens from your identity provider.

Example: `https://keycloak.test.env/auth/realms/myrealm`

##### `http_api.jwks.scope` / `grpc_api.jwks.scope`

String. Optional.

The required scope claim in the JWT token. If set, Centrifugo will verify that the token contains this scope. The scope claim can be either a string or an array of strings in the JWT.

Example: `centrifugo:api`

##### `http_api.jwks.tls` / `grpc_api.jwks.tls`

[Unified TLS object](../server/configuration.md#tls-config-object). Optional.

TLS configuration for HTTPS connection to JWKS endpoint. Use this if your JWKS endpoint requires custom TLS settings, such as custom CA certificates or client certificates.

### Usage

#### HTTP API

Once JWKS authentication is configured, API clients need to provide a valid JWT token in the `Authorization` header when making HTTP API requests:

```bash
curl --header "Authorization: Bearer <JWT_TOKEN>" \
  --request POST \
  --data '{"channel": "chat", "data": {"text": "hello"}}' \
  http://localhost:8000/api/publish
```

Example with httpie:

```bash
echo '{"channel": "chat", "data": {"text": "hello"}}' | \
  http POST "http://localhost:8000/api/publish" \
  "Authorization: Bearer <JWT_TOKEN>"
```

#### GRPC API

For GRPC API, clients need to provide the JWT token in the gRPC metadata with the `authorization` key:

```
authorization: Bearer <JWT_TOKEN>
```

The exact implementation depends on your gRPC client library. Here's an example using Go:

```go
import (
    "context"
    "google.golang.org/grpc"
    "google.golang.org/grpc/metadata"
)

// Create context with authorization metadata
md := metadata.New(map[string]string{
    "authorization": "Bearer " + token,
})
ctx := metadata.NewOutgoingContext(context.Background(), md)

// Make GRPC API call with authenticated context
response, err := client.Publish(ctx, &api.PublishRequest{
    Channel: "chat",
    Data:    []byte(`{"text": "hello"}`),
})
```

### JWKS caching, refresh and rotation

Centrifugo automatically caches the JWKS keys fetched from the endpoint to avoid making a request on every API call. The cache is periodically refreshed to pick up key rotations performed by your identity provider.

### Combining with API key authentication

JWKS authentication can be used alongside API key authentication provided by Centrifugo OSS. If both `http_api.key` and `http_api.jwks` are configured (or `grpc_api.key` and `grpc_api.jwks`), Centrifugo PRO will accept requests authenticated with either method:

```json title="config.json"
{
  "http_api": {
    "key": "my-api-key",
    "jwks": {
      "enabled": true,
      "endpoint": "https://keycloak.test.env/auth/realms/myrealm/protocol/openid-connect/certs",
      "audience": "https://centrifugo.test.env",
      "issuer": "https://keycloak.test.env/auth/realms/myrealm"
    }
  },
  "grpc_api": {
    "enabled": true,
    "port": 10000,
    "key": "my-api-key",
    "jwks": {
      "enabled": true,
      "endpoint": "https://keycloak.test.env/auth/realms/myrealm/protocol/openid-connect/certs",
      "audience": "https://centrifugo.test.env",
      "issuer": "https://keycloak.test.env/auth/realms/myrealm"
    }
  }
}
```

This can be useful during migration from API key to JWKS authentication, or when you need to support both authentication methods simultaneously.

### Example: Keycloak integration

Here's a complete example of integrating Centrifugo HTTP API and GRPC API with Keycloak:

1. **Configure Keycloak client**:
   - Create a client in Keycloak with client authentication enabled
   - Set valid redirect URIs
   - Add a custom scope `centrifugo:api`
   - Note the JWKS endpoint URL from realm settings

2. **Configure Centrifugo**:

```json title="config.json"
{
  "http_api": {
    "jwks": {
      "enabled": true,
      "endpoint": "https://keycloak.example.com/auth/realms/myrealm/protocol/openid-connect/certs",
      "issuer": "https://keycloak.example.com/auth/realms/myrealm",
      "scope": "centrifugo:api"
    }
  },
  "grpc_api": {
    "enabled": true,
    "port": 10000,
    "jwks": {
      "enabled": true,
      "endpoint": "https://keycloak.example.com/auth/realms/myrealm/protocol/openid-connect/certs",
      "issuer": "https://keycloak.example.com/auth/realms/myrealm",
      "scope": "centrifugo:api"
    }
  }
}
```

3. **Obtain a token from Keycloak** (usually this is done by your backend service):

```bash
TOKEN=$(curl -X POST "https://keycloak.example.com/auth/realms/myrealm/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=myclient" \
  -d "client_secret=mysecret" \
  -d "grant_type=client_credentials" \
  -d "scope=centrifugo:api" \
  | jq -r '.access_token')
```

4. **Use the token with Centrifugo HTTP API** (usually this is done by your backend service):

```bash
curl --header "Authorization: Bearer $TOKEN" \
  --request POST \
  --data '{"channel": "chat", "data": {"text": "hello"}}' \
  https://centrifugo.example.com/api/publish
```

5. **Use the token with Centrifugo GRPC API** (usually this is done by your backend service):

```go
md := metadata.New(map[string]string{
    "authorization": "Bearer " + token,
})
ctx := metadata.NewOutgoingContext(context.Background(), md)

response, err := client.Publish(ctx, &api.PublishRequest{
    Channel: "chat",
    Data:    []byte(`{"text": "hello"}`),
})
```

## Filtering targeted ops by client labels

The `subscribe`, `unsubscribe`, `disconnect`, and `refresh` methods accept an optional `label_filter` argument that further narrows the call to connections whose [client labels](./client_authentication.md#client-labels) match the predicate.

:::caution Requires `user` to be set

`label_filter` on these four ops is a **narrower within a user's connections**, not a fleet-wide selector. The op still requires `user` (or `client` / `session`) to identify which connections to consider. A request that sets only `label_filter` with an empty `user` matches zero connections and silently no-ops.

This mirrors how `client` and `session` work today — they narrow within a user's connections, never act fleet-wide on their own. The same constraint applies because the underlying centrifuge hub is indexed by user ID, so the op machinery dispatches to a user first and then iterates that user's connections.

For fleet-wide *listings* by labels (no `user` required), use the [`connections`](./connections.md) API, which goes through a survey across the entire hub. For fleet-wide *actions* by labels, list connections by label first and dispatch the action per user.

:::

The filter uses the same FilterNode tree as the [server tags filter](./server_tags_filter.md): operators `eq`, `neq`, `in`, `nin`, `ex`, `nex`, `sw`, `ew`, `ct`, `gt`, `gte`, `lt`, `lte`, `and`, `or`, `not`. The difference is the *subject*: `server_tags_filter` matches publication tags; `label_filter` matches connection labels (`map[string]string`) attached to the centrifuge client.

### Examples

Disconnect a user's connections only when they are on a beta build:

```bash
curl --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{
    "user": "user42",
    "label_filter": {"key": "channel", "cmp": "eq", "val": "beta"}
  }' \
  http://localhost:8000/api/disconnect
```

Refresh a user's connections only when they are running a deprecated app version (handy after rolling out new auth requirements that older clients can't honor):

```bash
curl --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{
    "user": "user42",
    "expired": true,
    "label_filter": {"key": "app_version", "cmp": "in", "vals": ["1.0.0", "1.1.0"]}
  }' \
  http://localhost:8000/api/refresh
```

Server-side subscribe a user's pro-tier connections to a feature channel, leaving free-tier connections alone:

```bash
curl --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{
    "user": "user42",
    "channel": "pricing:v2",
    "label_filter": {"key": "tier", "cmp": "eq", "val": "pro"}
  }' \
  http://localhost:8000/api/subscribe
```

Unsubscribe a user's legacy desktop connections from a chat channel:

```bash
curl --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{
    "user": "user42",
    "channel": "chat:lobby",
    "label_filter": {
      "op": "and",
      "nodes": [
        {"key": "platform", "cmp": "eq", "val": "desktop"},
        {"key": "app_version", "cmp": "lt", "val": "3.0.0"}
      ]
    }
  }' \
  http://localhost:8000/api/unsubscribe
```

### Combining with `client` and `session`

`label_filter` is **additive** with `client` and `session` — they further narrow within the same user's connections. A connection must match all set criteria to be affected by the op.

### Connections listing with `label_filter`

The [`connections`](./connections.md) admin API supports `label_filter` as a fleet-wide selector — it doesn't require `user` to be set. Listings go through a per-node survey across the entire hub. The snapshot creation endpoint also accepts `label_filter` and applies it at gather time — see [Connections API](./connections.md) for the details.

## See also

- [Client labels](./client_authentication.md#client-labels) — how to attach labels via JWT or connect proxy.
- [Server tags filter](./server_tags_filter.md) — sibling FilterNode-based feature for per-publication tag filtering.
- [Connections API](./connections.md) — the PRO `connections` listing endpoint and snapshot endpoints.
