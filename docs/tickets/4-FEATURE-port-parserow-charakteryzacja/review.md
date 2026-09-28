# 4-FEATURE-port-parserow-charakteryzacja — Code review

> Reviewed: 2026-08-26
> Branch: `feature/4-port-parserow-charakteryzacja`
> Diff: 54 plików, 6 commitów

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/backend/test/charakteryzacja/mo9-offline.mjs` + `probki/MO9.items.json` — mock keyset-paginacji nie jest realnie ćwiczony na >1 stronie.
  - Reason: próbka ma 12 elementów, a `PAGE_SIZE` w `mo9_agrorami_api.cjs:378` to 100 — pierwsza (i jedyna) odpowiedź mocka zwraca `batch.length = 12 < PAGE_SIZE`, więc pętla `fetchAllItems()` (`mo9_agrorami_api.cjs:501-534`) wykonuje się dokładnie raz i nigdy nie trafia na gałąź kontynuacji (`after = String(lastId)` + kolejne zapytanie). Raport i `ZRODLA.md` twierdzą, że charakteryzacja pokrywa „keyset-paginację" w całości — to prawda tylko dla przypadku jednostronicowego; sam mechanizm zmiany kursora między stronami nie jest w ogóle wykonany, więc regresja w tej logice (np. zły klucz kursora, błędne porównanie `>`) przeszłaby przez gate niezauważona.
  - Suggestion: albo dodać w próbce/mocku scenariusz z liczbą elementów > `PAGE_SIZE` (lub tymczasowo mniejszym page size w teście), żeby wymusić realną kontynuację paginacji, albo doprecyzować sformułowanie w `ZRODLA.md`/raporcie, że pokryta jest tylko ścieżka jednostronicowa.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/import/parsuj.ts:47-52` — `sprawdzKodDostawcy()` waliduje kod dostawcy wobec statycznej listy `KODY_DOSTAWCOW` z `typy.ts`, a nie wobec `dispatcher.listDostawcy()` (użytej tylko w treści komunikatu błędu), mimo że plan (Krok 3) zakładał walidację przez listę z dispatchera. Dziś obie listy są identyczne, ale przy resynchronizacji `dispatcher.cjs` z produkcją (np. dodanie/zmiana kodu dostawcy) obie listy trzeba by pamiętać o synchronizacji ręcznie — drobna okazja do rozjazdu, którą złapałby dopiero test integralności, nie typecheck.

## Plan compliance

### Done ✓
- Krok 1 — zależności (`csv-parse`, `iconv-lite`, `xlsx`), wykluczenie `src/import/legacy/**` z ESLint, `scripts/copy-parsery.mjs` wpięty w `npm run build`.
- Krok 2 — port verbatim 16 plików do `src/import/legacy/**`, zweryfikowany niezależnie (poza testem) diffem katalogów i sha256 — zero różnic wobec `mirror/backend`.
- Krok 3 — `parsujPlik`/`parsujBufor` w `src/import/parsuj.ts`, `createRequire` względem lokalizacji pliku (działa i w `src/`, i w `dist/` — zweryfikowane budowaniem od zera), sprzątanie katalogu tymczasowego w `finally` także przy wyjątku.
- Krok 4 — próbki MO1–MO5 (realne, wyciągnięte bajtowo z historii gita) i MO6/MO7/MO8/MO9/MO10 (odtworzone z `test_tyres.cjs`/archiwum), opisane i uzasadnione w `ZRODLA.md`.
- Krok 5 — `scripts/charakteryzacja-nagraj.mjs` faktycznie uruchamia **oryginalne** parsery skopiowane z `mirror/backend/` (zweryfikowane: ponowne uruchomienie skryptu daje bajtowo identyczne `MOx.expected.json` jak w repo) — gate nie sprawdza własnej pracy własną pracą.
- Krok 6 — `test/charakteryzacja.test.ts`, 4 warstwy (integralność sha256, charakteryzacja pole-po-polu, przydatność próbki, równoważność plik/bufor); skuteczność gate'u potwierdzona empirycznie mutacją `capitalizeKategoria` (opisane w raporcie).
- Krok 7 — audyt na pełnych plikach MO1–MO5 z krzyżową weryfikacją wobec `.meta.json` produkcji, wyniki w `raport.md`.
- Krok 8 — sekcja „Podsystem importu" w README.
- `docs/rebuild-backlog.md` i `docs/rebuild-roadmap.md` zaktualizowane zgodnie z DoD (statusy #1/#2/#5/#6, korekta zakresu `bridge_ext`/`tire_dims`, status 3a).

### Missing or deviating ✗
- Brak istotnych odchyleń od planu implementacji. Trzy odstępstwa opisane w `raport.md` (MO9 przez realny `fetchAll()` zamiast skopiowanej pętli; dwa skrypty zamiast ręcznych komend w `ZRODLA.md`; zawężenie weryfikacji MO6–MO10 do pól faktycznie czytanych z pliku) są uzasadnione i idą w stronę większej wierności, nie mniejszej — akceptowalne.
- Drobna nieścisłość w Kroku 3 (walidacja kodu dostawcy) — patrz NICE-TO-HAVE, nie wpływa na zachowanie.

### Definition of done
- [x] Podsystem parserów zportowany bajt-w-bajt, test sha256 zielony (zweryfikowane też niezależnym `diff -r`).
- [x] `parsujPlik`/`parsujBufor` zwracają rekordy po `recordToSurowe()`.
- [x] Charakteryzacja MO1–MO10 zielona, pole po polu (711 rekordów).
- [x] Próbki MO6/MO7/MO8/MO10 zweryfikowane wobec `test_tyres.cjs` (dokumentacja w `ZRODLA.md`, z jawnym opisem rozbieżności i ich przyczyn).
- [x] `ZRODLA.md` opisuje pochodzenie i odtwarzanie fixtures.
- [x] Audyt pełnych plików MO1–MO5 w `raport.md`, zgodność z `.meta.json`.
- [x] `npm run lint`, `typecheck`, `build`, `test` — czyste (zweryfikowane niezależnie, 162/162 testów).
- [x] `npm run build` umieszcza `.cjs` + `dictionaries/` w `dist/` (zweryfikowane niezależnym `rm -rf dist && npm run build`).
- [x] `docs/rebuild-backlog.md` zaktualizowany.
- [x] `docs/rebuild-roadmap.md` zaktualizowany.
- [x] Brak nowych endpointów / zapisu do bazy / `tk()` — potwierdzone grepem.

## Parallel-test concerns

None — all tests parallelizable. `mo9-offline.mjs` podmienia `globalThis.fetch` i zmienne `AGRORAMI_EMAIL`/`AGRORAMI_PASSWORD`, ale przywraca je w `finally` (także przy wyjątku), a vitest izoluje pliki testowe w osobnych workerach/procesach — brak współdzielonego portu, pliku o stałej ścieżce czy bazy.

## Overall assessment

Bardzo solidna realizacja — port jest rzeczywiście bajt-w-bajt (zweryfikowane niezależnie od testu przez `diff -r` i ponowne uruchomienie `sha256`), a gate charakteryzacyjny jest tym, czym się deklaruje: wzorzec pochodzi z prawdziwego uruchomienia `mirror/backend` (potwierdzone ponownym nagraniem — wynik bajtowo identyczny), porównanie jest pole-po-polu z czytelnym komunikatem błędu, a jego siła została potwierdzona empiryczną mutacją. Typy w `typy.ts` zweryfikowane skryptem względem 711 rekordów wzorca — bez sprzeczności. Jedyna realna słabość to niepełne pokrycie ścieżki wielostronicowej w mocku MO9 (SHOULD-FIX), która nie unieważnia gate'u, ale osłabia jedno z konkretnych twierdzeń raportu o zakresie pokrycia. Dokumentacja (`ZRODLA.md`, raport, aktualizacje backlogu/roadmapy) jest wyjątkowo transparentna co do luk i kompromisów — dobry wzorzec dla kolejnych sesji 3b–3e.
