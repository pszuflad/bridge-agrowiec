# Bridge — zasady stałe dla każdej sesji

Ten projekt to **wierna odbudowa** działającej produkcji („Bridge dla Agrowca") w nowym stosie
w `rebuild/`. Domyślna reguła: odtwarzasz udokumentowane zachowanie 1:1, nie wymyślasz nowego.
Każde odstępstwo musi być świadomą decyzją użytkownika. Pełny kontekst i kolejność źródeł
prawdy: `.claude/commands/feature.md`, sekcja „Kontekst odbudowy".

Praca idzie iteracjami i blokami (I3 → 3a, 3b, 3c…), opisanymi w `docs/rebuild-roadmap.md` §5.

---

## Roadmapa jest wejściem dla następnej sesji — utrzymuj ją na bieżąco

`docs/rebuild-roadmap.md` czyta następna sesja. Prompt, którym ją uruchamiasz, jest
jednorazowy — **roadmapa zostaje**. Z tego wynika pięć obowiązków:

**1. Po każdym zamkniętym bloku roadmapa opisuje STAN, nie zamiar.**
Blok oznaczony jako zrobiony (data + ID ticketa), gate rozliczony, zakres faktycznie dowieziony
zamiast planowanego. Dotyczy też `docs/rebuild-backlog.md` — statusy wpisów aktualizuje ta
sesja, która je realizuje, nie następna.

**2. Ustalenie dotyczące PRZYSZŁEGO bloku wpisz DO TEGO BLOKU.**
Nie do bloku właśnie zamkniętego. Sesja 3c czyta blok 3c; nota schowana w bloku 3b do niej nie
dojdzie. To realnie się stało w 3b: konsekwencje dla 3c/3d/3e wylądowały w opisie 3b i trzeba
było je potem przenosić.

**3. Przypisanie funkcji do sesji weryfikuj GRAFEM WYWOŁAŃ, nie nazwą.**
Zanim zaczniesz blok, sprawdź `grep`em, kto naprawdę woła funkcje z jego zakresu, i popraw
roadmapę, jeśli się rozjeżdża. Dwa razy przypisała `bridge_ext.cjs` do złej sesji — raz do 3a
(wykryte w 3a), raz do 3c (wykryte przy planowaniu 3c) — bo zakres pisano z nazw funkcji,
a nie z tego, gdzie są wywoływane. Ta sama nieufność dotyczy kształtu API: w I11 roadmapa
dwukrotnie opisała endpoint niezgodnie ze stanem faktycznym (`PUT /api/config` zamiast
realnego `POST /api/config` z ciałem `{klucz, wartosc}`, i pominięcie istniejącego
`POST /api/spedycja`) — metodę i kształt ciała sprawdzaj w `contract/openapi.yaml` i w
oryginale, zanim uwierzysz roadmapie.

**4. Prompt nie koryguje roadmapy — roadmapa koryguje siebie.**
Jeśli piszesz prompt do kolejnej sesji i musisz w nim zaprzeczyć roadmapie, to znak, że
najpierw trzeba poprawić roadmapę. Prompt ma pytać o decyzje, nie o fakty już ustalone.
Rozdzielaj przy tym dwie rzeczy: **fakt** (np. graf wywołań) zapisujesz jako fakt, a **zmianę
przypisania zakresu** traktujesz jako decyzję użytkownika i zapisujesz osobno.

**5. Uważaj na duplikaty definicji w zdeminifikowanym oryginale.**
`deminified/backend-index.cjs` ma funkcje zdefiniowane po dwa razy, gdzie wygrywa PÓŹNIEJSZA:
`tk` (:47378 martwe / :47584 żywe), `Lq` (:46965 licznik cyfr / :47312 generator identyfikatora).
Duplikaty są **fizycznie w wysłanym bundlu** `mirror/backend/index.cjs`, nie artefaktem naszej
deminifikacji — esbuild przy kolizji nazw by je przemianował, więc biorą się z łatek
`patch_*.cjs` doklejanych do `index.cjs` po buildzie (w `mirror/backend/` jest ich kilkanaście;
kolejna łatka Ani może dołożyć następny przypadek). Żeby wykryć: policz wystąpienia
`function <nazwa>(` w `mirror/backend/index.cjs`, nie ufaj numerowi linii w deminifikacie.
**Cieniowanie sięga dalej niż sama funkcja** — sprawdź też, KTO WOŁA zacienioną nazwę w innym
miejscu: `ZT()` (:46971) woła `Lq(i)` licząc na licznik cyfr z :46965, a trafia w generator sha1
z :47312, bo obie deklaracje `Lq` są w tym samym zakresie; efekt widoczny w produkcji: komunikat
„zapis naukowy ma tylko null cyfr znaczących". Szczegóły: `docs/rebuild-backlog.md` #11.

Ta sama nieufność dotyczy pustych odpowiedzi: `safeAll()` w module analityki zamienia błąd SQL
(np. odwołanie do nieistniejącej kolumny) w pustą listę, więc zepsuta trasa wygląda identycznie
jak trasa bez danych — nie ufaj `rows: []`, sprawdź, czy dane w bazie faktycznie są. Przykład:
`docs/rebuild-backlog.md` #32 (`historia_cen` bez kolumny `nazwa`). Ta sama pułapka ma też
postać pliku: `GET /api/analytics/export/{view}` dla `availability-products` i `sell-through`
oddaje sam BOM (pusty CSV) zamiast `rows: []`, mimo danych w bazie — nie ufaj też pustemu
plikowi eksportu.

---

## Środowisko

- Backend wymaga **Node ≥ 20** (`better-sqlite3`). Domyślny `node` na maszynie deweloperskiej to
  v14 — przed pracą: `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.
- Bramki backendu: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`
  w `rebuild/backend/`.
- Zakładaj, że projekt może być uruchomiony i że równolegle pracuje ktoś inny — testy używają
  bazy w katalogu tymczasowym i portów efemerycznych, i tak ma zostać.
