# Charakteryzacja parserów — pochodzenie próbek i odtwarzanie wzorca

Ten katalog jest **gate'em iteracji 3a**: dowodem, że portowany podsystem parserów
(`src/import/legacy/**`) zachowuje się identycznie jak oryginał w `mirror/backend/`.

- **Próbki wejściowe** → `probki/`
- **Wzorzec (oczekiwane wyjście oryginału)** → `MOx.expected.json`
- **Test** → `test/charakteryzacja.test.ts`

Punkt przechwycenia to rekord **po `adapter.recordsToSurowe()`**, przed jakimkolwiek zapisem
do bazy — czyli dokładnie tam, gdzie kończy się zakres sesji 3a.

---

## Odtwarzanie

```bash
cd rebuild/backend

# 1. Próbki MO1–MO5 z historii repozytorium (nadpisuje probki/MO1..MO5.csv)
node scripts/charakteryzacja-probki.mjs

# 2. Próbki odtworzone: MO6, MO9 (nadpisuje probki/MO6.csv, MO9.items.json)
#    MO7, MO8 i MO10 to realne pliki od Ani — leżą w repo i NIE są generowane
node scripts/charakteryzacja-probki-odtworzone.mjs

# 3. Wzorzec — uruchamia ORYGINALNE parsery z mirror/backend na tych próbkach
node scripts/charakteryzacja-nagraj.mjs

# 4. Porównanie portu z wzorcem
npm test -- test/charakteryzacja.test.ts
```

Krok 3 uruchamiaj **po każdej re-synchronizacji parserów z produkcją** — `git diff` na
`MOx.expected.json` pokaże wtedy dokładnie, co zmieniło się w zachowaniu importu.

---

## Skąd wzięły się próbki

### MO1–MO5 — realne pliki z produkcji

Źródło: `mirror/backend/import_archive/2026-08/` — katalog godzinowych zrzutów realnych
importów, usunięty z drzewa commitem `72957d7` („wyklucz import_archive + usuń 1874
zarchiwizowane CSV"). W historii jest nadal dostępny pod `72957d7^`.

| Dostawca | Plik źródłowy | Pełny rozmiar | Próbka |
|---|---|---|---|
| MO1 Bohnenkamp | `MO1__20260821__08471__bohnenkamp.csv` | 95 676 B | 23 224 B |
| MO2 JMK | `MO2__20260824__13195__rdzen.csv` | 291 068 B | 36 967 B |
| MO3 Grasdorf | `MO3__20260821__08480__test-csv-3_t1004_pl.csv` | 702 453 B | 117 900 B |
| MO4 Handlopex WR | `MO4__20260824__05585__agrowiec_wr.csv` | 489 430 B | 31 386 B |
| MO5 Handlopex RZ | `MO5__20260825__13431__agrowiec_mw.csv` | 741 590 B | 36 242 B |

Ręcznie pojedynczy plik wyciąga się tak:

```bash
git show '72957d7^:mirror/backend/import_archive/2026-08/MO1__20260821__08471__bohnenkamp.csv' > MO1.csv
```

Cięcie do 200 wierszy danych idzie **po bajtach**, na granicy `\n` — nigdy przez dekodowanie
tekstu. Pliki są w cp1250 albo utf-8 z BOM i konwersja tam i z powrotem mogłaby po cichu
zmienić bajty, które parser realnie widzi. MO1 nie ma wiersza nagłówka (`columns: false`
w `mo1_bohnenkamp.cjs`), pozostałe mają.

Każdy plik archiwum ma obok `.meta.json` z wynikiem **realnego przebiegu produkcji**
(`rekordy`, `parserErrors`, `odrzucone`, `sha256`) — niezależny oracle, użyty w audycie
pełnych plików opisanym w `raport.md`.

### MO7 Nokian i MO10 GRI — realne pliki od Ani (2026-08-26)

> MO8 Trelleborg też — opisany osobno niżej, bo doszedł po nich i ma własną historię.

Oba pochodzą bezpośrednio od Ani i są w repo **bajt w bajt**, bez przycinania — ważą po
~25–40 KB, więc nie ma czego oszczędzać, a byte-exactness jest tu więcej warta niż wycinek
(testujemy realne kodowanie i realne wyjście narzędzi dostawcy).

| Dostawca | Plik od Ani | Format | Rekordów |
|---|---|---|---|
| MO7 Nokian | `CennikNokianCSV (8).csv` | CSV, **UTF-8**, `;` | 285 |
| MO10 GRI | `Plik GRI AGROWIEC 13.07.2026 (1).xlsx` | **XLSX** | 223 |

Wcześniej oba miały próbki odtworzone z `test_tyres.cjs`. **Odtworzenie się obroniło:**
4 z 5 rekordów zgadzało się z prawdziwym plikiem we **wszystkich 53 polach**, a jedyna różnica
(MO10 `PAB1035`, `stan` 8 vs 6) to zmiana stanu magazynowego w czasie, nie błąd metody.
Rzeczywistość potwierdziła też dwie inferencje z kodu:
- **MO7 jest faktycznie w UTF-8** (nagłówek zawiera bajty `C5 BB` dla `Ż`) — patrz „Pułapka
  kodowania MO7" niżej;
- **MO10 przychodzi dziś jako XLSX**, nie CSV — parser wykrywa to po sygnaturze `PK\x03\x04`,
  więc ścieżka XLSX tego parsera jest teraz realnie pokryta.

Bonus pokrycia: prawdziwy cennik Nokiana zawiera **6 pozycji VF Float King z ceną „na zapytanie"**
(`cenaZakupu: null`, `uwagaCena: "na zapytanie"`) — czyli dokładnie przypadek z backlogu #4,
który wcześniej nie był pokryty żadnymi danymi.

### MO8 Trelleborg — realny plik (2026-08-26)

`_Trelleborg List Price_AG_April 2026_New_EPL_PL_BAL.xlsx` — 101 KB, **626 rekordów**, zero błędów.
XLSX z dwoma arkuszami, dokładnie jak opisuje nagłówek parsera: `Radial` (276 pozycji, `PLN`
w kolumnie O) i `XPly` (350 pozycji, `PLN` w kolumnie M). Parser odrzuca po drodze 32 pozycje
`In preparation` i pomija 88 wierszy grupujących — zgodnie z regułami z 2026-07-01.

⚠ **Uwaga: nie mylić z plikiem CSV o tej samej nazwie.** Dostaliśmy najpierw wersję CSV
(jeden arkusz wyeksportowany ze skoroszytu), z której produkcyjny parser czyta **zero rekordów**
— i robi to po cichu, bez błędu. To osobne znalezisko, opisane w backlogu #8; nie jest problemem
próbki, tylko odporności importu.

**Próbka odtworzona (zastąpiona) różniła się od rzeczywistości najbardziej ze wszystkich** —
warto wiedzieć dlaczego, bo to mówi coś o granicach metody:

| Pole | Odtworzone z `test_tyres.cjs` | Realny plik |
|---|---|---|
| `ean` | `8059970000000` | `8059971007480` |
| `model` / `bieznik` | `T421` | `T421 AMPT` |
| `cenaZakupu` | `6175.5` | `11840` |

EAN w `test_tyres.cjs` był zapisany jako `8,05997E+12` — czyli **już zepsuty przez Excela**,
co jest objawem ery CSV; prawdziwy XLSX trzyma pełną precyzję. Nazwy modeli i ceny pochodzą
z innego (starszego) wydania cennika. Próbka odtworzona **poprawnie reprodukowała to, co było
w `test_tyres.cjs`** — po prostu tamte dane były starsze i pochodziły z gorszego źródła.
Dla MO7 i MO10, gdzie wiersze w `test_tyres.cjs` pochodziły wprost z plików, zgodność wyniosła
4 z 5 rekordów co do pola.

### MO6 Agrowiec — odtworzona, dostawca wycofany

⚠ **MO6 jest od 2026-08-26 wycofany z importu** (decyzja produkcji — Ania wyłącza go u siebie,
my odtwarzamy ten stan). Nigdy nie był zresztą importem automatycznym: Uniglory wgrywano ręcznie.
W katalogu **nie ma ani jednego produktu MO6** (zweryfikowane na `db/snapshot.db`, stan 2026-08-13).

Próbkę i wzorzec **zostawiamy**: dalej dowodzą wierności portu, nic nie kosztują, a gdyby dostawca
kiedyś wrócił — pokrycie jest gotowe. Sam parser `mo6_agrowiec.cjs` zostaje w porcie, bo port jest
kopią produkcji; przestaje być po prostu wołany.

2 wiersze odtworzone z realnych linii w `test_tyres.cjs`; CSV, UTF-8 z BOM, nagłówki niemieckie
(`Beschreibung`, `Hersteller`).

#### Pułapka kodowania MO7

`mo7_nokian.cjs` dekoduje plik jako **cp1250**, ale `adapter.cjs` (case MO7) szuka bieżnika pod
kluczami `'BIEÄąÂ»NIK'`, `'BIEĹ»NIK'` i `'BIEZNIK'` — czyli pod nagłówkiem **zniekształconym**,
nigdy pod czystym `BIEŻNIK`. `Ĺ»` to dokładnie to, co daje para bajtów UTF-8 znaku `Ż`
(`C5 BB`) zdekodowana jako cp1250.

Wniosek z kodu: realny plik Nokiana musi być w **UTF-8**, a produkcja czyta go jako cp1250 —
i cały łańcuch (parser + adapter) jest napisany pod ten rozjazd.

✅ **Potwierdzone na prawdziwym pliku (2026-08-26).** Nagłówek `CennikNokianCSV (8).csv` zaczyna
się bajtami `B I E C5 BB N I K` — `C5 BB` to UTF-8 dla `Ż`. Inferencja z kodu była trafna;
próbka w repo jest tym samym plikiem, więc pułapka jest odtworzona sama z siebie.

### MO9 — obiekty API zamiast pliku

MO9 ma w archiwum 201 plików CSV, ale **produkcyjny parser ich nie czyta**. Od 2026-07-10
`mo9_agrorami.cjs` ignoruje `filePath` i odpala `execFileSync` na `_agrorami_fetch_helper.cjs`,
który pobiera katalog z GraphQL `hurtownia.agrorami.pl` (wymaga `AGRORAMI_EMAIL` /
`AGRORAMI_PASSWORD`). Powód zmiany opisuje komentarz w pliku: kolumna `magazyn` w CSV (0/1/2)
nie odpowiadała prawdziwemu stanowi.

Próbka `probki/MO9.items.json` to 12 obiektów `item` w kształcie zapytania GraphQL zaszytego
w `mo9_agrorami_api.cjs` (`sku`, `ean`, `name`, `manufacturer`, `weight`, `url_key`,
`stock_status`, `stock_availability{in_stock,in_stock_real}`, `categories{id,name}`,
`price_range{minimum_price{…}}`, `image{url}`).

Dane produktowe są **realne** — z archiwalnego `MO9__20260821__08472__agrorami.csv`
(EAN, model, rozmiar, indeksy nośności/prędkości, PR, ceny, wagi, kategorie). Przepakowane są
w kształt API:
- `name` — złożone z kolumn starego feedu w format, który API zwraca jednym stringiem
  (`"385/65-22.5 BKT FLOT 648 148A8/144B 18PR TL"`); stary CSV miał to rozbite na kolumny;
- `sku` = kolumna `id` starego feedu (kod handlowy), `id` = osobny numer encji Magento —
  rozróżnienie `sku` ↔ `id` to realna poprawka z 2026-07-13 i próbka celowo je pokrywa;
- `in_stock_real` — wartości w kształtach udokumentowanych w kodzie parsera: liczba, zapis
  `"5+"`/`"15+"`, oraz `null`.

**Jak testujemy bez sieci.** `test/charakteryzacja/mo9-offline.mjs` podstawia **tylko globalny
`fetch`**, odpowiadając nagraną odpowiedzią GraphQL zbudowaną z próbki (z odwzorowaniem
keyset-paginacji: zwraca elementy o `id` większym od kursora, najwyżej `pageSize`). Dzięki temu
realnie wykonuje się cały produkcyjny `fetchAll()` — generowanie tokenu, pętla paginacji,
wykrywanie błędów autoryzacji, odrzucanie quadów i `itemToRecord()`. Nie duplikujemy ani
linijki portowanej logiki. Wynik przepuszczamy przez `JSON.parse(JSON.stringify(…))`, bo
produkcja dostaje go tak samo — przez stdout procesu potomnego.

**Paginacja ma osobny test.** Sama charakteryzacja MO9 (12 obiektów) ćwiczy wyłącznie przypadek
**jednostronicowy** — `fetchAllItems()` przerywa pętlę, gdy strona ma mniej niż `PAGE_SIZE` (=100)
elementów. Dlatego warstwa 5 testu (`test/charakteryzacja.test.ts`) powiela realne obiekty próbki
do 250 sztuk z rozłącznymi `id` i sprawdza, że wracają wszystkie: liczba 250 jest osiągalna
**tylko** przez kontynuację paginacji, bo jedna strona zwraca najwyżej 100. Zweryfikowane
instrumentacją: 3 żądania, kursor `0 → 900099 → 900199`. Treść tych powielonych rekordów nie ma
znaczenia i nie wchodzi do wzorca — sprawdzany jest sam mechanizm kursora.

⚠ **Niepokryty zostaje wyłącznie transport HTTP** (realne żądanie, odnawianie tokenu w czasie,
zachowanie API przy błędach sieci). To brzeg, nie logika parsera, i należy do sesji 3b.

---

## Co wchodzi do repozytorium, a co nie

Próbki to cenniki zakupowe dostawców — wycinki (MO1–MO5, po 200 wierszy) albo pełne pliki tam,
gdzie i tak są małe (MO7 39 KB, MO8 101 KB, MO10 24 KB). Trafiają do repozytorium świadomie: pliki MO1–MO5
były w nim obecne aż do commita `72957d7`, a bez próbek gate nie byłby odtwarzalny na czystym
klonie ani w CI. Cały katalog waży ~3,1 MB zamiast dziesiątek MB.

Pełne pliki **nie** są wersjonowane — `.gitignore` wyklucza `mirror/backend/import_archive/`.
Audyt na pełnych plikach uruchamia się doraźnie z historii gita; wynik jest w `raport.md`.
