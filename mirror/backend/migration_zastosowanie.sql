-- Migracja: dodanie pola "zastosowanie" (kombajn, ciągnik, ładowarka, koparka itd.)
-- Uruchomić jednorazowo na bazie bridge (sqlite3 baza.db < migration_zastosowanie.sql)

-- 1. Nowa kolumna w products
ALTER TABLE products ADD COLUMN zastosowanie TEXT;

-- 2. Nowy rodzaj atrybutu (żeby dropdown w UI/staging był zasilany z /api/atrybuty)
INSERT OR IGNORE INTO atrybuty_rodzaje (value, label, opis, core)
VALUES ('zastosowanie', 'Zastosowanie', 'Typ maszyny / zastosowanie opony (ciągnik, kombajn, ładowarka, koparka, przyczepa itd.)', 0);
