#!/usr/bin/env bash
# Rydder Netlifys durable cache for de sider, fase 1 og 2 aendrer.
# Et deploy rydder den IKKE, saa scriptet skal koeres efter deployet er groent.
# Koeres fra web/: bash scripts/revalider-fase1-2.sh
set -euo pipefail
cd "$(dirname "$0")/.."
SECRET="$(grep -E '^ADMIN_SECRET=' .env.local | cut -d= -f2- | tr -d '"'"'"'')"
[ -n "$SECRET" ] || { echo "ADMIN_SECRET mangler i web/.env.local"; exit 2; }

PATHS="$(DOTENV_CONFIG_PATH=.env.local npx --no-install tsx scripts/revalider-stier.ts)"
echo "revaliderer $(echo "$PATHS" | tr -cd ',' | wc -c | tr -d ' ') + 1 stier"

curl -sS -X POST https://shelterdk.dk/api/revalidate \
  -H "content-type: application/json" \
  -H "x-admin-secret: $SECRET" \
  -d "{\"paths\":$PATHS}" | head -c 4000
echo
