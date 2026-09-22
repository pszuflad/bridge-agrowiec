# PR.1 ⭐ — Archiwum importów: trzy trasy + widok z POBIERANIEM pliku

> **Stan:** ✅ 2026-09-22 · 91-FEATURE-archiwum-importow
> **Iteracja:** przegląd 12 widoków · **Wpisy backlogu:** — · **Zależy od:** —
> **Ticket:** 91-FEATURE-archiwum-importow

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Jedyny w całym projekcie **czysty brak funkcji obecnej w produkcji** (`archive-injection.js`
+ `archive_module.cjs`, trzy trasy). Zakres doprecyzowany odpowiedzią Ani 12.1: używa archiwum do
porównywania, czy plik zgadza się z katalogiem, i do weryfikacji brakujących pozycji — więc widok
MUSI pozwalać pobrać plik, nie tylko pokazać listę.

## Pliki (wyłączna własność)
- BE: `rebuild/backend/src/routes/import-archive.ts` (nowy), `src/import/archiwum.ts` (dopisane
  funkcje odczytu obok istniejącego zapisu), `test/archiwum-importow.gate.test.ts` (nowy).
- FE: `rebuild/frontend/src/pages/ArchiwumImportow.tsx`, `pages/archiwum-importow/` (nowe),
  `App.tsx` (trasa `/archiwum`), `components/nawigacja.ts` (12. pozycja menu),
  `test/archiwum-importow.test.tsx` (nowy), `test/msw/kontrakt.ts`, `test/shell.test.tsx`.
- Kontrakt: `contract/openapi.yaml` (3 nowe ścieżki), `contract/fixtures/GET_import-archive*.json`
  (9 nagrań), `tools/record-write-fixtures.cjs` (scenariusz `odegrajArchiwum()`).

## Decyzje
**Świadomy wyjątek od kolejności** (5 → 6 → 7 → 9 → 10 → przegląd): warto puścić wcześniej, bo
rozłączna ze wszystkim innym.

Zatwierdzone przez użytkownika 2026-09-22 („go”), skrót (pełna treść: `plan.md`):
- **D1** — trasa `/archiwum`, pozycja „Archiwum importów" w menu zaraz po „Historia", ikona
  `Archive` (lucide).
- **D2** — backend 1:1 z filtrem `status` (prompt pierwotnie go nie wymieniał, oryginał ma),
  te same kody/komunikaty, `res.sendFile` + `Content-Disposition` z nazwą pliku w archiwum.
- **D3** — path traversal: **oryginał się broni** (regex dwóch segmentów + zakaz `..`), brak
  odstępstwa, odtworzone 1:1 + testy.
- **D4** — pobieranie w FE: `fetch` + Bearer → blob → `a.download = oryginalnaNazwa` (1:1, NIE
  nawigacja cookie'em — dałaby nazwę archiwalną z `Content-Disposition`).
- **D5** — błąd pobrania: toast zamiast `alert()` (styl odbudowy, treść komunikatu jak w
  oryginale).
- **D6** — opcje selectów liczone z przefiltrowanej listy (1:1, dziwactwo oryginału).
- **D7** — bez paginacji (oryginał jej nie ma).
- **D8** — HTML-escape z automatu Reacta zamiast `innerHTML` oryginału (tylko brak XSS, nie
  zmiana funkcjonalna).

## Dowiezione
Odbudowany ekran „Archiwum importów" — port 1:1 z `mirror/backend/archive_module.cjs` +
`mirror/frontend/assets/archive-injection.js`:
- **Backend:** `GET /api/import-archive` (filtry dostawca/miesiąc/status), `GET
  /api/import-archive/stats`, `GET /api/import-archive/file/{month}/{name}`. Retencja 7 dni
  zgodna z produkcją (rozjazdu nie ma — zapis z 3b był już wierny). Path traversal: brak
  odstępstwa, oryginał się broni (regex + zakaz `..`), dowiedzione testami surowego HTTP
  (`..`, `%2F`, `%2E%2E`, backslash, zły miesiąc, `a..csv` → 400).
- **Frontend:** widok `/archiwum`, pozycja w menu zaraz za „Historią" (sidebar teraz 12
  pozycji), filtry, pasek zajętości, tabela 8 kolumn, pobieranie pod ORYGINALNĄ nazwą pliku
  (nie nazwą z `Content-Disposition`).
- **Nagrania:** 9 fixtures z ORYGINAŁU uruchomionego lokalnie — archiwum piaskownicy zapełnione
  kodem oryginału (`POST /api/import/parse-file` na próbkach MO1/MO6/MO7), nie ręcznie pisanymi
  `.meta.json`; porównanie GATE obejmuje wartości, nie tylko kształt.
- **GATE:** `archiwum-importow.gate.test.ts`, 22/22 zielone. Bramki BE i FE (lint/typecheck/
  build/test, Node 20) zielone: BE 1491/1491, FE 904/904 + integracja 39/39.
- **Odstępstwa prezentacyjne** (nie funkcjonalne — `raport.md` „Deviations from plan"):
  wybrana wartość filtra zostaje na liście opcji, nawet gdy zniknęła z danych (oryginał wtedy
  pokazywał „Wszyscy dostawcy"); błąd listy nie „przykleja się" po udanym odświeżeniu (React
  Query czyści go, oryginał trzymał do przeładowania strony); generator schematów nazwał
  współdzielony schemat `{error}` `GETImportArchiveOdpowiedz401` zamiast `GETMeOdpowiedz401`
  (kosmetyka nazwy, bez skutku funkcjonalnego).
- Ticket: `91-FEATURE-archiwum-importow`, 2026-09-22.

## Do koordynatora
- **Cutover:** na produkcji `IMPORT_ARCHIVE_DIR` musi wskazywać
  `/home/admin/private_apps/bridge/import_archive`, żeby widok pokazał pliki sprzed
  przełączenia. `docs/cutover.md:207` podaje w kolumnie „Domyślna" „obok `dist/`", a kod ma
  `<cwd>/import_archive` (`rebuild/backend/src/import/archiwum.ts:40`) — rozjazd do poprawienia
  w `docs/cutover.md` przez koordynatora (ta karta go nie zmienia). Dodatkowo: pliki starsze niż
  7 dni (po `mtime`) i tak usunie pierwszy zapis po przełączeniu (rotacja), a proces musi mieć
  prawo zapisu do tego katalogu.
- Sidebar ma teraz **12 pozycji** (było 11 przed tym tickietem).
- Generator schematów przemianował współdzielony schemat `{error}` z `GETMeOdpowiedz401` na
  `GETImportArchiveOdpowiedz401` (bierze nazwę z pierwszego alfabetycznie nagrania) — kosmetyka
  nazwy w `contract/openapi.yaml`, follow-up bez pilności.
