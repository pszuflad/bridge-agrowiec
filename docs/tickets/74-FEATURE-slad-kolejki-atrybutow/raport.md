# 74-FEATURE-slad-kolejki-atrybutow — Implementation report

## Summary

Akcje kolejki atrybutów zostawiają ślad w `audit_log` (sześć tras, akcje `atrybut_pending_*`).
Dwie z nich, które przepisują produkty (akceptacja z edycją i alias), są widoczne w widoku
Historii jako `edycja`, z realną liczbą przepisanych produktów i opisem przed → po (#39).
Obie akceptacje korzystają z jednej, 15-pozycyjnej mapy rodzaj→kolumna, więc `model`
i `zastosowanie` nie kończą się już 400. Zakres skanu (13 rodzajów) został bez zmian, ale jest
teraz osobną, jawną listą (#41).

## Pomiar rozbieżności #41 (fakt)

- `origin/main:mirror/backend/pending_module.cjs` ma jeden commit (baseline `e03e2aa`,
  2026-08-13), a mapa skanu `:22-36` jest identyczna z develop i ma 13 rodzajów. **Produkcja
  we wrześniu nie zmieniła zakresu skanu.**
- `db/snapshot.db`: `atrybuty_wartosci_pending` ma `bieznik` 296, `rozmiar` 99, `marka` 68,
  `indeks_nosnosci` 27, `kategoria` 7, `konstrukcja` 1, czyli **0 wierszy `model`/`zastosowanie`**.
  Jedynym pisarzem tej tabeli jest skan, w oryginale i w rebuild.
- Rozbieżność bierze się z `docs/instrukcja-testow-I7.md:317-320` (§4 pkt 4), gdzie stoi
  nieprawdziwe zdanie „Te dwa rodzaje trafiają do kolejki”. Ania odpowiedziała na pytanie 7.4
  na jego podstawie, a nie na podstawie błędu zaobserwowanego w danych. Opis #41 w backlogu
  („nieosiągalne dzisiejszą ścieżką UI”) był trafny.
- Ustalenie poboczne: `atrybuty_wartosci.rodzaj` ma klucz obcy do `atrybuty_rodzaje`. W produkcji
  są tam wszystkie 15 rodzajów (`model` core=1, `zastosowanie` core=0, dodany ręcznie 2026-07-10),
  a seed rebuildu zakłada tylko 5 rdzeniowych. Na bazie z produkcji akceptacje `model`/`zastosowanie`
  działają. Na świeżej bazie bez tych rodzajów akceptacja z edycją skończyłaby się 500 i rollbackiem
  transakcji; to samo dotyczy dziś każdego rodzaju spoza piątki, również dla zwykłej akceptacji.
  Stan jest zastany, nie powstał w tym tickecie. Testy zasiewają oba rodzaje tak jak w produkcji.

## Changes

- `rebuild/backend/src/repos/atrybuty-pending.ts`: usunięta mapa `RODZAJE_KOLUMNY`. Doszła jawna
  lista `ZAKRES_SKANU` (13 rodzajów w kolejności oryginału). `kolumnaRodzaju()` czyta jedną mapę
  `RODZAJ_KOLUMNA`, a `skanujNoweWartosci()` iteruje po `ZAKRES_SKANU`. Nagłówek opisuje, gdzie
  jest audyt.
- `rebuild/backend/src/repos/atrybuty.ts`: tylko komentarz `RODZAJ_KOLUMNA`, która jest jedyną mapą.
  Seed, kandydaci i podobieństwo nietknięte (P7.2).
- `rebuild/backend/src/routes/atrybuty.ts`: `audytuj()` w sześciu trasach kolejki (akceptuj,
  z edycją, alias, odrzuć, DELETE, scan-pending), po udanej operacji i poza transakcją.
  Hook skanu po akceptacji stagingu nie jest audytowany.
- `rebuild/backend/src/historia/mapowanie.ts`: mapa `PRZEPISANIA_Z_KOLEJKI` (akcja → wariant)
  jest jedynym źródłem dwóch nowych wpisów `SLOWNIK_AKCJI`. Doszła gałąź `przepisanieZKolejki()`
  w `naWpisHistorii()`, tylko dla tych dwóch akcji, więc `edycja_produktu` mapuje się bez zmian.
- Testy: `atrybuty.pending.test.ts` (audyt ×7, #41 ×5, nieznany rodzaj), `atrybuty.crud.test.ts`
  (asercja o zakresie skanu), `historia.mapowanie.test.ts` (słownik 7 akcji, gałąź przepisań,
  uszkodzone szczegóły).

### Jak wpis wygląda w widoku Historii

| Data | Typ | Dostawca | Użytkownik | Pozycji | Szczegóły |
|---|---|---|---|---|---|
| 21.09.2026, 17:02 | edycja | — | Ania | 312 | **marka: „NOKIAN HAKKA” → „NOKIAN”**<br>marka (alias z kolejki) |

Pole `uwagi` (`Kolejka atrybutów — alias: marka „NOKIAN HAKKA” → „NOKIAN”, produktów: 312`) nie
jest rysowane przy `edycja`, ale łapie je wyszukiwarka, np. „alias” albo „kolejka”. Filtr „Edycje”
obejmuje oba wpisy. Pozostałe cztery akcje są tylko w `audit_log` (`GET /api/audit-log`).

## Deviations from plan

- Szczegóły wpisu `atrybut_pending_wyczyszczono` to `{rodzaj, usunieto}`, a skanu to same
  statystyki, zgodnie z planem. Innych odstępstw nie ma.
- Obieg techniczny: pierwszy przebieg prettiera bez konfiguracji projektu przeformatował całe
  pliki. Zmiany nałożono ponownie na wersje z develop, więc diff zawiera wyłącznie zmiany
  merytoryczne.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne. Kształt żadnej odpowiedzi się nie zmienił.
  `historia.gate.test.ts` (fixtures `GET_history_paged.json`, `GET_history_meta.json`),
  `historia.wyrocznia.test.ts` (porównanie z oryginałem na snapshocie, 0 rozjazdów) i
  `atrybuty.gate.test.ts` przechodzą bez zmian w fixtures. Na snapshocie nie ma wpisów
  `atrybut_pending_*`, a mapowanie `edycja_produktu` się nie zmieniło, więc wynik jest identyczny
  z produkcją. Różnica pojawi się dopiero przy nowych zdarzeniach kolejki.
- Unit + integracja (prawdziwa baza, bez mocków): ✓ 87 plików / 1360 testów.
- lint ✓, typecheck ✓, build ✓ (Node 20.20.2).
- E2E: nie dotyczy (backend).

## Breaking changes

Brak zmian kontraktu. Zmienia się zachowanie, co jest świadomym odstępstwem: w `audit_log`
pojawiają się nowe akcje, a Historia pokazuje dwa nowe rodzaje wpisów `edycja`.

## Follow-up

- **P7.4, instrukcja I7:** §4 pkt 4 (nieprawdziwe „trafiają do kolejki”, a błąd „Nieznany rodzaj”
  już nie występuje) oraz §4 pkt 7 (ślad w Historii już jest) do sprostowania. Warto też wyjaśnić
  Ani, że `model` i `zastosowanie` nie trafiają do kolejki. Jeśli chce, żeby trafiały, to jest
  zmiana zakresu skanu (I15), która zalałaby kolejkę (#40).
- **Frontend, komentarze (nie zachowanie):** `rebuild/frontend/src/pages/atrybuty/api.ts`
  („bez audytu (backlog #39)”) i `rebuild/frontend/src/pages/historia/dane.ts` („pięć akcji”)
  są nieaktualne.
- **Klucz obcy rodzaju:** na świeżej bazie akceptacja rodzaju spoza pięciu rdzeniowych kończy się
  500 (rollback). Stan zastany, nieobecny na bazie z produkcji. Ewentualne dosianie rodzajów
  `atrybuty_rodzaje` to osobna decyzja.
