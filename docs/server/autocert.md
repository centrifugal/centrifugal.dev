---
id: autocert
title: Automatic Let's Encrypt TLS
---

Centrifugo supports certificate loading and renewal from Let's Encrypt using ACME protocol.

:::tip

In most situations you better put TLS termination task on your reverse proxy/load balancing software such as Nginx. This can be a good thing for performance.

:::

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
