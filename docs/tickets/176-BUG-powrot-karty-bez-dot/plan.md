# 176-BUG-powrot-karty-bez-dot — powrót wstrzymanej karty bez porównywania DOT

> Status: Implemented
> Branch: `claude/new-session-wfqwy9` (gałąź wyznaczona przez sesję; bez osobnego worktree)

## Ticket description
Etap 2 specyfikacji „Naprawa kolejki stagingu (2026-10-01)”: 48 zgłoszeń „Powrót opony wymaga sprawdzenia…”
w produkcji (44 tylko DOT, 3 TL/TT + DOT, 1 tylko TL/TT). Blok powrotu w `fabryka.ts` używał `zgodnaZ`
(z DOT), co przeczy zmianie nr 172 („DOT jako cecha zmienna tej samej pozycji”). Etap musi wejść przed
migracją scalającą karty AUTO (Etap 1), bo inaczej scalone karty wracałyby do stagingu z tym błędem.

## Kontrakt i fixtures (zakres)
Brak (nie dotyka kontraktu API) — zmiana logiki importera. Odstępstwo od produkcji (oryginał porównywał też DOT
i traktował pustą cechę w ofercie jako różnicę) = decyzja użytkowniczki z 2026-10-01 (spec, ustalenie 3).
`staging_policy.cjs` (pilnowany sha256) NIE jest zmieniany — tolerancja siedzi w warstwie `tolerancja-dopasowania.ts`.

## Decisions
- Blok powrotu: `zgodnaZ` → `zgodnaBezDotZ` (ten sam kod = ta sama pozycja). Nowy DOT zapisuje istniejąca
  cicha aktualizacja (`aktualizacjaDotWMiejscu`), status wraca istniejącą ścieżką „pewny powrót”
  (tylko wstrzymanie automatyczne, tylko pełny cennik, ceny > 0). Blokady ręczne bez zmian.
- `widok(..., bezDot)`: pusta wartość `pr`/`tlTt`/`vfIf`/`konstrukcja` w ofercie przy wypełnionej karcie =
  brak informacji (podstawiamy wartość karty). Odwrotnie (karta pusta, oferta wypełniona) i dwie różne
  niepuste wartości nadal są różnicą. Zakres: TYLKO porównania „ten sam kod” (`zgodnaBezDot`), nie dopasowanie
  pod innym kodem — tam luźniejsza zgodność mogłaby scalać różne opony.
- Wartość na karcie (np. `tlTt`) zostaje bez zmian.

## Implementation plan
1. `tolerancja-dopasowania.ts` — stała `POLA_BRAK_TO_NIE_SPRZECZNOSC` + podstawienie w `widok` dla `bezDot`.
2. `fabryka.ts` — warunek powrotu na `zgodnaBezDotZ`.
3. Testy w `test/tolerancja-dopasowania.test.ts` (a–d + przypadek odwrotny).
4. Wpis `docs/spec-backend/wpis-176.md`.

## Testing strategy
Testy integracyjne na prawdziwej bazie (silnik stagingu + fixture MO5), bez mocków. Pełne bramki backendu.

## Out of scope
Etapy 1 (scalenie kart AUTO), 3 (normalizacja parserów), 4 (synchronizacja cenników) — osobne tickety.
Weryfikacja „≤ 1 zgłoszenie Powrót…” na kopii produkcji — wymaga `data-prod.db`, niedostępnej w tej sesji.

## Definition of done
- [x] testy (a)–(d) zielone, (a) i (c) czerwone bez poprawki
- [x] lint, typecheck, build, `npm test` zielone (1991 passed / 12 skipped)
- [ ] PR do `develop`, `MERGEABLE`
