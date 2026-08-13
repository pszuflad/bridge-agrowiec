#!/bin/bash
# ============================================================================
#  Bridge — audyt VPS: szukanie źródeł frontendu i backendu
#  Wersja poprawiona 2026-07-24 (naprawiona ścieżka private_apps, autodetekcja)
#
#  URUCHOMIENIE — na serwerze, po zalogowaniu:
#      ssh -p 222 admin@vpshd1242.cyber-folks.pl
#      bash audyt-vps.sh
#
#  Skrypt jest TYLKO DO ODCZYTU — niczego nie zmienia, nie kasuje, nie restartuje.
#  Nie wypisuje wartości sekretów — wyłącznie nazwy zmiennych z .env.
#  Wynik: ~/bridge_audit_<data>.tar.gz do pobrania na komputer.
# ============================================================================
set -u

OUT="$HOME/bridge_audit_$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
SKIP="-not -path */node_modules/* -not -path /proc/* -not -path /sys/* -not -path /dev/*"

say() { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
ok()  { printf '  \033[1;32m%s\033[0m\n' "$*"; }
no()  { printf '  \033[1;31m%s\033[0m\n' "$*"; }

echo "=================================================="
echo " Bridge — audyt VPS   $(date '+%Y-%m-%d %H:%M:%S')"
echo " host: $(hostname)    user: $(whoami)"
echo " wyniki → $OUT"
echo "=================================================="

# --- 0. Autodetekcja katalogów -------------------------------------------
say "0. Gdzie żyje Bridge?"
BE=""
for c in /home/admin/private_apps/bridge /home/admin/private/apps/bridge \
         "$HOME/private_apps/bridge" "$HOME/private/apps/bridge"; do
  [ -f "$c/index.cjs" ] && { BE="$c"; break; }
done
if [ -z "$BE" ]; then
  hit=$(find / -xdev -name index.cjs -path '*bridge*' $SKIP -print -quit 2>/dev/null)
  [ -n "$hit" ] && BE=$(dirname "$hit")
fi
# nie ufaj katalogowi bez index.cjs (dirname "" dałoby ".")
[ -n "$BE" ] && [ ! -f "$BE/index.cjs" ] && BE=""
FE=""
for c in /home/admin/domains/agritires.eu/public_html/panel \
         "$HOME/domains/agritires.eu/public_html/panel"; do
  [ -f "$c/index.html" ] && { FE="$c"; break; }
done

[ -n "$BE" ] && ok "backend:  $BE"  || no "backend:  NIE ZNALEZIONO"
[ -n "$FE" ] && ok "frontend: $FE"  || no "frontend: NIE ZNALEZIONO"
{ echo "backend=$BE"; echo "frontend=$FE"; } > "$OUT/00_sciezki.txt"

# --- 1. Katalogi źródłowe -------------------------------------------------
say "1. Katalogi src/ client/ server/ shared/ components/"
find / -xdev -type d \( -name src -o -name client -o -name server \
     -o -name shared -o -name components \) $SKIP 2>/dev/null \
  | sort > "$OUT/01_katalogi_src.txt"
n=$(wc -l < "$OUT/01_katalogi_src.txt")
[ "$n" -gt 0 ] && ok "znaleziono $n — SPRAWDŹ PLIK" || no "brak (0)"

# --- 2. Pliki źródłowe frontendu — NAJWAŻNIEJSZE -------------------------
say "2. Pliki źródłowe frontendu (.tsx/.jsx/vite.config/tsconfig/schema.ts)"
find / -xdev -type f \( -name '*.tsx' -o -name '*.jsx' \
     -o -name 'vite.config.*' -o -name 'tsconfig*.json' \
     -o -name 'components.json' -o -name 'tailwind.config.*' \
     -o -name 'drizzle.config.*' -o -name 'schema.ts' -o -name 'storage.ts' \
     -o -name 'routes.ts' \) $SKIP 2>/dev/null \
  | sort > "$OUT/02_zrodla_frontendu.txt"
n=$(wc -l < "$OUT/02_zrodla_frontendu.txt")
if [ "$n" -gt 0 ]; then ok "★★★ ZNALEZIONO $n PLIKÓW — to jest to, czego szukamy!"
else no "brak (0) — źródeł frontendu nie ma także na VPS"; fi

# --- 3. Source mapy -------------------------------------------------------
say "3. Source mapy (*.map) i odniesienia sourceMappingURL"
find / -xdev -type f -name '*.map' $SKIP 2>/dev/null | sort > "$OUT/03_source_mapy.txt"
n=$(wc -l < "$OUT/03_source_mapy.txt")
[ "$n" -gt 0 ] && ok "★★ znaleziono $n map — pozwalają odtworzyć źródła!" || no "brak (0)"
for d in "$BE" "$FE"; do [ -n "$d" ] && grep -rl "sourceMappingURL" "$d" 2>/dev/null; done \
  > "$OUT/03b_sourcemapping_refs.txt"

# --- 4. Historia Git ------------------------------------------------------
say "4. Repozytoria Git"
find / -xdev -type d -name .git $SKIP 2>/dev/null | sort > "$OUT/04_repozytoria_git.txt"
n=$(wc -l < "$OUT/04_repozytoria_git.txt")
[ "$n" -gt 0 ] && ok "znaleziono $n" || no "brak (0)"

# --- 5. Archiwa i kopie ---------------------------------------------------
say "5. Archiwa (.zip/.tar.gz) i kopie robocze"
find /home /root /tmp /opt /srv /var/backups -xdev -type f \
     \( -name '*.zip' -o -name '*.tar.gz' -o -name '*.tgz' -o -name '*.bak' \) \
     $SKIP 2>/dev/null | head -200 | sort > "$OUT/05_archiwa.txt"
ok "$(wc -l < "$OUT/05_archiwa.txt") pozycji — przejrzyj, może któreś zawiera src/"

# --- 6. .env — TYLKO nazwy zmiennych, bez wartości ------------------------
say "6. Pliki .env (bez ujawniania wartości)"
: > "$OUT/06_env_klucze.txt"
if [ -n "$BE" ]; then
  ls -la "$BE"/.env* 2>/dev/null | tee -a "$OUT/06_env_klucze.txt"
  [ -f "$BE/.env" ] && { echo "--- nazwy zmiennych:" >> "$OUT/06_env_klucze.txt"
    grep -Eo '^[A-Za-z_][A-Za-z0-9_]*=' "$BE/.env" >> "$OUT/06_env_klucze.txt"; }
fi
ok "zapisano wyłącznie nazwy zmiennych"

# --- 7. Struktura backendu ------------------------------------------------
say "7. Struktura katalogu backendu"
if [ -n "$BE" ]; then
  ( cd "$BE" && find . -maxdepth 4 -type f -not -path '*/node_modules/*' \
      -not -name 'data.db*' -not -name '*.gz' -printf '%10s  %p\n' 2>/dev/null | sort -k2 ) \
      > "$OUT/07_drzewo_backendu.txt"
  ok "$(wc -l < "$OUT/07_drzewo_backendu.txt") plików"
  { ls -lh "$BE"/index.cjs "$BE"/data.db 2>/dev/null
    echo "--- linii w index.cjs (mało = zminifikowany):"; wc -l < "$BE/index.cjs"
    echo "--- md5:"; md5sum "$BE/index.cjs"
  } > "$OUT/07b_index_cjs.txt" 2>&1
  cat "$OUT/07b_index_cjs.txt" | sed 's/^/  /'
fi

# --- 8. Frontend na produkcji --------------------------------------------
say "8. Zawartość katalogu frontendu"
if [ -n "$FE" ]; then
  ( cd "$FE" && find . -type f -printf '%10s  %p\n' 2>/dev/null | sort -k2 ) \
    > "$OUT/08_drzewo_frontendu.txt"
  ok "$(wc -l < "$OUT/08_drzewo_frontendu.txt") plików"
  ( cd "$FE" && md5sum assets/*.js 2>/dev/null ) > "$OUT/08b_md5_bundli.txt"
fi

# --- 9. PM2 ---------------------------------------------------------------
say "9. Stan procesu PM2"
{ pm2 list; echo; pm2 show bridge-backend 2>/dev/null | head -40; } \
  > "$OUT/09_pm2.txt" 2>&1
ok "zapisano"

# --- 10. Node / npm -------------------------------------------------------
{ echo "node: $(node -v 2>&1)"; echo "npm:  $(npm -v 2>&1)"; echo "pm2:  $(pm2 -v 2>&1)"; } \
  > "$OUT/10_wersje.txt" 2>&1

# --- Pakowanie ------------------------------------------------------------
say "Pakowanie wyników"
TAR="$HOME/$(basename "$OUT").tar.gz"
tar czf "$TAR" -C "$(dirname "$OUT")" "$(basename "$OUT")" 2>/dev/null
ok "$TAR  ($(du -h "$TAR" | cut -f1))"

echo
echo "=================================================="
echo " WERDYKT"
echo "=================================================="
a=$(wc -l < "$OUT/02_zrodla_frontendu.txt"); b=$(wc -l < "$OUT/03_source_mapy.txt")
if [ "$a" -gt 0 ]; then
  echo " ★★★ ŹRÓDŁA FRONTENDU ISTNIEJĄ ($a plików) — patrz 02_zrodla_frontendu.txt"
elif [ "$b" -gt 0 ]; then
  echo " ★★ Brak źródeł, ale są source mapy ($b) — da się z nich odtworzyć kod"
else
  echo " ✗ Źródeł ani source map nie ma. Trop VPS zamknięty →"
  echo "   frontend do odbudowy z instrukcji obsługi i 17 zrzutów ekranu."
fi
echo
echo " Pobierz wynik na swój komputer (w NOWYM terminalu, lokalnie):"
echo "   scp -P 222 admin@vpshd1242.cyber-folks.pl:$TAR ~/Pobrane/"
echo "=================================================="
