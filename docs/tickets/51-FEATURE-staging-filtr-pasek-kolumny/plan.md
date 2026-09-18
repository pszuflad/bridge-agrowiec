# 51-FEATURE-staging-filtr-pasek-kolumny — Staging: domyślny filtr, pasek narzędzi, konfigurator kolumn

> Status: Implemented
> Branch: `feature/51-staging-filtr-pasek-kolumny`
> Worktree: `.worktrees/51-FEATURE-staging-filtr-pasek-kolumny`
> Karta **14b** Iteracji 14 (`docs/rebuild-roadmap.md` §5, blok „Iteracja 14").

## Opis ticketa

14b — Staging: domyślny filtr, pasek narzędzi, konfigurator kolumn. Źródło: uwagi Ani
z testów Iteracji 3. Cztery pozycje:

1. **Zły filtr domyślny** — oryginał startuje z `useState("nowa")` („Nowe produkty"),
   odbudowa z `useState("all")`.
2. **Brak konfiguratora kolumn („Kolumny")** — w oryginale skrypt doklejony do DOM-u,
   do wchłonięcia jako komponent React w `pages/staging/`.
3. **Placeholder szukajki** zaniża jej możliwości (backend szuka po czterech polach).
4. **Układ paska akcji** — szukajka, filtr, licznik i przyciski w innych miejscach niż
   w oryginale.

**Własność plików (karty 14a/14b/14c idą równolegle):** wolno zmieniać wyłącznie
`rebuild/frontend/src/pages/Staging.tsx`, `rebuild/frontend/src/pages/staging/**`,
`rebuild/frontend/test/staging.test.tsx`, `docs/tickets/51-*/**` oraz podblok 14b
w `docs/rebuild-roadmap.md`. NIE wolno dotykać `pages/konfiguracja/**`,
`pages/katalog/**`, `rebuild/backend/**`, `contract/**`.

## Kontekst

### Co mówi oryginał (zweryfikowane, nie z nazw)

Komponent widoku to `JP` w `deminified/frontend-index.js:20616-20946`. Enhancer kolumn to
osobny blok `/* === STAGING COLUMN VISIBILITY ENHANCER V2 === */`, `:28801-29360`.

**Deminifikat jest tu WIARYGODNY.** Jest wprawdzie bundlem z 13.08, sprzed czterech łatek
FE Ani, ale `STAGING_COLS` i `POS_KEYS` w ŻYWYM bundlu
(`main:mirror/frontend/assets/index-PRICEFMT1783512500.js`, ścieżka z `mirror/frontend/index.html`)
są z nim **bajt w bajt identyczne** — żadna z czterech łatek tego enhancera nie tknęła.
Obecność potwierdzona: `bridge-staging-cols-btn` ×3, `bridge_staging_cols_v2` ×1,
`STAGING_COLS` ×8, `POS_KEYS` ×5.

### ⚠ Trzy fakty, których opis karty nie miał — wykryte rozpoznaniem

**F1. `data-testid` w oryginale są semantycznie ZAMIENIONE względem odbudowy.**

| przycisk w oryginale | miejsce | `data-testid` w oryginale | `data-testid` w odbudowie |
|---|---|---|---|
| Akceptuj wszystkie (N) | nagłówek | `button-accept-selected` | `button-accept-all` |
| Odrzuć wszystkie (N) | nagłówek | `button-reject-selected` | `button-reject-all` |
| Akceptuj widoczne | pasek | `button-accept-all` | `button-accept-selected` |
| Odrzuć widoczne | pasek | `button-reject-all` | `button-reject-selected` |
| Akceptuj zaznaczone (N) | pasek | `button-accept-checked` | `button-accept-checked` |
| Odrzuć zaznaczone (N) | pasek | `button-reject-checked` | `button-reject-checked` |

**Skutek dla pkt 2:** enhancer wstrzykuje przycisk „Kolumny" przed
`button[data-testid="button-accept-all"]` (`:29317-29331`), co w oryginale oznacza
**„Akceptuj widoczne" w pasku narzędzi**, a nie „Akceptuj wszystkie" w nagłówku.
Opis karty („wstrzykuje przycisk przed button-accept-all") jest literalnie prawdziwy,
ale prowadzi do złego miejsca, jeśli czytać nazwę semantycznie. To ten sam rodzaj pułapki,
co `.bak_szer_marka` z I13 — etykieta ≠ treść.

**F2. Kolejność kolumn tabeli rozjeżdża się z oryginałem.**
Oryginał (`:20795-20826`, potwierdzone `STAGING_COLS`/`POS_KEYS` w żywym bundlu):
`checkbox · Typ · Kod · Nazwa · Dostawca · Magazyn · Stan · Cena zakupu · Cena sprzedaży ·
Zmiana · Powód · Akcje`.
Odbudowa (`TabelaStagingu.tsx:83-102`) ma `Magazyn` dopiero na 9. pozycji, za `Cena sprzedaży`,
a nagłówek `Powód / co sprawdzić` zamiast `Powód`. Konfigurator mapuje kolumny POZYCYJNIE
(`POS_KEYS`), więc to nie jest wyłącznie kosmetyka.

**F3. Oryginał NIE pyta o potwierdzenie przed „Akceptuj/Odrzuć wszystkie".**
`kbAll()`/`vbAll()` (`:9134`, `:9141`) idą prosto do API; `onClick` woła `mutate` bez
`confirm()`. Odbudowa ma tu `DialogPotwierdzenia`. To zastane odstępstwo z 12e (D5,
backlog #51) — **poza zakresem tej karty**, trafia do Follow-up.

### Sprostowanie referencji z opisu karty i roadmapy

`docs/instrukcja-testow-I3.md` **nie ma §9** — kończy się na §8. Odwołania „§6, §9.1" (źródło
zadania) i „§9.3" (odstępstwo o resecie strony) nie mają pokrycia. Realne miejsca:
- reset strony przy zmianie rozmiaru — **§3.3, linia 95** („to celowe — inaczej łatwo
  wylądować poza zakresem i zobaczyć pustą tabelę"),
- filtr i wyszukiwarka — **§3.2**,
- lista kontrolna — **§6**.

Sama DECYZJA jest niezmieniona i obowiązuje: reset strony przy zmianie rozmiaru ZOSTAJE.
Poprawiam tylko wskaźnik, w bloku 14b roadmapy (CLAUDE.md pkt 4: roadmapa koryguje siebie).

### Enhancer kolumn — co dokładnie robi

- `STAGING_COLS` (`:28808-29105`) — **61 pozycji**: 12 „prawdziwych" (`checkbox` i `akcje`
  z `locked:true`; `def:true` na wszystkich poza `stan`/`cenaZ`/`cenaS`) + **49 z `extra:true`**
  (`ex_marka`, `ex_marzaPct`, `ex_ean`, …, `ex_dataAktualizacji`).
- `applyCss()` (`:29131-29140`) — **jawnie pomija `extra`** (`if (c.extra) return`), czyli
  49 przełączników sekcji „Dodatkowe" NIE ROBI NIC poza zapisem do pamięci.
- Preferencje: `localStorage`, klucz `bridge_staging_cols_v2` (`:29107`), całość w `try/catch`
  (błąd → ciche domyślne).
- Popover (`:29176-29270`): tytuł „Widoczne kolumny (staging)", trzy skróty
  „Wszystkie" / „Domyślne" / „Żadna", sekcja „W tabeli stagingu" (10 odblokowanych),
  potem sekcja „Dodatkowe (z katalogu)" z notką „Te kolumny nie są jeszcze wyświetlane
  w tabeli stagingu." i 49 przygaszonych pozycji (`opacity:0.75`).
- Semantyka skrótów (`:29196-29212`): „Wszystkie" i „Żadna" dotykają **tylko nie-`extra`**
  (`Żadna` zostawia `locked`), „Domyślne" resetuje WSZYSTKIE, `extra` włącznie.
- Przycisk: `btn.className = acceptBtn.className`, czyli dziedziczy wygląd „Akceptuj widoczne"
  (`ghost`, `sm`), ikona to inline SVG siatki kolumn.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Brak — ticket nie dotyka kontraktu.** Karta jest czysto frontowa: zmienia stan początkowy
komponentu, układ JSX, tekst placeholdera i dokłada komponent czytający `localStorage`.
Żadne wywołanie API nie zmienia ścieżki, metody ani kształtu ciała:

- `GET /api/staging/paged` — te same parametry (`page`, `limit`, `typZmiany`, `search`),
  zmienia się wyłącznie WARTOŚĆ `typZmiany` w pierwszym żądaniu (`all` → `nowa`), która jest
  legalną wartością enuma i była nią zawsze.
- `POST /api/staging/accept` i `POST /api/staging/reject` — te same dwa kształty ciała
  (`{ids}` i `{allFiltered, typZmiany}`), bez zmian w `dane.ts`.

**GATE odbudowy: N/D.** `contract/`, `contract/fixtures/` i `rebuild/backend/` nie są
w diffie gałęzi. Bramki backendu zbędne (ustalenie z bloku I14 roadmapy). Gdyby w trakcie
wyszło, że trzeba ruszyć fixtures — STOP i pytanie do użytkownika (nauka z 13c).

## Decisions

Wszystkie podjęte przez użytkownika 2026-09-18 po rozpoznaniu.

- **D1 — filtr domyślny `"nowa"`, 1:1 z oryginałem.** Bez wariantów; to sedno karty.
  **Skutek do opisania Ani:** licznik przy „Akceptuj/Odrzuć wszystkie (N)" pokazuje odtąd
  liczbę pozycji typu `nowa`, nie całego stagingu, a `allFiltered` leci z `typZmiany:"nowa"` —
  czyli przycisk domyślnie zatwierdza/odrzuca **tylko nowe produkty**. Żeby ruszyć cały staging,
  trzeba świadomie przestawić „Typ sprawy" na „Wszystkie". To jest zachowanie produkcji i ono
  właśnie chroni przed masowym zatwierdzeniem błędów i wycofań jednym kliknięciem.

- **D2 — tabela wyrównana do oryginału w OBU miejscach** (odpowiedź na F2): `Magazyn` wraca
  na 6. pozycję (zaraz po `Dostawca`), nagłówek wraca na `Powód`. Rozważone: zostawienie
  dłuższego nagłówka „Powód / co sprawdzić" jako celowo jaśniejszego — odrzucone, bo utrwalałoby
  rozjazd, którego nikt nie zdecydował, a Ania porównuje ekrany 1:1 przy przeglądzie 12 widoków.

- **D3 — sekcja „Dodatkowe (z katalogu)" odtworzona 1:1, z 49 nieaktywnymi przełącznikami
  i oryginalną notką.** Rozważone: (a) pominięcie sekcji — odrzucone jako świadome odstępstwo
  bez potrzeby; (b) pokazanie jej, ale z zablokowanymi checkboxami — odrzucone, bo w oryginale
  DA się je kliknąć i stan się zapisuje, a blokada byłaby zmianą zachowania. Koszt wierności
  to tablica stałych. Domyślna reguła projektu: odtwarzamy udokumentowane zachowanie, nie
  oceniamy go.

- **D4 — `data-testid` ZOSTAJĄ w konwencji odbudowy** (świadome odstępstwo, odpowiedź na F1).
  `button-accept-all` nadal znaczy „Akceptuj wszystkie". Przycisk „Kolumny" trafia tam, gdzie
  realnie wychodzi w oryginale — do paska, przed „Akceptuj widoczne". Rozważone: odtworzenie
  zamienionych nazw 1:1 — odrzucone, bo `data-testid` nie jest widoczne dla użytkownika,
  a wierność w tym miejscu utrwaliłaby mylącą nazwę w naszym kodzie i wymusiła przepisanie
  asercji w bloku „Akcje masowe". **Uzasadnienie odstępstwa: zero skutku dla Ani, realny koszt
  dla czytelności.**

- **D5 — ustawienia kolumn w `localStorage`, klucz `bridge_staging_cols_v2`, kształt JSON 1:1.**
  Rozważone: IndexedDB przez `lib/magazynKV.ts`, tak jak konfigurator KATALOGU — odrzucone.
  Katalog używa IndexedDB dlatego, że TAK ROBI ORYGINAŁ TAMTEGO ekranu (`KLUCZ_KOLUMN_KATALOGU`);
  staging w oryginale używa `localStorage`. Różnica nośników między ekranami jest faktem
  produkcji, nie niespójnością do posprzątania. Dodatkowa korzyść: po cutoverze (ta sama domena)
  Ania zachowuje swój wybór kolumn zamiast wracać do domyślnych.

- **D6 — nagłówek widoku wyrównany do oryginału:** tytuł „Staging — zmiany do akceptacji",
  podtytuł „Do decyzji Marty trafiają tylko nowe, wycofane, błędne i kluczowo zmienione pozycje.
  Cena i stan aktualizują katalog automatycznie." Nagłówek i tak jest przebudowywany (dochodzi
  `actions`), więc koszt zerowy.

- **D7 — przyciski masowe 1:1:** „Akceptuj wszystkie (N)" `variant="default"` + ikona `Check`,
  „Odrzuć wszystkie (N)" `variant="outline"` + ikona `X` (w oryginale `vr`=Check, `wr`=X).
  Odbudowa miała „Odrzuć wszystkie" czerwone (`destructive`) — czerwień znika.
  Bezpiecznikiem zostaje `DialogPotwierdzenia`, którego oryginał w ogóle nie ma (F3).

- **D8 — popover budowany komponentami odbudowy** (`@/components/ui/dropdown-menu`, ikona
  `Columns3`, `Badge` licznika), a nie inline'owym CSS-em z oryginału. To ten sam wzorzec
  wchłonięcia co `freq-injection.js` → `Dostawcy.tsx` w 3f-2: „presety, etykiety i zakotwiczenie
  są jego, znika warstwa manipulacji DOM-em". UKŁAD, TEKSTY i SEMANTYKA skrótów zostają 1:1.
  Decyzja Mastera w ramach wzorca; odwracalna, gdyby użytkownik wolał inaczej.

- **D9 — ukrywanie kolumn przez warunkowy render, nie przez wstrzykiwany `<style>`.**
  Oryginał musiał taggować `data-scol` i generować CSS, bo działał z zewnątrz Reacta.
  W komponencie mamy kolumny pod ręką. Skutek widoczny dla użytkownika identyczny.

### ŚWIADOME ODSTĘPSTWA OD ORYGINAŁU (pełna lista tej karty)

| # | Odstępstwo | Dlaczego |
|---|---|---|
| D4 | `data-testid` w konwencji odbudowy, nie zamienione jak w oryginale | niewidoczne dla użytkownika, wierność utrwalałaby pułapkę nazewniczą |
| D8 | popover z `ui/dropdown-menu` zamiast inline CSS | wzorzec wchłonięcia z 3f-2; układ i teksty 1:1 |
| D9 | warunkowy render zamiast wstrzykiwanego `<style>` + `data-scol` | efekt identyczny, warstwa DOM-owa niepotrzebna w Reakcie |
| — (zastane, 3e) | reset strony przy zmianie rozmiaru strony ZOSTAJE | zaakceptowane przez Anię, `instrukcja-testow-I3.md` §3.3 |
| — (zastane, 12e D5) | `DialogPotwierdzenia` zamiast braku potwierdzenia (F3) | poza zakresem karty, do Follow-up |

## Implementation plan

Pięć kroków, każdy = jeden commit.

**Krok 1 — `pages/staging/kolumny.ts` (NOWY): dane konfiguratora.**
- `type KolumnaStagingu = { klucz, etykieta, zablokowana?, domyslna?, dodatkowa? }`.
- `KOLUMNY_STAGINGU` — 61 pozycji 1:1 z `STAGING_COLS` (`:28808-29105`), w tej samej
  kolejności, z tymi samymi etykietami (łącznie z niekonsekwentnymi: `marza_pct`, `vat`,
  `status`, `data_aktualizacji` małą literą, `Bloto+snieg`, `Srednica` bez ogonka).
- `KLUCZ_PAMIECI = "bridge_staging_cols_v2"`.
- `domyslneKolumny()`, `wczytajKolumny()`, `zapiszKolumny()` — `try/catch` połykający
  błędy dokładnie jak `loadPrefs`/`savePrefs` (`:29109-29121`).
- ⚠ `wczytajKolumny()` odtwarza oryginał: gdy w pamięci JEST wpis, bierze go **w całości**,
  bez scalania z domyślnymi — czyli klucz dodany w przyszłości byłby dla zapisanego wpisu
  `undefined` (fałsz). Odtwarzam, nie „naprawiam"; zapisuję to komentarzem.

**Krok 2 — `pages/staging/KonfiguratorKolumn.tsx` (NOWY): komponent.**
- API bezstanowe jak w katalogu: `{ widoczne, onZmiana }`, stan trzyma `Staging.tsx`.
- Trigger: `Button variant="ghost" size="sm"` + `Columns3` + „Kolumny" (klasa dziedziczona
  po „Akceptuj widoczne" — w oryginale dosłownie `btn.className = acceptBtn.className`).
- Zawartość: tytuł „Widoczne kolumny (staging)", trzy skróty z semantyką z `:29196-29212`,
  `DropdownMenuLabel` „W tabeli stagingu" (10 odblokowanych), `DropdownMenuSeparator`,
  `DropdownMenuLabel` „Dodatkowe (z katalogu)" + notka + 49 przygaszonych pozycji.
- `onSelect={(e) => e.preventDefault()}` na pozycjach, żeby menu nie zamykało się po kliknięciu.
- `max-h` + `overflow-y-auto` (oryginał: `max-height:70vh;overflow-y:auto`).

**Krok 3 — `pages/staging/TabelaStagingu.tsx`: kolejność kolumn + widoczność.**
- `Magazyn` wraca na pozycję 6, nagłówek `Powód` (D2).
- Nowa właściwość `widoczne: Record<string, boolean>`; każda kolumna nie-`locked` renderowana
  warunkowo, `checkbox` i `akcje` zawsze (D9).
- Klucze kolumn dosłownie z `POS_KEYS`: `checkbox, typ, kod, nazwa, dostawca, magazyn, stan,
  cenaZ, cenaS, zmiana, powod, akcje`.

**Krok 4 — `pages/Staging.tsx`: filtr, pasek, nagłówek, placeholder.**
- `useState("nowa")` (D1).
- Placeholder „Szukaj po kodzie, nazwie, dostawcy lub EAN..." — **dosłownie, z trzema kropkami
  ASCII**, nie z wielokropkiem `…`, bo tak ma oryginał (`:20710`).
- Nagłówek: tytuł i podtytuł z D6, `actions` = „Akceptuj wszystkie (N)" + „Odrzuć wszystkie (N)"
  w wariantach z D7.
- Pasek — jeden rząd, POZA `Card` (oryginał: goły `div.flex.items-center.gap-3.mb-4`):
  szukajka (`min-w-[220px]`, `pl-8`, `font-mono text-sm`) → napis „Typ sprawy"
  (`text-xs uppercase tracking-wide text-muted-foreground`) → `Select` (`w-64`) → licznik
  `{razem} {razem === 1 ? "zmiana" : "zmian"}` (`text-xs font-mono`) → `ml-auto`:
  „Akceptuj zaznaczone (N)" i „Odrzuć zaznaczone (N)" **renderowane tylko przy `zaznaczone.size > 0`**
  → „Kolumny" → „Akceptuj widoczne" (`ghost sm`) → „Odrzuć widoczne" (`ghost sm`).
- Stan `widoczneKolumny` + `useEffect` zapisujący do `localStorage`.
- Bez zmian: `useEffect` resetujący stronę (zostaje `naStronie` w zależnościach), `adresStrony`,
  mutacje, dialogi, stopka paginacji.

**Krok 5 — `test/staging.test.tsx`: aktualizacja i nowe testy.**

## Testing strategy

Gate odbudowy N/D (brak kontraktu w diffie) — dowodem wierności są testy komponentowe
przeciw MSW, tak jak w reszcie frontu.

**Do poprawienia (padną po D1):**
- „pierwsze żądanie idzie z domyślnymi parametrami" (`:131-140`) — `typZmiany` `"all"` → `"nowa"`.
- „«wszystkie» wysyła allFiltered z bieżącym filtrem" (`:193-209`) — ciało
  `{allFiltered:true, typZmiany:"nowa"}`.

**Nowe testy:**
1. Pierwsze żądanie idzie z `typZmiany=nowa`, a select pokazuje „Nowe produkty" (D1).
2. Po przestawieniu na „Wszystkie" `allFiltered` leci z `typZmiany:"all"` — dowód, że filtr
   naprawdę steruje zakresem przycisku masowego (opisany skutek D1).
3. Placeholder szukajki ma dokładną treść oryginału (dziś nie chroni go żaden test).
4. Kolejność nagłówków tabeli = `POS_KEYS` (D2) — asercja na pełnej liście, nie na pojedynczym
   nagłówku, żeby złapać każde przyszłe przesunięcie.
5. „Akceptuj/Odrzuć zaznaczone" NIE są w DOM bez zaznaczenia i pojawiają się po zaznaczeniu
   (pkt 4 — w odbudowie były zawsze, tylko wyszarzone).
6. Konfigurator: odznaczenie „Dostawca" usuwa kolumnę z tabeli; `localStorage` dostaje wpis
   pod `bridge_staging_cols_v2`.
7. Konfigurator: zapisany wcześniej stan w `localStorage` jest respektowany przy montowaniu.
8. Konfigurator: kolumny `locked` (`checkbox`, `akcje`) nie mają przełącznika i przeżywają „Żadna".
9. Konfigurator: przełącznik z sekcji „Dodatkowe" zapisuje się do pamięci, ale NIE zmienia
   liczby kolumn w tabeli (D3 — dowód, że odtworzyliśmy martwotę, a nie ją przeoczyli).
10. Skrót „Domyślne" przywraca `stan`/`cenaZ`/`cenaS` do ukrycia... — **uwaga:** w oryginale
    `def` dla `stan`/`cenaZ`/`cenaS` jest `false`, więc DOMYŚLNIE te trzy kolumny są UKRYTE.
    Test ma to utrwalić.

**Czego nie testujemy:** wyglądu popovera (kolory, marginesy), pozycjonowania `fixed`
z oryginału (zastąpione przez Radix), zachowania przy zablokowanym `localStorage` poza jednym
testem „nie wywraca się".

⚠ **Ustalenie z Kroku 1 do potwierdzenia w implementacji:** `def:false` na `stan`/`cenaZ`/`cenaS`
oznacza, że po wejściu konfiguratora **trzy kolumny znikają z domyślnego widoku tabeli**.
To jest zachowanie produkcji (enhancer działa u Ani od dawna), ale dla odbudowy to widoczna
zmiana ekranu. Odnotowane w raporcie jako rzecz do uprzedzenia Ani.

## Out of scope

- Klasyfikacja pozycji, powody i odznaki typu (wyłączone w opisie karty).
- Cofanie resetu strony przy zmianie `naStronie` (świadome odstępstwo z 3e).
- `DialogPotwierdzenia` przy akcjach masowych, którego oryginał nie ma (F3) — zastane z 12e.
- Jakikolwiek refaktor `pages/katalog/KonfiguratorKolumn.tsx` i wyciąganie wspólnego komponentu
  (złamałoby rozłączność kart 14a/14b/14c).
- `docs/instrukcja-testow-I3.md` — aktualizuje ją karta 14d.
- Backend, kontrakt, fixtures.

## Definition of done

- [ ] Widok startuje z filtrem „Nowe produkty"; pierwsze żądanie ma `typZmiany=nowa`.
- [ ] Przycisk „Akceptuj/Odrzuć wszystkie (N)" liczy i wysyła bieżący filtr — skutek opisany
      w raporcie słowami, które da się przekleić Ani.
- [ ] Placeholder szukajki dosłownie jak w oryginale.
- [ ] Pasek akcji w jednym rzędzie, w kolejności z `:20702-20770`; „zaznaczone" renderowane
      warunkowo; „wszystkie" w nagłówku.
- [ ] Nagłówek i warianty przycisków masowych 1:1 (D6, D7).
- [ ] Kolumny tabeli w kolejności `POS_KEYS`, nagłówek „Powód" (D2).
- [ ] Konfigurator „Kolumny" w pasku przed „Akceptuj widoczne"; obie sekcje; trzy skróty
      z oryginalną semantyką; ustawienie przeżywa przeładowanie (`bridge_staging_cols_v2`).
- [ ] `npm run lint && npm run typecheck && npm run build && npm test` w `rebuild/frontend/`
      — wszystko zielone.
- [ ] Żaden plik spoza własności 14b nie jest w diffie gałęzi (sprawdzone `git diff --name-only`).
- [ ] Podblok 14b w roadmapie opisuje STAN, wpis „do triażu" z bloku 13e rozliczony,
      błędna referencja „§9.3" sprostowana.
