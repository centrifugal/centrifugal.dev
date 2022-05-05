---
id: db_namespaces
title: Database-driven namespace configuration
sidebar_label: Database-driven namespaces
---

Centrifugo PRO supports database-driven namespace configuration. This means that instead of configuring namespaces in a configuration file you will be able to configure them in admin web UI. It's also possible to select a namespace for automatic personal channel subscription.

![Namespaces](/img/namespaces.png)

## How it works

As soon as you point Centrifugo PRO to an admin storage and enable storage namespace management, Centrifugo will load namespaces from database table on start. Changes made in web UI will then propagate to all running Centrifugo nodes in up to 30 seconds.

:::info

Centrifugo nodes cache namespace configuration in memory so if Centrifugo temporarily lost connection to a database it will continue working with previous namespace configuration until connection problems will be resolved.

:::

## Configuration

By default namespace database management is off – i.e. namespaces loaded on Centrifugo start from a configuration file (or environment variable).

To enable namespace management through database add the following into configuration file:

```json title="config.json"
{
    ...
    "admin_storage": {
        "enabled": true,
        "storage_type": "sqlite",
        "storage_dsn": "/path/to/centrifugo.db",
        "manage_namespaces": true
    }
}
```

Centrifugo PRO supports several SQL database backends to keep namespace information:

* SQLite (storage_type: `sqlite`)
* PostgreSQL (storage_type: `postgresql`)
* MySQL (storage_type: `mysql`)

Each storage type has its own `storage_dsn` format. For SQLite it's just a path to a db file.

PostgreSQL dsn format described [here](https://pkg.go.dev/github.com/jackc/pgconn?utm_source=godoc#ParseConfig). Example:

```json title="config.json"
{
    ...
    "admin_storage": {
        "enabled": true,
        "storage_type": "postgresql",
        "storage_dsn": "host=localhost user=postgres password=mysecretpassword dbname=centrifugo port=5432 sslmode=disable",
        "manage_namespaces": true
    }
}
```

MySQL dsn format described [here](https://github.com/go-sql-driver/mysql#dsn-data-source-name). Example:

```json title="config.json"
{
    ...
    "admin_storage": {
        "enabled": true,
        "storage_type": "mysql",
        "storage_dsn": "user:pass@tcp(127.0.0.1:3306)/dbname?charset=utf8mb4&parseTime=True&loc=Local",
        "manage_namespaces": true
    }
}
```
