# 145-DOCS-ustalenia-i15-5 — sprostowanie ustaleń karty I15.5

> Branch: `docs/145-ustalenia-i15-5`
> Baza: `origin/develop` (`b0bccac`)

## Po co ten ticket

Ticket `140-FEATURE-staging-rozstrzygnij-frontend` (karta I15.5, scalony 2026-09-23) zgłosił
do koordynatora **zawężenie zakresu karty I15.11 jako sprawę otwartą**. To było zbędne:
koordynator zawęził I15.11 do panelu „Braki w cenniku" jeszcze **przed** wydaniem promptu,
a karta chodzi od 23.09 jako ticket `142-FEATURE-braki-w-cenniku`.

Ticket 140 nie sprawdził stanu fali przed zgłoszeniem. Skutek: dwa pliki, które czyta następna
sesja, prosiły o decyzję w sprawie już rozstrzygniętej — a `docs/karty/I15.11/wejscie-140.md`
czyta w tej chwili aktywny ticket 142 i mógł na tej podstawie zatrzymać się z pytaniem.

## Zmiany

- `docs/karty/I15.5/karta.md` → „Do koordynatora" p. 4 — z **„Zakres I15.11 do zawężenia —
  ZMIANA PRZYPISANIA, nie fakt dokonany"** na **„Zakres I15.11 — ROZSTRZYGNIĘTY, nic do
  decyzji"**, z nazwą i gałęzią ticketu, który kartę realizuje. Zachowany fakt, który nadal
  obowiązuje (gałąź `absenceReview` dowieziona w 140, bo siedziała w
  `staging-policy-injection.js`, nie w żywym bundlu). Dopisany morał: **przed zgłoszeniem
  „zmiany przypisania zakresu" sprawdź stan fali** (`tools/stan-kart.sh`, `git worktree list`,
  `git ls-remote --heads origin`).
  Dodane podsumowanie: **do rozstrzygnięcia zostają wyłącznie punkty 1–3** (1 — decyzja
  produktowa na cutover, 2 i 3 — osobne tickety techniczne, nie zakres żadnej karty I15).
- `docs/karty/I15.11/wejscie-140.md` → sekcja „Ostrzeżenie o zakresie" zastąpiona sekcją
  **„Zakres — już zawężony, nie pytaj o niego ponownie"**. Usunięte zdanie każące wracać
  do koordynatora. Zachowana instrukcja sprawdzenia diffu żywego bundla. **Dołożona uwaga**,
  że `docs/karty/I15.11/karta.md` nadal ma w „Zakres" „i podgląd starej karty" oraz źródło
  `abe5f14` zamiast `88fa31c` — to plik karty 142, więc ma go poprawić ona sama, w miejscu.

## Czego świadomie NIE ruszam

- **`docs/karty/I15.11/karta.md`** — plik cudzej, aktywnej karty (ticket 142). CLAUDE.md:
  `karta.md` pisze wyłącznie ta karta. Rozbieżność zgłoszona jej w `wejscie-140.md`.
- **`docs/tickets/140-*/plan.md`, `raport.md`, `review.md`** — artefakty zamkniętego ticketa
  są zapisem tego, co było wiadomo wtedy. Nie przepisuję historii; sprostowanie żyje tam,
  gdzie czyta je następna sesja, czyli w karcie i w pliku wejścia.
- **`docs/rebuild-roadmap.md`** — CLAUDE.md reguła 0, roadmapę zmienia wyłącznie koordynator.
- **`docs/rebuild-backlog.md`** — status #99 jest poprawny (I15.5 dowieziona, otwarte I15.11).

## Test results

Ticket **dokumentacyjny** — nie dotyka kodu, kontraktu ani fixtures, więc GATE odbudowy nie
obowiązuje. `git diff --stat` obejmuje wyłącznie `docs/`. Bramek kodu nie uruchamiam, bo żaden
plik `rebuild/` nie jest zmieniony.

## Breaking changes

Brak.

## Follow-up

Bez zmian wobec karty I15.5: otwarte zostają punkty 1–3 z jej „Do koordynatora"
(`close-absence-review` bez konsumenta w UI, `zadanie()` gubiące strukturę ciała błędu, brak
globalnego error middleware w backendzie).
