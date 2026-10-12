# Wpis do spec-backend od ticketu 235 („Połącz w jeden produkt” sumuje stan) · 2026-10-12

Decyzja użytkowniczki (2026-10-12), po przykładzie MITAS 300-15 FL-08 22PR TT (MO2): dwa wiersze jednego cennika różniące się tylko kodem dostawcy i stanem to jedna opona.

- `POST /api/staging/{id}/resolve-source-conflict` z `decision: "merge"` (`import/polityka/sprzecznosc-zrodla.ts`): **stan = suma stanów obu wierszy** (gdy oba są liczbami,
  inaczej stan z późniejszego wiersza), **kod dostawcy z pierwszego wiersza**; cena zakupu i reszta pól — z późniejszego (jak dotąd). Wynik od razu trafia do katalogu.
- Dotyczy tylko „Połącz”; „Rozdziel” bez zmian. Obsługa dokładnie dwóch wierszy (`earlier`/`later`).
- Okno rozstrzygnięcia (`OknoRozstrzygniecia.tsx`) ma zaktualizowany opis przycisku „Połącz w jeden produkt”.
- Karty już połączone wcześniej (stan z jednego wiersza) nie są korygowane wstecz.
