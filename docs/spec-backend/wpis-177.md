# Wpis do spec-backend od ticketu 177 · 2026-10-01

**Sekcja:** import/staging — karty `MO*_AUTO_*` po zmianie 172.

**Potwierdzone w 177** (`177-FEATURE-scal-karty-auto`, 2026-10-01): po 172 oferta dopasowuje się po kodzie do karty z prawdziwym
kodem, a karta AUTO (stan zamrożony) generuje zgłoszenie „Brak starego kodu…”. Jednorazowe scalenie: `npm run scal-karty-auto`
(dry-run/`--apply`/`--zeruj-selly`), archiwa `products_scalone` i `selly_products_scalone` (migracja 018). Karta AUTO znika, zostaje
karta z prawdziwym kodem; w Selly zostaje produkt tej drugiej, wariant AUTO dostaje stan 0 bez usuwania. Pary niejednoznaczne
(brak/kilka kart R, różny prawdziwy EAN, niezgodne cechy, kilka A na R) nie są scalane. Szczegóły: `docs/tickets/177-FEATURE-scal-karty-auto/`.
