# Wpis do spec-backend od ticketu 120 (karta I15.2) · 2026-09-23

**Sekcja:** §2 (import — parsowanie cenników) i §5 (odbudowa warstwy parserów).

## Potwierdzone w 120 — niekompletny cennik ZATRZYMUJE import

**Potwierdzone w 120** (`120-CHORE-i15-2-resync-parserow`, 2026-09-23, karta I15.2): od zmiany
produkcji z 22.09 (backlog #103) `dispatcher.parseByKod()` nie oddaje już surowego wyniku parsera —
owija go w `feed_safety.attach()` (`legacy/parsers/dispatcher.cjs:47`), które **rzuca wyjątek**
w trzech sytuacjach: brak tablicy `records`, `errors.length > 0`, pusta lista rekordów.

Znaczenie dla specyfikacji: **błąd odczytu cennika nie jest już ostrzeżeniem, tylko warunkiem
zatrzymania importu.** Wcześniej błędy przechodziły dalej w polu `bledy`, a import działał na
niekompletnych danych — co przy trzech przebiegach pod rząd wycofywało katalog dostawcy
(mechanizm `nieobecnosc_pod_rzad`). Komunikat produkcji mówi to wprost: *„Import zatrzymany bez
przełączania na stary format."*

Odbudowa odtwarza to 1:1 (port verbatim), a warstwa `parsuj.ts` tłumaczy wyjątek na typ znany
trasom, żeby nie zmienić kontraktu HTTP:
- pusty cennik → istniejący `PustyImportBlad` (odstępstwo **D7**) — kod **400** i komunikat
  **bez zmian** względem stanu sprzed resyncu;
- błędy parsera → nowy `BladCennika` — również **400**.

**Granica, która ma znaczenie dla specyfikacji — „zepsuty plik" to nie to samo co „zepsuty czytnik":**
- plik, który parser ODCZYTAŁ i zgłosił błędy wierszy, albo oddał pustą listę → rozpoznany przez
  `feed_safety` → **400** (błąd danych wejściowych);
- plik, który wywraca sam czytnik (np. `CsvError: Quote Not Closed` z `csv-parse`, rzucone wprost
  w `parseRawByKod`, zanim `attach()` w ogóle zostanie wywołane) → **500, bez zmian względem stanu
  sprzed ticketu**. Odbudowa tłumaczy wyłącznie trzy znane komunikaty `feed_safety`, żeby twarda
  awaria nie przebierała się za błąd klienta.

Kody odpowiedzi trasy `POST /api/import/parse-file` dla twardej awarii parsera pozostają więc
niezmienione, co potwierdza `test/archiwum-importow.gate.test.ts` (22/22, bez zmian w asercjach
ani w nagraniu fixture).

## Potwierdzone w 120 — `_bridgeFeedMeta` jest NIEWYLICZALNE

**Potwierdzone w 120**: `feed_safety.attach()` dokleja metadane kompletności do **tablicy**
rekordów przez `Object.defineProperty` **bez `enumerable: true`**, a `converted()`
(`legacy/parsers/adapter.cjs:733`) przenosi je na pozycje po adapterze:

```
_bridgeFeedMeta = { complete, parserErrors, source, rawCount, excludedCodes }
```

Konsekwencja dla specyfikacji: **te metadane nie pojawią się w żadnej odpowiedzi API ani
w `staging_items.snapshot_json` przez zwykłą serializację** — `JSON.stringify` i `Object.keys`
ich nie widzą. Trzeba po nie sięgnąć wprost. To celowe zabezpieczenie, nie przeoczenie.
`source` to `'Agrorami GraphQL'` dla MO9 i `'supplier file'` dla pozostałych dostawców.
Konsumpcja po stronie silnika należy do karty I15.4 — dziś nic w `rebuild/backend/src` tego nie czyta.

## Potwierdzone w 120 — błędny EAN daje `ean: null` (decyzja D4), ze zmierzoną skalą

**Potwierdzone w 120**: adapter realizuje decyzję **D4** — błędny EAN (w tym zapis naukowy)
daje `ean: null` przy zachowanym `eanRaw` i fladze `_eanLossy`. Zastępuje to wcześniejsze
odstępstwo **14i** („puste pole") oraz kontekst wpisu **#11**.

Skala zmierzona na pełnych, realnych cennikach (4 843 rekordy, MO1–MO5), stary port vs nowy:
nowa ekspozycja to **+6 rekordów (0,12 %)**, wyłącznie MO5 — i są to pozycje, które wcześniej
niosły bezsensowny EAN z końcówką `…W2`, niepasujący do niczego w katalogu.

**Stan przejściowy do czasu I15.4:** silnik nie zna flag `eanRaw`/`_eanLossy`. Pozycja z błędnym
EAN-em **nie ginie i nie wywraca importu** — `tk.ts:221` degraduje `null` do pustego łańcucha,
więc pozycja po prostu nie dopasowuje się po EAN i wchodzi pod własnym kodem dostawcy jako nowa.
Docelowo (D4) ma to być błąd blokujący akceptację do ręcznej poprawki.

## Potwierdzone w 120 — trzy zmiany zachowania parserów, zmierzone

Na wzorcu charakteryzacji (10 dostawców) i na pełnych cennikach:

| Zachowanie | Skala | Wpis |
|---|---|---|
| `blokowaneFormyPlatnosci` nadawane per dostawca w adapterze | wszystkie rekordy | #73 |
| `kategoria`/`zastosowanie` kanonizowane już w parserze (`common.cjs` → `capitalizeKategoria`, `tyre_params.cjs` → `application_rules`) | wszystkie rekordy | #75/#79/#80/#82 |
| `szerokosc` bez zer końcowych (`"10.0"` → `"10"`) | 172 zmiany, 9 dostawców | **#83** |
| MO2 (JMK) nie łączy wierszy po samym EAN — kod pozycji z identyfikatora wiersza dostawcy (`MO2_JMK_<id>`) | 6 na próbce, 8 na pełnym cenniku | #103 |
| Handlopex MO4/MO5: końcówka `W2` po 13-cyfrowym EAN to rocznik — do `ean` trafia sam numer, oryginał do `_supplierEanOriginal` | 4 na próbce, 15 na pełnych cennikach | #105 |
| MO9: samotne `DOT` przed `PR`/`TL`/`TT` usuwane z modelu | — (MO9 offline) | #105 |
| MO9: odrzucanie pozycji z kategorii Magento `163` (quady/kosiarki) | — (MO9 offline) | #78 |

**Efekt uboczny #83, wart odnotowania w specyfikacji:** normalizacja szerokości **zmniejsza**
liczbę pozycji trafiających do stagingu, bo katalog trzyma `"10"`, a cennik podawał `"10.0"` —
różnica w samym ZAPISIE produkowała fałszywą „zmianę kluczową". Zmierzone na charakteryzacji
silnika: MO8 `zmienione` 30 → 27, MO10 `zmienione` 2 → 0 (`autoZatwierdzone` 15 → 17).

## Potwierdzone w 120 — `application_rules` nie produkuje wartości wielokrotnych na danych dostawców

**Potwierdzone w 120**: `normalizeApplication()` **potrafi** zwrócić łańcuch rozdzielony `' ; '`
(`application_rules.cjs:150`, `parts.join(' ; ')`), a trigger z migracji `011` spłaszcza taki łańcuch
w kategorii kanonicznej do `Uniwersalne/pozostałe` (opisane w `docs/karty/I15.2/wejscie-107.md`).

**Zmierzone: na danych z cenników adapter nie produkuje ani jednej takiej wartości.** Na próbkach
10 dostawców i na pełnych cennikach MO1–MO5 pole `zastosowanie` przyjmuje wyłącznie `null`
albo `Uniwersalne/pozostałe`. Ryzyko spłaszczenia jest więc realne w kodzie, ale nie materializuje
się w ścieżce parserów — dotyczy danych wchodzących inną drogą (katalog, poprawki ręczne,
odtworzenie z `zastosowania_master.csv`).

Szczegóły i pomiary: `docs/tickets/120-CHORE-i15-2-resync-parserow/`.
