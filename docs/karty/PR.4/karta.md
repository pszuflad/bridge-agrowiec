# PR.4 — diagnoza Selly „Wygeneruj CSV” na stagingu

> **Stan:** ✅ 2026-09-22 · 93-CHORE-diagnoza-selly-csv-staging
> **Iteracja:** przegląd 12 widoków · **Wpisy backlogu:** #46 (skutek uboczny) · **Zależy od:** —
> **Ticket:** `93-CHORE-diagnoza-selly-csv-staging` (szczegóły, dowody, polecenia odczytu: `docs/tickets/93-CHORE-diagnoza-selly-csv-staging/raport.md`)

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Diagnoza przycisku „Wygeneruj CSV teraz” w panelu Selly na stagingu — punkt z przeglądu
12 widoków (`docs/przeglad-12-widokow.md` §11); zgłoszenie Ani: po kliknięciu nadal „Brak pliku CSV”.
⚠ `POST /api/selly/sync-supplier` z `dry_run=false` realnie modyfikuje sklep — patrz `CLAUDE.md`, „Środowisko”.

## Pliki (wyłączna własność)
`tools/deploy-staging.sh` (krok publikacji frontendu + strażnik), `tools/publikuj-frontend.sh` (nowy),
`rebuild/backend/test/publikacja-frontendu.test.ts` (nowy).

## Decyzje
- Naprawa w karcie: przyczyna pewna, zmiana tylko w skrypcie stagingu (produkcja bez zmian), z testem.
- Katalog CSV zostaje pod docrootem (link „Pobierz / podgląd CSV ↗” musi działać) — wyłączamy go
  z `rsync --delete`, zamiast przenosić poza docroot.
- Wyłączenie liczone z faktycznej wartości `SELLY_CSV_DIR`, nie z literału `ex-port-files`.

## Dowiezione
- **Przyczyna:** błąd NIE jest w backendzie ani w panelu. `generate-csv` i `csv-status` używają tej
  samej ścieżki, a panel po sukcesie odświeża status. Plik kasował **następny deploy stagingu**:
  `rsync -a --delete … "$DOCROOT"/` z `tools/deploy-staging.sh`, a `SELLY_CSV_DIR="$DOCROOT/ex-port-files"`
  (ticket 34) leży pod tym docrootem. Staging nie ma crona CSV o 6:00, więc plik żył tylko do
  najbliższego merge'a w `develop`.
- **Dowód:** odtworzenie lokalne (proces `dist/server.js` z env 1:1 z deployu, katalogi w tmp):
  klik → `exists:true`; krok rsync z deployu → `exists:false, "Brak pliku CSV"`; z poprawką plik przeżywa.
- **Hipoteza startowa „status patrzy w inną ścieżkę / SELLY_TRYB blokuje”:** obalona.
- **Naprawa:** `tools/publikuj-frontend.sh` (rsync z wyłączeniem `.htaccess` jak dotąd + katalogu
  CSV); deploy przerywa się przy pustym `SELLY_CSV_DIR`. 5 testów procesowych, bramki backendu zielone.
- **Nie potwierdzone na stagingu:** diagnoza jest lokalna. Wariant „generowanie padło od razu
  (uprawnienia)” wykluczają dopiero polecenia odczytu z `raport.md` (sekcja „Czego diagnoza lokalna
  nie wyklucza”). Odpowiedź Ani na 12.6 (data/godzina) nadal pusta.
- Po pierwszym deployu z poprawką katalog jest już pusty, więc trzeba raz kliknąć „Wygeneruj CSV teraz”.
- Wejście dla PR.6: `docs/karty/PR.6/wejscie-93.md`.

## Do koordynatora
- Pytanie 12.6 w `docs/pytania-do-ani-2026-09-18.md` jest nieaktualne: przyczynę ustalono bez
  godziny kliknięcia. Przy kolejnej rundzie pytań można je zamknąć.
