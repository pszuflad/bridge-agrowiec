# 259 — PARTNERZY: zdjęcie pola „Przesyłka bazowa” (przesyłka tylko z tabel GEIS)

Decyzja użytkowniczki 2026-10-14: pole „Przesyłka bazowa EUR” w ustawieniach kraju partnera jest niepotrzebne — system ma liczyć przesyłkę do CSV wyłącznie z wagi (i wymiarów) opony oraz cennika GEIS.

Zmiana zachowania (jawna): wcześniej niepusta „przesyłka bazowa” kraju (15 EUR wpisane przez konfigurację startową, ticket 237) zastępowała tabele GEIS dla wszystkich opon. Teraz przesyłka = stawka GEIS dla wagi rozliczeniowej (max z wagi i gabarytu) × (1 + paliwo %) + pakowanie z tabeli + myto i pakowanie kraju z panelu. Kraj bez tabeli GEIS albo opona bez wagi/wymiarów = pozycja NIE jest wyceniana (`BladKalkulacji`, nigdy cena 0) — dotąd maskowała to stała 15 EUR.

Zakres: kalkulator (`kalkulator.ts`), podgląd kosztu (`podglad-przesylki.ts`: tylko źródło `geis`), selekcja, walidacja ustawień kraju (pole `przesylkaStalaEur` w żądaniu ignorowane), konfiguracja startowa (nie ustawia już 15 EUR), panel (kolumna zniknęła; opis pod tabelą), krok wdrożenia `2026-10-14-partnerzy-zdjecie-przesylki-bazowej` czyści stare wartości w `partner_kraje.przesylka_stala_eur`. Kolumna w bazie zostaje (bez migracji destrukcyjnej), nieużywana.
Testy kalkulatora/publikacji/marży dostały tabele GEIS zamiast stałej przesyłki.
Skutek po wdrożeniu: ceny dla kraju pojawią się w pliku partnera dopiero, gdy kraj ma zaimportowaną tabelę GEIS; opony bez wagi/wymiarów będą pomijane i widoczne w logu błędów partnera.
