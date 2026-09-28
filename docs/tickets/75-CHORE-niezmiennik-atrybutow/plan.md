# 75-CHORE-niezmiennik-atrybutow — P7.3: test niezmiennika „liczba w ostrzeżeniu = liczba realnie przepisanych produktów"

> Status: Implemented
> Branch: `chore/75-niezmiennik-atrybutow`
> Worktree: `.worktrees/75-CHORE-niezmiennik-atrybutow`

## Ticket description

Karta P7.3 z `docs/rebuild-roadmap.md` (blok „Poprawki po testach Ani", „Iteracja 7"). Typ CHORE,
czysto testowa: **zero zmian** w `rebuild/backend/src/**`, `rebuild/frontend/src/**` i `contract/`.
Instrukcja testów I7 wskazuje jako drugie najcenniejsze zgłoszenie „liczba produktów w ostrzeżeniu
nie zgadza się z tym, co realnie się zmieniło". Ania odpowiedziała na I7 ogólnie („działa dobrze"),
a nic w bramkach nie pilnuje, że liczba pokazana PRZED akcją „Akceptuj z edycją" / „Akceptuj jako
alias" równa się liczbie przepisanych wierszy PO akcji. Karta: pomiar na kopii snapshotu + nowy test
w bramce.

## Context

Trzy liczby dla pozycji kolejki (rodzaj, wartosc), zweryfikowane w kodzie:

| | Skąd | Predykat |
|---|---|---|
| **A** `ile_wystapien` | `skanujNoweWartosci` (`repos/atrybuty-pending.ts`), zapis w `atrybuty_wartosci_pending`; kolumna listy kolejki i fallback ostrzeżenia (`PanelPending.tsx:58`) | `GROUP BY <kol>` po SUROWEJ wartości, `WHERE <kol> IS NOT NULL AND TRIM(<kol>) != '' AND (dostawca IS NULL OR dostawca != 'MO6')`, potem `String(w).trim()` jako klucz pozycji |
| **B** `count` z `GET /api/atrybuty/uzycie` | `uzycieAtrybutu` (`repos/atrybuty.ts`), liczone na żywo przy otwarciu dialogu | `COUNT(*) WHERE <kol> = wartosc` |
| **C** `produktow_zaktualizowano` | `akceptujZEdycja` / `akceptujJakoAlias` — `changes` z `UPDATE` | `UPDATE products SET <kol> = nowa WHERE <kol> = stara` |

Wszystkie trzy predykaty są dosłowną kopią oryginału: `pending_module.cjs:84-93` (skan), `:289`
i `:331` (UPDATE), `atrybuty_module.cjs:296` (licznik użycia). Kolumny `products` są `TEXT` bez
`COLLATE` → porównanie binarne (wielkość liter ma znaczenie) wszędzie tak samo.

**B i C mają identyczny predykat** — niezmiennik główny B == C wynika z konstrukcji, o ile nic nie
zmieni katalogu między otwarciem dialogu a kliknięciem. Różnice predykatu **A vs C** są trzy:

1. **MO6** — skan pomija wiersze dostawcy MO6, UPDATE i `uzycie` nie. A < C o liczbę wierszy MO6.
2. **TRIM** — skan grupuje po surowej wartości, a klucz pozycji przycina. „X " i „X" to dwie grupy
   z tym samym kluczem „X": druga nadpisuje `ile_wystapien` pierwszej. UPDATE szuka dokładnie „X",
   więc wiersze „X " zostają nietknięte, a wartość wraca do kolejki przy kolejnym skanie.
3. **Migawka** — A jest z chwili skanu; każda zmiana katalogu po skanie ją rozjeżdża. Pozycje już
   obecne w słowniku skan POMIJA, więc ich A nie odświeża się nigdy.

Dodatkowo C to liczba wierszy DOPASOWANYCH, nie ZMIENIONYCH: przy aliasie na samą siebie (pozycja
podpowiadająca siebie ze 100%, #40) albo edycji bez zmiany napisu C = n przy zerowej realnej zmianie.

Pomiar (szczegóły w `raport.md`): B == C w 100% z 4148 pomiarów, A == C na wszystkich 3648 świeżych
pozycjach; rozjazdy A≠C wyłącznie na nieświeżych pozycjach, „C ≠ realna zmiana" wyłącznie przy
aliasie na samą siebie (437 z 500 pozycji kolejki w snapshocie może to wywołać).

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Brak — ticket nie dotyka kontraktu ani kodu produkcyjnego. Test woła istniejące trasy
(`POST /api/atrybuty/scan-pending`, `GET /api/atrybuty/pending`, `GET /api/atrybuty/uzycie`,
`POST /api/atrybuty/pending/{id}/akceptuj-z-edycja`, `…/akceptuj-jako-alias`,
`POST /api/atrybuty/rodzaje`, `POST /api/atrybuty/wartosci`) i sprawdza skutki w bazie, nie kształt
odpowiedzi — kształt pilnuje `atrybuty.gate.test.ts`.

## Decisions

- **D1 — pomiar na odbudowie, nie na oryginale.** Moduł `pending_module.cjs` ma zahardkodowane
  ścieżki produkcyjne i lokalnie się nie podnosi (CLAUDE.md). Predykaty porównane z oryginałem linia
  w linię (sekcja Context), więc pomiar funkcji odbudowy na kopii snapshotu mierzy to samo.
- **D2 — dwa warianty pomiaru.** „stan" (kolejka i słownik ze snapshotu — ekran, który Ania widzi)
  oraz „czysty" (pusta kolejka, słownik i odrzucone przed skanem — każda z 3648 wartości 13 kolumn
  dostaje świeże A). Sam „stan" nic nie mówi o predykacie skanu: 498 z 500 pozycji jest nieświeżych.
- **D3 — snapshotu nie czytamy w bramce.** `db/snapshot.db` jest w `.gitignore`; wzorzec
  `historia.wyrocznia.test.ts` / `promocja-warunek-obniza-cene.test.ts` to zamrożenie WERDYKTU
  pomiaru w teście na danych kontrolowanych. Skrypt pomiarowy zostaje w katalogu ticketa
  (`pomiar-niezmiennika.ts`) razem z wynikiem (`pomiar-wynik.json`).
- **D4 — rozjazdy A vs C i „dopasowane ≠ zmienione" są testami DOKUMENTUJĄCYMI.** To zachowanie
  1:1 z oryginałem; karta jest pomiarowa, nie naprawia. Niezmiennik główny B == C się trzyma, więc
  nie ma rozjazdu wymagającego decyzji „naprawa 1:1 czy odstępstwo".
- **D5 — podział z P7.1 (ticket 74).** Nowy plik, zero edycji istniejących testów atrybutów, zero
  importu map rodzaj→kolumna z repozytoriów (test ma własną jawną listę 13 rodzajów), wszystko przez
  HTTP, żadnych asercji o `audit_log`. `model` i `zastosowanie` pominięte (dziś 400 „Nieznany
  rodzaj") — follow-up po merge'u P7.1.
- **D6 — podział z P7.2.** Alias na samą siebie to objaw #40 (P7.2). Test zapisuje dzisiejsze
  zachowanie i mówi w komentarzu, co ma się stać, gdy P7.2 usunie takie pozycje z kolejki.

Odstępstw od oryginału: **brak** (karta nie zmienia kodu produkcyjnego).

## Implementation plan

1. `docs/tickets/75-…/pomiar-niezmiennika.ts` — skrypt pomiarowy (tsx, funkcje odbudowy na kopii
   snapshotu w katalogu tymczasowym po migracjach 001–006, każda akcja w transakcji wycofywanej).
   Wynik do `pomiar-wynik.json`.
2. `rebuild/backend/test/atrybuty.niezmiennik.test.ts` — nowy plik:
   - niezmiennik B == C == realna zmiana dla obu akcji × 13 rodzajów (`it.each`),
   - brzegi predykatu: MO6, spacja na końcu (dwie grupy i sama wersja ze spacją), wielkość liter,
     NULL / pusty napis / same spacje,
   - „dopasowane ≠ zmienione": alias na samą siebie, edycja na ten sam napis,
   - import między skanem a akcją: produkt dochodzi / znika → A stoi, B == C; ponowny skan
     wyrównuje A.
3. `raport.md` z tabelą pomiaru, roadmapa (wiersz P7.3 + nota do P7.4 i P7.2).

## Testing strategy

Test integracyjny na prawdziwej bazie SQLite w katalogu tymczasowym (harness `stworzSrodowiskoTestowe`),
bez mocków. Każda asercja porównuje liczbę z trasy z niezależnym przeliczeniem w SQL na tej samej
bazie. Bramki: `npm run lint`, `typecheck`, `build`, `test` w `rebuild/backend/`.

## Out of scope

- Jakakolwiek naprawa kodu produkcyjnego (także rozjazdów A vs C).
- Rodzaje `model` / `zastosowanie` (P7.1).
- Frontend — ostrzeżenie w dialogu czyta B, a jego testy chodzą na atrapach; zachowanie trasy
  jest tym, co tu pilnujemy.
- `docs/instrukcja-testow-I7.md` (P7.4).

## Definition of done

- [x] Pomiar na kopii snapshotu, tabela per rodzaj w `raport.md`.
- [x] `atrybuty.niezmiennik.test.ts` zielony; zero zmian w `src/`, `contract/`, istniejących testach.
- [x] Bramki backendu zielone.
- [x] Roadmapa: P7.3 zrobione; noty dla P7.4 i P7.2 w ich wierszach.
