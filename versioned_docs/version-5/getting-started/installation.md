---
id: installation
title: Install Centrifugo
---

Centrifugo server is written in the Go language. It's open-source software, and the source code is available [on Github](https://github.com/centrifugal/centrifugo).

## Install from the binary release

For local development, you can download the prebuilt Centrifugo binary release (i.e., a single all-contained executable file) for your system.

Binary releases are available on Github. [Download the latest release](https://github.com/centrifugal/centrifugo/releases) for your operating system, unpack it, and you are done. Centrifugo is pre-built for:

* Linux 64-bit (linux_amd64)
* Linux 32-bit (linux_386)
* Linux ARM 64-bit (linux_arm64)
* MacOS (darwin_amd64)
* MacOS on Apple Silicon (darwin_arm64)
* Windows (windows_amd64)
* FreeBSD (freebsd_amd64)
* ARM v6 (linux_armv6)

Archives contain a single statically compiled binary `centrifugo` file that is ready to run.

```
./centrifugo
```

If you are unsure which distribution you need, then on Linux or MacOS you can use the following command to download and unpack the `centrifugo` binary to your current working directory:

```shell
curl -sSLf https://centrifugal.dev/install.sh | sh
```

See the version of Centrifugo:

```
./centrifugo version
```

Centrifugo requires a configuration file with several secret keys. If you are new to Centrifugo, then there is a genconfig command which generates a minimal configuration file to get started:

```bash
./centrifugo genconfig
```

This creates a configuration file config.json with some auto-generated option values in the current directory (by default).

:::tip

It's possible to generate a file in YAML or TOML format, for example: `./centrifugo genconfig -c config.toml`

:::

With a configuration file, you can finally run a Centrifugo instance:

```bash
./centrifugo --config=config.json
```

We will talk about configuration in detail in the next sections.

You can also put or symlink `centrifugo` into your `bin` OS directory and run it from anywhere:

```bash
centrifugo --config=config.json
```

## Docker image

Centrifugo server has a docker image [available on Docker Hub](https://hub.docker.com/r/centrifugo/centrifugo/).

Generate a configuration file.
```
docker run --rm -v$PWD:/centrifugo centrifugo/centrifugo:v5 centrifugo genconfig
```

Run:

```bash
docker run --rm --ulimit nofile=262144:262144 -v /host/dir/with/config/file:/centrifugo -p 8000:8000 centrifugo/centrifugo:v5 centrifugo -c config.json
```

Note that docker allows setting `nofile` limits in command-line arguments, which is quite important to handle many simultaneous persistent connections and not run out of the open file limit (each connection requires one file descriptor). See also [infrastructure tuning chapter](../server/infra_tuning.md).

:::caution

Pin to the exact Docker Image tag in production, for instance: `centrifugo/centrifugo:v5.0.0`. This will help to avoid unexpected problems during redeployment process.

:::

## Docker-compose example

Create configuration file `config.json`:

```json
{
  "token_hmac_secret_key": "my_secret",
  "api_key": "my_api_key",
  "admin_password": "password",
  "admin_secret": "secret",
  "admin": true
}
```

Create `docker-compose.yml`:

```yml
version: "3.9"
services:
  centrifugo:
    container_name: centrifugo
    image: centrifugo/centrifugo:v5
    volumes:
      - ./config.json:/centrifugo/config.json
    command: centrifugo -c config.json
    ports:
      - 8000:8000
    ulimits:
      nofile:
        soft: 65535
        hard: 65535
```

Run with:

```
docker-compose up
```

## Kubernetes Helm chart

See our [official Kubernetes Helm chart](https://github.com/centrifugal/helm-charts). Follow instructions in a Centrifugo chart README to bootstrap Centrifugo inside your Kubernetes cluster.

## RPM and DEB packages for Linux

Every time we make a new Centrifugo release we upload rpm and deb packages for popular Linux distributions on [packagecloud.io](https://packagecloud.io/FZambia/centrifugo).

At moment, we support versions of the following distributions:

* 64-bit Debian 10 Buster
* 64-bit Debian 11 Bullseye
* 64-bit Debian 12 Bookworm
* 64-bit Ubuntu 18.04 Bionic
* 64-bit Ubuntu 20.04 Focal Fossa
* 64-bit Ubuntu 22.04 Jammy
* 64-bit Centos 7

See [full list of available packages](https://packagecloud.io/FZambia/centrifugo) and [installation instructions](https://packagecloud.io/FZambia/centrifugo/install).

Centrifugo also works on 32-bit architecture, but we don't support packaging for it since 64-bit is more convenient for servers today.

## With brew on macOS

If you are developing on macOS then you can install Centrifugo over `brew`:

```
brew tap centrifugal/centrifugo
brew install centrifugo
```

## Build from source

You need Go language [installed](https://go.dev/doc/install). Then:

```
git clone https://github.com/centrifugal/centrifugo.git
cd centrifugo
go build
./centrifugo
```
