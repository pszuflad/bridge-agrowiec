# Uniwersalny workflow Claude Code — instrukcja dla innych projektów

Pakiet odtwarza w dowolnym repozytorium sposób pracy wypracowany w projekcie Bridge:
**Master + subagenci**, ticket od analizy do PR-a, worktree na każde zadanie, obowiązkowa
synchronizacja z gałęzią bazową, bramki jakości i mechaniczne zamki na GitHubie.

Wyciągnięty z: `.claude/commands/feature.md`, `.claude/commands/triaz-zmian.md`,
`.claude/agents/*`, `.claude/settings.json`, `CLAUDE.md`, `tools/*.sh`, `.githooks/pre-push`,
`.github/workflows/ci.yml`, `docs/karty/README.md`, `docs/spec-backend/README.md`,
`docs/rebuild-backlog/README.md`.

## 1. Co dostajesz

```
docs/workflow-uniwersalny/
  README.md                 ← ten plik
  zainstaluj.sh             ← kopiuje pakiet do innego repo (nie nadpisuje istniejących plików)
  szablony/                 ← to, co ląduje w projekcie docelowym
    CLAUDE.md               ← zasady stałe każdej sesji
    .claude/settings.json   ← uprawnienia (allow + deny)
    .claude/commands/feature.md      ← skill /feature (19 kroków, 6 faz)
    .claude/agents/researcher.md     ← analiza przed planem (read-only)
    .claude/agents/reviewer.md       ← review gałęzi po implementacji
    .claude/agents/doc-checker.md    ← aktualizacja docs po tickecie
    tools/bramki.sh                  ← JEDNO miejsce z komendami lint/test/build (do uzupełnienia)
    tools/sync-z-bazy.sh             ← merge origin/<baza> z kodami wyjścia
    tools/push-i-pr.sh               ← push + PR + odczyt scalalności (wymaga gh)
    tools/lib-ponow.sh               ← ponawianie przy blokadach .git / limitach GitHuba
    tools/wlacz-hooki.sh             ← core.hooksPath=.githooks
    .githooks/pre-push               ← odbija push gałęzi bez całej bazy
    .github/workflows/ci.yml         ← joby: synchronizacja + bramki
    docs/wpisy/README.md             ← zasada „jeden plik na ticket” + tryb koordynator/karty
```

## 2. Idea w sześciu zdaniach

1. **Master** (skill `/feature`) prowadzi ticket sam, a subagentów woła tylko do: analizy (`researcher`),
   review (`reviewer`), docs (`doc-checker`). Subagenci są bezstanowi — dostają ścieżki i instrukcje.
2. **Jedno zadanie = jeden worktree** (`.worktrees/<ID>/`) i jeden branch; worktree tworzy tylko Master.
3. **Numer ticketu jest globalnie unikalny** i rezerwowany atomowo (`mkdir`), bo równoległe sesje
   inaczej biorą ten sam numer.
4. **Artefakty ticketu** w `docs/tickets/<ID>/`: `plan.md` (przed zgodą) → `raport.md` → `review.md` → `pr-body.md`.
5. **Przed pushem gałąź musi zawierać całą bazę**; konflikty rozwiązuje autor, a nie recenzent;
   po scaleniu bramki lecą od nowa. Egzekwują to: hook, CI i ruleset.
6. **Równoległe zadania nie dzielą linii** we wspólnych dokumentach: każdy pisze we własnym pliku
   (`wpis-<N>.md`), a wspólne dokumenty tylko się poprawia w miejscu.

## 3. Instalacja w nowym projekcie

### Wariant A — skrypt (zalecany)

```bash
# z tego repo (Bridge) albo z repo, w którym trzymasz pakiet:
docs/workflow-uniwersalny/zainstaluj.sh /ścieżka/do/nowego-repo develop
```

Skrypt kopiuje szablony, podstawia `{{BAZA}}` nazwą gałęzi bazowej, dopisuje do `.gitignore`
`.worktrees/` i `.claude/settings.local.json`, ustawia `core.hooksPath` i **wypisuje wszystkie
placeholdery `{{…}}`, które musisz uzupełnić ręcznie**. Istniejących plików nie nadpisuje —
wypisze „pomijam”, więc możesz go odpalić w projekcie, który ma już własny `CLAUDE.md`
(wtedy wklej sekcje z szablonu ręcznie).

### Wariant B — ręcznie

Skopiuj katalog `szablony/` do korzenia repo, w plikach zamień `{{BAZA}}` na nazwę gałęzi
bazowej, `chmod +x tools/*.sh .githooks/pre-push`, uruchom `tools/wlacz-hooki.sh`.

### Po instalacji — checklista dostosowania (kolejność ma znaczenie)

1. **`tools/bramki.sh`** — wpisz komendy lint/typecheck/build/test dla stosu. Dopóki plik nie jest
   skonfigurowany, kończy się błędem (celowo — żeby nikt nie miał zielonego bez bramek).
2. **`CLAUDE.md`** — nazwa, opis, źródła prawdy, wersja runtime, lista „pułapek” (na start pusta).
3. **`.claude/commands/feature.md`, sekcja „Kontekst projektu”** — źródła prawdy, język artefaktów;
   sekcję „Bramka wierności” zostaw tylko, jeśli masz wiążący wzorzec (kontrakt API, fixtures,
   snapshoty). Inaczej usuń ją w Kroku 9 i w planie („Zakres weryfikacji”).
4. **`.claude/agents/*.md`** — uzupełnij hierarchię źródeł (researcher), język review, listę
   wspólnych dokumentów (doc-checker).
5. **`.github/workflows/ci.yml`** — dopasuj setup środowiska w jobie `bramki`.
6. **Ruleset na gałęzi bazowej** (sekcja 6) — dopiero ten krok zamienia zasady w zamek.
7. **Commit przez PR** (sekcja 5).

## 4. Jak tworzyć własny skill lub agenta

### Skill = plik markdown w `.claude/commands/`

Nazwa pliku jest nazwą komendy: `.claude/commands/feature.md` → `/feature`.

```markdown
---
description: Jedno zdanie — po tym model rozpoznaje, kiedy skill pasuje
argument-hint: <co użytkownik ma podać>
---

Jesteś <rola>. Zadanie użytkownika:

> $ARGUMENTS

## Kroki
...
```

Konwencje, które w Bridge się sprawdziły:
- **`$ARGUMENTS`** wstawia tekst podany po nazwie komendy.
- **Struktura fazowa z numerowanymi krokami** — model wraca do „Kroku 13”, a Ty odsyłasz do niego z innych plików.
- **Konkretne kody wyjścia i tabela reakcji** zamiast „obsłuż błędy”.
- **Reguły zapisane razem z przyczyną** („trzy karty wzięły numer 18 → dlatego atomowa rezerwacja”).
  Model nie „upraszcza” zabezpieczenia, którego powód zna.
- **Jawne zakazy** tam, gdzie automatyka szkodzi (`isolation: "worktree"`).
- **Format wyjścia dla subagentów** podany dokładnie (szablon Markdown) — łatwo go potem skleić.
- Skill nie powtarza zasad z `CLAUDE.md`, tylko odsyła do niego.

Skill z frontmatterem `description` jest widoczny w sesji na liście dostępnych skilli.
Skille „wbudowane” w Claude Code (`code-review`, `simplify`, `init`…) nie leżą w repo.

### Agent = plik markdown w `.claude/agents/`

```markdown
---
name: researcher
description: Kiedy go użyć (Master czyta to przy wyborze agenta)
tools: Read, Glob, Grep, Bash        # WHITELISTA — najmniejszy zestaw, jaki wystarcza
model: sonnet
---

Prompt systemowy agenta: rola, wejście, zasady, dokładny format zwrotu.
```

Zasada doboru `tools` (tak jest w Bridge):

| Agent | Narzędzia | Dlaczego |
|---|---|---|
| `researcher` | Read, Glob, Grep, Bash | tylko czyta — nie może zepsuć repo |
| `reviewer` | + Write | zapisuje wyłącznie `review.md`; kod poprawia Master |
| `doc-checker` | + Edit, Write | sam nanosi zmiany w docs; nie commituje |

Każdy agent ma w prompcie: **worktree od Mastera, nie tworzy własnego**, format zwrotu, zakaz commitowania.

## 5. Jak commitować skille i workflow

Skille to zwykłe pliki w repo — nie ma osobnej rejestracji na GitHubie. Pobiera je każdy klon.

```bash
git checkout -b chore/<N>-workflow-claude origin/<baza>
git add .claude CLAUDE.md tools .githooks .github docs/wpisy
git commit -m "<N>-CHORE: workflow Claude Code (skille, agenci, skrypty, CI)"
tools/sync-z-bazy.sh <baza>          # wymóg z CLAUDE.md
git push -u origin chore/<N>-workflow-claude
# PR do <baza>: gh pr create --base <baza> …  albo narzędziami MCP GitHub w sesji przeglądarkowej
```

Zasady commitowania samych skilli:
- **Zmiana skilla to zmiana procesu → zawsze PR**, nie commit prosto na bazę; recenzent widzi, jak zmienia się workflow.
- **Ustaw `.claude/settings.local.json` w `.gitignore`** — to osobiste ustawienia; `settings.json` idzie do repo.
- **Pliki wykonywalne**: `git add --chmod=+x tools/*.sh .githooks/pre-push`, gdy system plików nie zachowuje bitu.
- **Hooki nie przenoszą się z klonem** — każdy klon raz: `tools/wlacz-hooki.sh` (albo skrypt `prepare` w `package.json`).
- **Aktualizacja skilla, który jest w wielu projektach:** trzymaj pakiet w jednym „źródłowym” repo,
  a w projektach porównuj: `diff -r <źródło>/szablony <projekt>` (instalator nie nadpisuje, więc to
  świadoma decyzja, co przejąć). Zmiany specyficzne dla projektu trzymaj w sekcji „Kontekst
  projektu” i w `CLAUDE.md`, żeby reszta pliku dawała się porównywać 1:1.

## 6. Uprawnienia

### `.claude/settings.json` (w repo, wspólne)

Szablon ma dwie listy:
- **`allow`** — narzędzia i polecenia bez pytania: czytanie (`Read`, `Glob`, `Grep`, `ls`, `cat`, `grep`, `jq`…),
  bezpieczne pisanie (`mkdir`, `cp`, `mv`), `git` w zakresie potrzebnym workflow (`status`, `diff`, `log`,
  `fetch`, `add`, `commit`, `merge`, `push`, `worktree`), `gh pr`, `gh api user`, `gh auth status`
  oraz **własne skrypty** (`tools/sync-z-bazy.sh`, `tools/push-i-pr.sh`, `tools/bramki.sh`).
- **`deny`** — twarde zakazy: `git push --force/-f`, `git reset --hard`, `git clean`, czytanie `.env`.

Uwagi:
- Wzorzec `Bash(polecenie:*)` dopuszcza dowolne argumenty tego polecenia — wpuszczaj wąsko
  (`git push:*`, nie `git:*`). W Bridge jest szeroko (`git:*`, `rm:*`, `ssh:*`) bo to zaufane środowisko
  dewelopera; dla nowych projektów wąska lista jest bezpieczniejszym startem, rozszerzaj ją, gdy
  zobaczysz powtarzające się pytania (skill `fewer-permission-prompts` robi to na podstawie historii).
- **`gh auth status` bywa czerwony** („token in keyring is invalid”) mimo działającego API — dlatego
  `push-i-pr.sh` sprawdza realne `gh api user`, nie `gh auth status`.

### Uprawnienia po stronie GitHuba (ruleset na gałęzi bazowej) — ten krok robi z zasad zamek

Ustawienia → Rules → Rulesets → New branch ruleset, cel: dokładnie `refs/heads/<baza>`, `Enforcement: Active`:
- **Require a pull request before merging**, liczba wymaganych zatwierdzeń: `0` (sam możesz zmergować,
  ale dopiero po zielonych sprawdzeniach) — zwiększ, jeśli pracujecie zespołowo.
- **Require status checks to pass**: `synchronizacja` i `bramki` (nazwy jobów z `ci.yml`).
  Nazwy muszą dokładnie zgadzać się z jobami; check pojawia się na liście dopiero po pierwszym biegu CI.
- **Block force pushes** (`non_fast_forward`) i **Restrict deletions**.
- **Bypass**: tylko rola admina, jeśli w ogóle. Konto z samym `write` obejścia nie ma.

W Bridge ruleset dotyczy repo publicznego; **w prywatnych repo rulesety wymagają płatnego planu**
(zmierzono tam 403 na darmowym planie). Bez rulesetu zostają hook i job CI — sygnał, nie zamek.

### Sesja w przeglądarce (`claude.ai/code`)

- Brak `gh` w kontenerze — `tools/push-i-pr.sh` nie zadziała. `tools/sync-z-bazy.sh` i `git push` działają;
  **PR i stan scalalności przez narzędzia MCP GitHub**. Pole stanu nazywa się tam `mergeable_state`
  (`blocked`/`clean`/`dirty`); `blocked` zaraz po otwarciu PR-a jest normalne (sprawdzenia lecą ~2-3 min).
- **403 przy pushu = zwykle brak zainstalowanej aplikacji Claude GitHub App na repozytorium**, a nie brak
  uprawnień konta. Instalacja: https://github.com/apps/claude/installations/select_target
  (dodaj repo w „Configure”). Ponawianie nic nie da.
- Hook `pre-push` w takiej sesji bywa nieaktywny na starcie — `tools/wlacz-hooki.sh`.

## 7. Wzorzec „triaż zmian z zewnątrz” (opcjonalny skill)

W Bridge `/triaz-zmian` przetwarza commity produkcji (`sync(vps)`), które ktoś inny wprowadził poza
procesem. Uniwersalna wersja — użyj, gdy projekt ma **zewnętrzne źródło zmian** (fork, vendor,
zespół obok, produkcja edytowana ręcznie):

1. Stan przetworzenia w pliku (`docs/triage-state.txt` = SHA ostatnio przetworzonego commita).
2. Lista nowych commitów od tego SHA, filtrowana wzorcem wiadomości.
3. Klasyfikacja każdej zmiany: kod/schemat → wpis do backlogu; tylko dane → jedna linia w „Pominięte”.
4. Wpisy do **własnego pliku ticketu** (`docs/wpisy/backlog/wpis-<N>.md`), nigdy do wspólnego backlogu.
5. Kolumna „Do nowej wersji?” **zawsze ⬜** — decyzja należy do człowieka.
6. Aktualizacja stanu, commit, **bez pusha** (push tylko na prośbę), zwięzłe podsumowanie z listą decyzji.
7. Zasada „zero zmyślania”: opis wyłącznie z diffu i komentarza autora; czego nie wiadomo → „NIEZNANE”.

Zacznij od skopiowania `.claude/commands/triaz-zmian.md` z Bridge i podmień wzorzec commitów,
ścieżki diffu i nazwy plików docs.

## 8. Lekcje z Bridge — dlaczego reguły wyglądają tak, a nie inaczej

| Reguła | Incydent, który ją wymusił |
|---|---|
| Atomowa rezerwacja numeru ticketu (`mkdir`) | 2026-09-03: trzy karty odczytały „max = 17” i wszystkie wzięły 18 |
| Numery z branchy tylko po prefiksie typu | slug `chore/triaz-2026-08-25` dał „max = 2026” |
| `sed` z `#` jako delimiterem dla branchy | z `\|` sed padał po cichu i pomijał źródło numerów |
| Oś podziału = plik dla docs | 7 konfliktów merge'a w roadmapie w 4 dni; potem to samo w spec i backlogu |
| Sync z bazą przed pushem (merge, nie rebase) | PR-y przychodziły z konfliktami i zrzucały je na recenzenta; rebase wymusiłby `--force` |
| Bramki po każdym scaleniu | dwie zmiany osobno zielone potrafią się wykluczyć razem |
| `ponow` tylko dla blokad i sieci | ~46 worktree na jednym `.git` bije się o `index.lock`; auth/non-fast-forward to nie blokada |
| Sprawdzanie `gh api user`, nie `gh auth status` | status krzyczał o keyringu mimo działającego tokenu |
| `mergeable` **i** `mergeStateStatus` | `MERGEABLE` + `BLOCKED` = brak konfliktów, ale sprawdzenia jeszcze nie przeszły |
| Zakaz `isolation: "worktree"` | automatyka tworzyła dodatkowe worktree w `.claude/worktrees/` i rozbijała stan |
| Limit 3 pętli review, potem eskalacja | brak limitu = pętla bez końca na spornym BLOCKER-ze |
| Plan zatwierdzany przed implementacją, potem cisza | użytkownik nie chce oglądać każdego kroku; przerywa się tylko przy blokadzie/konflikcie merytorycznym |
| Pytania w jednej rundzie z opcjami A/B/C | jedna runda tańsza niż trzy; decyzje UI/architektura nie są zgadywane |

## 9. Jak sprawdzić, że instalacja działa

```bash
git config --get core.hooksPath                 # → .githooks
ls -l tools/*.sh .githooks/pre-push             # wszystkie z bitem x
tools/bramki.sh                                 # po uzupełnieniu — zielone
git checkout -b test/hook origin/<baza> && git commit --allow-empty -m t
# na bazie zrób inny commit i wypchnij; potem `git push` z test/hook powinno zostać odbite przez pre-push
tools/sync-z-bazy.sh <baza>                     # kod 10 (scalone) i po nim push przechodzi
```

W nowej sesji Claude Code wpisz `/feature test` — skill powinien być na liście, a Master
powinien zacząć od Kroku 1 (orientacja), nie od kodowania. `researcher`, `reviewer`, `doc-checker`
muszą być widoczne jako dostępne typy agentów.

## 10. Czego ten pakiet NIE przenosi (specyficzne dla Bridge)

- Bramki wierności odbudowy (`contract/fixtures`, `openapi.yaml`) — w szablonie jest opcjonalny slot.
- Pułapki domenowe z `CLAUDE.md` Bridge (Drizzle, SQLite `UPPER()`, bundle FE…) — Twój projekt
  zbiera własne w sekcji „Pułapki tego projektu”.
- Skrypty `tools/stan-kart.sh`, `tools/stan-backlogu.sh`, deploy/audyt VPS — zależą od formatu kart i infrastruktury Bridge;
  jeśli używasz trybu koordynator/karty, napisz analogiczny `stan-kart.sh` czytający linie `> **Stan:**`
  (jest 15-liniowy, wzór w Bridge).
- Konkretne nazwy ruleset/ID i konta — ustawiasz je sam w GitHubie.
