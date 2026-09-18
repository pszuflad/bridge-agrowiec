# 49-CHORE-i14a-wgrywanie-reczne — Code review

> Reviewed: 2026-09-18
> Branch: `chore/49-i14a-wgrywanie-reczne`
> Diff: 5 plików (2 kod, 1 testy, 2 docs), 4 commity (w tym merge `origin/develop`)

Bramki uruchomione w `rebuild/frontend/`: `npm run lint` ✓, `npm run typecheck` ✓,
`npm run build` ✓, `npm test` ✓ (48 plików / 758 testów, `konfiguracja.test.tsx` 21/21).

Wierność sedna karty sprawdzona linia po linii z oryginałem: pętla importu i sklejanie toasta
(`DialogWgrywania.tsx:152-231` vs `deminified/frontend-index.js:19130-19160`) zgadzają się
co do kolejności członów, separatora `" • "`, warunku `> 0` (nie `!= null`), członu „Pozycji
w plikach" bez warunku, sumowania i NIEwyświetlania `odrzuconeBrakDanych` oraz tytułu zależnego
od `doStagingu > 0`. Wymuszony dostawca nadpisywany jest PO analizie (`:127`, `wymusDostawce`
ma ten sam warunek `detekcja.kod === kod` co `:18868`), a pętla czyta `pozycja.analiza.detekcja.kod`,
nie props — nie ma ścieżki, w której plik poleci pod wykrytego zamiast wymuszonego dostawcę.
Warunek `disabled` (`:344`) = `:19161`, etykieta bez licznika (`:348`) = `:19171`.

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/konfiguracja/DialogWgrywania.tsx:213-216` — unieważnienia cache
      są w gałęzi sukcesu, więc po imporcie częściowo udanym (plik 1 OK, plik 2 rzuca → D7) nie
      wykonują się wcale.
  - Powód: oryginał unieważnia `/api/staging`, `/api/products`, `/api/suppliers` WEWNĄTRZ `sP()`,
    po każdym pliku (`:18838-18842`), więc pozycje już zapisane są widoczne mimo błędu następnego
    pliku. W porcie staging/katalog pokazują stan sprzed importu, choć wiersze są w bazie —
    rozjazd z oryginałem, którego plan nie zatwierdził (Krok 2 mówi „unieważnienia jak dziś").
  - Sugestia: unieważniać po każdym udanym `wgrajPlik()` albo przenieść bloki `invalidateQueries`
    do `finally`.
- [ ] `rebuild/frontend/src/pages/konfiguracja/DialogWgrywania.tsx:218` +
      `rebuild/frontend/src/pages/konfiguracja/Wgrywanie.tsx:104-115` — `onZaimportowano(wyniki)`
      też leci tylko przy pełnym sukcesie, a sekcja „Ostatni import" nie jest czyszczona na starcie
      importu.
  - Powód: po nieudanym imporcie pod kaflami wisi wynik POPRZEDNIEGO importu (inna nazwa pliku,
    inne liczby) obok toasta „Błąd importu" — czyta się jako wynik bieżącej próby. Sekcja jest
    naszym dodatkiem (D4), więc tu nie ma ograniczenia wierności i nie ma powodu, żeby mylić.
  - Sugestia: wyzerować wyniki na starcie `importuj()` albo oddać rodzicowi wyniki częściowe
    (zebrane do momentu błędu) razem z informacją, że import się urwał.
- [ ] `docs/rebuild-roadmap.md:2124-2205` — Krok 7 planu i ostatni punkt DoD nie zostały wykonane:
      podblok 14a dalej ma status „⬜ nie zaczęte", `:2169` wskazuje nieistniejące już
      `Wgrywanie.tsx:192` („Wgraj (0)"), a postawione tam pytanie „Etykieta akcji ma wariant
      »Importuj do katalogu« — ustalić, co go włącza" jest w tickecie rozstrzygnięte (martwa gałąź),
      ale roadmapa o tym nie wie.
  - Powód: CLAUDE.md pkt 1 — roadmapa jest wejściem następnej sesji i ma opisywać STAN; 14d czyta
    właśnie ten blok. Do tego `raport.md` („Odstępstwa od planu: Brak") nie odnotowuje pominięcia.
  - Uwaga: brief Mastera zawęził własność plików tej karty i `docs/rebuild-roadmap.md` się w niej
    NIE mieści (14b/14c idą równolegle na tym samym pliku) — decyzja, kto to dopisuje (14a czy
    scalająca sesja), należy do Mastera. Do rozstrzygnięcia przed merge, nie do przemilczenia.
- [ ] `rebuild/frontend/src/pages/konfiguracja/DialogWgrywania.tsx:258-270` — `<input type="file">`
      jest jednym trwałym węzłem DOM, a `value` czyszczone tylko w `wyczysc()` (`:109`).
  - Powód: ponowny wybór TEGO SAMEGO pliku (np. „Dodaj kolejny plik" po poprawieniu pliku na dysku,
    albo po błędzie importu, gdy D7 zostawia listę) nie generuje zdarzenia `change` — klik w dialog
    systemowy kończy się ciszą. Oryginał tego nie ma przy pierwszym dodaniu, bo renderuje DWA
    osobne inputy (`:18921` w strefie zrzutu, `:18959` w nagłówku listy) i węzeł się podmienia.
  - Sugestia: `e.target.value = ""` na końcu `onChange`.
- [ ] `rebuild/frontend/test/konfiguracja.test.tsx` — brak testu na człon `Pominięte pliki: N`
      (`DialogWgrywania.tsx:175-178, 201` = `:19136-19138`, `:19150`).
  - Powód: to jedyny licznik LICZONY PO STRONIE KLIENTA i jedyna gałąź `continue` w pętli.
    Odwrócenie warunku albo zgubienie członu przejdzie dziś przez cały pakiet niezauważone.
- [ ] `rebuild/frontend/test/konfiguracja.test.tsx:444-463` (test D7) — scenariusz błędu ma tylko
      JEDEN plik, więc nie dowodzi tego, co deklaruje.
  - Powód: „pętla urywa się na pierwszym błędzie" i „pliki po nim nie idą" nie są sprawdzone
    (`uploady` nie jest asertowane), tak samo jak zachowanie wyników/unieważnień po imporcie
    częściowym — czyli dokładnie miejsce, w którym siedzą dwa pierwsze wpisy tej listy.
  - Sugestia: dwa pliki (MO1 + drugi), błąd na pierwszym, asercja `uploady.length === 1`.
- [ ] `rebuild/frontend/src/pages/konfiguracja/DialogWgrywania.tsx:251-255` — opisy dialogu
      rozjeżdżają się ze stringami oryginału i z tekstem podyktowanym w planie (Krok 2): dla `multi`
      wypadło słowo „CSV" (oryginał `:18959`: „Wybierz dowolną liczbę plików CSV."), a wariant
      pojedynczy brzmi „Bridge sparsuje plik i zaimportuje pozycje do stagingu." zamiast
      „Bridge sparsuje CSV, rozpozna dostawcę i pokaże podgląd przed importem do staging."
      (`:18960`).
  - Powód: zmiany są sensowne (D6 — przyjmujemy XLSX; D2/D4 — nie ma podglądu przed importem), ale
    żadnej nie ma w tabeli świadomych odstępstw ani w raporcie. W tym repo niezapisany rozjazd
    tekstu jest błędem, bo następna sesja porówna string z bundlem i nie będzie wiedziała, czy to
    decyzja, czy literówka.
  - Sugestia: dopisać wiersz do tabeli odstępstw w `plan.md`/`raport.md` (albo przywrócić „CSV"
    tam, gdzie D6 tego nie wymusza).

## NICE-TO-HAVE

- [ ] `DialogWgrywania.tsx:124` — `id` z `Date.now()`: dwa pliki o tej samej nazwie i rozmiarze
      dodane w OSOBNYCH partiach w tej samej milisekundzie dają identyczny klucz, a wtedy `usun()`
      i `zmienDostawce()` trafiają w obie pozycje naraz. `crypto.randomUUID()` albo licznik w `useRef`
      zamyka temat.
- [ ] `DialogWgrywania.tsx:375, 386` — `data-testid="pozycja-{nazwaPliku}"` i `powod-detekcji`
      powtarzają się przy wielu plikach; `getByTestId("powod-detekcji")` przy dwóch plikach rzuci.
      Testy omijają to, używając jednego pliku.
- [ ] `Wgrywanie.tsx:110, 126` — `key={w.nazwaPliku}` i `data-testid="wynik-uploadu"` duplikują się
      przy imporcie wielu plików (ta sama nazwa z dwóch katalogów → ostrzeżenie Reacta o kluczach).
- [ ] `DialogWgrywania.tsx:97` — `useQuery(["/api/dostawcy"])` siedzi w KAŻDEJ z N+1 instancji
      dialogu. Zapytanie jest jedno (wspólny wpis cache), ale subskrypcji jest N+1 i każde
      unieważnienie przerenderowuje wszystkie kafle; lista mogłaby przyjść propsem z `Wgrywanie.tsx`.
- [ ] `DialogWgrywania.tsx:273-280` — strefa zrzutu zgubiła podświetlenie przy przeciąganiu
      (oryginał trzyma stan `h` i przełącza klasy `border-primary bg-accent`, `:18900-18907`,
      plus `onDragLeave`). Drobny rozjazd UI, nieopisany w tabeli odstępstw.
- [ ] `DialogWgrywania.tsx:142-146` — ręczny wybór z selecta ustawia `pewnosc: "wymuszona"` /
      „Wymuszone z UI (KOD)", a oryginał rozróżnia to od wymuszenia z kafla: `pewnosc: "ręczna"`,
      `powod: "Wybór użytkownika"` (`:19009-19013`). Rozjazd ISTNIEJĄCY od 3f-1 (karta go nie
      wprowadziła), ale nie ma go w żadnej tabeli odstępstw — warto dopisać albo domknąć.
- [ ] `wgrywanie.ts:52` — odpowiedź jest rzutowana bez walidacji; brak pola w ciele da w toaście
      `NaN` (oryginał zabezpieczał `|| 0` tylko `ilePrzeszlo`, `:18844`). Spina się z follow-upem
      z raportu o braku fixture dla `POST /api/dostawcy/{kod}/upload`.
- [ ] Toast pod modalem: `Toaster` ma `z-[100]` (widoczny nad dialogiem, OK), ale Radix w trybie
      modalnym `aria-hidden`uje rodzeństwo `DialogContent` — komunikaty „Błąd pliku …" i „Błąd
      importu", które z definicji pojawiają się przy OTWARTYM dialogu, mogą być niewidoczne dla
      czytników ekranu. Warto sprawdzić w przeglądarce (testy używają `getByTestId`, więc tego
      nie złapią).
- [ ] `DialogWgrywania.tsx:295` — „Parsowanie…" vs oryginalne „Parsowanie..." (znak wielokropka).
      Spójne z resztą odbudowy, zostawiam jako notkę.

## Plan compliance

### Done ✓
- Krok 1 — sposób wyboru kodu dostawcy potwierdzony w oryginale i odtworzony (`wymusDostawce`
  po analizie, pętla czyta `detekcja.kod`).
- Krok 2 — nowy `DialogWgrywania.tsx`: propsy bez `prostoDoKatalogu`/`buttonLabel`, `max-w-4xl
  max-h-[90vh] overflow-y-auto`, zamknięcie czyści listę (`:238-241` = `:18869`), tytuły obu
  wariantów 1:1, „Wczytane pliki (N)", „Dodaj kolejny plik", „Wyczyść" nie zamyka dialogu,
  toast „Błąd pliku …" (`destructive`) bez wpisania pliku na listę.
- Krok 3 — toast zbiorczy zgodny co do znaku z `:19142-19153`; `odrzuconeBrakDanych` sumowane,
  nigdy niewyświetlane, opatrzone komentarzem.
- Krok 4 — `Wgrywanie.tsx` na strukturze `JT()`: dwie karty, tytuł sekcji BEZ słowa „dostawcy",
  siatka `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`, kafle `upload-tile-{kod}`
  (kod · nazwa · e-mail), brak gałęzi dla pustej listy (D5), sekcja wyników z `wynik-uploadu`
  i podglądem 5 pozycji (D4). Usunięte: inline `input-pliki`, `bledy-wczytania`, `button-wyslij`
  z licznikiem, nieaktualny komentarz o braku Toastera.
- Krok 5 — `detekcja.ts` i `wgrywanie.ts` faktycznie nietknięte (potwierdzone `git diff --name-only`).
- Krok 6 — testy przepisane, pakiet zielony.
- Własność plików: zmienione wyłącznie `Wgrywanie.tsx`, nowy `DialogWgrywania.tsx` (ten sam
  katalog — dopuszczone), `test/konfiguracja.test.tsx`, `docs/tickets/49-*/**`. Nic z 14b/14c,
  nic z `contract/**` ani `rebuild/backend/**`. Martwego kodu po przenosinach nie ma —
  `ETYKIETY_PEWNOSCI`, `formatujRozmiar` i `PozycjaListy` przeniosły się, nie zduplikowały,
  a komentarze opisują stan, nie historię.

### Missing or deviating ✗
- **Krok 7 (docs) niewykonany** — `docs/rebuild-roadmap.md` nietknięty (patrz SHOULD-FIX #3).
  `raport.md` deklaruje „Odstępstwa od planu: Brak", co nie jest zgodne ze stanem.
- Opisy dialogu odbiegają od stringów podyktowanych w Kroku 2 bez wpisu do tabeli odstępstw
  (SHOULD-FIX #7).
- Strategia testów pkt 4 („przypadek z zerami i przypadek pełny") dowieziona, ale bez przypadku
  z `Pominięte pliki` i bez przypadku wielopilkowego dla D7 (SHOULD-FIX #5, #6).

### Definition of done
- [x] Wgrywanie zbiorcze jest modalem za `button-multi-upload`; inline'owy `input-pliki` zniknął.
- [x] Sekcja „Wgrywanie pojedyncze (z wymuszonym dostawcą)" z kaflami dla wszystkich dostawców.
- [x] Kafel otwiera ten sam dialog z wymuszonym dostawcą i wgrywa pod jego kod (test
      „kafel wgrywa pod WYMUSZONEGO dostawcę" — plik o nazwie MO1 idzie na `/api/dostawcy/MO3/upload`).
- [x] Toast po imporcie zgodny z tabelą Kroku 3; toasty „Błąd pliku …" i „Błąd importu" `destructive`.
- [x] Przycisk to „Importuj do staging" bez licznika; „Wgraj (0)" występuje wyłącznie w komentarzu
      opisującym naprawioną regresję.
- [x] Po udanym imporcie dialog zamknięty, lista wyczyszczona, wynik + podgląd pod kaflami.
- [x] Po błędzie importu dialog otwarty, lista zachowana (D7) — z zastrzeżeniem SHOULD-FIX #1/#2
      dotyczącym tego, co się przy tym NIE dzieje (cache, sekcja wyników).
- [x] Bramki FE zielone (zweryfikowane samodzielnie).
- [x] Żaden plik spoza własności karty nie zmieniony.
- [ ] Podblok 14a w `docs/rebuild-roadmap.md` opisuje STAN — **niespełnione**, roadmapa nietknięta.

## Parallel-test concerns

Brak — testy są jsdom + MSW, bez portów, plików tymczasowych i wspólnej bazy. `queryClient.clear()`
i `sessionStorage.clear()` w `beforeEach` działają na singletonach w obrębie procesu vitest, więc
równoległe okna sobie nie przeszkadzają. Uwaga niezależna od tej karty: `button-wyslij` jako
`data-testid` żyje dalej w `src/pages/selly/SekcjaSync.tsx` — inny widok, kolizji nie ma.

## Overall assessment

Solidna, wierna robota: sedno karty (pętla importu i sklejanie toasta) jest odtworzone znak
w znak z `:19130-19160`, wymuszenie dostawcy idzie tą samą ścieżką co w oryginale, a martwa gałąź
„Importuj do katalogu" została rozstrzygnięta dowodem z grafu wywołań, nie zgadywaniem. Kierunek
i struktura plików nie budzą zastrzeżeń. Dwie realne dziury są w ścieżce BŁĘDU, którą karta sama
wprowadziła decyzją D7: po imporcie częściowo udanym nie ma unieważnień cache (oryginał robi je
per plik) i pod kaflami zostaje wynik poprzedniego importu — obie rzeczy pokazują Ani nieprawdę
o stanie danych, a żaden test nie odpala tego scenariusza. Poza tym do domknięcia zostaje Krok 7
(roadmapa) i dopisanie dwóch rozjazdów tekstowych do tabeli odstępstw.
