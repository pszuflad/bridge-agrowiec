# PR.5 — duplikat marki `ALLIANCE` / `Alliance`

> **Stan:** ✅ 2026-09-22 · 101-CHORE-migracja-marka-caps
> **Iteracja:** przegląd 12 widoków · **Wpisy backlogu:** #92 (łącznie z #42) · **Zależy od:** —
> **Ticket:** `docs/tickets/101-CHORE-migracja-marka-caps/`

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Duplikat marki `ALLIANCE` / `Alliance`: rozwiązanie po stronie danych (#92, decyzja niżej).

## Pliki (wyłączna własność)
`rebuild/schema/010_marka_caps.sql`, wiersz 010 w `rebuild/schema/README.md`, blok 010
w `rebuild/backend/test/db.migracje.test.ts`.

## Decyzje
- **#92 = (A) DANE — migracja** (użytkownik, 2026-09-22). Odrzucone (B) — scalanie w filtrze
  katalogu, bo duplikat zostałby w eksportach, regułach cen i słowniku. Poprawka nie wraca przy
  imporcie: adapter od 2026-09-01 robi `toUpperPL(marka)`.
- Klucz porównania zna polskie litery (`ąćęłńóśźż` przez `replace()` przed ASCII-only `UPPER()`);
  inne litery spoza ASCII nie są sprowadzane — ograniczenie opisane w pliku 010 i pilnowane testem.
- `historia_cen.marka` celowo nietknięta (dziennik stanu w chwili rejestracji).

## Dowiezione
- Migracja `010_marka_caps.sql`, predykat OGÓLNY: marka, która ma w `products` drugą formę
  różniącą się wyłącznie wielkością liter, przechodzi na formę WIELKIMI; ze słownika `marka`
  znika forma niekanoniczna, jeśli kanoniczna w nim jest. Idempotentna treściowo.
- Na `db/snapshot.db` (test `SNAPSHOT_DB=…`): 848 + 1 → 849 × `ALLIANCE`, słownik bez `Alliance`,
  `total_changes()` = 2, poza tym nic; drugi przebieg 0; zero par case-only (licząc w JS, Unicode).
- Pomiar pozostałych miejsc (nic do zmiany):
  - `manual_overrides.marka` ma same formy WIELKIE;
  - wiersz stagingu 711428 (`MO1_71970103`) kasuje już **006**, bo oba segmenty `powod` (`nazwa` i `marka`) są case-only.
- Odstępstwo od założenia karty: brak — migracja 010 zgodnie z planem.

## Do koordynatora
- **`docs/cutover.md`** wymaga dopisania migracji `010_marka_caps.sql`: przy cutoverze zmienia
  dane produkcji (1 produkt + 1 wpis słownika na stanie snapshotu; świadome odstępstwo #92).
- Poza zakresem, do rozważenia jako osobne wpisy:
  - śmieci w polu marki (`21x7.00-15`, `18x8.50-8`, rozmiar zamiast marki);
  - 4 pary case-only w słowniku `bieznik` (`FLOTATION T422`, `LOGGER KING TRS-2`, `MAGLIFT LIP`, `MG121 PROWADZĄCA`);
  - mieszane formy w `historia_cen.marka` (953 × `Alliance`). Mają znaczenie dopiero, gdy grupowanie po marce w historii cen dostanie UI.
- Wejście dla PR.6: `docs/karty/PR.6/wejscie-101.md`.
