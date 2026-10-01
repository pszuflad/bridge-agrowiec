# Wpis do spec-backend od ticketu 179 · 2026-10-01

**Sekcja:** import — synchronizacja dostawców spod URL i bezpieczeństwo źródła (#103).

**Potwierdzone w 179** (`179-FEATURE-synchronizacja-cennikow`, 2026-10-01): odstępstwa od produkcji (decyzje użytkowniczki).
(1) `synchronizujDostawce`: timeout 120 s (było 30 s), 2 ponowienia co 120 s (AbortError, błąd sieci, 5xx), alert po 3. próbie
z dopiskiem o próbach, blokada nakładania per dostawca. (2) Próg „cennik podejrzanie mały” = 80% `last_item_count` (ostatni udany import),
nie historyczne `max_item_count`; błąd niesie liczbę i do 20 kodów brakujących kart; liczba zablokowanej próby w `supplier_feed_blocked`
(migracja 019, razem z jednorazowym resetem `max_item_count = last_item_count`). (3) Nowa trasa
`POST /api/dostawcy/{kod}/akceptuj-mniejszy-cennik` (auth `we`, audyt `akceptacja_mniejszego_cennika`, 404 bez zablokowanej próby).
Szczegóły: `docs/tickets/179-FEATURE-synchronizacja-cennikow/`.
