# 130-FEATURE-importer-staging-bezpieczenstwo — raport z realizacji

## Podsumowanie

Rdzeń importu w `rebuild/backend/src/import/` został **zastąpiony** portem `importer()`
zwracanego przez `staging_policy.install()` (`88fa31c`). Dowieziono bezpieczeństwo źródła
(#103), auto-wstrzymania z ochroną wstrzymań ręcznych (#104), dopasowanie po EAN z ochroną
DOT/DEMO (#103/#105), nadpisania Staging v2 (#99) i konsumpcję `_bridgeFeedMeta`.

Wierność jest udowodniona **dwoma niezależnymi gate'ami przeciw ŻYWEMU oryginałowi**:
przenagraną charakteryzacją na dziesięciu realnych cennikach i nowym gate'em polityki źródła,
który uruchamia `install()` obok portu i porównuje skutek w bazie.

## Kluczowe ustalenie

W `mirror/backend/index.cjs` @ `88fa31c` silnik `tk` **nie jest już funkcją bundla**:

```js
tk = require("./staging_policy.cjs").install({U, db:Qi, normalize:Hq, classify:Zc,
                                              badName:Kq, ext:__BRIDGE_EXT});
```

Stary `tk()` (`deminified/backend-index.cjs:47584`) jest **martwy** — nadpisany tą linią.
Nasz dotychczasowy port w `tk.ts` odtwarzał więc silnik, którego produkcja nie uruchamia,
a cała warstwa charakteryzacji mierzyła nieaktualny wzorzec. To jest powód, dla którego
ten ticket wymienia rdzeń, a nie go rozszerza.

## Zmiany

### Nowe moduły
- **`src/import/polityka/fabryka.ts`** — `stworzPolitykeStagingu(db, zaleznosci)`, odtworzenie
  domknięcia `install()`: `importer()` plus wspólne helpery (`wstrzymaj`, `wyczyscZgloszenie`,
  `dopasowanieZapamietane`, `kartaPoKodzie`, `nalozPoprawki`, flaga dostępności) wystawione
  jawnie do wołania przez I15.4c **bez zmian w tym pliku**.
- **`src/import/polityka/podstawy.ts`** — prymitywy polityki. Siedem eksportowanych przez
  oryginał jest **przemostowanych** z `legacy/staging_policy.cjs`; siedem modułowo prywatnych
  (`hash`, `separateDotBatch`, `sourceKey`, `codeKey`, `KEYS`, `LABEL`, `OPTIONAL`)
  odtworzonych, bo `legacy/**` należy do I15.2 i stoi pod gate'em sha256.
  `hash()` zweryfikowany przeciw `syntheticCode()` oryginału — wynik znak w znak.
- **`src/import/polityka/bledy.ts`** — cztery klasy blokad źródła + `jestBlokadaZrodla()`.
- **`src/import/polityka/kod-importu.ts`** — nadpisane `assignKodImportu` (#99).
- **`src/import/polityka/edycja-stagingu.ts`** — nadpisane `updateStaging` (#105 + D4).

### Zmienione
- `src/import/tk.ts` — z 640 linii portu starego silnika do ~70 linii warstwy zgodności.
- `src/import/typy.ts`, `src/import/parsuj.ts` — `MetaCennika` i zdejmowanie
  `_bridgeFeedMeta` (własność `enumerable: false`, gubiona przez spread).
- `src/routes/{import,suppliers,staging-mutacje}.ts`, `src/import/synchronizuj.ts` —
  przekazywanie `meta`, mapowanie blokad na 400.
- `src/routes/products.ts` — ręczna zmiana `status` kasuje znacznik automatu (D-130.3).
- `src/import/{bulk,akceptacja}.ts` — jedna linia każdy: nowe `assignKodImportu`.

### Testy
- **Nowy** `test/silnik.polityka-zrodla.test.ts` (17 przypadków) — port vs **żywy** oryginał.
- **Nowy** `test/charakteryzacja/silnik/polityka.mjs` — harness `install()` na prawdziwym SQLite.
- Przenagrane wzorce MO1–MO10 + scenariusze; `scripts/charakteryzacja-silnik-nagraj.mjs`
  przepięty z martwego `tk()` na `install()`.
- Przepięte: `silnik.charakteryzacja`, `silnik.gate`, `silnik.decyzje`, `silnik.rownosc`,
  `akceptacja.charakteryzacja`, `akceptacja.odstepstwa`, `produkty-bulk.charakteryzacja`,
  `import`, `dostawcy.upload`. **Żaden nie został usunięty.**

## Odstępstwa od planu

**Jedno odstępstwo częściowe (Krok 12, podpunkt D4).** Plan zapowiadał przepisanie przypadku
„EAN w notacji naukowej" na *oczekiwaną blokadę akceptacji*. Dowieziono tyle, ile może dowieźć
ścieżka ZAPISU: zgłoszenie ma teraz `typZmiany = 'blad'` z komunikatem walidacji i zachowanym
`eanRaw`, więc nie da się go zatwierdzić bez ręcznej poprawki. **Twarda blokada akceptacji**
(odrzucenie `POST /api/staging/:id/accept`) siedzi w `checkAcceptance()`
(`staging_policy.cjs:188-226`) i należy do karty **I15.4c** — ta część jest przesunięta tam,
nie pominięta. Wychwycone w code review tego ticketa.

Poza tym dwie rzeczy doprecyzowano w trakcie:

1. **Cenniki charakteryzacji nagrywane jako oferta NIEKOMPLETNA.** Wzorce 3a to próbki
   (~200 wierszy) przy katalogu kilku tysięcy kart. Zadeklarowanie ich jako kompletnej oferty
   kazałoby produkcji wstrzymać ~4800 kart na dostawcę (#104) i wzorzec przestałby mierzyć
   dopasowanie. Zachowania zależne od kompletności pokrywa nowy gate polityki źródła.
2. **Ścieżka dowodowa wycofań chodzi tylko w przebiegu weryfikacyjnym.** Zmierzone na
   oryginale: w zwykłym imporcie `importer()` wychodzi z pętli nieobecnych wcześniej
   (`staging_policy.cjs:597`), bo produkt jest już wstrzymany. Dowody i wiersz `wycofana`
   powstają wyłącznie przy `reconcileOnly` + `verifyAbsence`.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne. Import nie zmienia KSZTAŁTU odpowiedzi
  czytających — `GET /api/staging`, `GET /api/staging/paged`, `GET /api/products`,
  `GET /api/analytics/prices/{product-history,last-import}` przechodzą bez zmian w swoich
  gate'ach. **Jedna zmiana kształtu na trasach NIEZAMROŻONYCH:** `POST /api/import/parse-file`
  i `POST /api/dostawcy/:kod/upload` oddają dodatkowy klucz `pominieteWycofania` — tak samo
  jak produkcja na `88fa31c` (`...tkResult`). Kształt tych tras jest w `contract/openapi.yaml`
  oznaczony „do zamrożenia w 2.4", więc rozszerzenie jest dopuszczalne.
- **Charakteryzacja na realnych cennikach:** ✓ 49/49 — port zgadza się z `install()` @ `88fa31c`
  na MO1–MO10 i na 21 scenariuszach celowanych, pole po polu.
- **Gate polityki źródła (port vs żywy oryginał):** ✓ 17/17.
- **Pełna bramka:** `lint` ✓, `typecheck` ✓, `build` ✓, `test` ✓ — 108 plików, 1774 przechodzi,
  7 pominiętych (baseline `origin/develop`: 107 plików, 1754 przechodzi). Przybyło 20 testów.
- **Wydajność:** przypadki cennikowe MO1–MO10 dostały limit 90 s (globalny to 20 s). Nowy silnik
  wykonuje na pozycję znacznie więcej pracy niż stary `tk()` — sprawdza automatyczne wstrzymanie,
  zapamiętane dopasowanie i ręczny wybór operatora, a w pętli nieobecnych porównuje KAŻDĄ kartę
  katalogu z KAŻDYM rekordem cennika przez `compatibility()`. Dla MO2 (1729 kart) i MO5 (1989)
  to setki tysięcy porównań. Koszt jest oryginału — nie skracaliśmy go, bo zmieniłoby to
  zachowanie. Powiązany wpis: #107 (zatwierdzanie zbiorcze blokowało panel).
- **Znany flake, NIE z tego ticketa:** `test/alerty-katalogu.gate.test.ts` („paczka równa limitowi
  20 000 id") bywa czerwony na limicie 20 s przy pełnym przebiegu na obciążonej maszynie; osobno
  przechodzi (sprawdzone dwukrotnie), przechodzi też na czystym `origin/develop`. Zgłoszone już
  przez I15.4a („Do koordynatora", pkt 6) jako materiał na osobny ticket.

## Breaking changes

1. **`POST /api/import/parse-file` i `POST /api/dostawcy/:kod/upload` zwracają nowy klucz**
   `pominieteWycofania`. Trasy niezamrożone w kontrakcie; zgodne z produkcją.
2. **Import nie kasuje już kart z katalogu.** Stary `tk()` usuwał produkt, gdy cennik przyniósł
   pod jego kodem pozycję niebędącą oponą. `staging_policy` nie ma żadnego `deleteProduct`.
3. **Brak w kompletnej ofercie wstrzymuje produkt NATYCHMIAST** (status `wstrzymany`, stan 0),
   zamiast podbijać licznik przez trzy przebiegi.
4. **Konflikt pliku z poprawką Marty nie jest już nigdzie zgłaszany** i nie blokuje
   auto-zatwierdzenia — `protect()` nakłada poprawkę cicho. Do decyzji Ani.
5. **Różnica case-only w polu kluczowym przestała być zmianą** — nie tworzy zgłoszenia.

## Scalenie z kartą I15.4c (ticket 129) — zmiana premisy planu

Ticket **129** (karta I15.4c, akceptacja) wszedł do `develop` **w trakcie** tej pracy i dowiózł
wspólną warstwę, którą plan (decyzja **D-130.2**) przypisywał tej karcie. Premisa się odwróciła:
zamiast eksportować helpery DLA I15.4c, ta karta z nich KORZYSTA. Decyzja użytkownika 2026-09-23:
**adaptujemy się do 129 i kasujemy duplikaty.**

Co z tego wynikło:

| Usunięte z tej karty | Używane zamiast tego (ticket 129) |
|---|---|
| `podstawy.ts` — most do 7 prymitywów + `hash`, `KEYS` | `polityka/helpery.ts` |
| `fabryka.ts`: własne `wstrzymaj`, `nalozPoprawki`, `kartaPoKodzie`, `wyczyscZgloszenie` | `polityka/kontekst.ts`: `wstrzymajAutomatycznie`, `chron`, `produktPoKodzie`, `usunZgloszeniaPary` |
| `polityka/kod-importu.ts` (mój `assignKodImportu`) | `polityka/kod-importu.ts` (ich `nadajKodImportu`) |
| `polityka/edycja-stagingu.ts` | `polityka/zgloszenia.ts` → `zaktualizujZgloszenie` |

`podstawy.ts` został ODCHUDZONY do tego, czego akceptacja nie wołała, a oryginał nie eksportuje:
`LABEL`, `OPTIONAL`, `separateDotBatch`, `sourceKey`, `codeKey`. W repo jest teraz **jedna**
definicja `norm()`, `hash()`, `suspend()` i `protect()`.

**Cofnięta globalna podmiana `assignKodImportu`.** `wejscie-129.md` prosi wprost, żeby jej nie
robić: harness `test/charakteryzacja/akceptacja/oryginal.mjs` tnie oryginał BEZ `install()`,
więc musi dalej widzieć stare grupowanie, a politykową wersję wstrzykuje warstwa akceptacji
(`zatwierdzPozycjeStagingu(..., nadajKod)`). Mój `importer()` **w ogóle nie woła**
`assignKodImportu`, więc zmiana w `bulk.ts` i `akceptacja.ts` była po mojej stronie zbędna —
oba pliki wróciły do wersji z `develop`.

**Dwie połówki mostu pasują:** `checkAcceptance` z I15.4c odrzuca pozycje bez `_policyVersion`
(`staging_policy.cjs:194`), a ustawia je wyłącznie `importer()` — czyli ten ticket. Do czasu
jego merge'a akceptacja odrzuca wszystko, co produkuje staging. Port ustawia `_policyVersion: 2`
i `_catalogVersion` w każdej gałęzi zapisu, więc okno zamyka się razem z tym PR-em.

Po scaleniu bramki przebiegnięte od nowa — wynik niżej.

## Code review

Przeprowadzone po implementacji: **0 BLOCKER, 1 SHOULD-FIX, 2 NICE-TO-HAVE**
(`review.md`). SHOULD-FIX — niedokończony podpunkt D4 Kroku 12 — **naprawiony**: test
`silnik.gate.test.ts` sprawdza teraz blokadę na poziomie silnika, a raport wprost nazywa
przesunięcie twardej blokady akceptacji do I15.4c.

Reviewer potwierdził wierność portu linia po linii przeciw `staging_policy.cjs:332-616`:
kolejność łańcucha dopasowania, progi bezpieczeństwa źródła, „pewny powrót", zapis
`historia_cen`, dowody ze `slice(-3)` i pętla po nieobecnych zgadzają się co do warunków,
kolejności efektów ubocznych i literałów komunikatów.

## Follow-up

- **`mirror/backend/index.cjs` na `develop` jest NIEAKTUALNY** — stoi na `86d9090`, podczas gdy
  `staging_policy.cjs` i `bridge_ext.cjs` są już na `88fa31c` (resync I15.2 objął tylko wybrane
  pliki). Blok helperów, który wycina charakteryzacja, jest między tymi commitami identyczny
  (zweryfikowane bajtowo), więc nie blokuje tego ticketa — ale plik należy dosynchronizować.
- **Ciche nakładanie poprawek Marty (#103) do rozstrzygnięcia przez Anię** — czy brak
  jakiegokolwiek sygnału o sprzecznym pliku jest pożądany.
- **Wpięcie modułu dostępności I15.10 — ZROBIONE.** Ticket 119 zmergował się w trakcie tej pracy,
  więc `silnikStagingu()` podaje już `zadajOdswiezenie` z `src/selly/dostepnosc.ts` jako domyślne
  `odswiezDostepnosc`. Bez zamontowanej instancji funkcja nie robi nic (`dostepnosc.ts:127-130`) —
  wiernie wobec bramki oryginału na produkcyjną bazę. **Zostaje MONTAŻ instancji**
  (`ustawDomyslnaSynchronizacjeDostepnosci`) — to zakres I15.8, nie tej karty.
- **Wydajność `assignKodImportu`** — czyta całą tabelę `products` przy każdym wywołaniu.
  Wiernie wobec oryginału (`U.listProducts()` w `staging_policy.cjs:145`), ale przy akceptacji
  zbiorczej to koszt liniowy na pozycję. Materiał do istniejącego wpisu **#107**.
- **Helpery dostępności `dostepnoscZmieniona()` / `oznaczZmianeDostepnosci()`** są dziś bez
  wołających — to celowe API międzykartowe dla I15.4c (D-130.2). Warto o nich przypomnieć
  w karcie I15.4c, żeby nie zostały uznane za martwy kod.
- **#108 (kolizje `kod_importu`) pozostaje otwarty** — gałąź „zachowaj istniejący sześciocyfrowy
  numer" przeniesiona dosłownie, zgodnie z `wejscie-116.md`.
