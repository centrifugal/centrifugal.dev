---
id: install_and_run
title: Install and run PRO version
---

:::caution

Centrifugo PRO is distributed under [commercial license](/pro_license) which is different from OSS version. By downloading Centrifugo PRO you automatically accept license terms.

:::

### Binary release

Centrifugo PRO binary releases [available on Github](https://github.com/centrifugal/centrifugo-pro/releases). Note that we use a separate repo for PRO releases. Download latest release for your operating system, unpack it and run (see how to set license key [below](#setting-pro-license-key)).

### Docker image

Centrifugo PRO uses a different image from OSS version – [centrifugo/centrifugo-pro](https://hub.docker.com/repository/docker/centrifugo/centrifugo-pro):

```
docker run --ulimit nofile=65536:65536 -v /host/dir/with/config/file:/centrifugo -p 8000:8000 centrifugo/centrifugo-pro:v4.0.0-beta.5 centrifugo -c config.json
```

### Kubernetes

You can use our [official Helm chart](https://github.com/centrifugal/helm-charts) but make sure you changed Docker image to use PRO version and point to the correct image tag:

```yaml title="values.yaml"
...
image:
  registry: docker.io
  repository: centrifugo/centrifugo-pro
  tag: v4.0.0-beta.5
```

### Debian and Ubuntu

DEB package [available in release assets](https://github.com/centrifugal/centrifugo-pro/releases).

```
wget https://github.com/centrifugal/centrifugo-pro/releases/download/v4.0.0-beta.5/centrifugo-pro_4.0.0-beta.5_amd64.deb
sudo dpkg -i centrifugo-pro_4.0.0-beta.5_amd64.deb
```

### Centos

RPM package [available in release assets](https://github.com/centrifugal/centrifugo-pro/releases).

```
wget https://github.com/centrifugal/centrifugo-pro/releases/download/v4.0.0-beta.5/centrifugo-pro-4.0.0-beta.5.x86_64.rpm
sudo yum install centrifugo-pro-4.0.0-beta.5.x86_64.rpm
```

## Setting PRO license key

Centrifugo PRO inherits all features and configuration options from open-source version. The only difference is that it expects a valid license key on start to avoid sandbox mode limits.

Once you have installed a PRO version and have a license key you can set it in configuration over `license` field, or pass over environment variables as `CENTRIFUGO_LICENSE`. Like this:

```json title="config.json"
{
    ...
    "license": "<YOUR_LICENSE_KEY>"
}
```

:::tip

If license properly set then on Centrifugo PRO start you should see license information in logs: owner, license type and expiration date. All PRO features should be unlocked at this point. Warning about sandbox mode in logs on server start must disappear.

:::
