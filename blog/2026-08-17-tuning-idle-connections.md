---
title: "Tuning Centrifugo PRO for large number of idle WebSocket connections"
tags: [centrifugo, websocket, performance]
description: "An idle WebSocket connection costs CPU and memory even when no messages flow. The post starts with 200k idle connections on a single node, cuts the overhead with five Centrifugo PRO options, then holds a million idle connections on the same node."
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/blog_ws_idle.jpg
hide_table_of_contents: false
---

A lot of real-time systems spend most of their time doing nothing. Think about a notifications service, a presence dashboard, a "new message" badge — the connections sit open for hours, and messages arrive rarely. The interesting scaling question for such systems is not throughput, but how cheaply a single node can hold a large pool of connections that are mostly idle.

An idle connection still isn't free: even with no application traffic, every connection costs a bit of CPU (Centrifugo runs periodic per-connection work — an application-level ping, presence refresh, subscription checks) and a bit of memory (goroutines, buffers, protocol state). Multiply that by hundreds of thousands and the constant, do-nothing overhead becomes the thing that decides how many connections fit on a node.

This post measures that overhead and shows how five Centrifugo PRO options reduce it. One cuts CPU, the other four cut memory — and almost every byte they save turns out to come from a specific piece of the connection: a stack or a buffer.

<!--truncate-->

## The benchmark

We hold 200,000 real WebSocket connections open against a single Centrifugo node and leave them idle. "Idle" here means the connections do nothing but stay alive — the server sends its application-level ping every 25 seconds (the default), the clients answer it, and that is the only traffic. Then we measure the server process: CPU (in cores) and resident memory (RSS).

* Node: one Centrifugo instance on a 16 vCPU cloud VM (AMD EPYC-Genoa, KVM), 30 GB RAM, Ubuntu Linux.
* Connections: 200,000 bidirectional WebSocket, protocol v2, **no subscriptions**.
* Ping interval: 25s (default). Everything else at defaults unless stated.
* Every figure below is the mean of two independent full runs of the whole matrix; the two rounds agreed within ~3% on CPU and ~0.5% on memory.

We measure the Centrifugo process specifically — CPU as the process's own user + system time over a steady-state window well after the connection ramp, memory as its RSS after a forced GC — so the numbers are the server's own consumption, not the whole machine's.

One thing RSS does not include, and which matters when you size a machine: the kernel keeps its own structures for every socket — the `tcp_sock`, an inode, a dentry, a file — and charges them to slab, not to your process. We measured about 4 KB per socket, and it shows up in neither `ps`, nor `top`'s RSS column, nor Go's runtime memory stats. It is real memory and cgroup v2 does count it against a container limit, so add it to every per-connection figure below when planning capacity.

At these connection counts the server uses well under one core out of sixteen, so it's the per-connection overhead we're isolating, not saturation.

Everything below is the server's own cost — the number that decides how many connections a node holds.

## Baseline

With default settings, holding 200,000 idle connections costs:

| Metric | Value | Per connection |
|---|---|---|
| CPU | ~0.94 cores | ~4.7 µs/s |
| Memory (RSS) | ~5.4 GB | ~27 KB |
| Goroutines | ~400,000 | 2 |

Two goroutines per connection: one reads from the socket, one owns writes to it. The CPU is almost entirely the machinery of the periodic per-connection timers — for 200k connections that is a lot of independent timers for the Go runtime to track and fire.

It's worth splitting that ~27 KB, because it explains everything that follows:

| Component | Per connection |
|---|---|
| Goroutine stacks | ~12.3 KB |
| Heap (buffers, protocol state, client struct) | ~12.7 KB |
| Runtime overhead | ~2 KB |

Nearly half of an idle connection is goroutine stacks. Keep that number in mind: two of the memory options below are, underneath, different ways of making it smaller, and the other two go after the heap half.

## Cutting CPU: `batch_periodic_events`

Each connection runs several periodic tasks — the keepalive ping, presence updates, subscription expiration checks. By default each is an independent timer. With many connections, the Go runtime spends real CPU maintaining all of them and waking a goroutine every time one fires.

`batch_periodic_events` groups these per-connection events onto a shared timing wheel instead of scheduling each one independently. The periodic work still happens on schedule; it's just dispatched in batches rather than as hundreds of thousands of separate timer wakeups.

```json title="config.json"
{
  "client": {
    "batch_periodic_events": true
  }
}
```

The effect on the same 200,000 idle connections:

| Metric | Default | `batch_periodic_events` |
|---|---|---|
| CPU | ~0.94 cores | **~0.41 cores** |
| Memory (RSS) | ~5.4 GB | ~5.4 GB |

That's over 2× less CPU to hold the same pool — down to ~2.0 µs/s per connection. Memory is unchanged to within a rounding error: this option is purely about how periodic timers are scheduled.

## Cutting memory, part 1: the writer goroutine

By default every connection has a dedicated goroutine that owns writes to its socket and blocks waiting for something to send. For an idle connection that goroutine does nothing almost all the time — but it still exists, and a parked goroutine still costs a stack.

`write_delay` batches outgoing messages: instead of writing each message immediately, the connection waits a short delay to coalesce whatever arrives into a single write, which reduces system calls under load. `write_with_timer` changes *how* that batching waits — it uses a shared timer to trigger the flush instead of a dedicated per-connection writer goroutine. For this post the interesting part is the side effect at rest: idle connections no longer each hold a writer goroutine.

```json title="config.json"
{
  "client": {
    "write_delay": "100ms",
    "write_with_timer": true
  }
}
```

| Metric | Default | `write_with_timer` |
|---|---|---|
| Goroutines | ~400,000 | **~200,000** |
| Memory (RSS) | ~27 KB/conn | **~22.4 KB/conn** |
| Goroutine stacks | ~12.3 KB/conn | **~8.2 KB/conn** |

One goroutine per connection instead of two, and the saving is exactly one 4 KB goroutine stack.

The tradeoff to be aware of: `write_delay` adds latency equal to the delay (100 ms here) before a message is flushed, because the connection waits that long to batch. For notification-style workloads that is usually invisible; for latency-sensitive request/reply it may not be what you want. Tune the delay, or leave it off, accordingly.

## Cutting memory, part 2: the read goroutine's stack

That leaves one goroutine per connection — the one reading the socket. It can't be removed the same way; something has to wait for the client's next message. But it turns out most of what it costs isn't the goroutine. It's the *size* of its stack.

Go grows a goroutine's stack on demand, doubling it whenever a call chain doesn't fit, and — this is the part that matters — a long-lived goroutine never really gives that space back. So the stack grows to the deepest call the goroutine has ever made, and stays there.

A connection's read loop reads a frame and then processes the command inline: the event handler, the broker, the broadcast fan-out. That is a deep call chain, and it only has to happen **once** — even just the initial `connect` command — for the read goroutine to grow to 8 KB and hold it for the entire life of the connection, however idle it then becomes.

`process_commands_off_read_loop` moves command processing to a short-lived goroutine that exits when the frame is done. The read loop itself stays shallow. The deep stack still gets used, but it goes back to the Go runtime's stack pool and is reused by the next connection that needs it, instead of being pinned to a connection that spends its life waiting.

```json title="config.json"
{
  "websocket": {
    "process_commands_off_read_loop": true
  }
}
```

| Metric | Default | `process_commands_off_read_loop` |
|---|---|---|
| Goroutines | ~400,000 | ~400,000 (unchanged) |
| Memory (RSS) | ~27 KB/conn | **~23 KB/conn** |
| Goroutine stacks | ~12.3 KB/conn | **~8.2 KB/conn** |

Same saving as removing the writer goroutine — around 4 KB per connection — but by a completely different route: the goroutine count doesn't change at all, its stack just halves from 8 KB to 4 KB. The two options are independent, and they stack.

The tradeoff: handing each frame to another goroutine costs a goroutine start and two scheduler handoffs. For a connection that is genuinely busy, that shows up as a small increase in per-command latency. For a large pool of mostly-idle connections — the case this whole post is about — you are trading an operation that almost never happens for memory you pay for constantly.

## Cutting memory, part 3: `use_write_buffer_pool`

The last piece isn't a goroutine at all. Every WebSocket connection holds a write buffer — 4 KB by default — whether or not it is writing anything. `use_write_buffer_pool` makes connections share a pool of write buffers instead, so a buffer is held only while a write is actually in flight.

```json title="config.json"
{
  "websocket": {
    "use_write_buffer_pool": true
  }
}
```

| Metric | Default | `use_write_buffer_pool` |
|---|---|---|
| Memory (RSS) | ~27 KB/conn | **~24.0 KB/conn** |
| Heap | ~12.7 KB/conn | **~8.6 KB/conn** |

Another ~4 KB per connection, this time out of the heap rather than the stacks. Under sustained write load the pool sees more contention than a per-connection buffer, so this option is meant for pools that are idle most of the time.

## Cutting memory, part 4: `read_buffer_size`

With the write buffer pooled, a heap profile of the tuned server shows that the
WebSocket read buffer is now 47% of everything left. Each
connection holds one, and by default it takes the 4 KB buffer that `net/http`
allocated for the request it was upgraded from.

Centrifugo lets you size it. A client command is small — a subscribe, a publish,
a pong — so 4 KB is far more than a mostly-idle connection needs.

```json title="config.json"
{
  "websocket": {
    "read_buffer_size": 1024
  }
}
```

| Metric | All previous options | `+ read_buffer_size: 1024` |
|---|---|---|
| CPU | 0.46 cores | **0.45 cores** |
| Memory (RSS) | 15.3 KB/conn | **10.9 KB/conn** |
| Heap | 8.3 KB/conn | **5.1 KB/conn** |

That's another 4.4 KB per connection, and CPU does not move — the largest
single memory saving in this post, and the cheapest.

Dropping to 512 bytes saves only another 0.5 KB, so 1024 is the sweet spot. The
tradeoff is that a client sending messages larger than the buffer needs more
read syscalls to pull them in — irrelevant for command traffic, worth thinking
about if your clients push large payloads.

## Everything together

The five options target different costs, so they stack cleanly:

| Configuration | CPU | RSS/conn | Stacks/conn | Heap/conn |
|---|---|---|---|---|
| Default | 0.94 cores | 27.0 KB | 12.3 KB | 12.7 KB |
| `batch_periodic_events` | **0.41 cores** | 26.9 KB | 12.3 KB | 12.6 KB |
| `write_with_timer` | 0.98 cores | 22.4 KB | 8.2 KB | 12.3 KB |
| `process_commands_off_read_loop` | 0.96 cores | 22.9 KB | 8.2 KB | 12.8 KB |
| `use_write_buffer_pool` | 0.92 cores | 24.0 KB | 12.3 KB | 8.6 KB |
| **First four together** | **0.46 cores** | **15.3 KB** | **4.2 KB** | **8.3 KB** |
| **All five (+ `read_buffer_size: 1024`)** | **0.45 cores** | **10.9 KB** | **4.2 KB** | **5.1 KB** |

With everything enabled, one node holds 200,000 idle connections for ~0.45 cores and ~2.2 GB — 52% less CPU and 60% less memory than the default. Per connection that's roughly 2.2 µs/s of CPU and ~11 KB of RAM.

Look at where the memory went. The default 27 KB was 12.3 KB of stacks and 12.7 KB of heap; tuned, those are 4.2 KB and 5.1 KB. The four memory options each removed roughly 4 KB — one goroutine stack, one goroutine's *worth* of stack, one write buffer, and most of a read buffer.

A note on CPU: the memory options are not entirely free. The first three individually cost between 2% and 7% CPU and together around 12%, while `read_buffer_size` costs nothing measurable. `batch_periodic_events` more than pays for all of it, which is why the combined figure is still less than half the default — but if you enable only the memory options, expect CPU to tick up slightly.

## When this matters

These options shine for the workload we benchmarked: large pools of mostly-idle connections. Notifications, presence, live badges, dashboards that update occasionally — anywhere the connection count is high and the message rate per connection is low.

They matter less for high-throughput workloads. If every connection is receiving a steady stream of messages, the cost moves from the idle overhead we optimized here into the actual message fan-out and socket writes, which is a different benchmark. (`write_delay` still helps there — batching writes cuts system calls under load — but that's a throughput story, not the idle-pool story of this post.)

A couple of practical notes:

* `batch_periodic_events` is currently marked experimental. It's a scheduling change with no effect on delivery semantics, but the flag reflects that it's a newer option.
* `write_with_timer` only applies when `write_delay` is set — the timer-based flush is meaningless without a delay to flush against.
* `process_commands_off_read_loop` and `use_write_buffer_pool` are WebSocket-transport options, so they live under `websocket` rather than `client`. They do not affect SSE or HTTP-streaming connections, which don't hold a persistent read loop in the same way.

## One more thing: a million connections

Everything above is measured at 200,000, which is where the full comparison is
practical to run. But once the tuned configuration was in hand, the obvious
question was how far the same machine goes.

We pointed the load generator at the same 16 vCPU / 30 GB node with every option
from this post enabled, and asked it for 1,000,000 connections:

| Metric | Value | Per connection |
|---|---|---|
| Connections | 1,000,000 | |
| CPU | ~2.33 cores | ~2.3 µs/s |
| Memory (RSS) | ~11.3 GB | ~11.6 KB |
| Goroutines | 1,000,163 | 1.00 |
| — of which stacks | ~4.1 GB | ~4.1 KB |
| — of which heap | ~5.2 GB | ~5.2 KB |

Add the kernel's own per-socket structures — about 4 KB each, so roughly 4.2 GB
for a million sockets — and the true cost of the node is closer to 15.5 GB,
still only half the machine.

Two and a third cores and 11 GB of process memory, on one node, for a million
idle WebSocket connections. The per-connection cost is only slightly above the 200k figure —
~11.6 KB against ~10.9 KB — so the tuning holds its shape at five times the
scale rather than degrading.

To be clear about what this run is: a single run of one configuration, not the
two-round matrix the rest of the post is built on, and the connections are
idle — they connect, answer pings, and nothing else. Real traffic adds its own
budget on top.

And one number that is not in the table, because we could not measure it: the
default configuration simply cannot hold a million connections on this machine. At
the ~27 KB per connection we measured at 200k, a million of them would need
around 27 GB of process memory on a 30 GB box — before the kernel's own
per-socket structures, which add roughly 4 KB per socket on top. The tuned
configuration does it in 11.3 GB and leaves half the machine idle.

## Summing up

An idle connection costs CPU (periodic per-connection timers) and memory — and that memory is mostly goroutine stacks and buffers held by connections that are doing nothing. Centrifugo PRO gives you a knob for each:

* **`client.batch_periodic_events`** batches the periodic timers — over 2× less CPU.
* **`client.write_delay` + `write_with_timer`** drops the per-connection writer goroutine — ~4 KB less per connection.
* **`websocket.process_commands_off_read_loop`** halves the read goroutine's stack — another ~4 KB.
* **`websocket.use_write_buffer_pool`** shares write buffers between connections — another ~4 KB.
* **`websocket.read_buffer_size`** sizes the read buffer to what commands actually need — another ~4.4 KB, the largest saving of them all.

The split between the `client` and `websocket` sections is not cosmetic — it is
also the split between what helps everywhere and what does not.

The two `client` options act on the connection object itself, which every
transport builds the same way, so `batch_periodic_events` and `write_delay` +
`write_with_timer` help SSE and HTTP-streaming connections too: the periodic
timers and the per-connection writer goroutine exist regardless of how the
connection was established.

The three `websocket` options do not. Two of them size buffers that belong to
the WebSocket connection, and `process_commands_off_read_loop` only means
anything where there is a long-lived read loop to keep shallow — SSE and
HTTP-streaming receive client commands over ordinary HTTP requests, whose
goroutines are released when the request ends, so there is no persistent stack
to shrink.

So if your fleet is not WebSocket, the CPU win and one of the four memory wins
still apply.

Together they roughly halve the CPU and cut the memory of a large idle connection pool by 60% — enough to hold a million idle connections on a single 16-core node with half its RAM to spare. If your workload is a lot of connections that mostly wait, they're worth turning on.
