# Wpis do spec-backend od ticketu 206 (usunięcie kart AUTO krokiem wdrożenia) · 2026-10-09

- Decyzja użytkowniczki (2026-10-09, wpis #173.1): usuwamy WSZYSTKIE karty `MO*_AUTO_<hash>`; jeśli pozycja jest w pliku dostawcy, wpadnie jako nowa karta
  i przejdzie zwykłą weryfikację w stagingu.
- Krok wdrożenia `2026-10-09-usun-karty-auto` (`kroki/rejestr.ts` → `usunWszystkieKartyAuto` w `import/migracje/scal-karty-auto.ts`): usuwa tylko karty o statusie
  `wstrzymany` (aktywne AUTO są pomijane i wypisane w wyniku kroku), twardy próg 30 kart (powyżej → wyjątek, nic nie usunięto), pełny wiersz karty + jej poprawki Marty
  trafiają do `products_scalone` (`scalono_do` = „USUNIĘTA (bez scalania)”), wpis `audit_log` `usuniecie_karty_auto`, czyszczenie `product_auto_suspensions`,
  `staging_*` i `manual_overrides` tej karty.
- Mapowanie Selly (`selly_products`) NIE jest ruszane: po usunięciu karty staje się sierotą; usuwa ją Tor 3, o ile przejdzie kontrolę tożsamości (EAN/nazwa z historii).
