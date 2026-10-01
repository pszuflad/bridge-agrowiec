# Wpis do spec-backend od ticketu 181 · 2026-10-01

**Sekcja:** migracja `scal-karty-auto` (#177, #180).

**Potwierdzone w 181**: `zerujWariantySelly` i `usunDuplikatySelly` nie wołają Selly dla wariantu, który nadal jest w `selly_products`
(wariant współdzielony z kartą, która zostaje) — wiersz archiwum dostaje stempel i opis „pominięto”. Szczegóły: `docs/tickets/181-BUG-scal-auto-wspoldzielony-wariant/`.
