# 41-CHORE-i13f-decyzja-backfille — raport

**Data:** 2026-09-08 · **Typ:** chore (decyzja, zero kodu) · **Zamyka:** karta I13/13f, backlog #62

## Decyzja

**Backfilli Ani (tl_tt / szerokości ułamkowe / JMK marka+model + overrides) NIE odtwarzamy jako kod
ani migracje w odbudowie.** 13f zamknięte bez implementacji.

## Powód rozstrzygający

Cutover jest big-bang na **TEJ SAMEJ** `data.db` (`docs/cutover.md`: „nie migrujemy danych, nie
przenosimy plików"). Ania wykonała backfille bezpośrednio na produkcyjnej `data.db`, więc wartości
**już są w bazie**, na której odbudowa wystartuje po cutoverze. Jednorazowy UPDATE nie ma czego naprawiać.

## Reguły tl_tt B/C — świadomie NIE do parsera

Reguły B (Ciężarowe+Radialna+śr≥17.5→TL) i C (BKT MAGLIFT+Diagonalna+śr≤12→TT) były **jednorazową
heurystyką** czyszczenia historycznych NULL-i, nie logiką parsera. Mirror ich nie ma w parserze —
dodanie do odbudowy byłoby świadomym odstępstwem od 1:1, którego nie robimy. Na przyszłe importy
wystarcza:
- parserowy default TL dla Ciężarowych (wchodzi z 13a, `tyre_params.cjs`),
- `manual_overrides` JMK (już w bazie, respektowane przez `acceptStaging`).

## Świadomy skutek uboczny

`products/clear` + reimport NIE odtworzy wartości B/C — dokładnie jak w produkcji (jej parser też ich
nie derywuje). Zgodność 1:1 zachowana.

## Zmiany w dokumentacji

- `docs/rebuild-roadmap.md` — blok I13/13f oznaczony ✅ ROZSTRZYGNIĘTE, z powodem.
- `docs/rebuild-backlog.md` — #62: `Do nowej wersji?` ❌ świadomie pominięte, `Status` ✅ rozstrzygnięte.

## Wpływ na resztę I13

Odblokowuje **13c** (migracje) — nie musi obejmować tl_tt/backfilli. 13a i 13b bez zmian.
