---
id: migration_v5
title: Migrating to v5
---

Centrifugo v5 migration from v4 should be smooth for most of the use cases.

## Client SDK token behaviour adjustments

In Centrifugo v5 [client SDK spec](../transports/client_api.md) was adjusted in regards how SDKs work with tokens.

Returning an empty string from `getToken` function (for Javascript, and the same for analogous functions in other SDKs) is a valid scenario which won't result into disconnect on the client side. It's still possible to disconnect client by returning a special error from `getToken` function. We updated all our SDKs to inherit this behaviour. Specifically, here is a list of SDK versions which work according to adjusted spec:

* centrifuge-js >= v4.0.0
* centrifuge-go >= v0.10.0
* centrifuge-dart >= v0.10.0
* centrifuge-swift >= v0.6.0
* centrifuge-java >= v0.3.0

Nothing prevents you from updating Centrifugo v4 to v5 first and then migrate to new client versions or doing vice versa. **This change is client-side only**. But we bind it to major server release to make it more notable – as it changes the core SDK behavior.

## Node communication format changed

Avoid running Centrifugo v5 in the same cluster with Centrifugo v4 nodes – v4 and v5 have backwards incompatible node communication protocols.

## Old HTTP API format is DEPRECATED

Prefer using new HTTP API format instead of old one where possible. The old format still works and enabled by default. But we are planning to migrate our API libraries to the new format eventually – and then remove the old format. If you are using one of our HTTP API libs - at some point a new version will be released which will seamlessly migrate you to the modern HTTP API format.

If you are using hand-written requests – then some refactoring is required. It should be rather straighforward:

* replace request path from `/api` to `/api/<method>`
* replace payload from having `method` and `params` on top level. Payload does not include method and params keys anymore. Please refer to: https://centrifugal.dev/blog/2023/06/29/centrifugo-v5-released#new-http-api-format
* prefer using `X-API-Key: <YOUR_API_KEY` header format instead of `Authorization: apikey <YOUR_API_KEY`.

Don't forget that you can now generate HTTP clients from OpenAPI spec we now maintain for the new HTTP API format.

## Other changes

* `skip_user_check_in_subscription_token` removed
* `reconnect` flag removed from disconnect API call and proxy structures for custom disconnection
* `use_client_protocol_v1_by_default` option removed
* `disable_client_protocol_v1` option removed
* `redis_tls_skip_verify` option removed
* `presence_ttl` renamed to `global_presence_ttl`
* `sockjs_heartbeat_delay` option removed
* `uni_websocket_ping_interval` option removed
* `websocket_ping_interval` option removed

## Shutting down Centrifugo v2 doc site

With Centrifugo v5 release we are shutting down Centrifugo v2 documentation site - this means `https://centrifugal.github.io/centrifugo/` won't be available anymore. Documents may still be found [on Github](https://github.com/centrifugal/centrifugo/tree/gh-pages). Documentation for v3, v4 and v5 is hosted here.
