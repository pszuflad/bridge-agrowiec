# Wejście dla I15.10 od ticketu 116 (koordynator) · 2026-09-23 — kolizje `kod_importu` (#108), zawór w Torze 1

**Pomiar na świeżej kopii produkcji (23.09):** 80 grup `(dostawca, kod_importu)` wśród aktywnych produktów
ma więcej niż jeden wiersz; 174 produkty; **76 grup ma różne ceny lub stany**; wszystkie 80 mają już mapowanie
w `selly_products`. Rozkład: MO2 42, MO8 19, MO5 12, MO1 4, MO4 2, MO7 1. Przykład: `MO1_15126983` i
`MO1_15126981` — ta sama opona co do marki, modelu i rozmiaru, ale różne EAN-y, ceny i stany, jeden
`kod_importu` 326606.

**Skutek w Torze 1:** oba wiersze dzielą jeden snapshot (`stan_wyslany`, `cena_sprzedazy_wyslana`), więc każdy
nadpisuje poprzedni i **obie pozycje są wysyłane w kółko przy każdym cyklu** (HH:55 + co 15 min).

**Do zrobienia w tej karcie — wariant (c), jeśli użytkownik go potwierdzi:** przed wysyłką wykryć, że dla pary
`(dostawca, kod_importu)` istnieje więcej niż jeden aktywny produkt; taką grupę **pominąć** (`stats.skip`)
i odnotować w `selly_sync_log` (np. w `sample_errors` albo osobnym liczniku), zamiast wysyłać którykolwiek
wiersz. To ŚWIADOME ODSTĘPSTWO od produkcji — produkcja wysyła i wpada w pętlę.
Wariantu (a) — rozdzielenia grup w danych — **nie robisz**: to zmiana asortymentu w sklepie, czeka na decyzję Ani.

Decyzja użytkownika i ewentualna zmiana zakresu: patrz backlog #108.
