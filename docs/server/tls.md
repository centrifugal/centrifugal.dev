---
description: "Configure TLS for Centrifugo using certificate files or automatic Let's Encrypt certificates. Includes unified TLS config for GRPC and all endpoints."
id: tls
title: Configure TLS
---

TLS/SSL layer is very important not only for securing your connections but also to increase a
chance to establish Websocket connection.

:::tip

In most situations you better put TLS termination task on your reverse proxy/load balancing software such as Nginx. This can be a good thing for performance.

:::

There are situations though when you want to serve secure connections by Centrifugo itself.

There are two ways to do this: using TLS certificate `cert` and `key` files that you've got
from your CA provider or using automatic certificate handling via [ACME](https://datatracker.ietf.org/doc/html/rfc8555) provider (only [Let's Encrypt](https://letsencrypt.org/) at this moment).

### Using crt and key files

In first way you already have `cert` and `key` files. For development you can create self-signed
certificate - see [this instruction](https://devcenter.heroku.com/articles/ssl-certificate-self) as
example.

```json title="config.json"
{
  "tls": {
    "enabled": true,
    "key_pem_file": "server.key",
    "cert_pem_file": "server.crt"
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
    "host_whitelist": "www.example.com",
    "cache_dir": "/tmp/certs",
    "email": "user@example.com",
    "http": true,
    "http_addr": ":80"
  }
}
```

`tls_autocert.enabled` (boolean) says Centrifugo that you want automatic certificate handling using ACME provider.

`tls_autocert.host_whitelist` (string) is a string with your app domain address. This can be comma-separated
list. It's optional but recommended for extra security.

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

You can configure TLS for GRPC API server. Set `grpc_api.tls` objects which is a [TLSConfig](#unified-tls-config-object).

### TLS for GRPC unidirectional stream

You can configure TLS for GRPC unidirectional stream endpoint. Set `uni_grpc.tls` objects which is a [TLSConfig](#unified-tls-config-object).

### Unified TLS config object

Centrifugo v5 started a migration to a new unified way to configure TLS for all parts of Centrifugo. Some reasoning may be found in [this issue on GitHub](https://github.com/centrifugal/centrifugo/issues/831).

:::caution

At this point we use a unified TLS configuration object only for some parts of Centrifugo, but planning to extend this to all TLS configurations in Centrifugo v6. We explicitly point to this config in feature descriptions at this stage. 

:::

New TLS config is an object that has the following structure.

#### TLSConfig

| Option Name           | Type    | Description                                                                                          |
|-----------------------|---------|------------------------------------------------------------------------------------------------------|
| `enabled`             | bool    | Turns on using TLS.                                                                                  |
| `cert_pem`            | string  | Certificate in PEM format.                                                                           |
| `cert_pem_b64`        | string  | Certificate in base64 encoded PEM format.                                                            |
| `cert_pem_file`       | string  | Path to a file with certificate in PEM format.                                                       |
| `key_pem`             | string  | Key in PEM format.                                                                                   |
| `key_pem_b64`         | string  | Key in base64 encoded PEM format.                                                                    |
| `key_pem_file`        | string  | Path to a file with key in PEM format.                                                               |
| `server_ca_pem`       | string  | Server root CA certificate in PEM format used by client to verify server's certificate during handshake. |
| `server_ca_pem_b64`   | string  | Server root CA certificate in base64 encoded PEM format.                                             |
| `server_ca_pem_file`  | string  | Path to a file with server root CA certificate in PEM format.                                        |
| `client_ca_pem`       | string  | Client CA certificate in PEM format used by server to verify client's certificate during handshake.  |
| `client_ca_pem_b64`   | string  | Client CA certificate in base64 encoded PEM format.                                                  |
| `client_ca_pem_file`  | string  | Path to a file with client CA certificate in PEM format.                                             |
| `insecure_skip_verify`| bool    | Turns off server certificate verification.                                                           |
| `server_name`         | string  | Used to verify the hostname on the returned certificates.                                            |

- **Source Priority:** The configuration allows specifying TLS settings from multiple sources: file, base64 encoded PEM, and raw PEM. The sources are prioritized in the following order:
  1. File to PEM
  2. Base64 encoded PEM
  3. Raw PEM
- **Single Source Usage:** Users should ensure that only one source of configured values is used. For example, if both `cert_pem_file` and `cert_pem` are set, the file source (`cert_pem_file`) will be used, and the raw PEM (`cert_pem`) will be ignored.
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
        "cert_pem_file": "/path/to/cert.pem",
        "key_pem_file": "/path/to/key.pem"
      }
    }
  }
}
```
