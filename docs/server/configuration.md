---
id: configuration
title: Configure Centrifugo
---

:::danger

This is a documentation for Centrifugo v3 which is not released yet. See [Centrifugo v2 documentation](https://centrifugal.github.io/centrifugo/) instead.

:::

Let's look at how Centrifigo can be configured.

:::info There are more options

This chapter describes configuration principles and some important configuration options. There are some options not mentioned here but described later in each individual feature documentation.

:::

Centrifugo can be configured in several ways.

1. Over command-line flags. See `centrifugo -h` for available flags, command-line flags limited to most frequently used. Command-line options have the highest priority when set than other ways to configure Centrifugo.
1. Over OS environment variables. All Centrifugo options can be set over env in format `CENTRIFUGO_<OPTION_NAME>` (mostly straightforward except namespaces - [see how to set namespaces via env](#setting-namespaces-over-env)). Environment variables have the second priority after flags.
1. Over configuration file, configuration file supports all options mentioned in this documentation and can be in one of three supported formats: JSON, YAML or TOML. Config file options have the lowest priority.

A simple way to start with Centrifugo is run:

```bash
centrifugo genconfig
```

command which will generate `config.json` configuration file in a current directory. This file already has minimal number of options set. So it's then possible to start Centrifugo:

```bash
centrifugo -c config.json
```

## Config file formats

Centrifugo supports three configuration file formats: JSON, YAML or TOML.

### JSON config format

Here is a minimal Centrifugo JSON configuration file:

```json title="config.json"
{
  "token_hmac_secret_key": "<YOUR-SECRET-STRING-HERE>",
  "api_key": "<YOUR-API-KEY-HERE>"
}
```

The only two fields required are **token_hmac_secret_key** and **api_key**.

:::note

To be more exact latest Centrifugo releases introduced a new way of authenticating connections over [proxy HTTP request](proxy.md#connect-proxy) from Centrifugo to application backend, and a way to publish messages to channels over [proxy request to backend](proxy.md#publish-proxy). Also there is GRPC server API that can be used instead of HTTP API – so `api_key` not used there. This means that in some setups both `token_hmac_secret_key` and `api_key` are not required at all. But here we describe the traditional way of running Centrifugo - with JWT authentication and publishing messages over server HTTP API.

:::

`token_hmac_secret_key` used to check JWT signature (more info about JWT in [authentication chapter](authentication.md)). API key used for Centrifugo API endpoint authorization, see more in [chapter about server HTTP API](server_api.md#http-api). Keep both values in secret and never reveal to clients.

### TOML config format

Centrifugo also supports TOML format for configuration file:

```bash
centrifugo --config=config.toml
```

Where `config.toml` contains:

```toml title="config.toml"
token_hmac_secret_key = "<YOUR-SECRET-STRING-HERE>"
api_key = "<YOUR-API-KEY-HERE>"
log_level = "debug"
```

In example above we also defined logging level to be `debug` which is useful to have while developing an application. In production environment debug logging can be too chatty.

### YAML config format

YAML format is also supported:

```yaml title="config.yaml"
token_hmac_secret_key: "<YOUR-SECRET-STRING-HERE>"
api_key: "<YOUR-API-KEY-HERE>"
log_level: debug
```

With YAML remember to use spaces, not tabs when writing configuration file.

## Important options

Let's describe some important options you can configure when running Centrifugo.

### address

Bind your Centrifugo to specific interface address (string, by default `""` - listen on all available interfaces).

### port

Port to bind Centrifugo to (string, by default `"8000"`).

### engine

Engine to use - `memory`, `redis` or `tarantool`. It's a string option, by default `memory`. Read more about engines in [special chapter](engines.md).

### allowed_origins

This option allows setting an array of allowed origin patterns (array of strings) for WebSocket and SockJS endpoints to prevent [CSRF](https://en.wikipedia.org/wiki/Cross-site_request_forgery) attack. Also it's used for HTTP-based unidirectional transports to enable CORS for configured origins.

If `allowed_origins` option not set at all then Centrifugo will try to match request origin to Host header in request.

As soon as `allowed_origins` defined every connection request will be checked against each pattern in an array.

For example, client connects to Centrifugo from an application on `http://localhost:3000`. In this case `allowed_origins` should be configured in this way:

```json
"allowed_origins": [
    "http://localhost:3000"
]
```

When connecting from `https://example.com`:

```json
"allowed_origins": [
    "https://example.com"
]
```

Origin pattern can contain wildcard symbol `*` to match subdomains:

```json
"allowed_origins": [
    "https://*.example.com"
]
```

– in this case requests with `Origin` header like `https://foo.example.com` or `https://bar.example.com` will pass the check.

It's also possible to allow all origins in the following way (but this is discouraged especially when using connect proxy feature):

```json
"allowed_origins": [
    "*"
]
```

Connection requests without `Origin` header set are passing through without any checks (i.e. always allowed).

## Advanced options

These options allow tweaking server behaviour, in most cases default values are good to start with. 

### client_channel_limit

Default: 128

Sets maximum number of different channel subscriptions single client can have. Having many channels per client is not a good thing since this increases connection establishment time. In most cases you should design your app to use only several channels per client.

### channel_max_length

Default: 255

Sets maximum length of channel name.

### client_user_connection_limit

Default: 0

Maximum number of connections from user (with known user ID) to Centrifugo node. By default, unlimited.

The important thing to emphasize is that `client_user_connection_limit` works only per one Centrifugo node and exists mostly to protect Centrifugo from many connections from a single user – but not for business logic limitations. This means that if you will scale nodes – say run 10 Centrifugo nodes – then a user will be able to create 10 connections (one to each node).

### client_request_max_size

Default: 65536

Maximum allowed size of request from client in bytes.

### client_queue_max_size

Default: 1048576

Maximum client message queue size in bytes to close slow reader connections. By default - 1mb.

### client_anonymous

Default: false

Enable a mode when all clients can connect to Centrifugo without JWT connection token. In this case all connections without token will be treated as anonymous (i.e. with empty user ID) and only can subscribe to channels with `anonymous` option enabled.

### client_concurrency

Default: 0

`client_concurrency` when set tells Centrifugo that commands from client must be processed concurrently.

By default, concurrency disabled – Centrifugo processes commands received from a client one by one. This means that if a client issues two RPC requests to a server then Centrifugo will process the first one, then the second one. If the first RPC call is slow then the client will wait for the second RPC response much longer than it could (even if second RPC is very fast). If you set `client_concurrency` to some value greater than 1 then commands will be processed concurrently (in parallel) in separate goroutines (with maximum concurrency level capped by `client_concurrency` value). Thus, this option can effectively reduce the latency of individual requests. Since separate goroutines involved in processing this mode adds some performance and memory overhead – though it should be pretty negligible in most cases. This option applies to all commands from a client (including subscribe, publish, presence, etc).

### gomaxprocs

Default: 0

By default, Centrifugo runs on all available CPU cores. To limit amount of cores Centrifugo can utilize in one moment use this option.

## Endpoint configuration.

After Centrifugo started there are several endpoints available.

### Default endpoints.

Bidirectional WebSocket default endpoint:

```
ws://localhost:8000/connection/websocket
```

Bidirectional SockJS default endpoint (disabled by default):

```
http://localhost:8000/connection/sockjs
```

Unidirectional Eventsource endpoint (disabled by default):

```
http://localhost:8000/connection/uni_sse
```

Unidirectional http steaming endpoint (disabled by default):

```
http://localhost:8000/connection/uni_http_stream
```

Unidirectional WebSocket endpoint (disabled by default):

```
http://localhost:8000/connection/uni_websocket
```

Unidirectional Eventsource endpoint (disabled by default):

```
http://localhost:8000/connection/uni_sse
```

Server HTTP API endpoint:

```
http://localhost:8000/api
```

By default, all endpoints work on port `8000`. This can be changed with `port` option:

```json
{
    "port": 9000
}
```

In production setup you may have a proper domain name in endpoint addresses above instead of `localhost`. While domain name and port parts can differ depending on setup – URL paths stay the same: `/connection/sockjs`, `/connection/websocket`, `/api` etc.

### Admin endpoints.

Admin web UI endpoint works on root path by default, i.e. `http://localhost:8000`.

For more details about admin web UI, refer to the [Admin web UI documentation](admin_web.md).

### Debug endpoints.

Next, when Centrifugo started in debug mode some extra debug endpoints become available. To start in debug mode add `debug` option to config:

```json
{
    ...
    "debug": true
}
```

And endpoint:

```
http://localhost:8000/debug/pprof/
```

– will show useful information about internal state of Centrifugo instance. This info is especially helpful when troubleshooting. See [wiki page](https://github.com/centrifugal/centrifugo/wiki/Investigating-performance-issues) for more info.

### Health check endpoint

Use `health` boolean option (by default `false`) to enable healthcheck endpoint which will be available on path `/health`. Also available over command-line flag:

```bash
centrifugo -c config.json --health
```

### Custom internal ports

We strongly recommend to not expose API, admin, debug, health and prometheus endpoints to Internet. The following Centrifugo endpoints are considered internal:

* API endpoint (`/api`) - for HTTP API requests
* Admin web interface endpoints (`/`, `/admin/auth`, `/admin/api`) - used by web interface
* Prometheus endpoint (`/metrics`) - used for exposing server metrics in Prometheus format 
* Health check endpoint (`/health`) - used to do health checks
* Debug endpoints (`/debug/pprof`) - used to inspect internal server state

It's a good practice to protect all these endpoints with firewall. For example, it's possible to configure in `location` section of Nginx configuration.

Though sometimes you don't have access to per-location configuration in your proxy/load balancer software. For example when using Amazon ELB. In this case you can change ports on which your internal endpoints work.

To run internal endpoints on custom port use `internal_port` option:

```json
{
    ...
    "internal_port": 9000
}
```

So admin web interface will work on address:
 
```
http://localhost:9000
```

Also debug page will be available on new custom port too:

```
http://localhost:9000/debug/pprof/
```

The same for API and prometheus endpoint.

### Disable default endpoints

To disable websocket endpoint set `websocket_disable` boolean option to `true`.

To disable API endpoint set `api_disable` boolean option to `true`.

### Customize handler endpoints

It's possible to customize server HTTP handler endpoints. To do this Centrifugo supports several options:

* `admin_handler_prefix` (default `""`) - to control Admin panel URL prefix
* `websocket_handler_prefix` (default `"/connection/websocket"`) - to control WebSocket URL prefix
* `sockjs_handler_prefix` (default `"/connection/sockjs"`) - to control SockJS URL prefix
* `uni_sse_handler_prefix` (default `"/connection/uni_sse"`) - to control unidirectional Eventsource URL prefix
* `uni_http_stream_handler_prefix` (default `"/connection/uni_http_stream"`) - to control unidirectional HTTP streaming URL prefix
* `uni_websocket_handler_prefix` (default `"/connection/uni_websocket"`) - to control unidirectional WebSocket URL prefix
* `api_handler_prefix` (default `"/api"`) - to control HTTP API URL prefix
* `prometheus_handler_prefix` (default `"/metrics"`) - to control Prometheus URL prefix
* `health_handler_prefix` (default `"/health"`) - to control health check URL prefix

## Signal handling

It's possible to send HUP signal to Centrifugo to reload a configuration:

```bash
kill -HUP <PID>
```

Though at moment **this will only reload token secrets and channel options (top-level and namespaces)**.

Centrifugo tries to gracefully shutdown client connections when SIGINT or SIGTERM signals received. By default, maximum graceful shutdown period is 30 seconds but can be changed using `shutdown_timeout` (integer, in seconds) configuration option.

## Insecure modes

### Insecure client connection

The boolean option `client_insecure` (default `false`) allows to connect to Centrifugo without JWT token. In this mode there is no user authentication involved. This mode can be useful for demo projects based on Centrifugo, local projects or real-time application prototyping. Don't use it in production.

### Insecure API mode

This mode can be enabled using boolean option `api_insecure` (default `false`). When on there is no need to provide API key in HTTP requests. When using this mode everyone that has access to `/api` endpoint can send any command to server. Enabling this option can be reasonable if `/api` endpoint protected by firewall rules.

The option is also useful in development to simplify sending API commands to Centrifugo using CURL for example without specifying `Authorization` header in requests.

### Insecure admin mode

This mode can be enabled using boolean option `admin_insecure` (default `false`). When on there is no authentication in admin web interface. Again - this is not secure but can be justified if you protected admin interface by firewall rules or you want to use basic authentication for Centrifugo admin interface (configured on proxy level).

## Setting time duration options

Time durations in Centrifugo can be set using strings where duration value and unit are both provided. For example, to set 5 seconds duration use `"5s"`.

Minimal time resolution is 1ms. Some options of Centrifugo only support second precision (for example `history_ttl` channel option).

Valid time units are "ms" (milliseconds), "s" (seconds), "m" (minutes), "h" (hours).

Some examples:

```js
"1000ms" // 1000 milliseconds
"1s"     // 1 second
"12h"    // 12 hours
"720h"   // 30 days
```

## Setting namespaces over env

While setting most options in Centrifugo over env is pretty straightforward setting namespaces is a bit special:

```console
CENTRIFUGO_NAMESPACES='[{"name": "ns1"}, {"name": "ns2"}]' ./centrifugo
```

I.e. `CENTRIFUGO_NAMESPACES` environment variable should be a valid JSON string that represents namespaces array.
