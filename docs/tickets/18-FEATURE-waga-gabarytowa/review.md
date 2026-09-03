# 18-FEATURE-waga-gabarytowa — Code review

> Reviewed: 2026-09-03
> Branch: feature/18-waga-gabarytowa
> Diff: 16 plików, 4 commity

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:1036-1041` — blok „Iteracja 9 — Waga gabarytowa" nie jest zaktualizowany po zamknięciu ticketa.
  - Reason: `git diff origin/develop...HEAD -- docs/rebuild-roadmap.md docs/rebuild-backlog.md` nie zwraca nic — żaden z obu plików nie został ruszony. Roadmapa nadal opisuje ZAMIAR („Decyzja: liczyć w przeglądarce vs przez API — rekomendacja: przez API"), a nie STAN faktycznie dowieziony (D1: oba kalkulatory 1:1, rekomendacja API odrzucona). To wprost łamie obowiązek #1 z `CLAUDE.md` („Po każdym zamkniętym bloku roadmapa opisuje STAN, nie zamiar") oraz ostatni punkt Definition of done z `plan.md:227` („roadmapa i backlog zaktualizowane"). Kolejna sesja czytająca roadmapę dostanie fałszywy obraz — że decyzja „przez API vs lokalnie" wciąż czeka, podczas gdy jest rozstrzygnięta i uzasadniona (D1).
  - Suggestion: dopisać do bloku Iteracji 9 datę zamknięcia, ticket ID, i skrócone podsumowanie D1–D4 (zwłaszcza odrzucenie rekomendacji „przez API" z powodem), analogicznie do wpisów przy innych zamkniętych iteracjach w tym samym pliku.

## SHOULD-FIX

- [ ] `rebuild/backend/src/routes/waga-gabarytowa.ts:38` — `req.body ?? {}` to nieudokumentowany drobny dodatek wobec oryginału (handler oryginału zakłada `c.body` zawsze istnieje, bo framework je dostarcza).
  - Nie zmienia obserwowalnego zachowania (przy braku body i tak wszystko schodzi do zer przez `naLiczbe`), ale warto dopisać jednozdaniowy komentarz, że to zabezpieczenie przed `undefined` z express (np. brak nagłówka `Content-Type`), a nie odstępstwo behawioralne — inaczej przyszły czytelnik może pomyśleć, że to niezamierzona różnica względem 1:1.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx:174` — dodany `aria-label={\`Usuń ${przewoznik.nazwa}\`}` na przycisku usuwania, którego nie ma w oryginale. Nieszkodliwe (dostępność), ale to jest formalnie mikro-odstępstwo od 1:1 — warto by było mieć taki dodatek nazwany wprost w komentarzu, tak jak inne świadome odstępstwa w tym ticketcie.

## Plan compliance

### Done ✓
- Backend: `obliczWageGabarytowa` w `src/waga-gabarytowa/formula.ts` — formuła zweryfikowana linia po linii wobec `deminified/backend-index.cjs:48749-48769`: progi (`<=`, nie `<`), stała 60, kolejność mnożenia `T * dlugosc * g * m`, `Math.round(x*1e3)/1e3`, dokładne brzmienie trzech wariantów `opis` ze znakami `≤`/`>`/`→`, zachowanie NaN „przechodzącego" przez formułę.
- `repos/config.ts` — `odczytajUstawieniaWagiGabarytowej` używa `||`, nie `??`, z domyślnymi wartościami zgodnymi z `:45633-45637`.
- `routes/waga-gabarytowa.ts` — trasa za `requireAuth`, komentarz „⚠ ODSTĘPSTWO ŚWIADOME (D2)" obecny i treściwy, bez walidacji i bez 400, bez audytu — zgodnie z planem.
- `contract/openapi.yaml` nie zostało ruszone (zweryfikowane diffem) — kontrakt pozostaje zamrożony z `security: []`, tak jak wymagał plan.
- Testy jednostkowe formuły BE: ręcznie przeliczyłem wszystkie liczbowe oczekiwania (36.072, 33.4, 240.48, 3.707, 54 kg) — zgadzają się z formułą oryginału. Pokrycie gałęzi kompletne (`<`, `==` na obu granicach, `>`, NaN, stringi, jednostki w tekście, `null`/`""`/`false`, nadpisany config).
- Frontend: `WagaGabarytowa.tsx`, `obliczenia.ts`, `przewoznicy.ts`, `TabelaPrzewoznikow.tsx` porównane linia po linii z `deminified/frontend-index.js:26514-26953` i `:9161-9192` — stan startowy `"60"/"50"/"50"/""`, sześciu przewoźników w tej samej kolejności i z tymi samymi dzielnikami, cztery klucze IndexedDB nazwane identycznie, komplet `data-testid` zgodny z planem, formatowanie `toFixed(2)`/`toFixed(4)`/`toLocaleString("pl-PL")` zgodne.
- Flaga `wczytano` gatuje autozapis dokładnie tak jak `f` w oryginale — dwa osobne `useEffect` dla listy przewoźników i wyboru, `tg`/`eg` (wymiary/wynik) zapisywane wyłącznie w handlerze „Oblicz", nie przy każdej zmianie pola — subtelność oryginału odtworzona poprawnie.
- Logika edytora: blokada usunięcia ostatniego przewoźnika, przeniesienie wyboru na pierwszego pozostałego po usunięciu wybranego, ignorowanie niedodatniego/nieparsowalnego dzielnika, `custom_${Date.now()}` — wszystko zgodne z oryginałem.
- FE nie woła endpointu — potwierdzone brakiem `fetch`/MSW w testach renderowych (`onUnhandledRequest: "error"` wyłapałoby ewentualne wywołanie).
- Gate: operacja w kontrakcie, walidacja 200 przez `sprawdzZgodnoscZKontraktem`, dokładnie pięć pól odpowiedzi, 401 bez tokenu asertowane wprost — zgodnie z precedensem `narzuty.gate.test.ts`.
- Bramki: lint/typecheck/build/test czyste w obu pakietach (zweryfikowane uruchomieniem) — backend 622/622, frontend 307/307.

### Missing lub odbiegające ✗
- Roadmapa (`docs/rebuild-roadmap.md`) i backlog (`docs/rebuild-backlog.md`) nie zostały zaktualizowane mimo że `plan.md` i `raport.md` deklarują to jako część zakresu (patrz BLOCKER wyżej).

### Definition of done
- [x] `POST /api/waga-gabarytowa/oblicz` zwraca pięć pól zgodnych z formułą oryginału na wszystkich trzech gałęziach progu szerokości
- [x] Endpoint za `requireAuth`; 401 bez tokenu; 200 waliduje się przez `sprawdzZgodnoscZKontraktem`
- [x] `/waga-gabarytowa` zdjęte z placeholderów, wpięte w `App.tsx`, renderuje kalkulator + edytor przewoźników z kompletem `data-testid`
- [x] FE liczy lokalnie, nie woła API
- [x] Stan trwały w IndexedDB przez `magazynKV`, z gatowaniem autozapisu
- [x] Testy: gate + jednostkowe formuły BE + jednostkowe FE + renderowe FE — zielone (zweryfikowane uruchomieniem)
- [x] `lint`, `typecheck`, `build`, `test` czyste w obu pakietach (zweryfikowane uruchomieniem)
- [ ] Decyzje D1–D4 zapisane w plan.md i raport.md — TAK; roadmapa i backlog zaktualizowane — NIE (patrz BLOCKER)

## Parallel-test concerns

None — wszystkie nowe testy (BE: gate + formuła, FE: obliczenia + render) używają `stworzSrodowiskoTestowe()` (baza tymczasowa, port efemeryczny, ten sam wzorzec co reszta gate'ów) albo działają w pamięci (jsdom, bez IndexedDB, bez portów, bez plików tymczasowych o stałej ścieżce). Nic tu nie koliduje między równoległymi agentami.

## Overall assessment

Bardzo staranna robota — formuła backendu i widok frontendu są porównane i odtworzone linia po linii z oryginałem, łącznie z nieoczywistymi detalami (NaN przechodzące przez formułę, `||` zamiast `??`, dwa osobne `useEffect` do autozapisu zamiast jednego, brak autozapisu wymiarów/wyniku poza klikiem „Oblicz"). Testy jednostkowe formuły rzeczywiście dźwigają ciężar dowodu przy braku fixtura — przeliczyłem ręcznie kilka przykładów i się zgadzają. Jedyny realny problem to brak aktualizacji roadmapy/backlogu, co jest wprost złamaniem zasady projektu z `CLAUDE.md` i własnego punktu Definition of done z `plan.md` — łatwe do naprawienia, ale trzeba to zrobić przed merge'em.
