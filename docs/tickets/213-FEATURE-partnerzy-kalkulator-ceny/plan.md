# 213 — kalkulator ceny partnera (PRT-2.4)

Karta: `docs/karty/PARTNERZY/` · poziom 2 · zależy od 210 (kurs), 211 (formuły), 212 (transport).

## Zakres
`src/partnerzy/kalkulator.ts`: `obliczCene(db, wejscie)` → `{cenaEur, cenaPrzedZaokragleniem, skladniki, ostrzezenia}` albo `BladKalkulacji`.
`zaokragliWgReguly` (grosz / euro / w górę do 5 / w górę do 10). Bez migracji i tras.

## Decyzje (do potwierdzenia przez użytkownika)
- **Domyślna formuła (EUR):** `zakup * (1 + narzut) / kurs_EUR + przesylka_eur + koszty_dodatkowe / kurs_EUR`. Karta podaje `(zakup + zakup×narzut + przesyłka + koszty) / kurs`; różnica to jednostka przesyłki: tabele GEIS czytamy jako **EUR** (zgodnie z wyceną 175 EUR), więc nie dzielimy ich przez kurs. Wzór z karty działa jako własne pole obliczeniowe (zmienna `przesylka_pln` — test).
- **Narzut** w `partner_kraje.narzut_proc` to PROCENT (12 = 12 %); w formule jako ułamek `narzut` (0.12). **Koszty dodatkowe** w PLN.
- Pozycja bez ceny zakupu, wagi, wymiarów, tabeli kraju, z wagą ponad próg lub z błędem formuły → `BladKalkulacji` (wywołujący pomija i loguje); nigdy cena 0.
- Waga uzupełniona automatycznie / szacowana jest użyta, ale daje ostrzeżenie do logu (mniej pewna).
- Zaokrąglamy dopiero wynik; wyniki pośrednie w pełnej precyzji.

## Zmiana zachowania produkcji
Brak — nowy moduł, nikt go jeszcze nie woła. Nazw produktów nie dotyka.

## Testy
`test/partnerzy.kalkulator.test.ts` — wzór, zgodność z wzorem z karty, zaokrąglanie, błędy, ostrzeżenia wag, paliwo od daty.
