# PR.3 — migracja polskich znaków w alertach (`B??d` → `Błąd`: 435 typów + 2219 treści)

> **Stan:** ✅ 2026-09-22 · `92-CHORE-migracja-typow-alertow`
> **Iteracja:** przegląd 12 widoków · **Wpisy backlogu:** — · **Zależy od:** —
> **Ticket:** `92-CHORE-migracja-typow-alertow`

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Naprawa w danych polskich liter zamienionych na „?” w tabeli `alerts`. Tickety 72 (P6.1) i 77
(P6.2) celowo tego nie ruszały — „dane naprawia PR.3”.

## Pliki (wyłączna własność)
`rebuild/schema/009_alerty_polskie_znaki.sql`, wiersz 009 w `rebuild/schema/README.md`, blok 009
w `rebuild/backend/test/db.migracje.test.ts`.

## Decyzje
- **Zakres `typ` + `opis`** (użytkownik 2026-09-22): karta mówiła tylko o typie, ale treść
  (`produkt?w`, `kluczowe/b??dy`) jest zepsuta w 2219 wierszach, a odbudowa pisze już
  „produktów”. Bez tego po cutoverze w tabeli współistniałyby dwie wersje.
- **Słownik tylko z kodu, który zapisuje alerty** (odbudowa + oryginał); dopasowanie dokładne
  (`=`, `instr` + `replace` pełnego fragmentu szablonu, ograniczone typem) — bez `GLOB`
  (tam `?` jest wildcardem) i bez `UPPER` (ASCII-only).
- **Numer `009`** — `007` (ticket 76) i `008` (ticket 77) zajęte.

## Dowiezione
Migracja `009_alerty_polskie_znaki.sql` (świadome odstępstwo od produkcji). Pomiar na kopii
`db/snapshot.db` (2562 alerty, 2026-06-30…08-13) — skan wszystkich kolumn tekstowych wszystkich
tabel; „?” w słowie jest WYŁĄCZNIE w `alerts`:

| Kolumna | Zepsute → poprawne | Wierszy |
|---|---|---|
| `typ` | `B??d pobierania` → `Błąd pobierania` | 339 |
| `typ` | `R?czny upload` → `Ręczny upload` | 92 |
| `typ` | `B??d HTTP` → `Błąd HTTP` | 4 |
| `opis` (Synchronizacja) | `produkt?w` → `produktów`, `kluczowe/b??dy` → `kluczowe/błędy` | 2127 |
| `opis` (Ręczny upload) | `produkt?w` → `produktów` (`kluczowe/bledy` bez ogonków to oryginał — zostaje) | 92 |

- **435 vs 339:** obie prawdziwe — 435 = wszystkie zepsute `typ`, 339 = tylko `B??d pobierania`.
- **Niejednoznaczne / bez dopasowania:** 0 — każdy „?” to jedna litera, jeden kandydat.
- **Przyczyna:** „?” wpisane na sztywno w literałach żywego bundla (`mirror/backend/index.cjs`;
  `deminified/backend-index.cjs:48060, :48091, :48103, :48269, :48270`) — nie kodowanie zapisu
  (nazwa dostawcy w tym samym `opis` ma poprawne ogonki). **Produkcja psuje każdy nowy alert aż
  do cutoveru; odbudowa pisze poprawnie** — 009 przy cutoverze naprawia stan z dnia przełączenia,
  potem problem nie wraca.
- **Grupowanie P6.1:** na snapshocie 19 grup przed i po — nic się nie scala, bo produkcja nie ma
  ani jednego poprawnego „Błąd…”; grupy zmieniają tylko nazwę. Scalenie wyłącznie w bazach
  deweloperskich, gdzie odbudowa zdążyła zapisać własne alerty.
- **Fixtures:** `GET_alerts.json` (z `produkt?w`) nietknięty; gate zasiewa go po migracjach.
- **Testy:** `db.migracje.test.ts` — naprawa, nietknięte (spoza słownika, legalne „?”, już
  poprawne, inny typ), idempotencja; pomiar na kopii snapshotu uruchamiany z
  `SNAPSHOT_DB=…/db/snapshot.db` (435 → 0, 2219 → 0, `total_changes` = 2654, drugi przebieg 0).

## Do koordynatora
- **`docs/cutover.md` wymaga dopisania `009`** (karta go nie zmienia). Runner stosuje ją sam
  (`npm run migrate` bierze wszystkie `*.sql`, `copy-schema` kopiuje 9 plików), ale cutover.md
  omawia każdą migrację z nazwy: tabela w :17 wylicza „001–003, 004–006, 007” (brakuje już
  `008`), a krok z :259-274 opisuje 004–008. Do dopisania: 009 **NIE jest no-opem** — zmienia
  wszystkie alerty z „?” zapisane przez produkcję do dnia przełączenia (na snapshocie 435 `typ`
  + 2219 `opis`, na żywej bazie więcej). Proponowany punkt kontrolny po migracji:
  `sqlite3 data.db "SELECT count(*) FROM alerts WHERE instr(typ,'?')>0 OR instr(opis,'produkt?w')>0;"` → **0**.
- **Liczba w notatce dla Ani** (`docs/pytania-do-ani-2026-09-18.md`, sekcja 12: „339 alertów”)
  zaniża zakres — zepsutych było 435 typów i 2219 treści. Nie poprawiam cudzego dokumentu.
