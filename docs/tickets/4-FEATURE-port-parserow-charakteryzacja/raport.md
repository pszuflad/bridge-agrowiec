# 4-FEATURE-port-parserow-charakteryzacja — raport z realizacji

## Podsumowanie

Podsystem parserów z produkcji (5043 linie `.cjs` + słownik) został wciągnięty do
`rebuild/backend/src/import/legacy/` jako **kopia bajt-w-bajt**, a nad nim stanął własny brzeg
wejścia `parsujPlik`/`parsujBufor` w TS/ESM: (plik albo bufor + kod dostawcy) → rekordy po
`adapter.recordsToSurowe()`. Gate charakteryzacji jest zielony dla **MO1–MO10** — 1838 rekordów
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
- `rebuild/backend/test/charakteryzacja/probki/` — 10 próbek (~440 KB)
- `rebuild/backend/test/charakteryzacja/MOx.expected.json` — wzorzec (~2,7 MB)
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
| 2. Charakteryzacja MO1–MO10 | port == wyjście oryginału, pole po polu | ✅ 1838 rekordów |
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
| MO7 | MO7_Nokian | **285** | 0 | 0 | 0 |
| MO8 | MO8_Trelleborg | **626** | 0 | 0 | 0 |
| MO9 | MO9_Agrorami | 12 | 0 | 0 | 0 |
| MO10 | MO10_GRI | **223** | 0 | 0 | 0 |
| **razem** | | **1838** | **0** | **156** | **154** |

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
   `nro` i `cho` zostały liczbowe (zweryfikowane na 1838 rekordach). Osobna decyzja.
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

- **MO6 — 2 wiersze, i tak ma zostać.** Dostawca jest wycofany z importu, a w katalogu nie ma ani
  jednego produktu MO6 — pokrycie nie urośnie i nie musi. Próbka odtworzona z realnych linii
  w `test_tyres.cjs`.
- **MO7, MO8 i MO10 — luka zamknięta 2026-08-26.** Ania dostarczyła prawdziwe pliki
  (285, 626 i 223 rekordy), które zastąpiły próbki odtworzone. Odtworzone zostają już tylko MO6
  (wycofany) i MO9 (źródłem jest API, nie plik).
- **MO9 — niepokryty transport HTTP.** Podstawiamy wyłącznie globalny `fetch`, więc realnie wykonuje
  się cały `fetchAll()`. Poza pokryciem zostaje samo żądanie sieciowe, odnawianie tokenu w czasie
  i zachowanie API przy błędach — to brzeg, należący do 3b. Ścieżka wielostronicowa **jest** pokryta,
  ale osobnym testem (warstwa 5), nie samą charakteryzacją — 12-elementowa próbka mieści się
  w jednej stronie.
- **`uwagaCena` — luka zamknięta 2026-08-26.** Prawdziwy cennik Nokiana zawiera **6 pozycji
  VF Float King z ceną „na zapytanie"** (`cenaZakupu: null`, `uwagaCena: "na zapytanie"`) — czyli
  dokładnie przypadek z backlogu #4. Ścieżka `detectPriceOnRequest()` jest teraz pokryta realnymi
  danymi.

## Follow-up

Zebrane wyżej, tu w formie zadań:

1. **Domknąć `szerokosc` razem z decyzją backlogu #3** — usunąć fallback `parseWidthFallbackMm()`
   albo świadomie go zostawić, PRZED zmianą `products.szerokosc` REAL→TEXT (3b/I12).
2. **Zdecydować o `nro`/`cho`** — czy mają pójść za konwencją `'Tak'`/`null` jak reszta flag.
3. **Potwierdzić skalę odrzuceń MO4/MO5** przy 3c (klasyfikator `Zc()`/`shouldRejectRecord()`).
4. ~~Dograć próbkę z „ceną na zapytanie"~~ — **zrobione 2026-08-26**, prawdziwy cennik Nokiana
   zawiera 6 takich pozycji.
5. ~~Poprosić Anię o pliki od MO6/MO7/MO8/MO10~~ — **częściowo zrobione 2026-08-26**: MO7 i MO10
   podmienione na prawdziwe, MO6 wycofany (pokrycie nie jest już potrzebne). **Zostaje MO8.**
5b. **MO8 Trelleborg — poprosić o plik w formacie, który parser czyta** (XLSX z arkuszami
   `Radial`/`XPly`). Otrzymany CSV daje zero rekordów.
5c. **MO8 — rozważyć wykrywanie formatu po sygnaturze bajtów**, tak jak robi to `mo10_gri.cjs`.
   Dziś podanie CSV kończy się cichym importem zera pozycji, bez błędu. To zmiana zachowania
   produkcji, więc wymaga decyzji Ani, nie naszej.
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

## Aktualizacje dokumentacji

Trzy doc-checkery przeszły równolegle przez `docs/` i `START.md`.

**`docs/spec-backend.md`** — §5 „Silnik importu `tk()`": dopisany krótki callout „Odbudowa (3a)"
w stylu istniejących w tym pliku — potok WEJŚCIA do `tk()` (dispatcher → parser →
`adapter.recordsToSurowe()`) jest przeportowany 1:1 i pokryty charakteryzacją MO1–MO10;
`bridge_ext`/`tire_dims`/`tk()` zostają do 3c. Reszta pliku bez zmian (nie dotyczy ticketu).
Zweryfikowano też, że `docs/incoming/backend-perplexity/backend_doc/05_PARSERY_MODULY.md` już
poprawnie opisuje MO9 jako GraphQL, nie CSV — brak sprzeczności do naprawienia.

**`docs/spec-frontend.md`** — bez zmian. Plik opisuje wyłącznie frontend produkcji; ticket
nie dotyka UI.

**`docs/deploy-setup.md`** — dwie wstawki: (1) „Kontrakt z aplikacją" — `npm run build` ma od 3a
trzeci krok kopiujący portowane parsery do `dist/import/legacy/`, i dlaczego to ma znaczenie
(deploy kopiuje wyłącznie `dist/`); (2) „Znane pułapki środowiska (VPS)" — trzy nowe zależności
produkcyjne są czysto JS-owe i nie wymagają obejścia jak `better-sqlite3`. Zweryfikowane
w `tools/deploy-staging.sh`: kopiuje całe `dist/`, potem `npm ci --omit=dev` w release, więc nowe
zależności zainstalują się same.

**`START.md`** — dopisane trzy zdania o tym, że `src/import/legacy/` to port bajt-w-bajt
(nie edytować ręcznie), komenda gate'u charakteryzacji i odesłanie do README backendu.
Dodatkowo **poprawiony zastany błąd** wskazany przez doc-checkera: „Stan odbudowy: Iteracja 1
zamknięta" było nieaktualne niezależnie od tego ticketu → „iteracje 0–2 zamknięte, iteracja 3
w toku (3a gotowe)".

**`docs/plan.md`** — bez zmian. Dokument historyczny, jawnie oznaczony jako nieaktualny wobec
roadmapy; jego zapis „Każdy parser MO1–MO10 osobno (są już czytelne — przenosimy wiernie)" jest
zgodny z przyjętą strategią portu verbatim.

**`docs/rebuild-roadmap.md`** — doc-checker **wyłapał sprzeczność, którą zostawiłem**: akapit
„⭐ Strategia parserów" nadal wymieniał `bridge_ext.cjs` jako część portu 3a, mimo korekty D4
kilka linii niżej. Naprawione po obu stronach; blok **3c** dostał wprost zapis, że przejmuje port
`bridge_ext.cjs`/`tire_dims.js` wraz z `applyDims`/`applyLinkMemory`.

**`docs/rebuild-backlog.md`** — domknięty wpis #5: nagłówek („NIEZNANE szczegóły" → „rozstrzygnięte:
poza zakresem importu"), wiersz „Iteracja", status → ✔, oraz usunięta nieaktualna rekomendacja
„🕒 zbadać przy I3", która stała w sprzeczności z akapitem „ROZSTRZYGNIĘTE" tuż pod nią.
Statusy #1/#2/#3/#4/#6 zweryfikowane jako zgodne z treścią opisową — bez zmian.

**`docs/vps-syncer-setup.md`** — jeden punkt w „Uwagach": `mirror/backend/import_archive/` jest
wykluczony z rsync i z gita (`72957d7`), więc próbki do gate'u charakteryzacji pochodzą z historii
gita, nie z drzewa roboczego.

### Problemy zastane (zgłoszone, nie naprawiane w tym tickecie)

Brak nierozwiązanych. Jedyny zgłoszony przez doc-checkery problem zastany (nieaktualny „Stan
odbudowy" w `START.md`) został naprawiony, bo dotyczył jednego zdania w pliku i tak edytowanym
w tym tickecie.

## Uzupełnienie 2026-08-26: prawdziwe pliki od Ani + wycofanie MO6

### Podmiana próbek MO7 i MO10 na realne pliki

Ania dostarczyła pliki od trzech dostawców. Dwa zastąpiły próbki odtworzone; oba są w repo
**bajt w bajt**, bez przycinania (ważą 39 KB i 24 KB — nie ma czego oszczędzać, a byte-exactness
testuje realne kodowanie i realne wyjście narzędzi dostawcy).

| Dostawca | Plik | Format | Rekordów | Było (odtworzone) |
|---|---|---|---|---|
| MO7 Nokian | `CennikNokianCSV (8).csv` | CSV, UTF-8, `;` | **285** | 2 |
| MO10 GRI | `Plik GRI AGROWIEC 13.07.2026 (1).xlsx` | **XLSX** | **223** | 3 (CSV) |

Charakteryzacja urosła z **711 do 1214 rekordów**. Cała bateria dalej zielona (164/164).

**Metoda odtwarzania próbek się obroniła.** Porównanie rekordów, które występowały w obu
wersjach — odtworzonej i prawdziwej:

| Rekord | Wynik |
|---|---|
| `MO7_T445733` | identyczny we wszystkich 53 polach |
| `MO7_T445763` | identyczny we wszystkich 53 polach |
| `MO10_PAB1001` | identyczny we wszystkich 53 polach |
| `MO10_PAR1226` | identyczny we wszystkich 53 polach |
| `MO10_PAB1035` | jedna różnica: `stan` 8 → 6 |

Jedyna rozbieżność to stan magazynowy, który zmienił się od czasu, gdy Ania zapisywała ten
przypadek w `test_tyres.cjs` — nie błąd metody. Inaczej mówiąc: rekonstrukcja z realnych linii
producenta odtworzyła rzeczywistość co do pola.

**Dwie inferencje z kodu potwierdzone przez rzeczywistość:**
1. **MO7 jest w UTF-8** — nagłówek zawiera bajty `C5 BB` (`Ż`), dokładnie jak przewidywał układ
   fallbacków w `adapter.cjs` (`'BIEĹ»NIK'`). Parser czyta ten plik jako cp1250 i cały łańcuch
   jest napisany pod ten rozjazd.
2. **MO10 przychodzi dziś jako XLSX**, nie CSV — więc ścieżka XLSX w `mo10_gri.cjs` (wykrywanie
   po sygnaturze `PK\x03\x04`) jest teraz realnie pokryta, a nie tylko ta CSV-owa.

**Luka `uwagaCena` zamknięta przy okazji.** Prawdziwy cennik Nokiana zawiera 6 pozycji
VF Float King z `cenaZakupu: null` i `uwagaCena: "na zapytanie"` — czyli przypadek z backlogu #4,
który wcześniej nie miał żadnego pokrycia danymi.

### MO8 Trelleborg — plik nie nadaje się na próbkę, i to jest znalezisko

Trzeci plik (`_Trelleborg List Price_AG_April 2026_New_EPL_PL_BAL.csv`) przez produkcyjny parser
daje **zero rekordów**. Przyczyna jest jednoznaczna i zweryfikowana uruchomieniowo:

- `mo8_trelleborg.cjs` czyta plik przez `XLSX.readFile()` i iteruje **wyłącznie po arkuszach
  o nazwach `Radial` i `XPly`**;
- SheetJS wczytuje CSV jako pojedynczy arkusz **`Sheet1`**;
- filtr nie łapie nic → `records: []`, `errors: []` → **import kończy się bez jednego sygnału błędu**.

Dane w pliku są — ma układ kolumn arkusza XPly (13 kolumn, `PLN` w kolumnie M). Zmienia się tylko
opakowanie. Próbka MO8 zostaje więc odtworzona (XLSX, 2 rekordy) do czasu, aż dostaniemy plik
w formacie, który parser faktycznie czyta.

**To jest realna luka w odporności importu, nie tylko kłopot z próbką.** Porównaj z MO10, gdzie
Ania rozwiązała identyczny problem poprawnie: `mo10_gri.cjs` wykrywa format po sygnaturze bajtów
(`PK\x03\x04` = XLSX) i ma osobną ścieżkę CSV, właśnie dlatego, że dostawca potrafi zmienić format
bez zmiany URL-a. MO8 tego nie ma — dostanie CSV i cicho zaimportuje zero pozycji.

Nie naprawiamy tego w 3a (zakres to odtwarzanie, nie poprawianie). Do rozstrzygnięcia z Anią —
patrz „Follow-up".

### MO6 Agrowiec — wycofany z importu

Decyzja produkcji (2026-08-26): MO6 przestaje być importowany, **również w żywej produkcji** —
więc dla nas to nadal wierne odtworzenie, nie odstępstwo. Ustalenia:

- **Dane zostają.** Pozycje MO6 już w katalogu pozostają jako historyczne. Nic nie kasujemy,
  nic nie backfillujemy.
- **Parser zostaje w porcie.** `mo6_agrowiec.cjs` jest częścią kopii bajt-w-bajt; nie można go
  wybiórczo usunąć bez złamania testu integralności. Przestaje być po prostu wołany.
- **Wyłączenie dostawcy to konfiguracja `suppliers`** — sesja 3b (uruchamianie importu) / I11
  (edycja dostawcy), nie warstwa parserów.
- **Próbka i wzorzec MO6 zostają** — dalej dowodzą wierności portu i nic nie kosztują.
- **Automatyczne wycofywanie po 3 nieobecnościach NIE zagraża tym danym** — zweryfikowane
  w oryginale: `tk()` działa na produktach jednego dostawcy (`deminified/backend-index.cjs:47598`,
  `r = U.listProducts().filter(u => u.dostawca === t)`), a licznik `nieobecnosc_pod_rzad` rośnie
  wyłącznie wewnątrz `tk()`. Skoro MO6 nie jest importowany, `tk('MO6', …)` nigdy się nie wykonuje
  i nic się nie wycofuje. Ryzyko istnieje tylko przy uruchomieniu importu MO6 z pustym plikiem —
  ale to zachowanie dotyczy każdego dostawcy i jest zachowaniem oryginału.


## Uzupełnienie 2026-08-26 (2): odpowiedzi Ani i weryfikacja dwóch wątpliwości

### Potwierdzone: dętki, duplikaty, MO9

**Dętki są świadomie wyrzucane z katalogu** — „od początku tak miało być". Zamyka to obserwację
o skali odrzuceń MO4/MO5: klasyfikator działa zgodnie z zamierzeniem.

**Duplikaty w plikach Handlopeksu — zarzut nietrafiony, sprawdzone i wycofuję go.**
Ania wyjaśniła model biznesowy: Handlopex to **jeden dostawca z dwoma magazynami** (Wrocław,
Rzeszów), traktowany jako dwaj dostawcy MO4/MO5, bo cena i wysyłka różnią się między magazynami.
Ta sama opona może leżeć w obu — i tak ma zostać, rozdzielone.

To wyjaśnia duplikację **między** MO4 a MO5. Moja obserwacja dotyczyła jednak duplikatów
**wewnątrz jednego pliku** (MO4: 3771 wierszy, 2821 unikalnych). Doszedłem więc do końca:

| Zakres | Wierszy | Unikalnych |
|---|---|---|
| MO4 — cały plik | 3771 | 2821 |
| MO4 — **po odrzuceniu dętek** (to, co realnie wchodzi do katalogu) | **252** | **252** |
| MO5 — po odrzuceniu dętek | **1639** | **1639** |

**Cała duplikacja siedzi w dętkach** (np. `DET036;DĘTKA 15 x 6.00 - 6 TR-13` występuje 24 razy),
a dętki i tak są odrzucane. Wśród opon — **zero duplikatów**. Nie ma tu problemu do rozwiązania
w 3b; wpis wycofany.

**MO9 Agrorami — nic do szukania w dokumentacji dostawcy.** Ania opisała mechanizm tokenu
(generowany godzinowo, panel odświeża go ok. 55 min) — to jest **już zaimplementowane w porcie
i zweryfikowane w kodzie**: `mo9_agrorami_api.cjs:380-381` ma `TOKEN_TTL_MS = 55 min` i
`TOKEN_BUFFER_MS = 5 min`, a `_getToken()` odświeża po ~50 min, z jednorazowym retry na 401.
Do uruchomienia importu MO9 na stagingu (3b) potrzebne są wyłącznie `AGRORAMI_EMAIL` /
`AGRORAMI_PASSWORD` w pliku `.env` środowiska staging — te same, których używa produkcja.

### Cztery zatwierdzone poprawki → backlog #3, #8, #9, #10

Wszystkie cztery znaleziska z sekcji „Znaleziska" zostały przez Anię potwierdzone jako **błędy
do naprawienia**, nie zamierzone zachowanie:

| # | Rzecz | Werdykt |
|---|---|---|
| #3 | `szerokosc` przeliczana na mm w MO2/MO4/MO5 | „ewidentnie błąd, nie został naprawiony przy naprawie parserów"; ma być w calach |
| #9 | `nro`/`cho` jako 0/1 | „nie może tak być, mają być wszędzie albo Tak, albo puste" |
| #10 | `WULSTBAND` jako opona | „trzeba dopisać do listy odrzucanych, to nie powinno być importowane" |
| #8 | MO8 nie czyta CSV | „trzeba dorobić to samo w MO8" — wykrywanie formatu jak w MO10 |

Żadna z nich **nie jest naniesiona w tym tickecie** — 3a odtwarza zachowanie, a to są zmiany
zachowania. Doszła natomiast do backlogu sekcja **„Gdzie naprawiamy zatwierdzone błędy parserów"**
z decyzją do podjęcia: czy Ania poprawia je w produkcji (a my podciągamy portem — rekomendowane),
czy poprawiamy je u siebie, godząc się na rozjazd portu wobec lustra.

### MO6 i MO8 to importy RĘCZNE — konsekwencja dla 3b

Ania doprecyzowała, że **MO6 (Uniglory) nigdy nie był importem automatycznym** — wgrywano go
ręcznie, więc wycofanie nie wymaga niczego wyłączać. Podobnie **MO8 (Trelleborg)**: plik
przychodzi mailem „raz na jakiś czas", a **Marta wgrywa go ręcznie**.

Mapa `URLS` w `dispatcher.cjs` wymienia adresy dla wszystkich 10 dostawców, ale dla części z nich
jest zapisem nieużywanym. **Dla 3b oznacza to, że ścieżka uploadu pliku jest dla tych dostawców
jedyną realną**, a nie wariantem pobocznym auto-pulla — i że cichy import zera pozycji (#8) jest
groźniejszy, niż wyglądał: nie ma cyklicznego przebiegu, który następnym razem by to nadrobił.


## Uzupełnienie 2026-08-26 (3): MO8 — prześledzona realna ścieżka uploadu

Na pytanie „czy ten CSV to nie jest to, czego potrzebujesz" sprawdziłem nie tylko własny test,
ale **realną ścieżkę produkcyjną, z której korzysta Marta** (`POST /api/dostawcy/:kod/upload`).
Wniosek się nie zmienia — plik nie nadaje się na próbkę — ale znalezisko #8 okazuje się
poważniejsze, niż wyglądało.

**Ścieżka uploadu nie robi nic dodatkowego z formatem.** `nq(kod, bufor, rozszerzenie)`
(`backend-index.cjs:48005`) zapisuje bufor do pliku tymczasowego i woła `dispatcher.parseByKod()` —
dokładnie to, co odtwarza nasze `parsujBufor()`. Żadnej konwersji, żadnego wykrywania formatu.

**Fallback AI istnieje, ale nie ratuje tego przypadku.** Handler uploadu ma `catch`, w którym
sięga po parser AI (`Wc`). Odpala się **wyłącznie przy rzuconym wyjątku**. MO8 na pliku CSV nie
rzuca — zwraca `{records: [], errors: []}`, czyli formalnie sukces. Fallback nigdy nie startuje.

**`tk()` nie ma zabezpieczenia przed pustym wejściem.** Przy `records = []` pętla
`for (let u of r) if (!o.has(u.id))` (`:47808`) podnosi `nieobecnosc_pod_rzad` **każdemu**
produktowi dostawcy. Trzy takie uploady pod rząd → **cały katalog Trelleborga (624 pozycje)
trafia do stagingu jako „wycofana"**, a panel przez cały czas raportuje udany import.

**Czy to się już wydarzyło — nie.** Kanoniczny snapshot bazy (`db/snapshot.db`, stan 2026-08-13):
MO8 ma 624 produkty, **wszystkie z `nieobecnosc_pod_rzad = 0`**. Ten CSV nie był wgrywany panelem.
Liczniki > 0 mają MO1 (8), MO2 (115), MO3 (29), MO4 (71), MO5 (109) — normalna rotacja cenników.

**Korekta wcześniejszego zapisu o MO6.** Przy okazji sprawdzenia snapshotu: w tabeli `products`
**nie ma ani jednego rekordu `dostawca = 'MO6'`**. Zapis w raporcie i backlogu, że „pozycje MO6
zostają jako historyczne", był przedwczesny — nie ma czego zachowywać. Zgadza się to ze słowami
Ani („a jak nie ma nic w bazie, to też nie powinno tam nic być"). Wpis #7 poprawiony.


## Uzupełnienie 2026-08-26 (4): prawdziwy plik MO8

Ania dostarczyła `_Trelleborg List Price_AG_April 2026_New_EPL_PL_BAL.xlsx` — właściwy skoroszyt,
nie eksport pojedynczego arkusza. Próbka MO8 podmieniona; charakteryzacja rośnie z 1214 do
**1838 rekordów**, cała bateria dalej zielona (164/164).

| | Wartość |
|---|---|
| Rekordów | **626** (Radial 276 + XPly 350) |
| Błędów parsera | 0 |
| Odrzucone `In preparation` | 32 |
| Pominięte wiersze grupujące | 88 |

Arkusze nazywają się dokładnie `Radial` i `XPly`, a kolumna `PLN` jest tam, gdzie opisuje nagłówek
parsera (O w `Radial`, M w `XPly`) — czyli plik jest tym, pod który parser był pisany 2026-07-01.

**Odtworzenie MO8 rozminęło się z rzeczywistością najbardziej z całej czwórki** i warto wiedzieć
dlaczego, bo to wyznacza granicę metody:

| Pole | Odtworzone | Realne |
|---|---|---|
| `ean` | `8059970000000` | `8059971007480` |
| `model` / `bieznik` | `T421` | `T421 AMPT` |
| `cenaZakupu` | `6175.5` | `11840` |

Przyczyna nie leży w metodzie, tylko w źródle: wiersze MO8 w `test_tyres.cjs` to **ręcznie wpisane
wejście do `normalizeTrelleborg()`**, a nie linie z pliku (widać to po polach, których parser
w ogóle nie czyta z pliku — `Magazyn`, `RODZAJ`). EAN był tam zapisany jako `8,05997E+12`, czyli
**już zepsuty przez Excela** — objaw ery CSV; prawdziwy XLSX trzyma pełną precyzję. Nazwy modeli
i ceny pochodzą ze starszego wydania cennika.

Dla porównania: przy MO7 i MO10, gdzie wiersze w `test_tyres.cjs` pochodziły wprost z plików
dostawcy, zgodność wyniosła **4 z 5 rekordów co do pola**. Wniosek na przyszłość: rekonstrukcja
jest wiarygodna dokładnie na tyle, na ile wiarygodne jest źródło wierszy — i zawsze warto
docelowo zdobyć prawdziwy plik.

**Znalezisko #8 pozostaje w mocy.** Fakt, że mamy teraz właściwy XLSX, nie unieważnia problemu:
parser dalej po cichu zwraca zero rekordów, gdy dostanie CSV, a `tk()` dalej nie ma zabezpieczenia
przed pustym wejściem. Ryzyko jest realne, bo Trelleborg to import ręczny — a plik CSV o tej samej
nazwie i tej samej treści krąży obok właściwego skoroszytu (sami dostaliśmy najpierw jego).
