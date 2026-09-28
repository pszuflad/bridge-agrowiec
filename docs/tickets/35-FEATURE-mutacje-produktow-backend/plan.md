# 35-FEATURE-mutacje-produktow-backend — Iteracja 12, sesja 12a: mutacje produktów (BE)

> Status: Draft
> Branch: `feature/35-mutacje-produktow-backend`
> Worktree: `.worktrees/35-FEATURE-mutacje-produktow-backend`

## Opis ticketa

Iteracja 12, sesja 12a (BACKEND) wg `docs/rebuild-roadmap.md` §5 „Iteracja 12" (obszar B +
„Zaległości z I3"). Cel: domknąć katalog do **parytetu ZAPISU** z produkcją — mutacje
produktów + dwa endpointy `uwaga_cena`. Katalog (I2) jest dziś wyłącznie do odczytu.

Zakres z promptu użytkownika:
- `POST /api/products` (bulk) z rozszerzeniami importu (`assignKodImportu`, `applyDims`,
  `applyLinkMemory`, `applyNazwaPamiec`, `applyWagaPamiec`) i gotową gałęzią cenową.
- `PATCH /api/products/{id}` (edycja + wstrzymanie/aktywacja), `PUT`, `DELETE`.
- `GET /api/products/uwagi-cena` i `GET /api/products/hold-reasons`.

FE (dialog edycji `LT()` + menu „Akcje") to 12c, PO merge tej sesji. Niezależne od 12b
(konto/admin) → sesje idą równolegle.

## Kontekst

### Co ustalił research (i co prostuje roadmapę)

**⚠ ROZJAZD 1 — `PUT` i `PATCH` NIE są wspólnym handlerem.** Roadmapa (`:1621`), backlog #14
i treść promptu mówią „wspólny handler PUT/PATCH (`:48415-48424`, zarejestrowany w `:48452`)".
Stan faktyczny: `let i = (c,u) => {…}` (`:48415-48449`) jest handlerem **wyłącznie `PUT`**
(`e.put("/api/products/:id", we, i)`, `:48451`), a `PATCH` ma **własną, osobną funkcję**
zdefiniowaną inline tuż obok (`:48451-48487`). Kod jest niemal identyczny; jedyna różnica to
kolejność efektów ubocznych — `PUT` robi pętlę override/history, potem audyt; `PATCH` robi
audyt, potem pętlę. Stan końcowy bazy i odpowiedź są identyczne. Do sprostowania w roadmapie.

**⚠ ROZJAZD 2 — trasa pisze do DWÓCH tabel, nie jednej.** Prompt i roadmapa wymieniają tylko
`manual_overrides` (`:48427`). Oryginał w tej samej pętli woła też `U.addHistory(…)`
(`:48435-48445`) — wpis do tabeli `history` (`data, kodProduktu, nazwa, pole, staraWartosc,
nowaWartosc, zrodlo: "recznie", kto, wykonalUzytkownikId`). **To domyka fakt zapisany przez
I5:** „Tabela `history` nie ma w rebuildzie pisarza. Jedyny pisarz oryginału to ręczna edycja
produktu w katalogu (`PUT`/`PATCH /api/products/:id`) — poza zakresem tego ticketa. Do czasu
jej sportowania `GET /api/history` zwraca na stagingu `[]`" (roadmap `:946-948`).
Po tej sesji `/api/history` przestaje być puste. `rebuild/backend/src/repos/dziennik-zmian.ts`
ma dziś wyłącznie czytelnika (`listaDziennikaZmian`) — pisarza dokłada ta sesja.

**⚠ ROZJAZD 3 — `addProductsBulk` woła SZEŚĆ rozszerzeń, nie pięć.** Prompt wymienia pięć.
Oryginał (`:44800-44802`) woła dodatkowo `__BRIDGE_EXT.rememberLink(Qi, l)` **po** zapisie
produktu — tak samo jak `acceptStaging` (port: `akceptacja.ts:191-195`). Bez niego pamięć
linków zdjęć nie zapisywałaby się przy imporcie bulk.

**⚠ ROZJAZD 4 — `uwaga_cena_patch.cjs` patchuje TAKŻE `addProductsBulk`.** Prompt opisuje ten
plik wyłącznie jako źródło dwóch endpointów. W rzeczywistości ma cztery części: `ALTER TABLE`,
monkey-patch `U.acceptStaging` (już wniesiony natywnie w 3d-2), **monkey-patch
`U.addProductsBulk`** (`uwaga_cena_patch.cjs:72-93`) i dwa endpointy. Monkey-patch bulku po
oryginalnym wywołaniu robi dla każdej pozycji
`UPDATE products SET uwaga_cena = ? WHERE kod = ?`, gdzie wartość to
`it.uwagaCena !== undefined ? it.uwagaCena : (it.uwaga_cena || null)`.

**Nie ma cieniowania.** `addProductsBulk` występuje w `mirror/backend/index.cjs` dokładnie raz
(sprawdzone zgodnie z regułą z `CLAUDE.md` o duplikatach definicji); jedyna nadpisująca warstwa
to monkey-patch wyżej, wnoszony natywnie.

### Stan odbudowy — co JUŻ jest i czego użyjemy

| Element | Ścieżka | Status |
|---|---|---|
| `updateProduct` (z auto-statusem cena→0) | `src/repos/products.ts::aktualizujProdukt` | ✅ gotowe, port 1:1 |
| `deleteProduct` | `src/repos/products.ts::usunProdukt` | ✅ gotowe |
| Gałąź cenowa | `src/repos/ceny.ts::zastosujRegulyCenowe` | ✅ gotowe (4a) |
| Rozszerzenia importu (6 funkcji) | `src/import/silnik/bridge-ext.ts` | ✅ most typuje wszystkie sześć |
| Wzorzec całej sekwencji bulku | `src/import/akceptacja.ts::zatwierdzPozycjeStagingu` | ✅ do skopiowania |
| Filtr pól | `src/repos/pola-edytowalne.ts::odsiejPola` | ✅ gotowe (3f-2/4a) |
| `upsertOverride` | `src/repos/overrides.ts::zapiszPoprawke` | ✅ gotowe |
| `be()` (audyt) | `src/repos/audit.ts::zapiszAudyt` | ✅ gotowe |
| Projekcja kontraktowa | `src/repos/kolumny.ts` | ✅ ukrywa `uwagaCena` |
| Harness charakteryzacji | `test/charakteryzacja/akceptacja/oryginal.mjs` | 🔨 do poszerzenia kotwic |
| Pisarz tabeli `history` | — | ❌ dokłada ta sesja |
| `POST/PATCH/PUT/DELETE /api/products` | `src/routes/products.ts` (tylko GET) | ❌ dokłada ta sesja |

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Fixtures: BRAK dla wszystkich sześciu operacji tego ticketa.** `contract/fixtures/` nie ma ani
jednego nagrania dla `POST /api/products`, `PATCH`/`PUT`/`DELETE /api/products/{id}`,
`GET /api/products/uwagi-cena`, `GET /api/products/hold-reasons`. To nie jest przeoczenie:
`contract/README.md` odnotowuje, że fixtures zapisujące dochodzą dopiero w I12 (sesja 12d).

**Konsekwencja dla GATE'u:** wzorcem dla tej sesji jest **kod oryginału** — `mirror/backend/index.cjs`
(wycinany harnessem, uruchamiany, porównywany stanem bazy) plus `mirror/backend/uwaga_cena_patch.cjs`
(czytany dosłownie). To mocniejszy dowód niż porównanie kształtu, bo obie strony liczą na
identycznym schemacie. Gate fixtures **nie obowiązuje** — obowiązuje charakteryzacja.

**Kontrakt (`contract/openapi.yaml`) — ścieżki objęte:**

| Metoda + ścieżka | Stan w kontrakcie | Co robimy w 12a |
|---|---|---|
| `POST /api/products` | ✅ jest (`:812-821`), ciało `type: object` | bez zmian |
| `DELETE /api/products/{id}` | ✅ jest (`:835-846`), kody 200/401/400 | **+ `404`** |
| `PATCH /api/products/{id}` | ✅ jest (`:847-859`), kody 200/401/400 | **+ `404`** |
| `PUT /api/products/{id}` | ✅ jest (`:860-870`), kody 200/401/400 | **+ `404`** |
| `GET /api/products/uwagi-cena` | ❌ **brak w ogóle** | **dopisujemy ścieżkę** |
| `GET /api/products/hold-reasons` | ❌ **brak w ogóle** | **dopisujemy ścieżkę** |

Schematy ciał request/response celowo zostają nieopisane (`type: object`) — generuje się je
z nagrań produkcji w 12d, nie z naszej implementacji (roadmap `:1639-1641`: „Schematy ciał
generujemy z `contract/fixtures/` — z nagrań produkcji, NIE z naszej implementacji").

**Poza zakresem gate'u tej sesji:** `GET_products.json` i wyjątek `WYJATKI_GET_PRODUCTS`
(`szerokosc` REAL vs TEXT) zostają nietknięte — przenagranie fixtures to 12d.

## Decisions

Wszystkie cztery pytania Q&A rozstrzygnięte 2026-09-04; użytkownik wybrał rekomendacje.

**D1 — `POLA_EDYTOWALNE_PRODUKTU` = dokładnie 41 pól dialogu `LT()`.**
Lista nie jest wymysłem odbudowy: to zbiór, który produkcyjny dialog edycji realnie potrafi
wysłać (`deminified/frontend-index.js:24020-24090`, handler zapisu `:24107-24124` wysyła
wyłącznie dotknięte klucze ze stanu `r`). Zawartość:
`nazwa, marka, kategoria, kodDostawcy, stan, vat, cenaZakupu, cenaSprzedazy, ean, status,
linkZdjecia, rozmiar, rozmiarAlternatywny, szerokosc, profil, srednica, konstrukcja,
indeksNosnosci, indeksPredkosci, vfIf, pr, tlTt, dot, waga, model, bieznik, oznaczenieBieznika,
sezon, wentyl, ms, snow3pmsf, cfo, sb, sf, nro, cho, stubbleResistant, labelRolling, labelWet,
labelNoise, labelIce, labelSnow`.
- **Odcięte jako WYLICZANE:** `marzaPct`, `magazyn`, `magazynRaw`, `eanRaw`, `eanIsValid`,
  `eanSourceStatus`, `eanCandidates`, `kodImportu`, `nieobecnoscPodRzad`, `dlugosc`,
  `szerokoscPaczki`, `wysokosc`, `wysokoscPrzesylki` (te cztery liczy `applyDims`), `indeksy`,
  `indeks1`, `indeks2`, `dostepnosc`, `rodzaj`, `sku`, `zastosowanie`, `reinforced`,
  `extraLoad`, `cutResistant`, `heatResistant`.
- **Odcięte jako TOŻSAMOŚĆ / serwerowe:** `id`, `kod`, `dataAktualizacji`.
- **Odcięte jako WŁASNE ODBUDOWY:** `uwagaCena` (migracja 002) — zgodnie z regułą stałą
  z backlogu #14 („kolumny wyliczane i kolumny własne odbudowy nigdy nie wchodzą na listę").
- **`dostawca` ODCIĘTY** mimo że dialog go renderuje: pole jest `disabled: !0` (`:24028`),
  więc produkcja nigdy go nie wysyła. Dodatkowo `manual_overrides` kluczuje się po
  `supplierKod = p.dostawca` — zmiana dostawcy rozspójniłaby własne poprawki produktu.
- **Odstępstwo od 1:1 — ŚWIADOME, zatwierdzone.** Oryginał zapisuje całe ciało minus `_reason`,
  czyli wszystkie 70 kolumn (backlog #14). Domykamy wpis #14 dla produktów tym samym ruchem,
  co dostawcy (3f-2), narzuty/promocje (4a) i spedycja/config (I11).

**D2 — jeden wspólny handler dla `PUT` i `PATCH`.** Oryginał ma dwie osobne funkcje różniące
się wyłącznie kolejnością audytu względem pętli override/history (rozjazd 1 wyżej). Stan
końcowy bazy i odpowiedź są identyczne, więc portujemy jedną funkcję. Świadome, kosmetyczne
odstępstwo; różnica dotyczy kolejności dwóch zapisów w obrębie tego samego żądania.

**D3 — minimalny dopisek do `openapi.yaml` już w 12a.** Dopisujemy dwie brakujące ścieżki
(`uwagi-cena`, `hold-reasons`) i kod `404` przy `DELETE`/`PATCH`/`PUT /api/products/{id}`.
Bez tego gate nie mógłby objąć realnego zachowania (`sprawdzZgodnoscZKontraktem` sprawdza, czy
zwrócony status jest zadeklarowany, a kontrakt zna dziś tylko 200/401/400). Schematy ciał
i przenagranie fixtures zostają w 12d. Roadmapa wymienia dopisanie obu endpointów `uwaga_cena`
jako zaległość I12 (`:1633-1637`), więc to domknięcie zapowiedzianej pracy, nie poszerzenie zakresu.

**D4 — `POST /api/products` (bulk) dowozi trzy rzeczy ponad samą sekwencję:**
- gałąź cenową 1:1 przez `zastosujRegulyCenowe` (obie tabele czytane przy KAŻDYM rekordzie
  wewnątrz transakcji, bez cache'owania; próg `cenaZakupu > 0`; `try/catch` obejmuje też odczyt);
- `rememberLink` po zapisie (rozjazd 3);
- propagację `uwagaCena` z payloadu, natywnie (rozjazd 4).
- **BEZ listy pól na wejściu bulku** — bulk MUSI zapisywać kolumny wyliczane, bo to on je
  produkuje. Odsiewanie zostaje na poziomie `tylkoKolumnyProduktu()` (kolumny tabeli), jak
  w `akceptacja.ts`.

**D5 — backlog #3 (`szerokosc` REAL→TEXT) przyjęty, bez wyjątków.** Kanon ma
`003_szerokosc_text.sql`; nie ożywiamy starego wyjątku. Uwaga do przekazania sesji 12c:
dialog `LT()` renderuje `szerokosc` jako `type: number` z `parseFloat` (`:24076-24079`), więc
wysyła LICZBĘ do kolumny TEXT — zera końcowe („10.00") przepadną przy ręcznej edycji. To
zastane zachowanie produkcji, nie regres; odnotowane dla 12c.

**D6 — `requireAuth` na wszystkich sześciu trasach.** Odtworzenie 1:1: oryginał wpina `we`
w każdą z nich (`:48306`, `:48407`, `:48451`, `:48452`, oraz `we` w obu trasach
`uwaga_cena_patch.cjs:96,120`). Nie jest to odstępstwo — nie ma czego odnotowywać.

**D7 — kształt odpowiedzi obu tras `uwaga_cena` 1:1, z `snake_case`.**
`GET /api/products/uwagi-cena` → `{ok: true, items: [{id, kod, ean, uwaga_cena}]}`.
`GET /api/products/hold-reasons` → `{ok: true, items: [{id, kod, ean, reason}]}`.
⚠ Klucz `uwaga_cena` jest w `snake_case`, bo produkcja czyta te wiersze surowym
`better-sqlite3`, nie Drizzle'em. To dokładnie pułapka opisana w `CLAUDE.md` („projekcja
Drizzle oddaje nazwy PÓL modelu (camelCase)… dla trasy, której fixture ma klucze snake_case,
projekcję trzeba wypisać jawnie") — projekcję wypisujemy jawnie z aliasem.
Pięć przypadków `hold-reasons` w tej kolejności, z dosłownymi tekstami:
1. `uwaga_cena` niepuste po `trim()` → dosłowna treść;
2. `cenaZakupu === 0 && stan === 0` → `"Brak ceny i stanu u dostawcy"`;
3. `cenaZakupu === 0 && stan > 0` → `"Brak ceny u dostawcy"`;
4. `cenaZakupu > 0 && stan === 0` → `"Brak stanu magazynowego u dostawcy"`;
5. `cenaZakupu > 0 && stan > 0` → `"Wstrzymane — sprawdź ręcznie"`;
oraz szósta, nieosiągalna gałąź `else` → `"Wstrzymane — powód nieznany"` (nieosiągalna, bo
`Number(x) || 0` nie produkuje wartości ujemnych ani `NaN`; portujemy ją mimo to, 1:1).

## Implementation plan

### Krok 1 — poszerzenie harnessu charakteryzacji (dowód wierności)
`test/charakteryzacja/akceptacja/oryginal.mjs`: dołożyć **trzeci** wycinek (nie ruszając dwóch
istniejących, żeby nie unieważnić hashy 3d-2): kotwice `poczatekProduktow = "updateProduct(t,e){"`
→ `koniecProduktow = "listStaging(){"`. Daje `updateProduct`, `deleteProduct`, `clearProducts`,
`addProductsBulk`. Wycinki sklejamy w to samo `var U = { … }`. Nowy hash do `integralnosc.json`.
Weryfikacja: obie kotwice występują w bundlu dokładnie raz (`pozycjaJedyna` to wymusza).

### Krok 2 — `src/repos/products.ts::dodajProduktyBulk`
Port `U.addProductsBulk` (`:44746-44806`) w transakcji, sekwencja 1:1:
normalizacja (pomiń rekordy bez `kod`) → `SELECT WHERE kod` → wartości domyślne
(`cenaZakupu ?? 0`, `cenaSprzedazy ?? round(zakup*1.25, 2)`, `marzaPct` z marży, `nazwa ?? ""`,
`marka/kategoria/dostawca ?? "—"`, `magazyn = String(stan)`, `vat ?? 23`, `status ?? "aktywny"`,
`dataAktualizacji`) → **gałąź cenowa** (`try { if (Number(cenaZakupu) > 0) { selecty markups +
promotions; zastosujRegulyCenowe(rekord, narzuty, promocje) } } catch {}`) → `try{applyDims;
applyLinkMemory}catch` → `try{assignKodImportu}catch` → `try{applyNazwaPamiec}catch` →
`try{applyWagaPamiec}catch` → `update`/`insert` przez `tylkoKolumnyProduktu()` →
`try{rememberLink}catch` → propagacja `uwagaCena`. Zwraca LICZBĘ przetworzonych rekordów.
`tylkoKolumnyProduktu` wyciągnąć z `import/akceptacja.ts` do wspólnego miejsca (DRY) albo
wyeksportować stamtąd.

### Krok 3 — `src/repos/dziennik-zmian.ts::zapiszWpisDziennika`
Pisarz tabeli `history` — port `U.addHistory` (`:48435-48445`). Dziś plik ma tylko czytelnika.

### Krok 4 — `POLA_EDYTOWALNE_PRODUKTU` w `src/repos/products.ts`
Lista z D1 + użycie `odsiejPola` z `repos/pola-edytowalne.ts`. Komentarz nagłówkowy w stylu
`POLA_EDYTOWALNE_DOSTAWCY`: skąd wzięta (dialog `LT()`), co odcina i dlaczego, link do #14.

### Krok 5 — trasy w `src/routes/products.ts`
- `POST /api/products` — ciało `Array.isArray(body) ? body : body.items ?? []`, audyt
  `bulk_dodanie_produktow` / encja `produkt` / `encjaId: ""` / `{ile}`, odpowiedź `{ok: true, dodano}`.
- wspólny handler `PUT`/`PATCH /api/products/:id` (D2): `getProduct` → 404 → `{_reason, ...reszta}`
  → **`odsiejPola(reszta, POLA_EDYTOWALNE_PRODUKTU)`** → `aktualizujProdukt` → pętla po
  zmienionych polach (`stary[pole] !== nowa`): `zapiszPoprawke(manual_overrides)` +
  `zapiszWpisDziennika(history)` → audyt `edycja_produktu` z `{zmiany: Object.keys(…)}`.
  ⚠ `reason` domyślnie `"edycja w katalogu"`; `overrideValue` = `String(k)`, `null` → `""`.
- `DELETE /api/products/:id` — `usunProdukt` → 404 albo audyt `usuniecie_produktu` + `{ok: true}`.
  Bez kaskad (osierocone `manual_overrides`/`history` to zastane zachowanie oryginału).
- `GET /api/products/uwagi-cena`, `GET /api/products/hold-reasons` (D7). ⚠ Rejestracja PRZED
  ewentualnymi trasami parametrycznymi; `GET /api/products/{id}` nie istnieje, więc kolizji nie ma.
- Odpowiedź `PUT`/`PATCH` idzie w **projekcji kontraktowej** (`KOLUMNY_API`), żeby `uwagaCena`
  nie wyciekła do API — tak samo jak przy dostawcach w 3f-2.

### Krok 6 — `contract/openapi.yaml` (D3)
`404` przy trzech operacjach `/api/products/{id}` + dwie nowe ścieżki `GET` (bez schematów ciał).

### Krok 7 — testy (patrz niżej)

## Testing strategy

**1. Charakteryzacja `addProductsBulk` (dowód wierności, wzorzec 3d-2).**
Nowy plik `test/charakteryzacja/produkty-bulk.charakteryzacja.test.ts`: dwie bazy z tego samego
kanonu (`001+002+003`), oryginał wycięty harnessem po jednej stronie, nasz port po drugiej,
ten sam wsad → **porównanie końcowego stanu tabeli `products`** (plus `link_pamiec_*`,
`nazwa_pamiec`, `waga_pamiec`). Przypadki: nowy produkt; aktualizacja istniejącego;
rekord bez `kod` (pomijany); `cenaZakupu = 0` (gałąź cenowa nieaktywna); z regułą w `markups`
i z regułą w `promotions` (dowodzi, że gałąź cenowa liczy tak samo); pole `kodImportu`
porównywane po kształcie, nie wartości (generator używa `Math.random()`, jak odnotowuje
`bridge-ext.ts`). Test integralności bundla (sha256) rozszerzony o nowy wycinek.

**2. Testy tras** (`test/produkty.mutacje.test.ts`), przeciw prawdziwej bazie w katalogu
tymczasowym i portom efemerycznym — bez mocków warstwy danych:
- lista pól: `PATCH` z `marzaPct`, `kodImportu`, `uwagaCena`, `id`, `kod`, `dostawca` w ciele
  → żadne z nich nie zmienia bazy, a pola z listy tak;
- auto-status: `PATCH {cenaSprzedazy: 0}` bez `status` → `status = "wstrzymany"`; to samo dla
  `cenaZakupu`; `PATCH {cenaZakupu: 0, status: "aktywny"}` → status NIE jest nadpisywany;
- `manual_overrides` per pole: `PATCH` z trzema zmienionymi polami → trzy wiersze; pole
  wysłane z niezmienioną wartością → BRAK wiersza; `_reason` trafia do `reason`, brak `_reason`
  → `"edycja w katalogu"`;
- `history`: te same trzy pola → trzy wpisy z `zrodlo: "recznie"`; `GET /api/history` przestaje
  zwracać `[]`;
- `PUT` zachowuje się jak `PATCH` (D2);
- `404` dla nieistniejącego `id` na `PATCH`/`PUT`/`DELETE`; `401` bez tokenu na wszystkich sześciu;
- `POST` bulk: kształt `{ok, dodano}`, oba warianty ciała (tablica i `{items}`), audyt;
- `uwagaCena` NIE wycieka do odpowiedzi `PATCH`/`PUT` (projekcja kontraktowa);
- `hold-reasons`: po jednym produkcie na każdy z 5 przypadków → dosłowne teksty i kolejność
  warunków (produkt z `uwaga_cena` ORAZ `cena = 0` daje treść `uwaga_cena`, nie „Brak ceny");
- `uwagi-cena`: klucz `uwaga_cena` w `snake_case`, filtr `IS NOT NULL AND <> ''`.

**3. GATE kontraktu** (`test/produkty.mutacje.gate.test.ts`): `sprawdzZgodnoscZKontraktem` dla
wszystkich sześciu operacji i dla kodów 200/401/404. **Gate fixtures nie obowiązuje** — brak
nagrań, uzasadnione w sekcji „Kontrakt i fixtures" wyżej.

**4. Bramki:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/backend/`.

## Out of scope

- **FE:** dialog edycji `LT()`, menu „Akcje" w wierszu `/katalog` → **12c** (po merge tej sesji).
- **Konto/admin/maintenance:** `POST /api/password/change`, `GET /api/users`, `/api/admin/*`,
  `POST /api/maintenance/usun-nieopony`, **`POST /api/products/clear`**, `GET /api/audit-log` → **12b**.
- **Przenagranie fixtures i pełne schematy ciał w `openapi.yaml`**, w tym `GET_products.json`
  z `szerokosc` jako TEXT i zdjęcie `WYJATKI_GET_PRODUCTS` → **12d**.
- **Finalny audyt bezpieczeństwa** i przegląd 12 widoków z Anią → **12e**.
- **Ujawnienie `uwagaCena` w `GET /api/products`** — wymaga przenagrania fixture'a (12d).
  Kolumna zostaje ukryta projekcją; nowe trasy `uwaga_cena` oddają ją własnym, jawnym SELECT-em.
- Kaskadowe kasowanie `manual_overrides`/`history` przy `DELETE` — oryginał tego nie robi.

## Definition of done

- [ ] `POST /api/products` (bulk) zapisuje z gałęzią cenową, sześcioma rozszerzeniami importu
      i propagacją `uwagaCena`; zwraca `{ok, dodano}`; oba warianty ciała.
- [ ] `PATCH`/`PUT /api/products/{id}` — wspólny handler, lista 41 pól, auto-status przy cenie 0,
      `manual_overrides` + `history` per zmienione pole, audyt `edycja_produktu`, 404.
- [ ] `DELETE /api/products/{id}` — 404 albo audyt `usuniecie_produktu` + `{ok: true}`.
- [ ] `GET /api/products/uwagi-cena` i `GET /api/products/hold-reasons` — kształt 1:1 z D7.
- [ ] Charakteryzacja `addProductsBulk` zielona (oryginał z bundla vs port, stan bazy).
- [ ] `contract/openapi.yaml`: dwie nowe ścieżki + `404` przy trzech operacjach `{id}`.
- [ ] GATE kontraktu zielony dla sześciu operacji; `lint`/`typecheck`/`build`/`test` czyste.
- [ ] Roadmapa: blok I12 sprostowany (rozjazdy 1–4), 12a oznaczona jako zrobiona;
      backlog #14 domknięty dla produktów, #4 zaktualizowany.
