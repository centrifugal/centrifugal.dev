---
id: installation
title: Install Centrifugo
---

Centrifugo server is written in Go language. It's an open-source software, the source code is available [on Github](https://github.com/centrifugal/centrifugo).

## Install from the binary release

For a local development you can download prebuilt Centrifugo binary release (i.e. single all-contained executable file) for your system.

Binary releases available on Github. [Download latest release](https://github.com/centrifugal/centrifugo/releases) for your operating system, unpack it and you are done. Centrifugo is pre-built for:

* Linux 64-bit (linux_amd64)
* Linux 32-bit (linux_386)
* Linux ARM 64-bit (linux_arm64)
* MacOS (darwin_amd64)
* MacOS on Apple Silicon (darwin_arm64)
* Windows (windows_amd64)
* FreeBSD (freebsd_amd64)
* ARM v6 (linux_armv6)

Archives contain a single statically compiled binary `centrifugo` file that is ready to run: 

```
./centrifugo
```

If you doubt which distribution you need, then on Linux or MacOS you can use the following command to download and unpack `centrifugo` binary to your current working directory:

```shell
curl -sSLf https://centrifugal.dev/install.sh | sh
```

See the version of Centrifugo:

```
./centrifugo version
```

Centrifugo requires a configuration file with several secret keys. If you are new to Centrifugo then there is `genconfig` command which generates a minimal configuration file to get started:

```bash
./centrifugo genconfig
```

It creates a configuration file `config.json` with some auto-generated option values in a current directory (by default).

:::tip

It's possible to generate file in YAML or TOML format, i.e. `./centrifugo genconfig -c config.toml`

:::

Having a configuration file you can finally run Centrifugo instance:

```bash
./centrifugo --config=config.json
```

We will talk about a configuration in detail in the next sections.

You can also put or symlink `centrifugo` into your `bin` OS directory and run it from anywhere:

```bash
centrifugo --config=config.json
```

## Docker image

Centrifugo server has a docker image [available on Docker Hub](https://hub.docker.com/r/centrifugo/centrifugo/).

```
docker pull centrifugo/centrifugo
```

Run:

```bash
docker run --ulimit nofile=65536:65536 -v /host/dir/with/config/file:/centrifugo -p 8000:8000 centrifugo/centrifugo centrifugo -c config.json
```

Note that docker allows setting `nofile` limits in command-line arguments which is pretty important to handle lots of simultaneous persistent connections and not run out of open file limit (each connection requires one file descriptor). See also [infrastructure tuning chapter](../server/infra_tuning.md).

:::caution

Pin to the exact Docker Image tag in production, for example: `centrifugo/centrifugo:v4.0.0`, this will help to avoid unexpected problems during re-deploy process. 

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
centrifugo:
  container_name: centrifugo
  image: centrifugo/centrifugo:v4
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

* 64-bit Debian 8 Jessie
* 64-bit Debian 9 Stretch
* 64-bit Debian 10 Buster
* 64-bit Debian 11 Bullseye
* 64-bit Ubuntu 16.04 Xenial
* 64-bit Ubuntu 18.04 Bionic
* 64-bit Ubuntu 20.04 Focal Fossa
* 64-bit Centos 7
* 64-bit Centos 8

See [full list of available packages](https://packagecloud.io/FZambia/centrifugo) and [installation instructions](https://packagecloud.io/FZambia/centrifugo/install).

Centrifugo also works on 32-bit architecture, but we don't support packaging for it since 64-bit is more convenient for servers today.

## With brew on macOS

If you are developing on macOS then you can install Centrifugo over `brew`:

```
brew tap centrifugal/centrifugo
brew install centrifugo
```

## Build from source

You need Go language installed:

```
git clone https://github.com/centrifugal/centrifugo.git
cd centrifugo
go build
./centrifugo
```
