# 75-CHORE-niezmiennik-atrybutow — Implementation report

## Summary

Niezmiennik główny się trzyma: liczba w ostrzeżeniu dialogu (B, `GET /api/atrybuty/uzycie`) równa
się liczbie wierszy przepisanych przez akcję (C, `produktow_zaktualizowano`). Na kopii snapshotu
było **0 rozjazdów na 4148 pomiarach** (obie akcje, wszystkie pozycje kolejki). Jest też nowy test
w bramce, `atrybuty.niezmiennik.test.ts` (37 przypadków). Pilnuje B == C == realnej zmiany
policzonej niezależnie w SQL i zapisuje jako zachowanie trzy znane rozjazdy kolumny listy kolejki
(A) oraz jeden przypadek, w którym ostrzeżenie mówi „N produktów", a realnie nie zmienia się nic.

## Predykaty — skan (A) vs `uzycie` (B) vs UPDATE (C)

Wszystkie trzy są dosłowną kopią oryginału. Kolumny `products` to `TEXT` bez `COLLATE`, więc
porównanie jest binarne (wielkość liter ma znaczenie) wszędzie jednakowo.

| | Oryginał | Odbudowa | Predykat |
|---|---|---|---|
| A | `pending_module.cjs:84-93`, `:101` | `skanujNoweWartosci` | `GROUP BY <kol>` (surowa wartość), `IS NOT NULL AND TRIM(<kol>) != '' AND (dostawca IS NULL OR dostawca != 'MO6')`, klucz pozycji = `String(w).trim()` |
| B | `atrybuty_module.cjs:296` | `uzycieAtrybutu` | `COUNT(*) WHERE <kol> = ?` |
| C | `pending_module.cjs:289`, `:331` | `akceptujZEdycja`, `akceptujJakoAlias` | `UPDATE … WHERE <kol> = ?` → `changes` |

**B i C mają identyczny predykat**, więc B == C wynika z konstrukcji. Rozjechać się mogą tylko
wtedy, gdy katalog zmieni się między otwarciem dialogu a kliknięciem. Różnice **A vs C** są trzy:

1. **MO6.** Skan pomija dostawcę MO6, a UPDATE go przepisuje. Przykład: marka „X" ma 2 produkty
   u MO1 i 1 u MO6 → A = 2, B = C = 3. Kolumna listy kolejki zaniża, ostrzeżenie mówi prawdę.
2. **Spacje na brzegu.** Skan grupuje po surowej wartości, a klucz przycina. Produkty mają
   „X" ×2 i „X " ×1. Obie grupy trafiają w jedną pozycję „X", a druga nadpisuje jej licznik:
   A = 1 (!), B = C = 2. Wiersz „X " zostaje nietknięty i wraca do kolejki przy następnym skanie.
   Wariant skrajny, gdy są tylko wiersze „X " ×2: A = 2, B = C = 0. Akcja nie przepisuje nic,
   a pozycja znika z kolejki do następnego skanu.
3. **Migawka.** A jest z chwili skanu. Pozycji już obecnych w słowniku skan nie odświeża nigdy,
   bo pomija je, zanim sięgnie do kolejki.

NULL, pusty napis i same spacje odpadają już w skanie. Nie powstaje z nich pozycja, a `uzycie`
z pustą wartością zwraca 400. Nie da się ich zaakceptować.

**Poza A/B/C: C liczy wiersze DOPASOWANE, nie ZMIENIONE.** `changes` w SQLite liczy każdy wiersz
trafiony przez `WHERE`, także gdy nowa wartość jest taka sama jak stara. Alias na samą siebie
(pozycja podpowiadająca siebie ze 100%, backlog #40) albo zapis edycji bez zmiany napisu daje
ostrzeżenie „w N produktach" i toast „Zaktualizowano produktów: N", a realnie zmienia się 0 wierszy.
Danych to nie psuje. UI podsuwa taką sugestię jako pierwszą (`PanelPending.tsx:311-316`).

## Pomiar na kopii `db/snapshot.db`

Skrypt: `pomiar-niezmiennika.ts`. Wynik z przykładami: `pomiar-wynik.json`. Kopia w katalogu
tymczasowym po migracjach 001–006, każda akcja w transakcji wycofywanej. Oryginału nie
stawialiśmy, bo `pending_module.cjs` lokalnie się nie podnosi. Predykaty są 1:1 (tabela wyżej).
D = niezależne przeliczenie: ile wierszy po akcji ma nową wartość, a przed nią jej nie miało.

### Wariant „stan" — kolejka i słownik ze snapshotu (ekran, który Ania widzi)

Przed skanem w kolejce jest 498 pozycji. Skan dodał 2 nowe (`konstrukcja`) i nie zaktualizował
żadnej, bo **437 z 498 pozycji jest już w słowniku** i skan je pomija. W sumie 500 pozycji.

| rodzaj | pozycji | świeżych | A≠C | B≠C edycja | C≠D edycja | B≠C alias | C≠D alias | w tym alias na samą siebie |
|---|---|---|---|---|---|---|---|---|
| bieznik | 296 | 0 | 85 | 0 | 0 | 0 | 242 | 242 |
| rozmiar | 99 | 0 | 1 | 0 | 0 | 0 | 99 | 99 |
| marka | 68 | 0 | 33 | 0 | 0 | 0 | 68 | 68 |
| indeks_nosnosci | 27 | 0 | 0 | 0 | 0 | 0 | 27 | 27 |
| kategoria | 7 | 0 | 7 | 0 | 0 | 0 | 0 | 0 |
| konstrukcja | 3 | 2 | 0 | 0 | 0 | 0 | 1 | 1 |
| **razem** | **500** | **2** | **126** | **0** | **0** | **0** | **437** | **437** |

Kanoniczna dla aliasu to pierwsza sugestia UI, a gdy jej brak, pierwsza inna wartość słownika.
Wszystkie 500 pozycji miało sugestię.

- **B≠C: 0 z 1000** (500 × 2 akcje).
- **A≠C: 126, wszystkie na pozycjach nieświeżych**, 0 na świeżych. Przyczyny: 61 wartości
  zniknęło z katalogu po skanie (C = 0, np. `bieznik` „CONTI ECO 5": A = 9, B = C = 0; wszystkie
  7 pozycji `kategoria` pisanych małą literą, np. „rolnicze" A = 334; migracja 004 przepisała je na Wielką literę,
  tak jak produkcja skryptem `apply_kategoria.cjs`). U pozostałych 65 zmieniła się liczność (np. `marka` „ALLIANCE": A = 780, B = C = 848;
  `bieznik` „AGRI STAR II": A = 186, B = C = 188). MO6: 0, bo w snapshocie MO6 nie ma produktów.
- **C≠D: 437, wszystkie to alias na samą siebie.** Przykład: `bieznik` „AGRI STAR II" → „AGRI STAR
  II": C = 188, D = 0. Poza tym przypadkiem C == D.
- **Reszta po TRIM: 0.** W snapshocie żadna z 13 kolumn nie ma wartości ze spacją na brzegu.

Skąd pozycje „w słowniku": `origin = 'catalog'` 201 (bieznik 72, rozmiar 99, indeks_nosnosci 27,
marka 2, konstrukcja 1) i `origin = 'user'` 236 (bieznik 170, marka 66).

### Wariant „czysty" — pusta kolejka, słownik i odrzucone przed skanem

Skan wystawił 3648 pozycji z 11 rodzajów (`sezon` i `wentyl` nie mają wartości w snapshocie)
i nie zaktualizował żadnej, więc nie było kolizji po TRIM.

| rodzaj | pozycji | A≠C | B≠C | C≠D |
|---|---|---|---|---|
| bieznik | 1663 | 0 | 0 | 0 |
| rozmiar | 1119 | 0 | 0 | 0 |
| indeks_nosnosci | 665 | 0 | 0 | 0 |
| marka | 93 | 0 | 0 | 0 |
| indeks_predkosci | 71 | 0 | 0 | 0 |
| oznaczenie_bieznika | 13 | 0 | 0 | 0 |
| rodzaj | 13 | 0 | 0 | 0 |
| kategoria | 4 | 0 | 0 | 0 |
| konstrukcja | 3 | 0 | 0 | 0 |
| tl_tt | 2 | 0 | 0 | 0 |
| vfIf | 2 | 0 | 0 | 0 |
| **razem** | **3648** | **0** | **0** | **0** |

Niezmiennik pomocniczy A == C tuż po skanie trzyma się na całym katalogu produkcji. Rozjazdy
z punktów 1 i 2 (MO6, spacje) są w danych **uśpione, nie nieistniejące**. Obudzi je pierwszy
import MO6 albo pierwsza wartość ze spacją na brzegu.

## Werdykt i rekomendacja

- **Niezmiennik główny (B == C) nie jest złamany.** Ostrzeżenie w dialogu pokazuje liczbę, którą
  akcja przepisze. Nie ma rozjazdu, który wymagałby decyzji „naprawa 1:1 czy odstępstwo".
- **Alias na samą siebie** („N produktów" przy zerowej zmianie) to objaw #40, czyli materiał
  **karty P7.2**. Nie wynika z porównywania bez względu na wielkość liter (#42), tylko z tego,
  że skan nie czyści z kolejki pozycji obecnych w słowniku. **Ważne dla P7.2:** sama zmiana
  seedu `bieznik` z `products.model` na `products.bieznik` tego nie usunie. Seed dotyczy co
  najwyżej 72 pozycji `bieznik` z `origin = 'catalog'`. Pozostałe 365 zostaje: `bieznik` z
  `origin = 'user'` (170), `rozmiar` (99), `marka` (68), `indeks_nosnosci` (27) i `konstrukcja` (1).
  Żeby objaw zniknął, potrzebne jest
  „sprzątanie samego objawu", które backlog #40 wymienia jako osobną, mniejszą zmianę.
- **A (kolumna listy kolejki)** jest nieświeże u 126 z 500 pozycji. Ostrzeżenie pokazuje A tylko
  do czasu odpowiedzi `uzycie` (albo gdy `uzycie` padnie). Rekomendacja: bez naprawy w odbudowie.
  To zachowanie oryginału, a właściwe lekarstwo to samo sprzątanie kolejki co wyżej.

- **Instrukcja I7 §3.11 obiecuje nieprawdę** (`docs/instrukcja-testow-I7.md:206-208`): „liczba
  [w ostrzeżeniu] ma odpowiadać temu, co pokazuje kolumna *Wystąpień*". Dla 126 z 500 pozycji
  w snapshocie tak nie jest, także dla przykładu z samej instrukcji („AGRI STAR II": 186 w kolumnie,
  188 w ostrzeżeniu). Instrukcji nie ruszamy, to zadanie P7.4. Nota z liczbami jest w roadmapie,
  w bloku „Iteracja 7", pod „Wejście od P7.3".

## Changes

- **New:** `rebuild/backend/test/atrybuty.niezmiennik.test.ts` — 37 przypadków:
  - B == C == realna zmiana dla obu akcji × 13 rodzajów (26 przypadków),
  - brzegi predykatu: MO6, spacja na końcu obok wersji czystej, sama wersja ze spacją,
    wielkość liter, NULL / pusty / same spacje (5),
  - C = dopasowane, nie zmienione: alias na samą siebie, edycja na ten sam napis (2),
  - import między skanem a akcją: produkt dochodzi, produkt znika, ponowny skan wyrównuje A,
    pozycji ze słownika skan nie odświeża (4).
- **New:** `docs/tickets/75-CHORE-niezmiennik-atrybutow/pomiar-niezmiennika.ts` + `pomiar-wynik.json`.
- Zero zmian w `rebuild/backend/src/**`, `rebuild/frontend/src/**`, `contract/` i w istniejących
  testach atrybutów.

## Deviations from plan

Brak. Jedno doprecyzowanie w trakcie: test zakłada w `beforeEach` wszystkie 13 rodzajów w
`atrybuty_rodzaje` przez `POST /api/atrybuty/rodzaje`, żeby odtworzyć stan produkcji (patrz
Follow-up 2).

## Test results

- **Gate odbudowy (fixtures/kontrakt):** N/D. Ticket nie dotyka API ani kontraktu. Test woła
  istniejące trasy i sprawdza skutki w bazie. Kształt odpowiedzi pilnuje `atrybuty.gate.test.ts`.
- Nowy test: ✓ 37/37 (`npx vitest run test/atrybuty.niezmiennik.test.ts`).
- Bramki backendu: `npm run lint` ✓, `npm run typecheck` ✓, `npm run build` ✓,
  `npm test` ✓ 88 plików / 1377 testów.
- Zgodność z P7.1: test nie importuje map rodzaj→kolumna, nie sprawdza `audit_log`, pomija
  `model` / `zastosowanie` i nie edytuje istniejących plików testów. Powinien zostać zielony po
  merge'u P7.1. Weryfikacja na gałęzi P7.1 nie była możliwa, bo nie jest jeszcze wypchnięta.

## Breaking changes

Brak.

## Follow-up

1. **Po merge'u P7.1: dopisać `model` i `zastosowanie` do `RODZAJE`** w
   `atrybuty.niezmiennik.test.ts`. Dziś akceptacja odbija je 400 „Nieznany rodzaj" (#41).
   Uwaga: skan kolejki ich nie wykrywa, więc test musi dostać pozycję inną drogą albo poczekać,
   aż P7.1 rozszerzy mapę skanu.
2. **Świeża baza odbudowy zna tylko 6 z 15 rodzajów.** Seed `CORE_RODZAJE` (1:1 z oryginałem)
   zakłada `marka`, `kategoria`, `konstrukcja`, `vfIf`, `bieznik`, `rodzaj`. Produkcja (snapshot)
   ma w `atrybuty_rodzaje` wszystkie 15, bo pozostałe dołożono poza seedem. Na bazie
   postawionej od zera „Akceptuj z edycją" dla `sezon`, `tl_tt`, `oznaczenie_bieznika`, `wentyl`,
   `rozmiar`, `indeks_nosnosci` i `indeks_predkosci` kończy się **500**: `INSERT` do
   `atrybuty_wartosci` narusza FK na `atrybuty_rodzaje`, a transakcja wycofuje też UPDATE, więc
   danych nie psuje. Staging i produkcja stoją na snapshocie, więc dziś tego nie widać. Dotyczy
   to tylko nowej instalacji. Kandydat do backlogu (⬜ do decyzji).
3. **Uśpione rozjazdy A vs C (MO6, spacje na brzegu)** zostają zapisane w teście jako zachowanie.
   Jeśli kiedyś MO6 wróci do katalogu albo import przyniesie wartości ze spacją, kolumna listy
   kolejki zacznie kłamać. Ostrzeżenie w dialogu nie.

## Review fixes applied

- **BLOCKER (roadmapa niezaktualizowana):** wiersz P7.3 → ✅ z datą i ID. Pod tabelą „Iteracja 7"
  dopisane „Wejście od P7.3" z notami dla P7.1 (dopisać `model`/`zastosowanie`), P7.2 (seed usunie
  co najwyżej 72 z 437 pozycji „alias na samą siebie") i P7.4 (sprostowanie §3.11 instrukcji I7).
- **SHOULD-FIX (kolejność `GROUP BY`):** w teście „spacja na końcu" dopisany komentarz, że wynik
  `A: 1` zależy od kolejności grup bez `ORDER BY`, i co sprawdzać, gdyby test padł.

