---
id: install_and_run
title: Install and run PRO version
---

:::note

Centrifugo PRO distributed under [commercial license](/pro_license) which is different from OSS version.

:::

## Installing PRO version

### Binary release

Centrifugo PRO binary releases [available on Github](https://github.com/centrifugal/centrifugo-pro/releases). Note that we use a separate repo for PRO releases. Download latest release for your operating system, unpack it and run with license key.

### Docker image

Centrifugo PRO uses a different image from OSS version:

```
docker pull centrifugo/centrifugo-pro
```

### Kubernetes

You can use our official Helm chart but make sure you changed Docker image to use PRO version:

```yaml title="values.yaml"
...
image:
  registry: docker.io
  repository: centrifugo/centrifugo-pro
```

### Debian and Ubuntu

DEB package [available in release assets](https://github.com/centrifugal/centrifugo-pro/releases).

```
wget https://github.com/centrifugal/centrifugo-pro/releases/download/v3.0.2-beta.1/centrifugo-pro_3.0.2-beta.1_amd64.deb
sudo dpkg -i centrifugo-pro_3.0.2-beta.1_amd64.deb
```

### Centos

RPM package [available in release assets](https://github.com/centrifugal/centrifugo-pro/releases).

```
wget https://github.com/centrifugal/centrifugo-pro/releases/download/v3.0.2-beta.1/centrifugo-pro-3.0.2-beta.1.x86_64.rpm
sudo yum install centrifugo-pro-3.0.2-beta.1.x86_64.rpm
```

## Running PRO version

Centrifugo PRO inherits all features and configuration options from open-source version. The only difference is that it expects a valid license key on start.

Once you have installed a PRO version and have a license key you can set it in configuration over `license` field, or pass over environment variables as `CENTRIFUGO_LICENSE`. Like this:

```json title="config.json"
{
    ...
    "license": "<YOUR_LICENSE_KEY>"
}
```

:::tip

If license properly set then on Centrifugo PRO start you should see license information in logs: owner, license type and expiration date. All PRO features should be unlocked at this point.

:::
