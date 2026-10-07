# 195-FEATURE-selly-historia-usuniec — Code review

> Reviewed: 2026-10-07
> Branch: claude/awesome-faraday-98rpkk
> Diff: 18 plików (+1028), 3 commity (backend, frontend, docs); brak `raport.md` w katalogu ticketu

## BLOCKER

- [ ] `rebuild/backend/test/db.migracje.test.ts:41-63,65,110,88-98` — test migracji nie zna migracji 023 i **jest czerwony** (zmierzone: `npx vitest run test/db.migracje.test.ts`, 2 testy padają).
  - Reason: lista `MIGRACJE` kończy się na `022_…`, a `wynik.zastosowane`/`wynik.pominiete` zawierają teraz też `023_selly_usuniecia.sql`. Dodatkowo bilans `39 tabel / 22 indeksów` (:65, :88, :98, :113) nie uwzględnia +1 tabeli i +2 indeksów z 023 (będzie 40 / 24). Plik ma w komentarzu zasadę, że dołożenie migracji ma być „świadomą zmianą testu” — tego nie zrobiono. Merge z czerwoną bramką `backend`.
  - Suggestion: dopisać `"023_selly_usuniecia.sql"` do `MIGRACJE`, zmienić 39→40 i 22→24 (także w tytule testu i w obu `toBe`), dopisać linię komentarza „023 (ticket 195) dokłada `selly_usuniecia` + 2 indeksy: +1 tabela, +2”.
- [ ] `rebuild/backend/test/db.migracje-produkcja.test.ts:180-…` — drugi czerwony test: lista nowych obiektów po migracjach na kopii produkcji nie zawiera `selly_usuniecia` (oraz jej dwóch indeksów `idx_selly_usuniecia_at`, `idx_selly_usuniecia_przebieg`).
  - Reason: oczekiwana lista „obiektów dodanych przez migracje” jest jawna; diff pokazuje `+ "selly_usuniecia"`. Test pada (1 z 3 błędów w uruchomionych plikach; uruchomiono też `db.migracja-022` i `selly.usuniete` — zielone).
  - Suggestion: dopisać `selly_usuniecia` i oba indeksy do oczekiwanej listy (w kolejności alfabetycznej, jak reszta). Po poprawce uruchomić całość `npm test` — nie wykluczam kolejnych zależnych od liczby tabel testów poza uruchomionymi (np. `kopia-bazy`).

## SHOULD-FIX

- [ ] `rebuild/backend/src/repos/selly-usuniecia.ts:76-79` + `docs/spec-backend/wpis-195.md:15` + `contract/openapi.yaml` — „błędne `limit`/`offset` wracają do domyślnych” jest nieprawdą dla liczb ujemnych: `limit=-5` daje `Math.max(-5,1)` = 1 (nie 20), `limit=0` daje 20. Test sprawdza tylko `limit=abc&offset=-5`.
  - Reason: rozjazd dokumentacji (spec/OpenAPI: min 1, domyślnie 20) z kodem; drobny, ale to kontrakt.
  - Suggestion: albo doprecyzować opis („ujemny/zerowy limit → 1/20”), albo dla `limit < 1` zwracać domyślny; dodać asercję w teście.
- [ ] Brak `raport.md` w `docs/tickets/195-…/` — nie ma dowodu przebiegu bramek (lint/typecheck/build/test backend i frontend po synchronizacji z `develop`), a DoD wymaga zielonych bramek. Biorąc pod uwagę czerwone testy migracji powyżej, bramka backendu najpewniej nie została uruchomiona w całości.
  - Suggestion: po poprawkach uruchomić pełne bramki, spisać wynik (w tym GATE: nowe trasy bez fixtures — brak dotykania istniejących).
- [ ] `rebuild/backend/test/selly.usuniete.test.ts` — brak testu dla `przebieg_id` w ścieżce „wstrzymano” (tam nic nie jest usuwane, więc brak wierszy — OK) oraz testu, że zapis w pętli nie zmienia wyniku `wynik.wpisy`/liczników przy awarii (jest tylko dla `audit_log` i statusu). To akceptowalne; flaguję jako brak asercji na `wynik.usuniete_produkty` w teście awarii — jest (:`expect(wynik?.usuniete_produkty).toBe(1)`). Pozostaje luka: awaria `zapiszHistorie` (audit_log) NIE jest testowana razem z nowym zapisem (niezależność dwóch `try/catch`, którą deklaruje komentarz w `sync-usuwanie.ts:591`).
  - Suggestion: opcjonalny test: zepsuć `audit_log` (np. DROP/trigger) i sprawdzić, że `selly_usuniecia` nadal się zapisuje.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/routes/selly.ts:436-441` — komentarz „Status codziennego pliku CSV…” (`/** … */` nad `csv-status`) został oderwany od swojej trasy: nowe trasy wstawiono między ten komentarz a `router.get("/api/selly/csv-status"…)`, więc dwa bloki JSDoc stoją obok siebie, a komentarz o `csv-status` opisuje teraz trasę `usuniete`. Przenieść nowe trasy przed ten komentarz.
- [ ] `rebuild/backend/src/repos/selly-usuniecia.ts:90-93` — CSV nie neutralizuje komórek zaczynających się od `=`, `+`, `-`, `@` (wstrzyknięcie formuł w Excelu); `nazwa`/`kod` pochodzą z plików dostawców. Zgodne z istniejącym wzorcem `analityka/csv.ts` (port 1:1 `csvEscape`, bez ochrony), więc nie blokuje; warto odnotować w backlogu (`docs/rebuild-backlog/wpis-195.md`) jako dług wspólny dla wszystkich eksportów.
- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:594` — `{ ...wpis, akcja: wpis.akcja }` służy tylko zawężeniu typu; czytelniej `zapiszUsuniecie(db, logId, wpis as …)` lub wydzielić predykat typu. Komentarz przy `try/catch` poprawny.
- [ ] `rebuild/frontend/src/pages/Selly.tsx:79-86` — po `Odśwież` zapytanie zostaje na bieżącym `offset`; lista tylko rośnie, więc brak realnego ryzyka pustej strony, ale `offset` nie jest resetowany do 0 ani ograniczany do `total`. Do rozważenia, gdy kiedyś dojdzie kasowanie wpisów.
- [ ] `rebuild/frontend/src/pages/selly/api.ts:262-278` — `revokeObjectURL` przez `setTimeout` 5 s jest zgodny z wzorcem archiwum importów; przy błędzie `blob()` nie ma wycieku (URL tworzony dopiero po pobraniu). Bez uwag. Kolumna `przebieg_id` jest tylko w CSV, nie w tabeli UI — świadomie (plan), ewentualnie dodać.

## Plan compliance

### Done ✓
- Migracja `023_selly_usuniecia.sql` (`CREATE TABLE/INDEX IF NOT EXISTS`, numer wolny — ostatnia była 022) + wpis w `rebuild/schema/README.md`.
- `src/repos/selly-usuniecia.ts`: `zapiszUsuniecie`, `listaUsuniec`, `csvUsuniec` (jawna projekcja kolumn; `wszystkieUsuniecia` zrealizowane jako `csvUsuniec` bez osobnej funkcji — bez znaczenia).
- Zapis w `usunSierotyZSelly` obok `zapiszHistorie`, we własnym `try/catch`, po wykonanym DELETE; nie zmienia kolejności, wyjątków ani bezpieczników; synchroniczny `INSERT` (better-sqlite3) bez wpływu na przebieg poza ułamkami ms na pozycję. `audit_log` / `selly_sync_log` bez zmian. `SELLY_USUWANIE` nietknięte.
- Trasy `GET /api/selly/usuniete` i `/csv` za `requireAuth`; nazwa pliku z daty serwera (brak wstrzyknięcia nagłówka); parsowanie `limit`/`offset` odporne na `NaN`; parametry w SQL bindowane.
- Kontrakt w `contract/openapi.yaml` i `docs/spec-backend/wpis-195.md` (oznaczone jako spoza oryginału) — zgodne z kodem poza uwagą o ujemnym `limit`.
- Frontend: karta, paginacja (offset w kluczu zapytania, przyciski blokowane na końcach), stany ładowanie/błąd/pusty, pobranie CSV przez `fetch` + blob; `data-testid` zgodne z konwencją `selly-*`.
- Pułapka MSW: handler `*/api/selly/usuniete` dopisany we wszystkich testach renderujących `/selly` (`selly.test`, `selly.gate`, `selly.brak-konfiguracji`, `selly.usuwanie-i-historia`, własny `selly.usuniete`); `shell.test.tsx` używa catch-all `*/api/*` → `[]` i komponent to znosi (`strona?.items ?? []`). Uruchomione: 7 plików / 95 testów frontendu zielone; eslint na zmienionych plikach backendu bez uwag.
- Testy backendu na prawdziwym SQLite i atrapie Selly (trzy akcje, `przebieg_id`, brak przycinania >8000 znaków, awaria zapisu, paginacja, CSV z BOM/średnikiem/cudzysłowem, auth).

### Missing or deviating ✗
- Plan krok 7 / DoD: brak `raport.md`; testy migracji (`db.migracje.test.ts`, `db.migracje-produkcja.test.ts`) nie zaktualizowane — czerwone (patrz BLOCKER).
- Plan nie przewidział aktualizacji istniejących testów migracji, choć każda nowa migracja tego wymaga.

### Definition of done
- [x] Każda usunięta pozycja ma wiersz w `selly_usuniecia` z numerem przebiegu — pokryte testem.
- [x] Karta „Usunięte z Selly” pokazuje listę (najnowsze pierwsze, paginacja) i pobiera pełny CSV — pokryte testami.
- [ ] Migracja idempotentna, `npm run migrate` bez kroków ręcznych — sama migracja jest poprawna i idempotentna, ale testy migracji są czerwone.
- [ ] lint, typecheck, build, testy zielone po synchronizacji z `develop`; PR `MERGEABLE` — NIE: 3 testy backendu padają, brak raportu z bramek.

## Parallel-test concerns

None — all tests parallelizable (backend: `stworzTestowaBaze`/`stworzSrodowiskoTestowe` w katalogu tymczasowym, supertest na porcie efemerycznym; frontend: MSW w pamięci).

## Overall assessment

Zmiana jest czysta i bezpieczna dla Toru 3: dodatkowy zapis jest synchroniczny, osłonięty własnym `try/catch` po wykonanym DELETE i nie wpływa na przebieg usuwania; migracja jest idempotentna i addytywna; trasy mają auth i bindowane parametry; frontend i jego testy są solidne (handlery MSW wszędzie dodane). Jedyne realne problemy to niezaktualizowane testy migracji (`db.migracje.test.ts`, `db.migracje-produkcja.test.ts`), które czerwienią bramkę `backend`, oraz brak `raport.md` — po ich naprawie można mergować.

---

## Przegląd 2

> Reviewed: 2026-10-07 (po commicie `a11a405`)
> Zakres: `git show a11a405` + ponowny przegląd `git diff origin/develop...HEAD`. Uruchomione: `vitest` dla `selly.usuniete`, `db.migracje`, `db.migracje-produkcja` (3 pliki, 37 zielonych, 2 pominięte), `tsc --noEmit` (bez błędów).

### Weryfikacja poprzednich uwag

- [x] BLOCKER 1 (`db.migracje.test.ts`) — naprawione: `023_selly_usuniecia.sql` na liście `MIGRACJE`, bilans 40 tabel / 24 indeksy w tytule, obu `toBe` i w teście idempotencji (:116), dopisany komentarz do 023. Test zielony.
- [x] BLOCKER 2 (`db.migracje-produkcja.test.ts`) — naprawione: `selly_usuniecia` i oba indeksy (`idx_selly_usuniecia_at`, `idx_selly_usuniecia_przebieg`) w oczekiwanej liście, w kolejności alfabetycznej. Test zielony.
- [x] SHOULD-FIX 1 (`limit` ujemny/zerowy) — naprawione w `selly-usuniecia.ts:76`: `limit >= 1 ? min(trunc(limit), 200) : 20`. Zgodne ze spec/OpenAPI („błędne wracają do domyślnych”). Testy dla `limit=-5` i `limit=0` dopisane. Brak regresji: `limit=abc` → `NaN` → `undefined` → domyślny 20; `limit=0.5` → 20 (akceptowalne); `offset` ujemny/NaN → 0.
- [x] SHOULD-FIX 2 (brak `raport.md`) — jest; zawiera wyniki bramek (backend 2242, frontend 1072) i sekcję „Review fixes applied”. Wyniki bramek biorę z raportu (nie uruchamiałem całości zgodnie z poleceniem); trzy pliki testów, które były czerwone, potwierdziłem osobno.
- [x] SHOULD-FIX 3 (niezależność zapisów) — test dopisany (`selly.usuniete.test.ts:155-168`). Rozwiązanie z wyzwalaczem `BEFORE INSERT ON audit_log … RAISE(ABORT)` jest poprawne, a nie ozdobne: asercje `audit_log` = 0 wierszy dowodzą, że `zapiszHistorie` faktycznie rzucił i został złapany, a `selly_usuniecia` ma wiersz, `usuniete_produkty` = 1, `deleteProduct` wywołane raz. Test używa własnej bazy w katalogu tymczasowym — równoległy, bez wycieku wyzwalacza do innych testów.
- [x] NICE (JSDoc `csv-status`) — naprawione: nowe trasy stoją przed komentarzem `csv-status`, komentarz wrócił do swojej trasy.

### Nowe problemy z poprawek

- Przesunięcie tras w `src/routes/selly.ts` — bez skutków ubocznych: czysta zmiana kolejności, brak tras parametrycznych `/api/selly/:x`, które mogłyby przechwycić `/api/selly/usuniete` lub `/usuniete/csv` (sprawdzone grepem). Obie trasy nadal za `requireAuth`.
- Zmiana semantyki `limit` — brak regresji, spójna z dokumentacją. Nie dotyka logiki usuwania ani bezpieczników; `SELLY_USUWANIE` nietknięte.
- `sync-usuwanie.ts` — dodano wyłącznie komentarz; logika bez zmian.

## BLOCKER

Brak.

## SHOULD-FIX

Brak.

## NICE-TO-HAVE (nadal otwarte, nieblokujące — bez zmian względem przeglądu 1)

- [ ] `rebuild/backend/src/repos/selly-usuniecia.ts:90-93` — CSV nie neutralizuje komórek zaczynających się od `=`, `+`, `-`, `@` (zgodne z `analityka/csv.ts`); warto zanotować w `docs/rebuild-backlog/wpis-195.md` jako dług wspólny eksportów. Raport (Follow-up) już to odnotowuje, wpisu backlogu nie ma.
- [ ] `rebuild/frontend/src/pages/Selly.tsx:79-86` — `offset` nie jest resetowany po `Odśwież` ani przycinany do `total`; bez ryzyka, dopóki historia tylko rośnie.
- [ ] `rebuild/backend/src/selly/rest/sync-usuwanie.ts:594` — spread `{ ...wpis, akcja: wpis.akcja }` jako zawężenie typu; komentarz dodany, wystarczy.

## Plan compliance (przegląd 2)

- Wszystkie kroki planu w diffie; nic spoza zakresu (brak zmian w logice usuwania, bezpiecznikach, `SELLY_USUWANIE`).
- Definition of done: wszystkie pozycje spełnione (migracja idempotentna i testy migracji zielone; bramki zielone wg raportu; GATE — nowe trasy spoza oryginału, istniejące fixtures nietknięte).
- Parallel-test concerns: None — wyzwalacz w nowym teście działa na izolowanej bazie tymczasowej.

## Ocena po przeglądzie 2

Wszystkie BLOCKER-y i SHOULD-FIX-y z przeglądu 1 są faktycznie naprawione (zweryfikowane w kodzie i uruchomionych testach), poprawki nie wprowadziły nowych problemów. Zmiana gotowa do merge'a; pozostają tylko drobne uwagi NICE-TO-HAVE.
