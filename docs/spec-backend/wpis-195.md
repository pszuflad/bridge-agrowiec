# Wpis do spec-backend od ticketu 195 (Selly: zbiorcza historia usuniętych pozycji) · 2026-10-07

Dodatki względem oryginału (oryginał nie usuwał nic z Selly — backlog #100; nic z istniejącego zachowania nie zmienione):

- **Tabela `selly_usuniecia`** (migracja `rebuild/schema/023_selly_usuniecia.sql`): jeden wiersz na każdą pozycję usuniętą
  z Selly przez Tor 3, bez limitu długości. Kolumny: `usunieto_at` (UTC `YYYY-MM-DD HH:MM:SS`), `przebieg_id`
  (`selly_sync_log.id` przebiegu — zbiorcze grupowanie), `kod`, `nazwa`, `ean`, `dostawca`, `kod_importu`,
  `selly_product_id`, `selly_variant_id`, `akcja`. Zapisywane są tylko akcje `usunieto_wariant`, `usunieto_produkt`
  i `juz_nie_istnial` (te same, które trafiają do `audit_log`); pominięte i błędy nie wchodzą.
- **Zapis** w `usunSierotyZSelly` (`src/selly/rest/sync-usuwanie.ts`) obok `zapiszHistorie`, we własnym `try/catch`:
  `DELETE` w Selly jest już wykonany, więc awaria zapisu nie przerywa przebiegu ani nie gubi wpisu w `audit_log`
  i dzienniku. `audit_log` (widok „Historia”) i `selly_sync_log` (panel „Historia operacji”, lista przycinana do 8000
  znaków) działają jak dotąd.
- `GET /api/selly/usuniete?limit=&offset=` → `{ items, total }`, najnowsze pierwsze (`usunieto_at DESC, id DESC`);
  domyślnie 20 na stronę, maks. 200; błędne `limit`/`offset` wracają do domyślnych. Za `requireAuth`.
- `GET /api/selly/usuniete/csv` — CAŁA historia jako CSV: BOM `U+FEFF`, średnik, `\n` (wzorzec
  `src/analityka/csv.ts`), nagłówek w pierwszym wierszu (także przy pustej historii), nazwa pliku
  `selly-usuniete-RRRR-MM-DD.csv`. Za `requireAuth`.
- Frontend: karta „Usunięte z Selly” w zakładce Selly (tabela, paginacja po 20, „Pobierz CSV”).

Na istniejącej bazie migracja tworzy pustą tabelę (idempotentna, `IF NOT EXISTS`) — `npm run migrate` w
`deploy-produkcja.sh`, bez kroków ręcznych. Usuwanie z Selly nadal włącza `SELLY_USUWANIE` (ten ticket go nie zmienia).
