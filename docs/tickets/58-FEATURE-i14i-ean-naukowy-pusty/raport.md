# 58-FEATURE-i14i-ean-naukowy-pusty — raport z wdrożenia

## Summary

EAN rozpoznany jako zapis naukowy (`scientific_notation_uncertain`) trafia od teraz do
`products.ean` jako **NULL** zamiast rozwiniętej wartości — świadome odstępstwo od produkcji
wg decyzji Ani z 2026-09-18 (backlog #11). Cięcie jest w `akceptacja.ts`, nie w `silnik/ean.ts`,
więc silnik importu, staging i ostrzeżenie pozostają bez zmian. Zero ruszonych scenariuszy
charakteryzacji, zero ruszonych fixtures, kontrakt nietknięty.

## Changes

- `rebuild/backend/src/import/akceptacja.ts` — po zbudowaniu rekordu produktu, przed
  wartościami domyślnymi: `if (rekord.eanSourceStatus === "scientific_notation_uncertain")
  rekord.ean = null`. Komentarz opisuje odstępstwo (decyzja, data, backlog #11) oraz
  **dlaczego cięcie jest tutaj, a nie przy normalizacji**.
- **Nowy:** `rebuild/backend/test/akceptacja.odstepstwa.test.ts` — 7 przypadków, porównanie
  z uruchomionym oryginałem.
- `docs/tickets/58-FEATURE-i14i-ean-naukowy-pusty/plan.md`, `raport.md` — dokumentacja ticketa.

**Czego NIE zmieniono (zweryfikowane `git status --porcelain`, wynik pusty):**
`contract/**`, `rebuild/backend/src/import/silnik/**`, `rebuild/backend/src/import/tk.ts`,
`rebuild/backend/test/charakteryzacja/**`, `rebuild/frontend/**`.

## Zadanie 1 — gdzie przeciąć: pomiar i uzasadnienie

Zmierzony koszt obu wariantów (nie oszacowany — policzony grepem i lekturą harnessów):

| | (A) `silnik/ean.ts` | (B) `akceptacja.ts` |
|---|---|---|
| scenariusze charakteryzacji silnika | **1** — `ean-notacja-naukowa` | **0** |
| scenariusze charakteryzacji akceptacji | 0 | **0** (z 38) |
| testy | **1** — `silnik.gate.test.ts`, „dopasowanie po EAN ZNORMALIZOWANYM" (3 asercje) | **0** |
| pliki `contract/fixtures/` | 0 | **0** |

**Wybrano (B).** Trzy powody, w kolejności wagi:

1. **(A) wykracza poza decyzję Ani i psuje dopasowanie.** `tk.ts:302-305` dopasowuje pozycję
   do produktu w katalogu **po `znormalizowana.ean`**. Wyzerowanie EAN-u w `ean.ts` zerwałoby
   to dopasowanie: pozycja z EAN-em w notacji naukowej zostałaby sklasyfikowana jako „nowa"
   zamiast „zmiana_kluczowa", dostała inny `kod` i mogła założyć **duplikat w katalogu**.
   Istniejący test `silnik.gate.test.ts` pokazuje ten mechanizm wprost (produkt
   `MO1_INNY-KOD-2` stoi w katalogu pod `8059970000000`, a cennik podaje `8,05997E+12`).
   EAN jest też kluczem grupowania `kodImportu`. Ania rozstrzygnęła o **zawartości pola
   w katalogu**, nie o regułach dopasowania importu.
2. **Polecenie roadmapy „wzorce trzeba przenagrać" było przy (A) niewykonalne.**
   `test/charakteryzacja/silnik/scenariusze.expected.json` jest **zamrożony** i nagrywany
   skryptem `scripts/charakteryzacja-silnik-nagraj.mjs`, który uruchamia **żywy oryginał**
   z `mirror/backend/index.cjs`. Przenagranie odtworzyłoby STARĄ wartość `"6419440000000"` —
   oryginał nie zna decyzji Ani. Odstępstwo wymagałoby zbudowania od zera mechanizmu jawnego
   wyjątku, którego w repo nie ma. Roadmapa poprawiona (D5 w planie).
3. **(B) jest dosłownie tańszy** — zero ruszonych scenariuszy, testów i fixtures.

**Weryfikacja kompletności (B)** — graf wywołań wszystkich dróg zapisu do `products.ean`:
`akceptacja.ts:109` (jedyna droga z importu), `tk.ts:207-209` auto-zatwierdzanie (**nie tyka
`ean` w ogóle** — patchuje tylko ceny/stan/magazyn), `bulk.ts:71-87` i `repos/products.ts:93-117`
(biorą `ean` wprost z ciała żądania, **nigdy nie wołają `normalizujEan()`**), Selly (tylko
`select()`). Cięcie w `akceptacja.ts` łapie **100% dróg importu**.

## Zadanie 2 — jak opisano odstępstwo

- **W kodzie:** blok komentarza przy warunku w `akceptacja.ts` — treść decyzji, autorka, data
  (2026-09-18), odsyłacz do backlogu #11, numer linii oryginału (`:44872`) oraz wyjaśnienie,
  dlaczego cięcie nie jest przy normalizacji.
- **W teście:** nagłówek `akceptacja.odstepstwa.test.ts` tłumaczy, dlaczego odstępstwo mieszka
  w osobnym pliku, a nie jako scenariusz charakteryzacji.
- **Czego NIE zrobiono:** nie wyłączono żadnego scenariusza, nie rozluźniono porównania
  w `akceptacja.charakteryzacja.test.ts` (38/38 dalej żąda pełnej równości z oryginałem),
  nie poprawiono po cichu żadnego wzorca. Komunikat „zapis naukowy ma tylko null cyfr
  znaczących" (cieniowanie `Lq`, backlog #11) **pozostaje niezmieniony**, zgodnie z kartą.

## Deviations from plan

Brak — wdrożono 1:1 wg planu.

## Test results

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Ticket nie zmienia kształtu ani wartości
  żadnej odpowiedzi API; `contract/` nietknięty (`git status --porcelain contract/` pusty).
  Zielone bramki dowodzące: `kontrakt.spojnosc.test.ts` (schematy aktualne wobec fixtures —
  uruchamia generator z `--sprawdz`) oraz `katalog.gate.test.ts` (`GET /api/products` 1:1
  z `contract/fixtures/GET_products.json`, a także `GET_products_bez-parametrow.json`,
  `GET_products_hold-reasons.json`, `GET_products_uwagi-cena.json`).
  Zmierzone przed zmianą: te cztery fixtures mają odpowiednio 5/5/5/1 wystąpień `ean`, **zero
  `null` i zero wartości w notacji naukowej**, więc zmiana nie mogła przestawić żadnej wartości.
  W całym `contract/fixtures/`: **0 plików** ze statusem `scientific_notation_uncertain`.
- **Charakteryzacja akceptacji (najmocniejszy dowód wąskości): ✓ 38/38**,
  `akceptacja.charakteryzacja.test.ts` — porównanie końcowego stanu bazy naszego portu
  z **uruchomionym oryginałem**, bez dodanego wyjątku i bez rozluźnienia porównania.
- **Charakteryzacja silnika: ✓ nietknięta i zielona** (`silnik.charakteryzacja.test.ts`,
  `silnik.gate.test.ts` — w tym test „dopasowanie po EAN ZNORMALIZOWANYM").
- **Unit/integracja (nowe): ✓ 7/7** — `akceptacja.odstepstwa.test.ts`. Bez mocków, na
  prawdziwym SQLite w katalogu tymczasowym.
  **Kontrola mutacyjna:** po usunięciu poprawki z `akceptacja.ts` test „produkcja zapisuje
  rozwinięty EAN, my zapisujemy NULL" **czerwienieje** (1 failed / 6 passed) — próba realnie
  gryzie, a nie przechodzi „z rozpędu". Poprawka przywrócona, diff czysty.
- **Pełna bramka backendu:** `npm test` → **82 pliki, 1256 testów, 0 błędów**
  (baseline `develop` to 1249 — przyrost +7 to dokładnie nowy plik).
  `npm run lint` ✓ · `npm run typecheck` ✓ · `npm run build` ✓
- **Bramki FE:** nie dotyczy — `rebuild/frontend/**` ani `contract/fixtures/` nie były ruszane.

## Breaking changes

**Jedna zmiana zachowania, zamierzona i zatwierdzona:** produkt akceptowany z pozycji, której
EAN rozpoznano jako zapis naukowy, ma od teraz `products.ean = NULL`. Wcześniej (i w produkcji)
trafiała tam rozwinięta wartość, np. `6419440000000`.

Zakres realnego wpływu jest dziś wąski: w `db/snapshot.db` **0 z 7405** produktów ma status
`scientific_notation_uncertain`, a 9 z 10 parserów woła `common.normalizeEan()` przed silnikiem.
Gałąź staje się osiągalna, gdy MO8 przyjdzie jako CSV albo gdy pozycje wejdą przez
`POST /api/staging/import` z pominięciem parserów (backlog #11).

**Zmiana dotyczy tylko nowych akceptacji** — istniejące wiersze w katalogu nie są ruszane,
żadnej migracji danych nie ma.

## Follow-up

1. **`GETProducts200ItemsPozycja.ean` w `contract/openapi.yaml` jest zbyt wąskie.** Pole ma
   `type: "string"`, jest w `required` i **nie ma `nullable: true`**, podczas gdy produkcja
   realnie zwraca `null`: w `db/snapshot.db` **157 z 7405 produktów ma `ean IS NULL`** (plus
   1 pusty łańcuch); rozkład `ean_source_status`: `ok` 7246, `NULL` 157, `no_valid_candidate` 1,
   `memory` 1. To **artefakt próbkowania**, istniejący PRZED tym ticketem: schemat generuje się
   z fixtures, a `GET_products.json` nagrał 5 wierszy i wszystkie akurat miały EAN.
   Świadomie poza zakresem (decyzja użytkownika).
   ⚠ **Nie da się tego naprawić ręczną edycją** — schematy są generowane przez
   `tools/generate-openapi-schemas.cjs` do bloku między znacznikami, a
   `test/kontrakt.spojnosc.test.ts:112` uruchamia generator z `--sprawdz` i wywala się na
   każdej ręcznej zmianie. Dwie legalne drogi: (a) nagrać z oryginału dodatkowy fixture
   `GET /api/products` zawierający produkt z `ean: null` — generator scala nagrania tej samej
   operacji regułą `a.nullable && !b.nullable → {...b, nullable: true}`, więc `nullable`
   pojawi się sam; (b) dobudować w generatorze mechanizm jawnych, uzasadnionych poszerzeń.
   Wariant (a) rusza `contract/fixtures/` (wspólne BE/FE → bramki obu stron).
2. **`POST /api/products` (bulk) nie zna pojęcia zapisu naukowego.** `bulk.ts:71-87` bierze
   `ean` wprost z ciała żądania i nigdy nie woła `normalizujEan()`, więc EAN w notacji naukowej
   wysłany tą trasą wejdzie do katalogu tak, jak przyszedł. Objęcie tej trasy decyzją Ani
   wymagałoby **nowego odstępstwa** (dorobienia detekcji tam, gdzie produkcja jej nie ma) —
   do rozstrzygnięcia z użytkownikiem, jeśli trasa zacznie być używana do wgrywania cenników.
3. **Komunikat „zapis naukowy ma tylko null cyfr znaczących"** (cieniowanie `Lq`, backlog #11)
   dalej zawiera dosłowne „null". Karta wprost zabraniała naprawy przy okazji — wpis w backlogu
   pozostaje otwarty w tej części.
