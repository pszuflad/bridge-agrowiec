# 53-CHORE-i14e — raport z diagnozy

## Podsumowanie

Karta rozpoznawcza, zamknięta **bez ani jednej zmiany w kodzie produkcyjnym**.

**⚠ ZAKRES ZAWĘŻONY W TRAKCIE REALIZACJI** — odpowiedzi Ani z 19.09 zamknęły dwa z trzech zadań,
zanim doszło do wniosków. **Jedynym celem karty stało się zadanie C**, a jego waga wzrosła, bo
Ania zatwierdziła zmianę: *„data ma naprawdę kończyć promocje"* (backlog #19).

- **C (jedyny cel) — wycena obu wariantów gotowa.** **(a)** silnik czyta daty: **1 scenariusz
  charakteryzacji z 31**, 2 testy, 0 fixtures, **wymaga wyjątku w wyroczni**. **(b)** wygaszacz
  przestawia `status`: **0 scenariuszy**, 1 test, 0 fixtures, **bez wyjątku** — ale tylko dopóki
  nie wchodzi do ścieżki importu. **Rekomendacja: (b)**, z trzema nazwanymi słabościami.
  Decyzja należy do użytkownika.
- **A — BEZPRZEDMIOTOWE** (Ania: „tylko się nie wyświetlało, cena się oblicza prawidłowo").
  Pomiar zdążył to potwierdzić niezależnie, zanim przyszła odpowiedź: promocja `marka→BKT` 10%
  obniżyła ceny **954 produktów** wg wzoru, a porównanie pełnego katalogu **oryginał ↔ odbudowa
  dało 0 różnic na 7405 produktach**. Zostawiam jako dowód braku regresji, nie jako znalezisko.
- **B — ZAMKNIĘTE bez zmian** (Ania: „dodana czy zaktualizowana to nie ma różnicy, zostaw to tak
  jak jest"). Pomiar i tak wykazał, że defektu nie ma: zapis z edycji leci `PATCH`, **druga reguła
  nie powstaje**.

**Najważniejsze ustalenie karty** — i to, które przesądza o koszcie #19: **status promocji jest
zapisywany RAZ, przy tworzeniu.** POST liczy go z dat, PATCH go nie wysyła, a nic po stronie
serwera nigdy go nie przelicza. Silnik **już** honoruje `status`, więc wpisanie właściwej wartości
do bazy wyłącza rabat **bez tknięcia silnika**. Z tego samego faktu wynika defekt odwrotny,
nigdzie dotąd nieopisany: **promocja „zaplanowana" nigdy się nie włącza**.

---

## A. Czy promocja z warunkiem realnie obniża ceny?

> **ZADANIE ZAMKNIĘTE JAKO BEZPRZEDMIOTOWE** (odpowiedź Ani z 19.09: *„tylko się nie
> wyświetlało, cena się oblicza prawidłowo"* — zgłoszenie dotyczyło pustej kolumny „Promocja",
> nie cen). Pomiary poniżej wykonano, **zanim** odpowiedź dotarła; zostawiam je, bo niezależnie
> potwierdzają brak regresji i dostarczają liczby do backlogu #25. Dalszych poszukiwań defektu
> w dopasowaniu promocji nie prowadzono.

### Jak mierzyłem

Dwa żywe backendy na kopiach tej samej bazy, nigdy na oryginale pliku:

| Strona | Jak postawiona |
|---|---|
| Odbudowa | `DB_PATH` na kopię `db/snapshot.db`, `npm run migrate:dev` (6 migracji), port efemeryczny. Scheduler wyłączony domyślnie (`IMPORT_SCHEDULER` nieustawione) |
| Oryginał | Kopia całego `mirror/backend` do katalogu tymczasowego, `snapshot.db` jako `data.db` **obok** `index.cjs`, `npm install`, `UPDATE suppliers SET czestotliwosc_minuty = NULL` **przed** startem, CWD = katalog piaskownicy, port efemeryczny |

Log startu oryginału potwierdził `[scheduler] zaplanowano 0 dostawców z URL polling` — **żaden
ruch nie wyszedł na zewnątrz**. Moduły `atrybuty` i `pending` padły przy starcie, zgodnie
z opisem w `CLAUDE.md`; tej karty nie dotyczą.

Migracje odbudowy sprawdzone pod kątem wpływu na pomiar: `marka`, `cena_zakupu` i `vat`
występują w `rebuild/schema/00*.sql` **wyłącznie w DDL**, żaden `UPDATE` ich nie rusza.
Ceny są więc porównywalne wprost, mimo że oryginał chodził na bazie bez naszych migracji.

### Stan wyjściowy — zgodny z fixtures co do bajtu

| Co | Wartość | Kontrola |
|---|---|---|
| `markups` | 1 wiersz: `typ: "globalny"`, `wartosc: 6`, `status: "aktywny"` | **ZGODNE** z `contract/fixtures/GET_markups.json` |
| `promotions` | `[]` | **ZGODNE** z `contract/fixtures/GET_promotions.json` |
| `products` | 7405 | — |
| `products` z `marka = 'BKT'` | 954 (0 z ceną zakupu ≤ 0) | — |

Ceny BKT przed eksperymentem zgadzały się co do złotówki z `floor(zakup × 1,06 × 1,23)`,
czyli z jedynym narzutem w bazie.

### Wynik — promocja `marka→BKT`, rabat 10%, daty domyślne

Ciało żądania 1:1 z tym, co wysyła dialog przy **odznaczonej** „Regule globalnej":
`warunki: [{"typ":"marka","wartosc":"BKT"}]`, `zasieg: ""`, `rabatPct: 10`,
`status: "aktywna"`. Obie strony oddały HTTP 200 w ~0,3 s.

| Kod | Zakup | Oryginał przed → po | Odbudowa przed → po | Wzór `×1,06×0,90×1,23` |
|---|---|---|---|---|
| `MO3_10075153BKT2` | 290 | 378 → **340** | 378 → **340** | 340 |
| `MO3_10075153BKT3` | 240 | 312 → **281** | 312 → **281** | 281 |
| `MO3_10075153BKTAS18TL` | 470 | 612 → **551** | 612 → **551** | 551 |
| `MO3_1008012BKT` | 250 | 325 → **293** | 325 → **293** | 293 |
| `MO3_11580153B` | 360 | 469 → **422** | 469 → **422** | 422 |

**Porównanie pełnego katalogu, produkt po produkcie (po `kod`):**

> **7405 produktów wspólnych · 0 różniących się cen · 954/954 produktów BKT z identyczną ceną.**

`marzaPct` po promocji nadal pokazuje `6`, czyli procent narzutu — zgodnie z §4 pkt 3 instrukcji.

### Zasięg zmiany — i pułapka, w którą łatwo wpaść przy czytaniu liczb

Naiwny pomiar „ile cen się zmieniło" daje **3003**, co wygląda, jakby promocja objęła znacznie
więcej niż BKT. To złudzenie. Kontrola — **samo** `przeliczCenyZRegul` na czystej kopii, bez
żadnej promocji — zmienia **2050** cen, bo masowe przeliczenie prostuje pozycje, których
zapisana cena rozjechała się z aktualnym narzutem.

| Pomiar | Zmienionych cen |
|---|---|
| Kontrola: samo przeliczenie, bez promocji | 2050 |
| Promocja `marka→BKT` 10% (łącznie z przeliczeniem) | 3003, w tym **954 BKT** i 2049 innych |
| **Efekt samej promocji** | **954 produkty BKT** |

Rozbicie 3003 = 954 + 2049 domyka się z kontrolą 2050 bez luki, i jest to **zmierzone,
nie wyliczone**: w przebiegu kontrolnym 2050 zmian dzieli się na **2049 produktów spoza BKT
i dokładnie 1 produkt BKT**. Ten jeden BKT miałby zmienioną cenę także bez promocji, ale
w przebiegu z promocją nie da się go od jej efektu odróżnić, więc liczy się do 954.

⚠ **To jest osobne, uboczne znalezisko:** pierwsza mutacja dowolnej reguły na produkcyjnych
danych po cichu przepisze ~2050 cen, które dziś są nieaktualne. Nie jest to defekt — tak działa
`recalcPricesFromRules` i tak samo zachował się oryginał — ale przy prawdziwym wdrożeniu
zobaczy to ktoś, kto nie będzie tego oczekiwał. Do follow-upu.

### Wariant „Reguła globalna" — backlog #25 z liczbą

Powtórzone na świeżej kopii, ciało 1:1 z checkboxa: `zasieg: "globalny"`, `warunki: "[]"`.

> **Ponad efekt samego przeliczenia promocja „globalna" zmieniła cenę DOKŁADNIE
> 1 produktu z 7405** — `MO4_LLCR17523575MLLS0` (marka **pusta**, kategoria „Ciężarowe",
> zakup 475,30; 619 → 557). Identycznie w oryginale i w odbudowie (0 różnic na 7405).

Mechanizm zgodny z opisem #25: przy pustych `warunki` sprawdzane jest, czy `zasieg` **zawiera**
markę **albo** kategorię produktu, a `"globalny"` nie zawiera ani `"bkt"`, ani `"ciężarowe"` —
za to zawiera pusty napis. Doprecyzowanie wobec dotychczasowego opisu w backlogu: dopasowanie
jest **alternatywą**, więc wystarczy pusta marka *albo* pusta kategoria; zmierzony przypadek
ma pustą markę przy **wypełnionej** kategorii.

### Werdykt A

**(a) — promocja z warunkiem działa; Ania trafiła w pułapkę #25.** Odbudowa jest wierna
oryginałowi w obu wariantach. Nic do naprawy po stronie odbudowy. Otwarte zostaje to, co było
otwarte: czy **produkcja** ma przestać mieć defekt #25 — to decyzja użytkownika, nie tej karty.

Druga połowa zdania Ani („nie zaczytała się w katalogu w kolumnie promocje") jest znana
i poprawna — kolumna „Promocja" jest martwa, backlog **#22**, §4 pkt 1 instrukcji. Zgodnie
z zakresem karty nie badałem jej.

---

## B. Komunikat „Reguła dodana" po edycji (§3.11)

> **ZADANIE ZAMKNIĘTE BEZ ZMIAN W KODZIE** (odpowiedź Ani z 19.09: *„dodana czy zaktualizowana
> to nie ma różnicy, zostaw to tak jak jest"*). Pomiar poniżej wykonano przed odpowiedzią;
> zostawiam go razem z testem, bo zamyka realną lukę pokrycia i niczego nie wymusza.
> Opisane niżej ryzyko duplikatu reguły **nie jest już przedmiotem decyzji** — Ania rozstrzygnęła
> wątek na „zostaw jak jest".

### Co mówi architektura

Każdy zasób ma **dwie niezależne instancje** `DialogReguly`:

| Instancja | Montowanie | Stan |
|---|---|---|
| „Dodaj" | ZAWSZE, nigdy się nie odmontowuje | celowo **bez resetu** (`DialogReguly.tsx:337-344`, port `el()`) |
| „Edytuj" | WARUNKOWO (`TabelaNarzutow.tsx:77-81`, `TabelaPromocji.tsx:92-98`) | świeży przy każdym mount, `onClose` odmontowuje |

Treść komunikatu bierze się z `dodawanie = !edycja` (`DialogReguly.tsx:272-282`), a `edycja`
liczy się z propsów przy każdym renderze.

### Co pokazał pomiar

Nowy plik `rebuild/frontend/test/narzuty.edycja-toast.test.tsx`, **11 przypadków, wszystkie
przechodzą**:

| Sprawdzane | Wynik |
|---|---|
| Tytuł dialogu po kliknięciu ołówka | „Edytuj regułę", nigdy „Nowa reguła cenowa" |
| Metoda zapisu po edycji narzutu | `PATCH /api/markups/{id}`, **zero POST-ów** |
| Metoda zapisu po edycji promocji | `PATCH /api/promotions/{id}`, **zero POST-ów** |
| Toast po edycji narzutu | „Reguła zaktualizowana" |
| Toast po edycji promocji | „Promocja zaktualizowana" |
| Kontrola: dodanie reguły | `POST` + „Reguła dodana" |
| Edycja innego wiersza po zamknięciu | pokazuje dane TEGO wiersza, bez resztki |
| Przeciek edycji do formularza dodawania | **brak** |

**Odpowiedź na pytanie karty: nie, edycja nie tworzy drugiej reguły.** Zapis idzie `PATCH`-em
na konkretne `id`; nie ma ścieżki, którą powstałby nowy wiersz.

### Ale ryzyko utworzenia drugiej, podobnej reguły ISTNIEJE — tyle że innym wejściem

Formularz **dodawania** pamięta ostatnie wpisy (zachowanie oryginału, świadomie odtworzone
i opisane Ani w §3.11). Realna sekwencja, która kończy się duplikatem:

1. użytkownik edytuje regułę i zapisuje,
2. chce poprawić jeszcze jedną rzecz i klika **„Dodaj regułę"** zamiast ołówka,
3. widzi **wypełniony** formularz — z poprzedniej sesji dodawania, nie z edycji —
   i bierze go za „tę samą regułę, którą przed chwilą edytował",
4. zapisuje → powstaje **druga, podobna reguła**.

To **problem UX odziedziczony po oryginale**, nie defekt naszego portu, i zgodnie z zakresem
karty **nie został po cichu poprawiony**. Instrukcja już dziś ostrzega o pamiętających polach;
czego nie mówi, to że przycisk „Dodaj" po edycji wygląda myląco podobnie do „kontynuuj edycję".

**Do decyzji użytkownika** (propozycja osobnej karty, nie realizowana tutaj):
- **Wariant 1 — nic nie robić.** Zgodność z oryginałem 1:1. Ryzyko duplikatu zostaje.
- **Wariant 2 — czyścić formularz dodawania po udanym zapisie.** Usuwa ryzyko, ale jest
  **zmianą zachowania produkcji**: ktoś mógł polegać na tym, że pola zostają gotowe do korekty.
- **Wariant 3 — zostawić pamiętanie, dołożyć widoczne rozróżnienie** (np. wyraźny nagłówek
  „Nowa reguła" i przycisk „Wyczyść"). Nie rusza mechaniki, zdejmuje mylenie.

⚠ Jedno zastrzeżenie do werdyktu B, uczciwie: pomiar dotyczy **odbudowy**. Nie wykluczam, że
Ania widziała komunikat w **starym** Bridge — porównania tej konkretnej ścieżki na żywym
bundlu FE oryginału nie robiłem, bo karta nie przewidywała ruszania frontendu produkcji,
a `deminified/frontend-index.js` jest bundlem sprzed czterech łatek i nie jest miarodajny.

---

## C. ⭐ Wycena: „data ma naprawdę kończyć promocję" (backlog #19)

**To jest jedyny cel karty po zawężeniu zakresu 19.09**, i jednocześnie pozycja o najwyższej
stawce w I14 — jedyne świadome odstępstwo ruszające silnik cen.

### Najpierw ustalenie, które przesądza o koszcie: status jest zapisywany RAZ

Defekt #19 bywa opisywany jako „silnik ignoruje daty". To prawda, ale niepełna i przez to myląca
przy wycenie. Pełny obraz — trzy fakty, każdy sprawdzony w kodzie:

| Fakt | Gdzie |
|---|---|
| **POST** wysyła `status: statusZDat(start, koniec)` — status jest liczony z dat **przy tworzeniu** | `DialogReguly.tsx:226-236` (port `Cb()`, `:9324`) |
| **PATCH** wysyła SIEDEM pól i **`status` NIE jest wśród nich** — edycja dat nigdy nie zmienia statusu | `DialogReguly.tsx:209-224` (port `Eb()`, `:9369-9390`) |
| **Nic po stronie serwera nigdy statusu nie przelicza** | `grep` po `statusZDat`/`zakonczona`/`zaplanowana` w `rebuild/backend/src/` nie zwraca **nic**; w `mirror/backend/index.cjs` te napisy padają wyłącznie w danych seeda |

Czyli defekt to **brak przeliczania statusu w czasie**, a nie samo „nieczytanie dat".

### Silnik JUŻ honoruje status — zmierzone

Pomiar na prawdziwej bazie (`floor(1000 × 1,06 × 1,23) = 1303` bez rabatu, `1173` z rabatem 10%):

| Stan promocji w bazie | Cena po przeliczeniu | Wynik |
|---|---|---|
| `aktywna`, daty bieżące | 1173 | rabat działa |
| `aktywna`, **koniec w PRZESZŁOŚCI** | 1173 | **to jest defekt #19** |
| `aktywna`, **start w PRZYSZŁOŚCI** | 1173 | rabat działa |
| `zakonczona`, koniec w przeszłości | **1303** | **rabat nie działa** |
| `zaplanowana`, start w przyszłości | **1303** | **rabat nie działa** |

> **Wniosek nośny dla całej wyceny: wpisanie właściwego `status` do bazy wyłącza rabat
> BEZ TKNIĘCIA SILNIKA.** Słownik statusów (`aktywna`/`zakonczona`/`zaplanowana`) już istnieje
> i silnik już go respektuje. Wariant (b) nie wprowadza nowego pojęcia — stosuje w czasie tę samą
> regułę, którą system stosuje raz, przy tworzeniu promocji.

### Wycena obu wariantów

| Pozycja | **(a)** silnik czyta daty w `promocjaPasuje` | **(b)** wygaszacz przestawia `status` |
|---|---|---|
| Scenariusze charakteryzacji akceptacji | **1 z 31** (`promocja-wygasla-nadal-obniza-cene`) — 3 pola (`cena_sprzedazy`, `marza_pct`, `status`) w 1 wierszu `products` | **0 z 31** — warunkowo, patrz niżej |
| Scenariusze charakteryzacji `bulk` | **0 z 17** | **0 z 17** |
| Testy jednostkowe BE do przepisania | **2** — `ceny.silnik.test.ts:246-252` (2 asercje), `narzuty.patch.test.ts:319-331` (1 asercja) | **1** — `narzuty.patch.test.ts:319-331` |
| Fixtures w `contract/` do przenagrania | **0** | **0** |
| Realne ceny zmienione dziś w produkcji | **0** | **0** |
| **Wyjątek w wyroczni charakteryzacji** | **TAK** | **NIE** |

**Dlaczego fixtures to zero w obu wariantach.** `contract/fixtures/GET_promotions.json` to `[]` —
produkcja nie ma ani jednej promocji. Żaden fixture w całym katalogu nie zawiera `rabatPct`
(sprawdzone). Siedem fixtures niesie `cenaSprzedazy`/`marzaPct`, ale skoro w bazie źródłowej nie
było promocji, **żadna z tych wartości nie zależy od dat**. To samo dotyczy danych: w
`db/snapshot.db` nie ma promocji, więc naprawa nie zmieni dziś ani jednej realnej ceny.

### ⚠ Warunek, pod którym (b) jest darmowe

Harness charakteryzacji porównuje `acceptStaging`, a ta ścieżka woła `zastosujRegulyCenowe`,
**nie** `przeliczCenyZRegul`. Zweryfikowane grafem wywołań, nie nazwą: `przeliczCenyZRegul` jest
wołane wyłącznie z `repos/markups.ts:113` i `repos/promotions.ts:97` (mutacje reguł).

Wygaszacz odpalany **przy starcie** i **na wejściu `przeliczCenyZRegul`** jest więc dla harnessu
niewidoczny → **0 scenariuszy**. Ale:

> **Gdyby wygaszacz wszedł także do ścieżki importu, koszt zrównuje się z (a) — i jest nawet
> wyższy:** rozjechałyby się DWIE tabele naraz (`products` **i** `promotions`), bo nasz port
> zmieniłby dane, których oryginał nie rusza.

**Cena tego kompromisu, nazwana wprost:** zostaje okno, w którym promocja wygasa przy działającym
procesie, bez żadnej mutacji reguły — i **nadal obniża cenę przy imporcie**, aż do najbliższego
zamiatania. To jest realny wybór do podjęcia w 14f, nie szczegół implementacyjny.

### Gdzie odpalać wygaszacz

**Rekomendacja: przy starcie procesu I na wejściu `przeliczCenyZRegul`.** Start łapie wygaśnięcia
z czasu postoju, przeliczenie — wygaśnięcia między mutacjami reguł. Oba miejsca są poza ścieżką
importu, więc charakteryzacja zostaje nietknięta. Koszt wykonania jest pomijalny: `promotions`
w produkcji ma dziś 0 wierszy, a i docelowo będą to jednostki.

### ⚠ Promocje „zaplanowane" — tu jest defekt ODWROTNY, nigdzie nieopisany

Skoro status zapisuje się raz przy tworzeniu, to promocja założona z datą startu w przyszłości
dostaje `status: "zaplanowana"` i — jak pokazuje tabela pomiarów — **nie obniża cen**.
Ale nic nie przelicza jej statusu po nadejściu daty startu, więc:

> **Promocja „zaplanowana" NIGDY SIĘ NIE WŁĄCZA.** Zostaje `zaplanowana` na zawsze.

Z tego wynikają dwie rzeczy:
1. **Wygaszacz musi działać w OBIE strony** (`zakonczona` po końcu, `aktywna` po nadejściu startu),
   inaczej 14f naprawi wygaszanie i zostawi niedziałające planowanie. W wariancie (a) to samo:
   warunek musi objąć oba końce zakresu, inaczej „zaplanowana" nadal nie ruszy.
2. **`docs/instrukcja-testow-I4.md` §4 pkt 6 jest NIEPRAWDZIWY.** Mówi Ani, że „promocja z datą
   startu w przyszłości od razu obniża ceny", a założona przez dialog nie obniża niczego i nie
   pokaże znacznika rozbieżności (etykieta z dat i kolumna `status` się zgadzają). §3.9 pozostaje
   **poprawny** i teraz wiadomo dlaczego: PATCH nie rusza statusu, więc promocja utworzona jako
   „aktywna" i przestawiona na daty z 2020 dalej ma w bazie „aktywna".
   Plik jest poza własnością 14e — sprostowanie należy do **14d**.

### Znacznik `rozbieznoscStatusu` (D5 z 4b) — zachowuje się różnie, i to ma znaczenie

- **(b):** nigdy się nie zapali, bo `status` w bazie zrówna się z etykietą liczoną z dat →
  **martwy kod**, usunąć świadomie.
- **(a):** **nadal będzie się zapalał i będzie KŁAMAŁ** — powie „wg dat zakończona, ale nadal
  obniża ceny" o promocji, która już ich nie obniża, bo kolumna `status` zostanie nieprzeliczona.
  Tu usunięcie jest **warunkiem poprawności**, nie kosmetyką.

W obu wariantach nota `nota-daty-promocji` (`DialogReguly.tsx:555-557`, „upływ daty sam jej nie
wyłącza") staje się nieprawdziwa. Testy FE do przepisania: `narzuty.test.tsx:241` i `:256`
(znacznik), `narzuty.dialog.test.tsx:393` i `:400` (nota) — **4 przypadki**.

### Rekomendacja

**(b), i pomiar ją potwierdza — ale nie dlatego, że była wskazana z góry.** Powody, każdy
z liczbą albo z faktem za sobą:

1. **Nie wymaga wyjątku w wyroczni** (0 scenariuszy kontra 1), a wyrocznia uruchamia żywy kod
   produkcji — to najmocniejsza siatka, jaką mamy.
2. **O jeden test mniej** do przepisania (1 kontra 2).
3. **Nie zostawia kłamiącego znacznika** — w (a) trzeba go usunąć, żeby nie wprowadzał w błąd.
4. **Nie wprowadza nowego pojęcia** — stosuje w czasie regułę `status = statusZDat(...)`, którą
   system już stosuje przy tworzeniu promocji.
5. **Odtwarza dosłownie to, co Ania opisała słowami** „reguła znika po końcu obowiązywania":
   wiersz dostaje status `zakonczona` i przestaje obniżać ceny.

**Uczciwie o słabości (b), żeby wybór był świadomy:**
- **Charakteryzacja zostaje zielona, ale ŚLEPA na zmianę.** To nie jest obejście — funkcja
  naprawdę się nie zmienia, więc test naprawdę ma prawo przejść. Ale znaczy to, że nowe
  zachowanie **nie jest objęte wyrocznią** i 14f musi dowieźć własne testy wygaszacza.
- **Okno przy imporcie** (opisane wyżej) — (a) tej dziury nie ma, bo działa na każdym odczycie.
- **`status` jest polem edytowalnym przez API** (`POLA_EDYTOWALNE_PROMOCJI` w
  `repos/promotions.ts:29-38`), więc wygaszacz będzie **nadpisywał ręczne ustawienia**.
  Dziś instrukcja mówi Ani wprost: „żeby naprawdę wyłączyć promocję, musisz zmienić jej status".
  Po (b) status staje się polem **wyliczanym** i ta rada przestaje mieć sens.
  **Do rozstrzygnięcia w 14f: czy odciąć `status` od listy pól edytowalnych.**

**Decyzja należy do użytkownika.** Ta karta dostarcza liczby i nazywa kompromisy; nie przesądza.
## Zmiany

- **Nowy:** `rebuild/backend/test/promocja-warunek-obniza-cene.test.ts` — 8 przypadków,
  zamraża werdykt A (promocja z warunkiem obniża; „globalna" nie).
- **Nowy:** `rebuild/frontend/test/narzuty.edycja-toast.test.tsx` — 11 przypadków,
  zamyka lukę pokrycia zadania B.
- **Nowy:** `docs/tickets/53-CHORE-i14e-diagnoza-promocji/{plan,raport}.md`.
- **Kod produkcyjny: bez zmian** — `git diff` wobec `develop` nie pokazuje ani jednego pliku
  spoza `test/` i `docs/`.

## Odstępstwa od planu

Jedno, drobne i uzgodnione z użytkownikiem przed startem: plan dopuszczał nowy plik testu
wyłącznie w `rebuild/backend/test/`, a powstał też nowy plik w `rebuild/frontend/test/`
(decyzja D2). Żadnego istniejącego pliku testowego nie dotykałem.

## Wyniki bramek

- **Gate odbudowy (fixtures/kontrakt):** **N/D** — karta nie zmienia kodu produkcyjnego, więc
  nie ma nowego zachowania do porównania z nagraniem. Fixtures użyte w roli **odwrotnej**,
  jako kontrola poprawności piaskownicy: stan wyjściowy `GET /api/markups` i `GET /api/promotions`
  w obu piaskownicach zgodny z `contract/fixtures/GET_markups.json` i `GET_promotions.json`
  **co do bajtu**. `contract/**` nietknięty.
- **Backend:** `lint` ✓ · `typecheck` ✓ · `build` ✓ · `test` ✓ **81 plików / 1249 testów**.
- **Frontend:** `lint` ✓ · `typecheck` ✓ · `test` ✓ **49 plików / 772 testy** (liczba po wciągnięciu `develop` z zmergowaną kartą 14a).
- **Dowód wierności ponad bramki:** pełne porównanie katalogu oryginał ↔ odbudowa,
  **7405 produktów, 0 różnic**, w obu wariantach promocji.

## Breaking changes

Brak.

## Znaleziska poboczne i follow-up

1. **Pierwsza mutacja reguły przepisze ~2050 cen w produkcji.** Samo `przeliczCenyZRegul`,
   bez żadnej promocji, zmienia 2050 z 7405 cen — prostuje pozycje rozjechane z aktualnym
   narzutem. Zachowanie oryginału (zmierzone), nie defekt. Warto uprzedzić Anię **przed**
   cutoverem, bo pierwszy zapis dowolnej reguły wygląda jak masowa, niezamówiona zmiana cen.
2. **⚠ DLA KARTY 14f — dwa sprostowania do `docs/instrukcja-testow-I4.md`** (plik poza
   własnością 14e, sprostowanie należy do 14d): **§4 pkt 6 jest NIEPRAWDZIWY** — promocja
   z datą startu w przyszłości założona przez dialog dostaje `status: "zaplanowana"` i NIE
   obniża cen, nie pokaże też znacznika rozbieżności. **Jest za to defekt odwrotny, nigdzie
   nieopisany: promocja „zaplanowana" NIGDY SIĘ NIE WŁĄCZA**, bo nic nie przelicza statusu po
   nadejściu daty startu. 14f musi objąć oba kierunki, inaczej naprawi wygaszanie i zostawi
   niedziałające planowanie.
3. **Ryzyko duplikatu reguły przez pamiętający formularz dodawania** — opisane w sekcji B.
   **Nie wymaga już decyzji:** Ania rozstrzygnęła wątek 19.09 na „zostaw jak jest". Zapisane
   wyłącznie jako obserwacja, gdyby kiedyś wróciło.
4. **Doprecyzowanie backlogu #25:** dopasowanie „globalnej" to **alternatywa** (pusta marka
   *albo* pusta kategoria), a nie koniunkcja; zmierzony przypadek ma pustą markę przy
   wypełnionej kategorii. Poprawione we wpisie.
5. **Zaległość środowiskowa, nie moja zmiana:** `rebuild/frontend/node_modules` w głównym repo
   nie ma `recharts`, choć pakiet jest w `package.json` i `package-lock.json` od ticketa 19.
   Skutek: bramki FE odpalone na nieodświeżonych zależnościach dają **82 fałszywe porażki**
   w 8 plikach (`analityka.*`, `shell`). Po `npm ci` wszystko przechodzi. Ktokolwiek będzie
   uruchamiał bramki FE w głównym repo — najpierw `npm ci`.
6. **⚠ Bezpieczeństwo, poza zakresem karty.** Hasło seeda zapisane jawnie w
   `tools/record-write-fixtures.cjs` jest **tym samym hasłem**, którym otwierają się realne,
   imienne konta produkcyjne w `db/snapshot.db` (zweryfikowane logowaniem w obu piaskownicach).
   Nie cytuję go w artefaktach ticketa. Zgodnie z decyzją użytkownika **nie zakładam wpisu
   w backlogu** — sygnalizuję tutaj i w podsumowaniu PR. Do rozważenia przed cutoverem:
   rotacja haseł tych kont i oddzielenie hasła piaskownicy od produkcyjnego.

## Czego świadomie NIE zrobiłem

- **Nie zaimplementowałem #19** — karta miała go WYCENIĆ. Wdrożenie należy do **14f**,
  po wyborze wariantu przez użytkownika.
- Nie naprawiłem #22 ani #25 — obie decyzje zapadły poza tą kartą (odpowiednio: karta 14h
  i „❌ NIE" z 18.09).
- **Nie ruszałem pól „Do nowej wersji?" w backlogu** — przy scalaniu z `develop` wszystkie trzy
  konflikty rozstrzygnąłem na korzyść `develop`, bo to tam siedzą decyzje Ani i użytkownika.
  Swoje wniosłem wyłącznie jako zmierzone fakty do pola Status.
- **Nie poprawiłem `docs/instrukcja-testow-I4.md`**, mimo że znalazłem w niej nieprawdziwy
  punkt (§4 pkt 6) — plik jest poza własnością tej karty, należy do 14d.
- Po zawężeniu zakresu **przerwałem pomiary zadania A** i nie szukałem dalej defektu
  w dopasowaniu promocji.
- Nie porównywałem zadania B z żywym bundlem FE produkcji (zastrzeżenie w sekcji B).
