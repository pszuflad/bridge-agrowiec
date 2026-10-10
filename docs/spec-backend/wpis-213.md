# Wpis 213 — kalkulator ceny partnera

Ticket `213-FEATURE-partnerzy-kalkulator-ceny` (PRT-2.4). `src/partnerzy/kalkulator.ts`: `obliczCene` scala kurs (210), transport GEIS (212) i
formułę (211). Domyślnie `zakup×(1+narzut)/kurs + przesyłka_EUR + koszty_dodatkowe/kurs`; narzut w %, koszty dodatkowe w PLN, przesyłka GEIS w EUR.
Błędy danych → `BladKalkulacji` (pozycja pomijana i logowana przez generator, nigdy 0); waga auto/szacowana daje ostrzeżenie. Reguły zaokrąglania:
`grosz|euro|gora5|gora10`. Konsument: selekcja i generator plików (PRT-3.x).
