# 266 — zamówienie partnera w Selly w PLN (jak w dawnej integracji)

Dawna automatyzacja TyreWorld lokowała zamówienia w Selly „w locie”, przeliczając cenę EUR na PLN wg aktualnego kursu NBP. Decyzja użytkowniczki 2026-10-14: tak ma zostać.

- `podglad-selly.ts`: ciało zamówienia `currency: "PLN"`, `exchange_rate: 1`, `price_with_tax` i `delivery_price` = EUR × ostatni zapisany kurs NBP, zaokrąglone do groszy.
- Podgląd w panelu opisuje przeliczenie (bez „sprawdź kierunek kursu”).
- E-mail zamawiającego TyreWorld NIE jest zmieniany (decyzja 2026-10-14: zostaje bez zmian).
- Nie dotyczy nazw produktów (`nazwa_pamiec` / `manual_overrides`).
