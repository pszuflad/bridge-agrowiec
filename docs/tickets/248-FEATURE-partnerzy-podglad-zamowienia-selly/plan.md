# 248 — PARTNERZY: podgląd zamówienia przed Selly + stawki VAT w słownikach (tylko odczyt)

Decyzja użytkowniczki 2026-10-13: robimy „Utwórz w Selly" (zamawiający = partner z danymi do faktury, adres dostawy z zamówienia, VAT 0 %, EUR). Dokumentacji `POST /api/orders` Selly nie mamy (wyszukiwanie w sieci nic nie dało; w repo tylko `GET`), więc zapisu na żywy sklep NIE wysyłamy w ciemno.

Zakres tego ticketu (wszystko tylko do odczytu, Selly nie jest modyfikowany):
1. Słowniki Selly: dodana tabela „Stawki VAT" (`listVatRates`) — widać ID stawki 0 %. Nie zmienia stawek produktów: synchronizacja produktów bierze VAT z produktu/domyślnych 23 % albo wcale (`rest/mapper-v2.ts`), a ID stawki trafi tylko do ciała tworzonego zamówienia.
2. `GET /api/partnerzy/selly/przykladowe-zamowienie` (+ metoda klienta `listOrders`, klasyfikowana jako odczyt w `selly/tryb.ts`) — jedno ostatnie zamówienie sklepu bez interpretacji, żeby poznać prawdziwy kształt zamówienia Selly.
3. `GET /api/partnerzy/:id/zamowienia/:zamowienieId/podglad-selly` — zamawiający (`partnerzy.faktura_*`), dostawa z zamówienia, pozycje dopasowane do katalogu (`znajdzPozycjeKatalogu`: `products.kod` albo `EAN-dostawca`), blokady: brak danych do faktury, pozycje bez dopasowania („do ręcznej weryfikacji"), zamówienie ma już numer własny.
4. Panel: przycisk „Podgląd do Selly" przy zamówieniu; „Przykładowe zamówienie z Selly" w słownikach.

Następny ticket (po poznaniu kształtu zamówienia i wskazaniu ID statusu/płatności/dostawy/VAT 0 %): `POST /api/orders` ręcznie jednym przyciskiem, flaga domyślnie wyłączona, zapis `numer_wlasny`.
