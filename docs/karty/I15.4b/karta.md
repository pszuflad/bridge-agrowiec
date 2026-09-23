# I15.4b — importer: bezpieczeństwo źródła, wycofania, auto-wstrzymania, dopasowanie po EAN i DOT

> **Stan:** ✅ 2026-09-23 · 130-FEATURE-importer-staging-bezpieczenstwo
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #99, #103, #104, #105, #106, #107 (wg zakresu) · **Zależy od:** I15.4a (tabele), I15.2 (`feed_safety`, parsery)
> **Ticket:** `130-FEATURE-importer-staging-bezpieczenstwo`

Założona przez koordynatora ticketem `123-DOCS-podzial-i15-4`, 2026-09-23 — **podział dawnej karty I15.4** (665 linii
`staging_policy.cjs`, 5 nowych tabel, podmiana rdzenia importu to za dużo na jeden przegląd; decyzja użytkownika 23.09).
Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”. Materiał wspólny: wejścia w katalogach kart.

## Zakres
Podmiana rdzenia importu (`rebuild/backend/src/import/tk.ts`) na `importer()` z `staging_policy.install()`
(`88fa31c`, `mirror/backend/staging_policy.cjs`) — **ścieżka zapisu**:

- świeże ceny i stany; wycofania; zapis do `historia_cen`;
- **konsumpcja `_bridgeFeedMeta`** z `feed_safety` (moduł portuje I15.2): blokada źródła pustego, błędnego,
  mniejszego o ponad 20% lub masowo nierozpoznanego (#103);
- **reguła wycofań:** trzy różne kompletne oferty + minimum 24 h między potwierdzeniami, dowody w
  `supplier_feed_versions`, `supplier_feed_state`, `product_absence_checks` (#103); „wstrzymane/0 nie wracają”;
- **auto-wstrzymania (#104):** brak w pełnej wiarygodnej ofercie → `wstrzymany` + stan 0, wpis do
  `product_auto_suspensions`; pewny powrót przywraca TYLKO automatycznie wstrzymane, **ręczne wstrzymania
  chronione**; wystaw punkt wpięcia „zmiana dostępności” i **zawołaj funkcję z modułu dostępności karty I15.10**
  (jej sygnatura: `docs/karty/I15.10/karta.md`, sekcja „Do koordynatora” po zamknięciu tamtej karty);
- **dopasowanie po EAN wyłącznie do jednej zgodnej opony** z ochroną DOT (`compatibility()`), ochrona DEMO
  i wariantów, bezpieczne dopasowanie po kodzie dostawcy i wielkości liter (#103, #105);
- **`assignKodImportu`** — nadpisanie ze Staging v2. ⚠ Zachowaj DOSŁOWNIE gałąź „zachowaj istniejący
  sześciocyfrowy `kod_importu`” (`docs/karty/I15.4b/wejscie-116.md`) — to nie jest błąd do naprawy;
- **edycja modelu w stagingu aktualizuje bieżnik**, jeśli był jego automatyczną kopią (#105).

⚠ Testy charakteryzacyjne importu zamrażają STARY `tk()` — przepnij je na oryginał z `88fa31c`, nie usuwaj.
Rozjazdy opisz jako skutek #99/#103/#104, nie „naprawiaj” w stronę starego zachowania.

## Pliki (wyłączna własność)
`rebuild/backend/src/import/tk.ts` i moduły importu poza `legacy/`, testy importu.
NIE: akceptacja, trasy `review`/`resolve` i decyzje o nieobecnych kartach (I15.4c), migracja i model (I15.4a),
`legacy/**` (I15.2), moduł dostępności (I15.10 — tylko go wołasz).

## Decyzje
**Decyzje użytkownika (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na istniejące obiekty ·
D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2 przenosimy ·
D4 błędny EAN = błąd blokujący akceptację (zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
⭐ **Produkcja zamrożona — Ania skończyła 23.09 i czeka na nową wersję do testów. Źródło prawdy: `origin/main`
na commicie `88fa31c` (23.09 13:00).** Nowy commit z kodem na `main` = ZATRZYMAJ SIĘ i zgłoś użytkownikowi.


## Dowiezione

**Kluczowe ustalenie, powód wymiany zamiast rozszerzenia:** na `88fa31c` `tk` nie jest już
osobną funkcją bundla — jest wprost wynikiem `staging_policy.install()`
(`mirror/backend/index.cjs`: `tk = require("./staging_policy.cjs").install({...})`). Stary
`tk()` z bundla (żywa definicja `deminified/backend-index.cjs:47584`) jest na tym commicie
MARTWY — nadpisany tą linią. Dlatego rdzeń importu w `rebuild/backend/src/import/` został
**zastąpiony** portem `importer()`, nie rozszerzony o kolejne gałęzie.

Dowieziono, w nowych modułach `rebuild/backend/src/import/polityka/`
(`fabryka.ts`, `podstawy.ts`, `bledy.ts`, `kod-importu.ts`, `edycja-stagingu.ts`):
- **bezpieczeństwo źródła (#103):** cztery blokady (pusty odczyt, błędy parsera, oferta
  podejrzanie mała <80% maksimum, masowo nierozpoznana), wszystkie kodem 400;
- **auto-wstrzymania z ochroną ręcznych (#104):** brak w kompletnej ofercie wstrzymuje
  natychmiast, pewny powrót przywraca TYLKO automatycznie wstrzymane, ręczne wstrzymania
  przeżywają import; `updateProduct` (`src/routes/products.ts`) kasuje znacznik automatu przy
  jawnej zmianie `status`;
- **dopasowanie po EAN** wyłącznie do jednej zgodnej opony, z ochroną DOT i DEMO/wariantów;
- **nadpisania Staging v2 (#99):** `assignKodImportu` (gałąź „zachowaj istniejący 6-cyfrowy
  `kod_importu`" zachowana dosłownie), `addStaging`, `updateStaging` (model → bieżnik, #105),
  `updateProduct`;
- **konsumpcja `_bridgeFeedMeta`** z warstwy parsowania (`MetaCennika` w `WynikParsowania`) i
  zapis do `historia_cen`.

**Dwa gate'y wierności przeciw ŻYWEMU oryginałowi:** przenagrana charakteryzacja
(`scripts/charakteryzacja-silnik-nagraj.mjs` przepięty na `install()` @ `88fa31c`) — MO1–MO10 +
21 scenariuszy, 49/49 zgodnych pole po polu; oraz NOWY `test/silnik.polityka-zrodla.test.ts`
(17/17), który uruchamia `install()` obok portu na tej samej bazie SQLite i porównuje skutek.
Bramki: `lint`/`typecheck`/`build` zielone, 1774 testy przechodzą (baseline `origin/develop`
1754).

**Gdzie odbiegło od pierwotnego planu:**
- **D4 — twarda blokada akceptacji dla błędnego EAN przesunięta do I15.4c.** Silnik oznacza
  pozycję jako `typZmiany='blad'` z komunikatem walidacji i zachowanym `eanRaw`, ale samo
  odrzucenie `POST /api/staging/:id/accept` siedzi w `checkAcceptance()`
  (`staging_policy.cjs:188-226`), poza zakresem ścieżki zapisu. Wychwycone w code review.
- **Cenniki charakteryzacji nagrane jako oferta NIEKOMPLETNA** — próbki ~200 wierszy przy
  katalogu kilku tysięcy kart; jako kompletna oferta wstrzymałyby (#104) ~4800 kart na
  dostawcę i wzorzec przestałby mierzyć dopasowanie.

## Do koordynatora

### Scalenie z I15.4c — wspólna warstwa przyszła z ticketu 129

Karta I15.4c (ticket 129) weszła do `develop` PRZED tą kartą i dowiozła wspólną warstwę, którą
decyzja D-130.2 przypisywała I15.4b. Po decyzji użytkownika (2026-09-23) ta karta **adaptowała
się do 129 i skasowała duplikaty**: `podstawy.ts` odchudzony do prymitywów importerowych
(`LABEL`, `OPTIONAL`, `separateDotBatch`, `sourceKey`, `codeKey`), a `norm`/`hash`/`KEYS`,
`suspend`, `protect`, `find`, `clear`, `assignKodImportu` i `updateStaging` brane z
`polityka/helpery.ts`, `polityka/kontekst.ts`, `polityka/kod-importu.ts` i
`polityka/zgloszenia.ts`. Cofnięta też globalna podmiana `assignKodImportu` w `bulk.ts`
i `akceptacja.ts` — `wejscie-129.md` prosi o wstrzykiwanie, a `importer()` tej funkcji nie woła.

**Dla koordynatora:** wersja tej karty sprzed scalenia zakładała odwrotną kolejność fal
(I15.4b przed I15.4c). Jeśli planujesz kolejne fale, warto zapisać w roadmapie, że wspólna
warstwa polityki stagingu należy teraz do plików wniesionych przez ticket 129.


1. **`mirror/backend/index.cjs` na `develop` jest NIEAKTUALNY** — stoi na `86d9090`, a
   `staging_policy.cjs` i `bridge_ext.cjs` są już na `88fa31c` (resync I15.2 objął tylko
   wybrane pliki). Blok helperów wycinany przez charakteryzację jest między tymi commitami
   IDENTYCZNY (zweryfikowane bajtowo), więc nie zablokował tego ticketa — ale plik trzeba
   dosynchronizować.
2. **Ciche nakładanie poprawek Marty — do decyzji Ani.** `protect()`
   (`staging_policy.cjs:158-162`) podmienia wartość bez żadnego sygnału. Stary `tk()` meldował
   konflikt („plik nadpisuje poprawkę Marty") i BLOKOWAŁ auto-zatwierdzenie. Teraz plik
   dostawcy sprzeczny z ręczną decyzją Marty nie jest nigdzie widoczny, a cena przechodzi bez
   pytania. Odtworzone wiernie wobec `88fa31c`, ale warte decyzji.
3. **Rozszerzenie zakresu poza pliki karty (decyzja użytkownika D-130.3):** nadpisanie
   `U.updateProduct` naniesione w `src/routes/products.ts` (ręczna zmiana `status` kasuje
   znacznik automatu). Bez tego ochrona ręcznych wstrzymań nie działa end-to-end. Karta I15.1,
   która jako jedyna deklarowała ten plik, jest zamknięta.
4. **Wpięcie modułu dostępności I15.10 — ZROBIONE, zostaje MONTAŻ.** Karta I15.10 (ticket 119)
   zmergowała się w trakcie tej pracy, więc szew nie czeka już na nikogo: `silnikStagingu()`
   podaje `zadajOdswiezenie` z `src/selly/dostepnosc.ts` jako domyślne `odswiezDostepnosc`.
   Wpięcie jest bezpieczne bez konfiguracji — bez zamontowanej instancji funkcja nie robi NIC
   (`dostepnosc.ts:127-130`), co jest odpowiednikiem bramki oryginału na produkcyjną bazę
   (`staging_policy.cjs:131-134`). **Do zrobienia przez I15.8:** montaż instancji przez
   `ustawDomyslnaSynchronizacjeDostepnosci()` przy starcie aplikacji — ta karta celowo nie
   rusza `app.ts`.
5. **Wydajność:** przypadki cennikowe w charakteryzacji wymagają podniesionego limitu czasu
   (120 s po scaleniu z ticketem 132, który wprowadził też budżet `tools/czas-testow.cjs`).
   Nowy silnik porównuje KAŻDĄ kartę katalogu z KAŻDYM rekordem cennika przez `compatibility()`
   w pętli nieobecnych; `assignKodImportu` czyta całą tabelę `products` przy każdym wywołaniu
   (także wewnątrz pętli bulk/akceptacji). Materiał do wpisu #107.
6. **Znany flake NIE z tego ticketa:** `test/alerty-katalogu.gate.test.ts` („paczka równa
   limitowi 20 000 id") pada na limicie 20 s przy pełnym przebiegu na obciążonej maszynie;
   osobno i na czystym `origin/develop` przechodzi. Już zgłoszone przez I15.4a.
