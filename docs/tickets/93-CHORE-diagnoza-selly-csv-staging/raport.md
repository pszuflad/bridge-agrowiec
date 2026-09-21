# 93-CHORE-diagnoza-selly-csv-staging — Implementation report

## Summary
Diagnoza karty PR.4: „Brak pliku CSV” po „Wygeneruj CSV teraz” na stagingu **nie jest błędem
backendu ani panelu**. Plik powstaje i `csv-status` go widzi, ale **następny deploy stagingu go
kasuje**: `tools/deploy-staging.sh` publikuje frontend przez `rsync -a --delete` na cały
docroot, a katalog CSV (`SELLY_CSV_DIR="$DOCROOT/ex-port-files"`, ticket 34) leży wewnątrz
tego docroota. Naprawa (tylko skrypt stagingu, produkcja bez zmian): publikacja frontendu
wyłącza katalog CSV z `--delete`, z testem.

## Diagnoza

### Przyczyna
`tools/deploy-staging.sh` (przed zmianą):
```
export SELLY_CSV_DIR="$DOCROOT/ex-port-files"                               # ticket 34
...
rsync -a --delete --exclude '.htaccess' rebuild/frontend/dist/ "$DOCROOT"/  # publikacja frontendu
```
`--delete` usuwa z `$DOCROOT` wszystko, czego nie ma w `dist/`. W `dist/` nie ma
`ex-port-files/`, więc katalog z wygenerowanym plikiem znika przy każdym deployu. Deploy chodzi
z crona przy każdej nowej rewizji `develop`. W dniach przeglądu merge'y szły kilka razy dziennie.
Staging nie ma crona CSV o 6:00 (produkcja go ma), więc jedynym źródłem pliku jest przycisk,
a plik żyje tylko do najbliższego merge'a.

Błąd powstał w ticketcie 34 (2026-09-04): przeniesienie `SELLY_CSV_DIR` pod docroot stagingu
(słuszne, bo chroni plik produkcyjny i daje działający link) nie uwzględniło `rsync --delete`
kilkadziesiąt linii niżej w tym samym skrypcie.

### Dowód — odtworzenie lokalne
Backend zbudowany z tej gałęzi i uruchomiony jako proces (`node dist/server.js`). Env był
**identyczny z `deploy-staging.sh`** (`SELLY_TRYB=wylaczony`, `SELLY_CSV_DIR="$DOCROOT/ex-port-files"`,
`SELLY_CSV_PLIK=sellycsv-staging.csv`, `SELLY_CSV_URL=…`, `NODE_ENV=production`), a `$DOCROOT`
w katalogu tymczasowym miał strukturę `…/domains/agritires.eu/public_html/test`. Logowanie
kontem deweloperskim na świeżej bazie po migracjach:

| Krok | Wynik |
|---|---|
| 0. `GET /api/selly/csv-status` | `exists:false, powod:"Brak pliku CSV"` |
| 1. `POST /api/selly/generate-csv` („klik”) | 200, `Zapisano: …/public_html/test/ex-port-files/sellycsv-staging.csv` |
| 2. `GET csv-status` | **`exists:true`**, `wygenerowany_dzisiaj:true` |
| 3. krok frontendu z deployu: `rsync -a --delete --exclude .htaccess dist/ $DOCROOT/` | `ex-port-files/` usunięty |
| 4. `GET csv-status` | **`exists:false, powod:"Brak pliku CSV"`** ← objaw zgłoszony przez Anię |
| 4'. to samo z poprawką (`tools/publikuj-frontend.sh`) | `exists:true`, plik przeżywa deploy |

(W kroku 2 `status: "blad"` z powodem „Plik pusty” wynika tylko z pustej lokalnej bazy: zero
produktów, sam nagłówek. Na stagingu z danymi będzie `ok`.)

### Hipoteza startowa — obalona w części „ścieżki”
- `generate-csv` i `csv-status` biorą **tę samą** parę `sciezkiCsv` z env (`rebuild/backend/src/app.ts:201-205`).
  Generator sam tworzy katalog (`mkdirSync(..., {recursive: true})`, `src/selly/generator-csv.ts`).
  Rozjazdu ścieżki, nazwy ani zmiennej nie ma.
- `SELLY_TRYB=wylaczony` obwija tylko klienta REST (`src/selly/tryb.ts:87`). Trasy CSV są lokalne
  i blokada ich nie dotyczy, co pokazał krok 1 odtworzenia (`generate-csv` → 200).
- Frontend po sukcesie odświeża status (`rebuild/frontend/src/pages/Selly.tsx:85`,
  `invalidateQueries(KLUCZ_STATUS_CSV)`). „Brak pliku CSV” to pole `powod` odpowiedzi przy
  `exists:false` (`src/pages/selly/SekcjaCsv.tsx:108`). Z odświeżaniem wszystko w porządku.
- Pokrywa to też test bramki `rebuild/backend/test/selly.gate.test.ts:134` (generate → status na tym samym katalogu).

### Skąd zgłoszenie Ani
Ania kliknęła w dniach przeglądu 12 widoków (≈ 2026-09-17/18). Zgłoszenie jest w
`docs/pytania-do-ani-2026-09-18.md` 12.6. **Odpowiedź z datą i godziną nie została zapisana**
(pole puste; w backlogu i docs też nic). Najbardziej prawdopodobny przebieg: klik → plik powstał →
między kliknięciem a (ponownym) otwarciem panelu przeszedł deploy z merge'a do `develop` → status
znów „Brak pliku CSV”. Bez godziny kliknięcia nie da się tego przypiąć do konkretnego deployu.

### Czego diagnoza lokalna nie wyklucza — polecenia TYLKO DO ODCZYTU dla stagingu
Wariant alternatywny: `generate-csv` na stagingu padł od razu (np. brak prawa zapisu). Wtedy panel
pokazałby **dodatkowo** czerwony komunikat błędu pod przyciskiem. Do potwierdzenia na VPS (konto,
z którego chodzi deploy i pm2). Polecenia nic nie zmieniają i nie wypisują sekretów:

```bash
# 1. Czy katalog CSV stagingu istnieje (oczekiwane teraz: brak — skasowany ostatnim deployem)
ls -la ~/domains/agritires.eu/public_html/test/ex-port-files/ 2>&1

# 2. Godziny deployów w dniach przeglądu (do zestawienia z godziną kliknięcia Ani)
grep -E "deployuję|OK — wdrożono" ~/private_apps/bridge-staging/deploy.log | tail -40

# 3. Czy proces ma prawo zapisu do docroota stagingu
test -w ~/domains/agritires.eu/public_html/test && echo "zapis: OK" || echo "zapis: BRAK"

# 4. Jakie SELLY_CSV_* / SELLY_TRYB widzi DZIAŁAJĄCY proces — tylko te 4 klucze, bez sekretów
tr '\0' '\n' < /proc/"$(pm2 pid bridge-backend-staging)"/environ \
  | grep -E '^SELLY_(CSV_DIR|CSV_PLIK|CSV_URL|TRYB)='

# 5. Błędy generowania w logu procesu (np. EACCES/ENOENT)
pm2 logs bridge-backend-staging --lines 500 --nostream 2>&1 | grep -iE "csv|EACCES|ENOENT" | tail -20
```
Oczekiwane przy potwierdzonej diagnozie: (1) brak katalogu, (3) `zapis: OK`, (4) wartości jak
w `deploy-staging.sh`, (5) brak `EACCES`. Inny wynik (3) lub (5) oznacza drugą przyczynę i
wymaga powrotu do tej karty.

## Changes
- **New:** `tools/publikuj-frontend.sh` — publikacja `dist/` do docroota (`rsync -a --delete`),
  wyłącza `.htaccess` (jak dotąd) i każdy podany katalog leżący pod docrootem. Katalog poza
  docrootem pomija bez błędu.
- `tools/deploy-staging.sh` — krok frontendu woła helper z `"$SELLY_CSV_DIR"` zamiast
  inline `rsync`. Wyłączenie liczy się z faktycznej wartości zmiennej, więc działa też przy
  świadomym nadpisaniu w `$STAGING_ROOT/.env`.
- **New:** `rebuild/backend/test/publikacja-frontendu.test.ts` — 5 testów procesowych (prawdziwy
  `bash` + `rsync` na tmp; skip bez tych narzędzi).
- Kod backendu i frontendu: **bez zmian**.

## Deviations from plan
Brak. Plan pisany po diagnozie. Użytkownik polecił kontynuować bez zatrzymania („continu”),
więc naprawa weszła bez osobnego „go”. Kwalifikuje się pod warunek „Zakres” karty: przyczyna
pewna, poprawka mała, tylko skrypt stagingu, jest test.

## Test results
- **Gate odbudowy (fixtures/kontrakt):** N/D — zmiana wyłącznie w skrypcie wdrożenia stagingu;
  trasy `/api/selly/{csv-status,generate-csv}` i `GET_selly_csv-status.json` nietknięte.
- Unit/proces: `publikacja-frontendu.test.ts` 5/5 ✓ (w tym test-świadek „bez wyłączenia CSV
  znika”, czyli błąd sprzed poprawki).
- Backend: lint ✓, typecheck ✓, build ✓, `npm test` 91 plików / 1474 testy ✓.
  W pierwszym biegu padł 1 test spoza zakresu:
  `alerty-katalogu.gate.test.ts` „paczka równa limitowi 20 000 id”. Osobno 2× zielony, drugi
  pełny bieg zielony. To niestabilność pod równoległym obciążeniem, patrz Follow-up.
- `bash -n` obu skryptów ✓. `shellcheck` niedostępny na maszynie.
- Odtworzenie end-to-end przed i po poprawce: tabela wyżej.
- Frontend: bez zmian, bramki nie dotyczą.

## Breaking changes
Brak. Pierwszy deploy po merge'u nic nie odtworzy: katalog CSV został już skasowany. Po nim
trzeba raz kliknąć „Wygeneruj CSV teraz”, a od tej chwili plik przeżywa kolejne deploye.

## Follow-up
- `rebuild/backend/test/alerty-katalogu.gate.test.ts` — test „paczka równa limitowi 20 000 id”
  bywa czerwony pod pełnym równoległym `npm test` (timeout), osobno przechodzi. Właściciel: P6.2 / ticket 77.
- Odpowiedź Ani na 12.6 (data i godzina) nadal pusta. Po wdrożeniu poprawki nie jest już potrzebna
  do naprawy, najwyżej do potwierdzenia przebiegu (polecenie 2 wyżej).

## Review fixes applied
- **BLOCKER** (brak `karta.md` PR.4 i `wejscie-93.md` dla PR.6): krok dokumentacji był zaplanowany
  po review. Oba pliki dopisane (`docs/karty/PR.4/karta.md`, `docs/karty/PR.6/wejscie-93.md`).
- **SHOULD-FIX** (pusty `SELLY_CSV_DIR=` w `.env` po cichu wyłącza ochronę): dodany strażnik
  w `tools/deploy-staging.sh` obok strażnika `JWT_SECRET`. Deploy przerywa się, zanim cokolwiek zmieni.
- **NICE-TO-HAVE** (chroniony katalog zagnieżdżony głębiej niż 1 poziom → rsync wypisuje
  nieszkodliwe „cannot delete non-empty directory”): bez zmian, bo `ex-port-files` jest płytki.
  Zostaje jako follow-up.

## Docs updates
- `docs/rebuild-backlog.md` #46 — nota o skutku ubocznym naprawy z ticketu 34 (rsync `--delete`
  kasował katalog CSV stagingu) i jego naprawie w tickecie 93. Status wpisu (✅, ticket 34) bez zmian.
- `docs/deploy-setup.md` — publikację frontendu robi `tools/publikuj-frontend.sh`, który wyłącza
  `SELLY_CSV_DIR` z `--delete`. W bloku „Selly.pl i eksport CSV” dopisany opis skutku ubocznego
  i wskazówka: po pierwszym deployu z poprawką trzeba raz kliknąć „Wygeneruj CSV teraz”.
- `docs/karty/PR.4/karta.md` — stan ✅, dowiezione, do koordynatora (12.6 do zamknięcia).
- `docs/karty/PR.6/wejscie-93.md` — nowy: warunek i instrukcja ponownego sprawdzenia §11.
