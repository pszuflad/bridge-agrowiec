# 162-DOCS-proces-po-cutoverze — audyt `/feature` i agentów na tryb po cutoverze

**Typ:** DOCS (koordynator). **Zero zmian w `rebuild/`, `contract/`, `mirror/`, `deminified/`.**

**Zlecenie użytkownika (2026-09-24):** „`/feature` został przygotowany pod odbudowę — a jeżeli
wykonamy cutover i stary system przestanie być używany, czy w tym feature i w agentach
(doc-checker, researcher, reviewer) coś będzie trzeba zmienić?" → po analizie: „Udokumentuj to,
zrób z tego ticket, wrzuć do planu w backlogu po cutover i oznacz jako priorytet — do zrobienia
w pierwszej kolejności."

## Ustalenia (co audyt wykazał)

Przeczytane w całości: `.claude/commands/feature.md` (617 linii), `.claude/commands/triaz-zmian.md`,
`.claude/agents/{researcher,reviewer,doc-checker}.md`, `docs/cutover.md`, `docs/rebuild-roadmap.md` §6b.

- **Zmienia się jedna rzecz, nie proces:** premisa „wierne odtworzenie 1:1". Szkielet
  (19 kroków, rezerwacja numeru, worktree, plan/raport/review, bramki, sync z `develop`,
  `push-i-pr.sh`, ruleset, hooki) zostaje bez zmian.
- **Sześć ognisk zmiany:** hierarchia źródeł prawdy (odwraca się), rola fixtures (wzorzec →
  baseline regresji), GATE (odbudowy → kontraktu zewnętrznego: Selly, dostawcy, FE↔BE),
  `/triaz-zmian` (umiera w całości), mechanika kart (zwija się), `CLAUDE.md` (dzieli się na
  „nasz kod" i „archeologia oryginału").
- **`reviewer` wymaga zmiany JEDNEJ linii** (`:49`), `doc-checker` — jednej sekcji (`:23-44`),
  mechanika obu zostaje nietknięta.
- Dwie rzeczy, które trzeba świadomie **ochronić przed przestrojeniem**: zasada „nie dopisuj
  akapitu na koniec współdzielonego pliku" (wynika z równoległych gałęzi, nie z odbudowy)
  i pułapki `CLAUDE.md` dotyczące naszego kodu (Drizzle, `mode: "boolean"`, `UPPER()`,
  `safeAll()`, MSW).

## Decisions

- **D1. Audyt idzie do nowego pliku `docs/po-cutoverze-proces.md`, nie do roadmapy.** Roadmapa
  ma trzymać **plan** (co, w jakiej kolejności), nie 160 linii instrukcji wykonawczej; §6b i tak
  już odsyła do dokumentów per temat (`cutover.md`, `cutover-runbook.md`).
- **D2. Priorytet zapisany w TRZECH miejscach, bo każde czyta ktoś inny:** roadmapa §6b Blok 2
  (`PO.0` jako pierwszy wiersz + akapit ⭐ + poprawiona rekomendacja kolejności) — czyta sesja
  planująca falę; `docs/rebuild-backlog/wpis-162.md` (`#162.1`, `Do nowej wersji? ✅ TAK`) — widzi
  `tools/stan-backlogu.sh`; `docs/cutover-runbook.md` Krok 13 — czyta człowiek w oknie.
- **D3. Ten ticket jest koordynatorem, więc wolno mu ruszyć roadmapę** (CLAUDE.md pkt 0:
  roadmapę zmienia sesja planująca falę). Sprawdzone przed edycją: `gh pr list --state open` = 0,
  `tools/stan-kart.sh` = wszystkie 31 kart ✅ — nie ma równoległej karty, której edycja mogłaby
  skolidować.
- **D4. `docs/karty/PO.0/karta.md` NIE jest zakładana.** Decyzja D5 ticketu 158: katalogi
  `docs/karty/PO.*` zakłada koordynator tuż przed wydaniem promptów fali, bo skład fali może się
  jeszcze zmienić (odpowiedzi Ani).
- **D5. Trzech decyzji nie podejmujemy tym ticketem, tylko je zapisujemy jako otwarte:**
  archiwizacja `mirror/`/`deminified/` (byłaby zmianą D9), przenagranie fixtures z nowego
  backendu, naprawa schematu flag `'Tak'`. Wszystkie trzy to decyzje użytkownika, a nie
  konsekwencje cutoveru.
- **D6. Nie wykonujemy przestrojenia teraz.** Dopóki chodzi stary Bridge i mogą powstawać karty
  odbudowy, `feature.md` musi mówić o wiernym odtwarzaniu. Warunek wstępny PO.0 zapisany
  w dokumencie i w runbooku.

## Zakres zmian

1. `docs/po-cutoverze-proces.md` (nowy) — audyt: kiedy wykonać, 5 ognisk zmiany z numerami linii,
   co NIE wymaga zmian, lista zadań, trzy decyzje, Definition of done.
2. `docs/rebuild-backlog/wpis-162.md` (nowy) — wpis `#162.1`.
3. `docs/rebuild-roadmap.md` §6b Blok 2 — wiersz `PO.0`, akapit priorytetowy, kolejność; Blok 5 —
   wskaźnik + adnotacja przy D9/`mirror/`.
4. `docs/cutover-runbook.md` Krok 13 — jedna pozycja listy kontrolnej.

## Out of scope

Samo przestrojenie `.claude/**` i `CLAUDE.md` (to jest karta PO.0, po cutoverze).

## Tests

Nie dotyczy — zmiana wyłącznie w `docs/`. Bramki `rebuild/backend/` nieuruchamiane: ticket nie
dotyka kodu ani kontraktu, więc nie ma czego sprawdzać (GATE N/D).

## Definition of done

- [ ] audyt w `docs/po-cutoverze-proces.md` z konkretnymi miejscami (plik + linia), nie ogólnikami
- [ ] wpis `#162.1` widoczny w `tools/stan-backlogu.sh 162`
- [ ] `PO.0` jest **pierwszym** wierszem tabeli Bloku 2 i rekomendacja kolejności to potwierdza
- [ ] runbook wskazuje PO.0 w Kroku 13 z zastrzeżeniem „nie wcześniej"
- [ ] nigdzie nie sugerujemy wykonania przestrojenia przed przełączeniem domeny
