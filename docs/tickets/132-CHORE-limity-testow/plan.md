# 132-CHORE — limity czasu dla dwóch testów + budżet czasu jako sygnał

> Status: Implemented
> Branch: `chore/132-limity-testow`

## Ticket description
Dwa testy poza jakimkolwiek diffem wypadały na TIMEOUT (limit 20 s) przy obciążonej maszynie,
fałszywie czerwieniąc GATE cudzych ticketów: `test/alerty-katalogu.gate.test.ts` („paczka równa
limitowi 20 000 id”) i `test/silnik.charakteryzacja.test.ts` („MO5: port silnika == oryginalne
`tk()`”). Wariant wybrany przez użytkownika: podnieść limity teraz, przyspieszanie kodu odłożyć.

## Context — pomiar rozstrzygnął spór
Raport ticketu 119 mówił „w izolacji przechodzi”, review ticketu 119 mówiło „37–50 s także
w izolacji”. Pomiar z tego ticketu pokazuje, że **obie obserwacje są prawdziwe, bo decyduje
obciążenie maszyny**, nie sam test:

| Warunki | „paczka 20 000 id” | MO5 |
|---|---|---|
| load ≈ 6 (maszyna wolna) | **4,6 s** | **2,6 s** |
| load ≈ 19 | 21,4 s | — |
| load ≈ 34 (siedem sesji agentów) | 30,6 s (TIMEOUT) | 22,0 s (TIMEOUT) |

Wniosek: endpoint **nie jest** wolny (20 000 pozycji w ~3–5 s, czyli ~0,2 ms na pozycję, zapis
jest już w jednej transakcji — `repos/alerty-katalogu.ts:113`). Wcześniejsza hipoteza „~1 ms na
pozycję, użytkownik czeka 20 s” była wnioskiem z pomiaru na obciążonej maszynie i jest błędna.

## Decisions
- **Limit 120 s dla tych dwóch testów** (trzeci argument `it`), nie globalne podniesienie
  `testTimeout` — globalne przykryłoby też prawdziwe zawieszenia.
- **Budżet czasu jako osobny sygnał.** Sam podniesiony limit chowałby regresję: test mógłby
  urosnąć z 5 s do 80 s i nikt by nie zauważył. `tools/czas-testow.cjs` porównuje zmierzony czas
  z budżetem (45 s) i twardym limitem (90 s) z `rebuild/backend/test/budzety-czasu.json`.
- **Ostrzeżenie, nie blokada.** Przekroczenie budżetu daje `::warning::` w CI; dopiero twardy
  limit 90 s psuje bieg. Sygnał ma być widoczny, a nie dokładać kolejnego fałszywego czerwonego.
- **Odłożony ticket 133-PERF** — założony jako plan, uruchamiany dopiero, gdy budżet zostanie
  przekroczony **na wolnej maszynie**. Bez tego nie ma czego naprawiać.

## Implementation plan
1. `it(..., 120_000)` w obu testach + komentarz z pomiarem.
2. `rebuild/backend/test/budzety-czasu.json` — budżety, twarde limity, pomiary wyjściowe i to,
   co zrobić po przekroczeniu.
3. `tools/czas-testow.cjs` — czyta raport JSON vitest, porównuje, wypisuje adnotacje GitHuba.
4. `.github/workflows/ci.yml` — testy z raportem JSON + krok „Budżety czasu testów” (`always()`).
5. `docs/tickets/133-PERF-zapis-statusow-alertow/plan.md` — odłożony ticket z wyzwalaczem.

## Testing strategy
Uruchomienie obu plików z raportem JSON i sprawdzenie, że skrypt poprawnie odczytuje czasy
(✓ 4,6 s i ✓ 2,6 s przy load 6,5) oraz że rozpoznaje brak pliku/testu w raporcie. Pełne bramki
backendu po zmianie.

## Out of scope
- Przyspieszanie zapisu statusów (to odłożony 133-PERF).
- Zmiana `testTimeout` globalnie ani równoległości vitest.

## Definition of done
- [x] Oba testy mają własny limit i komentarz z pomiarem
- [x] Budżet czasu działa i mówi, co zrobić po przekroczeniu
- [x] CI wypisuje ostrzeżenie zamiast cicho przepuszczać wzrost czasu
- [x] Odłożony ticket 133 istnieje i ma wyzwalacz
