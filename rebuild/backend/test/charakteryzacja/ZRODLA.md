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

# 2. Próbki MO6–MO10 odtworzone z danych producenta (nadpisuje probki/MO6,MO7,MO8,MO10,MO9.items)
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

### MO6, MO7, MO8, MO10 — odtworzone z danych producenta

**Tych czterech dostawców nie ma w archiwum w ogóle.** Archiwizacja ruszyła 2026-08-21 i objęła
wyłącznie MO1–MO5 oraz MO9; w całej historii repozytorium nie ma ani jednego ich pliku.

Dane wierszy pochodzą z `mirror/backend/parsers/test_tyres.cjs` — pliku charakteryzacyjnego
Ani, w którym zaszyte są **realne linie** z plików tych dostawców (z numerami linii w oryginale).
Nagłówki, separator i kodowanie odczytano z komentarzy i kodu każdego parsera, a mapowanie
kolumn na pola normalizatora — z `adapter.cjs` (blok `normalizeBySupplier`).

| Dostawca | Format próbki | Wierszy | Uwagi |
|---|---|---|---|
| MO6 Agrowiec/Uniglory | CSV, UTF-8 z BOM, `;` | 2 | nagłówki niemieckie (`Beschreibung`, `Hersteller`) |
| MO7 Nokian | CSV, **UTF-8** czytany jako cp1250, `;` | 2 | patrz „Pułapka kodowania MO7" niżej |
| MO8 Trelleborg | XLSX, arkusz `Radial`, 15 kolumn | 2 | EAN celowo w notacji naukowej Excela |
| MO10 GRI | CSV, cp1250, `;` | 3 | parser obsługuje też XLSX (wykrywanie po `PK\x03\x04`) |

**Weryfikacja wierności odtworzenia.** Próbki przepuszczono przez ORYGINALNY `parseFile()` +
`recordToSurowe()` i porównano z oczekiwaniami `test_tyres.cjs` dla tych samych linii. Zgadzają
się wszystkie pola pochodzące z pliku: `kodDostawcy`, `ean` (w tym odzyskanie `8,05997E+12` →
`8059970000000`), `marka`, `model`, `rozmiar`, `indeksNosnosci`, `indeksPredkosci`, `tlTt`, `pr`,
`stan`, `cenaZakupu`, `oznaczenieBieznika`, `sb`. Kształt pliku nie jest więc zgadnięty.

Rozbieżności wobec `test_tyres.cjs` są **oczekiwane** i mają znane przyczyny:
- pola, które parser **ustawia na sztywno**, a nie czyta z pliku (MO8: `Magazyn` = 0, `RODZAJ` =
  `rolnicze`) — w `test_tyres.cjs` są ręcznie wpisanym wejściem do `normalizeTrelleborg()`,
  nie wynikiem `parseFile()`;
- `kategoria` i nazwy **wielkimi literami** — `capitalizeKategoria()` i `toUpperPL()` działają
  dopiero w `adapter.recordToSurowe()`, a `test_tyres.cjs` sprawdza wyjście `normalizeXxx()`
  sprzed tego kroku (poprawki `kategoriafix` i `standaryzacja` — backlog #2).

⚠ **`test_tyres.cjs` jest miejscami nieaktualny** — np. dla MO10 oczekuje `szerokosc: 400`
(liczba), podczas gdy obecny `tyre_params.cjs` po poprawce `szertxt` zwraca `"400"` (string).
Nie jest to więc utrzymywany gate producenta, tylko źródło realnych danych wejściowych; wzorcem
dla nas jest zawsze **aktualne wyjście oryginalnego kodu**, nagrane skryptem.

⚠ **Ograniczenie pokrycia.** 2–3 wiersze na dostawcę to wszystko, co jest dostępne offline.
Świadomie nie dopisujemy własnych wierszy, bo zmyślone dane dostawcy nie dowodzą niczego.
Gdy pojawi się prawdziwy plik od któregoś z tych czterech dostawców, wystarczy podmienić próbkę
i przenagrać wzorzec — test jest na to gotowy.

#### Pułapka kodowania MO7

`mo7_nokian.cjs` dekoduje plik jako **cp1250**, ale `adapter.cjs` (case MO7) szuka bieżnika pod
kluczami `'BIEÄąÂ»NIK'`, `'BIEĹ»NIK'` i `'BIEZNIK'` — czyli pod nagłówkiem **zniekształconym**,
nigdy pod czystym `BIEŻNIK`. `Ĺ»` to dokładnie to, co daje para bajtów UTF-8 znaku `Ż`
(`C5 BB`) zdekodowana jako cp1250.

Wniosek: realny plik Nokiana jest w **UTF-8**, a produkcja czyta go jako cp1250 — i cały łańcuch
(parser + adapter) jest napisany pod ten rozjazd. Próbka musi być zapisana w UTF-8; gdyby zapisać
ją „poprawnie" w cp1250, adapter nie zobaczyłby bieżnika i odtworzylibyśmy zachowanie, którego
produkcja nie ma.

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
keyset-paginacji). Dzięki temu realnie wykonuje się cały produkcyjny `fetchAll()` — generowanie
tokenu, paginacja, wykrywanie błędów autoryzacji, odrzucanie quadów i `itemToRecord()`.
Nie duplikujemy ani linijki portowanej logiki. Wynik przepuszczamy przez
`JSON.parse(JSON.stringify(…))`, bo produkcja dostaje go tak samo — przez stdout procesu
potomnego.

⚠ **Niepokryty zostaje wyłącznie transport HTTP** (realne żądanie, odnawianie tokenu w czasie,
zachowanie API przy błędach sieci). To brzeg, nie logika parsera, i należy do sesji 3b.

---

## Co wchodzi do repozytorium, a co nie

Próbki to wycinki cenników zakupowych dostawców. Trafiają do repozytorium świadomie:
były w nim obecne aż do commita `72957d7`, a bez nich gate nie byłby odtwarzalny na czystym
klonie ani w CI. Wycinek 200 wierszy zamiast pełnych plików trzyma cały katalog w granicach
~1,5 MB zamiast dziesiątek MB.

Pełne pliki **nie** są wersjonowane — `.gitignore` wyklucza `mirror/backend/import_archive/`.
Audyt na pełnych plikach uruchamia się doraźnie z historii gita; wynik jest w `raport.md`.
