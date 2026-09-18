# 49-CHORE-i14a-wgrywanie-reczne — zakładka „Wgrywanie ręczne" wraca do kształtu oryginału

> Status: Draft
> Branch: `chore/49-i14a-wgrywanie-reczne`
> Worktree: `.worktrees/49-CHORE-i14a-wgrywanie-reczne`

## Opis ticketa

Karta **14a** Iteracji 14 (roadmapa `docs/rebuild-roadmap.md`, blok „Iteracja 14"). Źródło:
uwagi Ani z testów Iteracji 3. Odbudowa nie przeniosła z oryginału czterech rzeczy z warstwy UI
zakładki Konfiguracja → „Wgrywanie ręczne":

1. wgrywanie zbiorcze jest inline'em, a w oryginale jest MODALEM za przyciskiem „Wgraj pliki";
2. brak całej sekcji „Wgrywanie pojedyncze (z wymuszonym dostawcą)" — siatki kafli `upload-tile-{kod}`;
3. brak toasta po imporcie (i po błędzie wczytania pliku) — dziś komunikat inline;
4. przycisk po udanym wgraniu pokazuje „Wgraj (0)", bo licznik liczy pozycje JESZCZE niewysłane.

Karta jest czysto frontendowa. Własność plików rozłączna z 14b/14c (roadmapa, tabela własności).

## Kontekst

Zakładka żyje w `rebuild/frontend/src/pages/konfiguracja/Wgrywanie.tsx` (318 linii, powstała w 3f-1).
Oryginał to `JT({suppliers})` (`deminified/frontend-index.js:26147-26200`) + współdzielony dialog
`Cd({trigger, dostawcaKod, multi, prostoDoKatalogu, buttonLabel})` (`:18850-19180`).

**Żywy bundel = deminifikat dla tej zakładki.** Zweryfikowane: bloki `JT` i `Cd` w
`mirror/frontend/assets/index-PRICEFMT1783512500.js` (ścieżka z `mirror/frontend/index.html`) są
znak w znak zgodne z deminifikatem; liczniki stringów („Wgraj wiele plików", „Wgrywanie pojedyncze",
„Importuj do staging", „button-multi-upload", „upload-tile-", „Pominięte pliki" …) identyczne w obu
plikach. Żadna z czterech łatek FE (`konstr`, `tr_fix`, `ackalerts`, `szer_marka`) tej zakładki
nie dotyka. To zdejmuje ostrzeżenie z roadmapy o bundlu z 13.08 — dla tej konkretnej zakładki
numery linii z deminifikatu są wiążące.

**Rozstrzygnięta zagadka „Importuj do katalogu" (`:19171`).** To MARTWA GAŁĄŹ. `prostoDoKatalogu`
i `buttonLabel` to propsy `Cd`, a `Cd` ma w całym bundlu dokładnie dwa miejsca użycia: `:26157`
(`{multi:true, trigger}`) i `:26190` (`{dostawcaKod, trigger}`) — żadne ich nie przekazuje
(`grep "prostoDoKatalogu\|buttonLabel"` → tylko `:18854`, `:18855`, czyli sama deklaracja).
`prostoDoKatalogu` domyślnie `false`, więc etykieta zawsze brzmi **„Importuj do staging"**, a trzeci
argument `sP(e,t,n)` nie jest w ciele funkcji nawet czytany. **Wariantu nie portujemy.**

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ticket nie dotyka kontraktu — GATE ODBUDOWY N/D.** Zmiany są wyłącznie w warstwie widoku
`rebuild/frontend/`; żaden plik `contract/**` ani `rebuild/backend/**` nie jest ruszany, nie
powstaje ani nie zmienia się żadne wywołanie API.

Używane (bez zmian) endpointy:
- `POST /api/dostawcy/{kod}/upload` — `contract/openapi.yaml:19314-19328`. **Fixture nie istnieje**
  (przeszukane 74 pliki `contract/fixtures/` — brak `POST_dostawcy*`/`*upload*`), bo multipartu nie
  dało się nagrać; kontrakt deklaruje `200` bez schematu. Kształt odpowiedzi jest wiążąco znany
  z kodu: oryginał `backend-index.cjs:48277-48281` (spread `tk()` `:47584-47597`) ≡ port
  `rebuild/backend/src/routes/suppliers.ts:213-221` ≡ typ `WynikUploadu` (`wgrywanie.ts:8-23`).
  Klient `wgrajPlik()` zostaje nietknięty.
- `GET /api/dostawcy` — fixture `contract/fixtures/GET_dostawcy.json` (identyczny z
  `GET_suppliers.json`, którego używa oryginał). Kafle potrzebują `kod`, `nazwa`, `email` — wszystkie
  są w fixture. Zapytanie już jest w `Wgrywanie.tsx:59`, nie zmieniamy go.

Gdyby w trakcie okazało się, że trzeba ruszyć `contract/` — STOP i pytanie do użytkownika
(fixtures są wspólne dla BE i FE, nauka z 13c).

## Decyzje

Podjęte wcześniej, wiążące (z treści karty):
- **D1. Toast wchodzi, komunikat inline znika.** `ToastProvider` stoi w `App.tsx` od sesji 4b —
  komentarz „nie mamy jeszcze Toastera" w `Wgrywanie.tsx:79-81` jest nieaktualny i znika razem z kodem.
- **D2. Podgląd 5 pozycji dalej z ODPOWIEDZI backendu**, nie z parsowania w przeglądarce
  (decyzja 3f-1, uzasadnienie w `detekcja.ts:309-318`, `:334-345`). Nie odtwarzamy przedimportowej
  tabeli 8 pozycji / 12 kolumn, którą oryginał buduje z `oP()`.
- **D3. Endpointy, limit 50 MB, obsługa CSV+XLSX — bez zmian.**

Podjęte w tej sesji (Q&A):
- **D4. Podgląd ląduje POD kaflami, po zamknięciu dialogu.** Dialog zachowuje się 1:1 z oryginałem
  (po udanym imporcie zamyka się i czyści listę — `i(!1)` + `w()`, `:19154-19155`), a wynik per plik
  wraz z podglądem 5 pozycji renderuje sekcja zakładki pod kartami. *Za:* zachowuje zdobycz 3f-1
  i to, co instrukcja testów I3 §2 obiecuje Ani, nie łamiąc zachowania dialogu. *Przeciw:* element,
  którego oryginał nie ma — **świadome odstępstwo**.
- **D5. Kafle 1:1 — wszyscy dostawcy, w tym wyłączeni z importu.** Oryginał renderuje całą listę bez
  filtrowania i sortowania (`e.map`, brak gałęzi `length===0`). Próba wgrania do MO6 kończy się
  toastem z komunikatem backendu („Dostawca MO6 jest wyłączony z importu", `suppliers.ts:151`).
  *Za:* wierne, backend i tak broni, front nie dubluje reguły, której dziś nie zna.
- **D6. Tekst strefy wyboru pliku dopasowany do realnego zachowania** — „CSV i XLSX (separator ; lub ,)
  — do 50 MB każdy" zamiast oryginalnego „CSV (separator ; lub ,) — do 10 MB każdy". **Świadome
  odstępstwo:** oryginalny string kłamałby o dwóch rzeczach naraz, bo rebuild przyjmuje XLSX i 50 MB
  (D3). Z tego samego powodu `accept` zostaje `.csv,.txt,.xlsx,.xls`, a nie oryginalne `.csv,text/csv`.
- **D7. Błąd importu 1:1 z oryginałem** (`:19156-19159`): pętla urywa się na pierwszym błędzie,
  toast „Błąd importu" (`variant: destructive`), dialog **zostaje otwarty**, lista **nie jest
  czyszczona**. *Za:* wierne i czytelne — Ania widzi, na czym stanęło.

Świadome odstępstwa od oryginału (komplet, do wpisania w komentarzach kodu):
| # | Odstępstwo | Powód |
|---|---|---|
| D2 | brak przedimportowej tabeli podglądu 8 poz./12 kol. | nie parsujemy w przeglądarce (3f-1) |
| D4 | wynik + podgląd 5 poz. pod kaflami, poza dialogiem | konsekwencja D2, zachowuje wartość dla Ani |
| D6 | „CSV i XLSX … do 50 MB", `accept` z XLSX | rebuild realnie przyjmuje XLSX i 50 MB (D3) |
| — | select dostawcy z `/api/dostawcy`, nie zahardkodowane `MO1…MO10` (`:19017`) | odstępstwo ISTNIEJĄCE z 3f-1, zostaje |
| — | brak klienckiego wpisu do dziennika `qb()` (`:10275-10288`) | proteza oryginału nadpisująca cache `/api/history`; rebuild ma dziennik z backendu |

## Plan implementacji

**Krok 1 — weryfikacja jednego szczegółu w bundlu (przed kodem).**
Ustalić, jak `Cd` wybiera kod dostawcy przy `dostawcaKod` (czy select pliku jest ukryty/zablokowany,
czy `sP()` dostaje `dostawcaKod` zamiast `detekcja.kodDostawcy`) — odczytać `:19100-19150` i `:18821`.
Karta mówi „wymuszony dostawca, bez auto-detekcji"; potwierdzić to w kodzie, nie zgadywać.

**Krok 2 — nowy plik `src/pages/konfiguracja/DialogWgrywania.tsx`** (port `Cd()`).
Propsy: `{ trigger: ReactNode; dostawcaKod?: string; multi?: boolean; onZaimportowano(wyniki): void }`.
Bez `prostoDoKatalogu`/`buttonLabel` (martwa gałąź). Zawartość:
- `Dialog`/`DialogTrigger`/`DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"` z
  `@/components/ui/dialog`; zamknięcie czyści listę (`w()`, `:18869`, `:18880`).
- Tytuł: `multi` → „Wgraj wiele plików — auto-detekcja dostawcy"; inaczej „Wczytaj plik cennika"
  + `— {dostawcaKod}` (`:18957`).
- Opis: `multi` → „Wybierz dowolną liczbę plików CSV. Bridge sam rozpozna dostawcę i sparsuje
  rozmiary opon."; inaczej wariant z „…przed importem do staging" (dostosowany do D2/D4).
- Strefa wyboru pliku przy pustej liście: „Przeciągnij plik(i) tutaj", tekst pomocniczy wg **D6**,
  przycisk „Wybierz plik(i) z dysku" / „Parsowanie…".
- Lista plików: `<h4>Wczytane pliki ({n})</h4>` + „Dodaj kolejny plik"; per plik nazwa, badge
  `{kod} · {pewnosc}` albo „Nie rozpoznano", powód, metryki, select dostawcy (przy `dostawcaKod`
  wymuszony wg ustaleń z Kroku 1), przycisk usunięcia.
- Stopka przy `n>0`: „Wyczyść" (`variant outline`, czyści listę, **nie zamyka dialogu**) +
  przycisk akcji „Importuj do staging", `disabled = wysyłanie || kolejka.every(p => !p.detekcja.kod)`
  — **bez licznika w etykiecie** (to jest naprawa punktu 4 karty; oryginał licznika nie ma, `:19171`).
- Błąd wczytania pliku → `toast({title: `Błąd pliku ${plik.name}`, description, variant:"destructive"})`
  (`:18876`); plik nie trafia na listę, pozostałe wczytują się normalnie.
- Import: pętla po plikach; brak kodu → `pominietePliki++` i `continue`; inaczej `wgrajPlik()`
  i akumulacja liczników. Po sukcesie: toast zbiorczy (Krok 3), `onZaimportowano(wyniki)`,
  zamknięcie dialogu, wyczyszczenie listy. Po błędzie: **D7**.
- Unieważnienia jak dziś (`/api/staging`, `/api/products`, `/api/dostawcy`, `/api/suppliers`).

**Krok 3 — toast zbiorczy** (`:19133-19160`), jeden po całej pętli, nie per plik.
Tytuł: `doStagingu > 0 ? `${doStagingu} pozycji czeka na akceptację` : "Import zakończony"`.
Opis: człony sklejone separatorem **`" • "`**, w tej kolejności, pomijane gdy wartość `> 0` nie zachodzi
(warunek to wyłącznie `> 0`, nie `!= null`):

| człon | warunek | źródło |
|---|---|---|
| `Pozycji w plikach: N` | **zawsze** | Σ `liczbaProduktow` |
| `Do akceptacji w stagingu: N` | `> 0` | Σ `doStagingu` |
| `Nowe: N` | `> 0` | Σ `nowe` |
| `Zmienione: N` | `> 0` | Σ `zmienione` |
| `Wycofane: N` | `> 0` | Σ `wycofane` |
| `Bez zmian: N` | `> 0` | Σ `bezZmian` |
| `Odrzucone (nie opony): N` | `> 0` | Σ `odrzuconeNieOpony` |
| `Pominięte pliki: N` | `> 0` | licznik kliencki (pliki bez rozpoznanego dostawcy) |

⚠ `odrzuconeBrakDanych` oryginał sumuje, ale **nigdy nie wyświetla** — odtwarzamy to zachowanie
(sumujemy, nie pokazujemy) i opisujemy komentarzem, żeby nikt tego „nie naprawił".
Wariant toastu: domyślny. Czas życia: `CZAS_ZYCIA_MS = 5000` z `toast.tsx:34`.

**Krok 4 — przepisanie `Wgrywanie.tsx`** na strukturę `JT()` (`:26147-26200`): `div.space-y-4`,
dwie karty.
- Karta 1 — „Wgraj wiele plików — auto-detekcja" (⚠ **bez słowa „dostawcy"** — ono jest dopiero
  w tytule dialogu; przepisujemy string z bundla 1:1) + opis „Bridge sam rozpozna dostawcę po nazwie
  pliku i nagłówkach, sparsuje rozmiar opony i pola techniczne. Wgrywaj dowolną liczbę plików naraz.
  Pozycje trafiają do stagingu — po zatwierdzeniu pojawiają się w katalogu." Treść: `DialogWgrywania`
  z `multi` i triggerem `<Button data-testid="button-multi-upload">Wgraj pliki</Button>`.
- Karta 2 — „Wgrywanie pojedyncze (z wymuszonym dostawcą)" + opis „Użyj gdy auto-detekcja się myli
  — wybierz dostawcę ręcznie i wgraj jego plik CSV." Siatka
  `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`, kafel `data-testid="upload-tile-{kod}"`:
  `{kod}` (mono, semibold) · `{nazwa}` · `{email}` (mono, xs, truncate) · `DialogWgrywania`
  z `dostawcaKod={kod}` i triggerem `<Button variant="outline" size="sm">Wgraj plik</Button>`.
  **Lista pusta → pusta siatka, żadnego komunikatu** (1:1: oryginał ma tylko `map`).
- Sekcja wyników pod kaflami (**D4**) — zachowuje dzisiejszy `data-testid="wynik-uploadu"` i tabelkę
  podglądu 5 pozycji (Kod · Nazwa · Rozmiar · Cena zakupu · Stan) z `wynik.podglad`.
- Usuwane: `input-pliki` inline, `bledy-wczytania`, `button-wyslij` z licznikiem `doWyslania`,
  `Wyczyść listę`, komponent `PozycjaListy` (przenosi się do dialogu), nieaktualny komentarz `:79-81`.

**Krok 5 — `detekcja.ts` / `wgrywanie.ts`:** zmiany nieoczekiwane. `przeanalizujPlik`,
`wymusDostawce`, `wgrajPlik` i typ `WynikUploadu` pokrywają potrzeby dialogu. Jeśli okaże się inaczej —
zmiana idzie z komentarzem i trafia do raportu.

**Krok 6 — testy** (`test/konfiguracja.test.tsx`, Krok 7 niżej).

**Krok 7 — docs:** podblok „14a" w `docs/rebuild-roadmap.md` (blok „Iteracja 14" ISTNIEJE,
`:2124-2205`) — oznaczenie jako zrobiony (data + ID ticketa) i opis zakresu FAKTYCZNIE dowiezionego,
w tym rozstrzygnięcia „Importuj do katalogu" i ustaleń D4–D7. **Tablica postępu §4 — NIE ruszać**
(wiersz iteracji zakłada 14d).

Kolejność commitów: (1) dialog + toast, (2) sekcja z kaflami + wynik pod kaflami, (3) testy, (4) docs.

## Strategia testów

GATE odbudowy N/D (brak styku z kontraktem — uzasadnienie wyżej). Weryfikacja idzie testami
komponentowymi w `rebuild/frontend/test/konfiguracja.test.tsx` (MSW, bez nowych mocków — istniejący
handler uploadu `:68-92` działa, bo `userEvent.upload` + MSW przechwytuje `FormData`):

1. **Sekcja 1:1** — po wejściu na zakładkę widać `button-multi-upload` i kafle `upload-tile-{kod}`
   dla każdego dostawcy z fixture (w tym wyłączonego z importu — D5), a w kaflu kod, nazwa i e-mail.
2. **Modal** — klik „Wgraj pliki" otwiera dialog z tytułem „Wgraj wiele plików — auto-detekcja
   dostawcy"; zakładka nie ma już inline'owego `input-pliki`.
3. **Wymuszony dostawca** — klik „Wgraj plik" w kaflu otwiera dialog z tytułem zawierającym kod
   dostawcy i wgrywa pod ten kod, bez auto-detekcji.
4. **Toast po imporcie** — sklejenie opisu: przypadek z zerami (człony pomijane) i przypadek pełny;
   tytuł w obu wariantach (`doStagingu > 0` i `== 0`). To jest sedno punktu 3 karty.
5. **Toast błędu wczytania** — plik odrzucony przez `przeanalizujPlik` daje toast „Błąd pliku …"
   (`destructive`) i nie trafia na listę; nie ma już `bledy-wczytania`.
6. **Punkt 4 karty** — przycisk akcji ma etykietę „Importuj do staging" **bez licznika** i jest
   wyłączony dokładnie wtedy, gdy żaden plik nie ma rozpoznanego dostawcy. Test wprost pilnuje, żeby
   „Wgraj (0)" nie wróciło.
7. **Zachowanie po imporcie** — dialog zamknięty, lista wyczyszczona, wynik + podgląd 5 pozycji
   widoczny pod kaflami (D4).
8. **Błąd importu (D7)** — dialog zostaje otwarty, lista niewyczyszczona, toast „Błąd importu".

Pomijamy: testy `detekcja.ts` (są w `konfiguracja.detekcja.test.ts`, nieruszane) i testy multipartu
na żywym backendzie (`fetch` z `FormData` nie działa w jsdom — takie testy żyją w
`test/integracja/`, poza własnością tej karty).

Bramki: `npm run lint && npm run typecheck && npm run build && npm test` w `rebuild/frontend/`.
Bramki backendu N/D.

## Poza zakresem

- `Staging.tsx`, `src/pages/staging/**`, `test/staging.test.tsx` — karta **14b**.
- `Dostawcy.tsx`, `DialogKonfiguracjiDostawcy.tsx`, `test/konfiguracja.dostawcy.test.tsx`,
  `test/konfiguracja.admin.test.tsx` — karta **14c** (w tym przycisk „Wgraj plik" na karcie dostawcy,
  który w oryginale ma WŁASNY, samodzielny upload, nie ten dialog).
- Aktualizacja `docs/instrukcja-testow-I3.md` — karta **14d**, idzie po 14a/14b/14c.
- `rebuild/backend/**`, `contract/**` — nietykane.
- Przedimportowa tabela podglądu z parsowania w przeglądarce (D2) i wariant „Importuj do katalogu"
  (martwa gałąź).
- Kliencki wpis do dziennika `qb()` — proteza oryginału, rebuild jej nie potrzebuje.

## Definition of done

- [ ] Wgrywanie zbiorcze jest modalem za `button-multi-upload`; inline'owy `input-pliki` zniknął.
- [ ] Sekcja „Wgrywanie pojedyncze (z wymuszonym dostawcą)" renderuje kafle `upload-tile-{kod}`
      (kod · nazwa · e-mail · „Wgraj plik") dla wszystkich dostawców, z opisem 1:1 z oryginału.
- [ ] Kafel otwiera ten sam dialog z wymuszonym dostawcą i wgrywa pod jego kod.
- [ ] Toast po imporcie: tytuł i sklejenie członów separatorem `" • "` zgodne z tabelą w Kroku 3,
      z pomijaniem zer; toast „Błąd pliku …" i „Błąd importu" (`destructive`).
- [ ] Przycisk akcji to „Importuj do staging" bez licznika — „Wgraj (0)" nie występuje w kodzie.
- [ ] Po udanym imporcie dialog zamknięty, lista wyczyszczona, wynik + podgląd 5 pozycji pod kaflami.
- [ ] Po błędzie importu dialog otwarty, lista zachowana (D7).
- [ ] `npm run lint && npm run typecheck && npm run build && npm test` w `rebuild/frontend/` — zielone.
- [ ] Żaden plik spoza własności karty nie zmieniony (`git diff --name-only` w raporcie).
- [ ] Podblok 14a w `docs/rebuild-roadmap.md` opisuje STAN, nie zamiar; tablica §4 nietknięta.
