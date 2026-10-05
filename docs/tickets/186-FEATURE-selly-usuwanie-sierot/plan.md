# 186-FEATURE-selly-usuwanie-sierot — stałe usuwanie z Selly produktów, których nie ma w Bridge

> Status: Implemented · Branch: `claude/clever-turing-w6da6a` (sesja chmurowa — gałąź narzucona)

## Ticket description
Usuwanie z Selly (backlog #100, życzenie Ani) ma działać na bieżąco: produkt, którego nie ma już w Bridge, znika ze sklepu.
Od początku naprawdę usuwa (bez etapu „tylko raport”), a historia zapisuje dokładnie który produkt i o której godzinie.

## Context
Produkcja nie ma żadnej ścieżki usuwania (`#100`, port 1:1 w I15). Klient ma `deleteVariant`/`deleteProduct` (ticket 180), blokada
`SELLY_TRYB` już je obejmuje, logika wyboru wariant/produkt istnieje w `scal-karty-auto`. Usunięcie produktu w Bridge (ręczne,
„Usuń nieopony”, „Wyczyść katalog”, import) niczego nie zgłaszało do Selly.

## Kontrakt i fixtures (zakres)
Brak zmian API/kształtu odpowiedzi. Jedyna zmiana w widoku „Historia” (`/api/history/paged`): nowa akcja `selly_usuniecie` w słowniku
(typ `edycja`, jak #39). Fixture `GET_history_paged` bez zmian (akcja pojawia się tylko przy nowych zdarzeniach); testy historii zielone.

## Decisions (użytkownik, 2026-10-05)
1. Usuwanie **stałe** w harmonogramie (nie jednorazowe), oparte na **porównaniu stanu** („produktów, których już nie ma w Bridge”), nie na zdarzeniach.
2. **Od początku usuwa** (bez trybu raportu).
3. **Historia** zapisuje dokładnie który produkt został usunięty i o której godzinie → widok „Historia” (`audit_log`) + dziennik Selly (`selly_sync_log`).
Przyjęte przeze mnie (do wglądu): limit 20 usunięć na przebieg; bezpiecznik zbiorczy (pusty katalog / >30% sierot → wstrzymanie);
przełączniki `SELLY_USUWANIE` (domyślnie włączony) i `SELLY_USUWANIE_MAKS_UDZIAL` (0.3); limit dobowy 200; produktów Selly bez mapowania Bridge nie ruszamy.

## Implementation plan
`src/selly/rest/sync-usuwanie.ts` (Tor 3) + wpięcie w `scheduler.ts` po Torze 1 + `SELLY_USUWANIE` w `config/env.ts`/`server.ts` +
akcja w `historia/mapowanie.ts` + testy `selly.usuwanie.test.ts`.

## Out of scope
Usuwanie produktów Selly niezmapowanych przez Bridge; UI do podglądu sierot; zmiana „Wyczyść katalog”.

## Definition of done
- [x] Sierota = brak produktu po (dostawca, kod_importu) ORAZ po kodzie Bridge ORAZ po EAN-ie (historia cen); wariant nie używany przez żywe mapowanie
- [x] Bezpiecznik jak przy zapisie (produkt/wariant/magazyn/EAN zgodne) — przy niezgodności nic nie usuwa
- [x] Usunięcie wariantu, gdy produkt ma inne warianty/mapowania; cały produkt, gdy to jedyny wariant; 404 = już usunięty
- [x] Historia: kod, nazwa, EAN, id w Selly, dostawca, godzina (audit_log + selly_sync_log)
- [x] Bramki backendu zielone po synchronizacji z `develop`
