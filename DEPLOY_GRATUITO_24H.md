# Deploy gratuito 24h (modo faca tudo)

Este guia usa Oracle Always Free + DuckDNS + Docker Compose.
O projeto ja esta preparado com:

- Dockerfile
- docker-compose.yml (app + HTTPS via Caddy)
- Caddyfile
- scripts/install-docker-ubuntu.sh
- scripts/setup-duckdns.sh
- scripts/deploy-prod.sh

## 1) Criar VM gratuita

1. Crie a VM Ubuntu 22.04 no Oracle Free Tier.
2. Libere portas 22, 80 e 443 no Security List da VCN.
3. Conecte por SSH.

## 2) Clonar projeto na VM

git clone URL_DO_SEU_REPOSITORIO oficina
cd oficina

## 3) Instalar Docker (automatico)

chmod +x scripts/install-docker-ubuntu.sh
./scripts/install-docker-ubuntu.sh

Se pedir, saia e entre no SSH novamente para aplicar grupo docker.

## 4) Configurar dominio gratis DuckDNS

1. Crie um subdominio em duckdns.org (exemplo: oficinaxpto).
2. Pegue o token da sua conta DuckDNS.
3. Rode:

chmod +x scripts/setup-duckdns.sh
./scripts/setup-duckdns.sh oficinaxpto SEU_TOKEN_DUCKDNS

## 5) Configurar variaveis de ambiente

cp .env.example .env

Edite .env e ajuste DOMAIN para seu dominio:

DOMAIN=oficinaxpto.duckdns.org

O AUTH_SECRET sera trocado automaticamente por um valor forte no deploy, se ainda estiver no padrao.

## 6) Subir producao (automatico)

chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh

## 7) Validar

docker compose ps
docker compose logs -f

Acesso final:

https://oficinaxpto.duckdns.org

## 8) Atualizar aplicacao depois

git pull
./scripts/deploy-prod.sh

## 9) Persistencia de dados

- Banco SQLite e uploads ficam em ./data
- A pasta ./data esta mapeada no container
- Reiniciar container nao perde dados
