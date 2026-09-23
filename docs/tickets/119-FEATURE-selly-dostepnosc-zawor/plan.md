# 119-FEATURE-selly-dostepnosc-zawor — dostępność w Selly: moduł odświeżania, Tor 1, Tor 2, zawór na kolizje

> Status: Draft
> Branch: `feature/119-selly-dostepnosc-zawor`
> Worktree: `.worktrees/119-FEATURE-selly-dostepnosc-zawor`
> Karta: `docs/karty/I15.10/` · Źródło prawdy: `origin/main` na `88fa31c`

## Opis ticketa

Karta I15.10 — cztery rzeczy:

1. **Moduł dostępności** (port `mirror/backend/availability_sync.cjs`): kolejkuje odświeżenie,
   uruchamia generator CSV, a po nim `syncDelta` dla dotkniętych dostawców; okresowa
   synchronizacja zostaje mechanizmem ponawiania; błąd tylko loguje. Generator wołamy
   **w tym samym procesie** (świadome odstępstwo). Modułu **nie podpinamy** do stagingu —
   hook dołoży I15.4; wystawiamy jawną funkcję.
2. **Tor 1** (`sync-delta.ts`), zmiany z #104: warunek obejmuje wstrzymane z wariantem, ale
   WYKLUCZA te, które mają inną aktywną ofertę w tej samej grupie `kod_importu`; mapowany
   wariant bez EAN też się zeruje; tuż przed wysyłką czytany jest ŻYWY
   `status`/`stan`/`cena_sprzedazy` — przy `wstrzymany` idzie stan 0.
3. **Tor 2** (`sync-full.ts`), zmiana z #104: tuż przed wysyłką żywy `status`/`stan`; produkt
   wstrzymany po rozpoczęciu cyklu pomijany (`skip`).
4. **Wykrywanie kolizji `kod_importu`**: dla pary `(dostawca, kod_importu)` z więcej niż jednym
   aktywnym produktem — grupę ZARAPORTUJ w `selly_sync_log`. **Bez pomijania** — patrz „Rewizja
   zakresu" niżej; pierwotny zawór (pomijanie) został wycofany po odpowiedzi Ani z 23.09.

## Kontekst

**Stan odbudowy.** I15.6 (ticket 108) i I15.7 (ticket 109) zamknęły się na stanie produkcji
`7d6cfc9` — czyli SPRZED zmiany „dostępność" wprowadzonej commitem `abe5f14` (22.09 19:00).
Obie poprawki z `abe5f14` przejmuje ta karta (`wejscie-111.md`). Diff `abe5f14..88fa31c` na obu
plikach jest PUSTY — zamrożenie 23.09 nie dotknęło Toru 1 ani Toru 2.

**Ustalenia, które korygują opis karty (do koordynatora):**
- `generator-csv.ts` **NIE pochodzi z I15.3** — to kod z ticketu 28 (wcześniejsza iteracja),
  już obecny na `develop`. Zależność od I15.3 była więc pozorna: `wygenerujCsvSelly(db, sciezki)`
  jest dostępne od razu i jest **synchroniczne**. I15.3 ma dołożyć do niego osobne rzeczy
  (zapis atomowy, kolumna `Blokowane-formy-platnosci`) — nie ruszamy go.
- `syncDelta` w odbudowie ma sygnaturę `(db, discovery, dostawca, opts)` — o jeden argument
  (`discovery`) więcej niż oryginalne `syncDelta(db, supplier)`. Moduł dostępności musi więc
  dostać `discovery`, czego oryginał nie potrzebował (tam to współdzielony `require`).
- Rebuild **nie ma kolumny `sample_errors`** w `selly_sync_log` (to nazwa z produkcji) — ma
  `liczba_skip` i wolny `szczegoly_json`, do którego istniejący kod pisze `{stats, sample_errors}`.
  Zawór raportuje się tam → **bez migracji** (numer 012 jest zajęty przez niezmergowaną kartę
  innej sesji, więc unikamy konfliktu numeru).

**Kolejkowanie w oryginale (23 linie, `availability_sync.cjs`)** — semantyka do odtworzenia:
`pending: Set` + `running: boolean`; zgłoszenie zawsze dopisuje dostawcę do `pending`; jeśli bieg
trwa — `request()` wraca natychmiast. Pętla `while (pending.size)` DRENUJE kolejkę: bierze całą
bieżącą partię, czyści `pending`, generuje CSV **raz na partię**, potem `syncDelta` **sekwencyjnie**
per dostawca. Zgłoszenie **nigdy nie ginie** — najwyżej odkłada się na kolejny obrót pętli.
`finally`: `running=false` i rekurencyjny restart, jeśli coś zostało w `pending`.

**Kto woła moduł w produkcji** (`mirror/backend/staging_policy.cjs:131-134`) — to jest wejście
dla I15.4, nie dla nas:
```js
function refreshAvailability(supplier){
  if(require('path').resolve(db.name)!=='/home/admin/private_apps/bridge/data.db')return;
  require('./availability_sync.cjs').request(db,supplier);
}
```
wołane z `importer()` (`:614`, warunek `availabilityChanged && !options.reconcileOnly`) oraz jako
`U.refreshAbsenceAvailability` (`:331`) przy decyzjach „brak karty".

## ⭐ Rewizja zakresu — odpowiedź Ani z 23.09 (wycofanie zaworu)

`wejscie-116.md`/`wejscie-117.md` traktowały współdzielony `kod_importu` jako anomalię i kazały
kolizyjne grupy POMIJAĆ. **Ania (23.09) wyjaśniła, że to mechanizm zamierzony:**

> Kod importu jest po to, aby umożliwić wielo-magazynowość w sklepie Selly. (…) Ten sam produkt
> u różnych dostawców może mieć różne EAN-y (…). To, że EAN jest różny, nie świadczy o tym, że to
> jest inna opona. Klasyfikacja opony jest po nazwie, modelu oraz indeksie nośności i prędkości.
> (…) Ten sam produkt trafia wtedy w Selly do jednej karty i pokazuje się tylko różna cena oraz
> inny magazyn.

**Pomiar rozstrzygający (migawka `db/snapshot.db`, 13.08; 6898 aktywnych produktów):**

| przypadek | grupowanie | wynik |
|---|---|---|
| **A. TEN SAM dostawca**, ten sam `kod_importu` | `(dostawca, kod_importu)` | **121 grup / 259 produktów**, z czego **116 grup ma różne ceny lub stany** |
| **B. RÓŻNI dostawcy**, ten sam `kod_importu` | `kod_importu` wg `dostawca` | **793 grupy / 1734 produkty** |

Przykład z A — nazwa, model i indeks IDENTYCZNE, EAN-y różne (dokładnie jak opisuje Ania):
```
MO1 / kod_importu=326606
  MO1_15126983 | ean 8906117626572 | stan 5  | cena 12016 | VF710/70R42 CEAT Torquemax 185D SB/TL
  MO1_15126981 | ean 8906117624387 | stan 2  | cena 10676 | VF710/70R42 CEAT Torquemax 185D SB/TL
```

**Wnioski:**
1. Przypadek **B to wielomagazynowość Ani** i odbudowa już ją respektuje — `isMetadataOwner()`
   (`sync-full.ts:251`) wprost mówi: „Jeden produkt Selly może mieć warianty od kilku dostawców".
   Zawór grupujący po `(dostawca, kod_importu)` **nigdy nie dotykał** przypadku B.
2. Problem z #108 to przypadek **A** i jest realny: oba wiersze piszą do JEDNEGO snapshotu
   w `selly_products` (`markSynced` kluczuje `kod_importu + dostawca`), więc każdy nadpisuje
   poprzedni i obie pozycje lecą w kółko co cykl.
3. Ale wg reguły Ani („ta sama opona ⇒ ten sam kod importu") te dane są **poprawne**, więc
   pomijanie grupy zatrzymałoby synchronizację produktów, które Ania uważa za prawidłowe.

**Decyzja użytkownika (23.09): wykrywamy i raportujemy, ale NIE pomijamy.** Zachowanie wysyłki
zostaje 1:1 z produkcją; dokładamy wyłącznie widoczność — licznik `kolizje_kod_importu` i listę
grup w `szczegoly_json`. Pętla wysyłek zostaje (jak dziś w produkcji), ale przestaje być
niewidoczna. Semantyczne rozstrzygnięcie przypadku A (deduplikacja / agregacja stanu / rozdzielenie)
to decyzja handlowa Ani — poza tym ticketem.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Brak — ticket nie dotyka kontraktu.** Uzasadnienie:
- `contract/openapi.yaml` ma ścieżki `/api/selly/{categories,csv-status,dictionaries,generate-csv,log,ping,producers,status,sync-product,sync-supplier}` — **nie ma** `/sync-delta`, `/sync-full`
  ani żadnej trasy dostępności. Montaż tras i harmonogramu to karta I15.8; my zmieniamy wyłącznie
  funkcje wewnętrzne i dokładamy moduł, którego nikt jeszcze nie woła.
- Jedyny fixture dotykający `selly_sync_log` to `contract/fixtures/GET_selly_log.json` — dotyczy
  wierszy `operacja='sync_supplier'`, nie naszych `sync_delta`/`sync_full`. Kształt odpowiedzi
  `GET /api/selly/log` się NIE zmienia: dokładamy tylko treść do wolnego pola `szczegoly_json`
  i nowy klucz w `stats` wewnątrz tego JSON-a.
- ⚠ Pułapka projekcji Drizzle camelCase/snake_case z `CLAUDE.md` **nie dotyczy** tego kodu:
  `selly_sync_log` jest pisany surowym SQL-em (`db.$client.prepare(...)`), nie przez `insert()`.

**Gate zastępczy:** pełny zestaw testów backendu musi zostać zielony (baseline zmierzony przed
startem: 100 plików, 1632 przechodzą, 3 pominięte), a testy Toru 1 i Toru 2 z kart I15.6/I15.7
nie mogą się zepsuć poza świadomą aktualizacją asercji na `stats` (dochodzi nowe pole).

## Decyzje

**Odtwarzane 1:1 z oryginału** (`abe5f14`, potwierdzone diffem):
- WHERE Toru 1 z wykluczeniem `NOT EXISTS(... active.status='aktywny')`.
- Warunek EAN: `(sp.selly_variant_id IS NOT NULL OR (p.ean IS NOT NULL AND p.ean != ''))`.
- Żywy odczyt w Torze 1 — łącznie z zagnieżdżonym sprawdzeniem „czy grupa ma inną aktywną
  ofertę" przy `wstrzymany` (wtedy `skip`), inaczej `row.stan = 0`.
- Żywy odczyt w Torze 2 — 3 linie, `status !== 'aktywny'` → `skip`.
- Semantyka kolejki: drenaż `while`, jeden CSV na partię, `syncDelta` sekwencyjnie, błąd tylko
  do `console.error`, brak własnego timera.

**Świadome odstępstwa (zatwierdzone przez użytkownika):**

| # | Odstępstwo | Uzasadnienie |
|---|---|---|
| D-A | **Wykrywanie i raportowanie kolizji `kod_importu` w Torze 1** — grupa z >1 aktywnym produktem jest odnotowana w `selly_sync_log`, ale **nadal wysyłana** | **To NIE jest odstępstwo w zachowaniu wysyłki** — ta zostaje 1:1 z produkcją; dokładamy wyłącznie widoczność (`kolizje_kod_importu` + lista grup). Pierwotny zawór z `wejscie-117.md` p.1 (pomijanie) został **wycofany** decyzją użytkownika z 23.09 po wyjaśnieniu Ani — pomijanie zatrzymałoby produkty, których dane są poprawne. Szczegóły i pomiar: sekcja „Rewizja zakresu". |
| D-B | **Generator CSV wołany w tym samym procesie**, nie przez `execFileSync(process.execPath, …)` | U nas generator to moduł (`wygenerujCsvSelly`), nie samodzielny skrypt CLI. Prostsze, bez kosztu startu Node'a. Decyzja z `wejscie-117.md` p.3. **Konsekwencja przyjęta świadomie:** tracimy izolację błędu i twardy timeout 60 s, który miał `execFileSync`. Ryzyko oceniono jako niskie — generator czyta lokalny SQLite i pisze plik, nie ma wywołań sieciowych, które mogłyby wisieć. |
| D-C | **Fabryka + rejestr domyślnej instancji** zamiast stanu na poziomie modułu (`const pending=new Set(); let running=false;`) | `syncDelta` wymaga wstrzyknięcia `discovery`, a modułowy singleton przeciekałby między testami w jednym procesie Vitest. Semantyka „jeden bieg naraz" zachowana — tyle że per instancja. |
| D-D | **Zawór raportowany przez nowy licznik `kolizje_kod_importu` + próbki w `szczegoly_json`** | Rebuild nie ma kolumny `sample_errors`; nowa kolumna wymagałaby migracji, a numer 012 jest zajęty przez niezmergowaną kartę. Licznik w `stats` pokazuje ILE, lista `kolizje` — KTÓRE grupy odpadły; kolizje liczą się też do `skip`. |

**Zakres wykrywania: TYLKO Tor 1.** Pętla wysyłek wynika ze współdzielonego snapshotu w delcie;
Tor 2 jest pełnym cyklem i nie zapętla się na tym mechanizmie.

**⛔ Danych NIE ruszamy** — rozdzielenie kolizyjnych grup (wariant (a) z `wejscie-116.md`) to
osobna decyzja Ani.

## Plan implementacji

### Krok 1 — Tor 1: WHERE i projekcja (`src/selly/rest/sync-delta.ts`)
- `WierszDelta` += `id: number`, `status: string`.
- SELECT: `p.kod, …` → `p.id, p.status, p.kod, …` (verbatim za `abe5f14`).
- `where[0]` → wariant z `NOT EXISTS(SELECT 1 FROM products active WHERE active.dostawca=p.dostawca
  AND active.kod_importu=p.kod_importu AND active.status='aktywny')`.
- `where[1..2]` (`p.ean IS NOT NULL`, `p.ean != ''`) → jeden warunek
  `(sp.selly_variant_id IS NOT NULL OR (p.ean IS NOT NULL AND p.ean != ''))`.
- Aktualizacja komentarza nagłówkowego (dziś mówi „EAN … wymagane", co ticket obala).

### Krok 2 — Tor 1: żywy odczyt przed wysyłką
W pętli `syncDelta`, po bloku mapowania, przy komentarzu `// 2. Aktualizacja wariantu`
i **przed** `if (dryRun)` (tak jak w oryginale):
```ts
const live = db.$client.prepare("SELECT status, stan, cena_sprzedazy FROM products WHERE id = ?")
  .get(row.id) as { status: string; stan: number | null; cena_sprzedazy: number | null } | undefined;
if (!live) { stats.skip++; continue; }
if (live.status === "wstrzymany") {
  if (db.$client.prepare("SELECT 1 FROM products WHERE dostawca = ? AND kod_importu = ? AND status = 'aktywny' LIMIT 1")
        .get(row.dostawca, row.kod_importu)) { stats.skip++; continue; }
  row.stan = 0;
} else { row.stan = live.stan; row.cena_sprzedazy = live.cena_sprzedazy; }
```

### Krok 3 — Tor 1: wykrywanie i raportowanie kolizji `kod_importu`
- Nowa funkcja `grupyKolizyjne(db, dostawca): Set<string>` — JEDEN SQL, nie N+1:
  `SELECT dostawca, kod_importu FROM products WHERE status='aktywny' AND kod_importu IS NOT NULL
   AND kod_importu != '' [AND dostawca = ?] GROUP BY dostawca, kod_importu HAVING COUNT(*) > 1`.
  Klucz zbioru: `` `${dostawca}\u0000${kod_importu}` ``.
- `StatystykiDelta` += `kolizje_kod_importu: number`.
- Na początku pętli: jeśli wiersz należy do grupy kolizyjnej — `stats.kolizje_kod_importu++`
  i dopisanie grupy do listy `kolizje` (raz na grupę, nie raz na wiersz). **Bez `continue`** —
  wiersz leci dalej normalną ścieżką i zostaje wysłany, dokładnie jak w produkcji.
- `logSyncEnd` dostaje `{ stats, kolizje: kolizje.slice(0, 20), sample_errors: … }`.

### Krok 4 — Tor 2: żywy odczyt (`src/selly/rest/sync-full.ts`)
Na początku `for (const row of limited) { try {`, przed `let result`:
```ts
const live = db.$client.prepare("SELECT status, stan FROM products WHERE id = ?")
  .get(row.bridge_product_id) as { status: string; stan: number | null } | undefined;
if (!live || live.status !== "aktywny") { stats.skip++; continue; }
row.stan = live.stan;
```

### Krok 5 — moduł dostępności (`src/selly/dostepnosc.ts`, nowy)
Nazewnictwo polskie, spójne z `generator-csv.ts` / `slowniki.ts` / `tryb.ts`.
```ts
export type ZaleznosciDostepnosci = {
  db: Baza; discovery: Discovery; sciezkiCsv: SciezkiCsvSelly;
  generujCsv?: …;            // wstrzykiwane w testach
  synchronizujDelte?: …;     // wstrzykiwane w testach
};
export type SynchronizacjaDostepnosci = {
  zadajOdswiezenie(dostawca: string): void;
  poczekajNaKoniec(): Promise<void>;   // afordancja testowa — oryginał jest fire-and-forget
};
export function stworzSynchronizacjeDostepnosci(z: ZaleznosciDostepnosci): SynchronizacjaDostepnosci;
export function ustawDomyslnaSynchronizacjeDostepnosci(s: SynchronizacjaDostepnosci | null): void;
export function zadajOdswiezenie(dostawca: string): void;  // ⭐ to woła I15.4
```
Brak skonfigurowanej instancji ⇒ `zadajOdswiezenie` nie robi nic (odpowiednik produkcyjnej
bramki „to nie jest produkcyjna baza → wracaj"). **`app.ts` NIE jest ruszany** — montaż
należy do I15.4/I15.8.

### Krok 6 — testy
Nowy `test/selly.dostepnosc.test.ts` + rozszerzenia `test/selly.sync-delta.test.ts`
i `test/selly.sync-full.test.ts`. Aktualizacja istniejących asercji `toEqual` na `stats`
(dochodzi `kolizje_kod_importu`).

### Krok 7 — dokumentacja karty
`docs/karty/I15.10/karta.md` (stan + „Dowiezione" + „Do koordynatora"), nowe
`docs/karty/I15.4/wejscie-119.md` (punkt wpięcia), `docs/spec-backend/wpis-119.md`,
statusy w `docs/rebuild-backlog.md` (#104, #108, #101). **Roadmapy nie ruszamy.**

## Strategia testów

Wszystkie na prawdziwym SQLite w katalogu tymczasowym (`stworzTestowaBaze`) i na atrapie
Selly (`stworzAtrapeSelly`) — **żaden test nie woła sieci**, klient jest wstrzykiwany.

| # | Przypadek | Oczekiwanie |
|---|---|---|
| T1 | Tor 1: produkt aktywny przy wyborze, `wstrzymany` w chwili wysyłki, **brak** innej aktywnej oferty w grupie | wysłane `quantity: 0`, nie stary stan |
| T2 | Tor 1: jw., ale grupa **ma** inną aktywną ofertę | `skip`, żadnego PUT |
| T3 | Tor 1: produkt zniknął z `products` w trakcie biegu | `skip`, żadnego PUT |
| T4 | Tor 1: `wstrzymany` z mapowanym wariantem **bez EAN** | wchodzi do zestawu i zeruje się (dziś odpadał na warunku EAN) |
| T5 | Tor 1: `wstrzymany` z wariantem, ale grupa ma aktywną ofertę | NIE wchodzi do zestawu (`findDeltaProducts`) |
| T6 | Tor 1: kolizja `(dostawca, kod_importu)` — 2 aktywne produkty | **oba WYSŁANE** (zachowanie produkcji), `kolizje_kod_importu = 1`, grupa w `szczegoly_json.kolizje`, `skip` bez zmian |
| T6b | Tor 1: różni dostawcy, ten sam `kod_importu` (wielomagazynowość Ani) | **nie jest** kolizją — `kolizje_kod_importu = 0`, oba wysłane |
| T7 | Tor 2: produkt wstrzymany po rozpoczęciu cyklu | `skip`, żadnego wywołania API |
| T8 | Tor 2: produkt aktywny ze zmienionym stanem w trakcie biegu | wysłany **żywy** stan, nie migawka |
| T9 | Moduł: dwa zgłoszenia pod rząd (synchronicznie) | **jedno** przetworzenie — jeden bieg generatora CSV, `syncDelta` raz na dostawcę |
| T10 | Moduł: zgłoszenie w trakcie biegu | nie ginie — drugi obrót pętli, kolejny generator + `syncDelta` |
| T11 | Moduł: błąd generatora / `syncDelta` | tylko log, wyjątek nie wycieka, `wTrakcie` wraca do `false`, kolejne zgłoszenie znów działa |

**Świadomie pomijamy:** testu wołającego prawdziwe Selly nie ma i nie będzie (`SELLY_TRYB`,
atrapa); nie testujemy `generator-csv.ts` (cudza własność, mamy go tylko zawołać —
w teście modułu wstrzykujemy atrapę generatora i osobno sprawdzamy, że domyślną implementacją
jest `wygenerujCsvSelly`).

## Poza zakresem

- `generator-csv.ts` (I15.3) — tylko go wołamy.
- Harmonogram i trasy HTTP (`scheduler_selly`, `routes_sync`) — I15.8. Moduł zostaje niewpięty.
- Staging, auto-wstrzymania, `refreshAvailability` — I15.4.
- `app.ts` / montaż domyślnej instancji.
- **Dane** — rozdzielenie kolizyjnych grup `kod_importu` (decyzja Ani, backlog #108).
- Naprawa #101 (blokady form płatności) — ticket tylko MIERZY i raportuje.
- Wykrywanie kolizji w Torze 2.
- Pomijanie / deduplikacja / agregacja kolizyjnych grup — decyzja handlowa Ani (#108).

## Definition of done

- [ ] Tor 1 ma WHERE, projekcję i żywy odczyt zgodne z `abe5f14` (diff przeczytany linia po linii)
- [ ] Tor 2 ma 3-liniową poprawkę żywego statusu z `abe5f14`
- [ ] Wykrywanie kolizji działa w Torze 1: raportuje licznik i grupy w `selly_sync_log`, a wysyłka pozostaje 1:1 z produkcją (nic nie jest pomijane)
- [ ] Przypadek „różni dostawcy, ten sam `kod_importu`" (wielomagazynowość) NIE jest raportowany jako kolizja
- [ ] Moduł dostępności odtwarza semantykę kolejki oryginału (drenaż, jeden CSV na partię, sekwencyjna delta, błąd tylko logowany)
- [ ] `zadajOdswiezenie` wystawione i opisane w „Do koordynatora" dla I15.4; `app.ts` nietknięty
- [ ] Testy T1–T11 zielone; żaden nie woła sieci
- [ ] `npm run lint`, `typecheck`, `build`, `test` zielone; brak regresji wobec baseline (1632 pass / 3 skip)
- [ ] Pomiar #101 zapisany w karcie jako fakt (bez naprawy)
- [ ] Karta I15.10 opisuje STAN; `wejscie-119.md` dla I15.4; roadmapa nietknięta
