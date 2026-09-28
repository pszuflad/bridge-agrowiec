## Ticket
157-DOCS-przelot-chmurowy-wyniki — wyniki przelotu diagnostycznego w sesji przeglądarkowej

## Summary
Przelot w Claude Code w przeglądarce (Ania, konto `Devilian07`, 2026-09-24) pokazał dwie rzeczy, których
nie było w żadnym dokumencie: **w kontenerze chmurowym nie ma `gh`** (więc `tools/push-i-pr.sh` tam nie
działa) i **zapis na GitHubie wraca 403, bo na repozytorium nie ma aplikacji Claude GitHub App — a nie
dlatego, że Ania nie ma uprawnień** (sprawdzone: `permission: write`, `push: true`). Bramki backendu
w chmurze przechodzą w całości: 1844 testy zielone, ~86 s. Wyniki naniesione na `CLAUDE.md`,
`feature.md` (Krok 17) i kartę TEST.3.

## Problem / Motivation
Instrukcja dla Ani (`docs/instrukcja-pracy-dla-ani.md`, tickety 152 i 156) obiecuje łańcuch
„zgłoszenie → PR → merge → wdrożenie na test". Ostatnie ogniwo działa (automatyczny deploy po merge'u),
ale nikt nie sprawdził ogniwa środkowego: czy sesja w przeglądarce w ogóle potrafi wypchnąć gałąź
i otworzyć PR. Przelot to rozstrzygnął — nie potrafi, z dwóch niezależnych powodów.

## Solution
- `CLAUDE.md` → „Środowisko": punkt o sesji w przeglądarce (brak `gh`, co zamiast, 403 vs uprawnienia
  konta z adresem instalacji aplikacji, hooki po `npm ci`, co działa i czego nie da się zrobić) oraz
  punkt o oczekiwanym szumie `DB_PATH: Required` w `npm test`.
- `.claude/commands/feature.md` → Krok 17: wariant bez `gh` (sync i push normalnie, PR i scalalność
  przez narzędzia MCP), z jawnym „403 = stop i zgłoszenie, nie ponawiaj i nie obchodź".
- `docs/karty/TEST.3/karta.md`: lista „do sprawdzenia empirycznie" zamieniona w miejscu na wyniki.
- `docs/instrukcja-pracy-dla-ani.md` **bez zmian** — jej rozdział opisuje czynności po stronie
  GitHuba i pozostaje prawdziwy; zepsuty był krok wcześniejszy, po stronie sesji.

## Design decisions
- **Fakty o chmurze do `CLAUDE.md`, nie do karty** — dotyczą każdej sesji w przeglądarce, nie jednego
  dokumentu.
- **Rozróżnienie „uprawnienie konta ≠ dostęp aplikacji" wpisane wprost**, bo sam komunikat 403 kieruje
  diagnozę w złą stronę („dajmy jej uprawnienia") — a uprawnienia już są.
- **Wariant Kroku 17 w komendzie**, bo bez niego sesja chmurowa padnie na `command not found` nawet po
  zainstalowaniu aplikacji. Zmiana komendy na podstawie polecenia użytkownika z 2026-09-24.
- **Szum `DB_PATH` opisany jako oczekiwany** z numerami linii testów, zamiast wpisu w backlogu — nie ma
  tu defektu do śledzenia.

## Tests
- **Gate odbudowy: N/D**, bramki nie dotyczą — zero zmian w `rebuild/`.
- Zweryfikowane w tej sesji, nie przyjęte z raportu: uprawnienia `Devilian07`
  (`gh api repos/.../collaborators`, `.../permission` → `write`) oraz źródło szumu `DB_PATH`
  (`test/kopia-bazy.test.ts:117`, `test/selly.csv-cli.test.ts:110` — oba celowo sprawdzają tę gałąź).
- Pozostałe fakty pochodzą z przelotu i są w dokumentacji opatrzone datą oraz kontem, na którym
  zmierzono.

## Breaking changes
None.

## Follow-up
1. **⛔ Do zrobienia przez admina repo: instalacja aplikacji Claude GitHub App**
   (https://github.com/apps/claude/installations/select_target). Do tego czasu sesja w przeglądarce nie
   dojdzie do „push + PR". Uprawnień Ani zmieniać nie trzeba.
2. Powtórzyć przelot po instalacji — push, PR przez MCP, reakcja hooka `pre-push` (w tym przelocie nie
   zdążył się odezwać).
3. Rozważyć, żeby `tools/push-i-pr.sh` sam rozpoznawał brak `gh` i kończył zrozumiałym komunikatem.
4. Bez zmian z 152/156: wariant `/feature` dla zgłoszeń Ani, błędny odsyłacz w `CLAUDE.md`,
   `#139.2`, odsyłacz z `docs/cutover.md`.

## Korekta w trakcie ticketa — `develop` JEST chroniony
Przy okazji sprawdzania stanu repozytorium wyszło, że założenie z ticketu 134 („prywatne repo, plan Free,
rulesety 403, CI jest sygnałem") jest **nieaktualne**: repo jest publiczne, a na `develop` stoi aktywny
ruleset `21299243` (aktualizowany 2026-09-23) wymagający PR-a i przejścia `backend`, `frontend`,
`synchronizacja`; obejście ma tylko rola admina. Dowód na żywo: ten PR ma `mergeable: MERGEABLE`, ale
`mergeStateStatus: BLOCKED`. Poprawione **w miejscu**: zdanie w dokumencie Ani („GitHub nie zablokuje Ci
przycisku" → blokuje, z komunikatem „Required statuses must pass before merging"), zakaz 1 w „Czego nie
robimy" (nie „umowa, nie zamek", a realne zabezpieczenie) i punkt 2 w `CLAUDE.md` (parametry rulesetu,
różnica `mergeable` vs `mergeStateStatus`, nieaktualność notatki z 134). Szczegóły i przyznanie własnej
pomyłki: `raport.md`, sekcja „Korekta w trakcie ticketa".

## Drugi przelot — łańcuch domknięty
Po instalacji aplikacji Claude GitHub App (2026-09-24) Ania powtórzyła przelot: `git push` z sesji
w przeglądarce **przeszedł bez 403**, pull request **#173** został utworzony narzędziem MCP (bez `gh`),
stan `blocked` zaraz po utworzeniu → `clean` po ~2,5 min. Hook `pre-push` milczał (świeży klon) —
zabezpieczeniem jest ruleset na `develop`, nie hook. Dopisane do `CLAUDE.md`: potwierdzenie instalacji,
co znaczy powrót 403, oraz różnica nazw pól — MCP oddaje `mergeable_state` (`blocked`/`clean`), `gh`
oddaje `mergeStateStatus` (`BLOCKED`/`CLEAN`); `blocked` zaraz po utworzeniu PR-a jest normalne.

## Domknięcie follow-upu — `/feature` bez wariantu dla Ani
Decyzja użytkownika 2026-09-24: `/feature` zachowuje się dla Ani **dokładnie tak samo** jak dla
użytkownika — pytania techniczne i architektoniczne też idą do niej i ona decyduje. `feature.md`
Krok 3 **nie jest zmieniany**; follow-up „wariant dla zgłoszeń Ani" zamknięty jako świadomie odrzucony.
Jedyne, co z tego weszło do dokumentu Ani: uprzedzenie, że pytania techniczne będą, i jawne pozwolenie
„nie wiem, zapytaj Pawła" jako pełnoprawna odpowiedź — żeby nie zgadywała.

## Review
Bez osobnego przebiegu review — trzy edycje tekstowe, każda oparta na fakcie sprawdzonym w repo albo
na dosłownym cytacie z przelotu; zmiana jest pilna przed sesją testową.

---
Ticket docs: `docs/tickets/157-DOCS-przelot-chmurowy-wyniki/`
