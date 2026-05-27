---
description: "Query and inspect active real-time connections with the Centrifugo PRO Connections API. Filter by user ID or CEL expression with session details."
id: connections
title: Connections API
---

Centrifugo PRO offers an extra API call, `connections`, which enables retrieval of all active sessions (based on user ID or expression) without the need to activate the presence feature for channels. Furthermore, developers can attach any desired JSON payload to a connection that will then be visible in the result of the connections call. It's worth noting that this additional meta-information remains hidden from the client side, unlike the info associated with the connection.

This feature serves a valuable purpose in managing active user sessions, particularly for messenger applications. Users can review their current sessions and terminate some of them using the Centrifugo disconnect server API.

Moreover, this feature can help developers investigate issues by providing insights into the system's state.

### Example

Let's look at the quick example. First, generate a JWT for user 42:

```bash
$ centrifugo genconfig
```

Generate token for some user to be used in the example connections:

```bash
$ centrifugo gentoken -u 42
HMAC SHA-256 JWT for user 42 with expiration TTL 168h0m0s:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsImV4cCI6MTYyNzcxMzMzNX0.s3eOhujiyBjc4u21nuHkbcWJll4Um0QqGU3PF-6Mf7Y
```

Run Centrifugo with `uni_http_stream` transport enabled (it will allow us connecting from the terminal with `curl`):

```
CENTRIFUGO_UNI_HTTP_STREAM=1 centrifugo -c config.json
```

Create new terminal window and run:

```bash
curl -X POST http://localhost:8000/connection/uni_http_stream --data '{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsImV4cCI6MTYyNzcxMzMzNX0.s3eOhujiyBjc4u21nuHkbcWJll4Um0QqGU3PF-6Mf7Y", "name": "terminal"}'
```

In another terminal create one more connection:

```bash
curl -X POST http://localhost:8000/connection/uni_http_stream --data '{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsImV4cCI6MTYyNzcxMzMzNX0.s3eOhujiyBjc4u21nuHkbcWJll4Um0QqGU3PF-6Mf7Y", "name": "terminal"}'
```

Now let's call `connections` over HTTP API:

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{"user": "42"}' \
  http://localhost:8000/api/connections
```

The result:

```json
{
    "result": {
        "connections": {
            "db8bc772-2654-4283-851a-f29b888ace74": {
                "app_name": "terminal",
                "transport": "uni_http_stream",
                "protocol": "json"
            },
            "4bc3ca70-ecc5-439d-af14-a78ae18e31c7": {
                "app_name": "terminal",
                "transport": "uni_http_stream",
                "protocol": "json"
            }
        }
    }
}
```

Here we can see that user has 2 connections from `terminal` app.

Each connection can be annotated with meta JSON information which is set during connection establishment (via the `meta` claim of JWT or by returning `meta` in the connect proxy result).

### connections

Returns information about active connections according to the request. 

#### ConnectionsRequest

| Parameter name | Parameter type | Required | Description                                                                                                                       |
|----------------|----------------|----------|-----------------------------------------------------------------------------------------------------------------------------------|
| `user`         | `string`       | no       | fast filter by User ID                                                                                                            |
| `expression`   | `string`       | no       | CEL expression to filter users                                                                                                    |
| `label_filter` | `FilterNode`   | no       | Restrict the listing to connections whose [labels](./client_authentication.md#client-labels) match this filter (see [Label filter](#label-filter) below) |

At least one of `user`, `expression`, or `label_filter` must be set — the API rejects requests with all three empty so an accidentally-blank request doesn't return the entire fleet.

#### ConnectionsResult

| Field name    | Field type                  | Optional | Description                                                                    |
|---------------|-----------------------------|----------|--------------------------------------------------------------------------------|
| `connections` | `map[string]ConnectionInfo` | no       | active user connections map where key is client ID and value is ConnectionInfo |

#### ConnectionInfo

| Field name    | Field type          | Optional | Description                                                                            |
|---------------|---------------------|----------|----------------------------------------------------------------------------------------|
| `app_name`    | `string`            | yes      | client app name (if provided by client)                                                |
| `app_version` | `string`            | yes      | client app version (if provided by client)                                             |
| `transport`   | `string`            | no       | client connection transport                                                            |
| `protocol`    | `string`            | no       | client connection protocol (json or protobuf)                                          |
| `user`        | `string`            | yes      | client user ID                                                                         |
| `state`       | `ConnectionState`   | yes      | connection state                                                                       |
| `labels`      | `map[string]string` | yes      | [client labels](./client_authentication.md#client-labels) attached to the connection   |

#### ConnectionState object

| Field name            | Field type                         | Optional | Description                                        |
|-----------------------|------------------------------------|----------|----------------------------------------------------|
| `channels`            | `map[string]ChannelContext`        | yes      | Channels client subscribed to                      |
| `connection_token`    | `ConnectionTokenInfo`              | yes      | information about connection token                 |
| `subscription_tokens` | `map[string]SubscriptionTokenInfo` | yes      | information about channel tokens used to subscribe |
| `meta`                | `JSON` object                      | yes      | meta information attached to a connection          |

#### ChannelContext object

| Field name | Field type | Optional | Description                        |
|------------|------------|----------|------------------------------------|
| `source`   | `int`      | yes      | The source of channel subscription |

#### ConnectionTokenInfo object

| Field name  | Field type | Optional | Description                               |
|-------------|------------|----------|-------------------------------------------|
| `uid`       | `string`   | yes      | unique token ID (jti)                     |
| `issued_at` | `int`      | yes      | time (Unix seconds) when token was issued |

#### SubscriptionTokenInfo object

| Field name  | Field type | Optional | Description                               |
|-------------|------------|----------|-------------------------------------------|
| `uid`       | `string`   | yes      | unique token ID (jti)                     |
| `issued_at` | `int`      | yes      | time (Unix seconds) when token was issued |

### Label filter

`label_filter` on `connections` restricts the listing to connections whose [labels](./client_authentication.md#client-labels) match the predicate. The listing supports `label_filter` as a fleet-wide selector — `user` and `expression` may both be left unset when filtering by labels alone (no `all_users` flag needed here; the survey already walks the full hub).

For *acting* on the matched connections fleet-wide (disconnect, refresh, subscribe, unsubscribe) see [Server API enhancements → targeted ops by client labels](./server_api_enhancements.md#targeted-ops-by-client-labels), which use the `all_users` flag.

Fleet-wide example (every EU pro/enterprise connection across all users):

```json
{
  "label_filter": {
    "op": "and",
    "nodes": [
      {"key": "region", "cmp": "eq", "val": "eu"},
      {"key": "tier", "cmp": "in", "vals": ["pro", "enterprise"]}
    ]
  }
}
```

Combine with `user` to scope the listing within a user's connections:

```json
{
  "user": "user42",
  "label_filter": {"key": "tier", "cmp": "eq", "val": "pro"}
}
```

The listing is implemented as a survey over each node's full connection hub, evaluating the filter per-client in-memory (no label index). Listings on very large deployments — tens of thousands of connections per node — scale linearly with hub size; prefer narrower scoping (`user`) when the same query can be expressed that way.
