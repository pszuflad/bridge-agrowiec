#!/usr/bin/env bash
# Zestawienie wpisów backlogu: historia z docs/rebuild-backlog.md + pliki docs/rebuild-backlog/wpis-*.md
# (reguła „jeden plik na ticket" — zob. docs/rebuild-backlog/README.md).
# Użycie: tools/stan-backlogu.sh            — wszystko
#         tools/stan-backlogu.sh 112        — tylko wpisy ticketu 112 (ID #112.1, #112.2…)
#         tools/stan-backlogu.sh --do-decyzji  — tylko te z ⬜ (czekają na decyzję użytkownika)
set -euo pipefail
cd "$(dirname "$0")/.."
shopt -s nullglob

filtr="${1:-}"
pliki=(docs/rebuild-backlog.md docs/rebuild-backlog/wpis-*.md)

awk -v filtr="$filtr" '
function wypisz() {
  if (id == "") return
  if (filtr == "--do-decyzji" && decyzja != "⬜") { return }
  if (filtr != "" && filtr != "--do-decyzji" && index(id, filtr) != 1) { return }
  printf "| #%s | %s | %s | %s | %s | %s |\n", id, data, (decyzja==""?"?":decyzja), (status==""?"?":status), etykieta, plik
}
# Kolejność szukania ma znaczenie: komórka „Status" często zawiera też ✅ z cytatu decyzji.
function symbol(wiersz, zestaw,   z, i, n) {
  n = split(zestaw, z, " ")
  for (i = 1; i <= n; i++) if (index(wiersz, z[i]) > 0) return z[i]
  return ""
}
/^### #/ {
  wypisz()
  linia = $0; sub(/^### #/, "", linia)
  n = split(linia, a, " · ")
  id = a[1]; data = (n >= 2 ? a[2] : "?")
  etykieta = (n >= 4 ? a[4] : (n >= 3 ? a[3] : "?"))
  gsub(/\|/, "/", etykieta)
  decyzja = ""; status = ""; plik = FILENAME
  next
}
/^\| \*\*Do nowej wersji\?\*\*/ { if (decyzja == "") decyzja = symbol($0, "⬜ ✅ ❌ 🕒"); next }
/^\| \*\*Status\*\*/            { if (status  == "") status  = symbol($0, "✔ 🔨 ⬜ ❌ 🕒 ✅ —"); next }
END { wypisz() }
' "${pliki[@]}" | { printf '| Wpis | Data | Do nowej wersji? | Status | Etykieta | Plik |\n|---|---|---|---|---|---|\n'; cat; }
