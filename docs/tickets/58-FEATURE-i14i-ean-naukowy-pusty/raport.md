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
- **Nowy:** `rebuild/backend/test/akceptacja.odstepstwa.test.ts` — 9 przypadków, porównanie
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
| scenariusze charakteryzacji akceptacji | 0 | **0** (z 31) |
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
  w `akceptacja.charakteryzacja.test.ts` (31/31 scenariuszy dalej żąda pełnej równości z oryginałem),
  nie poprawiono po cichu żadnego wzorca. Komunikat „zapis naukowy ma tylko null cyfr
  znaczących" (cieniowanie `Lq`, backlog #11) **pozostaje niezmieniony**, zgodnie z kartą.

## Deviations from plan

Brak odstępstw od planu w zakresie. **Zmieniło się natomiast MIEJSCE cięcia** wewnątrz
`akceptacja.ts` — po code review (patrz „Review fixes applied"). Plan mówił „po zbudowaniu
`rekord`, przed wartościami domyślnymi"; faktycznie cięcie stoi na `doZapisu`, tuż przed
zapisem do bazy. Powód w sekcji niżej — pierwotne miejsce powodowało drugie, nieautoryzowane
odstępstwo.

## Review fixes applied

**BLOCKER — zerowanie EAN-u psuło grupowanie `kod_importu` (naprawione).**
Cięcie stało pierwotnie na `rekord` zaraz po jego zbudowaniu, czyli **przed**
`assignKodImportu()` (`akceptacja.ts:200`). Ta funkcja (`legacy/bridge_ext.cjs:164-167`) nadaje
produktom tego samego towaru w różnych magazynach **wspólny sześciocyfrowy `kod_importu`**
(wielomagazynowość Selly), grupując je po kluczu `EAN:<ean>` — ale tylko gdy `ean` jest
niepusty **oraz** `eanIsValid === 1`. Zapis naukowy z poprawną sumą kontrolną spełnia oba
warunki (`8,05997E+12` → `8059970000000`, suma kontrolna zweryfikowana — poprawna), więc
wyzerowanie EAN-u wcześniej zrzucało grupowanie na gałąź zapasową `marka|rozmiar|bieznik|nazwa`
i produkt **losował nowy numer zamiast odziedziczyć** numer swojego odpowiednika z innego
magazynu. To byłoby **drugie, nieobjęte decyzją Ani odstępstwo**.

*Naprawa:* cięcie przeniesione na `doZapisu` (wynik `tylkoKolumnyProduktu(rekord)`), tuż przed
`INSERT`/`UPDATE`. Dzięki temu `assignKodImportu()`, `applyLinkMemory()` i `rememberLink()`
widzą **dokładnie to samo, co w produkcji**, a jedyną różnicą jest wartość wpisana do kolumny
`products.ean`. Zweryfikowano, że `ean` czytają w `bridge_ext.cjs` wyłącznie funkcje grupujące
`kod_importu` (linie 144, 145, 164, 167) — żadne inne rozszerzenie go nie używa.

*Nowe testy (2, w osobnym `describe`):* produkt z EAN-em w notacji naukowej **i poprawną sumą
kontrolną** dziedziczy numer grupy po produkcie z innego magazynu — asercja najpierw dowodzi, że
oryginał też tak robi. Drugi test pilnuje, że poza samym `ean` produkt jest identyczny jak
u produkcji, a produkt z innego magazynu nie został tknięty.
**Kontrola mutacyjna:** po przesunięciu cięcia z powrotem w stare miejsce oba nowe testy
**czerwienieją** (2 failed / 7 passed) — regresja jest realnie złapana.
Przy okazji poprawiono `stan()` w teście, żeby **nie maskowało** numerów `kod_importu` zasianych
ręcznie w katalogu (maskowanie ukrywało właśnie ten typ różnicy); maskowane są tylko numery
świeżo losowane przez `_kiGenUnique()`.

**SHOULD-FIX — błędna liczba scenariuszy w dokumentacji (naprawione).**
Plan i raport pisały o „38 scenariuszach" charakteryzacji akceptacji. Faktycznie
`SCENARIUSZE.length === 31` (zweryfikowane importem modułu) — liczba 38 wzięła się z naiwnego
`grep -c "nazwa:"`, który łapał też pola `nazwa` wewnątrz helperów `produkt()`/`narzut()`/
`promocja()`. Skorygowano w `plan.md` i `raport.md`.

**NICE-TO-HAVE — brak przypadku `eanIsValid: 1` (naprawione).**
Wszystkie pierwotne przypadki miały `eanIsValid: 0`, więc nigdy nie ćwiczyły kombinacji
„zapis naukowy + poprawna suma kontrolna" — a to właśnie ona ujawniała BLOCKER-a. Helper
`pozycjaZEanem()` przyjmuje teraz `eanIsValid`, a nowy `describe` używa `1`.

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
- **Charakteryzacja akceptacji (najmocniejszy dowód wąskości): ✓ 31/31 scenariuszy**,
  `akceptacja.charakteryzacja.test.ts` — porównanie końcowego stanu bazy naszego portu
  z **uruchomionym oryginałem**, bez dodanego wyjątku i bez rozluźnienia porównania.
- **Charakteryzacja silnika: ✓ nietknięta i zielona** (`silnik.charakteryzacja.test.ts`,
  `silnik.gate.test.ts` — w tym test „dopasowanie po EAN ZNORMALIZOWANYM").
- **Unit/integracja (nowe): ✓ 9/9** — `akceptacja.odstepstwa.test.ts`. Bez mocków, na
  prawdziwym SQLite w katalogu tymczasowym.
  **Kontrola mutacyjna:** po usunięciu poprawki z `akceptacja.ts` test „produkcja zapisuje
  rozwinięty EAN, my zapisujemy NULL" **czerwienieje** (1 failed / 6 passed) — próba realnie
  gryzie, a nie przechodzi „z rozpędu". Poprawka przywrócona, diff czysty.
- **Pełna bramka backendu:** `npm test` → **82 pliki, 1258 testów, 0 błędów**
  (baseline `develop` to 1249 — przyrost +9 to dokładnie nowy plik).
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

## Docs updates

### `docs/rebuild-roadmap.md` (9 edycji)

- Blok **14i** oznaczony jako zrobiony w czterech miejscach (tabela §4 linia ~191, nagłówek
  bloku I14 ~2158, tabela kart drugiej fali ~2499, sekcja „ROZSTRZYGNIĘTE 2026-09-18") —
  data 2026-09-18 + ID ticketa; 14i zdjęta z listy „otwarte 14f/14h/14i".
- **Skorygowane błędne przypisanie zakresu (D5):** wiersz 14i miał „BE: silnik importu
  (normalizacja EAN)" → jest „BE: zapis do katalogu (akceptacja), `src/import/akceptacja.ts`".
  Dowód zapisany jako fakt: `tk.ts:302-305` dopasowuje po `znormalizowana.ean`, test
  `silnik.gate.test.ts`.
- **Usunięta niewykonalna nota** „14i rusza silnik importu — wzorce trzeba przenagrać":
  zastąpiona stanem faktycznym (0 scenariuszy/testów/fixtures ruszonych) i wyjaśnieniem, że
  przenagranie odtworzyłoby starą wartość, bo skrypt uruchamia żywy oryginał.
- **Zdjęta fałszywa blokada kolejnościowa z 14h** — 14i nie ruszyła `contract/`, więc 14h
  wchodzi bez uzgodnień (poprawione w dwóch miejscach: nota o kolizji ~2504 i „Kolejność" ~2681).
- Nota „Do rozliczenia przez kartę zamykającą DRUGĄ FALĘ I14" — zależność aktualizacji
  `docs/instrukcja-testow-I4.md` zawężona z „14f/14i" do samego **14f**.
- Dopisane dwa follow-upy z tego raportu (zwężenie `ean` w kontrakcie, bulk bez
  `normalizujEan()`) — z odsyłaczem do ticketa zamiast kopiowania treści.

### `docs/rebuild-backlog.md` (wpis #11)

- **Rozdzielone dwa zagadnienia, które wpis mieszał:** (a) decyzja Ani „puste pole w katalogu" —
  **zrealizowana** kartą 58; (b) defekt cieniowania `Lq()` i komunikat „null cyfr znaczących" —
  **nadal otwarty**, karta 58 celowo go nie ruszała. Pola `Do nowej wersji?`, `Iteracja`
  i `Status` opisują teraz STAN, nie zamiar.
- Skorygowana obalona teza „rusza silnik importu, trzeba przenagrać wzorce".
- Rozstrzygnięte otwarte pytanie „czy ostrzeżenie w stagingu zostaje" → **ZOSTAJE** (D2).
- Dopisana wiedza z code review: `assignKodImportu()` (`bridge_ext.cjs:164-167`) grupuje po
  `EAN:<ean>` tylko gdy `eanIsValid === 1` — pułapka dla każdej przyszłej zmiany `products.ean`.
- Dopisana zmierzona statystyka zasięgu: **0 z 7405** produktów w `db/snapshot.db` ma dziś
  status `scientific_notation_uncertain`.

### `docs/instrukcja-testow-I3-v2.md` (dokument dla Ani)

Punkt **5.2** („⏳ EAN w zapisie naukowym — decyzja podjęta, wdrożenie czeka") przeniesiony do
rozdziału z dowiezionymi poprawkami jako **4.3**, z krokami sprawdzenia i miejscem na ocenę.
Uczciwe zastrzeżenie: gałąź trafia się rzadko (0/7405 w produkcji), więc punkt jest **warunkowy**
(„tylko jeśli natrafisz"), a nie do wymuszenia. Podbite odwołania: arytmetyka we wstępie
(9 poprawionych zamiast 8), tabela podsumowania (19 punktów), rozdział 8. W dokumencie
powiedziane wprost, że **ostrzeżenie na Stagingu zostaje** i nie należy go zgłaszać ponownie.

⚠ **Ten plik trafił na gałąź przez scalenie osieroconych commitów ticketa 56** — patrz
„Pre-existing issues" niżej.

## Pre-existing issues

1. **Trzy commity ticketa 56 nigdy nie trafiły na `develop`.** PR #71 zmergowano 2026-09-18
   o 17:18, a commity `c3343ba` (17:24), `e90dfab` (18:17) i `7ea0beb` (18:32) powstały PO
   merge'u i nie miały żadnego otwartego PR-a. Wśród nich: zawężenie instrukcji do uwag Ani
   (13 → 8 rozdziałów), 26 scenariuszy testowych i scalenie wszystkiego w jeden plik
   `docs/instrukcja-testow-I3-v2.md` (kasujące `instrukcja-testow-I14.md`
   i `scenariusze-testow-I14.md`). Skutek: `develop` i roadmapa opisywały plik, który gałąź 56
   już zastąpiła. **Naprawione w tym PR** przez scalenie gałęzi 56 (decyzja użytkownika) —
   historia i autorstwo trzech commitów zachowane.
2. **`docs/rebuild-backlog.md:35`** — narracja z podsumowania sesji 12e (2026-09-08) nadal
   wymienia #11 jako ⬜. Zostawione: to datowany zapis historyczny sprzed decyzji Ani, nie żywy
   wskaźnik statusu. Do rozważenia przy porządkowaniu preambuły.
