# Wejście dla I15.2 od ticketu 107 (I15.1) · 2026-09-22

**(a) Port adaptera nie normalizuje przed zapisem — trigger 011 ratuje `products`, staging nie.**
Nasz port `rebuild/backend/src/import/legacy/parsers/adapter.cjs:376` NIE woła odpowiedników
`normalizeCategoryApplication()` / `getBlockedPaymentForms()`, które produkcja woła w JS-ie PRZED zapisem
(`git show 7d6cfc9:mirror/backend/parsers/adapter.cjs` ~541-578, 687). Stan końcowy `products` ratuje trigger 011
(`DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` na `INSERT`/`UPDATE`), ale `staging_items.snapshot_json` — czyli to,
co operator widzi w podglądzie przed akceptacją — nie przechodzi przez żadną normalizację, bo `staging_items` nie
ma triggerów z 011. Skutek: operator może zobaczyć nieznormalizowaną kategorię/zastosowanie i brak blokad płatności
w podglądzie, mimo że po akceptacji `products` będzie mieć wartości poprawne. Zgłoszone w review 107 jako
SHOULD-FIX, poza własnością tej karty (I15.1 = tylko schemat).

**(b) Trigger zastosowań zna tylko POJEDYNCZE wartości — łańcuch `a ; b` ginie w kategorii kanonicznej.**
Trigger `products_zastosowanie_ai/_au` (011, bajt w bajt z `7d6cfc9:db/schema.sql:334-385`) rozpoznaje w
kategoriach kanonicznych (`Rolnicze`/`Przemysłowe`/`Ciężarowe`/`Leśne`) tylko pojedyncze wartości z zamkniętej
listy (plus warianty `Forwarder`/`Harwester` scalane do `Forwarder/Harwester`). Łańcuch, który JS
`normalizeApplication()` produkuje separatorem `' ; '` (`git show 7d6cfc9:mirror/backend/application_rules.cjs:133`),
w kategorii kanonicznej trigger zamienia na `Uniwersalne/pozostałe`; w kategorii SPOZA czterech kanonicznych
przepuszcza łańcuch bez zmian. Odtworzone dosłownie, test w
`rebuild/backend/test/db.migracja-011.test.ts`. Przy porcie `application_rules.cjs`/`common.cjs` sprawdź, czy port
JS-owej normalizacji generuje ten sam separator i te same aliasy, bo od tego zależy, co trigger zobaczy jako
wejście.

**Uwaga do zakresu importu:** `kategoria`/`zastosowanie` nie są w `POLA_KLUCZOWE` silnika (`src/import/tk.ts:125`)
→ triggery z 011 nie generują pozycji stagingu przy każdym imporcie (nie ma efektu ubocznego „każdy import tworzy
staging przez zmianę kategorii”), ale to też znaczy, że silnik porównania różnic nie widzi normalizacji z (a)/(b)
jako zmiany pola.
