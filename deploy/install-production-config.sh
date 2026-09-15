#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="/opt/cesar-mmo"
SERVER_ENV="/etc/cesar-mmo/server.env"

RDS_CA_DIR="/etc/cesar-mmo/certs"
RDS_CA_FILE="${RDS_CA_DIR}/sa-east-1-bundle.pem"
RDS_CA_URL="https://truststore.pki.rds.amazonaws.com/sa-east-1/sa-east-1-bundle.pem"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Este script debe ejecutarse como root."
  echo "Usa: sudo $0"
  exit 1
fi

cd "$APP_DIR"

echo "=============================================="
echo " Cesar MMO Edition - Install Production Config"
echo "=============================================="

echo
echo "[1/7] Validando archivos versionados..."

test -f deploy/cesar-mmo-server.service
test -f deploy/nginx/cesar-mmo.conf
test -f deploy/cesar-mmo-deploy
test -f "$SERVER_ENV"

command -v curl >/dev/null

echo "✅ Archivos encontrados"

echo
echo "[2/7] Instalando servicio systemd..."

install \
  -o root \
  -g root \
  -m 0644 \
  deploy/cesar-mmo-server.service \
  /etc/systemd/system/cesar-mmo-server.service

echo
echo "[3/7] Instalando configuración Nginx..."

install \
  -o root \
  -g root \
  -m 0644 \
  deploy/nginx/cesar-mmo.conf \
  /etc/nginx/conf.d/cesar-mmo.conf

echo
echo "[4/7] Instalando deployment script..."

install \
  -o root \
  -g root \
  -m 0750 \
  deploy/cesar-mmo-deploy \
  /usr/local/bin/cesar-mmo-deploy

echo
echo "[5/7] Instalando certificado CA de Amazon RDS..."

install \
  -d \
  -o root \
  -g cesarmmo \
  -m 0750 \
  "$RDS_CA_DIR"

TMP_CA="$(mktemp)"

cleanup() {
  rm -f "$TMP_CA"
}

trap cleanup EXIT

curl -fsSL \
  "$RDS_CA_URL" \
  -o "$TMP_CA"

grep -q "BEGIN CERTIFICATE" "$TMP_CA"

install \
  -o root \
  -g cesarmmo \
  -m 0640 \
  "$TMP_CA" \
  "$RDS_CA_FILE"

if grep -q '^NODE_EXTRA_CA_CERTS=' "$SERVER_ENV"; then
  sed -i \
    "s|^NODE_EXTRA_CA_CERTS=.*|NODE_EXTRA_CA_CERTS=${RDS_CA_FILE}|" \
    "$SERVER_ENV"
else
  printf '\nNODE_EXTRA_CA_CERTS=%s\n' "$RDS_CA_FILE" >> "$SERVER_ENV"
fi

chown root:cesarmmo "$SERVER_ENV"
chmod 0640 "$SERVER_ENV"

sudo -u cesarmmo test -r "$RDS_CA_FILE"

echo "✅ Certificado RDS instalado"

echo
echo "[6/7] Validando configuración..."

systemctl daemon-reload
nginx -t

echo
echo "[7/7] Reiniciando servicios..."

systemctl restart cesar-mmo-server
systemctl restart nginx

sleep 2

systemctl is-active --quiet cesar-mmo-server
systemctl is-active --quiet nginx

curl --fail --silent --show-error \
  http://127.0.0.1/health \
  >/tmp/cesar-mmo-health.json

grep -q '"status":"ok"' /tmp/cesar-mmo-health.json

echo
echo "=============================================="
echo " CONFIGURACIÓN INSTALADA CORRECTAMENTE"
echo "=============================================="

echo
echo "NestJS: $(systemctl is-active cesar-mmo-server)"
echo "Nginx:  $(systemctl is-active nginx)"
echo -n "Health: "
cat /tmp/cesar-mmo-health.json
echo