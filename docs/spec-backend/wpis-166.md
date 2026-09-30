# Wpis do spec-backend od ticketu 166 (rozstrzyganie sprzecznych wierszy cennika) · 2026-09-29

**Sekcja:** §5 (staging, polityka Staging v2 — `POST /api/staging/{id}/…`).

**Świadome odstępstwo od produkcji** (decyzja użytkowniczki, 2026-09-29): dla zgłoszeń
z `_duplicateSource` („Sprzeczne pozycje w jednym cenniku") produkcja ma sam podgląd, a
`POST /api/staging/{id}/resolve` odmawia (`staging_policy.cjs:231`). Odbudowa dokłada trasę
`POST /api/staging/{id}/resolve-source-conflict` z ciałem `{decision: "merge" | "split"}`
(implementacja: `rebuild/backend/src/import/polityka/sprzecznosc-zrodla.ts`). `/resolve`
zachowuje odmowę bez zmian.

- **Decyzja od razu zatwierdza wynik do katalogu** (`zatwierdzPozycjeZPolityka`), w jednej
  transakcji z rozstrzygnięciem — gdy akceptacja odmówi (np. błędny EAN), nie zostaje nic.
  Po sukcesie leci skan nowych wartości atrybutów jak po `POST /api/staging/accept`.
- **`merge`** — jeden produkt na karcie zgłoszenia; dane (stan, cena) z **późniejszego**
  wiersza (jak importer dla wierszy bez różnic: ostatni wygrywa — stan 13 + 1 NIE jest sumowany).
  Klucze źródłowe obu wierszy zapamiętują się na tę kartę (`staging_matches`).
- **`split`** — dwa produkty o kodach z pliku dostawcy (`_sourceConflict.*.kod`). Wiersz, którego
  kod = karta zgłoszenia, aktualizuje ją; gdy żaden nie pasuje, a karta istnieje — aktualizuje ją
  wcześniejszy. Kod zajęty w katalogu albo identyczne kody w obu wierszach → 409 `{message}`.
  Nie używa `syntheticCode` — tożsamość opony nie zawiera EAN ani kodu dostawcy, więc dla takich
  wierszy oba kody wyszłyby identyczne.
- Wiersz wcześniejszy odtwarzany jest z ośmiu pól `_sourceConflict.earlier` nałożonych na snapshot
  późniejszego (`kod dostawcy`, marka, model, rozmiar, DOT, EAN, cena zakupu, stan).
- Błędy jak reszta tras polityki: `{message}`, status 409.
