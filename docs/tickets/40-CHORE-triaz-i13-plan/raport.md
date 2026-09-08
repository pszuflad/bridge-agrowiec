# 40-CHORE-triaz-i13-plan — raport

**Data:** 2026-09-08 · **Branch:** `chore/40-triaz-i13-plan` · **Typ:** chore (planowanie, bez kodu produkcyjnego)

## Cel

Producent (`tools/vps-sync.sh`) milczał 25.08–08.09; zaległości Ani wciągnięto ręcznie w `6872aea`.
Ten ticket: (1) naprawia producenta, (2) triażuje zakres `08be0f3..6872aea` i (3) rozpisuje go jako
Iterację 13 w roadmapie + wpisy backlogu.

## Co zrobiono

### 1. Producent — fix (na `main`, `d88ac15`)
- Przyczyna ciszy: `BAKS="$(… grep -oE '\.bak_pre_' …)"` przestał trafiać po zmianie nazewnictwa
  kopii `.bak` Ani → grep zwracał 1 → pod `set -euo pipefail` skrypt ubijał się **przed** `git push`.
- Fix: wzorzec `.bak` rozszerzony na wszystkie formy (`\.bak[._-]…` + stripowanie dat 8-cyfrowych i
  ISO), cały pipeline `BAKS` zamknięty `|| true`. Druga mina: `git diff | head -250` (SIGPIPE 141
  pod pipefail) osłonięta `|| true`; wykluczenie `*.bak*` zamiast `*.bak_*`.
- Zweryfikowano ekstraktor na realnych nazwach z `6872aea` (23 pliki `.bak`): stary = pusto+exit 1
  (potwierdzony abort), nowy = czyste etykiety, puste wejście = exit 0.
- **DO ZROBIENIA RĘCZNIE:** potwierdzić cron w panelu DirectAdmin + pierwszy przebieg po fixie.

### 2. Triaż `08be0f3..6872aea`
Źródło prawdy: `mirror/backend/CHANGELOG.md` (25.08–08.09), `db/schema.sql`, parsery, `selly/*`.
64 pliki. Grupy A–E — patrz roadmapa blok I13.

### 3. Zapis
- **Roadmapa:** blok „Iteracja 13" (§5) z sesjami 13a–13e; wiersz 13 w tablicy §4; noty w §4 i §6.
- **Backlog:** nowe #53–#62; domknięcia #8/#9/#10 (nasze findingi „audytu Claude'a", na które Ania
  zareagowała — CHANGELOG „Bug #1/#2/#4"). #3 (szerokość) już zamknięte — backfill jego danych → 13e.
- **Marker triażu:** `d88ac15`.

## Kluczowe ustalenia dla wykonawców I13
- **13a↔13b kolejność:** katunify (#57) spowodowało regresję WULSTBAND (#10/Bug#1) — port razem albo
  13b przed 13a.
- **13c blokada:** Tor 2 Selly (`sync_full`) niedomknięty u Ani 08.09 — czekać, nie portować ruchomego celu.
- **Cieniowanie (CLAUDE.md §5):** P3 (#56) rusza `tk()`, CAPS (#59) rusza `Xq()` — oba w `index.cjs`.
- **13e to decyzja, nie kod:** reguły tl_tt B/C to logika klasyfikacji — jeśli mają działać na przyszłych
  importach, idą do parsera, nie jako jednorazowy UPDATE.

## Bramki
Nie dotyczy (chore dokumentacyjny; zero zmian w `rebuild/`). Zmiana `tools/vps-sync.sh` poszła osobno
na `main` (poza bramkami CI develop — to narzędzie VPS, nie deployowane przez CD).

## Aktualizacja 2026-09-08 — podział I13 zrewidowany + rewert mirror na develop

- **Merge main→develop** (`00097f8`) wciągnął `mirror/` do 08.09 → 12 bramek wierności czerwonych
  (byte-for-byte + charakteryzacja + acceptStaging). To poprawny sygnał (dług portu), nie błąd.
  Decyzja użytkownika: **cofnąć `mirror/` na develop do 25.08** (`6594525`), stan 08.09 zostaje na main
  jako źródło prawdy; każdy ticket I13 dociąga swój wycinek. CI develop znów zielone (potwierdzone).
- **Podział I13 przeprojektowany** z „grupa A–E" na oś **MECHANIZMU PORTU** (decyzja użytkownika):
  parsery-kopia (13a) / silnik-TS (13b) / migracje+fixtures (13c) / Selly (13d) / FE (13e) / decyzja (13f).
  Powód: `src/import/legacy/**` to kopia bajtowa `mirror/backend/**`, więc zmian w jednym pliku `.cjs`
  (np. b4 vs katunify w `tyre_params.cjs`) NIE DA SIĘ rozdzielić — kopia jest atomowa. Stary podział
  bug/unifikacje kolidował plikowo.
- **Inwentaryzacja CHANGELOG** (17 wpisów) wyłapała 2 zmiany spoza pierwotnego planu: **p2_4** (#63,
  parseSize L-series) i **odswinch** (#64, `tyre_params.cjs`, NIEZALOGOWANA w CHANGELOG — do rozłożenia
  diffem). Oba wchodzą w 13a razem z kopią `tyre_params.cjs`.
- **Prompty startowe** do wszystkich kart: `prompty-13a-13f.md` (w tym tickecie).
