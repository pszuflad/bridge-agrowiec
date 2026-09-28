# 16-FEATURE-widok-narzuty-promocje — raport z implementacji

## Podsumowanie

Sesja 4b (frontend) dowieziona: widok `/narzuty` z dwiema zakładkami, pełnym CRUD narzutów
i promocji na API z 4a, builderem warunków, symulatorem ceny i kontrolą „poniżej kosztu".
`/narzuty` zniknęło z listy placeholderów. Kolumna „Promocja" w `/katalog` została nietknięta —
lektura oryginału pokazała, że jest w produkcji martwa, więc roadmapa obiecywała dla niej dane,
których nie ma skąd wziąć.

## Zmiany

**Nowe pliki**
- `rebuild/frontend/src/pages/Narzuty.tsx` — złożenie widoku (port `VT()`).
- `rebuild/frontend/src/pages/narzuty/api.ts` — klient obu zasobów; wysyła wyłącznie pola
  z list edytowalnych backendu; znosi 200-z-pustym-ciałem na `PATCH /api/promotions/{id}`.
- `rebuild/frontend/src/pages/narzuty/warunki.ts` — (de)serializacja `warunki`, 9 typów warunku.
- `rebuild/frontend/src/pages/narzuty/ceny.ts` — silnik cen klienta (zgodny z backendem, D8).
- `rebuild/frontend/src/pages/narzuty/status.ts` — statusy promocji, port `Qd()`/`_b()`,
  naprawiona literówka `zaplanowana`, wykrywanie rozbieżności etykiety z kolumną `status`.
- `rebuild/frontend/src/pages/narzuty/TabelaNarzutow.tsx` — port `WT()`.
- `rebuild/frontend/src/pages/narzuty/TabelaPromocji.tsx` — port `BT()`.
- `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx` — port `el()` + dialog „poniżej kosztu".
- `rebuild/frontend/src/pages/narzuty/Symulator.tsx` — port `UT()`.
- `rebuild/frontend/src/components/ui/toast.tsx` — `ToastProvider`, `useToast`, `Toaster` (D7).
- `rebuild/frontend/test/narzuty.test.tsx` (16), `narzuty.dialog.test.tsx` (16),
  `narzuty.ceny.test.ts` (22), `narzuty.api.test.ts` (8).

**Zmienione**
- `rebuild/frontend/src/App.tsx` — trasa `/narzuty`, `ToastProvider` w drzewie.
- `rebuild/frontend/src/pages/placeholdery.ts` — zdjęty wpis `/narzuty`.
- `rebuild/frontend/src/components/ui/dialog.tsx` — dołożony `DialogFooter`.
- `rebuild/frontend/test/msw/kontrakt.ts` — `narzutyZFixtura`, `promocjeZFixtura`,
  `PROMOCJA_TESTOWA`.

**Nietknięte świadomie:** `src/pages/katalog/kolumny.ts` i `katalog/formatowanie.tsx` (D1).

## Odstępstwa od planu

Brak odstępstw od zatwierdzonego planu. Plan był natomiast **korygowany w trakcie**, dwukrotnie,
i oba razy dlatego, że lektura oryginału obaliła moje wcześniejsze ustalenie:

1. **Status promocji.** Najpierw zaraportowałem, że jest liczony raz przy tworzeniu i nigdy
   nieodświeżany. To było **błędne** — `_b()` (`frontend-index.js:9508`) przelicza go z dat przy
   KAŻDYM odczycie `/api/promotions`, tyle że wynik idzie do IndexedDB, nie na serwer. Decyzja D5
   została po tej korekcie podjęta na nowo (znacznik rozbieżności zamiast „uczciwego nagłówka").
2. **Silnik cen klienta.** Dopiero przy pisaniu kodu wyszło, że `Mb()` rozjeżdża się z własnym
   backendem — stąd nowa decyzja D8.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Tabela narzutów renderowana z
  `contract/fixtures/GET_markups.json` (nazwa, `+6%`, odznaka GLOBALNY z `warunki: "[]"`,
  status). Klient sprawdzony przeciwko gołej tablicy i `warunki` jako STRING.
  ⚠ Ograniczenie nazwane w `test/msw/kontrakt.ts`: `GET_promotions.json` jest PUSTĄ TABLICĄ,
  więc kształt wiersza promocji pochodzi ze schematu, nie z nagrania — słabsze świadectwo.
- **Widok: ✓ 16 testów** — układ i zakładki, sort po `id` malejąco, stany puste, przełącznik
  statusu (PATCH z odwróconą wartością), usuwanie bez potwierdzenia (1:1), badge „zaplanowana"
  po naprawie literówki, znacznik rozbieżności, nagłówek bez fałszywej obietnicy.
- **Dialog: ✓ 16 testów** — **asercja na KOMPLETNY zbiór kluczy wysyłanego ciała** (osiem pól
  dla każdego zasobu, bez `id`/`zmienilUzytkownikId`/`zmienionoData`), `warunki` jako string
  JSON, `typ`/`zakres` z pierwszego warunku, trzy walidacje, 9 typów warunku, nota przy datach,
  pełny cykl kontroli „poniżej kosztu" (pokazanie / anulowanie / potwierdzenie / brak przy
  umiarkowanym rabacie).
- **Silnik cen klienta: ✓ 22 testy** — te same liczby i te same przypadki co w
  `rebuild/backend/test/ceny.silnik.test.ts`, w tym test odstępstwa D8 i niezmiennik
  „wygasła promocja nadal obniża ceny", stojący po obu stronach.
- **Klient API: ✓ 8 testów** — w tym pułapka 200-z-pustym-ciałem.
- **Cały pakiet frontendu: ✓ 261 testów w 18 plikach.** `lint`, `typecheck`, `build` czyste.
- **Backend kontrolnie (nie ruszany): ✓ 603 testy w 36 plikach.**

## Breaking changes

Brak. Widok wchodzi w miejsce placeholdera, liczba tras routera bez zmian. `Toaster` dochodzi
do drzewa aplikacji, ale żaden istniejący widok go nie używa — komunikaty inline zostają
tam, gdzie były.

## Follow-up

1. **Kolumna „Promocja" w `/katalog` jest martwa** — `_reguly` nie jest ustawiane nigdzie
   w oryginale, a `GET /api/products` nie niesie danych o promocji. Port 1:1 (D1); wpis
   backlogu i sprostowanie roadmapy w Fazie 5.
2. **Promocja „globalna" nie pasuje do niczego** — znalezione przy pisaniu testów. Checkbox
   „Reguła globalna" zeruje `zasieg` i `warunki`, a `promocjaPasuje` wymaga jednego albo
   drugiego, więc taka promocja nie obniża NICZEGO. Oryginał zachowuje się identycznie
   (`Cb()` `:9322` + `Tb()` `:9477`) i tak samo o tym milczy. Port 1:1, test to utrwala,
   opis do backlogu. **Kandydat na poprawkę UX w przyszłości** — dla narzutów „globalna"
   znaczy „wszystkie produkty", dla promocji „żaden", a checkbox jest ten sam.
3. **`Mb()` w oryginale rozjeżdża się z backendem** (D8) — do backlogu jako opis defektu
   produkcji, nie do naprawy u nas.
4. **Status promocji nie wraca na serwer** — etykieta liczona z dat żyje tylko w przeglądarce
   (backlog #19 po stronie backendu). Znacznik rozbieżności czyni to widocznym, ale nie
   naprawia; naprawa należy do silnika.
5. **`TooltipProvider`** dalej nie wszedł — czeka na iterację, która pierwsza użyje tooltipa.

## Review fixes applied

Review zgłosiło 2 BLOCKER-y i 3 SHOULD-FIX. Weryfikacja w oryginale potwierdziła oba blokery
i **odsłoniła trzy dalsze rozjazdy**, których review nie miało jak zobaczyć, bo dotyczą
wartości domyślnych formularza. Wszystkie naprawione.

**BLOCKER 1 — `priorytet` zbijany do 50 przy każdym zapisie.** Potwierdzone: oryginał trzyma
priorytet w stanie `C = t?.priorytet ?? n?.priorytet ?? 50` (`:24220`) i odsyła go przy edycji
(`priorytet: C`, `:24626`); samo pole stoi pod `display:none` (`:24468-24472`), więc użytkownik
go nie zmienia, ale wartość jest zachowywana. Mój port wpisywał tam na sztywno 50, co po cichu
zmieniałoby, KTÓRA reguła wygrywa dla produktu. Naprawione: stan `priorytet`, inicjowany
z edytowanej reguły, odsyłany bez zmian. Test regresyjny: „PATCH zachowuje priorytet reguły,
zamiast zbijać go do 50" (reguła z priorytetem 99).

**BLOCKER 2 — brak aktualizacji roadmapy i backlogu.** To nie jest przeoczenie, tylko kolejność
procesu: plan.md (Krok 11) przewiduje te zmiany w Fazie 5, po review. Wykonane niżej,
w sekcji „Docs updates".

**SHOULD-FIX — ostrzeżenie „poniżej kosztu" liczone silnikiem zamiast metodą oryginału.**
Potwierdzone i naprawione. Oryginał liczy to TRZECIM, własnym sposobem (`:24563-24597`):
bierze AKTUALNĄ `cenaSprzedazy` z katalogu i mnoży przez `(1 − rabat/100)`, a dopasowanie ma
swoje — globalna obejmuje WSZYSTKIE produkty, `marka`/`kategoria`/`dostawca`/`produkt` po
równości, `rozmiar`/`bieznik` przez zawieranie, nieznany typ odrzuca. Mój port używał silnika
cen, przez co liczby się nie zgadzały, a promocja globalna nie ostrzegała o niczym. Przepisane
1:1 (`produktyPonizejKosztu` w `ceny.ts`, z jawną notą, że to NIE jest silnik z góry pliku).

**SHOULD-FIX — brak czerwonego paska ostrzegawczego na żywo.** Potwierdzone: oryginał ma DWA
ostrzeżenia liczone tą samą metodą — pasek w formularzu, aktualizowany przy każdej zmianie
(`:24473-24513`), i potwierdzenie przy zapisie. Plan miał tylko to drugie. Pasek dodany.

**Rozjazdy znalezione przy weryfikacji, poza zgłoszeniem review:**
1. **Domyślne nowej reguły były złe.** Oryginał (`:24216-24222`): checkbox „globalna"
   ODZNACZONY, jeden pusty warunek typu `kategoria`, wartość 15% dla narzutu i 10% dla rabatu,
   daty prefilled na dziś i dziś+30 dni. Mój port startował z zaznaczoną „globalną", pustą
   listą warunków, wartością 0 i pustymi datami. Poprawione, z osobnym opisem testowym.
2. **`zasieg` promocji globalnej to napis „globalny", nie pusty** (`:24613`). Różnica jest
   znacząca, nie kosmetyczna: `promocjaPasuje` odrzuca promocję z PUSTYM `zasieg`, więc mój
   port tworzył promocję globalną, która nie obniżała niczego. Poprawione + test.
   **To unieważnia punkt 2 z „Follow-up" wyżej** — promocja globalna działa, o ile `zasieg`
   jest ustawiony tak jak w oryginale.
3. **Edycja wysyła MNIEJ pól niż tworzenie.** `Ag()`/`Eb()` przekazują `{...t}`, czyli sześć
   pól przy narzucie (bez `jednostka` i `status`) i siedem przy promocji (bez `status`).
   Mój port wysyłał komplet ośmiu w obu przypadkach. To ma konsekwencje: wysyłanie `status`
   z formularza cofałoby przełącznik aktywności z tabeli, a przy promocji nadpisywałoby
   status wyliczony przy tworzeniu. Poprawione, z osobnymi testami na oba zbiory pól.
4. Fallback typu przy regule nieglobalnej to `"marka"`, nie `"globalny"` (`:24623`).

Po poprawkach: `lint`, `typecheck`, `build` czyste, **275 testów w 18 plikach** zielonych
(było 261 — doszło 14 testów pilnujących powyższych rzeczy).

### Review runda 2

0 BLOCKER-ów, 2 SHOULD-FIX — oba naprawione.

**Symulator odbiegał od `UT()`.** Przepisany 1:1 (`:24972-25120`): szukajka po pięciu polach
sklejonych spacją (`rozmiar`, `marka`, `model`, `nazwa`, `kod`), limit **50** trafień z notą
„Pokazane pierwsze 50 — zawęź wyszukiwanie", komunikat „Brak wyników dla…", wybrany produkt
z przyciskiem „Zmień", cztery wiersze rozbicia z **deltami** względem kroku poprzedniego
i wyróżnionym VAT-em, `data-testid` z oryginału (`input-simulator-search`,
`simulator-result-{id}`, `button-simulator-clear`). Dołożony **jeden wiersz ponad oryginał**
(D8): `UT()` kończy się na kwocie z VAT-em, ale to nie jest liczba, która ląduje w katalogu —
backend zaokrągla ją w dół. Symulator różniący się od katalogu o grosze tłumaczyłby cenę,
której tam nie ma. Trzy nowe testy, w tym sprawdzenie, że rozbicie zgadza się z `cenaSprzedazy`
z `contract/fixtures/GET_products.json`.

**Formularz resetował pola przy otwarciu.** Oryginał tego NIE robi — `el()` nie ma ani resetu,
ani `useEffect`, więc wpisane wcześniej wartości wracają przy kolejnym otwarciu. Reset był moim
dodatkiem. Usunięty, a przy okazji **cały stan przeniesiony do inicjalizatorów `useState`**,
tak jak w oryginale (`:24214-24223`) — mój `useEffect` synchronizujący formularz zniknął.
To nie jest kosmetyka: efekt kasowałby zmiany użytkownika przy każdym przerysowaniu rodzica.

Po rundzie 2: `lint`, `typecheck`, `build` czyste, **278 testów w 18 plikach** zielonych.

## Docs updates

### `docs/rebuild-roadmap.md`
- **Iteracja 4 ZAMKNIĘTA** — status `🔨 częściowo` → `✅`, oba pod-bloki (4a, 4b) z datami
  i ticketami; tablica postępu w §4 zaktualizowana.
- **Blok 4b przepisany ze stanu „⬜ nie zaczęte / pułapki do uważania" na stan dowieziony.**
  Sześć dawnych „pułapek" przepisanych na fakty.
- **Usunięta nieprawda o kolumnie „Promocja"** — roadmapa obiecywała, że 4b „dostarcza dla niej
  dane". Zastąpione jawnym sprostowaniem, że kolumna zostaje martwa (D1), z uzasadnieniem.
  Poprawiony też wpis w bloku Iteracji 2, który wskazywał na `I4b`.
- **Doprecyzowany fakt o statusie promocji** — frontend produkcji przelicza etykietę z dat przy
  każdym odczycie (`_b()`), ale nigdy nie zapisuje na serwer; 4b portuje to 1:1 i dokłada
  znacznik rozbieżności.
- **Noty dla przyszłych bloków trafiły DO NICH** (zasada 2 z `CLAUDE.md`): **I7** — dialog
  w oryginale zasila marki i kategorie z `GET /api/attributes`, 4b buduje je z produktów, więc
  po I7 warto podpiąć słownik; **I12** — ożywienie kolumny „Promocja" wymaga danych z backendu,
  nie liczenia po stronie klienta.

### `docs/rebuild-backlog.md`
- **#19** (silnik ignoruje daty promocji) — uzupełniony o odkrycie z 4b: etykieta statusu JEST
  przeliczana z dat przy każdym odczycie, ale wynik nigdy nie wraca na serwer, więc lista
  potrafi pokazać „zakończona" przy promocji, która nadal obniża ceny. Znacznik rozbieżności
  czyni to widocznym; naprawa dalej ⬜ do decyzji, po stronie backendu.
- **#20** (`PATCH /api/promotions/{id}` bez 404) — dopisany skutek dla frontendu i test, który
  go pilnuje.
- **#22 (nowy)** — kolumna „Promocja" w `/katalog` jest MARTWA; port 1:1, ożywienie ⬜ do decyzji.
- **#23 (nowy)** — `Mb()` z oryginału rozjeżdża się z własnym backendem; 4b świadomie tego nie
  portuje (D8), w produkcji defekt nadal obecny.
- **#24 (nowy)** — ostrzeżenie „poniżej kosztu" to trzeci, osobny sposób liczenia, nieobejmujący
  warunków `konstrukcja`/`srednica`/`vfIf`; port 1:1 (D6).

### `docs/spec-frontend.md`
- §3: dopisane, które z 12 tras są już zbudowane, a które zostają placeholderami.
- §5: blok „widok `/narzuty` NIE ISTNIEJE" (z sesji 4a) przepisany na opis stanu — zakładki,
  CRUD, builder 9 typów, etykieta statusu ze znacznikiem, ostrzeżenie „poniżej kosztu",
  martwa kolumna „Promocja" jako świadomy port 1:1, nowy `Toaster`.

### `docs/spec-backend.md`
Bez zmian — 4b nie ruszało backendu, a plik nie zawierał twierdzeń, które ticket unieważnił.

### `docs/instrukcja-testow-I3.md`
§5: wiersz o narzutach i promocjach rozliczony — backend (4a) i widok `/narzuty` (4b) gotowe.

### Pre-existing issues
`docs/instrukcja-testow-I3.md:395` — wiersz „Widok Historia | Iteracja 5" jest nieaktualny,
bo `/historia` powstało w tickecie `15-FEATURE-historia-zmian`. Poprzedza ten ticket i nie
dotyczy narzutów, więc świadomie nietknięte.
