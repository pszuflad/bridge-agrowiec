# Przestrojenie procesu po cutoverze — audyt `/feature` i agentów

> **Utworzono:** 2026-09-24, ticket `162-DOCS-proces-po-cutoverze` (zlecenie użytkownika).
> **Karta:** `PO.0` w `docs/rebuild-roadmap.md` §6b, Blok 2 — **wchodzi jako pierwsza po
> przełączeniu domeny** (decyzja użytkownika 2026-09-24). Wpis backlogu: `#162.1`.
> **Ten dokument niczego nie zmienia** — jest wejściem dla sesji, która wykona kartę PO.0.

## 0. Kiedy to wykonać — i dlaczego NIE teraz

**Warunek wstępny: stare środowisko zatrzymane, domena przełączona** (`docs/cutover-runbook.md`).

Dopóki chodzi stary Bridge i dopóki mogą jeszcze powstawać karty odbudowy, `.claude/commands/feature.md`
**musi** mówić o wiernym odtwarzaniu — przestrojenie go wcześniej zepsułoby tickety w toku. Ryzyko
jest odwrotne i to ono uzasadnia priorytet: po cutoverze nikt o tym nie pomyśli i przez kolejne
miesiące każda sesja będzie czytać `deminified/` jako „ostateczne źródło prawdy", a `openapi.yaml`
jako „zamrożony kontrakt" — dla systemu, którego wzorzec już nie istnieje.

**Zakres: wyłącznie pliki procesu.** Zero zmian w `rebuild/`, `contract/`, `mirror/`, `deminified/`.

## 1. Co przestaje być prawdą

### 1.1. Hierarchia źródeł prawdy się odwraca

Dziś: `contract/fixtures/` > `openapi.yaml` > `docs/spec-*` > mapa kodu > `deminified/`, a kod
w `rebuild/` „może jeszcze nie istnieć". Po cutoverze prawdą jest **kod w `rebuild/` + testy**;
`deminified/` i `mirror/` stają się **archeologią** („skąd się wzięło to dziwne zachowanie"),
nie wzorcem do naśladowania.

| Miejsce | Co tam jest dziś |
|---|---|
| [`.claude/commands/feature.md:2`](../.claude/commands/feature.md) | `description:` mówi „Ticket odbudowy … wierne odtworzenie zachowania wg kontraktu/fixtures" |
| `feature.md:14-35` | cała sekcja „Kontekst odbudowy — WIERNE ODTWORZENIE, nie nowy feature" + lista źródeł prawdy + reguła rozstrzygania sprzeczności |
| `feature.md:74-85` (Krok 2) | instrukcja dla `researcher`: „Ustal DOKŁADNE udokumentowane zachowanie, które nowy kod ma odtworzyć" |
| [`.claude/agents/researcher.md:14`](../.claude/agents/researcher.md) | hierarchia źródeł + „Kod w `rebuild/` może jeszcze nie istnieć — nie oczekuj go" |
| `researcher.md:33-40` | strategia eksploracji: punkt 2 to `deminified/`, punkt 4 to „flaguj rozjazdy spec ↔ oryginał ↔ fixtures" |
| `researcher.md:72` | sekcja raportu „Rozjazdy (spec ↔ oryginał ↔ fixtures)" |

**Do zrobienia:** odwrócić kolejność (kod + testy → `docs/spec-*` → kontrakt → archeologia),
skasować „kod może jeszcze nie istnieć", a sekcję „Rozjazdy" przemianować na rozjazd
**dokumentacja ↔ kod** (to jest realny problem systemu w utrzymaniu — docs się starzeją).

### 1.2. Fixtures zmieniają rolę, ale NIE giną

Dziś zasada jest twarda i słusznie: „nie »poprawiaj« fixtures, rozbieżność = **STOP**"
(`feature.md:276-290`). Po cutoverze fixtures to **baseline regresji**: chronią przed
**niezamierzoną** zmianą kontraktu, ale zmiana **zamierzona** staje się legalna — pod warunkiem,
że jest jawna: aktualizacja `contract/openapi.yaml` + przenagranie fixture + wpis w `plan.md`.
`contract/openapi.yaml` przestaje być „zamrożonym kontraktem" i staje się **kontraktem
utrzymywanym**.

⚠ **Nie usuwać gate'a — przestawić cel.** Po wyłączeniu starego Bridge nadal istnieją kontrakty
zewnętrzne, których złamanie boli natychmiast i poza naszym repo:

- **REST + feed CSV do Selly** — `src/selly/`, generator CSV, cron 6:00;
- **formaty importu od dostawców** — CSV/XLSX, 10 dostawców, `AGRORAMI_*`;
- **przeglądarka Ani** — kontrakt FE↔BE (`openapi.yaml`) to jedyna rzecz, która trzyma je razem.

To jest właściwa treść nowego gate'a. Nazwa „GATE ODBUDOWY" ma się zmienić na coś w rodzaju
**„GATE KONTRAKTU"**, a jego trzy punkty — z „zgodne z produkcją" na „zgodne z zadeklarowanym
kontraktem albo świadomie i widocznie zmienione".

### 1.3. `/triaz-zmian` umiera w całości

[`.claude/commands/triaz-zmian.md`](../.claude/commands/triaz-zmian.md) opiera się wyłącznie na
commitach `sync(vps)` od Ani do `mirror/`. Gdy stary system zgaśnie, nie ma czego triażować:
komenda, `docs/triage-state.txt` i `docs/rebuild-backlog.md` **jako lista różnic wobec starej
produkcji** tracą przedmiot.

**Do zrobienia:** usunąć komendę (albo przenieść do `docs/OLD/`) i dopisać na początku
`docs/rebuild-backlog.md` notę: „zamknięty <data cutoveru>; otwarte wpisy żyją w
`docs/rebuild-roadmap.md` §6b Bloki 3–4". **Zanim to zrobisz** upewnij się, że żaden otwarty
wpis `⬜`/`🕒` nie zostaje tylko w backlogu — sprawdzenie: `tools/stan-backlogu.sh --do-decyzji`
kontra §6b. Najważniejszy z nich to `#154.1` (sync REST do Selly gubi flagi `'Tak'`,
`src/selly/mapper.ts:197-203`) — dotyka żywego sklepu od pierwszego dnia.

### 1.4. Mechanika kart jest specyficzna dla fali odbudowy

Blok „OBOWIĄZKOWO, jeśli ticket realizował kartę odbudowy" (`feature.md:361-400`) i sekcja
„Ownership of shared docs (Bridge)" ([`doc-checker.md:23-44`](../.claude/agents/doc-checker.md))
zakładają kilkadziesiąt równoległych worktree jadących po roadmapie, z koordynatorem jako
jedynym właścicielem `docs/rebuild-roadmap.md`. Po cutoverze zostaje normalny strumień
pojedynczych ticketów — najczęściej zgłoszeń Ani.

**Zostaje bez zmian, bo jest uniwersalne:** zasada „nie dopisuj akapitu na koniec współdzielonego
pliku, twórz `wpis-<N>.md`". Ona nie wynika z odbudowy, tylko z równoległych gałęzi, i dotyczy
`docs/spec-backend/`, `docs/rebuild-backlog/` i każdego pliku, w który piszą dwa tickety.

**Do zrobienia:** zwinąć blok o kartach do kilku linii („jeśli ticket realizuje kartę — patrz
`docs/karty/README.md`"), zachować regułę plików-per-ticket, usunąć „okres przejściowy"
(ticket 82) i odniesienia do roadmapy jako planu pracy.

### 1.5. `CLAUDE.md` dzieli się na pół

**Zostaje** (dotyczy naszego kodu i nadal potrafi ugryźć):

- projekcje Drizzle: `select()` bez listy pól oddaje camelCase, fixture ma `snake_case`;
- kolumna dodana runtime'owym `ALTER TABLE` jest dla Drizzle niewidoczna;
- `integer({ mode: "boolean" })` cicho zjada tekstowe `'Tak'` — i `src/selly/mapper.ts` **nadal
  ma ten błąd** (`#154.1`);
- `UPPER()`/`LOWER()` w SQLite są ASCII-only (`PROWADZąCA`);
- `safeAll()` zamienia błąd SQL w pustą listę — `rows: []` nie znaczy „brak danych";
- MSW z `onUnhandledRequest: "error"` nie wywala testu, tylko zamienia go w stan `error`.

**Odchodzi** (dotyczy oryginału, który przestanie istnieć):

- duplikaty definicji w `deminified/backend-index.cjs` (`tk`, `Lq`) i cieniowanie nazw;
- „w `mirror/frontend/` żywy jest tylko bundel z `index.html`";
- „nazwa kopii `.bak` daje etykietę, nie treść";
- „oryginał da się uruchomić lokalnie" + `tools/record-write-fixtures.cjs` jako metoda dowodzenia
  wierności (nagrywanie fixtures ma sens dalej — ale **z nowego backendu**, jako baseline).

⚠ **Jedna reguła zmienia status z faktu na decyzję.** Dziś: „tryb `boolean` w modelu jest wierny
oryginałowi, więc `GET /api/products` ma zostać przy `false` na `'Tak'`; poprawka należy do
warstwy odczytu konsumenta, **nigdy** do `src/db/schema.ts`". Po cutoverze uzasadnienie
(wierność) znika i zostaje otwarte pytanie: czy wyczyścić dane i naprawić schemat. **To jest
decyzja użytkownika, nie zadanie karty PO.0** — PO.0 ma ją tylko jawnie postawić.

## 2. Co NIE wymaga zmian

Żeby przestrojenie nie zamieniło się w reformę działającego procesu:

- **Cały szkielet `/feature`:** 19 kroków, fazy, atomowa rezerwacja numeru ticketa (Krok 4),
  worktree i konwencja gałęzi (Krok 5), `plan.md` → `raport.md` → `review.md`, bramki
  (lint/typecheck/build/test), synchronizacja z `develop` (Krok 16), `tools/push-i-pr.sh`,
  ruleset i hooki, obejście braku `gh` w sesji chmurowej (Krok 17), język PL dla artefaktów
  i PL dla terminów domenowych w kodzie.
- **`reviewer` poza jedną linią** — `reviewer.md:49` (blocker „Wierność (GATE odbudowy)")
  przeformułować na „zmiana kontraktu API bez aktualizacji `openapi.yaml`/fixtures i bez
  wzmianki w `plan.md`". Reszta checklisty (BLOCKER/SHOULD-FIX/NICE-TO-HAVE, plan compliance,
  testy nierównoległe, mobile) jest niezależna od odbudowy.
- **Mechanika `doc-checker`** — skala dodawania per typ zmiany, dopasowanie do stylu dokumentu,
  minimalizm, odnośniki do ticketów, format raportu. Bez zmian.
- **Rola `researcher`** — zmienia się tylko to, **gdzie** ma szukać.

## 3. Lista zadań karty PO.0

- [ ] `.claude/commands/feature.md`: `description:` (`:2`); sekcja „Kontekst odbudowy" (`:14-35`)
      → „Kontekst utrzymania"; instrukcja dla researchera w Kroku 2 (`:74-85`); szablon `plan.md`
      — sekcje „Kontrakt i fixtures (zakres)" i „Odstępstwa od oryginału" (`:214-233`); GATE
      w Kroku 9 (`:276-290`) → GATE KONTRAKTU; pole „Gate odbudowy" w `raport.md` (`:319`);
      blok o kartach w Kroku 13 (`:361-400`) → kilka linii.
- [ ] `.claude/agents/researcher.md`: hierarchia (`:14`), strategia eksploracji (`:33-40`),
      sekcja raportu „Rozjazdy" (`:72`).
- [ ] `.claude/agents/reviewer.md`: jedna linia (`:49`).
- [ ] `.claude/agents/doc-checker.md`: sekcja „Ownership of shared docs" (`:23-44`) — zachować
      regułę plików-per-ticket, usunąć mechanikę kart i okres przejściowy.
- [ ] `.claude/commands/triaz-zmian.md`: usunąć; nota w `docs/rebuild-backlog.md`; sprawdzić
      `tools/stan-backlogu.sh --do-decyzji`, czy nic otwartego nie zostaje bez nośnika.
- [ ] `CLAUDE.md`: przeciąć na „pułapki naszego kodu" (zostają) i „archeologia oryginału"
      (do sekcji historycznej albo `docs/OLD/`); postawić jawnie pytanie o `mode: "boolean"`.
- [ ] `docs/rebuild-roadmap.md`: nota, że plik jest **archiwum planu odbudowy**, a bieżąca praca
      nie jest jego kontynuacją (§6b stopka już to mówi — dociągnąć do nagłówka i §0).
- [ ] **Decyzje do postawienia użytkownikowi w Kroku 3** (nie rozstrzygać samodzielnie):
      (a) czy `mirror/` i `deminified/` idą do `archive/` — D9 mówi „`mirror/` zostaje w repo",
      więc to zmiana tamtej decyzji, nie jej wykonanie; (b) czy przenagrać fixtures z **nowego**
      backendu jako baseline regresji, czy zostawić nagrania z oryginału; (c) czy naprawiać
      schemat flag `'Tak'`.

## 4. Definition of done

- Żaden plik procesu (`.claude/**`, `CLAUDE.md`) nie każe traktować `deminified/`/`mirror/`
  jako źródła prawdy dla nowego kodu.
- Gate przed merge'em **istnieje** i celuje w kontrakty zewnętrzne (Selly, dostawcy, FE↔BE).
- Zasada „nie dopisuj na koniec współdzielonego pliku" przetrwała w niezmienionej treści.
- Otwarte wpisy backlogu mają nośnik poza `docs/rebuild-backlog.md`.
- Trzy decyzje z §3 albo rozstrzygnięte przez użytkownika, albo zapisane jako otwarte.
