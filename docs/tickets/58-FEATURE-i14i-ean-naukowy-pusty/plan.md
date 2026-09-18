# 58-FEATURE-i14i-ean-naukowy-pusty — EAN w notacji naukowej trafia do katalogu jako PUSTE pole

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `feature/58-i14i-ean-naukowy-pusty`
> Worktree: `.worktrees/58-FEATURE-i14i-ean-naukowy-pusty`
> Blok roadmapy: **I14, podblok 14i** (druga fala I14)

## Opis ticketa

14i — Iteracja 14: EAN w notacji naukowej trafia do katalogu jako PUSTE pole.

Decyzja Ani z 2026-09-18 (backlog #11, wpis czekał na nią od 26.08): „EAN który jest zepsuty
notacją naukową ma być importowany jako puste pole w katalogu". To **świadome odstępstwo** od
produkcji — oryginał zapisuje wartość i wypisuje komunikat „zapis naukowy ma tylko null cyfr
znaczących — EAN niepewny" (ten „null" w komunikacie to osobny defekt oryginału, opisany
w backlogu #11; **nie naprawiamy go przy okazji**).

## Kontekst

`normalizujEan()` w `rebuild/backend/src/import/silnik/ean.ts:106` rozpoznaje zapis naukowy
(`ZAPIS_NAUKOWY`), rozwija go i nadaje status `scientific_notation_uncertain` (`:128` dla
rozwinięcia dającego 13 cyfr, `:140` dla pozostałych). Konsumenci:

- `src/import/tk.ts:325` — buduje z tego składnik `ostrzezenie`/`powod` wiersza stagingu;
- `src/import/tk.ts:387` / `:518` — przepisuje `eanRaw`/`eanIsValid`/`eanSourceStatus`/
  `eanCandidates` do wiersza stagingu i do `snapshotJson`;
- `src/import/akceptacja.ts:109` — `ean: snapshot.ean ?? null`, jedyne miejsce, w którym EAN
  z importu trafia do `products`.

### Graf wywołań — komplet dróg do `products.ean` (zweryfikowany grepem)

| Ścieżka | Miejsce | Skąd `ean` |
|---|---|---|
| Akceptacja pozycji stagingu | `src/import/akceptacja.ts:109` | **wyłącznie** ze `snapshot` |
| Auto-zatwierdzanie w silniku | `src/import/tk.ts:207-209` | **nie dotyka `ean` w ogóle** — auto-patch obejmuje tylko `cenaZakupu`/`cenaSprzedazy`/`marzaPct`/`stan`/`magazyn` |
| `POST /api/products` (bulk) | `src/import/bulk.ts:71-87` | wprost z ciała żądania; **nie przechodzi przez `normalizujEan()`**, więc nie zna pojęcia `eanSourceStatus` |
| `PATCH`/`PUT /api/products/{id}` | `src/repos/products.ts:93-117` | patch z ciała żądania, bez związku z importem |
| Selly | `repos/selly.ts`, `selly/generator-csv.ts` | tylko `select()`, **nie zapisuje** do `products` |

**Wniosek:** jedyną drogą, którą wartość ze statusem `scientific_notation_uncertain` może
trafić do `products.ean`, jest `akceptacja.ts:109`. Cięcie w tym miejscu łapie 100% dróg
importu.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Kontrakt NIE jest ruszany — decyzja użytkownika (patrz D4).** Zakres do weryfikacji w GATE:

- `GET /api/products` → `contract/fixtures/GET_products.json`,
  `GET_products_bez-parametrow.json`, `GET_products_hold-reasons.json`,
  `GET_products_uwagi-cena.json` — zmierzone: **5/5/5/1 wystąpień `ean`, zero `null`, żadnej
  wartości w notacji naukowej**. Zmiana nie przestawia tu żadnej wartości, bo żaden z tych
  produktów nie ma statusu `scientific_notation_uncertain`.
- `contract/fixtures/` ogółem: **0 plików** zawiera `scientific_notation_uncertain`,
  `6,41944E+12`, `6419440000000`, `8,05997E+12` ani `8059970000000` (potwierdzone `grep -rl`).
- `contract/openapi.yaml` — **bez zmian**.

### Rozjazd odnotowany, świadomie NIE naprawiany w tym tickecie

`GETProducts200ItemsPozycja.ean` w `contract/openapi.yaml` to `type: "string"`, pole jest
w `required` i **nie ma `nullable: true`** — podczas gdy produkcja realnie zwraca `null`:
w `db/snapshot.db` **157 z 7405 produktów ma `ean IS NULL`** (plus 1 `ean = ''`), a rozkład
`ean_source_status` to `ok: 7246`, `NULL: 157`, `no_valid_candidate: 1`, `memory: 1`.
Zwężenie jest **artefaktem próbkowania**: schemat generuje się z fixtures, a `GET_products.json`
nagrał 5 wierszy i wszystkie akurat miały EAN. To stan **sprzed** naszej zmiany i nasza zmiana
go nie pogłębia (nie ruszamy żadnego fixture'a). → **Follow-up**, nie zakres 14i.

⚠ Przy okazji ustalono, dlaczego tego nie da się „po prostu poprawić ręcznie": schematy
w `openapi.yaml` są w całości generowane przez `tools/generate-openapi-schemas.cjs` do bloku
między znacznikami POCZĄTEK/KONIEC, a `test/kontrakt.spojnosc.test.ts:112` uruchamia generator
z `--sprawdz` i **wywala się na każdej ręcznej edycji**. Legalna droga to nagranie fixture'a
zawierającego produkt z `ean: null` (generator scala nagrania tej samej operacji regułą
`a.nullable && !b.nullable → {...b, nullable: true}`) albo dobudowanie mechanizmu jawnych
poszerzeń w generatorze. Obie odrzucone w tym tickecie — patrz D4.

## Decisions

**D1 — Cięcie w `akceptacja.ts` (wariant B), nie w `ean.ts` (wariant A).** ⭐ decyzja użytkownika

Zmierzony koszt obu wariantów:

| | (A) `ean.ts` | (B) `akceptacja.ts` |
|---|---|---|
| scenariusze charakteryzacji silnika | **1** (`ean-notacja-naukowa`) | **0** |
| scenariusze charakteryzacji akceptacji | 0 | **0** |
| testy | **1** (`silnik.gate.test.ts`, 3 asercje) | **0** |
| pliki `contract/fixtures/` | 0 | **0** |

Uzasadnienie wyboru (B) — trzy powody, w kolejności wagi:

1. **(A) wykracza poza decyzję Ani.** `tk.ts:302-305` dopasowuje pozycję do produktu
   w katalogu **po `znormalizowana.ean`**. Wyzerowanie EAN-u już w `ean.ts` sprawia, że
   pozycja z EAN-em w notacji naukowej **przestaje się dopasowywać** do istniejącego produktu
   → klasyfikacja „nowa" zamiast „zmiana_kluczowa", inny `kod` w wierszu stagingu i realne
   ryzyko **duplikatu w katalogu**. Ania rozstrzygnęła wyłącznie o *pustym polu w katalogu*,
   nie o zmianie reguł dopasowania importu. Dowodzi tego wprost istniejący test
   `silnik.gate.test.ts` — „dopasowanie po EAN ZNORMALIZOWANYM", gdzie produkt
   `MO1_INNY-KOD-2` jest w katalogu pod `8059970000000`, a cennik podaje `8,05997E+12`.
   EAN jest też kluczem grupowania `kodImportu` (scenariusz `kod-importu-dziedziczy-sie-po-grupie-ean`).
2. **Polecenie roadmapy „wzorce trzeba przenagrać" jest przy (A) niewykonalne.**
   `test/charakteryzacja/silnik/scenariusze.expected.json` jest **zamrożony** i nagrywany
   skryptem `scripts/charakteryzacja-silnik-nagraj.mjs`, który za każdym razem uruchamia
   **ŻYWY oryginał** wycięty z `mirror/backend/index.cjs`. Przenagranie odtworzyłoby więc
   STARĄ, niechcianą wartość `"ean":"6419440000000"` — oryginał nie zna decyzji Ani.
   Świadome odstępstwo wymagałoby zbudowania od zera mechanizmu jawnego wyjątku, którego
   w repo nie ma.
3. **(B) jest dosłownie tańszy**: zero ruszonych scenariuszy, testów i fixtures.

**D2 — Ostrzeżenie i pola stagingu ZOSTAJĄ nietknięte.** Zgodnie z rekomendacją z backlogu #11
i z treścią karty. `staging_items.ostrzezenie`/`powod` dalej niosą
„EAN: scientific_notation_uncertain (…)", a `eanRaw`/`eanIsValid`/`eanSourceStatus`/
`eanCandidates` oraz `snapshotJson.ean` w stagingu zostają bez zmian — żeby pominięty EAN nie
stał się niewidzialny. Wariant (B) daje to automatycznie: silnik nie jest dotykany.

**D3 — Pola towarzyszące w KATALOGU też zostają.** ⭐ decyzja użytkownika
Puste jest wyłącznie `products.ean`. `eanRaw` (`'6,41944E+12'`), `eanIsValid`,
`eanSourceStatus` (`'scientific_notation_uncertain'`) i `eanCandidates` lądują w katalogu bez
zmian — dzięki temu z samego wiersza widać **dlaczego** pole jest puste i da się to później
naprawić ręcznie. Odrzucono czyszczenie wszystkich pól EAN jako szersze niż decyzja Ani.

**D4 — `contract/` nie jest ruszany.** ⭐ decyzja użytkownika
Zwężenie `ean` do `type: string` bez `nullable` zostaje jako follow-up. Konsekwencja
**dla kolejności w kontrakcie**: 14i **nie zajmuje slotu w `contract/`**, więc karta **14h**
wchodzi tam bez blokady kolejnościowej. Zweryfikowano, że 14h nie ma dziś ani commita
w `contract/`, ani katalogu w `docs/tickets/` — kolejność się nie rozjechała.

**D5 — Korekta roadmapy (zmiana przypisania zakresu).** ⭐ decyzja użytkownika
Roadmapa `docs/rebuild-roadmap.md:2479` przypisuje 14i do „BE: silnik importu (normalizacja
EAN)", a `:2488` każe „przenagrać wzorce". Oba zapisy są sprzeczne z pomiarem (D1). Zakres
zmienia się na **„BE: zapis do katalogu (akceptacja)"**, a nota o przenagrywaniu znika jako
niewykonalna. Zgodnie z `CLAUDE.md` §3 **fakt** (graf wywołań, nieprzenagrywalność wzorca)
zapisujemy jako fakt, a **zmianę przypisania zakresu** jako decyzję użytkownika.

**D6 — Warunek zerowania na statusie EFEKTYWNYM (założenie wykonawcze).**
Zerujemy, gdy `rekord.eanSourceStatus === "scientific_notation_uncertain"`, czyli po
uwzględnieniu `pozycja.eanSourceStatus ?? snapshot.eanSourceStatus`. Powód: to ten status
ląduje w kolumnie katalogu i to jego widzi użytkownik — dzięki temu `ean` i `eanSourceStatus`
w wierszu `products` nie mogą się rozjechać. W praktyce oba źródła są zgodne, bo `tk.ts:387`
zapisuje ten sam status do wiersza i do snapshotu.

**D7 — `POST /api/products` (bulk) poza zakresem (założenie wykonawcze).**
Ta trasa bierze `ean` wprost z ciała żądania i **nigdy nie woła `normalizujEan()`**, więc nie
ma tam statusu, na którym można by się oprzeć. Dorobienie detekcji byłoby **nowym
odstępstwem**, szerszym niż decyzja Ani („importowany" = ścieżka importu przez staging).
→ Follow-up.

### Świadome odstępstwa od oryginału w tym tickecie

| Odstępstwo | Podstawa |
|---|---|
| `products.ean` jest `NULL` dla pozycji ze statusem `scientific_notation_uncertain`; oryginał zapisuje rozwiniętą wartość (np. `6419440000000`) | Decyzja Ani 2026-09-18, backlog #11 |

Wszystko inne odtwarzamy 1:1. W szczególności **nie** naprawiamy komunikatu „ma tylko null
cyfr znaczących" (cieniowanie `Lq` — backlog #11, osobny defekt oryginału).

## Implementation plan

1. **`src/import/akceptacja.ts`** — wyłącznie fragment EAN (po zbudowaniu `rekord`, przed
   wartościami domyślnymi): jeśli `rekord.eanSourceStatus === "scientific_notation_uncertain"`,
   ustaw `rekord.ean = null`. Komentarz w stylu pliku: numer linii oryginału (`:44872`),
   treść decyzji Ani, data, odsyłacz do backlogu #11 i jawne „ODSTĘPSTWO ŚWIADOME", plus nota,
   że pola towarzyszące zostają (D3). **Nie ruszamy** `ean.ts` ani `tk.ts`.
2. **Test odstępstwa** — nowy plik `test/akceptacja.odstepstwa.test.ts`.
   ⚠ **Świadomie NIE dokładamy scenariusza do `test/charakteryzacja/akceptacja/scenariusze.mjs`** —
   ten harness porównuje **na żywo** nasz port z uruchomionym oryginałem
   (`akceptacja.charakteryzacja.test.ts`, `expect(nasz.produkty).toEqual(oczekiwany.produkty)`),
   więc scenariusz ze świadomym odstępstwem **musiałby tam paść**, a w typie scenariusza nie ma
   pola wyjątku. Wzorzec do naśladowania: `test/silnik.rownosc.test.ts` — twarde `expect`
   z komentarzem opisującym odstępstwo. Przypadki:
   - pozycja ze statusem `scientific_notation_uncertain` → `products.ean IS NULL`,
     a `eanRaw`/`eanIsValid`/`eanSourceStatus`/`eanCandidates` **zachowane** (D3);
   - kontrola negatywna: status `ok` → `ean` zapisany normalnie (dowód, że warunek jest wąski);
   - kontrola negatywna: status `no_valid_candidate` → bez zmian względem dotychczasowego
     zachowania (oryginał i tak daje tam `ean = null`, więc nie ruszamy tej gałęzi).
3. **Weryfikacja braku regresji** — pełny `npm test` w `rebuild/backend/`, ze szczególnym
   naciskiem na `akceptacja.charakteryzacja.test.ts` (31 scenariuszy porównywanych na żywo
   z oryginałem — muszą przejść **bez wyjątków**, bo żaden nie ma statusu z notacji naukowej)
   oraz `silnik.charakteryzacja.test.ts` i `silnik.gate.test.ts` (muszą przejść **nietknięte**).
4. **Docs** — `docs/rebuild-roadmap.md` (podblok 14i: stan + korekta D5 + nota o kolejności
   w kontrakcie dla 14h), `docs/rebuild-backlog.md` (#11: Status i Iteracja).

## Testing strategy

- **GATE odbudowy (fixtures/kontrakt):** ticket **nie zmienia kształtu ani wartości żadnej
  odpowiedzi API** — `contract/` nietknięty, 0 fixtures ruszonych. Weryfikacja: `npm test`
  obejmuje `kontrakt.spojnosc.test.ts` (schematy aktualne wobec fixtures) oraz
  `katalog.gate.test.ts` (`GET /api/products` 1:1 z `GET_products.json`). Obie muszą być
  zielone bez zmian w kontrakcie — to jest dowód, że gate jest spełniony.
- **Charakteryzacja (najmocniejsza siatka tutaj):** `akceptacja.charakteryzacja.test.ts`
  porównuje końcowy stan bazy naszego portu z **uruchomionym oryginałem** na 31 scenariuszach.
  Zielony wynik dowodzi, że odstępstwo jest **wąskie** — dotyka wyłącznie gałęzi
  `scientific_notation_uncertain` i nie przecieka na żadną inną ścieżkę akceptacji.
- **Test odstępstwa:** nowy `akceptacja.odstepstwa.test.ts` — 3 przypadki (pkt 2 wyżej),
  na prawdziwej bazie testowej (`stworzTestowaBaze`), bez mocków.
- **Bramki:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`
  w `rebuild/backend/`. Bramki FE **nie są wymagane** — nie ruszamy `rebuild/frontend/`
  ani `contract/fixtures/`.

## Out of scope

- Naprawa komunikatu „zapis naukowy ma tylko null cyfr znaczących" (cieniowanie `Lq`,
  backlog #11) — karta wprost tego zabrania.
- `ean.ts`, `tk.ts` i cała ścieżka silnika/stagingu — bez zmian (D1, D2).
- `contract/openapi.yaml` i `contract/fixtures/` — bez zmian (D4).
- `POST /api/products` (bulk) i `PATCH`/`PUT /api/products/{id}` (D7).
- `rebuild/frontend/**`, `src/repos/ceny.ts`, `src/pages/narzuty/**` (to 14f);
  trasy produktów i katalogu (to 14h).

## Definition of done

- [ ] Pozycja stagingu ze statusem `scientific_notation_uncertain` po akceptacji daje wiersz
      w `products` z `ean IS NULL`.
- [ ] `eanRaw`, `eanIsValid`, `eanSourceStatus`, `eanCandidates` w `products` **zachowane**.
- [ ] `staging_items.ostrzezenie`/`powod` oraz `snapshotJson` **niezmienione** — ostrzeżenie
      dalej widoczne.
- [ ] Status `ok` i `no_valid_candidate` zachowują się jak dotąd (kontrola negatywna).
- [ ] `test/charakteryzacja/silnik/*` i `silnik.gate.test.ts` — **nietknięte i zielone**.
- [ ] `akceptacja.charakteryzacja.test.ts` — 31/31 scenariuszy zielonych, bez dodanego wyjątku.
- [ ] `contract/` bez zmian; `kontrakt.spojnosc.test.ts` i `katalog.gate.test.ts` zielone.
- [ ] Bramki BE: lint, typecheck, build, test — wszystkie zielone.
- [ ] Odstępstwo opisane w kodzie (komentarz z decyzją, datą i odsyłaczem do backlogu #11).
- [ ] `docs/rebuild-roadmap.md` (14i) i `docs/rebuild-backlog.md` (#11) opisują STAN.
