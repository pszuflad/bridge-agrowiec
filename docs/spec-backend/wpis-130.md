# Wpis do spec-backend od ticketu 130 (karta I15.4b) · 2026-09-23

**Sekcja:** §5 (silnik importu `tk()` — na `88fa31c` już nie funkcja bundla, tylko wynik
`staging_policy.install()`).

**Potwierdzone w 130** (`130-FEATURE-importer-staging-bezpieczenstwo`, 2026-09-23, karta
I15.4b), przeciw `origin/main` @ `88fa31c` (produkcja zamrożona 23.09). Odsyłacze do linii
poniżej wskazują `rebuild/backend/src/import/legacy/staging_policy.cjs` — kopię bajt w bajt
oryginału (gate sha256, karta I15.4a/I15.2).

## A. Silnik `tk` to od `88fa31c` wynik `install()`, nie funkcja bundla

W `mirror/backend/index.cjs` ostatnim przypisaniem do `tk` jest:

```js
tk = require("./staging_policy.cjs").install({U, db:Qi, normalize:Hq, classify:Zc, badName:Kq, ext:__BRIDGE_EXT});
```

`function tk` z bundla (żywa deklaracja `deminified/backend-index.cjs:47584`, wcześniej
opisana w tej sekcji jako aktualny silnik) jest przez to **martwa** — dokładnie jak wcześniejsza
`function tk` (`:47378`), tylko że tym razem cieniowanie nie przychodzi z kolejnej deklaracji w
tym samym bundlu, tylko z osobnego modułu doklejonego później. Trzeci udokumentowany przypadek
tego mechanizmu w tym bundlu (por. `CLAUDE.md`: `tk`, `Lq`). Poprawka zdania w §5:
`docs/spec-backend.md`.

## B. Ścieżka dowodowa wycofań chodzi tylko w przebiegu weryfikacyjnym

W zwykłym imporcie pętla po produktach nieobecnych w ofercie wychodzi wcześniej —
`if(complete && !options.reconcileOnly) continue;` (`:596`) — bo produkt został już
WSTRZYMANY wcześniej w tym samym przebiegu. Dowody w `product_absence_checks` i zgłoszenie
typu `wycofana` powstają wyłącznie przy `options.reconcileOnly && options.verifyAbsence`.
Konsekwencja: w normalnym imporcie typ zmiany `wycofana` nie występuje w ogóle. Zmierzone na
żywym oryginale (`tools/record-write-fixtures.cjs`).

## C. Zapora 24 h jest per DOSTAWCA, nie per produkt

`supplier_feed_state.last_counted_at` (`:87`, `:465`) blokuje liczenie kolejnego dowodu
nieobecności przez dobę dla CAŁEGO dostawcy naraz — trzy dowody wymagają trzech różnych
kompletnych ofert w trzech różnych dobach, nie trzech niezależnych liczników per produkt.
Zmierzone: bez przesunięcia zegara systemowego między ofertami licznik dowodów zatrzymuje się
na 1, niezależnie od liczby przebiegów.

## D. `compatibility()` liczy pole opcjonalne puste po jednej stronie jako niezgodność

`compatibility(a,b)` (`:47-61`) wymaga zgodności `marka`/`model`/`rozmiar` ORAZ pól z `OPTIONAL`
(`indeksNosnosci`, `indeksPredkosci`, `pr`, `tlTt`, `vfIf`, `konstrukcja`, `dot`) i wariantu DEMO
(`variant()`). Puste pole po JEDNEJ stronie trafia do `missing`, czyli liczy się jako
niezgodność tak samo jak `different` — `ok = !missing.length && !different.length` (`:60`).
Skutki zmierzone w tym tickecie:
- karta katalogowa bez `model` nie odziedziczy numeru grupy `kodImportu` przez
  `assignKodImportu` (`:141-157`), bo żaden istniejący produkt nie da `compatibility().ok`;
- parser wyprowadza `konstrukcja` z zapisu rozmiaru (np. `"340/85R28"` → `"R"`), więc karta bez
  `konstrukcja` nie przejdzie „pewnego powrotu" i zamiast tego dostanie `matchIssue`.

## E. Parser MO1 (Bohnenkamp) stempluje KAŻDY rekord tą samą wartością `dot`

`dot: emptyToNull(record.dot) || 'nie starsza niz 3 lata'` (`legacy/parsers/tyre_params.cjs`,
kilkanaście wystąpień, m.in. `:598`, `:1164`) — to stała gwarancja z nagłówka cennika, nie numer
partii. Ochrona DOT w dopasowaniu po kodzie (`norm(d.dot)!==norm(current.dot)` zrywa dopasowanie,
`staging_policy.cjs:374`) sprawia, że karta katalogowa bez tej wartości `dot` nie dopasuje się do
ŻADNEGO rekordu MO1 — w produkcji nieobserwowalne, bo karty katalogowe zakłada ten sam importer,
który tę wartość zawsze wpisuje.

## F. `_bridgeFeedMeta` jest `enumerable: false` na tablicy rekordów

`feed_safety.cjs:26` dokłada metadane przez `Object.defineProperty(items,'_bridgeFeedMeta',
{value:{...meta,excludedCodes:excluded},configurable:true})` — bez `enumerable:true`, więc
własność nie przenosi się przez spread, `Object.keys`, `JSON.stringify` ani `structuredClone`.
Trzeba sięgnąć po nią wprost (`records._bridgeFeedMeta`). Brak metadanych na wejściu do silnika
= oferta traktowana jako NIEKOMPLETNA (bezpieczny domyślny stan: nie wstrzymuje i nie zlicza
braków źle rozpoznanej oferty).

## G. Liczniki, których `staging_policy` deklaruje, ale nie podbija

`odrzuconeBrakDanych` jest zadeklarowany w obiekcie statystyk (`:346`), ale w całym module nie
ma ani jednego `stats.odrzuconeBrakDanych++` — pozycja bez wystarczających danych idzie do
stagingu jako zgłoszenie z `typZmiany:'blad'`, nie jest liczona osobno. `odrzuconeSmieciMO2`
(`:349`) podbija się wyłącznie dla dostawcy MO2 (heurystyka na koclu `999991` bez EAN/marki).

## H. Nowy klucz w odpowiedzi HTTP tras niezamrożonych

`POST /api/import/parse-file` i `POST /api/dostawcy/:kod/upload` oddają dodatkowo
`pominieteWycofania` (`:528-529`) — tekstowe wyjaśnienie, dlaczego w tym przebiegu nie liczono
braków (oferta niekompletna / powtórzona / przed upływem 24 h). Trasy rozsypują statystyki do
ciała odpowiedzi przez `...tkResult`, tak samo jak produkcja. Kształt tych tras NIE jest
zamrożony w `contract/openapi.yaml` (oznaczony „do zamrożenia w 2.4").

## I. Import nie kasuje już kart z katalogu

`staging_policy` nie eksportuje żadnego `deleteProduct`. Dodatkowo znany kod chroni wiersz przed
odrzuceniem jako „nie opona": `if(!classification.isTire && !knownCode)` (`:353`) — jeśli kod
z cennika jest już znany w katalogu, klasyfikator „nie opona" nie odrzuca pozycji.

## J. Poprawki Marty (`manual_overrides`) nakładane cicho

`protect(supplier,r,code)` (`:158-162`) podmienia pole wartością z `getOverridesFor()` bez
raportowania konfliktu i bez blokowania auto-zatwierdzenia — inaczej niż poprzedni silnik,
gdzie `Gq()` przy konflikcie zapisywał ślad w `snapshotJson`. Zachowanie produkcji na `88fa31c`;
do decyzji Ani, czy brak sygnału o sprzecznym pliku jest pożądany.

## K. Różnica case-only przestała być zmianą (Unicode-aware, nie SQLite `UPPER()`)

Lista `changes` w zgłoszeniu do stagingu liczona jest przez
`KEYS.filter(k=>norm(current[k])!==norm(d[k]))` (`:427`), a `norm()` (`:4`) to
`.normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase()` — JS-owe `toUpperCase()`, więc
Unicode-aware (poprawnie obsługuje polskie znaki). **Nie mylić** z SQLite `UPPER()` z migracji
`006`, które jest ASCII-only (`CLAUDE.md`) i zostawia resztkowe duplikaty case-only dla polskich
liter — to dwa różne mechanizmy porównania wielkości liter w tym samym systemie.

Szczegóły: `docs/tickets/130-FEATURE-importer-staging-bezpieczenstwo/`.
