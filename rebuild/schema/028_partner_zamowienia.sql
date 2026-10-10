-- Ticket 228 (228-FEATURE-partnerzy-model-zamowien, PRT-7.1): zamówienia odbierane od partnerów B2B.
--
-- ⚠ NOWE TABELE, NIE ODTWORZENIE PRODUKCJI; powstają puste, bez kroków ręcznych. Sam model i parser — odbiór (FTP/e-mail), walidacja
-- biznesowa i wysyłka do Selly to kolejne tickety (7.2–7.5).
--   partner_zamowienia          — jedno zamówienie partnera; numer partnera (`NUMBER` z pliku) i nasz numer osobno.
--                                 UNIQUE(partner_id, numer_partnera) = idempotencja: ten sam plik wczytany drugi raz nie tworzy duplikatu.
--   partner_zamowienia_pozycje  — pozycje; `kod` = numer katalogowy z pliku (`CODE`), TEKST (zera wiodące są znaczące).
-- `numer_wlasny` jest NULL, dopóki zamówienie nie trafi do sklepu (7.5). `status` bez CHECK — kolejne tickety dokładają wartości.
CREATE TABLE IF NOT EXISTS partner_zamowienia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL REFERENCES partnerzy(id) ON DELETE CASCADE,
  numer_partnera TEXT NOT NULL,
  numer_wlasny TEXT,
  status TEXT NOT NULL DEFAULT 'nowe',
  data_zamowienia TEXT,
  data_dostawy TEXT,
  waluta TEXT,
  koszt_dostawy REAL,
  kraj_dostawy TEXT,
  faktura_json TEXT NOT NULL DEFAULT '{}',
  dostawa_json TEXT NOT NULL DEFAULT '{}',
  surowy_xml TEXT NOT NULL,
  skrot_xml TEXT NOT NULL,
  pobrano TEXT NOT NULL,
  UNIQUE (partner_id, numer_partnera)
);

CREATE TABLE IF NOT EXISTS partner_zamowienia_pozycje (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zamowienie_id INTEGER NOT NULL REFERENCES partner_zamowienia(id) ON DELETE CASCADE,
  lp INTEGER NOT NULL,
  kod TEXT NOT NULL,
  nazwa TEXT,
  ilosc INTEGER NOT NULL,
  cena_sprzedazy REAL,
  UNIQUE (zamowienie_id, lp)
);

CREATE INDEX IF NOT EXISTS idx_partner_zamowienia_pozycje_zam ON partner_zamowienia_pozycje(zamowienie_id);
