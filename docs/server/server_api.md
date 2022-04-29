---
id: server_api
title: Server API
---

Server API is a way to send various commands to Centrifugo. For example, server API allows publishing messages to channels, get server statistics, etc. There are two kinds of API available at the moment:

* HTTP API
* GRPC API

## HTTP API

Server HTTP API works on `/api` endpoint (by default). It has a simple request format: this is an HTTP POST request with `application/json` Content-Type and with JSON command body.

Here we will look at available methods and parameters

:::tip

In some cases, you can just use one of our [available HTTP API libraries](../ecosystem/api.md) or use Centrifugo [GRPC API](#grpc-api) to avoid manually constructing requests.

:::

### HTTP API authorization

HTTP API protected by `api_key` set in Centrifugo configuration. I.e. `api_key` option must be added to config, like:

```json title="config.json"
{
    ...
    "api_key": "<YOUR API KEY>"
}
```

This API key must be set in the request `Authorization` header in this way:

```
Authorization: apikey <KEY>
```

It's also possible to pass API key over URL query param. This solves some edge cases where it's not possible to use the `Authorization` header. Simply add `?api_key=<YOUR API KEY>` query param to the API endpoint. Keep in mind that passing the API key in the `Authorization` header is a recommended way. 

It's possible to disable API key check on Centrifugo side using the `api_insecure` configuration option. Be sure to protect the API endpoint by firewall rules, in this case, to prevent anyone on the internet to send commands over your unprotected Centrifugo API endpoint. API key auth is not very safe for man-in-the-middle so we also recommended running Centrifugo with TLS.

A command is a JSON object with two properties: `method` and `params`.

* `method` is the name of the API command you want to call.
* `params` is an object with command arguments. Each `method` can have its own `params`

Before looking at all available commands here is a CURL that calls `info` command:

```bash
curl --header "Authorization: apikey <API_KEY>" \
  --request POST \
  --data '{"method": "info", "params": {}}' \
  http://localhost:8000/api
```

Here is a live example:

<iframe width="100%" height="400" src="/img/api_example.mp4" frameborder="0" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

Now let's investigate each API method in detail.

### publish

Publish command allows publishing data into a channel. Most probably this is a command you'll use most.

It looks like this:

```json
{
    "method": "publish",
    "params": {
        "channel": "chat", 
        "data": {
            "text": "hello"
        }
    } 
}
```

Let's apply all information said above and send publish command to Centrifugo. We will send a request using the `requests` library for Python. 

```python
import json
import requests

command = {
    "method": "publish",
    "params": {
        "channel": "docs", 
        "data": {
            "content": "1"
        }
    }
}

api_key = "YOUR_API_KEY"
data = json.dumps(command)
headers = {'Content-type': 'application/json', 'Authorization': 'apikey ' + api_key}
resp = requests.post("https://centrifuge.example.com/api", data=data, headers=headers)
print(resp.json())
```

The same using `httpie` console tool:

```bash
echo '{"method": "publish", "params": {"channel": "chat", "data": {"text": "hello"}}}' | http "localhost:8000/api" Authorization:"apikey <YOUR_API_KEY>" -vvv
POST /api HTTP/1.1
Accept: application/json, */*
Accept-Encoding: gzip, deflate
Authorization: apikey KEY
Connection: keep-alive
Content-Length: 80
Content-Type: application/json
Host: localhost:8000
User-Agent: HTTPie/0.9.8

{
    "method": "publish",
    "params": {
        "channel": "chat",
        "data": {
            "text": "hello"
        }
    }
}

HTTP/1.1 200 OK
Content-Length: 3
Content-Type: application/json
Date: Thu, 17 May 2018 22:01:42 GMT

{
    "result": {}
}
```

In case of error response object can contain `error` field (here we artificially publishing to a channel with unknown namespace):

```bash
echo '{"method": "publish", "params": {"channel": "unknown:chat", "data": {"text": "hello"}}}' | http "localhost:8000/api" Authorization:"apikey <YOUR_API_KEY>"
HTTP/1.1 200 OK
Content-Length: 55
Content-Type: application/json
Date: Thu, 17 May 2018 22:03:09 GMT

{
    "error": {
        "code": 102,
        "message": "namespace not found"
    }
}
```

`error` object contains error code and message - this is also the same for other commands described below.

#### Publish params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| channel       | string  | yes | Name of channel to publish        |
| data       | any JSON       | yes | Custom JSON data to publish into a channel        |
| skip_history  | bool       | no | Skip adding publication to history for this request            |
| tags  | map[string]string  | no | Publication tags - map with arbitrary string keys and values which is attached to publication and will be delivered to clients (available since v3.2.0)            |

#### Publish result

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| offset       | integer  | yes | Offset of publication in history stream        |
| epoch       | string       | yes |   Epoch of current stream        |

### broadcast

Similar to `publish` but allows to send the same data into many channels.

```json
{
    "method": "broadcast",
    "params": {
        "channels": ["CHANNEL_1", "CHANNEL_2"],
        "data": {
            "text": "hello"
        }
    }
}
```

#### Broadcast params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| channels       | Array of strings  | yes | List of channels to publish data to        |
| data       | any JSON       | yes | Custom JSON data to publish into each channel        |
| skip_history  | bool       | no | Skip adding publications to channels' history for this request            |
| tags  | map[string]string  | no | Publication tags (available since v3.2.0) - map with arbitrary string keys and values which is attached to publication and will be delivered to clients           |

#### Broadcast result

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| responses       | Array of publish responses  | no | Responses for each individual publish (with possible error and publish result)        |

### subscribe

`subscribe` allows subscribing user to a channel.

#### Subscribe params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| user       | string       | yes | User ID to subscribe        |
| channel       | string  | yes | Name of channel to subscribe user to        |
| info       | any JSON  | no | Attach custom data to subscription (will be used in presence and join/leave messages)        |
| b64info       | string  | no | info in base64 for binary mode (will be decoded by Centrifugo)      |
| client       | string  | no | Specific client ID to subscribe (user still required to be set, will ignore other user connections with different client IDs)       |
| data       | any JSON  | no | Custom subscription data (will be sent to client in Subscribe push)        |
| b64data       | string  | no | Same as data but in base64 format (will be decoded by Centrifugo)        |
| recover_since       | StreamPosition object  | no | Stream position to recover from        |
| override       | Override object       | no |  Allows dynamically override some channel options defined in Centrifugo configuration (see below available fields)  |

#### Override object

| Field | Type | Optional | Description  |
| -------------- | -------------- | ------------ | ---- |
| presence       | BoolValue       | yes | Override presence   |
| join_leave       | BoolValue       | yes | Override join_leave   |
| position       | BoolValue       | yes | Override position   |
| recover       | BoolValue       | yes |  Override recover   |

BoolValue is an object like this:

```json
{
  "value": true/false
}
```

#### Subscribe result

Empty object at the moment.

### unsubscribe

`unsubscribe` allows unsubscribing user from a channel.

```json
{
    "method": "unsubscribe",
    "params": {
        "channel": "CHANNEL NAME",
        "user": "USER ID"
    }
}
```

#### Unsubscribe params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| user       | string       | yes | User ID to unsubscribe        |
| channel       | string  | yes | Name of channel to unsubscribe user to        |
| client       | string  | no | Specific client ID to unsubscribe (user still required to be set)       |

#### Unsubscribe result

Empty object at the moment.

### disconnect

`disconnect` allows disconnecting a user by ID.

```json
{
    "method": "disconnect",
    "params": {
        "user": "USER ID"
    }
}
```

#### Disconnect params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| user       | string       | yes | User ID to disconnect        |
| client       | string       | no | Specific client ID to disconnect (user still required to be set)       |
| whitelist       | Array of strings       | no | Array of client IDs to keep       |
| disconnect       | Disconnect object       | no | Provide custom disconnect object, see below      |

#### Disconnect object

| Field name | Field type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| code       | int       | yes | Disconnect code        |
| reason       | string       | yes | Disconnect reason       |
| reconnect       | bool       | no | Reconnect advice       |

#### Disconnect result

Empty object at the moment.

### refresh

`refresh` allows refreshing user connection (mostly useful when unidirectional transports are used).

#### Refresh params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| user       | string       | yes | User ID to refresh       |
| client       | string       | no | Client ID to refresh        |
| expired       | bool       | no | Mark connection as expired and close with Disconnect Expired reason |
| expire_at       | int       | no | Unix time (in seconds) in the future when the connection will expire        |

#### Refresh result

Empty object at the moment.

### presence

`presence` allows getting channel online presence information (all clients currently subscribed on this channel).

:::tip

Presence in channels is not enabled by default. See how to enable it over [channel options](./channels.md#channel-options).

:::

```json
{
    "method": "presence",
    "params": {
        "channel": "chat"
    }
}
```

Example:

```bash
fz@centrifugo: echo '{"method": "presence", "params": {"channel": "chat"}}' | http "localhost:8000/api" Authorization:"apikey KEY"
HTTP/1.1 200 OK
Content-Length: 127
Content-Type: application/json
Date: Thu, 17 May 2018 22:13:17 GMT

{
    "result": {
        "presence": {
            "c54313b2-0442-499a-a70c-051f8588020f": {
                "client": "c54313b2-0442-499a-a70c-051f8588020f",
                "user": "42"
            },
            "adad13b1-0442-499a-a70c-051f858802da": {
                "client": "adad13b1-0442-499a-a70c-051f858802da",
                "user": "42"
            }
        }
    }
}
```

#### Presence params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| channel       | string  | yes | Name of channel to call presence from        |

#### Presence result

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| presence       | Map of client ID (string) to ClientInfo object  | no | Offset of publication in history stream        |

#### ClientInfo

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| client       | string  | no | Client ID        |
| user       | string  | no | User ID        |
| conn_info       | JSON  | yes | Optional connection info        |
| chan_info       | JSON  | yes | Optional channel info        |

### presence_stats

`presence_stats` allows getting short channel presence information - number of clients and number of unique users (based on user ID).

```json
{
    "method": "presence_stats",
    "params": {
        "channel": "chat"
    }
}
```

Example:

```bash
echo '{"method": "presence_stats", "params": {"channel": "public:chat"}}' | http "localhost:8000/api" Authorization:"apikey KEY"
HTTP/1.1 200 OK
Content-Length: 43
Content-Type: application/json
Date: Thu, 17 May 2018 22:09:44 GMT

{
    "result": {
        "num_clients": 0,
        "num_users": 0
    }
}
```

#### Presence stats params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| channel       | string  | yes | Name of channel to call presence from        |

#### Presence stats result

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| num_clients       | integer  | no | Total number of clients in channel         |
| num_users       | integer  | no | Total number of unique users in channel         |

### history

`history` allows getting channel history information (list of last messages published into the channel). By default if no `limit` parameter set in request `history` call will only return current stream position information - i.e. `offset` and `epoch` fields. To get publications you must explicitly provide `limit` parameter. See also history API description in [special doc chapter](./history_and_recovery.md#history-iteration-api).

:::tip

History in channels is not enabled by default. See how to enable it over [channel options](./channels.md#channel-options).

:::


```json
{
    "method": "history",
    "params": {
        "channel": "chat",
        "limit": 2
    }
}
```

Example:

```bash
echo '{"method": "history", "params": {"channel": "chat", "limit": 2}}' | http "localhost:8000/api" Authorization:"apikey KEY"
HTTP/1.1 200 OK
Content-Length: 129
Content-Type: application/json
Date: Wed, 21 Jul 2021 05:30:48 GMT

{
    "result": {
        "epoch": "qFhv",
        "offset": 4,
        "publications": [
            {
                "data": {
                    "text": "hello"
                },
                "offset": 2
            },
            {
                "data": {
                    "text": "hello"
                },
                "offset": 3
            }
        ]
    }
}
```

#### History params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| channel       | string  | yes | Name of channel to call history from        |
| limit       | int  | no | Limit number of returned publications, if not set in request then only current stream position information will present in result (without any publications)         |
| since       | StreamPosition object  | no | To return publications after this position        |
| reverse       | bool  | no | Iterate in reversed order (from latest to earliest)        |

#### StreamPosition

| Field name | Field type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| offset       | integer  | yes | Offset in a stream        |
| epoch       | string  | yes | Stream epoch        |

#### History result

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| publications       | Array of publication objects  | yes | List of publications in channel         |
| offset       | integer  | yes | Top offset in history stream        |
| epoch       | string       | yes |   Epoch of current stream        |

### history_remove

`history_remove` allows removing publications in channel history. Current top stream position meta data kept untouched to avoid client disconnects due to insufficient state.

```json
{
    "method": "history_remove",
    "params": {
        "channel": "chat"
    }
}
```

Example:

```bash
echo '{"method": "history_remove", "params": {"channel": "chat"}}' | http "localhost:8000/api" Authorization:"apikey KEY"
HTTP/1.1 200 OK
Content-Length: 43
Content-Type: application/json
Date: Thu, 17 May 2018 22:09:44 GMT

{
    "result": {}
}
```

#### History remove params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| channel       | string  | yes | Name of channel to remove history        |

#### History remove result

Empty object at the moment.

### channels

`channels` return active channels (with one or more active subscribers in it).

```json
{
    "method": "channels",
    "params": {}
}
```

#### Channels params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| pattern       | string  | no | Pattern to filter channels        |

#### Channels result

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| channels       | Map of string to ChannelInfo  | no |  Map where key is channel and value is ChannelInfo (see below)      |

#### ChannelInfo

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| num_clients       | integer  | no |  Total number of connections currently subscribed to a channel      |

:::caution

Keep in mind that since the `channels` method by default returns all active channels it can be really heavy for massive deployments. Centrifugo does not provide a way to paginate over channels list. At the moment we mostly suppose that `channels` RPC extension will be used in the development process or for administrative/debug purposes, and in not very massive Centrifugo setups (with no more than 10k active channels). A better and scalable approach for huge setups could be a real-time analytics approach [described here](../pro/analytics.md).

:::

### info

`info` method allows getting information about running Centrifugo nodes.

Example:

```bash
echo '{"method": "info", "params": {}}' | http "localhost:8000/api" Authorization:"apikey KEY"
HTTP/1.1 200 OK
Content-Length: 184
Content-Type: application/json
Date: Thu, 17 May 2018 22:07:58 GMT

{
    "result": {
        "nodes": [
            {
                "name": "Alexanders-MacBook-Pro.local_8000",
                "num_channels": 0,
                "num_clients": 0,
                "num_users": 0,
                "uid": "f844a2ed-5edf-4815-b83c-271974003db9",
                "uptime": 0,
                "version": ""
            }
        ]
    }
}
```

#### Info params

Empty object at the moment.

#### Info result

| Field name   | Field type     | Optional | Description  |
| -------------- | -------------- | ------ | ------------ |
| nodes       | Array of Node objects  | no | Information about all nodes in a cluster  |

### Command pipelining

It's possible to combine several commands into one request to Centrifugo. To do this use [JSON streaming](https://en.wikipedia.org/wiki/JSON_streaming) format. This can improve server throughput and reduce traffic traveling around.

## GRPC API

Centrifugo also supports [GRPC](https://grpc.io/) API. With GRPC it's possible to communicate with Centrifugo using a more compact binary representation of commands and use the power of HTTP/2 which is the transport behind GRPC.

GRPC API is also useful if you want to publish binary data to Centrifugo channels.

:::tip

GRPC API allows calling all commands described in [HTTP API doc](#http-api), actually both GRPC and HTTP API in Centrifugo based on the same Protobuf schema definition. So refer to the HTTP API description doc for the parameter and the result field description.

:::

You can enable GRPC API in Centrifugo using `grpc_api` option:

```json title="config.json"
{
    ...
    "grpc_api": true
}
```

By default, GRPC will be served on port `10000` but you can change it using the `grpc_api_port` option.

Now, as soon as Centrifugo started – you can send GRPC commands to it. To do this get our API Protocol Buffer definitions [from this file](https://github.com/centrifugal/centrifugo/blob/master/internal/apiproto/api.proto).

Then see [GRPC docs specific to your language](https://grpc.io/docs/) to find out how to generate client code from definitions and use generated code to communicate with Centrifugo.

### GRPC example for Python

For example for Python you need to run sth like this according to GRPC docs:

```
pip install grpcio-tools
python -m grpc_tools.protoc -I ./ --python_out=. --grpc_python_out=. api.proto
```

As soon as you run the command you will have 2 generated files: `api_pb2.py` and `api_pb2_grpc.py`. Now all you need is to write a simple program that uses generated code and sends GRPC requests to Centrifugo:

```python
import grpc
import api_pb2_grpc as api_grpc
import api_pb2 as api_pb

channel = grpc.insecure_channel('localhost:10000')
stub = api_grpc.CentrifugoApiStub(channel)

try:
    resp = stub.Info(api_pb.InfoRequest())
except grpc.RpcError as err:
    # GRPC level error.
    print(err.code(), err.details())
else:
    if resp.error.code:
        # Centrifugo server level error.
        print(resp.error.code, resp.error.message)
    else:
        print(resp.result)
```

Note that you need to explicitly handle Centrifugo API level error which is not transformed automatically into GRPC protocol-level error.

### GRPC example for Go

Here is a simple example of how to run Centrifugo with the GRPC Go client.

You need `protoc`, `protoc-gen-go` and `protoc-gen-go-grpc` installed.

First start Centrifugo itself with GRPC API enabled:

```bash
CENTRIFUGO_GRPC_API=1 centrifugo --config config.json
```

In another terminal tab:

```bash
mkdir centrifugo_grpc_example
cd centrifugo_grpc_example/
touch main.go
go mod init centrifugo_example
mkdir apiproto
cd apiproto
wget https://raw.githubusercontent.com/centrifugal/centrifugo/master/internal/apiproto/api.proto -O api.proto
```

Run `protoc` to generate code:

```
protoc -I ./ api.proto --go_out=. --go-grpc_out=.
```

Put the following code to `main.go` file (created on the last step above):

```go
package main

import (
    "context"
    "log"
    "time"

    "centrifugo_example/apiproto"

    "google.golang.org/grpc"
)

func main() {
    conn, err := grpc.Dial("localhost:10000", grpc.WithInsecure())
    if err != nil {
        log.Fatalln(err)
    }
    defer conn.Close()
    client := apiproto.NewCentrifugoApiClient(conn)
    for {
        resp, err := client.Publish(context.Background(), &apiproto.PublishRequest{
            Channel: "chat:index",
            Data:    []byte(`{"input": "hello from GRPC"}`),
        })
        if err != nil {
            log.Printf("Transport level error: %v", err)
        } else {
            if resp.GetError() != nil {
                respError := resp.GetError()
                log.Printf("Error %d (%s)", respError.Code, respError.Message)
            } else {
                log.Println("Successfully published")
            }
        }
        time.Sleep(time.Second)
    }
}
```

Then run:

```bash
go run main.go
```

The program starts and periodically publishes the same payload into `chat:index` channel.

### GRPC API key authorization

You can also set `grpc_api_key` (string) in Centrifugo configuration to protect GRPC API with key. In this case, you should set per RPC metadata with key `authorization` and value `apikey <KEY>`. For example in Go language:

```go
package main

import (
    "context"
    "log"
    "time"

    "centrifugo_example/apiproto"
    
    "google.golang.org/grpc"
)

type keyAuth struct {
    key string
}

func (t keyAuth) GetRequestMetadata(ctx context.Context, uri ...string) (map[string]string, error) {
    return map[string]string{
        "authorization": "apikey " + t.key,
    }, nil
}

func (t keyAuth) RequireTransportSecurity() bool {
    return false
}

func main() {
    conn, err := grpc.Dial("localhost:10000", grpc.WithInsecure(), grpc.WithPerRPCCredentials(keyAuth{"xxx"}))
    if err != nil {
        log.Fatalln(err)
    }
    defer conn.Close()
    client := apiproto.NewCentrifugoClient(conn)
    for {
        resp, err := client.Publish(context.Background(), &PublishRequest{
            Channel: "chat:index",
            Data:    []byte(`{"input": "hello from GRPC"}`),
        })
        if err != nil {
            log.Printf("Transport level error: %v", err)
        } else {
            if resp.GetError() != nil {
                respError := resp.GetError()
                log.Printf("Error %d (%s)", respError.Code, respError.Message)
            } else {
                log.Println("Successfully published")
            }
        }
        time.Sleep(time.Second)
    }
}
```

For other languages refer to GRPC docs.
