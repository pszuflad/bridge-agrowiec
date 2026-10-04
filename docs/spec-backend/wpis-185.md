# Wpis do spec-backend od ticketu 185 · 2026-10-04

**Sekcja:** import / katalog (kategoria i zastosowanie produktu).

**Potwierdzone w 185** (`185-FEATURE-przypisanie-kategorii-zastosowania`, 2026-10-04): pliki dostawców nie niosą
kategorii ani zastosowania (parsery wpisują domyślne „Rolnicze”, zastosowanie puste), a zwykłe odświeżenie cen/stanów
(`fabryka.ts`, `patch`) ich nie dotyka. **Akceptacja stagingu istniejącego produktu** (`akceptacja.ts`,
`db.update(products).set(rekord)`) zapisuje jednak cały rekord — w produkcji cofnęłaby przypisaną parę do „Rolnicze”/puste.

**Odstępstwa od produkcji (decyzje użytkownika, 2026-10-04):**
1. Migracja `021` — „Wózek widłowy” tylko w Przemysłowych; trigger zamienia „Rolnicze / Wózek widłowy” na „Uniwersalne/pozostałe”.
   `legacy/application_rules.cjs` (kopia produkcji) bez zmian.
2. Akceptacja istniejącego produktu zachowuje `kategoria` i `zastosowanie` z bazy (poprawka Marty wygrywa — jest już na snapshocie).
3. Nowy produkt (akceptacja, `bulk` bez podanej kategorii) dziedziczy parę po odpowiednikach: marka + model + rozmiar
   (`szerokosc/profil/srednica/konstrukcja`), tylko gdy wszystkie odpowiedniki mają tę samą parę (`dziedziczenieKategorii.ts`).

Jednorazowe przypisanie z CSV przy wdrożeniu: migracja `022` (generowana; raz na bazę, po kopii bazy z deployu). Raport/dry-run: `npm run przypisz-kategorie-zastosowanie` (domyślnie dry-run; tabela przeniesień w
`src/import/migracje/przypisz-kategorie-zastosowanie.ts`). Szczegóły: `docs/tickets/185-FEATURE-przypisanie-kategorii-zastosowania/`.
