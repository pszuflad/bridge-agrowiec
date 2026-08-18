#!/bin/bash
# ============================================================================
#  Bridge — vps-sync.sh : PRODUCENT po stronie serwera
#  Uruchamiany z crona na VPS. Pliki produkcji są LOKALNE (bez ssh/rsync po sieci).
#  Snapshotuje stan produkcji -> git -> push do GitHuba (przez deploy key).
#
#  Laptopy NIE uruchamiają tego skryptu — one tylko `git pull`.
#  Konfiguracja: patrz docs/vps-syncer-setup.md
# ============================================================================
set -euo pipefail

REPO="$HOME/bridge-sync"                                  # klon repo na VPS
BE_SRC="/home/admin/private_apps/bridge"                  # żywy backend
FE_SRC="/home/admin/domains/agritires.eu/public_html/panel"  # żywy frontend

cd "$REPO"

# node z nvm/.nvmrc jeśli dostępne (dla deminify), inaczej systemowy node
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null 2>&1 || true

# 1. Bądź na bieżąco z tym, co pushnęły laptopy (docs/, knowledge/, rebuild/)
git pull --rebase --autostash origin main >/dev/null 2>&1 || true

# 2. Skopiuj lokalną produkcję do mirror/ (te same wykluczenia co acquire.sh)
rsync -a --delete --delete-excluded \
  --exclude 'node_modules' \
  --exclude 'data.db*' --exclude 'bridge.db' \
  --exclude 'backups' \
  --exclude 'index.cjs.bak*' --exclude 'index.cjs.backup*' \
  --exclude '*.tar.gz' --exclude '*.gz' \
  --exclude '.env' --exclude '.env.*' \
  --exclude 'logs' --exclude '*.log' \
  "$BE_SRC/" "$REPO/mirror/backend/"

rsync -a --delete --exclude 'node_modules' \
  "$FE_SRC/" "$REPO/mirror/frontend/"

# 3. Schemat bazy (wersjonowany). snapshot.db jest gitignored — nie kopiujemy.
sqlite3 "$BE_SRC/data.db" .schema > "$REPO/db/schema.sql"

# 4. Deminify żywych bundli -> deminified/ (diffowalne)
bash "$REPO/tools/deminify.sh" >/dev/null

# 5. Commit + push + powiadomienie — tylko jeśli coś się zmieniło
git add mirror/ deminified/ db/schema.sql
if git diff --cached --quiet; then
  echo "$(date '+%F %T')  brak zmian"
else
  TS="$(date '+%F %T')"
  NS="$(git diff --cached --name-status)"

  # kategorie zmiany (do tematu maila i commita)
  CAT=""
  printf '%s\n' "$NS" | grep -q 'db/schema\.sql'                       && CAT="$CAT[BAZA]"
  printf '%s\n' "$NS" | grep -qE 'mirror/backend|deminified/backend'   && CAT="$CAT[BACKEND]"
  printf '%s\n' "$NS" | grep -qE 'mirror/frontend|deminified/frontend' && CAT="$CAT[FRONTEND]"
  [ -z "$CAT" ] && CAT="[INNE]"

  # etykiety zmian z nazw kopii .bak (np. "sniegfix") — niezawodne, bo Ania zawsze robi .bak
  BAKS="$(printf '%s\n' "$NS" | grep -oE '\.bak_pre_[A-Za-z0-9_-]+' \
          | sed -E 's/\.bak_pre_//; s/[_-][0-9]{6,}.*$//' | sort -u | tr '\n' ' ' | sed 's/ *$//')"

  # najnowszy wpis z changelogu Ani (pierwsza sekcja "## "), jeśli CHANGELOG się zmienił
  CH=""
  if printf '%s\n' "$NS" | grep -q 'CHANGELOG' && [ -f "$REPO/mirror/backend/CHANGELOG.md" ]; then
    CH="$(awk '/^## /{c++} c>=1 && c<2{print} c>=2{exit}' "$REPO/mirror/backend/CHANGELOG.md")"
  fi

  # opis do commita (bez surowego diffa — diff jest treścią samego commita)
  MSG="sync(vps): zmiana $CAT${BAKS:+ ($BAKS)} $TS

Zmienione pliki:
$(printf '%s\n' "$NS" | sed 's/^/  /')${BAKS:+

Etykiety zmian (z kopii .bak): $BAKS}${CH:+

Changelog Ani (najnowszy wpis):
$CH}"

  git commit -q -m "$MSG"
  git push -q origin main
  SHA="$(git rev-parse --short HEAD)"
  echo "$TS  wypchnięto zmiany $CAT ${BAKS}"

  # diff CZYTELNYCH plików kodu do maila — SAM diff (git diff, nie git show, żeby
  # nie dublować komunikatu commita); bez .bak, bez zminifikowanego index.cjs oraz
  # bez CHANGELOG.md (wpis Ani jest już wyżej w sekcji "Changelog Ani"). Przycięty.
  DIFF="$(git diff "$SHA^" "$SHA" -- mirror/backend deminified db/schema.sql \
          ':(exclude)*.bak_*' ':(exclude)mirror/backend/index.cjs' \
          ':(exclude)*/CHANGELOG.md' 2>/dev/null | head -250)"

  # powiadomienie e-mail (sendmail -t; From na domenie serwera = lepsza dostarczalność)
  {
    echo "From: Bridge dla Agrowca <admin@agritires.eu>"
    echo "To: pszuflad@gmail.com, anna.naumowicz4@gmail.com"
    echo "Subject: [Bridge] Zmiana produkcji $CAT${BAKS:+ ($BAKS)} $TS"
    echo "Content-Type: text/plain; charset=UTF-8"
    echo
    printf '%s\n' "$MSG"
    echo
    echo "----- Diff (czytelne pliki, przycięty do 250 linii) -----"
    printf '%s\n' "$DIFF"
    echo
    echo "Commit: https://github.com/pszuflad/bridge-agrowiec/commit/$SHA"
  } | sendmail -t 2>/dev/null && echo "$TS  mail wyslany" || echo "$TS  UWAGA: mail nie wyszedl"
fi
