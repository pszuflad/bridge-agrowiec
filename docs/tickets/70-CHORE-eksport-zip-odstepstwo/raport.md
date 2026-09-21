# 70-CHORE-eksport-zip-odstepstwo — raport z implementacji

## Podsumowanie

Eksport ZIP (`GET /api/export-shoper` bez `?dostawca=`) jest teraz opisany i pilnowany jako
**świadome odstępstwo od produkcji** (backlog #93): w produkcji ta gałąź zawsze oddaje 500, bo
lockfile produkcji ma `archiver@5.3.2` bez `ZipArchive`. U nas ZIP działa i tak ma zostać. Bramka
otwiera teraz archiwum i sprawdza jego zawartość, zamiast patrzeć tylko na nagłówki. Nowy
strażnik zależności pada, jeśli zainstalowany `archiver` nie eksportuje `ZipArchive`. Przy okazji
znalazłem i naprawiłem **wiszące połączenie**: błąd po wysłaniu nagłówków ZIP-a zostawiał klienta
bez końca w oczekiwaniu.

## Zmiany

- **Nowy:** `rebuild/backend/test/gate/czytnik-zip.ts` — minimalny czytnik ZIP (`czytajZip`, czyta
  od katalogu centralnego, sprawdza EOCD, sygnatury, rozmiary i CRC-32, przy każdej niezgodności
  rzuca) + parser supertest `doBufora`. Nie ma nowej zależności: w `node_modules` są tylko
  pakiety piszące ZIP. Czytanie tym samym łańcuchem, który pisze, niczego by nie dowodziło.
  Nie jest eksportowany z `gate/index.ts`, żeby nie ruszać wspólnego indeksu.
- **Nowy:** `rebuild/backend/test/zaleznosci.archiver.test.ts` — strażnik: `ZipArchive` jest
  konstruktorem (komunikat błędu podaje wersję i eksporty zainstalowanego pakietu); archiwum
  zbudowane nim da się przeczytać; czytnik odrzuca archiwum urwane i przekłamane (kontrola, że
  asercje w bramkach coś sprawdzają).
- `rebuild/backend/test/eksport-shoper.gate.test.ts` — (zad. 1) jawny komentarz odstępstwa przy
  obu przypadkach ZIP i w nagłówku pliku: produkcja 500, `archiver@5.3.2`, decyzja 2026-09-18,
  backlog #93. Komentarz, który przedstawiał `:48786-48800` jako zachowanie produkcji, poprawiony.
  (zad. 2) wspólna `sprawdzArchiwum`: poprawny ZIP, nazwy wpisów dokładnie równe
  `shoper_{kod}_{data}.csv` dla `listaDostawcow` (bez brakujących i nadmiarowych, w kolejności
  listy), każdy CSV z BOM-em i 7-kolumnowym `NAGLOWEK_EXPORT_SHOPER`. (zad. 4) nowy `describe`
  ze ścieżką błędu.
- `rebuild/backend/test/eksport-shoper.format.test.ts` — test „podciąg nazwy w surowych bajtach"
  zastąpiony rozpakowaniem: każdy wpis ZIP-a jest **bajt w bajt** równy odpowiedzi
  `?dostawca={kod}`; dosiany dostawca bez produktów (`MO7`) dostaje plik z samym BOM-em
  i nagłówkiem.
- `rebuild/backend/src/routes/export-shoper.ts` — (zad. 4, D2) oba handlery błędu trasy ZIP idą
  przez `przerwij()`. Przed wysłaniem nagłówków: `unpipe` + `abort` archiwum i 500 jak w oryginale
  (`end()` dla `on("error")`, JSON dla `.catch`). Po wysłaniu nagłówków: `res.destroy()` +
  `abort()`. Drugi i kolejny błąd trafia już tylko do logu. Komentarz przy trasie opisuje
  odstępstwo #93.
- `package.json` / `package-lock.json` — **bez zmian** (D3).

## Odstępstwa od planu

Brak.

## Zadanie 4 — co realnie dostaje klient

Zmierzone, nie wydedukowane:

| Sytuacja | Przed poprawką | Po poprawce |
|---|---|---|
| Zapis audytu rzuca po `pipe(res)` (bez atrap: `DROP TABLE audit_log`) | nagłówki 200, odpowiedź **nigdy się nie kończy**; test padł na limicie 5 s | `ECONNRESET` / „socket hang up” w ~0,1 s |
| Archiver emituje `error` po pierwszych bajtach (osobny skrypt, prawdziwy `ZipArchive`) | chunked 200, **wisi** (5 s bez `end`) | po `abort()` + `destroy()`: `aborted` + `ECONNRESET` po 35 B |

Zerwany transfer chunked (bez końcowego fragmentu) przeglądarka oznacza jako nieudane
pobieranie. Użytkownik nie dostaje uszkodzonego pliku, który wyglądałby na poprawny, a serwer
nie trzyma otwartego połączenia. Uznałem to za akceptowalne.

W bramce jest test dla pierwszego wiersza. Drugi wiersz sprawdziłem jednorazowym skryptem,
bez testu: `on("error")` archivera da się w trasie wywołać tylko przez wstrzyknięcie archiwum
(dodatkowy parametr trasy tylko dla testu). Trasa dopisuje wyłącznie stringi, więc w praktyce
może tam paść tylko zlib. Obie ścieżki kończą się w tym samym `przerwij()`, więc test audytu
pokrywa także gałąź „po nagłówkach". Test przyjmuje oba poprawne zakończenia (500 albo zerwane
połączenie), bo moment wysłania nagłówków zależy od kolejki archivera. Zmierzone: przy
padniętym audycie nagłówki już poszły i klient dostaje `ECONNRESET`.

Produkcja tej ścieżki nie zna: pada wcześniej, na `new ZipArchive`, przed jakimkolwiek bajtem
(→ 500).

## Zadanie 3 — dlaczego zakres, nie pin (D3)

`package-lock.json` trzyma `archiver` dokładnie na 8.0.0, a `npm ci` instaluje wersję z locka,
więc zakres `^8.0.0` ma znaczenie tylko przy regeneracji locka (`npm install`/`npm update`).
Semver 8.x nie powinien usuwać eksportu, a gdyby to jednak zrobił, strażnik padnie przy
pierwszym `npm test` z komunikatem wskazującym #93. Pin kupiłby przewidywalność, którą lock już
daje, i zamknąłby drogę automatycznym poprawkom bezpieczeństwa 8.x. Decyzja użytkownika
2026-09-21.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** ✓ w zakresie, jaki ma sens. `GET /api/export-shoper`
  nie ma fixture'a (oddaje `application/zip`/`text/csv`, nagrywarka zapisywała tylko JSON);
  test ścieżki i statusu wobec `openapi.yaml` (`sprawdzZgodnoscZKontraktemNieJson`) jest bez
  zmian i przechodzi. Wariant ZIP jest **zatwierdzonym odstępstwem od produkcji** (#93, D1),
  nie od kontraktu (kontrakt deklaruje 200).
- **Backend:** `lint` ✓, `typecheck` ✓, `build` ✓, `test` ✓ — **86 plików, 1320 testów**
  (develop: 85 / 1317; +1 plik strażnika z 2 testami, +1 test ścieżki błędu w bramce; testy ZIP w bramce i formacie zastąpione 1:1).
- Test ścieżki błędu **pada na kodzie sprzed poprawki** (limit 5 s, „klient zawisł”) —
  sprawdzone przed commitem poprawki.

## Zmiany łamiące

Brak. Zawartość ZIP-a i odpowiedzi 500 przed nagłówkami bez zmian. Zmienia się tylko
zachowanie po awarii w trakcie strumienia: zamiast wiszenia jest zerwane połączenie.

## Follow-up

- **Odpowiedź 500 przed nagłówkami niesie `Content-Type: application/zip` i
  `Content-Disposition: attachment`** (ustawione na początku trasy). Tak samo jak w oryginale,
  więc zostaje, ale przeglądarka może zapisać treść błędu jako plik `.zip`. Do decyzji, jeśli
  kiedyś będzie to miało znaczenie.
- **Zapis audytu przed `finalize()` może zerwać eksport, który sam w sobie się udał.**
  Kolejność jest 1:1 z oryginałem. Zmiana (np. audyt po `finalize` albo w `try/catch`) to
  decyzja o zachowaniu, nie część tej karty.

## Poprawki po review

- **BLOCKER (DoD p.6: roadmapa i backlog)** — to zakres fazy dokumentacji (krok 13–14), która
  szła PO review. Rozliczone w sekcji „Aktualizacje dokumentacji” niżej.
- **SHOULD-FIX (dosiew `MO7` w środku `it()`)** — przeniesiony do `beforeAll` bloku end-to-end
  w `eksport-shoper.format.test.ts`, z komentarzem, dlaczego pozostałym testom bloku nie
  przeszkadza. Testy nie zależą już od kolejności wykonania.
- NICE-TO-HAVE: checkboxy DoD w `plan.md` odhaczone po dokumentacji. Brak automatycznego testu
  gałęzi „błąd archivera po nagłówkach” i to, że test ścieżki błędu trafia w praktyce w jedną
  gałąź, są opisane wyżej („Zadanie 4”). Zostają tak świadomie: testowy parametr trasy tylko po
  to, żeby wstrzyknąć archiwum, byłby kosztem większym niż zysk.
