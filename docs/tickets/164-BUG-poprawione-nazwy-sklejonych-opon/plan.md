# 164-BUG-poprawione-nazwy-sklejonych-opon — naprawa nazw dla kolidujących `kod_importu`

> Status: Draft
> Branch: `fix/164-poprawione-nazwy-sklejonych-opon`
> Worktree: `.worktrees/164-BUG-poprawione-nazwy-sklejonych-opon`

## Ticket description

Użytkownik dostarczył plik CSV (`MO1_MO2_MO4_MO5_MO8_poprawione_nazwy.csv`, 69 wierszy) z
poprawnymi nazwami dla konkretnych produktów (dokładny `dostawca`+`kod`) u dostawców MO1, MO2,
MO4, MO5, MO7, MO8. Kolumna `nazwa` to naprawa danych dla znanych kolizji `kod_importu` (ticket
119 / karta I15.10, `docs/rebuild-backlog.md` #108) — ten sam dostawca ma dwie fizycznie różne
opony (różny EAN, czasem inny DOT) pod jednym sześciocyfrowym `kod_importu`. Mechanizm
`nazwa_pamiec` jest kluczowany PO `kod_importu`, więc dla kolidującej pary pamięta tylko jedną
nazwę — stąd nazwy sklejone/pomylone.

Zadanie: wgrać poprawne nazwy tak, żeby każdy produkt (dokładny `dostawca`+`kod`) pokazywał
swoją własną nazwę, niezależnie od współdzielonego `kod_importu`.

## Context

- `nazwa_pamiec` (`rebuild/backend/src/db/schema.ts:482-487`) ma klucz główny `kod_importu` —
  nie da się nim rozróżnić dwóch produktów o tym samym `kod_importu`.
- `manual_overrides` ("Poprawki Marty", `rebuild/backend/src/db/schema.ts:148-158`) jest
  kluczowany po `(supplier_kod, supplier_product_id, field_name)` — czyli po DOKŁADNYM `kod`,
  nie po `kod_importu`. To rozwiązuje kolizję bez żadnej zmiany schematu/logiki `nazwa_pamiec`.
- Silnik importu (`rebuild/backend/src/import/silnik/overrides.ts`, `poprawkiMarty()`) nakłada
  override BEZWARUNKOWO na każdą pozycję z pliku dostawcy pasującą do (dostawca, kod) — override
  zawsze wygrywa z plikiem, dokładnie to zachowanie chcemy dla tych 69 pozycji.
- Zapis idzie przez `zapiszPoprawke()` (`rebuild/backend/src/repos/overrides.ts`) — upsert po
  (dostawca, kod, pole); ta sama funkcja stoi za `POST /api/overrides`, którym Marta/Ania
  poprawia pola ręcznie w panelu.
- W oryginale (`deminified/backend-index.cjs`) nie ma żadnego mechanizmu masowego importu
  poprawek — tylko pojedyncze upserty z UI (edycja produktu, akceptacja stagingu). Skrypt
  migracyjny czytający CSV to więc nowy proces po stronie odbudowy, nie port zachowania
  oryginału — flagowane jako świadome, ograniczone odstępstwo (jednorazowe narzędzie
  deweloperskie, nie stały endpoint/UI).
- Wzorzec jednorazowego skryptu operującego na `DB_PATH` z env: `rebuild/backend/scripts/dziedzicz-wage.ts`.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Brak (nie dotyka kontraktu). Ticket nie zmienia żadnego endpointu ani kształtu odpowiedzi API —
`POST /api/overrides` i `GET /api/products`/`GET /api/staging` zachowują się dokładnie tak samo
jak dziś (override wygrywa z plikiem — to już istniejące, przetestowane zachowanie). Zmieniają
się wyłącznie DANE w tabeli `manual_overrides` (69 nowych/nadpisanych wierszy z `fieldName='nazwa'`).
GATE fixtures/openapi nie ma tu zastosowania.

## Decisions

1. **Mechanizm: `manual_overrides`, nie zmiana `nazwa_pamiec`.** Klucz (dostawca, kod, pole) już
   rozróżnia kolidujące produkty; zmiana `nazwa_pamiec` byłaby większym, ryzykowniejszym
   zabiegiem bez potrzeby. *(decyzja użytkownika, Krok 3)*
2. **Sposób wgrania: jednorazowy skrypt migracyjny**, nie trwały mechanizm/endpoint importu CSV.
   Skrypt czyta plik CSV i woła `zapiszPoprawke()` per wiersz z `fieldName: "nazwa"`,
   `overrideValue` = kolumna `nazwa` z pliku, `reason` opisujący pochodzenie (import CSV z tego
   ticketu), `createdBy: null` (operacja systemowa/skryptowa, nie konkretny użytkownik z sesji
   HTTP). *(decyzja użytkownika, Krok 3)*
3. **Świadome odstępstwo (do zaflagowania w raporcie):** sam skrypt masowego importu poprawek
   nazw to nowy proces — w oryginale nie istniał żaden odpowiednik. Ograniczony do jednorazowego
   narzędzia CLI, nie zmienia API ani UI.

## Implementation plan

1. Zapisać dane z załączonego CSV jako plik wejściowy skryptu:
   `rebuild/backend/scripts/data/164-poprawione-nazwy.csv` (69 wierszy, kolumny z oryginalnego
   pliku: `kod_importu,dostawca,kod,ean,nazwa,marka,model,rozmiar,dot,cena_sprzedazy,stan`).
2. Nowy skrypt `rebuild/backend/scripts/napraw-nazwy-sklejone.ts` (wzorowany na
   `dziedzicz-wage.ts`):
   - wymaga `DB_PATH` z env (błąd + exit 1, jeśli brak — spójne z konwencją);
   - czyta CSV, dla każdego wiersza woła `zapiszPoprawke(db, { supplierKod: dostawca,
     supplierProductId: kod, fieldName: "nazwa", overrideValue: nazwa, reason: "import CSV
     164-BUG-poprawione-nazwy-sklejonych-opon (kolizja kod_importu)", createdBy: null,
     createdAt: new Date().toISOString() })`;
   - loguje ile wierszy przetworzono / ile było już istniejących poprawek (upsert nadpisze) /
     ile nowych.
3. Dodać wpis do `package.json` (`scripts`) analogiczny do `dziedzicz-wage`, np.
   `"napraw-nazwy-sklejone": "tsx scripts/napraw-nazwy-sklejone.ts"` (sprawdzić dokładną
   konwencję uruchamiania tsx/ts-node w repo przed dodaniem).
4. Testy jednostkowe skryptu/logiki parsowania CSV + wywołania `zapiszPoprawke` (patrz niżej).
5. Uruchomić skrypt na lokalnej/testowej bazie deweloperskiej, żeby zweryfikować manualnie efekt
   (69 poprawek w `manual_overrides`, poprawne `nazwa` przy odczycie produktu przez
   `poprawkiMarty()`).

## Testing strategy

- Unit test dla parsowania CSV (mapowanie kolumn, obsługa cudzysłowów/przecinków w polu `nazwa`
  — plik ma wartości z przecinkami w cudzysłowie, np. `"OPONA 205/75R17.5 RI151 ... (E,C,B,72dB)"`).
- Integracyjny test na tymczasowej bazie SQLite: uruchomienie funkcji importującej (wydzielonej
  z CLI, żeby dało się przetestować bez `process.exit`) i weryfikacja, że w `manual_overrides`
  powstały poprawne wiersze dla przykładowych par z kolizją (np. `MO1_15126981` vs `MO1_15126983`
  przy wspólnym `kod_importu=326606`), oraz że `poprawkiMarty()` po nałożeniu na pozycję z pliku
  dostawcy zwraca właściwą, różną nazwę dla każdego z tych dwóch `kod`.
- GATE fixtures/kontrakt: N/D (patrz sekcja wyżej) — dane, nie kontrakt.

## Out of scope

- Zmiana `nazwa_pamiec` / jego klucza.
- Stały endpoint/UI do masowego importu poprawek CSV (świadomie odłożone — decyzja użytkownika).
- Poprawa innych pól niż `nazwa` z pliku (plik ma też `marka`, `model`, `rozmiar`, `cena_sprzedazy`,
  `stan`, `ean`, `dot` — użytkownik poprosił wyłącznie o poprawę `nazwa`; pozostałe kolumny to
  kontekst identyfikujący wiersz, nie dane do wgrania).
- Kolizje `kod_importu` u innych dostawców niż MO1/MO2/MO4/MO5/MO7/MO8 z tego pliku.

## Definition of done

- [ ] Skrypt `napraw-nazwy-sklejone.ts` istnieje, czyta dołączony CSV, zapisuje 69 poprawek przez `zapiszPoprawke()`.
- [ ] Unit/integration testy zielone.
- [ ] Lint/typecheck/build/test przechodzą w `rebuild/backend/`.
- [ ] `raport.md` opisuje wynik uruchomienia (ile wierszy, ewentualne kolizje z istniejącymi override'ami).
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE`.
