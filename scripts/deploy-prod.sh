#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

mkdir -p data/uploads

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

if grep -q "troque-por-uma-chave" .env; then
  SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  sed -i "s|^AUTH_SECRET=.*$|AUTH_SECRET=${SECRET}|" .env
fi

if ! grep -q "^DOMAIN=.*" .env; then
  echo "DOMAIN=seu-subdominio.duckdns.org" >> .env
fi

docker compose pull

docker compose up -d --build

echo "Deploy finalizado."
echo "Verifique saude: docker compose ps"
