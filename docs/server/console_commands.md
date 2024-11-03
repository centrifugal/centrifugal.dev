---
id: console_commands
title: Helper CLI commands
---

Here is a list of helpful built-in command-line commands that come with `centrifugo` executable.

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

It will automatically generate the configuration file with some frequently required options. This is mostly useful for development.

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

## defaultconfig

The `defaultconfig` generates the configuration file with all defaults for all all available configuration options.

Try:

```bash
centrifugo defaultconfig -c config.json
centrifugo defaultconfig -c config.yaml
centrifugo defaultconfig -c config.toml
```

Also, in dry-run mode it will be posted to STDOUT instead of file:

```bash
centrifugo defaultconfig -c config.json --dry-run
```

Finally, it's possible to provide this command a base configuration file - so the result will inherit option values from base file and will extend it with defaults for everything else:

```bash
centrifugo defaultconfig -c config.json --dry-run --base existing_config.json
```

## defaultenv

In addition to `defaultconfig` Centrifugo  has `defaultenv` command. The `defaultenv` prints all config options as environment vars with default values to STDOUT. Run:

```bash
centrifugo defaultenv
```

It also supports the base config file to inherit values from:

```bash
centrifugo defaultenv --base config.json
```

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
