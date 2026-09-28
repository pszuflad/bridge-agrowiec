# 93-CHORE-diagnoza-selly-csv-staging — diagnoza „Brak pliku CSV” po „Wygeneruj CSV teraz” na stagingu (karta PR.4)

> Status: Implemented
> Branch: `chore/93-diagnoza-selly-csv-staging`
> Worktree: `.worktrees/93-CHORE-diagnoza-selly-csv-staging`

## Ticket description
Karta PR.4 (przegląd 12 widoków, §11 Selly): Ania zgłosiła, że po „Wygeneruj CSV teraz” w panelu
Selly na stagingu nadal widać „Brak pliku CSV”. Typ: CHORE, DIAGNOZA — ustalić przyczynę, dać
rekomendację; naprawić w tej karcie tylko wtedy, gdy przyczyna jest pewna, poprawka mała,
nie zmienia zachowania produkcji i ma test.

## Context
- Backend: `generate-csv` i `csv-status` biorą tę samą parę `sciezkiCsv` z `env`
  (`rebuild/backend/src/app.ts:201-205`); generator robi `mkdirSync(..., {recursive: true})`
  (`src/selly/generator-csv.ts`, `wygenerujCsvSelly`), status sprawdza `existsSync` tej samej
  ścieżki (`statusPlikuCsv`). Brak rozjazdu ścieżek.
- `SELLY_TRYB` obwija tylko klienta REST (`src/selly/tryb.ts`) — trasy lokalne CSV go nie widzą.
- Frontend: po sukcesie mutacji unieważnia `KLUCZ_STATUS_CSV` (`rebuild/frontend/src/pages/Selly.tsx:85`);
  „Brak pliku CSV” to pole `powod` z odpowiedzi `csv-status` przy `exists: false`
  (`src/pages/selly/SekcjaCsv.tsx:108`).
- `tools/deploy-staging.sh` (ticket 34): `SELLY_CSV_DIR="$DOCROOT/ex-port-files"` — katalog
  leży **wewnątrz** docroota stagingu, bo plik ma być pobieralny pod
  `https://test.agritires.eu/ex-port-files/...`. Ten sam skrypt na końcu publikuje frontend
  `rsync -a --delete --exclude '.htaccess' rebuild/frontend/dist/ "$DOCROOT"/`. `--delete`
  usuwa z docroota wszystko, czego nie ma w `dist/` — w tym `ex-port-files/`.
- Deploy chodzi z crona przy każdej nowej rewizji `develop` (w dniach przeglądu po kilka razy dziennie).

## Diagnoza (wynik odtworzenia lokalnego)
Backend uruchomiony jako proces (`dist/server.js`) z env identycznym jak w `deploy-staging.sh`
(katalogi w tmp o tej samej strukturze), skrypt w scratchpadzie sesji:
0. `csv-status` → `exists:false, powod:"Brak pliku CSV"`;
1. `POST generate-csv` → 200, plik `…/public_html/test/ex-port-files/sellycsv-staging.csv` na dysku;
2. `csv-status` → `exists:true` (hipoteza „status patrzy w inne miejsce” — **obalona**);
3. krok frontendu z deployu (`rsync -a --delete --exclude .htaccess dist/ $DOCROOT/`) → katalog `ex-port-files/` znika;
4. `csv-status` → znowu `exists:false, powod:"Brak pliku CSV"`.

**Przyczyna:** każdy deploy stagingu kasuje wygenerowany plik. Na stagingu nie ma crona o 6:00
(produkcja go ma), więc jedynym źródłem pliku jest przycisk — i plik żyje tylko do następnego
merge'a w `develop`. Produkcji to nie dotyczy (nie ma `rsync --delete` na `panel/`).

Czego ta diagnoza NIE wyklucza bez odczytu ze stagingu: że u Ani sam `generate-csv` zwrócił
błąd (np. uprawnienia) — wtedy panel pokazałby dodatkowo komunikat błędu. Polecenia odczytu
dla użytkownika: `raport.md`.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
Brak (nie dotyka kontraktu): zmiana wyłącznie w skrypcie wdrożenia stagingu, kod backendu
i frontendu bez zmian. `GET_selly_csv-status.json` i trasy `/api/selly/{csv-status,generate-csv}`
nietknięte.

## Decisions
- D1 — naprawa w karcie (spełnia warunek „Zakres”): rozjazd w `tools/deploy-staging.sh`, produkcja
  bez zmian. Użytkownik kazał kontynuować autonomicznie („continu”).
- D2 — wykluczamy katalog CSV z `rsync --delete`, zamiast przenosić `SELLY_CSV_DIR` poza docroot:
  przeniesienie zepsułoby link „Pobierz / podgląd CSV ↗” (`SELLY_CSV_URL`), bo Apache serwuje
  tylko docroot.
- D3 — wykluczenie liczone z `SELLY_CSV_DIR` (względem `$DOCROOT`), nie literał `ex-port-files`:
  skrypt pozwala świadomie nadpisać `SELLY_CSV_*` w `$STAGING_ROOT/.env`; chronimy to, co
  faktycznie jest katalogiem CSV. Poza docrootem — nic do chronienia.
- D4 — publikacja frontendu wydzielona do `tools/publikuj-frontend.sh` (wołanego z deployu),
  żeby dało się ją przetestować jako proces, bez uruchamiania całego deployu.
- Odstępstw od oryginału: brak (produkcja nie ma tego skryptu).

## Implementation plan
1. `tools/publikuj-frontend.sh <dist> <docroot> [chroniony-katalog…]` — `mkdir -p`, `rsync -a --delete`
   z `--exclude '/.htaccess'` i `--exclude '/<rel>/'` dla każdego chronionego katalogu pod docrootem.
2. `tools/deploy-staging.sh` — zamiast inline `rsync` woła helper z `"$SELLY_CSV_DIR"`.
3. Test `rebuild/backend/test/publikacja-frontendu.test.ts` — prawdziwy `bash` + `rsync` na tmp:
   plik CSV przeżywa publikację, stare assety znikają, `.htaccess` zostaje, katalog poza
   docrootem ignorowany; skip, gdy brak `bash`/`rsync`.

## Testing strategy
Test procesowy helpera (bez mocków) + ponowne odtworzenie scenariusza lokalnie. Bramki backendu
(lint, typecheck, build, test).

## Out of scope
Zmiany w kodzie Selly, cron CSV na stagingu, `docs/przeglad-12-widokow.md` (PR.6).

## Definition of done
- [x] Przyczyna ustalona i udowodniona odtworzeniem.
- [ ] Deploy stagingu nie kasuje katalogu CSV; test zielony; bramki zielone.
- [ ] `docs/karty/PR.4/karta.md` + `docs/karty/PR.6/wejscie-93.md`.
