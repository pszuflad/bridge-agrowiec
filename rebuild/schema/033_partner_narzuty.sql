-- Ticket 247 (247-FEATURE-partnerzy-reguly-narzutow): reguły narzutów PARTNERA (osobne od `markups` sklepu — decyzja użytkowniczki 2026-10-13).
--
-- ⚠ NOWA TABELA, NIE ODTWORZENIE PRODUKCJI. Zasada działania jak w „narzutach i promocjach” sklepu (specyficzna reguła z warunkami bije globalną,
-- między specyficznymi decyduje priorytet), ale własne dane: jedna lista na partnera, opcjonalnie zawężona do kraju. Brak pasującej reguły = narzut kraju
-- (`partner_kraje.narzut_proc`). Mutacja reguły NIE przelicza katalogu (ceny partnera powstają przy generowaniu pliku).
--   kraj      — NULL = wszystkie kraje partnera, inaczej kod kraju (np. DE)
--   warunki   — JSON: lista {typ, wartosc}; pusta = reguła globalna (typy jak w sklepie: dostawca, kategoria, marka, rozmiar, bieznik, produkt, konstrukcja, srednica, vfIf)
--   wartosc   — procent narzutu na zakup (12 = 12 %), „od”, nie marża
CREATE TABLE IF NOT EXISTS partner_narzuty (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL REFERENCES partnerzy(id) ON DELETE CASCADE,
  kraj TEXT,
  nazwa TEXT NOT NULL,
  warunki TEXT NOT NULL DEFAULT '[]',
  wartosc REAL NOT NULL,
  priorytet INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'aktywny',
  zmieniono TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_partner_narzuty_partner ON partner_narzuty (partner_id);
