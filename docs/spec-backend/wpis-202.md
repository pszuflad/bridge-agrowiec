# Wpis do spec-backend od ticketu 202 („Odrzuć” z listy stagingu zapamiętuje zmiany kart) · 2026-10-08

Decyzja użytkowniczki (2026-10-08, wpis #187.1): „Odrzuć” z LISTY działa dla zmian istniejących kart tak samo jak „Odrzuć” w szczegółach.

- `POST /api/staging/reject` (także `allFiltered`): dla każdej pozycji typu `zmiana_kluczowa` woła `odrzucZmianeKarty` — karta zostaje bez zmian,
  różnice tożsamości zapisują się jak poprawki Marty (`manual_overrides`, `acknowledgedSourceValue` = wartość z pliku), cena/stan/magazyn z pliku
  wchodzą od razu (z historią cen). Pozycje innych typów oraz zmiany, których nie da się zapamiętać (puste pola karty, brak różnic, brak karty) —
  skasowane jak dotąd (`BladPolityki` → `odrzucPozycjeStagingu`).
- Odpowiedź: `{ ok, rejected, kept }` — `kept` = ile pozycji zapamiętano poprawką (dodatek względem produkcji). Audyt `odrzucenie_stagingu` ma w szczegółach `zapamietane_poprawka`.
- Obejmuje też pole `nazwa` (jak w szczegółach) → obowiązują uwagi z `wpis-168c.md` / #168.1 (akceptacja nakłada `nazwa_pamiec` bez poprawek Marty).
- Frontend: „Odrzuć widoczne/zaznaczone” pytają z liczbą, gdy w wyborze są zmiany kart (inaczej jak dotąd, od razu); „Odrzuć wszystkie” ma rozszerzoną treść
  potwierdzenia; pasek komunikatu podaje, ile zmian zapamiętano. Cofnięcie pojedynczej poprawki: `DELETE /api/overrides/{id}`.
