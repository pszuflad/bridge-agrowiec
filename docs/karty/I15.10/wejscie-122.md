# Wejście dla I15.10 od ticketu 122 (I15.3) · 2026-09-23

Generator CSV jest gotowy do wywołania **in-process**, bez podprocesu:

```
wygenerujCsvSelly(db: Baza, sciezki: { katalog: string; plik: string; url: string }): WynikGenerowania
```

`rebuild/backend/src/selly/generator-csv.ts`, już eksportowana. `WynikGenerowania` = `{ ok, czas_ms,
wiersze, rozmiar_mb, ostatnia_synchronizacja, stdout }`. Dokładnie tej samej funkcji używają trasa
`POST /api/selly/generate-csv` (`src/routes/selly.ts`) i CLI `rebuild/backend/src/selly/csv-cli.ts`
(`npm run selly:csv`) — jeden format pliku, nie dwie kopie logiki.

**Ostrzeżenie: wywołanie jest SYNCHRONICZNE i blokuje pętlę zdarzeń** na czas zapisu (~6900 wierszy
na kopii `db/snapshot.db`, rzędu setek ms — dokładna liczba w `docs/tickets/122-…/raport.md`,
sekcja „Pomiar CSV”). W oryginale `availability_sync.cjs` odpalał generator w **osobnym procesie**
(`docs/karty/I15.10/karta.md`, zakres: „uruchamia generator CSV w osobnym procesie”) — jeśli I15.10
ma wołać `wygenerujCsvSelly()` bezpośrednio zamiast przez podproces, to jest odstępstwo od
architektury oryginału (wymaga świadomej decyzji, choćby dlatego że blokowanie event loopu na
serwerze obsługującym równolegle inne żądania to inny profil ryzyka niż osobny proces cronowy).

**Zapis jest atomowy** (tmp w tym samym katalogu co plik docelowy + `rename`) — równoległe odczyty
pliku CSV przez Selly (albo przez trasę `GET /api/selly/csv-status`) nie zobaczą pliku w połowie
zapisu, niezależnie od tego, ile wywołań generatora nakłada się w czasie.
