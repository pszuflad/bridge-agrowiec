# 141-DOCS-runda-decyzyjna-backlog — runda decyzyjna backlogu (karta DEC.1)

> Status: Implemented
> Branch: `docs/141-runda-decyzyjna-backlog`
> Worktree: `.worktrees/141-DOCS-runda-decyzyjna-backlog`

## Opis ticketa
Karta DEC.1 — runda decyzyjna. Przejść wpis po wpisie przez wszystko, co
`tools/stan-backlogu.sh --do-decyzji` pokazuje jako ⬜, ustalić stan faktyczny w kodzie
na `develop` (każde twierdzenie poparte plikiem:linią albo pomiarem), napisać rekomendację
z kosztem, zebrać decyzję użytkownika i zapisać ją w polach `Do nowej wersji?` / `Status`.
**Bez implementacji napraw** — decyzja „naprawiamy" daje propozycję karty w „Do koordynatora".

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
**Brak (nie dotyka kontraktu).** Ticket jest typu DOCS/decyzje i ma zadeklarowane ZERO zmian
w `rebuild/` i `contract/`. Nie zmienia żadnego zachowania API, więc GATE odbudowy nie
obowiązuje. Weryfikacja końcowa jest inna: `tools/stan-backlogu.sh --do-decyzji` ma pokazywać
wyłącznie to, co faktycznie czeka na Anię albo na świadomie odłożoną decyzję.

## Korekta zakresu wobec promptu
Prompt mówił o **jedenastu** wpisach (stan `ba4667d`). Na `develop` w chwili startu
(`ab30674`) narzędzie pokazuje **czternaście** — doszły `#137.1` i `#137.2` (ticket 137,
zmergowany po napisaniu promptu) oraz `#135.1`, który sam ma ⬜ i domyka się tą kartą.
Zgodnie z poleceniem („aktualną listę bierz zawsze z narzędzia") rundą objęte są wszystkie 14.

## Decisions
**Reguła nadrzędna (użytkownik, 2026-09-23):** wszystko, co da się zrobić po cutoverze —
robimy po cutoverze; priorytet to szybkie wdrożenie produkcyjne. Decyzje per wpis:
`docs/karty/DEC.1/karta.md` → „Decyzje".

## Implementation plan
1. Ustalić stan faktyczny każdego wpisu (researcherzy + weryfikacja własna) — ZROBIONE.
2. Przedstawić użytkownikowi jedną tabelę: wpis · o co chodzi · stan faktyczny dziś ·
   rekomendacja · koszt, pogrupowaną na „do zamknięcia od ręki" / „mała karta" /
   „po cutoverze" / „czeka na Anię".
3. Po decyzji: zmienić WYŁĄCZNIE linie `Do nowej wersji?` i `Status` w
   `docs/rebuild-backlog.md` oraz `docs/rebuild-backlog/wpis-135.md` i `wpis-137.md`,
   z datą i krótkim uzasadnieniem. Uwaga na parser `tools/stan-backlogu.sh`: funkcja
   `symbol()` bierze PIERWSZY pasujący znak w kolejności `⬜ ✅ ❌ 🕒`, więc linia
   zawierająca gdziekolwiek ⬜ nadal liczy się jako „do decyzji" (dotyczy #5).
4. Wypełnić `docs/karty/DEC.1/karta.md`: Stan, Stan faktyczny, Decyzje, Dowiezione,
   Do koordynatora (propozycje kart).
5. Zamknąć `#135.1` odsyłaczem do tej karty.

## Testing strategy
Brak testów kodu — ticket nie rusza kodu. Weryfikacja:
- `tools/stan-backlogu.sh --do-decyzji` — po zmianach zostaje wyłącznie to, co czeka na Anię
  albo zostało świadomie odłożone (🕒);
- `tools/stan-backlogu.sh` — całość parsuje się bez błędu, żaden wpis nie gubi pola;
- `git diff --stat` — potwierdzenie, że nie ruszono `rebuild/`, `contract/` ani roadmapy.

## Out of scope
- Implementacja jakiejkolwiek naprawy wynikającej z decyzji (idzie osobnym ticketem).
- `docs/rebuild-roadmap.md` (CLAUDE.md, reguła 0 — rusza ją wyłącznie koordynator).
- Przenumerowanie zduplikowanego `#103` (dwa różne wpisy o tym numerze) — to robota
  koordynatora, odnotowana w „Do koordynatora".
- Karty innych kart, `rebuild/**`, `contract/**`.

## Definition of done
- [x] Każdy wpis z listy narzędzia ma wypełnione `Do nowej wersji?` i `Status` z datą
- [x] `--do-decyzji` pokazuje wyłącznie wpisy czekające na Anię
- [x] `docs/karty/DEC.1/karta.md` opisuje STAN (nie zamiar), z dowodami plik:linia
- [x] `#135.1` zamknięty odsyłaczem do DEC.1
- [x] Zero zmian w `rebuild/` i `contract/`
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE`
