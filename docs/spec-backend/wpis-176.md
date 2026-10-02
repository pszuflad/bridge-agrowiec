# Wpis do spec-backend od ticketu 176 · 2026-10-01

**Sekcja:** import/staging — „Powrót wstrzymanej karty wymaga potwierdzenia cech” (`polityka/fabryka.ts`).

**Potwierdzone w 176** (`176-BUG-powrot-karty-bez-dot`, 2026-10-01): oryginał (`:487-489`) porównywał kartę
z ofertą przez `compatibility()` z DOT i z pustą cechą jako różnicą, przez co wstrzymana karta wracająca z innym
DOT (44 z 48 zgłoszeń w produkcji) albo bez `TL/TT` w ofercie trafiała do stagingu z błędem „Powrót opony wymaga
sprawdzenia”. **Odstępstwo (decyzja użytkowniczki):** warunek używa `zgodnaBezDotZ` — DOT nie jest kryterium
(ten sam kod = ta sama pozycja; nowy DOT zapisuje cicha aktualizacja ze zmiany 172), a pusta wartość
`pr`/`tlTt`/`vfIf`/`konstrukcja` w ofercie przy wypełnionej karcie to brak informacji. Sprzecznością zostają dwie
niepuste różne wartości (oferta `TT`, karta `TL`) oraz karta pusta przy wypełnionej ofercie. Tolerancja dotyczy tylko
porównań „ten sam kod”, nie dopasowania pod innym kodem. Powrót nadal wymaga wstrzymania automatycznego, pełnego
cennika i cen > 0; blokady ręczne bez zmian. Szczegóły: `docs/tickets/176-BUG-powrot-karty-bez-dot/`.
