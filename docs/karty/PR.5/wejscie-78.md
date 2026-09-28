# Wejście dla PR.5 od ticketu 78 (P7.2) · 2026-09-21

Po sprzątaniu kolejki (D1) kolejka atrybutów **nie zaproponuje już aliasu `ALLIANCE → Alliance`** —
pozycja `ALLIANCE` jest dosłownie w słowniku `marka` i znika przy sprzątaniu, zanim reguła sugestii
ją zobaczy. Słownik `marka` ma dziś obie formy naraz. Duplikat trzeba rozwiązać po stronie danych,
decyzja #92 dalej otwarta. Źródło: `docs/tickets/78-FEATURE-seed-bieznikow-podobienstwo/raport.md`.
