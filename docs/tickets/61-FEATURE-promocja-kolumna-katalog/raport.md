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

`db/snapshot.db`: `products` = 7405 wierszy, `promotions` = **0**. Produkcyjny fixture
`GET_promotions.json` to również pusta tablica. Kolumna będzie więc nadal pokazywać „—"
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
- **Backend pełny: ✓ 83 pliki, 1274 testy** — lint, typecheck, build, test wszystkie zielone.
- **Frontend pełny: ✓ 49 plików, 795 testów** — lint, typecheck, build, test zielone. Puszczony
  mimo braku zmian w fixtures, bo `contract/` jest wspólne (nauka z 13c).

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
   **Naprawa należy do silnika cen (`repos/ceny.ts`), czyli do 14f.** Warto sprawdzić, ile
   produktów w produkcji ma puste `marka`/`kategoria` — to skala ewentualnego problemu.
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
