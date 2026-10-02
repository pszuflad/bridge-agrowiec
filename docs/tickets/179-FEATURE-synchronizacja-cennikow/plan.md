# 179-FEATURE-synchronizacja-cennikow — pobieranie cenników i próg „podejrzanie mały” (Etap 4)

> Status: Implemented · Branch: `claude/new-session-wfqwy9` · SPEC „Naprawa kolejki stagingu (2026-10-01)”, Etap 4.

## Context
Logi PM2: AbortError (MO3 ×55, MO5 ×17, MO4 ×9 w prod) i blokada „Cennik podejrzanie mały” liczona z historycznego maksimum (MO4: 244 przy minimum 249).

## Kontrakt i fixtures
Nowa trasa `POST /api/dostawcy/:kod/akceptuj-mniejszy-cennik` (spoza kontraktu produkcji — decyzja użytkowniczki). Istniejące trasy bez zmian kształtu.

## Decisions
- 4a: timeout 120 s; 2 ponowienia co 120 s tylko dla AbortError/błędów sieci/zerwanego ciała i HTTP 5xx; 4xx, parser, „podejrzanie mały” nie są
  ponawiane; alert po 3. próbie z dopiskiem `(próby: N, odstęp X s, limit Y s)`; blokada per dostawca (kolejny cykl/ręczne „teraz” dostaje
  `Synchronizacja tego dostawcy już trwa`, bez alertu). Odstęp: `SYNC_ODSTEP_PONOWIEN_MS` (testy = 0).
- 4b: `minimumPozycjiOferty` = 80% `last_item_count` (ostatni udany import); alert z liczbą i do 20 kodami brakujących kart; migracja 019:
  tabela `supplier_feed_blocked` (liczba z ostatniej blokady) + jednorazowy reset `max_item_count = last_item_count`. Kolumny w `supplier_feed_state`
  NIE dokładamy — `db.migracja-012` pilnuje jej DDL znak w znak względem produkcji.
- Przycisk „Zaakceptuj mniejszy cennik” stoi na karcie dostawcy (Konfiguracja → Dostawcy) po błędzie synchronizacji, nie w widoku Alertów.
- Gate'y porównujące port z oryginałem mockują `minimumPozycjiOferty` na wariant z maksimum, jak wcześniejsze odstępstwa.

## Out of scope
Lista ~57 kart MO4, które zostaną wstrzymane po pierwszym imporcie (wymaga cennika i bazy prod — otwarte pytanie 3 speca); 4c (Handlopex EAN — poza kodem).

## Definition of done
- [x] testy −19%/−25%/akceptuj, ponowienia, blokada, migracja; backend 2061 i frontend 1033 testów zielone
- [ ] lista kart MO4 pokazana Annie przed wdrożeniem; 24 h po wdrożeniu 0 „podejrzanie mały” dla MO4 i AbortError ≤ 2/dobę
