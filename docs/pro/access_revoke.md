---
description: "Block users and revoke JWT tokens using Centrifugo PRO user blocking and token revocation APIs with Redis or PostgreSQL persistence."
id: access_revoke
title: User blocking and token revocation
---

Centrifugo PRO provides protective APIs for blocking users and revoking tokens. Both features share a similar design: information is distributed across the cluster and kept in memory by default, with optional persistent storage via Redis or PostgreSQL. Entries expire automatically to keep the working set small – all checks are performed over in-memory data structures, so they are cheap and have minimal performance impact.

## User blocking

When a user is blocked they will be disconnected from Centrifugo immediately and also on the next connect attempt right after JWT decoded (so that Centrifugo got a user ID) or after result from connect proxy received. In case of using connect proxy you can actually disconnect user yourself by implementing blocking check on the application backend side – but possibility to block user in Centrifugo can still be helpful.

User block feature is enabled by default in Centrifugo PRO (blocking information will be stored in process memory). To keep blocking information persistently you need to configure a persistence engine – see [persistence configuration](#persistence-configuration) below.

### block_user

Example:

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{"user": "2695", "expire_at": 1635845122}' \
  http://localhost:8000/api/block_user
```

#### BlockUserRequest

| Parameter name | Parameter type | Required | Description                                                                                                                                                                                                                                                                                                     |
|----------------|----------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `user`         | `string`       | yes      | User ID to block                                                                                                                                                                                                                                                                                                |
| `expire_at`    | `int`          | no       | Unix time in the future when user blocking information should expire (Unix seconds). While optional **we recommend to use a reasonably small expiration time** to keep working set of blocked users small (since Centrifugo nodes periodically load all entries from the storage to construct in-memory cache). |

#### BlockUserResult

Empty object at the moment.

### unblock_user

Example:

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{"user": "2695"}' \
  http://localhost:8000/api/unblock_user
```

#### UnblockUserRequest

| Parameter name | Parameter type | Required | Description        |
|----------------|----------------|----------|--------------------|
| `user`         | `string`       | yes      | User ID to unblock |

#### UnblockUserResult

Empty object at the moment.

## Token revocation

Centrifugo PRO provides two ways to revoke tokens:

1. Revoke token by ID: based on [jti](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.7) claim in the case of JWT.
1. Revoke all user's tokens issued before certain time: based on [iat](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.6) in the case of JWT.

When token is revoked client with such token will be disconnected from Centrifugo shortly. And attempt to connect with a revoked token won't succeed.

Token revocation features (both revocation by token ID and user token invalidation by issue time) are enabled by default in Centrifugo PRO (as soon as your JWTs has `jti` and `iat` claims you will be able to use revocation APIs). By default revocation information is kept in process memory. To persist it configure a storage engine – see [persistence configuration](#persistence-configuration) below.

### revoke_token

Allows revoking individual tokens. For example, this may be useful when token leakage has been detected and you want to revoke access for a particular token. BTW Centrifugo PRO provides `user_connections` API which has an information about tokens for active users connections (if set in JWT).

:::caution

This API assumes that JWTs you are using contain `"jti"` claim which is a unique token ID (according to [RFC](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.7)).

:::

Example:

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{"uid": "xxx-xxx-xxx", "expire_at": 1635845122}' \
  http://localhost:8000/api/revoke_token
```

#### revoke_token params

| Parameter name | Parameter type | Required | Description                                                                                                                                                                                                                                                                                                                                                   |
|----------------|----------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `uid`          | `string`       | yes      | Token unique ID (JTI claim in case of JWT)                                                                                                                                                                                                                                                                                                                    |
| `expire_at`    | `int`          | no       | Unix time in the future when revocation information should expire (Unix seconds). While optional **we recommend to use a reasonably small expiration time (matching the expiration time of your JWTs)** to keep working set of revocations small (since Centrifugo nodes periodically load all entries from the database table to construct in-memory cache). |

#### revoke_token result

Empty object at the moment.

### invalidate_user_tokens

Allows revoking all tokens for a user which were issued before a certain time. For example, this may be useful after user changed a password in an application.

:::caution

This API assumes that JWTs you are using contain `"iat"` claim which is a time token was issued at (according to [RFC](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.6)).

:::

Example:

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{"user": "test", "issued_before": 1635845022, "expire_at": 1635845122}' \
  http://localhost:8000/api/invalidate_user_tokens
```

#### InvalidateUserTokensRequest

| Parameter name  | Parameter type | Required | Description                                                                                                                                                                                                                                                                                                                                                   |
|-----------------|----------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `user`          | `string`       | yes      | User ID to invalidate tokens for                                                                                                                                                                                                                                                                                                                              |
| `issued_before` | `int`          | no       | All tokens issued at before this Unix time will be considered revoked (in case of JWT this requires `iat` to be properly set in JWT), if not provided server uses current time                                                                                                                                                                                |
| `expire_at`     | `int`          | no       | Unix time in the future when revocation information should expire (Unix seconds). While optional **we recommend to use a reasonably small expiration time (matching the expiration time of your JWTs)** to keep working set of revocations small (since Centrifugo nodes periodically load all entries from the database table to construct in-memory cache). |

#### InvalidateUserTokensResult

Empty object.

## Persistence configuration

By default both user blocking and token revocation data is kept in process memory and will be lost on restart. To persist this data, configure a storage engine.

Two persistent engines are supported:

1. `redis`
1. `database`

### Redis persistence engine

```json title="config.json"
{
  "user_block": {
    "storage_type": "redis",
    "redis": {
      "address": "localhost:6379"
    }
  },
  "token_revoke": {
    "storage_type": "redis",
    "redis": {
      "address": "localhost:6379"
    }
  },
  "user_tokens_invalidate": {
    "storage_type": "redis",
    "redis": {
      "address": "localhost:6379"
    }
  }
}
```

:::danger

Unlike many other Redis features in Centrifugo consistent sharding is not supported for blocking and revocation data. The reason is that we don't want to lose this information when additional Redis node added. So only one Redis shard can be provided for `user_block`, `token_revoke` and `user_tokens_invalidate` features. This should be fine given that working set should be reasonably small and old entries expire. If you try to set several Redis shards here Centrifugo will exit with an error on start.

:::

:::caution

One more thing you may notice is that Redis configuration here does not have `use_redis_from_engine` option. The reason is that since Redis is not shardable here reusing Redis configuration could cause problems at the moment of Redis scaling – which we want to avoid thus require explicit configuration here.

:::

### Database persistence engine

Only PostgreSQL is supported.

```json title="config.json"
{
  "database": {
    "enabled": true,
    "postgresql": {
      "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres"
    }
  },
  "user_block": {
    "storage_type": "database"
  },
  "token_revoke": {
    "storage_type": "database"
  },
  "user_tokens_invalidate": {
    "storage_type": "database"
  }
}
```

:::tip

To quickly start local PostgreSQL database:

```
docker run -it --rm -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:15
```

:::
