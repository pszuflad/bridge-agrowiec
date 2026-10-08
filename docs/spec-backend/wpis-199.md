# Wpis do spec-backend od ticketu 199 (cechy CFO/NRO/CHO w pełnej synchronizacji REST) · 2026-10-08

- `FEATURE_MAP` (`src/selly/rest/mapper-v2.ts`) ma 24 cechy: 21 z oryginału + **`CFO`, `NRO`, `CHO`** (wartość „Tak" przez `yn()`, puste/0 pomijane;
  nazwy = nagłówki kolumn pliku CSV dla Selly). **Świadome rozszerzenie względem oryginału** (decyzja użytkownika 2026-10-08) — stary mapper
  ich nie miał; do tej pory trafiały do sklepu tylko plikiem CSV.
- `collectFullSyncItems` (`sync-full.ts`) czyta surowo `p.cfo, p.nro, p.cho` (SQL, bez mappera Drizzle, więc tekst „Tak" nie ginie).
  Kolumny NIE weszły do `POLA_METADANYCH` — wybór „właściciela metadanych" grupy bez zmian.
- Zasięg: Tor 2 (pełna synchronizacja). Przy `SELLY_TOR2=false` (stan produkcji na 07.10) zmiana nie ma skutku do czasu jego włączenia.
- ⚠ Do potwierdzenia przy pierwszym dry-runie Toru 2: czy Selly akceptuje cechy o tych nazwach (pozostałe nazwy cech istnieją w sklepie;
  tych trzech z poziomu repo nie da się zweryfikować). Tryb lustra dopisuje brakujące cechy Bridge na końcu tablicy `features`.
