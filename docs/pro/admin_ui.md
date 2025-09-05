---
id: admin_ui
sidebar_label: "Admin UI: SSO, Snapshots"
title: "Admin UI: SSO, State Snapshots, and more"
---

Admin UI of Centrifugo OSS supports only one admin user identified by the preconfigured password. For the corporate and enterprise environments Centrifugo PRO provides a way to integrate with popular User [Identity Providers](https://en.wikipedia.org/wiki/Identity_provider) (IDP), such as Okta, KeyCloak, Google Workspace, Azure and others. Most of the modern providers which support [OpenID connect](https://openid.net/specs/openid-connect-core-1_0.html) (OIDC) protocol with [Proof Key for Code Exchange](https://oauth.net/2/pkce/)
(PKCE) and [OpenID Connect Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html) are supported. This provides a way to integrate Centrifugo PRO into your existing [Single Sign-On](https://en.wikipedia.org/wiki/Single_sign-on) (SSO) infrastructure.

Also, Centrifugo PRO extends admin UI in other ways providing more data about the system state.

## SSO for admin UI (OIDC)

As soon as OIDC integration configured, instead of password field Centrifugo PRO admin web UI shows a button to log in using a configured Identity Provider. As soon as user successfully logs in over the IDP, user is redirected back to Centrifugo admin UI. Centrifugo checks user's access token and permissions to access admin functionality upon every request to admin resources.

![](/img/admin_idp_auth.png)

### Configuration

```json title="config.json"
{
  "admin": {
    ...
    "oidc": {
      "enabled": true,
      "display_name": "Keycloak",
      "issuer": "http://localhost:8080/realms/master",
      "client_id": "myclient",
      "audience": "myclient",
      "redirect_uri": "http://localhost:8000",
      "extra_scopes": [],
      "access_cel": "'centrifugo_admins' in claims.groups"
    }
  }
}
```

* `admin.oidc.enabled` - boolean option which enables OIDC integration. When it's on, it's only possible to log in to Centrifugo over OIDC. By default, `false`. Enabling OIDC also enables validation of the required options below.
* `admin.oidc.display_name` – required string, name of IDP to be displayed on login button.
* `admin.oidc.issuer` - required string, the URL identifier of Identity Provider which will issue tokens. It's used for initializing OIDC provider and used as a base for the OIDC endpoint discovery.
* `admin.oidc.client_id` - required string, identifier for registered client in IDP for OIDC integration with Centrifugo.
* `admin.oidc.audience` - optional string, if not set Centrifugo expects access token audience (`aud`) to match configured `client_id` value (as required by the OIDC spec).
* `admin.oidc.redirect_uri` - required string, redirect URI to use.
* `admin.oidc.extra_scopes` - optional array of extra string scopes to request from IDP. Centrifugo always includes `openid` scope as it's required by OpenID Connect protocol.
* `admin.oidc.access_cel` – required string, this is a CEL expression which describes rule for checking access to Centrifugo admin resources. For now we don't provide RBAC – when this expression returns true the user gets full access to Centrifugo admin resources. If false – no access at all. For more information about what is CEL check out [Channel CEL expressions](./cel_expressions.md) chapter where CEL expressions are used for channel permission checks.

Let's look closer at `admin.oidc.access_cel`. In the example above we check this based on a user group membership:

```json title="config.json"
{
  "admin": {
    ...
    "oidc": {
      ...
      "access_cel": "'centrifugo_admins' in claims.groups"
    }
  }
}
```

The expression may differ depending on IDP used – you can modify it to fit your case. Inside CEL you have access token `claims` object with all claims of access token (which is JWT), so custom logic is possible. If you want to allow all authenticated users to access Centrifugo admin resources – then you can do the following:

:::caution

This is usually not recommended, since every new user in your IDP will get access to Centrifugo admin UI. Deciding based on groups or some other token attribute is more secure and flexible.

:::

```json title="config.json"
{
  "admin": {
    ...
    "oidc": {
      ...
      "access_cel": "true"
    }
  }
}
```

## Channels and Connections Snapshots

This feature allows using admin web UI to inspect current connections and channels state. It allows to:

* See current connections and channels state in the cluster
* Search connections by user ID, inspect subscribers of the channel
* See connection details: transport, client info, subscribed channels, how subscription was made, connection latency (for bidirectional transports only), connection time, etc.
* Disconnect/Reconnect a specific connection
* Integrates with Centrifugo PRO [Tracing](./tracing.md) to trace particular channel or particular connection in real-time.

Centrifugo PRO saves snapshot metadata to PostgreSQL database. The connections and channels raw data is effectively inserted to ClickHouse from each node during collection, so there is no expensive inter-node communication. Snapshot raw data in ClickHouse expires in 14 days by default.

<video width="100%" loop={true} autoPlay="autoplay" muted controls src="/img/snapshots_demo.mp4"></video>

:::caution

This feature is in beta state now. Use with caution in production. Snapshot collection may add memory and CPU overhead to Centrifugo nodes.

:::

### Configuration

To enable Snapshots feature you need to turn on admin web UI, enable `snapshots` inside `clickhouse_analytics` section and also enable `database` section with PostgreSQL.

```json title="config.json"
{
  "admin": {
    "enabled": true,
    "password": "secure-password-here",
    "secret": "long-secret-here"
  },
  "clickhouse_analytics": {
    "enabled": true,
    "clickhouse_dsn": [
      "tcp://default:default@127.0.0.1:9000",
    ],
    "clickhouse_database": "centrifugo",
    "clickhouse_cluster": "centrifugo_cluster",
    "snapshots": {
      "enabled": true
    }
  },
  "database": {
    "enabled": true,
    "postgresql": {
      "dsn": "postgres://test:test@localhost:5432/test?sslmode=disable"
    }
  }
}
```

## More data in admin UI

* an ability to show: CPU and RSS memory usage of each node, updated in near real-time
* show aggregations over `node.info_metrics_aggregate_interval` for each node:
* Distribution by client name
* Client incoming frames rate
* Client outgoing frames rate
* Client connect rate
* Client subscribe rate
* Server API calls rate
* Publication rate

Here is how this looks like:

![PRO UI](/img/pro_admin_ui_status.jpg)
