---
title: App-owned state with stream subscriptions
tags: [centrifugo, websocket, docsync]
description: When the data already lives in your own database, Centrifugo only has to deliver change events. The hard part is the seam between loading the state and going live. The getState callback on stream subscriptions closes that seam — capture the position first, load the data, and let the SDK handle every reconnect after that. With two worked examples — a Kafka aggregator and per-tenant kitchen orders.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/docsync_cover.jpg
hide_table_of_contents: false
---

Most real-time features start from data that already exists. Orders in an `orders` table, notifications, a document, a ticket queue. The browser needs two things: the current state, and every change from that moment on. The state usually comes from an HTTP endpoint, the changes come from a WebSocket subscription.

Each step is simple on its own. The seam between them is where the bugs live — and that seam is the same in every app that owns its state.

<!--truncate-->

## Where the seam is

Load the state, then subscribe, and three things can go wrong.

**A gap in time.** Between the HTTP response and the subscribe command, updates keep happening. They are not in the loaded snapshot, and the subscription started too late to see them. The component stays wrong until the page is reloaded.

**Lost stream continuity.** After a reconnect the SDK asks Centrifugo to replay missed publications. Usually it can. Sometimes it can't — the history window has moved on, or the stream epoch changed. Then the subscription reports `recovered: false`, and the application has to reload from the backend. While that reload is in flight, new publications keep arriving — the same race as on first load, now on every reconnect.

**Ordering between the two sources.** A publication that arrives while a fetch is running has to be applied after the fetch result, not before, or the fresh value gets overwritten by the older one.

None of this is Centrifugo-specific: any system that combines "fetch a snapshot" with "subscribe to a feed" has to answer it. [Proper real-time document state synchronization](/blog/2024/06/03/real-time-document-state-sync) walked through solving it by hand — buffering publications during the fetch, tracking versions, re-syncing on lost continuity. It works, and it is a fair amount of code to write in every client.

Stream subscriptions now have this built in.

## The getState callback

`getState` is an option on a stream subscription. The SDK calls it before subscribing. The callback loads the application state and returns the stream position that state corresponds to:

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

That is the whole integration. The application answers one question — "what is my state, and at which stream position was it taken?" — and the SDK does the rest.

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

The behaviour is worth spelling out, because it decides how much the application has to handle.

**On the first subscribe**, `getState` runs, and the SDK subscribes with recovery from the returned position. Everything published after that position arrives through the normal `publication` handler — the catch-up and the live stream look identical to the application.

**On a normal reconnect**, `getState` is *not* called. The SDK already holds a valid position and lets the server replay the gap from channel history. This is the point of recovery in the first place: a mass reconnect is absorbed by the broker instead of turning into a thundering herd on the application database.

**When recovery is impossible**, `getState` runs again. This is the part that removes the manual re-sync path. A subscription with `getState` asks the server to *reject* a subscribe it cannot recover, instead of accepting it and reporting `recovered: false`. The server answers with the `unrecoverable position` error, the SDK drops its saved position, and the next subscribe attempt calls `getState` again — fresh state, fresh position, recovery from there. There is no window where the subscription is live but the state under it is stale.

**When `getState` itself fails** — network error, database timeout — the SDK emits a subscription error and retries with the usual backoff. A failing state load never leaves a half-subscribed component behind.

## Read the position first

The order inside the callback matters, and it is the one rule the application has to get right: **read the stream position before reading the data**.

Doing it in that order makes the position a lower bound. Anything committed between the two reads shows up twice: once inside the loaded data, once again as a catch-up publication. Overlap is harmless, a gap is not — and reading the data first would produce exactly that gap.

So the application must tolerate replay. Most update shapes do this naturally:

- **Absolute values.** "Status is `shipped`", "price is 42.17". Applying it twice changes nothing.
- **Keyed upserts with a version or timestamp.** Apply by `id`, keep the newer `updated_at`. Last write wins.
- **Offset-based dedup.** Store the offset the state was loaded at and drop publications at or below it. Needed when updates are deltas — "add 3 items" is not safe to apply twice.

There is also a way to remove the overlap entirely if the data source is a single relational database: wrap both reads in one `REPEATABLE READ` transaction. Both statements then see the same MVCC snapshot, so the returned position is the exact watermark of the loaded data, and catch-up delivers only what was committed strictly after it. Nothing to reconcile, at the cost of a transaction on the read path.

## Where the position comes from

`getState` needs an `offset` and an `epoch` for the channel. Two ways to get them.

**Any broker — the server API.** A `history` call without a `limit` returns just the current stream position, no publications:

```bash
curl -X POST http://localhost:8000/api/history \
  -H "X-API-Key: <key>" \
  -d '{"channel": "orders:user_42"}'
```

```json
{"result": {"offset": 174, "epoch": "xcf4"}}
```

The application's own endpoint calls this, then reads its data, then returns both to the client. Clients never talk to the Centrifugo API directly.

**PostgreSQL broker — a SQL function.** With the [PostgreSQL stream broker](/docs/server/engines#postgresql-broker) the position lives in the same database as the data, so both reads happen in one place — and, if wanted, in one transaction:

```sql
SELECT * FROM cf_stream_top_position('orders:user_42');

SELECT id, status, updated_at FROM orders WHERE user_id = 42;
```

This is what makes the PostgreSQL broker a natural fit for app-owned state: the position and the rows share a transaction boundary, so the `REPEATABLE READ` trick above becomes a two-line change. The write side has the same property — `cf_stream_publish` commits the publication together with the row it announces, which is the subject of [Transactional publishing for stream subscriptions with PostgreSQL](/blog/2026/05/24/pg-stream-broker-benefits).

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

The history window only has to cover the reconnect gap, not the data's lifetime. Anything longer than that is served by `getState` reloading from the application database — which is the correct division of labour, since channel history is a bounded cache and the application database is the source of truth.

Alternatively use [`allow_recovery`](/docs/server/channels#allow_recovery) and let clients opt in per subscription with the `recoverable` option.

## Two worked shapes

The rules above are short. Two examples show how they land in real systems. Both use the PostgreSQL stream broker, so the write side is transactional too — but the read side is the same with any broker.

### An upstream feed shaped into stored views

The first is a service that consumes a Kafka topic and maintains aggregated views in PostgreSQL — say, a price board built from a market-data topic. The browser needs the current aggregate, then live updates.

The obvious wiring is to point Centrifugo at the same Kafka topic and let it fan events out to subscribers in parallel with the aggregator. That works, but it leaves two unrelated offset spaces to bridge: the snapshot row stores a Kafka offset, the live subscription speaks Centrifugo offsets, and the client has to subscribe with a recent stream position and discard everything older than the snapshot's Kafka offset. The bridging logic is awkward and easy to get subtly wrong.

Making the aggregator the publisher collapses the bridge. For each Kafka batch it processes, the aggregator does both things in one PostgreSQL transaction: the snapshot `UPDATE` and a `cf_stream_publish(...)` for the new events. The stored aggregate and the change stream can never disagree about what has been observed, and the snapshot row stays minimal — just the aggregate, no offset bookkeeping.

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

The read path is the recipe from earlier: `cf_stream_top_position` first, then the snapshot, then return the captured position. Events committed between the two reads arrive as catch-up on top of the snapshot. For a price board that reconciles itself — each event carries an absolute price, not a delta. If the events were deltas instead, the `REPEATABLE READ` variant removes the overlap and the need for dedup.

This shape fits any upstream feed being turned into stored views — Kafka, NATS, CDC, a polling worker. One process owns both the stored aggregate and the change stream, so there is no cross-system offset bridge left to maintain.

### Internal writes partitioned by tenant

The second flavour is more common still: one shared table, many independent consumers. The [kitchen-orders demo](/blog/2026/05/24/pg-stream-broker-benefits#a-concrete-example-per-tenant-channels) is a clean example — a single `orders` table across all restaurants, one channel per restaurant (`kitchen:{restaurant_id}`), and each kitchen display subscribed to its own. On the write side the rule is short: every code path that mutates a row for restaurant X publishes on `kitchen:X` in the same transaction.

The read side behind `getState` is the position-first recipe, with the data filtered by restaurant:

```sql
SELECT * FROM cf_stream_top_position('kitchen:42');

SELECT id, status, items, updated_at
FROM orders
WHERE restaurant_id = 42
  AND status IN ('received','preparing','ready');
```

Events carry `order_id` and `updated_at`, so the client applies them as upserts with last-write-wins — the keyed-upsert case from the overlap rules, which makes catch-up replay harmless. No offsets stored in the application schema, no dedup bookkeeping: the position is captured at read time and handed to the SDK.

The same client code serves every restaurant. Only the channel name and the `WHERE` clause change — which is what makes this shape scale to thousands of tenants without any per-tenant machinery.

## When app-owned state is the wrong shape

This pattern assumes the data has a home in the application's schema. Plenty of real-time data does not: cursors that exist for a few seconds, presence sets, lobby members, device telemetry, feature flags. Building a table, a snapshot endpoint, and a change feed for each of those is a lot of machinery for state that is disposable by nature.

For those, the broker can be the store instead — see [map subscriptions](/docs/server/map_subscriptions) for keyed collections, and [cache recovery mode](/docs/server/cache_recovery) when a channel only ever needs its latest value.

The rule of thumb: if a `SELECT` in your own database can already answer "what is the current state", `getState` on a stream subscription is the smaller design. If it can't, look at the state-carrying subscription types.

## Availability

The `getState` callback is available in Centrifugo v6.8.0+ and is supported by all bidirectional SDKs — [JavaScript](https://github.com/centrifugal/centrifuge-js), [Dart](https://github.com/centrifugal/centrifuge-dart), [Swift](https://github.com/centrifugal/centrifuge-swift), [Go](https://github.com/centrifugal/centrifuge-go), [Java](https://github.com/centrifugal/centrifuge-java), [Python](https://github.com/centrifugal/centrifuge-python).

See the [Subscription getState](/docs/transports/client_api#subscription-getstate) API reference for the option details, and the [pg_stream_broker example](https://github.com/centrifugal/examples/tree/master/v6/pg_stream_broker) for a runnable app built on this pattern.
