---
id: console_commands
title: CLI commands
---

Here is a list of helpful command-line commands that come with Centrifugo executable.

## version

To show Centrifugo version and exit run:

```
centrifugo version
```

## genconfig

Another command is `genconfig`:

```
centrifugo genconfig -c config.json
```

It will automatically generate the minimal required configuration file. This is mostly useful for development.

If any errors happen – program will exit with error message and exit code 1.

`genconfig` also supports generation of YAML and TOML configuration file formats - just provide an extension to a file:

```
centrifugo genconfig -c config.toml
```

## checkconfig

Centrifugo has special command to check configuration file `checkconfig`:

```bash
centrifugo checkconfig --config=config.json
```

If any errors found during validation – program will exit with error message and exit code 1.

## gentoken

Another command is `gentoken`:

```
centrifugo gentoken -c config.json -u 28282
```

It will automatically generate HMAC SHA-256 based token for user with ID `28282` (which expires in 1 week).

You can change token TTL with `-t` flag (number of seconds):

```
centrifugo gentoken -c config.json -u 28282 -t 3600
```

This way generated token will be valid for 1 hour.

If any errors happen – program will exit with error message and exit code 1.

This command is mostly useful for development.

## gensubtoken

Another command is `gensubtoken`:

```
centrifugo gensubtoken -c config.json -u 28282 -s channel
```

It will automatically generate HMAC SHA-256 based subscription token for channel `channel` and user with ID `28282` (which expires in 1 week).

You can change token TTL with `-t` flag (number of seconds):

```
centrifugo gentoken -c config.json -u 28282 -s channel -t 3600
```

This way generated token will be valid for 1 hour.

If any errors happen – program will exit with error message and exit code 1.

This command is mostly useful for development.

## checktoken

One more command is `checktoken`:

```
centrifugo checktoken -c config.json <TOKEN>
```

It will validate your connection JWT, so you can test it before using while developing application.

If any errors happen or validation failed – program will exit with error message and exit code 1.

This is mostly useful for development.

## checksubtoken

One more command is `checksubtoken`:

```
centrifugo checksubtoken -c config.json <TOKEN>
```

It will validate your subscription JWT, so you can test it before using while developing application.

If any errors happen or validation failed – program will exit with error message and exit code 1.

This is mostly useful for development.
