# I15.2 — resync parserów + `application_rules`, `payment_blocks`, część parserowa Staging v2

> **Stan:** ✅ 2026-09-23 · `120-CHORE-i15-2-resync-parserow`
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #73, #75, #78, #79, #80, #82, #83, #99 · **Zależy od:** I15.1
> **Ticket:** `120-CHORE-i15-2-resync-parserow`

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Ta sama metoda co 13a (`42-CHORE-i13a-resync-parserow`): kopia z `origin/main` do `rebuild/backend/src/import/legacy/`:
- `parsers/adapter.cjs`, `parsers/mo9_agrorami_api.cjs`, `parsers/tyre_params.cjs`, `common.cjs`,
  a po poszerzeniu zakresu z `wejscie-110.md` także `parsers/dispatcher.cjs`, `parsers/mo2_jmk.cjs`,
  `parsers/mo9_agrorami.cjs`, `parsers/_agrorami_fetch_helper.cjs` (razem OSIEM plików);
- NOWE: `application_rules.cjs` (#75/#79/#80/#82), `payment_blocks.cjs` (#73 — tylko czysta
  `getBlockedPaymentForms()`; moduł ma zahardkodowaną ścieżkę bazy produkcji `/home/admin/private_apps/bridge/data.db`
  — adapter NIE może otwierać żadnej bazy), `staging_policy.cjs` w części używanej przez adapter/common
  (`validateEan`, `rawEan`, `syntheticCode` i ich zależności; `install()`/`registerRoutes()` należą do I15.4).
- `git diff origin/develop origin/main -- mirror/backend/extensions.cjs` — rozłóż i przypisz: co dotyczy parsowania,
  robisz tu; co importu/akceptacji → wejście dla I15.4; Selly → I15.6/I15.8.

**Test akceptacyjny (gotowy):** `docs/tickets/71-DOCS-plan-poprawek/porownaj-parsery.cjs` na 8 prawdziwych
cennikach w `/tmp/cenniki` (poza repo — **NIE commitować**; jeśli ich nie ma, zapytaj użytkownika). Po resyncu:
**zero różnic w polach** między potokiem produkcji (`origin/main`, z nowymi modułami) a naszym. MO9 nie da się
przetestować plikiem (API, brak haseł) — opisz to.

⚠ D4: adapter produkuje teraz `eanRaw`/`_eanLossy` i `ean: null` dla błędnego EAN. Do czasu I15.4 importer
(`import/tk.ts`) tych flag nie zna — sprawdź, że stan przejściowy nie psuje importu (oczekiwanie: jak 14i, EAN pusty),
i zapisz wejście dla I15.4. Wpisy #11 i 14i: oznacz jako zastąpione przez #99/D4 (backlog).
⚠ #83 łamie obietnicę z `docs/instrukcja-testow-I3.md` §11 pkt 10 („10.00 zostaje”) — wejście dla I15.9.

## Pliki (wyłączna własność)
`rebuild/backend/src/import/legacy/**`, testy charakteryzacyjne parserów. NIE: `import/tk.ts` i staging (I15.4),
`rebuild/schema/`, Selly.

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona** — źródło prawdy dla TEGO ticketa to `origin/main` na commicie `88fa31c` (23.09 13:00).
Wcześniejsze zapisy w tej karcie (`7d6cfc9`) i w `wejscie-110.md` (`abe5f14`) są nieaktualne: produkcja
dołożyła kod po obu tych commitach. Decyzja użytkownika 23.09: idziemy z `88fa31c`.

—

## Dowiezione

**Resync warstwy parserów do `88fa31c`** — osiem plików + cztery NOWE moduły
(`application_rules.cjs`, `payment_blocks.cjs`, `feed_safety.cjs`, `staging_policy.cjs`), skopiowane
**bajt w bajt** równolegle do `mirror/backend/` i `rebuild/backend/src/import/legacy/`.

**Odstępstwo od litery karty (decyzja użytkownika D-1, 23.09):** nowe moduły skopiowane w CAŁOŚCI,
a nie okrojone do „czystej `getBlockedPaymentForms`" i „części używanej przez adapter/common".
Powód: gate integralności (`charakteryzacja.test.ts`, warstwa 1) liczy sha256 KAŻDEGO pliku
`legacy/**` wobec `mirror/backend/**`, a listy wyjątków pilnuje osobny test — okrojony plik nigdy nie
byłby bajt-w-bajt. Zweryfikowane przed decyzją: żaden z czterech modułów nie ma efektów ubocznych przy
`require()`, `payment_blocks` otwiera bazę tylko w `ensurePaymentBlocks()`, a `staging_policy.install()`
dostaje `db` argumentem. Warunek karty („adapter nie może otwierać bazy") jest więc spełniony,
a `install()`/`registerRoutes()` leżą uśpione dla I15.4.

**Test akceptacyjny — ZERO różnic w polach.** `/tmp/cenniki` nie istniało na maszynie; zamiast tego
pełne realne cenniki odzyskane z historii (`72957d7^:mirror/backend/import_archive/2026-08/`):
MO1 681, MO2 1 597, MO3 589, MO4 337, MO5 1 639 rekordów — **razem 4 843, zero różnic** wobec potoku
z `88fa31c`. Żaden plik ani fragment danych nie trafił do repo.
**MO9 przetestowane** ścieżką offline (`mo9-offline.mjs` + `MO9.items.json`), wbrew założeniu, że się nie da.

**Oba wzorce charakteryzacji przenagrane.** Liczba rekordów bez zmian u wszystkich 10 dostawców; zmiany
wyłącznie polowe i każda przypisana do zatwierdzonego wpisu: `eanRaw`/`_eanLossy`/`_supplierEanOriginal`
1 838 (D4/#99), `zastosowanie` 1 838 (#75/#79/#80/#82), `blokowaneFormyPlatnosci` 1 838 (#73),
`szerokosc` 172 (#83), `kod` 6 (#103 JMK), `ean` 4 (#105 W2), `_kodSynthetic` 2.
Wzorzec silnika: `scenariusze.expected.json` bez zmian; statystyki zmienione u MO2/MO4/MO8/MO10,
przy czym MO8 i MO10 to zmiana NA LEPSZE (#83 likwiduje fałszywe „zmiany kluczowe").

**Stan przejściowy D4 zweryfikowany — import się nie psuje.** Zmierzone stary port vs nowy na tych samych
pełnych cennikach: nowa ekspozycja to **+6 rekordów z 4 843 (0,12 %)**, wyłącznie MO5, i są to pozycje,
które wcześniej niosły bezsensowny EAN `…W2`. Liczba rekordów identyczna, nic nie ginie.
Szczegóły i zadanie dla silnika: `docs/karty/I15.4/wejscie-120.md`.

**Poza pierwotnym zakresem — naprawiona regresja, którą resync wprowadzał.** `feed_safety.attach()` rzuca
przy pustym cenniku i przy błędach parsera, a `parsujBufor()` nie było w try/catch w ŻADNYM z trzech
miejsc wywołania (`routes/import.ts`, `routes/suppliers.ts`, `import/synchronizuj.ts`) — błędny cennik
kończyłby się kodem 500. Tłumaczenie wyjątku wstawione w `parsuj.ts` (jedna warstwa, wszystkie trzy wejścia):
pusty cennik → istniejący `PustyImportBlad` (kod 400 i komunikat BEZ ZMIAN), błędy parsera → nowy
`BladCennika` (też 400).

**Nowy plik testowy** `test/feed-safety.test.ts` (10 testów) — ścieżki błędu #103, których próbki
charakteryzacji nie uruchamiają ani razu, plus PRZYPIĘCIE komunikatów `feed_safety`, bo po nich
`parsuj.ts` rozpoznaje pusty cennik od błędu parsera.

**#78 odnaleziony i sportowany** — `ODRZUCONE_CATEGORY_IDS = new Set(['163'])` + `powodOdrzucenia()`
w `mo9_agrorami_api.cjs` (odrzucanie quadów/kosiarek). Nie było go widać jako osobnego wpisu w diffie.

## Do koordynatora

**(a) Trigger 011 a wartości wielokrotne — ryzyko TEORETYCZNE, zmierzone.** `normalizeApplication()`
faktycznie potrafi produkować łańcuch `parts.join(' ; ')` (`application_rules.cjs:150`), a trigger z 011
spłaszcza taki łańcuch w kategorii kanonicznej do `Uniwersalne/pozostałe` (opisane w `wejscie-107.md`).
**Ale adapter nie produkuje ani jednej takiej wartości** — zmierzone i na próbkach 10 dostawców,
i na pełnych cennikach: `zastosowanie` jest wyłącznie `null` albo `Uniwersalne/pozostałe`.
Zgodnie z poleceniem nie naprawiane. Ryzyko leży poza warstwą parserów (katalog / poprawki ręczne).

**(b) `wejscie-107(a)` ROZWIĄZANE tym ticketem.** Zarzut brzmiał: nasz adapter nie woła
`normalizeCategoryApplication()`/`getBlockedPaymentForms()` przed zapisem, więc podgląd stagingu pokazuje
wartości nieznormalizowane. Po resyncu adapter woła oba (`tyre_params.cjs:6` → `application_rules`,
`adapter.cjs:10` → `payment_blocks`) — potwierdzone tym, że `zastosowanie`
i `blokowaneFormyPlatnosci` pojawiły się w 1 838 rekordach wzorca.

**(c) `#103` jest w `docs/rebuild-backlog.md` ZDUPLIKOWANY** — dwa niepowiązane wpisy pod jednym numerem:
„`routes_sync.cjs` woła nieistniejące `runFullTodays` → 500 na `/sync-full-*`" (Selly, I15.8) oraz
„Braki w cenniku / `feed_safety`" (ta karta). Numeracja do korekty.

**(d) Rozjazd w źródle prawdy, trzy różne commity w trzech dokumentach:** `karta.md` mówiła `7d6cfc9`,
`wejscie-110.md` mówi `abe5f14`, prompt i decyzja użytkownika z 23.09 — `88fa31c`. Poprawiłem to
W MIEJSCU tylko we własnej karcie; `wejscie-110.md` i roadmapa zostają do decyzji koordynatora.
Warto odnotować, że „zamrożenie produkcji" ogłoszono trzykrotnie i za każdym razem produkcja dołożyła
kod po tej dacie — przy następnej karcie warto sprawdzić `origin/main` tuż przed startem, nie tylko w planie.

**(e) `mirror/` zsynchronizowane TYLKO w warstwie parserów** (decyzja D-2), więc `mirror/backend/selly/*`,
`availability_sync.cjs`, `extensions.cjs` i `index.cjs` są na `develop` nadal starsze niż `88fa31c`.
Karty I15.4/I15.8/I15.10 będą musiały wziąć swoje pliki same.
