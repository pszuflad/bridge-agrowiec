## Ticket
`161-DOCS-runbook-przelaczenia` — instrukcja krok po kroku: nowe środowisko staje się produkcją

## Summary
**Nowy plik `docs/cutover-runbook.md`** — procedura wykonawcza dla modelu z rozdziału 0 `cutover.md`, napisana przy założeniu, że **stary stos właśnie został wyłączony**. Trzynaście kroków, każdy z poleceniem i sprawdzeniem. Plus jedno zdanie odsyłacza na końcu rozdziału 0 `cutover.md`. **Zero zmian w `rebuild/` i `contract/`.**

## Dlaczego osobny plik
`cutover.md` jest źródłem faktów (schemat, zmienne, smoke-testy), ale jego rozdziały 5 i 7 są jawnie nieaktualne, a to, co trzeba zrobić, jest rozsiane po §0, §2, §3a, §4, §6 i §8. Wykonawca w oknie potrzebuje jednej kolejności. Nowy plik nie konkuruje też o linie z równoległymi sesjami edytującymi `cutover.md`.

## Struktura
1. decyzja bramowa: gdzie stanie panel (wariant A `public_html/panel` vs B `public_html/test`) · 2. zatrzymanie obu wyzwalaczy CD · 3. wybór i migracja bazy + kopia bezpieczeństwa · 4. plik środowiska (komplet zmiennych) · 5. dostosowanie `deploy-staging.sh` · 6. build i start · 7. proxy `/panel` · 8. katalog CSV i biała lista IP · 9. cron 6:00 · 10. smoke-testy · 11. **dwufazowe włączenie Selly** · 12. dobicie starego stosu w PM2 · 13. pierwsza doba. Do tego: czego nie robić, co uprzedzić Anię, trzy typowe awarie z przyczyną.

## Trzy ustalenia z kodu, które zmieniają procedurę
1. **`DB_PATH` jest zahardkodowany w skrypcie i `.env` go NIE nadpisze** — `deploy-staging.sh:125` podaje `DB_PATH="$DATA_DB"` wprost przy `pm2 start`. Zmiana bazy na produkcyjną wymaga edycji skryptu, nie wpisu w `.env`.
2. **`pm2 restart` po edycji `.env` nic nie zmieni** — pm2 nie czyta plików env. Trzeba pełnego `FORCE=1 bash tools/deploy-staging.sh`.
3. **`SELLY_TRYB=pelny` sam z siebie otwiera zapis do żywego sklepu**, niezależnie od `SELLY_SCHEDULER`: `server.ts:90` montuje moduł dostępności dla każdego trybu poza `wylaczony`, a `selly/dostepnosc.ts` po imporcie regeneruje CSV **i woła Tor 1**. Stąd dwufazowość: `tylko-odczyt` → smoke-testy → `pelny` + scheduler.

## Czego runbook nie rozstrzyga
Konfiguracji Apache/DirectAdmin — krok 1 stawia to jako decyzję z wariantami, bo od niej zależy, czy adres feedu w panelu Selly zostaje bez zmian (wariant A) czy trzeba go zmienić (wariant B). Oraz: czy po przełączeniu stawiamy nowy staging i czy zostaje auto-deploy z `develop`.

## Tests
Nie dotyczy — wyłącznie `docs/`.

## Breaking changes
None.

---
Ticket docs: `docs/tickets/161-DOCS-runbook-przelaczenia/`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
