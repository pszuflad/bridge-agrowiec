# Wpis 260 — pobranie pełnego pliku partnera z podglądu

`GET /api/partnerzy/:id/podglad/plik?nazwa=` zwraca jako załącznik pełny plik partnera (wszystkie pozycje; ta sama treść co zapis generowania), liczony przez `przygotujPliki` bez limitu; nie zapisuje na dysk ani do `partner_kursy`. Szczegóły: `docs/tickets/260-FEATURE-partnerzy-pobranie-pliku-z-podgladu/plan.md`.
