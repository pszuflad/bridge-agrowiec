# 4-FEATURE-port-parserow-charakteryzacja — Iteracja 3a: port + charakteryzacja parserów

> Status: Implemented
> Branch: `feature/4-port-parserow-charakteryzacja`
> Worktree: `.worktrees/4-FEATURE-port-parserow-charakteryzacja`

## Opis ticketa

> Iteracja 3a — Port + charakteryzacja parserów (wierna odbudowa Bridge)
>
> Realizuj Iterację 3, sesję 3a (BACKEND) wg `docs/rebuild-roadmap.md` (§5 „Iteracja 3" — blok 3a
> + strategia PORT + wejście z triażu; §3 zasady). To pierwsza i NAJWAŻNIEJSZA część silnika importu.
>
> CEL: wciągnąć podsystem parserów z produkcji do `rebuild/backend` jako moduły JS i UDOWODNIĆ testem
> charakteryzacyjnym, że dają IDENTYCZNE wyjście co oryginał na realnych plikach dostawców. Nic więcej —
> BEZ zapisu do bazy, BEZ `tk()`, BEZ endpointów (to 3b/3c/3d).
>
> STRATEGIA — PORT, nie rewrite: portuj podsystem 1:1 jako moduły JS; przepisz tylko BRZEG WEJŚCIA:
> funkcja (plik/bufor + dostawca) → rekord(y), z `adapter.recordToSurowe()` na końcu potoku. Backend
> jest TS/ESM — konsumuje moduły `.cjs` bez problemu. Zachowaj polskie nazwy pól. Decyzje #1 sniegfix /
> #2 kategoriafix / #3 szerokość wchodzą AUTOMATYCZNIE przez port najświeższego źródła.
>
> ⭐ CHARAKTERYZACJA (główny gate): próbki realnych plików dostawców (po 1 na MO1–MO10) → oczekiwane
> wyjście złapane z ORYGINALNEGO parsera (punkt przechwycenia = rekord PO `recordToSurowe()`) →
> portowany parser na tych samych próbkach → porównanie 1:1 co do pola.
>
> DoD: podsystem zportowany; funkcja (plik+dostawca) → rekord działa; charakteryzacja MO1–MO10 zielona;
> raport opisuje skąd próbki i jak odtworzyć oczekiwane wyjście.

## Kontekst

### Anatomia podsystemu (ustalone przez research + weryfikację własną)

Graf zależności jest **czysty i domknięty** — podsystem nadaje się do portu bez cięcia:

```
common.cjs (628 l)  ──► fs, path, dictionaries/oznaczenia.json
      ▲
      ├── tyre_params.cjs (1726 l)   ──► common
      │        ▲
      ├────────┴── adapter.cjs (662 l)  ──► crypto (sha1), tyre_params, common
      │
      └── mo1…mo10 (~1440 l łącznie)  ──► csv-parse/sync, iconv-lite, fs, xlsx, common, tyre_params
                ▲
           dispatcher.cjs (63 l)
```

Właściwości potwierdzone bezpośrednio w kodzie:
- **Zero dostępu do bazy danych** — żaden plik podsystemu nie `require`uje `better-sqlite3` ani `index.cjs`.
- **Zero efektów ubocznych przy `require`** — `common.cjs` ładuje słownik leniwie (`loadDictionary()`), nie na starcie.
- **Determinizm** — brak `Date.now()`, `new Date()`, `Math.random()`. Jedyny `crypto` (`adapter.cjs:112`)
  to `sha1` z treści (`${dostawcaKod}|${basis}`) przy generowaniu kodu syntetycznego — deterministyczny.
- **Pułapka ścieżek:** `parsers/dictionaries/` jest **pustym, martwym katalogiem**. Prawdziwy słownik to
  `mirror/backend/dictionaries/oznaczenia.json`, bo `common.cjs:18` liczy `path.join(__dirname, 'dictionaries', 'oznaczenia.json')`,
  a `__dirname` to `mirror/backend`, nie `parsers/`. Port musi odtworzyć **dwa poziomy** katalogów.

### Potok produkcji (co odtwarzamy)

```
dispatcher.parseByKod(kod, sciezkaPliku)
    → moX.parseFile(sciezkaPliku)                     # fs.readFileSync → iconv.decode → csv-parse | XLSX
    → { records, errors, dostawca, odrzucone? }        # record.surowe_pola = surowy wiersz
    → adapter.recordsToSurowe(kod, records)            # ⇦ PUNKT PRZECHWYCENIA CHARAKTERYZACJI
    → tk()                                             # ⇦ POZA ZAKRESEM (3c)
```

`adapter.recordToSurowe()` jest centralnym miejscem normalizacji końcowej — dobiera normalizator
per dostawca (`adapter.cjs:404-490`), a potem stosuje wspólny blok (kategoria przez `capitalizeKategoria`,
flagi etykiety UE, `hs`, `uwagaCena`). Wyjście to płaski obiekt ~50 pól z polskimi nazwami
(`kategoria`, `szerokosc`, `zastosowanie`, `bieznik`, `dostawca`, `cenaZakupu`, …).

### Trzy rozjazdy wykryte przed planem

1. **Archiwum ma 6 z 10 dostawców.** `mirror/backend/import_archive/` (1874 pliki, usunięte commitem
   `72957d7`, dostępne w historii) zawiera wyłącznie MO1 (1 plik), MO2 (202), MO3 (166), MO4 (184),
   MO5 (183), MO9 (201) — wszystkie z okna 2026-08-21…25. **Zero MO6, MO7, MO8, MO10.**
2. **MO9 nie ma ścieżki plikowej.** `mo9_agrorami.cjs` **jawnie ignoruje** `filePath` (komentarz w pliku)
   i odpala `execFileSync` na `_agrorami_fetch_helper.cjs` → GraphQL `hurtownia.agrorami.pl`
   (wymaga `AGRORAMI_EMAIL`/`AGRORAMI_PASSWORD`). Archiwalne CSV-e MO9 to martwy artefakt auto-pulla.
3. **`bridge_ext.cjs`/`tire_dims.js` nie leżą na ścieżce parser→adapter.** Roadmap §5 (linia 311) wymienia
   je w porcie 3a, ale w oryginale żaden plik z `parsers/` ich nie `require`uje — `applyDims`,
   `applyLinkMemory`, `assignKodImportu` są wołane wyłącznie wewnątrz `tk()` w `index.cjs`.
   **Funkcjonalnie należą do 3c.** Rozjazd roadmap↔kod, do poprawienia w opisie roadmapy.

### Dwa znaleziska, które wzmacniają gate

- **Niezależny oracle produkcji:** każdy plik w archiwum ma `<nazwa>.meta.json` z wynikiem **realnego
  przebiegu importu na produkcji** — `rekordy`, `parserErrors`, `odrzucone`, `sha256`. To liczby, których
  nie wygenerowaliśmy my; nadają się na krzyżową weryfikację portu na PEŁNYCH plikach.
- **Gotowy materiał Ani:** `mirror/backend/parsers/test_tyres.cjs` (1207 l) to jej własny plik
  charakteryzacyjny pokrywający **wszystkie MO1–MO10** realnymi danymi z plików dostawców
  (z numerami linii z oryginalnych plików), plus przypadki `recordToSuroweDostawca`.

### Rozstrzygnięcie backlogu #5 `frazy`

**To NIE jest normalizacja w adapterze — poza zakresem 3a i poza potokiem parserów.** Dowód:
`mirror/backend/frazy_migruj.cjs` to samodzielny skrypt jednorazowy, który czyta statyczny
`/tmp/frazy_migracja.json` i woła `selly/client.cjs` (PUT do zewnętrznego Selly). W `common.cjs`
słowo „frazy" nie występuje ani razu (grep: 0 trafień). Wpis backlogu zostanie zaktualizowany.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Brak (ticket nie dotyka kontraktu API).** Uzasadnienie: 3a nie dodaje ani nie zmienia żadnej ścieżki
w `contract/openapi.yaml` — nie ma endpointu, nie ma zapisu do bazy, nie ma odpowiedzi HTTP do porównania.
Endpointy importu (`POST /api/import/from-url`, `/parse-file`, `/ai-fallback/parse`) i staging
(`GET /api/staging*`) należą do sesji 3b i tam obowiązuje pełny GATE fixtures/kontrakt.

**GATE tej sesji to CHARAKTERYZACJA** (patrz „Strategia testów"), zgodnie z roadmapą §5 blok 3a.

Referencja pomocnicza (nie gate): `contract/fixtures/GET_staging.json` zawiera w polu `snapshotJson`
zserializowany wynik `recordToSurowe()` z produkcji — pokazuje realny kształt rekordu. **Odnotowany
rozjazd czasowy:** ten fixture został nagrany PRZED 2026-08-24/25, więc nie ma w nim kluczy `hs`
i `uwagaCena` dodanych później. To luka pokrycia, nie sprzeczność — port podąża za **oryginałem**
(najświeższym stanem), a przenagranie fixtures należy do I12.

## Decyzje

Wszystkie z Q&A z użytkownikiem (2026-08-26).

**D1 — Port verbatim `.cjs` w lustrzanym układzie katalogów.** Kopia bajt-w-bajt do
`rebuild/backend/src/import/legacy/`, z zachowaniem DWÓCH poziomów oryginału (`legacy/common.cjs`
+ `legacy/dictionaries/` + `legacy/parsers/*.cjs`). Dzięki temu `require('../common.cjs')` oraz
`path.join(__dirname, 'dictionaries', …)` działają **bez tknięcia jednej linii**.
*Za:* re-synchronizacja z Anią to czysty `git diff`/`patch`; zero ryzyka regresji z przepisywania;
zgodne z decyzją zapisaną w roadmap §5 („TS-yfikacja później, opcjonalnie").
*Koszt:* ~4200 linii bez typów i lintu (jawny wpis w `eslint.config.js` → `ignores`); potrzebny krok
kopiujący `.cjs` + `.json` do `dist/` (analogia `scripts/copy-schema.mjs`).
*Odrzucone:* układ spłaszczony (wymaga edycji `require` w 12 plikach → koniec portu 1:1),
konwersja na TS (~4200 okazji do regresji, diff przestaje się mapować na patche Ani).

**D2 — Próbki MO6/MO7/MO8/MO10 odtwarzane z `test_tyres.cjs`.** Ci czterej dostawcy nie mają żadnego
pliku w historii repo. Składamy pełnoprawne pliki-próbki z realnych danych zaszytych przez Anię
w `test_tyres.cjs`, używając nagłówków kolumn odczytanych z kodu parsera i mapowania z `adapter.cjs:404-490`.
Charakteryzacja idzie przez **pełne `parseFile()`**, tak samo jak dla MO1–MO5.
*Walidacja odtworzenia:* próbka jest uznana za wierną dopiero, gdy przepuszczona przez ORYGINALNY
`parseFile()` + `recordToSurowe()` odtwarza wartości, których `test_tyres.cjs` oczekuje dla tych linii.
To zamyka pętlę — nie zgadujemy kształtu pliku, tylko dowodzimy go testem Ani.
*Odrzucone:* pobieranie z żywych URL dostawców (ruch sieciowy do cudzej produkcji, pliki dzisiejsze
a nie z okresu powstania kodu), gate tylko na `normalizeXxx()` (pomija warstwę czytania pliku —
kodowanie, nagłówki, XLSX — czyli to, co najłatwiej zepsuć przy porcie).

**D3 — Próbki przycięte do ~200 rekordów + osobny audyt pełnych plików.** Do repo trafia nagłówek
+ pierwsze ~200 wierszy danych na dostawcę (kilkanaście KB) i **pełne** oczekiwane wyjście dla tego
wycinka — fixtures pozostają czytelne w review i re-nagrywalne. Dodatkowo jednorazowy audyt (opisany
w raporcie, nie commitowany): port vs oryginał na PEŁNYCH plikach z archiwum, z krzyżową weryfikacją
liczby rekordów wobec `.meta.json` z realnego przebiegu produkcji.
*Zgoda na commit wycinka cenników:* udzielona — te pliki i tak były w historii repo do commita `72957d7`.
*Odrzucone:* pełne pliki + pełne fixtures (~2 MB próbek + 20-40 MB JSON, wraca bloat usunięty w `72957d7`),
fixtures skrócone do sha256 (czerwony test mówi „hash się nie zgadza" zamiast wskazać pole).

**D4 — `bridge_ext.cjs`/`tire_dims.js` zostają do 3c.** Idziemy za faktycznym grafem wywołań, nie za
opisem roadmapy. Zakres 3a pozostaje czysty („BEZ `tk()`", zgodnie z ticketem), zero martwego kodu
w review. Rozjazd roadmap↔kod odnotowany w raporcie i poprawiony w opisie roadmapy przy syncu docs.

**D5 — MO9 charakteryzowany na czystej części potoku.** Moduł `mo9_agrorami_api.cjs` portujemy
verbatim w całości; charakteryzujemy **czystą pętlę** z `fetchAll()` (odrzucenie quadów + `itemToRecord()`)
→ `recordToSurowe()`. Wejście: obiekty `item` zbudowane wg zapytania GraphQL zaszytego w kodzie
(`sku`, `ean`, `manufacturer`, `stock_availability.in_stock_real`, `price_range`, `categories`),
wypełnione **realnymi** danymi (nazwy, EAN-y, ceny, stany) wyciągniętymi z archiwalnego
`MO9__20260821__08472__agrorami.csv`. Niecharakteryzowany zostaje wyłącznie transport HTTP + paginacja
+ odnawianie tokenu — czyli brzeg, nie logika parsera; jawnie odnotowane jako luka pokrycia.
*Odrzucone:* pominięcie MO9 (łamie DoD), uderzenie w żywe API (sekrety, niedeterminizm stanów → nie da
się z tego zrobić powtarzalnego gate'u w CI).

**D6 — Brzeg wejścia: `parsujPlik` + `parsujBufor`.** Wariant buforowy zapisuje do pliku tymczasowego
i idzie tą samą ścieżką — dokładnie jak produkcja (`L4()` ściąga URL do pliku, potem parsuje).
3b dostaje gotowe wejście dla `POST /api/import/parse-file` bez dorabiania warstwy.

**D7 — Świadome odstępstwa od zachowania oryginału: BRAK.** To port 1:1. Poniższe wpisy backlogu
wchodzą **automatycznie przez port najświeższego źródła**, a nie jako nasza zmiana zachowania:

| Wpis | Co wnosi port | Warstwa poza 3a |
|---|---|---|
| **#1 sniegfix** | `normalizeLabelSnowValue()` (adapter) + `normalizeLabelFlag()` (tyre_params) → `'Tak'` albo `null`, nigdy 0/1 | — (całość w parserach) |
| **#2 kategoriafix** | `capitalizeKategoria()` w `recordToSurowe()` na końcu potoku | — (całość w parserach) |
| **#3 szerokość (`szertxt`)** | `parseSize()` zwraca `szerokosc` jako **string** z zerami końcowymi | schemat `REAL→TEXT` → 3b/I12 |
| **#4 `uwaga_cena`** | pole `uwagaCena` propagowane przez `mo7_nokian.cjs` i `adapter.cjs` | kolumna + `GET /api/products/uwagi-cena` → 3b/I12 |
| **#6 poprawki parserów** | flagsfix, mo8, batch — całość, za darmo | — |

W 3a nie ma bazy, więc #3 i #4 dotykają wyłącznie kształtu rekordu w pamięci. Statusy w
`docs/rebuild-backlog.md` zostaną zaktualizowane: #1/#2 → ✅ TAK; przy #3/#4 dopisek, że warstwa
parsera jest załatwiona portem, a warstwa bazy/API czeka na swoją sesję.

**D8 — `frazy` (#5) poza zakresem.** Zbadane (patrz Kontekst) — samodzielny skrypt migracyjny do Selly,
nie normalizacja w adapterze. Wpis backlogu zaktualizowany o rozstrzygnięcie.

## Plan implementacji

### Krok 1 — Zależności i konfiguracja budowania
- `rebuild/backend/package.json`: dodać `csv-parse@^5.5.6`, `iconv-lite@^0.6.3`, `xlsx@^0.18.5`
  (wersje 1:1 z `mirror/backend/package.json`, żeby zachowanie parserów było identyczne).
- `eslint.config.js`: dopisać `src/import/legacy/**` do `ignores` (port verbatim, nie nasz styl) —
  analogicznie do istniejącego wpisu `src/db/schema.ts`.
- `tsconfig.build.json` / `scripts/`: nowy `scripts/copy-parsery.mjs` kopiujący `src/import/legacy/**`
  (`.cjs` + `dictionaries/*.json`) do `dist/import/legacy/`, wpięty w `npm run build` obok `copy-schema.mjs`.
  Powód: `tsc` nie przenosi plików nie-TS, a deploy kopiuje tylko `dist/`.
- Commit: `4-FEATURE-…: zależności parserów + wykluczenie portu z lintu + kopiowanie do dist`

### Krok 2 — Port verbatim
Kopia **bajt-w-bajt** z `mirror/backend/` do `rebuild/backend/src/import/legacy/`:

```
src/import/legacy/
├── common.cjs                        ← mirror/backend/common.cjs
├── dictionaries/oznaczenia.json      ← mirror/backend/dictionaries/oznaczenia.json
└── parsers/
    ├── adapter.cjs  tyre_params.cjs  dispatcher.cjs
    ├── mo1_bohnenkamp.cjs  mo2_jmk.cjs  mo3_grasdorf.cjs  mo4_mo5_handlopex.cjs
    ├── mo6_agrowiec.cjs  mo7_nokian.cjs  mo8_trelleborg.cjs  mo10_gri.cjs
    └── mo9_agrorami.cjs  mo9_agrorami_api.cjs  _agrorami_fetch_helper.cjs
```

Pomijamy: wszystkie `*.bak_*`, `_mo9_agrorami_api_TEST.cjs`, `check_raw_name.cjs`, `test_tyres.cjs`
(to plik testowy Ani — jego treść wykorzystujemy jako źródło danych do próbek, ale go nie portujemy),
pusty `parsers/dictionaries/`.
- Commit: `4-FEATURE-…: port verbatim podsystemu parserów (mirror/backend → src/import/legacy)`

### Krok 3 — Brzeg wejścia (nasz kod, TS/ESM)
- `src/import/typy.ts` — `KodDostawcy` (`'MO1'|…|'MO10'`), `RekordSurowy` (kształt po
  `recordToSurowe()`, **polskie nazwy pól**), `WynikParsowania`.
- `src/import/parsuj.ts`:
  - `createRequire(import.meta.url)` → wczytanie `legacy/parsers/dispatcher.cjs` i `legacy/parsers/adapter.cjs`.
  - `parsujPlik(kodDostawcy, sciezkaPliku): WynikParsowania` — `dispatcher.parseByKod()` →
    `adapter.recordsToSurowe(kod, records)`; zwraca `{ dostawca, rekordy, bledy, odrzucone }`.
  - `parsujBufor(kodDostawcy, bufor, nazwaPliku?)` — plik tymczasowy (`fs.mkdtempSync` w `os.tmpdir()`),
    delegacja do `parsujPlik`, sprzątanie w `finally`.
  - Walidacja `kodDostawcy` przez listę z `dispatcher.listDostawcy()`.
- Commit: `4-FEATURE-…: brzeg wejścia parsujPlik/parsujBufor (plik+dostawca → rekordy)`

### Krok 4 — Próbki dostawców
Katalog `test/charakteryzacja/probki/`.

**MO1–MO5 (realne, z historii gita).** Wyciągnięcie: `git show 72957d7^:<ścieżka> > <cel>`, potem
przycięcie do nagłówka + ~200 wierszy danych. Kandydaci (najmniejsze reprezentatywne):
| Dostawca | Plik źródłowy w `import_archive/2026-08/` | Rozmiar |
|---|---|---|
| MO1 | `MO1__20260821__08471__bohnenkamp.csv` | 95 KB (jedyny) |
| MO2 | `MO2__20260824__13195__rdzen.csv` | 291 KB |
| MO3 | `MO3__20260821__08480__test-csv-3_t1004_pl.csv` | 702 KB |
| MO4 | `MO4__20260824__05585__agrowiec_wr.csv` | 489 KB |
| MO5 | `MO5__20260825__13431__agrowiec_mw.csv` | 742 KB |

⚠ Przycięcie musi zachować **bajtowe kodowanie** oryginału (MO1/MO2/MO3/MO4/MO5 dekodowane przez
`iconv-lite` jako cp1250 lub utf-8 zależnie od parsera) — cięcie po bajtach na granicy `\n`, nie
przez konwersję tekstu.

**MO6/MO7/MO8/MO10 (odtworzone).** Inwersja mapowania `adapter.cjs:404-490` (np. MO6:
`raw.EAN`, `raw.Beschreibung`, `raw['Beschreibung 2']`, `raw.Hersteller`, `raw.Lagerbestand`,
`raw.Cena`, `raw.Model`, `raw['VF/IF']`, `raw.Kategoria`) + nagłówki i kodowanie udokumentowane
w komentarzu każdego parsera (MO6: UTF-8 z BOM; MO7: Windows-1250; MO10: cp1250 CSV albo XLSX
wykrywany po sygnaturze `PK\x03\x04`; MO8: XLSX). Dane wierszy z `test_tyres.cjs`.
⚠ MO7 ma w adapterze fallbacki na klucze zniekształcone (`raw['BIEĹ»NIK']`) — odtworzona próbka
musi reprodukować **realne bajty**, żeby po dekodowaniu dała ten sam klucz co produkcja.
Weryfikacja: oryginalny `parseFile()` + `recordToSurowe()` na odtworzonej próbce musi odtworzyć
wartości oczekiwane przez `test_tyres.cjs` dla tych linii (pętla zamknięta, D2).

**MO9 (obiekty API).** `test/charakteryzacja/probki/MO9.items.json` — kilkanaście obiektów `item`
w kształcie zapytania GraphQL, wypełnionych realnymi danymi z archiwalnego CSV MO9.

- Commit: `4-FEATURE-…: próbki plików dostawców MO1–MO10 + opis pochodzenia`

### Krok 5 — Skrypt nagrywający oczekiwane wyjście (z ORYGINAŁU)
`scripts/charakteryzacja-nagraj.mjs` — jednorazowy, ale **commitowany**, żeby fixtures dały się odtworzyć:
1. Kopiuje `mirror/backend/{common.cjs, dictionaries/, parsers/}` do katalogu tymczasowego
   **wewnątrz `rebuild/backend/`** (`.tmp-oryginal/`, gitignorowany). Powód: oryginalne pliki
   `require`ują `csv-parse`/`iconv-lite`/`xlsx` po gołej nazwie, a Node rozwiązuje takie ścieżki
   względem lokalizacji modułu — dopiero pod `rebuild/backend/` trafią na właściwe `node_modules`.
2. Dla MO1–MO8, MO10: `dispatcher.parseByKod(kod, próbka)` → `adapter.recordsToSurowe(kod, records)`.
3. Dla MO9: `mo9_agrorami_api.itemToRecord()` + odrzucanie quadów (kopia czystej pętli z `fetchAll()`)
   → `adapter.recordsToSurowe('MO9', records)`.
4. Zapis `test/charakteryzacja/MOx.expected.json` (JSON, wcięcie 2, stabilna kolejność).
5. Sprzątanie `.tmp-oryginal/`.
- Commit: `4-FEATURE-…: skrypt nagrywający oczekiwane wyjście z oryginalnych parserów`

### Krok 6 — Test charakteryzacyjny
`test/charakteryzacja.test.ts` — trzy warstwy dowodu:
1. **Integralność portu** — sha256 każdego pliku w `src/import/legacy/**` równy sha256 odpowiednika
   w `mirror/backend/**`. Dowodzi dosłownie „port = oryginał 1:1" i wychwytuje przypadkową edycję.
2. **Charakteryzacja MO1–MO10** — `parsujPlik()` (MO9: czysta pętla) na próbce → porównanie
   **pole po polu** z `MOx.expected.json`; różnica wskazuje dostawcę, indeks rekordu i nazwę pola.
3. **Kontrola przydatności próbki** — każda próbka daje > 0 rekordów, 0 błędów parsera, a rekordy
   mają wypełnione pola kluczowe (`kategoria`, `rozmiar`, `cenaZakupu`) — żeby zielony test nie
   mógł wynikać z pustego wejścia.

Plus `test/charakteryzacja/ZRODLA.md`: dla każdej próbki — pochodzenie, komenda odtworzenia
(`git show 72957d7^:…`), zakres przycięcia, i sposób ponownego nagrania fixtures.
- Commit: `4-FEATURE-…: test charakteryzacyjny MO1–MO10 + integralność portu`

### Krok 7 — Audyt na pełnych plikach (jednorazowy, do raportu)
Poza testami: uruchomienie portu i oryginału na **pełnych** plikach z archiwum dla MO1–MO5,
porównanie wyjść oraz liczby rekordów/odrzuconych wobec `.meta.json` z realnego przebiegu produkcji.
Wynik (liczby, zgodność) trafia do `raport.md`. Nie commitujemy plików ani wyjścia.

### Krok 8 — Dokumentacja
`rebuild/backend/README.md` — sekcja o podsystemie importu: układ `src/import/`, zasada „legacy jest
verbatim, nie edytujemy go ręcznie", jak re-synchronizować z produkcją, jak przenagrać fixtures.

## Strategia testów

**GATE tej sesji = charakteryzacja** (roadmap §5 blok 3a). Gate kontraktu/fixtures **nie obowiązuje** —
ticket nie dotyka API (uzasadnienie w sekcji „Kontrakt i fixtures").

| Warstwa | Co dowodzi | Jak |
|---|---|---|
| Integralność portu | port jest bajt-w-bajt kopią oryginału | sha256 `src/import/legacy/**` vs `mirror/backend/**` |
| Charakteryzacja MO1–MO10 | portowany potok = wyjście oryginału | `parsujPlik()` vs `MOx.expected.json`, pole po polu |
| Przydatność próbki | zielony test nie wynika z pustego wejścia | > 0 rekordów, 0 błędów, pola kluczowe wypełnione |
| Brzeg wejścia | `parsujBufor` == `parsujPlik` | ten sam plik przez obie ścieżki → identyczny wynik |
| Audyt pełnych plików (poza CI) | zgodność na pełnej skali + oracle produkcji | port vs oryginał vs `.meta.json` (`rekordy`/`odrzucone`) |

**Uczciwe zastrzeżenie do zapisania w raporcie:** przy porcie verbatim warstwa (2) nie może wykryć
błędu przepisania (bo nic nie przepisujemy) — jej realna wartość to dowód, że podsystem **działa
identycznie w nowym środowisku** (ESM↔CJS interop, rozwiązywanie ścieżek `__dirname`, wersje
zależności, obecność plików w `dist/`) oraz **siatka regresji** dla 3b–3e i przyszłych re-synchronizacji
z Anią. Dowód „nie zepsuliśmy kopiowania" niesie warstwa (1).

Bez mocków — testy uruchamiają realny kod na realnych plikach.

## Poza zakresem

- Zapis do `staging_items` przez Drizzle (**3b**).
- Endpointy `POST /api/import/from-url`, `/parse-file`, `/ai-fallback/parse` (**3b**).
- Silnik `tk()`: dopasowanie kod→EAN→`Lq()`, klasyfikator `Zc()`, `assignKodImportu` oraz port
  `bridge_ext.cjs`/`tire_dims.js` (**3c**, decyzja D4).
- Zatwierdzanie/wycofanie/overrides Marty (**3d**).
- Frontend `/staging` (**3e**).
- Zmiana schematu bazy: `products.szerokosc` REAL→TEXT, kolumna `products.uwaga_cena` (**3b/I12**).
- Endpoint `GET /api/products/uwagi-cena` (**3b/I12**).
- Migracja `frazy` (#5) — rozstrzygnięta jako niezwiązana z potokiem parserów (D8).
- TS-yfikacja portowanych modułów (opcjonalnie, później).
- Pobieranie plików z URL/FTP dostawców (brzeg wyjścia sieciowego — 3b).

## Definition of done

- [ ] Podsystem parserów zportowany do `rebuild/backend/src/import/legacy/` — bajt-w-bajt, test sha256 zielony.
- [ ] `parsujPlik(kodDostawcy, sciezka)` i `parsujBufor(kodDostawcy, bufor)` zwracają rekordy po `recordToSurowe()`.
- [ ] Charakteryzacja **MO1–MO10 zielona** — port daje wyjście identyczne z oryginałem, pole po polu.
- [ ] Próbki MO6/MO7/MO8/MO10 zweryfikowane wobec oczekiwań `test_tyres.cjs` (dowód wierności odtworzenia).
- [ ] `test/charakteryzacja/ZRODLA.md` opisuje pochodzenie każdej próbki i komendę odtworzenia fixtures.
- [ ] Audyt pełnych plików MO1–MO5 wykonany, liczby w `raport.md` (w tym zgodność z `.meta.json` produkcji).
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` — czyste w `rebuild/backend`.
- [ ] `npm run build` umieszcza `.cjs` + `dictionaries/` w `dist/` (deploy kopiuje tylko `dist/`).
- [ ] `docs/rebuild-backlog.md` zaktualizowany (#1/#2 → ✅, dopiski przy #3/#4, rozstrzygnięcie #5).
- [ ] `docs/rebuild-roadmap.md` — rozjazd `bridge_ext`/`tire_dims` (3a→3c) poprawiony, status 3a odznaczony.
- [ ] Brak nowych endpointów → UI bez zmian; auto-deploy z `develop` przechodzi.
