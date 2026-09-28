# 53-CHORE-i14e-diagnoza-promocji — diagnoza promocji i wycena kosztu „daty wyłączają promocję"

> Status: Draft
> Branch: `chore/53-i14e-diagnoza-promocji`
> Worktree: `.worktrees/53-CHORE-i14e-diagnoza-promocji`

## Opis ticketa

Karta **ROZPOZNAWCZA**, nie naprawcza (blok I14, podblok 14e). Dopuszczalnym wynikiem jest
„zero zmian w kodzie produkcyjnym + werdykt". Znalezionych defektów **nie naprawiamy** —
opisujemy i proponujemy osobne karty.

Źródło: uwagi Ani z testów Iteracji 4 (`docs/instrukcja-testow-I4.md` §3.7 i §3.11).
Trzy zadania, w kolejności ważności:

**A. ⭐ Czy promocja z warunkiem realnie obniża ceny?** Ania zgłosiła: „Rabaty nie działają
mimo wprowadzenia promocji, nie zaczytała się ona ani w katalogu w kolumnie promocje ani nie
zmieniło na tej podstawie ceny". Druga połowa zdania jest ZNANA i poprawna (kolumna „Promocja"
w katalogu jest martwa — backlog #22, §4 pkt 1 instrukcji) i **nie jest przedmiotem tej karty**.
Rozstrzygnąć POMIAREM, nie lekturą, i porównać z ORYGINAŁEM.

**B. Komunikat „Reguła dodana" po edycji** (§3.11). Czy da się wejść w tryb dodawania MIMO
kliknięcia ołówka; czy realnym skutkiem jest przypadkowe utworzenie DRUGIEJ, podobnej reguły
zamiast edycji istniejącej.

**C. Wycena kosztu zmiany „data końca ma wyłączać promocję"** (§3.9, backlog #19) — zamienić
zdanie „naprawa wymagałaby wyjątku w charakteryzacji importu" w LICZBY.

## Kontekst

### Co już wiadomo z lektury kodu (do weryfikacji empirycznej, nie do powtórzenia)

- Dialog wysyła `status: statusZDat(start, koniec)`, co przy domyślnych datach daje `"aktywna"`
  (`rebuild/frontend/src/pages/narzuty/status.ts:27`, `DialogReguly.tsx:235`).
- Whitelist backendu przepuszcza `warunki` i `status` (`rebuild/backend/src/repos/promotions.ts:29-38`).
- `dodajPromocje` woła przeliczenie całego katalogu (`repos/promotions.ts:67`).
- `promocjaPasuje` wymaga `status === "aktywna"` i — gdy `warunki` są niepuste — sprawdza je
  przez `every`; `zasieg` jest wtedy **ignorowany** (`repos/ceny.ts:121-130`).

Statycznie ścieżka wygląda poprawnie. Karta ma to rozstrzygnąć **pomiarem**.

### Stan bazy `db/snapshot.db` (ustalone w rozpoznaniu, do potwierdzenia w piaskownicy)

| Fakt | Wartość |
|---|---|
| `products` | 7405 wierszy |
| `products` z `marka = 'BKT'` (dokładnie tak, wielkimi) | 954 |
| `markups` | **jeden** wiersz: `typ:"globalny"`, `wartosc:6`, `status:"aktywny"`, `warunki:"[]"` |
| `promotions` | **pusta** — eksperyment startuje bez interferencji |
| Produkty z pustą/NULL `marka` | 1 |
| Produkty z pustą `kategoria` | 0 |

Stan `markups`/`promotions` zgadza się z `contract/fixtures/GET_markups.json`
i `GET_promotions.json` — to jednocześnie sanity-check, że piaskownica stoi na właściwych danych.

### Architektura, której dotyka zadanie B

Każdy zasób (narzut/promocja) ma **dwie oddzielne instancje** `<DialogReguly>`:
- „Dodaj" — zamontowana ZAWSZE, nigdy się nie odmontowuje, stan inicjalizowany raz w `useState`,
  **celowo bez resetu** (`DialogReguly.tsx:337-344` — port `el()` oryginału; to zachowanie
  produkcji opisane Ani w §3.11 „Formularz pamięta ostatnie wpisy");
- „Edytuj" — montowana WARUNKOWO (`TabelaPromocji.tsx:92-98`), `onClose` → unmount, kolejne
  kliknięcie ołówka = nowy mount ze świeżym stanem z propsów.

`edycja = edytowanyNarzut ?? edytowanaPromocja`, `dodawanie = !edycja` (`DialogReguly.tsx:275-281`).
Lektura nie pokazuje ścieżki do błędu — **ale testu, który by to sprawdził, nie ma**:
`rebuild/frontend/test/narzuty.test.tsx` nie klika ołówka i nie sprawdza treści toastu po edycji,
a `narzuty.dialog.test.tsx` testuje dialog wyłącznie w izolacji (montowany wprost z propsami).
To realna luka w siatce — zgłoszenie Ani nie ma dziś niczego, co by je potwierdziło lub obaliło.

### Koszt zmiany #19 — gdzie naprawdę leży

Nie w fixtures (tam zero plików do przenagrania, bo `promotions` jest pusta), tylko w trzech
miejscach testowych, z czego jedno jest drogie: harness charakteryzacji
(`rebuild/backend/test/akceptacja.charakteryzacja.test.ts` + `charakteryzacja/akceptacja/oryginal.mjs`)
**wycina żywy fragment `mirror/backend/index.cjs`** (pilnowany sha256 w `integralnosc.json`)
i używa go jako wyroczni obok naszego portu. Naprawa po naszej stronie rozjedzie się z realnym
kodem produkcji na scenariuszu `promocja-wygasla-nadal-obniza-cene`.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Karta nie zmienia kodu produkcyjnego, więc nie zmienia kontraktu.** GATE odbudowy w swojej
właściwej roli (czy nowy kod zgadza się z fixtures) **nie obowiązuje** — nie ma nowego kodu
produkcyjnego do porównania.

Fixtures wchodzą tu w roli **odwrotnej**: jako punkt odniesienia dla poprawności eksperymentu.
Przed pomiarem sprawdzam, że piaskownica odbudowy i piaskownica oryginału oddają stan zgodny z:

| Fixture | Rola w tej karcie |
|---|---|
| `contract/fixtures/GET_markups.json` | sanity-check stanu wyjściowego (jeden narzut globalny +6%) |
| `contract/fixtures/GET_promotions.json` | sanity-check stanu wyjściowego (lista pusta) |
| `contract/fixtures/GET_products.json` | kształt pól `cenaZakupu`/`cenaSprzedazy`/`marzaPct`, na których liczę |

Ścieżki `contract/openapi.yaml`, których dotyka eksperyment (bez zmian w nich):
`GET/POST /api/markups`, `GET/POST /api/promotions`, `GET /api/products`.

**`contract/**` jest poza własnością tej karty i nie będzie dotykany.**

## Decyzje

- **D1 — karta rozpoznawcza, zero zmian w kodzie produkcyjnym.** Cokolwiek znajdę, nie naprawiam;
  opisuję i proponuję osobną kartę. Wynika wprost z opisu ticketa.
- **D2 — zadanie B rozstrzygane NOWYM plikiem testu FE** (decyzja użytkownika).
  `rebuild/frontend/test/narzuty.edycja-toast.test.tsx` — nowy plik, własna nazwa, nie dotyka kodu
  produkcyjnego ani istniejących testów. *Za:* rozstrzyga empirycznie i zostawia siatkę na
  przyszłość, skoro dziś jej nie ma. *Przeciw:* wymaga zielonych bramek FE. Odrzucone alternatywy:
  samo ręczne kliknięcie (wynik nie zostaje w repo) i sama lektura (karta miała mierzyć).
- **D3 — zadanie A dostaje NOWY plik testu backendu** (decyzja użytkownika).
  `rebuild/backend/test/promocja-warunek-obniza-cene.test.ts` — zamraża werdykt: promocja
  z warunkiem `marka→BKT` obniża cenę wg formuły, promocja „globalna" nie. *Za:* pilnuje
  zachowania, które Ania zgłosiła jako zepsute. *Przeciw:* bramki backendu muszą być zielone.
- **D4 — znalezisko o haśle seeda idzie do `raport.md` (Follow-up) i do podsumowania PR**
  (decyzja użytkownika), **bez cytowania hasła** i **bez wpisu w backlogu** — karta ma uprawnienia
  wyłącznie do #19/#22/#25.
- **D5 — porównanie z oryginałem robię w piaskownicy** metodą z `CLAUDE.md` („Środowisko"):
  kopia bazy, scheduler wygaszony SQL-em **przed** startem procesu, CWD = katalog backendu.
  Bez tego werdykt (b)/(c) nie ma podstawy.
- **D6 — żadnych odstępstw od zachowania oryginału.** Karta niczego nie odtwarza ani nie zmienia,
  więc lista świadomych odstępstw jest pusta.

## Plan realizacji

### Krok 1 — piaskownica odbudowy i pomiar A (odbudowa)
1. Kopia `db/snapshot.db` do katalogu tymczasowego, `DB_PATH` na kopię, port efemeryczny
   (równolegle pracują inne karty — **żadnych stałych portów**).
2. Migracje `npm run migrate:dev` na kopii, start backendu.
3. Stan wyjściowy: `GET /api/markups`, `GET /api/promotions` — porównanie z fixtures.
4. Zapamiętanie `kod`, `cenaZakupu`, `cenaSprzedazy`, `vat` dla kilku produktów `marka = "BKT"`.
5. Narzut globalny +6% już jest w bazie — potwierdzić, że `cenaSprzedazy = floor(zakup × 1,06 × 1,23)`.
6. `POST /api/promotions` z `warunki: [{typ:"marka", wartosc:"BKT"}]`, `rabatPct: 10`, daty domyślne,
   `status: "aktywna"` (dokładnie to, co wysyła dialog).
7. Sprawdzenie, czy ceny BKT spadły i czy zgadzają się z `floor(zakup × 1,06 × 0,90 × 1,23)`.
8. **Powtórka z promocją „globalną"** (`zasieg: "globalny"`, `warunki: "[]"`) na czystej kopii —
   i **zmierzenie, ilu produktów realnie dotyczy** (hipoteza #25: praktycznie zera).

### Krok 2 — ten sam pomiar na ORYGINALE
Piaskownica wg `tools/record-write-fixtures.cjs` (kopia `mirror/backend`, baza jako `data.db`
obok `index.cjs`, `UPDATE suppliers SET czestotliwosc_minuty = NULL` **przed** startem, CWD =
katalog piaskownicy, port efemeryczny). Ten sam scenariusz 4–8 co w Kroku 1, te same produkty.
Porównanie cena-w-cenę.

### Krok 3 — werdykt A
Jedna z trzech postaci:
- **(a)** promocja z warunkiem działa → Ania niemal na pewno miała zaznaczoną „Regułę globalną",
  czyli trafiła w pułapkę #25;
- **(b)** nie działa również w oryginale → defekt produkcji, do decyzji użytkownika;
- **(c)** nie działa TYLKO u nas → **regresja**, opisać dokładnie gdzie.

### Krok 4 — zadanie B
1. Nowy plik `rebuild/frontend/test/narzuty.edycja-toast.test.tsx`: renderuje stronę `/narzuty`,
   klika ołówek przy istniejącej regule, zapisuje, sprawdza **tytuł dialogu** i **treść toastu**;
   drugi przypadek — ponowne otwarcie edycji na INNYM wierszu (czy nie zostaje stan poprzedniego);
   trzeci — czy po edycji dialog „Dodaj" nadal pamięta swoje wpisy (zachowanie oryginału, ma zostać).
2. Rozstrzygnięcie pytania z karty: czy realnym skutkiem jest przypadkowe tworzenie DRUGIEJ,
   podobnej reguły zamiast edycji istniejącej.
3. Jeśli tak — to problem UX **odziedziczony po oryginale**, opis + propozycja osobnej karty,
   **bez cichej poprawki**.

### Krok 5 — zadanie C, wycena w liczbach
Akapit z liczbami, **nie implementacja**. Ma odpowiedzieć konkretnie:
- które bramki/wzorce charakteryzacji faktycznie by się przesunęły i **o ile pól**;
- czy da się to zrobić **BEZ wyjątku** (np. filtrowanie po datach wyłącznie w przeliczaniu cen,
  przy nietkniętym porównaniu z oryginałem) — i jaki to ma koszt;
- **ile fixtures** w `contract/` trzeba by przenagrać;
- czy zmiana dotyka też **promocji z datą startu w przyszłości** (§4 pkt 6 — ta sama przyczyna).

### Krok 6 — test regresji A
`rebuild/backend/test/promocja-warunek-obniza-cene.test.ts` (nowy plik, baza w katalogu
tymczasowym, port efemeryczny — jak reszta testów w projekcie).

### Krok 7 — dokumenty
- `docs/rebuild-roadmap.md` — **wyłącznie** podblok „14e" (dopisany do bloku Iteracja 14),
  ze STANEM: data, ID ticketa, werdykt, zakres faktycznie dowieziony. Ustalenia dotyczące
  przyszłych kart wpisane **do tych kart**, nie do 14e.
- `docs/rebuild-backlog.md` — **wyłącznie** pola Status/fakty we wpisach **#19, #22, #25**.
  Pola „Do nowej wersji?" **nie ruszam** — to decyzja użytkownika.
- `raport.md`, `review.md` w katalogu ticketa.

## Własność plików (ograniczenia karty)

**Wolno pisać wyłącznie do:**
- `docs/tickets/53-CHORE-i14e-diagnoza-promocji/**`
- `docs/rebuild-roadmap.md` — tylko podblok „14e"
- `docs/rebuild-backlog.md` — tylko Status/fakty w #19, #22, #25
- `rebuild/backend/test/promocja-warunek-obniza-cene.test.ts` (NOWY)
- `rebuild/frontend/test/narzuty.edycja-toast.test.tsx` (NOWY)

**NIE wolno ruszać** (zakresy równoległych kart 14a/14b/14c, 14f/14g i triażu):
`rebuild/frontend/src/pages/narzuty/**`, `pages/konfiguracja/**`, `pages/Staging.tsx`,
`contract/**`, ani **dopisywać do istniejących plików testowych**.

## Strategia testowania

- **GATE odbudowy:** N/D — karta nie zmienia kodu produkcyjnego, więc nie ma czego porównywać
  z fixtures. Fixtures użyte odwrotnie: jako kontrola poprawności piaskownicy (patrz wyżej).
- **Dowód dla A:** pomiar na dwóch żywych backendach (odbudowa + oryginał) na kopii tej samej bazy,
  plus nowy test regresji. Bez mocków — mierzę realny silnik na realnych danych.
- **Dowód dla B:** nowy test FE klikający realny komponent.
- **Dowód dla C:** liczby z repo (pliki, przypadki, pola, fixtures) — nie implementacja.
- **Bramki:** skoro dochodzą dwa pliki testowe, backend (`lint`/`typecheck`/`build`/`test`)
  i front muszą być zielone.
- **Porty i baza:** wszystko na kopiach w katalogu tymczasowym, porty efemeryczne — równolegle
  pracują inne karty. „Port zajęty" / „DB lock" = STOP i pytanie do użytkownika, nie zgadywanie.

## Poza zakresem

- **Naprawa czegokolwiek** — #19, #22, #25 zostają jak są; karta produkuje werdykt i wycenę.
- **Kolumna „Promocja" w katalogu** (backlog #22) — znana i potwierdzona jako martwa, nie badam.
- **Decyzje „Do nowej wersji?"** w backlogu — należą do użytkownika.
- **Zakładanie kart 14f/14g** — karta może je najwyżej zaproponować.
- **Rotacja haseł / zmiany w `tools/record-write-fixtures.cjs`** — sygnalizowane, nie realizowane.

## Definition of done

- [ ] Werdykt A zapisany w jednej z trzech postaci (a)/(b)/(c), poparty **pomiarem na odbudowie
      I na oryginale**, z konkretnymi cenami przed/po dla nazwanych produktów BKT
- [ ] Zmierzone, ilu produktów realnie dotyczy promocja „globalna" (weryfikacja hipotezy #25)
- [ ] Werdykt B: czy da się wejść w tryb dodawania mimo kliknięcia ołówka i czy grozi to
      utworzeniem drugiej reguły — poparty nowym testem FE
- [ ] Wycena C: akapit z liczbami (bramki, pola, fixtures, promocje z datą startu w przyszłości)
- [ ] Nowy test backendu i nowy test FE przechodzą; bramki obu stron zielone
- [ ] Podblok „14e" w roadmapie opisuje STAN (data + ID ticketa), nie zamiar
- [ ] Status/fakty w backlogu #19, #22, #25 zaktualizowane; pola „Do nowej wersji?" nietknięte
- [ ] Zero zmian w kodzie produkcyjnym (`git diff` potwierdza)
