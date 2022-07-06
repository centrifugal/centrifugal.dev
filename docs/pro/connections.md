---
id: connections
title: Connections API
---

Centrifugo PRO provides an additional API call `connections`. It allows getting all active sessions of the user (by user ID) without turning on presence feature for channels at all. It's also possible to attach any JSON payload to a connection which will be then visible in the result of `connections` call. The important thing is that this additional meta information won't be exposed to a client-side (unlike connection `info` for example).

This feature can be useful to manage active user sessions – for example in a messenger application. Users can look at a list of own current sessions and close some of them (possible with Centrifugo disconnect server API).

Let's look at example. Generate a JWT for user 42:

```
centrifugo genconfig
centrifugo gentoken -u 42
HMAC SHA-256 JWT for user 42 with expiration TTL 168h0m0s:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsImV4cCI6MTYyNzcxMzMzNX0.s3eOhujiyBjc4u21nuHkbcWJll4Um0QqGU3PF-6Mf7Y
```

Run Centrifugo with `uni_http_stream` transport enabled (it will allow us to connect from console):

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
  --header "Authorization: apikey <API_KEY>" \
  --request POST \
  --data '{"method": "connections", "params": {"user": "42"}}' \
  http://localhost:8000/api
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

Each connection can be annotated with meta JSON information which is set during connection establishment (over `meta` claim of JWT or by returning `meta` in connect proxy result).

#### User connections params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| user       | string  | no | fast filter by User ID        |
| expression       | string  | no | CEL expression to filter users        |

#### User connections result

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| connections       | map of string to UserConnectionInfo  | no | active user connections map where key is client ID and value is UserConnectionInfo      |

#### UserConnectionInfo

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| app_name       | string  | yes | client app name (if provided by client)         |
| app_version       | string  | yes | client app version (if provided by client)         |
| transport       | string  | no | client connection transport         |
| protocol       | string  | no | client connection protocol (json or protobuf) |
| state       | ConnectionState  | yes | connection state |

#### ConnectionState object

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| channels       | array of strings  | yes | Channels client subscribed to         |
| connection_token       | ConnectionTokenInfo  | yes | information about connection token         |
| subscription_tokens       | map<string, SubscriptionTokenInfo>  | yes |  information about channel tokens used to subscribe         |
| meta       | JSON object  | yes | meta information attached to a connection |

#### ConnectionTokenInfo object

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| uid       | string  | yes | unique token ID (jti)         |
| issued_at       | int  | yes | time (Unix seconds) when token was issued         |

#### SubscriptionTokenInfo object

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| uid       | string  | yes | unique token ID (jti)         |
| issued_at       | int  | yes | time (Unix seconds) when token was issued         |
