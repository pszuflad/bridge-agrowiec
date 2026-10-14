-- Ticket 263 (263-FEATURE-partnerzy-powiadomienia-email): powiadomienia e-mail o błędach zamówień partnerów.
--
-- ⚠ NOWA TABELA, NIE ODTWORZENIE PRODUKCJI. Zapamiętuje, o którym zamówieniu i z jakiego powodu już wysłano wiadomość, żeby ten sam błąd nie
-- przychodził co kilka minut (`rodzaj`: 'blad_importu'). Wiersz powstaje DOPIERO po udanej wysyłce — nieudana jest ponawiana przy następnym przebiegu.
CREATE TABLE IF NOT EXISTS partner_powiadomienia (
  zamowienie_id INTEGER NOT NULL REFERENCES partner_zamowienia(id) ON DELETE CASCADE,
  rodzaj TEXT NOT NULL,
  wyslano TEXT NOT NULL,
  PRIMARY KEY (zamowienie_id, rodzaj)
);
