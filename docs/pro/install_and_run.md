---
description: "Install and run Centrifugo PRO via binary release, Docker, Kubernetes Helm chart, or DEB/RPM packages. Set your license key to unlock all features."
id: install_and_run
title: Install and run Centrifugo PRO
sidebar_label: Install and run Centrifugo PRO
---

:::caution Centrifugo PRO license agreement

Centrifugo PRO is distributed by Centrifugal Labs LTD under [commercial license](/license) which is different from OSS version. By downloading Centrifugo PRO you automatically accept commercial license terms.

:::

### Binary release

Centrifugo PRO binary releases are [available on Github](https://github.com/centrifugal/centrifugo-pro/releases). Note that we use a separate repo for PRO releases. Download the latest release for your operating system, unpack it and run (see how to set the license key [below](#setting-pro-license-key)).

If you are unsure which distribution you need, then on Linux or macOS you can use the following command to download and unpack the `centrifugo` binary to your current working directory:

```shell
curl -sSLf https://centrifugal.dev/install_pro.sh | sh
```

### Docker image

Centrifugo PRO uses a different image from OSS version – [centrifugo/centrifugo-pro](https://hub.docker.com/r/centrifugo/centrifugo-pro):

```
docker run --ulimit nofile=262144:262144 -v /host/dir/with/config/file:/centrifugo -p 8000:8000 centrifugo/centrifugo-pro:v6.10.0 centrifugo -c config.json
```

### Kubernetes

You can use our [official Helm chart](https://github.com/centrifugal/helm-charts) but make sure you changed Docker image to use PRO version and point to the correct image tag:

```yaml title="values.yaml"
...
image:
  registry: docker.io
  repository: centrifugo/centrifugo-pro
  tag: v6.10.0
```

### Debian and Ubuntu

DEB package [available in release assets](https://github.com/centrifugal/centrifugo-pro/releases).

```
wget https://github.com/centrifugal/centrifugo-pro/releases/download/v6.10.0/centrifugo-pro_6.10.0-0_amd64.deb
sudo dpkg -i centrifugo-pro_6.10.0-0_amd64.deb
```

### Centos

RPM package [available in release assets](https://github.com/centrifugal/centrifugo-pro/releases).

```
wget https://github.com/centrifugal/centrifugo-pro/releases/download/v6.10.0/centrifugo-pro-6.10.0-0.x86_64.rpm
sudo yum install centrifugo-pro-6.10.0-0.x86_64.rpm
```

### Verifying release artifacts

Starting from Centrifugo PRO v6.10.0, release artifacts are signed and include an SBOM, the same way as for the [OSS version](../getting-started/installation.md#verifying-release-artifacts). Centrifugo PRO is built in the `centrifugal/centrifugo-pro-source` repository and published to `centrifugal/centrifugo-pro`, so the signing identity refers to the build repository:

```bash
VERSION=6.10.0
cosign verify-blob \
  --certificate-identity "https://github.com/centrifugal/centrifugo-pro-source/.github/workflows/release.yml@refs/tags/v${VERSION}" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --bundle centrifugo-pro_${VERSION}_checksums.txt.sigstore.json \
  centrifugo-pro_${VERSION}_checksums.txt
sha256sum --ignore-missing -c centrifugo-pro_${VERSION}_checksums.txt
```

To verify a Docker image:

```bash
cosign verify centrifugo/centrifugo-pro:v6.10.0 \
  --certificate-identity "https://github.com/centrifugal/centrifugo-pro-source/.github/workflows/release.yml@refs/tags/v6.10.0" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

## Setting PRO license key

Centrifugo PRO inherits all features and configuration options from the open-source version. The only difference is that it expects a valid license key on start to avoid sandbox mode limits.

Once you have installed a PRO version and have a license key, you can set it in the configuration via the `license` field, or pass it via environment variables as `CENTRIFUGO_LICENSE`. Like this:

```json title="config.json"
{
    ...
    "license": "<YOUR_LICENSE_KEY>"
}
```

:::tip

If the license is properly set, then on Centrifugo PRO start you should see license information in logs: owner, license type and expiration date. All PRO features should be unlocked at this point. The warning about sandbox mode in logs on server start should disappear.

:::
