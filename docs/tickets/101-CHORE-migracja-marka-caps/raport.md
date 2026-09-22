# 101-CHORE-migracja-marka-caps — Implementation report

## Summary
Migracja danych `010_marka_caps.sql` usuwa duplikat marki różniący się wyłącznie wielkością liter
(backlog #92, decyzja użytkownika 2026-09-22: droga A — dane). Na `db/snapshot.db`: `MO1_71970103`
`Alliance` → `ALLIANCE` (razem 849), ze słownika `marka` znika `Alliance`. Nic innego się nie zmienia.
Drugi przebieg daje 0 zmian.

## Changes
- **New:** `rebuild/schema/010_marka_caps.sql` — dwie instrukcje z CTE `klucz`:
  - `UPDATE products`: marka, której klucz ma w `products` więcej niż jedną formę, a forma ≠ klucz, dostaje klucz;
  - `DELETE atrybuty_wartosci` (rodzaj `marka`): forma ≠ klucz, gdy klucz jest w słowniku.
- `rebuild/schema/README.md` — wiersz 010 i dopiski w akapicie o migracjach danych.
- `rebuild/backend/test/db.migracje.test.ts` — 010 na liście `MIGRACJE`, nowy blok z 6 testami (jeden tylko przy `SNAPSHOT_DB`).

## Rozwiązanie problemu ASCII-only `UPPER()`
Klucz = `UPPER()` po `replace()` 9 małych polskich liter (`ąćęłńóśźż`) na wielkie. Skutki:
- `Stomil Poznań`, `STOMIL POZNAń` i `STOMIL POZNAŃ` trafiają do jednej grupy, a wynik ma `Ń`.
- **Ograniczenie:** innych liter spoza ASCII (`é`, `ü`) klucz nie sprowadza, więc para `Kléber`/`KLÉBER` zostaje nietknięta. Pilnuje tego test.
- Na snapshocie takich marek nie ma. Test na kopii snapshotu grupuje marki przez `toLocaleUpperCase('pl-PL')` (JS, Unicode) i żąda zera par po migracji.

To nie kłóci się z regułą z CLAUDE.md („nie poprawiaj na Unicode-aware bez sprawdzenia oryginału”): 010 nie odtwarza żadnej operacji produkcji. Jest świadomym odstępstwem, a karta wprost wymagała obsługi polskich znaków.

## Pomiar pozostałych miejsc z marką (snapshot)
| Miejsce | Stan | Co robi 010 |
|---|---|---|
| `manual_overrides` pole `marka` | tylko formy WIELKIE (w tym `ALLIANCE` dla MO6) | nic |
| `staging_items` id 711428 (`MO1_71970103`, `nazwa` + `marka` case-only) | usuwa go już **006** (każdy segment case-only), zmierzone na kopii | nic |
| `historia_cen.marka` | 953 × `Alliance` (2026-06-30…07-21), 650 × `ALLIANCE` | **celowo nic.** To dziennik stanu w chwili rejestracji. Czyta go `market/group-prices` bez UI (decyzja D2) |
| `history`, `audit_log`, `nazwa_pamiec`, `selly_*` | „Alliance” w tekstach historycznych i nazwach | poza zakresem |
| słownik `bieznik` | 4 pary case-only | poza zakresem (follow-up) |

## Deviations from plan
Plan zakładał tabelę `TEMP`. Wstawienia do niej liczą się w `total_changes()`, a test na tej
funkcji dowodzi, że poza produktami i słownikiem nic się nie zmieniło. Zastąpiłem więc tabelę
CTE powtórzonym w obu instrukcjach. Wynik bez zmian.

## Test results
- **Gate odbudowy (fixtures/kontrakt):** N/D — migracja danych, nie zmienia kształtu API.
- Migracje: `db.migracje.test.ts` 22/22 (z `SNAPSHOT_DB=db/snapshot.db`). Liczby na snapshocie:
  - 848 + 1 → 849;
  - `total_changes()` = 2 (1 produkt i 1 wpis słownika);
  - produkty porównane wiersz po wierszu;
  - drugi przebieg daje 0.
- Pełne bramki `rebuild/backend`: lint ✓, typecheck ✓, build ✓ (copy-schema: 10 plików), test 1516 passed / 2 skipped.

## Breaking changes
Brak. Przy cutoverze `npm run migrate` zmieni dane produkcji (1 produkt i 1 wpis słownika na
stanie snapshotu). Trzeba to dopisać w `docs/cutover.md` (zlecone koordynatorowi).

## Follow-up
- Śmieci w polu marki: `21x7.00-15`, `18x8.50-8` (rozmiar zamiast marki). Poza zakresem.
- 4 pary case-only w słowniku `bieznik`: `FLOTATION T422`, `LOGGER KING TRS-2`, `MAGLIFT LIP`, `MG121 PROWADZĄCA`.
- `historia_cen.marka` ma formy mieszane. Ma to znaczenie tylko wtedy, gdy grupowanie po marce w historii cen dostanie UI.

## Review fixes applied
- SHOULD-FIX: w `010_marka_caps.sql` dopisany komentarz, dlaczego instrukcje mogą czytać zmienianą przez siebie tabelę: podzapytanie `IN` jest nieskorelowane i liczone raz. Jest tam też ostrzeżenie przed skopiowaniem wzorca z podzapytaniem skorelowanym.
- NICE-TO-HAVE: odhaczone DoD w `plan.md`. Powielony łańcuch `replace()` zostaje, jest opisany w pliku.

## Docs updates
- `docs/karty/PR.5/karta.md` — stan ✅, „Decyzje”, „Dowiezione”, „Do koordynatora” (`docs/cutover.md`, follow-upy).
- `docs/rebuild-backlog.md` #92 — ✅ TAK (dane), status zrealizowane, akapit „Rozstrzygnięte”.
- **New:** `docs/karty/PR.6/wejscie-101.md` — pozycja do przeglądu §3 i pułapka „baza bez migracji”.
- `rebuild/schema/README.md` — wiersz 010.
- Roadmapa, `docs/cutover.md`, `docs/przeglad-12-widokow.md` — nietknięte (reguła 0 / zakres karty).
