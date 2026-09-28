# P10.3 — eksport CSV respektuje filtry

> **Stan:** ✅ 2026-09-22 · 98-FEATURE-eksport-csv-z-tabeli
> **Iteracja:** 10 — Analityka i Pulpit · **Wpisy backlogu:** #91 · **Zależy od:** P10.1 (✅ 2026-09-22)
> **Ticket:** `98-FEATURE-eksport-csv-z-tabeli`

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Eksport CSV respektuje to, co widać w tabeli — „zapisz to, co widzę” (#91). Zakres rozstrzygnięty
2026-09-21 (`wejscie-87.md`, backlog #91 boks „⭐ ZAKRES”): plik CSV powstaje w PRZEGLĄDARCE z wierszy
tabeli po filtrach, Marża w przekroju tabeli, wszystkie wiersze (bez limitu 300).

## Pliki (wyłączna własność)
Frontend analityki — **podział z PR.2 (fala B, obie równolegle)**:
- `rebuild/frontend/src/pages/analityka/eksport.tsx`, NOWY generator CSV (np. `csv.ts`),
  sekcje z przyciskiem CSV (`Sekcja*.tsx`), `TabelaAnalityki.tsx` (tylko jeśli potrzebny dostęp do kolumn),
  testy eksportu/sekcji.
- **NIE rusza:** `NaglowekKpi.tsx`, `Analityka.tsx`, `api.ts` (własność PR.2), backendu i `contract/`
  (trasa `export/:view` zostaje, jak zostawiła ją P10.1).

## Decyzje
✅ 2026-09-21, użytkownik, zgodnie z rekomendacją — trzy decyzje zakresu w `wejscie-87.md` i
backlogu #91 (plik z przeglądarki, Marża w przekroju tabeli, bez limitu 300).

✅ 2026-09-22, użytkownik, format pliku (wszystkie zgodnie z rekomendacją):
- nagłówek = etykiety kolumn tabeli (`Śr. marża`), nie klucze pól, w kolejności tabeli;
- liczby dziesiętne z przecinkiem, bez separatora tysięcy (`12,5`) — odstępstwo od formatu
  serwera (kropka), żeby polski Excel czytał je jako liczby;
- do komórki idzie surowa wartość pola `key` (Dostępność: `87,5`, bez `%`), nie tekst z ekranu;
  brak wartości (`null`/`undefined`/`""`) → pusta komórka, nie „—”; reguła dotyczy też kolumn z `render`;
- EAN-y i kody zostają zwykłym tekstem, jak na serwerze.

## Dowiezione
Zrobione ticketem `98-FEATURE-eksport-csv-z-tabeli`, zgodnie z planem, bez odstępstw (jedno
doprecyzowanie w trakcie: `NaN`/±∞ też dają pustą komórkę).

- **NOWY** `rebuild/frontend/src/pages/analityka/csv.ts` — generator: `wartoscKomorkiCsv`
  (reguła wartości + przecinek dziesiętny), `escapujKomorkeCsv` (reguła serwera `/[;"\n\r]/`),
  `zbudujCsvTabeli(wiersze, kolumny)` (nagłówek z `label`, `;`, `\n`, bez BOM — BOM dokłada
  `pobierzPlik()`).
- `eksport.tsx` — `PrzyciskCsv<T>({ widok, wiersze, kolumny, wczytywanie })` buduje plik w
  przeglądarce z wierszy/kolumn karty i zapisuje go istniejącym `pobierzPlik()` z
  `pages/katalog/eksport.ts`; usunięte `adresEksportu()`, `BAZA_API`, nawigacja
  `window.location.href` — żaden przycisk już nie woła `GET /api/analytics/export/{view}`.
- Wszystkie 10 kart z przyciskiem (Stabilność, Cykl życia dostawców, Stan dostawców,
  EAN-porównanie, EAN-unikalne, Ceny 3.1, Dostępność produktów, Tempo schodzenia, Marża, Rotacja)
  podają przyciskowi TĘ SAMĄ tablicę wierszy i te same kolumny co `TabelaAnalityki` — plik = to,
  co widać po filtrach globalnych i lokalnych (np. „Bez ruchu dni” w Rotacji), bez limitu 300
  (limit dotyczy tylko rysowania tabeli). Marża: plik ma przekrój tabeli (grupy), nie listę per
  produkt z serwera.
- Pusta tabela po filtrach → plik z samym nagłówkiem, przycisk aktywny; przycisk nieaktywny
  tylko podczas wczytywania karty.
- Backend, `contract/`, trasa `GET /api/analytics/export/{view}` — bez zmian (potwierdzone,
  patrz „Do koordynatora”); trasa nie ma już konsumenta we froncie.
- Format pliku poza wartością komórki: BOM, `;`, `\n`, cudzysłowy wg reguły serwera, nazwa
  `<view>.csv` — bez zmian względem serwera.
- Testy: jednostkowe generatora `analityka.csv.test.tsx` (14/14), integracyjne na `<App/>`
  `analityka.eksport.test.tsx` (13/13, w tym zero wywołań `export/*`, filtr globalny, Rotacja
  vs. „Bez ruchu dni”, 350 wierszy → tabela 300/plik 350, Marża zgrupowana). Bramki FE: lint,
  typecheck, build, test (53 pliki / 922 testy) zielone. Backend bez zmian w kodzie; `npm test`
  zielone (92 pliki / 1511 testów) jako potwierdzenie.
- Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API (`git diff origin/develop --
  rebuild/backend contract` pusty).

## Do koordynatora
- **Fakt, potwierdza `wejscie-87.md`:** roadmapa (historycznie) łączyła P10.3 z plikiem tras
  `routes/analytics.ts` — nieaktualne. P10.3 nie ruszyła backendu ani `contract/` (diff wobec
  `origin/develop` dla tych ścieżek pusty); jedyny wspólny plik z P10.1 to dane, nie kod.
- **Decyzja do podjęcia (nie ta karta):** `GET /api/analytics/export/{view}` nie ma już żadnego
  konsumenta we froncie (trasa zostaje „martwa” dla UI, działa dalej pod API). Zostawić jako
  publiczne API czy kiedyś wygasić — decyzja koordynatora/użytkownika.
- **Nieaktualne zdanie w roadmapie:** `docs/rebuild-roadmap.md:3402`, wiersz tabeli „Po stronie
  użytkownika — decyzje, które zostały” — `| **#91** — zakres „zapisz to, co widzę" | P10.3 |
  do rozstrzygnięcia |`. Zakres #91 rozstrzygnęła decyzja użytkownika już 2026-09-21 (ticket 87,
  `wejscie-87.md`), a ten ticket (98) go dowiózł — wiersz nie odzwierciedla żadnego z tych dwóch
  faktów.
