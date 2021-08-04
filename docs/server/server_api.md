---
id: server_api
title: Server API
---

Server API is a way to send various commands to Centrifugo. For example, server API allows publishing messages to channels, get server statistics etc. There are two kinds of API available at the moment:

* HTTP API
* GRPC API

## HTTP API

Server HTTP API works on `/api` endpoint (by default). It has a simple request format: this is a HTTP POST request with `application/json` Content-Type and with JSON command body.

Here we will look at available methods and parameters

:::note

In some cases you can just use one of our [available HTTP API libraries](../ecosystem/api.md) or use Centrifugo [GRPC API](#grpc-api) to avoid manually constructing requests.

:::

### HTTP API authorization

HTTP API protected by `api_key` set in Centrifugo configuration. I.e. `api_key` option must be added to config, like:

```json title="config.json"
{
    ...
    "api_key": "<YOUR API KEY>"
}
```

This API key must be set in request `Authorization` header in this way:

```
Authorization: apikey <KEY>
```

It's also possible to pass API key over URL query param. This solves some edge cases where it's not possible to use `Authorization` header. Simply add `?api_key=<YOUR API KEY>` query param to API endpoint. Keep in mind that passing API key in `Authorization` header is a recommended way. 

It's possible to disable API key check on Centrifugo side using `api_insecure` configuration option. Be sure to protect API endpoint by firewall rules in this case to prevent anyone in internet to send commands over your unprotected Centrifugo API endpoint. API key auth is not very safe for man-in-the-middle so we also recommended running Centrifugo with TLS.

Command is a JSON object with two properties: `method` and `params`.

* `method` is a name of API command you want to call.
* `params` is an object with command arguments. Each `method` can have its own `params`

Before looking at all available commands here is a CURL that calls `info` command:

```bash
curl --header "Authorization: apikey <API_KEY>" \
  --request POST \
  --data '{"method": "info", "params": {}' \
  http://localhost:8000/api
```

Here is a live example:

<iframe width="100%" height="400" src="/img/api_example.mp4" frameborder="0" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

Now let's investigate each API methods in detail.

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

Let's apply all information said above and send publish command to Centrifugo. We will send request using `requests` library for Python. 

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

`error` object contains error code and message - this also the same for other commands described below.

#### Publish params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| channel       | string  | yes | Name of channel to publish        |
| data       | JSON object       | yes | Custom JSON data to publish into a channel        |
| skip_history  | bool       | no | Skip adding publication to history for this request            |

#### Publish result

| Result field   | Field type     | Can be omitted | Description  |
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
| data       | JSON object       | yes | Custom JSON data to publish into each channel        |
| skip_history  | bool       | no | Skip adding publications to channels' history for this request            |

#### Broadcast result

| Result field   | Field type     | Can be omitted | Description  |
| -------------- | -------------- | ------ | ------------ |
| responses       | Array of publish responses  | no | Responses for each individual publish (with possible error and publish result)        |

### subscribe

`subscribe` allows subscribing user to a channel.

#### Subscribe params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| user       | string       | yes | User ID to subscribe        |
| channel       | string  | yes | Name of channel to subscribe user to        |

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
| user       | string       | yes | User ID to subscribe        |
| channel       | string  | yes | Name of channel to subscribe user to        |

#### Unsubscribe result

Empty object at the moment.

### disconnect

`disconnect` allows disconnecting user by ID.

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
| user       | string       | yes | User ID to subscribe        |

#### Disconnect result

Empty object at the moment.

### presence

`presence` allows getting channel presence information (all clients currently subscribed on this channel).

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

| Result field   | Field type     | Can be omitted | Description  |
| -------------- | -------------- | ------ | ------------ |
| presence       | Map of client ID (string) to client info  | no | Offset of publication in history stream        |

### presence_stats

`presence_stats` allows getting short channel presence information.

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

| Result field   | Field type     | Can be omitted | Description  |
| -------------- | -------------- | ------ | ------------ |
| num_clients       | integer  | no | Total number of clients in channel         |
| num_users       | integer  | no | Total number of unique users in channel         |


### history

`history` allows getting channel history information (list of last messages published into channel).

```json
{
    "method": "history",
    "params": {
        "channel": "chat",
        "limit": 1
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
| limit       | int  | yes | Limit number of returned publications        |
| since       | Stream position object  | no | To return publications after this position        |
| reverse       | bool  | no | Iterate in reversed order (from latest to earliest)        |

#### History result

| Result field   | Field type     | Can be omitted | Description  |
| -------------- | -------------- | ------ | ------------ |
| publications       | Array of publication objects  | yes | List of publications in channel         |
| offset       | integer  | yes | Top offset in history stream        |
| epoch       | string       | yes |   Epoch of current stream        |

### rpc

`rpc` allows calling JSON RPC extension by name. Actually it's RPC inside RPC :)

#### RPC params

| Parameter name | Parameter type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| method       | string  | yes | RPC extension method        |
| params       | JSON object  | yes | RPC extension method params        |

#### RPC result

| Result field   | Field type     | Can be omitted | Description  |
| -------------- | -------------- | ------ | ------------ |
| data       | JSON object  | no | Data returned from RPC <br />(different format for different RPC extensions)         |

One available RPC extension is `getChannels` method which returns all active channels in Centrifugo with number of clients in each (optionally filtered by pattern), command looks like this:

```json
{
    "method": "rpc",
    "params": {
        "method": "getChannels",
        "params": {
            "pattern": "chat*"
        }
    }
}
```

**Keep in mind that since `getChannels` RPC extension returns all active channels it can be really heavy for massive deployments.** There is no way to paginate over channels list and we don't know a case where this could be useful and not error prone. At the moment **we mostly suppose that getChannels RPC extension will be used in development process and in not very massive Centrifugo setups** (with no more than 10k channels). A better and scalable approach could be real-time analytics approach [described here](../pro/overview.md).


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

| Result field   | Field type     | Can be omitted | Description  |
| -------------- | -------------- | ------ | ------------ |
| nodes       | Array of Node objects  | no | Information about all nodes in a cluster  |

### Command pipelining

It's possible to combine several commands into one request to Centrifugo. To do this use [JSON streaming](https://en.wikipedia.org/wiki/JSON_streaming) format. This can improve server throughput and reduce traffic travelling around.

## GRPC API

Centrifugo also supports [GRPC](https://grpc.io/) API. With GRPC it's possible to communicate with Centrifugo using more compact binary representation of commands and use the power of HTTP/2 which is the transport behind GRPC.

GRPC API is also useful if you want to publish binary data to Centrifugo channels.

:::tip

GRPC API basically allows calling all commands described in [HTTP API doc](#http-api), actually both GRPC and HTTP API in Centrifugo based on the same Protobuf schema definition. So refer to the HTTP API description doc for parameter and result field description.

:::

You can enable GRPC API in Centrifugo using `grpc_api` option:

```json title="config.json"
{
    ...
    "grpc_api": true
}
```

By default, GRPC will be served on port `10000` but you can change it using `grpc_api_port` option.

Now as soon as Centrifugo started you can send GRPC commands to it. To do this get our API Protocol Buffer definitions [from this file](https://github.com/centrifugal/centrifugo/blob/master/misc/proto/api.proto).

Then see [GRPC docs specific to your language](https://grpc.io/docs/) to find out how to generate client code from definitions and use generated code to communicate with Centrifugo.

### GRPC example for Python

For example for Python you need to run sth like this according to GRPC docs:

```
python -m grpc_tools.protoc -I../../protos --python_out=. --grpc_python_out=. api.proto
```

As soon as you run command you will have 2 generated files: `api_pb2.py` and `api_pb2_grpc.py`. Now all you need is to write simple program that uses generated code and sends GRPC requests to Centrifugo:

```python
import grpc
import api_pb2_grpc as api_grpc
import api_pb2 as api_pb

channel = grpc.insecure_channel('localhost:10000')
stub = api_grpc.CentrifugoStub(channel)

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

Note that you need to explicitly handle Centrifugo API level error which is not transformed automatically into GRPC protocol level error.

### GRPC example for Go

Here is a simple example on how to run Centrifugo with GRPC Go client.

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
wget https://raw.githubusercontent.com/centrifugal/centrifugo/master/misc/proto/api.proto -O api.proto
```

Run `protoc` to generate code:

```
protoc -I ./ api.proto --go_out=. --go-grpc_out=.
```

Put the following code to `main.go` file (created on last step above):

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

Then run:

```bash
go run main.go
```

The program starts and periodically publishes the same payload into `chat:index` channel.

### GRPC API key authorization

You can also set `grpc_api_key` (string) in Centrifugo configuration to protect GRPC API with key. In this case you should set per RPC metadata with key `authorization` and value `apikey <KEY>`. For example in Go language:

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
