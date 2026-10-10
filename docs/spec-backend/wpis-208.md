# Wpis 208 — model danych partnerów B2B

Ticket `208-FEATURE-partnerzy-model-danych` (PRT-1.1, karta `docs/karty/PARTNERZY/`). **Nowa funkcjonalność, nie odtworzenie produkcji.**

Migracja `024_partnerzy.sql` zakłada osiem tabel: `partnerzy` (ustawienia partnera: `aktywny` domyślnie 0, `stan_min` 2,
`zaokraglanie`, `harmonogram_minuty`, `tolerancja_ceny_proc`, `format_pliku`, `csv_separator`, kanały zamówień),
`partner_magazyny`, `partner_wykluczenia` (po `products.kod`), `partner_kraje` (narzut, źródło kursu `nbp`/`reczny`, koszty
dodatkowe; unikalne `(partner_id, kraj)`), `partner_kolumny`, `partner_pola_obliczeniowe`, `paliwo_historia` (per kraj, nie
per partner) i `partner_kursy` (kurs użyty przy pliku). Tabele podrzędne kasują się kaskadowo z partnerem. Żaden istniejący kod
ich nie używa; logika, trasy i panel — kolejne tickety karty.
