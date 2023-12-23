---
id: recovery
sidebar_label: "Missed messages recovery"
title: "Missed messages recovery"
---

At this point we already have a real-time application with an instant delivery of events towards interested messenger users. Now let's work on reliable message delivery a bit. First step would be enabling Centrifugo automatic message recovery for personal channels.

This will let connections automatically recover missed messages due to short network disconnections, like when moving in the metro with limited mobile internet coverage, etc. Also, it will help to recover messages due to disconnections upon Centrifugo node restart (in case of using Redis Engine).

But the most important thing about auto recovery is that it help to survive mass reconnect scenarios. This may happen when some load balancer in the infrastructure level reloaded – all connections towards your app is then dropped and try to re-establish. In some cases, like our messenger app, clients want to load the latest state and this may result into lots of requests to your main database (more connections => larger burst of requests in a short time). Centrifugo provides efficient recovery from history cache thus may help your backend to deal with such scenarios. This is especially useful if the backend is written in Django as you can have many WebSocket connections but still reasonable number of Django app processes.

To do this we need to extend Centrifugo `personal` namespace configuration:

```json
{
    ...
    "namespaces": [{
        "name": "personal",
        "history_size": 300,
        "history_ttl": "600s",
        "force_recovery": true
    }]
}
```

We set `history_size` and `history_ttl` to some reasonable values, also enebled auto recovery for channels in `personal` namespace. This configuration is enough for recovery to start working in our app - without any changes on the frontend side.

Now if client temporary looses internet connection and then comes back online – Centrifugo will redeliver client all the publications from last seen publication offset. It's also possible to set initial offset (if known) when creating subscription object. The feature is described in detail in [History and recovery](../server/history_and_recovery.md) chapter.

If client was offline for a long time or there were mode than 300 publications while client was offline Centrifugo understands that it can't recover client's state. In this case Centrifugo sets a special flag to `subscribed` state event context. We can handle it and suggest client to reload the app:

```javascript
sub.on('subscribed', (ctx: SubscribedContext) => {
  if (ctx.wasRecovering && !ctx.recovered) {
    setUnrecoverableError('State LOST - please reload the page')
  }
})
```

So the idea here that in most case Centrifug message history cache will help clients catch up, in some cases though clients still need to load state from scratch from the main database. So that we effectively solve mass reconnect problem.

Also note, that message history cache in Centrifugo Memory Engine used in the example does not survive Centrifugo node restarts – so clients will get `"recovered": false` upon reconnecting after Centrifugo restart. This is where Redis Engine has an advantage – it allows message hostory to survive Centrifugo node restarts.

In the next chapter we will discuss one more aspect of reliable message delivery - on the way between backend and Centrifugo.
