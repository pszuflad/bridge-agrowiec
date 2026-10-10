# Wpis 233 — utwardzenie obsługi zamówień partnerów (po review 229–232)

Ticket `233-CHORE-partnerzy-utwardzenie-zamowien`. Bez nowych funkcji; poprawki przypadków brzegowych, zebrane z `review.md` ticketów 229–232.

- **Typ załącznika:** `czyXml` uznaje `.xml` oraz MIME `text/xml`, `application/xml`, `…+xml`; `application/vnd.openxmlformats-…` (xlsx/docx) i inne nie są XML-em zamówienia (wcześniej wpadały do parsera i dawały błędny „XML” w error_log).
- **Kodowanie:** `src/partnerzy/dekoduj-xml.ts` — BOM (UTF-8/16) → deklaracja `encoding` (ISO-8859-2, windows-1250 itd.) → UTF-8; nieznane kodowanie lub bajty niezgodne z kodowaniem = błąd pliku (`BladZamowienia`),
  nie zniekształcony tekst. Wcześniej `toString("utf-8")` niszczyło polskie litery z pliku w ISO-8859-2.
- **IMAP:** port inny niż 993 wymusza STARTTLS (`doSTARTTLS: true`) — bez tego imapflow łączyłby się bez szyfrowania, gdyby serwer go nie oferował. **Zmiana zachowania dla konfiguracji bez TLS na porcie ≠ 993 (zamierzona).**
- **Zamek odbioru** identyfikowany tokenem (`Symbol`), nie znacznikiem czasu.
- **Walidacja:** `POST …/waliduj` dla zamówienia w późniejszym statusie → 409 (wcześniej mylące 200 z `bledy:0`); szczegóły zamówienia zawierają `mozeWalidowac` (jedno źródło prawdy: `czyPodlegaWalidacji`), panel nie powiela listy statusów.
- **Panel:** `title` na wyłączonym przycisku „Odbierz teraz”, `aria-controls`, przewijana tabela pozycji, `scope="col"`, przycięty opis błędu w toaście, pusty stan mówi o wyłączonym kanale e-mail.
