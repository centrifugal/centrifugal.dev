---
id: user_block
title: User blocking API
---

In addition to detailed observability properties Centrifugo PRO provides instruments for performing protective actions. One of such instruments is user blocking API which allows blocking a specific user in Centrifugo.

When user is blocked it will be disconnected from Centrifugo immediately and also on the next connect attempt right after JWT decoded (so that Centrifugo got a user ID) or after result from connect proxy received. In case of using connect proxy you can actually disconnect user yourself by implementing blocking check on the application backend side – but possibility to block user in Centrifugo can still be helpful.

## How it works

By default, information about user block/unblock requests shared throughout Centrifugo cluster and kept in memory. So user will be blocked until Centrifugo restart.

But it's possible to enable blocking information persistence – in this case information will survive Centrifugo restarts.

Centrifugo also automatically expires entries in the database (as soon as you provide `expire_at` in API request) to keep working set of blocked users reasonably small. Keeping pool of blocked users small allows avoiding expensive database lookups on every check – information is loaded periodically from the database and all checks performed over in-memory data structure – thus user blocking checks are cheap and have a small impact on overall system performance.

## Configure

User block feature is enabled by default in Centrifugo PRO (blocking information will be stored in process memory). To keep blocking information persistently you need configuration like this:

```json
{
    ...
    "database": {
        "dsn": "postgresql://postgres:test@127.0.0.1:5432/postgres"
    },
    "user_block": {
        "persist": true
    }
}
```

Centrifugo PRO supports only PostgreSQL as a storage backend.

## Block user API

Example:

```bash
curl --header "Content-Type: application/json" \
  --header "Authorization: apikey <API_KEY>" \
  --request POST \
  --data '{"method": "block_user", "params": {"user": "2695", "expire_at": 1635845122}}' \
  http://localhost:8000/api
```

#### Block user params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| user       | string  | yes | User ID to block       |
| expire_at       | int  | no | Unix time in the future when user blocking information should expire (Unix seconds). While optional **we recommend to use a reasonably small expiration time to keep working set of blocked users reasonably small (since Centrifugo nodes load all entries from the database table to construct in-memory cache)**    |

#### Block user result

Empty object at the moment.

## Unblock user API

Example:

```bash
curl --header "Content-Type: application/json" \
  --header "Authorization: apikey <API_KEY>" \
  --request POST \
  --data '{"method": "unblock_user", "params": {"user": "2695"}}' \
  http://localhost:8000/api
```

#### Unblock user params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| user       | string  | yes | User ID to unblock        |

#### Unblock user result

Empty object at the moment.
