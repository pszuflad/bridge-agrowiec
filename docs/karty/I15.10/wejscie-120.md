# Wejście dla I15.10 od ticketu 120 (karta I15.2, resync parserów) · 2026-09-23

Rozbierałem `git diff origin/develop 88fa31c -- mirror/backend/extensions.cjs` (5 hunków, +34/−1).
**Jeden hunk dotyka bezpośrednio liczników nieobecności, czyli rdzenia Twojej karty.**

## Hunk 4 — drugi scheduler WYGASZONY (linie 839–842 na `88fa31c`)

```js
function startScheduler(app, ctx) {
  // One owner: the core D4 scheduler already polls all configured suppliers.
  // Running a second timer duplicated downloads and absence counters.
  console.log('[bridge_v6] Scheduler delegated to core D4');
  return;
  if (schedulerStarted) return;      // ← martwy kod od tego commita
  ...
```

Produkcja miała **DWA** schedulery odpytujące dostawców: rdzeniowy („core D4") i ten z `extensions.cjs`.
Efekt uboczny, który to naprawia, jest wprost w komentarzu: *duplicated downloads **and absence
counters***.

**Dlaczego to Twoja sprawa:** `nieobecnosc_pod_rzad` rośnie o 1 przy każdym imporcie, w którym pozycji
nie ma w cenniku, a po trzech nieobecnościach pod rząd katalog dostawcy jest wycofywany. Dwa schedulery
odpalające ten sam auto-pull podbijały ten licznik **dwa razy szybciej**, więc próg 3 był osiągany po
półtora cyklu, nie po trzech. Cokolwiek policzysz na danych produkcji sprzed tej łatki
(`abe5f14` i wcześniej) o wycofaniach i `product_auto_suspensions`, jest liczone w tym zafałszowanym
tempie — nie bierz tych liczb za wzorzec dla nowego stosu.

⚠ To łączy się z pułapką opisaną w `CLAUDE.md`: scheduler rusza po URL-e dostawców w ciągu 60 s od startu
(`extensions.cjs:811-838`). Po tej łatce gałąź jest martwa w `extensions.cjs`, ale **rdzeniowy scheduler
D4 nadal działa** — przy stawianiu oryginału lokalnie trzeba go wygaszać tak samo jak dotąd.

## Czego ticket 120 NIE dotknął

`availability_sync.cjs`, `product_auto_suspensions` i cała logika #104 siedzą w `staging_policy.cjs`
(linie 82-665, `install()`) i w plikach Selly. Moduł `staging_policy.cjs` jest już w
`rebuild/backend/src/import/legacy/` skopiowany **bajt w bajt z `88fa31c`**, ale `install()`
i `registerRoutes()` **nikt nie woła** — leżą uśpione. Masz więc kod źródłowy pod ręką, bez ryzyka,
że coś się już wykonuje.

`mirror/backend/availability_sync.cjs` NIE został zsynchronizowany do `mirror/` (decyzja D-2: tylko
warstwa parserów), więc na `develop` jest starszy niż `88fa31c`.
