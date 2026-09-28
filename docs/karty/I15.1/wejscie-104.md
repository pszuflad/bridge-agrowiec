# Wejście dla I15.1 od ticketu 104 (koordynator) · 2026-09-22 — #101 puste blokady płatności u nowych produktów

Ania (runda 3, 2.2): „każdy nowy produkt ma to pole puste”. Trigger `products_blokowane_formy_ai` w teorii to załatwia
(`dostawca` w bazie = MO1…MO10). **Przyczyna nieznana** — patrz backlog #101 (hipotezy: MO6 poza listą, pole puste po
stronie Selly, ścieżka omijająca trigger). Przy pracy nad migracją sprawdź na kopii bazy (od 23.09 będzie świeża kopia
produkcji na stagingu — D2), czy produkty dodane po 10.09 mają pole puste, i zapisz wynik w karcie. Naprawa po stronie
Bridge wejdzie do tej karty dopiero po decyzji użytkownika (#101) — nie rozszerzaj zakresu sam.
