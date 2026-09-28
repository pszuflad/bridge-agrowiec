# 25-FEATURE-analityka-dostepnosc-rotacja — Iteracja 10, blok 10e (dostępność / rotacja / cykl)

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/25-analityka-dostepnosc-rotacja`
> Worktree: `.worktrees/25-FEATURE-analityka-dostepnosc-rotacja`

## Opis ticketa

> Iteracja 10, blok 10e (BE+FE) wg `docs/rebuild-roadmap.md` §5. Buduje na 10a, niezależny
> od 10b/10c/10d (idą równolegle). Sześć tras `/api/analytics/*`, agregaty 1:1
> z `analytics_module.cjs`, kształt = fixtures:
>
> - `availability/products` · `availability/sell-through` → wypełniają zakładkę `dostepnosc`,
> - `rotation/inactive` (czyta `req.query.days`) · `lifecycle/models` → dokładają się POD
>   istniejącą kartą marż w zakładce `marza` (`deminified/frontend-index.js:28516-28640`),
>   NIE tworzą nowej zakładki,
> - `seasonality/monthly` (szereg miesięczny) · `importy-timeline` (FE nie woła — §1.1).
>
> GATE: 6 tras zgodnych z fixtures + openapi; testy kształtu; dashboardy na snapshocie;
> karta marż z 10a nie może się popsuć; lint/typecheck/build czyste.

## Kontekst

Blok 10a (`19-FEATURE-analityka-fundament`) dowiózł fundament: pięć tras backendu, hooki
TanStack Query, filtry globalne, `TabelaAnalityki`, `formatowanie.ts`, infrastrukturę
wykresów i wzorzec sekcji (`rebuild/frontend/src/pages/analityka/README.md`). 10e **dokłada
treść w gotowe miejsca**, nie przemeblowuje widoku: zakładki, ich kolejność i etykiety
są już 1:1 z oryginałem, a `ZakladkaWPrzygotowaniu` z `blok="10e"` stoi w dwóch miejscach
(`dostepnosc` i pod sekcją marż w `marza`) jako miejsce docelowe.

**Rozmieszczenie kart wg oryginału** (`deminified/frontend-index.js:28417-28640`,
potwierdzone w `docs/analityka-bloki-10b-10f.md` §7):

| Zakładka | Karta | Trasa |
|---|---|---|
| `dostepnosc` | „4.1 Historia dostępności pozycji" | `availability/products` |
| `dostepnosc` | „4.2 Tempo schodzenia z magazynu" | `availability/sell-through` |
| `dostepnosc` | „4.4 Sezonowy wzorzec cen" | `seasonality/monthly` |
| `marza` (pod marżami z 10a) | „Rotacja / produkty bez aktualizacji" | `rotation/inactive` |
| `marza` (pod marżami z 10a) | „4.6 Cykl życia modelu" | `lifecycle/models` |
| — (bez UI) | — | `importy-timeline` |

⚠ **Sezonowość idzie do `dostepnosc`, nie osobno.** Prompt ticketa grupował
`seasonality/monthly` razem z `importy-timeline` w trzecim punkcie bez wskazania zakładki;
oryginał umieszcza ją jako trzecią kartę zakładki „Dostępność" (`fe.js:28489-28513`).
Rozstrzyga oryginał.

**Siatka bezpieczeństwa tego bloku jest najsłabsza w całej Iteracji 10** — cztery z sześciu
fixtures są puste (`availability/products.rows`, `availability/sell-through.rows`,
`rotation/inactive.rows`, całe `importy-timeline`), a `test/gate/ksztalt.ts:50` nie zagląda
do elementów pustej tablicy. Kształt wiersza tych czterech tras trzeba pokryć testem
jednostkowym przeciw SQL-owi oryginału.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ścieżki `contract/openapi.yaml`** (wszystkie `GET`, wszystkie
`security: [{bearerAuth}, {cookieAuth}]`, wszystkie bez schematu odpowiedzi — same kody
200/400/401):

| # | Ścieżka | openapi | Fixture |
|---|---|---|---|
| 1 | `/api/analytics/availability/products` | `:85-93` | `GET_analytics_availability_products.json` |
| 2 | `/api/analytics/availability/sell-through` | `:94-102` | `GET_analytics_availability_sell-through.json` |
| 3 | `/api/analytics/rotation/inactive` | `:270-278` | `GET_analytics_rotation_inactive.json` |
| 4 | `/api/analytics/lifecycle/models` | `:216-224` | `GET_analytics_lifecycle_models.json` |
| 5 | `/api/analytics/seasonality/monthly` | `:279-287` | `GET_analytics_seasonality_monthly.json` |
| 6 | `/api/analytics/importy-timeline` | `:198-206` | `GET_analytics_importy-timeline.json` |

**Trzy kształty koperty — nie jeden** (`docs/analityka-bloki-10b-10f.md` §3):

- `{ hasHistory, rows }` — 1, 2, 4, 5
- `{ days, rows }` — 3
- **goła tablica** — 6

**Kształty wierszy dowiedzione fixture'em (2 z 6):**

- `lifecycle/models.rows[]`: `marka`, `model`, `pierwszyRaz`, `ostatniRaz`, `produkty`
- `seasonality/monthly.rows[]`: `miesiac`, `marka`, `sredniaCena`, `dostepnoscPct`

**Kształty wierszy NIEdowiedzione (4 z 6, fixture pusty)** — pokrywa je test jednostkowy
`analityka.dostepnosc.agregaty.test.ts` przepisany z SQL-a oryginału:

- `availability/products.rows[]` (gałąź z historią): `kod`, `ean`, `dostawca`, `nazwa`,
  `snapshoty`, `dostepnoscPct`, `miesiaceBrakow`; (gałąź bez historii): `kod`, `ean`,
  `dostawca`, `nazwa`, `stan`, `dostepnoscPct`, `miesiaceBrakow`
- `availability/sell-through.rows[]`: `dostawca`, `kod`, `nazwa`, `zeszloSztuk`
- `rotation/inactive.rows[]`: `kod`, `nazwa`, `dostawca`, `marka`, `model`, `rozmiar`,
  `stan`, `ostatniaAktualizacja`
- `importy-timeline[]`: `id`, `kiedy`, `uzytkownik`, `dostawca`, `szczegolyJson`

**Czego odpowiedź mieć NIE MOŻE:** klucza `_przyciete` (jest w fixtures
`lifecycle_models` i `seasonality_monthly`, ale to adnotacja nagrywarki —
`contract/README.md:29`). Harness pomija klucze na `_` po stronie fixture'a, a klucz
nadmiarowy po stronie odpowiedzi zgłasza jako różnicę (`gate/ksztalt.ts:69-76`).

**Rozjazdy:** brak rozjazdu roadmapa ↔ `docs/analityka-bloki-10b-10f.md` §7 ↔ oryginał
co do listy tras i przypisania zakładek. Jedno **nowe odkrycie tej sesji** (pułapka SQL
w `sell-through`) — opis w „Decyzje", D1.

## Decyzje

Cztery decyzje użytkownika z 2026-09-03 (runda pytań przed planem):

**D1 — `availability/sell-through`: odtwarzamy niepoprawny SQL 1:1 + wpis do backlogu.**
CTE `seq` (`analytics_module.cjs:175-179`) bierze gołe `stan` (bez agregatu) obok
`GROUP BY dostawca, kod, zarejestrowano_at`, a `LAG(stan) OVER (PARTITION BY dostawca, kod
ORDER BY zarejestrowano_at)` liczy się PO tej agregacji. Zweryfikowane empirycznie na
SQLite 3.47.2: przy jednym wierszu na grupę wynik jest poprawny; przy duplikacie
`(dostawca, kod, zarejestrowano_at)` SQLite bierze `stan` z **arbitralnego** wiersza
grupy (implementation-defined). Duplikat jest osiągalny: `import/tk.ts:171,548-564` liczy
`zarejestrowanoAt` RAZ na cały import, więc dwie linie tego samego `kod` w jednym cenniku
dają dwa wiersze z identycznym kluczem. Odtwarzamy dosłownie (zasada projektu), dokładamy
test charakteryzacyjny dokumentujący zachowanie przy duplikacie i **nowy wpis w
`docs/rebuild-backlog.md`** ze statusem „⬜ do decyzji Ani".
*Alternatywa odrzucona:* naprawa SQL-a — dałaby liczby inne niż produkcja, bez pokrycia
w żadnym fixture.

**D2 — `importy-timeline`: backend 1:1, zero UI.** Oryginalny bundle nie woła tej trasy ani
razu (`docs/analityka-bloki-10b-10f.md` §1.1), fixture to pusta tablica. Trasa powstaje,
przechodzi GATE i test jednostkowy, ale żadna zakładka jej nie konsumuje — dokładnie tak,
jak 10a potraktowało `POST /api/analytics/bootstrap-current` (decyzja D4 z 10a).
*Alternatywa odrzucona:* dołożenie karty „Oś czasu importów" — to nowa funkcja, nie odbudowa.

**D3 — jeden wykres w całym bloku: linia sezonowości.** Wykres liniowy „średnia cena zakupu
wg miesiąca" (agregat po wszystkich markach, JEDNA seria) nad tabelą „4.4 Sezonowy wzorzec
cen". Cztery pozostałe karty to same tabele. Uzasadnienie formy (skill `dataviz`,
`references/choosing-a-form.md`): zmiana w czasie → linia; ~172 wiersze miesiąc × marka to
za dużo marek na osobne serie, a limit z `chart.tsx` to 4 serie. Jedna seria → bez legendy
(tytuł nazywa, co jest rysowane). Tabela pod wykresem obowiązkowa — jest.
*Alternatywy odrzucone:* wykresy słupkowe też w kartach 4.1/4.2 (więcej odstępstwa od
oryginału bez zysku); wielolinia top-4 marki (kolor musiałby należeć do marki, a nie do
rankingu — filtr przemalowałby ocalałe serie, czego reguły `chart.tsx` zakazują).
**To jest ODSTĘPSTWO od oryginału**, kontynuacja O-10a-3 — oryginał nie ma żadnych wykresów.
Nowy numer: **O-10e-1**.

**D4 — pasek postępu dostępności: 10e wydziela wspólny komponent.**
`pages/analityka/PasekDostepnosci.tsx` (port helpera `O()`, `frontend-index.js:27919-27935`),
dopisany do inwentarza w `pages/analityka/README.md` §9, żeby równoległy blok 10d
(karty „1.4/1.5") go REUŻYŁ zamiast pisać drugi. Ryzyko: jeśli 10d wejdzie wcześniej pod
inną nazwą, przy mergu trzeba będzie usunąć duplikat.

**Decyzje wykonawcze (moje, nie wymagały pytania):**

- **`days` niepoprawne → odtwarzamy zachowanie oryginału bez „poprawiania".**
  `Math.min(730, Math.max(1, parseInt(req.query.days || '60', 10)))` — dla `?days=abc` daje
  `NaN`. Zweryfikowane empirycznie: better-sqlite3 wiąże `NaN` jako `NULL` (nie rzuca),
  więc `data_aktualizacji < datetime('now','-' || NULL || ' days')` jest `NULL`/fałszem
  i zostają wyłącznie wiersze z `data_aktualizacji IS NULL`, a `JSON.stringify(NaN)` daje
  `"days": null`. Dokładnie to samo robi produkcja. Pokrywa to test jednostkowy.
- **`?days` idzie do `queryKey`, reszta filtruje się klientem.** To jedyna trasa 10e, która
  czyta `req.query` (`analytics_module.cjs:300`). Klucz budujemy jako JEDEN segment z pełnym
  adresem (`["/api/analytics/rotation/inactive?days=60"]`), zgodnie z wzorcem już używanym
  w `pages/Staging.tsx:60` i `pages/Historia.tsx:48` (`adresStrony`) — a nie jako dwa
  segmenty, bo `queryKey.join("/")` wstawiłoby ukośnik przed znakiem zapytania.
  Przykład w `pages/analityka/README.md` §2.2 pokazuje wariant dwusegmentowy — poprawiam go
  przy okazji.
- **Bez debounce'a na polu „Bez ruchu dni"** — oryginał go nie ma (`fe.js:28576-28583`,
  `onChange: e => l(e.target.value)`), a `staleTime: Infinity` sprawia, że raz pobrana
  wartość zostaje w cache.
- **Bez przycisków „CSV"** w kartach 4.1, 4.2 i „Rotacja" — oryginał je ma
  (`M("availability-products")`, `M("sell-through")`, `M("rotation-inactive")`), ale trasa
  `GET /api/analytics/export/{view}` należy do bloku **10f** i jeszcze nie istnieje.
  Ten sam wybór zrobiło 10a przy karcie marż; 10f dokłada wszystkie przyciski naraz.
- **Nowy plik testu GATE**, `analityka.dostepnosc.gate.test.ts`, zamiast dopisywania do
  `analityka.gate.test.ts` — trzy bloki analityki (10b, 10c, 10d) idą równolegle i wszystkie
  dopisywałyby do tego samego pliku.
- **Nie ruszamy `test/gate/dane.ts`** (plik wspólny, ryzyko konfliktu z równoległymi
  kartami). Bogatsze dane historii i `audit_log` powstają lokalnie w pliku testu
  jednostkowego, wzorem `analityka.agregaty.test.ts` (`stworzTestowaBaze()` + `db.insert`).

## Plan implementacji

### Krok 1 — backend: sześć agregatów (`rebuild/backend/src/repos/analityka.ts`)

Dopisujemy do istniejącego pliku, trzymając jego układ: jedna funkcja = jedna trasa,
SQL przepisany dosłownie, limity jako nazwane stałe. Nowe stałe:
`LIMIT_DOSTEPNOSCI = 500`, `LIMIT_SELL_THROUGH = 500`, `LIMIT_CYKLU_ZYCIA = 1000`,
`LIMIT_ROTACJI = 1000`, `LIMIT_OSI_IMPORTOW = 200`, `DNI_ROTACJI_MIN = 1`,
`DNI_ROTACJI_MAX = 730`, `DNI_ROTACJI_DOMYSLNE = 60`.

1. `dostepnoscProduktow(db): { hasHistory, rows }` — `:156-171`. **Dwie gałęzie**: przy
   historii `GROUP BY dostawca, kod` z `historia_cen` (+`GROUP_CONCAT(CASE WHEN stan <= 0
   THEN substr(zarejestrowano_at,1,7) END)`), bez historii — `products` z
   `CASE WHEN stan > 0 THEN 100 ELSE 0 END` i `NULL AS miesiaceBrakow`. Kolumny obu gałęzi
   RÓŻNIĄ SIĘ (`snapshoty` vs `stan`) — to zachowanie oryginału, nie ujednolicamy.
2. `tempoSchodzenia(db): { hasHistory, rows }` — `:173-184`. CTE + `LAG`, przepisane
   dosłownie razem z pułapką z D1; komentarz nad funkcją opisuje pułapkę i wskazuje wpis
   backlogu. Bez historii → `rows: []` (oryginał nie ma tu gałęzi zapasowej).
3. `sezonowoscMiesieczna(db): { hasHistory, rows }` — `:279-283`. `substr(...,6,2) AS miesiac`
   (numer miesiąca bez roku), `WHERE cena_zakupu > 0`, `ORDER BY marka, miesiac`, bez limitu.
4. `cyklZyciaModeli(db): { hasHistory, rows }` — `:285-289`. Dwie gałęzie: `historia_cen`
   (`ORDER BY ostatniRaz DESC`) i `products` (`ORDER BY produkty DESC`, `data_aktualizacji`
   jako źródło dat) — różne sortowania, to też zostaje 1:1.
5. `rotacjaNieaktywnych(db, dni): { days, rows }` — `:299-303`.
6. `osCzasuImportow(db): WpisOsiImportow[]` — `:334`, `audit_log`,
   `akcja IN ('import_z_url','import_pliku','import')`, `ORDER BY id DESC LIMIT 200`.
   Odbudowa realnie zapisuje dwie pierwsze akcje (`routes/import.ts:170`); `'import'`
   to martwy wariant w obu wersjach — zostaje, bo tak jest w oryginale.

Wzorzec surowego SQL z CTE/`LAG` przez Drizzle jest już w repo: `repos/suppliers.ts:36-60`.

### Krok 2 — backend: sześć tras (`rebuild/backend/src/routes/analytics.ts`)

Sześć `router.get(...)` z `requireAuth`, w kolejności rejestracji oryginału. Jedyna trasa
czytająca query to `rotation/inactive`; parsowanie `days` dokładnie jak w `:300`.

### Krok 3 — backend: testy

- **`test/analityka.dostepnosc.gate.test.ts`** (nowy) — GATE: sześć tras × (kontrakt +
  fixture) + 401 bez tokenu. Seed: `zasiejProdukty` + `zasiejHistorieCen`
  + `zasiejStagingZFixtures` (jak w 10a). `audit_log` **nie jest** zasiewany, żeby
  `importy-timeline` zwróciło `[]` zgodnie z fixture'em.
- **`test/analityka.dostepnosc.agregaty.test.ts`** (nowy) — kształt wiersza czterech tras
  z pustym fixture'em, obie gałęzie `hasHistory` w 1 i 4, `GROUP_CONCAT` miesięcy braków,
  zaciskanie `days` do [1, 730] wraz z przypadkiem `?days=abc` → `days: null`,
  limity, sortowania, oraz **test charakteryzacyjny pułapki z D1** (duplikat
  `(dostawca, kod, zarejestrowano_at)`).

### Krok 4 — frontend: typy i hooki (`pages/analityka/api.ts`)

Sześć typów wiersza + pięć hooków (`useDostepnoscProduktow`, `useTempoSchodzenia`,
`useSezonowoscMiesieczna`, `useCyklZyciaModeli`, `useRotacjeNieaktywnych(dni)`).
`importy-timeline` **nie dostaje hooka** (D2). Wszystkie typy z `| null` (`on401:
"returnNull"`).

### Krok 5 — frontend: generyczny filtr kliencki (`pages/analityka/filtrowanie.ts`)

Dziś jest tylko `zastosujFiltryMarz`. Dokładamy generyk:

```ts
export type MapowanieWymiarow<T> = Partial<Record<WymiarFiltra, (w: T) => string | null | undefined>>;
export function zastosujFiltry<T>(w: T[], wybor: WyborFiltrow, mapa: MapowanieWymiarow<T>): T[];
export function wymiaryZMapowania<T>(mapa: MapowanieWymiarow<T>): WymiarFiltra[];
```

`zastosujFiltryMarz` zostaje jako cienka nakładka na generyk — zachowanie identyczne, więc
`test/analityka.filtrowanie.test.ts` z 10a musi przejść **bez zmian** (to jest dowód, że
karta marż się nie popsuła). Wymiary sekcji: dostępność → `dostawcy`; tempo schodzenia →
`dostawcy`; sezonowość → `marki`; rotacja → `dostawcy, marki, modele, rozmiary`; cykl życia
→ `marki, modele`. Nieobsługiwane wymiary pokazuje istniejące `wymiaryNieobslugiwane`.

### Krok 6 — frontend: pasek postępu (`pages/analityka/PasekDostepnosci.tsx`, nowy)

Port `O(e, t = 100)` — `flex items-center gap-2`, tor `h-2 w-24 bg-muted rounded`,
wypełnienie `h-full bg-primary` o szerokości zaciśniętej do [0, 100], obok `font-mono
text-xs` z `formatujProcent`. 1:1 z `frontend-index.js:27919-27935`.

### Krok 7 — frontend: pięć sekcji (nowe pliki w `pages/analityka/`)

`SekcjaDostepnosciProduktow.tsx`, `SekcjaTempaSchodzenia.tsx`, `SekcjaSezonowosci.tsx`,
`SekcjaRotacji.tsx`, `SekcjaCykluZycia.tsx` — wzorowane na `SekcjaMarze.tsx`. Nagłówki kart
i kolumny tabel **1:1 z oryginałem** (`fe.js:28419-28631`), łącznie z `mono`/`right`.
`SekcjaSezonowosci` dokłada `LineChart` z `recharts` w `KontenerWykresu` (D3).
`SekcjaRotacji` niesie kontrolkę „Bez ruchu dni" (`Input`, `w-24 font-mono`) i układ karty
`p-4 space-y-3` — tu oryginał ma inny layout niż pozostałe karty.

### Krok 8 — frontend: montaż (`pages/Analityka.tsx`)

Zakładka `dostepnosc`: `ZakladkaWPrzygotowaniu` znika, wchodzą trzy sekcje w kolejności
4.1 → 4.2 → 4.4. Zakładka `marza`: **`SekcjaMarze` zostaje pierwsza, nietknięta**, pod nią
`SekcjaRotacji` i `SekcjaCykluZycia` zamiast `ZakladkaWPrzygotowaniu`. Stan `dni`
(`useState("60")`) mieszka w `Analityka.tsx` albo w `SekcjaRotacji` — decyzja przy
implementacji, oryginał trzyma go w komponencie widoku.

### Krok 9 — frontend: testy

- `test/msw/kontrakt.ts` — sześć loaderów na wzór `analitykaZFixtura()` (zdejmują `_przyciete`).
- `test/analityka.dostepnosc.test.tsx` (nowy) — render `<App/>`, przejście na zakładki
  `dostepnosc` i `marza`, asercje na nagłówkach kart, kolumnach i pasku postępu; osobny
  przypadek: zmiana „Bez ruchu dni" trafia do URL zapytania.
- `test/analityka.filtrowanie.test.ts` — dopisujemy przypadki generyka `zastosujFiltry`
  (istniejące przypadki 10a zostają nietknięte).

### Krok 10 — dokumentacja

`docs/rebuild-backlog.md` — nowy wpis o pułapce SQL z D1 (⬜ do decyzji Ani).
Reszta (roadmapa §5, README sekcji, inwentarz 10a) idzie przez doc-checkerów w Fazie 5.

## Strategia testów

**GATE odbudowy (obowiązkowy).** Sześć ścieżek z sekcji „Kontrakt i fixtures" ×
`sprawdzZgodnoscZKontraktem` (ścieżka istnieje, status zadeklarowany, ciało to JSON)
+ `sprawdzZgodnoscZFixture` (kształt 1:1). Plus 401 bez tokenu dla każdej z sześciu.
Świadomość słabości: kontrakt nie ma schematów odpowiedzi, a cztery fixtures są puste —
GATE dowodzi tu koperty (`{hasHistory, rows}` / `{days, rows}` / goła tablica) i braku
`_przyciete`, ale **nie** kształtu wiersza czterech tras.

**Testy jednostkowe backendu** (`analityka.dostepnosc.agregaty.test.ts`) — to jest realna
siatka tego bloku: kształt wiersza czterech tras, obie gałęzie `hasHistory`, progi/limity,
zaciskanie `days` (w tym `?days=abc` → `days: null`), pułapka D1.

**Testy frontendu** — widok na MSW z fixtures (kształt jak w produkcji, bez `_przyciete`)
+ jednostkowe testy filtrowania. Regresja karty marż z 10a: `analityka.test.tsx`
i `analityka.filtrowanie.test.ts` muszą przejść **bez modyfikacji**.

**Bramki:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w
`rebuild/backend/` i `rebuild/frontend/` (Node ≥ 20).

**Czego nie robimy:** E2E (brak w projekcie); testów na `GET /api/analytics/export/{view}`
(blok 10f); mocków bazy (testy jadą na realnym SQLite w katalogu tymczasowym).

## Poza zakresem

- Przyciski „CSV" i trasa `GET /api/analytics/export/{view}` — blok **10f**.
- Pulpit `/` — blok **10f**.
- Trasy bloków 10b (ceny), 10c (EAN), 10d (dostawcy) — równoległe karty.
- UI dla `importy-timeline` (D2).
- Naprawa pułapki SQL w `sell-through` (D1 — tylko wpis w backlogu).
- Ożywianie `currentWhere()` z oryginału (martwy kod, decyzja D2 z 10a).

## Definition of done

- [ ] Sześć tras `/api/analytics/*` odpowiada kształtem 1:1 z fixtures i waliduje się wg `openapi.yaml`
- [ ] Żadna odpowiedź nie zawiera `_przyciete`
- [ ] Kształt wiersza czterech tras z pustym fixture'em pokryty testem jednostkowym
- [ ] Pułapka SQL `sell-through` udokumentowana testem charakteryzacyjnym + wpisem w backlogu
- [ ] Zakładka `dostepnosc` niesie trzy karty (4.1, 4.2, 4.4) z kolumnami 1:1 z oryginałem
- [ ] Zakładka `marza`: karta marż z 10a nietknięta, pod nią rotacja i cykl życia
- [ ] Pole „Bez ruchu dni" zmienia `?days` w zapytaniu (jedyny filtr serwerowy bloku)
- [ ] Wykres sezonowości: jedna seria, tabela pod nim, paleta z `chart.tsx` nieruszona
- [ ] `PasekDostepnosci` wydzielony i opisany w `pages/analityka/README.md`
- [ ] Testy 10a (`analityka.test.tsx`, `analityka.filtrowanie.test.ts`) przechodzą bez zmian
- [ ] `lint`, `typecheck`, `build`, `test` czyste w backendzie i frontendzie
