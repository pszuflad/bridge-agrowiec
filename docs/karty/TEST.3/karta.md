# TEST.3 — zasady pracy Ani z Claude Code (przeglądarka) po testach

> **Stan:** ✅ 2026-09-24 · 152-DOCS-instrukcja-pracy-dla-ani
> **Iteracja:** poza iteracjami (przygotowanie do cutoveru) · **Wpisy backlogu:** — · **Zależy od:** —
> **Ticket:** `152-DOCS-instrukcja-pracy-dla-ani`

Założona przez koordynatora ticketem `148-DOCS-karty-testow`, 2026-09-24, na polecenie użytkownika.

## Po co ten dokument

Po testach Ania będzie zgłaszać uwagi i poprawki. Dotąd robiła to łatkami doklejanymi do
produkcyjnego bundla — stąd duplikaty definicji w `index.cjs`, łatki wpisane w martwy bundel
frontendu i zmiany, o których dowiadywaliśmy się z triażu. Po cutoverze **każda zmiana ma wejść
tą samą drogą co nasze karty**: research → plan → decyzje użytkownika → implementacja → review →
dokumentacja → PR.

## Wymóg twardy: każde zgłoszenie idzie przez `/feature`

Dokument ma **wymagać** od Ani komendy `/feature <opis>` (`.claude/commands/feature.md`) i nie
zostawiać furtki „popraw mi to szybko w czacie". Uzasadnienie dla Ani ma być praktyczne, nie
proceduralne — bez `/feature` znika:
- **researcher** — czytanie kontraktu, fixtures i oryginału ZANIM ktoś zacznie pisać kod,
- **pytania przed pracą** (Krok 3) — Ania decyduje o rozbieżnościach, zamiast odkrywać je po fakcie,
- **plan do zatwierdzenia** (Krok 7) — widać, co się zmieni, zanim się zmieni,
- **review** i **aktualizacja `docs/`** — inaczej dokumentacja rozjeżdża się z kodem w tydzień,
- **PR bez konfliktów zamiast pushu na gałąź główną** (`tools/push-i-pr.sh`).

## Zakres dokumentu

1. **Jak wejść** — `claude.ai/code`, wybór repozytorium i gałęzi (`develop`, nigdy `main`),
   co oznacza worktree i dlaczego jej zmiany nie psują pracy innych.
2. **Jak zgłaszać** — format zgłoszenia: co zrobiłam → co się stało → czego oczekiwałam → zrzut
   ekranu/adres. To samo, czego my od niej wymagamy przy testach.
3. **Trzy rodzaje zgłoszeń i co z nimi robić** (to jest sedno dokumentu):
   - **błąd** (jest inaczej niż w starym Bridge) → `/feature` z opisem różnicy,
   - **świadoma zmiana** (ma być inaczej niż dotąd) → `/feature`; Ania w zgłoszeniu pisze tylko
     „to zmiana świadoma, nie błąd" — zapis do `docs/rebuild-backlog/wpis-<ticket>.md` robi sesja,
     bez ścieżek plików i numeracji w jej dokumencie (decyzja użytkownika, patrz „Decyzje" niżej;
     rozstrzygnięte, znacznik ⚠ nieaktualny),
   - **obserwacja/pytanie** → też `/feature` (typ `DOCS`), żeby nie ginęło w czacie.
4. **Czego nie wolno** — push na `develop`/`main` z pominięciem PR-a, praca bezpośrednio na
   produkcji, `POST /api/selly/sync-supplier` z `dry_run=false`, generowanie CSV z domyślnymi
   `SELLY_CSV_*` (wskazują katalog produkcyjny), wklejanie sekretów do czatu.
5. **Czego się spodziewać** — ile trwa ticket, kiedy dostanie pytania, kiedy PR, kto merguje.

## Jak pisać

⚠ To jedyny z trzech dokumentów, który **nie jest instrukcją testu** — czyta go osoba, która zna
stary Bridge i dopiero poznaje nasz sposób pracy. Ton: krótko, konkretnie, bez żargonu z CLAUDE.md
(„gate", „fixture", „karta" wymagają jednozdaniowego wyjaśnienia przy pierwszym użyciu albo
zastąpienia polskim odpowiednikiem). Zasady, których nie umiesz uzasadnić korzyścią dla Ani,
lepiej pominąć niż wpisać jako nakaz.

Nie przepisuj `.claude/commands/feature.md` — to instrukcja dla agenta, nie dla człowieka. Ania ma
wiedzieć, CO dostanie na każdym etapie i CO ma zatwierdzić, a nie jak Master orkiestruje subagentów.

## Pliki (wyłączna własność)
`docs/instrukcja-pracy-dla-ani.md` (nowy), `docs/karty/TEST.3/karta.md`, `docs/tickets/<ID>/**`.
NIE: `.claude/commands/feature.md` (zmiana samej komendy = osobna decyzja użytkownika), `CLAUDE.md`.

## Decyzje

Cztery decyzje użytkownika, 2026-09-24 (runda pytań ticketu 152):

1. **Zakazy jako UMOWA, nie zamek.** Dokument mówi „tak się u nas pracuje" i uczciwie dodaje, że
   technicznie da się to obejść (hook `pre-push` ma udokumentowane obejście, CI na prywatnym repo
   w planie Free nie blokuje merge'a) — bo „nie da się" byłoby nieprawdą i psuje zaufanie przy
   pierwszym obejściu.
2. **Ścieżka awaryjna = telefon do Pawła.** Nie naprawa, nie łatka w czacie — decyduje człowiek,
   nie czat; `/feature` z researchem i planem jest za wolne na sytuację zatrzymującą sprzedaż.
3. **Backlog: Ania pisze tylko „to zmiana świadoma, nie błąd".** Zapis do
   `docs/rebuild-backlog/wpis-<N>.md` robi sesja; w dokumencie dla Ani zero ścieżek plików i
   numeracji — w praktyce wpisy zakładały dotąd sesje, nie interesariusze.
4. **Wejście opisane krok po kroku** (logowanie → repozytorium → gałąź `develop` → `/feature`),
   bo Ania ma/będzie mieć własne konto i dostęp do repozytorium — założenie wchodzi do warunków
   wstępnych dokumentu.

## Dowiezione

- `docs/instrukcja-pracy-dla-ani.md` — nowy plik, ~2000 słów, 10 rozdziałów: Po co ta kartka ·
  Dlaczego nie poprawiamy już plików produkcji bezpośrednio · Co dostajesz w zamian · Jak wejść ·
  Jak napisać zgłoszenie (szablon + przykład dobry/źle) · Trzy rodzaje zgłoszeń · Czego nie
  robimy · Gdy pali się · Czego się spodziewać po drodze · Do Twojej decyzji.
- Pokryte wszystkie pięć punktów zakresu karty: jak wejść, jak zgłaszać, trzy rodzaje zgłoszeń,
  czego nie wolno, czego się spodziewać.
- Wymóg twardy spełniony: każde zgłoszenie prowadzi do `/feature`, w dokumencie nie ma zdania
  sugerującego „popraw mi to szybko w czacie".
- **Czego karta nie zamawiała, a weszło:** sekcja „Gdy pali się" (decyzja 2) — granica awarii to
  „zatrzymuje sprzedaż", nie każda usterka; sekcja „Do Twojej decyzji" z dwoma pytaniami (czy
  dostęp do repozytorium dla Ani jest już założony; czy telefon jest właściwym kanałem
  awaryjnym) — wzorem pozostałych dokumentów fali.
- Punkt 3 „Zakresu dokumentu" (znacznik ⚠ o drodze wpisu do backlogu) rozstrzygnięty decyzją 3 —
  usunięty z treści punktu, żeby nie sugerował przyszłej sesji zadania do wykonania.
- **Zmienione po zamknięciu karty, ticketem `156-DOCS-ania-merguje-i-sprawdza-wdrozenie`**
  (decyzja użytkownika 2026-09-24): dokument mówił „Włączenie zmiany robi Paweł" — teraz **merguje
  Ania sama**. Doszedł rozdział „Jak włączyć zmianę i sprawdzić, że jest na teście": cztery kroki
  na GitHubie, reguła „tylko przy zielonym ✓" (z ostrzeżeniem, że GitHub nie zablokuje przycisku,
  bo `develop` nie ma ochrony gałęzi) i sprawdzenie biegu **„Deploy staging"** w zakładce Actions
  (`.github/workflows/deploy-staging.yml` — push do `develop` ze zmianą w `rebuild/**`, ~1 min,
  zmierzone na realnych biegach). Kto zmienia ten dokument dalej: ta karta pozostaje jego
  właścicielem.

## Do koordynatora

1. **`/feature` nie ma jawnego kroku „utwórz NOWY wpis backlogu dla świadomej zmiany".**
   `.claude/commands/feature.md:29` nanosi do `docs/rebuild-backlog.md` tylko wpisy już oznaczone
   ✅ TAK; Faza 5 (`:382`) aktualizuje statusy ISTNIEJĄCYCH wpisów. Dokument dla Ani obiecuje zapis
   jej decyzji — część gwarantowana procedurą to sekcja `Decisions` w `plan.md` każdego ticketu
   (zawsze istnieje, z datą); wpis na wspólnej liście backlogu istnieje dziś przez praktykę sesji
   (np. `docs/rebuild-backlog/wpis-153.md`), nie przez nazwany krok w `feature.md`. Karta TEST.3
   zakazuje edycji `feature.md` (zmiana komendy = osobna decyzja użytkownika) — zgłaszam fakt, nie
   poprawiam.
2. **Ticket 134 (praca w chmurze) to na dziś sam plan.** `.claude/settings.json` nie ma bloku
   `hooks`/`SessionStart`, `.claude/commands/feature.md` nie ma wariantu „branch w chmurze" (zero
   wystąpień „chmur"/„cloud"/„claude.ai"), hook `pre-push` włącza się dopiero przez `npm install`
   (`rebuild/backend/package.json:11`). Skutek: `docs/instrukcja-pracy-dla-ani.md` musiał opisać
   zasady jako umowę (decyzja 1), a fragment o „osobnej kopii plików (worktree)" w rozdziale „Jak
   wejść" jest zgodny ze stanem na dziś, ale ticket 134 planuje dla sesji w chmurze inny mechanizm
   (kontener/klon per sesja, worktree „zbędny") — po domknięciu 134 ten fragment trzeba
   zweryfikować i ewentualnie poprawić.
   **PRZELOT WYKONANY 2026-09-24** (sesja Ani w przeglądarce, konto `Devilian07`; wyniki
   naniesione ticketem `157-DOCS-przelot-chmurowy-wyniki`, szczegóły w `CLAUDE.md` → „Środowisko").
   Co wyszło:
   - **DZIAŁA:** Node 22.22.2; pełne bramki backendu (`npm ci` 10 s, lint 7 s, typecheck 7 s,
     build 4 s, `npm test` → **1844 testy zielone, 12 pominiętych, ~86 s**); atomowa rezerwacja
     numeru ticketa mimo braku lokalnego `.worktrees/.numery`; `git worktree add`; widoczność
     `CLAUDE.md` i `.claude/commands/feature.md`; brak sekretów `SELLY_*`/`AGRORAMI_*` w środowisku
     (0 zmiennych — tak ma być); `core.hooksPath` pusty na starcie, włącza się sam po `npm ci`.
   - **BLOKER ZDJĘTY 2026-09-24** — aplikacja Claude GitHub App zainstalowana na repozytorium,
     drugi przelot potwierdził cały łańcuch z sesji w przeglądarce: `git push` bez 403, PR #173
     utworzony narzędziem MCP, stan `blocked` → `clean` po ~2,5 min. Brak `gh` **zostaje** faktem
     środowiska (patrz niżej) — obchodzimy go wariantem Kroku 17 w `feature.md`, nie instalacją.
   - **BLOKER (stan przed instalacją, do kontekstu):** **w kontenerze nie ma `gh`** („command not found") — więc `tools/push-i-pr.sh`
     i każde `gh …` padnie; dostęp do GitHuba idzie wyłącznie narzędziami MCP. Odczyt działa
     (`get_me`, `list_pull_requests`), **zapis wraca 403**: `git push` i `mcp__github__create_branch`
     dają „Claude doesn't have GitHub access to pszuflad/bridge-agrowiec…". **Nie jest to brak
     uprawnień konta** — `Devilian07` ma `permission: write`, `push: true` (sprawdzone przez
     `gh api repos/.../collaborators`); brakuje **instalacji aplikacji Claude GitHub App na
     repozytorium** (https://github.com/apps/claude/installations/select_target). Dopóki tego nie
     ma, żaden ticket przez `/feature` nie dojdzie do „push + PR".
   - **Nie do sprawdzenia w tym przelocie:** czy `pre-push` odbije nieaktualną gałąź przy realnym
     pushu (403 przyszedł wcześniej, hook się nie odezwał).
   - **Wniosek dla dokumentu Ani:** rozdział „Jak włączyć zmianę i sprawdzić, że jest na teście"
     zostaje bez zmian — opisuje to, co robi ONA na GitHubie, i to działa. Zmiany wymagał krok
     WCZEŚNIEJSZY, po stronie sesji: `feature.md` Krok 17 ma teraz wariant bez `gh`.
3. **Błędny odsyłacz w `CLAUDE.md`.** Jako dowód na łatkę `konstrukcja` wpisaną w martwy bundel
   wskazuje `mirror/backend/CHANGELOG.md:101` — dziś jest tam inny wpis (hold-reasons).
   Weryfikowalny dowód leży w tabeli łatek w `deminified/README.md`. `CLAUDE.md` jest zakazany
   przez kartę TEST.3, więc nie poprawiam go sam — zgłaszam.
4. **Brak twardej bramki na `SELLY_CSV_DIR`** — oryginał miał ją w
   `mirror/backend/staging_policy.cjs:131-134`, odbudowa nie ma odpowiednika; otwarte w backlogu
   jako `#139.2` (`docs/rebuild-backlog/wpis-139.md`, ⬜ do decyzji użytkownika). Dokument dla Ani
   łata to dziś zakazem dla człowieka („nie generujemy CSV na próbę"), co jest słabszą ochroną niż
   kod — propozycja: rozważyć przed cutoverem.
5. **Warto rozważyć odsyłacz do `docs/instrukcja-pracy-dla-ani.md` z `docs/cutover.md`.** Ten
   ticket go nie dopisał — `cutover.md` nie jest własnością karty TEST.3, a dopisek groziłby
   konfliktem przy merge'u z inną kartą tej samej fali.
