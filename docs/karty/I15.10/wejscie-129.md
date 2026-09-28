# Wejście dla I15.10 od ticketu 129 (karta I15.4c — akceptacja) · 2026-09-23

## Punkt wpięcia `availability_sync` jest wystawiony jawnie i czeka

`wejscie-110.md` prosiło kartę I15.4 o „wystawienie punktu wpięcia, bez portowania modułu".
Zrobione po stronie akceptacji.

**Gdzie:** `rebuild/backend/src/routes/staging-polityka.ts`, funkcja `odswiezDostepnosc(dostawca)`.
Woła ją trasa `POST /api/staging/:id/choose-absence-card` zaraz po zapisie audytu — dokładnie tam,
gdzie oryginał woła `U.refreshAbsenceAvailability(result.dostawca)` (`staging_policy.cjs:646`).

**Dziś to no-op z logiem** i tak ma zostać do Twojej karty. Powód jest w oryginale, nie w naszej
wygodzie: `refreshAvailability()` (`:137-139`) strzela WYŁĄCZNIE wtedy, gdy
`path.resolve(db.name) === '/home/admin/private_apps/bridge/data.db'`. Komentarz produkcji mówi
wprost dlaczego: *„Test copies must never call shop APIs or publish the production CSV."*
U nas ten warunek nie jest spełniony nigdy, więc **no-op jest wiernym portem**, a nie skrótem.

**Co masz zrobić:** podmienić ciało `odswiezDostepnosc` na realne wywołanie modułu
(`availability_sync.cjs` → `request(db, supplier)`) i **zachować warunek bezpieczeństwa** w jakiejś
postaci — inaczej testy i kopie deweloperskie zaczną strzelać do cudzego sklepu.

## Druga ścieżka, która zmienia dostępność, jest w `chooseAbsenceCard`

Oryginał ustawia `availabilityChanged = true` w `suspend()` (`:127`) i w `chooseAbsenceCard`
(`:328`). W porcie odpowiednikiem `suspend()` jest `wstrzymajAutomatycznie`
(`src/import/polityka/kontekst.ts`). Samej flagi `availabilityChanged` **nie portowałem** — w
oryginale czyta ją wyłącznie `importer()` (karta I15.4b) na końcu przebiegu. Gdy będziesz spinać
odświeżanie z importem, sprawdź, którędy ta flaga naprawdę płynie: `grep availabilityChanged`
w `rebuild/backend/src/import/legacy/staging_policy.cjs`.

## Hunk `extensions.cjs`, który dotyczy też Ciebie

`wejscie-120.md` pkt 5 (dostałeś ten materiał w swoim katalogu): hunk 4, linie 839-842 na `main` —
`startScheduler()` wygaszony natychmiastowym `return`, komentarz „Scheduler delegated to core D4".
Powód podany przez Anię: drugi timer dublował pobrania **i liczniki nieobecności**. Liczniki
nieobecności to `product_absence_checks`, czyli materiał #103/#104 — stąd to dotyczy Twojej karty.
Nie ruszałem `extensions.cjs`; to nie jest plik tej karty.
