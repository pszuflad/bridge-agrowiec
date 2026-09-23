# 143-DOCS-wpisy-organizacyjne-dec1 — przeniesienie notatek DEC.1 do backlogu

> Status: Implemented
> Branch: `docs/143-wpisy-organizacyjne-dec1`
> Worktree: `.worktrees/143-DOCS-wpisy-organizacyjne-dec1`

## Opis ticketa
Po zamknięciu karty **DEC.1** (ticket 141) trzy ustalenia organizacyjne zostały wyłącznie
w sekcji „Do koordynatora" jej `karta.md`. Użytkownik zapytał, czy musi je przekazać koordynatorowi
ręcznie. Sprawdzenie wykazało, że **formalnie są w dokumentacji, ale w miejscu, które już raz
zawiodło** — ten sam wzorzec dał `docs/rebuild-backlog/wpis-137.md`. Decyzja użytkownika
2026-09-24: przenieść do backlogu, który jest przeglądany rutynowo.

## Kontrakt i fixtures (zakres)
**Brak (nie dotyka kontraktu).** Jeden nowy plik dokumentacji, zero zmian w `rebuild/`
i `contract/`. GATE odbudowy nie obowiązuje.

## Decisions
- **Przenosimy do backlogu, nie zostawiamy w karcie** (użytkownik, 2026-09-24). Dowód, że to
  konieczne: `grep -l "Do koordynatora" tools/*.sh` → zero trafień; `tools/stan-kart.sh` pokazuje
  stan karty, nie jej treść; karta `✅` wypada z pola uwagi.
- **Plik nazwany numerem ticketu, który go pisze** (`wpis-143.md`), nie ticketu, który odkrył
  treść (141) — zgodnie z `docs/rebuild-backlog/README.md` i precedensem ticketu 137
  (przeniósł ustalenia ticketu 130).
- **`Do nowej wersji? = 🕒`, `Status = ⬜`** — żeby nowe wpisy NIE pojawiły się w
  `--do-decyzji` (ta lista ma pokazywać wyłącznie to, co czeka na Anię), ale były widoczne
  jako robota do zrobienia.
- **NIE edytujemy `docs/karty/DEC.1/karta.md`** — to cudza karta (reguła własności
  z `docs/karty/README.md`). Korektę nieaktualnej noty zapisujemy w swoim pliku.
- **Punkt o `I15.10b` pominięty** — sprawdzony 2026-09-24 na `develop`: karta ma już
  `Stan: ✅ 2026-09-23 · 139-FEATURE-montaz-dostepnosci`, więc nota z DEC.1 jest nieaktualna.
  Odnotowane w stopce pliku zamiast przepisywania fałszu.

## Implementation plan
1. Zweryfikować w kodzie każde twierdzenie przenoszone z DEC.1 — ZROBIONE.
2. Utworzyć `docs/rebuild-backlog/wpis-143.md` z trzema wpisami (`#143.1` duplikat `#103`,
   `#143.2` katalogi kart przed promptem, `#143.3` siedem kart po cutoverze).
3. Sprawdzić parsowanie narzędziem i brak wpływu na `--do-decyzji`.

## Testing strategy
Brak testów kodu. Weryfikacja:
- `tools/stan-backlogu.sh 143` → trzy wpisy, `🕒` / `⬜`;
- `tools/stan-backlogu.sh --do-decyzji` → **nadal dokładnie** `#89`, `#108`, `#137.2`;
- `git diff --name-only` → zero zmian poza `docs/rebuild-backlog/wpis-143.md`
  i `docs/tickets/143-*/`, w szczególności zero w `docs/karty/`.

## Out of scope
- Samo przenumerowanie `#103` (to robota koordynatora — ten ticket ją tylko odnotowuje).
- Edycja `docs/karty/DEC.1/karta.md` i jakiejkolwiek innej karty.
- `docs/rebuild-backlog.md` — reguła „backlog.md nie rośnie".
- Zmiana `tools/stan-kart.sh` (propozycja sygnalizowania brakujących katalogów została
  zapisana jako rekomendacja w `#143.2`, nie wdrożona).

## Definition of done
- [x] `docs/rebuild-backlog/wpis-143.md` z trzema wpisami, format zgodny z README
- [x] `--do-decyzji` niezmienione (3 wpisy czekające na Anię)
- [x] Zero zmian w `rebuild/`, `contract/`, roadmapie i cudzych kartach
- [x] Nieaktualna nota o `I15.10b` odnotowana, nie przepisana
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE`
