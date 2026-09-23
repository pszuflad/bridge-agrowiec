# Wejście dla I15.6 od ticketu 107 (I15.1) · 2026-09-22

Dotyczy starego `POST /api/selly/sync-supplier`/`sync-product` (blok 8a, I8), które ta karta ma **utrzymać** (#67).
Zweryfikowane grepem — logika `multi_cat` (`src/selly/mapper.ts`, `src/selly/klient.ts`, `src/repos/selly.ts`) żyje
w TYM module, nie w nowych `mapper_v2`/`sync_full` (I15.7); `mapper_v2.cjs` na produkcji nie ma koncepcji `multi_cat`
w ogóle (bierze pojedynczą `kategoria` → `category_id` i `zastosowaniePierwsze()` — pierwszą wartość z pola, nie
listę), więc to ustalenie NIE dotyczy I15.7.

**Od migracji 011 `multi_cat` idzie praktycznie tylko dla produktów w kategorii NIEKANONICZNEJ.** Trigger
`products_zastosowanie_ai/_au` (011, `7d6cfc9:db/schema.sql:334-385`) w czterech kategoriach kanonicznych
(`Rolnicze`/`Przemysłowe`/`Ciężarowe`/`Leśne`) spłaszcza każdy łańcuch `a ; b` do pojedynczej wartości (albo
`Uniwersalne/pozostałe`, albo `Forwarder/Harwester`) — a to właśnie łańcuch jest tym, co `mapper.ts` (blok 8a) dzieli
na kategorię główną + `extra_cat_ids` do `multi_cat`. W kategorii spoza czterech kanonicznych trigger łańcucha nie
rusza, więc tam `multi_cat` nadal może wystąpić.

Test „w kategorii kanonicznej brak `multi_cat`” już istnieje: `rebuild/backend/test/selly.synchronizacja.test.ts`
(`describe` „pojedynczy produkt”, testy „`multi_cat` idzie tylko przy kategoriach dodatkowych” i „w kategorii
kanonicznej trigger zamienia łańcuch `a + b` na jedną wartość — bez `multi_cat`”) — dodany przy okazji 107, bo
zmieniał się stan bazy pod testami tego modułu. Przy dalszej pracy nad blokiem 8a w tej karcie to zachowanie jest
już pokryte, nic dodatkowego nie trzeba robić poza świadomością, że to efekt uboczny 011, nie osobnej logiki I15.6.

## Uzupełnienie (ta sama sesja, po decyzji koordynatora 2026-09-22): migracja 013 dostała warunek
`013_selly_products_warianty.sql` padała na bazie produkcji (`selly_products_old` istnieje tam od 07.09), co karta
I15.6 opisała jako ręczny krok cutoveru. Ticket 107 uodpornił łańcuch migracji na kształt produkcji, więc 013 ma
teraz w nagłówku dyrektywę runnera `-- @pomin-jesli-typ-kolumny selly_products selly_variant_id INTEGER`: gdy
`selly_products` ma już kształt wariantowy, migracja zostaje odnotowana w `_migracje` BEZ wykonania treści (DDL w 013 jest verbatim z produkcji, więc jej
kształt jest celem migracji). Treść SQL 013 poza nagłówkiem — bez zmian.
Skutek dla I15.6: ręczne odnotowanie 013 przy cutoverze **odpada**; test `test/migracje.selly-warianty.test.ts`
(„na bazie, która już ma nowy kształt…”) sprawdza teraz `bezTresci` i niezmieniony `sqlite_master` zamiast wyjątku.
Pełny łańcuch na schemacie produkcji: `test/db.migracje-produkcja.test.ts`.
⚠ Warunek celowo patrzy na KOLUMNĘ `selly_variant_id`, a nie na obecność `selly_products_old`: stara tabela tej
kolumny nie ma (`7d6cfc9:db/schema.sql:174-188`), więc baza z samą nazwą `selly_products_old`, ale nieprzebudowaną
`selly_products`, nadal zatrzyma deploy (013 rusza i pada na `RENAME`) zamiast zostać po cichu przepuszczona.
Pilnuje tego test „sama nazwa `selly_products_old` NIE pomija migracji…” w `test/migracje.selly-warianty.test.ts`.
