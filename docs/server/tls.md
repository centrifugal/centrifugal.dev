---
description: "Configure TLS for Centrifugo using certificate files or automatic Let's Encrypt certificates. Includes unified TLS config for GRPC and all endpoints."
id: tls
title: Configure TLS
---

The TLS/SSL layer is very important not only for securing your connections but also to increase the
chance of establishing a WebSocket connection.

:::tip

In most situations you should put the TLS termination task on your reverse proxy/load balancing software such as Nginx. This can be beneficial for performance.

:::

There are situations though when you want to serve secure connections by Centrifugo itself.

There are two ways to do this: using TLS certificate `cert` and `key` files that you've obtained
from your CA provider, or using automatic certificate handling via an [ACME](https://datatracker.ietf.org/doc/html/rfc8555) provider (only [Let's Encrypt](https://letsencrypt.org/) at this moment).

### Using crt and key files

In the first way you already have `cert` and `key` files. For development you can create a self-signed
certificate — see [this instruction](https://devcenter.heroku.com/articles/ssl-certificate-self) as an
example.

```json title="config.json"
{
  "tls": {
    "enabled": true,
    "key_pem": "server.key",
    "cert_pem": "server.crt"
  }
}
```

And run:

```
./centrifugo --config=config.json
```

See [other options](#unified-tls-config-object) supported by TLS object.

### Automatic certificates

For automatic certificates from Let's Encrypt add into configuration file:

```json title="config.json"
{
  "tls_autocert": {
    "enabled": true,
    "host_whitelist": ["www.example.com"],
    "cache_dir": "/tmp/certs",
    "email": "user@example.com",
    "http": true,
    "http_addr": ":80"
  }
}
```

`tls_autocert.enabled` (boolean) says Centrifugo that you want automatic certificate handling using ACME provider.

`tls_autocert.host_whitelist` (array of strings) is the list of domains certificates are allowed for. It's optional but recommended for extra security.

`tls_autocert.cache_dir` (string) is a path to a folder to cache issued certificate files. This is optional
but will increase performance.

`tls_autocert.email` (string) is optional - it's an email address ACME provider will send notifications
about problems with your certificates.

`tls_autocert.http` (boolean) is an option to handle http_01 ACME challenge on non-TLS port.

`tls_autocert.http_addr` (string) can be used to set address for handling http_01 ACME challenge (default is `:80`)

When configured correctly and your domain is valid (`localhost` will not work) - certificates
will be retrieved on first request to Centrifugo.

Also Let's Encrypt certificates will be automatically renewed.

### TLS for GRPC API

You can configure TLS for the GRPC API server. Set `grpc_api.tls` which is a [TLSConfig](#unified-tls-config-object).

### TLS for GRPC unidirectional stream

You can configure TLS for the GRPC unidirectional stream endpoint. Set `uni_grpc.tls` which is a [TLSConfig](#unified-tls-config-object).

### Unified TLS config object

Centrifugo v5 started a migration to a new unified way to configure TLS for all parts of Centrifugo. Some reasoning may be found in [this issue on GitHub](https://github.com/centrifugal/centrifugo/issues/831).

:::tip

As of Centrifugo v6 this unified TLS configuration object is used consistently across all parts of Centrifugo that support TLS (HTTP server, GRPC API, uni-GRPC, proxies, NATS, PostgreSQL, Kafka, etc.).

:::

New TLS config is an object that has the following structure.

#### TLSConfig

| Option Name           | Type    | Description                                                                                          |
|-----------------------|---------|------------------------------------------------------------------------------------------------------|
| `enabled`             | bool    | Turns on using TLS.                                                                                  |
| `cert_pem`            | string  | Certificate in PEM format. May be a raw PEM string, base64-encoded PEM, or a path to a PEM file.    |
| `key_pem`             | string  | Private key in PEM format. May be a raw PEM string, base64-encoded PEM, or a path to a PEM file.    |
| `server_ca_pem`       | string  | Server root CA in PEM format used by the client to verify the server's certificate during handshake. Raw PEM, base64 PEM, or file path. |
| `client_ca_pem`       | string  | Client CA in PEM format used by the server to verify client certificates (enables mutual TLS). Raw PEM, base64 PEM, or file path. |
| `insecure_skip_verify`| bool    | Turns off server certificate verification.                                                           |
| `server_name`         | string  | Used to verify the hostname on the returned certificates.                                            |

- **Flexible source:** Each PEM field (`cert_pem`, `key_pem`, `server_ca_pem`, `client_ca_pem`) accepts its value in any of three forms, auto-detected in this order: 1) raw PEM content, 2) base64-encoded PEM, 3) a path to a PEM file.
- **Server and Client CA:** `server_ca_pem` and `client_ca_pem` are used for verifying the server and client certificates respectively during the TLS handshake.
- **Insecure Option:** The `insecure_skip_verify` option can be used to turn off server certificate verification, which is not recommended for production environments.
- **Hostname Verification:** The `server_name` is utilized to verify the hostname on the returned certificates, providing an additional layer of security.

So in the configuration the usage of new TLS config may be like this:

```json title="config.json"
{
  "unified_proxy": {
    "grpc": {
      "tls": {
        "enabled": true,
        "cert_pem": "/path/to/cert.pem",
        "key_pem": "/path/to/key.pem"
      }
    }
  }
}
```
