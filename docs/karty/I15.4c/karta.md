# I15.4c — akceptacja: cztery blokady, trasy review/resolve, decyzje o nieobecnych kartach

> **Stan:** ⬜ po I15.4a (ścieżka ODCZYTU I DECYZJI; równolegle z I15.4b)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #99, #103, #104, #105, #106, #107 (wg zakresu) · **Zależy od:** I15.4a (tabele)
> **Ticket:** —

Założona przez koordynatora ticketem `123-DOCS-podzial-i15-4`, 2026-09-23 — **podział dawnej karty I15.4** (665 linii
`staging_policy.cjs`, 5 nowych tabel, podmiana rdzenia importu to za dużo na jeden przegląd; decyzja użytkownika 23.09).
Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”. Materiał wspólny: wejścia w katalogach kart.

## Zakres
Druga połowa `staging_policy` — **ścieżka odczytu i decyzji użytkownika**:

- **`checkAcceptance` — cztery blokady 409, komunikaty DOSŁOWNIE** (#99): zgłoszenie zastąpione lub usunięte;
  zgłoszenie ze starego importu (brak `_policyVersion`) → „Odśwież cennik przed akceptacją”; nierozstrzygnięte
  dopasowanie → „Najpierw rozstrzygnij dopasowanie…”; błędny EAN (D4) → poprawa numeru przed akceptacją.
  Atomowa akceptacja; ochrona ręcznych poprawek bez osobnego błędu;
- **dodawanie i edycja zgłoszenia:** nowe zgłoszenie zastępuje poprzednie tej samej pary `(dostawca, kod)`;
  edycja przelicza status EAN (`eanRaw`, `eanIsValid`, `eanSourceStatus`);
- **trasy** `GET /api/staging/:id/review` i `POST /api/staging/:id/resolve` (`action`, `targetCode`) →
  `contract/openapi.yaml` + nagrania z oryginału;
- **decyzje o nieobecnych kartach (#106):** zapis do `staging_absence_decisions`, sprawa nie wraca przy kolejnym
  imporcie, a zmiana kodu, EAN lub DOT otwiera ją ponownie; porównanie starej karty z ofertą uwzględnia DOT
  (różne DOT nie tworzą zgłoszenia o scaleniu); wybór jednej karty przy naprawdę zgodnych (niewybrana zostaje
  wstrzymana, wybrana w katalogu, zapamiętany kod źródłowy);
- **#107 — wydajność:** zmierz zatwierdzanie zbiorcze na kopii produkcji (staging ma ją od 23.09). Produkcja
  naprawiała pięciosekundową blokadę przy zapisie uwagi o cenie, ale wynikała ona z osobnego połączenia do bazy
  w `uwaga_cena_patch.cjs`; u nas to jedno połączenie i kolumna modelu. **Zmierz i opisz — nie portuj mechanicznie.**

## Pliki (wyłączna własność)
Repozytoria i trasy stagingu (akceptacja, `review`, `resolve`), `contract/openapi.yaml` (dwie trasy),
testy akceptacji i tras. NIE: `import/tk.ts` (I15.4b), migracja i model (I15.4a), frontend (I15.5, I15.11).

## Decyzje
**Decyzje użytkownika (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na istniejące obiekty ·
D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2 przenosimy ·
D4 błędny EAN = błąd blokujący akceptację (zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
⭐ **Produkcja zamrożona — Ania skończyła 23.09 i czeka na nową wersję do testów. Źródło prawdy: `origin/main`
na commicie `88fa31c` (23.09 13:00).** Nowy commit z kodem na `main` = ZATRZYMAJ SIĘ i zgłoś użytkownikowi.


## Dowiezione
—

## Do koordynatora
—
