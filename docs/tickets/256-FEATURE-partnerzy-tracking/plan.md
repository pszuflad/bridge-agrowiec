# 256 — PARTNERZY: tracking (numer listu przewozowego → plik dla partnera)

Prośba użytkowniczki 2026-10-13: w panelu ma być miejsce na wpisanie numeru listu przewozowego, a Bridge ma automatycznie wysłać partnerowi tracking. Wzoru pliku od partnerów nie ma — użytkowniczka określiła format na podstawie portalu partnera (zrzut formularza „Add tracking” Adtyres: numer zamówienia, firma kurierska z listy, typ trackingu, numery listów, EAN i „Your item ID” w podsumowaniu zamówienia):
`order_id;platform_order_id;supplier_item_id;ean;carrier;tracking_number;tracking_type;quantity_shipped;shipped_at` (separator `;`, nagłówek, `shipped_at` ISO 8601 z przesunięciem Europe/Warsaw). Format jest ZAŁOŻENIEM — do potwierdzenia z partnerami przed pierwszym użyciem.
Zakres:
1. Migracja 037: `partner_wysylki` (przesyłka = numer listu, przewoźnik, typ `delivery`/`pickup`, data, pozycje JSON, status pliku `zapisany`/`brak_katalogu`/`blad`).
2. `src/partnerzy/tracking.ts`: walidacja (przewoźnik i numer wymagane, ilości ≤ zamówione łącznie, brak duplikatu numeru, tylko zamówienia przyjęte/wysylanie/wyslane), budowa pliku (`order_id` = numer z Selly, a przed utworzeniem w Selly `ZAM-<id>`; `platform_order_id` = numer partnera; `supplier_item_id` = kod pozycji z zamówienia; `ean` z dopasowanego produktu), zapis do katalogu partnera przez plik tymczasowy + rename.
3. Trasy: `GET/POST /api/partnerzy/:id/zamowienia/:zid/przesylki`, `GET …/przesylki/:wid/plik`, `POST …/przesylki/:wid/ponow`.
4. `PARTNERZY_KATALOGI_TRACKINGU` (`Nazwa=/ścieżka;…`, tylko w `.env` produkcji; bez wpisu plik zostaje do podejrzenia w panelu). Błąd zapisu pliku NIE cofa przesyłki — widać go w panelu i można ponowić.
5. Panel: sekcja „Numer listu przewozowego” przy zamówieniu partnera (przewoźnik, numer, typ, sztuki w paczce), lista przesyłek ze statusem pliku, „Pokaż plik”, „Ponów zapis pliku”.
Poza zakresem (do rozważenia po odpowiedzi partnerów): lista przewoźników (kody jak w portalu partnera — dziś pole tekstowe), „brak numeru listu”, wiele numerów w jednym wpisie (dziś każdy numer osobno z ilościami sztuk), usuwanie/korekta przesyłki po wysłaniu pliku, import odpowiedzi partnera.
