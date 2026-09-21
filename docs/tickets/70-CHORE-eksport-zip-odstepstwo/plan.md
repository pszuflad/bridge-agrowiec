# 70-CHORE-eksport-zip-odstepstwo — P5.2: eksport ZIP jako świadome odstępstwo od produkcji

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `chore/70-eksport-zip-odstepstwo`
> Worktree: `.worktrees/70-CHORE-eksport-zip-odstepstwo`

## Opis ticketa

Karta P5.2 (backlog #93). `GET /api/export-shoper` bez `?dostawca=` w produkcji oddaje zawsze
HTTP 500 (`archiver@5.3.2` nie eksportuje `ZipArchive`, czyta go `rV()`,
`deminified/backend-index.cjs:48139`). Odbudowa ma `archiver@^8.0.0` i trasa działa. Decyzja
użytkownika z 2026-09-18 (karta `62-DOCS-decyzje-po-i14j`, D1): **nie odtwarzamy defektu**.
Zadania: (1) oznaczyć odstępstwo w bramce, (2) bramka ma sprawdzać ZAWARTOŚĆ ZIP-a,
(3) strażnik dryfu wersji `archiver`, (4) zbadać błąd w trakcie strumienia.

## Kontekst — ustalenia (fakty zmierzone w tej karcie)

1. **Bramka ZIP sprawdza wyłącznie nagłówki** (`test/eksport-shoper.gate.test.ts:87-104`),
   a jej komentarz cytuje oryginał `:48786-48800` tak, jakby produkcja tak działała.
   `test/eksport-shoper.format.test.ts:217-234` sprawdza ZIP tylko sygnaturą `PK` i podciągiem
   nazwy pliku w surowych bajtach — nie wykrywa ani uszkodzonego archiwum, ani nadmiarowych
   wpisów, ani pustych plików.
2. **W `node_modules` nie ma czytnika ZIP** (są tylko pakiety piszące: `zip-stream`,
   `compress-commons`). Właściwość plików nie obejmuje nowej zależności, a do testu ona zbędna:
   format ZIP (EOCD → katalog centralny → nagłówki lokalne → deflate) da się przeczytać
   `node:zlib.inflateRawSync` w ~80 liniach, z kontrolą CRC-32.
3. **Zadanie 4 — REALNY PROBLEM, odtworzony bez atrap.** Gdy w bloku asynchronicznym trasy padnie
   coś po `archiwum.pipe(res)` — np. zapis audytu (`zapiszAudyt`, `export-shoper.ts:106-115`;
   symulacja: `DROP TABLE audit_log` w bazie testowej) — klient **wisi bez końca**: odpowiedź
   200 nigdy się nie kończy (test przekroczył limit 20 s). Tak samo przy błędzie archivera
   emitowanym po pierwszych bajtach: `on("error")` przy `headersSent === true` nie robi nic,
   a `pipe()` nie kończy odpowiedzi. Z `archiwum.abort()` + `res.destroy(blad)` klient po ~0,1 s
   dostaje zerwany transfer (`ECONNRESET`) — przeglądarka oznacza pobieranie jako nieudane.
   **Produkcja do tej ścieżki nigdy nie dochodzi** (pada wcześniej na `new oh(...)`), więc zmiana
   nie zmienia żadnego zachowania, które widać w produkcji.
4. **Lockfile trzyma `archiver` dokładnie na 8.0.0** (`package-lock.json:2176-2179`), zakres
   `^8.0.0` ma znaczenie tylko przy regeneracji locka.
5. **W roadmapie nie ma podbloku „P5.2"**, a blok 14j (`docs/rebuild-roadmap.md` ~:2628-2641)
   nadal mówi „wymaga osobnej karty i decyzji" — nieaktualne od 2026-09-18.
   Wpis #93 jest w `develop` (PR #80 zmergowany), status: „decyzja podjęta, karta niezałożona".

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

`GET /api/export-shoper` (`contract/openapi.yaml`, security `[]`, bez `content`). **Fixtures: brak
i być nie może** — trasa oddaje `application/zip`/`text/csv`, nagrywarka zapisywała tylko JSON.
Istniejący test ścieżki + statusu (`sprawdzZgodnoscZKontraktemNieJson`) zostaje bez zmian.
Kontrakt nie jest ruszany. **Wariant ZIP jest świadomym odstępstwem od produkcji** (produkcja: 500).

## Decyzje

- **D1 (użytkownik, 2026-09-18, karta 62, backlog #93):** nie odtwarzamy 500 produkcji; ZIP działa.
- **D2 (użytkownik, 2026-09-21): błąd po wysłaniu nagłówków przerywa połączenie.** Oba handlery
  błędu w trasie ZIP: przed nagłówkami — 500 jak dotąd (1:1 z oryginałem); po nagłówkach —
  `archiwum.abort()` + `res.destroy(blad)` zamiast wiszenia. Odstępstwo w kodzie handlera, w ścieżce
  nieosiągalnej w produkcji. Dodatkowo: zanim trasa odpowie 500, odpina archiwum od odpowiedzi,
  żeby archiver nie pisał do zakończonego strumienia.
- **D3 (użytkownik, 2026-09-21): zostaje zakres `^8.0.0` + test strażnika, bez przypinania.**
  Lockfile i tak trzyma 8.0.0 dla `npm ci`; strażnik pada na każdej wersji bez `ZipArchive`,
  zakres zostawia drogę dla poprawek 8.x. `package.json`/`package-lock.json` bez zmian.
- **D4 (moje, techniczne): czytnik ZIP własny, w teście, bez nowej zależności** — patrz Kontekst 2.

## Plan implementacji

1. **Czytnik ZIP dla testów** — NOWY `rebuild/backend/test/gate/czytnik-zip.ts` (nie eksportowany
   z `gate/index.ts`, żeby nie dotykać wspólnego indeksu): `czytajZip(bufor) → {nazwa, tresc}[]`.
   Waliduje: rekord EOCD, zgodność liczby wpisów EOCD↔katalog centralny, sygnatury nagłówków
   lokalnych, metodę 0/8, długość po rozpakowaniu i CRC-32 każdego wpisu. Rzuca przy
   uszkodzeniu. Plus `pobierzBinarnie` (parser supertest do bufora).
2. **Bramka (zadania 1+2)** — `test/eksport-shoper.gate.test.ts`: komentarz odstępstwa przy obu
   przypadkach ZIP (produkcja 500, `archiver@5.3.2`, D1 2026-09-18, backlog #93); sprostowanie
   komentarza cytującego `:48786-48800`; asercje zawartości: poprawny ZIP, dokładnie jeden plik na
   dostawcę z `listaDostawcow` (zbiór nazw równy oczekiwanemu, bez nadmiarowych), nazwy
   `shoper_{kod}_{YYYY-MM-DD}.csv`, każdy CSV zaczyna się BOM + nagłówkiem 7-kolumnowym
   (`NAGLOWEK_EXPORT_SHOPER`); także dla `dostawca=wszyscy`.
3. **Format (zadanie 2, bajty)** — `test/eksport-shoper.format.test.ts`: test „podciąg w surowych
   bajtach" zastąpiony rozpakowaniem — każdy wpis ZIP-a jest BAJT W BAJT równy odpowiedzi
   `GET /api/export-shoper?dostawca={kod}`; dostawca bez produktów = sam BOM + nagłówek.
4. **Strażnik (zadanie 3)** — NOWY `test/zaleznosci.archiver.test.ts`: `ZipArchive` jest
   eksportowany i jest konstruktorem; zbudowane nim archiwum czyta się czytnikiem z kroku 1.
   Komunikat błędu wskazuje przyczynę (#93) i wersję zainstalowaną.
5. **Ścieżka błędu (zadanie 4)** — `src/routes/export-shoper.ts`: wspólny handler dla
   `on("error")` i `.catch()`: log; `headersSent` → `abort()` + `res.destroy()`; inaczej
   `unpipe` + 500 jak dotąd. Test w bramce/format: `DROP TABLE audit_log` → klient dostaje
   odpowiedź zakończoną (500 albo zerwane połączenie) w czasie < limit, a nie wiszenie. Test
   pisany najpierw i sprawdzony, że na starym kodzie PADA.
6. Bramki: `lint`, `typecheck`, `build`, `test`.

## Strategia testów

Bez atrap: prawdziwa aplikacja (`stworzSrodowiskoTestowe`), prawdziwy `archiver`, realna usterka
bazy. Test zadania 4 musi paść na kodzie sprzed poprawki (sprawdzone ręcznie, zapisane w raporcie).

## Poza zakresem

Historia (`src/historia/**`, `routes/history.ts`, `test/historia.*` — karta P5.1), `contract/**`,
`src/import/**`, trasy produktów/katalogu; `Content-Type: application/zip` przy odpowiedzi 500
przed nagłówkami (1:1 z oryginałem); druga trasa `GET /api/export/shoper` (zawsze CSV).

## Definition of done

- [ ] Bramka ZIP ma jawny komentarz odstępstwa (oba przypadki) i sprawdza zawartość archiwum.
- [ ] Każdy wpis ZIP-a == pojedynczy eksport tego dostawcy (bajty).
- [ ] Strażnik `archiver` pada na wersji bez `ZipArchive`.
- [ ] Błąd w trakcie strumienia nie wiesza klienta; test pada na starym kodzie.
- [ ] `lint`/`typecheck`/`build`/`test` zielone; `package.json`/lock bez zmian.
- [ ] Roadmapa: podblok P5.2 ✅; 14j bez „wymaga decyzji"; backlog #93 Status zaktualizowany.
