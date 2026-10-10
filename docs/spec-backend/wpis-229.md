# Wpis 229 — odbiór zamówień partnerów przez e-mail

Ticket `229-FEATURE-partnerzy-odbior-email` (PRT-7.3). Nowa funkcjonalność, nie odtworzenie produkcji.

- `src/partnerzy/odbior-email.ts`: dla aktywnego partnera z `kanal_email` i `email_skrzynka` czyta nieprzeczytane wiadomości przez IMAP, bierze załączniki XML (po rozszerzeniu
  lub typie MIME) i zapisuje je przez `zapiszZamowienie` (ticket 228, idempotentnie po `NUMBER`). Wynik: jedna linia w `partner_logi` (operacja `odbior-zamowien-email`),
  błędy i ostrzeżenia w `partner_error_log`.
- IMAP za interfejsem (`poczta.ts`, `poczta-imap.ts`: `imapflow` + `mailparser`); testy używają atrapy, nigdy prawdziwej poczty. Połączenia IMAP **nie sprawdzono na prawdziwym serwerze**
  (brak dostępu z chmury) — pierwszy odbiór na środowisku testowym wymaga skrzynki testowej.
- Wiadomość jest oznaczana jako przetworzona (`\Seen`) po próbie, także przy błędnym pliku (błąd idzie do error_log); wyjątek infrastruktury zostawia ją nieprzeczytaną.
- Sekrety w `.env` serwera: `PARTNERZY_IMAP_HOST`, `PARTNERZY_IMAP_PORT` (993), `PARTNERZY_IMAP_HASLO_<id partnera>`. Brak hosta lub hasła → kanał pomijany z wpisem w logu.
- Harmonogram: `PARTNERZY_ODBIOR_EMAIL` (domyślnie wyłączony) i `PARTNERZY_ODBIOR_EMAIL_MINUTY` (5). Brak tras REST (panel zamówień to PRT-7.6).
- Zależności: `imapflow` 2.0.6, `mailparser` 3.9.28 (przypięte), `@types/mailparser` 3.4.6 (dev).
