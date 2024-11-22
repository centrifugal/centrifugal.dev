---
id: proxy
title: Proxy events to the backend
---

Due to its self-hosted nature, Centrifugo can offer an efficient way to proxy client connection events to your application backend, enabling the backend to respond to client connection requests in a customized manner. In other words, this mechanism allows Centrifugo to send (web)hooks to the backend to control the behavior of real-time connections.

For example, you can authenticate connections by responding to requests from Centrifugo to your application backend, subscribe connections to a stable set of channels, refresh client sessions, and handle RPC calls sent by a client over a bidirectional real-time connection. Additionally, you can control subscription and publication permissions using these event proxy hooks.

## Supported proxy events

Here is the full list of events which can be proxied (we will show the details about how to configure each of those later in this chapter).

Client-wide proxy events:

* `connect` – called when a client connects to Centrifugo, so it's possible to authenticate user, return custom initial data to a client, subscribe connection to server-side channels, attach meta information to the connection, and so on. This proxy hook available for both bidirectional and unidirectional transports.
* `refresh` - called when a client session is going to expire, so it's possible to prolong it or just let it expire. Can also be used as a periodical connection liveness callback from Centrifugo to the app backend. Works for bidirectional and unidirectional transports.

Channel-wide proxy events:

* `subscribe` - called when clients try to subscribe on a channel, so it's possible to check permissions and return custom initial subscription data. Works for bidirectional transports only.
* `publish` - called when a client tries to publish into a channel, so it's possible to check permissions and optionally modify publication data. Works for bidirectional transports only.
* `sub_refresh` - called when a client subscription is going to expire, so it's possible to prolong it or just let it expire. Can also be used just as a periodical subscription liveness callback from Centrifugo to app backend. Works for bidirectional and unidirectional transports.
* `subscribe_stream` – this is an experimental proxy for simple integration of Centrifugo with third-party streams. It works only for bidirectional transports, and it's a bit special, so we describe this proxy type in a dedicated chapter [Proxy subscription streams](./proxy_streams.md).
* `cache_empty` – a hook available in Centrifugo PRO to be notified about data missing in channels with cache recovery mode. See a [dedicated description](../pro/channel_cache_empty.md).
* `state` – a hook available in Centrifugo PRO to be notified about channel `occupied` or `vacated` states. See a [dedicated description](../pro/channel_events.md).

Finally, Centrifugo can proxy client RPC calls to the backend:

* `rpc` - called when a client sends RPC, you can do whatever logic you need based on a client-provided RPC `method` and `data`. Works for bidirectional transports only (and bidirectional emulation), since data is sent from client to the server in this case.

:::tip

Centrifugo does not emit `unsubscribe` and `disconnect` events at this point. For the exact reasoning and possible workarounds [check out the answer in Centrifugo FAQ](/docs/faq#why-centrifugo-does-not-have-disconnect-hooks).

:::

## Supported proxy protocols

Before we dive into specifics of event configuration let's talk about protocols which Centrifugo can use to proxy events to the backend. Currently Centrifugo supports:

* HTTP requests – using JSON-based communication with the backend
* [GRPC](https://grpc.io/) – by exchanging messages based on the Protobuf schema

Both HTTP and GRPC share [the same Protobuf schema](https://github.com/centrifugal/centrifugo/blob/master/internal/proxyproto/proxy.proto) for event format – so you can easily extrapolate all the request/response fields described in this doc from one protocol to another.

### HTTP proxy

HTTP proxy in Centrifugo converts client connection events into HTTP requests to the application backend. To use HTTP protocol when configuring event proxies use `http://` or `https://` in the proxy `endpoint`.

All HTTP proxy requests from Centrifugo use HTTP POST method. These requests may have some headers copied from the original client connection request (see details below) and include JSON body which varies depending on the proxy event type (see more details about different request bodies below). In response Centrifugo expects JSON from the backend with some predefined format (also see the details below).

For example, for connect event proxy the configuration which uses HTTP protocol may look like this:

```json title="config.json"
{
  "client": {
    "proxy": {
      "connect": {
        "enabled": true,
        "endpoint": "https://your_backend/centrifugo/connect"
      }
    }
  }
}
```

Note `https` endpoint is used which gives the hint to Centrifugo to use HTTP protocol.

### GRPC proxy

Another transport Centrifugo can use to proxy connection events to the app backend is GRPC. In this case, Centrifugo acts as a GRPC client and your backend acts as a GRPC server. To use GRPC protocol in proxy configuration use `grpc://` prefix when configuring the `endpoint`.

GRPC service definitions can be found in the Centrifugo repository, see [proxy.proto](https://github.com/centrifugal/centrifugo/blob/master/internal/proxyproto/proxy.proto). You can use the schema to generate GRPC server code in your programming language and write proxy handlers on top of it.

:::tip

We also publish Centrifugo GRPC proxy Protobuf definitions to [Buf Schema Registry](https://buf.build/centrifugo/proxyproto/docs/main:centrifugal.centrifugo.proxy). This means that it's possible to depend on pre-generated Protobuf definitions for your programming language instead of manually generating them from the schema file (see [SDKs supported by Buf registry here](https://buf.build/centrifugo/proxyproto/sdks)).

:::

Every proxy call in this case is an unary GRPC call (except `subscribe_stream` case which is [a bit special](./proxy_streams.md) and represented by unidirectional or bidirectional GRPC stream). Note also that Centrifugo transforms real-time connection client HTTP request headers into GRPC metadata in this case (since GRPC doesn't have headers concept).

Let's look on example how client connect proxy may be configured to use GRPC:

```json title="config.json"
{
  "client": {
    "proxy": {
      "connect": {
        "enabled": true,
        "endpoint": "grpc://your_backend:9000"
      }
    }
  }
}
```

Basically, the main difference from HTTP proxy protocol example is an `endpoint`.

#### GRPC proxy example

We have [an example of backend server](https://github.com/centrifugal/examples/tree/master/v3/go_proxy/grpc) (written in Go language) which can react to events from Centrifugo over GRPC. For other programming languages the approach is similar, i.e.:

1. Copy proxy Protobuf definitions
1. Generate GRPC code
1. Run backend service with you custom business logic
1. Point Centrifugo to it.

## Proxy configuration object

Centrifugo re-uses the same configuration object for all proxy types. This object allows configuring the `endpoint` to use, `timeout` to apply, and various options how exactly to proxy the request to the backend, including possibility to configure protocol specific options (i.e. options specific to HTTP or GRPC requests to the backend):

| Field name                | Field type                                                     | Required | Description                                                                                                                                                             |
|---------------------------|----------------------------------------------------------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `endpoint`                | `string`                                                       | yes      | HTTP or GRPC endpoint in the same format as in default proxy mode. For example, `http://localhost:3000/path` for HTTP or `grpc://localhost:3000` for GRPC.              |
| `timeout`                 | [`duration`](./configuration.md#setting-time-duration-options) | no       | Proxy request timeout, default `"1s"`                                                                                                                                   |
| `http_headers`            | `array[string]`                                                | no       | List of headers from incoming client connection to proxy, by default no headers will be proxied. See [Proxy HTTP headers](#proxy-http-headers) section.                 |
| `grpc_metadata`           | `array[string]`                                                | no       | List of GRPC metadata keys from incomig GRPC connection to proxy, by default no metadata keys will be proxied. See [Proxy GRPC metadata](#proxy-grpc-metadata) section. |
| `include_connection_meta` | `bool`                                                         | no       | Include meta information (attached on connect). This is noop for connect proxy now. See [Include connection meta](#include-connection-meta) section.                    |
| `http`                    | [`HTTP options`](#http-options-object)                | no       | Allows configuring outgoing HTTP protocol specific options.                                                                                                             |
| `grpc`                    | [`GRPC options`](#grpc-options-object)                | no       | Allows configuring outgoing GRPC protocol specific options.                                                                                                             |
| `binary_encoding`         | `bool`                                                         | no       | Use base64 for payloads. See [Binary encoding mode](#binary-encoding-mode)                                                                                              |

#### HTTP options object

This object is used to configure outgoing HTTP-specific request options.

| Field name       | Field type          | Required | Description                                                                                                                                                                              |
|------------------|---------------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `static_headers` | `map[string]string` | no       | Static set of headers to add to HTTP proxy requests. Note these headers only appended to HTTP proxy requests from Centrifugo to backend. See [Static HTTP headers](#static-http-headers) |

#### GRPC options object

This object is used to configure outgoing GRPC-specific options.

| Field name          | Field type                                         | Required | Description                                                           |
|---------------------|----------------------------------------------------|----------|-----------------------------------------------------------------------|
| `tls`               | [`TLS`](./tls.md#unified-tls-config-object) object | no       | Allows configuring GRPC client TLS                                    |
| `credentials_key`   | `string`                                           | no       | Add custom key to per-RPC credentials.                                |
| `credentials_value` | `string`                                           | no       | A custom value for `credentials_key`.                                 |
| `compression`       | `bool`                                             | no       | If `true` then gzip compression will be used for each GRPC proxy call |

## Proxy HTTP headers

One good thing about Centrifugo proxy is that it can transparently proxy original HTTP request headers in a request to the app backend. In many cases, this allows achieving transparent authentication on the application backend side (if `Cookie` authentication is used and request come from the same backend).

It's required to provide an explicit list of HTTP headers you want to be proxied using `http_headers` field of proxy configuration object.

For example, for connect event proxy it may look like this:

```json title="config.json"
{
  "client": {
    "proxy": {
      "connect": {
        "enabled": true,
        "endpoint": "https://your_backend/centrifugo/connect",
        "http_headers": [
          "Cookie",
          "Origin",
          "User-Agent",
          "Authorization",
          "X-Real-Ip",
          "X-Forwarded-For",
          "X-Request-Id"
        ]
      }
    }
  }
}
```

:::note

Centrifugo forces the `Content-Type` header to be `application/json` in all HTTP proxy requests since Centrifugo sends the body in JSON format to the application backend.

:::

### HTTP headers emulation

Centrifugo provides a unique feature called `headers emulation` which simplifies working with WebSocket and auth when connecting from web browser and using proxy hooks.

The thing is that WebSocket browser API does not allow setting custom HTTP headers which makes implementing authentication in the WebSocket world harder. Centrifugo users can provide a custom `headers` map to the browser SDK (`centrifuge-js`) constructor, these headers are then sent in the first message to Centrifugo, and Centrifugo can translate it to the outgoing proxy request native HTTP headers (based on `http_headers` list) – abstracting away the specifics of WebSocket protocol in a secure way. This can drastically simplify the integration from the auth perspective since the backend may re-use existing code.

### Static HTTP headers

It's possible to configure a static set of headers to be appended to all outgoing HTTP proxy requests (note, this is under `http` section because it's HTTP protocol proxy specific, won't be added to GRPC protocol):

```json title="config.json"
{
  "client": {
    "proxy": {
      "connect": {
        "enabled": true,
        "endpoint": "https://your_backend/centrifugo/connect",
        "http_headers": [
          "Cookie"
        ],
        "http": {
          "static_headers": {
            "X-Custom-Header": "custom value"
          }
        }
      }
    }
  }
}
```

So it is a map with string keys and string values. You may also set it over environment variable using JSON object string:

```
export CENTRIFUGO_CLIENT_PROXY_CONNECT_HTTP_STATIC_HEADERS='{"X-Custom-Header": "custom value"}'
```

Static headers may be overridden by the header from the client connection request if you proxy the header with the same name inside `http_headers` option showed above.

## Proxy GRPC metadata

This is only useful when using [GRPC unidirectional stream](../transports/uni_grpc.md) as a client transport. In that case you may want to proxy GRPC metadata from the client request. To do this configure `grpc_metadata` field of Proxy configuration object. This is an array of string metadata keys to be proxied. By default, no metadata keys are proxied.

See below [the table of rules](#header-proxy-rules) how metadata and headers proxied in transport/proxy different scenarios.

## Client-wide proxy events

Now we know what options we have for event request protocol, and let's dive into how to enable specific event proxies in Centrifugo configuration. 

### Connect proxy

The connect proxy endpoint is called when a client connects to Centrifugo without JWT token, so it's possible to authenticate user, return custom initial data to a client, subscribe connection to server-side channels, attach meta information to the connection, and so on. This proxy hook available for both bidirectional and unidirectional transports.

Above, we already gave some examples on how to enable connect proxy, let's re-iterate:

```json title="config.json"
{
  "client": {
    "proxy": {
      "connect": {
        "enabled": true,
        "endpoint": "grpc://your_backend:9000",
        "timeout": "1s",
        "http_headers": [
          "Cookie",
          "Authorization"
        ]
      }
    }
  }
}
```

:::danger

Make sure you properly configured [allowed_origins](configuration.md#allowed_origins) Centrifugo option or check request origin on your backend side upon receiving connect request from Centrifugo. Otherwise, your site can be vulnerable to CSRF attacks if you are using WebSocket transport for client connections.

:::

This means you don't need to generate JWT and pass it to a client-side and can rely on a cookie while authenticating the user. **Centrifugo should work on the same domain in this case so your site cookie could be passed to Centrifugo by browsers**. Or you need to use headers emulation. In many cases your existing session mechanism will provide user authentication details to the connect proxy handler on your backend which processes the request from Centrifugo.

![](/img/diagram_connect_proxy.png)

:::tip

You can also pass custom data from a client side using `data` field of client SDK constructor options (available in all our SDKs). This data will be included by Centrifugo into `ConnectRequest` to the backend.

:::

:::tip

Every new connection attempt to Centrifugo will result in an HTTP POST request to your application backend. While with [JWT token authentication](./authentication.md) you generate token once on application page reload. If client reconnects due to Centrifugo restart or internet connection loss can re-use the same JWT it had before. So JWT authentication instead of connect proxy can be much more effective since it reduces load on your session backend.

:::

Let's look and the JSON payload example that will be sent to the app backend endpoint when client without token wants to establish a connection with Centrifugo and connect proxy uses HTTP protocol:

```json
{
  "client":"9336a229-2400-4ebc-8c50-0a643d22e8a0",
  "transport":"websocket",
  "protocol": "json",
  "encoding":"json"
}
```

The response from the backend Centrifugo expects looks like this:

```json
{
  "result": {
    "user": "56"
  }
}
```

This response tells Centrifugo the ID user of authenticated user and the connection is then accepted by Centrifugo. See below the full list of supported fields in the connect proxy request and response objects.

Several app examples which use connect proxy can be found in our blog:

* [With NodeJS](/blog/2021/10/18/integrating-with-nodejs)
* [With Django](/blog/2021/11/04/integrating-with-django-building-chat-application)
* [With Laravel](/blog/2021/12/14/laravel-multi-room-chat-tutorial)

Let's now move to a more formal description of connect request and response objects.

#### ConnectRequest

This is what sent from Centrifugo to application backend in case of connect proxy request.

| Field       | Type            | Required | Description                                                                                                                                |
|-------------|-----------------|----------|--------------------------------------------------------------------------------------------------------------------------------------------|
| `client`    | `string`        | yes      | unique client ID generated by Centrifugo for each incoming connection                                                                      |
| `transport` | `string`        | yes      | transport name (ex. `websocket`, `sse`, `uni_sse` etc)                                                                                     |
| `protocol`  | `string`        | yes      | protocol type used by the client (`json` or `protobuf` at moment)                                                                          |
| `encoding`  | `string`        | yes      | protocol encoding type used (`json` or `binary` at moment)                                                                                 |
| `name`      | `string`        | no       | optional name of the client (this field will only be set if provided by a client on connect)                                               |
| `version`   | `string`        | no       | optional version of the client (this field will only be set if provided by a client on connect)                                            |
| `data`      | `JSON`          | no       | optional data from client (this field will only be set if provided by a client on connect)                                                 |
| `b64data`   | `string`        | no       | optional data from the client in base64 format (if the binary proxy mode is used)                                                          |
| `channels`  | `array[string]` | no       | list of server-side channels client want to subscribe to, the application server must check permissions and add allowed channels to result |

#### ConnectResponse

| Field name   | Field type                        | Optional | Description         |
|--------------|-----------------------------------|----------|---------------------|
| `result`     | [`ConnectResult`](#connectresult) | yes      | Result of operation |
| `error`      | [`Error`](#error)                 | yes      | Custom error        |
| `disconnect` | [`Disconnect`](#disconnect)       | yes      | Custom disconnect   |

#### Error

`Error` type represents Centrifugo-level API call error and it has common structure for all server API responses:

| Field name | Field type | Optional | Description   |
|------------|------------|----------|---------------|
| `code`     | `integer`  | no       | Error code    |
| `message`  | `string`   | yes      | Error message |

#### Disconnect

`Disconnect` type represents custom disconnect code and reason to close connection with.

| Field name | Field type | Optional | Description       |
|------------|------------|----------|-------------------|
| `code`     | `integer`  | no       | Disconnect code   |
| `reason`   | `string`   | yes      | Disconenct reason |

#### ConnectResult

This is what an application returns to Centrifugo inside `result` field in of `ConnectResponse`.

| Field       | Type                                   | Required | Description                                                                                                                                                          |
|-------------|----------------------------------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `user`      | `string`                               | yes      | user ID (calculated on app backend based on request cookie header for example). Return it as an empty string for accepting unauthenticated requests                  |
| `expire_at` | `integer`                              | no       | a timestamp (Unix seconds in the future) when connection must be considered expired. If not set or set to `0` connection won't expire at all                         |
| `info`      | `JSON`                                 | no       | a connection info JSON. This information will be included in online presence data, join/leave events and into client-side channel publications                       |
| `b64info`   | `string`                               | no       | binary connection info encoded in base64 format, will be decoded to raw bytes on Centrifugo before using in messages                                                 |
| `data`      | `JSON`                                 | no       | a custom data to send to the client in connect command response.                                                                                                     |
| `b64data`   | `string`                               | no       | a custom data to send to the client in the connect command response for binary connections, will be decoded to raw bytes on Centrifugo side before sending to client |
| `channels`  | `array[string]`                        | no       | allows providing a list of server-side channels to subscribe connection to. See more details about [server-side subscriptions](server_subs.md)                       |
| subs        | `map[string]SubscribeOptions`          | no       | map of channels with options to subscribe connection to. See more details about [server-side subscriptions](server_subs.md)                                          |
| `meta`      | `JSON` object (ex. `{"key": "value"}`) | no       | a custom data to attach to connection (this **won't be exposed to client-side**)                                                                                     |

#### SubscribeOptions

| Field      | Type                      | Optional | Description                                                                                                                                                                                       |
|------------|---------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `info`     | `JSON` object             | yes      | Additional channel-specific information about connection (**valid JSON**). This information will be included in online presence data, join/leave events and into client-side channel publications |
| `b64info`  | `string`                  | yes      | Custom channel info in Base64 - to pass binary channel info                                                                                                                                       |
| `data`     | `JSON` object             | yes      | Custom JSON data to return in subscription context inside Connect reply                                                                                                                           |
| `b64data`  | `string`                  | yes      | Same as `data` but in Base64 to send binary data                                                                                                                                                  |
| `override` | `SubscribeOptionOverride` | yes      | Allows dynamically override some channel options defined in Centrifugo configuration on a per-connection basis (see below available fields)                                                       |

#### SubscribeOptionOverride

Allow per-connection overrides of some channel namespace options:

| Field                   | Type        | Optional | Description                                             |
|-------------------------|-------------|----------|---------------------------------------------------------|
| `presence`              | `BoolValue` | yes      | Override `presence` from namespace options              |
| `join_leave`            | `BoolValue` | yes      | Override `join_leave` from namespace options            |
| `force_recovery`        | `BoolValue` | yes      | Override `force_recovery` from namespace options        |
| `force_positioning`     | `BoolValue` | yes      | Override `force_positioning` from namespace options     |
| `force_push_join_leave` | `BoolValue` | yes      | Override `force_push_join_leave` from namespace options |

#### BoolValue

Is an object like this:

| Field   | Type   | Optional | Description       |
|---------|--------|----------|-------------------|
| `value` | `bool` | no       | `true` or `false` |

#### Example

Here is the simplest example of the connect handler in Tornado Python framework (note that in a real system you need to authenticate the user on your backend side, here we just return `"56"` as user ID):

```python
class CentrifugoConnectHandler(tornado.web.RequestHandler):

    def check_xsrf_cookie(self):
        pass

    def post(self):
        self.set_header('Content-Type', 'application/json; charset="utf-8"')
        data = json.dumps({
            'result': {
                'user': '56'
            }
        })
        self.write(data)


def main():
    options.parse_command_line()
    app = tornado.web.Application([
      (r'/centrifugo/connect', CentrifugoConnectHandler),
    ])
    app.listen(3000)
    tornado.ioloop.IOLoop.instance().start()


if __name__ == '__main__':
    main()
```

This example should help you to implement a similar HTTP handler in any language/framework you are using on the backend side.

We also have a tutorial in the blog about [Centrifugo integration with NodeJS](/blog/2021/10/18/integrating-with-nodejs) which uses connect proxy and native session middleware of Express.js to authenticate connections. Even if you are not using NodeJS on a backend a tutorial can help you understand the idea.

#### What if connection is unauthenticated/unauthorized to connect?

In this case return a disconnect object in a response. See [Return custom disconnect](#return-custom-disconnect) section. Depending on whether you want connection to reconnect or not (usually not) you can select the appropriate disconnect code. Sth like this in response:

```json
{
  "disconnect": {
    "code": 4501,
    "reason": "unauthorized"
  }
}
```

– may be sufficient enough. Choosing codes and reason is up to the developer, but follow the rules described in [Return custom disconnect](#return-custom-disconnect) section.

### Refresh proxy

With the following options in the configuration file:

```json
{
  "client": {
    "proxy": {
      ...
      "refresh": {
        "enabled": true,
        "endpoint": "https://your_backend/centrifugo/refresh",
        "timeout": "1s"
      }
    }
  }
}
```

– Centrifugo will call the configured endpoint when it's time to refresh the connection. Centrifugo itself will ask your backend about connection validity instead of refresh workflow on the client-side.

The payload example sent to app backend in refresh request (when the connection is going to expire) in HTTP protocol case:

```json
{
  "client":"9336a229-2400-4ebc-8c50-0a643d22e8a0",
  "transport":"websocket",
  "protocol": "json",
  "encoding":"json",
  "user":"56"
}
```

Expected successful response example:

```json
{
  "result": {
    "expire_at": 1565436268
  }
}
```

Where `expire_at` contains some Unix time in the future (until which connection will be prolonged).

#### RefreshRequest

| Field       | Type     | Optional | Description                                                                                |
|-------------|----------|----------|--------------------------------------------------------------------------------------------|
| `client`    | `string` | no       | unique client ID generated by Centrifugo for each incoming connection                      |
| `transport` | `string` | no       | transport name (ex. `websocket`, `sockjs`, `uni_sse` etc.)                                 |
| `protocol`  | `string` | no       | protocol type used by client (`json` or `protobuf` at moment)                              |
| `encoding`  | `string` | no       | protocol encoding type used (`json` or `binary` at moment)                                 |
| `user`      | `string` | no       | a connection user ID obtained during authentication process                                |
| `meta`      | `JSON`   | yes      | a connection attached meta (off by default, enable with `"include_connection_meta": true`) |

#### RefreshResponse

| Field name | Field type                        | Optional | Description                 |
|------------|-----------------------------------|----------|-----------------------------|
| `result`   | [`RefreshResult`](#refreshresult) | no       | Result of refresh operation |

#### RefreshResult

| Field       | Type      | Optional | Description                                                                                                                |
|-------------|-----------|----------|----------------------------------------------------------------------------------------------------------------------------|
| `expired`   | `bool`    | yes      | a flag to mark the connection as expired - the client will be disconnected                                                 |
| `expire_at` | `integer` | yes      | a timestamp in the future when connection must be considered expired                                                       |
| `info`      | `JSON`    | yes      | update connection info JSON                                                                                                |
| `b64info`   | `string`  | yes      | alternative to `info` - a binary connection info encoded in base64 format, will be decoded to raw bytes on Centrifugo side |

## Channel-wide proxy events

The following types of proxies are related to channels. The same client connection may issue multiple events for different channels.

### Subscribe proxy

This proxy is called when clients try to subscribe to a channel in a namespace where subscribe proxy is enabled. This allows checking the access permissions of the client to a channel.

:::info

**Subscribe proxy does not proxy [subscriptions with token](./channel_token_auth.md) and subscriptions to [user-limited](channels.md#user-channel-boundary-) channels at the moment**. That's because those are already providing channel access control. Subscribe proxy assumes that all the permission management happens on the backend side when processing proxy request. So if you need to get subscribe proxy requests for all channels in the system - do not use subscription tokens and user-limited channels.

:::

Example:

```json title="config.json"
{
  ...
  "channel": {
    "proxy": {
      "subscribe": {
        "endpoint": "http://localhost:3000/centrifugo/subscribe"
      }
    }
  }
}
```

Note, there is no `enabled` option here. Unlike client-wide proxy types described above subscribe proxy must be enabled per channel namespace. This means that every namespace has a boolean option `subscribe_proxy_enabled` that allows enabling subscribe proxy for channels in a namespace.

So to enable subscribe proxy for channels without namespace define `subscribe_proxy_enabled`:

```json
{
  ...
  "channel": {
    "proxy": {
      "subscribe": {
        "endpoint": "http://localhost:3000/centrifugo/subscribe"
      }
    },
    "without_namespace": {
      "subscribe_proxy_enabled": true
    }
  }
}
```

Or, for channels in the namespace `sun`:

```json
{
  ...
  "channel": {
    "proxy": {
      "subscribe": {
        "endpoint": "http://localhost:3000/centrifugo/subscribe"
      }
    },
    "namespaces": [
      {
        "name": "sun",
        "subscribe_proxy_enabled": true
      }
    ]
  }
}
```

The payload example sent to the app backend in subscribe proxy request in HTTP protocol case is:

```json
{
  "client":"9336a229-2400-4ebc-8c50-0a643d22e8a0",
  "transport":"websocket",
  "protocol": "json",
  "encoding":"json",
  "user":"56",
  "channel": "chat:index"
}
```

The expected response example if a subscription is allowed:

```json
{
  "result": {}
}
```

See below on how to [return an error](#what-if-connection-is-not-allowed-to-subscribe) in case you don't want to allow subscribing.

#### SubscribeRequest

| Field       | Type     | Optional | Description                                                                                                                |
|-------------|----------|----------|----------------------------------------------------------------------------------------------------------------------------|
| `client`    | `string` | no       | unique client ID generated by Centrifugo for each incoming connection                                                      |
| `transport` | `string` | no       | transport name (ex. `websocket` or `sockjs`)                                                                               |
| `protocol`  | `string` | no       | protocol type used by the client (`json` or `protobuf` at moment)                                                          |
| `encoding`  | `string` | no       | protocol encoding type used (`json` or `binary` at moment)                                                                 |
| `user`      | `string` | no       | a connection user ID obtained during authentication process                                                                |
| `channel`   | `string` | no       | a string channel client wants to subscribe to                                                                              |
| `meta`      | `JSON`   | yes      | a connection attached meta (off by default, enable with `"include_connection_meta": true`)                                 |
| `data`      | `JSON`   | yes      | custom data from client sent with subscription request (this field will only be set if provided by a client on subscribe). |
| `b64data`   | `string` | yes      | optional subscription data from the client in base64 format (if the binary proxy mode is used).                            |

#### SubscribeResponse

| Field name   | Field type                              | Optional | Description         |
|--------------|-----------------------------------------|----------|---------------------|
| `result`     | [`SubscribeResult`](#subscriberesult)   | yes      | Result of operation |
| `error`      | [`Error`](#error)                       | yes      | Custom error        |
| `disconnect` | [`Disconnect`](#disconnect)             | yes      | Custom disconnect   |

#### SubscribeResult

| Field       | Type              | Optional | Description                                                                                                                                                                                       |
|-------------|-------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `info`      | `JSON`            | yes      | Additional channel-specific information about connection (**valid JSON**). This information will be included in online presence data, join/leave events and into client-side channel publications |
| `b64info`   | `string`          | yes      | An alternative to `info` – a binary connection channel information encoded in base64 format, will be decoded to raw bytes on Centrifugo before using                                              |
| `data`      | `JSON`            | yes      | Custom data to send to the client in subscribe command reply.                                                                                                                                     |
| `b64data`   | `string`          | yes      | Custom data to send to the client in subscribe command reply, will be decoded to raw bytes on Centrifugo side before sending to client                                                            |
| `override`  | `Override` object | yes      | Allows dynamically override some channel options defined in Centrifugo configuration on a per-connection basis (see below available fields)                                                       |
| `expire_at` | `integer`         | yes      | a timestamp (Unix seconds in the future) when subscription must be considered expired. If not set or set to `0` subscription won't expire at all. Supported since Centrifugo v5.0.4               |

#### Override

| Field                   | Type        | Optional | Description                    |
|-------------------------|-------------|----------|--------------------------------|
| `presence`              | `BoolValue` | yes      | Override presence              |
| `join_leave`            | `BoolValue` | yes      | Override join_leave            |
| `force_push_join_leave` | `BoolValue` | yes      | Override force_push_join_leave |
| `force_positioning`     | `BoolValue` | yes      | Override force_positioning     |
| `force_recovery`        | `BoolValue` | yes      | Override force_recovery        |

#### BoolValue

Is an object like this:

| Field   | Type   | Optional | Description       |
|---------|--------|----------|-------------------|
| `value` | `bool` | no       | `true` or `false` |

#### What if connection is not allowed to subscribe?

In this case you can return error object as a subscribe handler response. See [return custom error](#return-custom-error) section.

In general, frontend applications should not try to subscribe to channels for which access is not allowed. But these situations can happen or malicious user can try to subscribe to a channel. In most scenarios returning:

```json
{
  "error": {
    "code": 403,
    "message": "permission denied"
  }
}
```

– is sufficient. Error code may be not 403 actually, no real reason to force HTTP semantics here - so it's up to Centrifugo user to decide. Just keep it in range  [400, 1999] as described [here](#return-custom-error).

If case of returning response above, on client side `unsubscribed` event of Subscription object will be called with error code 403. Subscription won't resubscribe automatically after that.

### Publish proxy

Publish proxy endpoint is called when clients try to publish data to a channel in a namespace where publish proxy is enabled. This allows checking the access permissions of the client to publish data to a channel. And even modify data to be published.

This request happens BEFORE a message is published to a channel, so your backend can validate whether a client can publish data to a channel. An important thing here is that publication to the channel can fail after your backend successfully validated publish request (for example publish to Redis by Centrifugo returned an error). In this case, your backend won't know about the error that happened but this error will propagate to the client-side.

![](/img/diagram_publish_proxy.png)

Example:

```json title="config.json"
{
  ...
  "channel": {
    "proxy": {
      "publish": {
        "endpoint": "http://localhost:3000/centrifugo/publish"
      }
    }
  }
}
```

Note, there is no `enabled` option here – same as for subscribe proxy described above. Every namespace has a boolean option `publish_proxy_enabled` that allows enabling publish proxy for channels in a namespace.

So to enable publish proxy for channels without namespace define `publish_proxy_enabled`:

```json title="config.json"
{
  ...
  "channel": {
    "proxy": {
      "publish": {
        "endpoint": "http://localhost:3000/centrifugo/publish"
      }
    },
    "without_namespace": {
      "publish_proxy_enabled": true
    }
  }
}
```

Or, for channels in the namespace `sun`:

```json title="config.json"
{
  ...
  "channel": {
    "proxy": {
      "publish": {
        "endpoint": "http://localhost:3000/centrifugo/publish"
      }
    },
    "namespaces": [
      {
        "name": "sun",
        "publish_proxy_enabled": true
      }
    ]
  }
}
```

The payload example sent to the app backend in publish proxy request in HTTP protocol case is:

```json
{
  "client":"9336a229-2400-4ebc-8c50-0a643d22e8a0",
  "transport":"websocket",
  "protocol": "json",
  "encoding":"json",
  "user":"56",
  "channel": "chat:index",
  "data":{
    "input":"hello"
  }
}
```

The expected response example if a publication is allowed:

```json
{
  "result": {}
}
```

#### PublishRequest

| Field       | Type     | Optional | Description                                                                                      |
|-------------|----------|----------|--------------------------------------------------------------------------------------------------|
| `client`    | `string` | no       | unique client ID generated by Centrifugo for each incoming connection                            |
| `transport` | `string` | no       | transport name (ex. `websocket`, `sockjs`)                                                       |
| `protocol`  | `string` | no       | protocol type used by the client (`json` or `protobuf` at moment)                                |
| `encoding`  | `string` | no       | protocol encoding type used (`json` or `binary` at moment)                                       |
| `user`      | `string` | no       | a connection user ID obtained during authentication process                                      |
| `channel`   | `string` | no       | a string channel client wants to publish to                                                      |
| `data`      | `JSON`   | yes      | data sent by client                                                                              |
| `b64data`   | `string` | yes      | will be set instead of `data` field for binary proxy mode                                        |
| `meta`      | `JSON`   | yes      | a connection attached meta (off by default, enable with `"include_connection_meta": true`)       |

#### PublishResponse

| Field name   | Field type                        | Optional | Description         |
|--------------|-----------------------------------|----------|---------------------|
| `result`     | [`PublishResult`](#publishresult) | yes      | Result of operation |
| `error`      | [`Error`](#error)                 | yes      | Custom error        |
| `disconnect` | [`Disconnect`](#disconnect)       | yes      | Custom disconnect   |

#### PublishResult

| Field          | Type     | Optional | Description                                                                                                                                          |
|----------------|----------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| `data`         | `JSON`   | yes      | an optional JSON data to send into a channel **instead of** original data sent by a client                                                           |
| `b64data`      | `string` | yes      | a binary data encoded in base64 format, the meaning is the same as for data above, will be decoded to raw bytes on Centrifugo side before publishing |
| `skip_history` | `bool`   | yes      | when set to `true` Centrifugo won't save publication to the channel history                                                                          |

See below on how to [return an error](#return-custom-error) in case you don't want to allow publishing.

### Sub refresh proxy

This allows configuring the endpoint to be called when it's time to refresh the subscription. Centrifugo itself will ask your backend about subscription validity instead of subscription refresh workflow on the client-side.

Sub refresh proxy may be used as a periodical Subscription liveness callback from Centrifugo to app backend.

:::caution

In the current implementation the delay of Subscription refresh requests from Centrifugo to application backend may be up to one minute (was implemented this way from a simplicity and efficiency perspective). We assume this should be enough for many scenarios. But this may be improved if needed. Please reach us out with a detailed description of your use case where you want more accurate requests to refresh subscriptions.

:::

Example:

```json title="config.json"
{
  ...
  "channel": {
    "proxy": {
      "sub_refresh": {
        "endpoint": "http://localhost:3000/centrifugo/sub_refresh"
      }
    }
  }
}
```

Like subscribe and publish proxy types, sub refresh proxy must be enabled per channel namespace. This means that every namespace has a boolean option `sub_refresh_proxy_enabled` that enables sub refresh proxy for channels in the namespace. Only subscriptions which have expiration time will be validated over sub refresh proxy endpoint.

So to enable sub refresh proxy for channels without namespace define `sub_refresh_proxy_enabled`:

```json title="config.json"
{
  ...
  "channel": {
    "proxy": {
      "sub_refresh": {
        "endpoint": "http://localhost:3000/centrifugo/sub_refresh"
      }
    },
    "without_namespace": {
      "sub_refresh_proxy_enabled": true
    }
  }
}
```

Or, for channels in the namespace `sun`:

```json title="config.json"
{
  ...
  "channel": {
    "proxy": {
      "sub_refresh": {
        "endpoint": "http://localhost:3000/centrifugo/sub_refresh"
      }
    },
    "namespaces": [
      {
        "name": "sun",
        "sub_refresh_proxy_enabled": true
      }
    ]
  }
}
```

The payload sent to app backend in sub refresh request (when the subscription is going to expire):

```json
{
  "client":"9336a229-2400-4ebc-8c50-0a643d22e8a0",
  "transport":"websocket",
  "protocol": "json",
  "encoding":"json",
  "user":"56",
  "channel": "channel"
}
```

Expected response example:

```json
{
  "result": {
    "expire_at": 1565436268
  }
}
```

Very similar to connection-wide refresh response.

#### SubRefreshRequest

| Field       | Type     | Optional | Description                                                                                      |
|-------------|----------|----------|--------------------------------------------------------------------------------------------------|
| `client`    | `string` | no       | unique client ID generated by Centrifugo for each incoming connection                            |
| `transport` | `string` | no       | transport name (ex. `websocket`, `sockjs`, `uni_sse` etc.)                                       |
| `protocol`  | `string` | no       | protocol type used by client (`json` or `protobuf` at moment)                                    |
| `encoding`  | `string` | no       | protocol encoding type used (`json` or `binary` at moment)                                       |
| `user`      | `string` | no       | a connection user ID obtained during authentication process                                      |
| `channel`   | `string` | no       | channel for which Subscription is going to expire                                                |
| `meta`      | `JSON`   | yes      | a connection attached meta (off by default, enable with `"include_connection_meta": true`)       |

#### SubRefreshResponse

| Field name | Field type                              | Optional | Description                     |
|------------|-----------------------------------------|----------|---------------------------------|
| `result`   | [`SubRefreshResult`](#subrefreshresult) | no       | Result of sub refresh operation |

#### SubRefreshResult

| Field       | Type      | Optional | Description                                                                                                       |
|-------------|-----------|----------|-------------------------------------------------------------------------------------------------------------------|
| `expired`   | `bool`    | yes      | a flag to mark the subscription as expired - the client will be disconnected                                      |
| `expire_at` | `integer` | yes      | a timestamp in the future (Unix seconds) when subscription must be considered expired                             |
| `info`      | `JSON`    | yes      | update channel-specific information about connection                                                              |
| `b64info`   | `string`  | yes      | binary channel info encoded in base64 format, will be decoded to raw bytes on Centrifugo before using in messages |

### Subscribe stream proxy

An experimental proxy for simple integration of Centrifugo with third-party streams. It works only for bidirectional transports, and it's a bit special, so we describe this proxy type in a dedicated chapter [Proxy subscription streams](./proxy_streams.md).

### Cache empty proxy

A hook available in Centrifugo PRO to be notified about data missing in channels with cache recovery mode. See a [dedicated description](../pro/channel_cache_empty.md).

### State proxy

A hook available in Centrifugo PRO to be notified about channel `occupied` or `vacated` states. See a [dedicated description](../pro/channel_events.md).

## Client RPC proxy

Centrifugal bidirectional SDKs provide a way to issue `rpc` calls with custom `method` and `data` fields. This call is sent over WebSocket to Centrifugo and may be proxied to the app backend. Let's describe how to configure such a proxy.

This allows a developer to utilize WebSocket connection (or any other bidirectional transport Centrifugo supports) in a bidirectional way.

Example of configuration:

```json
{
  ...
  "rpc": {
    "proxy": {
      "endpoint": "http://localhost:3000/centrifugo/rpc"
    },
    "without_namespace": {
      "proxy_enabled": true
    },
    "namespaces": [
      {
        "name": "sun",
        "proxy_enabled": true
      }
    ]
  }
}
```

The mechanics of RPC namespaces is the same as for channel namespaces. RPC requests with RPC method like `ns1:test` will use rpc proxy `rpc1`, RPC requests with RPC method like `ns2:test` will use rpc proxy `rpc2`. So Centrifugo uses `:` as RPC namespace boundary in RPC method (just like it does for channel namespaces, it's possible to configure this boundary).

Just like channel namespaces RPC namespaces should have a name which match `^[-a-zA-Z0-9_.]{2,}$` regexp pattern – this is validated on Centrifugo start.

Payload example sent to the app backend in RPC request in HTTP protocol case:

```json
{
  "client":"9336a229-2400-4ebc-8c50-0a643d22e8a0",
  "transport":"websocket",
  "protocol": "json",
  "encoding":"json",
  "user":"56",
  "method": "getCurrentPrice",
  "data":{
    "params": {"object_id": 12}
  }
}
```

Expected response example:

```json
{
  "result": {
    "data": {"answer": "2019"}
  }
}
```

See below on how to [return a custom error](#return-custom-error).

#### RPCRequest

| Field       | Type     | Optional | Description                                                                                      |
|-------------|----------|----------|--------------------------------------------------------------------------------------------------|
| `client`    | `string` | no       | unique client ID generated by Centrifugo for each incoming connection                            |
| `transport` | `string` | no       | transport name (ex. `websocket` or `sockjs`)                                                     |
| `protocol`  | `string` | no       | protocol type used by the client (`json` or `protobuf` at moment)                                |
| `encoding`  | `string` | no       | protocol encoding type used (`json` or `binary` at moment)                                       |
| `user`      | `string` | no       | a connection user ID obtained during authentication process                                      |
| `method`    | `string` | yes      | an RPC method string, if the client does not use named RPC call then method will be omitted      |
| `data`      | `JSON`   | yes      | RPC custom data sent by client                                                                   |
| `b64data`   | `string` | yes      | will be set instead of `data` field for binary proxy mode                                        |
| `meta`      | `JSON`   | yes      | a connection attached meta (off by default, enable with `"include_connection_meta": true`)       |

#### RPCResponse

| Field name   | Field type                  | Optional | Description         |
|--------------|-----------------------------|----------|---------------------|
| `result`     | [`RPCResult`](#rpcresult)   | yes      | Result of operation |
| `error`      | [`Error`](#error)           | yes      | Custom error        |
| `disconnect` | [`Disconnect`](#disconnect) | yes      | Custom disconnect   |

#### RPCResult

| Field     | Type     | Optional | Description                                                               |
|-----------|----------|----------|---------------------------------------------------------------------------|
| `data`    | `JSON`   | yes      | RPC response - any valid JSON is supported                                |
| `b64data` | `string` | yes      | can be set instead of `data` for binary response encoded in base64 format |

## Return custom error

Application backend can return JSON object that contains an error to return it to the client:

```json
{
  "error": {
    "code": 1000,
    "message": "custom error"
  }
}
```

Applications **must use error codes in range [400, 1999]**. Error code field is `uint32` internally.

:::note

Returning custom error does not apply to response for refresh and sub refresh proxy requests as there is no sense in returning an error (will not reach client anyway). I.e. custom error is only processed for connect, subscribe, publish and rpc proxy types.

:::

## Return custom disconnect

Application backend can return JSON object that contains a custom disconnect object to disconnect client in a custom way:

```json
{
  "disconnect": {
    "code": 4500,
    "reason": "disconnect reason"
  }
}
```

Application **must use numbers in the range 4000-4999 for custom disconnect codes**:

* codes in range [4000, 4499] give client an advice to reconnect
* codes in range [4500, 4999] are terminal codes – client won't reconnect upon receiving it.

Code is `uint32` internally. Numbers outside of 4000-4999 range are reserved by Centrifugo internal protocol. Keep in mind that **due to WebSocket protocol limitations and Centrifugo internal protocol needs you need to keep disconnect reason string no longer than 32 ASCII symbols (i.e. 32 bytes max)**.

:::note

Returning custom disconnect does not apply to response for refresh and sub refresh proxy requests as there is no way to control disconnect at moment - the client will always be disconnected with `expired` disconnect reason. I.e. custom disconnect is only processed for connect, subscribe, publish and rpc proxy types.

:::

## Per-namespace custom proxies

By default, with proxy configuration shown above, you can only define one proxy object for each type of event. This may be sufficient for many use cases, but in some cases for channel-wide and client rpc you need a more granular control. For example, when using microservice architecture you may want to use different subscribe proxy endpoints for different channel namespaces.

It's possible to define a list of named proxies in Centrifugo configuration and reference to them from channel or RPC namespaces.

### Defining a list of proxies

On configuration top level you can define `"proxies"` – an array with different named proxy objects. Each proxy object in the array must additionally have the `name` field. This `name` must be unique and match `^[-a-zA-Z0-9_.]{2,}$` regexp pattern.

Here is an example:

```json title="config.json"
{
  ...
  "proxies": [
    {
      "name": "subscribe1",
      "endpoint": "http://localhost:3001/centrifugo/subscribe"
    },
    {
      "name": "publish1",
      "endpoint": "http://localhost:3001/centrifugo/publish"
    },
    {
      "name": "subscribe2",
      "endpoint": "http://localhost:3002/centrifugo/subscribe"
    },
    {
      "name": "publish2",
      "endpoint": "grpc://localhost:3002"
    },
    {
      "name": "rpc1",
      "endpoint": "http://localhost:3001/centrifugo/rpc"
    },
    {
      "name": "rpc2",
      "endpoint": "grpc://localhost:3002"
    }
  ]
}
```

These proxy objects may be then referenced by `name` from channel and RPC namespaces to be used instead of default proxy configuration shown above. Outside the `name` rest of fields in the array proxy object are the same as for general [proxy configuration object](#proxy-configuration-object).

### Per-namespace channel-wide proxies

It's possible to use named proxy for `subscribe`, `publish`, `sub_refresh`, `subscribe_stream` channel-wide proxy events.

To reference a named proxy use `subscribe_proxy_name`, `publish_proxy_name`, `sub_refresh_proxy_name`, `subscribe_stream_proxy_name` channel namespace options.

```json title="config.json"
{
  ...
  "proxies": [
    {
      "name": "subscribe1",
      "endpoint": "http://localhost:3001/centrifugo/subscribe"
    },
    {
      "name": "publish1",
      "endpoint": "http://localhost:3001/centrifugo/publish"
    },
    {
      "name": "subscribe2",
      "endpoint": "http://localhost:3002/centrifugo/subscribe"
    },
    {
      "name": "publish2",
      "endpoint": "grpc://localhost:3002"
    }
  ],
  "channel": {
    "namespaces": [
      {
        "name": "ns1",
        "subscribe_proxy_enabled": true,
        "subscribe_proxy_name": "subscribe1",
        "publish_proxy_enabled": true,
        "publish_proxy_name": "publish1"
      },
      {
        "name": "ns2",
        "subscribe_proxy_enabled": true,
        "subscribe_proxy_name": "subscribe2",
        "publish_proxy_enabled": true,
        "publish_proxy_name": "publish2"
      }
    ]
  }
}
```

### Per-namespace RPC proxies

Analogous to channel namespaces it's possible to configure different proxies in different rpc namespaces:

```json title="config.json"
{
  ...
  "proxies": [
    ...
    {
      "name": "rpc1",
      "endpoint": "http://localhost:3001/centrifugo/rpc"
    },
    {
      "name": "rpc2",
      "endpoint": "grpc://localhost:3002"
    }
  ],
  "rpc": {
    "namespaces": [
      {
        "name": "ns1",
        "proxy_enabled": true,
        "proxy_name": "rpc1"
      },
      {
        "name": "ns2",
        "proxy_enabled": true,
        "proxy_name": "rpc2"
      }
    ]
  }
}
```

## Header proxy rules

Centrifugo not only supports HTTP-based client transports but also GRPC-based (for example GRPC unidirectional stream). Here is a table with rules used to proxy headers/metadata in various scenarios:

| Client protocol type | Proxy type | Client headers            | Client metadata           |
|----------------------|------------|---------------------------|---------------------------|
| HTTP                 | HTTP       | In proxy request headers  | N/A                       |
| GRPC                 | GRPC       | N/A                       | In proxy request metadata |
| HTTP                 | GRPC       | In proxy request metadata | N/A                       |
| GRPC                 | HTTP       | N/A                       | In proxy request headers  |

## Binary encoding mode

As you may have noticed there are several fields in request/result description of various proxy calls which use `base64` encoding.

Centrifugo can work with binary Protobuf protocol (in case of bidirectional WebSocket transport). All our bidirectional clients support this.

Most Centrifugo users use JSON for custom payloads: i.e. for data sent to a channel, for connection info attached while authenticating (which becomes part of presence response, join/leave messages and added to Publication client info when message published from a client side).

But since HTTP proxy works with JSON format (i.e. sends requests with JSON body) – it can not properly pass binary data to the application backend. Arbitrary binary data can't be encoded into JSON.

In this case it's possible to turn Centrifugo proxy into binary mode by using `binary_encoding` option of proxy configuration.

Once enabled this option tells Centrifugo to use base64 format in requests and utilize fields like `b64data`, `b64info` with payloads encoded to base64 instead of their JSON field analogues.

While this feature is useful for HTTP proxy it's not really required if you are using GRPC proxy – since GRPC allows passing binary data just fine.

Regarding b64 fields in proxy results – just use base64 fields when required – Centrifugo is smart enough to detect that you are using base64 field and will pick payload from it, decode from base64 automatically and will pass further to connections in binary format.

## Include connection meta

It's possible to attach some meta information to connection and pass it to the application backend in proxy requests.

The `meta` field in proxy request is off by default. To enable it set `include_connection_meta` to `true` in proxy object configuration.

The `meta` data can be attached to the connection in the following ways:

* by setting `meta` field in [connection JWT token](./authentication.md#meta)
* by setting `meta` field in [ConnectResult](#connectresult) of connect proxy.
