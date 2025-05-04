---
id: performance
title: Faster performance
---

<img src="/img/logo_animated_fast.svg" width="100px" height="100px" align="left" style={{'marginRight': '10px', 'float': 'left'}} />

Centrifugo PRO has performance improvements for several server parts. These improvements can help to reduce tail end-to-end latencies in the application, increase server throughput and/or reduce CPU usage on server machines. Our open-source version has a decent performance by itself, with PRO improvements Cenrifugo steps even further.

## Faster connections runtime

New in Centrifugo v6.2.0

EXPERIMENTAL option on `client` level is `client.batch_periodic_events` (boolean, by default, `false`). To enable:

```json title="config.json"
{
  "client": {
    "batch_periodic_events": true
  }
}
```

Once enabled Centrifugo will batch client connection periodic events such as ping and presence updates together instead of having them to work in isolated way. This may result into noticeable CPU savings when working with many mostly idle connections.

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

Of course the ratio is highly dependent on the Centrifugo specific setup load profile and usage scenarios.

## Faster HTTP API

Centrifugo PRO has an optimized JSON serialization/deserialization for HTTP API.

The effect can be noticeable under load. The exact numbers heavily depend on usage scenario. According to our benchmarks you can expect 10-15% more requests/sec for small message publications over HTTP API, and up to several times throughput boost when you are frequently get lots of messages from a history, see a couple of examples below.

## Faster GRPC API

Centrifugo PRO has an optimized Protobuf serialization/deserialization for GRPC API. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario.

## Faster HTTP proxy

Centrifugo PRO has an optimized JSON serialization/deserialization for HTTP proxy. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario.

### Faster HTTP proxy client

Centrifugo PRO adds a boolean option `use_fast_client` which enables using fast optimized HTTP client for proxy requests. In the benchmarks we did, the effect was up to 2x more request throughput for HTTP proxy and 10 times fewer allocations for each request. This will result into significant CPU and latency reductions under load.

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

Centrifugo PRO has an optimized Protobuf serialization/deserialization for GRPC API. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario.

## Faster async consumers

When asynchronous consumers are used and payload represents encoded request type Centrifugo PRO leverages optimized JSON decoder.

## Faster JWT decoding

Centrifugo PRO has an optimized decoding of JWT claims.

## Faster GRPC unidirectional stream

Centrifugo PRO has an optimized Protobuf deserialization for GRPC unidirectional stream. This only affects deserialization of initial connect command.

## WebSocket compression optimizations

Centrifugo PRO provides an integer option `websocket.compression_prepared_message_size` (in bytes, default `0`) which when set to a value > 0 tells Centrifugo to use a cache or prepared websocket messages when working with connections with WebSocket compression negotiated.

```json title="config.json"
{
  "websocket": {
    "compression_prepared_message_size": 10485760
  }
}
```

This can significantly improve CPU and memory Centrifufo resource usage when using [WebSocket compression feature](../transports/websocket.md#websocketcompression).

Check out blog post [Performance optimizations of WebSocket compression in Go application](/blog/2024/08/19/optimizing-websocket-compression) which describes the possible effect of this optimization.

## Other optimizations

Centrifugo PRO also provides other optimizations which can significantly affect resource usage and which are described individually, see:

* [Message batching control](./client_msg_batching.md)
* [Scalability optimizations](./scalability.md)

## Examples

Let's look at quick live comparisons of Centrifugo OSS and Centrifugo PRO regarding HTTP API performance.

### Publish HTTP API 

<video width="100%" controls>
  <source src="/img/pro_api_publish_perf.mp4" type="video/mp4" />
  Sorry, your browser doesn't support embedded video.
</video>

In this video you can see a 13% speed up for publish operation. But for more complex API calls with larger payloads the difference can be much bigger. See next example that demonstrates this.

### History HTTP API

<video width="100%" controls>
  <source src="/img/pro_api_history_perf.mp4" type="video/mp4" />
  Sorry, your browser doesn't support embedded video.
</video>

In this video you can see an almost 2x overall speed up while asking 100 messages from Centrifugo history API.
