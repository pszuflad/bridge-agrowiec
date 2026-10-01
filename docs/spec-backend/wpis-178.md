# Wpis do spec-backend od ticketu 178 · 2026-10-01

**Sekcja:** import — normalizacja pozycji cennika i porównanie modelu.

**Potwierdzone w 178** (`178-FEATURE-normalizacja-pozycji`, 2026-10-01): po parserze (nie w parserach — `legacy/**` jest
pinned) pozycja przechodzi `normalizujPozycje()` (`polityka/normalizacja-pozycji.ts`): dopiski osi usuwane z modelu/bieżnika,
`HS/LS/HD/HT` Continentala odtwarzane z nazwy, litera bieżnika LingLong z nazwy, DOT `NN`→`20NN` i `WWYY`→`20YY`, konstrukcja do formy
słownej, ucięte indeksy z nazwy (tylko przy tym samym zestawie znaków). Model w dopasowaniu porównuje `kluczModelu()` (`widok()` w
`tolerancja-dopasowania.ts`). Słownik wzorców producenta: `slowniki/modele-producenta.ts` (pusty). Czyszczenie katalogu: `npm run normalizuj-katalog`.
Odstępstwa: konstrukcja nie jako `R`/`D`, dopiski nie trafiają do `zastosowanie`. Szczegóły: `docs/tickets/178-FEATURE-normalizacja-pozycji/`.
