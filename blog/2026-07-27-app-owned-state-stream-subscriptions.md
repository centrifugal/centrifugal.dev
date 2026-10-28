---
title: App-owned state with stream subscriptions
tags: [centrifugo, websocket, docsync]
description: Describing the getState callback on stream subscriptions — capture the stream position first, load the data, and let the SDK handle every reconnect after that. With two worked examples — a Kafka aggregator and per-tenant kitchen orders.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/blog_get_state.jpg
hide_table_of_contents: false
---

Most real-time features start from data that already exists somewhere — orders in an `orders` table, notifications, a document, a ticket queue. To show it live, the browser needs two things: the current state, and every change that happens after. In a typical app the state comes from an HTTP endpoint and the changes come from a WebSocket subscription.

Each part is easy on its own. The hard part is joining them correctly, and it turns out to be hard in the same way in every application that keeps state in its own database.

<!--truncate-->

## What goes wrong

The natural approach is to load the state first and subscribe after. Three problems hide in this sequence.

The first is a gap in time. Between the moment the HTTP response was produced and the moment the subscription becomes active, updates keep happening. They are not in the loaded snapshot, and the subscription started too late to catch them, so they are simply lost. The component shows stale data until the user reloads the page.

The second one shows up later, on reconnects. After a network drop the SDK asks Centrifugo to replay the publications the client missed. Usually it can. But sometimes it can't — the client was offline longer than the history retention, or the stream epoch changed. The subscription then reports `recovered: false` and the application has to reload state from the backend. While that reload is in flight, new publications keep arriving — the same race as on the first load, except now it can happen on any reconnect.

The third is ordering between the two sources. If a publication arrives while the state fetch is still running, it has to be applied on top of the fetch result, not before it — otherwise a fresh value gets overwritten by an older one.

None of this is specific to Centrifugo: any system that combines "fetch a snapshot" with "subscribe to a feed" runs into the same three problems. [Proper real-time document state synchronization](/blog/2024/06/03/real-time-document-state-sync) showed how to solve them by hand — buffer publications during the fetch, track versions, re-sync when continuity is lost. It works, but it's a fair amount of code to repeat in every client.

Stream subscriptions now have this logic built in.

## The getState callback

`getState` is an option on a stream subscription. The SDK calls it before subscribing. Inside the callback the application loads its state and returns the stream position that state corresponds to:

```javascript
const sub = client.newSubscription('orders:user_42', {
  getState: async () => {
    // 1. Capture the stream position FIRST.
    const pos = await api.getStreamPosition('orders:user_42');
    // 2. Then load and render your data.
    renderOrders(await api.getOrders(42));
    // 3. Return the position — the SDK subscribes from exactly here.
    return { offset: pos.offset, epoch: pos.epoch };
  },
});

sub.on('publication', (ctx) => {
  // Incremental updates: catch-up first, then live.
  applyOrderUpdate(ctx.data);
});

sub.subscribe();
```

This is the entire integration. The application answers one question — what is the current state, and at which stream position was it taken — and the SDK takes care of everything else.

```
   getState()                    subscribe(recover from pos)
       │                                    │
       ▼                                    ▼
  ┌─────────┐   pos          ┌───────────────────────────┐
  │ App API │ ─────────────► │  catch-up publications    │──► live
  │  + DB   │   state        │  (offset > pos.offset)    │
  └─────────┘                └───────────────────────────┘
       ▲                                                     │
       │        recovery impossible — reload from scratch     │
       └─────────────────────────────────────────────────────┘
```

## What the SDK does with it

It's worth walking through the behaviour case by case, because it defines how much the application still has to handle on its own.

On the first subscribe, the SDK runs `getState` and subscribes with recovery from the returned position. Everything published after that position arrives through the normal `publication` handler, so catch-up publications and live ones look identical to the application.

On a normal reconnect, `getState` is not called. The SDK already holds a valid position, so it lets the server replay the missed publications from channel history. This is exactly what recovery exists for: when thousands of clients reconnect at once, the broker absorbs the load instead of the application database.

When recovery turns out impossible, `getState` runs again — and this is the part that replaces the manual re-sync code. A subscription with `getState` asks the server to reject a subscribe it cannot recover, instead of accepting it with `recovered: false`. The server responds with the `unrecoverable position` error, the SDK drops its saved position, and the next subscribe attempt calls `getState` again: fresh state, fresh position, recovery from there. At no point is the subscription live while the state under it is stale.

And if `getState` itself fails — a network error, a database timeout — the SDK emits a subscription error and retries with the usual backoff, so a failed state load never leaves a component half-subscribed.

## Read the position first

There is one rule the application has to get right inside the callback: read the stream position before reading the data.

In this order the position becomes a lower bound. Anything committed between the two reads shows up twice — once in the loaded data, and once more as a catch-up publication. Seeing an update twice is harmless, missing one is not, and reading the data first would produce exactly the kind of gap this whole mechanism exists to close.

Since duplicates are possible, the application must be able to apply the same update twice. Most update shapes already can:

- **Absolute values.** "Status is `shipped`", "price is 42.17". Applying it twice changes nothing.
- **Keyed upserts with a version or timestamp.** Apply by `id`, keep the newer `updated_at`. Last write wins.
- **Offset-based dedup.** Store the offset the state was loaded at and drop publications at or below it. This one is needed when updates are deltas — "add 3 items" is not safe to apply twice.

And when the data source is a single relational database, the overlap can be removed entirely: wrap both reads in one `REPEATABLE READ` transaction. Both statements then see the same MVCC snapshot, the returned position is the exact watermark of the loaded data, and catch-up delivers only what was committed strictly after it. Nothing left to reconcile, at the cost of a transaction on the read path.

## Where the position comes from

`getState` must return an `offset` and an `epoch` for the channel. There are two ways to get them.

With any broker, the server API works: a `history` call without a `limit` returns just the current stream position, without publications:

```bash
curl -X POST http://localhost:8000/api/history \
  -H "X-API-Key: <key>" \
  -d '{"channel": "orders:user_42"}'
```

```json
{"result": {"offset": 174, "epoch": "xcf4"}}
```

The application's own endpoint calls this, then reads its data, then returns both to the client. Clients never talk to the Centrifugo API directly.

With the [PostgreSQL stream broker](/docs/server/engines#postgresql-broker), the position lives in the same database as the data, so both reads happen in one place — and, if needed, in one transaction:

```sql
SELECT * FROM cf_stream_top_position('orders:user_42');

SELECT id, status, updated_at FROM orders WHERE user_id = 42;
```

This is what makes the PostgreSQL broker such a natural fit for app-owned state: the position and the rows share a transaction boundary, so the `REPEATABLE READ` trick above becomes a two-line change. The write side has the same property — `cf_stream_publish` commits the publication together with the row it announces, which was the subject of [Transactional publishing for stream subscriptions with PostgreSQL](/blog/2026/05/24/pg-stream-broker-benefits).

## Server configuration

`getState` builds on standard [history and recovery](/docs/server/history_and_recovery), so the channel namespace needs history and recovery enabled:

```json title="config.json"
{
  "channel": {
    "namespaces": [
      {
        "name": "orders",
        "history_size": 100,
        "history_ttl": "300s",
        "force_recovery": true
      }
    ]
  }
}
```

Note that the history window only has to cover the reconnect gap, not the lifetime of the data. Anything longer than that is served by `getState` reloading from the application database — which is the right split: channel history is a bounded cache, the application database is the source of truth.

Alternatively use [`allow_recovery`](/docs/server/channels#allow_recovery) and let clients opt in per subscription with the `recoverable` option.

## Two examples

The rules above are short, so here are two examples showing how they play out in real systems. Both use the PostgreSQL stream broker, which makes the write side transactional too — but the read side works the same with any broker.

### An upstream feed shaped into stored views

The first one is a service that consumes a Kafka topic and maintains aggregated views in PostgreSQL — say, a price board built from a market-data topic. The browser needs the current aggregate, then live updates.

The obvious wiring is to point Centrifugo at the same Kafka topic and let it fan events out to subscribers in parallel with the aggregator. That works, but it leaves two unrelated offset spaces to bridge: the snapshot row stores a Kafka offset, the live subscription speaks Centrifugo offsets, and the client has to subscribe with a recent stream position and throw away everything older than the snapshot's Kafka offset. This bridging logic is awkward and easy to get subtly wrong.

There is a simpler wiring: make the aggregator the publisher. For each Kafka batch it processes, it does both things in one PostgreSQL transaction — updates the snapshot and calls `cf_stream_publish(...)` for the new events. Now the stored aggregate and the change stream can never disagree about what has been observed, and the snapshot row stays minimal: just the aggregate, no offset bookkeeping.

```
─── Write path (single PG txn ties snapshot + publish) ───────────

   Kafka topic
       │ batch
       ▼
  ┌────────────┐
  │ Aggregator │
  └─────┬──────┘
        │   BEGIN
        │     UPDATE snapshot SET aggregate = ...
        │     cf_stream_publish(p_channel := ch, p_data := evt)
        │   COMMIT              ← both land atomically
        ▼
  ┌──────────────────────────────┐
  │          PostgreSQL          │
  │   ┌──────────┐ ┌──────────┐  │
  │   │ snapshot │ │cf_stream │  │
  │   │   row    │ │  outbox  │  │
  │   └──────────┘ └────┬─────┘  │
  └────────────────────┬┴────────┘
                       │ LISTEN/NOTIFY + poll
                       ▼
                 ┌──────────────┐
                 │  Centrifugo  │
                 │ (PG broker)  │
                 └──────────────┘


─── Read path (position first; catch-up applied idempotently) ────

  Browser ──1. GET /state──► App server
                                 │ pos  = cf_stream_top_position(ch)
                                 │ snap = SELECT aggregate FROM ...
  Browser ◄──── (snap, pos) ─────┘

  Browser ──2. subscribe(ch, since=pos)──► Centrifugo
  Browser ◄─── catch-up from pos → live ──┘
             (events committed between the two reads
              arrive here; idempotent apply reconciles)
```

The read path is the recipe from the previous sections: `cf_stream_top_position` first, then the snapshot, then return the captured position. Events committed between the two reads arrive as catch-up on top of the snapshot. A price board reconciles this on its own, since each event carries an absolute price rather than a delta. If the events were deltas, the `REPEATABLE READ` variant would remove the overlap along with the need for dedup.

The same shape fits any upstream feed being turned into stored views — Kafka, NATS, CDC, a polling worker. One process owns both the stored aggregate and the change stream, so there is no cross-system offset bridge to maintain.

### Internal writes partitioned by tenant

The second example is even more common: one shared table, many independent consumers. The [kitchen-orders demo](/blog/2026/05/24/pg-stream-broker-benefits#a-concrete-example-per-tenant-channels) shows it well — a single `orders` table across all restaurants, one channel per restaurant (`kitchen:{restaurant_id}`), and each kitchen display subscribed to its own channel. The write side follows one rule: every code path that changes a row for restaurant X publishes on `kitchen:X` in the same transaction.

The read side behind `getState` is the position-first recipe, with data filtered by restaurant:

```sql
SELECT * FROM cf_stream_top_position('kitchen:42');

SELECT id, status, items, updated_at
FROM orders
WHERE restaurant_id = 42
  AND status IN ('received','preparing','ready');
```

Events carry `order_id` and `updated_at`, so the client applies them as upserts with last-write-wins — the keyed-upsert case from the list above, which makes catch-up replay harmless. There are no offsets stored in the application schema and no dedup bookkeeping: the position is captured at read time and handed to the SDK.

The same client code serves every restaurant — only the channel name and the `WHERE` clause change. That's what lets this shape scale to thousands of tenants without any per-tenant machinery.

## When this pattern doesn't fit

The pattern assumes the data has a home in the application's schema. Plenty of real-time data does not: cursors that live for a few seconds, presence sets, lobby members, device telemetry, feature flags. Building a table, a snapshot endpoint and a change feed for each of those is a lot of machinery for state that is disposable by nature.

For such data the broker can act as the store instead — see [map subscriptions](/docs/server/map_subscriptions) for keyed collections, and [cache recovery mode](/docs/server/cache_recovery) when a channel only ever needs its latest value.

A simple rule of thumb: if a `SELECT` in your own database can already answer "what is the current state", then `getState` on a stream subscription is the smaller design. If it can't, look at the state-carrying subscription types.

## Availability

The `getState` callback is available in Centrifugo v6.8.0+ and is supported by all bidirectional SDKs — [JavaScript](https://github.com/centrifugal/centrifuge-js), [Dart](https://github.com/centrifugal/centrifuge-dart), [Swift](https://github.com/centrifugal/centrifuge-swift), [Go](https://github.com/centrifugal/centrifuge-go), [Java](https://github.com/centrifugal/centrifuge-java), [Python](https://github.com/centrifugal/centrifuge-python).

See the [Subscription getState](/docs/transports/client_api#subscription-getstate) API reference for the option details, and the [pg_stream_broker example](https://github.com/centrifugal/examples/tree/master/v6/pg_stream_broker) for a runnable app built on this pattern.
