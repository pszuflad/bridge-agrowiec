# Wpis do spec-backend od ticketu 183

Synchronizacja MO9 pobiera API asynchronicznie przez `parsujAgrorami()` i `agrorami-worker.cjs`.
`store=pl` przekazywane w nagłówku Store zamiast parametrze URL; 120 s na żądanie, do 3 prób,
2/4 s odstępu, 600 s dla procesu. Ponawiane są błędy sieci, 429/5xx oraz GraphQL Internal server error.
Mapowanie i kontrola kompletności nadal pochodzą z legacy. Nie stosuje się fallbacku do CSV.
Odmowa autoryzacji jest obsługiwana przez istniejący mechanizm odnowienia tokenu.
Szczegóły diagnozy i zakres: `docs/tickets/183-BUG-agrorami-transport/raport.md`.
