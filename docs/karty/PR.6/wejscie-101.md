# Wejście dla PR.6 od ticketu 101 (PR.5) · 2026-09-22

Dotyczy `docs/przeglad-12-widokow.md` §3 (Katalog), pozycja „filtry (marka, kategoria, dostępność)”,
oraz zgłoszenia Ani 12.4 („w filtrach marki w katalogu jest ALLIANCE i alliance”).

- **Stan po tickecie 101:** decyzja #92 = **dane**, nie prezentacja. Filtr marek we froncie jest
  BEZ zmian — duplikat znika, bo migracja `rebuild/schema/010_marka_caps.sql` poprawia
  `products.marka` (na snapshocie: `MO1_71970103` `Alliance` → `ALLIANCE`, razem 849) i usuwa
  `Alliance` ze słownika marek.
- **Propozycja pozycji do przeglądu (§3), w układzie „Zgłosiłaś → Jest teraz → Sprawdź”:**
  Zgłosiłaś: w filtrze marek są `ALLIANCE` i `Alliance`. → Jest teraz: jedna marka `ALLIANCE`
  (849 pozycji na danych z kopii). → Sprawdź: rozwiń filtr marki, wpisz „alli” — ma być jedna
  pozycja; wybierz ją i zobacz, że `6.50-16 … FARM PRO 303` (MO1) jest na liście.
- **Pułapka do wypunktowania:** poprawka działa dopiero na bazie po `npm run migrate` z 010.
  Jeśli środowisko testowe Ani stoi na bazie sprzed migracji, zobaczy duplikat dalej — to
  nie błąd filtra. Sprawdź to przed wydaniem przeglądu.
- **Nie do zgłaszania jako błąd:** w filtrze marek mogą być „marki” wyglądające jak rozmiar
  (`21x7.00-15`, `18x8.50-8`) — to śmieci w danych dostawcy, poza zakresem PR.5.

Źródło: `docs/tickets/101-CHORE-migracja-marka-caps/{plan.md,raport.md}`.
