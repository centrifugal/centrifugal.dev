---
id: scale
sidebar_label: "Scale to 100k room members"
title: "Scale to 100k room members"
---

We now have a working app, and we are done with the app development! 🎉

Now let's experiment a bit. Here we will try to look at some latency numbers for the room with 100k members. Not many apps will reach such scale, but we want to show that Centrifugo gives you a way to grow this big and still keep reasonable latency times and answers how to increase a system throughput.

We will start with 10k room members. Let's create fake users programatically and add them all to some room:

```python
TBD
```

Now, we have a room where each message must be broadcasted to 100k channels. In practice, in messenger application only small part of those members will be online at the moment of message broadcast. For the experiment here we will look what is the time spent to send one message to the room in various setup cases. We will measure the time of Django handler which processes message creation. And we will measure the time Centrifugo spends on broadcast request.

TBD - results for 10k.

This looks very nice, Django handler is fast and Centrifugo responds very quickly. Now let's go further and create a room with 100k members.

TBD - results for 100k.

At this point we see that timings went beyond one second for Redis case. Since we are sending to 100k channels here the amount of work is significant. In the app we are using individual channels for each user. Channel is the unit of scalability in Centrifugo. So we can try to improve timings in Redis engine case by adding more Redis instances.

Redis operates using a single core of processor, so on modern server machine we can easily start many Redis processes and point Centrifugo to them. Centrifugo will then shard the work between Redis shards. It's also possible to point Centrifugo to a Redis cluster consisting of many nodes.

For example, let's start Redis cluster based on 4 nodes:

```
TBD
```

And point Centrifugo to it:

```
{
    ...
    "redis_cluster_address": "127.0.0.1:7000"
}
```

Run the experiment again, and we can see that latency of broadcasting to 100k channels dropped:

```
1.4s -> 800ms
TBD
```

To reduce the latency of massive broadcast further another concern should be taken into account – we need to make broadcast in batches. Because otherwise all publications inside broadcast are processed by one Centrifugo node (since all the channels are inside one broadcast request). I.e. the goal here is to make different Centrifugo nodes to do the work in parallel.

You may send parallel requests with splitted batches to Centrifugo HTTP broadcast API or stick with asynchronous broadcast in this case, but make sure batches belong to different partitions to achieve parallel processing. 

If you want to keep strict message order then you need to be careful about proper partitioning of processed data. In our app case, we could split channels by user ID. So messages in one broadcast batch belonging to the specific partition contain stable subset of user IDs (for example, you can apply a hash function to the user ID (or individual channel) and get the reminder of division to the number of partitions). In that case the order inside one individual user channel will be preserved. 

After applying these recommendations your requests will be processed in parallel and scale by adding more Centrifugo nodes, more Redis nodes, more partitions. We leave out of scope here the part about scalability of your application backend and its database. Ideally, when grow this big you should have a plan how to shard data on your backend too. The selection of sharding key must be based on your app specifics, probably you will even end up with different sharding strategy for users, room memberships and messages with eventual consistency model.

As you can see scaling messenger apps requires careful thinking. The complexity here goes from the fact we are using personal channels for message delivery - thus we had to use broadcast API of Centrifugo. If we had isolated chat rooms (for example, like real-time comments for each video on Youtube web site) – then it could be much easier to implement and to scale as we could just subscribe to the specific room channel instead of user individual channel upon page load and publish only to one channel on every message sent (using Centrifugo publish API). In that case the scalability with many concurrent users may be simply achieved by adding more Centrifugo nodes. Also, if we had only one-to-one chat rooms in the up, without super-groups with 100k members – again, it would scale pretty easily.

But when we design an app where we want to have a screen with all user's rooms, where some rooms have massive number of members, and need to consume updates from all of them – things are becoming harder as we've just shown above. That's an important thing to keep in mind - application specifics may affect Centrifugo channel configuration a lot.

You could ask – could we simply subscribe to all room channels current user is member of? It may be a good thing if you know that users won't have too many groups, let's say 100 max. Going above this number will make UI less efficient. Consider user who is a member of a thousand of groups – it will require a very heavyweight initial subscribe request. What if user is member of 10k groups? So moving all the routing complexity to the backend having a single individual channel on the frontend seems a more reasonable approach for our app.
