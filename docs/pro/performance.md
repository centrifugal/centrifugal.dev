---
description: "Centrifugo PRO delivers faster HTTP/GRPC API, faster broadcast and batch publishing, optimized proxy, faster JWT decoding, and WebSocket compression improvements to reduce CPU and latency."
id: performance
title: Faster performance
---

<img src="/img/logo_animated_fast.svg" width="100px" height="100px" align="left" style={{'marginRight': '10px', 'float': 'left'}} />

Centrifugo PRO has performance improvements for several server parts. These improvements can help to reduce tail end-to-end latencies in the application, increase server throughput and/or reduce CPU usage on server machines. Our open-source version has a decent performance by itself, with PRO improvements Centrifugo steps even further.

## Faster connections runtime

:::tip

The [Tuning Centrifugo PRO for large number of idle WebSocket connections](/blog/2026/08/17/tuning-idle-connections) blog post measures the options below on a single node — it starts at 200k idle connections and ends up holding a million on the same machine.

:::

### client.batch_periodic_events

New in Centrifugo v6.2.0

EXPERIMENTAL option on `client` level is `client.batch_periodic_events` (boolean, by default, `false`). To enable:

```json title="config.json"
{
  "client": {
    "batch_periodic_events": true
  }
}
```

Once enabled, Centrifugo will batch client connection periodic events such as ping and presence updates together instead of having them work in an isolated way. This may result in noticeable CPU savings when working with many mostly idle connections.

In our local experiments we observed more than 2x CPU reduction for 10k mostly idle connections setup (only PING/PONG messages are being sent). First image is OSS CPU utilization, second one is PRO with periodic events batching enabled:

import useBaseUrl from '@docusaurus/useBaseUrl';

<div style={{
  display: 'flex',
  flexWrap: 'wrap',
}}>
  <img
    src={useBaseUrl('/img/cpu_idle_oss.jpg')}
    alt="OSS"
    style={{ width: '50%', objectFit: 'contain' }}
  />
  <img
    src={useBaseUrl('/img/cpu_idle_pro.jpg')}
    alt="Pro"
    style={{ width: '50%', objectFit: 'contain' }}
  />
</div>

Of course the ratio is highly dependent on the Centrifugo-specific setup load profile and usage scenarios.

### websocket.process_commands_off_read_loop

New in Centrifugo v6.9.2

Another option which helps to hold large pools of mostly idle WebSocket connections is `websocket.process_commands_off_read_loop` (boolean, by default `false`):

```json title="config.json"
{
  "websocket": {
    "process_commands_off_read_loop": true
  }
}
```

A WebSocket connection processes each incoming command on its read loop goroutine, and that goroutine's stack grows to the deepest call it ever makes (even just the initial `connect`) and is never given back while the connection lives. When this option is enabled, each command is processed on a short-lived goroutine instead, so the read loop itself stays shallow — the deep stack returns to the Go runtime's stack pool and is reused by the next connection that needs it, rather than being pinned to a connection that then spends its life idle. This roughly halves the read goroutine's stack (around 4 KB less per connection).

The option is off by default and adds a small per-command latency that becomes negligible once many connections are active, so it's most useful for large pools of mostly idle connections.

## Faster HTTP API

Centrifugo PRO decodes HTTP API requests and encodes responses with faster JSON libraries – 2-4 times faster than the standard ones Centrifugo OSS uses.

How much this saves depends on how much JSON a request carries. For small requests, like a single publication, the difference is not noticeable: JSON is a tiny part of the work Centrifugo does for such a request. The gain shows for requests and responses with a lot of data. In our measurements of the same server with the two JSON implementations:

* a `history` request returning 100 publications took 40% less CPU, and the server handled 1.3 times more such requests per second
* a `batch` of 100 `publish` commands took 15% less CPU
* a `broadcast` into 1000 channels took 10% less CPU

## Faster GRPC API

Centrifugo PRO encodes and decodes GRPC API messages with generated code which is about 2 times faster than the default Protobuf implementation. As with the HTTP API, the effect grows with the size of messages and is small for small ones.

## Faster publishing

New in Centrifugo PRO v6.9.7

Centrifugo PRO sends publications to the broker in groups instead of one by one: single publications arriving under load are sent together, and the publications of a [`broadcast`](../server/server_api.md#broadcast) or [`batch`](../server/server_api.md#batch) call are handed to the broker together. With Redis and Memory engines, a broadcast also does not start a separate goroutine for each channel. See [Grouped publications](./server_api_enhancements.md#grouped-publications) for how it works, what it changes for applications, and the options.

Depending on the load profile, this may give:

* lower CPU usage of Centrifugo
* lower CPU usage of Redis and less traffic between Centrifugo and Redis
* lower latency of batch requests with many publish commands (with Redis)
* lower memory usage and fewer goroutines during large broadcasts
* higher throughput of single publications under heavy load

The effect is larger when a call carries many publications, and for single publications it grows with load. It also depends on the broker setup – for example, with Redis Cluster without sharded PUB/SUB the gain is smaller, since publications to different channels can not share one Redis call. Under load, a single publication may wait a little for others, which adds up to 250 microseconds to its latency; the latency of a broadcast with history may also increase slightly, since one broker call carrying many channels takes Redis longer than a single publish.

## Faster HTTP proxy

Centrifugo PRO encodes proxy requests and decodes proxy responses with faster JSON libraries, about 2 times faster than the standard ones. The saving is small compared to the cost of the HTTP call to your backend.

### Faster HTTP proxy client

Centrifugo PRO adds a boolean option `use_fast_client` which enables using a fast optimized HTTP client for proxy requests. In our benchmark of connect proxy calls it made about 10 times fewer memory allocations per call and took about 20% less time per call. Fewer allocations mean less CPU spent on garbage collection under load; how much faster calls get depends on your backend.

The option may be defined inside `http` section of proxy object. For example, to enable it for a connect proxy:

```json title="config.json"
{
  "client": {
    "proxy": {
      "connect": {
        "enabled": true,
        "endpoint": "https://your_backend/centrifugo/connect",
        "http": {
          "use_fast_client": true
        }
      }
    }
  }
}
```

This is a separate option because the optimized version only supports HTTP 1.1, so we try to avoid unexpected side effects when migrating from Centrifugo OSS to Centrifugo PRO.

## Faster GRPC proxy

Centrifugo PRO encodes and decodes GRPC proxy messages with the same faster Protobuf code as the GRPC API. The saving is small compared to the cost of the call to your backend.

## Faster async consumers

When asynchronous consumers are used and the payload represents an encoded request type, Centrifugo PRO decodes it with a faster JSON library. As with the HTTP API, this matters for large payloads and is not noticeable for small ones.

## Faster JWT decoding

Centrifugo PRO decodes JWT claims with a faster JSON library.

## Faster GRPC unidirectional stream

Centrifugo PRO decodes the connect command of a GRPC unidirectional stream with faster Protobuf code. This only affects the initial connect command.

## WebSocket compression optimizations

Centrifugo PRO provides an integer option `websocket.compression_prepared_message_cache_size` (in bytes, default `0`) which when set to a value > 0 tells Centrifugo to use a cache or prepared websocket messages when working with connections with WebSocket compression negotiated.

```json title="config.json"
{
  "websocket": {
    "compression_prepared_message_cache_size": 10485760
  }
}
```

This can significantly improve CPU and memory Centrifugo resource usage when using [WebSocket compression feature](../transports/websocket.md#websocketcompression).

Check out blog post [Performance optimizations of WebSocket compression in Go application](/blog/2024/08/19/optimizing-websocket-compression) which describes the possible effect of this optimization.

## Other optimizations

Centrifugo PRO also provides other optimizations which can significantly affect resource usage and which are described individually, see:

* [Scalability optimizations](./scalability.md)
* [Bandwidth optimizations](./bandwidth_optimizations.md)
* [Message batching control](./client_msg_batching.md)
