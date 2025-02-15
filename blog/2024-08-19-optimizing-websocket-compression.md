---
title: Performance optimizations of WebSocket compression in Go application
tags: [centrifugo, centrifuge, websocket, compression, performance]
description: In this post, we explore how WebSocket compression can optimize bandwidth costs. We also discuss strategies to minimize the CPU and memory overhead associated with the enabled WebSocket compression from the Go ecosystem perspective.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/ws_compression_cover.jpg
hide_table_of_contents: false
---

<img src="/img/ws_compression_cover.jpg" />

In a recent blog post, we [talked about the Delta Compression](https://centrifugal.dev/blog/2024/05/30/real-time-data-compression-experiments) feature of the Centrifuge/Centrifugo stack. We continue the topic of real-time data compression here, and in this post, we will show the optimizations for WebSocket compression made recently in collaboration with one of our Centrifugo PRO customers.

The optimizations described here allowed our customer to reduce the transmit bandwidth used for real-time communication by 3x by enabling WebSocket compression, while keeping server CPU and memory utilization at comparable levels. This eventually resulted in notable savings of up to $12,000 per month on their bandwidth bill.

<!-- truncate -->

The optimization is now part of our open-source [centrifugal/centrifuge](https://github.com/centrifugal/centrifuge) library for the Go language and [Centrifugo PRO](https://centrifugal.dev/docs/pro/overview) offering. However, the concepts described here can be applied not only to other Go projects but also beyond the Go ecosystem.

:::tip Thanks

Huge kudos to the Skin.Club engineering team (and Sergey in particular) for bringing us the case, evaluating the changes, providing graphs from production, and reviewing this post.

:::

## Enabling WebSocket compression

WebSocket compression allows reducing the size of messages exchanged between a client and server over a WebSocket connection. Nowadays, it's achieved using the `permessage-deflate` algorithm (see [RFC 7692](https://datatracker.ietf.org/doc/html/rfc7692)), which compresses the data before transmission. By reducing the data size, WebSocket compression helps optimize bandwidth usage and may actually lower latency due to the reduced data size over the wire.

[Centrifuge library](https://github.com/centrifugal/centrifuge) (the core of Centrifugo server) uses [Gorilla WebSocket](https://github.com/gorilla/websocket) library for its WebSocket transport implementation (actually, we have our own fork with minor modifications, but the core is the same). Gorilla WebSocket supports WebSocket compression by using a Go standard's library [compress/flate](https://pkg.go.dev/compress/flate) package. Enabling compression on server side can be done by setting an `EnableCompression` option of the [websocket.Upgrader](https://pkg.go.dev/github.com/gorilla/websocket#Upgrader):

```go
var upgrader = websocket.Upgrader{
    EnableCompression: true,
}
```

Then it's possible to control whether to use compression for a message by using `EnableWriteCompression` method before you are writing data to the specific connection:

```go
conn.EnableWriteCompression(false)
// Write data.
```

When paying for bandwidth, minimizing its usage can result in substantial cost savings, even if it leads to higher CPU and memory consumption on the server side. This is why our customer chose to enable WebSocket compression to evaluate its impact on their metrics:

<img src="/img/ws_compression_enabling.jpg" />

Sorry for the image quality; at that point, we did not know that the case would eventually lead to a blog post. However, what is important to emphasize from these graphs is that when WebSocket compression was enabled:

* The graphs show a significant reduction in transmit bandwidth on nodes, from 7.5 to 2.5 MiB/s at peak times (or in sum across all nodes from 45 to 15 MiB/s).
* We observe a notable (approximately 2x) increase in CPU usage.
* We see how memory usage was affected in a bad way – instead of being super-stable we now observe sporadic spikes, up to 2.5x larger values.

Despite the negative change of CPU and memory utilization, migrating to WebSocket compression was still economically beneficial for our customer. As mentioned earlier, this step alone allowed the company to save up to $12,000 per month on bandwidth costs, while the additional resource usage costs were comparably much lower.

Fortunately, at Centrifugal Labs, we had [prior experience](https://github.com/gorilla/websocket/issues/203) with WebSocket compression performance overhead. This allowed us to suggest some optimizations to mitigate the resource usage degradation. To understand these optimizations, we first need to explore how WebSocket compression works under the hood.

## Permessage-deflate in gorilla/websocket

In Go, when you need to compress the WebSocket frame your starting point is [compress/flate](https://pkg.go.dev/compress/flate) package from Go standard library. That's what Gorilla WebSocket uses to implement `permessage-deflate` compression. You can find the implementation in [compression.go](https://github.com/gorilla/websocket/blob/3810b2346f49a47aa0b99c23a7aa619d5f5dcf80/compression.go) file.

When compressing frames the user may choose one of the [predefined levels of compression](https://pkg.go.dev/compress/flate#pkg-constants) - from 1 (BestSpeed) to 9 (BestCompression).

One of the important compression implementation details is that Gorilla WebSocket uses `sync.Pool` for `flate.Writer` (separate pool for each level of compression) and `flate.Reader` types:

```go
var (
    flateWriterPools [maxCompressionLevel - minCompressionLevel + 1]sync.Pool
    flateReaderPool  = sync.Pool{New: func() interface{} {
        return flate.NewReader(nil)
    }}
)
```

Having a pool for these objects allows Gorilla WebSocket to reuse existing readers/writers and generally avoid additional allocations. The benefit of having a pool for `flate.Writer` is enormous, especially when considering how large this type is:

```go
package main

import "unsafe"
import "compress/flate"

func main() {
    var w flate.Writer
    println(unsafe.Sizeof(w))
    // Output: 656640
}
```

So it's around 650 KB on its own! For `flate.Reader` it's not that critical as it's only 16B overhead. Having pools makes a lot of sense and helps Gorilla WebSocket to perform well when compressing data.

Thus when you call [Conn.WriteMessage](https://pkg.go.dev/github.com/gorilla/websocket#Conn.WriteMessage) or use [Conn.NextWriter](https://pkg.go.dev/github.com/gorilla/websocket#Conn.NextWriter) API for connections with compression negotiated under the hood Gorilla Websocket library acquires `flate.Writer` from the proper pool for the time of write operation.

:::tip No context takeover

Gorilla WebSocket implements `permessage-deflate` [without context takeover](https://datatracker.ietf.org/doc/html/rfc7692#section-7.1.1.1) only. Implementing a context takeover would mean attaching a `flate.Writer` to each connection – which is very memory inefficient as we can see. Though it can be still a viable money-effective bandwidth optimization for WebSocket – especially if the app does not have a lot of concurrent connections.

:::

But below we will describe a scenario in which having just a `sync.Pool` is not enough to avoid extra allocations.

## PreparedMessage type

Let’s delve into the specifics of Centrifuge/Centrifugo. Both the Centrifuge library and the Centrifugo server implement the PUB/SUB pattern for real-time messaging. Clients can establish a WebSocket connection and subscribe to multiple channels, all multiplexed over a single connection. A single channel can have many online subscribers — often thousands. Our APIs enable publishing a message to a channel, ensuring it is delivered to all online subscribers of that channel. Here’s a simple illustration of the PUB/SUB pattern:

![pub_sub](/img/pub_sub.png)

When you publish a message to a channel, our WebSocket server puts the message into each subscribed client's individual queue. Client queues are processed concurrently in separate goroutines, and messages are eventually sent to the client over the transport implementation. WebSocket is the most frequently used transport implementation in our case.

With WebSocket compression enabled, broadcasts to a channel with many online subscribers result in many compression operations that compress the same message concurrently. This, in turn, results in a load on `sync.Pool`, which grows significantly at the point of such a broadcast. Given the size of each `flate.Writer` object, this is exactly what causes the temporary memory spikes we observed on the graphs above. More allocations also mean more CPU utilization.

In your app, you may observe something like this in the heap profile:

![img](/img/ws_compression_profile.jpg)

That's why, at some point in the past, Gary Burd (author of Gorilla WebSocket) [added](https://github.com/gorilla/websocket/pull/211) a [PreparedMessage](https://pkg.go.dev/github.com/gorilla/websocket#PreparedMessage) type. This is a helper type that allows caching the constructed WebSocket frame depending on various negotiated connection options (compression used or not, compression level).

```go title="How PreparedMessage is defined"
// PreparedMessage caches on the wire representations of a message payload.
// Use PreparedMessage to efficiently send a message payload to multiple
// connections. PreparedMessage is especially useful when compression is used
// because the CPU and memory expensive compression operation can be executed
// once for a given set of compression options.
type PreparedMessage struct {
    messageType int
    data        []byte
    mu          sync.Mutex
    frames      map[prepareKey]*preparedFrame
}

// prepareKey defines a unique set of options to cache prepared frames in PreparedMessage.
type prepareKey struct {
    isServer         bool
    compress         bool
    compressionLevel int
}

// preparedFrame contains data in wire representation.
type preparedFrame struct {
    once sync.Once
    data []byte
}
```

Then there is a method [func (*Conn) WritePreparedMessage](https://pkg.go.dev/github.com/gorilla/websocket#Conn.WritePreparedMessage), which should be used to write data to all connections interested in a message — the proper WebSocket frame will be created once and then automatically re-used. By the way, this is an example of the [elegant use](https://github.com/gorilla/websocket/blob/ce903f6d1d961af3a8602f2842c8b1c3fca58c4d/prepared.go#L72) of `sync.Once`.

```go title="Using PreparedMessage"
preparedMessage, _ = websocket.NewPreparedMessage(websocket.TextMessage, data)
_ := conn.WritePreparedMessage(preparedMessage)
```

This means that if we broadcast the same prepared message to many connections, we remove the excessive load on `sync.Pool`, just taking a one `flate.Writer` from the pool instead of many. This way, we avoid large memory spikes due to big size of `flate.Writer` objects and `sync.Pool` growth.

For broadcasts, `PreparedMessage` approach significantly reduces CPU usage by minimizing the need to construct and compress WebSocket frames, especially as the number of concurrent subscribers increases. Additionally, it reduces the allocation of large `flate.Writer` objects, further optimizing CPU utilization.

Gorilla WebSocket contains [benchmarks](https://github.com/gorilla/websocket/blob/3810b2346f49a47aa0b99c23a7aa619d5f5dcf80/conn_broadcast_test.go) which compare message broadcast to many connections with enabled compression without and with `PreparedMessage` usage. Let's run them:

```go
❯ go test -run xxx -bench BenchmarkBroadcast -benchmem

Compression_100_conn-8             198619 ns/op	   14113 B/op	    301 allocs/op
CompressionPrepared_100_conn-8      42643 ns/op	   12320 B/op	     19 allocs/op

Compression_1000_conn-8           1797432 ns/op	  123864 B/op	   3001 allocs/op
CompressionPrepared_1000_conn-8    649506 ns/op	   11421 B/op	     19 allocs/op

Compression_10000_conn-8         16506132 ns/op	 1040709 B/op	  30007 allocs/op
CompressionPrepared_10000_conn-8  7702265 ns/op	   11631 B/op	     21 allocs/op
```

Benchmarks demonstrate that `PreparedMessage` significantly reduces memory allocations during broadcasts, with the impact becoming more significant as the number of connections increases.

## PreparedMessage cache

For Centrifuge/Centrifugo though, we couldn't directly use `PreparedMessage` in the part of the code responsible for preparing messages for channel broadcasts. This is because doing so would introduce a dependency on a WebSocket-specific type in a layer of code that should remain agnostic to the underlying real-time transport.

To avoid this, we chose not to rely on the `PreparedMessage` type in the broadcasting preparation layer. Instead, we implemented a cache of `PreparedMessage` types within the WebSocket transport implementation layer.

We use the data to be sent to the WebSocket connection as a cache key, and the `PreparedMessage` object as a value. The WebSocket transport implementation checks the cache before constructing `PreparedMessage` and has a high chance of finding it. The TTL (time-to-live) of each cache entry can be kept very short (something like 1 second should be sufficient). The size of the cache should be comparable to the total size of all different messages being broadcasted concurrently. For most WebSocket applications, a cache size of several megabytes should be more than enough.

We used [maypok86/otter](https://github.com/maypok86/otter) cache for our implementation, but there are a lot of other options in Go ecosystem.

Here is how we initialize the cache:

```go
otter.MustBuilder[string, *websocket.PreparedMessage](int(config.CompressionPreparedMessageCacheSize)).
    Cost(func(key string, value *websocket.PreparedMessage) uint32 {
        return 2 * uint32(len(key))
    }).
    WithTTL(time.Second).
    Build()
```

And use it at the point where we want to write data to the WebSocket connection on a transport layer:

```go
...
if usePreparedMessage {
    key := convert.BytesToString(data)
    preparedMessage, ok := t.preparedCache.Get(key)
    if !ok {
        var err error
        preparedMessage, err = websocket.NewPreparedMessage(messageType, data)
        if err != nil {
            return err
        }
        t.preparedCache.Set(key, preparedMessage)
    }
    err := t.conn.WritePreparedMessage(preparedMessage)
    if err != nil {
        return err
    }
} else {
    ...
}
```

You may wonder why the cache at this level can make a difference compared to simply using `conn.WriteMessage`. At first glance, the probability of finding a `PreparedMessage` in the cache during a concurrent broadcast seems similar to getting a `flate.Writer` from the `sync.Pool` for reuse. However, that's not entirely true, because the `WriteMessage` method of Gorilla WebSocket acquires a `flate.Writer` for the duration of the write operation, which involves a syscall and generally takes much more time than our cache operations. Additionally, two subsequent writes that reuse the `flate.Writer` will construct the frame from scratch, whereas a cached `PreparedMessage` allows us to avoid this.

It's important to note that the fact we use a cache is actually a Centrifuge-specific detail to avoid dependency on a type from the WebSocket library in places where we don't want to be tied to specific transport implementations. In your WebSocket app that uses Gorilla WebSocket, you can likely create a `PreparedMessage` directly and use it when iterating over connections to which you need to broadcast the message. This approach might even lead to more predictable behavior than what we have in the Centrifuge case with a cache. While the cache approach is somewhat probabilistic, the probability is high, and as we'll see below, it works well.

## Mentioning klauspost/compress

Since we are discussing compression optimizations in the Go ecosystem, it would be wrong not to mention the [klauspost/compress](https://github.com/klauspost/compress) library created by Klaus Post. The library is backwards compatible with standard Go packages but provides faster implementations of compression algorithms. Additionally, it offers capabilities beyond those of the standard library.

Specifically, it provides [Stateless Compression](https://github.com/klauspost/compress?tab=readme-ov-file#stateless-compression), which theoretically could help with the use case we described here.

However, in our initial evaluations of [klauspost/compress](https://github.com/klauspost/compress) (switching to its `flate` implementation and also trying the Stateless Compression feature), we did not observe notable improvements in our specific set of benchmarks (and actually observed regressions in some cases). So, for now, we are sticking with the standard Go library. Nevertheless, it's still a promising direction for research, and we may re-evaluate our findings in the future. Since we use our own fork of Gorilla WebSocket, we can easily switch to [klauspost/compress](https://github.com/klauspost/compress) if we prove the benefit.

## Results

Alright, it's time to see how enabling `PreparedMessage` cache helped the customer with a resource usage.

First, let's look at CPU after enabling the cache in production:

<img src="/img/ws_compression_results_cpu.png" />

We see that the average CPU utilization is significantly reduced at peak times, closer to values before enabling the WebSocket compression.

Second, let's look at memory usage:

<img src="/img/ws_compression_results_mem.png" />

As we can see on the graph – the pattern smoothed a lot making the usage on each Centrifugo node much more stable. It's still not the same as it was with compression disabled, we can see minor spikes – but the positive effect of `PreparedMessage` cache is clear.

## Conclusion

Enabling WebSocket compression helped our customer significantly reduce monthly costs, and with PreparedMessage cache optimization, we were able to keep resource usage at a comparable level. So, it was mostly a no-brainer improvement.

If you are a Go developer, our open-source [centrifugal/centrifuge](https://github.com/centrifugal/centrifuge) library for Go supports WebSocket compression and contains the cache described here — so if you build your app on top of Centrifuge, you just need to enable a couple of options to benefit from it:

```go
websocketConfig := centrifuge.WebsocketConfig{
    Compression: true,
    CompressionPreparedMessageCacheSize: 1048576 // 1 MB. 
}
```

If we talk about Go, the technique with prepared message is also applicable to other WebSocket libraries, not just Gorilla WebSocket. For example, with [gobwas/ws](https://github.com/gobwas/ws), it seems possible to construct a prepared compressed WebSocket frame, though it involves slightly more work than with Gorilla WebSocket, which provides a handy `PreparedMessage` type for this and abstracts the complexity of frame building (based on the set of connection-negotiated options).

That's it for today. In some cases, when working with WebSocket broadcasts, the bandwidth may be reduced even more — check out our post about [Delta Compression](https://centrifugal.dev/blog/2024/05/30/real-time-data-compression-experiments).
