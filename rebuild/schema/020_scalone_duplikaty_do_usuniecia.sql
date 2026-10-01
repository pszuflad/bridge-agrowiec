-- 020_scalone_duplikaty_do_usuniecia.sql — ticket 180 (2026-10-01)
--
-- ⚠ NOWA LOGIKA, NIE ODTWORZENIE PRODUKCJI. Grupy „kilka kart AUTO wskazuje tę samą prawdziwą kartę”
-- (`scal-karty-auto`): scalana jest karta AUTO z bieżącej oferty, a pozostałe karty AUTO ze stanem 0 to
-- duplikaty — decyzja Ani: usunąć je całkowicie z Bridge i z Selly („jak wróci, wpadnie jako nowy produkt”).
-- Wiersz mapowania Selly takiego duplikatu trafia do `selly_products_scalone` z `do_usuniecia = 1`;
-- `--usun-duplikaty-selly` usuwa wariant (albo cały produkt, gdy to jego jedyny wariant) i stempluje `usunieto_at`.
ALTER TABLE selly_products_scalone ADD COLUMN do_usuniecia INTEGER NOT NULL DEFAULT 0;
ALTER TABLE selly_products_scalone ADD COLUMN usunieto_at TEXT;
