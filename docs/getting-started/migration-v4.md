---
id: migration_v4
title: Migrating to v4
---

Centrifugo v4 development was concentrated around two main things:

* adopt a new generation of client protocol
* make namespaces secure by default

These goals dictate most of backwards compatibility changes in v4.

:::tip

What we would like to emphasize is that even there are many backwards incompatible changes it should be possible to migrate to Centrifugo v4 server without changing your client-side code at all. And then gradually upgrade the client-side. Below we are giving all the tips to achieve this.

:::

## Client SDK migration

New generation of client protocol requires using the latest versions of client SDKs. During the next several days we will release the following SDK versions which are compatible with Centrifugo v4:

* centrifuge-js v3.0.0
* centrifuge-go v?
* centrifuge-dart v?
* centrifuge-swift v?
* centrifuge-java v?

New client SDKs **support only new client protocol** – you can not connect to Centrifugo v3 with them.

If you have a production system where you want to upgrade Centrifugo from v3 to v4 then the plan is:

:::danger

If you are using private channels (starting with `$`) or user-limited channels (containing `#`) then additionally read about private channel migration below.

:::

1. Upgrade Centrifugo and its configuration to adopt changes in v4.
1. In Centrifugo v4 config turn on `use_client_protocol_v1_by_default`.
1. Run Centrifugo v4 – all current clients should continue working with it.
1. Then on the client-side uprade client SDK version to the one which works with Centrifugo v4, adopt changes in SDK API dictated by our new [client SDK API spec](../transports/client_api.md). **Important thing** – add `?cf_protocol_version=v2` URL param to the connection endpoint to tell Centrifugo that modern generation of protocol is being used by the connection (otherwise, it assumes old protocol since we have `use_client_protocol_v1_by_default` option enabled).
1. As soon as all your clients migrated to use new protocol generation you can remove `use_client_protocol_v1_by_default` option from the server configuration.
1. After that you can remove `?cf_protocol_version=v2` from connection endpoint on the client-side.

:::tip

If you are using mobile client SDKs then most probably some time must pass while clients update their apps to use an updated Centrifugo SDK version.

:::

## Unidirectional transport migration

Client protocol framing also changed in unidirectional transports. The good news is that Centrifugo v4 still supports previous format for unidirectional transports.

When you are enabling `use_client_protocol_v1_by_default` option described above you also make unidirectional transports to work over old protocol format. So your existing clients will continue working just fine with Centrifugo v4. Then the same steps to migrate described above can be applied to unidirectional transport case. The only difference that in unidirectional approach you are not using Centrifugo SDKs.

## SockJS migration

SockJS is now DEPRECATED in Centrifugo. Centrifugo v4 may be the last release which supports it. We now offer our own bidirectional emulation layer on top of HTTP-streaming and EventSource. See additional information in Centrifugo v4 introduction post.

## Channel ASCII enforced

Centrifugo v2 and v3 docs mentioned the fact that channels must contain only ASCII characters. But it was not actually enforced by a server. Now Centrifugo is more strict. If a channel has non-ASCII characters then the `102 unknown channel` error will be returned to the client. Please reach us out if this behavior is not suitable for your use case – we can discuss the use case and think on a proper solution together.

## Subscription token migration

Subscription token now requires `sub` claim (current user ID) to be set.

In most cases the only change which is required to smoothly migrate to v4 without breaking things is to add a boolean option `"skip_user_check_in_subscription_token": true` to a Centrifugo v4 configuration. This skips the check of `sub` claim to contain the current user ID set to a connection during authentication.

After that start adding `sub` claim (with current user ID) to subscription tokens. As soon as all subscription tokens in your system contain user ID in `sub` claim you can remove the `skip_user_check_in_subscription_token` from a server configuration.

One more important note is that `client` claim in subscription token in Centrifugo v4 only supported for backwards compatibility. It must not be included into new subscription tokens.

It's worth mentioning that Centrifugo v4 does not allow subscribing on channels starting with `$` without token even if namespace marked as available for subscribing using sth like `allow_subscribe_for_client` option. This is done to prevent potential security risk during v3 -> v4 migration when client previously not available to subscribe to channels starting with `$` in any case may get permissions to do so.

## User limited channel migration

User-limited channel support should now be enabled over separate channel namespace option. See below the namespace option converter which takes this change into account. 

## Namespace configuration migration

In Centrifugo v4 namespace configuration options have been changed. Centrifugo now has `secure by default` namespaces. First thing to do is to read the new docs about [channels and namespaces](../server/channels.md).

Then you can use the following converter which will transform your old namespace configuration to a new one. This converter tries to keep backwards compatibility – i.e. it should be possible to deploy Centrifugo with namespace configuration from converter output and have the same behaviour as before regarding channel permissions. We believe that new option names should provide a more readable configuration and may help to reveal some potential security improvements in your namespace configuration – i.e. making it more strict and protective.

:::caution

Do not blindly deploy things to production – test your system first, go through the possible usage scenarios and/or test cases.

:::

## Other configuration option changes

Several other non-namespace related options have been renamed or removed:

* `client_anonymous` option renamed to `allow_connect_without_token` – new name better describes the purpose of this option which was previously not clear. Converter above takes this into account.
* `use_unlimited_history_by_default` option was removed. It was used to help migrating from Centrifugo v2 to v3.

## Server API changes

The only breaking change is that `user_connections` API method (which is available in Centrifugo PRO only) was renamed to `connections`. The method is more generic now with a broader possibilities – so previous name does not match the current behavior.
