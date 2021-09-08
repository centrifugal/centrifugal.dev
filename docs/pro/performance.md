---
id: performance
title: PRO performance
---

Centrifugo PRO has performance improvements for several server parts. These improvements can help to reduce tail end-to-end latencies in application, increase server throughput and/or reduce CPU usage on server machines.

## Faster HTTP API

Centrifugo PRO has an optimized JSON serialization/deserialization for HTTP API.

The effect can be noticeable under load. The exact numbers heavily depend on usage scenario. According to our benchmarks you can expect 10-15% more requests/sec for small message publications over HTTP API, and up to several times throughput boost when you are frequently get lots of messages from a history, see a couple of examples below.

## Faster GRPC API

Centrifugo PRO has an optimized Protobuf serialization/deserialization for GRPC API. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario.

## Faster HTTP proxy

Centrifugo PRO has an optimized JSON serialization/deserialization for HTTP proxy. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario.

## Faster GRPC proxy

Centrifugo PRO has an optimized Protobuf serialization/deserialization for GRPC API. The effect can be noticeable under load. The exact numbers heavily depend on usage scenario.

## Faster GRPC unidirectional stream

Centrifugo PRO has an optimized Protobuf deserialization for GRPC unidirectional stream. This only affects deserialization of initial connect command.

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
