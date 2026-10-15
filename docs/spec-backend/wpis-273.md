# Wpis 273 — symulacja ceny partnera

`POST /api/partnerzy/:id/symulacja-ceny` (requireAuth) `{kraj: "DE", kody?: string[], limit?: number}` → `{kraj, formula, kurs, pozycjeWybrane, wiersze[], ostrzezenia[]}`; 400 zły kraj, 404 brak kraju/partnera, 503 bez serwisu. Wiersz: zakup, marża sklepu, dopłata (+ źródło: kraj/reguła), narzut łączny, przesyłka (GEIS), koszty dodatkowe, `cenaEur` albo `blad`. Tylko odczyt; wycena przez `wycenPozycje` (jak generator). Trasa poza `contract/openapi.yaml`.
