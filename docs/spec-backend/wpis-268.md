# Wpis 268 — zamówienie partnera do Selly w PLN

Sklep Selly prowadzi zamówienia w PLN; `POST /api/orders` odrzuca `currency` („Niedozwolone pole: currency”) — `currency`/`exchange_rate` są tylko w odczycie. `podgladDlaSelly` wysyła więc `price_with_tax` i `delivery_price` = EUR × ostatni kurs z `kursy_nbp` (grosze), bez pól waluty. Wersja z `currency: EUR` + `exchange_rate` (ticket 249) była nieweryfikowaną hipotezą.
