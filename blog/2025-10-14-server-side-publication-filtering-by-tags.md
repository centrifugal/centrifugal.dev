---
title: Publication filtering by tags - reducing bandwidth with server-side stream filtering
tags: [performance, go]
description: Learn how Centrifugo's new publication filtering feature allows clients to subscribe with server-side tag filters, significantly reducing bandwidth usage and client-side processing overhead through efficient zero-allocation filtering.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/blog_filter_by_tags.jpg
hide_table_of_contents: false
---

Real-time applications often face the challenge of delivering relevant content to subscribers while minimizing bandwidth usage and client-side processing overhead. Recently introduced [publication filtering by tags](/docs/server/publication_filtering) in Centrifugo OSS and Centrifugo PRO addresses this challenge from a new side – by allowing clients to subscribe to channels with server-side filters, ensuring that only publications with matching tags are delivered to subscribers.

<!-- truncate -->

<img src="/img/publication_filtering.png" /><br /><br />

This feature may significantly help with bandwidth optimization for real-time messaging applications, particularly in scenarios where clients would otherwise receive and discard a significant portion of messages in a channel anyway. Not only network costs may be reduced in this case, but also processing overhead which leads to a faster battery drain on mobile devices.

During last months we observed the increased interest in this feature from Centrifugo users, so it was eventually implemented in Centrifugo v6.4.0. In this blog post we will discuss the design goals, implementation decisions, and performance benchmarks that led to the final solution.

## Design Goals

When designing publication filtering for Centrifugo, we established several key principles:

#### Zero-Allocation Performance in hot broadcast path

The filtering mechanism must be zero-allocation during evaluation because it operates in the hot path during broadcasts to many subscribers. Any memory allocations during filtering would significantly impact performance and increase garbage collection pressure.

While for most applications it may be fine, the predictability of filtering overhead decreases if evaluation allocates. We will see in the benchmarks below how many allocations may be caused by a single publication in channel with 10k subscribers. 

#### Protocol Compatibility

Filters must be easy to serialize/deserialize to/from Protobuf and be fully JSON compatible, ensuring seamless integration with existing client SDKs and Centrifugo protocol.

#### Programmatic Construction

The filtering system should be easily constructible programmatically, allowing developers to build dynamic filters based on application conditions without the need in string formatting and templating.

#### Simplicity and Security

The implementation should remain simple enough and avoid complexity that could limit adoption or introduce security vulnerabilities. The filtering system should only filter based on data that subscribers can already see in publications, ensuring no security boundaries are crossed.

Centrifugo ensures permissions on channel level, filters are not adding a new layer of data protection. Subscriber in channel is able to read all the publications in that stream – filters do not add any permission functionality here.

## Implementation decision: filter by Publication tags

To implement publication filtering, we decided to use tags associated with each publication. Tags are key-value pairs that can be attached to publication:

```go
message Publication {
  ...
  bytes data = 4; // Data contains publication payload.
  map<string, string> tags = 7; // Optional tags associated with publication.
  ...
}
```

It's important that `tags` are already part of the client protocol. Each channel subscriber has access to data and tags of Publication already. So we do not introduce any new security boundaries here.

For examples in this post, let's consider scenario where a channel represents event stream with football match updates. Stream may look like this:

```json
// Publication 1
{
  "data": {
    "minute": "23.27",
    "event_type": "possession_change",
    "event_data": {
      "team": "Real Madrid",
      "tackler": "Arda Guler"
    }
  },
  "tags": {
    "event_type": "possession_change"
  }
}
// Publication 2
{
  "data": {
    "minute": "23.30",
    "event_type": "goal",
    "event_data": {
      "team": "Real Madrid",
      "scorer": "Kilian Mbappe",
      "assistant": "Arda Guler"
    }
  },
  "tags": {
    "event_type": "goal"
  }
}
// Publication 3
{
  "data": {
    "minute": "24.10",
    "event_type": "shot",
    "event_data": {
      "team": "Bayern Munich",
      "shooter": "Harry Kane",
      "xG": "0.85",
      "outcome": "saved"
    }
  },
  "tags": {
    "event_type": "shot",
    "xG": "0.85"
  }
}
```

We can suppose that user does not need all the match events. Some basic filtering example may be: user is only interested in `"goal"` type events.

## Implementation Decision: CEL vs custom filters

Initially, we considered using Google's [Common Expression Language](https://github.com/google/cel-go) (CEL) for filtering, which would have provided a familiar and powerful expression syntax. We already use CEL in other parts of Centrifugo, so it seemed a very natural decision initially. For the scenario above the filter could look like:

```
tags["event_type"] == "goal"
```

Seems simple and straightforward, right? True, and we were quite enthusiastic about using CEL, but the devil is in the details. Turned out for this specific part of Centrifugo it was not the best choice.

First thing to mention, on every subscription we need to compile the CEL expression to a program. Compilation is not a very cheap operation. Here is how compilation may look like with the `cel-go` library:

```go
func buildCELProgram(expr string) (cel.Program, error) {
  env, err := cel.NewEnv(
    cel.Variable("tags", cel.MapType(cel.StringType, cel.StringType)),
  )
  if err != nil { return nil, err }

  ast, issues := env.Compile(expr)
  if issues != nil && issues.Err() != nil { return nil, issues.Err() }

  if ast.OutputType() != cel.BoolType { return nil, errors.New("expected bool output type") }

  return env.Program(ast)
}

// Build and use the program against tags.

prg, err := buildCELProgram(`tags["event_type"] == "goal"`)
// Handle err.

activation := map[string]any{"tags": tags}
out, _, err := sub.Eval(activation)
// Handle err.

if out == types.True {
  // Match!
}
```

An environment made by `cel.NewEnv` call may be shared between subscriptions, but parsing expression and checking AST must be done per each subscription. We will see the overhead for this below in benchmarks.

For a simple expression like `tags["event_type"] == "goal"`:

| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| CEL | 41,606 | 28,581 | 23,178 | 326 |

Or with a more complex expression like `int(tags["count"]) > 42 && double(tags["price"]) >= 99.5 && tags["ticker"].contains("GOO")`:

| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| CEL | 13,784 | 86,623 | 67,560 | 1,060 |

Which is 3x more.

Subscription requests are often frequent operation in Centrifugo, so seeing these numbers is of course unfortunate. Possible optimization here could be caching the same expressions and re-using CEL programs, adds some complexity – but feasible.

More importantly though. While compiled CEL expressions are rather fast to evaluate – evaluations of even simple CEL expressions still come with memory allocations. Memory allocations directly add CPU overhead and also create more load on Garbage Collector (GC). These allocations may not be a huge problem in other parts, but during publication broadcast process it's a very unpredictable performance overhead.

In Centrifugo broadcast process prepares a Publication once and then just adds it to each subscriber queue with minimal allocations during this process. Any allocations per each subscriber in that place in channels with many subscribers can be a performance killer. Another place where we would like to not sacrifice the performance is automatic Publication recovery Centrifugo feature. Recovery is already not a very cheap process to do, so any additional overhead caused by filtering is not a good thing.

Let's look at evaluating CEL program with expression like `tags["event_type"] == "goal"`:

#### Single Evaluation
| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| CEL | 13,632,322 | 79.70 | 32 | 2 |

#### 10k Subscribers (massive broadcast simulation)
| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| CEL | 1,490 | 791,854 | 320,147 | 20,000 |

Or with more complex expression like `int(tags["count"]) > 42 && double(tags["price"]) >= 99.5 && tags["ticker"].contains("GOO")`:

#### Single Evaluation
| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| CEL | 3,579,276 | 333.5 | 104 | 7 |

#### 10k Subscribers (massive broadcast simulation)
| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| CEL | 354 | 3,366,629 | 1,040,445 | 70,000 |

One more concern against the design goals above is that CEL expressions do not offer programmatic construction. It's just a string. This, while OK for other cases like server-side configurations, does not fit well client applications where filter often must be built programmatically from the application state.

Mostly due to this couple of reasons we decided to implement a custom filtering system based on a tree of nodes with logical and comparison operators. This approach is not as flexible as CEL, but it covers most common filtering use cases while providing zero-allocation performance during evaluation and programmatic construction capabilities. Let's look at the chosen design more closely.

## FilterNode design

The filtering system in Centrifugo is based on a tree structure using `FilterNode` object defined in the client protocol Protobuf schema:

```go
message FilterNode {
  // Operation type:
  // - If not set or empty → leaf node (comparison)
  // - "and" → logical AND of child nodes
  // - "or" → logical OR of child nodes
  // - "not" → logical NOT of single child
  string op = 1;

  // Key for comparison (leaf nodes only)
  string key = 2;

  // Comparison operator for leaf nodes
  // "eq", "neq", "in", "nin", "ex", "nex",
  // "sw", "ew", "ct", "gt", "gte", "lt", "lte"
  string cmp = 3;

  // Single value for most comparisons
  string val = 4;

  // Multiple values for set operations
  repeated string vals = 5;

  // Child nodes for logical operations
  repeated FilterNode nodes = 6;
}
```

This structure may be passed in subscribe request to Centrifugo, it's already part of Protobuf schema, so no additional parsing is required on server side to build the filter tree since it comes ready – only a very fast zero-allocation validation step is performed.

It's also fully compatible with Centrifugo optimized JSON serialization (as a general rule, we avoid using `enums` and `oneof` in the Protobuf schema due to that).

The filter is attached to a Subscription and then applied to `tags` in every channel Publication in a channel during broadcast.

Filter supports a comprehensive set of comparison and logical operators.

- **eq/neq**: for exact equality and inequality checks
- **sw/ew/ct**: to perform string starts with, ends with, contains comparisons
- **in/nin**: to make set membership operations
- **gt/gte/lt/lte**: for numeric comparisons with automatic type coercion using zero-allocation decimal library ([quagmt/udecimal](https://github.com/quagmt/udecimal))
- **ex/nex**: for key existence and non-existence checks

More complex filtering with nested conditions may be built using logical operations: **and**, **or**, **not**.

And the implementation of evaluation is a simple recursive function with zero allocations during evaluation. Here is a simplified version of it (with only one logical operator and a couple of comparisons, full code with all the above's features may be found [on Github](https://github.com/centrifugal/centrifuge/blob/master/internal/filter/filter.go))

```go
func Match(f *FilterNode, tags map[string]string) bool {
  switch f.Op {
  case OpLeaf:
    val, ok := tags[f.Key]
    switch f.Cmp {
    case CompareEQ:
      return ok && val == f.Val
    case CompareExists:
      return ok
    }
  case OpAnd:
    for _, child := range f.Nodes {
      if !Match(child, tags) {
        return false
      }
    }
    return true
  }
  return false
}
```

Overall, this structure allows rather powerful filtering capabilities while maintaining zero-allocation evaluation performance in hot path.

This is how filtering of football match events by `event_type` tag may look like with FilterNode structure:

```javascript
const tagsFilter = {
  key: "event_type",
  cmp: "eq",
  val: "goal"
};

const sub = centrifuge.newSubscription("match_events:match_id", {
  tagsFilter: basicFilter
});
```

More complex filters may be built using logical operators:

```javascript
const tagsFilter = {
  op: "or",
  nodes: [
    { key: "event_type", cmp: "eq", val: "goal" },
    {
      op: "and",
      nodes: [
        { key: "event_type", cmp: "eq", val: "shot" },
        { key: "xG", cmp: "gte", val: "0.8" }
      ]
    }
  ]
};

const sub = centrifuge.newSubscription("match_events:match_id", {
  tagsFilter: tagsFilter
});
```

It's possible to build filters programmatically using helper functions to ensure type safety and reduce boilerplate. For example, for JavaScript we may have:

```javascript
const Filter = {
  // Comparison operators.
  eq: (key, val) => ({ key, cmp: "eq", val }),
  neq: (key, val) => ({ key, cmp: "neq", val }),
  in: (key, vals) => ({ key, cmp: "in", vals }),
  nin: (key, vals) => ({ key, cmp: "nin", vals }),
  exists: (key) => ({ key, cmp: "ex" }),
  notExists: (key) => ({ key, cmp: "nex" }),
  startsWith: (key, val) => ({ key, cmp: "sw", val }),
  endsWith: (key, val) => ({ key, cmp: "ew", val }),
  contains: (key, val) => ({ key, cmp: "ct", val }),
  gt: (key, val) => ({ key, cmp: "gt", val }),
  gte: (key, val) => ({ key, cmp: "gte", val }),
  lt: (key, val) => ({ key, cmp: "lt", val }),
  lte: (key, val) => ({ key, cmp: "lte", val }),
  // Logical operators.
  and: (...nodes) => ({ op: "and", nodes }),
  or: (...nodes) => ({ op: "or", nodes }),
  not: (node) => ({ op: "not", nodes: [node] })
};

// Same filter using helper.
const tagsFilter = Filter.or(
  Filter.eq("event_type", "goal"),
  Filter.and(
    Filter.eq("event_type", "shot"),
    Filter.gte("xG", "0.8")
  )
);

const sub = centrifuge.newSubscription("match_events:match_id", {
  tagsFilter: tagsFilter
});
```

Someone can go further and build a string expression parser to build FilterNode tree from string representation similar to CEL, but we did not see a strong need for that so far – leaving as an exercise for the developers.

With the described approach it seems that we found a good balance between flexibility, performance, and simplicity – meeting the design goals.

Now let's see at some benchmarks we did to compare this custom approach with CEL.

## Performance Comparison against CEL

We ran a series of benchmarks comparing **FilterNode** against CEL. The tests covered both **simple expression** and **more complex expression** used earlier, measuring three scenarios:

- **BenchmarkCompareCompile** – overhead of compiling the expression (relevant at subscription time).
- **BenchmarkCompare** – a single evaluation of the filter.
- **BenchmarkCompare10k** – 10,000 evaluations (simulating overhead during broadcast to 10k subscribers).

### Simple Expression

`tags["event_type"] == "goal"`

#### Compilation Overhead (at subscription time)

| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| FilterNode | 11,606,757 | 103.5 | 328 | 3 |
| CEL | 41,605 | 28,683 | 23,164 | 326 |

#### Single Evaluation

| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| FilterNode | 102,141,284 | 11.69 | 0 | 0 |
| CEL | 14,766,996 | 78.96 | 32 | 2 |

#### 10k Evaluations (massive broadcast simulation)

| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| FilterNode | 10,000 | 112,080 | 0 | 0 |
| CEL | 1,480 | 794,553 | 320,135 | 20,000 |

**Analysis:**  
FilterNode compiles nearly **280x faster** than CEL – which is obvious because it's just a matter of several struct creations. Once compiled, executes about **7x faster per evaluation** with zero allocations. At scale (10k evals), it is roughly **7x faster** and completely allocation-free, whereas CEL incurs significant heap usage.

### Complex Expression

`int(tags["count"]) > 42 && double(tags["price"]) >= 99.5 && tags["ticker"].contains("GOO")`

#### Compilation Overhead (at subscription time)

| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| FilterNode | 5,815,352 | 206.8 | 664 | 5 |
| CEL | 13,548 | 88,699 | 67,502 | 1,060 |

#### Single Evaluation

| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| FilterNode | 11,372,026 | 93.78 | 0 | 0 |
| CEL | 3,609,756 | 333.8 | 104 | 7 |

#### 10k Evaluations (massive broadcast simulation)

| Benchmark Name | Iterations | ns/op | B/op | allocs/op |
|----------------|------------|--------|------|-----------|
| FilterNode | 1,290 | 923,829 | 0 | 0 |
| CEL | 356 | 3,350,432 | 1,040,445 | 70,000 |

**Analysis:**  
For more complex expressions, FilterNode is even stronger in comparison. Compilation is **~430x faster** than CEL, and evaluation is **3–4x faster**. Under load (10k evals), FilterNode is nearly **4x faster** and entirely allocation-free, while CEL creates GC pressure.

### Takeaways

- **Compile-time overhead:** FilterNode compiles **hundreds of times faster** than CEL with small number of allocations. This matters in scenarios like channel subscription where expressions are frequently registered.
- **Evaluation speed:** FilterNode executes **3–7x faster** than CEL, depending on complexity the difference may be even more.
- **Scalability:** FilterNode provides **zero allocations per evaluation**, making it extremely GC-friendly at scale. CEL, in contrast, allocates memory on every evaluation. In broadcast scenarios with thousands of subscribers, FilterNode avoids the GC overhead and scales predictably, while CEL quickly incurs both time and memory costs.

FilterNode approach delivers **order-of-magnitude improvements** in both latency and memory efficiency compared to CEL, especially under high-throughput workloads like subscription broadcasts.

## Demo

Here is how it may look like in real life with Centrifugo:

<video width="100%" loop={true} muted controls src="/img/blog_filter_by_tags_demo.mp4"></video>

You can see a simple browser app which subscribes to a channel with stock price ticks with a filter on `ticker` tag. After that, client only receives messages matching the filter. You can find the client side source code [in Centrifuge Go lib examples](https://github.com/centrifugal/centrifuge/blob/c2caf7f4ef0dbc64689ddab438169b419693a11c/_examples/tags_filter/index.html#L226).

In this example we're also demonstrating the change of filter on the fly by unsubscribing and subscribing again with a different filter. Also note that offsets of messages are not incremental here because of filtering – client only receives messages matching the filter.

## Conclusion

For applications dealing with high-volume channels where clients need only a subset of messages, publication filtering offers a compelling solution that optimizes both network usage and client-side processing overhead. This is particularly beneficial for mobile clients where battery life and data usage are critical.

The custom implementation, while less powerful than expression languages like CEL, provides the exact functionality needed for real-time filtering scenarios while maintaining the performance characteristics essential for high-throughput applications.

Note, there was no goal here to say that CEL is bad – no, it's an awesome tool for many use cases including existing usages in Centrifugo. Just for this specific case of publication filtering in Centrifugo we needed something more performance predictable and programmable.

The filtering by tags is available starting from Centrifugo v6.4.0, with [the documentation available](/docs/server/publication_filtering). For now, it's supported only in Javascript SDK, but we plan to add support in other SDKs too depending on demand.
