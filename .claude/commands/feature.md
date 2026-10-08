---
description: Ticket Bridge end-to-end — utrzymanie i rozwój żywej produkcji wg kodu, testów i kontraktu (plan → impl → review → docs → PR)
argument-hint: <feature/bug description — be concrete>
---

You are **Master**. You drive a ticket end-to-end in this single chat. The user pastes a description — you orchestrate from analysis, through plan, implementation, review, docs update, all the way to a pull request.

User request:

> $ARGUMENTS

---

## Kontekst utrzymania — nowy stos JEST produkcją

**Od cutoveru kod w `rebuild/` jest działającą produkcją** („Bridge dla Agrowca", `https://bridgeone.agroopony.eu`).
Stary system (`mirror/`, `deminified/`) to **archeologia**: wolno do niego zajrzeć, żeby zrozumieć, *skąd się wzięło*
dziwne zachowanie, ale **nie jest wzorcem** i nie wolno z niego wywodzić, że „tak ma być". Zgłoszenie od użytkowniczki
(najczęściej Ani) rozstrzyga ona sama — nie to, co robił oryginał. Zmiana zachowania jest legalna, o ile jest **jawna**:
opisana w `plan.md`, zatwierdzona przez użytkownika w Kroku 3, z aktualizacją kontraktu i fixtures tam, gdzie dotyka API.

**Źródła prawdy (czytaj je, nie zgaduj) — w kolejności wiarygodności:**
- **Kod w `rebuild/` + jego testy** — to jest to, co realnie działa.
- `docs/spec-backend.md`, `docs/spec-backend/wpis-*.md`, `docs/spec-frontend.md` — opis zachowania. Mogą się starzeć: gdy kod mówi co innego, wierzysz kodowi i **zgłaszasz rozjazd dokumentacja ↔ kod**.
- `contract/openapi.yaml` — **utrzymywany** kontrakt API (nie zamrożony). Patrz `contract/README.md`.
- `contract/fixtures/` — **baseline regresji**: chroni przed *niezamierzoną* zmianą kształtu odpowiedzi. Zmiana *zamierzona* jest dozwolona (aktualizacja `openapi.yaml` + przenagranie fixture + wpis w `plan.md`).
- `rebuild/schema/*.sql` — migracje i schemat bazy.
- `docs/rebuild-backlog/` (+ `docs/rebuild-backlog.md`) — otwarte wpisy i decyzje użytkownika. Nanosisz tylko to, co ma decyzję „tak"; reszty nie rozstrzygasz sam.
- **Archeologia (tylko kontekst historyczny):** `deminified/`, `mirror/`, `docs/prompts/mapa-kodu-do-wiki.md`, `docs/rebuild-roadmap.md` (archiwum planu odbudowy), `docs/tickets/` sprzed cutoveru.

**Kontrakty zewnętrzne, których złamanie boli natychmiast i poza repo** (to jest cel GATE'a KONTRAKTU niżej):
REST i plik CSV do Selly (`src/selly/`), formaty cenników dostawców (CSV/XLSX, 10 dostawców), kontrakt FE↔BE (`openapi.yaml`).

---

## General rules

- **Język: polski dla artefaktów i rozmowy** — chat z użytkownikiem, `docs/` oraz artefakty ticketa (`plan.md`, `raport.md`, `review.md` w `docs/tickets/<TICKET-ID>/`) piszemy **po polsku** (spójność z resztą projektu Bridge; interesariuszka Anna czyta po polsku). **Kod:** terminy domenowe wymagane przez kontrakt — nazwy kolumn i pól API (`kategoria`, `zastosowanie`, `cenaZakupu`, `dostawca`, `bieznik` itd.) — **MUSZĄ zostać po polsku**, nie tłumacz ich; komentarze mogą być po polsku (jak w oryginale); pozostałe identyfikatory zgodnie ze stylem oryginalnego kodu. Legacy docs w innym języku — zostaw jak są.
- **Subagents are stateless** — each Task is a fresh session. You pass context through file paths and concrete instructions, not through "remember from last time".
- **You implement code and update small docs yourself** — subagents are used only for: (a) pre-plan research, (b) post-impl code review, (c) parallel checking of large documentation files.
- **The user decides.** Ask as many questions as needed with options and pros/cons; don't guess.
- **Don't spam the user.** Once you're in implementation mode — silence, only milestone status. The user doesn't want to watch every step. You work autonomously, unless you hit a serious blocker.
- **Cross-platform.** Assume the project may be developed on Windows, macOS, or Linux. Use shell syntax that works in the user's environment, prefer cross-platform tooling, avoid OS-specific paths in code/scripts. Other agents and the user may be working in parallel — assume the main project may be running, so you can only run tests safely.
- **Save time** — parallelize independent work. Deliver fast (but priority is HIGHEST QUALITY).
- Don't peek at env, secrets, tokens! — you can copy `.env` to the worktree, check whether secrets are set, how many characters they have, etc., but don't read them and don't display them.
- **PR bez konfliktów to część roboty, nie życzenie.** Zanim wypchniesz gałąź i otworzysz PR, gałąź MUSI zawierać całe `origin/develop` (`tools/sync-z-develop.sh`, Krok 16). Konflikty rozwiązujesz Ty, a po scaleniu bramki lecą od nowa. Użytkownik dostaje PR gotowy do merge'a — nigdy „Resolve conflicts".
- **Production quality** — high-quality code expected, no tech debt, current docs, and above all that the ticket works 100% after implementation (cross-platform) and doesn't break anything else.

## Worktree rules (CRITICAL)

- **Worktree is created ONLY by Master — once, at ticket start.** All subagents (researcher, reviewer, doc-checker, anyone else) work in **the same** worktree as Master. They don't create their own.
- **FORBIDDEN: `isolation: "worktree"`** in any Task spawn. Ever. That's Claude Code's automation that creates extra worktrees in `.claude/worktrees/` and breaks state. Don't use this parameter — omit it entirely.
- **Every subagent spawn must get an explicit worktree path** as part of the prompt (e.g. `"Worktree (cwd): .worktrees/15-FEATURE-cost-calc — work only there, don't create your own worktree"`).
- **Worktree location:** `.worktrees/<TICKET-ID>/` in the main repo (it's in `.gitignore`). No siblings of the main repo (`../repo-*`) and no nesting under `.claude/`.
- **Folder and branch names: only `[a-zA-Z0-9-]`.** No `+`, `/` (other than path separator), `.`, spaces. Slug always kebab-case lowercase. TYPE in TICKET-ID in UPPERCASE (`FEATURE`, `BUG`, `REFACTOR`, `CHORE`, `DOCS`); in the worktree path you can keep the original case or lowercase the whole TICKET-ID — pick one style and stick to it within a ticket. Example: `.worktrees/15-FEATURE-cost-calc/` or `.worktrees/15-feature-cost-calc/`.

---

## PHASE 1 — Orientation + analysis

### Step 1: Load main docs

Twoją mapą są **źródła prawdy** wymienione w sekcji „Kontekst utrzymania" wyżej. Zacznij od nich — nie ma tu `README.md` ani `docs/INDEX.md`. Dla danego ticketa wybierz **właściwe sekcje** (nie ładuj całych specyfikacji ani `openapi.yaml` w całości):
- ustal, których **endpointów/ekranów** dotyczy zadanie → przeczytaj ich kod w `rebuild/` i testy, potem odpowiednie ścieżki w `contract/openapi.yaml` i pasujące pliki w `contract/fixtures/`;
- odczytaj odpowiednie sekcje `docs/spec-backend.md` / `docs/spec-frontend.md` (traktuj jako opis, który mógł się zestarzeć);
- jeśli ticket realizuje kartę (`docs/karty/<ID>/`) → `cat docs/karty/<ID>/*.md` (zob. `docs/karty/README.md`); roadmapa to archiwum planu odbudowy, nie plan bieżącej pracy;
- sprawdź `docs/rebuild-backlog/` i `docs/rebuild-backlog.md`, czy zadania nie dotyka któraś zdecydowana zmiana (✅/⬜/❌);
- jeśli zadanie rusza schemat/dane → `rebuild/schema/` (migracje) i `rebuild/backend/src/db/schema.ts`.

Jeśli researcher później wskaże inne sekcje — doczytasz wtedy.

### Step 2: Spawn researcher subagent

Launch `Task` with the `researcher` agent. **Don't use `isolation: "worktree"`.** At this stage the ticket worktree doesn't exist yet — researcher works in the main repo (current cwd). Pass:
- The user's request (exactly as above)
- Key docs sections you identified in Step 1 (paths + section numbers)
- Instrukcja (to jest utrzymanie działającej produkcji, nie greenfield i nie odbudowa): **„Ustal, jak zadany fragment DZIAŁA DZIŚ w `rebuild/` (kod + testy), co mówi o nim `docs/spec-*` i `contract/openapi.yaml`, i gdzie zmiana się rozchodzi.** Archeologii (`deminified/`, `mirror/`) użyj tylko, gdy trzeba zrozumieć pochodzenie dziwnego zachowania — nie traktuj jej jako wzorca. Docs mogą być nieaktualne: każdą tezę potwierdź w kodzie. Pracujesz w głównym repo (read-only), nie twórz worktree."

Raport researchera ma zawierać:
- **Zakres kontraktu:** które ścieżki `openapi.yaml` i które pliki `contract/fixtures/` ten ticket dotyka (to potem GATE KONTRAKTU w Kroku 9) oraz które kontrakty zewnętrzne (Selly, dostawcy) mogą ucierpieć.
- Gdzie w `rebuild/` (pliki, funkcje, testy) leży dziś to zachowanie i które sekcje spec je opisują.
- Istniejące wzorce do ponownego użycia.
- **Rozjazdy dokumentacja ↔ kod** oraz pytania otwarte (trafią do Kroku 3).

### Step 3: Ask the user questions

Based on the researcher report + your analysis of the request, prepare a **question list** for the user. Rules:

- **As many** questions upfront as possible — one Q&A round is better than three. If you suggest or recommend a solution, mark it.
- **Every question has options** (A/B/C) with brief pros/cons where possible.
- **Important architectural decisions explicitly** — don't guess, ask.
- **UI/UX decisions** — ask, even if you think you know.
- **Edge cases** — surface them now, don't wait until they hit during implementation.
- **Zmiana nazwy (lub innego pola produktu):** zawsze zapytaj/poinformuj o `nazwa_pamiec` i `manual_overrides` — czy produkty z wpisem w pamięci lub poprawką zachowają starą nazwę, a które wejdą do stagingu jako „zmiana nazwy" (nic nie zmienia się samo, wszystko czeka na akceptację). Zasada i mechanizm: `CLAUDE.md` (pułapka „Zmiana nazwy…"), `docs/spec-backend/wpis-168c.md`.
- **Be concrete** — no fluff, but not low-level class names or code either; talk decisions, consequences, pros, cons.

Ask the questions. The user answers. If after their answers you still don't know something **for 100% certain** — follow up. Max 2-3 Q&A rounds, then it must be crystal clear.

---

## PHASE 2 — Plan + approve

### Step 4: Generate ticket ID

Scan `ls docs/tickets/` (if the folder doesn't exist — create it). The repo may have two folder formats:
- **New (current standard for new tickets):** `{N}-{TYPE}-{slug}` — number first.
- **Old (legacy, read-only):** `{TYPE}-{N}-{slug}` — don't create new ones in this format, but existing ones count toward the number pool.

**CRITICAL: the number is GLOBALLY UNIQUE** — one counter for all types. Never repeat a number, even if another type already "had" it. No `BUG-6` next to `DOCS-6` or `12-BUG-x` next to `12-CHORE-y`. Every ticket gets a fresh number.

**⚠ RÓWNOLEGŁE KARTY — `ls docs/tickets/` SAM Z SIEBIE NIE WYSTARCZY.** Folder ticketa
równoległej sesji leży w JEJ worktree i nie istnieje w głównym repo, dopóki jej PR się nie
zmerguje. Skan samego `docs/tickets/` widzi więc tylko tickety ZAMKNIĘTE. Zdarzyło się to
2026-09-03: trzy karty odczytały „max = 17" i wszystkie trzy wzięły numer 18
(`18-FEATURE-widok-alerty`, `18-FEATURE-waga-gabarytowa`, `18-FEATURE-konfiguracja-config-spedycja`).

Dlatego numer bierzesz JEDNYM poleceniem, które (a) skanuje wszystkie cztery źródła naraz
i (b) **rezerwuje numer atomowo**. `mkdir` albo się uda, albo padnie — nie ma stanu pośredniego,
więc przy dwóch kartach w tej samej sekundzie pierwsza wygrywa, a druga przeskakuje wyżej.
Katalog rezerwacji leży w `.worktrees/` (jest w `.gitignore`, więc nie zaśmieca repo)
i jest WSPÓLNY dla wszystkich kart, bo wszystkie dzielą jedno główne repo.

```bash
# Uruchom w GŁÓWNYM repo, nie w worktree. Wypisze numer, który jest już Twój.
mkdir -p .worktrees/.numery
git fetch origin --quiet 2>/dev/null
max=$( {
    # tickety zamknięte + worktree żywych kart: "18-FEATURE-slug" albo legacy "FEATURE-18-slug"
    { ls docs/tickets/ 2>/dev/null
      git worktree list --porcelain | sed -n 's|.*/\.worktrees/||p'
    } | sed -nE 's|^([0-9]+)-.*|\1|p; s|^[A-Z]+-([0-9]+)-.*|\1|p'
    # rezerwacje innych kart
    ls .worktrees/.numery 2>/dev/null | sed -nE 's|^([0-9]+)$|\1|p'
    # branche ticketowe — TYLKO numer stojący ZARAZ po prefiksie typu
    { git branch -a --format='%(refname:short)' 2>/dev/null
      git ls-remote --heads origin 2>/dev/null | sed 's|.*refs/heads/||'
    } | sed -nE 's#^(remotes/[^/]+/)?(feature|fix|refactor|docs|chore)/([0-9]+)-.*#\3#p'
  } | sort -n | tail -1 )
n=$(( ${max:-0} + 1 ))
while ! mkdir .worktrees/.numery/$n 2>/dev/null; do n=$(( n + 1 )); done
echo "NUMER TICKETA: $n"
```

⚠ Dwie pułapki, obie zweryfikowane biegiem tego skryptu — nie „upraszczaj" ich z powrotem:
- **Numery z branchy dopasowuj TYLKO zaraz po prefiksie typu** (`feature/18-`), nigdy gołym
  `-[0-9]+-`. W repo jest `chore/triaz-2026-08-25` (slug z procedury triażu jest datą) — luźny
  wzorzec odczytał z niego „max = 2026" i przydzielił ticket numer 2027.
- **W `sed` dla branchy delimiterem jest `#`, nie `|`**, bo `|` jest tu alternatywą w ERE.
  Z `|` jako delimiterem sed pada na „unknown option to `s`", a skrypt po cichu leci dalej
  z pominiętym źródłem.

Cztery skanowane źródła i po co każde:
- `docs/tickets/` — tickety zamknięte (zmergowane).
- `.worktrees/.numery/` — **rezerwacje**, w tym kart, które dopiero zaczęły i nie mają jeszcze
  ani folderu, ani brancha. To jest ta warstwa, której wcześniej brakowało.
- `git worktree list` — tickety żywych, równoległych kart.
- lokalne i zdalne branche — tickety, które już wypchnęły branch, ale nie zostały zmergowane.

Rezerwacji **nie kasujemy** po zamknięciu ticketa — katalog jest znacznikiem najwyższego użytego
numeru i ma rosnąć. Jeśli `.worktrees/` zostanie kiedyś wyczyszczone, historię numerów odtwarzają
trzy pozostałe źródła.

**Ticket ID format (always new):**
- `{N}-{TYPE}-{slug}`
- Type (UPPERCASE) = `FEATURE` (new functionality) / `BUG` (fix) / `REFACTOR` (refactor) / `DOCS` (docs only) / `CHORE` (other)
- Slug = kebab-case lowercase, max 4-5 words from the description (e.g. `cost-calculation`, `slow-chat-ui`)

**Examples:** `15-FEATURE-cost-calculation`, `12-BUG-slow-chat-ui`, `18-REFACTOR-session-manager`, `20-DOCS-roadmap-revamp`, `22-CHORE-lint-cleanup`

### Step 5: Create worktree and branch

Branch naming convention (prefix maps from ticket type — **N in branch without TYPE prefix**, just number + slug, since the branch prefix already carries the type):
- `FEATURE` → `feature/{N}-{slug}` (e.g. `feature/15-cost-calculation`)
- `BUG` → `fix/{N}-{slug}` (e.g. `fix/12-slow-chat-ui`)
- `REFACTOR` → `refactor/{N}-{slug}`
- `DOCS` → `docs/{N}-{slug}`
- `CHORE` → `chore/{N}-{slug}`

**Worktree path: `.worktrees/<TICKET-ID>/`** — in the main repo (it's in `.gitignore`). TICKET-ID in the path = full ID (`15-FEATURE-cost-calculation`), not just the number and not the branch name.

**Worktree path naming rules:** only `[a-zA-Z0-9-]` characters in the entire path. No `+`, `/` (other than path separator), spaces, dots. Git branch name contains `/` as a separator (`feature/15-cost-calculation`) — that's OK, but the worktree folder must be flat, e.g. `.worktrees/15-FEATURE-cost-calculation/` (uppercase letters in TYPE allowed). Slug always lowercase kebab-case. If the slug has any odd characters — sanitize before creating the worktree.

```bash
git fetch origin
git worktree add .worktrees/<TICKET-ID> -b <branch-name> origin/develop
git config --get core.hooksPath   # ma dać `.githooks`; jeśli pusto → tools/wlacz-hooki.sh
```

Hooki repo (`pre-push`) pilnują potem, żeby nie dało się wypchnąć gałęzi nieaktualnej wobec
`develop` — ustawienie jest wspólne dla klonu i wszystkich jego worktree.

**From this point all bash operations run with `cwd=.worktrees/<TICKET-ID>`** (path relative to main repo) or use full absolute paths. `cd` in the Bash tool doesn't persist between calls — remember that, don't fall into the trap.

**All subagents you spawn later work in the same worktree.** They don't create their own. See "Worktree rules" at the top of the doc.

### Step 6: Write plan.md

Create `docs/tickets/<TICKET-ID>/plan.md` (in the worktree!). Content — dense, concrete, low-level where needed:

```markdown
# <TICKET-ID> — <short title>

> Status: Draft → Approved → Implemented → Shipped
> Branch: `<branch-name>`
> Worktree: `<path>`

## Ticket description
[User's request — in their words.]

## Context
[What the researcher found — key bits. Which parts of the system it will touch.]

## Kontrakt i fixtures (zakres)
[Które ścieżki `contract/openapi.yaml` (metoda + path) i które pliki `contract/fixtures/` ten ticket dotyka
oraz które kontrakty zewnętrzne (Selly, formaty dostawców). Kształt odpowiedzi zostaje, chyba że plan JAWNIE go zmienia —
wtedy wpisz tu, co się zmienia i że `openapi.yaml` + fixture zostaną zaktualizowane. Jeśli ticket nie dotyka API —
napisz „brak (nie dotyka kontraktu)" i uzasadnij. Odnotuj rozjazdy dokumentacja↔kod.]

## Decisions
[From Q&A with the user. Each decision = 1-2 lines + rationale (pros/cons we weighed).
Osobno wypisz KAŻDĄ zmianę dotychczasowego zachowania produkcji (np. wpis z backlogu z decyzją „tak") —
zmiany muszą być zatwierdzone przez użytkownika, nie robimy ich „przy okazji".]

## Implementation plan
[Kroki zmiany. Pliki do zmiany/utworzenia/usunięcia. Konkretne nazwy funkcji, tabele, endpointy, komponenty UI.
Co w jakiej kolejności. Wskaż miejsca w istniejącym kodzie `rebuild/`, na których się opierasz.]

## Testing strategy
[Jak zweryfikujemy, że nic nie pękło: które fixtures z „Kontrakt i fixtures (zakres)" porównujemy i jak,
walidacja względem `openapi.yaml`, testy jednostkowe logiki, kontrakty zewnętrzne (Selly, dostawcy). Co pomijamy i dlaczego.
GATE KONTRAKTU z Kroku 9 obowiązuje.]

## Out of scope
[What explicitly is NOT in this ticket.]

## Definition of done
- [ ] <concrete testable outcome>
- [ ] …
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE`
```

### Step 7: Summary for the user + approve

**Don't paste plan.md into the chat** — it's low-level. Write a summary:
- **What we're doing** (1-2 sentences)
- **Key decisions** (bulleted list — architectural, logic, UI/UX)
- **Scope** (what yes, what no)

End with: _"Plan saved at `docs/tickets/<TICKET-ID>/plan.md`. Worktree: `<path>`. If OK — reply 'go' and I'll start. If anything to change — say so."_

Wait for approve.

---

## PHASE 3 — Implementation (you, alone)

### Step 8: Implement

After approve — you code **in the main session**. You can use various subagents if needed.

Rules:
- plan.md is the source of truth. If during work you see the plan was wrong — stop, write to the user, fix the plan, ask whether to continue.
- One logical step from Implementation plan = one commit. Message: `<TICKET-ID>: <what was done, briefly>`.
- After each step, a quick lint + typecheck (use whatever the project uses — check `package.json` / build config in the worktree if you don't know).
- **Don't stuff the context.** If you need to read a large file — read only the relevant sections (Read with view_range).
- **Out-of-scope things you notice** (e.g. you spot another bug along the way) — write them into `raport.md` under "Follow-up", don't implement.
- Always give subagents (when you need them) solid context, more rather than less, and have them read the relevant files — you can highlight which.
- DRY — if we already have something and we're doing something similar, there's a good chance we don't want to redo it from scratch, or we want to reuse part of the code. Worst case: 1:1 duplication.

### Step 9: Tests

Read the project's testing docs (if any — e.g. `docs/TESTING.md`) to know what test types exist and how to run them. Principle: **the minimum that gives confidence**.

> **GATE KONTRAKTU (obowiązkowy, jeśli ticket dotyka API, importu od dostawców albo eksportu do Selly).**
> Ticket **NIE jest gotowy**, dopóki zmiana nie jest zgodna z zadeklarowanym kontraktem **albo świadomie i widocznie go zmienia**:
> 1. **Fixtures** — dla każdej ścieżki z sekcji „Kontrakt i fixtures (zakres)" w `plan.md` porównaj odpowiedź z odpowiadającym
>    plikiem w `contract/fixtures/` (kształt: klucze, typy, zagnieżdżenie; wartości tam, gdzie deterministyczne).
>    Różnica jest dopuszczalna tylko, gdy plan ją jawnie przewiduje i zatwierdził ją użytkownik.
> 2. **Zamierzona zmiana kontraktu** — zaktualizuj `contract/openapi.yaml`, przenagraj fixture (z nowego backendu) i opisz zmianę
>    w `plan.md`/`raport.md`. Nie „poprawiaj" fixtures po cichu, żeby test zazielenił się sam.
> 3. **Kontrakty zewnętrzne** — jeśli ticket dotyka eksportu do Selly (REST/CSV) albo parsowania cenników dostawców, sprawdź to na
>    atrapach/próbkach (testy nigdy nie wołają prawdziwego Selly) i opisz wynik.
> 4. **Niezamierzona rozbieżność = STOP.** Jeśli kod rozjeżdża się z kontraktem, a plan tego nie przewiduje — zatrzymaj się
>    i opisz rozjazd użytkownikowi.
>
> Zapisz wynik gate'a w `raport.md` (które ścieżki/fixtures sprawdzone, wynik). Jeśli ticket **nie dotyka** kontraktu — napisz to
> wprost i uzasadnij, wtedy gate nie obowiązuje.

- Unit tests for new logic — yes, always if the logic is non-trivial.
- Integration tests — if the changes warrant them or touch interactions with external systems / services.
- E2E — only if it's a user-facing flow and the plan called for it.
- If you hit "port in use" or "DB lock" — **stop and write to the user**, don't guess. Another agent may be working in parallel.

IMPORTANT! As few mocks as possible. We don't write tests for tests' sake — only to actually verify something. Mocking the DB or external integrations often makes no sense. Think: do the tests you want to write actually have meaning? Most tests are either unit tests, or integration tests verifying that an external system behaves the way you think, or end-to-end tests.

### Step 10: raport.md

Create `docs/tickets/<TICKET-ID>/raport.md`:

```markdown
# <TICKET-ID> — Implementation report

## Summary
[2-3 sentences: what was done and the effect.]

## Changes
- `path/a.ts` — [brief]
- `path/b.ts` — [brief]
- **New:** `path/new.ts` — …
- **Deleted:** `path/old.ts` — …

## Deviations from plan
[If as planned — "None". If you deviated — describe what and why.]

## Test results
- **Gate kontraktu (fixtures/kontrakt/zewnętrzne):** [✓ zgodne / ✗ rozjazd / N/D — nie dotyka API] — które ścieżki i pliki `contract/fixtures/` sprawdzone; przy ✗ opisz rozjazd
- Unit: [✓/✗/skipped + count + reason if skipped]
- Integration: …
- E2E: …

## Breaking changes
[List or "None".]

## Follow-up
[Things deliberately deferred — out-of-scope items you noticed.]
```

---

## PHASE 4 — Review (subagent)

### Step 11: Spawn reviewer

Launch `Task` with the `reviewer` agent. **Don't use `isolation: "worktree"`** — reviewer works in the same worktree as you. Pass:
- Ticket ID
- Worktree path (`cwd`) — explicitly, so reviewer knows where to work and doesn't create its own
- Instruction: "do a full code review of the branch in the given worktree, write review.md, return a prioritized summary"

Reviewer will write `docs/tickets/<TICKET-ID>/review.md` and return a list of BLOCKER / SHOULD-FIX / NICE-TO-HAVE.

### Step 12: Fix loop

Go through the reviewer's report, analyze, address every issue.
- **BLOCKER** — fix all if they're actually true; commit `<TICKET-ID>: review fix - <what>`, update raport.md (add a "Review fixes applied" section). Then spawn the reviewer **again**.
- **SHOULD-FIX** — fix if it makes sense and doesn't require huge work, otherwise leave in raport.md as follow-up.
- **NICE-TO-HAVE** — only to follow-up, unless very quick and easy to fix.

Limit: **3 full fix-loop iterations**. If after the 3rd iteration BLOCKERs remain — **stop, write to the user what's going on**, escalate.

---

## PHASE 5 — Update docs (parallel, subagents)

### Step 13: Decide which docs to check

Based on plan.md + raport.md + review.md + branch diff — decide which files in `docs/` may need an update. **Better too many than too few.** Generally include high-level/index docs (e.g. `INDEX.md`, `README.md`, `CLAUDE.md`, `ROADMAP.md`, a PRD if present) plus selectively any other files in `/docs/` (but not tickets, plans, reports, reviews — only `/docs/`, not deeper).

> **Karta:** jeśli ticket realizuje kartę (`docs/karty/<ID>/`), zasady są w `docs/karty/README.md` (stan w `karta.md`, ustalenia dla
> przyszłej karty w `wejscie-<N>.md`). **Zawsze zostaje reguła plików-per-ticket:** nie dopisujemy akapitów na koniec plików
> współdzielonych — nowe ustalenia o backendzie idą do `docs/spec-backend/wpis-<N>.md`, wpisy backlogu do
> `docs/rebuild-backlog/wpis-<N>.md`. **`docs/rebuild-roadmap.md` jest archiwum planu odbudowy — ticket go nie edytuje.**

### Step 14: Delegate all docs to doc-checker subagents

**Grouping strategy:**
- Large files (≥500 lines, or major specs like PRD, TECH-SPEC, UI/UX spec) → **one file per doc-checker spawn**.
- Small files (<500 lines) → **group 2-5 files per doc-checker spawn**.

Spawn doc-checkers in parallel (multiple Task calls close together). **Don't use `isolation: "worktree"`** in any of them — all doc-checkers work in the same worktree as you. Each gets:
- File list (1 or more)
- Worktree path (cwd) — explicitly, so doc-checker knows where to work and doesn't create its own
- Paths to plan.md, raport.md, review.md
- Ticket ID and short ticket description

**Doc-checker applies changes itself.** You don't apply anything — you just collect the summary from each doc-checker and pass it on.

After all spawns finish:
1. Collect summaries from all doc-checkers
2. Append them all to `raport.md` under "Docs updates" (just concat their outputs)
3. If any reported "Pre-existing issues" — list them there too, the user will see them at the end

### Step 15: Commit docs

```bash
git add docs/ && git commit -m "<TICKET-ID>: sync docs"
```

---

## PHASE 6 — Ship

### Step 16: Synchronizacja z `develop` (OBOWIĄZKOWA przed pushem)

**Nie wypychasz gałęzi i nie otwierasz PR-a, dopóki gałąź nie zawiera całego `origin/develop`.**
Powód: kart chodzi kilka równolegle, `develop` przesuwa się w trakcie ticketa, a PR z konfliktami
zrzuca ich rozwiązanie na użytkownika. Konflikt rozwiązuje ta sesja, która go wywołała — tylko ona
zna swój zakres. Użytkownik ma dostać PR gotowy do merge'a, bez „Resolve conflicts".

```bash
tools/sync-z-develop.sh        # cwd = worktree ticketa: .worktrees/<TICKET-ID>
```

Skrypt robi `git fetch origin --prune`, dociąga ewentualne commity z `origin/<gałąź>` i scala
`origin/develop` **mergem, nie rebasem** (tak wygląda cała historia tego repo, a gałąź mogła już
zostać wypchnięta — rebase wymusiłby `--force`). Operacje na `.git` ponawia przy blokadach
(`tools/lib-ponow.sh`) — repo ma kilkadziesiąt worktree kart na jednym `.git`.

Kody wyjścia:
- `0` — gałąź była już aktualna, nic nie weszło → idź do Kroku 17;
- `10` — **scalone czysto, ale coś weszło** → bramki od nowa (niżej), dopiero potem Krok 17;
- `2` — konflikty do ręcznego rozwiązania;
- `1` — warunek wstępny (niezacommitowane zmiany, HEAD odłączony, gałąź bazowa);
- `3` — uwierzytelnienie przy `git fetch` — to do użytkownika, nie ponawiaj w kółko.

Jeśli skryptu nie ma (stara gałąź), zrób to samo ręcznie:
`git fetch origin && git merge --no-edit origin/develop`.

**Wyjście `2` — konflikty rozwiązujesz TY, teraz:**
1. Dla każdego pliku z listy połącz **obie** strony — zmiana z `develop` zostaje, Twoja zostaje.
   Nie „wygrywaj" całym plikiem (`--ours` / `--theirs`) bez przeczytania, co w nim jest.
2. `git add <plik>` dla każdego, potem `git commit --no-edit`.
3. Uruchom skrypt ponownie — ma wyjść „Gałąź zawiera już całe origin/develop".
4. **Nie rób `git merge --abort`** i nie omijaj synchronizacji, żeby „zdążyć z PR-em".
5. Jeśli konflikt jest merytoryczny i nie wiesz, która wersja jest poprawna (dwie karty zmieniły
   to samo zachowanie, cudza migracja zajęła Twój numer, ktoś zmienił sygnaturę, którą wołasz) —
   **STOP, pytasz użytkownika**. To jedyny przypadek, w którym przerywasz ciszę Fazy 3–6.
6. Konflikt w pliku współdzielonym (`docs/rebuild-roadmap.md`, `docs/spec-backend.md`,
   `docs/karty/README.md`) = ktoś złamał zasadę „karty piszą we własnych plikach" (CLAUDE.md).
   Rozwiąż zachowując OBA wpisy i odnotuj to w `raport.md` → „Follow-up".

**Po każdym scaleniu, które coś przyniosło (wyjście `10`) — bramki od nowa:**
lint, typecheck, build, test (Krok 9), a jeśli ticket dotyka kontraktu, także GATE na fixtures.
Merge łączy dwie zmiany, z których każda osobno przechodziła; dopiero razem mogą się wykluczać.
Czerwona bramka po merge'u = naprawiasz przed pushem, nie po. Wynik dopisz do `raport.md`
(„Test results": że bramki przebiegły **po** synchronizacji z `develop`, z datą/SHA bazy).

Sprawdź też numer migracji, jeśli ticket ją dodaje: po ściągnięciu `develop` mogło dojść do
kolizji numeru (zob. `docs/` i zasady migracji) — dwie karty potrafią zarezerwować ten sam.

### Step 17: Push + PR

Dopiero teraz — po czystym Kroku 16 i zielonych bramkach. Treść PR-a (format niżej) zapisz do
pliku i wypchnij jednym poleceniem:

```bash
tools/push-i-pr.sh --tytul "<TICKET-ID>: <title>" --tresc-plik docs/tickets/<TICKET-ID>/pr-body.md
```

Skrypt robi po kolei: sprawdza dostęp `gh` → **powtarza synchronizację z Kroku 16** (żeby nie
wypchnąć gałęzi, którą `develop` wyprzedził w międzyczasie) → `git push -u origin <gałąź>` →
`gh pr create --base develop` → odczyt scalalności. **Blokady ponawia sam**: przy
`index.lock` / `cannot lock ref` / limicie GitHuba czeka 5 s, 15 s, 40 s, 90 s, 180 s i próbuje
ponownie (`PONOW_PROBY`, `PONOW_PRZERWY` w env, jeśli chcesz inaczej). Przy `[rejected]
(non-fast-forward)` sam robi sync i próbuje raz jeszcze. `--base develop` jest w skrypcie na
sztywno-domyślnie (`--baza` zmienia): domyślną gałęzią repo jest `main`, a PR ticketa do `main`
to błąd.

**Kody wyjścia i co z nimi zrobić:**

| Kod | Znaczenie | Twoja reakcja |
|---|---|---|
| `0` | wypchnięte, PR istnieje, `MERGEABLE` | Krok 18 |
| `1` | warunek wstępny (niezacommitowane zmiany, brak pliku treści) | popraw i powtórz |
| `2` | konflikty z `develop` | rozwiąż (Krok 16), bramki, powtórz |
| `3` | **uwierzytelnienie `gh`/git** | **NIE ponawiaj** — zgłoś użytkownikowi, to jego decyzja (`gh auth login`) |
| `4` | sync wciągnął zmiany z bazy | przebiegnij bramki, powtórz |
| `5` | PR jest, ale GitHub widzi `CONFLICTING` | sync + bramki + `git push`, sprawdź ponownie |
| `6` | blokada nie ustąpiła mimo ponawiania | poczekaj i uruchom **raz** jeszcze; dalej `6` → zgłoś użytkownikowi, co blokuje |

**Nie zapętlaj się.** Skrypt już odczekał swoje. Jeśli po drugim ręcznym podejściu dalej `3` lub
`6` — kończysz i piszesz użytkownikowi, co konkretnie blokuje (treść błędu, nie domysł).

Ręczny wariant, gdy skryptu nie ma na gałęzi:

```bash
git push -u origin <branch-name>
gh pr create --base develop --title "<TICKET-ID>: <title>" --body-file <plik>
gh pr view --json mergeable,mergeStateStatus -q '.mergeable + " / " + .mergeStateStatus'
```

W wariancie ręcznym sam ponawiasz: przy `index.lock` / `cannot lock ref` odczekaj ~15 s i powtórz
(inna karta trzyma to samo `.git`), przy `[rejected] (non-fast-forward)` zrób sync i wypchnij
jeszcze raz, przy `CONFLICTING` — sync + bramki + push. Błąd uwierzytelnienia = stop i zgłoszenie
użytkownikowi.

**Wariant dla sesji w przeglądarce (`claude.ai/code`) — tam NIE MA `gh`.** Zmierzone 2026-09-24
(ticket 157): binarki `gh` nie ma w kontenerze, więc `tools/push-i-pr.sh` i każde `gh …` padnie na
`command not found`. Wtedy:

1. **Synchronizacja z `develop`: normalnie** — `tools/sync-z-develop.sh` to czysty `git` i działa.
2. **Push: normalnie** — `git push -u origin <branch-name>`.
3. **Pull request: narzędziami MCP GitHub**, nie `gh`. Nazwy weź z listy narzędzi swojej sesji
   (w przelocie działały `mcp__github__get_me`, `mcp__github__list_pull_requests`); treść PR-a
   podajesz jako tekst z `docs/tickets/<TICKET-ID>/pr-body.md`, baza to `develop`.
4. **Odczyt scalalności:** tym samym narzędziem MCP, którym czytasz pull requesta — zamiast
   `gh pr view --json mergeable`.

⚠ **`403` przy `git push` albo przy tworzeniu gałęzi przez MCP („Claude doesn't have GitHub access
to …") to NIE brak uprawnień użytkownika.** To brak zainstalowanej aplikacji Claude GitHub App na
repozytorium — konto może mieć `permission: write` i `push: true`, a zapis i tak wróci z 403.
**Ponawianie nic nie da: stop i zgłoszenie użytkownikowi** z tym rozróżnieniem i z adresem
https://github.com/apps/claude/installations/select_target. Nie próbuj obejść tego innym zdalnym
repozytorium ani `--force`.

⚠ Hooki w takiej sesji na starcie nie są aktywne (`core.hooksPath` pusty) — włącza je `npm ci`
w `rebuild/backend` (skrypt `prepare`) albo `tools/wlacz-hooki.sh`. Nie licz na to, że `pre-push`
odbije nieaktualną gałąź; synchronizację z Kroku 16 przeprowadź świadomie.

**PR body (exactly this format)** — zapisz go do `docs/tickets/<TICKET-ID>/pr-body.md`
i podaj jako `--tresc-plik` (plik zostaje w repo razem z resztą artefaktów ticketa):

```markdown
## Ticket
<TICKET-ID> — <title>

## Summary
<from raport.md Summary, 2-3 sentences>

## Problem / Motivation
<from plan.md Context + Description, in 2-3 sentences>

## Solution
<from raport.md Changes — high-level bullet list>

## Design decisions
<from plan.md Decisions — bullet list with rationales>

## Tests
<from raport.md Test results>

## Breaking changes
<from raport.md — or "None">

## Follow-up
<from raport.md Follow-up — or "None">

## Review
<paste the full content of docs/tickets/<TICKET-ID>/review.md as collapsed details>

<details>
<summary>Code review</summary>

[review.md content]

</details>

---
Ticket docs: `docs/tickets/<TICKET-ID>/`
Zsynchronizowane z `develop` (`<SHA origin/develop w chwili merge'a>`); bramki przebiegnięte po synchronizacji.
```

### Step 18: Cleanup worktree

After successful push + PR create **remove the worktree**. Only if everything is clean — otherwise skip and tell the user what's blocking.

Conditions: push OK, PR URL returned, `git status --porcelain` empty, `git log origin/<branch>..HEAD` empty.

```bash
# from the main repo, not from inside the worktree
git worktree remove .worktrees/<TICKET-ID>
```

Don't delete the local branch. Don't force `--force` — if `remove` failed, leave the worktree and give the user the command for manual cleanup.

### Step 19: Final report to the user

Write to the user **briefly**:
- PR URL
- **Stan scalalności** — jedna linia: `Zsynchronizowane z develop (<SHA>), PR: MERGEABLE` albo co konkretnie koliduje i dlaczego nie dało się rozwiązać
- One sentence on what was done
- Anything that didn't get done, if so
- **If there are things requiring their manual verification** (from "Breaking changes" or "Docs review needed") — list them explicitly; same for env vars to add, etc.
- **If there are follow-up tickets** — list them (the user wants to see what was deferred)
- **Worktree status** — one line:
  - Removed: `Worktree <path> cleaned up.`
  - Skipped with reason: `Worktree <path> remains: <reason> — manually: git worktree remove [--force] <path>`

End. Don't spawn any further subagents, don't write anything more.
