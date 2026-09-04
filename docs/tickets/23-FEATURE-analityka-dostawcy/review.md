# 23-FEATURE-analityka-dostawcy — Code review

> Reviewed: 2026-09-03
> Branch: feature/23-analityka-dostawcy
> Diff: 18 plików, 4 commity (wobec `origin/develop`)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/frontend/test/analityka.dostawcy.test.tsx:89`, `rebuild/frontend/test/analityka.test.tsx:76` — podniesiony limit `findByTestId(..., { timeout: 15_000 })` nie jest w praktyce skuteczny do 15 s, bo globalny `testTimeout` w `rebuild/frontend/vitest.config.ts` pozostaje na domyślnych 5000 ms i nie został podniesiony ani globalnie, ani per-test (trzeci argument `it(...)`). Gdyby leniwy import chunku z Recharts realnie przekroczył 5 s (np. pod obciążeniem przy równoległej pracy kilku agentów na tej samej maszynie — scenariusz, który projekt zakłada), test padnie z „Test timed out in 5000ms” zanim `findByTestId` zdąży doczekać 15 s. Zmierzone lokalnie: import trwa ok. 1.5 s, więc obecnie problemu nie widać, ale deklarowana ochrona przed migotaniem jest częściowo pozorna.
  - Reason: raport.md wprost twierdzi, że to podniesienie „usuwa migotanie” testów widoku — twierdzenie nie jest w pełni prawdziwe przy obecnej konfiguracji, więc pod większym obciążeniem CI/równoległej pracy testy mogą nadal migotać, mimo że wygląda to na naprawione.
  - Suggestion: podnieść też `testTimeout` (globalnie w `vitest.config.ts` albo per-test w tych dwóch `it()`/helperach) do wartości ≥ 15 s, żeby limit `findByTestId` miał w ogóle szansę zadziałać.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/analityka/README.md:4` — zdanie „Blok 10d (…) wypełnił wg niego zakładkę `dostawcy`… Bloki 10b–10e **dokładają zakładki**…” zostało sklejone w jeden akapit bez podziału (dawne zdanie o blokach 10b–10e zaczyna się teraz w środku zdania o 10d) — czysto kosmetyczne, nie wpływa na treść.

## Plan compliance

### Done ✓
- Krok 1 — cztery funkcje w `rebuild/backend/src/repos/analityka.ts` (sekcja „BLOK 10d · DOSTAWCY”), SQL 1:1 z `mirror/backend/analytics_module.cjs:110-154,332` (zweryfikowane linia po linii — kolumny, aliasy, `GROUP BY`, `ORDER BY`, progi, `LAG() OVER (PARTITION BY …)`).
- Krok 2 — cztery trasy `GET` w `rebuild/backend/src/routes/analytics.ts`, bez czytania `req.query`, w kolejności rejestracji oryginału (trzy w sekcji „supplier analysis”, `dostawcy-stats` w sekcji aliasów).
- Krok 3 — GATE (`analityka.dostawcy.gate.test.ts`, 4 operacje × kontrakt+fixture+401, plus asercja o braku `_przyciete`) i testy jednostkowe (`analityka.dostawcy.agregaty.test.ts`, w tym gałąź `hasHistory: false`, próg zmiany ceny, sortowania, `stan > 0`).
- Krok 4 — typy i trzy hooki w `pages/analityka/api.ts`; `dostawcy-stats` świadomie bez hooka (D3).
- Krok 5 — `PasekDostepnosci.tsx`, wierny port `O(e)` (`fe.js:27919-27936`), wydzielony jako wspólny komponent.
- Krok 6 — trzy sekcje (`SekcjaStabilnoscDostawcow`, `SekcjaCyklZyciaDostawcow`, `SekcjaStanDostawcow`), tytuły i kolumny 1:1 z `deminified/frontend-index.js:28054-28172`; wykres w karcie „1.4/1.5” zgodny z regułami `chart.tsx` (jedna seria bez legendy, jedna oś 0–100, paleta nietknięta — `KOLOR_SERII = KOLORY_WYKRESU[0]`, tabela pod wykresem, `isAnimationActive={false}`).
- Krok 7 — `ZakladkaWPrzygotowaniu blok="10d"` zastąpione trzema sekcjami w kolejności oryginału.
- Krok 8 — loadery fixtures, testy widoku (12+ przypadków w `analityka.dostawcy.test.tsx`), testy `zastosujFiltryDostawcow` w `analityka.filtrowanie.test.ts`.
- Krok 9 — bramki uruchomione i zielone (patrz niżej).

### Missing or deviating ✗
Brak — trzy odstępstwa opisane w `raport.md` (charakteryzacja progu grosza, podniesiony timeout leniwego chunku, dołożenie mocków tras dostawców do `analityka.test.tsx`) mieszczą się w zakresie ticketa i są uzasadnione; pierwsze i trzecie nie budzą zastrzeżeń, drugie opisane wyżej jako SHOULD-FIX (mechanizm nie działa tak, jak deklaruje raport, choć kierunek jest słuszny).

### Definition of done
- [x] Cztery trasy odpowiadają kształtem 1:1 fixtures i walidują się względem `openapi.yaml`; wszystkie za `requireAuth` (401 bez tokenu potwierdzone testem i ręcznie uruchomionym GATE).
- [x] Odpowiedzi nie zawierają `_przyciete` — potwierdzone asercją w GATE i ręczną inspekcją fixtures/kodu.
- [x] Gałąź `hasHistory: false` pokryta testem jednostkowym backendu i testem widoku frontu.
- [x] Zakładka `dostawcy` renderuje trzy karty w kolejności oryginału, z dosłownymi tytułami i kompletem kolumn 1:1.
- [x] Kolumna „Dostępność” renderuje pasek postępu, wydzielony jako wspólny komponent.
- [x] Wykres nad tabelą w karcie „1.4/1.5”, zgodny z regułami `chart.tsx`.
- [x] Filtr globalny `dostawcy` zawęża wszystkie trzy tabele; wymiary nieobsługiwane wypisane w notce.
- [x] `ZakladkaWPrzygotowaniu blok="10d"` usunięte z `Analityka.tsx`.
- [x] `lint`, `typecheck`, `build`, `test` czyste w obu projektach — zweryfikowane samodzielnie: backend lint/typecheck/build OK, `npm test` backendu 702/703 (jeden nietrafiony test w `test/scheduler.test.ts` — **niezwiązany z tym ticketem**, plik nie występuje w diffie; w izolacji przechodzi w 24/24, więc to istniejąca wcześniej niestabilność timingowa pod obciążeniem pełnego zestawu testów, nie regresja tego bloku). Frontend: lint/typecheck/build OK, `npm test` 408/408 zielone.
- [ ] `docs/rebuild-roadmap.md` §5 opisuje blok 10d jako STAN — **nie sprawdzone w tym review** (poza zakresem diffu ticketa; roadmapa nie jest częścią tego brancha wg `git diff --stat`, więc aktualizacja albo nastąpi osobno, albo trzeba ją dopisać przed mergem).

## Parallel-test concerns

Brak realnych kolizji zasobów (baza tymczasowa, porty efemeryczne — zgodnie z konwencją projektu). Jedyna obserwacja to opisany wyżej SHOULD-FIX: podniesiony `timeout` w `findByTestId` bez podniesienia `testTimeout` może dać migotanie właśnie pod obciążeniem generowanym przez równoległą pracę kilku agentów na tej samej maszynie — to nie jest kolizja zasobu, ale wrażliwość na obciążenie CPU, więc wymienione osobno.

## Overall assessment

Bardzo solidny port. Cztery zapytania SQL są bajt w bajt zgodne z oryginałem (zweryfikowane wobec `mirror/backend/analytics_module.cjs:110-154,332`), kolejność rejestracji tras i brak odczytu `req.query` — zgodne. Front wiernie odtwarza siedem/sześć/pięć kolumn kart z `deminified/frontend-index.js:28054-28172`, `PasekDostepnosci` jest dosłownym portem `O(e)`, a jedyne świadome odstępstwo (wykres) trzyma się reguł `chart.tsx` co do palety, jednej serii i tabeli pod wykresem. Testy są nietrywialnie dobre — GATE pokrywa cztery kształty koperty i brak `_przyciete`, test jednostkowy domyka gałąź `hasHistory: false`, której żaden fixture nie dowodzi, a testy widoku sprawdzają realne zachowanie (pasek, wykres, filtr, kolejność DOM). Jedyne zastrzeżenie dotyczy mechaniki podniesionego limitu oczekiwania w testach widoku — kierunek słuszny, ale realizacja niepełna. Bramki zielone poza jednym, niezwiązanym z tym blokiem, timing-owym testem w `scheduler.test.ts`. Merge — po ewentualnym doprecyzowaniu timeoutu i weryfikacji wpisu do roadmapy.
