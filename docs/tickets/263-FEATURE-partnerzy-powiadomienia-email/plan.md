# 263 — PARTNERZY: powiadomienia e-mail o błędach zamówień (do Marty)

Decyzja użytkowniczki 2026-10-14: powiadomienia o błędach zamówień mają iść e-mailem do Marty; ustawienia SMTP podała zrzutem z panelu sklepu (skrzynka firmowa `info@agroopony.eu`, serwer `vpshd86.cyber-folks.pl`, port 465, nadawca „AGROOPONY”).
Zakres:
- `src/poczta/nadawca.ts` — wysyłka SMTP przez `nodemailer` (nowa zależność, wersja przypięta; `@types/nodemailer` w devDependencies) za interfejsem `NadawcaEmail` (testy używają atrapy, nigdy prawdziwego SMTP). Port 465 = SSL od razu. Hasło tylko ze środowiska, maskowane w komunikatach błędów.
- `src/partnerzy/powiadomienia.ts`: (1) przebieg co `POWIADOMIENIA_PARTNERZY_MINUTY` (domyślnie 5) — zamówienia w statusie `blad_importu`, o których jeszcze nie wysłano wiadomości (tabela `partner_powiadomienia`, migracja 038; wiersz powstaje po udanej wysyłce, więc nieudana jest ponawiana); (2) natychmiast po nieudanym „Utwórz w Selly” (odmowa sklepu albo niejasny wynik, HTTP 502) — best effort, błąd SMTP tylko do logu. Wiadomość: partner, numer zamówienia, powód — bez surowego XML-a i danych klienta.
- `POST /api/partnerzy/powiadomienia/test` — wiadomość próbna (503 bez konfiguracji, 502 przy błędzie SMTP).
- Konfiguracja (`config/env.ts`): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_HASLO` (sekret), `SMTP_OD`, `SMTP_OD_NAZWA`, `POWIADOMIENIA_PARTNERZY_DO` (adresy po przecinku). Brak któregokolwiek z wymaganych = powiadomienia wyłączone, bez błędu.
- Krok wdrożenia `2026-10-14-partnerzy-smtp-ustawienia` (tylko produkcja): dopisuje w `.env` produkcji TYLKO brakujące klucze `SMTP_HOST/PORT/USER/OD/OD_NAZWA` (dane skrzynki firmowej ze zrzutu). NIE ustawia hasła ani odbiorców.
Zostaje po stronie użytkowniczki: wpisać w `.env` produkcji `SMTP_HASLO` i `POWIADOMIENIA_PARTNERZY_DO` (adres Marty), po wdrożeniu kliknąć/wywołać wiadomość próbną.
Skutek w działaniu: dopóki nie ma hasła i odbiorcy, nic się nie zmienia (powiadomienia wyłączone). Po ich wpisaniu: wiadomości o błędach importu zamówień i o nieudanym tworzeniu w Selly. Nie dotyczy brakującego numeru listu, korekty ani usuwania przesyłki (poza zakresem — decyzja użytkowniczki).
