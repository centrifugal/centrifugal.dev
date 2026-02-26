---
description: "Benchmark Centrifugo real-time delivery latency for chat rooms with 100 to 100k members. Learn scaling strategies with Redis sharding and partitioning."
id: scale
sidebar_label: "Scale to 100k room members"
title: "Scale to 100k cats in room"
---

Congratulations – we've built an awesome app and we are done with the development within this tutorial! 🎉

![](/img/spin_chat_cover.jpg)

But before wrapping up, let's experiment a little. Here we will try to look at some latency numbers for the room with 100, 1k, 10k, 100k members in different scenarios. Not many apps will reach 100k members in one group scale, but we want to show that Centrifugo gives you a way to grow this big keeping reasonable latency times, and also gives answers how to reduce latency and increase a system throughput further.

:::info

This chapter is still to be improved. We've included some numbers we were able to get while experimenting with the app – but left configuring Redis Engine out of scope for now. In experiments we used Centrifugo running outside of Docker. See how we did it in [Tips and Tricks](./tips_and_tricks.md#point-to-centrifugo-running-on-host-outside-docker).

:::

In our blog post [Million connections with Centrifugo](/blog/2020/02/10/million-connections-with-centrifugo) we've shown that on a limited hardware resources, comparable to one modern server machine, delivering 500k messages per second with delivery latency no more than 200ms in 99 percentile is possible with Centrifugo.

But this case is different, in this app we want to have large group chats with many members. The difference here is that publishing involves sending a message to each individual channel – so instead of small fan-in and large fan-out **we have large fan-in and mostly the same fan-out** (mostly – because user may have several connections from different devices). We also have Django on the backend and database communication here – which also makes the use case different as we need to take backend processing timings into account too.

Let's create fake users and fill the rooms with members. First, the function to create fake users programatically:

```python title='backend/app/utils.py'
from django.contrib.auth.models import User
from django.utils.crypto import get_random_string
from django.contrib.auth.hashers import make_password


def create_users(n):
    users = []
    total = 0
    for _ in range(n):
        username = get_random_string(10)
        email = f"{username}@example.com"
        password = get_random_string(50)
        user = User(username=username, email=email, password=make_password(password, None))
        users.append(user)

        if len(users) >= 100:
            total += len(users)
            User.objects.bulk_create(users)
            users = []
            print("Total users created:", total)

    # Create remaining users.
    if users:
        total += len(users)
        User.objects.bulk_create(users)
        print("Total users created:", total)
```

A function to create rooms:

```python
from chat.models import Room


def create_room(name):
    return Room.objects.create(name=name)
```

Similar helper script may be used to fill the room with users:

```python
from chat.models import RoomMember, Room


def fill_room(room_id, limit):
    members = []
    total = 0
    room = Room.objects.get(pk=room_id)
    for user in User.objects.all()[:limit]:
        members.append(RoomMember(room=room, user=user))

        if len(members) >= 100:
            total += len(members)
            RoomMember.objects.bulk_create(members, ignore_conflicts=True)
            members = []
            print("Total members created:", total)

    # Create remaining members.
    if members:
        total += len(members)
        RoomMember.objects.bulk_create(members, ignore_conflicts=True)
        print("Total members created:", total)
```

And finally, a function to quickly bootstrap rooms with desired number of members:

```python
def setup_dev():
    create_users(100_000)
    r1 = create_room('Centrifugo')
    fill_room(r1.pk, 100_000)
    r2 = create_room('Movies')
    fill_room(r2.pk, 10_000)
    r3 = create_room('Programming')
    fill_room(r3.pk, 1_000)
    r4 = create_room('Football')
    fill_room(r4.pk, 100)
```

To create users connect to Django shell:

```
docker compose exec backend python manage.py shell
```

And run:

```python
from app.utils import setup_dev
setup_dev()
```

This may take a while, please see how to speed this app in the comment of `create_users` in source code. TLDR - it's possible to relax requirements to password a bit. Which is totally OK for experiment purposes and allows creating 100k users in seconds.

Now, let's compare some latency numbers for these rooms when broadcasting a message. We will measure:

* median time of Django handler which processes message creation in every broadcast mode (creation). We have four broadcast modes here: api, outbox, cdc, api_cdc (combined API and CDC)
* median time Centrifugo spends on broadcast request (broadcast) - this time is spent by Centrifugo on putting each publication to individual channel from the request, saving publication to each channel's history
* end-to-end median latency – the time between pressing ENTER by a user till receiving real-time message (delivery). This includes passing data over entire stack: Nginx proxy -> Gunicorn/Django -> [api | outbox | cdc | api_cdc ] -> Centrifugo. In practice, in messenger application, only small part of those members will be online at the moment of message broadcast – in this experiment we will measure the delivery latency while only one client in the room online – it's OK because having more users connected scales very well in Centrifugo with adding more nodes, so numbers achieved here are totally achievable with more online connections in the room just by adding several more Centrifugo nodes.

Also note, that in reality there will be some additional overhead due to network latencies missing in this experiment. Our goal here is to show the overhead of technologies used to build the app here. The experiment's goal is to give you the idea of **difference**, not exact latency values (which may be better or worse depending on the hardware, operating system, etc). All measurements were done on a single local machine – Apple Macbook M1 Pro – not very scientific, but fits the goal.

We first start with Centrifugo that uses [Memory engine](../server/engines.md#memory-engine) which is the fastest one:

|      | api | outbox | cdc | api_cdc |
|------|-----|--------|-----|---------|
| 100  | creation: 50ms<br/>broadcast: 2ms<br/>delivery 40ms    | creation: 35ms<br/>broadcast: 1ms<br/>delivery 70ms | creation: 35ms<br/>broadcast: 1ms<br/>delivery 140ms    |  creation: 50ms<br/>broadcast: 1ms<br/>delivery 50ms  |
| 1k | creation: 60ms<br/>broadcast: 20ms<br/>delivery 50ms    | creation: 50ms<br/>broadcast: 18ms<br/>delivery 75ms | creation: 50ms<br/>broadcast: 18ms<br/>delivery 170ms    | creation: 60ms<br/>broadcast: 18ms<br/>delivery 55ms  |
| 10k  | creation: 120ms<br/>broadcast: 60ms<br/>delivery 115ms    | creation: 55ms<br/>broadcast: 55ms<br/>delivery 130ms | creation: 55ms<br/>broadcast: 55ms<br/>delivery 250ms   |  creation: 170ms<br/>broadcast: 55ms<br/>delivery 150ms  |
| 100k | creation: 620ms<br/>broadcast: 520ms<br/>delivery 600ms    | creation: 170ms<br/>broadcast: 500ms<br/>delivery 600ms | creation: 170ms<br/>broadcast: 500ms<br/>delivery 750ms    |  creation: 900ms<br/>broadcast: 500ms<br/>delivery 750ms       |

Things to observe:

* end-to-end latency here includes the time Django processes the request, that's why we can't go below 40ms even in rooms with only 100 members.
* when broadcasting over Centrifugo API - message delivered even faster than Django handler completes its work (since we are publishing synchronously somewhere inside request processing). I.e. this means your frontend can receive real-time message before publish request completes, this is actually true for all other broadcast mode – just with much smaller probability.
* using outbox and CDC decreases time of message creation, but latency increases – since broadcastng is asynchronous, and several more stages involved into the flow. It's generally possible to tune to be faster.
* for 10k members in group latencies are very acceptable for the messenger app, this is already the scale of quite huge organizations which use Slack messenger, and it's not limit as we will show.
* using API and CDC together provides better latency than just CDC (so we proved it works as expected!), but probably for large groups you may want to only use CDC to keep publication time reasonably small.

Now let's use Centrifugo [Redis engine](../server/engines.md#redis-engine). In the tutorial we used in-memory engine of Centrifugo. But with Redis engine it's possible to scale Centrifugo nodes and load balance WebSocket connections over them. We left Redis Engine out of the scope in the tutorial – but you can simply add it by extending `docker-compose.yml`. Here are results we got for it: 

|      | api | outbox | cdc | api_cdc |
|------|-----|--------|-----|---------|
| 100  | creation: 55ms<br/>broadcast: 6ms<br/>delivery 50ms   | creation: 35ms<br/>broadcast: 5ms<br/>delivery 55ms | creation: 35ms<br/>broadcast: 5ms<br/>delivery 140ms    |   creation: 55ms<br/>broadcast: 5ms<br/>delivery 50ms      |
| 1k | creation: 75ms<br/>broadcast: 30ms<br/>delivery 60ms   | creation: 40ms<br/>broadcast: 25ms<br/>delivery 70ms |  creation: 40ms<br/>broadcast: 25ms<br/>delivery 180ms   | creation: 50ms<br/>broadcast: 25ms<br/>delivery 60ms        |
| 10k  | creation: 240ms<br/>broadcast: 170ms<br/>delivery 220ms    | creation: 65ms<br/>broadcast: 160ms<br/>delivery 250ms | creation: 65ms<br/>broadcast: 160ms<br/>delivery 300ms    |  creation: 260ms<br/>broadcast: 180ms<br/>delivery 260ms       |
| 100k | creation: 1.5s<br/>broadcast: 1.4s<br/>delivery 1.5s    | creation: 140ms<br/>broadcast: 1.4s<br/>delivery 2s |  creation: 140ms<br/>broadcast: 1.4s<br/>delivery 2s   |  creation: 2.8ms<br/>broadcast: 160ms<br/>delivery 2.6s       |

We see that timings went beyond one second for Redis case for group with 100k members. Since we are sending to 100k **individual** channels here with saving message history for each, the amount of work is significant. But channel is the unit of scalability in Centrifugo. Let's discuss how we can improve timings in Redis engine case.

First thing to do is adding more Redis instances. Redis operates using a single core of processor, so on modern server machine we can easily start many Redis processes and point Centrifugo to them. Centrifugo will then shard the work between Redis shards. It's also possible to point Centrifugo to a Redis cluster consisting of many nodes.

For example, let's start Redis cluster based on 4 nodes and point Centrifugo to it. We then get the following results (skipped 100, 1k and 10k scenarios here as they already fast enough):

|      | api | outbox | cdc | api_cdc |
|------|-----|--------|-----|---------|
| 100k | creation: 1s<br/>broadcast: 900ms<br/>delivery 950ms    | creation: 220ms<br/>broadcast: 850ms<br/>delivery 1s       |  creation: 200ms<br/>broadcast: 850ms<br/>delivery 1.3s   |  creation: 1.6s<br/>broadcast: 950ms <br/>delivery 1.5s     |

We can see that latency of broadcasting to 100k channels dropped: `1.5s -> 900ms`. This is because we offloaded some work from a single Redis to several instances.

To reduce the latency of massive broadcast further another concern should be taken into account – we need to split broadcast to many Centrifugo nodes. Currently all publications inside broadcast request are processed by one Centrifugo node (since all the channels belong to one broadcast request). If we add more Centrifugo nodes and split one broadcast request to several ones to utilize different Centrifugo nodes – we will parallelize the work of broadcasting the same message to many channels.

You may send parallel requests with splitted batches to Centrifugo HTTP broadcast API (though this requires asynchronous model or using thread pool). Or stick with asynchronous broadcast (outbox, CDC, etc). In this case, make sure to construct batches which belong to different partitions to achieve parallel processing. You can reduce the request up to one channel in batch – which makes broadcast equal to Centrifugo's [publish](../server/server_api.md#publish) API.

If you want to keep strict message order then you need to be careful about proper partitioning of processed data. In our app case, we could split channels by user ID. So messages in one broadcast batch belonging to the specific partition may contain stable subset of user IDs (for example, you can apply a hash function to the user ID (or individual channel) and get the reminder of division to some configured number which is much larger that the number of partitions). In that case the order inside one individual user channel will be preserved.

After applying these recommendations your requests will be processed in parallel and scale by adding more Centrifugo nodes, more Redis nodes, more partitions. We've made a quick experiment using sth like this in Django code:

```python
from itertools import islice


def chunks(xs, n):
    n = max(1, n)
    iterator = iter(xs)
    return iter(lambda: list(islice(iterator, n)), [])


channel_batches = chunks(channels, 1000)
cdc_objects = []
i = 0
for batch in channel_batches:
    broadcast_payload = {
        'channels': batch,
        'data': {
            'type': 'message_added',
            'body': serializer.data
        },
        'idempotency_key': f'message_{serializer.data["id"]}'
    }
    cdc_objects.append(CDC(method='broadcast', payload=broadcast_payload, partition=i))
    i+=1

CDC.objects.bulk_create(cdc_objects)
```

:::caution

Note, this code does not properly partition data, so may result into incorrect ordering - was used just to prove the idea!

:::

With this batch approach and running Centrifugo with 8 isolated Redis instances and Centrifugo's client-side Redis sharding feature we were able to quickly achieve 400ms median delivery latency on Digital Ocean 16 CPU-core droplet. So sending a message to a group with 100k members feels almost instant:

<video width="100%" loop={true} autoPlay="autoplay" muted controls="" src="/img/grand-chat-100k.mp4"></video>

If we take Slack as an example, this already feels nice to cover messaging needs of some largest organizations in the world. It will also work for Amazon scale, who has around 1.5 million people now – just need more resources for better end-to-end latency or simply trade-off the latency in large messenger groups for reduced resources.

To conclude here, scaling messenger apps requires careful thinking. The complexity in the case goes from the fact we are using personal channels for message delivery - thus we have a massive fan-in and need to use broadcast API of Centrifugo.

If we had isolated chat rooms (for example, like real-time comments for each video on Youtube web site) – then it could be much easier to implement and to scale. Because we could just subscribe to the specific room channel instead of user individual channel and publish only to one channel on every message sent (using Centrifugo [simple publish API](../server/server_api.md#publish)). It's a very small fan-in and the scalability with many concurrent users may be simply achieved by adding more Centrifugo nodes. Also, if we had only one-to-one chat rooms in the app, without super-groups with 100k members – again, it scales pretty easily. If you don't need message recovery – than disabling it will provide better performance too. Our experiments with 100k members and a single [Nats server as broker](../server/engines.md#nats-broker) showed 300ms delivery latency.

But when we design an app where we want to have a screen with all user's rooms, where some rooms have massive number of members, and need to consume updates from all of them – things are becoming harder as we've just shown above. That's an important thing to keep in mind - application specifics may affect Centrifugo channel configuration and performance a lot.
