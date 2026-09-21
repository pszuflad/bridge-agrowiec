# 77-FEATURE-pseudo-alerty-katalogowe — Code review

> Reviewed: 2026-09-21
> Branch: `feature/77-pseudo-alerty-katalogowe`
> Diff: 22 pliki, 8 commitów (`b9fd680`…`c5ad318`; commit `1d3a8e5` to merge z `origin/develop`, nie
> zawiera zmian tego ticketu)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:3047`, `docs/rebuild-roadmap.md:3181`, `docs/rebuild-backlog.md:1869`
  — roadmapa i backlog NIE zostały zaktualizowane, mimo że raport.md twierdzi inaczej.
  - Reason: to jawny punkt Definition of done z `plan.md:220` ("Roadmapa (podblok P6.2, nota
    o 008 w PR.3), backlog #26 (Status) zaktualizowane"). Zweryfikowane bezpośrednio: `git diff
    origin/develop...HEAD -- docs/rebuild-roadmap.md docs/rebuild-backlog.md` jest PUSTY — żaden
    z tych plików nie został tknięty. Roadmapa nadal pokazuje `P6.2` jako
    „⬜ gotowe — P6.1 zmergowana, można startować" (linia 3047) zamiast stanu „zrobione", a blok
    `PR.3` (linia 3181) nie ma żadnej noty o tym, że migracja `007` jest zajęta i PR.3 musi wziąć
    `008`. Backlog `#26` (linia 1869) nadal mówi „Pseudo-alerty katalogowe … nadal P6.2, nie
    zaczęte" — czyli opisuje ZAMIAR, nie stan, wbrew regule #1 z `CLAUDE.md`. Co gorsza,
    `raport.md:175-176` twierdzi wprost „Nota wpisana do bloku PR.3 w roadmapie" — to nieprawda,
    noty nie ma nigdzie w repo. To dokładnie ryzyko, przed którym ostrzega `CLAUDE.md` (reguła 2:
    „Ustalenie dotyczące PRZYSZŁEGO bloku wpisz DO TEGO BLOKU") — bez tej noty sesja realizująca
    PR.3 może nieświadomie użyć numeru `007`, który już zajęła ta karta, i skolidować migracje.
  - Suggestion: dopisać do roadmapy stan „✅ zrobione (77-FEATURE…, 2026-09-21)" dla P6.2, notę
    o migracji `008` w bloku PR.3, i zaktualizować status wpisu `#26` w backlogu na „zrobione" (z
    odsyłaczem do tego ticketu). To czysto dokumentacyjna poprawka, nie wymaga zmian w kodzie.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/Pulpit.tsx:139-141` — gdy `useAlertyKatalogu()` zwróci
  `blad: true` (np. `GET /api/alerty-katalogu/statusy` padnie), Pulpit po cichu pokazuje zero
  alertów katalogowych zamiast jakiegokolwiek sygnału błędu — `alertyKatalogu` zostaje `null`
  na stałe, `aktywneKatalog` liczy `[]`, kafel i karta wyglądają jak „brak alertów".
  - Reason: to nie fałszuje danych importu (te mają swój, oddzielny React Query błąd
    niewyłapywany tu wcale), ale cichy fallback do „zero" na kaflu KPI jest myląco podobny do
    stanu „katalog jest czysty" — checklist reviewu wprost prosi o obsługę „co gdy statusy
    padną". `ListaAlertowKatalogu.tsx` ma jawny komunikat błędu, Pulpit — nie.
  - Suggestion: nie blokująco — np. mały wskaźnik „nie udało się policzyć alertów katalogu"
    obok kafla, albo świadomie udokumentowana decyzja, że Pulpit celowo degraduje po cichu.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/routes/alerty-katalogu.ts:MAKS_ID_W_ZADANIU` — limit paczki `20 000`
  nie ma testu granicznego (gate test pokrywa 9 przypadków 400, ale nie `ids.length > 20000`).
  Drobna luka w pokryciu, niski priorytet — limit i tak jest tylko siatką bezpieczeństwa.
- [ ] `rebuild/schema/README.md` — nadal wymienia migracje do `006` (raport świadomie odkłada to
  do „synchronizacji dokumentacji"); warto zrobić przy najbliższej okazji, żeby nie kumulować
  długu wraz z `008` z PR.3.

## Plan compliance

### Done ✓
- Migracja `007_alerty_katalogu_statusy.sql` + model Drizzle + repo z wypieraniem i sierotkami —
  zweryfikowane w kodzie i w 35-testowym `alerty-katalogu.gate.test.ts` (wszystkie zielone).
- `rozbierzIdAlertu` poprawnie rozpoznaje wszystkie 4 formy `id`, w tym przypadki brzegowe z
  zadania: myślnik w kodzie dostawcy (`dostawca-A-B-brak-importu-30`), nazwa z `|`, polskimi
  znakami i nową linią (`LINIA1\nLINIA2`).
- `GET`/`PUT /api/alerty-katalogu/statusy` z pełną walidacją, `requireAuth`, bez `audit_log`
  (zgodnie z D4 z I6), jawna projekcja w `listStatusyKatalogu` (zgodnie z pułapką Drizzle z
  `CLAUDE.md`).
- Kontrakt: ścieżka dopisana ręcznie POZA generowanym blokiem; `node
  tools/generate-openapi-schemas.cjs --sprawdz` przechodzi (zweryfikowane bezpośrednio);
  `test/alerty-katalogu.gate.test.ts` czyta schemat z `openapi.yaml` i sprawdza ciało.
- Silnik `silnik-katalogu.ts` porównany TOKEN W TOKEN z `h2`/`y2`/`g2`/`x2`/`v2`/`w2`/`pv` w
  `git show origin/main:mirror/frontend/assets/index-PRICEFMT1783512500.js` (offsety 313291–318200
  w bundlu) — słowniki, regexy, kolejność gałęzi klasyfikatora, progi `7`/`30`, wykluczenie
  `MO7`/`MO8`, budowa `id` z odciskiem, sortowanie i `if(false)` reguły są identyczne. Jedyna
  różnica to udokumentowana optymalizacja (regexy budowane raz zamiast w pętli) i parametr
  `teraz` do testów — oba bez wpływu na wynik.
- `N2()`/`HT()` oryginału porównane analogicznie: domyślny filtr statusu w `HT()` faktycznie
  chowa `rozwiazany` (mimo etykiety „Wszystkie statusy") — plan poprawnie to uchwycił jako Q3 i
  świadomie odstąpił (opcja „Wszystkie" w porcie POKAZUJE rozwiązane, zgodnie z decyzją).
  Oryginalny `N2()` liczy kafel WYŁĄCZNIE z pseudo-alertów katalogowych (żadnego `/api/alerts`) —
  zweryfikowane bezpośrednio w bundlu — więc scalenie dwóch źródeł na Pulpicie jest w pełni
  świadomym, zatwierdzonym odstępstwem (decyzja 3), nie pomyłką.
- Zakładki „Import"/„Katalog" w adresie (`?zakladka=katalog`), domyślna „Import", link z Pulpitu
  trafia we właściwą zakładkę.
- „Zaakceptuj wszystko" działa na WIDOCZNYCH po filtrach alertach, jednym PUT, bez pytania —
  zgodnie z `button-accept-all-alerts` oryginału.
- Pulpit: kafel sumuje `nowy` z obu źródeł, karta ma dwie sekcje (znikające niezależnie),
  odświeżenie przez `invalidateQueries` zamiast `window.dispatchEvent` — pokryte testami (blok 6
  w `pulpit.test.tsx`).
- Pliki własności P6.1 (`TabelaAlertow.tsx`, `grupowanie.ts`, `repos/alerts.ts`,
  `statusy.ts`, `PrzyciskiStatusu.tsx`) — potwierdzone brakiem zmian (`git diff --stat` pusty);
  P6.2 wyłącznie importuje.
- Bramki BE i FE zielone — zweryfikowane bezpośrednio: backend lint/typecheck/test (1437/1437),
  frontend lint/typecheck/`npx vitest run` (874/874), zgodne z liczbami w raporcie.

### Missing or deviating ✗
- Roadmapa i backlog NIE zaktualizowane — patrz BLOCKER wyżej. To jedyny realnie brakujący
  element planu; cała reszta „Planu implementacji" (kroki 1–9) jest dowieziona.
- Limit paczki `id` w PUT to `20 000`, nie `10 000` z planu — udokumentowane w raporcie jako
  świadoma zmiana z uzasadnieniem (2× teoretyczny sufit katalogu), nie flaguję jako defekt.

### Definition of done
- [x] Migracja 007 + tabela + model; trasa GET/PUT z walidacją, wypieraniem i sierotkami.
- [x] `openapi.yaml` opisuje trasę; `--sprawdz` i `kontrakt.spojnosc` zielone.
- [x] Silnik 1:1 z `origin/main` (4 reguły, h2 bez `tr-`, MO7/MO8, odciski).
- [x] Zakładki „Import"/„Katalog", filtry jak P6.1, „Zaakceptuj wszystko", wspólne przyciski.
- [x] Pulpit: kafel sumuje oba źródła, karta z dwiema sekcjami, odświeżenie po zmianie statusu.
- [x] Testy reguł z progami, MO7/MO8, odciskiem, BKT TR-135.
- [x] Pomiar czasu liczenia na snapshocie w raporcie.
- [x] Bramki BE i FE zielone.
- [ ] Roadmapa (podblok P6.2, nota o 008 w PR.3), backlog #26 (Status) zaktualizowane — NIE
      zrobione, mimo przeciwnego twierdzenia w `raport.md`.

## Parallel-test concerns

None — wszystkie nowe testy (backend `alerty-katalogu.gate.test.ts` na tymczasowej bazie z
`test/gate`, frontend `alerty.silnik-katalogu.test.ts`/`alerty.katalog.test.tsx`/`pulpit.test.tsx`
na MSW + in-memory `queryClient`) nie trzymają się stałych portów ani współdzielonych plików.

## Overall assessment

Implementacja jest bardzo solidna technicznie: silnik pseudo-alertów jest zweryfikowany token
w token wobec żywego bundla `origin/main` (nie tylko zaufano opisowi w planie), backend ma
kompletną walidację, transakcyjne wypieranie/sierotki i 35 testów GATE, a frontend wiernie
odtwarza filtr statusu, „Zaakceptuj wszystko" i podział Pulpitu na dwa źródła z jawnie
udokumentowanymi, zatwierdzonymi odstępstwami. Jedyny realny problem to rozjazd między tym, co
`raport.md` deklaruje („nota wpisana do bloku PR.3 w roadmapie"), a stanem faktycznym repo —
roadmapa i backlog zostały nietknięte, co jest dokładnie tą kategorią błędu, przed którą
`CLAUDE.md` ostrzega w regułach 1–2. To do naprawienia przed zamknięciem karty, ale nie wymaga
zmian w kodzie.
