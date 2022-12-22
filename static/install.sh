#!/bin/sh

set -e

if [ -n "${DEBUG}" ]; then
  set -x
fi

_centrifugo_latest() {
  curl -s https://api.github.com/repos/centrifugal/centrifugo/releases/latest | grep "tag_name" | awk '{print $2}' | sed 's/[",]//g'
}

_detect_binary() {
  os="$(uname)"
  case "$os" in
    Linux|Darwin) echo "centrifugo" ;;
    *) echo "Unsupported operating system: $os" 1>&2; return 1 ;;
  esac
  unset os
}

_detect_os() {
  os="$(uname)"
  case "$os" in
    Linux) echo "linux" ;;
    Darwin) echo "darwin" ;;
    *) echo "Unsupported operating system: $os" 1>&2; return 1 ;;
  esac
  unset os
}

_detect_arch() {
  arch="$(uname -m)"
  case "$arch" in
    amd64|x86_64) echo "amd64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) echo "Unsupported processor architecture: $arch" 1>&2; return 1 ;;
  esac
  unset arch
}

_download_url() {
  echo "https://github.com/centrifugal/centrifugo/releases/download/$CENTRIFUGO_VERSION/${centrifugoBinary}_${CENTRIFUGO_VERSION#"v"}_${centrifugoOs}_${centrifugoArch}.tar.gz"
}

main() {
  if [ -z "${CENTRIFUGO_VERSION}" ]; then
    CENTRIFUGO_VERSION=$(_centrifugo_latest)
  fi

#  centrifugoInstallPath=/usr/local/bin
  centrifugoInstallPath=`pwd`
  centrifugoBinary="$(_detect_binary)"
  centrifugoOs="$(_detect_os)"
  centrifugoArch="$(_detect_arch)"
  centrifugoDownloadUrl="$(_download_url)"

  mkdir -p -- "$centrifugoInstallPath"

  echo "Downloading centrifugo from URL: $centrifugoDownloadUrl"

  curl -sSLf "$centrifugoDownloadUrl" >"/tmp/centrifugo.tar.gz"
  tar -xzf /tmp/centrifugo.tar.gz ${centrifugoBinary}
  chmod +x "$centrifugoBinary"

  echo "centrifugo is now executable in $centrifugoInstallPath"
}

main
