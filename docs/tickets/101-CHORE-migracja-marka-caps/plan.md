# 101-CHORE-migracja-marka-caps — duplikat marki `ALLIANCE` / `Alliance` (karta PR.5, backlog #92)

> Status: Approved (decyzja #92 = A, 2026-09-22; użytkownik: „continue")
> Branch: `chore/101-migracja-marka-caps`
> Worktree: `.worktrees/101-CHORE-migracja-marka-caps`

## Ticket description
PR.5 — Przegląd 12 widoków: duplikat marki `ALLIANCE` / `Alliance` (#92) — poprawka danych migracją.
Predykat ogólny (każda marka różniąca się od innej wyłącznie wielkością liter → forma WIELKIMI),
słownik marek bez formy niekanonicznej, migracja idempotentna, test na kopii snapshotu.

## Context — pomiar na `db/snapshot.db` (2026-09-22, zweryfikowany)
- `products.marka`: `ALLIANCE` 848 (MO1 266, MO2 461, MO3 120, MO5 1), `Alliance` 1 — `MO1_71970103`
  „6.50-16 Alliance FARM PRO 303 6PR TT". Porównanie Unicode-aware w JS (`toLocaleUpperCase('pl')`):
  innych par case-only w `products` brak. Jedyna marka z polskim znakiem: `STOMIL POZNAŃ` (bez pary).
- Słownik `atrybuty_wartosci` (rodzaj `marka`): `Alliance` (id 230761, origin `catalog`) i `ALLIANCE`
  (id 411058312, origin `user`). Poza zakresem karty: 4 pary case-only w rodzaju `bieznik`
  (`FLOTATION T422`/`Flotation T422`, `LOGGER KING TRS-2`/…, `MAGLIFT LIP`/…, `MG121 PROWADZĄCA`/`MG121 prowadząca`).
- `manual_overrides` pole `marka`: tylko formy WIELKIE (m.in. `ALLIANCE` dla MO6) — nic do zmiany.
- `staging_items` id 711428 (`zmiana_kluczowa`, `MO1_71970103`, powod „nazwa: … Alliance … → … ALLIANCE …
  • marka: Alliance → ALLIANCE"): KAŻDY segment case-only, więc kasuje go już **006** (zmierzone:
  po 006 na kopii snapshotu wiersza nie ma). 010 nie musi go ruszać.
- Inne kolumny z marką: `historia_cen.marka` (953 wierszy `Alliance` z 2026-06-30…07-21, 650 `ALLIANCE`)
  — dziennik stanu w chwili rejestracji, jedyny czytelnik grupujący po marce to
  `GET /api/analytics/market/group-prices` bez UI (decyzja D2). **Nie ruszamy** — przepisanie
  historii byłoby fałszowaniem zapisu; odnotowane. `history`, `audit_log`, `nazwa_pamiec`,
  `selly_*` — teksty historyczne/nazwy, poza zakresem.
- Źródło: adapter od 2026-09-01 daje `toUpperPL(marka)` — problem nie wraca przy imporcie.

## Kontrakt i fixtures (zakres)
Brak — migracja danych, nie dotyka kształtu API. Gate odbudowy N/D.

## Decisions
- **D1 (#92 = A, użytkownik 2026-09-22):** poprawka danych migracją, nie scalanie w filtrze.
- **D2 — klucz porównania świadomy polskich znaków.** SQLite `UPPER()` jest ASCII-only; klucz =
  `UPPER()` po zamianie 9 małych polskich liter (`ąćęłńóśźż`) na wielkie przez `replace()`.
  Forma docelowa = klucz (WIELKIE litery, także polskie). Ograniczenie: inne litery spoza ASCII
  (np. `é`, `ü`) nie są sprowadzane — takie pary migracja pominie; test na snapshocie liczy pary
  w JS (Unicode) i żąda zera po migracji.
- **D3 — słownik:** kasujemy wpis `marka` w formie ≠ klucz, gdy forma = klucz już istnieje. Gdy
  formy kanonicznej w słowniku nie ma — nie ruszamy (nie ma tego na snapshocie).
- **D4 — `historia_cen` bez zmian** (wyżej). **Świadome odstępstwo od produkcji:** produkcja ma ten
  duplikat; migracja go usuwa (decyzja D1).

## Implementation plan
1. `rebuild/schema/010_marka_caps.sql`: tymczasowa tabela klucz dla wartości z `products.marka`
   i słownika `marka`; `UPDATE products` dla marek z grupy klucza o >1 formie i formie ≠ klucz;
   `DELETE` słownika; `DROP` tabeli tymczasowej. Idempotentna treściowo.
2. `rebuild/schema/README.md` — wiersz 010.
3. `test/db.migracje.test.ts` — lista MIGRACJE, blok 010: ogólny predykat, grupa bez formy WIELKIEJ,
   polski znak, brak pary = nietknięte, słownik, idempotencja; `SNAPSHOT_DB`: 848+1 → 849, słownik
   bez `Alliance`, `total_changes()` = 2, zero par Unicode po migracji.

## Testing strategy
Testy na bazie z migracji + opcjonalny na kopii snapshotu (`SNAPSHOT_DB=…`). Bramki backendu.

## Out of scope
Śmieci w polu marki (`21x7.00-15`, `18x8.50-8`), pary case-only w słowniku `bieznik`, `historia_cen`,
`docs/cutover.md` (do koordynatora), frontend.

## Definition of done
- [ ] 010 na snapshocie: 849 × `ALLIANCE`, 0 × `Alliance`, słownik bez `Alliance`, nic innego
- [ ] drugi przebieg = 0 zmian
- [ ] lint/typecheck/build/test zielone
