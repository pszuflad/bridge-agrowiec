# 53-CHORE-i14e — raport z diagnozy

## Podsumowanie

Karta rozpoznawcza, zgodnie z założeniem **bez ani jednej zmiany w kodzie produkcyjnym**.

Trzy werdykty:

- **A — werdykt (a): promocja z warunkiem DZIAŁA, i to identycznie w oryginale i w odbudowie.**
  Pomiar na kopii `db/snapshot.db`, na dwóch żywych backendach: po założeniu promocji
  `marka→BKT` z rabatem 10% ceny 954 produktów BKT spadły dokładnie wg
  `floor(zakup × 1,06 × 0,90 × 1,23)`, a porównanie **wszystkich 7405 produktów** między
  oryginałem a odbudową dało **zero rozjazdów**. Zgłoszenie Ani („rabaty nie działają")
  to trafienie w pułapkę backlogu **#25**: promocja z zaznaczoną „Regułą globalną" obejmuje
  **1 produkt na 7405**. Nie ma regresji i nie ma czego naprawiać po naszej stronie.
- **B — nie potwierdzono defektu.** Nie istnieje ścieżka, którą kliknięcie ołówka wchodzi
  w tryb dodawania. Zapis z dialogu edycji leci `PATCH` na id edytowanej reguły, nie pada
  żaden `POST`, toast mówi „zaktualizowana". **Druga reguła nie powstaje.** Ryzyko, na które
  Ania mogła trafić, jest realne, ale leży gdzie indziej — opisane niżej.
- **C — wycena gotowa, decyzja NIE zapadła.** Naprawa #19 kosztuje **1 scenariusz
  charakteryzacji z 31** (3 pola w 1 wierszu), **2 testy jednostkowe** i **0 fixtures**.
  Istnieje wariant omijający charakteryzację, ale ma własny koszt. Poniżej są dwa warianty
  z liczbami i moją rekomendacją; **wybór między nimi — albo pozostawienie stanu jak jest —
  należy do użytkownika.** Ta karta niczego tu nie przesądza.

---

## A. ⭐ Czy promocja z warunkiem realnie obniża ceny?

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

## C. Wycena kosztu: „data końca ma wyłączać promocję" (backlog #19)

### Które bramki i wzorce faktycznie by się przesunęły

**Wariant 1 — wymuszenie dat w `promocjaPasuje`** (obie ścieżki silnika: masowe przeliczenie
i gałąź importu). To jest ta naprawa, o której mówi komentarz w `repos/ceny.ts:108-116`.

| Miejsce | Co się zapala | Rozmiar |
|---|---|---|
| `test/ceny.silnik.test.ts:246-252` | test „⚠ promocja WYGASŁA nadal działa" | 1 test, **2 asercje** (wygasła + z datą startu w przyszłości) |
| `test/narzuty.patch.test.ts:319-331` | „POST promocji obniża ceny natychmiast" — promocja `2026-06-01…2026-08-31`, czyli dziś już wygasła | 1 test, **1 asercja** |
| **Charakteryzacja akceptacji** | scenariusz `promocja-wygasla-nadal-obniza-cene` | **1 z 31 scenariuszy** |
| Charakteryzacja `bulk` | — | **0 z 17 scenariuszy** |
| `test/gate/dane.ts:451` (`PROMOCJA_TESTOWA`, daty w przeszłości) | używana tylko do porównania KSZTAŁTU odpowiedzi (`narzuty.gate.test.ts:129-130`), nie do liczenia cen | **0** |

**Ile pól w charakteryzacji.** Gałąź cenowa zapisuje dokładnie trzy pola, i tyle właśnie by się
rozjechało: **`cena_sprzedazy`, `marza_pct`, `status`** — w **1 wierszu `products`**, w tym
jednym scenariuszu. Harness porównuje jednak całe tabele przez `toEqual` (9 tabel na scenariusz:
`products`, `staging_items`, `manual_overrides`, `link_pamiec_kod`, `link_pamiec_mr`,
`nazwa_pamiec`, `waga_pamiec`, `markups`, `promotions`), więc formalnie padłaby cała asercja
`products` tego scenariusza.

**Dlaczego to boli bardziej, niż sugeruje liczba „1 z 31".** Harness nie porównuje się
z zapisanym oczekiwaniem — on **wycina żywy fragment `mirror/backend/index.cjs`**
(`__bridgeCondMatch` → `recalcPricesFromRules`, pilnowany sha256 w `integralnosc.json`)
i uruchamia **prawdziwy kod produkcji** jako wyrocznię obok naszego portu. Rozjazd na tym
scenariuszu nie jest więc „nieaktualnym oczekiwaniem do poprawienia" — to jest stwierdzenie,
że nasz port przestał liczyć tak jak produkcja. Wyciszenie go = świadome wypisanie jednego
scenariusza spod wyroczni, czyli dokładnie „wyjątek w charakteryzacji", o którym mówi #19.

### Czy da się BEZ wyjątku — tak, ale za cenę niespójności

**Wariant 2 — filtrowanie po datach wyłącznie w `przeliczCenyZRegul`**, przy nietkniętych
`promocjaPasuje` i `zastosujRegulyCenowe`:

| Miejsce | Wariant 1 | Wariant 2 |
|---|---|---|
| Charakteryzacja akceptacji | 1 scenariusz pada | **0** — idzie przez `acceptStaging`, czyli przez `zastosujRegulyCenowe` |
| Charakteryzacja `bulk` | 0 | **0** |
| `ceny.silnik.test.ts:246-252` | pada | **przechodzi** — testuje `promocjaPasuje` wprost |
| `narzuty.patch.test.ts:319-331` | pada | **pada** — idzie przez masowe przeliczenie |
| Fixtures do przenagrania | 0 | 0 |

**Koszt wariantu 2 nie jest testowy, tylko koncepcyjny:** system dostaje **trzecią** odpowiedź
na pytanie „czy wygasła promocja obniża cenę". Dziś są dwie (silnik mówi „tak", etykieta na
liście mówi „zakończona"); po tej zmianie byłoby: masowe przeliczenie mówi „nie", a **import
nadal mówi „tak"** — więc wygasła promocja wróciłaby na produkt przy najbliższej akceptacji
pozycji ze stagingu i cena zmieniałaby się w tę i z powrotem. To gorsze niż dzisiejszy defekt,
bo niestabilne w czasie. **Nie rekomenduję.**

### Ile fixtures trzeba by przenagrać

> **Zero.**

- `contract/fixtures/GET_promotions.json` to `[]` — produkcja nie ma żadnej promocji.
- **Żaden** z fixtures nie zawiera `rabatPct` (sprawdzone na całym katalogu `contract/fixtures/`).
- 7 fixtures niesie `cenaSprzedazy`/`marzaPct` (`GET_products.json`,
  `GET_products_bez-parametrow.json`, `POST_products.json`, `POST_products_items.json`,
  `PATCH_products_id.json`, `PUT_products_id.json`,
  `GET_analytics_prices_product-history.json`), ale skoro w bazie źródłowej nie było promocji,
  żadna z tych wartości nie zależy od dat. **Zmiana nie ruszy ani jednego pola w `contract/`.**

To samo dotyczy danych: w `db/snapshot.db` **nie ma ani jednej promocji**, więc naprawa
na dziś nie zmieniłaby żadnej realnej ceny w produkcji. Koszt jest w całości „na przyszłość".

### Czy dotyczy też promocji z datą startu w przyszłości (§4 pkt 6)

**Tak — to ta sama przyczyna i ta sama linia kodu.** `promocjaPasuje` nie czyta ani `start`,
ani `koniec`; decyduje wyłącznie `status === "aktywna"`. Naprawa musi objąć oba końce zakresu,
inaczej promocja „zaplanowana" nadal obniżałaby ceny przed startem. Test
`ceny.silnik.test.ts:250` sprawdza dziś wprost przypadek `start: "2099-01-01"`, więc
obie gałęzie są pod tą samą asercją i przy naprawie zapalą się razem.

### Co jeszcze stanie się martwe po naprawie

Nie testy, ale warto policzyć — **naprawa unieważnia własną obudowę ostrzegawczą**, dołożoną
świadomie w 4b:

- znacznik `rozbieznosc-statusu-{id}` (`TabelaPromocji.tsx:165`) — po naprawie etykieta z dat
  i zachowanie silnika przestaną się rozjeżdżać, więc **nigdy się nie pokaże**;
  testy `narzuty.test.tsx:241` i `:256` trzeba by przepisać albo usunąć;
- nota w dialogu (`nota-daty-promocji`, `DialogReguly.tsx:555-557`, treść: „Daty są
  informacyjne… upływ daty sam jej nie wyłącza") — stanie się **nieprawdziwa**;
  testy `narzuty.dialog.test.tsx:393` i `:400` do przepisania.

### Wycena zbiorczo

| Pozycja | Wariant 1 (rekomendowany, jeśli w ogóle) | Wariant 2 |
|---|---|---|
| Testy jednostkowe BE | 2 testy (3 asercje) | 1 test (1 asercja) |
| Scenariusze charakteryzacji | 1 z 31 (3 pola, 1 wiersz) | 0 |
| Fixtures `contract/` | 0 | 0 |
| Realne ceny w produkcji dziś | 0 | 0 |
| Artefakty FE do przepisania | 2 miejsca + 4 testy | 2 miejsca + 4 testy |
| Osłabienie wyroczni | **tak** — 1 scenariusz spod żywego kodu produkcji | nie |
| Spójność systemu | zachowana | **złamana** (import kontra przeliczenie) |

**Wniosek do decyzji użytkownika:** naprawa jest **tańsza, niż sugerował komentarz
w `repos/ceny.ts`** — nie „przenagrywanie fixtures", tylko trzy asercje i jeden scenariusz.
Prawdziwą ceną jest wypisanie jednego scenariusza spod wyroczni, która uruchamia realny kod
produkcji. Dopóki produkcja nie zostanie naprawiona tym samym warunkiem, ten wyjątek będzie
oznaczał: „tutaj świadomie różnimy się od Bridge'a, który stoi u Agrowca".

---

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
2. **Ryzyko duplikatu reguły przez pamiętający formularz dodawania** — opis i trzy warianty
   w sekcji B. Wymaga decyzji użytkownika, nie cichej poprawki.
3. **Doprecyzowanie backlogu #25:** dopasowanie „globalnej" to **alternatywa** (pusta marka
   *albo* pusta kategoria), a nie koniunkcja; zmierzony przypadek ma pustą markę przy
   wypełnionej kategorii. Poprawione we wpisie.
4. **Zaległość środowiskowa, nie moja zmiana:** `rebuild/frontend/node_modules` w głównym repo
   nie ma `recharts`, choć pakiet jest w `package.json` i `package-lock.json` od ticketa 19.
   Skutek: bramki FE odpalone na nieodświeżonych zależnościach dają **82 fałszywe porażki**
   w 8 plikach (`analityka.*`, `shell`). Po `npm ci` wszystko przechodzi. Ktokolwiek będzie
   uruchamiał bramki FE w głównym repo — najpierw `npm ci`.
5. **⚠ Bezpieczeństwo, poza zakresem karty.** Hasło seeda zapisane jawnie w
   `tools/record-write-fixtures.cjs` jest **tym samym hasłem**, którym otwierają się realne,
   imienne konta produkcyjne w `db/snapshot.db` (zweryfikowane logowaniem w obu piaskownicach).
   Nie cytuję go w artefaktach ticketa. Zgodnie z decyzją użytkownika **nie zakładam wpisu
   w backlogu** — sygnalizuję tutaj i w podsumowaniu PR. Do rozważenia przed cutoverem:
   rotacja haseł tych kont i oddzielenie hasła piaskownicy od produkcyjnego.

## Czego świadomie NIE zrobiłem

- Nie naprawiłem #19, #22 ani #25 — to karta rozpoznawcza.
- Nie podjąłem decyzji „Do nowej wersji?" w backlogu; zaktualizowałem wyłącznie Status i fakty.
- Nie badałem martwej kolumny „Promocja" w katalogu (#22) — wyłączone z zakresu karty.
- Nie porównywałem zadania B z żywym bundlem FE produkcji (zastrzeżenie w sekcji B).
