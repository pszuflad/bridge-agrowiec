# 143-DOCS-wpisy-organizacyjne-dec1 — Code review

> Reviewed: 2026-09-24
> Branch: docs/143-wpisy-organizacyjne-dec1
> Diff: 2 pliki (`docs/rebuild-backlog/wpis-143.md`, `docs/tickets/143-DOCS-wpisy-organizacyjne-dec1/plan.md`), 1 commit (`6b05944`)

## BLOCKER

Brak.

## SHOULD-FIX

Brak.

## NICE-TO-HAVE

- [ ] `docs/rebuild-backlog/wpis-143.md` — w chwili tego przeglądu `raport.md` i sam `review.md`
  jeszcze nie były zacommitowane (widoczne jako `??` w `git status` obok już scalonego commitu
  `6b05944`). Do domknięcia przed pushem: dopisać je do commita/nowego commita, żeby PR niósł
  komplet artefaktów ticketa (plan/raport/review/pr-body), zgodnie z listą w `raport.md` „Zmiany".

## Plan compliance

### Done ✓
- Utworzono dokładnie jeden nowy plik backlogu: `docs/rebuild-backlog/wpis-143.md`, z trzema
  wpisami `#143.1`, `#143.2`, `#143.3` — zgodnie z planem.
- Zero zmian w `rebuild/**`, `contract/**`, `docs/rebuild-roadmap.md` i w `docs/karty/**`
  (w tym w cudzej karcie `docs/karty/DEC.1/karta.md`) — potwierdzone `git diff --name-only
  origin/develop...HEAD`, które pokazuje wyłącznie `docs/rebuild-backlog/wpis-143.md`
  i `docs/tickets/143-DOCS-wpisy-organizacyjne-dec1/plan.md`.
- Format wpisów zgodny z szablonem `docs/rebuild-backlog/README.md`: identyfikatory
  `#143.<kolejny>`, tabela z polami Data/Kategoria/Pliki/Commit/Do nowej wersji?/Status.
- `docs/rebuild-backlog.md` nie zostało dotknięte (`git diff origin/develop...HEAD --
  docs/rebuild-backlog.md` — pusty diff), zgodnie z regułą „backlog.md nie rośnie".
- Punkt o `docs/karty/I15.10b/karta.md` świadomie pominięty jako nieaktualny, z odnotowaniem
  w stopce pliku zamiast przepisania fałszu — zgodnie z CLAUDE.md regułą 1.

### Missing or deviating ✗
Brak — implementacja pokrywa plan 1:1.

### Definition of done
- [x] `docs/rebuild-backlog/wpis-143.md` z trzema wpisami, format zgodny z README
- [x] `--do-decyzji` niezmienione (3 wpisy czekające na Anię)
- [x] Zero zmian w `rebuild/`, `contract/`, roadmapie i cudzych kartach
- [x] Nieaktualna nota o `I15.10b` odnotowana, nie przepisana
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE` — do zrobienia przed pushem (poza zakresem review)

## Weryfikacja twierdzeń (sedno tego przeglądu)

Wszystkie sprawdzone twierdzenia potwierdzone jako prawdziwe:

1. **`#143.1` — duplikat `#103`.** W `docs/rebuild-backlog.md` są dwa nagłówki `### #103`
   dokładnie na liniach **4613** i **4638** (`grep -n "^### #103"`). Treść zgadza się z opisem
   wpisu: `:4613` to Selly/`runFullTodays`, zamknięty ✅ w DEC.1 (I15.8, ticket 121); `:4638` to
   „Braki w cenniku", żyje dalej, `Do nowej wersji?` bez rozstrzygnięcia domykającego (opisuje
   cząstkowe ✅ dla części I15.2/I15.4a/I15.4c/I15.4b, „Otwarte: panel — I15.5/I15.11").

2. **`#143.2` — krok 1 „Przepływu fali".** `docs/karty/README.md:64-66` potwierdza dosłownie:
   „Koordynator planuje falę — ticket `DOCS`: zakłada `docs/karty/<ID>/karta.md` dla KAŻDEJ
   karty fali (…). PR → merge do `develop`." Cytat w `wpis-143.md` jest wierny.

3. **`#143.3` — tabela siedmiu kart.** Zgadza się 1:1 (kolejność, wpisy, koszty) z tabelą
   w `docs/karty/DEC.1/karta.md:307-315` (sekcja „Do koordynatora" pkt 5). Wszystkie sześć
   numerów wpisów (`#94`, `#98`, `#43`, `#12`, `#65`, `#88`) ma faktycznie `🕒 **PO CUTOVERZE**`
   w polu „Do nowej wersji?” w `docs/rebuild-backlog.md` (sprawdzone liniami 4347, 4453, 2863,
   878, 3376, 4085).

4. **Nagłówek — `grep -l "Do koordynatora" tools/*.sh` daje zero trafień.** Potwierdzone
   uruchomieniem — brak wyjścia, kod wyjścia `1` (brak dopasowań). Prawdziwe.

5. **Stopka — `docs/karty/I15.10b/karta.md` ma dziś `Stan: ✅ 2026-09-23 ·
   139-FEATURE-montaz-dostepnosci`.** Potwierdzone `grep -n "^> \*\*Stan" docs/karty/I15.10b/karta.md`
   — dokładnie taka linia. Nota z DEC.1 (`⬜ do wstawienia w kolejkę`) faktycznie nieaktualna.

6. **Precedens — `docs/rebuild-backlog/wpis-137.md` powstał z analogicznego powodu.**
   Potwierdzone nagłówkiem tego pliku: „ustalenia z ticketu 130 (karta I15.4b), które po
   zamknięciu tamtej karty zostały bez domu: siedziały wyłącznie w sekcji „Do koordynatora"
   zamkniętego `docs/karty/I15.4b/karta.md”.

7. **`tools/stan-backlogu.sh 143`** wypisuje dokładnie 3 wpisy (`#143.1`, `#143.2`, `#143.3`),
   każdy z `Do nowej wersji? = 🕒` i `Status = ⬜`. **`tools/stan-backlogu.sh --do-decyzji`**
   wypisuje dokładnie 4 pozycje: `#89`, `#108`, `#137.2` **i `#139.2`** (ten ostatni z ticketu 139,
   zmergowanego już po rundzie DEC.1 — poza zakresem tego ticketu, sam `raport.md` to jawnie
   odnotowuje w sekcji „Follow-up" jako nowy wpis niebędący częścią DEC.1). Zgodne z tym, co
   ticket obiecuje: żaden z TRZECH nowych wpisów `#143.*` nie wszedł na listę `--do-decyzji`.

## Parallel-test concerns

Brak — ticket nie dotyka kodu ani testów, wyłącznie dokumentacja.

## Overall assessment

Ticket dokładnie w zakresie: jeden nowy plik backlogu, zero ingerencji w cudze artefakty
(`docs/karty/DEC.1/karta.md`, roadmapa, kod). Wszystkie zweryfikowane twierdzenia — numery linii,
cytaty, tabela siedmiu kart, status `I15.10b`, precedens `wpis-137.md` — potwierdzają się co do
joty w źródłach. Jedyna uwaga (NICE-TO-HAVE) dotyczy stanu commitu w momencie przeglądu, nie
treści merytorycznej. Gotowe do dalszego procesu (sync + PR).
