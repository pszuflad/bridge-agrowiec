-- 016_mo7_stan_zero.sql — decyzja Anny 2026-09-30: stan Nokiana (MO7) zawsze 0.
--
-- ⚠ NOWA LOGIKA BIZNESOWA, NIE ODTWORZENIE PRODUKCJI. Cennik Nokiana podaje „5+", które
-- parser zamieniał na 5 dla każdej pozycji. Nowe importy dostają 0 z `parsujPlik()`
-- (`src/import/parsuj.ts`); ta migracja zeruje stan produktów, które już są w katalogu,
-- żeby zmiana była widoczna od razu, a nie dopiero po następnym imporcie MO7.
UPDATE products SET stan = 0 WHERE dostawca = 'MO7' AND stan <> 0;
