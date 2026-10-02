# 181 · scal-karty-auto: nie zerować/nie usuwać wariantu Selly, którego używa karta R (2026-10-01)

Odkryte przy wdrożeniu 180 na produkcji: z 273 wierszy `selly_products_scalone` aż 272 wskazują wariant Selly, który
nadal mapuje aktywna karta (zwykle karta R — obie karty Bridge miały TEN SAM wariant). `--zeruj-selly` wyzerowałby
w sklepie stan karty, która zostaje, a `--usun-duplikaty-selly` usunąłby jej wariant/produkt. Skryptów jeszcze nie uruchomiono.

Zmiana: `zerujWariantySelly` i `usunDuplikatySelly` pomijają wariant obecny w `selly_products` (stempel `wyzerowano_at` /
`usunieto_at` + `ostatni_blad = "pominięto: wariant współdzielony z <kod> — bez akcji w Selly"`), wynik ma licznik `pominieto`.
Test: `scal-karty-auto.test.ts` („ticket 181…”). Bramki zielone (2081 testów).
