#!/usr/bin/env bash
# 現在の LAN IP を含む自己署名証明書を certificates/ に生成する（Git 管理対象外）。
#
# スマホ実機からの位置情報・加速度センサーはセキュアコンテキスト（HTTPS または localhost）
# でしか使えないので、同じ Wi-Fi のスマホから PC の IP で開くには dev サーバーを HTTPS に
# する必要がある。vite.config.ts は certificates/ に証明書があれば自動で HTTPS になる。
#
# DHCP 環境では PC の IP が変わることがあり、証明書の SAN が古い IP のままだとスマホから
# 繋がらなくなる。繋がらなくなったらこのスクリプトを実行して dev サーバーを再起動する。
set -euo pipefail

cd "$(dirname "$0")/.."

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$LAN_IP" ]; then
  echo "LAN IP を取得できませんでした（en0 以外を使っている場合は手で指定してください）" >&2
  exit 1
fi

mkdir -p certificates
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certificates/localhost-key.pem \
  -out certificates/localhost.pem \
  -days 365 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${LAN_IP}"

echo "証明書を生成しました (LAN IP: ${LAN_IP})"
openssl x509 -in certificates/localhost.pem -noout -ext subjectAltName
