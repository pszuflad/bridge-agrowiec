## Ticket
`158-DOCS-plan-po-cutoverze` — aktualizacja roadmapy do stanu „system u Ani na testach" + plan prac po cutoverze

## Summary
Ticket koordynacyjny, **wyłącznie `docs/`, zero zmian w `rebuild/` i `contract/`**. Roadmapa pokazywała I15 i plan P jako `🔨`, a FIX.1 jako `⬜ BLOKADA`, mimo że wszystkie 31 kart jest zamkniętych i nie ma ani jednego otwartego PR-a. Ten ticket doprowadza tablicę postępu do stanu faktycznego i dopisuje to, czego w roadmapie w ogóle nie było: **plan prac po cutoverze**.

## Weryfikacja stanu (na `origin/develop` @ `bda6488`)
- `tools/stan-kart.sh` → **31 kart, 0 otwartych**;
- `gh pr list --state open` → **0**;
- worktree 155/156/157 → wszystkie zawarte w `origin/develop`;
- `tools/stan-backlogu.sh --do-decyzji` → 8 wpisów, **żaden nie blokuje cutoveru**.

⚠ Lokalny `develop` był **27 commitów w tyle** — bez `git fetch` TEST.1 wygląda na otwartą, a FIX.1 na nierozliczoną blokadę.

## Zmiany
- **§4** — nota nagłówkowa na 24.09; wiersz `15` → ✅ (14/14 kart), `P` → ✅, nowy wiersz `TEST` (trzy dokumenty dla Ani).
- **Blok I15 w §5** — `Status` → ✅; Faza E → ✅; wiersz `⛔ przed cutoverem` (FIX.1) → ✅ z adnotacją, że bliźniaczy błąd `#154.1` w `src/selly/mapper.ts:197-203` jest świadomie niezałatany.
- **Blok „Poprawki po testach Ani"** — tabela „Po stronie użytkownika" wyzerowana (#94/#95/#98 rozstrzygnięte w DEC.1, trzy pytania do Ani zamknięte ticketem 155).
- **§6** — nota stanu przepisana na 24.09.
- **§6a (nowa) „Przed cutoverem — co zostało"** — siedem czynności z właścicielem i statusem (testy Ani, przegląd widoków, audyt środowiska, weryfikacja schematu, okno) + wykaz decyzji Ani czekających w dokumentach testowych.
- **§6b (nowa) „Po cutoverze — plan prac"** — pięć bloków: okno i pierwsza doba · fala **PO.1–PO.7** z rundy DEC.1 (~3–4 dni) · dług z ostatniej fali (`#154.1`, `#139.2`, `#142.x`, `#137.1`, `#143.x`) · co czeka na Anię (`#108`, `#137.2`, `#100`, `#45`/`#48`/`#50`) · tryb pracy po cutoverze.
- **`docs/przeglad-12-widokow.md`** — cztery poprawki faktyczne zgłoszone przez kartę TEST.1 w „Do koordynatora" (karta nie jest właścicielem tego pliku): opcje filtra stagingu, sufit wierszy w CSV Analityki po P10.5 (dwa miejsca), treść komunikatu ekranu Selly.

## Design decisions
- **Plan po cutoverze idzie do roadmapy, nie do nowego pliku** — roadmapa jest wejściem dla następnej sesji; backlog trzyma uzasadnienia per wpis, nie kolejność prac.
- **Poprawki `przeglad-12-widokow.md` wnoszone teraz, nie zapisywane jako zadanie** — Ania testuje na tym dokumencie w tej chwili, a trzy zdania są nieprawdziwe wobec kodu.
- **`docs/karty/*/karta.md` nietykane** — zamknięte karty są jedynymi właścicielami swoich plików (CLAUDE.md pkt 0); rozliczenie ich zgłoszeń jest w `raport.md`.
- **Katalogi `docs/karty/PO.*` jeszcze nie zakładane** — skład fali może zmienić się po odpowiedziach Ani (`#137.2`, `#108`).

## Znaleziona niespójność
`docs/instrukcja-pelnego-testu.md` pyta Anię o priorytet reguł, a wpis `#89` zamknięto jej decyzją dzień wcześniej (ticket 155) — tickety 149 i 155 szły równolegle. Dokument jest już u Ani, więc go nie ruszam; oznaczone ⚠ w §6a.

## Tests
Nie dotyczy — wyłącznie `docs/`.

## Breaking changes
None.

---
Ticket docs: `docs/tickets/158-DOCS-plan-po-cutoverze/`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
