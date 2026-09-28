# 96-FEATURE-kafel-ostatni-eksport — Code review

> Reviewed: 2026-09-22
> Branch: feature/96-kafel-ostatni-eksport
> Diff: 8 plików (6 kodu/testów + plan.md + raport.md), 2 commity

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `docs/rebuild-backlog.md` #34, `docs/karty/P10.2/karta.md`, `docs/karty/P10.4/` —
  Definition of done ticketu (plan.md, sekcja „Definition of done") wymaga oznaczenia karty
  P10.2 jako gotowej, aktualizacji pola „Status" wpisu #34 w backlogu oraz utworzenia
  `docs/karty/P10.4/wejscie-96.md` (delta instrukcji dla Ani — nowy tekst błędu „Nie udało się
  pobrać historii" jest zmianą widoczną dla testerki, więc P10.4 musi o niej wiedzieć). W obecnym
  diffie żaden z tych trzech plików się nie zmienił — dwa commity to tylko kod + raport.md.
  - Reason: to jawnie niezaznaczone pola w DoD z plan.md; projekt kładzie duży nacisk na
    bieżącą aktualizację kart/roadmapy (CLAUDE.md, sekcja o kartach) — inaczej P10.4 i
    koordynator falowy nie dowiedzą się o zamknięciu P10.2 i o nowym tekście do przetestowania.
  - Suggestion: dopisać commit domykający kartę (na wzór `90-FEATURE-…: sync docs` z ticketu 90)
    przed mergem albo świadomie przesunąć to na osobny krok i odnotować to w raporcie.

- [ ] `rebuild/backend/src/routes/history.ts:47-48` (komentarz nad `GET /api/history`) —
  „Wołają ją Pulpit (I10) i optymistyczny cache edycji katalogu" jest już nieprawdziwe: Pulpit od
  tego ticketu nie woła gołego `GET /api/history` (usunięty `useDziennikZmian`).
  - Reason: zasada projektu „zgodność komentarzy z kodem" — czytelnik commentarza w backendzie
    dostanie fałszywą informację o konsumentach trasy; backend jest formalnie poza zakresem
    ticketu, ale komentarz stał się nieaktualny w wyniku tej zmiany.
  - Suggestion: krótka poprawka komentarza (osobny mały commit/follow-up), np. „Woła ją tylko
    optymistyczny cache edycji katalogu (jeszcze niesportowany); Pulpit od #34/ticketu 96 czyta
    `/api/history/paged`".

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/pulpit/kpi.ts:150-158` (`opisKafelkaEksportu`) — gdy zapytanie o
  eksport kończy się błędem, funkcja zwraca `PODPIS_BLEDU_HISTORII` natychmiast, nawet jeśli
  zapytanie o import w tym samym momencie ma poprawne dane (nie sprawdza `imp` w ogóle). Zachowanie
  jest przetestowane i udokumentowane w komentarzu nad funkcją („Błąd zapytania o import liczy się
  dopiero…"), ale explicite nie opisuje tego dla odwrotnego przypadku (błąd eksportu + istniejący
  import) — jedno zdanie więcej w komentarzu ułatwiłoby to przyszłemu czytelnikowi bez sięgania do
  testu `pulpit.kpi.test.ts`.
- [ ] `docs/tickets/96-FEATURE-kafel-ostatni-eksport/raport.md:62-63` — nota o osieroconym
  `dziennikZmianZFixtura()` w `test/msw/kontrakt.ts` to dobry trop na przyszłość; warto przenieść
  ją do `docs/karty/P10.2/karta.md` (`## Do koordynatora`), żeby nie zginęła w archiwum raportu
  ticketu (patrz też SHOULD-FIX wyżej o niezaktualizowanej karcie).

## Plan compliance

### Done ✓
- `pages/pulpit/api.ts`: usunięte `WpisDziennikaZmian`/`useDziennikZmian`, dodane
  `useOstatniWpisHistorii(typ)` z `adresStrony()` i `refetchOnMount: "always"` — zgodnie z
  krokiem 1 planu.
- `pages/pulpit/kpi.ts`: `znajdzPoTypie` zastąpione czystą, testowalną `opisKafelkaEksportu`
  + `PODPIS_BLEDU_HISTORII` — krok 2.
- `pages/Pulpit.tsx`: dwa zapytania podpięte, nagłówek pliku przepisany na sekcję odstępstwa —
  krok 3.
- Testy: `pulpit.kpi.test.ts` (8 przypadków z jednostkowym pokryciem wszystkich gałęzi),
  `pulpit.test.tsx` (asercje na treść, handler `/paged` z walidacją parametrów, test braku
  wywołania `/api/history`, test `refetchOnMount`), `msw/pulpit.ts` zaktualizowany — krok 4.
- Bramki FE (lint/typecheck/build/test — 52 pliki/914 testów) zielone — zweryfikowane ponownie w
  tym review, zgadza się z raportem; krok 5.
- Teksty, format daty, kolejność gałęzi podpisu, `testId`, `href`, quirk ZIP „wszyscy" —
  zweryfikowane 1:1 z oryginałem (`deminified/frontend-index.js:16852`, `:16902-16917`).
- Parametry zapytania (`adresStrony`, `limit=1`, `page=1`, sortowanie malejąco po `kiedy` w
  `historia/mapowanie.ts`) zweryfikowane w backendzie — zgodne z opisem w plan.md.

### Missing or deviating ✗
- DoD: aktualizacja karty P10.2, statusu backlog #34 i `docs/karty/P10.4/wejscie-96.md` — patrz
  SHOULD-FIX wyżej.

## Definition of done

- [x] Kafel pokazuje datę względną ostatniego eksportu i „<dostawca|wszyscy> — N produktów".
- [x] Bez eksportu, z importem → „—" + „Ostatni import: <data>"; bez obu → „Brak eksportów ani importów".
- [x] Błąd zapytania → „Nie udało się pobrać historii", reszta Pulpitu działa.
- [x] Pulpit nie woła `GET /api/history`; `handleryPulpitu()` ma `/api/history/paged`.
- [x] lint, typecheck, build, test FE zielone; testy BE zielone (backend nietknięty, gate BE N/D
      zgodnie z uzasadnieniem w raport.md); `contract/` i backend nietknięte.
- [ ] karta P10.2 ✅, backlog #34 Status, `docs/karty/P10.4/wejscie-96.md` — nie w diffie (patrz
      SHOULD-FIX).

## Parallel-test concerns

None — wszystkie testy używają lokalnego MSW/renderu, bez współdzielonych zasobów (portów, plików
tymczasowych, wspólnej bazy). `pulpit.test.tsx` rejestruje/odrejestrowuje listener
`server.events` lokalnie w obrębie pojedynczego testu.

## Overall assessment

Implementacja jest staranna i dobrze udokumentowana: logika kafla przeniesiona do czystej,
w pełni przetestowanej funkcji, testy integracyjne sprawdzają treść (nie tylko obecność
elementu) i aktywnie pilnują kształtu zapytania (400 przy złym adresie zamiast cichego
przejścia — dokładnie pułapka z CLAUDE.md o MSW). Weryfikacja 1:1 z oryginałem (teksty, format
daty, kolejność gałęzi, quirk ZIP) się zgadza, a parametry zapytania do backendu są poprawne.
Jedyny realny brak to niedokończone administracyjne zamknięcie karty/backlogu/instrukcji dla
Ani wymagane przez Definition of done — nie wpływa na poprawność kodu, ale powinno zostać
uzupełnione przed mergem zgodnie z konwencją projektu.
