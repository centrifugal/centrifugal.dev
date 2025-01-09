---
id: user_block
title: User blocking API
---

One additional instrument for making protective actions in Centrifugo PRO is user blocking API which allows blocking a specific user on Centrifugo level.

When user is blocked it will be disconnected from Centrifugo immediately and also on the next connect attempt right after JWT decoded (so that Centrifugo got a user ID) or after result from connect proxy received. In case of using connect proxy you can actually disconnect user yourself by implementing blocking check on the application backend side – but possibility to block user in Centrifugo can still be helpful.

## How it works

By default, information about user block/unblock requests shared throughout Centrifugo cluster and kept in memory. So user will be blocked until Centrifugo restart.

But it's possible to enable blocking information persistence by configuring a persistence storage – in this case information will survive Centrifugo restarts.

Centrifugo also automatically expires entries in the storage to keep working set of blocked users reasonably small. Keeping pool of blocked users small allows avoiding expensive database lookups on every check – information is loaded periodically from the storage and all checks performed over in-memory data structure – thus user blocking checks are cheap and have a small impact on the overall system performance.

## Configure

User block feature is enabled by default in Centrifugo PRO (blocking information will be stored in process memory). To keep blocking information persistently you need to configure persistence engine.

There are two types of persistent engines supported at the moment:

1. `redis`
1. `database`

### Redis persistence engine

Blocking data can be kept in Redis. To enable this configuration should be:

```json
{
    ...
    "user_block": {
        "persistence_engine": "redis",
        "redis_address": "localhost:6379"
    }
}
```

:::danger

Unlike many other Redis features in Centrifugo consistent sharding is not supported for blocking data. The reason is that we don't want to loose blocking information when additional Redis node added. So only one Redis shard can be provided for `user_block` feature. This should be fine given that working set of blocked users should be reasonably small and old entries expire. If you try to set several Redis shards here Centrifugo will exit with an error on start.

:::

:::caution

One more thing you may notice is that Redis configuration here does not have `use_redis_from_engine` option. The reason is that since Redis is not shardable here reusing Redis configuration here could cause problems at the moment of Redis scaling – which we want to avoid thus require explicit configuration here.

:::

### Database persistence engine

Blocking data can be kept in the relational database. Only PostgreSQL is supported.

To enable this configuration should be like:

```json
{
    ...
    "database": {
        "dsn": "postgresql://postgres:pass@127.0.0.1:5432/postgres"
    },
    "user_block": {
        "persistence_engine": "database"
    }
}
```

:::tip

To quickly start local PostgreSQL database:

```
docker run -it --rm -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:15
```

:::

## Block  API

### block_user

Example:

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{"user": "2695", "expire_at": 1635845122}' \
  http://localhost:8000/api/block_user
```

#### block_user params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| user       | string  | yes | User ID to block       |
| expire_at       | int  | no | Unix time in the future when user blocking information should expire (Unix seconds). While optional **we recommend to use a reasonably small expiration time** to keep working set of blocked users small (since Centrifugo nodes periodically load all entries from the storage to construct in-memory cache). |

#### block_user result

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

#### unblock_user params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| user       | string  | yes | User ID to unblock        |

#### unblock_user result

Empty object at the moment.
