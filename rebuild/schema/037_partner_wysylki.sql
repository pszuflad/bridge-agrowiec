-- Ticket 256 (256-FEATURE-partnerzy-tracking): wysyłki zamówień partnerów = numer listu przewozowego wpisany w panelu → plik trackingu CSV dla partnera.
--
-- ⚠ NOWA TABELA, NIE ODTWORZENIE PRODUKCJI. Format pliku trackingu to ZAŁOŻENIE użytkowniczki (brak wzoru od partnerów, 2026-10-13):
--   order_id;platform_order_id;supplier_item_id;ean;carrier;tracking_number;tracking_type;quantity_shipped;shipped_at
-- partner_wysylki: jedna przesyłka (numer listu) zamówienia; `pozycje` = JSON [{pozycjaId, ilosc}] (ile sztuk której pozycji w tej przesyłce);
--   `plik_status`: 'zapisany' (plik leży w katalogu partnera) | 'brak_katalogu' (nie skonfigurowano katalogu — plik do pobrania z panelu) | 'blad' (zapis się nie udał, `plik_blad`).
CREATE TABLE IF NOT EXISTS partner_wysylki (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zamowienie_id INTEGER NOT NULL REFERENCES partner_zamowienia(id) ON DELETE CASCADE,
  przewoznik TEXT NOT NULL,
  numer_przesylki TEXT NOT NULL,
  typ TEXT NOT NULL DEFAULT 'delivery',
  wyslano TEXT NOT NULL,
  pozycje TEXT NOT NULL,
  plik_nazwa TEXT,
  plik_status TEXT NOT NULL DEFAULT 'brak_katalogu',
  plik_blad TEXT,
  utworzono TEXT NOT NULL,
  UNIQUE (zamowienie_id, numer_przesylki)
);
CREATE INDEX IF NOT EXISTS idx_partner_wysylki_zamowienie ON partner_wysylki(zamowienie_id);
