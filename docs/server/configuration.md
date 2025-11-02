---
id: configuration
title: Configure Centrifugo
---

Centrifugo can start without any configuration – it runs out-of-the-box with enabled HTTP API endpoint and enabled WebSocket transport endpoint for client real-time connections. In most cases though, you still need to configure it to set [authorization options for HTTP API](./server_api.md#http-api-authorization), [connection JWT authentication](./authentication.md), or maybe authentication over [connect proxy](./proxy.md), describe the desired [channel behaviour](./channels.md), and so on.

This document describes configuration principles and configuration sections, and most of the options available in Centrifugo. Where the feature requires more description we point from here to the dedicated documentation chapters.

## Lost in options?

Before we start, a little disclaimer: Centrifugo has many configuration options. If you feel lost, you can always use the [defaultconfig](./console_commands.md#defaultconfig), [defaultenv](./console_commands.md#defaultenv) and [configdoc](./console_commands.md#configdoc) CLI commands to check how config file options may be set and how environment variables should be named. Centrifugo also [warns you in logs](#validation-and-warnings-on-start) on start if sth unknown found in the configuration file or environment variables.

## Configuration sources

Centrifugo can be configured in several ways:

* configuration file (lowest priority).
* environment variables (medium priority – env vars override config file options)
* using command-line flags (highest priority – flags override everything) - we recommended to use them only during development.

## Configuration file

Configuration file supports all options mentioned in Centrifugo documentation and can be in one of three supported formats: JSON, YAML, or TOML.

Config file options have the lowest priority among configuration sources (i.e. option set over environment variable is preferred over the same option in config file).

One simple way to start with Centrifugo and its configuration is to run:

```bash
centrifugo genconfig
```

This command generates `config.json` configuration file in a current directory. This file already has the minimal number which are often used set. It's then possible to start Centrifugo with generated config file:

```bash
centrifugo -c config.json
```

## Config file formats

Centrifugo supports three configuration file formats: JSON, YAML, or TOML.

### JSON config format

Here is an example of Centrifugo JSON configuration file:

```json title="config.json"
{
  "client": {
    "token": {
      "hmac_secret_key": "<YOUR-SECRET-STRING-HERE>"
    },
    "allowed_origins": [
      "http://localhost:3000"
    ]
  },
  "http_api": {
    "key": "<YOUR-API-KEY-HERE>"
  }
}
```

`client.token.hmac_secret_key` used to check JWT signature (more info about JWT in [authentication chapter](authentication.md)). If you are using [connect proxy](proxy.md#connect-proxy) then you may use Centrifugo without JWT.

`http_api.key` used for Centrifugo API endpoint authorization, see more in [chapter about server HTTP API](server_api.md#http-api). Keep both values secret and never reveal them to clients.

`client.allowed_origins` option [described below](#clientallowed_origins).

### TOML config format

Centrifugo also supports TOML format for configuration file:

```bash
centrifugo --config=config.toml
```

Where `config.toml` may contain sth like:

```toml title="config.toml"
[client]
allowed_origins = [ "http://localhost:3000" ]

  [client.token]
  hmac_secret_key = "<YOUR-SECRET-STRING-HERE>"

[http_api]
key = "<YOUR-API-KEY-HERE>"
```

### YAML config format

YAML format is also supported:

```yaml title="config.yaml"
client:
  token:
    hmac_secret_key: "<YOUR-SECRET-STRING-HERE>"
  allowed_origins:
  - http://localhost:3000
http_api:
  key: "<YOUR-API-KEY-HERE>"
```

## OS environment variables

Environment variables override configuration file options.

Almost all Centrifugo options can be set over env in the format `CENTRIFUGO_<OPTION_NAME>`. Setting options over environment variables is mostly straightforward – you just prefix the option used in configuration file with `CENTRIFUGO_`, make it uppercase and replace nested levels with `_`.

:::tip

There are some cases with more complex config types where you need to configure maps or arrays of objects. See docs for [MapStringString](#mapstringstring-type) and [StringKeyValues](#stringkeyvalues-type) types which represent maps. For arrays of objects Centrifugo either provides a way to point the specific array instance by name when setting environment variable, or always supports [setting the entire array of objects as a JSON string](#setting-arrays-over-env).

:::

Boolean options can be set using strings according to Go language [ParseBool](https://pkg.go.dev/strconv#ParseBool) function. I.e. to set `true` you can just use `"true"` value for an environment variable (or simply `"1"`). To set `false` use `"false"` or `"0"`.

Array of strings (`[]string`) can be set over env using space-separated string values.

Let's look at the example. Suppose the configuration file looks like this:

```json title="config.json"
{
  "client": {
    "allowed_origins": [
      "https://mysite1.com",
      "https://mysite2.com"
    ]
  },
  "prometheus": {
    "enabled": true
  }
}
```

The same may be achieved using environment variables in this way:

```bash
export CENTRIFUGO_CLIENT_ALLOWED_ORIGINS="https://mysite1.com https://mysite2.com"
export CENTRIFUGO_PROMETHEUS_ENABLED="true"
```

Empty environment variables are considered unset (!) and will fall back to the next configuration source.

## Command-line flags

Command-line options override options set over config file and env vars.

Centrifugo supports several command-line flags. See `centrifugo -h` for available flags. Command-line flags limited to most frequently used. Mostly useful for development. In general, **we recommend to avoid using flags for configuring Centrifugo in a production environment** because flags often harder to redefine without changes in how Centrifugo deployed – prefer using environment variables or configuration file.

## Configuration types

Throughout Centrifugo documentation you may see references to several non-primitive configuration types. Here we describe them in more detail.

### Duration type

Time durations in Centrifugo can be set using strings where duration value and unit are both provided. For example, to set 5 seconds duration use `"5s"`.

The minimal time resolution is 1ms. Some options of Centrifugo only support second precision (for example `history_ttl` channel option).

Valid time units are `ms` (milliseconds), `s` (seconds), `m` (minutes), `h` (hours).

Some examples:

```js
"1000ms" // 1000 milliseconds
"1s"     // 1 second
"12h"    // 12 hours
"720h"   // 30 days
```

Example of setting duration type in config file:

```json title="config.json"
{
  "client": {
    "ping_interval": "25s",
    "pong_timeout": "8s"
  }
}
```

Or using environment variables:

```bash
export CENTRIFUGO_CLIENT_PING_INTERVAL="30s"
```

### MapStringString type

Some configuration options in Centrifugo use `MapStringString` type. This type represents a map where both keys and values are strings.

This type is just a map in JSON configuration:

```json title="config.json"
{
  "some_option": {
    "key1": "value2",
    "key2": "value2"
  }
}
```

It can be set using environment variables too – in that case Centrifugo expects JSON string representation of the map:

```bash
export CENTRIFUGO_SOME_OPTION='{"key1": "value1", "key2": "value2"}'
```

Configuration parser used by Centrifugo transforms keys of `MapStringString` type to lower case. This may be an issue in some corner cases, so Centrifugo uses [StringKeyValues](#stringkeyvalues-type) configuration type for options where the case may be an issue.

To work around the issue in corner cases for `MapStringString` type Centrifugo supports setting it using list of key-value pairs too – in that case keys keep their case.

Example of `MapStringString` type as a list of key-value pairs:

```json title="config.json"
{
  "some_option": [
    {"key": "FirstKey", "value": "first_value"},
    {"key": "SecondKey", "value": "second_value"}
  ]
}
```

Since v6.3.0 Centrifugo supports extrapolating custom env variables in `MapStringString` config fields. This may help to define secret map values in config via separate env variables. All such environment vars must have `CENTRIFUGO_VAR_` prefix. For example, when defining static HTTP headers in [proxy](./proxy.md) config:

```json title="config.json"
  ...
  "http": {
    "static_headers": {
      "authorization": "Bearer ${CENTRIFUGO_VAR_API_TOKEN}"
    }
  }
```

### StringKeyValues type

For cases where case-insensitive keys of `MapStringString` may be a problem Centrifugo uses `StringKeyValues` type. This type represents a list of key-value pairs where both keys and values are strings. Keys must be unique.

Example:

```json title="config.json"
{
  "some_option": [
    {"key": "key1", "value": "value1"},
    {"key": "key2", "value": "value2"}
  ]
}
```

While more verbose to configure, this type does not have case-sensitivity issues like `MapStringString`. Centrifugo does not allow setting `StringKeyValues` as a map in the config file, protecting developer from the unexpected issues.

Just like with `MapStringString` type – `StringKeyValues` type can be set using environment variables too. In that case Centrifugo expects JSON string representation of the key/value list or JSON object representation of the map.

I.e. the following environment variable values are both valid for `some_option` of `StringKeyValues`:

```bash
export CENTRIFUGO_SOME_OPTION='[{"key": "key1", "value": "value1"}, {"key": "key2", "value": "value2"}]'
export CENTRIFUGO_SOME_OPTION='{"first_key": "first_value", "second_key": "second_value"}'
```

Centrifugo supports extrapolating custom env variables in `StringKeyValues` values. This may help to define secret map values in config via separate env variables. All such environment vars must have `CENTRIFUGO_VAR_` prefix. For example, when defining static HTTP headers in [proxy](./proxy.md) config:

```json title="config.json"
{
  "some_option": [
    {"key": "key", "value": "${CENTRIFUGO_VAR_MY_VALUE}"}
  ]
}
```

### Array of objects

Setting array of objects is straightforward in the config file:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {"name": "ns1"},
      {"name": "ns2"}
    ]
  }
}
```

But when setting over the environment variable it must be an array of objects encoded to a JSON string:

```console
CENTRIFUGO_CHANNEL_NAMESPACES='[{"name": "ns1"}, {"name": "ns2"}]' ./centrifugo
```

This applies for other options which have are array of objects.

### TLS config object

TLS configurations in Centrifugo can be set using the following TLS object:

| Field name             | Type   | Description                                                                                                                                       |
|------------------------|--------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| `enabled`              | bool   | Turns on using TLS                                                                                                                                |
| `cert_pem`             | string | Certificate in PEM format. Raw string, base64 PEM encoded string or path to a PEM file supported as a value. See more details below.              |
| `key_pem`              | string | Key in PEM format. Same values as for `cert_pem` supported.                                                                                       |
| `server_ca_pem`        | string | Server root CA certificate in PEM format used by client to verify server's certificate during handshake. Same values as for `cert_pem` supported. |
| `client_ca_pem`        | string | Client CA certificate in PEM format used by server to verify client's certificate during handshake. Same values as for `cert_pem` supported.      |
| `insecure_skip_verify` | bool   | Turns off server certificate verification.                                                                                                        |
| `server_name`          | string | Used to verify the hostname on the returned certificates.                                                                                         |

- **Source Priority:** The configuration allows specifying TLS settings from multiple sources: raw PEM string, base64 PEM encoded string, path to a PEM file. The sources are prioritized in the following order:
    1. Raw PEM
    2. Base64 encoded PEM
    3. PEM file path
- **Insecure Option:** The `insecure_skip_verify` option can be used to turn off server certificate verification, which is not recommended for production environments.
- **Hostname Verification:** The `server_name` is utilized to verify the hostname on the returned certificates, providing an additional layer of security.

So in the configuration the usage of TLS config for HTTP server may be like this:

```json title="config.json"
{
  "http_server": {
    "tls": {
      "enabled": true,
      "cert_pem": "/path/to/cert.pem",
      "key_pem": "/path/to/key.pem"
    }
  }
}
```

## Validation and warnings on start

Centrifugo validates configuration on start, in case the configuration is invalid server exits with code 1. See also some built-in [CLI helpers](./console_commands.md).

Centrifugo also tries to help you find misconfigurations by writing logs on WARN level during server startup in case configuration file or environment variables have keys which are not known by Centrifugo. Unknown keys do not result into server exiting at this point.

It's recommended to pay attention to logs on server start to ensure that configuration is correct.

## `http_server`

Object.

Configuration options of Centrifugo HTTP server are combined under `http_server` section of configuration file.

### `http_server.port`

String. Default: `"8000"`.

Port to bind Centrifugo to. Example:

```json title="config.json"
{
  "http_server" : {
    "port": "8000"
  }
}
```

Alternatively, to set over environment variables:

```
CENTRIFUGO_HTTP_SERVER_PORT="8000"
```

### `http_server.address`

String. Default: `""`.

Bind your Centrifugo to a specific interface address. By default `""` - listen on all available interfaces. Example:

```json title="config.json"
{
  "http_server" : {
    "address": "0.0.0.0"
  }
}
```

### `http_server.tls`

[Unified TLS object](#tls-config-object). By default – disabled.

TLS layer is very important not only for securing your connections but also to increase a chance to establish Websocket connection.

:::tip

In most situations you better put TLS termination task on your reverse proxy/load balancing software such as Nginx. This can be a good thing for performance.

:::

If you still need to configure Centrifugo server TLS then `tls` object can help you. This is a [unified TLS object](#tls-config-object). If set and enabled Centrifugo HTTP server will start with TLS support.

### `http_server.tls_autocert`

Object. By default – disabled.

Centrifugo supports certificate loading and renewal from Let's Encrypt using ACME protocol for HTTP server.

:::tip

In most situations you better put TLS termination task on your reverse proxy/load balancing software such as Nginx. This can be a good thing for performance.

:::

For automatic certificates from Let's Encrypt add into configuration file:

```json title="config.json"
{
  "http_server": {
    "tls_autocert": {
      "enabled": true,
      "host_whitelist": "www.example.com",
      "cache_dir": "/tmp/certs",
      "email": "user@example.com",
      "http": true,
      "http_addr": ":80"
    }
  }
}
```

`http_server.tls_autocert.enabled` (boolean) says Centrifugo that you want automatic certificate handling using ACME provider.

`http_server.tls_autocert.host_whitelist` (string) is a string with your app domain address. This can be comma-separated
list. It's optional but recommended for extra security.

`http_server.tls_autocert.cache_dir` (string) is a path to a folder to cache issued certificate files. This is optional
but will increase performance.

`http_server.tls_autocert.email` (string) is optional - it's an email address ACME provider will send notifications
about problems with your certificates.

`http_server.tls_autocert.http` (boolean) is an option to handle http_01 ACME challenge on non-TLS port.

`http_server.tls_autocert.http_addr` (string) can be used to set address for handling http_01 ACME challenge (default is `:80`)

When configured correctly and your domain is valid (`localhost` will not work) - certificates will be retrieved on first request to Centrifugo.

Also Let's Encrypt certificates will be automatically renewed.

### `http_server.tls_external`

Boolean. Default: `false`.

When set to `true` Centrifugo will use TLS configuration from `tls` option only for external endpoints (i.e. for client-facing ones – WebSocket, SSE, and so on).

### `http_server.internal_port`

String. Default: `""`.

The port to bind internal endpoints to (string, by default `""` – not used). When set Centrifugo will bind internal endpoints to this port. See more about internal endpoints [below](#custom-internal-port).

### `http_server.internal_address`

String. Default: `""`.

Bind internal endpoints to a specific interface address (string, by default `""` - listen on all available interfaces).

### `http_server.internal_tls`

[Unified TLS object](#tls-config-object). By default – disabled.

This is useful when you want to use different TLS settings for internal endpoints (like Prometheus, debug, health, etc).

### `http_server.http3`

Object.

Centrifugo experimentally supports HTTP/3. We can't guarantee stability of this component at this point and given Centrifugo is usually running behind load balancer – this reduces a scope where HTTP/3 may be useful. It's required to support [WebTransport](../transports/webtransport.md) though.

### `http_server.h2c_external`

Boolean, default `false`. Since Centrifugo v6.5.0

This allows enabling H2C (HTTP/2 CLEARTEXT) on external endpoints of HTTP server.

## `log`

Object.

Logging options may be set under `log` section of configuration file.

### `log.level`

String. Default: `"info"`.

Log level to use. Possible values are: `"none"`, `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`. See also some info in [observability](./observability.md#logs) chapter.

```json title="config.json"
{
  "log" : {
    "level": "error"
  }
}
```

### `log.file`

String. Default: `""`.

Path to a file to which Centrifugo will write logs (string, by default `""` – not used, logs go to STDOUT).

## `engine`

Object.

Engine in Centrifugo is responsible for PUB/SUB, channel history cache, online presence features. By default, all Centrifugo PUB/SUB, channel history cache, online presence features are managed by in-memory engine. To scale Centrifugo to many nodes you may want to set alternative engine.

Here we only mention `engine.type` option, but there are more available engine type specific options. We have a chapter dedicated to engines - [Engines and Scalability](engines.md).

### `engine.type`

String. Default: `"memory"`.

By default, all Centrifugo PUB/SUB, channel history cache, online presence features are managed by in-memory engine:

```json title="config.json"
{
  "engine": {
    "type": "memory"
  }
}
```

There is a possibility to use `redis` type for an alternative full-featured engine implementation based on [Redis](https://redis.io/). Centrifugo also provides an integration with [Nats](https://nats.io/) server for at most once delivery cases. See more details in a dedicated chapter [Engines and Scalability](engines.md).

## `broker`

Object.

Centrifugo v6 introduced a new way to set a separate broker responsible for PUB/SUB and history cache related operations – using `broker` section of config.

Once a separate broker configured it will be used for Broker part instead of Engine's Broker part.

See more description of available options inside the section in [Engines and Scalability](engines.md#separate-broker-and-presence-manager) chapter.

## `presence_manager`

Object.

Centrifugo v6 introduced a new way to set a separate presence manager responsible for online presence management – using `presence_manager` section of config.

Once a separate presence manager configured it will be used for Presence Manager part instead of Engine's Presence Manager part.

See more description of available options inside the section in [Engines and Scalability](engines.md#separate-broker-and-presence-manager) chapter.

## `http_api`

Object.

Options related to server HTTP API may be set under `http_api` section of configuration.

See more details in [dedicated chapter](../server/server_api.md).

```json title="config.json"
{
  "http_api": {
    ...
  }
}
```

## `grpc_api`

Object.

Options related to server GRPC API may be set under `grpc_api` section of configuration.

See more details in [dedicated chapter](../server/server_api.md).

```json title="config.json"
{
  "grpc_api": {
    ...
  }
}
```

## `client`

Object.

Client connection options may be set under `client` section of configuration:

```json title="config.json"
{
  "client": {
    ...
  }
}
```

### `client.allowed_origins`

Array of strings. Default: empty array.

This option allows setting an array of allowed origin patterns (array of strings) for WebSocket endpoints to prevent [CSRF](https://en.wikipedia.org/wiki/Cross-site_request_forgery) or WebSocket hijacking attacks. Also, it's used for HTTP-based unidirectional transports to enable CORS for configured origins.

As soon as `client.allowed_origins` is defined every connection request with `Origin` set will be checked against each pattern in an array.

Connection requests without `Origin` header set are passing through without any checks (i.e. always allowed). Those originate from non-browser environment, so non-related to the mentioned security concerns.

For example, a client connects to Centrifugo from a web browser application on `http://localhost:3000`. In this case, `client.allowed_origins` should be configured in this way:

```json title="config.json"
{
  "client": {
    "allowed_origins": [
      "http://localhost:3000"
    ]
  }
}
```

When connecting from `https://example.com`:

```json title="config.json"
{
  "client": {
    "allowed_origins": [
      "https://example.com"
    ]
  }
}
```

Origin pattern can contain wildcard symbol `*` to match subdomains:

```json title="config.json"
{
  "client": {
    "allowed_origins": [
      "https://*.example.com"
    ]
  }
}
```

– in this case requests with `Origin` header like `https://foo.example.com` or `https://bar.example.com` will pass the check.

It's also possible to allow all origins in the following way (but this is discouraged and insecure when using connect proxy feature):

```json title="config.json"
{
  "client": {
    "allowed_origins": [
      "*"
    ]
  }
}
```

### `client.token`

Object.

The section `client.token` contains options for client connection and subscription JWT auth. See more details in [JWT authentication](./authentication.md) and [Channel JWT authorization](./channel_token_auth.md).

### `client.subscription_token`

Object.

It's possible to use separate token options for channel subscription – see details [here](./channel_token_auth.md#separate-subscription-token-config).

### `client.proxy.connect`

Object.

The configuration object for proxy to use for connect events. See how to configure [event proxies](./proxy.md).

### `client.proxy.refresh`

Object.

The configuration object for proxy to use for refresh events. See how to configure [event proxies](./proxy.md).

### `client.ping_interval`

[Duration](#duration-type). Default `"25s"`.

Interval to send pings to clients – see [more about ping/pong](../transports/overview.md#pingpong-behavior)

### `client.pong_timeout`

[Duration](#duration-type). Default `"8s"`.

Timeout to wait pong from clients after sending ping to them – see [more about ping/pong](../transports/overview.md#pingpong-behavior)

### `client.queue_max_size`

Integer. Default: `1048576`.

Each client connection has individual message queue, this is the size of that queue in bytes. Default: 1048576 bytes (1MB).

### `client.history_max_publication_limit`

Integer. Default: `300`

Limit for the max number of publications to be returned via client protocol. See more in [History and recovery](./history_and_recovery.md)

### `client.recovery_max_publication_limit`

Integer. Default: `300`

Limit for the max number of publications to be recovered via client protocol. See more in [History and recovery](./history_and_recovery.md)

### `client.channel_limit`

Integer. Default: `128`

Sets the maximum number of different channel subscriptions a single client can have.

:::tip

When designing an application avoid subscribing to an unlimited number of channels per one client. Keep number of subscriptions for each client reasonably small – this will help keeping handshake process lightweight and fast.

:::

### `client.user_connection_limit`

Integer. Default: `0`

The maximum number of connections from a user (with known user ID) to Centrifugo node. By default, unlimited.

The important thing to emphasize is that `client_user_connection_limit` works only per one Centrifugo node and exists mostly to protect Centrifugo from many connections from a single user – but not for business logic limitations. This means that if you set this to 1 and scale nodes – say run 10 Centrifugo nodes – then a user will be able to create 10 connections (one to each node).

### `client.connection_limit`

Integer. Default: `0`

When set to a value > 0 `client.connection_limit` limits the max number of connections single Centrifugo node can handle. It acts on HTTP middleware level and stops processing request if the condition met. It logs a warning into logs in this case and increments `centrifugo_node_client_connection_limit` Prometheus counter. Client SDKs will attempt reconnecting.

Some motivation behind this option may be found in [this issue](https://github.com/centrifugal/centrifugo/issues/544).

Note, that at this point `client.connection_limit` does not affect connections coming over GRPC unidirectional transport.

### `client.connection_rate_limit`

Integer. Default: `0`

`client.connection_rate_limit` sets the maximum number of HTTP requests to establish a new real-time connection a single Centrifugo node will accept per second (on real-time transport endpoints). All requests outside the limit will get 503 Service Unavailable code in response. Our SDKs handle this with backoff reconnection.

By default, no limit is used.

Note, that at this point `client.connection_rate_limit` does not affect connections coming over GRPC unidirectional transport.

### `client.queue_max_size`

Integer. Default: `1048576`

Maximum client message queue size in bytes to close slow reader connections. By default - 1mb.

### `client.concurrency`

Integer. Default: `0`

`client.concurrency` when set tells Centrifugo that commands from a client must be processed concurrently.

By default, concurrency disabled – Centrifugo processes commands received from a client one by one. This means that if a client issues two RPC requests to a server then Centrifugo will process the first one, then the second one. If the first RPC call is slow then the client will wait for the second RPC response much longer than it could (even if the second RPC is very fast). If you set `client.concurrency` to some value greater than 1 then commands will be processed concurrently (in parallel) in separate goroutines (with maximum concurrency level capped by `client.concurrency` value). Thus, this option can effectively reduce the latency of individual requests. Since separate goroutines are involved in processing this mode adds some performance and memory overhead – though it should be pretty negligible in most cases. This option applies to all commands from a client (including subscribe, publish, presence, etc).

### `client.stale_close_delay`

[Duration](#duration-type). Default: `"10s"`

This option allows tuning the maximum time Centrifugo will wait for the connect frame (which contains authentication information) from the client after establishing connection. Default value should be reasonable for most use cases.

### `client.user_id_http_header`

String. Default: `""`

Usually to authenticate client connections with Centrifugo you need to use [JWT authentication](./authentication.md) or [connect proxy](./proxy.md#connect-proxy). Sometimes though it may be convenient to pass user ID information in incoming HTTP request headers. This is usually the case when application backend infrastructure has some authentication proxy (like Envoy, etc). This proxy may set authenticated user ID to some header and proxy requests further to Centrifugo.

When `client.user_id_http_header` is set to some non-empty header name Centrifugo will try to extract the authenticated user ID for client connections from that header. This mechanism works for all real-time transports based on HTTP (this also includes WebSocket since it starts with HTTP Upgrade request). Example:

```json title="config.json"
{
  "client": {
    "user_id_http_header": "X-User-Id"
  }
}
```

When using this way for user authentication – you can not set connection expiration and additional connection info which is possible to do using other authentication ways mentioned above.

:::caution Security warning

When using authentication over proxy ensure your proxy strips the header you are using for auth if it comes from the client or forbids such requests to avoid malicious usage. Only your authentication proxy must set the header with user ID.

:::

### `client.connect_include_server_time`

Boolean. Default: `false`.

When enabled, Centrifugo attaches `time` field to the connect reply (or connect push in the unidirectional transport case). This field contains current server time as Unix milliseconds. Ex. `1716198604052`.

### `client.allow_anonymous_connect_without_token`

Boolean, default: `false`.

Enable a mode when all clients can connect to Centrifugo without JWT. In this case, all connections without a token will be treated as anonymous (i.e. with empty user ID). Access to channel operations should be explicitly enabled for anonymous connections.

### `client.disallow_anonymous_connection_tokens`

Boolean. Default: `false`.

When the option is set Centrifugo won't accept connections from anonymous users even if they provided a valid JWT. I.e. if token is valid, but `sub` claim is empty – then Centrifugo closes connection with advice to not reconnect again.

### `client.subscribe_to_user_personal_channel`

Object.

An object to configure user personal channel subscription and optionally enable single connection from user. See [dedicated description](./server_subs.md#automatic-personal-channel-subscription).

### `client.insecure`

:::danger INSECURE OPTION.

This option is insecure and mostly intended for development. In case of using in production – please make sure you understand the possible security risks.

:::

The boolean option `client.insecure` (default `false`) allows connecting to Centrifugo without JWT token. In this mode, there is no user authentication involved. It also disables permission checks on client API level - for presence and history calls. This mode can be useful for demo projects based on Centrifugo, integration tests, local projects, or real-time application prototyping. Don't use it in production until you 100% know what you are doing.

### `client.insecure_skip_token_signature_verify`

:::danger INSECURE OPTION.

This option is insecure and mostly intended for development. In case of using in production – please make sure you understand the possible security risks.

:::

Boolean. Default: `false`.

The boolean option `client.insecure_skip_token_signature_verify` (default `false`), if enabled – tells Centrifugo to skip JWT signature verification - for both connection and subscription tokens. This is absolutely **insecure** and must only be used for development and testing purposes. Token claims are parsed as usual - so token should still follow JWT format.

## `channel`

Object.

Let's describe some options for the `channel` section – these options relate to channel behavior. Learn more about channels in [Channels and namespaces](./channels.md) chapter.

### `channel.without_namespace`

Object.

This is an object with [channel options](./channels.md#channel-options) which are applied to all channels which do not belong to any namespace.

### `channel.namespaces`

Array of objects.

This is an array of objects with to configure [channel namespaces](./channels.md#channel-namespaces). Each object in the array represents a namespace. Namespaces allow you to apply specific options to a group of channels starting with a namespace name.

### `channel.history_meta_ttl`

[Duration](#duration-type). Default `"720h"`.

This option is a time to keep history meta information for channels when publication history is used. This value must be bigger than max `history_ttl` in all channel namespaces.

The motivation to have history meta information TTL is as follows. When using a history in a channel, Centrifugo keeps some metadata for each channel stream. Metadata includes the latest stream offset and its epoch value. In some cases, when channels are created for а short time and then not used anymore, created metadata can stay in memory while not useful. For example, you can have a personal user channel but after using your app for a while user left it forever. From a long-term perspective, this can be an unwanted memory growth. Setting a reasonable value to this option can help to expire metadata faster (or slower if you need it).

It's possible to redefine `history_meta_ttl` on channel namespace level.

### `channel.proxy.subscribe`

Object.

The configuration object for proxy to use for channel subscribe events. See how to configure [event proxies](./proxy.md).

### `channel.proxy.publish`

Object.

The configuration object for proxy to use for channel publish events. See how to configure [event proxies](./proxy.md).

### `channel.proxy.sub_refresh`

Object.

The configuration object for proxy to use for channel sub refresh events. See how to configure [event proxies](./proxy.md).

### `channel.proxy.subscribe_stream`

Object.

The configuration object for proxy to use for channel subscribe stream. See how to configure in [Proxy subscription streams](./proxy_streams.md).

### `channel.proxy.state`

Object.

The configuration object for proxy to use for channel state events. Centrifugo PRO only – see [docs](../pro/channel_events.md).

### `chanel.proxy.cache_empty`

Object.

The configuration object for proxy to use for cache empty events. Centrifugo PRO only – see [docs](../pro/channel_cache_empty.md).

### `channel.max_length`

Integer. Default: `255`

Sets the maximum length of the channel name.

## `rpc`

Object.

The section `rpc` of configuration file allows configuring options for client initiated RPC calls.

### `rpc.without_namespace`

Object.

Analogous to `channel.without_namespace` but for client RPC calls.

### `rpc.namespaces`

Array of objects.

Analogous to `channel.namespaces` but for client RPC calls.

### `rpc.namespace_boundary`

String. Default `":"`.

Analogue to `channel.namespace_boundary` but for client RPC calls.

### `rpc.ping`

Object.

Sometimes you may need a way to just ping Centrifugo server from the client-side. For example, some Centrifugo users wanted this to show RTT time to server in UI. It's possible to enable RPC extension which simply returns an empty reply to RPC `ping`:

```json title="config.json"
{
  "rpc": {
    "ping": {
      "enabled": true
    }
  }
}
```

After that, on SDK side you can do sth like this:

```javascript
const startTime = performance.now();
centrifuge.rpc('ping', {}).then(function() {
  const endTime = performance.now();
  console.log('rtt', ((endTime - startTime)).toFixed(2).toString(), 'ms');  // Output: rtt 0.90 ms
})
```

If you are not happy with method name `ping` – you can use a different one by setting `rpc.ping_method` option to a string you want:

```json title="config.json"
{
  "rpc": {
    "ping": {
      "enabled": true,
      "method": "rtt"
    }
  }
}
```

## `websocket`

Object.

WebSocket transport related options can be defined under `websocket` section of config.

See [WebSocket](../transports/websocket.md) chapter for all the configuration options.

## `sse`

Object.

SSE transport related options can be defined under `sse` section of config.

See [SSE (EventSource), with bidirectional emulation](../transports/sse.md) chapter for all the configuration options.

## `http_stream`

Object.

HTTP-streaming transport related options can be defined under `http_stream` section of config.

See [HTTP streaming, with bidirectional emulation](../transports/http_stream.md) chapter for all the configuration options.

## `webtransport`

Object.

WebTransport transport related options can be defined under `webtransport` section of config.

See [WebTransport](../transports/webtransport.md) chapter for all the configuration options.

## `uni_websocket`

Object.

Unidirectional WebSocket transport related options can be defined under `uni_websocket` section of config.

See [unidirectional WebSocket](../transports/uni_websocket.md) chapter for all the configuration options.

## `uni_sse`

Object.

Unidirectional SSE transport related options can be defined under `uni_sse` section of config.

See [Unidirectional SSE](../transports/uni_sse.md) chapter for all the configuration options.

## `uni_http_stream`

Object.

Unidirectional HTTP-streaming transport related options can be defined under `uni_http_stream` section of config.

See [Unidirectional HTTP-streaming](../transports/uni_http_stream.md) chapter for all the configuration options.

## `uni_grpc`

Object.

Unidirectional GRPC transport related options can be defined under `uni_grpc` section of config.

See [Unidirectional GRPC](../transports/uni_grpc.md) chapter for all the configuration options.

## `emulation`

Object.

Emulation endpoint enables automatically as soon as `http_stream.enabled` or `sse.enabled` set to `true`. It's required for
bidirectional emulation over HTTP-streaming and SSE to handle client to server part of communication.

### `emulation.max_request_body_size`

Integer. Default: `65536`.

Maximum size of POST request body in bytes for bidirectional emulation endpoint.

## `admin`

Object.

Admin web UI endpoint works on root path by default, i.e. `http://localhost:8000`.

For more details about admin web UI, refer to the [Admin web UI documentation](admin_web.md).

### `admin.enabled`

Boolean. Default: `false`.

When set to `true` Centrifugo will serve an admin web interface. This interface is useful for monitoring and managing Centrifugo server. It's a single-page application built with ReactJS, it's embedded to Centrifugo binary – so you don't need to serve any additional files.

## `debug`

Object.

Next, when Centrifugo started in debug mode some extra debug endpoints become available. To start in debug mode add `debug` option to config:

### `debug.enabled`

Boolean. Default: `false`.

When set to `true` Centrifugo will serve debug endpoints. For example, with the following config:

```json title="config.json"
{
  ...
  "debug": {
    "enabled": true
  }
}
```

– the endpoint:

```
http://localhost:8000/debug/pprof/
```

– will show useful information about the internal state of Centrifugo instance. This info is especially helpful when troubleshooting. See [wiki page](https://github.com/centrifugal/centrifugo/wiki/Investigating-performance-issues) for more info.

## `health`

Object.

Health endpoint configuration – useful for K8S liveness and readiness probes.

### `health.enabled`

Boolean. Default: `false`.

Use `health.enabled` boolean option (by default `false`) to enable the health check endpoint which will be available on path `/health`.

```json title="config.json"
{
  ...
  "health": {
    "enabled": true
  }
}
```

## `init`

Object.

Init endpoint for external endpoints. May be used as AWS LB ping endpoint, or as an endpoint to force HTTP/2 connection in Chrome (if there is no HTTP/2 connection established Chrome uses HTTP 1.1 for WebSocket). It's accessible over GET request, for now returns empty JSON object `{}`. It has the same CORS protection as other external real-time endpoints.

### `init.enabled`

Boolean. Default: `false`. Since Centrifugo v6.5.0

This enables connection init endpoint (on `/connection/init` by default, may be changed with `init.handler_prefix` option).

## `prometheus`

Object.

Prometheus endpoint configuration – useful for monitoring Centrifugo with Prometheus.

### `prometheus.enabled`

Boolean. Default: `false`.

The option `prometheus.enabled` (by default `false`) allows enabling the Prometheus endpoint. Metrics are then available on path `/metrics`.

```json title="config.json"
{
  ...
  "prometheus": {
    "enabled": true
  }
}
```

### `prometheus.instrument_http_handlers`

Boolean. Default `false`.

When set to `true` Centrifugo will instrument HTTP handlers with additional Prometheus metrics – at this point only the number of requests to specific handler with status code resolution. This can be useful to get more detailed information about the number of HTTP requests to Centrifugo. Comes with a small overhead, thus disabled by default.

## `swagger`

Object.

Swagger UI config.

### `swagger.enabled`

Boolean. Default: `false`.

Use `swagger.enabled` boolean option (by default `false`) to enable Swagger UI for [server HTTP API](./server_api.md). UI will be available on path `/swagger`. Also available over command-line flag:

```json title="config.json"
{
  ...
  "swagger": {
    "enabled": true
  }
}
```

## `proxies`

Array of objects.

Sometimes you need more flexibility when configuring channel proxies. Centrifugo provides a way to define custom proxy on channel namespace and rpc namespace levels. In that case you can reference a proxy defined in `proxies` array by name from a namespace.

See the [dedicated chapter](./proxy.md) for more details.

## `consumers`

Array of objects.

Centrifugo supports asynchronous reading of API commands from external queue systems, inclusing Kafka and PostgreSQL outbox table. It's possible to configure using `consumers` array option. See the [dedicated chapter about consumers](./consumers.md) for more details and configuration details.

## `opentelemetry`

Object.

See description in [dedicated chapter](./observability.md#opentelemetry).

## `graphite`

Object.

See description in [dedicated chapter](./observability.md#graphite-metrics).

## `shutdown`

Object.

Section to configure server shutdown behavior.

### `shutdown.timeout`

[Duration](#duration-type). Default `"30s"`.

Allows configuring max shutdown duration.

## `pid_file`

String. Default: `""`.

Path to a file where Centrifugo will write its PID (string, by default `""` – not used).

## Custom internal port

We strongly recommend not expose API, admin, debug, health, and Prometheus endpoints to the Internet. The following Centrifugo endpoints are considered internal:

* HTTP API endpoint (`/api`) - for HTTP API requests
* Admin web interface endpoints (`/`, `/admin/auth`, `/admin/api`) - used by web interface
* Prometheus endpoint (`/metrics`) - used for exposing server metrics in Prometheus format 
* Health check endpoint (`/health`) - used to do health checks
* Debug endpoints (`/debug/pprof`) - used to inspect internal server state
* Swagger UI endpoint (`/swagger`) - used for showing embedded Swagger UI for server HTTP API

It's a good practice to protect all these endpoints with a firewall. For example, it's possible to configure in `location` section of the Nginx configuration.

Though sometimes you don't have access to a per-location configuration in your proxy/load balancer software. For example when using Amazon ELB. In this case, you can change ports on which your internal endpoints work.

To run internal endpoints on custom port use `internal_port` option:

```json title="config.json"
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

## Endpoint management

This part is about Centrifugo endpoints and possibility to tweak them. 

### Default endpoints

[Bidirectional WebSocket](../transports/websocket.md) default endpoint:

```
ws://localhost:8000/connection/websocket
```

[Bidirectional emulation with HTTP-streaming](../transports/http_stream.md) (disabled by default):

```
ws://localhost:8000/connection/http_stream
```

[Bidirectional emulation with SSE](../transports/sse.md) (EventSource) (disabled by default):

```
ws://localhost:8000/connection/sse
```

[Unidirectional EventSource](../transports/uni_sse.md) endpoint (disabled by default):

```
http://localhost:8000/connection/uni_sse
```

[Unidirectional HTTP streaming](../transports/uni_http_stream.md) endpoint (disabled by default):

```
http://localhost:8000/connection/uni_http_stream
```

[Unidirectional WebSocket](../transports/uni_websocket.md) endpoint (disabled by default):

```
http://localhost:8000/connection/uni_websocket
```

[Server HTTP API](../server/server_api.md) endpoint:

```
http://localhost:8000/api
```

By default, all endpoints work on port `8000`. This can be changed with [port](#http_serverport) option:

```json title="config.json"
{
  ...
  "port": 9000
}
```

In production setup, you may have a proper domain name in endpoint addresses above instead of `localhost`. While domain name and port parts can differ depending on setup – URL paths stay the same: `/connection/websocket`, `/api` etc.

It's possible to redefine endpoint HTTP path prefixes using [custom handler prefixes](#customize-handler-prefixes).

### Customize handler prefixes

It's possible to customize server HTTP handler endpoints. To do this Centrifugo supports several options:

* `admin.handler_prefix` (default `""`) - to control Admin panel URL prefix
* `websocket.handler_prefix` (default `"/connection/websocket"`) - to control WebSocket URL prefix
* `http_stream.handler_prefix` (default `"/connection/http_stream"`) - to control HTTP-streaming URL prefix
* `sse.handler_prefix` (default `"/connection/sse"`) - to control SSE/EventSource URL prefix
* `emulation.handler_prefix` (default `"/emulation"`) - to control emulation endpoint prefix
* `uni_sse.handler_prefix` (default `"/connection/uni_sse"`) - to control unidirectional Eventsource URL prefix
* `uni_http.stream_handler_prefix` (default `"/connection/uni_http_stream"`) - to control unidirectional HTTP streaming URL prefix
* `uni_websocket.handler_prefix` (default `"/connection/uni_websocket"`) - to control unidirectional WebSocket URL prefix
* `http_api.handler_prefix` (default `"/api"`) - to control HTTP API URL prefix
* `prometheus.handler_prefix` (default `"/metrics"`) - to control Prometheus URL prefix
* `health.handler_prefix` (default `"/health"`) - to control health check URL prefix

### Disable default endpoints

Centrifugo starts with bidirectional WebSocket and HTTP API enabled.

To disable websocket endpoint set `websocket.disabled` boolean option to `true`.

To disable API endpoint set `http_api.disabled` boolean option to `true`.

## Signal handling

It's possible to send HUP signal to Centrifugo to reload a configuration:

```bash
kill -HUP <PID>
```

Though at moment **this will only reload token secrets and channel options (top-level and namespaces)**.

Centrifugo tries to gracefully shut down client connections when SIGINT or SIGTERM signals are received. By default, the maximum graceful shutdown period is 30 seconds but can be changed using `shutdown_timeout` (integer, in seconds) configuration option.

## Anonymous usage stats

Centrifugo periodically sends anonymous usage information (once in 24 hours). That information is impersonal and does not include sensitive data, passwords, IP addresses, hostnames, etc. Only counters to estimate version and installation size distribution, and feature usage.

Please do not disable usage stats sending without reason. If you depend on Centrifugo – sure you are interested in further project improvements. Usage stats help us understand Centrifugo use cases better, concentrate on widely-used features, and be confident we are moving in the right direction. Developing in the dark is hard, and decisions may be non-optimal.

To disable sending usage stats set `usage_stats_disable` option:

```json title="config.json"
{
  "usage_stats": {
    "disabled": true
  }
}
```
