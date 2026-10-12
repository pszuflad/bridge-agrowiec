# 235 — PARTNERZY: nazwy plików, koszty w EUR, stały koszt przesyłki, blokada przy braku narzutu

Źródło: `docs/karty/PARTNERZY/wejscie-odpowiedzi-2026-10-12.md` (odp. 2, 11, 12, 14, 19, 33) i rozmowa z 2026-10-12.

Zakres:
1. Migracja 030: `partnerzy.nazwa_pliku`, `partner_kraje.przesylka_stala_eur`.
2. Nazwy plików: `<nazwa_pliku|slug>.csv` / `<baza>_<kraj małymi>.csv|xml` (np. `adtyres_agrowiec_at.csv`, `tyreworld_agrowiec.csv`).
3. Archiwum: jeden plik na dzień (`YYYYMMDD_<plik>`), kolejne generowanie tego dnia zastępuje; czyszczenie 30 dni obsługuje też stare nazwy.
4. Koszty dodatkowe w EUR (formuła domyślna bez dzielenia przez kurs; ZMIANA SEMANTYKI — na produkcji brak partnerów z kosztami, nic nie przeliczamy).
5. Stały koszt przesyłki kraju w EUR zamiast tabel GEIS (gdy ustawiony; puste = GEIS).
6. Blokada: kraj z narzutem 0 % nie dostaje cen (jeden błąd na kraj), żeby nie opublikować cen zakupu.
7. Panel: kolumny EUR, pole „Przesyłka EUR”, kolumna „Używany kurs” (ręczny albo ostatnio użyty w pliku).

Poza zakresem: numer katalogowy `EAN-dostawca`, ceny wg reguł „narzuty i promocje”, harmonogram 60 min + FTP, wdrożeniowy krok konfiguracji partnerów.
