#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Uso: $0 <subdominio_duckdns> <token_duckdns>"
  exit 1
fi

SUBDOMAIN="$1"
TOKEN="$2"

mkdir -p "$HOME/duckdns"

cat > "$HOME/duckdns/duck.sh" <<EOF
#!/usr/bin/env bash
echo url=\"https://www.duckdns.org/update?domains=${SUBDOMAIN}&token=${TOKEN}&ip=\" | curl -k -o \"$HOME/duckdns/duck.log\" -K -
EOF

chmod 700 "$HOME/duckdns/duck.sh"
"$HOME/duckdns/duck.sh"

( crontab -l 2>/dev/null; echo "*/5 * * * * $HOME/duckdns/duck.sh >/dev/null 2>&1" ) | crontab -

echo "DuckDNS configurado para ${SUBDOMAIN}.duckdns.org"
