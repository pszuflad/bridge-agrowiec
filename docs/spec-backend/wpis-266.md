# Wpis 266 — zamówienia partnerów w Selly w PLN

`podgladDlaSelly` buduje `zadanie` w PLN: `currency: "PLN"`, `exchange_rate: 1`, ceny pozycji i `delivery_price` = EUR × ostatni kurs z `kursy_nbp`, zaokrąglone do 0,01. Waluta zamówienia partnera nadal musi być EUR (blokada).
