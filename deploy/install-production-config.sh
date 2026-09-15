#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="/opt/cesar-mmo"

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
echo "[1/6] Validando archivos versionados..."

test -f deploy/cesar-mmo-server.service
test -f deploy/nginx/cesar-mmo.conf
test -f deploy/cesar-mmo-deploy

echo "✅ Archivos encontrados"

echo
echo "[2/6] Instalando servicio systemd..."

install \
  -o root \
  -g root \
  -m 0644 \
  deploy/cesar-mmo-server.service \
  /etc/systemd/system/cesar-mmo-server.service

echo
echo "[3/6] Instalando configuración Nginx..."

install \
  -o root \
  -g root \
  -m 0644 \
  deploy/nginx/cesar-mmo.conf \
  /etc/nginx/conf.d/cesar-mmo.conf

echo
echo "[4/6] Instalando deployment script..."

install \
  -o root \
  -g root \
  -m 0750 \
  deploy/cesar-mmo-deploy \
  /usr/local/bin/cesar-mmo-deploy

echo
echo "[5/6] Validando configuración..."

systemctl daemon-reload
nginx -t

echo
echo "[6/6] Reiniciando servicios..."

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
