---
description: "Load balancing Centrifugo behind a reverse proxy: nginx, HAProxy, Envoy, Caddy and Traefik configs for WebSocket, HTTP-streaming and SSE, plus the bidirectional emulation endpoint and idle-timeout tuning."
id: load_balancing
title: Load balancing and proxying
---

This chapter shows how to run Centrifugo behind a reverse proxy / load balancer —
which almost every production deployment does, both to terminate TLS and to
spread persistent connections across several Centrifugo nodes.

All the configurations shown here are **tested end to end in Docker** — see the
[`proxy_load_balancing` example](https://github.com/centrifugal/examples/tree/master/v6/proxy_load_balancing),
which stands up two Centrifugo nodes behind each of these proxies and verifies
every transport (WebSocket, HTTP-streaming and SSE, over both plaintext and TLS)
with a real `centrifuge-js` client.

:::caution

Regardless of which reverse proxy / load balancer you use, make sure you have
tuned the open file limit for its process too, since it will also handle many
persistent connections. See [Infrastructure tuning](./infra_tuning.md).

:::

## What a proxy must get right

Centrifugo's client transports are all HTTP/TCP-based, but they are **persistent,
low-latency, streaming** connections — not the short request/response cycles most
proxies are tuned for by default. There are four things a proxy in front of
Centrifugo must handle correctly:

1. **WebSocket upgrade** — pass the `Upgrade` and `Connection` headers and use
   HTTP/1.1 upstream so the connection can switch protocols.
2. **No response buffering** — for [SSE](../transports/sse.md) and
   [HTTP-streaming](../transports/http_stream.md) the server pushes data on a
   long-lived response. If the proxy buffers the response body, messages only
   reach the client when the connection closes. Buffering must be **off** for the
   connection endpoints.
3. **The `/emulation` endpoint** — SSE and HTTP-streaming send client→server
   commands as separate `POST /emulation` requests (see
   [below](#bidirectional-emulation-and-load-balancing)). The proxy must forward
   this endpoint to Centrifugo like any normal POST.
4. **Idle timeouts above the ping interval** — a proxy drops connections it
   considers idle. Centrifugo pings each client periodically (every 25s by
   default), which keeps the connection active — so the proxy's read/idle timeout
   must stay comfortably **above** that interval.

:::note Using a plain TCP (L4) load balancer?

If your load balancer operates at layer 4 (TCP passthrough) — for example AWS
NLB, HAProxy in `mode tcp`, nginx `stream {}`, or a plain Kubernetes `Service` —
it forwards raw bytes and none of the four requirements above apply: upgrades,
streaming and buffering are handled transparently. The only thing to tune is the
**TCP idle timeout** (keep it above the ping interval). The rest of this chapter
is about L7 (HTTP-terminating) proxies, where configuration actually matters.

:::

## Bidirectional emulation and load balancing

WebSocket is naturally bidirectional, so it is a single connection the load
balancer handles like any other upgraded HTTP connection.

SSE and HTTP-streaming are **one-way** (server→client). To provide bidirectional
behaviour, Centrifugo uses a [bidirectional emulation layer](https://centrifugal.dev/blog/2022/07/19/centrifugo-v4-released#modern-websocket-emulation-in-javascript):
the client opens the long-lived stream, and sends its commands (connect,
subscribe, RPC, …) as separate `POST` requests to the `/emulation` endpoint.

This has an important and convenient consequence for load balancing:

:::tip No sticky sessions required

The `/emulation` POST can be routed to **any** Centrifugo node — not necessarily
the one holding the client's stream. Centrifugo forwards the command to the node
that owns the session internally (via the broker). So you do **not** need sticky
sessions / session affinity for SSE or HTTP-streaming behind a multi-node
Centrifugo cluster. Plain round-robin is fine.

:::

Make sure the `/emulation` endpoint is reachable through your proxy (it lives at
`/emulation` by default; the prefix is configurable — see
[customizing handler prefixes](./configuration.md#customize-handler-prefixes)).

:::caution Keep proxy timeouts above the ping interval

A reverse proxy or cloud load balancer drops connections it considers idle.
Centrifugo sends a ping to each client periodically (every 25 seconds by
default), which counts as activity and keeps the connection alive — so the
proxy's read/idle timeout must stay comfortably **above** that interval. If you
increase Centrifugo's `client.ping_interval`, raise the proxy timeout to match.
The same rule applies to cloud L4/L7 load balancers (for example, the AWS ALB
idle timeout).

:::

:::note Scaling to many connections

Each config below includes the per-proxy knob needed to hold many connections
(commented inline). Two things apply to **all** proxies: raise the process
**file-descriptor limit** — each connection costs 2 fds (client + upstream), so
set `nofile` well above `2 × connections` via Docker `ulimits`, systemd
`LimitNOFILE=`, or `/etc/security/limits.conf` — and remember Centrifugo itself
needs a high limit too (see [Infrastructure tuning](./infra_tuning.md)). The
[`proxy_load_balancing` example](https://github.com/centrifugal/examples/tree/master/v6/proxy_load_balancing)
verifies each proxy below holding **10,000** connections across two nodes.

:::

## Nginx

Any reasonably modern Nginx works — WebSocket proxying has been supported since
version **1.3.13** (2013). The key directives are the `$connection_upgrade` map,
`proxy_http_version 1.1`, `proxy_buffering off` on the connection endpoints, and
`proxy_read_timeout` above the ping interval.

### Load balancing several Centrifugo nodes

```nginx
# --- top-level nginx.conf (outside the http {} block) ---
# Connection scaling: raise the process fd ceiling and per-worker connection
# count. Each proxied client uses 2 fds (downstream client + upstream).
worker_rlimit_nofile 1048576;
events {
    worker_connections 65535;
}

# --- inside the http {} block ---
upstream centrifugo {
    server 127.0.0.1:8000;
    server 127.0.0.1:8001;
    # Default round-robin. No sticky sessions needed (see emulation note above).
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name centrifugo.example.com;

    #listen 443 ssl;
    #ssl_certificate     /etc/nginx/ssl/server.crt;
    #ssl_certificate_key /etc/nginx/ssl/server.key;

    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Real-time connection endpoints: WebSocket, SSE, HTTP-streaming.
    location /connection/ {
        proxy_pass http://centrifugo;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # Do not buffer the server->client stream (critical for SSE / streaming).
        proxy_buffering off;

        # Keep above client.ping_interval.
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Everything else, including the /emulation endpoint used by SSE / streaming.
    location / {
        proxy_pass http://centrifugo;
    }
}
```

For a single node just use one `server` entry in the `upstream` block.

### Embed at a location of your website

If you serve Centrifugo under a path prefix (for example `/centrifugo`):

```nginx
location /centrifugo/ {
    rewrite ^/centrifugo/(.*)  /$1 break;
    proxy_pass http://centrifugo;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $http_host;
    proxy_buffering off;
    proxy_read_timeout 60s;
}
```

Note this rewrites both `/centrifugo/connection/...` and `/centrifugo/emulation`
back to Centrifugo's own paths. Alternatively, configure matching
[handler prefixes](./configuration.md#customize-handler-prefixes) in Centrifugo
so no rewrite is needed.

## HAProxy

In `mode http` HAProxy detects and tunnels WebSocket upgrades automatically. The
important knobs are the timeouts (`tunnel` for upgraded WebSocket connections,
`server`/`client` for streaming) and `option http-no-delay` for low latency.

```
global
    # For many connections: HAProxy sizes its own fd limit from maxconn. Back it
    # with a high process nofile limit.
    maxconn 200000

defaults
    mode http
    option http-no-delay
    maxconn 200000
    timeout connect 5s
    timeout client  1h
    timeout server  1h
    timeout tunnel  1h          # established WebSocket connections
    timeout http-keep-alive 10s

frontend fe
    bind :80
    #bind :443 ssl crt /etc/haproxy/certs/server.pem
    default_backend be_centrifugo

backend be_centrifugo
    balance roundrobin
    server c1 127.0.0.1:8000
    server c2 127.0.0.1:8001
```

For TLS, HAProxy expects the certificate and key concatenated into a single PEM
file (`cat server.crt server.key > server.pem`).

## Envoy

Envoy streams responses by default, so no buffering flag is needed. You must
enable WebSocket upgrades and disable the per-route timeout (the default 15s
route timeout would otherwise cut long-lived streams).

```yaml
static_resources:
  listeners:
    - name: http
      address: { socket_address: { address: 0.0.0.0, port_value: 80 } }
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_http
                stream_idle_timeout: 0s          # do not cut idle streams
                upgrade_configs:
                  - upgrade_type: websocket      # allow WebSocket upgrades
                route_config:
                  name: local_route
                  virtual_hosts:
                    - name: centrifugo
                      domains: ["*"]
                      routes:
                        - match: { prefix: "/" }
                          route:
                            cluster: centrifugo
                            timeout: 0s          # disable per-route timeout
                http_filters:
                  - name: envoy.filters.http.router
                    typed_config:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
  clusters:
    - name: centrifugo
      connect_timeout: 5s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      # For many connections: Envoy's per-cluster circuit breakers default to
      # 1024 (max_connections, max_pending_requests, max_requests; max_retries is
      # 3), and each WebSocket/streaming request is one active upstream request -
      # without raising these Envoy silently caps at ~1024 connections.
      circuit_breakers:
        thresholds:
          - priority: DEFAULT
            max_connections: 1000000
            max_pending_requests: 1000000
            max_requests: 1000000
            max_retries: 1000000
      load_assignment:
        cluster_name: centrifugo
        endpoints:
          - lb_endpoints:
              - endpoint: { address: { socket_address: { address: centrifugo-1, port_value: 8000 } } }
              - endpoint: { address: { socket_address: { address: centrifugo-2, port_value: 8000 } } }
```

## Caddy

Caddy's `reverse_proxy` handles WebSocket upgrades transparently and flushes
streaming responses. Use `flush_interval -1` to flush every write immediately for
SSE / HTTP-streaming, and `lb_policy` for balancing.

```
example.com {
    reverse_proxy centrifugo-1:8000 centrifugo-2:8000 {
        lb_policy round_robin
        flush_interval -1
    }
}
```

Caddy obtains and renews TLS certificates automatically, so the same block gives
you HTTPS/WSS with no extra configuration. It has no connection cap to configure —
it's bounded only by the OS `nofile` limit (Caddy logs a warning if that limit is
too low, but does not raise it for you).

## Traefik

With the file provider, Traefik handles WebSocket upgrades automatically. Use a
small `flushInterval` on the service so SSE / HTTP-streaming stays low-latency.

```yaml
# dynamic config
http:
  routers:
    centrifugo:
      rule: "PathPrefix(`/`)"
      entryPoints: ["web"]     # or websecure for TLS
      service: centrifugo
  services:
    centrifugo:
      loadBalancer:
        responseForwarding:
          flushInterval: "10ms"
        servers:
          - url: "http://centrifugo-1:8000"
          - url: "http://centrifugo-2:8000"
```

Traefik has no connection cap to configure — it's bounded only by the OS
`nofile` limit.

## TLS termination

In all the examples above TLS is terminated at the proxy, and the proxy talks
plain HTTP to Centrifugo over a trusted internal network — this is the most
common and simplest setup. Clients connect with `wss://` / `https://`; nothing
changes on the Centrifugo side. If you instead want Centrifugo to terminate TLS
itself, see [TLS configuration](./tls.md).

## The tested example

Every configuration on this page is taken from the runnable
[`proxy_load_balancing` example](https://github.com/centrifugal/examples/tree/master/v6/proxy_load_balancing),
which is also a good way to sanity-check a proxy configuration before shipping
it. It runs entirely in `docker compose` (a single `./run.sh`).

**What it covers:** all five proxies above (nginx, HAProxy, Envoy, Traefik,
Caddy), each in front of a **two-node** Centrifugo cluster with no sticky
sessions, exercised by a real `centrifuge-js` client over **WebSocket,
HTTP-streaming and SSE**, on both **plaintext and TLS**.

**What it proves** — the things that actually break in production:

- messages are delivered **promptly** (catching a buffering proxy — "the
  connection opens fine" is not enough, a buffering proxy only flushes at close);
- idle connections **survive** with only pings flowing (catching a read/idle
  timeout set below the ping interval);
- the `/emulation` POST is routed correctly even when it lands on a **different
  node** than the stream;
- a publication **fans out across both nodes** — many connections spread over the
  cluster all receive every message (no sticky sessions needed);
- each proxy holds **10,000** concurrent connections with the scaling settings
  shown above.
