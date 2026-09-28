# 80-DOCS-instrukcja-testow-i9-v2 — Implementation report

## Summary

Powstała delta instrukcji testów Iteracji 9 dla Ani (`docs/instrukcja-testow-I9-v2.md`) w układzie
„Zgłosiłaś → Jest teraz → Sprawdź”. Obejmuje dwa zgłoszenia z PDF-u (§3.11, §3.13), trzy decyzje
z rundy 2 (9.1–9.3), jedno pytanie z wariantami (progi palety) i rozliczenie wszystkich zdań
pierwszej wersji, które przestały być prawdą. Stara instrukcja dostała tylko banner. W roadmapie
P9.2 jest zrobiona, a Iteracja 9 zamknięta.

## Changes

- **New:** `docs/instrukcja-testow-I9-v2.md` — delta dla Ani (6 rozdziałów, 3 punkty do klikania,
  1 pytanie z wariantami).
- `docs/instrukcja-testow-I9.md` — banner „częściowo nieaktualne” z listą unieważnionych paragrafów,
  treść bez zmian.
- `docs/rebuild-roadmap.md`:
  - wiersz P9.2 ✅ i blok „P9.2 — dowieziony zakres” zamiast bloku „do napisania”;
  - wiersz iteracji 9 w §4: P9.2, iteracja zamknięta;
  - wiersz „Progi kalkulatora paletowego” w tabeli „Po stronie użytkownika — decyzje, które
    zostały” (⬜ po stronie Ani);
  - dopisek przy „Po jej stronie nie ma już ani jednej otwartej sprawy”;
  - fakt o ramce mocniejszego okna (niżej) zapisany dla koordynatora.
- **New:** `docs/tickets/80-DOCS-instrukcja-testow-i9-v2/{plan,raport,review}.md`.

## Deviations from plan

- Start karty został wstrzymany: P9.1 (ticket 76) nie zrobiła mocniejszego okna dla wybranego
  przewoźnika, o które Ania prosiła w §3.11. Użytkownik zlecił kartę P9.1b (ticket 84, PR #97).
  Delta powstała po jej merge'u.
- Znalezisko przy pisaniu: ramka mocniejszego okna mówi „…i przeliczy wynik jego dzielnikiem”,
  a wynik na ekranie przelicza się dopiero po „Oblicz”. Decyzja użytkownika z 2026-09-21:
  instrukcja uprzedza Anię (ramka ⚠ w §2.1 i pozycja 1 w „Jak zgłosić”), a tekst ramki poprawi
  przyszła karta.
- Ticket 80 jest kartą z okresu przejściowego `docs/karty/README.md` (worktree założony przed
  ticketem 82), więc kończy w roadmapie, nie w `docs/karty/`, zgodnie z README.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** N/D — ticket DOCS, nie dotyka `rebuild/` ani `contract/`.
- **Liczby kalkulatora paletowego:** sprawdzone prawdziwą funkcją `obliczWageGabarytowa`
  (`rebuild/backend/src/waga-gabarytowa/formula.ts`, uruchomioną przez `tsx`) na ustawieniach
  `waga_gab.*` odczytanych z kopii `db/snapshot.db`:
  - progi 55 / 80 / 10 / 0.000167;
  - 50×60×25 → `{"wagaGabarytowa":21.042,"szerokoscEfektywna":60,"wysokoscZPaleta":35,…}`;
  - 70×60×25 → 28.056 kg, szerokość 80 cm;
  - teksty `opis` zacytowane z wyniku.
- **Pozostałe liczby:**
  - przykład GLS 3000: 150 000 / 3000 = 50.00;
  - DPD 25.00 kg i GEIS 15.00 kg: z pierwszej wersji, wzór bez zmian.
- **Teksty UI:** cytowane znak w znak z `TabelaPrzewoznikow.tsx`, `WagaGabarytowa.tsx`
  i `KalkulatorPaletowy.tsx` na develop.

## Breaking changes

Brak.

## Warunek testowalności (dla użytkownika, nie dla Ani)

Na stagingu muszą działać tickety 76 i 84 oraz migracja `007_waga_gab_przewoznicy.sql` z seedem
sześciu przewoźników. Deploy stagingu idzie automatycznie po merge'u do `develop`, jeśli zmiana
dotyka `rebuild/**` (`.github/workflows/deploy-staging.yml`), a `deploy-staging.sh` uruchamia
`npm run migrate`. Nie weryfikowane na żywym serwerze.

## Follow-up

- **Tekst ramki mocniejszego okna** (`TabelaPrzewoznikow.tsx`, `text-ostrzezenie-wybrany`): „…i przeliczy wynik jego dzielnikiem” obiecuje
  przeliczenie, którego nie ma. Mała karta frontendowa: zmiana tekstu (np. „Kliknij „Oblicz”, żeby
  przeliczyć wynik”) albo faktyczne przeliczenie. Po niej wykreślić ramkę ⚠ z §2.1 I9-v2.
- **Odpowiedź Ani o progi palety** (I9-v2 §3.2) → przy „tak” nic; przy „do zmiany” zmiana
  ustawień `waga_gab.*`, a stała 60 cm to zmiana kodu (`formula.ts`), czyli świadome odstępstwo
  od produkcji.
- Z ticketu 84: wybór przenosi się przed odpowiedzią serwera (niespójność z „Przywróć domyślne”) —
  bez zmian, dalej do decyzji.

## Review fixes applied

Runda 1: 0 BLOCKER, 0 SHOULD-FIX, 3 NICE-TO-HAVE. Poprawione dwa:
- cytat okna „Przywróć domyślne” oddaje podział na dwie linijki, jak na ekranie;
- w podsumowaniu wiersz pytania o progi ma etykietę „3.2, pytanie”, żeby nie mylił się z oceną 3.2.

Trzeci (styl `⬜` w tabeli decyzji roadmapy) zostaje — znak stanu jest tam celowy, bo to jedyna
decyzja po stronie Ani, nie użytkownika.

## Docs updates

Mały ticket DOCS z zakresem plików narzuconym promptem, więc edycje zrobił Master bez
doc-checkerów. `docs/rebuild-roadmap.md` (P9.2 ✅, Iteracja 9 zamknięta, progi palety w tabeli
decyzji, fakt o ramce okna dla koordynatora), banner w `docs/instrukcja-testow-I9.md`.
`docs/rebuild-backlog.md` i `docs/karty/` celowo nietknięte (poza zakresem plików karty).
Pre-existing issues: brak.
