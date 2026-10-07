# Wpisy backlogu od sesji 194 · 2026-10-06

### #194.1 — Tor 1 co 15 min ponawia „produkt nie istnieje w Selly" (pending_create)

**Status:** ✅ wdrożone w tickecie 194 (decyzja użytkownika: „można zmienić”)
**Do nowej wersji?** tak
**Źródło:** audyt przepływu synchronizacji. Tor 1 bez map słownikowych nie umie założyć produktu, więc wiersze
bez `selly_id` kończą błędem `pending_create` w każdym cyklu (a Tor 2 jest wyłączalny, ticket 190). To oryginał.
Opcje: wycofanie ponawiania (backoff) albo włączenie Toru 2.

### #194.2 — `syncDelta` wysyła `price: cena_sprzedazy ?? 0` i `quantity: stan ?? 0`

**Status:** ✅ wdrożone w tickecie 194 (decyzja użytkownika: „można zmienić”)
**Do nowej wersji?** tak
**Źródło:** audyt. Gdy `cena_sprzedazy` jest NULL, do żywego sklepu poszłaby cena 0. Oryginał robi tak samo; nie zmieniano.
Rozważyć pominięcie takiego wiersza.

### #194.3 — Odrzucenia tożsamości (`sprawdzCelSelly`) ponawiane w każdym cyklu

**Status:** ✅ wdrożone w tickecie 194 (decyzja użytkownika: „można zmienić”)
**Do nowej wersji?** tak
**Źródło:** audyt (ticket 184). Zablokowany zapis wraca co cykl; od 194 widać je w „Szczegółach" wpisu (kategoria `tozsamosc`).
