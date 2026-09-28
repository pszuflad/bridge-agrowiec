# Dowód równoważności generatorów CSV — przebieg i wynik

> Wykonane 2026-09-24 w ramach ticketu `150-DOCS-test-sciezki-krytycznej` (plan.md, D1).
> **Wynik na użytej bazie: pliki identyczne bajt w bajt.**
>
> ⚠ **CZYTAJ RAZEM Z SEKCJĄ „Dlaczego ten wynik NIE uogólnia się" NA KOŃCU.** Równolegle
> prowadzony ticket 153 wykonał ten sam pomiar na **bazie stagingu** (kopia produkcji z 23.09)
> i znalazł **899 różniących się wierszy** (wpis backlogu `#153.1`, karta `FIX.1`, blokada
> cutoveru). Oba wyniki są prawdziwe — różni je zawartość bazy. Instrukcja dla Ani opisuje
> stan faktyczny, czyli wynik ticketu 153.

## Po co

Karta TEST.2 wymaga dowodu, że nowy generator daje ten sam plik co produkcja, i wprost ostrzega,
że naiwny `diff` dwóch DZISIEJSZYCH plików mierzy rozjazd danych, nie generatorów. Dowód ma sens
wyłącznie na **jednej i tej samej zawartości bazy**.

Stan zastany był niewystarczający: karta I15.3 / ticket 122 zostawiły stały test porównujący
**wiersz nagłówkowy** bajt w bajt z realnym plikiem produkcji
(`rebuild/backend/test/selly.generator-csv.test.ts`, nagranie `test/nagrania/selly-csv-naglowek.csv`
z `origin/main@88fa31c`). Pełnego porównania treści wierszy nie było — liczby z raportu 122
(8209 vs 5461) pochodzą z różnych momentów produkcji i są nieporównywalne.

## Dwie pułapki, które trzeba było ominąć

1. **Stary generator w `mirror/backend/` na `develop` jest NIEAKTUALNY** — ma 59 kolumn, bez
   `Blokowane-formy-platnosci`. Uruchomienie tej wersji dałoby fałszywy rozjazd na ostatniej
   kolumnie. Wersja produkcyjna z 60 kolumnami: `git show 88fa31c:mirror/backend/generate_selly_export.cjs`.
2. **Snapshot nie ma migracji odbudowy** — `db/snapshot.db` to surowa produkcja z 13.08,
   bez kolumny `products.blokowane_formy_platnosci` (wprowadza ją migracja 011). Bez nałożenia
   migracji nowy generator nie miałby skąd wziąć 60. kolumny.

## Przebieg (odtwarzalny)

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"   # Node 20, wymagane przez better-sqlite3
S=<katalog roboczy>

# 1. kopia bazy — NIE otwieramy oryginału do zapisu (ma -shm, może być w użyciu)
cp db/snapshot.db $S/baza.db && rm -f $S/baza.db-shm $S/baza.db-wal

# 2. migracje odbudowy na kopię
cd rebuild/backend && npm run build
DB_PATH=$S/baza.db npm run migrate        # zastosowano 13 (001…013), pominięto 0

# 3. STARY generator — wersja produkcyjna z 88fa31c, nie z develop
git show 88fa31c:mirror/backend/generate_selly_export.cjs > $S/stary/generate_selly_export.cjs
git show 88fa31c:mirror/backend/payment_blocks.cjs        > $S/stary/payment_blocks.cjs
# podmiana WYŁĄCZNIE dwóch stałych ścieżek, reszta pliku nietknięta:
sed -i "s|^const DB_PATH = '.*';|const DB_PATH = '$S/baza.db';|"   $S/stary/generate_selly_export.cjs
sed -i "s|^const OUT_DIR = '.*';|const OUT_DIR = '$S/stary/out';|" $S/stary/generate_selly_export.cjs
cd $S/stary && node generate_selly_export.cjs

# 4. NOWY generator — ta sama baza, to samo polecenie, które po cutoverze odpali cron o 6:00
cd rebuild/backend
DB_PATH=$S/baza.db SELLY_CSV_DIR=$S/nowy SELLY_CSV_PLIK=sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv \
  npm run selly:csv

# 5. porównanie
cmp $S/stary/out/sellycsv-*.csv $S/nowy/sellycsv-*.csv
```

## Wynik

Oba generatory wypisały identyczne statystyki:

```
Liczba produktow aktywnych: 6898
Liczba kolumn: 60
Rozmiar pliku (bajty): 3177786
```

Porównanie plików:

| | Stary (`88fa31c`) | Nowy (`selly:csv`) |
|---|---|---|
| sha256 | `70dacfd79f9e2c69c031e253691f668ef870590993dbb76b4c0ac6ba947b87c5` | **ten sam** |
| bajtów | 3 177 786 | 3 177 786 |
| linii | 6899 (nagłówek + 6898) | 6899 |
| `cmp` | **IDENTYCZNE BAJT W BAJT** | **IDENTYCZNE BAJT W BAJT** |

## Kontrola, czy dowód nie jest pusty

Identyczność byłaby bezwartościowa, gdyby oba generatory wypisywały puste pola. Sprawdzone:

- 60. kolumna `Blokowane-formy-platnosci` jest **wypełniona we wszystkich 6898 wierszach**,
  wartości zróżnicowane (najczęstsza kombinacja 1747 wystąpień, dalej 1629, 861, 634, 615…);
- w pliku jest 5469 linii z polskimi znakami (`ł/ą/ę/ó`) — kodowanie realnie testowane;
- BOM UTF-8 obecny (`ef bb bf`), separator `;`, nagłówek zaczyna się od `Nazwa-produktu`;
- dziewięciu dostawców w pliku (MO1 634, MO2 1629, MO3 577, MO4 353, MO5 1747, MO7 265,
  MO8 615, MO9 861, MO10 217). **MO6 nie ma ani jednego wiersza** — patrz niżej.

## Obserwacja uboczna — MO6

W tej bazie MO6 (Agrowiec / Uniglory, jedyny dostawca `upload`) ma **zero produktów w katalogu**
— ani `aktywny`, ani `wstrzymany` — i `suppliers.import_wylaczony = 1`. W konsekwencji nie ma go
w pliku dla Selly. Pomiar pochodzi ze snapshotu z 13.08, więc na bazie stagingu (kopia z 23.09)
może być inaczej. Skierowane do użytkownika jako pytanie w instrukcji
(`docs/instrukcja-testu-sciezki-krytycznej.md`, „Do Twojej decyzji" p. 1).

## Zasięg dowodu — czego NIE pokazuje

- Dowód jest **jednorazowy**, nie jest stałym testem. Na bieżąco pilnowany jest wyłącznie wiersz
  nagłówkowy (`selly.generator-csv.test.ts`). Zamiana tego w stałą straż → follow-up w `raport.md`.
- Baza jest snapshotem z 13.08 po nałożeniu migracji 001–013, nie kopią stagingu z 23.09.
  Dla dowodu **równoważności generatorów** to bez znaczenia (liczy się identyczne wejście),
  ale nie jest to pomiar dzisiejszej produkcji.
- Migracje zmieniają dane (006 `UPPER` na nazwach, 010 marka, 004/005 kategoria i konstrukcja),
  więc plik nie jest bajtowo równy dzisiejszemu plikowi produkcji — i nie miał być.


---

## ⭐ Dlaczego ten wynik NIE uogólnia się — korekta z 2026-09-24

Po wykonaniu tego dowodu na `develop` pojawiło się `docs/karty/TEST.2/wejscie-153.md`: koordynator
przeprowadził **tę samą procedurę na bazie stagingu** (kopia produkcji z 23.09) i dostał wynik
**niezerowy** — 5396 = 5396 pozycji, nagłówek identyczny, ale **899 wierszy różni się treścią**
w pięciu kolumnach flagowych (`Snieg-3PMSF` 750, `Bloto+snieg` 713, `CFO` 52, `NRO` 12, `CHO` 10).

**Przyczyna (wpis `#153.1`):** te kolumny mają w bazie **mieszane typy** — część wierszy trzyma
`integer`, część **tekst `'Tak'`**. Nowy generator czyta produkty przez Drizzle, gdzie kolumny są
`integer({ mode: "boolean" })`, a `Number('Tak') === 1` daje `false` → pusta komórka. Produkcyjny
skrypt czyta `SELECT *` przez `better-sqlite3` i przepisuje `'Tak'` surowo.

**Dlaczego TUTAJ wyszło zero.** Zmierzone na bazie użytej w tym dowodzie
(`db/snapshot.db` z 13.08 + migracje 001–013) — **wszystkie dziesięć kolumn flagowych ma wyłącznie
typ `integer`**, ani jednej wartości tekstowej:

```
stubble_resistant  integer 0: 2147   integer 1: 2
nro                integer 0: 2133   integer 1: 16
cho                integer 0: 2136   integer 1: 13
ms                 integer 0: 2830   integer 1: 1311
snow_3pmsf         integer 0: 2783   integer 1: 1358
cfo                integer 0: 2716   integer 1: 57
```

Tekst `'Tak'` wszedł do bazy **po 13.08** (importy i łatki produkcji z września), więc na tym
snapshocie **błąd nie ma jak się ujawnić**. Dowód był metodycznie poprawny — ale substrat był
niereprezentatywny, a zielony wynik mylący.

**To jest dokładnie ta pułapka, przed którą ostrzega `CLAUDE.md`** („nie ufaj pustym
odpowiedziom" / „nie ufaj `rows: []`"), w wariancie „nie ufaj zerowemu `diff`-owi": wynik zgodny
z oczekiwaniem trzeba podważyć tak samo jak niezgodny. Konkretnie: **zanim uznasz porównanie
za zielone, sprawdź, czy dane w ogóle zawierają przypadek, który mógłby je zapalić na czerwono.**
W tym dowodzie zweryfikowałem, że 60. kolumna nie jest pusta — ale nie sprawdziłem rozkładu
TYPÓW w kolumnach flagowych, a to była właściwa kontrola.

### Co z tego zostaje w mocy

- **Wersja starego generatora była wzięta poprawnie.** `88fa31c` jest na `origin/main`
  i `git diff` z `origin/main:mirror/backend/generate_selly_export.cjs` jest pusty
  (sprawdzone). Ostrzeżenie o `mirror/` na `develop` jest trafne, ale przyczyna jest inna, niż
  napisałem wyżej: `mirror/` w `develop` jest **świadomie cofnięty do stanu z 25.08**
  (commit `6594525`, bramki wierności), a nie „nieaktualny przez zaniedbanie". Wniosek
  praktyczny bez zmian: **żywy generator produkcji bierze się z `origin/main`**.
- **Pozostała część formatu jest potwierdzona** — przy danych bez wartości tekstowych pliki
  są bajtowo identyczne (ta sama suma kontrolna, 6898 pozycji, 60 kolumn, BOM, `\r\n`,
  separator, kolumna `Blokowane-formy-platnosci` wypełniona). Różnica z ticketu 153 ogranicza
  się do pięciu kolumn flagowych i do warstwy odczytu, nie do formatowania.
- **Metoda jest dobra i ma być powtarzana** — w wariancie ticketu 153 (na bazie stagingu,
  oba pliki jeden po drugim, z rozkładem różnic na kolumny). Sam `diff` mówi „899 linii"
  i nic więcej; dopiero rozbicie na kolumny wskazało flagi.

### Wniosek dla przyszłych pomiarów

Porównanie generatorów prowadzi się **na bazie stagingu**, nie na `db/snapshot.db` z sierpnia.
Snapshot nadaje się do sprawdzenia formatu, ale nie do orzekania o wierności na dzisiejszych
danych. Procedura referencyjna: `docs/tickets/153-DOCS-flagi-tak-w-csv/raport.md`.
