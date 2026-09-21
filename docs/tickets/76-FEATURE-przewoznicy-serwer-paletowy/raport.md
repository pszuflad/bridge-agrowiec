# 76-FEATURE-przewoznicy-serwer-paletowy — Implementation report

## Summary

Lista przewoźników i dzielników wagi wolumetrycznej przeniosła się z IndexedDB przeglądarki na serwer:
tabela `waga_gab_przewoznicy` (migracja 007 z seedem Ani) i `GET`/`PUT /api/waga-gabarytowa/przewoznicy`
z walidacją i audytem. Widok `/waga-gabarytowa` czyta listę z API. Usunięcie przewoźnika i „Przywróć
domyślne" pytają o potwierdzenie. Pod tabelą przewoźników doszedł kalkulator paletowy, który woła
istniejące `POST /api/waga-gabarytowa/oblicz`. Wzór wolumetryczny i wzór paletowy są bez zmian.

## Changes

- **New:** `rebuild/schema/007_waga_gab_przewoznicy.sql` — tabela + seed sześciu przewoźników (GEIS
  domyślny). Pierwsza migracja wstawiająca dane do nowej tabeli.
- `rebuild/schema/README.md` — wiersz dla 007.
- `rebuild/backend/src/db/schema.ts` — model Drizzle `wagaGabPrzewoznicy` (dopieszczenie, `domyslny` boolean).
- **New:** `rebuild/backend/src/waga-gabarytowa/przewoznicy.ts` — typ `Przewoznik` i `zwalidujListePrzewoznikow()`.
- **New:** `rebuild/backend/src/repos/przewoznicy.ts` — odczyt (`ORDER BY kolejnosc`, jawna projekcja)
  i zapis całej listy w transakcji.
- `rebuild/backend/src/routes/waga-gabarytowa.ts` — `GET`/`PUT /api/waga-gabarytowa/przewoznicy`
  (`requireAuth`, 400 `{error}`, audyt `edycja_przewoznikow` z `{przed, po}` w try/catch). `/oblicz` bez zmian.
- `contract/openapi.yaml` — nowa ścieżka (get, put) z markerem `x-odbudowa-nowa-trasa`. Schemat ciała
  PUT jest inline; kształt odpowiedzi opisuje tekst markera, bo linie statusów należą do
  `tools/generate-openapi-schemas.cjs`.
- `rebuild/backend/test/db.migracje.test.ts` — 007 na liście, 27 tabel.
- **New:** `rebuild/backend/test/waga-gabarytowa.przewoznicy.test.ts` — 24 testy.
- **New:** `rebuild/frontend/src/pages/waga-gabarytowa/api.ts` — `KLUCZ_PRZEWOZNIKOW`,
  `zapiszPrzewoznikow`, `obliczPaletowo`, typ `WynikPaletowy`.
- **New:** `rebuild/frontend/src/pages/waga-gabarytowa/KalkulatorPaletowy.tsx` — Card „Waga paletowa
  (opony) — inny wzór".
- `rebuild/frontend/src/pages/waga-gabarytowa/przewoznicy.ts` — usunięty `KLUCZ_PRZEWOZNICY`, nagłówek
  opisuje listę na serwerze.
- `rebuild/frontend/src/pages/waga-gabarytowa/TabelaPrzewoznikow.tsx` — szkice pól z zapisem na blur,
  dwa `DialogPotwierdzenia`, blokada przycisków w trakcie zapisu, dopisek „Lista jest wspólna".
- `rebuild/frontend/src/pages/WagaGabarytowa.tsx` — `useQuery` listy, `useMutation` PUT
  (optymistycznie, przy błędzie toast i ponowny odczyt), wyrównanie wyboru usuniętego przez kogoś
  innego, stan „wczytywanie / błąd", kalkulator paletowy.
- `rebuild/frontend/test/waga-gabarytowa.test.tsx` — przepisany na MSW z listą w pamięci (28 testów).

## Deviations from plan

- **Kontrakt:** plan zakładał inline schematy odpowiedzi 200 i 400. Generator schematów
  (`kontrakt.spojnosc.test.ts` → „schematy są AKTUALNE") przepisuje linie statusów i zdejmuje z nich
  treść, jeśli nie ma fixture'a. Kształt odpowiedzi jest więc opisany w tekście `x-odbudowa-nowa-trasa`.
  Inline zostaje tylko schemat `requestBody` PUT. Plan zaktualizowany.
- Poza tym zgodnie z planem.

## Odpowiedzi na punkty z karty

- **Stary klucz `waga-gabarytowa-przewoznicy` (C):** zostaje w IndexedDB nieczytany i niepisany.
  `magazynKV.ts` nie ma funkcji usuwania, a karta zabrania go ruszać. Test FE dowodzi, że wpis
  nie jest ani czytany, ani nadpisywany.
- **Współbieżność (D):** wygrywa ostatni zapis. Jeśli dwie osoby edytują listę naraz, druga nadpisze
  zmiany pierwszej bez ostrzeżenia. Przy jednej-dwóch osobach edytujących tę listę to przypadek
  teoretyczny.
- **Wartości `waga_gab.*` w `db/snapshot.db`**, czyli progi, z którymi kalkulator paletowy wystartuje
  w produkcji: `szer_polpaleta = 55`, `szer_paleta = 80`, `wys_palety = 10`, `wspolczynnik = 0.000167`.
- **Numer migracji:** 007. Sprawdzone 2026-09-21 na `origin/develop` (najwyższy 006) i w otwartych PR-ach
  (jedyny otwarty, #87, nie ma migracji). Przed merge'em sprawdzić, czy karty PR.3 i P6.2 nie weszły
  z własnym 007.
- **Seed na produkcji:** cutover uruchamia `npm run migrate` na żywej `data.db` (`docs/cutover.md` §5),
  więc sześciu przewoźników trafi tam bez ręcznych kroków.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** ✓. `POST /api/waga-gabarytowa/oblicz` — istniejący
  `waga-gabarytowa.gate.test.ts` bez zmian, zielony. `GET`/`PUT /api/waga-gabarytowa/przewoznicy` —
  trasy spoza produkcji, fixture'a nie ma i nie może być. `sprawdzZgodnoscZKontraktem` sprawdza je dla
  200, 400 i 401, `kontrakt.spojnosc.test.ts` jest zielony. `contract/fixtures/` nieruszane.
- **Backend:** lint ✓, typecheck ✓, build ✓ (kopiuje 7 plików `.sql`), test ✓: 88 plików, 1361 testów (po poprawkach z review).
  Nowe testy sprawdzają:
  - seed migracji wprost z tabeli i jego zgodność z listą Ani / `PRZEWOZNICY_DOMYSLNI`;
  - GET w kolejności;
  - PUT → GET;
  - odcięcie obcych pól;
  - 12 przypadków walidacji 400 (lista się nie zmienia);
  - numer pozycji w komunikacie;
  - wpis w `audit_log` z `przed`/`po` i brak wpisu przy 400;
  - 401 dla GET i PUT.
- **Frontend:** lint ✓, typecheck ✓, build ✓, test ✓: 49 plików, 823 testy (po poprawkach z review). Scenariusze z karty:
  - lista z API, a stara lista z IndexedDB nieczytana;
  - usunięcie pyta i dopiero po potwierdzeniu robi PUT;
  - anulowanie usunięcia i resetu niczego nie zmienia;
  - ostatniego przewoźnika nie da się usunąć i widok nawet nie pyta;
  - „Przywróć domyślne" pyta („dla całej firmy") i wysyła `PRZEWOZNICY_DOMYSLNI`;
  - kalkulator paletowy woła `/oblicz` z liczbami i pokazuje pięć pól; puste pole albo liczba ujemna
    nie wysyłają żądania, a zero przechodzi;
  - wybrany przewoźnik usunięty przez kogoś innego → wybór przechodzi na GEIS i zapisuje się lokalnie.

  Dodatkowo:
  - zapis nazwy i dzielnika dopiero na blur;
  - pusta nazwa albo zły dzielnik wracają do poprzedniej wartości bez PUT;
  - błąd zapisu pokazuje toast i przywraca listę z serwera;
  - błąd odczytu pokazuje komunikat i blokuje liczenie.
- **`waga-gabarytowa.obliczenia.test.ts`:** przechodzi **bez zmian** (plik nietknięty, tak samo
  `obliczenia.ts`, `formula.ts`, `magazynKV.ts`).
- **E2E:** pominięte. Plan tego nie przewidywał, a przepływ jest pokryty RTL + MSW i testami tras na
  prawdziwej bazie.

## Review fixes applied

Runda 1 (`review.md`: 1 BLOCKER, 2 SHOULD-FIX, 2 NICE-TO-HAVE):

- **BLOCKER — szybkie edycje z rzędu mogły cofnąć wcześniejszą zmianę.** `zapiszListe` dostaje teraz
  ZMIANĘ (`(aktualna) => nowa`), a nie gotową listę. Liczy ją z bieżącego cache React Query
  i aktualizuje cache synchronicznie, więc kolejna zmiana zawsze widzi poprzednią. Do tego
  `onSuccess` wkłada odpowiedź do cache tylko wtedy, gdy nie leci następny zapis (`isMutating`).
  Bez tego odpowiedź starszego zapisu cofała na ekranie nowszą zmianę.
  - Test regresyjny „odpowiedź pierwszego zapisu nie cofa drugiej, jeszcze lecącej zmiany"
    wstrzymuje każdy PUT osobno. Na starym kodzie **pada**, na nowym przechodzi (sprawdzone).
  - Sama nieświeżość propsa w starym kodzie trwała kilka mikrozadań i przez UI nie da się w nią
    trafić. Pierwsza wersja testu przechodziła na starym kodzie, więc została zastąpiona.
- **SHOULD-FIX — najwyżej jeden `domyslny`.** Nowa reguła walidacji
  („Przewoźnik nr N: tylko jeden przewoźnik może być domyślny") + przypadek testowy.
- **SHOULD-FIX — `contract/README.md` bez konwencji `x-odbudowa-nowa-trasa`.** Przekazane do
  aktualizacji dokumentacji (faza docs tego ticketa).
- **Znalezione przy okazji:** test seeda migracji 007 był tautologią, bo `beforeEach` robił wcześniej
  PUT tą samą listą. Przeniesiony do osobnego `describe` ze świeżą bazą.

## Breaking changes

- Nowa migracja `007` — przy wdrożeniu wymaga `npm run migrate` (standardowy krok deployu i cutoveru).
- Użytkownicy tracą lokalne zmiany listy przewoźników z IndexedDB, bo nie są importowane. Świadome
  założenie C, Ania potwierdziła seed.

## Follow-up

- **P9.2 — sprostowanie `docs/instrukcja-testow-I9.md`.** §3.11, §4 pkt 4 i pkt 6 oraz opisy „lista
  żyje w Twojej przeglądarce" przestały być prawdziwe. Do instrukcji dochodzą:
  - potwierdzenia usunięcia i resetu;
  - wspólna lista;
  - zapis po opuszczeniu pola;
  - kalkulator paletowy.
- Konwencja `x-odbudowa-nowa-trasa` jest nowa. Jeśli kolejne trasy spoza produkcji dojdą, warto
  dopisać ją do `contract/README.md` i sprawdzać w `kontrakt.spojnosc.test.ts`, jak `x-odbudowa-auth`.
