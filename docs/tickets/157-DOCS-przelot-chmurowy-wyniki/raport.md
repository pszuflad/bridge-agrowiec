# 157-DOCS-przelot-chmurowy-wyniki — raport wdrożenia

## Summary

Wyniki przelotu diagnostycznego z sesji w przeglądarce (Ania, konto `Devilian07`, 2026-09-24) są
naniesione na bazę wiedzy. Najważniejsze: **w kontenerze chmurowym nie ma `gh`**, więc
`tools/push-i-pr.sh` tam nie działa, a **zapis na GitHubie wraca 403 z powodu braku aplikacji Claude
GitHub App na repozytorium — nie z powodu uprawnień konta Ani** (ma `write`/`push`). Bramki backendu
w chmurze przechodzą w całości (1844 testy, ~86 s).

## Changes

- `CLAUDE.md` → „Środowisko": nowy punkt **„Sesja w przeglądarce (`claude.ai/code`) NIE MA `gh`"** —
  skutki (`push-i-pr.sh` nie działa, `sync-z-develop.sh` działa, PR przez MCP), 403 jako brak
  aplikacji z adresem instalacji i jawnym rozróżnieniem od uprawnień konta, hooki włączające się
  po `npm ci`, lista rzeczy działających i niedziałających. Drugi nowy punkt: **szum `DB_PATH:
  Required` / „kopia-bazy: brak DB_PATH" w `npm test` jest oczekiwany** (dwa testy, numery linii).
- `.claude/commands/feature.md` → Krok 17: **„Wariant dla sesji w przeglądarce — tam NIE MA `gh`"**
  (cztery kroki: sync normalnie · `git push` normalnie · PR narzędziami MCP · scalalność tym samym
  narzędziem), plus dwa ostrzeżenia: 403 = stop i zgłoszenie użytkownikowi z adresem instalacji
  (nie ponawiać, nie obchodzić), oraz nieaktywny hook `pre-push` na starcie sesji.
- `docs/karty/TEST.3/karta.md` → „Do koordynatora" p. 2: lista „do sprawdzenia empirycznie"
  zamieniona **w miejscu** na wyniki przelotu (co działa, co jest blokerem, czego nie dało się
  sprawdzić, wniosek dla dokumentu Ani).
- **Nowe:** `docs/tickets/157-DOCS-przelot-chmurowy-wyniki/{plan,raport,pr-body}.md`
- **Bez zmian:** `docs/instrukcja-pracy-dla-ani.md` — jej rozdział o mergowaniu i sprawdzaniu
  wdrożenia opisuje czynności po stronie GitHuba i pozostaje prawdziwy.

## Deviations from plan

Brak.

## Test results

- **Gate odbudowy: N/D** — ticket nie dotyka API ani schematu; zero zmian w `rebuild/`.
- **Bramki backendu: nie dotyczą** (jak wyżej). Kontrola: `git diff --name-only origin/develop HEAD`
  → `CLAUDE.md`, `.claude/commands/feature.md`, `docs/karty/TEST.3/karta.md`, artefakty ticketa.
- **Zweryfikowane przeze mnie w tej sesji (nie przyjęte z raportu):**
  - uprawnienia konta: `gh api repos/pszuflad/bridge-agrowiec/collaborators` → `Devilian07`
    `push: true`, `admin: false`; `.../collaborators/Devilian07/permission` → `permission: write`.
    **Wniosek: 403 nie pochodzi z uprawnień konta** ✓
  - źródło szumu `DB_PATH`: `rebuild/backend/test/kopia-bazy.test.ts:117` i
    `rebuild/backend/test/selly.csv-cli.test.ts:110` — oba testy celowo uruchamiają skrypt/CLI bez
    `DB_PATH` i sprawdzają, że przerywa. **Wniosek: oczekiwane wyjście, nie defekt** ✓
- **Pozostałe fakty pochodzą z przelotu** (Node 22.22.2, czasy bramek, 1844 testy, numer 157
  z rezerwacji, 403 przy `git push` i `mcp__github__create_branch`, brak `gh`) — w `CLAUDE.md`
  i w karcie oznaczone datą i kontem, na którym zmierzono, żeby dało się to podważyć pomiarem.
- **Bez osobnego przebiegu review** — trzy edycje tekstowe, każda oparta na fakcie sprawdzonym
  wyżej albo na dosłownym cytacie z przelotu; zmiana jest pilna (sesja testowa Ani).

## Breaking changes

None.

## Follow-up

1. **⛔ BLOKER po stronie użytkownika: zainstalować aplikację Claude GitHub App na
   `pszuflad/bridge-agrowiec`** — https://github.com/apps/claude/installations/select_target.
   Do tego czasu żadna sesja w przeglądarce nie dojdzie do „push + PR", więc instrukcja dla Ani
   jest wykonalna tylko w części „zgłoś przez `/feature`". Uprawnień Ani zmieniać NIE trzeba.
2. **Powtórzyć przelot po instalacji** — potwierdzić `git push`, utworzenie PR-a przez MCP i to,
   czy hook `pre-push` się odezwie (w tym przelocie nie zdążył: 403 przyszedł wcześniej).
3. **Rozważyć, czy `tools/push-i-pr.sh` ma sam rozpoznawać brak `gh`** i kończyć zrozumiałym
   komunikatem „jesteś w sesji bez `gh` — użyj wariantu MCP z Kroku 17" zamiast `command not found`.
   Ścieżki MCP skrypt wykonać nie może (to warstwa sesji, nie basha), ale diagnozę tak.
4. Niezmienione z ticketów 152 i 156: wariant `/feature` z pytaniami biznesowymi dla Ani i jawnym
   krokiem tworzącym wpis w backlogu; błędny odsyłacz w `CLAUDE.md` do `CHANGELOG.md:101`; brak
   twardej bramki na `SELLY_CSV_DIR` (`#139.2`); odsyłacz z `docs/cutover.md`.

## Korekta w trakcie ticketa — `develop` JEST chroniony (obala trzy wcześniejsze zdania)

Przy pisaniu instrukcji instalacji aplikacji sprawdziłem stan repozytorium i wyszło coś, co obala
założenie ciągnięte od ticketu 134:

- repozytorium `pszuflad/bridge-agrowiec` jest **publiczne** (`gh api repos/... --jq .private` →
  `false`), właściciel to konto osobiste (`type: User`), organizacji nie ma;
- na `develop` stoi **aktywny ruleset** `21299243` (`enforcement: active`, zakres dokładnie
  `refs/heads/develop`, `updated_at` 2026-09-23 21:34): wymaga **pull requesta** i **przejścia
  trzech sprawdzeń** (`backend`, `frontend`, `synchronizacja`), zakazuje usunięcia gałęzi
  i `non-fast-forward`; wymaganych zatwierdzeń: **0**; obejście: jedna rola repozytorium
  (`RepositoryRole` id 5, `bypass_mode: always`) — czyli admin, a `Devilian07` ma `admin: false`;
- `gh api repos/.../branches/develop --jq .protected` → `true`;
- **dowód na żywo:** PR #172 tego ticketa ma `mergeable: MERGEABLE`, ale
  `mergeStateStatus: **BLOCKED**` — dopóki sprawdzenia nie przejdą, GitHub przycisku nie daje.

**Co z tego poprawiłem (w miejscu, nie dopiskiem):**
1. `docs/instrukcja-pracy-dla-ani.md` — zdanie „GitHub nie zablokuje Ci przycisku przy czerwonym
   znaczku… to Ty jesteś ostatnim sprawdzeniem" było **nieprawdą**. Teraz: przycisk jest wtedy
   nieaktywny, nad nim komunikat „Required statuses must pass before merging", to nie awaria
   i nie brak uprawnień. Poprawiony też zakaz 1 w „Czego nie robimy" — nie „umowa, nie zamek",
   a realne zabezpieczenie po stronie GitHuba.
2. `CLAUDE.md` — punkt 2 w „Zasada jest egzekwowana mechanicznie" opisywał CI jako „sygnał, który
   łapie kogoś, kto hooków nie włączył". Teraz opisuje ruleset z parametrami, rolę z obejściem,
   różnicę `mergeable` vs `mergeStateStatus` oraz to, że `tools/push-i-pr.sh` czyta tylko
   `mergeable` (`:113`), więc jego „Scalalny: MERGEABLE" nie znaczy „gotowe do merge'a".
   Oznaczyłem też jako nieaktualne `134-CHORE-praca-w-chmurze/plan.md:4-6,21-22` („rulesety dają
   403 na planie Free", „CI jest sygnałem, nie blokadą") — mierzone przed włączeniem rulesetu.
3. Punkt o hookach w sesji chmurowej: brak hooka to gorszy komunikat o błędzie, nie otwarta furtka.

**Moja pomyłka do odnotowania:** w rozmowie z użytkownikiem napisałem wcześniej, że „`develop` nie
ma ochrony gałęzi ani wymogu review". Wzięło się to z `plan.md` ticketu 134, a nie z pomiaru —
jedyne moje `gh api .../protection` padło wtedy na błędzie sieci i nie powtórzyłem go. To ta sama
pułapka, o której mówi `CLAUDE.md` („nie ufaj notatce, zmierz") — tylko że tym razem nieaktualną
notatką był nasz własny plan.

**Follow-up dołożony:** `tools/push-i-pr.sh` powinien wypisywać także `mergeStateStatus`, inaczej
każda sesja raportuje „MERGEABLE" przy PR-ze, którego GitHub nie pozwoli zmergować.
