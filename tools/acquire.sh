#!/bin/bash
# ============================================================================
#  Bridge — acquire.sh : pełne pobranie stanu produkcji na maszynę dev
#  TYLKO ODCZYT po stronie serwera. Nie ściąga sekretów (.env).
#  Uruchom z katalogu repo:  bash tools/acquire.sh
# ============================================================================
set -euo pipefail

VPS="admin@vpshd1242.cyber-folks.pl"
PORT=222
BE_REMOTE="/home/admin/private_apps/bridge"
FE_REMOTE="/home/admin/domains/agritires.eu/public_html/panel"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/mirror/backend" "$ROOT/mirror/frontend" "$ROOT/db"
TS="$(date +%Y%m%d-%H%M%S)"

# Uwaga: systemowy sqlite3 na serwerze to 3.26 (bez VACUUM INTO, od 3.27).
# Metoda przenośna: .backup daje spójną kopię online (WAL-safe), potem zwykły
# VACUUM kompaktuje kopię na serwerze -> pobieramy ~25 MB zamiast ~210 MB.
echo "[1/5] Spójny snapshot bazy (.backup + VACUUM na serwerze)..."
ssh -p "$PORT" "$VPS" "sqlite3 '$BE_REMOTE/data.db' \".backup '/tmp/bridge_snap_$TS.db'\" && sqlite3 '/tmp/bridge_snap_$TS.db' 'VACUUM;'"

echo "[2/5] Pobranie snapshotu -> db/snapshot.db"
scp -P "$PORT" "$VPS:/tmp/bridge_snap_$TS.db" "$ROOT/db/snapshot.db"
ssh -p "$PORT" "$VPS" "rm -f /tmp/bridge_snap_$TS.db"

echo "[3/5] Schemat bazy -> db/schema.sql"
ssh -p "$PORT" "$VPS" "sqlite3 '$BE_REMOTE/data.db' .schema" > "$ROOT/db/schema.sql"

echo "[4/5] Backend -> mirror/backend/ (bez node_modules, bazy, logów, .env)"
rsync -az --delete --delete-excluded -e "ssh -p $PORT" \
  --exclude 'node_modules' \
  --exclude 'data.db*' \
  --exclude 'bridge.db' \
  --exclude 'backups' \
  --exclude 'index.cjs.bak*' --exclude 'index.cjs.backup*' \
  --exclude '*.tar.gz' --exclude '*.gz' \
  --exclude '.env' --exclude '.env.*' \
  --exclude 'logs' --exclude '*.log' \
  "$VPS:$BE_REMOTE/" "$ROOT/mirror/backend/"

echo "[5/5] Frontend -> mirror/frontend/ (z łańcuchem .bak = historia zmian)"
rsync -az --delete -e "ssh -p $PORT" \
  --exclude 'node_modules' \
  "$VPS:$FE_REMOTE/" "$ROOT/mirror/frontend/"

# opcjonalnie: changelog Ani, jeśli już skonfigurowany na serwerze
scp -P "$PORT" "$VPS:$BE_REMOTE/CHANGELOG.md" "$ROOT/knowledge/CHANGELOG-ania.md" 2>/dev/null \
  && echo "     + pobrano CHANGELOG-ania.md" || true

{
  echo "$(date '+%F %T')  acquire"
  echo "  backend  md5(index.cjs): $(md5sum "$ROOT/mirror/backend/index.cjs" 2>/dev/null | cut -d' ' -f1)"
  echo "  db       $(du -h "$ROOT/db/snapshot.db" 2>/dev/null | cut -f1)"
} >> "$ROOT/mirror/ACQUIRED.txt"

echo
echo "GOTOWE. Podsumowanie:"
tail -3 "$ROOT/mirror/ACQUIRED.txt"
