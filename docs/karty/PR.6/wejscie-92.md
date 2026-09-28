# Wejście dla PR.6 od ticketu 92 (PR.3) · 2026-09-22

Sekcja „Alerty” w `docs/przeglad-12-widokow.md` (i punkt „B??d HTTP” z przeglądu Ani): po migracji
`009_alerty_polskie_znaki.sql` filtr typu i tabela pokazują **„Błąd pobierania”, „Błąd HTTP”,
„Ręczny upload”**, a treści „produktów … kluczowe/błędy” — bez znaków zapytania. Wyszukiwarka
znajduje te alerty po słowach „Błąd”, „Ręczny”, „produktów”.

Do uwzględnienia w instrukcji dla Ani:
- Poprawka działa na bazie, na której uruchomiono `npm run migrate` (na produkcji — przy
  cutoverze). Do tego dnia produkcja nadal zapisuje „B??d…”, bo „?” jest wpisane w jej kod.
- Liczba grup w widoku Alerty się nie zmienia (19 na snapshocie) — zmieniają się tylko nazwy.
- W notatce `docs/pytania-do-ani-2026-09-18.md` jest „339 alertów”; naprawionych wierszy jest
  435 (typ) + 2219 (treść). Szczegóły: `docs/karty/PR.3/karta.md`, „Dowiezione”.
