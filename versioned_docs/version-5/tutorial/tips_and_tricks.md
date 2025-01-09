---
id: tips_and_tricks
sidebar_label: "Appx #2: tips and tricks"
title: "Appendix #2: Tips and tricks"
---

Making this tutorial took quite a lot of time for us. We want to collect some useful tips and tricks here for those who decide to play with the final example. Feel free to contribute if you find something which could help others.

## Point to Centrifugo running on host (outside Docker)

We did this ourselves while experimenting and measuring latency numbers in different scenarios. If you want to run the example, but need to point backend or Nginx to look at Centrifugo on your machine outside Docker, then you can use:

* On Linux run `ifconfig` and find `docker0` interface – use its ip address to point to Centrifugo. In our case it was `172.17.0.1`, so we pointed Nginx to `172.17.0.1:8000` upstream (Centrifugo runs on port 8000 by default), and in Django code used `http://172.17.0.1:8000/api/broadcast` endpoint. Also, make sure you are using `"address": "0.0.0.0"` in Centrifugo configuration
* On Macos – use `host.docker.internal` special name, i.e. `host.docker.internal:8000` in Nginx and `http://host.docker.internal:8000/api/broadcast` as API endpoint for Django code.

## Connect to PosgreSQL

Run from within example repo root:

```bash
docker compose exec db psql postgresql://grandchat:grandchat@localhost:5432/grandchat
```

## Inspect dockerized Kafka state

List current Kafka topics (run from within example repo root):

```bash
docker compose exec kafka kafka-topics --bootstrap-server kafka:9092 --list
```

Describe the state of Kafka topic:

```bash
docker compose exec kafka kafka-topics --bootstrap-server kafka:9092 --describe --topic postgres.public.chat_cdc
```

Show state of consumer group – partitions, lag, offsets (`centrifugo` is a name of consumer group in our case):

```bash
docker compose exec kafka kafka-consumer-groups --bootstrap-server kafka:9092 --describe --group centrifugo
```

Tail new messages in topic:

```bash
docker compose exec kafka kafka-console-consumer --bootstrap-server kafka:9092 --topic postgres.public.chat_cdc
```

## Pause Kafka Connect

Or any other service in Docker compose when you need to test failure scenarios (use name of service from `docker-compose.yml`):

```bash
docker compose pause connect
```

To run again:

```bash
docker compose unpause connect
```
