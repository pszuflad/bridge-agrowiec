# I15.4b — importer: bezpieczeństwo źródła, wycofania, auto-wstrzymania, dopasowanie po EAN i DOT

> **Stan:** ⬜ po I15.4a i I15.2 (ścieżka ZAPISU)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #99, #103, #104, #105, #106, #107 (wg zakresu) · **Zależy od:** I15.4a (tabele), I15.2 (`feed_safety`, parsery)
> **Ticket:** —

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
—

## Do koordynatora
—
