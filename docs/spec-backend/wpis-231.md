# Wpis 231 — „Odbierz teraz” zamówienia z e-maila partnera

Ticket `231-FEATURE-partnerzy-odbierz-teraz` (PRT-7.3a). Nowa funkcjonalność, nie odtworzenie produkcji.

- `POST /api/partnerzy/:id/zamowienia/odbierz` (za `requireAuth`, poza `contract/openapi.yaml`): jeden odbiór dla partnera, także nieaktywnego i przy wyłączonym harmonogramie — do testów kanału.
  Odpowiedź 200: `{polaczono, powod, wiadomosci, nowe, duplikaty, bledy}`. Brak konfiguracji (`PARTNERZY_IMAP_HOST`, `PARTNERZY_IMAP_HASLO_<id>`) lub awaria połączenia to **200** z `polaczono:false` i czytelnym `powod`
  (nazwa zmiennej, nigdy wartość; hasło wycinane z komunikatów). 409: partner bez kanału e-mail/adresu skrzynki albo odbiór już trwa; 503: aplikacja bez wstrzykniętego odbioru (testy). Audyt: `partner_odbior_reczny`.
- Zamek odbioru jest per partner i **wspólny** dla ręcznego odbioru i harmonogramu (`OdbiorTrwaError`; harmonogram pomija zajętego partnera bez błędu). Zamek wygasa po 15 minutach (`LIMIT_ZAMKA_MS`),
  żeby zawieszone połączenie IMAP nie blokowało partnera do restartu.
- `OdbiorEmail` (fabryka skrzynki + ustawienia z `.env`) jest składany w `server.ts` i wstrzykiwany do `stworzApp`; testy wstrzykują atrapę.
- Panel: przycisk „Odbierz teraz” w sekcji zamówień (wyłączony z podpowiedzią, gdy kanał e-mail nie jest skonfigurowany); instrukcja testów: rozdział 1.7.
