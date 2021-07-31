---
id: user_connections
title: User connections RPC
---

One more Centrifugo PRO feature is a `getUserConnections` RPC call. It allows to get all active sessions of the user (by user ID) without turning on presence feature for channels at all. It's also possible to attach any JSON payload to a connection which will be then visible in the result of `getUserConnections` call. This additional meta information won't be exposed to a client-side.

This feature can be useful to manage active user sessions – for example in a messenger application. Users can look at a list of current sessions and close some of them (possible with Centrifugo disconnect server API).

Below is a feature showcase using admin web UI, but this call is available over HTTP or GRPC server API.

<video width="100%" controls>
  <source src="/img/user_connections.mp4" type="video/mp4" />
  Sorry, your browser doesn't support embedded video.
</video>

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

Then let's call `getUserConnections` using Centrifugo HTTP API RPC extension:

```bash
curl --header "Content-Type: application/json" \
  --header "Authorization: apikey <API_KEY>" \
  --request POST \
  --data '{"method": "rpc", "params": {"method": "getUserConnections", "params": {"user": "42"}}}' \
  http://localhost:8000/api
```

The result:

```json
{
    "result":{
        "data":{
            "0a32d5a2-d898-44fa-b498-bf0bfb064862":{
                "app_name": "terminal"
            },
            "322a7e2f-b3b5-4131-aa0d-3bf343b6a4fe":{
                "app_name": "terminal"
            }
        }
    }
}
```

Here we can see that user has 2 connections from `terminal` app.

Each connection can be annotated with meta JSON information which is set during connection establishment (over `meta` claim of JWT or by returning `meta` in connect proxy result).
