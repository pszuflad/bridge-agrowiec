## Ticket
137-DOCS-wpisy-mirror-i-poprawki-marty — dwa ustalenia z I15.4b dostają dom w backlogu

## Summary
Dwa ustalenia z ticketu 130 (karta I15.4b) po zamknięciu tamtej karty zostały bez domu — siedziały
wyłącznie w sekcji „Do koordynatora" zamkniętego `karta.md`. Ten ticket przenosi je do backlogu,
który jest przeglądany rutynowo. Zero zmian w kodzie.

## Problem / Motivation
Przegląd po merge'u PR #150 pokazał, że z sześciu punktów „Do koordynatora" karty I15.4b cztery
mają już właściciela (montaż dostępności → karta `I15.10b` z planem ticketu 136; kolejność fal →
mechanizm „Do koordynatora" działa zgodnie z CLAUDE.md; D-130.3 i wydajność → rozliczone przy
`#104` i `#107`/`#129.1`; flake → ticket 132). Dwa nie miały **żadnego** trafienia w backlogu.

## Solution
- **Nowy** `docs/rebuild-backlog/wpis-137.md` — wpisy `#137.1` i `#137.2` wg szablonu
  z `docs/rebuild-backlog/README.md` (reguła „jeden plik na ticket", ticket 128).
- `docs/karty/I15.4b/karta.md` — odsyłacze do wpisów przy punktach 1 i 2, żeby nie powstały
  dwa niezależne opisy tej samej rzeczy.

## Design decisions
- **Nic nie rozstrzygam** — oba wpisy wychodzą jako `⬜ do decyzji`.
- **`#137.2` to decyzja Ani, nie techniczna.** Ciche nakładanie poprawek jest zachowaniem
  produkcji po Staging v2 i odbudowa odtwarza je 1:1 — cofnięcie byłoby ODSTĘPSTWEM, nie naprawą.
  Wpis podaje trzy warianty: zostaw / przywróć sam meldunek / przywróć meldunek i blokadę.
- **`docs/rebuild-backlog.md` nietknięty** — zgodnie z regułą „backlog nie rośnie".

## Tests
Brak — ticket dotyka wyłącznie dokumentacji, nie zmienia ani jednej linii kodu.

## Breaking changes
None.

## Follow-up
Oba wpisy czekają na decyzję: `#137.1` na CHORE dosynchronizujący mirror, `#137.2` na odpowiedź Ani.

---
Ticket docs: `docs/tickets/137-DOCS-wpisy-mirror-i-poprawki-marty/`
