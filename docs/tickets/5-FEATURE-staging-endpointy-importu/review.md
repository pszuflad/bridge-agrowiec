# 5-FEATURE-staging-endpointy-importu — Code review

> **RUNDA 2** (weryfikacja poprawek z rundy 1)
> Reviewed: 2026-08-26
> Branch: feature/5-staging-endpointy-importu
> Diff: 27 plików, 6 commitów (`0a6ffac`..`c005cb4`) — poprawki w `c005cb4`

## Status znalezisk z rundy 1

| # | Znalezisko rundy 1 | Status |
|---|---|---|
| BLOCKER | `pageSize=0` liczone przez `parseInt(...) \|\| domyślna` zamiast `string \|\| string \|\| '50'` PRZED `parseInt` — dawało `50` zamiast `1` | **NAPRAWIONE** — `src/routes/staging.ts:86-90` odtwarza dokładny wzorzec z `pagination_module.cjs:18-19`. Zweryfikowane linia po linii, potwierdzone testem `pageSize=0` → `1` (`test/staging.odczyt.test.ts:148-154`) |
| SHOULD-FIX | wspólna bramka `odrzucNiedozwolonegoDostawce`/`kodZZadania` dawała `from-url` zły komunikat błędu (`Nieznany dostawca: X` zamiast `Brak URL dla dostawcy X`) | **NAPRAWIONE** — rozdzielone na `kodDlaParseFile`/`kodDlaFromUrl` (`src/routes/import.ts:90-100`) i osobne bramki inline w każdej trasie (`:199-211`, `:300-313`), komunikaty i kolejność sprawdzeń zgodne z `extensions.cjs:127-130` i `:214-218` |
| SHOULD-FIX | `parse-file` przyjmował po scaleniu alias `body.dostawca`, którego oryginał tam nie ma; `from-url` przyjmował `query.dostawcaKod`, którego oryginał tam nie ma | **NAPRAWIONE** — `kodDlaParseFile` czyta wyłącznie `query.dostawcaKod \|\| body.dostawcaKod`, `kodDlaFromUrl` wyłącznie `body.dostawcaKod \|\| body.dostawca`. Pokryte testami (`import.test.ts` — „nie przyjmuje aliasu `dostawca`”, „nie czyta kodu dostawcy z query”) |
| SHOULD-FIX | buforowanie CAŁEGO ciała żądania przed sprawdzeniem limitu 25 MB (DoS pamięciowy), nieodnotowane w „Znaleziska w oryginale” | **UTWARDZONE (D13)** — limit liczony w trakcie strumieniowania, pętla `for await` przerywana od razu po przekroczeniu progu; zweryfikowano empirycznie, że `break` niszczy leżący pod spodem strumień (`stream.destroy()`), więc nie zostaje zawieszone żądanie ani wyciek. Odpowiedź identyczna (ten sam 400/komunikat). Nowe odstępstwo D13 opisane w `plan.md` i `raport.md` |
| SHOULD-FIX | brak testu na nieparsowalny `page` w `/paged` | **NAPRAWIONE** — dodany test „nieparsowalny `page` daje null, a offset schodzi do zera” (`test/staging.odczyt.test.ts:180-188`), plus analogiczny dla `pageSize` |
| NICE-TO-HAVE | `resume()` w `pobierz.ts` bez komentarza uzasadniającego | **NAPRAWIONE** — komentarz dodany przy obu wywołaniach (`src/import/pobierz.ts:33-36,47`) |
| NICE-TO-HAVE | walidacja wykluczeń w `kolumny.ts` biegła po budowie projekcji | **NAPRAWIONE** — walidacja przeniesiona przed budowę obiektu (`src/repos/kolumny.ts:24-38`) |
| NICE-TO-HAVE | `wymusRetencje` nie sprawdza ponownie `existsSync` | **ŚWIADOMIE POMINIĘTE** — udokumentowane w raport.md („oryginał ma tę samą strukturę”), akceptowalne |

Wszystkie znaleziska z rundy 1 zaadresowane. Zero pozostałości.

## BLOCKER

Brak.

## SHOULD-FIX

Brak nowych.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/import/pobierz.ts` — brak jakiegokolwiek limitu rozmiaru dla `from-url` (limit 25 MB dotyczy tylko `parse-file`). To wiernie odtworzony brak z oryginału (`extensions.cjs` też go nie ma), więc nie jest to regresja tej sesji — odnotowuję tylko jako coś, co warto mieć na radarze przy ewentualnym twardnieniu bezpieczeństwa poza zakresem tego ticketa.
- [ ] `rebuild/backend/test/import.test.ts:225` — pusta linia nawiasowa (podwójny odstęp) po teście „odrzuca plik większy niż 25 MB” — kosmetyka, linter przepuszcza.

## Weryfikacja szczegółowa (wg instrukcji z zadania)

1. **BLOCKER paginacji** — porównanie linia po linii z `mirror/backend/pagination_module.cjs:18-19` potwierdza wierność: `page`/`pageSize` liczone przez `string || string || default` PRZED `parseInt`, bez fallbacku po `parseInt`. Sprawdzone przypadki: `page=0`→1 (przez tożsamy wzorzec do `pageSize`), `page=-3`→1 (test), `page=abc`→`NaN`→`null` w JSON (test), `pageSize=0`→1 (test, kluczowy przypadek z rundy 1), `pageSize=""`→50 (test), `pageSize=abc`→`NaN`→`null`, LIMIT NULL = bez limitu (test), `pageSize=9999`→200=MAX_PAGE_SIZE (test), `pageSize=-5`→1 (test), `limit` jako alias `pageSize` (test). Komentarze w kodzie i w testach są rzetelne i zgodne z faktycznym zachowaniem zweryfikowanym uruchomieniem testów (241/241 zielone).

2. **Rozdzielenie bramek `import.ts`** — `kodDlaParseFile`/`kodDlaFromUrl` i trzy kolejne `if` w każdej trasie odtwarzają dokładnie kolejność i treść z `extensions.cjs:127-130` (from-url: brak kodu → brak URL) i `:214-218` (parse-file: brak kodu → nieznany dostawca). Strażnik `wylaczonyZImportu` (D5) jest wstawiony jako TRZECI, ostatni warunek w obu trasach — po oryginalnych dwóch — więc nie zmienia kolejności ani treści oryginalnych walidacji, zgodnie z komentarzem w kodzie.

3. **D13 (limit w strumieniu)** — dla pliku ≤25 MB wynik identyczny jak przy pełnym buforowaniu (kod tylko przerywa pętlę WCZEŚNIEJ przy przekroczeniu, przed tym momentem zachowanie jest identyczne z oryginałem). Przerwanie `for await` przez `break` wywołuje `iterator.return()`, co niszczy leżący pod spodem strumień żądania (zweryfikowane empirycznie na izolowanym `Readable` — `destroyed: true`) — nie ma więc wiszącego żądania ani wycieku pamięci; pełny zestaw testów (w tym test „odrzuca plik większy niż 25 MB”) przechodzi zielono, co potwierdza brak zawieszenia. Pusty plik nadal daje „Pusty plik” — sprawdzenie `bufor.length === 0` jest niezmienione i wykonuje się po sprawdzeniu `przekroczonyLimit` tylko wtedy, gdy limit NIE został przekroczony, więc kolejność (najpierw limit, potem pustość) jest zachowana tak samo jak w oryginale (tam też limit sprawdzany jest po długości bufora, ale w tym wypadku nie ma kolizji, bo pusty plik nigdy nie przekroczy limitu).

4. **Regresje w GATE/charakteryzacji** — `test/staging.gate.test.ts`, `test/katalog.gate.test.ts`, `test/charakteryzacja.test.ts` uruchomione osobno: 77/77 zielone. Pełny `npm test`: 241/241 zielone. `npm run lint` i `npm run typecheck` czyste.

5. **Usunięcie testu granicy dokładnie 25 MB** — test ten nigdy nie trafił do żadnego commitu (sprawdzone w historii git — brak śladu `Buffer.alloc(MAX_ROZMIAR_UPLOADU)` bez `+1` w całej historii gałęzi), więc jego usunięcie nie jest widoczne jako regresja w diffie i nie da się go zweryfikować inaczej niż na słowo z raport.md. Uzasadnienie (14 s, ostre `>` widoczne w kodzie i opatrzone komentarzem, boundary pokryty pośrednio przez test `+1`) jest rozsądne — sam próg (`> MAX_ROZMIAR_UPLOADU`) jest jednoznaczny w kodzie i nie wymaga osobnego testu granicznego przy `===`, skoro test `+1` już potwierdza, że próg jest ostry, a nie `>=`. Nie zostawia realnej luki.

6. **Rzetelność `raport.md`/`plan.md`** — `plan.md` ma zaktualizowaną tabelę D1–D13 (D12, D13 dopisane z uzasadnieniem) oraz `Status: Implemented`. `raport.md` ma nową sekcję „Poprawki po recenzji” z rzetelnym opisem wszystkich 4 zaadresowanych zarzutów (w tym błędnego uzasadnienia usuniętego testu z rundy 1) i sekcję „Znaleziska w oryginale” z DOKŁADNIE 5 pozycjami (dodano czwartą — `NaN`/`LIMIT NULL` — i piątą — różne komunikaty `parse-file`/`from-url`), zgodnie z instrukcją zadania. Treść zweryfikowana wobec kodu źródłowego produkcji (`pagination_module.cjs`, `extensions.cjs`) — bez rozbieżności.

## Plan compliance

### Done ✓
- Wszystko z rundy 1 (patrz historia — bez zmian w tej rundzie).
- Dodatkowo: D12 i D13 udokumentowane w `plan.md` (tabela odstępstw) i `raport.md`.

### Missing or deviating ✗
Brak — wszystkie odchylenia zgłoszone w rundzie 1 są teraz albo naprawione, albo świadomie udokumentowane jako odstępstwo (D13) lub jako znalezisko w oryginale (pozycje 4 i 5 w `raport.md`).

### Definition of done
- [x] Rekordy z parsera trafiają do `staging_items` przez Drizzle, w transakcji
- [x] `GET /api/staging` oba kształty, `/paged` z filtrami, `/{id}` z 400/404 — BLOCKER z rundy 1 naprawiony, weryfikacja linia-po-linii OK
- [x] `POST /api/import/parse-file` działa na realnym cenniku, bramka walidacyjna wierna oryginałowi
- [x] `POST /api/import/from-url` pobiera, archiwizuje, parsuje, zapisuje, bramka walidacyjna wierna oryginałowi
- [x] `POST /api/ai-fallback/parse` odtworzony 1:1 w obu trybach
- [x] Strażnik MO6 (D5) i bezpiecznik pustego wyniku (D4) pokryte testami
- [x] Archiwum tworzy plik + `.meta.json` o poprawnych 14 polach
- [x] `GET_staging.json` i `GET_staging_paged.json` przez GATE
- [x] Zbiory kluczy 24/20/21 pokryte testami
- [x] `katalog.gate.test.ts` nadal zielony bez zmian w teście
- [x] `charakteryzacja.test.ts` nadal zielony
- [x] `lint`/`typecheck`/`build`/`test` czyste (241/241 testów, zweryfikowane w tej rundzie lokalnie)
- [x] `raport.md`/`plan.md` opisują D1–D13 rzetelnie, w tym poprawki po recenzji i 5 znalezisk w oryginale

## Parallel-test concerns

None — poprawki nie dodały nowych plików testowych ani nowych zasobów współdzielonych; wzorce (port efemeryczny, tymczasowa baza SQLite, katalog archiwum per test) pozostają bez zmian.

## Overall assessment

Wszystkie znaleziska z rundy 1 zostały rzetelnie zaadresowane — BLOCKER naprawiony z odtworzeniem dokładnego wzorca `string || string || default` PRZED `parseInt`, potwierdzonym testami, które faktycznie sprawdzają to, co deklarują (w przeciwieństwie do testu z rundy 1, który utrwalał błędne zachowanie). Rozdzielenie bramek walidacyjnych `parse-file`/`from-url` jest wykonane starannie, z komentarzem wprost tłumaczącym, dlaczego wspólna funkcja była błędem, i z testami na oba nowo odkryte rozjazdy. Utwardzenie limitu 25 MB (D13) jest bezpieczne — zweryfikowałem empirycznie, że przerwanie `for await` niszczy strumień żądania, więc nie ma ryzyka wiszącego połączenia — i jest właściwie udokumentowane jako świadome odstępstwo bez wpływu na kontrakt. Dokumentacja (`plan.md`, `raport.md`) jest rzetelna i spójna z kodem. Branch gotowy do merge z perspektywy tego ticketa.
