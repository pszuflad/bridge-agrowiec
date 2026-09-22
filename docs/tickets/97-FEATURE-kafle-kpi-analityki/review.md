# 97-FEATURE-kafle-kpi-analityki — Code review

> Reviewed: 2026-09-22
> Branch: `feature/97-kafle-kpi-analityki`
> Diff: 8 plików (352 dodane / 72 usunięte), 4 commity

## BLOCKER

- [ ] `docs/karty/PR.2/karta.md` — karta nie opisuje STANU po zamknięciu ticketu.
  - Reason: Plan (`plan.md` DoD #5) wymaga „`karta.md` PR.2 z opisem stanu, wejścia dla PR.6
    i P10.4, PR do `develop`”. Karta wciąż ma `Stan: ⬜ gotowe (po P10.1)` (forma zamiaru, nie
    wykonania), a sekcje „Dowiezione” i „Do koordynatora” są puste (`—`). To dokładnie sytuacja,
    przed którą ostrzega `CLAUDE.md` (zasada 1: „karta.md opisuje STAN, nie zamiar”) i zasada 2
    (ustalenia dla przyszłej karty idą do jej `wejscie-<N>.md`, nie do `raport.md` bieżącego
    ticketu). Bez tego następna sesja (koordynator, PR.6, P10.4) nie ma skąd wziąć tych faktów —
    `raport.md` tego ticketu nikt poza tą sesją nie czyta.
  - Suggestion: zaktualizować `karta.md` (`Stan: ✅ 2026-09-22, ticket 97`, wypełnić
    „Dowiezione”) i dopisać `docs/karty/PR.6/wejscie-97.md` oraz `docs/karty/P10.4/wejscie-97.md`
    z treścią, która dziś jest tylko w sekcji „Follow-up” `raport.md` (komentarz
    `pages/pulpit/KafelKpi.tsx:8` o żywym O-10a-1 i nieaktualny opis kafli w
    `docs/instrukcja-testow-I10.md:171,472`) — obie te notatki dotyczą kart innych niż PR.2 i
    zgodnie z zasadą 2 CLAUDE.md powinny trafić do plików docelowych kart, nie zostać w
    `raport.md`.

## SHOULD-FIX

- [ ] `docs/tickets/97-FEATURE-kafle-kpi-analityki/plan.md:78-81` — cztery pozycje „Definition of
  done” zostały nieodhaczone (`- [ ]`), mimo że raport i kod potwierdzają ich spełnienie.
  - Reason: konwencja w innych zamkniętych kartach (np. `90-FEATURE-*`, `92-CHORE-*`) każe
    odznaczać `[x]` po dostarczeniu — niespójność utrudnia następnej sesji szybkie potwierdzenie,
    co faktycznie zrobiono.
  - Suggestion: odhaczyć 4 punkty w `plan.md`, skoro treściowo są spełnione (patrz „Definition of
    done” niżej w tym review).

## NICE-TO-HAVE

- [ ] `rebuild/frontend/test/analityka.test.tsx:236` — linia testu ma ~111 znaków (widoczna
  przewaga nad przyjętą szerokością ~100 dla reszty repo); kosmetyczne, lint tego nie łapie.
- [ ] `docs/tickets/97-FEATURE-kafle-kpi-analityki/raport.md:38-41` — sekcja „Follow-up” dubluje
  treść z `plan.md` „Poza zakresem” niemal 1:1; do rozważenia, czy po dopisaniu `wejscie-97.md`
  (patrz BLOCKER) nie warto tu zostawić tylko odnośnika zamiast pełnego powtórzenia.

## Plan compliance

### Done ✓
- `NaglowekKpi.tsx`: cztery kafle 1:1 z oryginałem (`zM()`, `:27980-28030`) — etykiety, kolejność
  (Dostawcy / EAN wspólne / Pozycje unikalne / Snapshoty), klasy (`border rounded p-3`,
  `text-muted-foreground text-xs`, `text-xl font-mono font-semibold`), liczby surowe (`String`,
  bez `toLocaleString`) — zweryfikowane linia po linii wobec deminifikatu.
- Semantyka pustych stanów D3/D4 zaimplementowana wiernie, także asymetria „—”/„0” między
  kaflem „Dostawcy” a kaflami EAN, i osobne traktowanie `undefined` vs `null` vs `{}` bez
  `rows` — sprawdzone ręcznie na wszystkich kombinacjach z `wartosciKafli()` i pokryte testem
  jednostkowym (`test/analityka.naglowek-kpi.test.ts`).
- `Analityka.tsx`: `useKpi()` usunięty, nagłówek dostaje `porownanieEan.data`/`unikalneEan.data`
  przez współdzielony `queryKey` z zakładką EAN — brak drugiego zapytania (potwierdzone testem
  liczącym wywołania MSW: `filters:1, status:1, ean/comparison:1, ean/unique:1`, bez klucza
  `kpi`).
- `api.ts`, `README.md`: `useKpi` usunięty, typ `Kpi` zachowany (używa go loader fixture), wpis
  O-10a-1 oznaczony jako zamknięty.
- Backend i `contract/` nietknięte (`git diff origin/develop -- rebuild/backend contract` pusty —
  zweryfikowane).
- Pliki zakazane (`eksport.tsx`, `Sekcja*.tsx`, `TabelaAnalityki.tsx`, Pulpit, backend, `contract/`,
  roadmapa, `docs/przeglad-12-widokow.md`, `docs/instrukcja-testow-I10.md`) — nietknięte.
- Testy: treść (etykiety, kolejność, różne liczby na kafel, brak `/kpi`, dokładnie jedno wywołanie
  każdej z czterech tras również po przejściu na zakładkę EAN) — bez śladu pułapki MSW z
  `onUnhandledRequest: "error"` (asercje na treść są, nie tylko na brak błędu).
- Bramki: `npm run lint` ✓, `npm run typecheck` ✓, `npm run build` ✓, `npx vitest run` — 53 pliki /
  911 testów ✓ (odtworzone lokalnie, zgadza się z raportem).

### Missing or deviating ✗
- `docs/karty/PR.2/karta.md` i wejścia dla `PR.6`/`P10.4` — patrz BLOCKER wyżej. To jedyny punkt
  planu (krok „Definition of done” #5), który nie został wykonany.

### Definition of done
- [x] Cztery kafle z etykietami i kolejnością oryginału, liczby z fixtures.
- [x] Puste stany wg D3/D4.
- [x] `/api/analytics/kpi` nie jest wołane z `/analityka`, każda z czterech tras dokładnie raz.
- [x] Bramki FE zielone, backend i contract bez zmian.
- [ ] `karta.md` PR.2 z opisem stanu, wejścia dla PR.6 i P10.4, PR do `develop` — karta i wejścia
      nie zostały napisane (patrz BLOCKER); PR do develop nie do zweryfikowania z worktree.

## Parallel-test concerns

None — wszystkie nowe/zmienione testy używają MSW z lokalnym `server.use()` i nie dotykają
współdzielonych zasobów (bazy, portów, plików tymczasowych).

## Overall assessment

Implementacja kodu jest bardzo solidna: wartości i puste stany czterech kafli zweryfikowane
linia po linii wobec `deminified/frontend-index.js:27980-28030` i wiernie odtwarzają asymetrię
oryginału (w tym subtelne rozróżnienie `undefined`/`null`/obiekt-bez-`rows`), testy asertują
treść, nie tylko brak błędu, i jawnie sprawdzają brak duplikatu zapytań. Jedyny realny problem to
strona procesowa: karta `PR.2` i wejścia dla kart, które mają przejąć follow-upy (`PR.6`, `P10.4`),
nie zostały napisane, mimo że plan i raport je zapowiadają — to prosta poprawka do zrobienia przed
mergem, nie wymaga zmian w kodzie produkcyjnym.
