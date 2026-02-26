---
description: "Centrifugo publication filtering by tags. Reduce bandwidth by delivering only matching messages to subscribers using server-side filter expressions."
id: publication_filtering
sidebar_label: Publication filtering
title: Channel publication filtering
---

Publication filtering allows clients to subscribe to a channel with a filter, ensuring that only publications with tags matching the specified criteria are delivered to the subscriber. This feature **can significantly reduce bandwidth usage** and minimize client-side processing overhead by filtering out irrelevant messages at the server level.

![publication filtering](/img/publication_filtering.png)

:::info Optimization feature

Publication filtering is designed purely for **bandwidth and performance optimization**. It is not a security feature and should not be used for access control or data protection. Channel-level security and permissions should be managed through Centrifugo's authentication and authorization mechanisms. Channel subscribers can read all the data in a channel!

:::

When combined with channels that publish messages with data tags, publication filtering enables fine-grained content delivery based on subscriber interests and requirements.

## Implementation notes

- Publication filtering works only with client-side subscriptions at this point.
- Publication filtering is only supported by `centrifuge-js` for now, [see below the examples](#usage-in-real-time-sdk)
- Publication filtering cannot be used together with [delta compression](./delta_compression.md) in the same channel – both features serve as alternative approaches for bandwidth optimization and are mutually exclusive in Centrifugo.
- It is recommended to avoid the design where a single subscriber to channel can not keep up with all the messages in the channel if filter is not used. Filter should be used as a bandwidth optimization, mostly in scenarios where client already skips some messages received from the channel. Or at least make sure that you don't have scenarios in the app where a subscriber is overwhelmed with messages from the channel – this results into bad UX and disconnections with `slow` reason. Remember – Centrifugo is a client-facing PUB/SUB system, where each channel publication is processed by each subscriber. It's a pattern completely different from "Queue" where large volume of messages in topic may be shared over many consumers thus each consumer only processes a fraction of messages achieving high throughput in terms of a single topic.
- Publication filtering works seamlessly with Centrifugo's automatic recovery mechanisms: in case of successful recovery, only publications matching the filter are returned during [stream recovery](./history_and_recovery.md#automatic-message-recovery), and only the latest matching publication is returned when using [cache recovery mode](./cache_recovery.md).
- Centrifugo tag filters designed to be zero-allocation during publication broadcast towards many subscribers, the CPU overhead of using filter must be negligible for most setups. Having filters adds memory overhead for each subscription since Centrifugo need to keep them during the entire lifetime of the connection.
- See more details about the decisions made in the [Publication filtering by tags - reducing bandwidth with server-side stream filtering](/blog/2025/10/14/server-side-publication-filtering-by-tags) blog post.

## Enable publication filtering

To allow clients the usage of publication tags-based filtering in a channel, you need to enable the feature in your Centrifugo configuration by setting the `allow_tags_filter` option to `true` for the desired namespace.

Example configuration:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "market",
        "allow_tags_filter": true
      }
    ]
  }
}
```

## How it works

Publication filtering is based on **tags** – a `map[string]string` attached to each publication. When publishing a message, you can include tags as metadata, and subscribers can specify filters to receive only publications with tags that match their criteria.

The filtering system uses a tree-based filter structure that supports:
- **Comparison operations**: equality, inequality, existence checks, string operations, numeric comparisons
- **Logical operations**: AND, OR, NOT combinations
- **Set operations**: membership checks

Filters are defined using a tree structure where each node can be either a comparison operation (leaf node) or a logical operation (branch node). The filter is passed to the subscription request and evaluated server-side for each publication.

### FilterNode structure

Tags filter may be represented in the client protocol using `FilterNode` object. It may be set in client-side subscribe request. Here is its structure:

| Field name | Field type | Description |
|------------|------------|-------------|
| `op` | `string` | Operation type: skip for leaf node (comparison), `"and"` for logical AND, `"or"` for logical OR, `"not"` for logical NOT |
| `key` | `string` | Key for comparison (required for leaf nodes, not used for logical operations) |
| `cmp` | `string` | Comparison operator for leaf nodes (required when `op` is empty). See comparison operators table below |
| `val` | `string` | Single value used in most comparisons (e.g. `eq`, `neq`, `gt`, etc.) |
| `vals` | `array[string]` | Multiple values used for set comparisons (`in`, `nin`) |
| `nodes` | `array[FilterNode]` | Child nodes, only for logical operations (`and`, `or`, `not`) |

While it may seem complex, below you will see many examples which should make things crystal clear.

### Comparison operators

Here's how different filter operators work:

| Operator | Description | Notes |
|----------|-------------|-------|
| `eq` | Equal to value |  |
| `neq` | Not equal to value |  |
| `in` | Value is in list | Uses `vals` array field |
| `nin` | Value is not in list | Uses `vals` array field |
| `ex` | Key exists | No `val` or `vals` field needed |
| `nex` | Key does not exist | No `val` or `vals` field needed |
| `sw` | String starts with |  |
| `ew` | String ends with |  |
| `ct` | String contains |  |
| `gt` | Numerically greater than | Tag value must be numeric, otherwise value is skipped |
| `gte` | Numerically greater than or equal | Tag value must be numeric, otherwise value is skipped |
| `lt` | Numerically less than | Tag value must be numeric, otherwise value is skipped |
| `lte` | Numerically less than or equal | Tag value must be numeric, otherwise value is skipped |

Let's say we have a publication with these tags:
```json
{
  "ticker": "AAPL",
  "source": "NASDAQ",
  "price": "150.25",
  "category": "tech",
  "volume": "1000"
}
```

**Filter structure examples (all match the example tags above):**

```json
// Equal: ticker = "AAPL" → ✅ Matches (ticker is "AAPL")
{"key": "ticker", "cmp": "eq", "val": "AAPL"}

// Not equal: source != "TEST" → ✅ Matches (source is "NASDAQ", not "TEST")
{"key": "source", "cmp": "neq", "val": "TEST"}

// In list: category in ["tech", "finance"] → ✅ Matches (category is "tech")
{"key": "category", "cmp": "in", "vals": ["tech", "finance"]}

// Not in list: ticker not in ["MSFT", "GOOGL"] → ✅ Matches (ticker "AAPL" not in list)
{"key": "ticker", "cmp": "nin", "vals": ["MSFT", "GOOGL"]}

// Key exists: price exists → ✅ Matches (price field exists)
{"key": "price", "cmp": "ex"}

// Key does not exist: internal_id does not exist → ✅ Matches (no internal_id field)
{"key": "internal_id", "cmp": "nex"}

// String starts with: ticker starts with "AA" → ✅ Matches ("AAPL" starts with "AA")
{"key": "ticker", "cmp": "sw", "val": "AA"}

// String ends with: source ends with "DAQ" → ✅ Matches ("NASDAQ" ends with "DAQ")
{"key": "source", "cmp": "ew", "val": "DAQ"}

// String contains: category contains "ec" → ✅ Matches ("tech" contains "ec")
{"key": "category", "cmp": "ct", "val": "ec"}

// Greater than: price > 100 → ✅ Matches (150.25 > 100)
{"key": "price", "cmp": "gt", "val": "100"}

// Greater than or equal: volume >= 1000 → ✅ Matches (1000 >= 1000)
{"key": "volume", "cmp": "gte", "val": "1000"}

// Less than: price < 200 → ✅ Matches (150.25 < 200)
{"key": "price", "cmp": "lt", "val": "200"}

// Less than or equal: volume <= 1000 → ✅ Matches (1000 <= 1000)
{"key": "volume", "cmp": "lte", "val": "1000"}
```

### Logical operators

| Operator | Description |
|----------|-------------|
| `and` | All child conditions (in `nodes`) must be true |
| `or` | At least one child condition (in `nodes`) must be true |
| `not` | Inverts the result of a single child condition (only one `node` in `nodes` expected) |


Let's say we have a publication with these tags:
```json
{
  "ticker": "AAPL",
  "source": "NASDAQ",
  "price": "150.25",
  "category": "tech",
  "volume": "1000"
}
```

**Logical filter structure examples (all match the example tags above):**

```json
// ticker = "AAPL" AND category = "tech" → ✅ Matches (both conditions true)
{
  "op": "and",
  "nodes": [
    {"key": "ticker", "cmp": "eq", "val": "AAPL"},
    {"key": "category", "cmp": "eq", "val": "tech"}
  ]
}

// ticker = "MSFT" OR category = "tech" → ✅ Matches (category = "tech" is true)
{
  "op": "or",
  "nodes": [
    {"key": "ticker", "cmp": "eq", "val": "MSFT"},
    {"key": "category", "cmp": "eq", "val": "tech"}
  ]
}

// NOT (source = "NYSE") → ✅ Matches (source is "NASDAQ", not "NYSE")
{
  "op": "not",
  "nodes": [
    {"key": "source", "cmp": "eq", "val": "NYSE"}
  ]
}
```

### Validation and error handling

Filters are validated when a subscription is established. Invalid filters result in subscription rejection with `ErrorBadRequest`. Common validation issues include:

- Missing comparison operator for leaf nodes
- Missing key for comparison operations (except existence checks)
- Empty value lists for `in`/`nin` operations
- Invalid operator or comparison values
- Incorrect child node counts for logical operations

During runtime evaluation, invalid numeric values for numeric comparisons cause the filter to evaluate to `false`, ensuring graceful degradation.

## Publishing with tags

When publishing messages to channels (assuming Centrifugo runs on `localhost:8000`), include `tags` as part of [server API publish request](./server_api.md#publishrequest):

```bash
curl --header "X-API-Key: <API_KEY>" \
  --request POST \
  --data '{
    "channel": "market:stocks",
    "data": {
      "ticker": "AAPL",
      "source": "NASDAQ",
      "price": "150.25",
      "category": "tech"
    },
    "tags": {
      "ticker": "AAPL",
      "source": "NASDAQ",
      "price": "150.25"
    }
  }' \
  http://localhost:8000/api/publish
```

Note, tags are available on the client-side in incoming publication context – so it's not necessary to duplicate the same keys and values in both `data` and `tags`. The design to choose here is up to the application developers.

## Usage in real-time SDK

Now let's see how tags filters may be set in real-time SDK. Don't forget that usage of filters [must be explicitly enabled](#enable-publication-filtering) in server configuration for a namespace. 

:::info

At this moment only `centrifuge-js` SDK supports tags filter.

:::

### Basic tags filter

Subscribe to a channel and receive only publications for a specific ticker:

```javascript
const tagsFilter = {
    key: "ticker",
    cmp: "eq",
    val: "AAPL"
};

const sub = centrifuge.newSubscription("market:stocks", {
    tagsFilter: tagsFilter
});
```

### More complex tags filter

Use logical operators to create more sophisticated filters (using `op` field):

```javascript
// Receive AAPL stocks from NASDAQ only
const tagsFilter = {
    op: "and",
    nodes: [
        {
            key: "ticker",
            cmp: "eq",
            val: "AAPL"
        },
        {
            key: "source",
            cmp: "eq",
            val: "NASDAQ"
        }
    ]
};

const sub = centrifuge.newSubscription("market:stocks", {
    tagsFilter: tagsFilter
});
```

### Filter construction helper

For better type safety and code maintainability, consider using a filter construction helper (it's not part of `centrifuge-js` at this point):

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
```

Usage example:

```javascript
// ticker = "AAPL"
const tagsFilter = Filter.eq("ticker", "AAPL"); 

const sub = centrifuge.newSubscription("market:stocks", {
    tagsFilter: tagsFilter
});
```

Or more complex:

```javascript
// (ticker = "AAPL") AND (price >= "100") AND (source in ["NASDAQ", "NYSE"])
const tagsFilter = Filter.and(
  Filter.eq("ticker", "AAPL"),
  Filter.gte("price", "100"),
  Filter.in("source", ["NASDAQ", "NYSE"])
);

const sub = centrifuge.newSubscription("market:stocks", {
    tagsFilter: tagsFilter
});
```
