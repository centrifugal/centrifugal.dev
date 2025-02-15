---
id: performance
title: Faster performance
---

<img src="/img/logo_animated_fast.svg" width="100px" height="100px" align="left" style={{'marginRight': '10px', 'float': 'left'}} />

Centrifugo PRO has performance improvements for several server parts. These improvements can help to reduce tail end-to-end latencies in the application, increase server throughput and/or reduce CPU usage on server machines. Our open-source version has a decent performance by itself, with PRO improvements Cenrifugo steps even further.

## Faster HTTP API

Centrifugo PRO has an optimized JSON serialization/deserialization for HTTP API.

The effect can be noticeable under load. The exact numbers heavily depend on usage scenario. According to our benchmarks you can expect 10-15% more requests/sec for small message publications over HTTP API, and up to several times throughput boost when you are frequently get lots of messages from a history, see a couple of examples below.

## Faster GRPC API

Centrifugo PRO has an optimized Protobuf serialization/deserialization for GRPC API. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario.

## Faster HTTP proxy

Centrifugo PRO has an optimized JSON serialization/deserialization for HTTP proxy. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario.

## Faster GRPC proxy

Centrifugo PRO has an optimized Protobuf serialization/deserialization for GRPC API. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario.

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
