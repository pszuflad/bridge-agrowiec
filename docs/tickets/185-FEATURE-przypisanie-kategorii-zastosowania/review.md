# 185-FEATURE-przypisanie-kategorii-zastosowania — Code review

> Reviewed: 2026-10-04
> Branch: claude/clever-turing-w6da6a
> Diff: 20 plików, 4 commity własne (+ merge'e z develop)

## BLOCKER

Brak. Migracja 021 różni się od 011 dokładnie dwoma warunkami `Wózek widłowy` na trigger (4 → 2, gałąź Przemysłowe nietknięta), jest idempotentna (`DROP TRIGGER IF EXISTS` + `CREATE`), idzie po 011 i nie koliduje numerem z `origin/develop` (ostatnia tam: 020). `products.kod` jest `UNIQUE` globalnie (001/003), więc UPDATE po `(dostawca, kod)` jest jednoznaczny.

## SHOULD-FIX

- [ ] `rebuild/backend/src/import/dziedziczenieKategorii.ts:33-37` (wywołanie `akceptacja.ts:246`) — „poprawka Marty wygrywa” jest zrealizowane jako „nie ruszam pola w rekordzie”, a nie „nałóż wartość poprawki”.
  - Reason: `rekord` w akceptacji powstaje ze `snapshot` + pól wiersza stagingu (`akceptacja.ts:~133`), bez `pozycja.kategoria`. Gdy poprawka na `kategoria` powstała PO imporcie (np. `PUT /api/staging/{id}` — `staging-mutacje.ts:40,59` — to jedyne miejsce tworzące poprawki), snapshot jej nie zawiera. Wtedy akceptacja istniejącego produktu zapisuje `snapshot.kategoria` (domyślne „Rolnicze”), czyli cofa to, co Marta ustawiła. Przed ticketem było tak samo, ale decyzja 5 („poprawka Marty wygrywa”) obiecuje inaczej.
  - Suggestion: przy poprawce na polu — wpisać `overrideValue` z `poprawkiDla(...)` do `rekord`, a nie zostawiać wartość ze snapshotu; dodać test akceptacji z poprawką dodaną po imporcie (obecny test z linii 70 pliku testu dziedziczenia zakłada, że rekord już ma wartość poprawki).
- [ ] `rebuild/backend/scripts/przypisz-kategorie-zastosowanie.ts:34` — `zastosujMigracje(sqlite)` leci także w trybie dry-run i PRZED backupem.
  - Reason: „dry-run” na kopii/bazie produkcyjnej zmienia triggery (021) i zapisuje wpis do `_migrations`; backup z `--apply` jest już po migracji, więc nie jest stanem sprzed skryptu. Dla jednorazowego skryptu na produkcji to zaskakujące.
  - Suggestion: w dry-run tylko sprawdzić, czy migracja 021 jest zastosowana (i przerwać z komunikatem), albo zrobić backup przed `zastosujMigracje`.
- [ ] `rebuild/backend/src/import/migracje/przypisz-kategorie-zastosowanie.ts:~146-160` — dopasowanie po `nazwa` jest dokładne (tylko `trim`), z rozróżnianiem wielkości liter i bez normalizacji wielokrotnych spacji.
  - Reason: nazwy z pliku, których w bazie nie ma w identycznym zapisie, trafiają do `nazwyBezProduktu` i są po cichu pomijane (liczba tylko w logu). Skrypt nie wypisuje ich do raportu CSV (`raportPrzypisaniaCsv` ma tylko zmiany i niejednoznaczne).
  - Suggestion: dopisać `nazwyBezProduktu` do raportu (osobny status) i obejrzeć je na kopii produkcji przed `--apply`; rozważyć dopasowanie case-insensitive (uwaga: SQLite `LOWER` jest ASCII-only — porównywać w JS).
- [ ] `przypisz-kategorie-zastosowanie.ts:~154` — ta sama nazwa u różnych dostawców: skrypt przypisuje parę WSZYSTKIM produktom o tej nazwie (pętla po `prods`). To zgodne z kluczem `nazwa` z decyzji 1, ale nie jest ani raportowane, ani testowane.
  - Suggestion: dodać test dwóch produktów o tej samej nazwie (inni dostawcy; jeden z poprawką) i w raporcie oznaczyć nazwy o >1 produkcie.
- [ ] `dziedziczenieKategorii.ts:62-69` — dziedziczenie ignoruje `bieznik` (choć `kluczZRekordu` go zwraca, a wzorzec wagi go uwzględnia tolerancyjnie) i porównuje `marka`/`model` dokładnie, wielkość liter ma znaczenie. Dwa bieżniki tego samego modelu/rozmiaru o różnych zastosowaniach dadzą „sprzeczne” i brak dziedziczenia (bezpieczny kierunek), ale niespójność z `dziedziczenieWagi` warto świadomie zapisać w komentarzu/specu.
- [ ] `dziedziczenieKategorii.ts:70` — filtr `zastosowanie IS NOT NULL AND TRIM <> ''` odrzuca odpowiedniki bez zastosowania z zestawu par: jeśli jeden odpowiednik ma „Ciągnik”, a drugi pusty, nowy produkt dziedziczy „Ciągnik” (pusty nie liczy się jako sprzeczność). Zgodne z duchem decyzji 6, ale „tylko gdy jednoznaczna” w planie tego nie precyzuje — potwierdzić i opisać w `wpis-185.md`.
- [ ] Wydajność: zapytanie dziedziczenia w imporcie (`applyKategoriaDziedziczona`, jedno na każdy NOWY produkt) filtruje po `marka`+`model`+`szerokosc`+…; w schemacie nie ma indeksu na `products(marka, model)` (jest tylko `idx_products_kod_importu`). Przy ~8 tys. produktów to pełny skan na każdy nowy produkt; dla dużego pierwszego importu (tysiące nowych) to O(n·m). Ten sam koszt ma wzorzec wagi, więc nie jest to regresja kierunku, ale warto zmierzyć na kopii produkcji lub dodać indeks.
- [ ] Luki testów:
  - brak testu akceptacji istniejącego produktu z poprawką wyłącznie na `zastosowanie` (kategoria z bazy, zastosowanie z poprawki) oraz z poprawką dodaną po imporcie (patrz wyżej);
  - brak testu `kod` bez zgodnego `dostawca` (wyszukiwanie `istniejacy` idzie po samym `kod` — `akceptacja.ts:196`, `bulk.ts:62`; `poleZPoprawka` używa `rekord.dostawca` z pozycji, nie z `istniejacy.dostawca`; przy rozjeździe klucz poprawek będzie inny niż produkt, którego dotyczy zapis);
  - brak testów null-safe (`profil`/`srednica`/`konstrukcja` = NULL u produktu istniejącego i nowego) dla zapytania dziedziczenia — gałęzie `isNull` nie są pokryte;
  - brak testu dry-run (czy nie zapisuje) i drugiego uruchomienia `--apply` (idempotencja: 0 zmian, `juzZgodnych`), brak testu CLI `scripts/…` (jak `selly.csv-cli.test.ts`);
  - test mutacyjny z raportu: sprawdzono 2 testy czerwone — warto wskazać, które.

## NICE-TO-HAVE

- [ ] `przypisz-kategorie-zastosowanie.ts:~137` — `field_name.toLowerCase()` przy czytaniu poprawek, ale `dziedziczenieKategorii.ts:34` porównuje `p.fieldName === pole` dokładnie. Klucz `(supplier_kod, supplier_product_id)` jest użyty tak samo jak w `poprawkiDla` — spójne; warto jednak ujednolicić porównanie nazwy pola (wspólna funkcja).
- [ ] Produkty z „Rolnicze / Wózek widłowy” spoza pliku CSV: każdy późniejszy `UPDATE OF kategoria, zastosowanie` (w tym „zachowaj” z akceptacji, które zapisuje te same wartości) uruchomi trigger i po cichu zamieni parę na „Uniwersalne/pozostałe”. Dla 22 produktów z pliku to nie występuje (przenosi je skrypt), ale warto zmierzyć na kopii produkcji, czy takich spoza pliku nie ma.
- [ ] Zakres raportu `przypisz-…`: kolumna `kategoria`/`zastosowanie` w CSV raportu przy `niejednoznaczna_pominieta` zawiera opis par w kolumnie „zastosowanie” — mylące; osobna kolumna `uwagi`.
- [ ] Na froncie lista Leśnych nie ma „Forwarder/Harwester” (raport to odnotowuje); `PRZENIESIENIA` kieruje tam produkty, więc edycja takiego produktu w UI nie pokaże bieżącej wartości na liście — osobny ticket.
- [ ] `catch {}` w akceptacji/bulku połyka błędy reguły kategorii (zgodnie z konwencją pozostałych rozszerzeń) — rozważyć chociaż log ostrzegawczy.

## Plan compliance

### Done ✓
- Migracja 021 + test macierzy (`db.migracja-021`) oraz korekta testów 011/łańcucha/produkcji.
- Skrypt przypisania: tabela `PRZENIESIENIA` (16 wpisów), reguła Ciągnik/Uniwersalne, pomijanie poprawek Marty, raport, backup (`VACUUM INTO`), `history`, jedna transakcja.
- Ochrona w akceptacji (`zachowajKategorieZastosowanie`) i dziedziczenie (akceptacja, bulk, tylko gdy `pozycja.kategoria` nie podana).
- Lista Rolniczych na froncie bez „Wózek widłowy” + test.
- Gate fixtures: N/D (brak zmian kształtu API) — zgodne z planem; testy w raporcie zielone.

### Missing or deviating ✗
- Decyzja 5 („poprawka Marty wygrywa”) zrealizowana tylko częściowo (patrz SHOULD-FIX 1).
- Dziedziczenie w `bulk` zależy od `pozycja.kategoria == null` — zgodne z przyjętym założeniem, ale `POST /api/products/bulk` z klienta zwykle wysyła kategorię, więc w praktyce dotyka głównie akceptacji stagingu.

### Definition of done
- [x] Migracja 021 + test macierzy
- [x] Skrypt przypisania z tabelą przeniesień i raportem
- [x] Ochrona w akceptacji + dziedziczenie (akceptacja, bulk)
- [x] Bramki backendu i testy frontendu zielone (wg raportu; nie uruchamiano ponownie w ramach review)
- [ ] `--apply` na produkcji — poza zakresem (użytkownik)

## Parallel-test concerns

None — testy używają baz tymczasowych; nowych portów ani stałych ścieżek nie zauważono.

## Overall assessment

Realizacja jest rzetelna i dobrze przetestowana: migracja jest minimalna i bezpieczna, skrypt transakcyjny z backupem i historią, klucz poprawek (`supplier_kod`, `supplier_product_id`) spójny z resztą kodu. Główne zastrzeżenie to semantyka „poprawka wygrywa” przy akceptacji (nie nakłada wartości poprawki na rekord) oraz dry-run, który migruje bazę przed backupem; reszta to luki raportowania/testów i wydajność zapytania dziedziczenia.
