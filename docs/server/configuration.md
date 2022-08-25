---
id: configuration
title: Configure Centrifugo
---

Let's look at how Centrifugo can be configured.

:::info There are more options

This chapter describes configuration principles and some important configuration options. There are some options not mentioned here but described later in each feature documentation.

:::

## Configuration sources

Centrifugo can be configured in several ways.

### Command-line flags

Centrifugo supports several command-line flags. See `centrifugo -h` for available flags. Command-line flags limited to most frequently used. In general, we suggest to avoid using flags for configuring Centrifugo in a production environment – prefer environment or configuration file sources.

Command-line options have the highest priority when set than other ways to configure Centrifugo.

### OS environment variables

All Centrifugo options can be set over env in the format `CENTRIFUGO_<OPTION_NAME>` (i.e. option name with `CENTRIFUGO_` prefix, all in uppercase).

Setting options over env is mostly straightforward except namespaces – [see how to set namespaces via env](#setting-namespaces-over-env). Environment variables have the second priority after flags.

Boolean options can be set using strings according to Go language [ParseBool](https://pkg.go.dev/strconv#ParseBool) function. I.e. to set `true` you can just use `"true"` value for an environment variable (or simply `"1"`). To set `false` use `"false"` or `"0"`. Example:

```bash
export CENTRIFUGO_PROMETHEUS="1"
```

Also, array options, like `allowed_origins` can be set over environment variables as a single string where values separated by a space. For example:

```bash
export CENTRIFUGO_ALLOWED_ORIGINS="https://mysite1.example.com https://mysite2.example.com"
```

For a nested object configuration (which we have, for example, in [Centrifugo PRO ClickHouse analytics](../pro/analytics.md)) it's still possible to use environment variables to set options. In this case replace nesting with `_` when constructing environment variable name.

Empty environment variables are considered unset (!) and will fall back to the next configuration source.

### Configuration file

Configuration file supports all options mentioned in Centrifugo documentation and can be in one of three supported formats: JSON, YAML, or TOML. Config file options have the lowest priority among configuration sources (i.e. option set over environment variable prevails over the same option in config file).

A simple way to start with Centrifugo is to run:

```bash
centrifugo genconfig
```

This command generates `config.json` configuration file in a current directory. This file already has the minimal number of options set. So it's then possible to start Centrifugo:

```bash
centrifugo -c config.json
```

## Config file formats

Centrifugo supports three configuration file formats: JSON, YAML, or TOML.

### JSON config format

Here is an example of Centrifugo JSON configuration file:

```json title="config.json"
{
  "allowed_origins": ["http://localhost:3000"],
  "token_hmac_secret_key": "<YOUR-SECRET-STRING-HERE>",
  "api_key": "<YOUR-API-KEY-HERE>"
}
```

`token_hmac_secret_key` used to check JWT signature (more info about JWT in [authentication chapter](authentication.md)). If you are using [connect proxy](proxy.md#connect-proxy) then you may use Centrifugo without JWT.

`api_key` used for Centrifugo API endpoint authorization, see more in [chapter about server HTTP API](server_api.md#http-api). Keep both values secret and never reveal them to clients.

`allowed_origins` option [described below](#allowed_origins).

### TOML config format

Centrifugo also supports TOML format for configuration file:

```bash
centrifugo --config=config.toml
```

Where `config.toml` contains:

```toml title="config.toml"
allowed_origins: [ "http://localhost:3000" ]
token_hmac_secret_key = "<YOUR-SECRET-STRING-HERE>"
api_key = "<YOUR-API-KEY-HERE>"
log_level = "debug"
```

In the example above we also defined logging level to be `debug` which is useful to have while developing an application. In the production environment debug logging can be too chatty.

### YAML config format

YAML format is also supported:

```yaml title="config.yaml"
allowed_origins:
  - "http://localhost:3000"
token_hmac_secret_key: "<YOUR-SECRET-STRING-HERE>"
api_key: "<YOUR-API-KEY-HERE>"
log_level: debug
```

With YAML remember to use spaces, not tabs when writing a configuration file.

## Important options

Let's describe some important options you can configure when running Centrifugo.

### allowed_origins

This option allows setting an array of allowed origin patterns (array of strings) for WebSocket and SockJS endpoints to prevent [CSRF](https://en.wikipedia.org/wiki/Cross-site_request_forgery) or WebSocket hijacking attacks. Also, it's used for HTTP-based unidirectional transports to enable CORS for configured origins.

As soon as `allowed_origins` is defined every connection request with `Origin` set will be checked against each pattern in an array.

Connection requests without `Origin` header set are passing through without any checks (i.e. always allowed).

For example, a client connects to Centrifugo from a web browser application on `http://localhost:3000`. In this case, `allowed_origins` should be configured in this way:

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

It's also possible to allow all origins in the following way (but this is discouraged and insecure when using connect proxy feature):

```json
"allowed_origins": [
    "*"
]
```

### address

Bind your Centrifugo to a specific interface address (string, by default `""` - listen on all available interfaces).

### port

Port to bind Centrifugo to (string, by default `"8000"`).

### engine

Engine to use - `memory`, `redis` or `tarantool`. It's a string option, by default `memory`. Read more about engines in [special chapter](engines.md).

## Advanced options

These options allow tweaking server behavior, in most cases default values are good to start with. 

### client_channel_limit

Default: 128

Sets the maximum number of different channel subscriptions a single client can have.

:::tip

When designing an application avoid subscribing to an unlimited number of channels per one client. Keep number of subscriptions for each client reasonably small – this will help keeping handshake process lightweight and fast.

:::

### channel_max_length

Default: 255

Sets the maximum length of the channel name.

### client_user_connection_limit

Default: 0

The maximum number of connections from a user (with known user ID) to Centrifugo node. By default, unlimited.

The important thing to emphasize is that `client_user_connection_limit` works only per one Centrifugo node and exists mostly to protect Centrifugo from many connections from a single user – but not for business logic limitations. This means that if you set this to 1 and scale nodes – say run 10 Centrifugo nodes – then a user will be able to create 10 connections (one to each node).

### client_connection_limit

Added in Centrifugo v4.0.1

Default: 0

When set to a value > 0 `client_connection_limit` limits the max number of connections single Centrifugo node can handle. It acts on HTTP middleware level and stops processing request if the condition met. It logs a warning into logs in this case and increments `centrifugo_node_client_connection_limit` Prometheus counter. Client SDKs will attempt reconnecting.

Some motivation behind this option may be found in [this issue](https://github.com/centrifugal/centrifugo/issues/544).

Note, that at this point `client_connection_limit` does not affect connections coming over GRPC unidirectional transport.

### client_queue_max_size

Default: 1048576

Maximum client message queue size in bytes to close slow reader connections. By default - 1mb.

### client_concurrency

Default: 0

`client_concurrency` when set tells Centrifugo that commands from a client must be processed concurrently.

By default, concurrency disabled – Centrifugo processes commands received from a client one by one. This means that if a client issues two RPC requests to a server then Centrifugo will process the first one, then the second one. If the first RPC call is slow then the client will wait for the second RPC response much longer than it could (even if the second RPC is very fast). If you set `client_concurrency` to some value greater than 1 then commands will be processed concurrently (in parallel) in separate goroutines (with maximum concurrency level capped by `client_concurrency` value). Thus, this option can effectively reduce the latency of individual requests. Since separate goroutines are involved in processing this mode adds some performance and memory overhead – though it should be pretty negligible in most cases. This option applies to all commands from a client (including subscribe, publish, presence, etc).

### allow_anonymous_connect_without_token

Default: false

Enable a mode when all clients can connect to Centrifugo without JWT. In this case, all connections without a token will be treated as anonymous (i.e. with empty user ID). Access to channel operations should be explicitly enabled for anonymous connections.

### gomaxprocs

Default: 0

By default, Centrifugo runs on all available CPU cores (also Centrifugo can look at cgroup limits when rnning in Docker/Kubernetes). To limit the number of cores Centrifugo can utilize in one moment use this option.

## Endpoint configuration.

After Centrifugo started there are several endpoints available.

### Default endpoints.

Bidirectional WebSocket default endpoint:

```
ws://localhost:8000/connection/websocket
```

Bidirectional emulation with HTTP-streaming (disabled by default):

```
ws://localhost:8000/connection/http_stream
```

Bidirectional emulation with SSE (EventSource) (disabled by default):

```
ws://localhost:8000/connection/sse
```

Bidirectional SockJS default endpoint (disabled by default):

```
http://localhost:8000/connection/sockjs
```

Unidirectional EventSource endpoint (disabled by default):

```
http://localhost:8000/connection/uni_sse
```

Unidirectional HTTP streaming endpoint (disabled by default):

```
http://localhost:8000/connection/uni_http_stream
```

Unidirectional WebSocket endpoint (disabled by default):

```
http://localhost:8000/connection/uni_websocket
```

Unidirectional SSE (EventSource) endpoint (disabled by default):

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

In production setup, you may have a proper domain name in endpoint addresses above instead of `localhost`. While domain name and port parts can differ depending on setup – URL paths stay the same: `/connection/sockjs`, `/connection/websocket`, `/api` etc.

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

– will show useful information about the internal state of Centrifugo instance. This info is especially helpful when troubleshooting. See [wiki page](https://github.com/centrifugal/centrifugo/wiki/Investigating-performance-issues) for more info.

### Health check endpoint

Use `health` boolean option (by default `false`) to enable the health check endpoint which will be available on path `/health`. Also available over command-line flag:

```bash
centrifugo -c config.json --health
```

### Custom internal ports

We strongly recommend not expose API, admin, debug, health, and Prometheus endpoints to the Internet. The following Centrifugo endpoints are considered internal:

* API endpoint (`/api`) - for HTTP API requests
* Admin web interface endpoints (`/`, `/admin/auth`, `/admin/api`) - used by web interface
* Prometheus endpoint (`/metrics`) - used for exposing server metrics in Prometheus format 
* Health check endpoint (`/health`) - used to do health checks
* Debug endpoints (`/debug/pprof`) - used to inspect internal server state

It's a good practice to protect all these endpoints with a firewall. For example, it's possible to configure in `location` section of the Nginx configuration.

Though sometimes you don't have access to a per-location configuration in your proxy/load balancer software. For example when using Amazon ELB. In this case, you can change ports on which your internal endpoints work.

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

Also, debug page will be available on a new custom port too:

```
http://localhost:9000/debug/pprof/
```

The same for API and Prometheus endpoints.

### Disable default endpoints

To disable websocket endpoint set `websocket_disable` boolean option to `true`.

To disable API endpoint set `api_disable` boolean option to `true`.

### Customize handler endpoints

It's possible to customize server HTTP handler endpoints. To do this Centrifugo supports several options:

* `admin_handler_prefix` (default `""`) - to control Admin panel URL prefix
* `websocket_handler_prefix` (default `"/connection/websocket"`) - to control WebSocket URL prefix
* `http_stream_handler_prefix` (default `"/connection/http_stream"`) - to control HTTP-streaming URL prefix
* `sse_handler_prefix` (default `"/connection/sse"`) - to control SSE/EventSource URL prefix
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

Centrifugo tries to gracefully shut down client connections when SIGINT or SIGTERM signals are received. By default, the maximum graceful shutdown period is 30 seconds but can be changed using `shutdown_timeout` (integer, in seconds) configuration option.

## Insecure modes

### Insecure client connection

The boolean option `client_insecure` (default `false`) allows connecting to Centrifugo without JWT token. In this mode, there is no user authentication involved. It also disables permission checks on client API level - for presence and history calls. This mode can be useful for demo projects based on Centrifugo, integration tests, local projects, or real-time application prototyping. Don't use it in production until you 100% know what you are doing.

### Insecure API mode

This mode can be enabled using the boolean option `api_insecure` (default `false`). When on there is no need to provide API key in HTTP requests. When using this mode everyone that has access to `/api` endpoint can send any command to server. Enabling this option can be reasonable if `/api` endpoint is protected by firewall rules.

The option is also useful in development to simplify sending API commands to Centrifugo using CURL for example without specifying `Authorization` header in requests.

### Insecure admin mode

This mode can be enabled using the boolean option `admin_insecure` (default `false`). When on there is no authentication in the admin web interface. Again - this is not secure but can be justified if you protected the admin interface by firewall rules or you want to use basic authentication for the Centrifugo admin interface (configured on proxy level).

## Setting time duration options

Time durations in Centrifugo can be set using strings where duration value and unit are both provided. For example, to set 5 seconds duration use `"5s"`.

The minimal time resolution is 1ms. Some options of Centrifugo only support second precision (for example `history_ttl` channel option).

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

## Anonymous usage stats

Centrifugo periodically sends anonymous usage information (once in 24 hours). That information is impersonal and does not include sensitive data, passwords, IP addresses, hostnames, etc. Only counters to estimate version and installation size distribution, and feature usage.

Please do not disable usage stats sending without reason. If you depend on Centrifugo – sure you are interested in further project improvements. Usage stats help us understand Centrifugo use cases better, concentrate on widely-used features, and be confident we are moving in the right direction. Developing in the dark is hard, and decisions may be non-optimal.

To disable sending usage stats set `usage_stats_disable` option:

```json title="config.json"
{
  "usage_stats_disable": true
}
```
