# 15-FEATURE-narzuty-promocje-ceny — Code review

> Reviewed: 2026-09-02
> Branch: feature/15-narzuty-promocje-ceny
> Diff: 17 plików, 2 commity (`905c0ba`, `86ba852`)

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/backend/src/routes/markups.ts:82-89` — `PATCH /api/markups/:id` z nienumerycznym
  `id` (np. `"abc"`) omija `aktualizujNarzut` całkowicie (`Number.isNaN(id) ? undefined : ...`),
  więc `przeliczCenyZRegul` NIE jest wołane. W oryginale (`:48699-48710`) `parseInt` daje `NaN`,
  ale `U.updateMarkup(NaN, …)` i tak jest wywoływane — `UPDATE … WHERE id=NaN` trafia w 0 wierszy,
  ale `recalcPricesFromRules()` mimo to przelicza cały katalog, zanim padnie 404. Port cichcem
  usuwa ten efekt uboczny. Bliźniacza trasa promocji (`routes/promotions.ts:71-77`) tego skrótu
  NIE ma i zachowuje się zgodnie z oryginałem — asymetria jest więc również między dwiema
  trasami tego samego bloku, a nie tylko względem oryginału. Nieprzetestowane (brak scenariusza
  z nienumerycznym `id` w `narzuty.patch.test.ts`).
  - Reason: cicha różnica zachowania nieopisana żadną z decyzji D1–D5 w planie; w duchu zasady
    „szukaj cichych różnic" z promptu do tego ticketa to dokładnie taki przypadek.
  - Suggestion: albo usunąć strażnik `Number.isNaN` i zawsze wołać `aktualizujNarzut` (pełna
    wierność, łącznie z „marnym" przeliczeniem katalogu przy literówce w URL-u), albo świadomie
    zaakceptować odstępstwo i dopisać je do `docs/rebuild-backlog.md` — obecnie nie jest ani
    portem 1:1, ani udokumentowaną decyzją.

## NICE-TO-HAVE

- [ ] `docs/rebuild-backlog.md`, `docs/rebuild-roadmap.md` — raport.md (sekcja „Follow-up") i
  plan.md (Krok 7) zapowiadają nowe wpisy backlogu (D4 — daty promocji, D5 — asymetria 404,
  domknięcie #14) oraz aktualizację roadmapy (zamknięcie 4a, PUT→PATCH, wymóg dla I12), ale
  `git diff origin/develop...HEAD` nie dotyka żadnego z tych plików. Zgodnie z planem robi to
  „Faza 5 (doc-checker)" — najpewniej osobny krok Mastera po tym review, nie przeoczenie
  implementera. Wymienione tu, żeby Master nie zamknął ticketa bez tego kroku.
- [ ] `rebuild/backend/src/repos/ceny.ts:169-171` — `cenaSprzedazyZRegul` jest współdzielona
  między `zastosujRegulyCenowe` i `przeliczCenyZRegul`, co jest lepszą praktyką niż oryginał
  (dwa niezależne, ale identyczne wyrażenia). Nie zmienia wyniku (ta sama kolejność mnożeń
  left-to-right co w oryginale), ale warto mieć świadomość, że to jedno z niewielu miejsc,
  gdzie port jest odważniej zrefaktoryzowany niż źródło — zgodnie z duchem „jedna formuła,
  wspólna dla obu miejsc" z planu, więc nieproblematyczne.

## Plan compliance

### Done ✓
- Krok 1 — silnik cen `src/repos/ceny.ts`: `dopasujWarunek`, `narzutPasuje`, `promocjaPasuje`,
  `wybierzNarzut`, `wybierzPromocje`, `zastosujRegulyCenowe`, `przeliczCenyZRegul` — porównane
  linia po linii z `:44572-44693`, zgodne co do kolejności sortowania, progu `0.005`/`0.05`,
  `floor`, `??` vs domyślnych, obsługi uszkodzonego JSON-a i specyficzności reguł.
- Krok 2 — `src/repos/pola-edytowalne.ts` z generycznym `odsiejPola`; `suppliers.ts` deleguje
  bez zmiany zachowania (potwierdzone diffem i zielonymi testami `dostawcy.patch.test.ts`).
- Krok 3 — `src/repos/markups.ts` / `promotions.ts`, CRUD + `POLA_EDYTOWALNE_*` (D3), każda
  mutacja woła `przeliczCenyZRegul` w `try/catch`.
- Krok 4 — `src/routes/markups.ts` / `promotions.ts`, osiem tras, kody audytu, kształt
  odpowiedzi, 404 tylko przy markupach (D5) — zgodne z `:48692-48737`.
- Krok 5 — rejestracja w `src/app.ts`.
- Krok 6 — gałąź cenowa wpięta w `src/import/akceptacja.ts` w dokładnie tym samym miejscu
  sekwencji (między ustawieniem `status` a `const istniejacy = …`), z tym samym zakresem
  `try/catch` i bez cache'owania tabel między pozycjami — zweryfikowane wprost porównaniem
  z `:44884-44892`.
- Strategia testów zrealizowana: `narzuty.gate.test.ts` (fixtures+kontrakt+401 na 8 operacjach),
  `ceny.silnik.test.ts` (34 testy formuły i wyboru reguł), `narzuty.patch.test.ts` (18 testów
  pól edytowalnych/audytu/przeliczania), rozszerzona charakteryzacja z 13 nowymi scenariuszami
  cenowymi + kontrola negatywna uruchamiana na prawdziwym oryginale.
- `npm run lint`, `typecheck`, `build`, `test` — uruchomione ponownie w tym review, wszystkie
  czyste (522/522 testów, 33 pliki).

### Missing or deviating ✗
- Wpisy do `docs/rebuild-backlog.md` i poprawki `docs/rebuild-roadmap.md` zapowiedziane w planie
  (Krok 7) nie są częścią tego diffu — zgodnie z planem to osobna „Faza 5 (doc-checker)", ale
  warto potwierdzić u Mastera, że ten krok faktycznie nastąpi przed zamknięciem ticketa.
- Poza tym zero odchyleń od planu implementacji; raport.md „Odstępstwa od planu: Brak" — zgodne
  z tym, co widać w diffie.

### Definition of done
- [x] `GET/POST /api/markups`, `PATCH/DELETE /api/markups/{id}` — działają, za `requireAuth`
- [x] `GET/POST /api/promotions`, `PATCH/DELETE /api/promotions/{id}` — jw.
- [x] Silnik cen (`ceny.ts`) odtwarza `:44572-44693` co do gałęzi, z formułą i progiem zapisu
- [x] Każda mutacja narzutu/promocji przelicza cały katalog (`try/catch`, jak oryginał)
- [x] Gałąź cenowa wpięta w `acceptStaging` w miejscu i kolejności jak oryginał
- [x] Charakteryzacja 3d-2 z regułami w tabelach zielona (port == uruchomiony oryginał)
- [x] Kontrola negatywna dowodzi, że nowe scenariusze faktycznie zmieniają cenę
- [x] GATE: `GET_markups.json` i `GET_promotions.json` — kształt 1:1 + walidacja kontraktu
- [x] Listy pól edytowalnych (D3) z testami; audyt loguje surowe ciało (D2) z testem
- [x] `npm run lint`, `typecheck`, `build`, `test` — czyste
- [ ] Roadmapa: 4a zamknięte, PUT→PATCH sprostowane, wymóg dla I12 w bloku I12, noty dla 4b —
      nie ma w diffie, zapowiedziane jako Faza 5, do potwierdzenia
- [ ] Backlog: #14 zaktualizowany, nowe wpisy D4 i D5 — jw., nie ma w diffie

## Parallel-test concerns

None — wszystkie nowe testy używają `stworzSrodowiskoTestowe()`/`stworzTestowaBaze()` (baza
w katalogu tymczasowym, porty efemeryczne), zgodnie z istniejącym wzorcem w repo.

## Overall assessment

Bardzo solidny port — silnik cen (`ceny.ts`) porównany linia po linii z oryginałem zgadza się co
do wszystkich nieoczywistych zachowań (specyficzność reguł bijąca priorytet, odwrócone
dopasowanie `zasieg`, ignorowane daty promocji, próg zapisu, brak `status` w masowym
przeliczeniu), a wpięcie w `acceptStaging` trafia w dokładnie to samo miejsce sekwencji co
`:44884-44892`. Charakteryzacja z 13 nowymi scenariuszami i kontrolą negatywną na uruchomionym
oryginale to najmocniejszy możliwy dowód wierności w tym projekcie. Jedyny realny finding to
drobna, nieudokumentowana różnica w obsłudze nienumerycznego `id` w `PATCH /api/markups/:id`
(pomija efekt uboczny przeliczenia katalogu, którego oryginał by nie pominął) — niska stawka,
ale warto rozstrzygnąć świadomie zamiast zostawić jako przypadkowe zachowanie. Wszystkie bramki
(lint/typecheck/build/test) przechodzą czysto.
