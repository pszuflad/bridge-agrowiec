# 272 — dwa zamówienia symulacyjne (Adtyres i TyreWorld) z pełnym adresem

Prośba 2026-10-14: „przygotujmy symulację dwóch zamówień, jedno z Adtyres, drugie z Furmana, obojętnie jaki kraj”. Zamówienie testowe 267 nie ma adresu dostawy, więc Selly odrzuciło je przez `ship_postcode`.

- Krok wdrożenia `2026-10-14-partnerzy-symulacja-zamowien` (tylko produkcja): `TEST-SYM-ADTYRES-20261014` (format DOCUMENTORDER, dostawa do FR, 2 pozycje) i `TEST-SYM-TYREWORLD-20261014` (format `bestellung`, dostawa do DE, 2 pozycje) — produkty aktywne ze stanem ≥ 2 i jednoznacznym powiązaniem Selly, ceny stałe (180/240 i 200/150 EUR), dane odbiorców zmyślone i oznaczone TEST.
- Zapis przez `zapiszZamowienie` + `zwaliduj`, jak prawdziwe pliki; idempotentne po numerze; brak partnerów albo 4 produktów → krok odłożony.
- Nic nie idzie do Selly ani do partnera bez kliknięcia „Utwórz w Selly”; tracking nie wychodzi bez wpisania numeru listu.
- Nie dotyczy nazw produktów.
