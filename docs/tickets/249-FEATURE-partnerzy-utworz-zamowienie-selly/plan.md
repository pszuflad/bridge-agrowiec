# 249 — PARTNERZY: ręczne „Utwórz w Selly"

Podstawa: przykładowe zamówienie z `GET /api/orders` (użytkowniczka wkleiła je 2026-10-13; zawiera dane klienta sklepu — NIE trafia do repo, testy używają danych zmyślonych). Z niego wynikają nazwy pól i to, że produkt w zamówieniu to para `product_id` + `variant_id` (wariant = dostawca/magazyn), a formy dostawy bywają per dostawca („MO1 – Dostawa paletowa").

Zakres:
1. Migracja 034: `partnerzy.selly_status_id/selly_payment_id/selly_delivery_id/selly_vat_id` (NULL = nie ustawione); edycja w „Ustawieniach" partnera.
2. Pozycje → Selly przez LOKALNĄ tabelę `selly_products` (`bridge_kod` → `selly_product_id` + `selly_variant_id`), bez wołania Selly. Brak powiązania = blokada.
3. `GET …/podglad-selly` zwraca teraz też `ostrzezenia`, `zadanie` (dokładne ciało `POST /api/orders`; `null` przy blokadach) i `tworzenieWlaczone`.
4. `POST …/zamowienia/:id/utworz-w-selly` (`utworzWSelly`) + metoda klienta `createOrder` (ZAPISUJĄCA w `selly/tryb.ts`, więc blokowana w trybie `tylko-odczyt`).
5. Flaga `PARTNERZY_SELLY_ZAMOWIENIA` (domyślnie wyłączona; bez niej 403, przycisk nieaktywny).
6. Panel: „Utwórz w Selly" → pytanie → „Tak, utwórz"; ciało zamówienia widoczne przed wysłaniem.

Ciało zamówienia: status/płatność/dostawa z ustawień partnera, waluta EUR + `exchange_rate` = ostatni zapisany kurs NBP (PLN za 1 EUR), `invoice_*` = dane do faktury partnera (zamawiający), `ship_*` = dostawa z zamówienia (nazwa odbiorcy w `ship_company`, imię/nazwisko „-" jak w wzorcu), pozycje `{product_id, variant_id, quantity, price_with_tax, vat_rate_id}`, numer partnera w `client_comment`. Cena = cena partnera z pliku (EUR, VAT 0 %).

Poprawki po review (BLOCKER + SHOULD-FIX): wracamy do `przyjete` TYLKO przy jednoznacznej odmowie (4xx poza 408/429); timeout/zerwane połączenie/5xx zostawiają `wysylanie` (blokada duplikatu) z komunikatem „sprawdź w Selly”, a odblokowanie to osobna, audytowana akcja `POST …/zwolnij-wysylanie` (przycisk w podglądzie). Niejednoznaczne powiązanie `selly_products` (różne pary produkt/wariant dla jednego `bridge_kod`) = blokada, nie zgadywanie. Cena musi być > 0; kraj dostawy musi być 2-literowy; flaga działa tylko przy `SELLY_TRYB=pelny`; podgląd pokazuje kurs i datę tabeli (ostrzeżenie > 5 dni); audyt także przy nieudanej próbie (bez treści błędu); ID Selly = `isSafeInteger`.
Świadomie NIE zrobione: kraj faktury w ciele (brak pewnej nazwy pola w kontrakcie — do sprawdzenia przy pierwszej próbie), zapis `idSelly` poza `numer_wlasny`, pusty adres dostawy (Adtyres nie ma ulicy/kodu/miasta w pliku) jako ostrzeżenie, nie blokada — inaczej żadne zamówienie Adtyres nie przeszłoby.

Bezpieczeństwo: tworzenie tylko ręczne, jedno zamówienie na kliknięcie, potwierdzenie w panelu; zamówienie „zajmowane" (`przyjete`→`wysylanie`) PRZED wywołaniem sklepu (brak duplikatów przy podwójnym kliknięciu); błąd sklepu → powrót do `przyjete`; sukces → `wyslane` + `numer_wlasny`. Blokady: dane do faktury, ID Selly, brak dopasowania/powiązania pozycji, brak ceny, waluta ≠ EUR, brak kursu, status ≠ `przyjete`, już ma numer.

NIEZNANE (do sprawdzenia przy pierwszym zamówieniu — dlatego flaga i podgląd ciała): kontrakt `POST /api/orders` jest wyprowadzony z `GET`, nie z dokumentacji; kierunek `exchange_rate` dla EUR; czy sklep przyjmie `price_with_tax` jako cenę przy VAT 0 %; czy nieznane pola są ignorowane.
Poza zakresem: tracking, wiadomości do partnera, automatyczne tworzenie.
