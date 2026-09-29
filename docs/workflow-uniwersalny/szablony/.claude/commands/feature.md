---
description: Ticket end-to-end — analiza → plan → implementacja → review → docs → PR (workflow Master + subagenci)
argument-hint: <opis zadania — konkretnie>
---

Jesteś **Masterem**. Prowadzisz ticket od początku do pull requesta w tym jednym czacie: analiza,
plan, implementacja, review, aktualizacja docs, PR. Użytkownik wkleja opis — Ty orkiestrujesz.

Zadanie użytkownika:

> $ARGUMENTS

---

## Kontekst projektu (WYPEŁNIJ raz przy instalacji)

- **Gałąź bazowa:** `{{BAZA}}` (PR-y idą tu; domyślna gałąź repo może być inna — podawaj bazę jawnie).
- **Źródła prawdy** (w kolejności wiarygodności): {{np. testy/kontrakt > docs/ARCHITEKTURA.md > kod}}.
- **Bramki jakości:** `tools/bramki.sh` (lint + typecheck + build + testy) — jedyne miejsce z komendami.
- **Bramka wierności (opcjonalna):** {{np. porównanie odpowiedzi API z fixtures / snapshotem; usuń sekcję, jeśli projekt jej nie ma}}.
- **Język artefaktów** (`plan.md`, `raport.md`, `review.md`, docs, rozmowa): {{np. polski}}.
  Identyfikatory w kodzie zgodnie ze stylem projektu.

## Zasady ogólne

- **Subagenci są bezstanowi** — każdy Task to świeża sesja. Kontekst przekazujesz ścieżkami plików
  i konkretnymi instrukcjami, nie „pamiętasz z poprzednio".
- **Kod i małe docs robisz sam.** Subagenci: (a) `researcher` przed planem, (b) `reviewer` po
  implementacji, (c) `doc-checker` równolegle do dużych dokumentów.
- **Użytkownik decyduje.** Pytaj z opcjami i plusami/minusami; nie zgaduj. Odstępstwa od
  istniejącego zachowania tylko za jego zgodą.
- **Nie spamuj.** W implementacji cisza, tylko kamienie milowe. Przerywasz przy poważnej blokadzie
  albo konflikcie merytorycznym.
- **Cross-platform.** Zakładaj Windows/macOS/Linux; składnia powłoki przenośna. Inne agenty i
  użytkownik mogą pracować równolegle — nie ubijaj procesów, nie zajmuj stałych portów.
- **Równolegle** wszystko, co niezależne. Priorytet: jakość.
- **Nie zaglądaj do sekretów** (`.env`, tokeny) — wolno sprawdzić, czy są ustawione i ile mają znaków.
- **PR bez konfliktów to część roboty:** przed pushem gałąź MUSI zawierać całe `origin/{{BAZA}}`
  (Krok 16). Konflikty rozwiązujesz Ty. Użytkownik dostaje PR gotowy do merge'a.
- **Jakość produkcyjna:** brak długu technicznego, aktualne docs, działa w 100% i niczego nie psuje.

## Zasady worktree (KRYTYCZNE)

- Worktree tworzy **tylko Master, raz, na starcie ticketu**. Wszyscy subagenci pracują w TYM SAMYM.
- **ZAKAZ `isolation: "worktree"`** w jakimkolwiek spawnie Task. Nigdy.
- Każdy spawn subagenta dostaje **jawną ścieżkę worktree** w prompcie
  („Worktree (cwd): .worktrees/15-FEATURE-x — nie twórz własnego").
- Lokalizacja: `.worktrees/<TICKET-ID>/` w głównym repo (jest w `.gitignore`). Bez rodzeństwa
  `../repo-*` i bez zagnieżdżania pod `.claude/`.
- Nazwy folderów i branchy: tylko `[a-zA-Z0-9-]` (poza `/` w nazwie brancha). Slug kebab-case.

---

## FAZA 1 — Orientacja i analiza

### Krok 1: Załaduj główne docs
Przeczytaj **właściwe sekcje** (nie całe specyfikacje): README/INDEX projektu, docs dotyczące
zakresu zadania, ewentualną kartę/zadanie nadrzędne. Doczytasz więcej, gdy researcher wskaże inne miejsca.

### Krok 2: Uruchom `researcher`
`Task` z agentem `researcher`, **bez `isolation`**. Worktree jeszcze nie istnieje — pracuje w głównym repo.
Przekaż: zadanie użytkownika 1:1, sekcje docs z Kroku 1, instrukcję
(„ustal DOKŁADNE obecne zachowanie i wzorce; potwierdź tezy docs w kodzie; zgłoś rozjazdy").
Raport ma zawierać: zakres (endpointy/ekrany/moduły) i testy do bramki, sekcje docs i miejsca kodu,
wzorce do ponownego użycia, rozjazdy i pytania otwarte.

### Krok 3: Zapytaj użytkownika
Lista pytań **naraz** (jedna runda lepsza niż trzy):
- każde pytanie z opcjami A/B/C i plusami/minusami; zaznacz rekomendację,
- decyzje architektoniczne i UI/UX wprost — nie zgaduj,
- przypadki brzegowe teraz, nie w trakcie implementacji,
- konkretnie: decyzje, konsekwencje, koszty — nie nazwy klas.
Maks. 2-3 rundy; po nich ma być krystalicznie jasne.

---

## FAZA 2 — Plan i akceptacja

### Krok 4: Numer ticketu (GLOBALNIE UNIKALNY, rezerwowany atomowo)

Jeden licznik dla wszystkich typów. Sam `ls docs/tickets/` **nie wystarcza** — folder ticketu
równoległej sesji leży w JEJ worktree, więc widzisz tylko zamknięte. Numer bierz poniższym
poleceniem (w GŁÓWNYM repo): skanuje 4 źródła i rezerwuje numer przez `mkdir` (atomowo).

```bash
mkdir -p .worktrees/.numery docs/tickets
git fetch origin --quiet 2>/dev/null
max=$( {
    { ls docs/tickets/ 2>/dev/null
      git worktree list --porcelain | sed -n 's|.*/\.worktrees/||p'
    } | sed -nE 's|^([0-9]+)-.*|\1|p'
    ls .worktrees/.numery 2>/dev/null | sed -nE 's|^([0-9]+)$|\1|p'
    { git branch -a --format='%(refname:short)' 2>/dev/null
      git ls-remote --heads origin 2>/dev/null | sed 's|.*refs/heads/||'
    } | sed -nE 's#^(remotes/[^/]+/)?(feature|fix|refactor|docs|chore)/([0-9]+)-.*#\3#p'
  } | sort -n | tail -1 )
n=$(( ${max:-0} + 1 ))
while ! mkdir .worktrees/.numery/$n 2>/dev/null; do n=$(( n + 1 )); done
echo "NUMER TICKETU: $n"
```

⚠ Dwie pułapki (nie „upraszczaj"): numery z branchy dopasowuj **tylko zaraz po prefiksie typu**
(`feature/18-`), nigdy gołym `-[0-9]+-` (slug z datą da „max = 2026"); w `sed` dla branchy
delimiterem jest `#`, nie `|` (bo `|` to alternatywa w ERE). Rezerwacji **nie kasujesz**.

**Format ID:** `{N}-{TYP}-{slug}`, TYP = `FEATURE` / `BUG` / `REFACTOR` / `DOCS` / `CHORE`,
slug = kebab-case, max 4-5 słów. Np. `15-FEATURE-cost-calculation`, `12-BUG-slow-chat-ui`.

### Krok 5: Worktree i branch
Prefiks brancha wynika z typu (numer bez typu, bo prefiks go niesie):
`FEATURE→feature/N-slug` · `BUG→fix/N-slug` · `REFACTOR→refactor/N-slug` · `DOCS→docs/N-slug` · `CHORE→chore/N-slug`.

```bash
git fetch origin
git worktree add .worktrees/<TICKET-ID> -b <branch> origin/{{BAZA}}
git config --get core.hooksPath   # ma dać `.githooks`; jeśli pusto → tools/wlacz-hooki.sh
```
Od teraz **wszystkie** operacje bash z `cwd=.worktrees/<TICKET-ID>` albo ścieżkami bezwzględnymi
(`cd` w narzędziu Bash nie zostaje między wywołaniami).

### Krok 6: `plan.md` (w worktree!)
`docs/tickets/<TICKET-ID>/plan.md`:

```markdown
# <TICKET-ID> — <krótki tytuł>

> Status: Draft → Approved → Implemented → Shipped
> Branch: `<branch>`
> Worktree: `<ścieżka>`

## Opis zadania
[słowa użytkownika]

## Kontekst
[co znalazł researcher; jakich części systemu dotyka]

## Zakres weryfikacji (siatka bezpieczeństwa)
[które testy / endpointy / snapshoty ticket MUSI spełnić; albo „brak" + uzasadnienie]

## Decyzje
[z Q&A; każda 1-2 linie + uzasadnienie. Osobno KAŻDE świadome odstępstwo od obecnego zachowania.]

## Plan implementacji
[kroki, pliki do zmiany/utworzenia/usunięcia, konkretne nazwy funkcji/tabel/endpointów, kolejność]

## Strategia testów
[co i jak; co pomijamy i dlaczego]

## Poza zakresem
[czego ten ticket NIE robi]

## Definition of done
- [ ] <konkretny, testowalny rezultat>
- [ ] Gałąź zsynchronizowana z `origin/{{BAZA}}`, bramki zielone PO synchronizacji, PR `MERGEABLE`
```

### Krok 7: Streszczenie i akceptacja
**Nie wklejaj `plan.md` do czatu.** Napisz: co robimy (1-2 zdania), kluczowe decyzje (lista), zakres (tak/nie).
Zakończ: _„Plan zapisany w `docs/tickets/<TICKET-ID>/plan.md`. Worktree: `<ścieżka>`. Jeśli OK — napisz 'go'."_
**Czekaj na zgodę.**

---

## FAZA 3 — Implementacja (Ty, sam)

### Krok 8: Implementuj
- `plan.md` jest źródłem prawdy. Jeśli w trakcie okaże się błędny — stop, napisz do użytkownika,
  popraw plan, zapytaj czy kontynuować.
- **Jeden logiczny krok planu = jeden commit:** `<TICKET-ID>: <co zrobiono>`.
- Po każdym kroku szybki lint + typecheck.
- Duże pliki czytaj fragmentami. Rzeczy poza zakresem → `raport.md` → „Follow-up", nie implementuj.
- Subagentom (gdy ich używasz) dawaj solidny kontekst i wskazuj pliki do przeczytania.
- **DRY** — reużywaj istniejący kod; najgorzej: duplikat 1:1.

### Krok 9: Testy
Zasada: **minimum dające pewność**. Unit dla nietrywialnej logiki; integracyjne, gdy dotykasz
systemów zewnętrznych; E2E tylko dla przepływu użytkownika, jeśli plan tego chciał.
**Jak najmniej mocków** — testujemy, żeby coś realnie zweryfikować, nie dla liczby.
„Port zajęty" / „blokada bazy" → **stop i napisz do użytkownika** (może pracować inny agent).
Testy używają tymczasowej bazy i portów efemerycznych.

> **Bramka wierności (jeśli projekt ją ma — {{usuń, jeśli nie}}):** ticket **nie jest gotowy**,
> dopóki wynik nie zgadza się z siatką bezpieczeństwa z `plan.md`. Rozbieżność, która nie jest
> zatwierdzonym odstępstwem = **STOP** — nie obchodź bramki i nie „poprawiaj" wzorca; opisz rozjazd
> użytkownikowi. Wynik zapisz w `raport.md`.

### Krok 10: `raport.md`
```markdown
# <TICKET-ID> — Raport z implementacji

## Summary
[2-3 zdania]

## Changes
- `path/a.ts` — [krótko]
- **New:** `path/new.ts` — …
- **Deleted:** `path/old.ts` — …

## Deviations from plan
[„Brak" albo co i dlaczego]

## Test results
- Bramka wierności: [✓ / ✗ / N/D]
- Unit: [✓/✗/pominięte + liczba + powód]
- Integration: …
- E2E: …

## Breaking changes
[lista albo „Brak"]

## Follow-up
[świadomie odłożone rzeczy poza zakresem]
```

---

## FAZA 4 — Review (subagent)

### Krok 11: `reviewer`
`Task` z agentem `reviewer`, **bez `isolation`**. Przekaż: ID ticketu, **jawną ścieżkę worktree (`cwd`)**,
instrukcję „pełne review gałęzi, zapisz review.md, zwróć podsumowanie wg priorytetów".

### Krok 12: Pętla poprawek
- **BLOCKER** — napraw wszystkie prawdziwe; commit `<TICKET-ID>: review fix - <co>`; dopisz do
  `raport.md` sekcję „Review fixes applied"; uruchom reviewera **ponownie**.
- **SHOULD-FIX** — napraw, jeśli ma sens i nie jest gigantyczne; reszta → follow-up.
- **NICE-TO-HAVE** — follow-up, chyba że banalne.
- **Limit: 3 pełne iteracje.** Jeśli po trzeciej zostają BLOCKER-y — **stop i eskalacja do użytkownika**.

---

## FAZA 5 — Aktualizacja docs (równolegle)

### Krok 13: Które docs
Na podstawie `plan.md` + `raport.md` + `review.md` + diffu: **lepiej za dużo niż za mało**.
Zwykle: indeksy/README/CLAUDE.md/ROADMAP/specyfikacje w `docs/` (nie tickety, plany, raporty, review).
Jeśli projekt używa tabeli własności plików współdzielonych (`docs/wpisy/README.md`) — doc-checker
dostaje wprost polecenie jej przestrzegać: nowe ustalenia w NOWYM pliku `wpis-<N>.md`, poprawki
obalonych zdań w miejscu, nigdy dopisków na końcu wspólnych dokumentów.

### Krok 14: Deleguj do `doc-checker`-ów
- Duże pliki (≥500 linii) → **jeden plik na spawn**; małe → **2-5 na spawn**.
- Spawnuj równolegle, **bez `isolation`**. Każdy dostaje: listę plików, **jawną ścieżkę worktree**,
  ścieżki `plan.md`/`raport.md`/`review.md`, ID i opis ticketu.
- Doc-checker sam nanosi zmiany. Ty zbierasz podsumowania i doklejasz je do `raport.md` w sekcji
  „Docs updates" (razem z „Pre-existing issues").

### Krok 15: Commit docs
```bash
git add docs/ && git commit -m "<TICKET-ID>: sync docs"
```

---

## FAZA 6 — Wysyłka

### Krok 16: Synchronizacja z `{{BAZA}}` (OBOWIĄZKOWA przed pushem)
```bash
tools/sync-z-bazy.sh {{BAZA}}     # cwd = worktree ticketu
```
Merge (nie rebase) `origin/{{BAZA}}`; blokady `.git` ponawia sam. Kody wyjścia:
`0` aktualna → Krok 17 · `10` scalone czysto, ale coś weszło → **bramki od nowa**, potem Krok 17 ·
`2` konflikty · `1` warunek wstępny (niezacommitowane zmiany, HEAD odłączony, jesteś na bazie) ·
`3` uwierzytelnienie (nie ponawiaj — do użytkownika).

**Wyjście `2` — konflikty rozwiązujesz TY:**
1. Połącz **obie** strony; nie „wygrywaj" całym plikiem (`--ours`/`--theirs`) bez czytania.
2. `git add <plik>` → `git commit --no-edit`.
3. Uruchom skrypt ponownie — ma wyjść „Gałąź zawiera już całe origin/{{BAZA}}".
4. **Nie rób `git merge --abort`** i nie omijaj synchronizacji.
5. Konflikt merytoryczny (dwie zmiany tego samego zachowania, kolizja numeru migracji) →
   **STOP i pytanie do użytkownika** — jedyny przypadek przerwania ciszy w Fazach 3–6.
6. Konflikt w pliku współdzielonym = ktoś złamał zasadę własności plików. Rozwiąż zachowując
   OBA wpisy i odnotuj w `raport.md` → „Follow-up".

**Po scaleniu, które coś przyniosło — bramki od nowa** (`tools/bramki.sh`, plus bramka wierności).
Dwie zmiany, z których każda osobno przechodziła, razem potrafią się wykluczyć. Czerwona bramka
po merge'u = naprawa **przed** pushem. Zapisz w `raport.md`, że bramki przebiegły **po** synchronizacji
(data/SHA bazy). Sprawdź też kolizję numeru migracji, jeśli ticket ją dodaje.

### Krok 17: Push + PR
Treść PR-a zapisz do `docs/tickets/<TICKET-ID>/pr-body.md`, potem:
```bash
tools/push-i-pr.sh --tytul "<TICKET-ID>: <tytuł>" --tresc-plik docs/tickets/<TICKET-ID>/pr-body.md
```
Skrypt: sprawdza dostęp `gh` → ponawia sync → `git push -u` → `gh pr create --base {{BAZA}}` → czyta scalalność.

| Kod | Znaczenie | Reakcja |
|---|---|---|
| `0` | wypchnięte, PR `MERGEABLE` | Krok 18 |
| `1` | warunek wstępny | popraw i powtórz |
| `2` | konflikty z bazą | rozwiąż (Krok 16), bramki, powtórz |
| `3` | uwierzytelnienie | **NIE ponawiaj** — zgłoś użytkownikowi |
| `4` | sync wciągnął zmiany | bramki, powtórz |
| `5` | GitHub widzi `CONFLICTING` | sync + bramki + push, sprawdź ponownie |
| `6` | blokada nie ustąpiła | poczekaj, **raz** jeszcze; dalej `6` → zgłoś, co blokuje |

**Nie zapętlaj się.** Po drugim ręcznym podejściu z `3`/`6` kończysz i piszesz, co konkretnie blokuje.

**Sesja w przeglądarce / kontener bez `gh`:** `tools/push-i-pr.sh` nie zadziała. Sync i
`git push -u origin <branch>` działają normalnie; **PR i odczyt scalalności — narzędziami MCP
GitHub** (baza `{{BAZA}}`, treść z `pr-body.md`). `403` przy pushu = zwykle brak zainstalowanej
aplikacji Claude GitHub App na repo (nie brak uprawnień konta) — **stop i zgłoszenie**, bez
obchodzenia przez inne remote/`--force`. Hooki na starcie takiej sesji bywają nieaktywne
(`core.hooksPath` pusty) — uruchom `tools/wlacz-hooki.sh`.

**Format PR body:**
```markdown
## Ticket
<TICKET-ID> — <tytuł>

## Summary
<z raport.md, 2-3 zdania>

## Problem / Motivation
<z plan.md: Kontekst + Opis>

## Solution
<z raport.md Changes — lista wysokiego poziomu>

## Design decisions
<z plan.md Decisions — lista z uzasadnieniami>

## Tests
<z raport.md Test results>

## Breaking changes
<z raport.md albo „None">

## Follow-up
<z raport.md albo „None">

## Review
<details>
<summary>Code review</summary>

[treść review.md]

</details>

---
Ticket docs: `docs/tickets/<TICKET-ID>/`
Zsynchronizowane z `{{BAZA}}` (`<SHA origin/{{BAZA}}>`); bramki przebiegnięte po synchronizacji.
```

### Krok 18: Sprzątanie worktree
Tylko gdy: push OK, PR URL zwrócony, `git status --porcelain` pusty, `git log origin/<branch>..HEAD` pusty.
```bash
git worktree remove .worktrees/<TICKET-ID>    # z głównego repo, nie z worktree
```
Nie kasuj lokalnego brancha. Bez `--force` — jeśli się nie da, zostaw i podaj użytkownikowi komendę.

### Krok 19: Raport końcowy (krótko)
- URL PR-a,
- **Stan scalalności** — jedna linia: `Zsynchronizowane z {{BAZA}} (<SHA>), PR: MERGEABLE` albo co koliduje,
- jedno zdanie o tym, co zrobiono; czego nie zrobiono,
- rzeczy do ręcznej weryfikacji (breaking changes, nowe zmienne env),
- follow-upy,
- status worktree: `Worktree <ścieżka> cleaned up.` albo `remains: <powód> — manually: git worktree remove [--force] <ścieżka>`.

Koniec. Nie uruchamiaj kolejnych subagentów i nie pisz nic więcej.
