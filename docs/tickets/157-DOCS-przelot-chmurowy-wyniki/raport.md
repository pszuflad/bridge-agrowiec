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
