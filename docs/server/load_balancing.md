---
description: "Load balancing Centrifugo with Nginx. Sample configurations for WebSocket proxy on a separate domain or embedded location with connection upgrades."
id: load_balancing
title: Load balancing
---

This chapter shows how to deal with persistent connection load balancing.

:::caution

Regardless which reverse proxy / load balancer you are using make sure that you tuned open file limit for its process too since it will also need to handle many persistent connections. See [Infrastructure tuning](./infra_tuning.md).

:::

## Nginx configuration

Although it's possible to use Centrifugo without any reverse proxy before it,
it's still a good idea to keep Centrifugo behind mature reverse proxy to deal with
edge cases when handling HTTP/Websocket connections from the wild. Also you probably
want some sort of load balancing eventually between Centrifugo nodes so that proxy
can be such a balancer too.

In this section we will look at [Nginx](http://nginx.org/) configuration to deploy Centrifugo.

Minimal Nginx version – **1.3.13** because it was the first version that can proxy
Websocket connections.

There are 2 ways: running Centrifugo server as separate service on its own
domain or embed it to a location of your website (for example to `/centrifugo`).

### Separate domain for Centrifugo

```
upstream centrifugo {
    server 127.0.0.1:8000;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

#server {
#	listen 80;
#	server_name centrifugo.example.com;
#	rewrite ^(.*) https://$server_name$1 permanent;
#}

server {
    server_name centrifugo.example.com;

    listen 80;

    #listen 443 ssl;
    #ssl_protocols TLSv1.2;
    #ssl_certificate /etc/nginx/ssl/server.crt;
    #ssl_certificate_key /etc/nginx/ssl/server.key;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Only retry if there was a communication error, not a timeout
    # on the Centrifugo server (to avoid propagating "queries of death"
    # to all frontends)
    proxy_next_upstream error;

    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Scheme $scheme;
    proxy_set_header Host $http_host;

    location /connection {
        proxy_pass http://centrifugo;
        proxy_buffering off;
        keepalive_timeout 65;
        proxy_read_timeout 60s;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Scheme $scheme;
        proxy_set_header Host $http_host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
    
    location / {
        proxy_pass http://centrifugo;
    }

    error_page   500 502 503 504  /50x.html;

    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}
```

### Embed to a location of web site

```
upstream centrifugo {
    server 127.0.0.1:8000;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {

    # ... your web site Nginx config

    location /centrifugo/ {
        rewrite ^/centrifugo/(.*)        /$1 break;
        proxy_pass http://centrifugo;
        proxy_pass_header Server;
        proxy_set_header Host $http_host;
        proxy_redirect off;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Scheme $scheme;
    }

    location /centrifugo/connection {
        rewrite ^/centrifugo(.*)        $1 break;
        proxy_pass http://centrifugo;
        proxy_buffering off;
        keepalive_timeout 65;
        proxy_read_timeout 60s;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Scheme $scheme;
        proxy_set_header Host $http_host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}
```

### worker_connections

You may also need to update `worker_connections` option of Nginx:

```
events {
    worker_connections 65535;
}
```
