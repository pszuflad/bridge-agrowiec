# 78-FEATURE-seed-bieznikow-podobienstwo — Implementation report

## Summary

Kolejka atrybutów przestała podpowiadać pozycjom same siebie (#40). Pozycje, których wartość jest
już dosłownie w słowniku, są usuwane na końcu każdego skanu i przy starcie procesu po seedzie,
a reguła sugestii nigdy nie proponuje identycznego napisu. Seed słownika `bieznik` bierze wartości
z `products.bieznik` zamiast `products.model`. Podobieństwo aliasów liczone jest po normalizacji
wielkości liter i spacji (#42), więc „rolnicze” dostaje sugestię „Rolnicze” ze 100%. Na snapshocie
z 498 pozycji kolejki zostaje 61, a self-matchy jest 0 zamiast 437.

## Pomiar na kopii `db/snapshot.db`

Skrypt: `pomiar-kolejki.ts` (kod rebuildu po zmianie, wzór oryginału przepisany do porównania),
pełny wynik: `pomiar-wynik.json`.

### Słownik `bieznik` (pkt 1c, decyzja D3: zostawić)

| | liczba |
|---|---:|
| wartości w słowniku | 1665 |
| w `products.model` i w `products.bieznik` | 1660 |
| tylko w `products.bieznik` | 3 |
| **tylko w `products.model`** | **0** |
| w żadnej kolumnie (`AGRIMAX RT 851`, `RM 500 STBT`, `origin='catalog'`, 2026-07-10) | 2 |
| wartości obecne tylko w `products.model` (np. `MAGLIFT LIP 8.00`, `'REM8 '`), a w słowniku | 0 z 13 |
| produkty z `model ≠ bieznik` | 17 z 7405 |
| `audit_log`: `atrybut_wartosc_dodano` | 0 |

Zanieczyszczenia z `products.model` w słowniku nie ma, więc nie ma czego usuwać i migracja nie
weszła. Ręcznych dodań nie da się wyodrębnić. `origin='user'` to domyślna wartość kolumny, którą
dostają też wpisy z seedu i z akceptacji, a audyt dodań jest pusty.

### Kolejka (pkt 1b, decyzja D1: usuwać i nie podpowiadać)

| rodzaj | przed | w słowniku → znika | po starcie | po starcie i skanie |
|---|---:|---:|---:|---:|
| bieznik | 296 | 242 | 54 | 54 |
| rozmiar | 99 | 99 | 0 | 0 |
| marka | 68 | 68 | 0 | 0 |
| indeks_nosnosci | 27 | 27 | 0 | 0 |
| kategoria | 7 | 0 | 7 | 7 |
| konstrukcja | 1 | 1 | 0 | 2 |
| **razem** | **498** | **437** | **61** | **63** |

Liczba 500 z raportu P7.3 to stan po skanie, który dokłada 2 pozycje `konstrukcja`. Snapshot i
fixture mają 498. Seed po zmianie nic nie dosiał do słownika `bieznik`, bo wszystkie wartości
`products.bieznik` już tam są. Dosiał za to `kategoria` +2 i `vfIf` +3 z `CORE_WARTOSCI`
(stan zastany, niezwiązany z tym ticketem).

**Dlaczego sprzątanie, a nie tylko zmiana seedu.** Seed przy starcie wsypuje do słownika marki
i (teraz) bieżniki z `products`, a skan w oryginale nie usuwa pozycji, które trafiły do słownika
później. Seed z `products.bieznik` robi więc to samo co seed marek. Tylko 72 z 437 self-matchy
dotyczyło bieżnika z `origin='catalog'`, a reszta to marki, rozmiary i indeksy (P7.3).
Sprzątanie działa jak „Akceptuj”: wartość jest w słowniku, pozycja wychodzi z kolejki, a
`products` zostaje nietknięte.

**Świadoma konsekwencja.** Pozycje `marka` i `bieznik` żyją w kolejce do najbliższego restartu,
bo seed „akceptuje” wszystko, co jest w `products`. To semantyka seedu z produkcji, dotąd ukryta
pod self-matchem. Jeśli Ania chce, żeby nowe marki i bieżniki czekały na decyzję, trzeba zmienić
sam seed. To nowa decyzja, patrz Follow-up.

### Sugestie aliasów (#42)

| | przed (wzór oryginału) | po (start) |
|---|---:|---:|
| pozycji z co najmniej jedną sugestią | 443 | 17 |
| sugestii łącznie | 607 | 21 |
| self-matchy | 437 (na pierwszym miejscu) | 0 |
| nowych par (nie było ich w regule oryginału) | — | 13 |

Wszystkie 13 nowych par:
- `kategoria`: „rolnicze” → „Rolnicze” 100% (334 produkty), „ciężarowe” → „Ciężarowe” 100% (106),
  „leśne” → „Leśne” 100% (7), „przemyslowe” → „Przemysłowe” 91% (1)
- `bieznik`: „Conti CrossTrac 3” → „CONTI CROSSTRAC 3” 100%, „FARMAX R75” → „Farmax R75” 100%,
  „MG638 NAPĘD” → „MG638  napęd” 100%, „MG628 NAPĘD” → „MG638  napęd” 91%,
  „Conti EfficientPro 5” → „CONTI EFFICIENTPRO HD5” / „…HS5” 91%,
  „MAGLIFT LIP NIEBRUDZĄCA Quick 3/4/8” → „MAGLIFT LIP NIEBRUDZĄCA QUICK” 94%

**Ryzyko.** „Akceptuj jako alias” przepisuje produkty w całym katalogu. Po P7.1 zostaje z tego
ślad w Historii, ale cofnięcia nie ma. Nowe sugestie są w większości trafne, ale nie wszystkie.
Przykłady:
- „FARMAX R75” → „Farmax R75” i „MG638 NAPĘD” → „MG638  napęd” proponują formę kanoniczną
  **mniejszymi** literami. Słownik ma wartości niezgodne z konwencją WIELKICH liter, a przyjęcie
  aliasu przepisze produkty na tę formę.
- „MG628 NAPĘD” → „MG638  napęd” (91%) to prawdopodobnie inny bieżnik: różnica jednej cyfry.
- „Conti EfficientPro 5” → „…HD5” / „…HS5” to dwa różne warianty i oba dostają 91%.

Takie przypadki istniały też przed zmianą, np. „AGRI STAR II” → „AGRISTAR II” 92%. Normalizacja
nie tworzy nowego rodzaju ryzyka, tylko zwiększa liczbę kandydatów. Ania powinna o tym usłyszeć
w delcie instrukcji I7 (P7.4).

**ALLIANCE / Alliance (#92).** Słownik `marka` ma obie formy. Pozycja kolejki `ALLIANCE` jest
dosłownie w słowniku, więc znika przy sprzątaniu i **kolejka tej pary nie zaproponuje**. Gdyby
pozycja została, nowa reguła podpowiedziałaby `ALLIANCE → Alliance` ze 100%. Rozwiązanie
duplikatu w `products.marka` zostaje przy karcie PR.5.

## Changes

- `rebuild/backend/src/repos/atrybuty-pending.ts`:
  - nowe `normalizujDoPorownania()` (trim, `toLowerCase`, zwinięcie `\s+`).
  - `podobienstwo()` liczy na postaci znormalizowanej.
  - `czySugerowacAlias()` odrzuca napis identyczny z pozycją, a regułę `+` stosuje na postaci
    znormalizowanej. Próg 0,9 bez zmian, `levenshtein()` bez zmian.
  - nowe `usunZKolejkiObecneWSlowniku()`: `DELETE … WHERE EXISTS` z porównaniem BINARY.
  - `skanujNoweWartosci()` woła sprzątanie na końcu. Statystyki i kształt odpowiedzi bez zmian,
    liczba usuniętych trafia do `console.log`.
- `rebuild/backend/src/repos/atrybuty.ts`: seed `bieznik` z `SELECT DISTINCT bieznik`. Nadal
  `INSERT OR IGNORE`, więc tylko dosypuje. Komentarz opisuje odstępstwo.
- `rebuild/backend/src/app.ts`: po `zasiejSlownikAtrybutow` sprzątanie kolejki w tym samym
  `try/catch`. To plik spoza listy własności z promptu, zmiana minimalna i uzgodniona w planie.
  Sprzątanie nie siedzi w seedzie, bo `atrybuty-pending.ts` importuje `atrybuty.ts` i powstałby
  import cykliczny.
- Testy:
  - `atrybuty.podobienstwo.test.ts`: odwrócone przypadki z wielkością liter i self-matchem,
    z komentarzem „świadome odstępstwo, #42/#40, decyzja Ani 2026-09-21”. Nowe przypadki: `Ą`/`ą`
    i pełny polski alfabet, spacje, `+` po normalizacji, osobno self-match (false) i różnica
    wyłącznie wielkością liter (true, 100). Przypadki bez różnic wielkości liter bez zmian.
  - `atrybuty.pending.test.ts`: nowy blok „sprzątanie kolejki” z 4 testami (skan na dwóch
    rodzajach, dokładność `bkt` przy `BKT` z sugestią 100, lista bez self-matcha przed skanem,
    start procesu). Test „najwyżej 5 sugestii” opiera się teraz na wariancie wielkości liter,
    a self-match jest jawnie nieobecny.
  - `atrybuty.crud.test.ts`: odwrócony test źródła seedu (`bieznik`, nie `model`).
  - `atrybuty.niezmiennik.test.ts`: odwrócony jeden przypadek, „pozycji obecnej w słowniku skan
    nie odświeża”. Po decyzji użytkownika skan ją teraz usuwa. Asercja B == C == realna zmiana
    została we wszystkich pozostałych przypadkach nietknięta, w tym „alias na samą siebie”:
    wartość dodana do słownika bez skanu pomiędzy, więc pozycja jeszcze istnieje.
- **Nowe:** `docs/tickets/78-…/pomiar-kolejki.ts`, `pomiar-wynik.json`.

## Deviations from plan

- **`atrybuty.niezmiennik.test.ts` zmieniony, choć plan zakładał, że zostanie nietknięty.** Przypadek
  z `:542` zamrażał dokładnie ten stan, który usuwa D1. Zgodnie z promptem („jeśli go złamiesz, wróć
  z pytaniem”) zapytałem użytkownika. Decyzja: odwrócić. Niezmiennik ostrzeżenie = toast = realna
  zmiana trzyma się bez zmian.
- Liczby: plan podawał „437 z 500”, a w snapshocie jest 498. Plan i komentarz w kodzie poprawione.
- Przy okazji jeden martwy warunek: `podobienstwo()` nie ma już gałęzi `maxDlugosc === 0 → 1`,
  bo pusty napis (także same spacje po normalizacji) odpada wcześniej. Tak samo było w oryginale:
  gałąź była nieosiągalna.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne co do kształtu, rozjazd wartości świadomy (D2).
  `atrybuty.gate.test.ts` sprawdza 6 fixtures atrybutów, w tym `GET_atrybuty_pending.json`
  (kształtem), i przechodzi bez zmian w fixtures. Kształt `GET /api/atrybuty/pending` i
  `POST /api/atrybuty/scan-pending` się nie zmienił. Test kluczy odpowiedzi skanu jest w nowym
  bloku. Wartości `GET_atrybuty_pending.json` (5 self-matchy) to nagranie produkcji sprzed
  odstępstwa. Nie da się go przenagrać lokalnie, więc zostaje. Frontend i fixtures nietknięte,
  bramki FE nie były wymagane.
- Unit + integracja (prawdziwa baza, bez mocków): ✓ **88 plików / 1411 testów**.
  Domena atrybutów: 131.
- lint ✓, typecheck ✓, build ✓ (Node 20.20.2).
- E2E: nie dotyczy (backend).

## Breaking changes

Brak zmian kontraktu. Zmienia się zachowanie (świadome odstępstwa #40, #42):
- po wdrożeniu pierwszy start usunie z kolejki produkcyjnej ok. 437 pozycji (snapshot);
- `sugerowane_aliasy` nie zawiera już self-matchy, a zawiera pary różniące się wielkością liter
  lub spacjami;
- słownik `bieznik` dosypuje się z `products.bieznik`.

## Follow-up

- **P7.4, instrukcja I7:** §4 pkt 1 (self-match „AGRI STAR II”) i §4 pkt 2 („BKT”/„bkt” bez
  sugestii) przestają być prawdziwe. Do dopisania w delcie:
  - kolejka po wdrożeniu jest krótsza (61 zamiast 498);
  - marki i bieżniki z katalogu znikają z kolejki po restarcie;
  - nowe sugestie wielkością liter bywają w formie mniejszymi literami („Farmax R75”, „MG638  napęd”),
    więc przed „jako alias” warto sprawdzić, która forma jest kanoniczna;
  - sugestie 91% mogą łączyć różne produkty („MG628” → „MG638”).
- **Decyzja do rozważenia (nie w tym tickecie):** czy seed ma dalej „akceptować” przy każdym
  starcie wszystkie marki i bieżniki z `products`. To robi kolejkę tych rodzajów krótkotrwałą.
  Zmiana wymaga decyzji Ani.
- **Frontend, komentarz:** `rebuild/frontend/test/atrybuty.pending.test.tsx:118-129` opisuje
  self-match z fixture jako „⬜ do decyzji”. Test jest zielony, bo czyta fixture, ale komentarz
  jest nieaktualny.
- **Słownik z wartościami niezgodnymi z konwencją WIELKICH liter** („Farmax R75”, „MG638  napęd”,
  „Alliance”) to ten sam wątek co #92 (strona danych), do karty PR.5.
