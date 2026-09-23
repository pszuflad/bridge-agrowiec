# 153-DOCS — CSV dla Selly gubi flagi `'Tak'` (rozpoznanie)

Data: 2026-09-24. Znalezione przy porównaniu eksportu CSV na stagingu, przed testami Ani.

## Jak to wyszło

Porównanie plików CSV wygenerowanych z **tej samej bazy** (kopia produkcji z 23.09 na stagingu)
przez generator produkcji i przez nowy stos. Pomiar, przyczyna i liczby: `docs/rebuild-backlog/wpis-153.md`.
Poprawka: karta `docs/karty/FIX.1/karta.md`.

**Wynik:** 5396 = 5396 produktów, nagłówek 60 kolumn identyczny, **899 wierszy różnych** — wyłącznie
w pięciu flagach (`Snieg-3PMSF` 750, `Bloto+snieg` 713, `CFO` 52, `NRO` 12, `CHO` 10).

## Dwie pomyłki po drodze — warte zapamiętania

1. **Pierwsze podejście wzięło generator z `develop`** i pokazało różnicę „59 kolumn kontra 60".
   To był artefakt: w `develop` katalog `mirror/` jest świadomie cofnięty do stanu z 25.08
   (commit `6594525`, bramki wierności). Żywy skrypt produkcji jest na `origin/main` i ma
   60 kolumn razem z `Blokowane-formy-platnosci` oraz mapowanie nazw kategorii na sklepowe.
2. **Sam `diff` nie wystarcza.** „899 linii różnych" nie mówi nic; dopiero rozkład na kolumny
   (ile wierszy różni się w której kolumnie) pokazał, że chodzi o pięć flag, a nie o rozjazd danych.

## Procedura porównania (odtwarzalna)

```bash
STG=~/private_apps/bridge-staging
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
mkdir -p ~/cmp/prod && ln -sfn "$STG/current/node_modules" ~/cmp/prod/node_modules

# 1. generator produkcji z origin/main, z podmienionymi TRZEMA stałymi (oryginał pisze do produkcji!)
cd "$STG/repo" && git fetch -q origin main
git show origin/main:mirror/backend/payment_blocks.cjs > ~/cmp/prod/payment_blocks.cjs
git show origin/main:mirror/backend/generate_selly_export.cjs \
  | sed -e "s|^const DB_PATH = .*|const DB_PATH = '$STG/data/data-nowy.db';|" \
        -e "s|^const OUT_DIR = .*|const OUT_DIR = '$HOME/cmp';|" \
        -e "s|^const OUT_FILE = .*|const OUT_FILE = 'stary.csv';|" > ~/cmp/prod/generator.cjs
grep -nE "^const (DB_PATH|OUT_DIR|OUT_FILE)" ~/cmp/prod/generator.cjs   # KONTROLA przed uruchomieniem
node ~/cmp/prod/generator.cjs

# 2. nowy generator, ta sama baza, od razu po tamtym (scheduler importu na stagingu chodzi)
cd "$STG/current" && DB_PATH="$STG/data/data-nowy.db" \
  SELLY_CSV_DIR="$HOME/cmp" SELLY_CSV_PLIK=nowy.csv SELLY_CSV_URL=http://localhost/nieuzywany \
  node dist/selly/csv-cli.js

# 3. rozkład różnic NA KOLUMNY (samo `diff` nie wystarcza)
cd ~/cmp
head -1 stary.csv | tr ';' '\n' | tr -d '\r' | sed '1s/^\xef\xbb\xbf//' > nag.txt
awk -F';' 'NR==FNR{for(i=1;i<=NF;i++)A[FNR"|"i]=$i;next}
           {for(i=1;i<=NF;i++) if(A[FNR"|"i]!=$i) c[i]++}
           END{for(i in c) printf "%d %d\n", i, c[i]}' stary.csv nowy.csv | sort -k2 -rn > kol.txt
while read -r i n; do printf "%-30s %5d wierszy\n" "$(sed -n "${i}p" nag.txt)" "$n"; done < kol.txt
```

Pliki w `~/cmp` zawierają kolumnę `Cena-zakupu` — zostają poza `public_html`, po pomiarze `rm -rf ~/cmp`.

## Co dalej

`FIX.1` naprawia generator (czytanie surowych wartości, model Drizzle bez zmian — oryginał ma te
kolumny w trybie boolean i jego API też zwraca `false` na `'Tak'`). Po poprawce ten sam pomiar
musi dać pusty `diff`; dopóki nie daje, instrukcja TEST.2 nie może twierdzić, że pliki są identyczne.
