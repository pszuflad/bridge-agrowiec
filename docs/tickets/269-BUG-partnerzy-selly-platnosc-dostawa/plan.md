# 269 — ID płatności i dostawy Selly dla partnerów

Test „Utwórz w Selly” (2026-10-14): po statusie (poprawionym ręcznie na 3) Selly odrzuciło `delivery_id: 101` („Brak metody wysyłki zamówienia o id: 101”). 101 to ID VAT „0 % WDT” wpisane w złe pole; `payment_id` 10 było założeniem. Użytkowniczka potwierdziła: płatność = przelew (ID 1), dostawa = 209 („MO5 – Dostawa kurierska” z wzoru zamówienia ze sklepu).

- Stałe domyślne: `SELLY_PLATNOSC_ID = 1`, `SELLY_DOSTAWA_ID = 209`.
- Krok wdrożenia `2026-10-14-partnerzy-selly-platnosc-dostawa`: dla TyreWorld i Adtyres uzupełnia puste pola i zastępuje tylko znane błędne wartości (10, 101); ręcznie ustawionych innych nie rusza.
- Nie dotyczy nazw produktów.
