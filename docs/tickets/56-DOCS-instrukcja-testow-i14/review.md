# 56-DOCS-instrukcja-testow-i14 — Code review

> Reviewed: 2026-09-18
> Branch: `docs/56-instrukcja-testow-i14`
> Diff: 5 plików, 5 commitów (base `origin/develop`)

## BLOCKER

Brak.

## SHOULD-FIX

Brak.

## NICE-TO-HAVE

- [ ] `docs/instrukcja-testow-I3.md:414-421` — sekcja „Czego jeszcze NIE MA" wewnątrz starego
  dokumentu (poza bannerem, więc świadomie nietknięta wg D3) nadal wymienia „Atrybuty | Iteracja 7"
  i „Widok Historia | Iteracja 5" bez przekreślenia, mimo że oba są ✅ w tablicy §4 roadmapy —
  drobna wewnętrzna niespójność starego dokumentu, ale banner na górze i tak każe czytelniczce
  ignorować rozbieżności i wierzyć I14 (rozdz. 11 poprawnie mówi „są dowiezione"). Nie wymaga
  akcji tej karty — tylko sygnał, gdyby ktoś kiedyś chciał doczyścić I3 dalej niż banner.
- [ ] `docs/instrukcja-testow-I14.md:100-107` — „Test wart zrobienia: plik MO1 wgrany przez kafel
  MO3" jest dobrym testem regresji wymuszenia, ale rozdział nie mówi wprost, co zrobić z takim
  plikiem po teście (czy usunąć z katalogu) — kosmetyczne, nie wpływa na wierność ani użyteczność.

## Plan compliance

### Done ✓
- `docs/instrukcja-testow-I14.md` (463 linie, 13 rozdziałów) opisuje STAN trzech ekranów
  (Wgrywanie ręczne, Staging, Karta dostawcy) zgodnie z kodem na `origin/develop` — każdy
  cytowany string i każda liczba zweryfikowane `grep`em wobec `rebuild/frontend/src/`
  (`Wgrywanie.tsx`, `DialogWgrywania.tsx`, `Dostawcy.tsx`, `Staging.tsx`, `staging/kolumny.ts`,
  `staging/KonfiguratorKolumn.tsx`) — bez żadnego rozbieżnego stringu czy liczby.
- WULSTBAND i NRO/CHO (rozdz. 6) opisane jako naprawione, z liczbami z pomiaru 13a zgodnymi
  1:1 z `docs/rebuild-backlog.md` #9/#10 (MO1 199, MO3 44, MO9 12; `odrzuconePrzezAdapter` 1→0).
- „Zapis naukowy" (rozdz. 8) opisany jako decyzja zatwierdzona 18.09, ale niewdrożona (#11,
  karta 14i jeszcze nieistniejąca) — zgodne z backlogiem.
- Status dostawcy (rozdz. 7) zostaje jako dziwactwo, z tabelą logiki 1:1 zweryfikowaną wobec
  `rebuild/backend/src/repos/suppliers.ts:75-92`, i notą o prośbie Ani + backlog #18.
- Rozdział 11 „Czego jeszcze NIE MA" zweryfikowany wobec tablicy §4 roadmapy (wszystkie pozycje
  4-13 ✅, 13d ⛔ odłożone) — bez fałszywych twierdzeń.
- Test rozstrzygający (rozdz. 9) obecny, tabela MO1–MO10 z jawnym statusem NIEWYKONANY.
- Backlog #9/#10 nietknięty — potwierdzone `git diff --name-only`.
- Wszystkie odsyłacze do sekcji I3 (§2, §3.1, §3.2, §3.10–§3.13, §4 pkt 4, §4 pkt 11, §5, §6)
  istnieją w `docs/instrukcja-testow-I3.md` i mówią to, co I14 im przypisuje — brak przypadku
  „§9.1/§9.3, których nie ma" z historii projektu.
- Roadmapa: podblok 14d przepisany na STAN (data, ID ticketa, faktyczny zakres), wiersz 14
  w §4 ⬜→🔨 z rozliczeniem fali 1 i wskazaniem otwartej fali 2.
- `docs/instrukcja-testow-I4.md` i `docs/rebuild-backlog.md` nietknięte, zgodnie z D5/D7 —
  potwierdzone listą zmienionych plików.

### Missing or deviating ✗
Brak — realizacja pokrywa plan w całości, łącznie z trzema świadomie udokumentowanymi
odstępstwami w raporcie (numeracja rozdziałów z nieistniejącej wersji dokumentu, backlog #9/#10
już zamknięty, sprostowanie przypisania zadania z podbloku 14e) — wszystkie uzasadnione i opisane.

### Definicja ukończenia
- [x] `docs/instrukcja-testow-I14.md` istnieje i opisuje STAN zgodny z kodem — zweryfikowane
- [x] WULSTBAND i `nro`/`cho` opisane jako naprawione, z liczbami z pomiaru 13a
- [x] „zapis naukowy" opisany jako zmiana zatwierdzona, niewdrożona
- [x] status dostawcy zostaje jako dziwactwo + nota o #18
- [x] rozdział „Czego jeszcze NIE MA" zawiera wyłącznie pozycje potwierdzone wobec §4
- [x] test rozstrzygający obecny i oznaczony NIEWYKONANY, z tabelą MO1–MO10
- [x] `docs/instrukcja-testow-I3.md` ma banner, poza nim nietknięta
- [x] roadmapa: podblok 14d opisuje STAN, wiersz 14 w §4 ma status 🔨
- [x] backlog #9/#10 nietknięte, rozbieżność odnotowana w raporcie
- [x] `docs/instrukcja-testow-I4.md` nietknięta, follow-up zapisany
- [x] `git diff --name-only origin/develop` zwraca wyłącznie pliki z listy własności karty

## Parallel-test concerns

Nie dotyczy — karta czysto dokumentacyjna, zero testów automatycznych, zero zmian w `rebuild/`.

## Overall assessment

Karta wykonana wzorowo pod kątem wierności — sprawdziłem osobno w kodzie każdy istotny string,
liczbę i regułę biznesową cytowaną w `instrukcja-testow-I14.md` (etykiety przycisków, liczba
przełączników 10/49, 3 domyślnie ukryte kolumny, kolejność 9 nagłówków, 11 presetów
częstotliwości, 8 członów toasta, logika statusu dostawcy, logika promocji z 14e) i nie
znalazłem ani jednego rozbieżnego twierdzenia. Karta poprawnie wykryła i udokumentowała trzy
realne rozjazdy między poleceniem karty a stanem repo (numeracja z nieistniejącej wersji
dokumentu, zamknięty backlog #9/#10, błędne przypisanie zadania w 14e) zamiast po cichu je
zignorować lub zmyślić treść. Jedyne uwagi to kosmetyczne NICE-TO-HAVE niezwiązane z zakresem
tej karty. Merge bez zastrzeżeń.
