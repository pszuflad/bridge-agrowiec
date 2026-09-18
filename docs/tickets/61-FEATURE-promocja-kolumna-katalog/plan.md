# 61-FEATURE-promocja-kolumna-katalog — kolumna „Promocja" w Katalogu zaczyna pokazywać promocję

> Status: Draft
> Branch: `feature/61-promocja-kolumna-katalog`
> Worktree: `.worktrees/61-FEATURE-promocja-kolumna-katalog`
> Blok roadmapy: I14, karta **14h** (FALA 2)

## Opis ticketa

14h — Iteracja 14: kolumna „Promocja" w Katalogu zaczyna pokazywać działającą promocję.

Decyzja Ani z 2026-09-18 (backlog #22): „W kolumnie promocje mają się wyświetlać aktualne
promocje dla danych produktów" oraz, po dopytaniu: „dodaj regułę wypełniania kolumny promocja".

`GET /api/products` ma dokładać do każdego produktu `_reguly.promocja` — wygrywającą, aktywną
promocję albo brak pola, gdy żadna nie pasuje. Dopasowanie MUSI iść przez istniejące funkcje
silnika cen (`wybierzPromocje`, `promocjaPasuje`), nie przez nową, własną implementację.

## Kontekst

### ⚠ To jest NOWA FUNKCJA i ŚWIADOME ODSTĘPSTWO, nie naprawa regresji

Ania pamięta, że kolumna „działała w starym Bridge i zepsuł ją jakiś backup". **Kod tego nie
potwierdza w ŻADNEJ wersji, którą mamy** — i to trzeba jej powiedzieć wprost, żeby nie liczyła
na „powrót do stanu sprzed backupu" i nie wyceniała tego jak naprawy:

- `mirror/frontend/assets/index-PRICEFMT1783512500.js` (żywy bundle produkcji — potwierdzony
  przez `grep -o 'src="./assets/index[^"]*"' mirror/frontend/index.html`) ma **dokładnie jedno**
  wystąpienie `._reguly` i jest to miejsce **ODCZYTU**;
- `mirror/backend/index.cjs` nie ma go wcale — dwa trafienia `grep -o "_reguly"` to substring
  kolumny `dodatkowe_reguly` z tabeli `spedycja_limity`;
- `git log -S'_reguly:' --all` zwraca **dokładnie jeden** commit — `538e3b3`, czyli **nasz
  własny wpis dokumentacyjny** do roadmapy/backlogu. Ani jednego commita z kodem produkcji.
  (`git log -S'_reguly' --all` daje 18 commitów i wszystkie są naszą pracą portową
  i dokumentacyjną — 54-DOCS, 16-FEATURE-widok-narzuty-promocje itd.)
- Odczyt istniał już w baseline'ie z 2026-08-13 (`deminified/frontend-index.js`, 1 wystąpienie),
  więc **żadna łatka Ani go nie dodała ani nie usunęła** — nie ma czego „przywracać".

Nikt nigdy nie dopisał **zapisu** tego pola. Kolumna jest w domyślnym zestawie kolumn katalogu
i od zawsze renderuje „—". Źródło: `docs/rebuild-backlog.md` #22 („SPROSTOWANIE ARCHEOLOGICZNE"),
`docs/rebuild-roadmap.md` §I14.

Powiązane, niezależne ustalenie z 14e: pusta kolumna **nie wpływała na ceny** — przy promocji
`marka→BKT` ceny 954 produktów spadły poprawnie mimo pustej kolumny. Ania: „tylko się nie
wyświetlało, cena się oblicza prawidłowo". Czyli naprawiamy wyłącznie WIDOCZNOŚĆ.

### Co już jest w `rebuild/` i czego nie trzeba pisać

| Element | Miejsce | Stan |
|---|---|---|
| Renderer kolumny | `rebuild/frontend/src/pages/katalog/formatowanie.tsx:142-160` | ✅ gotowy — czyta `produkt._reguly?.promocja`, rysuje pomarańczową odznakę `-N%` + nazwę, przy braku „—" |
| Kolumna w pikerze | `rebuild/frontend/src/pages/katalog/kolumny.ts:84` | ✅ jest |
| Typ `Produkt` na FE | `rebuild/frontend/src/pages/katalog/filtrowanie.ts:33` | ✅ ma `[pole: string]: unknown`, więc `produkt._reguly` już się typuje — **FE nie wymaga zmian** |
| Dopasowanie promocji | `rebuild/backend/src/repos/ceny.ts:121-163` | ✅ `promocjaPasuje` + `wybierzPromocje` — reużywamy, nie dotykamy |
| Lista promocji | `rebuild/backend/src/repos/promotions.ts:52` `listaPromocji(db)` | ✅ reużywamy (tylko odczyt) |
| Wzorzec „wczytaj raz, potem pętla" | `rebuild/backend/src/repos/ceny.ts:234-235` (`przeliczCenyZRegul`) | ✅ do naśladowania |
| Odczyt katalogu | `rebuild/backend/src/repos/products.ts:22,37` | jawna projekcja `KOLUMNY_API`, 72 klucze camelCase |

`RekordCenowy` to `Record<string, unknown>` (`ceny.ts:31`), więc `Produkt` wchodzi do
`wybierzPromocje` bez konwersji. Do dopasowania potrzebne są `marka` i `kategoria` — obie są
w `KOLUMNY_API`.

### Dlaczego NIE piszemy własnego dopasowania

1. Backlog #23 i #24 opisują, że w systemie są **już trzy** sposoby liczenia ceny (backend,
   symulator, ostrzeżenie „poniżej kosztu"). Czwarty sposób dopasowania promocji byłby fabryką
   rozjazdów.
2. Karta **14f** sprawi, że daty zaczną kończyć promocje (backlog #19, decyzja Ani 2026-09-19:
   „data ma naprawdę kończyć promocje"). Rekomendowany tam wariant **(b) wygaszacz statusu**
   przestawia `status` na `zakonczona` i **nie rusza silnika** — więc kolumna zacznie
   respektować daty **sama**, bez otwierania tej karty, o ile korzysta ze wspólnej funkcji.
   Zduplikowana logika tego nie dostanie.

**Tu NIE implementujemy logiki dat.** Dziś `promocjaPasuje` dat nie czyta (`ceny.ts:110-116`)
i tak ma zostać do 14f.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ścieżka w zakresie:** `GET /api/products` (`contract/openapi.yaml:19563-19571`).
Oba warianty odpowiedzi dzielą jeden schemat pozycji `GETProducts200ItemsPozycja`:
`GETProductsOdpowiedz200` (koperta) i `GETProductsOdpowiedz2002` (goła tablica), spięte przez
`GETProductsOdpowiedz200Warianty` (`openapi.yaml:17531-17556`).

**Fixtures w zakresie:**
- `contract/fixtures/GET_products.json` — wariant `?limit=5`, koperta `{items,total,limit,offset}`, **72 klucze** w pozycji;
- `contract/fixtures/GET_products_bez-parametrow.json` — goła tablica, **72 klucze**.

**Żadnego fixture'a NIE ruszamy.** Fixtures to nagranie produkcji, a produkcja `_reguly` nie
zwraca — edycja byłaby fałszowaniem dowodu i łamie regułę gate'a „nie poprawiamy fixture'a".
Dodatkowo `contract/fixtures/` są **wspólne z frontendem** (`rebuild/frontend/test/msw/kontrakt.ts`
i ~20 plików testów FE, w tym `katalog.formatowanie.test.tsx`) — to nauka z 13c.

**Gdzie stoi bramka wierności i co ją zapali.** `rebuild/backend/test/katalog.gate.test.ts`
asertuje 72 klucze w **trzech** miejscach, a `test/gate/ksztalt.ts:68-76` zgłasza każdy klucz
nadmiarowy jako twardy błąd (filtr `/^_/` obejmuje wyłącznie klucze **fixture'a**, nie odpowiedzi):

1. `sprawdzZgodnoscZFixture(...)` dla obu wariantów → `_reguly` = „klucz nadmiarowy";
2. test „NIE oddaje uwagaCena" → `expect(Object.keys(pozycja)).toHaveLength(72)` dla obu ścieżek;
3. test „pozycja ma dokładnie te 72 klucze co fixture" → `toEqual(oczekiwane)`.

**Kluczowa obserwacja:** `katalog.gate.test.ts` **nie zasiewa żadnej promocji**
(`zasiejPromocjeTestowa` istnieje w `test/gate/dane.ts:466`, ale ta bramka jej nie woła). Pole
jest **warunkowe** — pojawia się wyłącznie przy dopasowanej, aktywnej promocji — więc wszystkie
trzy asercje zostaną zielone **bez żadnej zmiany**. To prawda, ale byłaby to zieloność
„przez przypadek", więc świadomie dokładamy strażnika (D5).

**Rozjazdy:** brak rozjazdu spec↔oryginał↔fixtures. Roadmapa §I14 i backlog #22 zgadzają się ze
stanem faktycznym kodu; sprawdzone. Kolejka do `contract/` wolna — 14i nie ruszyła kontraktu
w ogóle.

## Decisions

Wszystkie z rundy Q&A z użytkownikiem (2026-09-18). **D1–D4 to jedno, wspólne świadome
odstępstwo od produkcji**: `GET /api/products` zaczyna oddawać klucz, którego nagrana produkcja
nie ma. Decyzja źródłowa: Ania, 2026-09-18, backlog #22 (✅ TAK, ożywienie).

**D1 — ładunek minimalny `{ wartosc, nazwa }`.**
`wartosc` = `promotions.rabat_pct` (REAL, model: `rabatPct`), `nazwa` = `promotions.nazwa`.
Dokładnie tyle, ile czyta renderer i ile czytał oryginał. *Za:* najmniejsza powierzchnia
odstępstwa, łatwa do opisania i wycofania. *Przeciw (odrzucone):* `id` byłoby polem, którego
dziś nikt nie czyta; cały wiersz promocji wyciekłby do katalogu razem z `warunki` jako surowy
JSON; `narzut` obok promocji nie ma odbiorcy w rendererze (i jest zakresem 14f).

**D2 — brak dopasowania = BRAK POLA `_reguly`, nie `_reguly: {}`.**
Produkt bez pasującej promocji ma dokładnie te 72 klucze co produkcja. *Za:* odstępstwo jest
wtedy minimalne i warunkowe — niezmiennik „72 klucze" pozostaje prawdziwy dla zdecydowanej
większości katalogu, a renderer i tak sprawdza `if (!promocja) return <Kreska />`.

**D3 — pole trafia do OBU kształtów odpowiedzi.**
Goła tablica (bez parametrów — tej używa Katalog) **i** koperta (`?limit=`, `?dostawca=`).
*Za:* jedna trasa zachowuje się spójnie; karta dostawcy też zobaczy promocję. *Przeciw
(odrzucone):* ograniczenie do gołej tablicy zostawiłoby trasę, która raz oddaje pole, a raz
nie — rozjazd, który ktoś kiedyś odkryje boleśnie.

**D4 — kontrakt: KOMENTARZ nad ścieżką `/api/products`, bez węzła schematu.**

⚠ **Pierwsza wersja D4 była błędna i została odrzucona po weryfikacji.** Zakładała, że
w `components.schemas` istnieje ręczna sekcja poza blokiem generowanym. **Nie istnieje:** klucz
`schemas:` sam leży WEWNĄTRZ bloku (`openapi.yaml:18` POCZĄTEK → `:18716` KONIEC, a bezpośrednio
po nim zaczyna się `paths:`). Dopisanie własnego `schemas:` przed znacznikiem dałoby
**zduplikowany klucz YAML**, czyli cichą utratę jednej z gałęzi — lekarstwo gorsze od choroby.

Stan faktyczny, który to wymusza: blok jest **generowany wyłącznie z `contract/fixtures/`**,
a generator **z definicji pomija klucze zaczynające się od `_`**
(`tools/generate-openapi-schemas.cjs:53,65` — traktuje je jako techniczne klucze nagrywarki).
`--sprawdz` porównuje **cały plik tekstowo** (`:465-472`) i jest **realną bramką `npm test`**
(`rebuild/backend/test/kontrakt.spojnosc.test.ts:112`). Nie da się też „nagrać" pola z oryginału,
bo produkcja nigdy go nie wypełnia — droga z precedensu ticketu 58 tu nie działa.

Dlatego: **komentarz nad `/api/products:`** w sekcji `paths`, opisujący odstępstwo (kształt
`_reguly`, decyzja Ani z 2026-09-18, backlog #22, oraz dlaczego pola nie ma w schemacie niżej).
**Zweryfikowane empirycznie w tym worktree:** komentarz w tym miejscu przeżywa zarówno
`--sprawdz`, jak i **pełny bieg generatora** (wstawiony, przepuszczony, przywrócony — plik wrócił
do stanu wyjściowego, `--sprawdz` zielony).

*Za:* kontrakt niesie opis odstępstwa dokładnie tam, gdzie czytelnik go szuka; generator zostaje
nietknięty i idempotentny. *Świadomy koszt:* to komentarz, nie węzeł schematu — żaden walidator
go nie wymusi. Nic jednak nie odrzuca, bo `additionalProperties` nie jest w tym pliku ustawione
nigdzie. *Przeciw (odrzucone):* rozszerzanie generatora o tabelę odstępstw daje pełny, walidujący
schemat, ale rusza plik **poza własnością tej karty**, wspólny dla wszystkich sesji; nieruszanie
kontraktu w ogóle = dryf, przed którym ostrzega `CLAUDE.md`.

*Follow-up:* wariant „generator z tabelą odstępstw" rozwiązałby też nierozliczony **follow-up #1
z ticketu 58** (`ean` nullable) — to ten sam mechanizm. Kandydat na osobną kartę.

**D5 — bramka: istniejące asercje NIETKNIĘTE + nowy strażnik z zasianą promocją.**
Nie rozluźniamy `porownajKsztalt`, nie wyłączamy żadnego testu, nie ruszamy trzech asercji
72 kluczy — one dalej dowodzą, że produkt **bez** promocji jest 1:1 z produkcją. Dochodzi
**nowy** test, który zasiewa promocję pasującą do produktu z seeda i żąda 73. klucza `_reguly`
o zadanym kształcie, z komentarzem opisującym odstępstwo. *Za:* odstępstwo staje się jawne
i pilnowane z obu stron (że jest, gdy ma być; że go nie ma, gdy nie ma promocji), przy zerowym
rozluźnieniu porównania. *Przeciw (odrzucone):* parametr `dozwoloneNadmiarowe` w
`test/gate/ksztalt.ts` ruszałby helper wspólny dla **wszystkich** bramek — więcej powierzchni
ryzyka, niż karta wymaga; dopisanie `_reguly` do fixture'a to fałszowanie nagrania.

**D6 — wydajność: lista promocji wczytana RAZ przed pętlą.**
Katalog to ~7400 produktów. Wzorzec 1:1 z `przeliczCenyZRegul` (`ceny.ts:234-235`).
Zero zapytań per produkt.

**D7 — frontend bez zmian W KODZIE.**
Weryfikacja wykazała, że renderer (`formatowanie.tsx:142-160`) i piker (`kolumny.ts`) są gotowe,
a typ `Produkt` ma sygnaturę indeksową, więc `produkt._reguly` już się typuje. Renderer jest
**bajt w bajt zgodny z żywym bundlem produkcji** (`const p=e?._reguly?.promocja; if(!p)…;
const rabat=p.wartosc; const nazwa=p.nazwa||"Promocja"`) — co niezależnie potwierdza D1.
Karta jest **czysto backendowa**; dochodzą wyłącznie testy.

Brak ryzyka zapisu zwrotnego: `zapiszProdukt` (`katalog/api.ts:64-70`) wysyła **tylko zmienione
pola** formularza, a backend i tak filtruje ciało przez `POLA_EDYTOWALNE_PRODUKTU`
(`repos/products.ts:199-247`), gdzie `_reguly` nie występuje.

**D8 — poprawiamy DWA nieaktualne komentarze na FE (zmiana wyłącznie w komentarzach).**
`kolumny.ts:80-89` i `formatowanie.tsx:142-145` twierdzą dziś, że kolumna jest MARTWA i że to
„port 1:1, decyzja użytkownika". Po tej karcie to nieprawda. Zmieniamy **wyłącznie treść
komentarzy** — zero zmian w JSX, w typach i w zachowaniu. *Za:* zostawienie ich to dokładnie ten
rodzaj dryfu dokumentacyjnego, który ten projekt ściga. *Koszt:* świadome wyjście poza literę
przydziału plików („FE tylko, jeśli renderer nie wystarcza") — **odnotowane w raporcie**.
Ryzyko konfliktu żadne: 14f siedzi w `/narzuty`, 14j w `/historia`.

**D9 — dziś w bazie NIE MA ŻADNEJ PROMOCJI i to musi trafić do raportu dla Ani.**
`db/snapshot.db`: `products` = 7405 wierszy, `promotions` = **0**; produkcyjny fixture
`GET_promotions.json` to pusta tablica. Kolumna zaświeci dopiero, gdy Ania **założy promocję**
w `/narzuty`. Bez tego zdania w raporcie zgłosi „dalej nie działa" — i będzie miała rację
z własnego punktu widzenia.

## Implementation plan

### Krok 1 — wzbogacenie odczytu katalogu (BE)

`rebuild/backend/src/repos/products.ts`:

- nowy typ eksportowany:
  ```ts
  export type PromocjaProduktu = { wartosc: number; nazwa: string };
  export type ProduktZRegulami = Produkt & { _reguly?: { promocja: PromocjaProduktu } };
  ```
- nowa funkcja `dolaczReguly(produkty: Produkt[], promocje: Promocja[]): ProduktZRegulami[]`:
  - dla pustej listy promocji zwraca wejście bez kopiowania (szybka ścieżka — dziś to stan
    produkcji, `GET_promotions.json` jest pustą tablicą);
  - dla każdego produktu woła `wybierzPromocje(promocje, produkt as RekordCenowy)`;
  - trafienie → `{ ...produkt, _reguly: { promocja: { wartosc: p.rabatPct, nazwa: p.nazwa } } }`;
  - brak → zwraca **ten sam obiekt** produktu (bez `_reguly`, D2).
- komentarz nad funkcją: świadome odstępstwo, decyzja Ani 2026-09-18, backlog #22, i że
  dopasowanie celowo idzie przez silnik cen (z powodem: 14f i backlog #23/#24).

Import `wybierzPromocje` z `./ceny.js` i `listaPromocji` z `./promotions.js` — **tylko odczyt**,
żadnego z tych plików nie modyfikujemy (`repos/ceny.ts` to zakres 14f).

### Krok 2 — wpięcie w trasę (BE)

`rebuild/backend/src/routes/products.ts`, handler `GET /api/products`:

- `const promocje = listaPromocji(db);` — **raz**, przed rozgałęzieniem na dwa kształty (D6);
- gałąź gołej tablicy: `res.json(dolaczReguly(listaProduktow(db), promocje))`;
- gałąź koperty: `items: dolaczReguly(items, promocje)` (D3);
- rozszerzyć komentarz nagłówkowy trasy o odstępstwo 14h.

### Krok 3 — kontrakt (D4)

`contract/openapi.yaml`, **nad linią `  /api/products:`** w sekcji `paths` (dziś :19563):
blok komentarza opisujący odstępstwo — kształt `_reguly`, decyzja Ani z 2026-09-18, backlog #22,
oraz dlaczego pola nie ma w schemacie niżej (blok `schemas` generowany z fixtures, generator
pomija klucze `_*`).

Weryfikacja: `node tools/generate-openapi-schemas.cjs --sprawdz` **oraz** pełny bieg
`node tools/generate-openapi-schemas.cjs` + `git diff` — komentarz musi przetrwać oba
(sprawdzone prototypowo: przetrwał).

### Krok 4 — komentarze FE (D8)

`rebuild/frontend/src/pages/katalog/kolumny.ts:80-89` i
`rebuild/frontend/src/pages/katalog/formatowanie.tsx:142-145` — **wyłącznie treść komentarzy**.
Żadnej zmiany w JSX, typach ani zachowaniu.

### Krok 5 — testy (patrz „Testing strategy")

### Krok 6 — docs

`docs/rebuild-roadmap.md` (podblok 14h → zrobione, data + ID ticketa),
`docs/rebuild-backlog.md` (#22 → Status),
`docs/spec-frontend.md:235-236` (mówi dziś „kolumna zostaje MARTWA (…) port 1:1" — decyzja Ani
z 18.09 to odwraca).

## Testing strategy

**GATE odbudowy — `rebuild/backend/test/katalog.gate.test.ts`:**
- trzy istniejące asercje 72 kluczy **zostają bez zmian** i muszą przejść — to dowód, że
  produkt bez pasującej promocji jest nadal 1:1 z nagraniem produkcji;
- `sprawdzZgodnoscZFixture` dla `GET_products.json` i `GET_products_bez-parametrow.json`
  bez zmian;
- **NOWY strażnik odstępstwa (D5)**: zasiewa promocję pasującą do produktu z seeda
  (`zasiejPromocjeTestowa` albo własna, jeśli `zasieg: "BKT,MICHELIN"` nie trafia w seed
  katalogu — do sprawdzenia w implementacji) i sprawdza, że:
  - produkt dopasowany ma **73** klucze, w tym `_reguly`,
  - `_reguly.promocja` ma dokładnie `{ wartosc, nazwa }` o poprawnych typach,
  - produkt **nie**dopasowany dalej ma 72 klucze i **nie** ma `_reguly` (D2),
  - dzieje się to w **obu** kształtach odpowiedzi (D3);
- test „bez promocji w bazie → wszystkie pozycje mają 72 klucze" jako jawna kotwica D2.

**Testy jednostkowe** (`rebuild/backend/test/produkty.test.ts` lub nowy plik katalogu):
wygrywa promocja o wyższym priorytecie; promocja `status != "aktywna"` jest pomijana;
`wartosc` bierze się z `rabatPct`; pusta lista promocji nie dokłada pola.

**Czego NIE testujemy:** logiki dat (`promocjaPasuje` ich nie czyta — zakres 14f);
zachowania renderera FE (istniejące testy `katalog.formatowanie.test.tsx` pokrywają je od 4b).

**Bramki:** backend `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`.
`node tools/generate-openapi-schemas.cjs --sprawdz` (ruszamy kontrakt).
Frontend: **nie ruszamy ani fixtures, ani kodu FE**, więc bramki FE nie są wymuszone — ale
puszczę je kontrolnie, skoro `contract/` jest wspólne (tanie, a 13c nauczyło).

## Out of scope

- **Logika dat** kończących promocję — karta 14f (backlog #19).
- **Zmiany w `repos/ceny.ts`** — czytamy, nie modyfikujemy (14f).
- `pages/narzuty/**` (14f), `src/historia/**` i `test/historia.*` (14j, chodzi równolegle),
  `src/import/**`.
- **Zmiany w `contract/fixtures/`** — świadomie zero (D4/D5).
- Kolumna dla **narzutu** obok promocji (D1). Oryginał nigdzie nie czyta `_reguly.narzut` —
  dołożenie go byłoby wymyśleniem ponad to, co produkcja kiedykolwiek miała.
- **Węzeł schematu dla `_reguly` w `openapi.yaml`** i rozszerzanie
  `tools/generate-openapi-schemas.cjs` o tabelę świadomych odstępstw — odrzucone w D4,
  kandydat na osobną kartę razem z follow-upem #1 z ticketu 58.
- **Zmiany w zachowaniu frontendu** — dotykamy wyłącznie komentarzy (D8).

## Definition of done

- [ ] `GET /api/products` bez parametrów (goła tablica) dokłada `_reguly.promocja` do produktów
      z pasującą, aktywną promocją
- [ ] To samo w wariancie kopertowym (`?limit=`, `?dostawca=`) — D3
- [ ] Produkt bez pasującej promocji **nie ma** klucza `_reguly` i ma dokładnie 72 klucze — D2
- [ ] Dopasowanie idzie przez `wybierzPromocje`/`promocjaPasuje` z `repos/ceny.ts`; zero
      własnej implementacji dopasowania; `repos/ceny.ts` niezmieniony
- [ ] Lista promocji wczytywana RAZ na żądanie, nie per produkt — D6
- [ ] `contract/fixtures/` niezmienione
- [ ] `contract/openapi.yaml` opisuje odstępstwo komentarzem nad `/api/products`;
      `generate-openapi-schemas.cjs --sprawdz` przechodzi, a komentarz przeżywa pełną regenerację
- [ ] Dwa nieaktualne komentarze na FE poprawione — bez zmiany zachowania (D8)
- [ ] Raport mówi WPROST, że kolumna zaświeci dopiero po założeniu promocji (dziś 0 w bazie, D9)
- [ ] Trzy istniejące asercje 72 kluczy w `katalog.gate.test.ts` **nietknięte** i zielone
- [ ] Nowy strażnik odstępstwa w bramce katalogu — zielony, z komentarzem (co/dlaczego/kto/kiedy)
- [ ] Frontend bez zmian w kodzie produkcyjnym (D7)
- [ ] Bramki backendu zielone: lint, typecheck, build, test
- [ ] Raport mówi WPROST, że to nowa funkcja, a nie powrót do stanu sprzed backupu
- [ ] Roadmapa 14h i backlog #22 opisują STAN, nie zamiar
