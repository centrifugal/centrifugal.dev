---
id: reverse_proxy
sidebar_label: "Adding reverse proxy"
title: "Adding Nginx as a reverse proxy"
---

As mentioned we are building single-page frontend application here. The frontend will be fully decoupled from the backend. This is actually quite nice because Centrifugo users may theoretically swap only backend or only frontend parts when trying to follow this tutorial – for example, keep frontend part but try to implement the backend in Laravel or Rails, or with sth else.

For general user authentication we will be using native Django session authentication, which is based on cookies. For the best in class security we will use HTTP-only cookies. To make such a setup work with SPA frontend we should serve the frontend and the backed from the same domain.

BTW, if you are interested in more details check out this awesome tutorial: [Django Session-based Auth for Single Page Apps](https://testdriven.io/blog/django-spa-auth/). It contains a detailed description of the approach we use here together with other options to configure Django in SPA scenarios.

It's possible to use any reverse proxy, but we will go with Nginx here as one of the most popular servers in the world. Here is a configuration for Nginx placed into `nginx/nginx.conf` file:

```conf title="nginx/nginx.conf"
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
  worker_connections 1024;
}

http {
  upstream backend {
    server backend:8000;
  }

  upstream frontend {
    server frontend:5173;
  }

  upstream centrifugo {
    server centrifugo:8000;
  }

  server {
    listen 80;

    server_name localhost 127.0.0.1;

    location /api {
      proxy_pass          http://backend;
      proxy_http_version  1.1;
      proxy_redirect      default;
      proxy_set_header    Upgrade $http_upgrade;
      proxy_set_header    Connection "upgrade";
      proxy_set_header    Host $host;
      proxy_set_header    X-Real-IP $remote_addr;
      proxy_set_header    X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Host $server_name;
    }

    location /admin {
      proxy_pass          http://backend;
      proxy_http_version  1.1;
      proxy_redirect      default;
      proxy_set_header    Upgrade $http_upgrade;
      proxy_set_header    Connection "upgrade";
      proxy_set_header    Host $host;
      proxy_set_header    X-Real-IP $remote_addr;
      proxy_set_header    X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Host $server_name;
    }

    location /static {
      proxy_pass          http://backend;
      proxy_set_header    Host $host;
      proxy_http_version  1.1;
      proxy_redirect      default;
    }

    location /connection/websocket {
      proxy_pass          http://centrifugo;
      proxy_http_version  1.1;
      proxy_redirect      default;
      proxy_set_header    Upgrade $http_upgrade;
      proxy_set_header    Connection "upgrade";
      proxy_set_header    Host $host;
      proxy_set_header    X-Real-IP $remote_addr;
      proxy_set_header    X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Host $server_name;
    }

    location / {
      proxy_pass          http://frontend;
      proxy_http_version  1.1;
      proxy_redirect      default;
      proxy_set_header    Upgrade $http_upgrade;
      proxy_set_header    Connection "upgrade";
      proxy_set_header    Host $host;
      proxy_set_header    X-Real-IP $remote_addr;
      proxy_set_header    X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header    X-Forwarded-Host $server_name;
    }
  }
}
```

And add Nginx to `docker-compose.yaml` file:

```yaml
nginx:
  image: nginx:1.25
  volumes:
    - ./nginx:/etc/nginx/
  ports:
    - 9000:80
  depends_on:
    - backend
```

As you may noticed we added several locations to Nginx:

* `/api` - this is an entrypoint for backend REST API. We will implement it shortly.
* `/admin` - serves Django built-in admin web UI, it will allow us to create some rooms to interact with
* `/static` - to serve Django admin static files
* `/connection/websocket` - this is a proxy to Centrifugo service, we will setup Centrifugo later in this tutorial
* `/` – and finally root path serves the frontend app, we will be creating it soon too.
