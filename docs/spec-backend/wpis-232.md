# Wpis 232 — walidacja zamówień partnera względem katalogu

Ticket `232-FEATURE-partnerzy-walidacja-zamowien` (PRT-7.4a). Nowa funkcjonalność, nie odtworzenie produkcji.

- `src/partnerzy/walidacja-zamowienia.ts` — `zwaliduj(db, zamowienieId)`: dla każdej pozycji szuka produktu po `CODE` (dziś `products.kod`, UNIKALNE; jedyne miejsce mapowania to `znajdzPozycjeKatalogu` — po decyzji o numerze
  katalogowym `KK PP NNNNN` przestawia się tylko ją) i sprawdza: **nieznany kod**, **produkt nieaktywny** (`status ≠ 'aktywny'`), **brak stanu** (`stan < ilość`). Wynik: status `przyjete` albo `blad_importu`
  z opisem zbiorczym (`partner_zamowienia.blad_importu`) i powodem per pozycja (`partner_zamowienia_pozycje.blad`; migracja 029).
- Zamówienie ZAWSZE zostaje zapisane (nic nie ginie przed Selly) i **nie wychodzi żadne powiadomienie do partnera**. Zasada dla kodu/stanu jest „zakładana, do potwierdzenia” w karcie (dla ceny — zapisana); jest odwracalna.
- Wywołanie: automatycznie po każdym zapisie zamówienia z e-maila (też dla powtórzonego pliku — jest idempotentne i przywraca zamówienie po poprawie katalogu); w error_log ostrzeżenie, gdy zamówienie wpada w `blad_importu`;
  ręcznie `POST /api/partnerzy/:id/zamowienia/:zamowienieId/waliduj` (za `requireAuth`, poza `openapi.yaml`, audyt `partner_zamowienie_waliduj`) — zwraca świeże szczegóły. Waliduje tylko statusy `nowe`/`przyjete`/`blad_importu`;
  późniejsze (np. wysłane do sklepu, 7.5) są nietykalne.
- Stan jest sprawdzany dla ŁĄCZNEJ ilości danego kodu w zamówieniu (dwie linie tego samego kodu nie mogą razem przekroczyć stanu). Automatyczna walidacja po odbiorze (`zachowajPrzyjete`) nie degraduje zamówienia już `przyjete`
  po późniejszej zmianie stanu w katalogu; ręczne „Sprawdź ponownie” może je zdegradować (świadoma akcja). Odpowiedź ręcznej trasy: 200 + szczegóły zamówienia, 404 dla zamówienia spoza partnera, 401 bez logowania.
- **Poza zakresem: kontrola ceny/tolerancji** — czeka na wartość tolerancji, zasadę dla ceny wyższej (karta, „Otwarte” pkt 2) i zapis ceny z ostatniego cennika.
- Panel: status „przyjęte”/„błąd importu” (czerwony), ramka z opisem błędu, powód przy pozycji, przycisk „Sprawdź ponownie”. Instrukcja testów: rozdział 1.7.
