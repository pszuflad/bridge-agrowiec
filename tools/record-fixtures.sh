#!/bin/bash
# ============================================================================
#  Bridge — record-fixtures.sh : nagranie odpowiedzi GET z ŻYWEGO backendu (2.4)
#
#  TYLKO ODCZYT (GET). Nie dotyka danych — żadnych POST/PUT/PATCH/DELETE.
#  Loguje się raz, dla każdego endpointu z listy zapisuje status + body do
#  contract/fixtures/GET_*.json.
#
#  Uruchomienie:  bash tools/record-fixtures.sh
#  Opcjonalnie:   bash tools/record-fixtures.sh https://panel.agritires.eu
#
#  Login i hasło podajesz w terminalu (read -s) — NIE trafiają do repo ani logu.
#  Token żyje tylko w pamięci procesu i jest kasowany na końcu.
# ============================================================================
set -uo pipefail

BASE="${1:-https://panel.agritires.eu}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIST="$ROOT/contract/fixtures/_get-endpoints.txt"
OUT="$ROOT/contract/fixtures"
COOKIE="$(mktemp)"; TMP="$(mktemp)"
mkdir -p "$OUT"
trap 'rm -f "$COOKIE" "$TMP"; unset PASS TOKEN 2>/dev/null' EXIT

[ -f "$LIST" ] || { echo "Brak listy: $LIST"; exit 1; }

echo "=== Nagrywanie fixtures z: $BASE ==="
read -rp "Email (login): " EMAIL
read -rsp "Hasło: " PASS; echo

echo "Logowanie..."
LOGIN=$(curl -sk -c "$COOKIE" -X POST "$BASE/api/login" \
  -H 'Content-Type: application/json' \
  --data "$(python3 -c 'import json,sys;print(json.dumps({"email":sys.argv[1],"password":sys.argv[2]}))' "$EMAIL" "$PASS")")
unset PASS
TOKEN=$(printf '%s' "$LOGIN" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("token",""))
except: print("")' 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "BŁĄD logowania. Odpowiedź serwera:"; printf '%s\n' "$LOGIN" | head -c 300; echo
  exit 1
fi
echo "Zalogowano. Nagrywam GET-y..."; echo

n=0; ok=0
while IFS= read -r ep <&3; do
  [ -z "$ep" ] && continue
  case "$ep" in \#*) continue;; esac
  n=$((n+1))
  safe=$(printf '%s' "$ep" | sed 's#^/api/##; s#?.*##; s#/#_#g')
  fname="$OUT/GET_${safe}.json"
  code=$(curl -sk -b "$COOKIE" -H "Authorization: Bearer $TOKEN" \
         -o "$TMP" -w '%{http_code}' "$BASE$ep")
  python3 -c '
import sys,json
fname,ep,code,bf=sys.argv[1:5]
raw=open(bf,encoding="utf8",errors="replace").read()
try: body=json.loads(raw); js=True
except Exception: body=raw[:3000]; js=False
json.dump({"endpoint":ep,"method":"GET","status":int(code) if code.isdigit() else code,
           "json":js,"body":body}, open(fname,"w"), ensure_ascii=False, indent=2)
' "$fname" "$ep" "$code" "$TMP"
  [ "$code" = "200" ] && ok=$((ok+1))
  printf "  %-45s %s\n" "$ep" "$code"
done 3< "$LIST"

echo
echo "=== GOTOWE: $ok/$n odpowiedzi 200. Fixtures w contract/fixtures/ ==="
echo "Przejrzyj i wklej Claude wynik:  ls contract/fixtures/  oraz  grep -l '\"status\": 200' contract/fixtures/*.json | wc -l"
