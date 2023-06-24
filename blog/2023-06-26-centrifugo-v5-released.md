---
title: Centrifugo v5 released
tags: [centrifugo, release]
description: We are excited to announce a new version of Centrifugo. It's an evolutionary step which makes Centrifugo cleaner and more intuitive to use.
author: Centrifugal team
authorTitle: 💻✨🔮✨💻
authorImageURL: /img/logo_animated.svg
image: /img/v5.jpg
hide_table_of_contents: false
---

In Centrifugo v5 we're phasing out old client protocol support, introducing a more intuitive HTTP API, adjusting token management behaviour in SDKs, improving configuration process, and refactoring the history meta ttl option. As the result you get a cleaner, more user-friendly, and optimized Centrifugo experience. And we have some news about the project – check it out in the end of this post.

<!--truncate-->

<img src="/img/v5.jpg" />

## Dropping old client protocol

With the introduction of Centrifugo v4, our previous major release, [we rolled out](/blog/2022/07/19/centrifugo-v4-released#unified-client-sdk-api) a new version of the client protocol along with a set of client SDKs designed to work in conjunction with it. Nevertheless, we maintained support for the old client protocol in Centrifugo v4 to facilitate a seamless migration of applications.

In Centrifugo v5 we are discontinuing support for the old protocol. If you have been using Centrifugo v4 with the latest SDKs, this change should have no impact on you. From our perspective, removing support for the old protocol allows us to eliminate a considerable amount of non-obvious branching in the source code and cleanup Protobuf schema definitions.

## Token behaviour adjustments in SDKs

In Centrifugo v5 we are adjusting [client SDK specification](/docs/transports/client_api) in the aspect of connection token management. Previously, returning an empty token string from `getToken` callback resulted in client disconnection with `unauthorized` reason.

There was some problem with it though. We did not take into account the fact that empty token may be a valid scenario actually. Centrifugo supports options to avoid using token at all for anonymous access. So the lack of possibility to switch between `token`/`no token` scenarios did not allow users to easily implement login/logout workflow. The only way was re-initializing SDK.

Now returning an empty string from `getToken` is a valid scenario which won't result into disconnect on the client side. It's still possible to disconnect client by returning a special error from `getToken` function. We updated all our SDKs to inherit this behaviour - check out v5 [migration guide](/docs/getting-started/migration_v5) for more details.

And we are putting back `setToken` method to our SDKs – so it's now possible to reset the token to be empty upon user logout.

An abstract example in Javascript which demonstrates how login/logout flow may be now implemented:

```javascript
const centrifuge = new Centrifuge('ws://localhost:8000/connection/websocket', {
    // Provide function which returns empty string for anonymous users,
    // and proper JWT for authenticated users.
    getToken: getTokenImplementation
});
centrifuge.connect();

loginButton.addEventListener('click', function() {
    centrifuge.disconnect();
    // Do actual login here.
    centrifuge.connect();
});

logoutButton.addEventListener('click', function() {
    centrifuge.disconnect();
    // Reset token - so that getToken will be called on next connect attempt.
    centrifuge.setToken("");
    // Do actual logout here.
    centrifuge.connect();
});
```

## history_meta_ttl refactoring

One of Centrifugo's key advantages for real-time messaging tasks is its ephemeral channels and per-channel history. In version 5, we've improved one aspect of handling history by offering users the ability to tune the history meta TTL option at the channel namespace level.

The history meta TTL is the duration Centrifugo retains meta information about each channel stream, such as the latest offset and current stream epoch. This data allows users to successfully restore connections upon reconnection, particularly useful when subscribed to mostly inactive channels where publications are infrequent. Although the history meta TTL can usually be reasonably large (significantly larger than history TTL), there are certain scenarios where it's beneficial to minimize it as much as possible.

One such use case is illustrated in this [example](https://github.com/centrifugal/examples/tree/master/v4/go_async_processing). Using Centrifugo SDK and channels with history, it's possible to reliably stream results of asynchronous tasks to clients.

As another example, consider a ChatGPT use case where clients ask questions, subscribe to a channel with the answer, and then the response is streamed towards the client token by token. This all may be done over a secure, separate channel protected with a token. With the ability to use a relatively small history meta TTL in the channel namespace, implementing such things is now simpler.

Hence, `history_meta_ttl` is now an option at the channel namespace level (instead of per-engine). However, setting it is optional as we have a global default value for it - see [details in the doc](/docs/server/channels#history_meta_ttl).

## Node communication protocol update

When running in cluster Centrifugo nodes can communicate between each other using broker's PUB/SUB. Nodes exchange some information - like statistics, emulation requests, etc.

In Centrifugo v5 we are simplifying and making inter-node communication protocol slightly faster by removing extra encoding layers from it's format. Something similar to what we did for our client protocol in Centrifugo v4.

This change, however, leads to an incompatibility between Centrifugo v4 and v5 nodes in terms of their communication protocols. Consequently, Centrifugo v5 cannot be part of a cluster with Centrifugo v4 nodes.

## New HTTP API format

From the beginning Centrifugo HTTP API exposed one `/api` endpoint to make requests with all command types.

To work properly HTTP API had to add one additional layer to request JSON payload to be able to distinguish between different API methods:

```bash
curl --header "Content-Type: application/json" \
  --header "Authorization: apikey API_KEY" \
  --request POST \
  --data '{"method": "publish", "params": {"channel": "test", "data": {"x": 1}}}' \
  http://localhost:8000/api
```

And it worked fine. It additionally supported request batching where users could send many commands to Centrifugo in one request using line-delimited JSON.

However, the fact that we were accommodating various commands via a single API endpoint resulted in nested serialized payloads for each command. The top-level method would determine the structure of the params. We addressed this issue in the client protocol in Centrifugo v4, and now we're addressing a similar issue in the inter-node communication protocol in Centrifugo v5.

At some point we introduced GRPC API in Centrifugo. In GRPC case we don't have a way to send batches of commands without defining a separate method to do so.

These developments highlighted the need for us to align the HTTP API format more closely with the GRPC API. Specifically, we need to separate the command method from the actual method payload, moving towards a structure like this:

```bash
curl --header "Content-Type: application/json" \
  --header "X-API-Key: API_KEY" \
  --request POST \
  --data '{"channel": "test", "data": {"x": 1}}' \
  http://localhost:8000/api/publish
```

Note:

* `/api/publish` instead of `/api` in path
* payload does not include `method` and `params` keys anymore
* we also support `X-API-Key` header for setting API key to be closer to OpenAPI specification (see more about OpenAPI below)

In v5 we implemented the approach above. Many thanks to [@StringNick](https://github.com/StringNick) for the help with the implementation and discussions.

Our HTTP and GRPC API are very similar now. We've also introduced a new batch method to send multiple commands in both HTTP and GRPC APIs, a feature that was previously unavailable in GRPC.

Documentation for v5 was updated to reflect this change. But it worth noting - old API format id still supported. It will be supported for some time while we are migrating our HTTP API libraries to use modern API version. Hopefully users won't be affected by this migration a lot, just switching to a new version of library at some point.

## OpenAPI spec and Swagger UI

One additional benefit of moving to the new HTTP format is the possibility to define a clear OpenAPI schema for each API method Centrifugo has. It was previously quite tricky due to the fact we had one endpoint capable to work with all kinds of commands.

This change paves the way for generating HTTP clients based on our OpenAPI specification.

We now have Swagger UI built-in. To access it, launch Centrifugo with the `"swagger": true` option and navigate to `http://localhost:8000/swagger`.

The Swagger UI operates on the internal port, so if you're running Centrifugo using our Kubernetes Helm chart, it won't be exposed to the same ingress as client connection endpoints. This is similar to how our Prometheus, admin, API, and debug endpoints currently work.

## OpenTelemetry for server API

Another good addition is an OpenTelemetry tracing support for HTTP and GRPC server API requests. If you are using OpenTelemetry in your services you can now now enable tracing export in Centrifugo and find Centrifugo API request exported traces in your tracing collector UI.

Description and simple example with Jaeger may be found [in observability chapter](/docs/server/observability#opentelemetry). We only support OTLP HTTP export format and trace format defined in W3C spec: https://www.w3.org/TR/trace-context/.

## Unknown config keys warnings

With every release, Centrifugo offers more and more options. One thing we've noticed is that some options from previous Centrifugo options, which were already removed, still persist in the user's configuration file.

Another issue is that a single typo in the configuration key can cost hours of debugging especially for Centrifugo new users. What is worse, the typo might result in unexpected behavior if the feature isn't properly tested before being run in production.

In Centrifugo v5, we are addressing these problems. Now, Centrifugo logs on WARN level about unknown keys found in the configuration upon server start-up. Not only in the configuration file but also verifying the validity of environment variables (looking at those starting with `CENTRIFUGO_` prefix). This should help clean up the configuration to align with the latest Centrifugo release and catch typos at an early stage.

It looks like this:

```
08:25:33 [WRN] unknown key found in the namespace object key=watch namespace_name=xx
08:25:33 [WRN] unknown key found in the proxy object key=type proxy_name=connect
08:25:33 [WRN] unknown key found in the configuration file key=granulr_proxy_mode
08:25:33 [WRN] unknown key found in the environment key=CENTRIFUGO_ADDRES
```

These warnings do not prevent server to start so you can gradually clean up the configuration.

## The future of SockJS

As you know SockJS is deprecated in Centrifugal ecosystem since Centrifugo v4. In this release we are not removing support for it – but we may do this in the next release.

Unfortunately, SockJS client repo is poorly maintained these days. And some of its iframe-based transports are becoming archaic. If you depend on SockJS and you really need fallback for WebSocket – consider switching to Centrifugo own bidirectional emulation for the browser which works over HTTP-streaming (using modern fetch API with Readable streams) or SSE. It should be more performant and work without sticky sessions requirement (sticky sessions is an optimization in our implementation). More details may be found in [Centrifugo v4 release post](/blog/2022/07/19/centrifugo-v4-released#modern-websocket-emulation-in-javascript).

If you think SockJS is still required for your use case - reach us out so we could think about the future steps together.

## Introducing Centrifugal Labs LTD

Finally, some important news about the project we promised in the beginning.

Centrifugo is now backed by the company called **Centrifugal Labs LTD** - a Cyprus-registered technology company. This should help us to finally launch [Centrifugo PRO](/docs/pro/overview) offering – the product we have been working on for a couple of years now and which has some unique and powerful features like [real-time analytics](/docs/pro/analytics) or [push notification API](/docs/pro/push_notifications).

As a Centrifugo user you will start noticing mentions of Centrifugal Labs LTD in our licenses, Github organization, throughout this web site. And that's mostly it - no radical changes at this point. We will still be working on improving Centrifugo trying to find a balance between OSS and PRO versions. Which is difficult TBH – but we will try.

An ideal plan for us – make Centrifugo development sustainable enough to have the possibility for features from the PRO version flow to the OSS version eventually. The reality may be harder than this of course.

## Conclusion

That's all about most notable things happened in Centrifugo v5. We updated documentation to reflect the changes in v5, also some documentation chapters were rewritten. For example, take a look at the refreshed [Design overview](/docs/getting-started/design). Several more changes and details outlined in the [migration guide for Centifugo v5](/docs/getting-started/migration_v5). Please feel free to contact in the community rooms if you have questions about the release. And as usual, let the Centrifugal force be with you!
