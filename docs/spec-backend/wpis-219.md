# Wpis 219 — logi operacji partnerów

Ticket `219-FEATURE-partnerzy-logi` (PRT-4.2). Tabele `partner_logi` (jedna linia na operację) i `partner_error_log` (błędy/ostrzeżenia, `poziom`), migracja 027. `zapiszWynikGenerowania` zapisuje
wynik generatora i czyści wpisy starsze niż 30 dni. Odczyt: `GET /api/partnerzy/:id/logi` oraz `/error-log` (poza openapi). Zapisuje je scheduler (PRT-4.1) i ręczne „generuj teraz”.
