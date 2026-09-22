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
