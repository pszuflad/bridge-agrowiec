# 167-FEATURE-oszacuj-pozostale-wagi — Code review

> Reviewed: 2026-09-29
> Branch: feature/167-oszacuj-pozostale-wagi
> Diff: 30 plików, 1 commit

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/backend/test/oszacowanie-wagi.test.ts`, `rebuild/backend/test/maintenance.test.ts` — brak testu na ochronę `manual_overrides` (`pominietoOverride`) dla nowego mechanizmu szacowania.
  - Reason: Sama strategia testowa w `plan.md` („Testing strategy") explicite wymienia „pominięcie override" jako przypadek do pokrycia. Ścieżka kodu istnieje i wygląda poprawnie (`dziedziczenieWagi.ts:301-315`), ale nie jest w ogóle wywołana testem — regresja w tym miejscu (np. literówka w warunku `eq(manualOverrides.fieldName, "waga")`) przeszłaby niezauważona. Dla porównania, dziedziczenie z ticketu 156 (`test/maintenance.test.ts`, wcześniejsze `describe`) ma taki test.
  - Suggestion: dopisać test integracyjny/jednostkowy z wierszem w `manual_overrides` dla `fieldName: "waga"`, sprawdzający że `waga` zostaje nietknięta i `pominietoOverride` rośnie.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/import/dziedziczenieWagi.ts:282-339` — `oszacujWageWstecznie` nie ma testu na scenariusz „produkt ma dziedziczoną wagę z bieżącego przebiegu `dziedziczWageWstecznie`, gdyby ktoś złączył oba kroki jednym wywołaniem" — dziś nieistotne (funkcje wołane osobno, każda czyta świeży stan bazy przez `db.select()`), ale warto rozważyć dopisanie komentarza-ostrzeżenia przy ewentualnym przyszłym scaleniu obu kroków (plan „Out of scope" świadomie to wyklucza, więc nie blokuje).
- [ ] `rebuild/frontend/src/pages/konfiguracja/Katalog.tsx:300-343` — sekcja „Oszacuj pozostałe wagi" nie ma osobnego nagłówka/tytułu wizualnego (tylko opis + przycisk pod `border-t border-dashed`), w przeciwieństwie do sekcji „Dziedziczenie wagi" wyżej, która ma nagłówek. Kosmetyka, nie blokuje.

## Plan compliance

### Done ✓
- Migracja `015_waga_szacowana.sql` + `schema.ts` — kolumna `waga_szacowana`, nullable, wzorem 014.
- `kluczRozmiaru`, `sredniaWagaDlaRozmiaru`, `oszacujWageWstecznie` w `dziedziczenieWagi.ts` — zgodne z decyzjami 1/2/4 z Q&A: dopasowanie tylko po szerokość+profil+średnica, wykluczenie pustej/zerowej wagi, zaokrąglenie `Math.round`, ochrona `manual_overrides`, jedna transakcja.
- `POST /api/products/oszacuj-wage` w `routes/maintenance.ts` + audyt `oszacowanie_wagi_wsteczne`.
- `scripts/oszacuj-wage.ts` — cienki wrapper CLI (nie czytany w detalu, wzorzec analogiczny do `dziedzicz-wage.ts`).
- Kontrakt: nowy endpoint + `wagaSzacowana` w schemacie, fixture ręcznie napisany.
- Frontend: `filtrowanie.ts` (`wagaSzacowana?: boolean`), `formatowanie.tsx` (priorytet `wagaAutoUzupelniona` > `wagaSzacowana`, osobny tooltip amber `AlertTriangle`), `konfiguracja/katalog.ts` (`oszacujWage()`), `konfiguracja/Katalog.tsx` (przycisk + wynik + link do `/katalog?status=brak_waga`).
- Reset `wagaSzacowana` przy ręcznej edycji `waga` w `repos/products.ts::aktualizujProdukt` — osobny, niezależny `if` obok resetu `wagaAutoUzupelniona`; sensowne, bo to dwie niezależne flagi z niezależnymi warunkami wejścia (`!("wagaAutoUzupelniona" in patch)` / `!("wagaSzacowana" in patch)`) — nie ma potrzeby ich łączyć.
- Mechaniczne poprawki liczby kluczy 73→74 (i 74→75 dla `_reguly`) we wszystkich wymienionych plikach testowych — zweryfikowane, arytmetyka się zgadza wszędzie (`katalog.gate.test.ts`, `db.migracje*.test.ts`, `produkty.mutacje.test.ts`, `projekcja.test.ts`).

### Missing or deviating ✗
Brak — implementacja pokrywa plan 1:1.

### Definition of done
- [x] Migracja + kolumna + funkcje + trasa + CLI + kontrakt + frontend (przycisk, tooltip, reset) — wszystko obecne.
- [x] Priorytet „ręczna poprawka / dziedziczenie zawsze wygrywa" zachowany tą samą logiką co 155/156 (pomijanie produktów z niepustą wagą i z override'em).
- [ ] Pełne pokrycie testowe strategii z planu — brakuje testu na `pominietoOverride` dla nowego mechanizmu (patrz SHOULD-FIX).

## Parallel-test concerns

None — wszystkie nowe testy używają `stworzTestowaBaze()`/`stworzSrodowiskoTestowe()` (baza w katalogu tymczasowym), bez współdzielonych zasobów ani twardo zakodowanych portów/ścieżek.

## Overall assessment

Implementacja jest czysta, dobrze udokumentowana i konsekwentnie powtarza sprawdzony wzorzec z ticketów 155/156 (ta sama struktura funkcji, ta sama ochrona override'ów, ten sam wzorzec resetu błędu w UI). SQL w `sredniaWagaDlaRozmiaru` poprawnie dopasowuje tylko po rozmiarze i wyklucza puste/zerowe wagi; priorytet ikon i flag w warstwie backendu i frontendu jest logicznie spójny (backend nigdy nie ustawia obu flag naraz, bo działa tylko na produktach z pustą wagą). Jedyny realny brak to test na ochronę `manual_overrides` dla nowej ścieżki — sama logika wygląda poprawnie, ale nie jest zweryfikowana testem, mimo że plan tego wymagał.
