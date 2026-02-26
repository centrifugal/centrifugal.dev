---
description: "Enable automatic missed message recovery in Centrifugo using history cache to handle disconnections and mass reconnect scenarios reliably."
id: recovery
sidebar_label: "Missed messages recovery"
title: "Missed messages recovery"
---

At this point, we already have a real-time application with the instant delivery of events to interested messenger users. Now, let's focus on ensuring reliable message delivery. The first step would be enabling Centrifugo's automatic message recovery for personal channels.

Enabling this feature allows connections to automatically recover missed messages due to brief network disconnections, such as when moving through areas with limited mobile internet coverage, and it aids in recovering messages after disconnections caused by a Centrifugo node restart (in the case of using the Redis Engine).

The most crucial aspect of auto recovery is its ability to handle mass reconnect scenarios. This situation might occur when a load balancer at the infrastructure level is reloaded, causing all connections to your app to be dropped and attempting to re-establish. In cases like our messenger app, clients want to load the latest state, leading to numerous requests to your main database (more connections result in a larger burst of requests in a short time). Centrifugo efficiently recovers from the history cache, helping your backend manage such scenarios. This is particularly valuable if the backend is written in Django, allowing for many WebSocket connections with a still reasonable number of Django app processes.

To implement this, we need to extend the Centrifugo `personal` namespace configuration:

```json
{
  ...
  "channel": {
    "namespaces": [
      {
        "name": "personal",
        "history_size": 300,
        "history_ttl": "600s",
        "force_recovery": true
      }
    ]
  }
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
