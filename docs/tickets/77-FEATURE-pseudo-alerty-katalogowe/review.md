# 77-FEATURE-pseudo-alerty-katalogowe — Code review

## Review nr 1 (2026-09-21, `b9fd680`…`c5ad318`) — skrót i status poprawek

> Pełna treść: historia gita (`git show <commit>:docs/tickets/77-FEATURE-pseudo-alerty-katalogowe/review.md`
> na commicie `c5ad318`). Poniżej tylko skrót i rozliczenie.

- **BLOCKER — roadmapa/backlog niezaktualizowane, wbrew Definition of done i wbrew twierdzeniu
  raportu.** → **✅ ROZWIĄZANE w `c493748`** (sync docs). Zweryfikowane bezpośrednio: `P6.2` w
  roadmapie ma stan „✅ 2026-09-21 (77)”, blok `PR.3` ma notę „migracja `007` zajęta przez P6.2,
  PR.3 bierze `008`”, backlog `#26` ma nagłówek „✅ ZROBIONE 2026-09-21” i nowy blok „CO DOWIOZŁA
  KARTA P6.2”. Treść zweryfikowana pod kątem prawdziwości względem kodu (patrz Review nr 2 niżej)
  — nie tylko obecności wpisu.
- **SHOULD-FIX — Pulpit milczy przy błędzie statusów katalogu.** → **✅ ROZWIĄZANE w `0b358e2`**.
  `SekcjaPowiadomien` dostała prop `blad`; gdy `useAlertyKatalogu()` zwraca `blad: true`, sekcja
  „Katalog” renderuje komunikat „Nie udało się policzyć alertów katalogu.” (`role="alert"`)
  zamiast cicho pokazywać zero. Kryta testem `pulpit.test.tsx` (blok 6.6a, `0b358e2`).
- **NICE-TO-HAVE — brak testu limitu 20 000.** → **✅ ROZWIĄZANE w `0b358e2`** — dodane dwa testy
  GATE: `20 001` → 400, dokładnie `20 000` → 200 (z weryfikacją wypierania do jednego wiersza).
- **NICE-TO-HAVE — `rebuild/schema/README.md` do `006`.** → **✅ ROZWIĄZANE w `c493748`** — wiersz
  `007` dopisany do tabeli migracji + akapit-wyjątek „numer = chronologia produkcji”.

Wszystkie cztery punkty z review nr 1 rozliczone, bez pozostałości.

---

## Review nr 2

> Reviewed: 2026-09-21
> Branch: `feature/77-pseudo-alerty-katalogowe`
> Diff: 32 pliki, 11 commitów (`b9fd680`…`c493748`; `1d3a8e5` to merge z `origin/develop`, bez
> zmian tego ticketu)
> Zakres tej weryfikacji: commity `0b358e2` (poprawki kodu/testów) i `c493748` (sync docs), plus
> ponowna weryfikacja bramek na całości diffu.

### BLOCKER

Brak.

### SHOULD-FIX

Brak.

### NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/Pulpit.tsx:206-213` — kafel KPI „Aktywne alerty” nie ma
  żadnego sygnału błędu, gdy `bladKatalogu` jest `true` — liczba po prostu nie zawiera alertów
  katalogowych, bez adnotacji. Komunikat błędu jest tylko w karcie „Najnowsze powiadomienia”
  (sekcja „Katalog”), która się renderuje tylko gdy jest coś do pokazania. To nie jest regresja
  względem review nr 1 (ten wprost prosił o sygnał na karcie, nie na kaflu, i to zostało
  dowiezione) ani odstępstwo od reszty strony — pozostałe trzy kafle KPI (`produkty`, `staging`,
  `dostawcy`) też nie mają obsługi `isError`, więc kafel katalogowy jest tu spójny z konwencją
  całego Pulpitu. Zostawiam jako drobną notatkę na przyszłość, nie jako defekt tej karty.

### Weryfikacja prawdziwości dokumentacji (`c493748`)

Sprawdzone punkt po punkcie względem kodu, nie tylko obecność wpisu:

- **`docs/rebuild-roadmap.md`** — blok Iteracja 6 (P6.2 „✅ zrobione”, delta dla P6.3 poprawnie
  umieszczona W BLOKU Iteracja 6, czyli tam gdzie P6.3 realnie żyje — zgodnie z regułą 2
  `CLAUDE.md`, nie w P6.2), blok PR.3 z notą o `008` — poprawnie w bloku PR.3, nie w P6.2 (reguła
  2). Historyczne D1–D4/follow-upy z I6/I10f/I13e dostały adnotacje „nieaktualne od P6.2” z
  zachowaniem oryginalnego zapisu — zgodnie z regułą 1 (stan, nie zamiana treści).
- **`docs/rebuild-backlog.md` #26** — status „✅ zrobione”, blok „CO DOWIOZŁA KARTA P6.2” zgodny
  z kodem (migracja `007`, wypieranie+sierotki, filtr jak P6.1, Pulpit, pomiar). **#61** —
  zaktualizowany wiersz „Do nowej wersji?”/„Status” z odsyłaczem do P6.2; nazwa reguły
  (`tr_fix`/`ackalerts` pkt 1–3 „sportowane”) zgodna z realnym stanem `silnik-katalogu.ts`
  (potwierdzone w review nr 1 token-w-token wobec bundla).
- **`docs/spec-frontend.md`/`docs/spec-backend.md`** — opisy nowej trasy i zakładki zgodne z
  kodem (`routes/alerty-katalogu.ts`, `katalog-api.ts`, `ListaAlertowKatalogu.tsx`).
- **`rebuild/schema/README.md`** — wiersz `007` zgodny z treścią migracji i z testem
  `db.migracje.test.ts` (27 tabel / 14 indeksów, zweryfikowane uruchomieniem testu).
- **`contract/README.md`** — liczniki „97 ścieżek / 115 operacji” przeliczone bezpośrednio z
  `contract/openapi.yaml` (`yaml.safe_load` + zliczenie metod HTTP): **zgodne co do liczby**.
  Akapit o ręcznym schemacie inline dla `/api/alerty-katalogu/statusy` zgodny z realną strukturą
  pliku (blok „ODSTĘPSTWO OD PRODUKCJI — P6.2” poza generowanym `components.schemas`).
- **`docs/cutover.md`** — krok 5 z ostrzeżeniem, że `007` (w odróżnieniu od `004`–`006`) NIE jest
  no-opem i musi zostać zastosowana — zgodne z faktem, że produkcja nie ma tej tabeli.
- **`CLAUDE.md`** — nowy akapit o `onUnhandledRequest: "error"` w MSW: zweryfikowane bezpośrednio
  w `rebuild/frontend/test/setup.ts:63` (`server.listen({ onUnhandledRequest: "error" })`) —
  twierdzenie prawdziwe; nazwa `handleryPulpitu()` istnieje w `test/msw/pulpit.ts:17`.
- **`docs/przeglad-12-widokow.md`** — nota przy Pulpicie i sekcja „Alerty” (dwie zakładki, filtr
  poziomu z `info`) zgodne z kodem `Alerty.tsx`/`ListaAlertowKatalogu.tsx`.

Żadna z kontrolowanych sekcji nie wymyśla funkcji, których nie ma w kodzie; wszystkie
przywoływane nazwy (`klasyfikujOpone`, `policzAlertyKatalogu`, `handleryPulpitu`,
`alerty_katalogu_statusy`, `GET/PUT /api/alerty-katalogu/statusy`) istnieją i mają wskazane
zachowanie.

### Weryfikacja kodu poprawek pod kątem regresji

- `rebuild/frontend/src/pages/Pulpit.tsx` — jedyny zmieniony plik źródłowy od review nr 1
  (`git diff c5ad318..HEAD --stat -- rebuild/backend/src rebuild/frontend/src` pokazuje TYLKO
  ten plik, 14 wstawień/3 usunięcia). Zmiana jest lokalna do `SekcjaPowiadomien` i przekazania
  `bladKatalogu` — nie dotyka innych sekcji Pulpitu, nie zmienia sygnatur eksportowanych poza
  komponentem. `useAlertyKatalogu()` (pole `blad`) istniało od commitu `2f11f39`, poprawka tylko
  zaczęła je czytać — brak nowego ryzyka w hooku.
- `rebuild/backend/test/alerty-katalogu.gate.test.ts` — dwa nowe testy (20 001 → 400, 20 000 →
  200 z weryfikacją wypierania) używają tego samego wzorca co reszta pliku (tabela `casos`,
  `ustaw()`, `wiersze()`) — brak duplikacji nazw testów, brak zależności od kolejności.
- `rebuild/frontend/test/pulpit.test.tsx` — nowy test w bloku 6 używa istniejącego importu
  `within` (obecny w pliku od dawna) i istniejącego `server.use()` z `msw` — brak nowych zależności.
- Wszystkie nowe/zmienione testy działają na efemerycznych bazach/portach i MSW — bez konfliktu
  między równoległymi agentami.

### Bramki (uruchomione bezpośrednio w tej sesji)

- `node tools/generate-openapi-schemas.cjs --sprawdz` → **zielone** („aktualny wobec fixtures”).
- Backend: `npm run lint` ✓, `npm run typecheck` ✓, `npm test` → **1439/1439** (89 plików) — zgodne
  z liczbą w raporcie.
- Frontend: `npm run lint` ✓, `npm run typecheck` ✓, `npx vitest run` → **875/875** (51 plików) —
  zgodne z liczbą w raporcie.

### Plan compliance

#### Done ✓
- Wszystkie punkty Definition of done z `plan.md`, w tym ostatni („Roadmapa/backlog
  zaktualizowane”), są teraz spełnione — zweryfikowane bezpośrednio w `docs/rebuild-roadmap.md`
  i `docs/rebuild-backlog.md`.
- „Poza zakresem” z planu nie zostało naruszone: `docs/instrukcja-testow-I6.md`, pliki P6.1
  (`TabelaAlertow.tsx`, `grupowanie.ts`, `repos/alerts.ts`), `src/historia/**`,
  `routes/history.ts`, `routes/export-shoper.ts` — wszystkie bez zmian w diffie (zweryfikowane
  `git diff --stat`).

#### Missing or deviating ✗
Brak — pełna zgodność z planem, łącznie z udokumentowanym i uzasadnionym odstępstwem limitu
paczki (10 000 → 20 000, opisane w raporcie i w `spec-backend.md`).

### Definition of done

- [x] Migracja 007 + tabela + model; trasa GET/PUT z walidacją, wypieraniem i sierotkami.
- [x] `openapi.yaml` opisuje trasę; `--sprawdz` i `kontrakt.spojnosc` zielone.
- [x] Silnik 1:1 z `origin/main` (4 reguły, h2 bez `tr-`, MO7/MO8, odciski).
- [x] Zakładki „Import”/„Katalog”, filtry jak P6.1, „Zaakceptuj wszystko”, wspólne przyciski.
- [x] Pulpit: kafel sumuje oba źródła, karta z dwiema sekcjami, odświeżenie po zmianie statusu,
      sekcja „Katalog” sygnalizuje błąd zamiast cichego zera.
- [x] Testy reguł z progami, MO7/MO8, odciskiem, BKT TR-135.
- [x] Pomiar czasu liczenia na snapshocie w raporcie.
- [x] Bramki BE i FE zielone (zweryfikowane bezpośrednio w tej sesji).
- [x] Roadmapa (podblok P6.2, nota o 008 w PR.3), backlog #26 (Status) zaktualizowane —
      zweryfikowane bezpośrednio, treść prawdziwa względem kodu.

## Parallel-test concerns

None — wszystkie nowe/zmienione testy (backend `alerty-katalogu.gate.test.ts` na tymczasowej
bazie z `test/gate`, frontend `pulpit.test.tsx` na MSW + in-memory `queryClient`) nie trzymają
się stałych portów ani współdzielonych plików.

## Overall assessment

Karta jest gotowa do merge'a. Wszystkie cztery punkty z review nr 1 zostały rozwiązane rzeczowo
(nie tylko kosmetycznie): kod ma dodatkowy test graniczny i sygnalizację błędu na Pulpicie,
a dokumentacja (roadmapa, backlog, spec-frontend/backend, schema README, contract README,
cutover, CLAUDE.md, przegląd 12 widoków) faktycznie opisuje stan, nie zamiar — sprawdzone
bezpośrednio względem kodu (liczniki kontraktu przeliczone z `openapi.yaml`, nazwy funkcji i
plików zweryfikowane grepem, licznik tabel/indeksów zweryfikowany testem). Noty dla przyszłych
bloków (delta P6.3, migracja 008 w PR.3) trafiły do właściwych bloków, zgodnie z regułą 2
`CLAUDE.md`. Bramki zielone przy bezpośrednim uruchomieniu w tej sesji, liczby zgodne z
raportem. Jedyna uwaga to kosmetyczny NICE-TO-HAVE o kaflu KPI, niewymagający działania przed
merge'em.
