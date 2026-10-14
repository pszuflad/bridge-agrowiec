# Wpis 269 — płatność i dostawa Selly

`partnerzy.selly_payment_id`/`selly_delivery_id` (pole bez UI) mogły zawierać 101 (ID VAT) lub 10 (założenie). Krok `2026-10-14-partnerzy-selly-platnosc-dostawa` ustawia przelew = 1 i dostawę = 209 dla TyreWorld/Adtyres tam, gdzie pole jest puste albo ma 10/101. Domyślne stałe w `podglad-selly.ts`: 1 i 209.
