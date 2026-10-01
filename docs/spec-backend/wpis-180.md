# Wpis do spec-backend od ticketu 180 · 2026-10-01

**Sekcja:** import — walidacja EAN (staging_policy `validateEan`) i migracja `scal-karty-auto` (#177).

**Potwierdzone w 180** (`180-FEATURE-handlopex-ean-slownik-duplikaty-auto`, 2026-10-01): odstępstwa od produkcji (decyzje użytkowniczki).
(1) MO4/MO5 (Handlopex): EAN-13 z poprawną sumą i doklejonym oznaczeniem partii (1–3 litery, opcjonalnie `_`/`-`/spacja i cyfra) zapisywany
jako same cyfry, surowy w `_supplierEanOriginal`; numer odrzucony wyłącznie za cyfrę kontrolną — prawidłowy (`polityka/ean-dostawcy.ts`).
(2) `MODELE_PRODUCENTA`: Trelleborg T539, Cultor RD-01/AS-AGRI 10/13/19, Mitas EM-22, LingLong L-T20/L-S20/L-D20/L-T10/R-D30.
(3) `scal-karty-auto`: decyzja `usun_duplikat` dla kart AUTO ze stanem 0 w grupie wskazującej tę samą kartę R; usunięcie z Selly flagą
`--usun-duplikaty-selly` (migracja 020: `selly_products_scalone.do_usuniecia`, `usunieto_at`). Klient Selly: `deleteVariant`, `deleteProduct`.
Szczegóły: `docs/tickets/180-FEATURE-handlopex-ean-slownik-duplikaty-auto/`.
