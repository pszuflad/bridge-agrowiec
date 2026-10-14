# 268 — zamówienie partnera do Selly w PLN, bez pól waluty

Pierwsza próba „Utwórz w Selly” (2026-10-14): status 101 odrzucony (to było ID VAT, poprawione w ustawieniach partnera na 3), potem `HTTP 400: Niedozwolone pole: currency`. Wzór zamówienia ze sklepu: `base_currency: "PLN"`, `currency`/`exchange_rate` tylko do odczytu, ceny w PLN.

- Ciało `POST /api/orders` bez `currency` i `exchange_rate`; `price_with_tax` i `delivery_price` = EUR z pliku partnera × ostatni kurs NBP (grosze). To odtwarza dawną integrację (EUR → PLN wg NBP).
- Opis w podglądzie: ceny przeliczone na PLN po kursie z datą tabeli.
- Reguły z `partnerzy.kurs-nbp` bez zmian (kurs w panelu: niższy z NBP i ręcznego — dotyczy cennika; zamówienie używa ostatniego zapisanego kursu).
- Nie dotyczy nazw produktów.
