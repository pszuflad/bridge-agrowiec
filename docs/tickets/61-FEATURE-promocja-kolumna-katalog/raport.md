# 61-FEATURE-promocja-kolumna-katalog — raport z implementacji

## Summary

`GET /api/products` dokłada teraz do produktu opcjonalny klucz `_reguly.promocja`
(`{ wartosc, nazwa }`) z wygrywającą, aktywną promocją — wyliczoną **istniejącym** silnikiem cen,
nie nową implementacją. Kolumna „Promocja" w `/katalog` przestaje być martwa. Karta okazała się
**czysto backendowa**: renderer, piker kolumn i typ `Produkt` na froncie były gotowe od sesji 4b,
więc na FE zmieniły się wyłącznie dwa nieaktualne komentarze.

## ⚠ TO JEST NOWA FUNKCJA, NIE POWRÓT DO STANU SPRZED BACKUPU — do przekazania Ani

Ania, prosząc o ożywienie kolumny, napisała: *„w starym Bridge działała, było to sprawdzane,
być może któryś backup to zastąpił i już nie działa"*. **Sprawdziliśmy to i kod tego nie
potwierdza w żadnej wersji, którą mamy.** Zmierzone na żywych plikach produkcji, nie na
deminifikacie, i potwierdzone niezależnie dwa razy:

| Co sprawdzone | Wynik |
|---|---|
| `mirror/frontend/assets/index-PRICEFMT1783512500.js` (żywy bundle) | **1** wystąpienie `_reguly` — wyłącznie **ODCZYT** (`e?._reguly?.promocja`) |
| `deminified/frontend-index.js` (baseline 2026-08-13) | **1** wystąpienie, też odczyt — **żadna łatka Ani tego nie dodała ani nie usunęła** |
| `mirror/backend/index.cjs` i wszystkie łatki `mirror/backend/*.cjs` | **0** wystąpień pola (dwa trafienia gołego `grep` to substring kolumny `dodatkowe_reguly` ze `spedycja_limity`) |
| `git log -S'_reguly:' --all` | **1** commit — nasz własny wpis dokumentacyjny, zero kodu produkcji |

**Nikt nigdy nie dopisał ZAPISU tego pola.** Kolumna była w domyślnym zestawie kolumn i od
zawsze pokazywała „—". To praca nowa, nie naprawa regresji — i tak trzeba ją wycenić.

Powiązane, zmierzone niezależnie w 14e: pusta kolumna **nie wpływała na ceny** (przy promocji
`marka→BKT` ceny 954 produktów spadły poprawnie). Zgadza się to z tym, co Ania napisała 19.09:
*„tylko się nie wyświetlało, cena się oblicza prawidłowo"*. Naprawiliśmy więc wyłącznie
**widoczność**.

## ⚠ DZIŚ W BAZIE NIE MA ŻADNEJ PROMOCJI — kolumna zaświeci dopiero po jej założeniu

Zmierzone bezpośrednio na snapshocie produkcji `db/snapshot.db`: `products` = 7405 wierszy,
`promotions` = **0**, `markups` = 1. Produkcyjny fixture `GET_promotions.json` to również
pusta tablica. Kolumna będzie więc nadal pokazywać „—"
**dopóki Ania nie założy promocji** w `/narzuty`. To nie jest usterka tej karty — bez tego
zdania zgłosi „dalej nie działa" i z własnego punktu widzenia będzie miała rację.

## Changes

- **Nowy:** `rebuild/backend/src/repos/products.ts` → `dolaczReguly()`, typy `PromocjaProduktu`
  i `ProduktZRegulami`, plus 20-wierszowy blok komentarza opisujący odstępstwo (co, dlaczego,
  czyja decyzja, z jakiej daty) i powód reużycia silnika cen.
- `rebuild/backend/src/routes/products.ts` — `listaPromocji(db)` wołane **raz**, przed
  rozgałęzieniem na dwa kształty; `dolaczReguly` wpięte w **obie** gałęzie; komentarz
  nagłówkowy trasy rozszerzony o odstępstwo.
- `contract/openapi.yaml` — blok komentarza nad ścieżką `/api/products` opisujący odstępstwo
  i wyjaśniający, dlaczego pola nie ma w schemacie niżej.
- `rebuild/backend/test/katalog.gate.test.ts` — **nowy, osobny `describe`** ze strażnikiem
  odstępstwa (własne środowisko testowe). Trzy istniejące asercje 72 kluczy **nietknięte**.
- **Nowy:** `rebuild/backend/test/katalog.promocja.test.ts` — 8 testów jednostkowych
  `dolaczReguly`.
- `rebuild/frontend/src/pages/katalog/kolumny.ts` i `.../formatowanie.tsx` — **wyłącznie treść
  komentarzy** (twierdziły, że kolumna jest martwa i taka zostaje).

**Czego NIE ruszono:** `contract/fixtures/` (ani bajta), `rebuild/backend/src/repos/ceny.ts`
(czytane, nie modyfikowane — zakres 14f), `repos/promotions.ts` (tylko odczyt),
`tools/generate-openapi-schemas.cjs`, kod produkcyjny frontendu.

## Deviations from plan

**Jedno, rozstrzygnięte z użytkownikiem w trakcie — D4 zostało przepisane.**

Pierwotne D4 („schemat `RegulyProduktu` poza blokiem generowanym") okazało się **niewykonalne**.
Zakładało, że w `components.schemas` istnieje ręczna sekcja poza blokiem generowanym. Nie
istnieje: klucz `schemas:` sam leży **wewnątrz** bloku (`openapi.yaml:18` POCZĄTEK → `:18716`
KONIEC, a zaraz po nim zaczyna się `paths:`). Dopisanie własnego `schemas:` przed znacznikiem
dałoby **zduplikowany klucz YAML**, czyli cichą utratę jednej z gałęzi.

Zatrzymałem pracę, zgłosiłem to użytkownikowi i decyzją z Q&A zastąpiłem D4 **komentarzem nad
ścieżką `/api/products`** — zweryfikowanym empirycznie: przeżywa i `--sprawdz`, i pełny bieg
generatora (sprawdzone przez skopiowanie pliku, regenerację i `diff`).

Poza tym doszły dwie decyzje (obie uzgodnione przed implementacją): **D8** — poprawka dwóch
nieaktualnych komentarzy na FE, i **D9** — obowiązek napisania wprost, że w bazie nie ma dziś
żadnej promocji.

## Test results

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.**
  - `GET /api/products?limit=5` vs `contract/fixtures/GET_products.json` — **bez zmian, zielone**
  - `GET /api/products` vs `contract/fixtures/GET_products_bez-parametrow.json` — **bez zmian, zielone**
  - trzy asercje „dokładnie 72 klucze" — **nietknięte i zielone**
  - walidacja obu wariantów względem `contract/openapi.yaml` — zielona, także z obecnym `_reguly`
  - `tools/generate-openapi-schemas.cjs --sprawdz` — zielone (biegnie też w `npm test`,
    `kontrakt.spojnosc.test.ts:112`)
  - **`contract/fixtures/` niezmienione** — zero edycji

  **Dlaczego gate nie wymagał wyjątku.** Pole jest **warunkowe**, a bramka katalogu nie zasiewa
  żadnej promocji, więc żaden produkt nie dostaje tam `_reguly`. Istniejący, samoczyszczący
  mechanizm `WyjatekGate` (`test/gate/asercje.ts:98-134`) nie był potrzebny i nie został użyty.
  Żeby ta zieloność nie była przypadkowa, odstępstwo pilnuje **osobny strażnik** — patrz niżej.

- **Strażnik odstępstwa (nowy, `katalog.gate.test.ts`): ✓ 8 przypadków**, każdy dla **obu**
  ścieżek: klucz obecny i o kształcie `{wartosc, nazwa}` przy dopasowaniu; nieobecny i 72 klucze
  bez dopasowania; dokładnie jeden dodatkowy klucz, reszta kształtu nietknięta; walidacja
  kontraktu. Świadomie **bez** `sprawdzZgodnoscZFixture` — nie istnieje nagranie produkcji
  z wypełnioną promocją, więc nie ma z czym porównywać.
- **Unit: ✓ 8/8** (`katalog.promocja.test.ts`).
- **Renderer FE: ✓ 26/26** (`katalog.formatowanie.test.tsx`) — w tym dwa nowe przypadki
  na ścieżkę pozytywną, dodane po review.
- **Weryfikacja mutacyjna (wykonana przez reviewera):** zepsucie `dolaczReguly` na dwa sposoby
  zapala 8 testów bramki i 5 jednostkowych. Strażnik realnie łapie regres.
- **Backend pełny: ✓ 83 pliki, 1274 testy** — lint, typecheck, build, test wszystkie zielone.
- **Frontend pełny: ✓ 49 plików, 795 testów** — lint, typecheck, build, test zielone. Puszczony
  mimo braku zmian w fixtures, bo `contract/` jest wspólne (nauka z 13c).

## Review fixes applied

Review: `docs/tickets/61-FEATURE-promocja-kolumna-katalog/review.md`.

Reviewer wykonał **eksperyment mutacyjny** na `dolaczReguly` (dwa warianty: „zawsze dokładaj
`_reguly`" i „`wartosc` z błędnego pola") i potwierdził, że nowy strażnik oraz istniejące
asercje 72 kluczy realnie się zapalają — czyli testy coś dowodzą, a nie tylko wyglądają na testy.
Potwierdził też niezależnie nietykalność `repos/ceny.ts`, `contract/fixtures/`, `test/gate/*`
oraz przeżywalność komentarza w kontrakcie pod pełną regeneracją.

- **SHOULD-FIX — brak testu ścieżki POZYTYWNEJ renderera. Naprawione.** Plan twierdził, że
  renderer jest pokryty od 4b; to było **nieprecyzyjne** — pokryta była wyłącznie gałąź
  „brak promocji → kreska", czyli jedyna, jaką produkcja umiała pokazać. Doszły dwa przypadki
  w `rebuild/frontend/test/katalog.formatowanie.test.tsx`: odznaka `-10%` z nazwą oraz fallback
  nazwy `Promocja` z oryginału. To dokładnie ta ścieżka, którą Ania zobaczy jako pierwszą.
- **NICE-TO-HAVE — komentarz obiecywał więcej, niż asercja robi. Naprawione.**
  `sprawdzZgodnoscZKontraktem` sprawdza ścieżkę, metodę, kod i `content-type`, a nie ciało
  względem schematu. Komentarz w `katalog.gate.test.ts` mówi teraz wprost, jaki ma zakres
  i skąd wiemy, że dodatkowy klucz nie łamie schematu.
- **Dwa BLOCKER-y (synchronizacja `rebuild-roadmap.md`, `rebuild-backlog.md`,
  `spec-frontend.md`) — to faza docs tego samego ticketa, wykonana poniżej.** Reviewer miał
  rację, że musi się to zdarzyć w tej gałęzi, przed mergem; w momencie review ta faza
  jeszcze nie ruszyła.
- **Uwaga reviewera, której nie mógł zweryfikować:** liczby z `db/snapshot.db`. Sprawdziłem
  je bezpośrednio — `products` = 7405, `promotions` = 0, i **zero** produktów z pustą `marka`
  ORAZ pustą `kategoria`. Ostatnia liczba obniża pilność follow-upu #1 i jest w nim zapisana.

## Breaking changes

**Jedno, świadome i zatwierdzone:** `GET /api/products` może teraz oddać pozycję z **73**
kluczami zamiast 72 — ale wyłącznie dla produktu, któremu odpowiada aktywna promocja. Bez
dopasowania kształt jest identyczny z nagraniem produkcji.

Konsument, który zakłada sztywno 72 klucze, zobaczy różnicę. W `rebuild/` takich konsumentów nie
ma: front czyta pola po nazwach, a typ `Produkt` ma sygnaturę indeksową. Nie ma też ryzyka zapisu
zwrotnego — `zapiszProdukt` wysyła tylko zmienione pola formularza, a backend filtruje ciało
przez `POLA_EDYTOWALNE_PRODUKTU`, gdzie `_reguly` nie występuje.

## Follow-up

1. **Defekt: produkt z pustą marką I pustą kategorią łapie KAŻDĄ promocję.** `promocjaPasuje`
   robi `zasieg.includes(tekst(produkt.marka))`, a każdy napis zawiera pusty napis. Zachowanie
   odziedziczone po oryginale, utrwalone testem — karta 14h go wyłącznie **uwidacznia** (dotąd
   nie było go jak zobaczyć, bo kolumna była martwa, choć na cenę wpływał tak samo, po cichu).
   **Naprawa należy do silnika cen (`repos/ceny.ts`), czyli do 14f.**

   **Zasięg zmierzony na snapshocie produkcji: ZERO.** `db/snapshot.db` nie ma ani jednego
   produktu z pustą `marka` ORAZ pustą `kategoria` (0 z 7405). Defekt jest więc **realny, ale
   dziś nikogo nie dotyka** — to pułapka czekająca na dane, nie usterka do gaszenia. Zapisujemy
   go, żeby nie został odkryty ponownie od zera, i nie podnosimy mu priorytetu.
2. **Kontrakt opisuje `_reguly` komentarzem, nie schematem.** Pełne, walidujące opisanie wymaga
   rozszerzenia `tools/generate-openapi-schemas.cjs` o tabelę świadomych odstępstw. Ten sam
   mechanizm rozwiązałby **nierozliczony follow-up #1 z ticketu 58** (`ean` nullable) — warto
   zrobić oba jedną kartą, a nie dwa razy po kawałku.
3. **`docs/spec-frontend.md:235-236`** twierdzi, że kolumna „zostaje MARTWA (…) port 1:1" —
   nieaktualne od tej karty (adresowane w fazie docs).
4. **Wyjście poza literę przydziału plików, odnotowane świadomie:** poprawiłem dwa komentarze
   w `rebuild/frontend/src/pages/katalog/` (`kolumny.ts`, `formatowanie.tsx`), choć karta
   przyznawała FE tylko warunkowo. Zmiana dotyczy **wyłącznie treści komentarzy** — zero zmian
   w JSX, typach i zachowaniu. Uzgodnione z użytkownikiem przed implementacją (D8). Ryzyko
   konfliktu żadne: 14f siedzi w `/narzuty`, 14j w `/historia`.

## Docs updates

Trzej doc-checkerzy, rozłączne pliki, równolegle. Ich ustalenia niżej; pomiar skali defektu
(zero produktów) dopisałem do `#88` i do bloku 14f już po ich zakończeniu.

### `docs/rebuild-roadmap.md` — 9 miejsc

- Wiersz tabeli §5 (I14) i status bloku (:2158): **14h ✅ `61-FEATURE-promocja-kolumna-katalog`
  · 2026-09-18 (czysto backendowa)**; „otwarte 14f/14h" → **„otwarte 14f"**. Kolumna kart
  poprawiona z „14h BE+FE" na **„14h BE"** — bo FE nie wymagał zmian w kodzie.
- Wiersz **14h** w tabeli kart drugiej fali: opis planowany zastąpiony **stanem faktycznym**
  (pliki realnie zmienione zamiast zakładanych, testy realnie dodane zamiast jednego
  planowanego testu FE).
- Usunięte założenia sprzed implementacji o kolizji z kontraktem — zastąpione faktem.
- **Do bloku 14f (nie do 14h!) dopisane dwa punkty:** (1) kolumna korzysta ze wspólnego
  `wybierzPromocje`, więc po 14f zacznie respektować daty **sama**, bez zmian w
  `repos/products.ts`; (2) defekt pustych `marka`/`kategoria` — z pomiarem „skala: zero".
- **Do sekcji o kontrakcie dopisane:** ten sam mechanizm (tabela odstępstw w generatorze)
  rozwiąże odstępstwo 14h **i** nierozliczony follow-up `ean nullable` z ticketu 58 —
  **kandydat na jedną wspólną kartę zamiast dwóch**. Plus fakty o kontrakcie zweryfikowane
  empirycznie, przydatne każdej następnej karcie ruszającej `openapi.yaml`.

### `docs/rebuild-backlog.md` — 4 wpisy zmienione + 1 nowy

- **#22** — Status z „decyzja podjęta, karta niezałożona" na **zrobione 2026-09-18**; sprostowanie
  archeologiczne wzmocnione o dwa fakty z tej karty; hipoteza „ożywienie wymagałoby…" przepisana
  na czas przeszły z potwierdzeniem, że dokładnie tak zrobiono; usunięte obalone „kandydat na I12".
- **#19** — kolumna zacznie respektować daty sama, gdy 14f dowiezie naprawę (status bez zmian).
- **#23, #24** — odnotowane, że 14h świadomie **nie dołożyła czwartego** sposobu liczenia.
- **#88 (nowy)** — defekt pustych `marka`/`kategoria`, ⬜ do decyzji, naprawa = 14f,
  **ze zmierzoną skalą: zero produktów w produkcji**.

### `docs/spec-frontend.md` — 1 edycja

Usunięte nieprawdziwe już „Kolumna «Promocja» w `/katalog` zostaje MARTWA (…) to port 1:1".
Zastąpione rozdzieleniem: **w produkcji** kolumna martwa na trwałe (fakt zostaje);
**w odbudowie** ożywiona od 14h jako świadome odstępstwo.

### `docs/spec-backend.md` — bez zmian (uzasadnione)

Plik jest raportem z audytu auth i rejestracji tras, nie opisem kształtu payloadu. Jedyna
wzmianka o `GET /api/products` dotyczy `requireAuth` i pozostaje prawdziwa. Występujące tam
„72" to liczba **kolumn tabeli SQL**, nie kluczy odpowiedzi — ticket nie rusza schematu bazy.
Dopisywanie noty o `_reguly` byłoby wprowadzaniem tematu spoza zakresu pliku.

### Pre-existing issues

Żaden z trzech doc-checkerów nie znalazł w swoich plikach nieścisłości niezwiązanych z tym
ticketem.
