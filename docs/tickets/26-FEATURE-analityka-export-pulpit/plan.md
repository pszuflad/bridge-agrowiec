# 26-FEATURE-analityka-export-pulpit — Iteracja 10, blok 10f: export CSV + Pulpit

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `feature/26-analityka-export-pulpit`
> Worktree: `.worktrees/26-FEATURE-analityka-export-pulpit`

## Opis ticketa

Realizacja Iteracji 10, bloku **10f** (BE+FE) wg `docs/rebuild-roadmap.md` §5 — ostatni blok
analityki (10a–10e zamknięte). Dwie części:

**A — Export CSV.** Ostatnia, 27. trasa modułu analityki: `GET /api/analytics/export/{view}`
(`mirror/backend/analytics_module.cjs:305`) — parametr ścieżki, CSV przez `sendRows`, dziesięć
widoków, każdy z **własnym SQL-em**, innym niż trasa dashboardu o tej samej nazwie. Do tego
przyciski „CSV" w sekcjach `/analityka`, świadomie pominięte przez bloki 10a–10e, bo trasa
eksportu jeszcze nie istniała.

**B — Pulpit `/`.** Odtworzenie strony głównej oryginału (`deminified/frontend-index.js:16836-17090`,
funkcja `N2`) — ostatni placeholder Iteracji 10 w `src/pages/placeholdery.ts`.

## Kontekst

### Co powiedział zwiad (i gdzie prompt ticketa rozminął się z oryginałem)

Prompt ticketa i `docs/analityka-bloki-10b-10f.md` §8.2 sugerują, że Pulpit ma reużyć
`useKpi()`/`useStatusHistorii()`/`NaglowekKpi.tsx` z bloku 10a oraz `pobierzAlerty()` z I6.
**Oryginalny Pulpit nie woła ani jednej trasy `/api/analytics/*` i nie woła `/api/alerts`.**
Zweryfikowane bezpośrednio w `deminified/frontend-index.js:16836-17090` (`N2`):

- pobiera `["/api/products"]`, `["/api/staging"]`, `["/api/suppliers"]`, `["/api/history"]`;
- cztery kafle KPI liczy **lokalnie** (`e?.length`, filtry `b2()` = „w tym tygodniu",
  `j2()` = „dzisiaj"), a kafel jest komponentem `Si()` (`:16794-16836`) z **ikoną, `href`
  i trendem up/none** — `NaglowekKpi` z 10a nie ma żadnej z tych rzeczy i pokazuje inne cztery
  liczby (to samo w sobie odstępstwo O-10a-1);
- alerty wyprowadza **klientem** z `/api/products` przez `pv()` (`:16631-16745`) — pseudo-alerty
  katalogowe (marża ujemna/niska, „nie-opona" przez klasyfikator `v2()` z `:16589`, brak importu
  dostawcy ≥7/≥30 dni), filtrowane po `status === "nowy"`.

To dokładnie to samo zjawisko, które Iteracja 6 odnotowała jako **backlog #26** („widok `/alerty`
w oryginale NIE czyta `/api/alerts`") i porzuciła świadomą decyzją D1. Rozjazd zgłoszony
użytkownikowi w Kroku 3 — rozstrzygnięcia niżej w „Decyzje".

### Czego blok NIE buduje od nowa (inwentarz 10a–10e)

`bezpiecznieWiersze()` (port `safeAll`, `repos/analityka.ts:1260`) · `NaglowekSekcji` z gotowym
slotem `obok?: ReactNode` (komentarz w kodzie mówi wprost „przycisk CSV dołoży blok 10f") ·
`TabelaAnalityki` · `formatowanie.ts` · klient alertów `pobierzAlerty()` + typ `Alert` ·
`GET /api/history` (I5, trasa i fixture) · `GET /api/products`, `/api/staging`, `/api/suppliers`
(I2/3b) · harness GATE.

### Pułapki potwierdzone samodzielnie, nie przepisane z opisu

1. **„LIMIT 5000" NIE dotyczy wszystkich widoków.** Mają go tylko `suppliers-lifecycle`,
   `prices-last`, `availability-products`, `sell-through`, `margins`, `rotation-inactive` (6/10).
   `suppliers-stability`, `suppliers-stock`, `ean-comparison`, `unique` **nie mają LIMIT-u
   w ogóle** (`analytics_module.cjs:311-316`). Prompt ticketa uogólnił to niedokładnie —
   portujemy SQL dosłownie, bez dokładania limitu, którego oryginał nie ma.
2. **Nieznany `{view}` → `sendRows([])` → status 200 i sam BOM**, nie 404.
3. **Eksport nie niesie żadnych parametrów.** `M(e)` (`:27938-27940`) to
   `window.location.href = Vd + "/api/analytics/export/" + e` — bez query stringu, bez filtrów
   globalnych. CSV nie odzwierciedla tego, co użytkownik widzi w tabeli.
4. **`/api/products` i `/api/staging` mają DWA kształty odpowiedzi.** Bez parametrów oddają
   **gołą tablicę**, z `?limit`/`?dostawca` — kopertę `{items,total,limit,offset}` (fixtures
   zamrażają wariant drugi). Pulpit woła je bez parametrów, więc `e?.length` działa —
   to już obsłużone w `routes/products.ts` i `routes/staging.ts`, nie ruszamy.
5. **Cookie sesji przejdzie przy nawigacji przeglądarki.** `bridge_session` jest
   `HttpOnly; Path=/; SameSite=Lax` (`src/auth/cookie.ts`), a `Lax` **wysyła cookie przy
   nawigacji najwyższego poziomu metodą GET** — czyli dokładnie przy `window.location.href`.
   Staging jest same-origin (frontend pod `/`, API proxy `/api/*` — `docs/deploy-setup.md`),
   więc nie wchodzi w grę nawet kwestia cross-site. `wyciagnijToken()`
   (`src/middleware/auth.ts`) czyta Bearer **albo** cookie, więc `requireAuth` przepuści.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

| Ścieżka | Fixture | Jak sprawdzamy |
|---|---|---|
| `GET /api/analytics/export/{view}` (`contract/openapi.yaml:178-188`) | **BRAK** (metoda GET nienagrana — trasa oddaje CSV, nie JSON) | kontrakt: ścieżka istnieje + status 200 zadeklarowany; kształt: testy jednostkowe formatu CSV i wierszy |
| `GET /api/history` | `contract/fixtures/GET_history.json` | pełny GATE (kształt 1:1) — już zielony od I5, Pulpit tylko konsumuje |
| `GET /api/alerts` | `contract/fixtures/GET_alerts.json` | pełny GATE — zielony od I6, Pulpit tylko konsumuje |
| `GET /api/products`, `/api/staging`, `/api/suppliers` | odpowiednie `GET_*.json` | zielone od I2/3b — Pulpit tylko konsumuje, bez zmian w backendzie |

**Kontrakt milczy o kształcie odpowiedzi analityki** (`openapi.yaml` ma dla wszystkich 27 tras
tylko `responses: {200, 400, 401}` + `security`) — potwierdzone, to znany stan opisany
w `docs/analityka-bloki-10b-10f.md` §1.3. Dla `export/{view}` kontrakt nie deklaruje też
żadnego `content` — `text/csv` go więc **nie narusza**.

**Rozjazd techniczny do obejścia bez ruszania wspólnej maszynerii GATE.**
`sprawdzZgodnoscZKontraktem()` (`test/gate/asercje.ts:17`) zawsze podaje `contentType`
do `sprawdzOdpowiedz()`, a ta zgłasza naruszenie dla wszystkiego, co nie jest
`application/json` (`test/gate/kontrakt.ts:81-85`). Ale sama `sprawdzOdpowiedz()` przyjmuje
`contentType` jako **opcjonalne** i pomija sprawdzenie, gdy go nie ma. Blok 10f korzysta z tej
furtki: woła `wczytajKontrakt().sprawdzOdpowiedz({metoda, sciezka, status})` bez `contentType`
przez nowy, nazwany pomocnik, i **osobno** asertuje `content-type: text/csv; charset=utf-8`.
Zero zmian w zachowaniu dla bloków 1–10e. Precedens na pomijanie wspólnej asercji przy
udokumentowanym rozjeździe: `test/auth.gate.test.ts:67-82` (`GET /api/me` 401).

## Decyzje

Rozstrzygnięcia użytkownika z 2026-09-04 (runda pytań po zwiadzie):

- **D1 — alerty Pulpitu: realne `/api/alerts`, nie port `pv()`.** Karta „Najnowsze
  powiadomienia" i kafel „Aktywne alerty" stoją na `pobierzAlerty()` z I6 (filtr
  `status === "nowy"`, poziom `krytyczny`/`ostrzezenie`, sort poziom→data malejąco, `slice(0,5)`).
  *Za:* spójność z widokiem `/alerty` — „Zobacz wszystkie" prowadzi do TYCH SAMYCH alertów;
  typ `Alert` (`poziom, typ, opis, dostawca, data, status`) pokrywa się co do pola z tym,
  czego karta oryginału używa, więc layout zostaje 1:1. *Koszt:* liczby inne niż w produkcji —
  **kontynuacja odstępstwa D1 z I6 (backlog #26)**, nie nowe zjawisko.
- **D2 — kafle KPI: wierny port kafli oryginału, nie `NaglowekKpi`.** Port `Si()` (ikona,
  wartość, trend, `href`) plus lokalne liczenie z `/api/products` i `/api/staging`.
  *Za:* 1:1 z produkcją, którą Ania zna; klikalne skróty do `/katalog`, `/staging`, `/alerty`,
  `/historia`. *Przeciw wariantowi „reużyj":* `NaglowekKpi` pokazuje inne cztery liczby, inne
  etykiety, bez linków i trendu, plus banner o historii cen, którego Pulpit nie ma — byłoby to
  przeniesienie nagłówka analityki na stronę główną, nie odbudowa widoku `/`.
- **D3 — kafel „Ostatni eksport CSV" odtworzony 1:1 jako TRWALE martwy.** Oryginał szuka
  `r.find(e => e.typ === "eksport")` w odpowiedzi `/api/history`, a ta trasa oddaje tabelę
  `history`, której wiersz **nie ma pola `typ`** (`GET_history.json`:
  `{id,data,kodProduktu,nazwa,pole,staraWartosc,nowaWartosc,zrodlo,kto,wykonalUzytkownikId}`).
  Kafel zawsze pokaże „—" / „Brak eksportów ani importów". *Za:* zgodne z regułą projektu
  (tak samo dowieziono trwale puste karty „4.1"/„4.2" w 10e, backlog #32). Usterka trafia
  do backlogu jako nowy wpis do decyzji Ani.
- **D4 — przyciski „CSV" we wszystkich dziesięciu sekcjach oryginału, 1:1** — łącznie
  z dwoma, które oddają pusty plik (`availability-products`, `sell-through`, backlog #32).
  *Za:* wierność i spójność z 10e, które dowiozło te dwie karty jako trwale puste.
- **D5 (zaklepane w promptcie, bez zmian) — `POST /api/analytics/bootstrap-current` zostaje
  BEZ UI** (decyzja D4 z 10a: trasa nieidempotentna, `INSERT…SELECT` bez `ON CONFLICT`,
  backlog #31). Blok 10f nie dokłada mu przycisku.

### Świadome odstępstwa od oryginału wprowadzane przez ten blok

| # | Odstępstwo | Podstawa |
|---|---|---|
| O-10f-1 | Karta powiadomień i kafel alertów na realnych `/api/alerts` zamiast pseudo-alertów `pv()` | D1 — kontynuacja D1 z I6, backlog #26 |

Poza tym blok jest odbudową 1:1. `requireAuth` na `export/{view}` **nie jest odstępstwem** —
kontrakt wymaga go wprost (`security: [{bearerAuth}, {cookieAuth}]`), a oryginał podaje
`requireAuth` w rejestracji (`analytics_module.cjs:305`).

## Plan implementacji

### Krok 1 — Backend: format CSV (port `toCsv`/`csvEscape`)

**Nowy:** `rebuild/backend/src/analityka/csv.ts`
- `escapujKomorke(v)` — port `csvEscape` (`:56`): `null`/`undefined` → `""`; `String(v)`;
  gdy pasuje `/[;"\n\r]/` → otocz `"` i podwój wewnętrzne `"`.
- `naCsv(wiersze)` — port `toCsv` (`:57`): pusta lista → **sam `"﻿"`**; inaczej
  `"﻿"` + nagłówek z `Object.keys(wiersze[0])` sklejony `;` + wiersze, złączone `"\n"`.
  Kolumny bierzemy z PIERWSZEGO wiersza — dosłownie jak oryginał.

**Test:** `rebuild/backend/test/analityka.csv.test.ts` — jednostkowy, bez serwera:
średnik jako separator, BOM na początku, podwajanie cudzysłowów, cytowanie pól z `;`/`"`/`\n`/`\r`,
`null` → puste pole, pusta lista → sam BOM, nagłówek z kluczy pierwszego wiersza.

### Krok 2 — Backend: dziesięć zapytań eksportu

**Nowy:** `rebuild/backend/src/repos/analityka-eksport.ts` — osobny plik, bo
`repos/analityka.ts` ma już ~1300 linii i jest wspólnym punktem merge'u pięciu bloków.
- Eksport `bezpiecznieWiersze` z `repos/analityka.ts` (dziś funkcja modułowa bez `export`)
  i użycie go tu **bez zmian** — port `safeAll`, który zamienia błąd SQL w pustą listę.
  To jedyna zmiana w `repos/analityka.ts`.
- Dziesięć funkcji, **każda z dosłownym SQL-em z `analytics_module.cjs:311-320`**, plus mapa
  `WIDOKI_EKSPORTU: Record<string, (db) => unknown[]>`:

  | `{view}` | źródło | LIMIT | uwagi |
  |---|---|---|---|
  | `suppliers-stability` | `historia_cen` GROUP BY dostawca | **brak** | inne kolumny niż dashboard `suppliers/stability` |
  | `suppliers-lifecycle` | `staging_items` WHERE typ_zmiany IN (…) | 5000 | |
  | `suppliers-stock` | `products` GROUP BY dostawca | **brak** | |
  | `ean-comparison` | `products` GROUP BY ean HAVING ≥2 dostawców | **brak** | |
  | `unique` | `products` GROUP BY ean HAVING =1 dostawca | **brak** | |
  | `prices-last` | `staging_items` WHERE cena_zakupu_stara IS NOT NULL | 5000 | |
  | `availability-products` | `historia_cen` | 5000 | **`nazwa` nie istnieje → sam BOM** (#32) |
  | `sell-through` | `historia_cen` + `LAG() OVER` | 5000 | **`nazwa` nie istnieje → sam BOM** (#32, #33) |
  | `margins` | `products`, **per produkt** | 5000 | dashboard `/margins` grupuje — inny SQL |
  | `rotation-inactive` | `products` ORDER BY data_aktualizacji | 5000 | dashboard filtruje `?days`, eksport NIE |

**Test:** `rebuild/backend/test/analityka.eksport.agregaty.test.ts` — na zasianej bazie
w katalogu tymczasowym: kształt wiersza każdego widoku (nazwy kolumn 1:1 z aliasami SQL),
oraz **charakteryzacja dwóch zepsutych widoków** — mimo zasianej `historia_cen` oddają pustą
listę (gdy kiedyś zaczną zwracać wiersze, test zapali).

### Krok 3 — Backend: trasa `GET /api/analytics/export/:view`

`rebuild/backend/src/routes/analytics.ts` — dopisać 27. trasę, port `:305-322`:
```
router.get("/api/analytics/export/:view", requireAuth, (req, res) => {
  const widok = req.params.view;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=${widok}.csv`);
  res.send(naCsv(WIDOKI_EKSPORTU[widok]?.(db) ?? []));   // nieznany widok → sam BOM, 200
});
```
Z zachowaniem `try/catch → 500 {error}` z oryginału. **Bez sanityzacji `filename`** —
port 1:1; obserwacja trafia do backlogu, nie do kodu.
Zaktualizować nagłówek pliku: 26/27 → 27/27, blok 10f domknięty.

**Test:** `rebuild/backend/test/analityka.eksport.gate.test.ts`
- kontrakt: `sprawdzOdpowiedz({metoda:"GET", sciezka:"/api/analytics/export/margins", status:200})`
  bez `contentType` + osobna asercja `content-type: text/csv; charset=utf-8`
  i `content-disposition: attachment; filename=margins.csv`;
- 401 bez tokenu;
- wszystkie dziesięć widoków → 200 i ciało zaczynające się od `﻿`;
- nieznany widok → 200 i **dokładnie** `﻿`;
- `availability-products` i `sell-through` → dokładnie `﻿` mimo danych w `historia_cen`.

### Krok 4 — Backend: dowód, że eksport działa na samym cookie (bez `Authorization`)

**Nowy test integracyjny** w `analityka.eksport.gate.test.ts`: prawdziwy serwer na porcie
efemerycznym → `POST /api/login` → wyjęcie `Set-Cookie` → `GET /api/analytics/export/margins`
z **wyłącznie** nagłówkiem `Cookie: bridge_session=…` i **bez** `Authorization` → 200 `text/csv`.
Dodatkowo asercja atrybutów cookie (`HttpOnly`, `Path=/`, `SameSite=Lax`) — to one decydują,
czy nawigacja przeglądarki je poniesie. To najmocniejsza weryfikacja dostępna przed merge'em;
potwierdzenie na samym stagingu jest po auto-deployu (odnotowane w `raport.md`).

### Krok 5 — Frontend: przycisk „CSV"

**Nowy:** `rebuild/frontend/src/pages/analityka/eksport.tsx`
- `adresEksportu(widok)` → `` `${BAZA_API}/api/analytics/export/${widok}` `` — port `M()`,
  bez query stringu (funkcja czysta, testowalna);
- `<PrzyciskCsv widok="…" />` → `<Button variant="outline" size="sm" onClick={() => { window.location.href = adresEksportu(widok); }} data-testid={`csv-${widok}`}>CSV</Button>`
  — **nawigacja, nie `fetch`**, żeby cookie zadziałało tak jak w oryginale.

Wpięcie w dziesięć kart (mapowanie zweryfikowane po `M("…")` w oryginale — `:28065`, `:28109`,
`:28147`, `:28190`, `:28233`, `:28310`, `:28432`, `:28470`, `:28531`, `:28573`):

| `{view}` | karta | plik |
|---|---|---|
| `suppliers-stability` | 1.1 Stabilność cennika dostawcy | `SekcjaStabilnoscDostawcow.tsx` * |
| `suppliers-lifecycle` | 1.2 Nowości i wycofania | `SekcjaCyklZyciaDostawcow.tsx` * |
| `suppliers-stock` | 1.4 / 1.5 Stan i dostępność dostawcy | `SekcjaStanDostawcow.tsx` * |
| `ean-comparison` | 2.1-2.4 Porównanie cen po EAN | `SekcjaEan.tsx` * |
| `unique` | 2.5 … | `SekcjaEan.tsx` * |
| `prices-last` | 3.1 Zmiany cen z ostatnich importów | `SekcjaCeny.tsx` (`KartaCen`) * |
| `availability-products` | 4.1 Historia dostępności pozycji | `SekcjaDostepnosciProduktow.tsx` |
| `sell-through` | 4.2 Tempo schodzenia z magazynu | `SekcjaTempaSchodzenia.tsx` |
| `margins` | Marża per dostawca/kategoria/marka | `SekcjaMarze.tsx` |
| `rotation-inactive` | Rotacja / produkty bez aktualizacji | `SekcjaRotacji.tsx` |

Cztery ostatnie używają `NaglowekSekcji` → wystarczy `obok={<PrzyciskCsv …/>}`, slot już jest.
Sekcje oznaczone `*` mają własne nagłówki inline o **identycznym markupie**
(`<div className="border-b px-4 py-3"><div className="text-sm font-semibold">…`) — dostają
`flex items-center justify-between gap-2` wokół tytułu i przycisk, dokładnie tak, jak robi to
`NaglowekSekcji`. Nie przepisujemy ich na `NaglowekSekcji`: te sekcje nie liczą notek o filtrach,
więc konwersja rozdęłaby diff i ruszyła testy trzech innych bloków bez zysku.

### Krok 6 — Frontend: Pulpit `/`

**Nowe:**
- `rebuild/frontend/src/pages/pulpit/api.ts` — hooki na `["/api/products"]`, `["/api/staging"]`,
  `["/api/suppliers"]`, `["/api/history"]` (domyślny `queryFn`, klucz = ścieżka, `| null`
  z `on401: returnNull`) + typy z fixtures. Alerty przez **istniejące** `pobierzAlerty()`
  z `pages/alerty/api.ts`, `queryKey: ["/api/alerts"]` — bez drugiego klienta.
- `rebuild/frontend/src/pages/pulpit/kpi.ts` — **czyste funkcje** (testowalne bez DOM):
  `czyDzisiaj()` (port `j2`), `czyWTymTygodniu()` (port `b2`), `opisTrenduProduktow()`,
  `opisTrenduStagingu()`, `najswiezszeAlerty(alerty)` (filtr `status==="nowy"` +
  `poziom ∈ {krytyczny, ostrzezenie}`, sort poziom→data malejąco, `slice(0,5)`),
  `sortujDostawcowPoKodzie()` (port `parseInt(kod.replace(/\D/g,""))`),
  `ostatniEksport(history)`/`ostatniImport(history)` (port `find(e => e.typ === …)` —
  **z komentarzem, że pole `typ` w tej odpowiedzi nie istnieje**, D3).
- `rebuild/frontend/src/pages/pulpit/KafelKpi.tsx` — port `Si()`: ikona, etykieta wersalikami,
  wartość `font-mono tabular-nums`, trend (`up` zielony ze strzałką / `none` szary), opcjonalny
  `href` opakowujący kartę w `Link`, `data-testid` + `${testId}-value`.
- `rebuild/frontend/src/pages/pulpit/sformatujWzglednie.ts` — port `Bu()` („przed chwilą",
  „N min temu", „dzisiaj, HH:MM", „wczoraj, HH:MM", „N dni temu", data `pl-PL`).
  ⚠ Najpierw sprawdzić, czy `sformatujOstatnia()` z `pages/alerty/grupowanie.ts:162` nie jest
  tą samą funkcją — jeśli tak, reużyć zamiast pisać drugą (DRY; ten sam błąd popełniły
  równolegle 10c i 10d przy filtrze dostawców).
- `rebuild/frontend/src/pages/Pulpit.tsx` — złożenie: `PageHeader` („Pulpit" / „Codzienny obraz
  kanału dostawców i katalogu produktów"), siatka `grid-cols-2 lg:grid-cols-4` czterech kafli,
  karta „Najnowsze powiadomienia" (**renderowana tylko gdy są alerty** — `o.length > 0`
  w oryginale) z przyciskiem „Zobacz wszystkie" → `/alerty` i pięcioma wierszami linkującymi
  do `/alerty`, karta „Ostatnia aktywność dostawców" (9 kolumn, sort po numerze w kodzie,
  badge statusu OK/Błąd/Wstrzymany) — wszystko z etykietami PL verbatim z `N2`.

**Zmiany:** `rebuild/frontend/src/pages/placeholdery.ts` — usunąć wpis `/` (zostają dwa:
`/atrybuty`, `/moje-konto`; zaktualizować komentarz nagłówkowy o zdjętych trasach).
`rebuild/frontend/src/App.tsx` — wpiąć `Pulpit` pod `/` (liczba tras routera bez zmian: 12).

### Krok 7 — Testy frontendu

- `rebuild/frontend/test/pulpit.kpi.test.ts` — jednostkowy, bez DOM: predykaty dat, wybór
  i sortowanie pięciu alertów, sortowanie dostawców po numerze w kodzie, „ostatni eksport"
  na odpowiedzi `/api/history` bez pola `typ` (zamrożenie D3).
- `rebuild/frontend/test/pulpit.test.tsx` — widok przez MSW na danych z fixtures (loader
  z `test/msw/kontrakt.ts`, **zdejmujący klucze na `_`**): cztery kafle z liczbami i linkami,
  karta powiadomień ≤5 pozycji, **pusty `GET /api/history` → `[]` nie jest błędem**
  (kafel „—", widok się renderuje), brak alertów → karty powiadomień nie ma.
- `rebuild/frontend/test/analityka.eksport.test.tsx` — dziesięć przycisków „CSV" obecnych
  w swoich kartach + `adresEksportu()` buduje adres bez query stringu.
- Dopisać handlery MSW nowych tras tam, gdzie `onUnhandledRequest: "error"` tego wymaga.

### Krok 8 — Dokumentacja

`docs/rebuild-backlog.md` — nowy wpis: kafel „Ostatni eksport CSV" trwale martwy (D3), status
⬜ do decyzji Ani; dopisek przy #32 i #33, że dwa widoki eksportu zostały odtworzone w 10f;
dopisek o braku sanityzacji `filename` w `Content-Disposition`.
`docs/rebuild-roadmap.md` + `docs/analityka-bloki-10b-10f.md` + `pages/analityka/README.md` —
zamknięcie bloku 10f i **całej Iteracji 10** (§4 i §5) — realizuje Faza 5 przez doc-checkerów.

## Strategia testów

- **GATE (kontrakt):** `export/{view}` — ścieżka i status 200 wg `openapi.yaml`, bez asercji
  JSON-a (kontrakt nie deklaruje `content`), plus jawne sprawdzenie `text/csv` i nagłówka
  `Content-Disposition`. Trasy konsumowane przez Pulpit (`/api/history`, `/api/alerts`,
  `/api/products`, `/api/staging`, `/api/suppliers`) mają zielony GATE od I2/3b/I5/I6 — blok
  ich nie modyfikuje, więc uruchamiamy je jako regresję, nie piszemy od nowa.
- **GATE (fixtures):** dla `export/{view}` **nie istnieje** — nagrywarka nie zapisała tej trasy,
  bo nie oddaje JSON-a. Ciężar kształtu niosą testy jednostkowe (Krok 2) i format CSV (Krok 1).
  To jest zadeklarowana, znana luka, nie obejście gate'a.
- **Jednostkowe:** format CSV; dziesięć kształtów wiersza eksportu; czyste funkcje Pulpitu.
- **Integracyjne:** eksport na samym cookie sesji, bez `Authorization` (Krok 4) — prawdziwy
  serwer, prawdziwa baza w katalogu tymczasowym, port efemeryczny.
- **Charakteryzacja:** dwa widoki eksportu oddające sam BOM mimo danych (#32).
- **Pomijamy E2E** — projekt ich nie ma; ekwiwalentem jest test widoku na MSW.

## Poza zakresem

- Dashboardy 10a–10e (zrobione).
- Naprawa backlogu #32 (`historia_cen.nazwa`) i #33 (okno po niepełnym `GROUP BY`) —
  odtwarzamy zachowanie produkcji, naprawa czeka na decyzję Ani.
- Przycisk dla `POST /api/analytics/bootstrap-current` (D5, backlog #31).
- Przepięcie kafli `NaglowekKpi` na dane z 10c (odstępstwo O-10a-1) — osobna decyzja
  odnotowana w roadmapie przy bloku 10c, nie w zakresie 10f.
- Powrót pseudo-alertów katalogowych `pv()` (backlog #26) — D1 utrzymuje decyzję z I6.
- Sanityzacja `filename` w `Content-Disposition` — port 1:1, obserwacja do backlogu.

## Definition of done

- [ ] `GET /api/analytics/export/{view}` obsługuje wszystkie dziesięć widoków oryginału,
      każdy ze swoim własnym SQL-em (nie z danych dashboardu), z LIMIT-ami dokładnie tam,
      gdzie ma je oryginał (6 z 10).
- [ ] Format CSV zgodny z `toCsv`/`csvEscape`: średnik, BOM, podwajane cudzysłowy, cytowanie
      pól z `;`/`"`/nowej linii, nagłówek z kluczy pierwszego wiersza, pusty wynik = sam BOM.
- [ ] Nieznany `{view}` → 200 i sam BOM (nie 404).
- [ ] `export/availability-products` i `export/sell-through` oddają sam BOM mimo danych
      w `historia_cen` — zamrożone testem charakteryzacyjnym (#32).
- [ ] Eksport działa na samym cookie `bridge_session`, bez nagłówka `Authorization` —
      dowiedzione testem integracyjnym na prawdziwym serwerze.
- [ ] Przyciski „CSV" w dziesięciu kartach `/analityka`, jako nawigacja przeglądarki.
- [ ] Pulpit `/` renderuje cztery kafle KPI z linkami i trendami, kartę „Najnowsze
      powiadomienia" (status `nowy`, ≤5) i tabelę „Ostatnia aktywność dostawców".
- [ ] Pusty `GET /api/history` (`[]`) nie jest traktowany jak błąd — kafel „—", widok żyje.
- [ ] `/` zdjęte z `placeholdery.ts` i wpięte w `App.tsx`; liczba tras routera nadal 12.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` czyste w `rebuild/backend`
      i `rebuild/frontend`.
- [ ] Roadmapa: blok 10f i **cała Iteracja 10** oznaczone ✅ w §4 i §5; backlog zaktualizowany.
