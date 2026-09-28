## Ticket
145-DOCS-ustalenia-i15-5 — sprostowanie ustaleń karty I15.5 dla koordynatora

## Summary
Ticket 140 (karta I15.5) zgłosił zawężenie zakresu karty I15.11 jako **sprawę otwartą do decyzji koordynatora**. Było już rozstrzygnięte: koordynator zawęził I15.11 do panelu „Braki w cenniku” przed wydaniem promptu, a karta chodzi od 23.09 jako ticket `142-FEATURE-braki-w-cenniku`. Ten PR poprawia dwa pliki, które czyta następna sesja, tak żeby niosły stan faktyczny zamiast pytania.

## Problem / Motivation
`docs/karty/I15.11/wejscie-140.md` czyta w tej chwili **aktywny ticket 142** i w pierwotnym brzmieniu kazał mu wracać do koordynatora z pytaniem o zakres — czyli re-litygować rzecz, którą ten sam koordynator rozstrzygnął, wydając mu prompt. „Do koordynatora” karty I15.5 niosło to samo jako punkt do decyzji, przez co lista otwartych spraw iteracji wyglądała na dłuższą, niż jest.

Przyczyna po stronie ticketu 140: zgłosił „zmianę przypisania zakresu”, nie sprawdziwszy wcześniej stanu fali (`tools/stan-kart.sh`, `git worktree list`, `git ls-remote --heads origin`) — a te pokazałyby działającą kartę z już zawężonym zakresem.

## Solution
- `docs/karty/I15.5/karta.md` → „Do koordynatora” p. 4: **„Zakres I15.11 — ROZSTRZYGNIĘTY, nic do decyzji”** zamiast „ZMIANA PRZYPISANIA, nie fakt dokonany”, z nazwą i gałęzią realizującego ticketu. Zachowany fakt, który nadal obowiązuje (gałąź `absenceReview` dowieziona w 140, bo siedziała w `staging-policy-injection.js`, a nie w żywym bundlu). Dopisany morał o sprawdzaniu stanu fali przed zgłaszaniem zmiany przypisania. Dodane podsumowanie: **do rozstrzygnięcia zostają wyłącznie punkty 1–3**.
- `docs/karty/I15.11/wejscie-140.md` → sekcja **„Zakres — już zawężony, nie pytaj o niego ponownie”**. Usunięte zdanie odsyłające do koordynatora, zachowana instrukcja sprawdzenia diffu żywego bundla. Dołożona uwaga, że `docs/karty/I15.11/karta.md` nadal ma w „Zakres” „i podgląd starej karty” oraz źródło `abe5f14` zamiast `88fa31c` — do poprawienia przez kartę 142 w jej własnym pliku.

## Design decisions
- **Sprostowanie idzie tam, gdzie czyta je następna sesja** (karta + plik wejścia), a **nie** do artefaktów zamkniętego ticketa 140. `plan.md`/`raport.md`/`review.md` są zapisem tego, co było wiadomo wtedy — historii nie przepisujemy.
- **`docs/karty/I15.11/karta.md` nietknięta** — to plik cudzej, aktywnej karty; CLAUDE.md: `karta.md` pisze wyłącznie ta karta. Rozbieżność zgłoszona jej przez `wejscie-140.md`.
- **Roadmapa i backlog nietknięte** — reguła 0; status #99 jest zresztą poprawny.

## Tests
Ticket dokumentacyjny — nie dotyka kodu, kontraktu ani fixtures, więc GATE odbudowy nie obowiązuje i bramek kodu nie uruchamiam. `git diff --stat` obejmuje wyłącznie `docs/`.

## Breaking changes
None

## Follow-up
Bez zmian wobec karty I15.5 — otwarte zostają jej punkty 1–3: `close-absence-review` bez konsumenta w UI (decyzja produktowa na cutover), `lib/api.ts::zadanie()` gubiące strukturę ciała błędu, brak globalnego error middleware w backendzie.

---
Ticket docs: `docs/tickets/145-DOCS-ustalenia-i15-5/`
