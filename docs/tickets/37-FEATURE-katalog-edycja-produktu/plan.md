# 37-FEATURE-katalog-edycja-produktu — Edycja katalogu: dialog `LT()` + menu „Akcje"

> Status: Draft
> Branch: `feature/37-katalog-edycja-produktu`
> Worktree: `.worktrees/37-FEATURE-katalog-edycja-produktu`
> Iteracja 12, sesja **12c** (FRONTEND). Zależy od 12a (zmerge'owane). Niezależna od 12b.

## Opis ticketa

Realizacja Iteracji 12, sesji 12c wg `docs/rebuild-roadmap.md` §5 („Iteracja 12", sesja 12c
+ nota z 7c o dialogu `LT()`).

**CEL (Ania klika):** w `/katalog` edytuje produkt (modal), wstrzymuje/aktywuje i usuwa —
natywnie. Znosi odstępstwo **D4 z I2** (dziś jest tylko podgląd read-only).

Zakres wg promptu: port dialogu `LT()` (selecty słownikowe z `["/api/atrybuty"]`, override'y
z `["/api/overrides", dostawca, kod]` z możliwością kasowania, zapis `PATCH /api/products/{id}`
ograniczony do pól edytowalnych z 12a) oraz menu „Akcje" w wierszu tabeli (Edytuj /
Wstrzymaj-Aktywuj / Usuń, „Historia" `disabled`), z invalidacjami po każdej mutacji.

## Kontekst

**Co jest gotowe.** Backend mutacji produktów dowieziony w 12a (`35-FEATURE-mutacje-produktow-backend`):
`PATCH`/`PUT`/`DELETE /api/products/{id}` (`rebuild/backend/src/routes/products.ts:199-298`),
lista 42 pól edytowalnych `POLA_EDYTOWALNE_PRODUKTU` (`rebuild/backend/src/repos/products.ts:184-231`),
`GET /api/overrides?dostawca&kod` + `DELETE /api/overrides/{id}` gotowe od 3d-2
(`rebuild/backend/src/routes/overrides.ts:33-39`). **Bez tego frontendu te trasy nie mają
z czego być wołane.**

**Czego brakuje po stronie FE.** `rebuild/frontend/src/pages/katalog/` ma wyłącznie
`PodgladProduktu.tsx` — modal READ-ONLY wniesiony w I2 jako świadome odstępstwo D4. Ostatnia
kolumna tabeli (`TabelaProduktow.tsx:214-226`) to pojedynczy przycisk „Eye" otwierający ten
podgląd. Zero mutacji produktu w całym widoku.

**Oryginał — ustalenia potwierdzone w kodzie (nie z nazw funkcji).**

- `LT()` (`deminified/frontend-index.js:23909-24121`) — modal edycji, **42 klucze payloadu**,
  otwierany z menu wierszowego (`:23780`, `onClick: () => T(e)`), renderowany raz na poziomie
  widoku (`:23896`).
- Menu „Akcje" (`:23763-23814`) — trigger `EllipsisVertical`, `data-testid="button-actions-${id}"`.
  **Kolejność pozycji: Edytuj → Historia (disabled) → separator → Wstrzymaj/Aktywuj → Usuń.**
  ⚠ To korekta wobec brzmienia promptu, który wymieniał „Edytuj / Wstrzymaj-Aktywuj / Usuń,
  Historia disabled" — w oryginale „Historia" stoi DRUGA, a separator dzieli ją od toggle'a.
- **Wstrzymaj/Aktywuj to JEDNA pozycja przełączająca**, nie dwie: etykieta
  `status === "wstrzymany" ? "Aktywuj" : "Wstrzymaj"`, akcja `Og(id, {status: nowy})`.
- `Og()` (`:9147-9150`) — `PATCH /api/products/{id}`, po sukcesie `Uo("/api/products")`, czyli
  **invalidacja WYŁĄCZNIE `["/api/products"]`**. `jb()` (`:9151-9153`) — `DELETE /api/products/{id}`,
  również tylko `["/api/products"]`.
  ⚠ **Rozstrzygnięcie warunku z promptu:** oryginał **NIE** unieważnia `["/api/alerts"]` ani
  `["/api/analytics"]` przy mutacjach produktu. Backlog #26 potwierdza dodatkowo, że `/alerty`
  w ogóle nie czyta `/api/products`. Nie dokładamy tych kluczy.
- `Yb()` (`:10290-10303`) — **nie jest wywołaniem API.** Dopisuje wpis do lokalnej tablicy
  i robi `setQueryData(["/api/history"], …)` + zapis do IndexedDB. Patrz decyzja D2.
- Wszystkie użyte nazwy (`Og`, `jb`, `Yb`, `Uo`, `$t`, `tt`) mają **po jednej definicji** —
  sprawdzone `grep -c`, brak pułapki cieniowania z `CLAUDE.md` §5.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ticket jest **frontendowy** — nie zmienia ani jednej linii backendu, więc nie może naruszyć
kształtu odpowiedzi. Zakres kontraktu, który nowy kod musi SPEŁNIAĆ jako klient:

| Operacja | `contract/openapi.yaml` | Fixture |
|---|---|---|
| `PATCH /api/products/{id}` | `:870-909` | **BRAK nagrania** |
| `DELETE /api/products/{id}` | `:870-909` | **BRAK nagrania** |
| `GET /api/overrides?dostawca&kod` | `:760-768` | `GET_overrides.json` ✅ |
| `DELETE /api/overrides/{id}` | `:779-786` | **BRAK nagrania** |
| `GET /api/atrybuty` (selecty) | — | `GET_atrybuty.json` ✅ |
| `GET /api/products` (tabela, bez zmian) | `:...` | `GET_products.json` ✅ |

**Uczciwa ocena GATE'u.** Sześć operacji mutacji produktów **nie ma nagrań** — ich przenagranie
to zadanie **12d**, jawnie zapisane w roadmapie. Dla 12c GATE stoi więc na trzech nogach,
a nie na porównaniu z fixture'em:

1. **Metoda + ścieżka + kształt ŻĄDANIA** zgodne z `openapi.yaml` i z `POLA_EDYTOWALNE_PRODUKTU`
   — front nie może wysłać pola, które backend odrzuci (test pilnujący listy pól).
2. **`GET_overrides.json` jest wiążący** dla odczytu override'ów: klucze **camelCase**
   (`fieldName`, `overrideValue`, `id`, `supplierProductId`) — zgodne z `l[t.fieldName]`
   w oryginale, **bez pułapki snake_case** z `CLAUDE.md`. Test czyta ten plik.
3. **`GET_products.json` i `GET_atrybuty.json`** — front konsumuje je przez mocki MSW
   zbudowane wprost z nagrań (`test/msw/kontrakt.ts`), więc zmiana kształtu fixture'u wywali
   testy widoku.

⚠ **GATE katalogu (`rebuild/backend/test/katalog.gate.test.ts`) jest testem BACKENDU, nie
frontu** — razem z wyjątkiem `WYJATKI_SZEROKOSC`. Ten ticket nie zmienia ani jednego pliku
backendu, więc tamten gate jest nietknięty Z KONSTRUKCJI (dowód: `git diff --name-only
origin/develop...HEAD` nie zawiera `rebuild/backend/`), a nie dlatego, że go tu uruchamiamy.
Usunięcie `WYJATKI_SZEROKOSC` należy do 12d, po przenagraniu `GET_products.json`.

## Decisions

Cztery decyzje użytkownika (Q&A 2026-09-05), wszystkie zgodne z rekomendacją:

- **D1 — „Usuń" pyta przez `DialogPotwierdzenia`, nie przez `window.confirm`.**
  ŚWIADOME ODSTĘPSTWO od 1:1, kontynuacja precedensu **D2 z 7b** i **D6 z narzutów**.
  Tekst pytania przenosimy **dosłownie**: `Usunąć {kod}?` — zmienia się nośnik, nie treść.
  *Za:* spójność z resztą odbudowy (zero surowego `confirm()` w nowych widokach), testowalność
  w RTL bez podmiany globalu. *Przeciw:* kolejne odstępstwo. Zważone — precedens przeważa.
  ⚠ `Staging.tsx:177,210` nadal ma surowy `confirm()` — niespójność zastana, **poza zakresem**
  tego ticketa (idzie do Follow-up).

- **D2 — `Yb()` NIE jest portowane; zamiast tego invalidujemy `["/api/history"]`.**
  ŚWIADOME ODSTĘPSTWO. Oryginał po zapisie pisze lokalny dziennik do IndexedDB i nadpisuje nim
  cache `["/api/history"]`. Od 12a backend pisze **realny** wiersz `history` wprost w handlerze
  (`zapiszWpisDziennika`), więc port `Yb` postawiłby drugie, konkurencyjne źródło historii —
  dokładnie ten wzorzec odrzucono w **I6/D3** (statusy alertów wyłącznie przez API, zero IndexedDB).
  Nasz `queryClient` ma `staleTime: Infinity` (`src/lib/queryClient.ts:35`), więc bez jawnej
  invalidacji `/historia` pokazywałaby dane nieaktualne aż do przeładowania strony — czyli
  parytet dla Ani byłby **gorszy** niż w produkcji. Invalidacja `["/api/history"]` odtwarza
  skutek, który `Yb` dawał użytkownikowi, przez prawdziwe źródło danych.
  Dotyczy **edycji i usunięcia** (backend audytuje obie).

- **D3 — `szerokosc` portowana 1:1 jako `type="number" step="0.01"` + `parseFloat`.**
  BEZ odstępstwa. Zgodnie z regułą domyślną projektu odtwarzamy produkcję dokładnie, z jej wadą:
  ręczna edycja zgubi zera końcowe („10.00" → „10"), których broniła saga `szertxt`
  (backlog #3, migracja `003_szerokosc_text.sql`). *Za:* to zastane zachowanie produkcji, nie
  regres odbudowy; nota z 12a explicite tego pilnowała. *Przeciw:* utrata precyzji zapisu.
  Zważone — wada jest w oryginale, więc ją odtwarzamy i **dokumentujemy** (backlog).

- **D4 — `PodgladProduktu.tsx` usunięty całkowicie.**
  ZNIESIENIE odstępstwa D4 z I2. Oryginał nie ma podglądu produktu w żadnej postaci; klik
  w wiersz nic nie otwiera poza zawinięciem komórki „Nazwa". Dialog edycji zastępuje podgląd
  w całości. *Przeciw wariantowi „zostawić obok":* utrzymywanie funkcji, której produkcja nie
  ma, i drugi modal mylący Anię.

**Odstępstwa odziedziczone, nietykane w tym tickecie:** D5 z I2 (`isLoading`/`isError`),
D3 z 7c (listy filtrów ze słownika), wyjątek `WYJATKI_SZEROKOSC` w GATE (znika w 12d).

## Implementation plan

Kolejność = kolejność commitów.

### Krok 1 — `src/pages/katalog/api.ts` (NOWY): warstwa mutacji

Port `Og` / `jb` / odczytu i kasowania override'ów, na istniejącym `zadanie()` z `src/lib/api.ts`
(odpowiednik `$t`). Bez własnego `fetch`.

- `type Override = { id: number; fieldName: string; overrideValue: string | null; ... }`
  — kształt **z `contract/fixtures/GET_overrides.json`** (camelCase).
- `pobierzOverrides(dostawca, kod): Promise<Override[]>` — `GET /api/overrides?dostawca=…&kod=…`
  z `encodeURIComponent` na obu parametrach (1:1 z `:23922`).
- `zapiszProdukt(id, patch): Promise<Produkt>` — `PATCH /api/products/{id}`, ciało = tylko
  dotknięte pola (port `Og`).
- `usunProdukt(id): Promise<void>` — `DELETE /api/products/{id}` (port `jb`).
- `usunOverride(id): Promise<void>` — `DELETE /api/overrides/{id}` (port `:23955`).

### Krok 2 — `src/pages/katalog/poleEdycji.ts` (NOWY): opis formularza jako dane

42 pola w kolejności renderowania oryginału (`:24041-24095`) jako tablica deklaratywna
(etykieta, klucz, rodzaj kontrolki, `step`/parser/`disabled`/`span`/`mono`). Powód wydzielenia:
to jedyny fragment dialogu, który da się przetestować bez renderowania, i jednocześnie miejsce,
w którym test porówna listę wysyłanych kluczy z `POLA_EDYTOWALNE_PRODUKTU`.

⚠ **Etykiety przenosimy DOSŁOWNIE, bez polskich znaków** — tak jak w oryginale:
„Cena sprzedazy", „Bieznik/model", „Szerokosc", „Srednica", „Indeks nosnosci (LI)",
„Opor toczenia", „Przyczepnosc", „Halas", „Lod", „Bloto + snieg (M+S)", „Link do zdjecia".
Tekst tooltipa override'u też dosłownie: `Recznie zmienione - import nie nadpisze. Kliknij, zeby zdjac override.`

Pułapki do zakodowania:
- **`dostawca` jest `disabled`** → nigdy nie trafia do payloadu (dlatego nie ma go na liście 42
  pól backendu, a `manual_overrides` kluczuje się po nim).
- **„Bieznik/model" pisze DWA klucze naraz** (`model` **i** `bieznik`, `:24085`); etykieta
  override'u czyta `l.model ? "model" : "bieznik"` (`:24022`).
- **Cztery pola warunkowe** (`rozmiar`, `indeksNosnosci`, `indeksPredkosci`, `sezon`): select,
  gdy słownik ma wartości danego rodzaju, inaczej zwykły input tekstowy.
- **Rodzaje słownikowe są snake_case, a pola camelCase**: `indeks_nosnosci` → `indeksNosnosci`,
  `indeks_predkosci` → `indeksPredkosci`.
- **`"-"` w `konstrukcja` to REALNA wartość**, nie placeholder (placeholderem jest `"__empty"` → `null`).
- Selecty stałe: `status` `["aktywny","wstrzymany"]`, `konstrukcja` `["R","D","B","-"]`,
  `vfIf` `["VF","IF","CFO"]`, `tlTt` `["TL","TT"]`.
- Osiem flag tri-state (`ms`, `snow3pmsf`, `cfo`, `sb`, `sf`, `nro`, `cho`, `stubbleResistant`):
  `true`→„Tak", `false`→„Nie", inaczej „-" → `null`.
- Parsery liczbowe: pusty string → `null`; `NaN` → `null` (1:1 z `:24073`).
- Helper opcji słownikowych 1:1 z `:23966`:
  `(wartosci||[]).filter(w => w.rodzaj === rodzaj).map(w => w.wartosc).filter(Boolean).sort(localeCompare "pl")`.

### Krok 3 — `src/pages/katalog/DialogEdycjiProduktu.tsx` (NOWY)

Port `LT()`. Stan `zmiany: Record<string, unknown>` (`useState({})`), resetowany `useEffect`em
przy zmianie `produkt?.id` (port `FT`, `:24123`). Odczyt wartości:
`zmiany[k] !== undefined ? zmiany[k] : produkt[k]` z `?? ""` (port `d`, `:23965`).

- `useQuery(["/api/atrybuty"], pobierzSlownik)` — **ten sam klucz i loader**, co `Katalog.tsx`,
  `/atrybuty` i dialog reguł (7c). Nie dokłada zapytania sieciowego.
- `useQuery(["/api/overrides", dostawca, kod], …, { enabled: !!produkt })` — mapa
  `fieldName → override`; przycisk „override" widoczny tylko dla pól, które override mają;
  klik → `DELETE` + `invalidateQueries(["/api/overrides", dostawca, kod])` (1:1 z `:23955-23958`).
- Nagłówek: `Edycja produktu (kodDostawcy || kod)`, `max-w-3xl max-h-[85vh] overflow-y-auto`,
  siatka `grid-cols-1 md:grid-cols-2 gap-4`, separator „Parametry techniczne" przed blokiem
  parametrów.
- Stopka: „Anuluj" + „Zapisz zmiany" (`data-testid="button-save-edit"`).
- Zapis: `PATCH` z **samymi dotkniętymi kluczami**, potem `onZapisano(produkt)`.
  **`Yb` pomijamy (D2).**

### Krok 4 — `src/pages/katalog/MenuAkcji.tsx` (NOWY) + zmiana `TabelaProduktow.tsx`

Ostatnia kolumna (`px-3 py-2 text-right sticky right-0 bg-background`) — przycisk „Eye"
zastąpiony dropdownem na istniejącym `src/components/ui/dropdown-menu.tsx`. Wzorzec menu
wierszowego: `src/pages/alerty/TabelaAlertow.tsx:83-103`.

Kolejność i kształt 1:1 z `:23766-23812`:
1. **Edytuj** (ikona `Pencil`), `data-testid="button-edit-${id}"`
2. **Historia** (ikona `History`), **`disabled`** — bez akcji, tak jak w oryginale
3. separator
4. **Wstrzymaj / Aktywuj** (ikona `Pause` w OBU stanach) — jedna pozycja, etykieta i cel wg
   aktualnego `status`
5. **Usuń** — `className="text-red-600 focus:text-red-600"`, bez ikony

Trigger: `ghost`, `h-7 w-7 p-0`, ikona `EllipsisVertical`, `data-testid="button-actions-${id}"`.
`data-testid` **tylko** tam, gdzie ma je oryginał (trigger i „Edytuj"); pozostałe pozycje
adresujemy w testach po roli i nazwie.

Props `onPodglad` → `onEdytuj`, plus `onPrzelaczStatus` i `onUsun`.

### Krok 5 — `src/pages/Katalog.tsx`: wpięcie

- `import { PodgladProduktu }` i stan `podglad/setPodglad` → `edytowany/setEdytowany`.
- `<PodgladProduktu …/>` → `<DialogEdycjiProduktu …/>`.
- Trzy `useMutation` (edycja / toggle statusu / usunięcie) z toastami **dosłownymi z oryginału**:
  - zapis → `{ title: "Zapisano zmiany", description: `${kod} — ${nazwa.slice(0,40)}` }` (`:23899`)
  - toggle → `{ title: nowy === "wstrzymany" ? "Wstrzymano" : "Aktywowano", description: `${kod} — ${nazwa.slice(0,40)}` }`
  - usunięcie → `{ title: "Usunięto produkt", description: kod }`
- Invalidacje po każdej z trzech mutacji: **`["/api/products"]`** (1:1) **+ `["/api/history"]`** (D2).
  **Bez `["/api/alerts"]` i `["/api/analytics"]`** — oryginał ich nie unieważnia.
- `DialogPotwierdzenia` dla „Usuń" (D1): tytuł/treść niosą dosłowne `Usunąć {kod}?`,
  `wariantPotwierdzenia="destructive"`.

### Krok 6 — usunięcie `PodgladProduktu.tsx` (D4)

Plik kasowany razem z jego testami/asercjami (`data-testid="dialog-podglad-produktu"`,
`podglad-pole-*`, `button-podglad-*`). Sprawdzić grepem, czy `KOLUMNY`/`formatujKomorke`
nie tracą jedynego konsumenta — tabela ich używa, więc zostają.

### Krok 7 — testy (Krok 9 procedury)

## Testing strategy

Wzorzec: `test/alerty.test.tsx` (MSW + `useMutation` + assercje na ciałach żądań),
`test/katalog.test.tsx` (`onUnhandledRequest: "error"`).

⚠ **Nota z 7c, obowiązkowa:** `katalog.test.tsx` stoi na `onUnhandledRequest: "error"`, a widok
pobiera komplet swoich tras. Dialog dokłada `GET /api/overrides` — **bez dopisania handlera
padnie cały plik testowy.**

Nowe testy:

1. **`test/katalog.poleEdycji.test.ts`** (jednostkowe, bez renderowania)
   - Lista kluczy wysyłanych przez formularz **=== `POLA_EDYTOWALNE_PRODUKTU`** (42 pola).
     Test importuje listę z backendu przez odczyt pliku źródłowego (front nie zależy od backendu
     w buildzie) — dowodzi, że front nie wysyła pola, które backend odrzuci, i że żadnego nie gubi.
   - `dostawca` **nie występuje** w kluczach payloadu (jest `disabled`).
   - Helper opcji słownikowych: filtr po rodzaju, `filter(Boolean)`, sort `localeCompare "pl")`
     (kolejność polska, np. „Ł" przed „M").
   - Parsery: `""` → `null`, `"abc"` → `null`, `"10.5"` → `10.5`, `parseInt` vs `parseFloat`.
   - Tri-state: `true`/`false`/`null` ↔ `"true"`/`"false"`/`"__empty"`.
   - `"-"` w `konstrukcja` przechodzi jako wartość, nie jako `null`.
2. **`test/katalog.edycja.test.tsx`** (RTL + MSW, przepływ GATE z promptu)
   - **Edycja:** otwarcie menu → „Edytuj" → zmiana pola → „Zapisz zmiany" → assercja, że poszedł
     **`PATCH /api/products/{id}`** i że ciało zawiera **tylko dotknięte klucze** (nie cały produkt).
   - **Pole scalone:** zmiana „Bieznik/model" wysyła **oba** klucze `model` i `bieznik`.
   - **Wstrzymanie/aktywacja:** produkt `aktywny` → pozycja ma etykietę „Wstrzymaj", klik wysyła
     `{status:"wstrzymany"}`; produkt `wstrzymany` → „Aktywuj", `{status:"aktywny"}`.
   - **Usuwanie:** klik „Usuń" → dialog potwierdzenia z tekstem `Usunąć {kod}?`; anulowanie
     **nie** wysyła żądania; potwierdzenie wysyła `DELETE /api/products/{id}`.
   - **Kasowanie override:** dialog pokazuje znacznik „override" przy polu z override'em
     (dane z `contract/fixtures/GET_overrides.json`), klik wysyła `DELETE /api/overrides/{id}`.
   - **Invalidacje:** po każdej z trzech mutacji unieważnione `["/api/products"]` i `["/api/history"]`,
     a **`["/api/alerts"]`/`["/api/analytics"]` NIE** (assercja negatywna — pilnuje, żeby ktoś
     nie „poprawił" tego wbrew oryginałowi).
   - **„Historia" jest `disabled`.**
3. **Aktualizacja `test/katalog.test.tsx`** — handler `GET /api/overrides`, podmiana asercji
   podglądu na menu akcji.
4. **GATE katalogu bez zmian** — `test/katalog.gate.test.ts` musi dalej przechodzić nietknięty.

**Czego NIE testujemy i dlaczego:** nie stawiamy testów integracyjnych przeciw żywemu backendowi
dla mutacji — 12a pokryła te trasy 22 testami porównawczymi i pełną suitą backendu (1103 testy),
a `POST /api/selly/sync-supplier` i pokrewne pozostają nietknięte. Nie mockujemy `window.confirm`,
bo D1 go eliminuje.

**Bramki:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/frontend/`.
Baseline przed zmianami: **646 testów / 43 pliki, zielone.**

## Out of scope

- **Backend mutacji** — 12a, zrobione. Ten ticket nie rusza `rebuild/backend/`.
- **Konto/admin/maintenance** — 12b (równoległa sesja, `.worktrees/36-FEATURE-konto-admin-maintenance`).
- **Przenagranie fixtures i schematy ciał w `openapi.yaml`** — 12d. Stąd brak fixture'ów dla
  sześciu operacji produktów; GATE 12c stoi na kontrakcie żądań, nie na nagraniach.
  `WYJATKI_SZEROKOSC` **zostaje** — usuwa go 12d.
- **Finalny audyt + przegląd 12 widoków** — 12e.
- **Przycisk „Usuń wszystko z katalogu"** (`POST /api/products/clear`) — należy do zakładki
  „Katalog" w `/konfiguracja`, dowozi go **12b**. Osobna trasa od `DELETE /api/products/{id}`.
- **Ożywienie kolumny „Promocja"** (martwa, D1 z 4b, backlog #22) — wymaga pola z backendu,
  nota informacyjna w roadmapie, nie zadanie tej sesji.
- **Surowy `confirm()` w `Staging.tsx`** — zastana niespójność, follow-up.

## Definition of done

- [ ] Dialog edycji produktu zastępuje podgląd read-only; `PodgladProduktu.tsx` usunięty,
      **odstępstwo D4 z I2 zniesione**.
- [ ] Formularz ma 42 pola w kolejności oryginału, z dosłownymi etykietami; `dostawca` `disabled`;
      „Bieznik/model" pisze `model` i `bieznik`; cztery pola warunkowe działają jako select
      przy niepustym słowniku.
- [ ] `PATCH /api/products/{id}` wysyła **wyłącznie dotknięte pola** i wyłącznie klucze
      z `POLA_EDYTOWALNE_PRODUKTU` (dowiedzione testem porównującym obie listy).
- [ ] Menu „Akcje" w kolejności 1:1 (Edytuj → Historia `disabled` → separator → Wstrzymaj/Aktywuj
      → Usuń), toggle statusu jako JEDNA pozycja.
- [ ] Usuwanie woła `DELETE /api/products/{id}` po potwierdzeniu w `DialogPotwierdzenia`
      z dosłownym tekstem `Usunąć {kod}?` (D1); anulowanie nie wysyła żądania.
- [ ] Override'y widoczne przy polach i kasowalne przez `DELETE /api/overrides/{id}`,
      z invalidacją `["/api/overrides", dostawca, kod]`.
- [ ] Po każdej mutacji unieważnione `["/api/products"]` + `["/api/history"]` (D2);
      `["/api/alerts"]`/`["/api/analytics"]` **nie** (assercja negatywna w teście).
- [ ] Toasty z dosłownymi tekstami oryginału (cztery przypadki).
- [ ] `lint` / `typecheck` / `build` / `test` czyste; GATE katalogu (`katalog.gate.test.ts`)
      przechodzi nietknięty.
