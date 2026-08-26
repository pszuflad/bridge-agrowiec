# 4-FEATURE-port-parserow-charakteryzacja — raport z realizacji

## Podsumowanie

Podsystem parserów z produkcji (5043 linie `.cjs` + słownik) został wciągnięty do
`rebuild/backend/src/import/legacy/` jako **kopia bajt-w-bajt**, a nad nim stanął własny brzeg
wejścia `parsujPlik`/`parsujBufor` w TS/ESM: (plik albo bufor + kod dostawcy) → rekordy po
`adapter.recordsToSurowe()`. Gate charakteryzacji jest zielony dla **MO1–MO10** — 711 rekordów
porównanych pole po polu z wyjściem **oryginalnych** parserów, plus sha256 port↔`mirror/backend`.
Audyt na **pełnych** plikach MO1–MO5 potwierdza zgodność portu z oryginałem także poza próbką,
a liczby rekordów zgadzają się z `.meta.json` z realnych przebiegów produkcji.

Bez bazy, bez `tk()`, bez endpointów — zgodnie z zakresem sesji 3a.

## Zmiany

**Nowe — port verbatim (16 plików, zero edycji):**
- `rebuild/backend/src/import/legacy/common.cjs` — 628 l
- `rebuild/backend/src/import/legacy/dictionaries/oznaczenia.json`
- `rebuild/backend/src/import/legacy/parsers/{adapter,tyre_params,dispatcher}.cjs` — 662 / 1726 / 63 l
- `rebuild/backend/src/import/legacy/parsers/mo1_bohnenkamp.cjs` … `mo10_gri.cjs` (+ `mo9_agrorami_api.cjs`, `_agrorami_fetch_helper.cjs`)

**Nowe — nasz kod:**
- `rebuild/backend/src/import/parsuj.ts` — brzeg wejścia; most ESM→CJS przez `createRequire`
- `rebuild/backend/src/import/typy.ts` — `KodDostawcy`, `RekordSurowy` (50 pól, polskie nazwy), `WynikParsowania`
- `rebuild/backend/scripts/copy-parsery.mjs` — kopiuje `.cjs` + słownik do `dist/` (wpięte w `npm run build`)
- `rebuild/backend/scripts/charakteryzacja-probki.mjs` — odtwarza próbki MO1–MO5 z historii gita
- `rebuild/backend/scripts/charakteryzacja-probki-odtworzone.mjs` — składa próbki MO6–MO10
- `rebuild/backend/scripts/charakteryzacja-nagraj.mjs` — nagrywa wzorzec z **oryginalnych** parserów
- `rebuild/backend/test/charakteryzacja.test.ts` — gate (59 asercji)
- `rebuild/backend/test/charakteryzacja/mo9-offline.mjs` (+ `.d.mts`) — MO9 bez sieci
- `rebuild/backend/test/charakteryzacja/probki/` — 10 próbek (~250 KB)
- `rebuild/backend/test/charakteryzacja/MOx.expected.json` — wzorzec (~1,2 MB)
- `rebuild/backend/test/charakteryzacja/ZRODLA.md` — pochodzenie próbek i procedura odtwarzania

**Zmienione:**
- `rebuild/backend/package.json` — `csv-parse@^5.5.6`, `iconv-lite@^0.6.3`, `xlsx@^0.18.5` (wersje 1:1 z produkcją); `build` woła `copy-parsery.mjs`
- `rebuild/backend/eslint.config.js` — `src/import/legacy/**` i `.tmp/**` poza lintem; `Buffer` w globals
- `rebuild/backend/README.md` — sekcja „Podsystem importu" + procedura re-synchronizacji z produkcją
- `docs/rebuild-backlog.md` — #1/#2 → ✅ TAK (zrobione portem); #3/#4 dopiski o warstwie parsera; #5 rozstrzygnięte na ❌ NIE; #6 → ✔
- `docs/rebuild-roadmap.md` — 3a ✅, korekta zakresu `bridge_ext`/`tire_dims`, status iteracji 3 → 🔨

**Usunięte:** brak.

## Odstępstwa od planu

Trzy, wszystkie na korzyść wierności — żadne nie zmienia zakresu ani decyzji z Q&A.

1. **MO9 charakteryzowany przez realny `fetchAll()`, nie przez skopiowaną pętlę.** Plan zakładał
   odtworzenie w skrypcie czystej części `fetchAll()` (odrzucanie quadów + `itemToRecord`).
   Okazało się, że moduł używa **globalnego `fetch`**, więc wystarczy podstawić sam transport HTTP
   — i wtedy wykonuje się produkcyjny `fetchAll()` w całości: generowanie tokenu, pętla paginacji,
   wykrywanie błędów autoryzacji, odrzucanie quadów, `itemToRecord()`. Lepiej niż w planie: zero
   duplikowania portowanej logiki, większe pokrycie. Wynik przechodzi przez
   `JSON.parse(JSON.stringify(…))`, bo produkcja dostaje go tak samo — przez stdout procesu potomnego.
2. **Dwa skrypty generujące próbki zamiast opisu w `ZRODLA.md`.** Plan przewidywał ręczne wyciągnięcie
   plików i udokumentowanie komend. Skrypty są odtwarzalne bez przepisywania komend z dokumentu.
3. **Weryfikacja próbek MO6–MO10 zawężona do pól pochodzących z pliku.** Plan mówił „odtwarza wartości,
   których `test_tyres.cjs` oczekuje". W trakcie okazało się, że część oczekiwań w tym pliku **nie
   pochodzi z `parseFile()`** (MO8: `Magazyn`/`RODZAJ` są w parserze zahardkodowane, a w teście wpisane
   ręcznie) i że **plik jest miejscami nieaktualny** (dla MO10 oczekuje `szerokosc: 400` jako liczby,
   podczas gdy po poprawce `szertxt` kod zwraca `"400"`). Porównujemy więc pola realnie czytane z pliku
   — i te zgadzają się w 100%. Szczegóły w `ZRODLA.md`.

## Wyniki testów

### Gate odbudowy (fixtures/kontrakt): **N/D — ticket nie dotyka API**

3a nie dodaje ani nie zmienia żadnej ścieżki w `contract/openapi.yaml`: brak endpointu, brak zapisu
do bazy, brak odpowiedzi HTTP do porównania. Endpointy importu i staging należą do 3b i tam gate
fixtures/kontraktu obowiązuje w pełni. Wszystkie istniejące gate'y z iteracji 1–2 pozostają zielone
(162/162 testów w całym backendzie).

### GATE tej sesji: charakteryzacja — ✅ **zielony**

`rebuild/backend/test/charakteryzacja.test.ts` — 61 asercji, pięć warstw:

| Warstwa | Co dowodzi | Wynik |
|---|---|---|
| 1. Integralność portu | sha256 każdego z 16 plików == `mirror/backend` | ✅ |
| 2. Charakteryzacja MO1–MO10 | port == wyjście oryginału, pole po polu | ✅ 711 rekordów |
| 3. Przydatność próbki | > 0 rekordów, 0 błędów parsera, pola kluczowe wypełnione | ✅ |
| 4. Brzeg wejścia | `parsujBufor` == `parsujPlik`; nieznany dostawca odrzucony; typ `KodDostawcy` == lista dispatchera | ✅ |
| 5. Paginacja MO9 | 250 obiektów wraca przez wiele stron, bez gubienia i duplikatów | ✅ |

Wzorzec (`MOx.expected.json`) nagrany skryptem uruchamiającym **oryginalne** parsery z
`mirror/backend/`; punkt przechwycenia = rekord po `adapter.recordsToSurowe()`.

| Dostawca | Etykieta | Rekordy | Błędy parsera | Odrzucone przez parser | Odrzucone przez adapter |
|---|---|---|---|---|---|
| MO1 | MO1_Bohnenkamp | 199 | 0 | 0 | 1 |
| MO2 | MO2_JMK | 200 | 0 | 0 | 0 |
| MO3 | MO3_Grasdorf | 44 | 0 | 156 | 0 |
| MO4 | MO4_Handlopex_WR | 101 | 0 | 0 | 99 |
| MO5 | MO5_Handlopex_RZ | 146 | 0 | 0 | 54 |
| MO6 | MO6_Agrowiec | 2 | 0 | 0 | 0 |
| MO7 | MO7_Nokian | 2 | 0 | 0 | 0 |
| MO8 | MO8_Trelleborg | 2 | 0 | 0 | 0 |
| MO9 | MO9_Agrorami | 12 | 0 | 0 | 0 |
| MO10 | MO10_GRI | 3 | 0 | 0 | 0 |
| **razem** | | **711** | **0** | **156** | **154** |

**Skuteczność gate'u zweryfikowana empirycznie.** Zielony test, którego nie da się złamać, niczego
nie dowodzi — więc sprawdziliśmy. Celowe cofnięcie `capitalizeKategoria()` w porcie
`adapter.cjs` zapaliło **10 asercji**: warstwę 1 (sha256 `parsers/adapter.cjs`) oraz warstwę 2 dla
MO2/MO3/MO4/MO5 z komunikatem wskazującym dostawcę, rekord i pole:

```
AssertionError: MO2[0] (kod=MO2_003-01-01-06-08-0001) pole "kategoria":
  expected 'przemysłowe' to strictly equal 'Przemysłowe'
```

Oryginał przywrócony, gate ponownie zielony.

### Audyt na pełnych plikach (poza CI, MO1–MO5)

Port i oryginał uruchomione na **pełnych** plikach z `import_archive` (95 KB – 742 KB), z krzyżową
weryfikacją wobec `.meta.json` — metadanych zapisanych przez produkcję przy **realnym** przebiegu
importu, czyli oracle'a, którego nie wygenerowaliśmy my.

| Dostawca | Rekordy parsera | `meta.rekordy` | Błędy | `meta.parserErrors` | Odrzucone | `meta.odrzucone` | port == oryginał | sha256 pliku == `meta.sha256` |
|---|---|---|---|---|---|---|---|---|
| MO1 | 842 | 842 | 0 | 0 | 0 | 0 | **TAK** | TAK |
| MO2 | 1596 | *(brak)* | 0 | *(brak)* | 0 | *(brak)* | **TAK** | TAK |
| MO3 | 580 | 580 | 0 | 0 | 720 | 720 | **TAK** | TAK |
| MO4 | 3771 | 3771 | 0 | 0 | 0 | 0 | **TAK** | TAK |
| MO5 | 5184 | 5184 | 0 | 0 | 0 | 0 | **TAK** | TAK |

Porównanie obejmuje pełne `recordsToSurowe()`, `errors` i `odrzucone` — identyczne co do znaku
w każdym z pięciu przypadków. MO2 ma w `.meta.json` `null`-e, bo ten import szedł ścieżką
`"zrodlo": "rdzen-nq"`, która liczników nie zapisuje; pozostałe cztery zgadzają się **co do sztuki**.

Odtworzenie: `git show '72957d7^:mirror/backend/import_archive/2026-08/<plik>'` + skrypt opisany
w `ZRODLA.md`. Pełnych plików nie commitujemy (`.gitignore` wyklucza `import_archive/`).

### Pozostałe

- **Unit/integracyjne:** ✅ 162/162 (13 plików) — cała bateria backendu, w tym gate'y iteracji 1–2.
- **`npm run lint`** ✅ · **`npm run typecheck`** ✅ · **`npm run build`** ✅
- **Artefakt buildu zweryfikowany uruchomieniowo:** `dist/import/legacy/` zawiera 16 plików, a
  `dist/import/parsuj.js` realnie sparsował MO1 (199 rekordów) i MO8 (XLSX, słownik z `dist/`).
  To istotne dla wdrożenia, bo deploy kopiuje wyłącznie `dist/`.
- **E2E:** nie dotyczy — brak ścieżki użytkownika w tej sesji.

## Breaking changes

Brak. Nie ubyło ani nie zmieniło się żadne API, żaden endpoint ani schemat bazy. Nowy kod jest
na razie nieużywany produkcyjnie — konsumentów dostanie w 3b.

Jedna rzecz do odnotowania przy wdrożeniu: `npm ci` w `rebuild/backend` zainstaluje trzy nowe
zależności (`csv-parse`, `iconv-lite`, `xlsx`). `xlsx` jest paczką czysto JS-ową, bez kroku
kompilacji natywnej, więc nie zmienia wymagań build-time na VPS.

## Znaleziska (odtworzone wiernie, NIE naprawione)

Zakres 3a to odtworzenie zachowania, nie jego poprawianie. Poniższe rzeczy port reprodukuje
1:1, bo taka jest produkcja — ale wymagają decyzji.

1. **`szertxt` (backlog #3) nie jest kompletny.** `normalizeJmk` (MO2) i `normalizeHandlopex`
   (MO4/MO5) mają fallback `size.szerokosc ?? parseWidthFallbackMm(record.szerokosc)`
   (`tyre_params.cjs:520`, `:1069`). `parseWidthFallbackMm()` to pozostałość po **cofniętym**
   `szerokoscfix`: przelicza cale na milimetry i zwraca **float**, nie string. W próbce MO2
   trafił 1 rekord na 200 — `rozmiar "6.5/80-12"` → `szerokosc 165.1` zamiast `"6.5"`.
   **Konsekwencja dla decyzji #3:** po przejściu kolumny na TEXT dostanie ona wartości w dwóch
   różnych jednostkach (cale jako string, milimetry jako liczba) — czyli dokładnie tę
   niespójność, którą `szerorig`/`szertxt` miały zlikwidować. Do domknięcia razem z #3.
2. **`nro` i `cho` nadal są liczbami 0/1.** Rekomendacja z backlogu #1 przewidywała, że „ta sama
   zasada dotyczy prawdopodobnie innych pól-flag" — i sprawdziła się. Po `sniegfix` i `flagsfix`
   pola `labelSnow`, `snow3pmsf`, `ms`, `cfo`, `stubbleResistant` zwracają `'Tak'`/`null`, ale
   `nro` i `cho` zostały liczbowe (zweryfikowane na 711 rekordach). Osobna decyzja.
3. **Adapter odrzuca duży odsetek rekordów MO4/MO5.** Na pełnym pliku MO4: 3771 rekordów parsera
   → 252 po `recordsToSurowe()`; MO5: 5184 → 1639. Odrzucanie robi `shouldRejectRecord()`
   (klasyfikator „czy to opona"). Zachowanie identyczne z produkcją, ale skala jest na tyle duża,
   że warto ją potwierdzić przy **3c**, gdzie klasyfikator `Zc()` jest tematem sesji.
4. **`test_tyres.cjs` producenta jest miejscami nieaktualny** — dla MO10 oczekuje `szerokosc: 400`
   (liczba), podczas gdy kod po `szertxt` zwraca `"400"` (string). To nie jest utrzymywany gate,
   tylko zbiór realnych danych wejściowych; nasz wzorzec bierzemy zawsze z aktualnego wyjścia
   oryginalnego kodu.
5. **Rozjazd roadmap ↔ kod (naprawiony w dokumentacji).** Roadmap §5 wymieniała `bridge_ext.cjs`
   i `tire_dims.js` w porcie 3a, ale żaden plik z `parsers/` ich nie `require`uje — są wołane
   wyłącznie w `tk()` w `index.cjs`. Przeniesione do 3c (decyzja D4), opis roadmapy poprawiony.

## Luki pokrycia (świadome, do zamknięcia gdy pojawią się dane)

- **MO6/MO7/MO8/MO10 — 2–3 wiersze na dostawcę.** W całej historii repozytorium nie ma ani jednego
  pliku od tych dostawców; archiwizacja ruszyła 2026-08-21 i objęła tylko MO1–MO5 oraz MO9. Próbki
  odtworzono z realnych linii zaszytych w `test_tyres.cjs`. Świadomie **nie** dopisywaliśmy własnych
  wierszy — zmyślone dane dostawcy nie dowodzą niczego. Gdy pojawi się prawdziwy plik, wystarczy
  podmienić próbkę i przenagrać wzorzec.
- **MO9 — niepokryty transport HTTP.** Podstawiamy wyłącznie globalny `fetch`, więc realnie wykonuje
  się cały `fetchAll()`. Poza pokryciem zostaje samo żądanie sieciowe, odnawianie tokenu w czasie
  i zachowanie API przy błędach — to brzeg, należący do 3b. Ścieżka wielostronicowa **jest** pokryta,
  ale osobnym testem (warstwa 5), nie samą charakteryzacją — 12-elementowa próbka mieści się
  w jednej stronie.
- **`uwagaCena` nigdzie nie jest niepuste.** Żaden z 711 rekordów nie trafił na „cenę na zapytanie",
  więc ścieżka `detectPriceOnRequest()` nie jest pokryta danymi. Kod jest w porcie i przechodzi
  przez typ; potrzebna próbka z takim wierszem (MO7 VF Float King albo MO8 wielkoformatowe VF).

## Follow-up

Zebrane wyżej, tu w formie zadań:

1. **Domknąć `szerokosc` razem z decyzją backlogu #3** — usunąć fallback `parseWidthFallbackMm()`
   albo świadomie go zostawić, PRZED zmianą `products.szerokosc` REAL→TEXT (3b/I12).
2. **Zdecydować o `nro`/`cho`** — czy mają pójść za konwencją `'Tak'`/`null` jak reszta flag.
3. **Potwierdzić skalę odrzuceń MO4/MO5** przy 3c (klasyfikator `Zc()`/`shouldRejectRecord()`).
4. **Dograć próbkę z „ceną na zapytanie"** — domknie pokrycie `uwagaCena` (naturalnie przy 3b,
   gdzie `uwaga_cena` dostaje kolumnę i endpoint).
5. **Poprosić Anię o po jednym pliku od MO6/MO7/MO8/MO10** — podmiana próbki to jedna komenda,
   a pokrycie tych czterech dostawców przestaje być symboliczne.
6. **`xlsx@0.18.5`** — to najnowsza wersja SheetJS w npm i ma znane ostrzeżenia bezpieczeństwa
   (nowsze wydania dystrybuowane są poza npm). Wierność wygrywa na tym etapie; do przeglądu przy
   hardeningu w I12, gdy będzie wiadomo, czy pliki dostawców mogą pochodzić z niezaufanego źródła.
7. **TS-yfikacja portu** — świadomie odłożona (roadmap §5). Dopóki Ania rozwija parsery,
   `.cjs` verbatim jest wart więcej niż typy.

## Poprawki po review

Review (`review.md`): **0 BLOCKER**, 1 SHOULD-FIX, 1 NICE-TO-HAVE. Obie zgłoszone rzeczy naprawione.

1. **SHOULD-FIX — mock keyset-paginacji MO9 nie był realnie ćwiczony.** Słuszne: próbka ma
   12 obiektów, a `PAGE_SIZE` w `mo9_agrorami_api.cjs` to 100, więc `fetchAllItems()` wykonywał
   pętlę dokładnie raz i gałąź kontynuacji kursora nigdy nie startowała — a raport i `ZRODLA.md`
   twierdziły, że paginacja jest pokryta. Zamiast złagodzić twierdzenie, **dołożyliśmy pokrycie**:
   nowa warstwa 5 testu powiela realne obiekty próbki do 250 sztuk z rozłącznymi `id` i sprawdza,
   że wracają wszystkie — liczba 250 jest osiągalna wyłącznie przez kontynuację paginacji, bo
   jedna strona zwraca najwyżej 100. Potwierdzone instrumentacją: **3 żądania, kursor
   `0 → 900099 → 900199`**. Powielone rekordy nie wchodzą do wzorca — testują sam mechanizm kursora.
   Sformułowania w `ZRODLA.md` i w tym raporcie doprecyzowane: paginacja jest pokryta **osobnym
   testem**, nie samą charakteryzacją.
2. **NICE-TO-HAVE — walidacja kodu dostawcy wobec statycznej listy zamiast dispatchera.** Też
   słuszne i to odstępstwo od Kroku 3 planu. `sprawdzKodDostawcy()` sprawdza teraz **oba** źródła:
   `dispatcher.listDostawcy()` (autorytet runtime — to on wie, kto ma parser) oraz typ
   `KodDostawcy` (potrzebny do zawężenia typu w TS). Dodatkowo nowy test pilnuje, żeby te dwie
   listy się nie rozjechały przy re-synchronizacji `dispatcher.cjs` z produkcją.

Przy okazji usunięta jedna asercja-tautologia z pierwszej wersji testu paginacji (porównywała
dwie stałe). Po poprawkach: **61 asercji charakteryzacji**, cała bateria **164/164**,
`lint`/`typecheck`/`build` czyste.
