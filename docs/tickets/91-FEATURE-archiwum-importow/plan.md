# 91-FEATURE-archiwum-importow — Archiwum importów: trzy trasy odczytu + widok z pobieraniem

> Status: Implemented
> Branch: `feature/91-archiwum-importow`
> Worktree: `.worktrees/91-FEATURE-archiwum-importow`
> Karta: `docs/karty/PR.1/`

## Ticket description
PR.1 z przeglądu 12 widoków: ekranu „Archiwum importów" w nowym Bridge nie ma — jedyny czysty brak
funkcji obecnej w produkcji. Ania używa archiwum do porównywania pliku dostawcy z katalogiem
i do weryfikacji brakujących pozycji, więc widok MUSI pozwalać pobrać plik. Odbudowa 1:1.

## Context
- **Zapis archiwum działa od 3b** — `rebuild/backend/src/import/archiwum.ts` (plik + `.meta.json`,
  14 pól, `IMPORT_ARCHIVE_DIR`). Retencja `RETENCJA_DNI = 7` — **zgodna z produkcją**
  (`archive_module.cjs:24`), rozjazdu nie ma.
- **Oryginał BE:** `mirror/backend/archive_module.cjs:160-241` (`registerArchive`, wołane
  z `extensions.cjs:419`, auth `we` → 401 `{error:"Nieautoryzowany"}`, Bearer LUB cookie).
  - `GET /api/import-archive` — filtry `dostawca` (upper-case), `miesiac` (porównanie z nazwą
    katalogu), **`status`** (prompt go nie wymienia, oryginał ma — `:173,180`). Najnowsze
    pierwsze (sort po `mtime`). Odpowiedź `{ok, total, items[]}`, item = 11 pól
    z fallbackami gdy brak meta (`:181-193`).
  - `GET /api/import-archive/stats` → `{ok, plikow, bajtow, limitBajtow, retencjaDni, perMiesiac}`.
  - `GET /api/import-archive/file/:month/:name` → `res.sendFile` + `Content-Disposition:
    attachment; filename="<nazwa w archiwum>"`; 400 `{ok:false,error:"Nieprawidłowe id"}` gdy
    `id` nie pasuje do `^\d{4}-\d{2}\/[^/]+$` albo zawiera `..`; 404 `{ok:false,error:"Nie
    znaleziono pliku"}`; 500 `{ok:false,error}`.
  - Komentarz nagłówka (`file/:id`, „90 dni") jest nieaktualny — kod wygrywa.
- **Łatki (rozłożone diffem):** `.bak_ret7` = wyłącznie `RETENTION_DAYS 90 → 7`.
  `.bak_dlfix` (BE) = trasa `file/:id` z `decodeURIComponent` → `file/:month/:name` (Apache
  `AllowEncodedSlashes=Off` odrzucał `%2F` → 404) + to samo 90→7. `.bak_dlfix` (FE) = URL
  pobierania dzielony na dwa segmenty `encodeURIComponent(month)/encodeURIComponent(name)`.
  Czyli „dlfix" naprawiał **niedziałające pobieranie za Apache**. `origin/main` = `develop` dla
  obu plików (sprawdzone 2026-09-22).
- **Oryginał FE:** `mirror/frontend/assets/archive-injection.js` (ładowany z `index.html`).
  Trasa `/archiwum`, link w sidebarze **tuż po „Historia"** z etykietą „Archiwum importów".
  Widok: nagłówek + podtytuł, przycisk „Odśwież", błąd, 3 selecty (dostawca, miesiąc, status),
  pasek zajętości `bajtow/limitBajtow · N plików · retencja D dni`, tabela 8 kolumn (Data,
  Dostawca, Źródło[· użytkownik], Plik[+błąd ≤120 znaków], Rozmiar, Rekordy, Status OK/BŁĄD,
  „Pobierz"), pusty stan, „Ładowanie…". Opcje selectów dostawcy i miesiąca liczone
  **z aktualnie wczytanej (przefiltrowanej) listy**. Pobranie: `fetch` z Bearer → blob →
  `<a download = oryginalnaNazwa>` (NIE nazwa z `Content-Disposition`); błąd → `alert`.
- **Wzorce odbudowy:** trasy `routes/history.ts` (fabryka + `requireAuth`), `routes/import.ts`
  (`katalogArchiwum` z env), widok `pages/Historia.tsx` + `pages/historia/`, sidebar
  `components/nawigacja.ts`, router `App.tsx` (`TRASY_Z_RAMA`), toasty `components/ui/toast`,
  anchor-download `pages/katalog/eksport.ts:180-199`, klient `lib/api.ts` (`naglowki`),
  GATE `test/historia.gate.test.ts`, `test/gate/asercje.ts`.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
Dziś **brak** — `/api/import-archive*` nie ma w `openapi.yaml` ani w `contract/fixtures/`.
Ticket je tworzy z nagrań oryginału (`tools/record-write-fixtures.cjs`):
- `GET_import-archive.json` (bez filtrów), `GET_import-archive_dostawca.json`,
  `GET_import-archive_miesiac.json`, `GET_import-archive_status.json`,
  `GET_import-archive_401.json`, `GET_import-archive_stats.json`,
  `GET_import-archive_file.json` (treść tekstowa + nagłówki w polu informacyjnym),
  `GET_import-archive_file_400.json`, `GET_import-archive_file_404.json`.
- **Skąd dane w archiwum piaskownicy:** nagrywarka na końcu scenariuszy wgrywa przez
  ORYGINALNĄ trasę `POST /api/import/parse-file` dwie realne próbki dostawców z
  `rebuild/backend/test/charakteryzacja/probki/` (np. MO6.csv, MO1.csv — status `ok`) i jeden
  plik, którego parser nie przełknie (status `blad`). Archiwum powstaje więc kodem oryginału
  (`archiveBuffer` + `updateMeta`), nie ręcznie pisanymi `.meta.json`. Scenariusz na końcu,
  żeby nie zmienić stanu pozostałych nagrań; pozostałe fixtures przywracam, jeśli różnią się
  tylko zegarem.
- Trzy ścieżki opisane w `contract/openapi.yaml` na podstawie nagrań + regeneracja schematów
  (`tools/generate-openapi-schemas.cjs`), jeśli tak robi reszta kontraktu.
- ⚠ Nowe fixtures → bramki OBU stron (sprawdzę, co w BE/FE iteruje po fixtures/ścieżkach).

## Decisions
Rekomendacje (do potwierdzenia przy approve):
- **D1 — trasa i menu:** `/archiwum`, pozycja „Archiwum importów" w `POZYCJE_NAWIGACJI` zaraz po
  „Historia" (przed „Konfiguracja"), ikona `Archive` z lucide (oryginał klonował ikonę Historii).
- **D2 — backend 1:1** z filtrem `status`, tymi samymi kodami/komunikatami, `res.sendFile`
  i `Content-Disposition` z nazwą pliku w archiwum. Funkcje odczytu dopisane do `archiwum.ts`
  (eksport `listaPlikow`, nowe `listaWpisow`, `statystyki`, `sciezkaPliku`); zapis bez zmian.
- **D3 — path traversal: oryginał SIĘ BRONI** (regex dwóch segmentów, zakaz `/` w nazwie po
  zdekodowaniu `%2F` przez Express, zakaz `..`). **Brak odstępstwa** — odtwarzam 1:1 i dokładam
  testy (`..`, `%2F`, `%2E%2E`, zły miesiąc). Skutek uboczny oryginału zachowany: nazwa
  zawierająca `..` (np. `a..csv`) jest nie do pobrania — `safeName` dopuszcza kropki, ale
  archiwizowane nazwy mają postać `KOD__stempel__nazwa`, więc praktycznie tylko przy nazwie
  z dwiema kropkami obok siebie. Odnotowane w raporcie.
- **D4 — pobieranie w FE: `fetch` + Bearer → blob → `a.download = oryginalnaNazwa`** (1:1).
  NIE nawigacja cookie'em jak `pages/analityka/eksport.tsx`: backend przyjąłby cookie, ale
  przeglądarka zapisałaby plik pod nazwą archiwalną (`MO6__20260922__12345__MO6.csv`)
  z `Content-Disposition`, a oryginał daje nazwę oryginalną. Model autoryzacji bez zmian.
- **D5 — błąd pobrania:** toast (styl odbudowy — w `rebuild/frontend/src` nie ma ani jednego
  `alert()`), treść jak w oryginale: „Nie udało się pobrać pliku: <status>".
- **D6 — opcje selectów z przefiltrowanej listy** (1:1, dziwactwo oryginału: po wyborze
  dostawcy lista dostawców zawęża się do niego, do czasu wyboru „Wszyscy dostawcy").
- **D7 — bez paginacji** (oryginał jej nie ma; retencja 7 dni trzyma listę małą).
- **D8 — HTML-escape** z automatu Reacta (oryginał wstrzykiwał `innerHTML` bez escape'owania —
  to nie odstępstwo funkcjonalne, tylko brak XSS).
- Odstępstw od zachowania oryginału: **brak** (D5 i D8 to warstwa prezentacji w stylu odbudowy).

## Implementation plan
1. **Nagrania** — scenariusz archiwum w `tools/record-write-fixtures.cjs` (upload przez
   `parse-file` surowym ciałem, `?dostawcaKod=&nazwa=`), GET-y listy (4 warianty + 401), stats,
   pobranie (200 + nagłówki, 400, 404). Uruchomienie, przegląd diffu fixtures.
2. **Kontrakt** — 3 ścieżki w `contract/openapi.yaml` (+ schematy), wpis w `contract/README.md`.
3. **BE** — funkcje odczytu w `import/archiwum.ts`; `routes/import-archive.ts`
   (`trasyArchiwumImportu({ katalogArchiwum })`); rejestracja w `app.ts` obok `trasyImportu`.
4. **Testy BE** — `test/archiwum-importow.gate.test.ts`: lista bez filtrów / dostawca / miesiąc /
   status, stats, pobranie (bajt w bajt + `Content-Disposition` + `Content-Type`), 404,
   traversal (400), 401, zgodność z fixtures i `openapi.yaml`. Pliki testowe tworzone
   `archiwizujBufor` w `srodowisko.katalogArchiwum`.
5. **FE** — `pages/ArchiwumImportow.tsx` + `pages/archiwum-importow/` (dane, tabela, pobieranie
   blobu obok `lib/api.ts`), wpis w `App.tsx` i `nawigacja.ts`, MSW handlery z fixtures.
6. **Testy FE** — lista, filtry (query string), pobranie (blob + nazwa), pusty stan, błąd
   serwera, błąd pobrania (toast), obecność w menu.
7. Bramki lint/typecheck/build/test obu stron.

## Testing strategy
GATE: odpowiedzi nowego BE dla list/stats porównane z nagraniami (kształt 1:1, wartości
deterministyczne: `ok`, `status`, `zrodlo`, `limitBajtow`, `retencjaDni`), walidacja względem
`openapi.yaml`; pobranie — treść bajt w bajt + nagłówki. Testy na prawdziwym systemie plików
w katalogu tymczasowym, bez mocków. FE przez MSW zasilane nagraniami.

## Out of scope
Zapis archiwum przy imporcie (3b), analityka, alerty, Selly, roadmapa,
`docs/przeglad-12-widokow.md` (PR.6), `docs/cutover.md` (ustalenie → „Do koordynatora").

## Definition of done
- [ ] 9 nagrań w `contract/fixtures/`, 3 ścieżki w `openapi.yaml`
- [ ] 3 trasy w BE, GATE zielony
- [ ] Widok `/archiwum` z menu, filtrami, paskiem zajętości, pobieraniem pod oryginalną nazwą
- [ ] Bramki BE i FE zielone (Node 20)
- [ ] `karta.md` PR.1 = stan, `PR.6/wejscie-91.md`, ustalenie cutover w „Do koordynatora"
