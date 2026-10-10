# 229 — odbiór zamówień partnerów przez e-mail (PRT-7.3)

> Status: Approved (użytkownik 2026-10-10: „tak", pracujemy autonomicznie) · Gałąź: `claude/peaceful-gates-a8yebr`

Karta: `docs/karty/PARTNERZY/` · poziom 7 · zależy od 228 (model zamówień i parser).

## Zakres
- `src/partnerzy/poczta.ts` — interfejs skrzynki (`OtworzSkrzynke` → `Skrzynka.pobierzNieprzeczytane()`), za nim IMAP (`poczta-imap.ts`, `imapflow` + `mailparser`); testy NIGDY nie łączą się z prawdziwą pocztą (atrapa).
- `src/partnerzy/odbior-email.ts` — `odbierzZamowieniaEmail`: dla partnera z `kanal_email` i `email_skrzynka` czyta nieprzeczytane wiadomości, bierze załączniki XML, zapisuje przez `zapiszZamowienie` (228, idempotentnie), loguje wynik do `partner_logi` / `partner_error_log`.
- Sekrety: host/port IMAP w `PARTNERZY_IMAP_HOST` / `PARTNERZY_IMAP_PORT` (993), hasło per partner w `PARTNERZY_IMAP_HASLO_<id partnera>`; użytkownik = `email_skrzynka`. **Brak hosta lub hasła → kanał partnera POMIJANY z wpisem w logu**, bez błędu (CLAUDE.md pkt 2).
- Harmonogram: `PARTNERZY_ODBIOR_EMAIL` (domyślnie WYŁĄCZONY, jak scheduler cenników), `PARTNERZY_ODBIOR_EMAIL_MINUTY` (domyślnie 5). Tylko aktywni partnerzy.

## Decyzje (samodzielnie, użytkownik zlecił pracę bez pytań)
- Wiadomość jest oznaczana jako przetworzona (`\Seen`) po próbie przetworzenia — także gdy plik był błędny (inaczej wracałby co 5 minut). Błąd NIE ginie: idzie do `partner_error_log`. Wyjątek infrastrukturalny (np. baza) zostawia wiadomość nieprzeczytaną — zostanie ponowiona.
- Wiadomość bez załącznika XML → ostrzeżenie w logu błędów, oznaczona jako przetworzona.
- Ten sam `NUMBER` z inną treścią → ostrzeżenie (nie nadpisujemy, zob. 228).
- Zależności: `imapflow` 2.0.6 i `mailparser` 3.9.28 (wersje przypięte, starsze niż 2 tygodnie), `@types/mailparser` dev. `npm audit` nie zgłasza nowych pakietów.
- Brak tras REST („odbierz teraz" i lista zamówień to panel 7.6).

## Kontrakt i fixtures
Brak (nie dotyka kontraktu): moduł wewnętrzny, bez tras. Kontrakty zewnętrzne (Selly, dostawcy) nie ruszone.

## Testy
`partnerzy.odbior-email.test.ts` na atrapie skrzynki: zapis, idempotencja, bez XML, błędny XML, pominięcie bez sekretu, awaria połączenia, nieaktywny partner, wyjątek bazy zostawia wiadomość.

## Poza zakresem
FTP (7.2), walidacja biznesowa (7.4), Selly (7.5), panel (7.6).

## Definition of done
- [ ] Testy i bramki zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop`
