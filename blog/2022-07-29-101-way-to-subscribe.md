---
title: 101 ways to subscribe user on a personal channel in Centrifugo
tags: [centrifugo, tutorial]
description: In this post we are discussing vaious ways developers can use to subscribe user to a personal channel in Centrifugo
author: Alexander Emelin
authorTitle: Author of Centrifugo
authorImageURL: https://github.com/FZambia.png
image: /img/101-way.png
hide_table_of_contents: false
---

![Centrifuge](/img/101-way.png)

Let's say you develop an application and want a real-time connection which is subscribed to one channel. Let's also assume that this channel is used for user personal notifications. So only one user in the application can subcribe to that channel to receive its notifications in real-time.

In this post we will look at various ways to achieve this with Centrifugo, and consider trade-offs of the available approaches. The main goal of this tutorial is to help Centrifugo newcomers be aware of all the ways to control channel permissions by reading just one document.

And... well, there are actually 8 ways I found, not 101 😇

<!--truncate-->

## Setup

To make the post a bit easier to consume let's setup some things. Let's assume that the user for which we provide all the examples in this post has ID `"17"`. Of course in real-life the example given here can be extrapolated to any user ID.

When you create a real-time connection to Centrifugo the connection is authenticated using the one of the following ways:

* using connection JWT
* using connection request proxy from Centrifugo to the configured endpoint of the application backend (connect proxy)

As soon as the connection is successfully established and authenticated Centrifugo knows the ID of connected user. This is important to understand.

And let's define a namespace in Centrifugo configuration which will be used for personal user channels:

```json
{
    ...
    "namespaces": [
        {
            "name": "personal",
            "presence": true
        }
    ]
}
```

Defining namespaces for each new real-time feature is a good practice in Centrifugo. As an awesome improvement we also enabled `presence` in the `personal` namespace, so whenever users subscribe to a channel in this namespace Centrifugo will maintain online presence information for each channel. So you can find out all connections of the specific user existing at any moment. Defining `presence` is fully optional though - turn it of if you don't need presence information and don't want to spend additional server resources on maintaining presence.

## #1 – user-limited channel

:::tip

Probably the most performant approach.

:::

All you need to do is to extend namespace configuration with `allow_user_limited_channels` option:

```json
{
    "namespaces": [
        {
            "name": "personal",
            "presence": true,
            "allow_user_limited_channels": true
        }
    ]
}
```

On the client side you need to have sth like this (of course the ID of current user will be dynamic in real-life):

```javascript
const sub = centrifuge.newSubscription('personal:#17');
sub.on('publication', function(ctx) {
    console.log(ctx.data);
})
sub.subscribe();
```

Here you are subscribing to a channel in `personal` namespace and listening to publications coming from a channel. Having `#` in channel name tells Centrifugo that this is a user-limited channel (because `#` is a special symbol that is treated in a special way by Centrifugo as soon as `allow_user_limited_channels` enabled).

In this case the user ID part of user-limited channel is `"17"`. So Centrifugo allows user with ID `"17"` to subscribe on `personal:#17` channel. Other users won't be able to subscribe on it.

To publish updates to subscription all you need to do is to publish to `personal:#17` using server publish API (HTTP or GRPC).

## #2 - channel token authorization

:::tip

Probably the most flexible approach, with reasonably good performance characteristics.

:::

Another way we will look at is using subscription JWT for subscribing. When you create Subscription object on the client side you can pass it a subscription token, and also provide a function to retrieve subscription token (useful to automatically handle token refresh, it also handles initial token loading).

```javascript
const token = await getSubscriptionToken('personal:17');

const sub = centrifuge.newSubscription('personal:17', {
    token: token
});
sub.on('publication', function(ctx) {
    console.log(ctx.data);
})
sub.subscribe();
```

Inside `getSubscriptionToken` you can issue a request to the backend, for example in browser it's possible to do with fetch API.

On the backend side you know the ID of current user due to the native session mechanism of your app, so you can decide whether current user has permission to subsribe on `personal:17` or not. If yes – return subscription JWT according to our rules. If not - return empty string so subscription will go to unsubscribed state with `unauthorized` reason.

Here are examples for generating subscription HMAC SHA-256 JWTs for channel `personal:17` and HMAC secret key `secret`:

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

````mdx-code-block
<Tabs
  className="unique-tabs"
  defaultValue="python"
  values={[
    {label: 'Python', value: 'python'},
    {label: 'NodeJS', value: 'node'},
  ]
}>
<TabItem value="python">

```python
import jwt
import time

claims = {
    "sub": "17",
    "channel": "personal:17"
    "exp": int(time.time()) + 30*60
}

token = jwt.encode(claims, "secret", algorithm="HS256").decode()
print(token)
```

</TabItem>
<TabItem value="node">

```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
    { 
        sub: '17'
        channel: 'personal:17'
    },
    'secret',
    { expiresIn: 30 * 60 }
);
console.log(token);
```

</TabItem>
</Tabs>
````

Since we set expiration time for subscription JWT tokens we also need to provide a `getToken` function to a client on the frontend side:

```javascript
const sub = centrifuge.newSubscription('personal:17', {
    getToken: async function (ctx) {
        const token = await getSubscriptionToken('personal:17');
        return token;
    }
});
sub.on('publication', function(ctx) {
    console.log(ctx.data);
})
sub.subscribe();
```

This function will be called by SDK automatically to refresh subscription token when it's going to expire. And note that we omitted setting `token` option here – since SDK is smart enough to call provided `getToken` function to extract initial subscription token from the backend.

The good thing in using subscription JWT approach is that you can provide token expiration time, so permissions to subscribe on a channel will be validated from time to time while connection is active. You can also provide additional channel context info which will be attached to presence information (using `info` claim of subscription JWT). And you can granularly control channel permissions using `allow` claim of token – and give client capabilities to publish, call history or presence information (this is Centrifugo PRO feature at this point). Token also allows to override some namespace options on per-subscription basis (with `override` claim).

Using subscription tokens is a general approach for any channels where you need to check access first, not only for personal user channels.

## #3 - subscribe proxy

:::tip

Probably the most secure approach.

:::

Subscription JWT gives client a way to subscribe on a channel, and avoid requesting your backend for permission on every resubscribe. Token approach is very good in massive reconnect scenario, when you have many connections and they all resubscribe at once (due to your load balancer reload, for example). But this means that if you unsubscribed client from a channel using server API, client can still resubscribe with token again - until token will expire. In some cases you may want to avoid this.

Also, in some cases you want to be notified when someone subscribes to a channel.

In this case you may use subscribe proxy feature. When using subscribe proxy every attempt of a client to subscribe on a channel will be translated to request (HTTP or GRPC) from Centrifugo to the application backend. Application backend can decide whether client is allowed to subscribe or not.

One advantage of using subscribe proxy is that backend can additionally provide initial channel data for the subscribing client. This is possible using `data` field of subscribe result generated by backend subscribe handler.

```json
{
    "proxy_subscribe_endpoint": "http://localhost:9000/centrifugo/subscribe",
    "namespaces": [
        {
            "name": "personal",
            "presence": true,
            "proxy_subscribe": true
        }
    ]
}
```

And on the backend side define a route `/centrifugo/subscribe`, check permissions of user upon subscription and return result to Centrifugo according to our subscribe proxy docs. Or simply run GRPC server using our proxy definitions and react on subscription attempt sent from Centrifugo to backend over GRPC.

On the client-side code is as simple as:

```javascript
const sub = centrifuge.newSubscription('personal:17');
sub.on('publication', function(ctx) {
    console.log(ctx.data);
})
sub.subscribe();
```

## #4 - server-side channel in connection JWT

:::tip

The approach where you don't need to manage client-side subscriptions.

:::

Server-side subscriptions is a way to consume publications from channels without even create Subscription objects on the client side. In general, client side Subscription objects provide a more flexible and controllable way to work with subscriptions. Clients can subscribe/unsubscribe on channels at any point. Client-side subscriptions provide more details about state transitions.

With server-side subscriptions though you are consuming publications directly from Client instance:

```javascript
const client = new Centrifuge('ws://localhost:8000/connection/websocket', {
    token: 'CONNECTION-JWT'
});
client.on('publication', function(ctx) {
    console.log('publication received from server-side channel', ctx.channel, ctx.data);
});
client.connect();
```

In this case you don't have separate Subscription objects and need to look at `ctx.channel` upon receiving publication or to publication content to decide how to handle it. Server-side subscriptions could be a good choice if you are using Centrifugo unidirectional transports and don't need dynamic subscribe/unsubscribe behavior.

The first way to subscribe client on a server-side channel is to include `channels` claim into connection JWT:

```json
{
    "sub": "17",
    "channels": ["personal:17"]
}
```

Upon successful connection user will be subscribed to a server-side channel by Centrifugo. One downside of using server-side channels is that errors in one server-side channel (like impossible to recover missed messages) may affect the entire connection and result into reconnects, while with client-side subscriptions individual subsription failures do not affect the entire connection.

But having one server-side channel per-connection seems a very reasonable idea to me in many cases. And if you have stable set of subscriptions which do not require lifetime state management – this can be a nice approach without additional protocol/network overhead involved.

## #5 - server-side channel in connect proxy

Similar to the previous one for cases when you are authenticating connections over connect proxy instead of using JWT.

This is possible using `channels` field of connect proxy handler result. The code on the client-side is the same as in Option #4 – since we only change the way how list of server-side channels is provided.

## #6 - automatic personal channel subscription

:::tip

Almost no code approach.

:::

As we pointed above Centrifugo knows an ID of the user due to authentication process. So why not combining this knowledge with automatic server-side personal channel subscription? Centrifugo provides exactly this with user personal channel feature.

```json
{
    "user_subscribe_to_personal": true,
    "user_personal_channel_namespace": "personal",
    "namespaces": [
        {
            "name": "personal",
            "presence": true
        }
    ]
}
```

This feature only subscribes non-anonymous users to personal channels (those with non-empty user ID). The configuration above will subscribe our user `"17"` to channel `personal:#17` automatically after successful authentication.

## #7 – capabilities in connection JWT

Allows using client-side subscriptions, but skip receiving subscription token. This is only available in Centrifugo PRO at this point.

So when generating JWT you can provide additional `caps` claim which contains channel resource capabilities:

````mdx-code-block
<Tabs
  className="unique-tabs"
  defaultValue="python"
  values={[
    {label: 'Python', value: 'python'},
    {label: 'NodeJS', value: 'node'},
  ]
}>
<TabItem value="python">

```python
import jwt
import time

claims = {
    "sub": "17",
    "exp": int(time.time()) + 30*60,
    "caps": [
        {
            "channels": ["personal:17"],
            "allow": ["sub"]
        }
    ]
}

token = jwt.encode(claims, "secret", algorithm="HS256").decode()
print(token)
```

</TabItem>
<TabItem value="node">

```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
    { 
        sub: '17'
        caps: [
            {
                "channels": ["personal:17"],
                "allow": ["sub"]
            }
        ]
    },
    'secret',
    { expiresIn: 30 * 60 }
);
console.log(token);
```

</TabItem>
</Tabs>
````

While in case of single channel the benefit of using this approach is not really obvious, it can help when you are using several channels with stric access permissions per connection, where providing capabilities can help to save some traffic and CPU resources since we avoid generating subscription token for each individual channel.

## #8 – capabilities in connect proxy

This is very similar to the previous approach, but capabilities are passed to Centrifugo in connect proxy result. So if you are using connect proxy for auth then you can still provide capabilities in the same form as in JWT. This is also a Centrifugo PRO feature.

## Teardown

Which way to choose? Well, it depends. Since your application will have more than only a personal user channel in many cases you should decide which approach suits you better in each particular case – it's hard to give the universal advice.

Client-side subscriptions are more flexible in general, so I'd suggest using them whenever possible. Though you may use unidirectional transports of Centrifugo where subscribing to channels from the client side is not simple to achieve (though still possible using our server subscribe API). Server-side subscriptions make more sense there.

The good news is that all our official bidirectional client SDKs support all the approaches mentioned in this post. Hope designing the channel configuration on top of Centrifugo will be a pleasant experience for you.

:::note Attributions

* <a href="https://www.freepik.com/vectors/internet-network">Internet network vector created by rawpixel.com - www.freepik.com</a>
* <a href="https://www.flaticon.com/free-icons/cyber-security" title="cyber security icons">Cyber security icons created by Smashicons - Flaticon</a>

:::
