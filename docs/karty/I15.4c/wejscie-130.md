# Wejście dla I15.4c od ticketu 130 (I15.4b) · 2026-09-23

Ścieżka ZAPISU (`importer()`) jest zastąpiona portem `staging_policy.install()` @ `88fa31c`.
Gotowe do wołania przez akceptację, bez zmian w plikach I15.4b:

## Fabryka i wspólne helpery domknięcia `install()`

`stworzPolitykeStagingu(db, zaleznosci)` z `rebuild/backend/src/import/polityka/fabryka.ts`
zwraca `{ importer, wstrzymaj, wyczyscZgloszenie, dopasowanieZapamietane, kartaPoKodzie,
nalozPoprawki, dostepnoscZmieniona, oznaczZmianeDostepnosci, odswiezDostepnosc }`
(`fabryka.ts:1014-1026`). To dokładny odpowiednik wspólnego stanu domknięcia oryginalnego
`install()`, który w `staging_policy.cjs` dzielą `importer` z `acceptStaging`,
`resolveStaging`, `closeAbsenceReview`, `chooseAbsenceCard`.

- `dostepnoscZmieniona()` i `oznaczZmianeDostepnosci()` **nie mają dziś żadnego wołającego** —
  to CELOWE API dla Was, nie martwy kod. Nie kasować przy porządkowaniu (zgłoszone też w
  code review ticketu 130, punkt NICE-TO-HAVE).
- `odswiezDostepnosc` to szew do modułu dostępności I15.10 — domyślnie no-op, patrz
  `docs/karty/I15.10/wejscie-130.md`.

## Prymitywy

`rebuild/backend/src/import/polityka/podstawy.ts`: `norm`, `hash`, `validateEan`, `rawEan`,
`identity`, `syntheticCode`, `compatibility`, `separateDotBatch`, `sourceKey`, `codeKey`,
`version`, `KEYS`, `LABEL`, `OPTIONAL` — wszystkie eksportowane, gotowe do wołania bez zmian.

## D4 — twarda blokada akceptacji NALEŻY DO WAS

Silnik (ścieżka zapisu, już dowieziona) oznacza pozycję z błędnym EAN-em jako
`typZmiany='blad'`, z komunikatem walidacji i zachowanym `eanRaw` w zgłoszeniu — ale to nie
blokuje akceptacji samo z siebie. Samo odrzucenie `POST /api/staging/:id/accept` siedzi w
`checkAcceptance()` (`staging_policy.cjs:188-226`) i jest w Waszym zakresie.

Test po stronie silnika, który już to pilnuje i na który możecie się oprzeć:
`rebuild/backend/test/silnik.gate.test.ts`, przypadek „EAN w notacji naukowej — D4"
(`"8,05997E+12"` → `kod MO1_GATE-NORMEAN`, `ean null`, `eanRaw "8,05997E+12"`, `_eanLossy
true`). Uwaga: w code review ticketu 130 ten test dostał SHOULD-FIX — asercje na
`typZmiany`/`eanRaw`/`_eanIssue` mogły nie zostać dociągnięte do końca; przed oparciem się na
nim sprawdźcie stan testu na `develop`.

## `assignKodImportu` już podmienione globalnie

`rebuild/backend/src/import/polityka/kod-importu.ts` — `acceptStaging` ma wołać TĘ wersję, nie
`legacy/bridge_ext.cjs`. Nowa reguła grupuje przez `compatibility()` + EAN, nie po gołym
kluczu `EAN:<ean>`; karta bez `model` NIE dziedziczy numeru grupy. Gałąź „zachowaj istniejący
sześciocyfrowy `kod_importu`" zachowana dosłownie (patrz `docs/karty/I15.4b/wejscie-116.md`) —
#108 (kolizje kodu) zostaje otwarte, rozstrzygnięcie należy do Ani.

⚠ Wydajność: `assignKodImportu` czyta całą tabelę `products` przy każdym wywołaniu
(`kod-importu.ts:63`, `db.select().from(products).all()`) — wierne oryginałowi
(`U.listProducts()`), ale przy akceptacji zbiorczej koszt jest liniowy na pozycję. Materiał do
wpisu backlogu #107.

## `updateStaging` już sportowane

`rebuild/backend/src/import/polityka/edycja-stagingu.ts` — bieżnik idzie za modelem, gdy był
jego automatyczną kopią (#105); zmieniony EAN przechodzi ścisłą walidację.

## Harness oryginału do porównań

`rebuild/backend/test/charakteryzacja/silnik/polityka.mjs`:
- `stworzPolitykeOryginalu({produkty, overrides})` stawia prawdziwy SQLite i zwraca oryginalny
  `importer` przez `install()` @ `88fa31c`;
- `oryginalneAssignKodImportu({db, U})` i `zaladujOryginalZeStagingV2(zaladuj, baza)` dają
  nadpisaną wersję dla charakteryzacji akceptacji;
- Uwaga na `U` z wycinka akceptacji: nie ma `listProducts`, a nadpisane `assignKodImportu` go
  woła — harness dokłada odpowiednik czytający z tej samej bazy.

Wzorzec `test/silnik.polityka-zrodla.test.ts` (port vs ŻYWY oryginał na tej samej bazie SQLite,
17/17) jest mocniejszy niż nagrany fixture i wart powielenia dla ścieżki akceptacji.
