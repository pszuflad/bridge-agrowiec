# 26-FEATURE-analityka-export-pulpit — Code review

> Reviewed: 2026-09-04
> Branch: feature/26-analityka-export-pulpit
> Diff: 36 plików, 5 commitów

## BLOCKER

- [ ] `docs/rebuild-roadmap.md`, `docs/rebuild-backlog.md`, `docs/analityka-bloki-10b-10f.md`, `rebuild/frontend/src/pages/analityka/README.md` — dokumentacja bloku NIE została zaktualizowana.
  - Reason: Plan (Krok 8) i Definition of done wprost wymagają: (a) nowego wpisu w backlogu o trwale martwym kaflu „Ostatni eksport CSV" (D3), (b) dopisku przy #32/#33 o odtworzeniu dwóch widoków eksportu w 10f, (c) obserwacji o braku sanityzacji `filename`, (d) oznaczenia bloku 10f i **całej Iteracji 10** jako ✅ w roadmapie. `git diff origin/develop...HEAD --stat -- docs/rebuild-roadmap.md docs/rebuild-backlog.md docs/analityka-bloki-10b-10f.md rebuild/frontend/src/pages/analityka/README.md` nie zwraca ŻADNEJ zmiany — te pliki nie zostały ruszone w ogóle. Roadmapa nadal pokazuje Iterację 10 jako `🔨` i mówi „Zostaje 10f" (linia 160, 1086), mimo że blok jest zaimplementowany, zmergowany i wg `raport.md` kompletny. To dokładnie ten problem, przed którym ostrzega `CLAUDE.md` §„Roadmapa jest wejściem dla następnej sesji, obowiązek 1": „Po każdym zamkniętym bloku roadmapa opisuje STAN, nie zamiar" — kolejna sesja czytająca roadmapę dostanie nieaktualny obraz świata (uzna, że 10f wciąż trwa, i może np. spróbować go ponownie zaplanować albo nie zauważyć, że Iteracja 10 jest zamknięta).
  - Suggestion: Dopisać do roadmapy status ✅ dla bloku 10f i Iteracji 10 (§4, §5, wiersz w tabeli iteracji), dodać wpis do backlogu o kaflu D3 i dopiski przy #32/#33/obserwacji o `filename`, zamknąć `docs/analityka-bloki-10b-10f.md` i zaktualizować `pages/analityka/README.md` zgodnie z Krokiem 8 planu.

## SHOULD-FIX

Brak. Kod merytoryczny (backend + frontend) jest bardzo starannie sportowany i nie budzi zastrzeżeń wykrytych w tym przeglądzie.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/routes/analytics.ts:311-322` — `Content-Disposition` bierze `req.params.view` bez sanityzacji (port 1:1, świadomie, raport pkt 2 „Follow-up"). Zgodne z planem; zostaje jako obserwacja do backlogu, patrz BLOCKER wyżej (bo akurat ten wpis do backlogu też nie trafił).
- [ ] `raport.md` §„Follow-up" pkt 3 — niejednolite renderowanie `AppShell` w widokach (Pulpit/Konfiguracja/WidokWPrzygotowaniu renderują ramę, siedem innych widoków nie) zgłoszone jako obserwacja poza zakresem 10f — słusznie niezałatwiane tutaj, ale warto przenieść do konkretnego wpisu w backlogu/roadmapie, żeby nie zgubić się między sesjami (tu też dotyczy brak aktualizacji dokumentacji).

## Plan compliance

### Done ✓
- Krok 1 — port `toCsv`/`csvEscape` → `rebuild/backend/src/analityka/csv.ts`, 1:1 z `analytics_module.cjs:56-57` (separator średnik, BOM zawsze, podwajanie cudzysłowów, nagłówek z kluczy pierwszego wiersza), z testem jednostkowym `analityka.csv.test.ts`.
- Krok 2 — dziesięć zapytań eksportu w `repos/analityka-eksport.ts`, każde zweryfikowane linia po linii wobec oryginału (`analytics_module.cjs:311-320`): kolumny, aliasy, `GROUP BY`/`HAVING`/`ORDER BY` i LIMIT dokładnie tam, gdzie ma go oryginał (6/10: `suppliers-lifecycle`, `prices-last`, `availability-products`, `sell-through`, `margins`, `rotation-inactive`; BEZ limitu: `suppliers-stability`, `suppliers-stock`, `ean-comparison`, `unique`) — zgodne z pułapką #1 z planu.
- Krok 3 — trasa `GET /api/analytics/export/:view` w `routes/analytics.ts`, nieznany `{view}` → 200 i sam BOM (nie 404), `try/catch → 500 {error}` zachowane.
- Krok 4 — dowód autoryzacji samym cookie (`analityka.eksport.gate.test.ts`, prawdziwy serwer, `Cookie` bez `Authorization` → 200; podrobione cookie → 401; atrybuty `HttpOnly`/`Path=/`/`SameSite=Lax` sprawdzone).
- Krok 5 — przycisk „CSV" (`pages/analityka/eksport.tsx`, nawigacja `window.location.href`, bez `fetch`) wpięty we wszystkich dziesięciu kartach z mapowaniem `{view}` zweryfikowanym wobec `frontend-index.js:28065`…`:28573` — zgodne co do joty.
- Krok 6 — Pulpit `/` (`Pulpit.tsx`, `pulpit/{api,kpi,czas,KafelKpi}.ts(x)`) zweryfikowany linia po linii wobec `N2` (`:16836-17090`): cztery kafle w tej samej kolejności, te same `href`, te same progi trendu, limit 5 alertów, sortowanie poziom→data malejąco, `o.length > 0` na karcie powiadomień, dziewięć kolumn tabeli dostawców, sortowanie po liczbie w kodzie, teksty PL verbatim.
- Krok 7 — testy: `analityka.csv.test.ts`, `analityka.eksport.agregaty.test.ts` (seed realnie gwarantuje niepuste wyniki tam, gdzie trzeba — sprawdzone, `test #13` z checklisty nie budzi zastrzeżeń), `analityka.eksport.gate.test.ts`, `pulpit.kpi.test.ts`, `pulpit.test.tsx`, `analityka.eksport.test.tsx`; `test/msw/pulpit.ts` jako wspólny fallback dla `shell.test.tsx`/`logowanie.test.tsx`, bez osłabiania ich asercji.
- GATE: `sprawdzZgodnoscZKontraktemNieJson` dodana jako nowa, osobna funkcja — nie zmienia `sprawdzZgodnoscZKontraktem` ani `gate/kontrakt.ts`; potwierdzone diffem, że wspólna maszyneria jest nietknięta.
- Decyzje D1–D5: D1 (alerty z `/api/alerts`) udokumentowana w kodzie (`Pulpit.tsx`, `pulpit/kpi.ts`) i w tabeli odstępstw O-10f-1; D2 (port kafli `Si()`, nie `NaglowekKpi`) zaimplementowana i skomentowana; D3 (kafel eksportu trwale martwy) zamrożona testem i skomentowana; D4 (wszystkie 10 przycisków, w tym dwa oddające pusty plik) zrealizowana; D5 (brak UI dla `bootstrap-current`) zachowana.
- Trzy odstępstwa od planu opisane w `raport.md` (AppShell w Pulpicie, zmiany w `shell.test.tsx`/`logowanie.test.tsx`/`analityka.ean.test.tsx`, `sformatujWzglednie` jako nowy port zamiast reużycia) — wszystkie zweryfikowane w kodzie i nie osłabiają istniejących testów; `analityka.ean.test.tsx` dostał silniejszą asercję (liczy przyciski i sprawdza `data-testid`), nie słabszą.

### Missing or deviating ✗
- Krok 8 (Dokumentacja) — **nie zrealizowany**. Zero zmian w `docs/rebuild-roadmap.md`, `docs/rebuild-backlog.md`, `docs/analityka-bloki-10b-10f.md`, `pages/analityka/README.md`. Patrz BLOCKER wyżej.

### Definition of done
- [x] `GET /api/analytics/export/{view}` obsługuje wszystkie dziesięć widoków, każdy z własnym SQL-em, z LIMIT-ami dokładnie tam, gdzie ma je oryginał.
- [x] Format CSV zgodny z `toCsv`/`csvEscape`.
- [x] Nieznany `{view}` → 200 i sam BOM.
- [x] `export/availability-products` i `export/sell-through` oddają sam BOM mimo danych w `historia_cen` — zamrożone testem.
- [x] Eksport działa na samym cookie, bez `Authorization` — dowiedzione integracyjnie.
- [x] Przyciski „CSV" w dziesięciu kartach `/analityka`, jako nawigacja przeglądarki.
- [x] Pulpit `/` renderuje cztery kafle, kartę powiadomień i tabelę dostawców — zgodnie z oryginałem.
- [x] Pusty `GET /api/history` (`[]`) nie jest traktowany jak błąd.
- [x] `/` zdjęte z `placeholdery.ts`, wpięte w `App.tsx`, liczba tras routera nadal 12.
- [x] `npm run lint`, `typecheck`, `build`, `test` czyste w obu katalogach — potwierdzone uruchomieniem: backend 847/847, frontend 504/504, wszystkie cztery bramki zielone w obu.
- [ ] Roadmapa: blok 10f i cała Iteracja 10 oznaczone ✅ w §4 i §5; backlog zaktualizowany — **NIE zrobione**.

## Parallel-test concerns

None — wszystkie nowe testy backendu korzystają ze wspólnego harnessu `stworzSrodowiskoTestowe()` (baza w katalogu tymczasowym, port efemeryczny), a testy frontendu działają na MSW/jsdom bez zasobów współdzielonych. Brak twardo zakodowanych portów czy ścieżek.

## Overall assessment

Merytorycznie blok jest wykonany bardzo starannie — dziesięć zapytań eksportu, format CSV, zachowanie dla nieznanego `{view}`, autoryzacja przez cookie i cała odbudowa Pulpitu zweryfikowane linia po linii wobec oryginału i zgodne co do joty, łącznie z nieoczywistymi pułapkami (brak LIMIT-u w czterech z dziesięciu widoków, dwa trwale puste eksporty, martwy kafel D3). Testy są realne, nie „na sucho" — zasiew w `analityka.eksport.agregaty.test.ts` jawnie gwarantuje niepuste wyniki tam, gdzie trzeba. Cztery bramki (`lint`/`typecheck`/`build`/`test`) są zielone w obu katalogach, potwierdzone uruchomieniem. Jedyny, ale realny problem to całkowity brak aktualizacji dokumentacji projektu (roadmapa, backlog, ściąga bloków, README sekcji) — Krok 8 planu i jeden punkt Definition of done zostały pominięte, mimo że `raport.md` nie zgłasza tego jako odstępstwa. To wprost narusza obowiązek 1 z `CLAUDE.md` i wymaga uzupełnienia przed merge'em.
