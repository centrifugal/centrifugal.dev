---
id: admin_web
title: Admin web UI
---

Centrifugo comes with a built-in administrative web interface. It enables users to:

* Display general information and statistics from server nodes - including the number of connections, unique users, subscriptions, and unique channels, among others
* Execute commands such as `publish`, `broadcast`, `subscribe`, `unsubscribe`, `disconnect`, `history`, `history_remove`, `presence`, `presence_stats`, `info`, `channels`, along with several additional Centrifugo PRO server API commands.
* Trace connections in real-time (a feature of [Centrifugo PRO](../pro/overview.md)).
* View analytics widgets (a feature of Centrifugo PRO).
* Visualize registered devices for push notifications (a feature of Centrifugo PRO).

To activate the administrative web interface, run Centrifugo with the `admin` UI enabled and configure security settings in the configuration file:

```json title="config.json"
{
  "admin": {
    "enabled": true,
    "password": "<PASSWORD>",
    "secret": "<SECRET>"
  }
}
```

## Options

* `admin.enabled` (boolean, default: `false`) – enables/disables admin web UI
* `admin.password` (string, default: `""`) – this is a password to log into admin web interface
* `admin.secret` (string, default: `""`) - this is a secret key for authentication token set on successful login.

Make both `admin.password` and `admin.secret` strong and keep them in secret.

After configuring, restart Centrifugo and go to [http://localhost:8000](http://localhost:8000) (by default) - you should see web interface.

:::tip

Although there is a password based authentication a good advice is to protect web interface by firewall rules in production.

:::

![Admin web panel](/img/quick_start_admin_v5.png)
Log in using `admin.password` value:
![Admin web panel](/img/admin_three_nodes.png)

:::tip

Centrifugo PRO [supports Single Sign-On](../pro/admin_idp_auth.md) (SSO) authentication for web interface using OpenID Connect (OIDC) protocol.

:::

## Using custom web interface

If you want to use custom web interface you can specify path to web interface directory dist:

```json title="config.json"
{
  "admin": {
    "enabled": true,
    "password": "<PASSWORD>",
    "secret": "<SECRET>",
    "web_path": "<PATH_TO_WEB_DIST>"
  }
}
```

This can be useful if you want to modify official [web interface code](https://github.com/centrifugal/web) in some way and test it with Centrifugo.

## Admin insecure mode

:::danger INSECURE OPTION.

This option is insecure and mostly intended for development. In case of using in production – please make sure you understand the possible security risks.

:::

There is also an option to run Centrifugo in insecure admin mode. In this mode, it's unnecessary to set `admin.password` and `admin.secret` in the configuration – you will be automatically logged into the web interface without any password. Note that this mode should only be considered for production if you have protected the admin web interface with firewall rules. Without such protection, anyone on the internet would have full access to the admin functionalities described above. To enable insecure admin mode:

```json title="config.json"
{
  "admin": {
    "enabled": true,
    "insecure": true
  }
}
```
