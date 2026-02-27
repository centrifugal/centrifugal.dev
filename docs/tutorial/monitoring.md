---
description: "Add Prometheus and Grafana monitoring to your Centrifugo-powered app using Docker Compose with the official Centrifugo Grafana dashboard."
id: monitoring
sidebar_label: "Appx #3: Prometheus and Grafana"
title: "Appendix #3: Adding Prometheus and Grafana"
---

Let's move a bit further and show how to add Centrifugo monitoring to our messenger application. We will use Prometheus and Grafana for this.

## Prometheus

[Prometheus](https://prometheus.io/) is a popular monitoring system and time series database. It collects metrics from monitored targets by scraping metrics HTTP endpoints. Centrifugo has built-in support for Prometheus metrics.

The first step would be adding Prometheus service to our `docker-compose.yml` file. We will use the official Prometheus Docker image. Here is how the service definition looks like:

```yaml title="docker-compose.yml"
  prometheus:
    image: prom/prometheus:v3.0.1
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
    ports:
      - 9090:9090
```

We also need to create a `prometheus.yml` file in the root of our project. Here is how it looks like:

```yaml title="prometheus/prometheus.yml"
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: 'centrifugo'
    static_configs:
      - targets: ['centrifugo:8000']
```

This configuration tells Prometheus to scrape metrics from Centrifugo container every 5 seconds.

In Centrifugo configuration we also need to enable Prometheus metrics endpoint. Here is how it looks like:

```json title="config.json"
{
    ...
    "prometheus": {
        "enabled": true
    }
}
```

Now once you start the app with `docker compose up` you can open Prometheus UI at [http://localhost:9090](http://localhost:9090) and see Centrifugo metrics.

## Grafana

Many users prefer to use [Grafana](https://grafana.com/) for visualizing metrics collected by Prometheus. Let's add Grafana service to our `docker-compose.yml` file. We will use the official Grafana Docker image. Here is how the service definition looks like:

```yaml title="docker-compose.yml"
  grafana:
    image: grafana/grafana-oss:11.4.0
    depends_on:
      - prometheus
    # Expose Grafana on host port 3000
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      # Mount local provisioning directory to automatically configure Prometheus as a datasource
      - ./grafana/provisioning:/etc/grafana/provisioning
      - grafana-data:/var/lib/grafana
```

We also need to create a `datasource.yml` file in the `grafana/provisioning/datasources` directory. Here is how it looks like:

```yaml title="grafana/provisioning/datasources/datasource.yml"
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    access: proxy
    isDefault: true
```

This configuration tells Grafana to use Prometheus as a default datasource.

Now once you start the app with `docker compose up` you can open Grafana UI at [http://localhost:3000](http://localhost:3000) and login with `admin`/`admin` credentials.

Then you can simply import Centrifugo [official Grafana dashboard](https://grafana.com/grafana/dashboards/13039). To import a dashboard in Grafana go to http://localhost:3000/dashboards, click on the `New` button in the top-right corner and select `Import`. Then you need to put the dashboard ID (`13039`) into the form and click `Load`. After that **select Prometheus as a datasource** for the dashboard and click `Import`. And enjoy visualized metrics:

![](/img/grafana.jpg)

That's it! Now you have Centrifugo metrics visualized in the application. You can even use Grafana alerting feature to notify you over tons of supported communication channels (Slack, email, and so on) in case of metric changes.

## We did it again

Here we showed how to add Prometheus and Grafana to our messenger application to monitor Centrifugo metrics.

In real-world applications the way of Prometheus and Grafana setup can be different, but the core idea is the same. For example, in Kubernetes you can use Helm charts to deploy Prometheus and Grafana stack and use k8s service discovery to find Centrifugo instances.

For the convenience we've included Prometheus and Grafana support to [the source code](https://github.com/centrifugal/grand-chat-tutorial) of our tutorial, so it works out of the box, but you need to import Grafana dashboard manually in a way described above.
