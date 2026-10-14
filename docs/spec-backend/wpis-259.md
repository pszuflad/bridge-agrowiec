# Wpis 259 — przesyłka partnera tylko z tabel GEIS

`partner_kraje.przesylka_stala_eur` („przesyłka bazowa”) wycofana z wyceny: `obliczCene` i `podgladKosztuPrzesylki` zawsze liczą z tabel GEIS (`kosztPrzesylki`) + myto + pakowanie kraju. Kolumna zostaje w bazie (nieużywana), krok wdrożenia `2026-10-14-partnerzy-zdjecie-przesylki-bazowej` ustawia ją na NULL. Żądanie `PUT /api/partnerzy/:id/kraje/:kraj` ignoruje pole `przesylkaStalaEur`. Szczegóły: `docs/tickets/259-FEATURE-partnerzy-zdjecie-przesylki-bazowej/plan.md`.
