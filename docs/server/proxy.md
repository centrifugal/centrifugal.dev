---
id: proxy
title: Proxy events to the backend
---

It's possible to proxy some client connection events from Centrifugo to the application backend and react to them in a custom way. For example, it's possible to authenticate connection via request from Centrifugo to application backend, refresh client sessions and answer to RPC calls sent by a client over bidirectional connection. Also, you may control subscription and publication permissions using these hooks. 

The list of events that can be proxied:

* `connect` – called when a client connects to Centrifugo, so it's possible to authenticate user, return custom data to a client, subscribe connection to several channels, attach meta information to the connection, and so on. Works for bidirectional and unidirectional transports.
* `refresh` - called when a client session is going to expire, so it's possible to prolong it or just let it expire. Can also be used just as a periodical connection liveness callback from Centrifugo to app backend. Works for bidirectional and unidirectional transports.
* `subscribe` - called when clients try to subscribe on a channel, so it's possible to check permissions and return custom initial subscription data. Works for bidirectional transports only.
* `publish` - called when a client tries to publish into a channel, so it's possible to check permissions and optionally modify publication data. Works for bidirectional transports only.
* `sub_refresh` - called when a client subscription is going to expire, so it's possible to prolong it or just let it expire. Can also be used just as a periodical subscription liveness callback from Centrifugo to app backend. Works for bidirectional and unidirectional transports.
* `rpc` - called when a client sends RPC, you can do whatever logic you need based on a client-provided RPC method and params. Works for bidirectional transports only.

At the moment Centrifugo can proxy these events over two protocols:

* HTTP (JSON payloads)
* GRPC (Protobuf messages)

## HTTP proxy

HTTP proxy in Centrifugo converts client connection events into HTTP calls to the application backend.

### HTTP request structure

All proxy calls are **HTTP POST** requests that will be sent from Centrifugo to configured endpoints with a configured timeout. These requests will have some headers copied from the original client request (see details below) and include JSON body which varies depending on call type (for example data sent by a client in RPC call etc, see more details about JSON bodies below).

### Proxy HTTP headers

The good thing about Centrifugo HTTP proxy is that it transparently proxies original HTTP request headers in a request to app backend. In most cases this allows achieving transparent authentication on the application backend side. But it's required to provide an explicit list of HTTP headers you want to be proxied, for example:

```json title="config.json"
{
    ...
    "proxy_http_headers": [
        "Origin",
        "User-Agent",
        "Cookie",
        "Authorization",
        "X-Real-Ip",
        "X-Forwarded-For",
        "X-Request-Id"
    ]
}
```

Alternatively, you can set a list of headers via an environment variable (space separated):

```
export CENTRIFUGO_PROXY_HTTP_HEADERS="Cookie User-Agent X-B3-TraceId X-B3-SpanId" ./centrifugo
```

:::note

Centrifugo forces the` Content-Type` header to be `application/json` in all HTTP proxy requests since it sends the body in JSON format to the application backend.

:::

Starting from Centrifugo v5.0.2 it's possible to configure static set of headers to be appended to all HTTP proxy requests:

```json title="config.json"
{
  ...
  "proxy_static_http_headers": {
    "X-Custom-Header": "custom value"
  }
}
```

`proxy_static_http_headers` is a map with string keys and string values. You may also set it over environment variable using JSON object string:

```
export CENTRIFUGO_PROXY_STATIC_HTTP_HEADERS='{"X-Custom-Header": "custom value"}'
```

Static headers may be overriden by the header from client connection request if you proxy the header with the same name inside `proxy_http_headers` option showed above.

### Proxy GRPC metadata

When [GRPC unidirectional stream](../transports/uni_grpc.md) is used as a client transport then you may want to proxy GRPC metadata from the client request. In this case you may configure `proxy_grpc_metadata` option. This is an array of string metadata keys which will be proxied. These metadata keys transformed to HTTP headers of proxy request. By default no metadata keys are proxied.

See below [the table of rules](#header-proxy-rules) how metadata and headers proxied in transport/proxy different scenarios. 

### Connect proxy

With the following options in the configuration file:

```json
{
  ...
  "proxy_connect_endpoint": "http://localhost:3000/centrifugo/connect",
  "proxy_connect_timeout":  "1s"
}
```

– connection requests **without JWT set** will be proxied to `proxy_connect_endpoint` URL endpoint. On your backend side, you can authenticate the incoming connection and return client credentials to Centrifugo in response to the proxied request.

:::danger

Make sure you properly configured [allowed_origins](configuration.md#allowed_origins) Centrifugo option or check request origin on your backend side upon receiving connect request from Centrifugo. Otherwise, your site can be vulnerable to CSRF attacks if you are using WebSocket transport for client connections.

:::

Yes, this means you don't need to generate JWT and pass it to a client-side and can rely on a cookie while authenticating the user. **Centrifugo should work on the same domain in this case so your site cookie could be passed to Centrifugo by browsers**. In many cases your existing session mechanism will provide user authentication details to the connect proxy handler.   

:::tip

If you want to pass some custom authentication token from a client side (not in Centrifugo JWT format) but force request to be proxied then you may put it in a cookie or use connection request custom `data` field (available in all our transports). This `data` can contain arbitrary payload you want to pass from a client to a server.

:::

This also means that **every** new connection from a user will result in an HTTP POST request to your application backend. While with JWT token you usually generate it once on application page reload, if client reconnects due to Centrifugo restart or internet connection loss it uses the same JWT it had before thus usually no additional requests are generated during reconnect process (until JWT expired).

![](/img/diagram_connect_proxy.png)

Payload example that will be sent to app backend when client without token wants to establish a connection with Centrifugo and `proxy_connect_endpoint` is set to non-empty URL string:

```json
{
  "client":"9336a229-2400-4ebc-8c50-0a643d22e8a0",
  "transport":"websocket",
  "protocol": "json",
  "encoding":"json"
}
```

Expected response example:

```json
{"result": {"user": "56"}}
```

This response allows connecting and tells Centrifugo the ID of a user. See below the full list of supported fields in the result.

Several app examples which use connect proxy can be found in our blog:

* [With NodeJS](/blog/2021/10/18/integrating-with-nodejs)
* [With Django](/blog/2021/11/04/integrating-with-django-building-chat-application)
* [With Laravel](/blog/2021/12/14/laravel-multi-room-chat-tutorial)

#### Connect request fields

This is what sent from Centrifugo to application backend in case of connect proxy request.

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| client       | string     | no | unique client ID generated by Centrifugo for each incoming connection  |
| transport    | string     | no | transport name (ex. `websocket`, `sockjs`, `uni_sse` etc)        |
| protocol     | string     | no | protocol type used by the client (`json` or `protobuf` at moment)            |
| encoding     | string     | no | protocol encoding type used (`json` or `binary` at moment)            |
| name         | string     | yes | optional name of the client (this field will only be set if provided by a client on connect)            |
| version      | string     | yes | optional version of the client (this field will only be set if provided by a client on connect)            |
| data         | JSON     | yes | optional data from client (this field will only be set if provided by a client on connect)            |
| b64data      | string     | yes | optional data from the client in base64 format (if the binary proxy mode is used)            |
| channels      | Array of strings     | yes | list of server-side channels client want to subscribe to, the application server must check permissions and add allowed channels to result               |

#### Connect result fields

This is what application returns to Centrifugo inside `result` field in case of connect proxy request.

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| user       | string     | no |  user ID (calculated on app backend based on request cookie header for example). Return it as an empty string for accepting unauthenticated requests |
| expire_at    | integer     | yes | a timestamp when connection must be considered expired. If not set or set to `0` connection won't expire at all        |
| info     | JSON     | yes | a connection info JSON            |
| b64info     | string     | yes | binary connection info encoded in base64 format, will be decoded to raw bytes on Centrifugo before using in messages            |
| data         | JSON     | yes | a custom data to send to the client in connect command response.           |
| b64data      | string     | yes | a custom data to send to the client in the connect command response for binary connections, will be decoded to raw bytes on Centrifugo side before sending to client            |
| channels      | array of strings     | yes | allows providing a list of server-side channels to subscribe connection to. See more details about [server-side subscriptions](server_subs.md)       |
| subs         | map of SubscribeOptions     | yes | map of channels with options to subscribe connection to. See more details about [server-side subscriptions](server_subs.md)           |
| meta         | JSON object (ex. `{"key": "value"}`) | yes | a custom data to attach to connection (this **won't be exposed to client-side**)  |

#### Options

`proxy_connect_timeout` (duration) config option controls timeout of HTTP POST request sent to app backend. By default `1s`.

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

In this case return a disconnect object as a response. See [Return custom disconnect](#return-custom-disconnect) section. Depending on whether you want connection to reconnect or not (usually not) you can select the appropriate disconnect code. Sth like this in response:

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
  ...
  "proxy_refresh_endpoint": "http://localhost:3000/centrifugo/refresh",
  "proxy_refresh_timeout":  "1s"
}
```

– Centrifugo will call `proxy_refresh_endpoint` when it's time to refresh the connection. Centrifugo itself will ask your backend about connection validity instead of refresh workflow on the client-side.

The payload sent to app backend in refresh request (when the connection is going to expire):

```json
{
  "client":"9336a229-2400-4ebc-8c50-0a643d22e8a0",
  "transport":"websocket",
  "protocol": "json",
  "encoding":"json",
  "user":"56"
}
```

Expected response example:

```json
{"result": {"expire_at": 1565436268}}
```

#### Refresh request fields

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| client       | string     | no | unique client ID generated by Centrifugo for each incoming connection  |
| transport    | string     | no | transport name (ex. `websocket`, `sockjs`, `uni_sse` etc.)        |
| protocol     | string     | no | protocol type used by client (`json` or `protobuf` at moment)            |
| encoding     | string     | no | protocol encoding type used (`json` or `binary` at moment)            |
| user         | string     | no | a connection user ID obtained during authentication process         |
| meta         | JSON | yes | a connection attached meta (off by default, enable with `"proxy_include_connection_meta": true`)         |

#### Refresh result fields

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| expired       | bool     | yes |  a flag to mark the connection as expired - the client will be disconnected  |
| expire_at    | integer     | yes | a timestamp in the future when connection must be considered expired       |
| info     | JSON     | yes | a connection info JSON            |
| b64info     | string     | yes | binary connection info encoded in base64 format, will be decoded to raw bytes on Centrifugo before using in messages            |

#### Options

`proxy_refresh_timeout` (duration) config option controls timeout of HTTP POST request sent to app backend. By default `1s`.

### RPC proxy

With the following option in the configuration file:

```json
{
  ...
  "proxy_rpc_endpoint": "http://localhost:3000/centrifugo/connect",
  "proxy_rpc_timeout":  "1s"
}
```

RPC calls over client connection will be proxied to `proxy_rpc_endpoint`. This allows a developer to utilize WebSocket connection (or any other bidirectional transport Centrifugo supports) in a bidirectional way.

Payload example sent to app backend in RPC request:

```json
{
  "client":"9336a229-2400-4ebc-8c50-0a643d22e8a0",
  "transport":"websocket",
  "protocol": "json",
  "encoding":"json",
  "user":"56",
  "method": "getCurrentPrice",
  "data":{"params": {"object_id": 12}}
}
```

Expected response example:

```json
{"result": {"data": {"answer": "2019"}}}
```

#### RPC request fields

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| client       | string     | no | unique client ID generated by Centrifugo for each incoming connection  |
| transport    | string     | no | transport name (ex. `websocket` or `sockjs`)        |
| protocol     | string     | no | protocol type used by the client (`json` or `protobuf` at moment)            |
| encoding     | string     | no | protocol encoding type used (`json` or `binary` at moment)            |
| user         | string     | no |  a connection user ID obtained during authentication process         |
| method         | string     | yes |  an RPC method string, if the client does not use named RPC call then method will be omitted      |
| data         | JSON     | yes |  RPC custom data sent by client       |
| b64data         | string     | yes |  will be set instead of `data` field for binary proxy mode       |
| meta         | JSON | yes | a connection attached meta (off by default, enable with `"proxy_include_connection_meta": true`)         |

#### RPC result fields

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| data     | JSON     | yes | RPC response - any valid JSON is supported            |
| b64data     | string     | yes | can be set instead of `data` for binary response encoded in base64 format   |

#### Options

`proxy_rpc_timeout` (duration) config option controls timeout of HTTP POST request sent to app backend.  By default `1s`.

See below on how to return a custom error.

### Subscribe proxy

With the following option in the configuration file:

```json
{
  ...
  "proxy_subscribe_endpoint": "http://localhost:3000/centrifugo/subscribe",
  "proxy_subscribe_timeout":  "1s"
}
```

– subscribe requests sent over client connection will be proxied to `proxy_subscribe_endpoint`. This allows you to check the access of the client to a channel.

:::tip

**Subscribe proxy does not proxy [private](channels.md#private-channel-prefix) and [user-limited](channels.md#user-channel-boundary) channels at the moment**. That's because those are already providing a level of security (user-limited channels check current user ID, private channels require subscription token). In some cases you may use subscribe proxy as a replacement for private channels actually: if you prefer to check permissions using the proxy to backend mechanism – just stop using `$` prefixes in channels, properly configure subscribe proxy and validate subscriptions upon proxy from Centrifugo to your backend (issued each time user tries to subscribe on a channel for which subscribe proxy enabled).

:::

Unlike proxy types described above subscribe proxy must be enabled per channel namespace. This means that every namespace (including global/default one) has a boolean option `proxy_subscribe` that enables subscribe proxy for channels in a namespace.

So to enable subscribe proxy for channels without namespace define `proxy_subscribe` on a top configuration level:

```json
{
  ...
  "proxy_subscribe_endpoint": "http://localhost:3000/centrifugo/subscribe",
  "proxy_subscribe_timeout":  "1s",
  "proxy_subscribe": true
}
```

Or for channels in namespace `sun`:

```json
{
  ...
  "proxy_subscribe_endpoint": "http://localhost:3000/centrifugo/subscribe",
  "proxy_subscribe_timeout":  "1s",
  "namespaces": [{
    "name": "sun",
    "proxy_subscribe": true
  }]
}
```

Payload example sent to app backend in subscribe request:

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

Expected response example if subscription is allowed:

```json
{"result": {}}
```

#### Subscribe request fields

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| client       | string     | no | unique client ID generated by Centrifugo for each incoming connection  |
| transport    | string     | no | transport name (ex. `websocket` or `sockjs`)        |
| protocol     | string     | no | protocol type used by the client (`json` or `protobuf` at moment)            |
| encoding     | string     | no | protocol encoding type used (`json` or `binary` at moment)            |
| user         | string     | no |  a connection user ID obtained during authentication process         |
| channel         | string     | no |  a string channel client wants to subscribe to        |
| meta         | JSON | yes | a connection attached meta (off by default, enable with `"proxy_include_connection_meta": true`)         |
| data         | JSON     | yes | custom data from client sent with subscription request (this field will only be set if provided by a client on subscribe).           |
| b64data      | string     | yes | optional subscription data from the client in base64 format (if the binary proxy mode is used).           |

#### Subscribe result fields

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| info     | JSON     | yes | a channel info JSON         |
| b64info     | string     | yes | a binary connection channel info encoded in base64 format, will be decoded to raw bytes on Centrifugo before using   |
| data         | JSON     | yes | a custom data to send to the client in subscribe command reply.           |
| b64data      | string     | yes | a custom data to send to the client in subscribe command reply, will be decoded to raw bytes on Centrifugo side before sending to client |
| override       | Override object       | yes |  Allows dynamically override some channel options defined in Centrifugo configuration on a per-connection basis (see below available fields)  |

#### Override object

| Field | Type | Optional | Description  |
| -------------- | -------------- | ------------ | ---- |
| presence       | BoolValue       | yes | Override presence   |
| join_leave       | BoolValue       | yes | Override join_leave   |
| force_push_join_leave       | BoolValue       | yes | Override force_push_join_leave   |
| force_positioning       | BoolValue       | yes | Override force_positioning   |
| force_recovery       | BoolValue       | yes |  Override force_recovery   |

BoolValue is an object like this:

```json
{
  "value": true/false
}
```

See below on how to return an error in case you don't want to allow subscribing.

#### Options

`proxy_subscribe_timeout` (duration) config option controls timeout of HTTP POST request sent to app backend. By default `1s`.

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

– is sufficient enough. Error code may be not 403 actually, no real reason to force HTTP semantics here - so it's up to Centrifugo user to decide. Just keep it in range  [400, 1999] as described [here](#return-custom-error).

If case of returning response above, on client side `unsubscribed` event of Subscription object will be called with error code 403. Subscription won't resubscribe automatically after that.

### Publish proxy

With the following option in the configuration file:

```json
{
  ...
  "proxy_publish_endpoint": "http://localhost:3000/centrifugo/publish",
  "proxy_publish_timeout":  "1s"
}
```

– publish calls sent by a client will be proxied to `proxy_publish_endpoint`.

This request happens BEFORE a message is published to a channel, so your backend can validate whether a client can publish data to a channel. An important thing here is that publication to the channel can fail after your backend successfully validated publish request (for example publish to Redis by Centrifugo returned an error). In this case, your backend won't know about the error that happened but this error will propagate to the client-side. 

![](/img/diagram_publish_proxy.png)

Like the subscribe proxy, publish proxy must be enabled per channel namespace. This means that every namespace (including the global/default one) has a boolean option `proxy_publish` that enables publish proxy for channels in the namespace. All other namespace options will be taken into account before making a proxy request, so you also need to turn on the `publish` option too.

So to enable publish proxy for channels without namespace define `proxy_publish` and `publish` on a top configuration level:

```json
{
  ...
  "proxy_publish_endpoint": "http://localhost:3000/centrifugo/publish",
  "proxy_publish_timeout":  "1s",
  "publish": true,
  "proxy_publish": true
}
```

Or for channels in namespace `sun`:

```json
{
  ...
  "proxy_publish_endpoint": "http://localhost:3000/centrifugo/publish",
  "proxy_publish_timeout":  "1s",
  "namespaces": [{
    "name": "sun",
    "publish": true,
    "proxy_publish": true
  }]
}
```

Keep in mind that this will only work if the `publish` channel option is on for a channel namespace (or for a global top-level namespace).

Payload example sent to app backend in a publish request:

```json
{
  "client":"9336a229-2400-4ebc-8c50-0a643d22e8a0",
  "transport":"websocket",
  "protocol": "json",
  "encoding":"json",
  "user":"56",
  "channel": "chat:index",
  "data":{"input":"hello"}
}
```

Expected response example if publish is allowed:

```json
{"result": {}}
```

#### Publish request fields

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| client       | string     | no | unique client ID generated by Centrifugo for each incoming connection  |
| transport    | string     | no | transport name (ex. `websocket`, `sockjs`)        |
| protocol     | string     | no | protocol type used by the client (`json` or `protobuf` at moment)            |
| encoding     | string     | no | protocol encoding type used (`json` or `binary` at moment)            |
| user         | string     | no |  a connection user ID obtained during authentication process         |
| channel         | string     | no |  a string channel client wants to publish to        |
| data     | JSON     | yes | data sent by client        |
| b64data     | string     | yes |  will be set instead of `data` field for binary proxy mode   |
| meta         | JSON | yes | a connection attached meta (off by default, enable with `"proxy_include_connection_meta": true`)         |

#### Publish result fields

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| data     | JSON     | yes | an optional JSON data to send into a channel **instead of** original data sent by a client         |
| b64data     | string     | yes | a binary data encoded in base64 format, the meaning is the same as for data above, will be decoded to raw bytes on Centrifugo side before publishing  |
| skip_history     | bool     | yes | when set to `true` Centrifugo won't save publication to the channel history |

See below on how to return an error in case you don't want to allow publishing.

#### Options

`proxy_publish_timeout` (duration) config option controls timeout of HTTP POST request sent to app backend. By default `1s`.

### Sub refresh proxy

With the following options in the configuration file:

```json
{
  ...
  "proxy_sub_refresh_endpoint": "http://localhost:3000/centrifugo/sub_refresh",
  "proxy_sub_refresh_timeout":  "1s"
}
```

– Centrifugo will call `proxy_sub_refresh_endpoint` when it's time to refresh the subscription. Centrifugo itself will ask your backend about subscription validity instead of subscription refresh workflow on the client-side.

Like subscribe and publish proxy types, sub refresh proxy must be enabled per channel namespace. This means that every namespace (including the global/default one) has a boolean option `proxy_sub_refresh` that enables sub refresh proxy for channels in the namespace. Only subscriptions which have expiration time will be validated over sub refresh proxy endpoint.

Sub refresh proxy may be used as a periodical Subscription liveness callback from Centrifugo to app backend.

:::caution

In the current implementation the delay of Subscription refresh requests from Centrifugo to application backend may be up to one minute (was implemented this way from a simplicity and efficiency perspective). We assume this should be enough for many scenarios. But this may be improved if needed. Please reach us out with a detailed description of your use case where you want more accurate requests to refresh subscriptions.

:::

So to enable sub refresh proxy for channels without namespace define `proxy_sub_refresh` on a top configuration level:

```json
{
  ...
  "proxy_sub_refresh_endpoint": "http://localhost:3000/centrifugo/sub_refresh",
  "proxy_sub_refresh": true
}
```

Or for channels in namespace `sun`:

```json
{
  ...
  "proxy_sub_refresh_endpoint": "http://localhost:3000/centrifugo/publish",
  "namespaces": [{
    "name": "sun",
    "proxy_sub_refresh": true
  }]
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
{"result": {"expire_at": 1565436268}}
```

#### Sub refresh request fields

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| client       | string     | no | unique client ID generated by Centrifugo for each incoming connection  |
| transport    | string     | no | transport name (ex. `websocket`, `sockjs`, `uni_sse` etc.)        |
| protocol     | string     | no | protocol type used by client (`json` or `protobuf` at moment)            |
| encoding     | string     | no | protocol encoding type used (`json` or `binary` at moment)            |
| user         | string     | no | a connection user ID obtained during authentication process         |
| channel         | string  | no | channel for which Subscription is going to expire          |
| meta         | JSON | yes | a connection attached meta (off by default, enable with `"proxy_include_connection_meta": true`)         |

#### Sub refresh result fields

| Field | Type | Optional | Description |
| ------------ | -------------- | ------------ | ---- |
| expired       | bool     | yes |  a flag to mark the connection as expired - the client will be disconnected  |
| expire_at    | integer     | yes | a timestamp in the future when connection must be considered expired       |
| info     | JSON     | yes | a channel info JSON            |
| b64info     | string     | yes | binary channel info encoded in base64 format, will be decoded to raw bytes on Centrifugo before using in messages            |

#### Options

`proxy_sub_refresh_timeout` (duration) config option controls timeout of HTTP POST request sent to app backend. By default `1s`.

### Return custom error

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

### Return custom disconnect

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

## GRPC proxy

Centrifugo can also proxy connection events to your backend over GRPC instead of HTTP. In this case, Centrifugo acts as a GRPC client and your backend acts as a GRPC server.

GRPC service definitions can be found in the Centrifugo repository: [proxy.proto](https://github.com/centrifugal/centrifugo/blob/master/internal/proxyproto/proxy.proto).

:::tip

GRPC proxy inherits all the fields for HTTP proxy – so you can refer to field descriptions for HTTP above. Both proxy types in Centrifugo share the same Protobuf schema definitions.

:::

Every proxy call in this case is a unary GRPC call. Centrifugo puts client headers into GRPC metadata (since GRPC doesn't have headers concept).

All you need to do to enable proxying over GRPC instead of HTTP is to use `grpc` schema in endpoint, for example for the connect proxy:

```json title="config.json"
{
  ...
  "proxy_connect_endpoint": "grpc://localhost:12000",
  "proxy_connect_timeout":  "1s"
}
```

Refresh proxy:

```json title="config.json"
{
  ...
  "proxy_refresh_endpoint": "grpc://localhost:12000",
  "proxy_refresh_timeout":  "1s"
}
```

Or for RPC proxy:

```json title="config.json"
{
  ...
  "proxy_rpc_endpoint": "grpc://localhost:12000",
  "proxy_rpc_timeout":  "1s"
}
```

For publish proxy in namespace `chat`:

```json title="config.json"
{
  ...
  "proxy_publish_endpoint": "grpc://localhost:12000",
  "proxy_publish_timeout":  "1s"
  "namespaces": [
    {
      "name": "chat",
      "publish": true,
      "proxy_publish": true
    }
  ]
}
```

Use subscribe proxy for all channels without namespaces:

```json title="config.json"
{
  ...
  "proxy_subscribe_endpoint": "grpc://localhost:12000",
  "proxy_subscribe_timeout":  "1s",
  "proxy_subscribe": true
}
```

So the same as for HTTP, just the different endpoint scheme.

### GRPC proxy options

Some additional options exist to control GRPC proxy behavior.

#### proxy_grpc_cert_file

String, default: `""`.

Path to cert file for secure TLS connection. If not set then an insecure connection with the backend endpoint is used.

#### proxy_grpc_credentials_key

String, default `""` (i.e. not used).

Add custom key to per-RPC credentials.

#### proxy_grpc_credentials_value

String, default `""` (i.e. not used).

A custom value for `proxy_grpc_credentials_key`.

### GRPC proxy example

We have [an example of backend server](https://github.com/centrifugal/examples/tree/master/v3/go_proxy/grpc) (written in Go language) which can react to events from Centrifugo over GRPC. For other programming languages the approach is similar, i.e.:

1. Copy proxy Protobuf definitions
1. Generate GRPC code
1. Run backend service with you custom business logic
1. Point Centrifugo to it.

## Header proxy rules

Centrifugo not only supports HTTP-based client transports but also GRPC-based (for example GRPC unidirectional stream). Here is a table with rules used to proxy headers/metadata in various scenarios:

| Client protocol type  | Proxy type  | Client headers | Client metadata |
| ------------- | ------------- | -------------- | -------------- |
| HTTP  | HTTP  |  In proxy request headers |    N/A  |
| GRPC  | GRPC  |  N/A  |  In proxy request metadata  |
| HTTP  | GRPC  |  In proxy request metadata  |    N/A  |
| GRPC  | HTTP  |  N/A  |  In proxy request headers  |

## Binary mode

As you may noticed there are several fields in request/result description of various proxy calls which use `base64` encoding.

Centrifugo can work with binary Protobuf protocol (in case of bidirectional WebSocket transport). All our bidirectional clients support this.

Most Centrifugo users use JSON for custom payloads: i.e. for data sent to a channel, for connection info attached while authenticating (which becomes part of presence response, join/leave messages and added to Publication client info when message published from a client side).

But since HTTP proxy works with JSON format (i.e. sends requests with JSON body) – it can not properly pass binary data to application backend. Arbitrary binary data can't be encoded into JSON.

In this case it's possible to turn Centrifugo proxy into binary mode by using:

```json title="config.json"
{
  ...
  "proxy_binary_encoding": true
}
```

Once enabled this option tells Centrifugo to use base64 format in requests and utilize fields like `b64data`, `b64info` with payloads encoded to base64 instead of their JSON field analogues.

While this feature is useful for HTTP proxy it's not really required if you are using GRPC proxy – since GRPC allows passing binary data just fine.

Regarding b64 fields in proxy results – just use base64 fields when required – Centrifugo is smart enough to detect that you are using base64 field and will pick payload from it, decode from base64 automatically and will pass further to connections in binary format.

## Granular proxy mode

By default, with proxy configuration shown above, you can only define a global proxy settings and one endpoint for each type of proxy (i.e. one for connect proxy, one for subscribe proxy, and so on). Also, you can configure only one set of headers to proxy which will be used by each proxy type. This may be sufficient for many use cases, but what if you need a more granular control? For example, use different subscribe proxy endpoints for different channel namespaces (i.e. when using microservice architecture).

Centrifugo v3.1.0 introduced a new mode for proxy configuration called granular proxy mode. In this mode it's possible to configure subscribe and publish proxy behaviour on per-namespace level, use different set of headers passed to the proxy endpoint in each proxy type. Also, Centrifugo v3.1.0 introduced a concept of rpc namespaces (in addition to channel namespaces) – together with granular proxy mode this allows configuring rpc proxies on per rpc namespace basis.

### Enable granular proxy mode

Since the change is rather radical it requires a separate boolean option `granular_proxy_mode` to be enabled. As soon as this option set Centrifugo does not use proxy configuration rules described above and follows the rules described below.

```json title="config.json"
{
  ...
  "granular_proxy_mode": true
}
```

### Defining a list of proxies

When using granular proxy mode on configuration top level you can define `"proxies"` array with a list of different proxy objects. Each proxy object in an array should have at least two required fields: `name` and `endpoint`.

Here is an example:

```json title="config.json"
{
  ...
  "granular_proxy_mode": true,
  "proxies": [
    {
      "name": "connect",
      "endpoint": "http://localhost:3000/centrifugo/connect",
      "timeout": "500ms",
      "http_headers": ["Cookie"]
    },
    {
      "name": "refresh",
      "endpoint": "http://localhost:3000/centrifugo/refresh",
      "timeout": "500ms"
    },
    {
      "name": "subscribe1",
      "endpoint": "http://localhost:3001/centrifugo/subscribe"
    },
    {
      "name": "publish1",
      "endpoint": "http://localhost:3001/centrifugo/publish"
    },
    {
      "name": "rpc1",
      "endpoint": "http://localhost:3001/centrifugo/rpc"
    },
    {
      "name": "subscribe2",
      "endpoint": "http://localhost:3002/centrifugo/subscribe"
    },
    {
      "name": "publish2",
      "endpoint": "grpc://localhost:3002"
    }
    {
      "name": "rpc2",
      "endpoint": "grpc://localhost:3002"
    }
  ]
}
```

Let's look at all fields for a proxy object which is possible to set for each proxy inside `"proxies"` array.

| Field name | Field type | Required | Description  |
| -------------- | -------------- | ------------ | ---- |
| name       | `string`  | yes | Unique name of proxy used for referencing in configuration, must match regexp `^[-a-zA-Z0-9_.]{2,}$`      |
| endpoint       | `string`  | yes | HTTP or GRPC endpoint in the same format as in default proxy mode. For example, `http://localhost:3000/path` for HTTP or `grpc://localhost:3000` for GRPC.      |
| timeout       | `duration` (string)  | no | Proxy request timeout, default `"1s"`       |
| http_headers       | `array of strings`  | no | List of headers to proxy, by default no headers       |
| static_http_headers       | `map[string]string`  | no | Static set of headers to add to HTTP proxy requests. Note these headers only appended to HTTP proxy requests from Centrifugo to backend. Available since Centrifugo v5.0.2        |
| grpc_metadata       | `array of strings`  | no | List of GRPC metadata keys to proxy, by default no metadata keys   |
| binary_encoding       | `bool`  | no | Use base64 for payloads       |
| include_connection_meta | `bool`  | no | Include meta information (attached on connect)       |
| grpc_cert_file       | `string`  | no | Path to cert file for secure TLS connection. If not set then an insecure connection with the backend endpoint is used.       |
| grpc_credentials_key       | `string`  | no | Add custom key to per-RPC credentials.       |
| grpc_credentials_value       | `string`  | no | A custom value for `grpc_credentials_key`.       |

### Granular connect and refresh

As soon as you defined a list of proxies you can reference them by a name to use a specific proxy configuration for a specific event.

To enable connect proxy:

```json title="config.json"
{
  ...
  "granular_proxy_mode": true,
  "proxies": [...],
  "connect_proxy_name": "connect"
}
```

We have an [example of Centrifugo integration with NodeJS](https://github.com/centrifugal/examples/tree/master/v3/nodejs_granular_proxy) which uses granular proxy mode. Even if you are not using NodeJS on a backend an example can help you understand the idea.

Let's also add refresh proxy:

```json title="config.json"
{
  ...
  "granular_proxy_mode": true,
  "proxies": [...],
  "connect_proxy_name": "connect",
  "refresh_proxy_name": "refresh"
}
```

### Granular subscribe, publish, sub refresh

Subscribe, publish and sub refresh proxies work per-namespace. This means that `subscribe_proxy_name`, `publish_proxy_name` and `sub_refresh_proxy_name` are just channel namespace options. So it's possible to define these options on configuration top-level (for channels in default top-level namespace) or inside namespace object.

```json title="config.json"
{
  ...
  "granular_proxy_mode": true,
  "proxies": [...],
  "namespaces": [
    {
      "name": "ns1",
      "subscribe_proxy_name": "subscribe1",
      "publish": true,
      "publish_proxy_name": "publish1"
    },
    {
      "name": "ns2",
      "subscribe_proxy_name": "subscribe2",
      "publish": true,
      "publish_proxy_name": "publish2"
    }
  ]
}
```

If namespace does not have `"subscribe_proxy_name"` or `"subscribe_proxy_name"` is empty then no subscribe proxy will be used for a namespace.

If namespace does not have `"publish_proxy_name"` or `"publish_proxy_name"` is empty then no publish proxy will be used for a namespace.

If namespace does not have `"sub_refresh_proxy_name"` or `"sub_refresh_proxy_name"` is empty then no sub refresh proxy will be used for a namespace.

:::tip

You can define `subscribe_proxy_name`, `publish_proxy_name`, `sub_refresh_proxy_name` on configuration top level – and in this case publish, subscribe and sub refresh requests for channels without explicit namespace will be proxied using this proxy. The same mechanics as for other channel options in Centrifugo.

:::

### Granular RPC

Analogous to channel namespaces it's possible to configure rpc namespaces:

```json title="config.json"
{
  ...
  "granular_proxy_mode": true,
  "proxies": [...],
  "namespaces": [...],
  "rpc_namespaces": [
    {
      "name": "rpc_ns1",
      "rpc_proxy_name": "rpc1",
    },
    {
      "name": "rpc_ns2",
      "rpc_proxy_name": "rpc2"
    }
  ]
}
```

The mechanics is the same as for channel namespaces. RPC requests with RPC method like `rpc_ns1:test` will use rpc proxy `rpc1`, RPC requests with RPC method like `rpc_ns2:test` will use rpc proxy `rpc2`. So Centrifugo uses `:` as RPC namespace boundary in RPC method (just like it does for channel namespaces).

Just like channel namespaces RPC namespaces should have a name which match `^[-a-zA-Z0-9_.]{2,}$` regexp pattern – this is validated on Centrifugo start.

:::tip

The same as for channel namespaces and channel options you can define `rpc_proxy_name` on configuration top level – and in this case RPC calls without explicit namespace in RPC method will be proxied using this proxy.

:::
