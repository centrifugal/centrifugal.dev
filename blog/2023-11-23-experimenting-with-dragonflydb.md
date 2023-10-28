---
title: Experimenting with DragonflyDB as a drop-in replacement for Redis in Centrifugo
tags: [centrifugo, redis, dragonflydb]
description: During last several months we were experimenting with DragonflyDB as a drop-in replacement for Redis in Centrifugo. Here, we want to share some thoughts and benchmark results about it.
author: Alexander Emelin
authorTitle: TBD
authorImageURL: https://github.com/FZambia.png
image: /img/centrifugo_dragonflydb_cover.jpg
hide_table_of_contents: false
draft: true
---

<img src="/img/centrifugo_dragonflydb_cover.jpg" />

In Centrifugal Labs we like Redis a lot. It's a masterpiece software which provides unique possibilities for soft real-time systems while being simple and robust. We scale PUB/SUB with it, using as a message history cache, keep online presence information in it. In Centrifugo PRO we are using Redis as queue, as a backend for token bucket rate limiting, as a key/value storage of user statuses, revoked tokens. We even trying to build a distributed queue with partition semantics a-la Kafka on top of Redis.

When we've noticed the release of DragonflyDB which stated overperforming Redis in more than 30x times due to using multicore architecture, modern algorithms and Linux APIs like io-uring, we were super curious to try it out.

<!--truncate-->

Did it work out of the box? No - we opened several issues in DragonflyDB. Thanks to DragonflyDB engineers – all the requests were quickly fixed/implemented – and we were able to run all the functionality of Centrifugo and Centrifugo PRO on top of it. And finally all the things we currently provide and all the tests we have work fine with DragonflyDB. Of course, the obvious next step is to measure the performance DragonflyDB may provide for our tasks.

## Disclaimer about DragonflyDB performance

TBD.

## Let's setup on Ubuntu

TBD

## Running our benchmarks

TBD

## Conclusion

TBD
