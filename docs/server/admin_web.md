---
id: admin_web
title: Admin web UI
---

Centrifugo comes with a built-in admin web interface. It can:

* Show general information and statistics from server nodes - number of connections, unique users, number of subscriptions, unique channels etc.
* Call `publish`, `broadcast`, `subscribe`, `unsubscribe`, `disconnect`, `history`, `history_remove`, `presence`, `presence_stats`, `info`, `channels` and several additional Centrifugo PRO server API commands.
* Trace connections in real-time (Centrifugo PRO feature)

To enable admin web interface run Centrifugo with `admin` option enabled and provide some security options in configuration file:

```json title="config.json"
{
    ...
    "admin": true,
    "admin_password": "<PASSWORD>",
    "admin_secret": "<SECRET>"
}
```

## Options

* `admin` (boolean, default: `false`) – enables/disables admin web UI
* `admin_password` (string, default: `""`) – this is a password to log into admin web interface
* `admin_secret` (string, default: `""`) - this is a secret key for authentication token set on successful login.

Make both `admin_password` and `admin_secret` strong and keep them in secret.

After configuring, restart Centrifugo and go to [http://localhost:8000](http://localhost:8000) (by default) - you should see web interface.

:::tip

Although there is a password based authentication a good advice is to protect web interface by firewall rules in production.

:::

![Admin web panel](/img/quick_start_admin.png)

## Using custom web interface

If you want to use custom web interface you can specify path to web interface directory dist:

```json title="config.json"
{
    ...,
    "admin": true,
    "admin_password": "<PASSWORD>",
    "admin_secret": "<SECRET>",
    "admin_web_path": "<PATH_TO_WEB_DIST>"
}
```

This can be useful if you want to modify official [web interface code](https://github.com/centrifugal/web) in some way and test it with Centrifugo.

## Admin insecure mode

There is also an option to run Centrifugo in insecure admin mode - in this case you don't need to set `admin_password` and `admin_secret` in config – in web interface you will be logged in automatically without any password. Note that this is only an option for production if you protected admin web interface with firewall rules. Otherwise anyone in internet will have full access to admin functionality described above. To enable insecure admin mode:

```json title="config.json"
{
    ...,
    "admin": true,
    "admin_insecure": true,
    "admin_password": "<PASSWORD>",
    "admin_secret": "<SECRET>"
}
```
