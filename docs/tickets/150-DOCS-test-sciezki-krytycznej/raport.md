# 150-DOCS-test-sciezki-krytycznej — raport z realizacji

## Podsumowanie

Powstał `docs/instrukcja-testu-sciezki-krytycznej.md` — instrukcja testu ścieżki krytycznej dla
Ani (dokument 2 z trzech), pięć odcinków: import trzema drogami z MO9 osobno, parsery i zapis do
bazy z przeprowadzeniem jednej pozycji od pliku do katalogu, generowanie CSV, dowód równoważności
generatorów i sprawa adresu feedu w Selly. Obie rzeczy, które karta kazała rozstrzygnąć przed
pisaniem, zostały rozstrzygnięte: **dowód CSV przeprowadzono realnie** (pliki identyczne bajt
w bajt), a wariant Selly wskazano wprost (przy cutoverze nic się nie przepina).

## Zmiany

- **Nowy:** `docs/instrukcja-testu-sciezki-krytycznej.md` — instrukcja dla Ani (413 linii).
- **Nowy:** `docs/tickets/150-DOCS-test-sciezki-krytycznej/plan.md`
- **Nowy:** `docs/tickets/150-DOCS-test-sciezki-krytycznej/dowod-csv.md` — odtwarzalny przebieg
  i wynik dowodu równoważności generatorów, z pułapkami i zasięgiem dowodu.
- **Nowy:** `docs/tickets/150-DOCS-test-sciezki-krytycznej/raport.md` (ten plik)

Żaden plik w `rebuild/`, `contract/`, `rebuild/schema/` ani `mirror/` nie został zmieniony.

## Rozstrzygnięcia, których wymagała karta

### 1. Metoda porównania CSV — dowód przeprowadzony, nie odesłany

Karta kazała najpierw sprawdzić, czy dowodu nie ma już w I15.3. **Jest, ale tylko częściowo:**
ticket 122 zostawił stały test porównujący **wiersz nagłówkowy** bajt w bajt z realnym plikiem
produkcji (`rebuild/backend/test/selly.generator-csv.test.ts`). Porównania **treści wierszy**
na tej samej bazie nie było — liczby w raporcie 122 (8209 vs 5461) pochodzą z różnych momentów
produkcji i są nieporównywalne. Odesłanie pokryłoby więc format, ale nie zawartość, co karta
TEST.2 wprost uznaje za niewystarczające.

Wybrano **pierwszy wariant z karty**: stary generator uruchomiony na kopii bazy, oba pliki
wygenerowane z jednego stanu danych. Wariant drugi (porównanie z produkcyjnym CSV z 23.09)
odrzucony — pliku nie mamy, a odtworzenie wymagałoby dostępu do produkcji.

**Wynik: pliki identyczne bajt w bajt** — ten sam sha256
(`70dacfd7…b87c5`), 6899 linii, 3 177 786 bajtów, 60 kolumn, 6898 pozycji.
Pełny przebieg: `dowod-csv.md`.

Dwie pułapki, które dowód musiał ominąć i które są w nim opisane:
- stary generator w `mirror/` **na `develop` ma 59 kolumn** (brak `Blokowane-formy-platnosci`);
  wersja produkcyjna jest na `88fa31c`. Użycie wersji z `develop` dałoby fałszywy rozjazd;
- `db/snapshot.db` to surowa produkcja z 13.08 bez migracji odbudowy — bez nałożenia 001–013
  nowy generator nie miałby skąd wziąć 60. kolumny.

Dowód sprawdzono też pod kątem pustki: 60. kolumna wypełniona we **wszystkich** 6898 wierszach
wartościami zróżnicowanymi, 5469 linii z polskimi znakami, BOM obecny.

### 2. Model pull w Selly — wariant docelowy wskazany wprost

Odcinek 5 instrukcji opisuje oba warianty i mówi wprost, który jest docelowy:
- **cutover (docelowy): nic się nie przepina.** Dowód twardy, nie deklaracja — nowy stos ma
  w `rebuild/backend/src/config/env.ts:138-146` domyślne `SELLY_CSV_DIR`/`SELLY_CSV_PLIK`/
  `SELLY_CSV_URL` ustawione na **tę samą ścieżkę produkcyjną**, pod którą pisze stary generator.
  Adres w panelu Selly zostaje bez zmian;
- **test przed cutoverem: odradzany**, z podaną ceną — przestawienie adresu przełącza ŻYWY sklep
  na dane z 23.09, wymaga okna i integratora, a katalog stagingu trzeba najpierw zamknąć białą
  listą IP, bo plik zawiera kolumnę `Cena-zakupu`. Instrukcja argumentuje, że po dowodzie
  z odcinka 4 ten test niczego nowego nie sprawdzi.

## Czego na stagingu sprawdzić nie można — opisane wprost

Instrukcja ma osobną sekcję z tabelą „czego nie sprawdzimy / dlaczego / kiedy się zweryfikuje":
zaciągnięcie pliku przez sklep, Tor 1 (delty w ciągu dnia), Tor 2 (pełna synchronizacja 04:30)
i cron o 6:00. Wymienione są trzy niezależne blokady (`SELLY_TRYB=wylaczony`, brak
`SELLY_SCHEDULER`, brak sekretów sklepu) i to, że każda osobno wystarcza.

**Ustalenie, którego karta nie przewidziała, a które trafia do instrukcji:** przy
`SELLY_TRYB=wylaczony` serwer **nie montuje modułu dostępności** (`server.ts:90`), więc na
stagingu CSV **nie odświeża się sam po imporcie** — Ania musi kliknąć „Wygeneruj CSV teraz".
Na produkcji odświeża się automatycznie. Bez tego zdania test „zaimportuj i zobacz pozycję
w pliku" dałby mylący wynik.

## Odstępstwa od planu

Brak. Zakres i metoda zgodne z `plan.md`; wszystkie trzy decyzje użytkownika z Kroku 3
zrealizowane (dowód w tym tickecie, MO9 tylko opisane, droga `url` na przycisku ręcznym).

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Zmiana jest wyłącznie
  dokumentacyjna: nowy plik w `docs/` plus artefakty ticketa i karta. Żaden plik w `rebuild/`,
  `contract/` ani `rebuild/schema/` nie jest modyfikowany, więc nie ma odpowiedzi, którą można by
  porównać z fixture. Kontrakt był **czytany** (nazwy tras), nie zmieniany.
- **Weryfikacja faktów w instrukcji** — każda nazwa ekranu, przycisku i kolumny odczytana ze
  źródła, nie z pamięci ani z roadmapy:
  - menu (`Staging`, `Katalog`, `Alerty`, `Archiwum importów`, `Konfiguracja`, `Selly`) —
    `rebuild/frontend/src/components/nawigacja.ts:42-59`;
  - „Synchronizuj" / „Synchronizuję…" — `pages/konfiguracja/Dostawcy.tsx:314`; „Wgraj plik" — `:341`;
    przyjmowane rozszerzenia `.csv,.xml,.xlsx` — `:322`; „Plik wczytany" — `:206`;
    „Błąd uploadu" — `:130`;
  - kolumny Archiwum (Data, Dostawca, Źródło, Plik, Rozmiar, Rekordy, Status) —
    `pages/archiwum-importow/TabelaArchiwum.tsx:39-45`;
  - szukajka Stagingu („Szukaj po kodzie, nazwie, dostawcy lub EAN…") — `pages/Staging.tsx:222`;
    przycisk „Kolumny" — `pages/staging/KonfiguratorKolumn.tsx:84`; etykiety kolumn dodatkowych
    (EAN, Rozmiar, Producent-opony, Bieznik/model, Cena zakupu, Stan) — `pages/staging/kolumny.ts:47-75`;
  - szukajka Katalogu obejmuje `ean` — `pages/katalog/filtrowanie.ts`, `POLA_SZUKAJKI`;
  - sekcja „Codzienna synchronizacja CSV", przycisk „Wygeneruj CSV teraz", pytanie
    „Wygenerować plik CSV teraz? Zastąpi bieżący plik pobierany przez Selly.", komunikaty
    „⏳ Generuję plik CSV…", „✓ Wygenerowano — N produktów (X MB) w Y s", link
    „Pobierz / podgląd CSV ↗" — `pages/selly/SekcjaCsv.tsx:27,53,81,118,125`;
  - przypisanie dostawców do dróg — odczytane z `db/snapshot.db`, tabela `suppliers`,
    kolumna `sposob_dostarczania` (nie z nazw funkcji ani z roadmapy);
  - godziny: cron CSV 6:00 i pobranie przez Selly 12:00 — `docs/cutover.md:52,280,545,553`;
    Tor 2 o 04:30 — `docs/spec-backend/wpis-121.md:20`. ⚠ Komentarz w
    `tools/deploy-staging.sh:41` mówi luźno „Selly zaciąga go o 6:00" — rozstrzygnięte na korzyść
    `cutover.md:553` („Ania, runda 3: Selly pobiera plik o 12:00");
  - `generate-csv` i `csv-status` **nie** zależą od `SELLY_TRYB` ani od klienta Selly
    (`routes/selly.ts:372,389`) — dlatego przycisk na stagingu działa;
  - MO9 pobiera stronami przez GraphQL (`mo9_agrorami_api.cjs:579-599`) — stąd uzasadnione
    zdanie w instrukcji, że synchronizacja MO9 trwa zauważalnie dłużej.
- **Bramki backendu** (`lint`, `typecheck`, `build`, `test`) — przebiegnięte po synchronizacji
  z `develop`; wynik niżej, w sekcji dopisanej po Kroku 16.

## Breaking changes

Brak.

## Follow-up

1. **Pełne porównanie generatorów jako stała straż.** Dowód z tego ticketu jest jednorazowy;
   na bieżąco pilnowany jest wyłącznie wiersz nagłówkowy. Zamiana go w test regresyjny
   (oba generatory na tej samej bazie w CI) to osobny ticket — w instrukcji jest to postawione
   Ani jako pytanie („Do Twojej decyzji" p. 3), bo wymaga trzymania w repo starego generatora
   z `88fa31c` jako referencji.
2. **Stary generator w `mirror/backend/` na `develop` jest nieaktualny** (59 kolumn, bez
   `Blokowane-formy-platnosci`) względem wersji produkcyjnej z `88fa31c`. To pułapka dla każdego,
   kto sięgnie po `mirror/` jako po „oryginał" — warto rozważyć dociągnięcie `mirror/` do stanu
   produkcji albo ostrzeżenie w `mirror/backend/CHANGELOG.md`. Poza zakresem tego ticketu
   (`mirror/` nie jest własnością karty TEST.2).
3. **MO6 bez produktów w katalogu** — obserwacja z dowodu, skierowana do użytkownika jako
   pytanie w instrukcji. Jeśli odpowiedź brzmi „to błąd", potrzebny osobny ticket na ustalenie,
   na którym etapie pozycje MO6 wypadają.
