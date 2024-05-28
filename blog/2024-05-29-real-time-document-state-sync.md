---
title: Proper real-time document state synchronization within Centrifugal ecosystem
tags: [centrifugo, centrifuge, websocket, docsync]
description: A simple yet cool example of document state synchronization on top of Centrifugal stack. The end goal is to effectively and reliably synchronize document state to application users – to avoid race condition between state load and updates coming from the real-time subscription.
author: Alexander Emelin
authorTitle: Founder of Centrifugal Labs
authorImageURL: /img/alexander_emelin.jpeg
image: /img/docsync_cover.png
hide_table_of_contents: false
draft: true
---

<img src="/img/docsync_cover.png" />

Centrifugo and its main building block Centrifuge library for Go both provide a way for clients to receive a stream of events in channels using Subscription objects. Also, there is an automatic history recovery feature which allows clients catching up with missed publications after the reconnect to the WebSocket server and restore the state of a real-time component. While the continuity in the stream is not broken clients can avoid re-fetching a state from the main application database – which optimizes a scenario when many real-time connections reconnect all within a short time interval (for example, during a load balancer restart) by reducing the excessive load on the application database.

Usually, our users who use recovery features load the document state from the backend, then establish a real-time Subscription to apply changes to the component state coming from the real-time channel. After that the component stays synchronized, even after network issues – due to Centrifugo recovery feature the document state becomes actual again since client catches up the state from the channel history stream.

There are several hidden complexities in the process though and things left for users to implement. We want to address those here.

## Complexities in state sync

### Gap in time

The first edge case comes from the fact that there is a possible gap in time between initial loading of the state from the main app database and real-time subscription establishment. Some messages could be published in between of state loading and real-time subscription establishment. So there is a chance that due to this gap in time the component will live in the inconsistent state until the next application page reload. For many apps this is not critical at all, or due to message rates happens very rarely. But in this post we will look at the possible approach to avoid such a case.

Or imagine a situation when state is loaded, but real-time subscription is delayed due to some temporary error. This increases a gap in time and a chance to miss an intermediary update.

Centrifugo channel stream offsets are not binded to the application business models in any way, so it's not possible to initially subscribe to the real-time channel and receive all updates happened since the snapshot of the document loaded from the database. There is a way to solve this though, we will cover it shortly.

### Re-sync upon lost continuity

Another complexity which is left to the user is the need to react on `recovered: false` flag provided by the SDK when client can not catch up the state upo re-subscription. This may happen due to channel history retention configuration, or simply because history was lost. In this case our SDKs provide users `wasRecovering: true` and `recovered: false` flags, and we suggest re-fetching the document state from the backend in such cases. But while you re-fetch the state you are still receiving real-time updates from the subscription – which leads us to something similar to the problem described above, same race conditions may happen leaving the component in the inconsistent state until reload.

### Late delivery of real-time updates

One more possible problem to discuss is a late delivery of real-time messages.

When you want to reliably stream document changes to Centrifugo (without loosing any update, due to temporary network issues for example) and keep the order of changes (to not occasionally apply property addition and deletion is different order on the client side) your best bet is using transactional outbox or CDC approaches. So that changes in the database are made atomic and there is a guarantee that the update will be soon issued to the real-time channel of Centrifuge-based server or Centrifugo. Usually transactional outbox or CDC can also maintain correct order of event processing, thus correct order of publising to the real-time channel.

But this means that upon loading a real-time component it may receive non-actual real-time updates from the real-time subscription – due to outbox table or CDC processing lag. We need a way for the client side to understand whether the update must be applied to the document state or not. Sometimes it's possible to understand due to the nature of component. Like receiving an update with some identifier which already exists in the object on client side. But what if update contains deletion of some property of object? This will mean that object may rollback to non-actual state, then will receive next real-time updates which will move it to back to the actual state. We want to avoid such modifications leading to temporary state glitches at all. Not all cases allow having idempotent real-time updates.

Even when you are not using outbox/CDC you can still hit a situation of late real-time message delivery. Let's suppose you publish messages to Centrifugal channel synchronously over server publish API reducing the chance of having a lag from the outbox/CDC processing. But the lag may still present. Because while message travelling towards subscriber through Centrifugo, subscriber can load a more freshy initial state from the main database and subscribe to the real-time channel.

## Core principles of solution

In this post we will write a `RealTimeDocument` JavaScript class designed to synchronize a document state. This class handles initial data loading, real-time updates, and state re-synchronization when required. It should solve the problems described above.

The good thing is that this helper class is compact enough to be implemented in any programming language, so you can apply it (or the required part of it) for other languages where we already have real-time SDKs.

We will build the helper on top of several core principles:

* The document has an incremental version which is managed atomically and transactionally on the backend
* Initial state loading returns document state together with the current version, loading happens with at least `read committed` transactional isolation level (default in many databases, ex. PostgreSQL)
* All real-time updates published to the document channel have the version attached, and updates are published to the channel in the correct version order.

We already discussed the approach in our [Grand tutorial](/docs/tutorial/intro) – but now want to generalize it as a re-usable pattern.

After writing a `RealTimeDocument` wrapper we will apply it to a simple example of synchronizing counter increments across multiple devices reliably to demonstrate it works. Eventually we get best from two worlds – leveraging Centrifugo publication cache to avoid excessive load on the backend upon massive reconnect and proper document state in all scenarios.

## Top-level API of RealTimeDocument

```javascript
const subscription = centrifuge.newSubscription('counter', {});

const realTimeDocument = new RealTimeDocument({
    subscription, // Wraps Subscription.
    load: async (): Promise<{ document: any; version: number }> => {
        // Must load the actual document state and version from the database.
        // Ex. return { document: result.document, version: result.version };
    },
    applyUpdate: (currentDocument: any, update: any): any => {
        // Must apply update to the document.
        // currentDocument.value += update.increment;
        // return currentDocument;
    },
    compareVersion: (currentVersion: number, update: any): number | null => {
        // Must compare versions in real-time publication and current doc version.
        // const newVersion = publication.data.version;
        // return newVersion > currentVersion ? newVersion : null;
    },
    onChange: (document: any) => {
        // Will be called once the document is loaded for the first time and every time
        // the document state is updated. This is where application may render things
        // based on the document data.
    }
});

realTimeDocument.startSync();
```

## Implementing solution

To address the gap between state load and real-time subscription establishment the obvious solution which is possible with Centrifugal stack is to make the real-time subscription first, and only after that load the state from the backend. This eliminates the possibility to miss messages. But until the state is loaded we need to buffer real-time publications and then apply them to the loaded state.

Here is where the concept of having incremental document version helps – we can collect messages in the buffer, and then apply only those with version greater than current document version. So that the object will have the correct state after the initial load.

Here is how we can process real-time publications:

```javascript
this.#subscription.on('publication', (ctx) => {
    if (!this.#isLoaded) {
        // Buffer messages until initial state is loaded.
        this.#messageBuffer.push(ctx);
        return;
    }
    // Process new messages immediately if initial state is already loaded.
    const newVersion = this.#compareVersion(ctx.data, this.#version);
    if (newVersion === null) {
        // Skip real-time publication, non actual version.
        return;
    }
    this.#document = this.#applyUpdate(this.#document, ctx.data);
    this.#version = newVersion;
    this.#onChange(this.#document);
}
```

And we also need to handle `subscribed` event properly and load the initial document state from the backend:

```javascript
this.#subscription.on('subscribed', (ctx) => {
    if (ctx.wasRecovering) {
        if (ctx.recovered) {
            // Successfully re-attached to a stream, nothing else to do.
        } else {
            // Re-syncing due to failed recovery.
            this.#reSync();
        }
    } else {
        // Load data for the first time.
        this.#loadDocumentApplyBuffered();
    }
})
```

For the initial load `this.#loadDocumentApplyBuffered()` will be called. Here is how it may look like:

```javascript
async #loadDocumentApplyBuffered() {
    try {
        const result = await this.#load();
        this.#document = result.document;
        this.#version = result.version;
        this.#isLoaded = true;
        this.#processBufferedMessages();
    } catch (error) {
        // Retry the loading, in the final snippet it's implemented
        // and uses exponential backoff for the retry process.
    }
}
```

After loading the state we prosess buffered real-time publications inside `#processBufferedMessages` method:

```javascript
#processBufferedMessages() {
    this.#messageBuffer.forEach((msg) => {
        const newVersion = this.#compareVersion(msg, this.#version);
        if (newVersion) { // Otherwise, skip buffered publication.
            this.#document = this.#applyUpdate(this.#document, msg.data);
            this.#version = newVersion;
        }
    });
    // Clear the buffer after processing.
    this.#messageBuffer = [];
    // Only call onChange with final document state.
    this.#onChange(this.#document);
}
```

This way the initial state is loaded correctly. Note also, that version comparisons also help with handling late delivered real-time updates – we now simply skip them inside `on('publication')` callback.

Let's go back and look how to manage stream continuity loss:

```javascript
if (ctx.recovered) {
    // Successfully re-attached to a stream, nothing else to do.
} else {
    // Re-syncing due to failed recovery.
    this.#reSync();
}
```

In this case we call `#reSync` method:


```javascript
#reSync() {
    this.#isLoaded = false; // Reset the flag to collect new messages to the buffer.
    this.#messageBuffer = [];
    this.#loadDocumentApplyBuffered();
}
```

It basically clears up the class state and calls `#loadDocumentApplyBuffered` again – repeating the initial sync procedure.

That's it. Here is [a full code](https://raw.githubusercontent.com/centrifugal/centrifuge/master/_examples/document_sync/rtdocument.js) for the `RealTimeDocument` class. Note, it also contains backoff implementation to handle possible error while loading the document state from the backend endpoint.

## Let's apply it

I've made a [POC](https://github.com/centrifugal/centrifuge/tree/master/_examples/document_sync) with Centrifuge library to make sure this works.

In that example I tried to apply `RealTimeDocument` class to synchronize state of the counter. Periodically timer is incremented on a random value in range [0,9] on the backend and these increments are published to the real-time channel. Note, I could simply publish counter value in every publication over WebSocket – but intentionally decided to send counter increments instead. To make sure nothing is lost during state synchronization so counter value is always correct on the client side.

Here is a demo:

<div class="vimeo-full-width">
   <iframe src="/img/docsync.mp4" frameBorder="0" allow="autoplay; fullscreen" allowFullScreen></iframe>
</div>

Let's look at how `RealTimeDocument` class was used in the example:

```javascript
const counterContainer = document.getElementById("counter");

const client = new Centrifuge('ws://localhost:8000/connection/websocket', {});
const subscription = client.newSubscription('counter', {});

const realTimeDocument = new RealTimeDocument({
    subscription,
    load: async () => {
        const response = await fetch('/api/counter');
        const result = await response.json();
        return { document: result.value, version: result.version };
    },
    applyUpdate: (document, update) => {
        document += update.increment
        return document
    },
    compareVersion: (currentVersion, update) => {
        const newVersion = update.version;
        return newVersion > currentVersion ? newVersion : null;
    },
    onChange: (document) => {
        counterContainer.textContent = document;
    },
    debug: true,
});
client.connect();

// Note – we can call sync even before connect.
realTimeDocument.startSync();
```

Things to observe:

* We return `{"version":4823,"value":21656}` from `/api/counter`
* Send `{"version":4824,"increment":9}` over real-time channel
* Counter updated every 250 milliseconds, history size is 20, retention 10 seconds
* Upon going offline for a short period we see that `/api/counter` endpoint not called at all - state fully cought up from Centrifugo history stream
* Upon going offline for a longer period Centrifugo was not able to recover the state, so we re-fetched data from scratch and attached to the stream again. 

## Conclusion

In this post, we walked through a practical implementation of a `RealTimeDocument` class using Centrifugal stack for the real-time state synchronization to achieve proper eventually consistent state of the document when using real-time updates. We mentioned possible gotchas when trying to sync the state in real-time and described a generic solution to it.

You don't need to always follow the solution here. As I mentioned it's possible that your app does not require handling all these edge cases, or they could be handled in alternative ways – this heavily depends on your app business logic.

Note, that with some changes you can make `RealTimeDocument` class to behave properly and support graceful degradation behaviour. If there are issues with real-time subscription you can still load the document and display it, and then re-sync the state as soon as a real-time system becomes available (successful subscription).
