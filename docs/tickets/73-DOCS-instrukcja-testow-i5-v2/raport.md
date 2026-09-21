# 73-DOCS-instrukcja-testow-i5-v2 — Implementation report

## Summary
Powstała delta `docs/instrukcja-testow-I5-v2.md` (karta P5.3), która domyka Iterację 5. Rozdział 1
potwierdza trzy rozstrzygnięcia Ani (#21 — nic się nie zmienia; §6 i §9 — nie musi powtarzać).
Rozdział 2 („Przy okazji”) opisuje P5.1 jako zabezpieczenie, którego dziś nie widać, a P5.2 jako
jeden scenariusz z gotowym linkiem. Rozdział 3 wymienia z cytatami każde zdanie pierwszej wersji,
które przestało być prawdą. Pierwsza wersja dostała banner, a roadmapa oznacza Iterację 5 jako zamkniętą.

## Changes
- **New:** `docs/instrukcja-testow-I5-v2.md`: delta dla Ani, 5 rozdziałów, jeden punkt do klikania (2.2).
- `docs/instrukcja-testow-I5.md`: banner „częściowo nieaktualne” z listą unieważnionych paragrafów.
  Reszta bez zmian (numery paragrafów wiążące).
- `docs/rebuild-roadmap.md`: wiersz P5.3 → ✅; tabela statusów i nagłówek bloku Iteracja 5 → zamknięta
  (P5.1–P5.3). Dwa skonsumowane „Wejścia dla P5.3” zastąpione rozliczeniem z ustaleniami na dalej.
  Wskaźnik w podbloku P5.1 zaktualizowany.
- **New:** `docs/tickets/73-DOCS-instrukcja-testow-i5-v2/` (`plan.md`, `raport.md`, `review.md`).

## Deviations from plan
- **Rozdział 3 wyszedł szerszy niż lista kandydatów z promptu.** Doszły §1, §3.2 (ramka „W praktyce”)
  i §5 („jedyna droga” do nowego wpisu), bo dziś nowy wpis dają trzy drogi (cennik, edycja w Katalogu,
  link ZIP). Doszły też §14 poz. 1 i 4. §3.3 i wiersz „ręczna edycja” z §12 są nieaktualne od 12a,
  nie od P5.x, więc trafiły do osobnej podsekcji 3.2.
- **Sprostowanie promptu (D2 planu):** ZIP nie jest „jedynym miejscem, w którym nowy Bridge pokaże
  więcej”. Po P5.1 nowy Bridge może też sięgać dalej wstecz niż stary. Instrukcja mówi o obu przypadkach,
  a ZIP opisuje jako jedyny nowy RODZAJ wpisu.
- **Scenariusz ZIP używa linku** (decyzja użytkownika D1), bo przycisku nie ma w żadnym z Bridge'ów.

## Test results
- **Gate odbudowy (fixtures/kontrakt):** N/D. Ticket DOCS, zero zmian w `rebuild/` i `contract/`.
- **Weryfikacja twierdzeń z kodem `develop` (`a793eeb`):**
  - wpis ZIP: `routes/export-shoper.ts:136-146` + `historia/mapowanie.ts::naWpisHistorii` +
    `TabelaHistorii.tsx:70-77`. Wynik: typ `eksport` (zielona odznaka, `:22-26`), dostawca „—”,
    Pozycji = liczba dostawców, „Format: csv Format: csv”, filtr „Eksporty” (`historia/dane.ts:51`);
  - link w przeglądarce: `requireAuth` czyta cookie `bridge_session`; cookie `SameSite=Lax` ustawiane
    przy logowaniu (`auth/cookie.ts`, `routes/auth.ts:56`); `/api` proxowane na stagingu
    (`deploy/staging/htaccess:12`); brak sesji daje 401 `{"error":"Nieautoryzowany"}`
    (`middleware/auth.ts:41`);
  - P5.1 na `db/snapshot.db`: 3873 wierszy, 270 widocznych (93,0% niewidocznych, `auto_pull` 2869),
    remisów `kiedy` 0, eksportów 0; scheduler stagingu domyślnie wyłączony;
  - §6: test `rebuild/frontend/test/historia.test.tsx:128` („zmiana filtra cofa na pierwszą”);
  - §9: raport `59-CHORE-i14j` (0 różnic / 49 813 wpisów, wyrocznia w bramkach);
  - edycja w Katalogu: `MenuAkcji.tsx:65-69`, `DialogEdycjiProduktu.tsx:288-318`, `api.ts:68`,
    `routes/products.ts:270`.
- **Staging:** workflow „Deploy staging” dla `a793eeb` (merge #86) zakończony `success` 2026-09-21 14:28.

## Breaking changes
None.

## Follow-up
- **§8.1 pierwszej wersji jest nieścisły od początku.** Import wyświetla „Plik: x (Plik: x)”, a import
  z konsoli „Plik: — (Plik: ?)”, nie „Plik: x” / „Plik: ?”. Źródło: `uwagi` dublowane w
  `TabelaHistorii.tsx:62-68`, wierne `fe.js`. Nie wynika z P5.x, Ania tego nie reklamowała
  i poza zakresem delty.
- Faktycznej liczby wierszy `audit_log` w `data-nowy.db` na VPS nie da się ustalić z repo. Twierdzenie
  „na stagingu < 5000” opiera się na snapshocie (3873) i wyłączonym schedulerze.

## Review fixes applied
- NICE-TO-HAVE z review: DoD w `plan.md` odhaczone. BLOCKER-ów i SHOULD-FIX brak.

## Docs updates
- Bez doc-checkerów: prompt karty zawęził zakres plików do instrukcji v2, bannera w I5, roadmapy
  i folderu ticketa. Roadmapę zaktualizowano w commicie „roadmapa - P5.3 zrobiona, Iteracja 5
  zamknięta”. Backlog nie wymaga zmian, bo #87 i #93 zamknęły karty 69 i 70.
