# 35-FEATURE-mutacje-produktow-backend — raport z realizacji

## Podsumowanie

Katalog domknięty do **parytetu ZAPISU** z produkcją: `POST /api/products` (bulk z pełną
sekwencją importu), wspólny handler `PUT`/`PATCH /api/products/{id}` z listą 42 pól
edytowalnych, `DELETE /api/products/{id}` oraz dwa endpointy `uwaga_cena`
(`uwagi-cena`, `hold-reasons`) przeniesione z produkcyjnego monkey-patcha. Wierność bulku
dowiedziona charakteryzacją: oryginał wycięty z `mirror/backend/index.cjs` uruchamiany obok
naszego portu na dwóch identycznie zasianych bazach, z porównaniem końcowego stanu.

**Efekt uboczny o znaczeniu dla całej odbudowy:** tabela `history` dostała w rebuildzie
pierwszego pisarza, więc `GET /api/history` przestał zwracać `[]` — I5 odnotowała to jako
stan przejściowy do domknięcia właśnie tutaj.

## Zmiany

### Nowe pliki
- `rebuild/backend/src/import/bulk.ts` — port `U.addProductsBulk` (`:44746-44806`): transakcja,
  wartości domyślne, gałąź cenowa przez `zastosujRegulyCenowe`, sześć rozszerzeń `bridge_ext`
  (z `rememberLink` po zapisie), natywna propagacja `uwagaCena`.
- `rebuild/backend/test/produkty-bulk.charakteryzacja.test.ts` — 22 testy: 16 scenariuszy
  porównawczych + integralność wycinka + trzy kontrole negatywne.
- `rebuild/backend/test/charakteryzacja/bulk/scenariusze.mjs` (+ `.d.mts`) — 17 scenariuszy
  celowanych w gałęzie bulku.
- `rebuild/backend/test/produkty.mutacje.test.ts` — 41 testów warstwy tras.
- `rebuild/backend/test/produkty.mutacje.gate.test.ts` — 16 testów GATE kontraktu.

### Zmienione
- `rebuild/backend/src/routes/products.ts` — sześć nowych tras; wspólny `handlerEdycji`
  dla `PUT`/`PATCH`; odpowiedź edycji w projekcji kontraktowej.
- `rebuild/backend/src/repos/products.ts` — `POLA_EDYTOWALNE_PRODUKTU` (42 pola + pełne
  uzasadnienie, skąd wzięte i czego nie ma), `odsiejPolaEdytowalneProduktu`, `produktPoId`,
  `wKontrakcie`, `tylkoKolumnyProduktu` (przeniesione z `akceptacja.ts` — DRY),
  oraz zabezpieczenie `aktualizujProdukt` przed pustym patchem.
- `rebuild/backend/src/repos/dziennik-zmian.ts` — `zapiszWpisDziennika` (port `U.addHistory`);
  nagłówek pliku zaktualizowany, bo jego główna teza („tabela nie ma pisarza") przestała być prawdą.
- `rebuild/backend/src/import/akceptacja.ts` — usunięta prywatna kopia `tylkoKolumnyProduktu`,
  import ze wspólnego miejsca.
- `rebuild/backend/test/charakteryzacja/akceptacja/oryginal.mjs` (+ `.d.mts`) — trzeci wycinek
  bundla (`updateProduct(t,e){` → `listStaging(){`). Dwa istniejące wycinki NIETKNIĘTE.
- `contract/openapi.yaml` — `404` przy trzech operacjach `/api/products/{id}`; dwie nowe
  ścieżki `GET` (`uwagi-cena`, `hold-reasons`) ze wskazaniem źródła w monkey-patchu.

## Odstępstwa od planu

Brak odstępstw merytorycznych. Trzy sprostowania wobec brzmienia planu:

1. **Lista pól ma 42 pozycje, nie 41.** Skład listy jest dokładnie taki, jak wyliczono
   w planie (D1) — pomyłka była w samej liczbie, nie w zawartości.
2. **Trasa bulku nie potrzebowała nowego pisarza `uwagaCena`** — propagacja zmieściła się
   w `bulk.ts` jako pętla po transakcji, 1:1 z monkey-patchem.
3. **Doszedł zabezpieczenie, którego plan nie przewidywał:** `aktualizujProdukt` musiało
   dostać gałąź na pusty patch. Wprowadzenie listy pól sprawia, że `PATCH` z samymi polami
   spoza listy daje `{}`, a Drizzle rzuca na `set({})` — bez tego trasa oddawałaby 500 tam,
   gdzie produkcja oddaje 200. Ten sam ruch, co `aktualizujDostawce` w 3f-2.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ **kontrakt zgodny; fixtures N/D — nie istnieją.**
  `contract/fixtures/` nie ma ani jednego nagrania dla sześciu operacji tej sesji (nagrania
  POST/PUT/PATCH/DELETE dochodzą w 12d, `contract/README.md`). Sprawdzone przez
  `sprawdzZgodnoscZKontraktem`: `POST /api/products` (200, 401),
  `PATCH`/`PUT`/`DELETE /api/products/{id}` (200, 404, 401),
  `GET /api/products/uwagi-cena` i `/hold-reasons` (200, 401). Gate ma kontrolę negatywną —
  ścieżka spoza kontraktu musi zapalić naruszenie, inaczej test pada.
- **Charakteryzacja przeciw uruchomionemu oryginałowi:** ✓ 22/22
  (`produkty-bulk.charakteryzacja.test.ts`) — 16 scenariuszy porównuje końcowy stan
  `products`, `link_pamiec_kod`, `link_pamiec_mr`, `nazwa_pamiec`, `waga_pamiec`, `markups`,
  `promotions` oraz licznik zwrócony przez obie strony.
- **Testy tras:** ✓ 41/41 (`produkty.mutacje.test.ts`).
- **GATE kontraktu:** ✓ 16/16 (`produkty.mutacje.gate.test.ts`).
- **Cała suita backendu:** ✓ **1103 testy / 68 plików** (przed ticketem 1024/64).
- **Bramki:** `lint` ✓ · `typecheck` ✓ · `build` ✓.

### Czego charakteryzacja świadomie NIE mierzy (i gdzie to jest zmierzone)

Propagacja `uwagaCena` w bulku jest w produkcji monkey-patchem doklejanym do `index.cjs`
PO buildzie (`mirror/backend/uwaga_cena_patch.cjs:72-93`), więc wycięty z bundla
`addProductsBulk` jej nie zawiera — oryginał w tej próbie kolumny nie tknie, a nasz port
tknie. Porównanie stanu bazy pomija więc `uwagaCena`, co jest jawnie udokumentowane
w nagłówku pliku testu. Samą propagację (oba klucze, czyszczenie przy braku) mierzą testy
tras, gdzie wzorcem jest kod monkey-patcha. Bez tego rozdziału zielony wynik charakteryzacji
znaczyłby mniej, niż się wydaje.

## Rozjazdy wykryte wobec roadmapy i treści ticketa

Cztery, wszystkie potwierdzone kodem — do naniesienia na roadmapę:

1. **`PUT` i `PATCH` NIE są w oryginale wspólnym handlerem.** `:48415-48449` obsługuje
   wyłącznie `PUT` (`e.put(…, i)`, `:48451`); `PATCH` ma własną, niemal identyczną funkcję
   (`:48452-48487`), różniącą się kolejnością audytu względem pętli override/history.
   Roadmapa (`:1621`), backlog #14 i treść ticketa opisują to jako jeden handler.
2. **Trasa edycji pisze do DWÓCH tabel, nie jednej.** Poza `manual_overrides` (`:48427`)
   woła `U.addHistory` (`:48435-48445`) — tabela `history`.
3. **`addProductsBulk` woła SZEŚĆ rozszerzeń, nie pięć.** Szóste to `rememberLink`
   (`:44801-44803`), po zapisie produktu.
4. **`uwaga_cena_patch.cjs` monkey-patchuje TAKŻE `addProductsBulk`** (`:72-93`), nie tylko
   dostarcza dwa endpointy.

Sprawdzono też regułę z `CLAUDE.md` o cieniowaniu definicji: `addProductsBulk` występuje
w `mirror/backend/index.cjs` dokładnie raz; jedyną warstwą nadpisującą jest monkey-patch wyżej.

## Breaking changes

**Zmiana zachowania widoczna poza tym ticketem, zamierzona:** `GET /api/history` na stagingu
przestaje zwracać pustą listę — od teraz zawiera po jednym wpisie na każde pole zmienione
ręczną edycją produktu. Widok `/historia` (I5) jest na to gotowy; to domknięcie jego DoD,
nie regres.

Poza tym brak — sześć tras to nowa powierzchnia, żaden istniejący kształt odpowiedzi się
nie zmienił (`GET /api/products` nietknięty, `uwagaCena` nadal ukryta projekcją).

## Follow-up

Rzeczy zauważone po drodze, świadomie NIE zrobione w tej sesji:

- **`marzaPct` liczy się inaczej w dwóch ścieżkach zapisu.** `addProductsBulk` (`:44753`)
  liczy ją z faktycznych cen, a `acceptStaging` (`:44881`) wpisuje na sztywno `25`.
  To niespójność PRODUKCJI, odtworzona 1:1 po obu stronach i opisana komentarzem w `bulk.ts`.
  Do decyzji Ani, czy w produkcji ujednolicić — poza zakresem odbudowy.
- **`encjaId` w audycie jest niespójne między trasami produktów:** `edycja_produktu` zapisuje
  `kod` (`:48446`), `usuniecie_produktu` — `id` jako tekst (`:48412`). Port 1:1, oba
  zachowania zamrożone testem.
- **`DELETE /api/products/{id}` nie kasuje kaskadowo** `manual_overrides` ani `history`
  produktu — zostają sieroty. Zastane zachowanie oryginału, zamrożone testem; naprawa
  byłaby zmianą zachowania, więc wymaga decyzji.
- **`szerokosc` a dialog edycji (dla sesji 12c):** produkcyjny `LT()` renderuje `szerokosc`
  jako `type="number"` z `parseFloat` (`frontend-index.js:24076-24079`), a kanon ma tam TEXT
  (migracja 003). Ręczna edycja zgubi więc zera końcowe („10.00" → „10"), których cała saga
  `szertxt` broniła. To zastane zachowanie produkcji, nie regres odbudowy — ale 12c powinna
  o tym wiedzieć, zanim zaportuje pole.
- **`POST /api/products/clear`** należy do 12b (zakładka „Katalog" w `/konfiguracja`) —
  celowo nietknięte.
