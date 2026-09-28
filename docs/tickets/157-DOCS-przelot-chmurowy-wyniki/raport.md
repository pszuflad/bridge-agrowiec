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

## Drugi przelot — po instalacji aplikacji: łańcuch DOMKNIĘTY

Aplikacja Claude GitHub App zainstalowana na `pszuflad/bridge-agrowiec` 2026-09-24. Ania powtórzyła
przelot w nowej sesji przeglądarkowej. Wynik:

| Ogniwo | Wynik |
|---|---|
| `git push` nowej gałęzi z sesji w przeglądarce | ✅ **przeszedł, zero 403** |
| pull request narzędziem MCP (bez `gh`) | ✅ **#173** utworzony, baza `develop` |
| stan zaraz po utworzeniu | `mergeable_state: blocked` — zgodnie z przewidywaniem |
| stan po ~2,5 min | `mergeable_state: clean` |
| hook `pre-push` | **milczał** — świeży klon, `tools/wlacz-hooki.sh` nieuruchomiony |

**Dwa fakty dopisane do `CLAUDE.md`:**
1. Instalacja potwierdzona + co znaczy powrót 403 (repozytorium wypadło z listy w „Configure"
   aplikacji, a NIE odebrane komuś uprawnienia).
2. **Nazwa pola różni się między MCP a `gh`:** MCP oddaje `mergeable_state` małymi literami
   (`blocked`, `clean`, `dirty`), `gh` — `mergeStateStatus` wielkimi (`BLOCKED`, `CLEAN`).
   `blocked` zaraz po utworzeniu PR-a jest normalne (sprawdzenia lecą 2–3 min) i nie wolno tego
   czytać jako konfliktu ani braku uprawnień. To dokładnie ta pułapka, która kazałaby sesji
   „naprawiać" coś, co po prostu jeszcze się liczy.
3. Milczenie hooka **potwierdzone empirycznie**, nie tylko wywnioskowane z `package.json` — push
   przeszedł bez ani jednej linii o synchronizacji. Zabezpieczeniem jest ruleset na `develop`,
   nie hook.

**Karta TEST.3:** wpis o blokerze przepisany na „BLOKER ZDJĘTY 2026-09-24" z zachowaniem stanu
przed instalacją jako kontekstu; brak `gh` zostaje faktem środowiska, obchodzonym wariantem
Kroku 17, nie instalacją czegokolwiek.

**Do sprzątnięcia po stronie GitHuba (Ania):** zmergować #173 i usunąć gałąź `chore/probe-chmura-2`.
Bieg „Deploy staging" przy tym merge'u **nie powstanie** — pusty commit nie rusza `rebuild/**`,
co jest zgodne z wyjątkiem opisanym w `docs/instrukcja-pracy-dla-ani.md`.

## Domknięcie ostatniego follow-upu — `/feature` bez wariantu dla Ani

Decyzja użytkownika 2026-09-24: **`/feature` ma zachowywać się dla Ani dokładnie tak samo jak dla
użytkownika.** Pytania techniczne i architektoniczne też idą do niej i ona decyduje; ryzyko
użytkownik bierze na siebie („najwyżej będzie na nią").

**Skutek: `.claude/commands/feature.md` Krok 3 NIE jest zmieniany** — follow-up „wariant `/feature`
dla zgłoszeń Ani" z ticketów 156 i 157 jest tym samym zamknięty jako **odrzucony świadomie**, nie
zapomniany. Uzasadnienie odrzucenia (do zapamiętania, bo wróci): filtrowanie pytań za Anię odebrałoby
jej decyzje, o których nawet by nie wiedziała, a wagę sprawy dla sprzedaży zna ona, nie sesja.

**Jedyna zmiana, jaka z tego weszła** — `docs/instrukcja-pracy-dla-ani.md`, „Czego się spodziewać
po drodze" p. 1: uprzedzenie, że część pytań będzie techniczna i że nie odsiewamy ich za nią, oraz
jawne pozwolenie **„nie wiem, zapytaj Pawła" jako pełnoprawna odpowiedź**. Powód: bez tego zdania
przy pierwszym pytaniu o projekcję albo migrację Ania zgadnie, a zgadywanie jest dla projektu gorsze
niż odłożenie jednej decyzji. Praca idzie wtedy dalej tym, co nie zależy od odpowiedzi.

Otwartych follow-upów z tej fali zostaje: brak jawnego kroku tworzącego wpis w backlogu
(`feature.md`), błędny odsyłacz w `CLAUDE.md` do `CHANGELOG.md:101`, brak twardej bramki na
`SELLY_CSV_DIR` (`#139.2`), odsyłacz z `docs/cutover.md`, `push-i-pr.sh` bez `mergeStateStatus`.
