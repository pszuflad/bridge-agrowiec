# 15-FEATURE-historia-zmian — Code review

> Reviewed: 2026-09-02
> Branch: feature/15-historia-zmian
> Diff: 20 plików, 5 commitów (base `origin/develop`)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:863-882` — blok „Iteracja 5 — Historia" nie został zamknięty mimo że implementacja jest gotowa i przechodzi GATE.
  - Reason: To wprost DoD ticketa (`plan.md` ostatni punkt) i decyzja D3: „Poprawiamy fakt w roadmapie i PRZENOSIMY przypisanie `historia_cen` do I10". Nic z tego nie zaszło — `Status: ⬜`, linia 866 dalej mówi `Wa` = `historia_cen` (fakt sprostowany w `plan.md` i w kodzie, ale NIE w roadmapie), a blok „Iteracja 10" (linia 973) nie ma żadnej wzmianki o `historia_cen`/pisarzu z 3d-1. `CLAUDE.md` opisuje dokładnie ten mechanizm awarii („ustalenie dotyczące przyszłego bloku wpisz do tego bloku") jako źródło realnych problemów w poprzednich sesjach — tu ten sam błąd się powtarza, tyle że w drugą stronę (poprawka nie trafiła nigdzie).
  - Suggestion: W bloku I5 ustawić `Status: ✅ 2026-09-02 (15-FEATURE-historia-zmian)`, poprawić linię 866 na `Wa` = tabela `history` (nie `historia_cen`), a w opisie dopisać, że `/meta`+`/paged` czytają `audit_log`. W bloku I10 (linia ~973) dopisać notę, że `historia_cen` ma pisarza z bloku 3d-1 i czeka na czytelnika `/api/analytics/prices/product-history`.

## SHOULD-FIX

- [ ] `rebuild/frontend/test/msw/kontrakt.ts:86` — komentarz przy `stronaHistoriiZFixtura` mówi „z 50 nagranymi wpisami", a fixture (`GET_history_paged.json`) faktycznie ma tylko 5 elementów w `items` (50 to wartość `_przyciete.items`, czyli ile było PRZED przycięciem nagrania). Myląca dokumentacja dla kogoś, kto będzie rozszerzał testy FE o kolejne wiersze z fixture'a.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/historia/dane.ts:91-95` — `sformatujDate` dokłada strażnik `Number.isNaN`, którego oryginał (`fe.js:25502`) nie ma (tam `Invalid Date` poszłoby wprost do DOM). To niezatwierdzone w `plan.md` (D1–D6) odstępstwo — nieszkodliwe i defensywne, ale warto dopisać je do listy decyzji albo do nagłówka funkcji, żeby nie wyglądało na przeoczenie przy kolejnym audycie wierności.
- [ ] `rebuild/backend/test/historia.odczyt.test.ts:114,151,158,174` — asercje `total === 12` / `pages === 3` są związane sztywno z liczbą wierszy w `zasiejAudytHistorii` (`test/gate/dane.ts`). Nie jest to problem współbieżności (seed lokalny dla tego pliku testowego), ale każda przyszła zmiana tego seeda (np. przy pracach nad I12/`/api/audit-log`) cichutko wywali te testy — rozważyć liczenie oczekiwanej wartości z długości seeda zamiast literału.

## Plan compliance

### Done ✓
- Backend: `repos/dziennik-zmian.ts`, `repos/audit.ts::listaAudytu`, `repos/historia.ts` (sprostowanie docstringu), `historia/mapowanie.ts`, `routes/history.ts`, wpięcie w `app.ts` — dokładnie wg planu i kolejności commitów.
- Mapowanie `audit_log → widok`: słownik pięciu akcji, `parsujSzczegoly` z `try/catch`, kolejność fallbacków `liczbaPozycji`/`dostawca`/`uwagi`, clamp `page`/`limit` z fallbackiem PO `parseInt` — zweryfikowane linia po linii wobec `deminified/backend-index.cjs:48335-48391`, zgodne 1:1.
- Frontend: `Historia.tsx`, `historia/TabelaHistorii.tsx`, `historia/dane.ts`, wpięcie w router/`placeholdery.ts`, poprawka komentarza w `Staging.tsx` — teksty PL, kolumny, formatowanie daty, ucięcie listy pól do 6, etykiety filtrów zgodne z `frontend-index.js:25350-25635`.
- GATE (`historia.gate.test.ts`) faktycznie dowodzi zgodności: seed `zasiejAudytHistorii` to uczciwe wiersze WEJŚCIOWE `audit_log` (nie przepisany fixture), a osobny test sprawdza komplet kluczy (10/11) i wartości pięciu najświeższych wpisów `edycja` — nie tylko kształt.
- Odsetek akcji spoza słownika (D2), NULL/zepsuty JSON w `szczegoly_json`, `encja_id` niezłączalny z `suppliers` — pokryte i w testach jednostkowych, integracyjnych i FE (MSW).
- `requireAuth` faktycznie na wszystkich trzech trasach (`routes/history.ts:52,63,69`), utrwalone testem 401 (D1).
- Wszystkie cztery bramki (`lint`, `typecheck`, `test`, `build`) czyste po obu stronach — zweryfikowane uruchomieniem: backend 529/529, frontend 199/199.

### Missing or deviating ✗
- Aktualizacja `docs/rebuild-roadmap.md` (zamknięcie bloku I5, sprostowanie faktu `Wa`, nota do I10) — patrz BLOCKER wyżej. Jedyny punkt planu, który nie został zrealizowany.

### Definition of done
- [x] Trzy trasy za `requireAuth`, GATE przechodzi (kontrakt + fixtures, kształt 1:1).
- [x] Mapowanie `akcja → typ` odtworzone 1:1 wraz z odrzucaniem akcji spoza słownika.
- [x] `szczegoly_json = NULL` i niepoprawny JSON nie wywracają odczytu (testy jednostkowe + integracyjne).
- [x] `encja_id` niezłączalny z `suppliers` nie wywraca odczytu ani widoku (testy backend + FE).
- [x] Clamp `page`/`limit` odtworzony dosłownie, utrwalony testem (`it.each` w `historia.mapowanie.test.ts`).
- [x] Widok `/historia` wpięty w router i shell, placeholder zdjęty.
- [x] Tabela, filtry, paginacja 25/50/100 i teksty PL zgodne z oryginałem.
- [x] `isLoading`/`isError` wg wzorca `Staging.tsx` (D5).
- [x] `lint`, `typecheck`, `test`, `build` czyste po obu stronach.
- [ ] Roadmapa: blok I5 zamknięty, fakt `Wa = history` sprostowany, nota o `historia_cen` przeniesiona do I10 — NIE zrobione.

## Parallel-test concerns

None — wszystkie nowe testy (backend: GATE/jednostkowe/integracyjne; frontend: MSW) używają `stworzSrodowiskoTestowe()` (baza w katalogu tymczasowym, port efemeryczny) albo czystych funkcji bez stanu współdzielonego. `historia.odczyt.test.ts` ma dopisujący test na końcu opisu (`zapiszAudyt` po istniejących asercjach), ale działa na własnej, izolowanej instancji `srodowisko` per plik — bez kolizji między agentami.

## Overall assessment

Implementacja jest bardzo solidna i rzetelnie wierna oryginałowi — mapowanie `audit_log → widok`, clamp paginacji i odsiew akcji zweryfikowane linia po linii zgadzają się z `deminified/backend-index.cjs:48335-48391`, a seed GATE uczciwie dowodzi całej drogi audyt → widok, a nie tylko przepisuje fixture. Wszystkie bramki (lint/typecheck/test/build) są czyste po obu stronach, testy FE sprawdzają realne zachowanie (parametry zapytań, ucinanie list, stany błędu), nie tylko render. Jedyny realny problem to niedokończona aktualizacja `docs/rebuild-roadmap.md` — wymagana wprost przez DoD i przez własną decyzję D3 z `plan.md`, a jej brak jest dokładnie tym rodzajem błędu, przed którym ostrzega `CLAUDE.md` (fakt „`Wa` = `historia_cen`" zostanie powielony przez kolejną sesję, jeśli roadmapa nie zostanie poprawiona teraz).
