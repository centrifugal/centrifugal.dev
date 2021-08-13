---
id: design
title: Design overview
---

Let's discuss some architectural and design topics about Centrifugo.

## Idiomatic usage

Centrifugo has been designed as a real-time transport without long-term persistence in mind. Idiomatic Centrifugo usage requires having the main application database from which initial and actual state can be loaded at any point in time.

Originally Centrifugo was built with the unidirectional flow as the main approach – where application data travels only from server to a client. All requests that generate new data first go to the application backend (for example over AJAX call of backend API), where a backend can validate the message, process it, save it into a database for long-term persistence – and then published from a backend side to Centrifugo API. During Centrifugo v2 life cycle this paradigm changed a bit, so it's now possible to send RPC requests from client to Centrifugo and it will be then proxied to the application backend. Also, connection requests or publications to channels can be proxied. So at the moment, the number of possible integration ways increased.

Message history Centrifugo feature designed to hold only a reasonably small number of last messages in a channel. History helps to reduce the load on the main application database when all users reconnect at once (in case of load balancer configuration reload, Centrifugo restart, temporary network problems, etc) – since such disconnects are usually pretty short in time having a reasonably small number of messages cached in history is sufficient.

## Message delivery model

By default, the message delivery model of Centrifugo is at most once. With the position/recovery feature enabled it's possible to achieve at least once guarantee within history retention time and size. After abnormal disconnect clients have an option to recover missed messages from the publication stream cache that Centrifugo maintains (depending on the engine used this cache can leave in Redis for example).

Without recovery feature enabled a message sent to Centrifugo can be theoretically lost while moving towards clients. Centrifugo tries to do its best to prevent message loss on a way to online clients, but the application should tolerate a loss. 

As noted Centrifugo has a feature called message recovery to automatically recover messages missed due to short network disconnections. Also, it compensates at most once delivery of Redis PUB/SUB by using additional publication offset checks and periodic offset synchronization.

At this moment Centrifugo message recovery is designed for a short-term disconnect period (think no more than one hour for a typical chat application). After this period (which can be configured per channel basis) Centrifugo removes messages from the channel history cache. In this case, Centrifugo may tell the client that some messages can not be recovered, so your application state can be loaded from the main database.

It is recommended to design an application in a way that users don't even notice when Centrifugo does not work at all. Use graceful degradation. For example, if a user posts a new comment over AJAX call to your application backend - you should not rely only on Centrifugo to receive a new comment from a channel and display it - you should return new comment data in AJAX call response and render it. This way user that posts a comment will think that everything works just fine. Be careful to not draw comments twice in this case - think about idempotent identifiers for your entities.

## Message order guarantees

Message order in channels is guaranteed to be the same while you publish messages into channel one after another or publish them in one request. If you do parallel publications into the same channel then Centrifugo can't guarantee message order since those may be processed in different goroutines.
