# Iteracja 3 — wersja 2: poprawki po Twoich uwagach

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-18 · **Dla:** Ania
**Zastępuje:** [pierwszą wersję](instrukcja-testow-I3.md) z 2026-09-01 — w punktach opisanych niżej

> **To jest STAGING, nie produkcja.** Cokolwiek tu zaakceptujesz, odrzucisz albo zepsujesz —
> produkcji nie dotyka. Testuj bez skrupułów.

---

## Po co ta kartka

Przeszłaś pierwszą wersję tej instrukcji (z 1 września) i zgłosiłaś uwagi. **To jest odpowiedź na nie** — punkt
po punkcie: **co zgłosiłaś**, **jak to naprawiliśmy**, **co kliknąć, żeby to sprawdzić**
i **miejsce na Twoją ocenę**.

**Nie ma tu nic, czego nie zgłaszałaś.** Nie musisz przechodzić testów od początku — scenariusze
z pierwszej wersji dotyczące silnika importu, dopasowania pozycji i wycofań **zostają aktualne**.

**Pierwsza wersja zostaje w repozytorium bez zmian** i miejscami opisuje stan sprzed tych
poprawek. **Gdy coś się różni, prawdą jest ta kartka.**

**Zgłosiłaś dziesięć rzeczy.** Dziewięć poprawiliśmy (rozdziały 1–4) — ostatnią, EAN w zapisie
naukowym (4.3), domknęliśmy po Twojej decyzji z 18 września. Jedna czeka na Twoją decyzję
(rozdział 5). Rozdział 6 to jedyne zadanie, które zostaje
po Twojej stronie.

### Jak wypełniać

Każdy punkt kończy się linijką **Twoja ocena**. Zaznacz i dopisz uwagi:

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

Przy „ŹLE" napisz, **co zobaczyłaś zamiast** oczekiwanego, i **zrób zrzut ekranu** (przy
dymkach szczególnie — znikają po kilku sekundach). Zbiorcze podsumowanie jest w rozdziale 7.

**Punkty oznaczone ⭐ są najważniejsze.** Jeśli masz mało czasu, zrób przynajmniej
**1.3, 2.1, 2.2, 3.2 i 6**.

---

## 0. Zanim zaczniesz

**Zaloguj się** na https://test.agritires.eu. W nagłówku ma być **„Bridge ONE"**.

**Przygotuj pliki:**

| Plik | Do którego punktu |
|---|---|
| cennik **MO1 Bohnenkamp** (CSV) | 1.1, 1.3, 4.1, 4.2 |
| cennik **MO8 Trelleborg** lub **MO10 GRI** (XLSX) | 1.6 |
| **plik celowo wadliwy** | 1.5 |
| po jednym cenniku od MO2, MO3, MO4, MO5, MO7, MO8, MO10 | 6 |

**Plik celowo wadliwy** zrób tak: weź cokolwiek, co nie jest cennikiem — np. zdjęcie albo
dokument — i zmień rozszerzenie na `.csv`, nazywając plik `zepsuty.csv`. Chodzi o to, żeby
Bridge nie rozumiał zawartości.

⚠ **MO6 (Uniglory) jest wyłączony z importu.** Nie szukaj jego cennika — poza punktem 1.7,
gdzie sprawdzamy właśnie odmowę.

**Jeśli staging jest pusty** — zrób najpierw punkt 1.1, inaczej nie będzie czego oglądać
w rozdziale 2.

---

# 1. Wgrywanie ręczne

**Gdzie:** Konfiguracja → zakładka **Wgrywanie ręczne**.

---

## 1.1 Wgrywanie wróciło do okienka

> **Zgłosiłaś:** w starym Bridge wgrywanie otwiera się w okienku, a u nas wszystko było wprost
> na zakładce.

**Jak to naprawiliśmy.** Przepisaliśmy zakładkę na układ ze starego Bridge: wgrywanie zbiorcze
przeniosło się z zakładki **do okienka za przyciskiem „Wgraj pliki"**, a inline'owe komunikaty
pod formularzem zastąpił **dymek (toast)** w rogu ekranu — tak jak w oryginale.

**Sprawdź:**
1. Konfiguracja → **Wgrywanie ręczne**.
2. Na karcie **„Wgraj wiele plików — auto-detekcja"** kliknij **„Wgraj pliki"**.
3. W okienku kliknij **„Wybierz pliki z dysku"** i wskaż cennik MO1.
4. Popatrz, co Bridge napisał przy pliku.
5. Kliknij **„Importuj do staging"**.

**Ma się stać:**
- krok 2 otwiera **okienko**, nie formularz na zakładce;
- przy pliku jest rozpoznanie w rodzaju *„MO1 · wysoka pewność · Nazwa pliku pasuje do wzorca"*;
- po imporcie okienko **zamyka się** i lista plików znika;
- w rogu pojawia się **dymek** z tytułem *„N pozycji czeka na akceptację"* i podsumowaniem
  sklejonym kropkami: *Pozycji w plikach · Do akceptacji w stagingu · Nowe · Zmienione ·
  Wycofane · Bez zmian · Odrzucone (nie opony) · Pominięte pliki*;
- pod kaflami pojawia się sekcja **„Ostatni import"** z wynikiem i podglądem pięciu pozycji.

**⚠ Dwie rzeczy, które NIE są błędem:**
- **w podsumowaniu widać tylko niezerowe człony** — brak „Wycofane" przy pierwszym imporcie
  jest poprawny;
- **podgląd pozycji jest PO imporcie, nie przed.** Stary Bridge pokazywał tabelkę zanim
  zaimportował, bo czytał plik w przeglądarce; my czytamy go na serwerze i inaczej się nie da.
  **To jest uzgodnione odstępstwo**, jedyne w tym rozdziale.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.2 Zniknął licznik „Wgraj (0)"

> **Zgłosiłaś:** po udanym imporcie przycisk pokazywał „Wgraj (0)".

**Jak to naprawiliśmy.** Sprawdziliśmy oryginał: **stary Bridge nigdy nie miał w tym miejscu
licznika**. Licznik był naszym dodatkiem i po imporcie, gdy lista plików się czyściła, pokazywał
zero. Usunęliśmy go, a przycisk nazywa się tak jak w oryginale — **„Importuj do staging"**.
Zostawiliśmy w kodzie ostrzeżenie, żeby nikt go przypadkiem nie przywrócił.

**Sprawdź:**
1. Otwórz okienko przyciskiem **„Wgraj pliki"**, dodaj plik i popatrz na przycisk akcji.
2. Zaimportuj, otwórz okienko ponownie i popatrz jeszcze raz.

**Ma się stać:** przycisk zawsze nazywa się **„Importuj do staging"** — **bez nawiasu z liczbą**,
ani przed importem, ani po.

**⚠ Brak liczby jest poprawny** — nie zgłaszaj tego.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.3 ⭐ Wróciła sekcja „Wgrywanie pojedyncze"

> **Zgłosiłaś:** brakuje kafli dostawców, przez które wgrywa się plik z góry ustawionemu
> dostawcy, bez zgadywania po nazwie.

**Jak to naprawiliśmy.** Odtworzyliśmy brakującą sekcję z oryginału. Pod kartą zbiorczą jest
teraz **„Wgrywanie pojedyncze (z wymuszonym dostawcą)"** — siatka kafli wszystkich dostawców.
Kliknięcie kafla otwiera **to samo okienko**, ale z dostawcą ustawionym na sztywno, więc
rozpoznawanie po nazwie pliku w ogóle się nie uruchamia.

**Sprawdź:**
1. Zjedź do sekcji **„Wgrywanie pojedyncze (z wymuszonym dostawcą)"**.
2. Na kaflu **MO3** kliknij **„Wgraj plik"**.
3. Wskaż cennik, którego **nazwa wskazuje na MO1**.
4. Kliknij **„Importuj do staging"**.
5. Wejdź na **Staging**, ustaw „Typ sprawy" na **„Wszystkie"** i wpisz w szukajkę **MO3**.

**Ma się stać:**
- sekcja z kaflami **istnieje** i pokazuje wszystkich dostawców (kod, nazwa, e-mail);
- tytuł okienka zawiera kod wymuszonego dostawcy;
- zaimportowane pozycje mają dostawcę **MO3**, **nie MO1** — wymuszenie wygrało z nazwą pliku.

**⚠ Posprzątaj od razu po tym teście.** To są celowo źle przypisane pozycje — **nie akceptuj
ich**, bo trafiłyby do katalogu pod złym dostawcą. Zaznacz je na stagingu i kliknij
**„Odrzuć zaznaczone"**.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________
>
> **Posprzątane po teście:** ☐ tak

---

## 1.4 Poprawianie dostawcy wewnątrz okienka

*(część tej samej poprawki co 1.1 — sprawdź przy okazji)*

**Jak to działa.** Przy każdym plikiem na liście jest lista dostawców do ręcznego nadpisania
i przycisk **„Usuń"**. **„Dodaj kolejny plik"** dokłada następne bez zamykania okienka,
a **„Wyczyść"** czyści listę, ale **okienka nie zamyka**.

**Sprawdź:**
1. Otwórz okienko i dodaj plik.
2. Rozwiń listę dostawców przy pozycji i wybierz **innego** niż rozpoznany.
3. Kliknij **„Dodaj kolejny plik"** i dodaj drugi plik.
4. Przy jednej pozycji kliknij **„Usuń"**.
5. Kliknij **„Wyczyść"**.

**Ma się stać:** opis pod nazwą pliku zmienia się na wariant mówiący o wyborze ręcznym; krok 3
dokłada plik bez zamykania okienka; krok 4 usuwa **tylko tę jedną** pozycję; krok 5 czyści listę,
a **okienko zostaje otwarte**.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.5 Wadliwy plik nie zatrzymuje pozostałych

*(zachowanie odtworzone przy okazji 1.1 — warto potwierdzić)*

**Jak to działa.** Gdy jednego pliku nie da się odczytać, Bridge pokazuje dymek o tym pliku
i **idzie dalej z pozostałymi**. Pominięte pliki liczy osobno.

**Sprawdź:**
1. Otwórz okienko i dodaj **oba** pliki naraz: poprawny cennik i `zepsuty.csv`.
2. Kliknij **„Importuj do staging"**.

**Ma się stać:** czerwony dymek **„Błąd pliku zepsuty.csv"**, a **poprawny plik i tak się
importuje** — w podsumowaniu jest człon **„Pominięte pliki: 1"**, a pozycje są w stagingu.

**⚠ Gdyby padł sam import** (nie pojedynczy plik), zobaczysz dymek **„Błąd importu"**,
a **okienko zostanie otwarte z listą plików**, żebyś mogła spróbować ponownie. Pliki wgrane
**przed** błędem **są już w stagingu**. Tego nie da się wywołać na życzenie — jeśli nie trafisz
na taki przypadek, zostaw ten akapit bez oceny.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.6 Plik XLSX wchodzi tak samo jak CSV

**Sprawdź:** otwórz okienko, dodaj cennik XLSX (MO8 albo MO10), zaimportuj.

**Ma się stać:** przy pozycji widać oznaczenie arkusza XLSX i liczbę wierszy, import przechodzi,
pozycje są w stagingu. Okienko informuje, że przyjmuje **CSV i XLSX do 50 MB każdy**.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.7 MO6 odmawia importu

**Sprawdź:** na kaflu **MO6 (Uniglory)** kliknij „Wgraj plik", wskaż dowolny plik i zaimportuj.

**Ma się stać:** import kończy się **odmową** z komunikatem o wyłączeniu MO6 z importu.

**⚠ Kafel MO6 MA być widoczny na liście.** Stary Bridge też nie filtrował kafli — to nie jest
błąd do zgłoszenia.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 2. Staging

**Gdzie:** `/staging`.

---

## 2.1 ⭐ Ekran startuje na filtrze „Nowe produkty"

> **Zgłosiłaś:** stary Bridge otwiera staging na „Nowych produktach", u nas było „Wszystkie".

**Jak to naprawiliśmy.** Zmieniliśmy wartość startową filtra na **„Nowe produkty"**, zgodnie
z oryginałem.

**Sprawdź:**
1. Przeładuj stronę (F5) i wejdź na **Staging**.
2. Popatrz na filtr **„Typ sprawy"** i rozwiń listę.

**Ma się stać:** filtr stoi na **„Nowe produkty"**, a na liście jest sześć opcji:
*Wszystkie · Nowe produkty · Nowe produkty (stare) · Wycofane · Zmiany kluczowe · Błędy importu*.

**⚠ „Nowe produkty (stare)" nic nie znajdzie** — to pozostałość po starszym oznaczeniu pozycji,
zostawiona, bo jest w oryginale. Nowy import jej nie produkuje.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 2.2 ⭐ Co ta zmiana robi z przyciskami „Akceptuj/Odrzuć wszystkie"

**To nie jest osobna poprawka, tylko konsekwencja 2.1 — i najważniejsza rzecz do zrozumienia
na tym ekranie.**

**Jak to działa.** Przyciski **„Akceptuj wszystkie (N)"** i **„Odrzuć wszystkie (N)"** działają
**na tym, co przepuszcza filtr**, a nie na całym stagingu. Przy starcie licznik `N` pokazuje
liczbę **nowych** pozycji i przycisk zatwierdza **tylko je**. Tak jest w starym Bridge — i to
właśnie chroni przed zatwierdzeniem błędów importu i wycofań jednym kliknięciem.

**Sprawdź:**
1. Przy filtrze **„Nowe produkty"** zapisz liczbę z przycisku **„Akceptuj wszystkie (N)"**.
2. Przestaw filtr na **„Wszystkie"** i zapisz nową liczbę.
3. Przestaw na **„Błędy importu"** i zapisz liczbę raz jeszcze.

**Ma się stać:** liczba **zmienia się razem z filtrem**.

**⚠ Żeby ruszyć CAŁY staging, musisz świadomie przestawić filtr na „Wszystkie".**

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 2.3 Pasek narzędzi ułożony jak w oryginale

> **Zgłosiłaś:** przyciski akcji masowych są w innych miejscach niż w starym Bridge.

**Jak to naprawiliśmy.** Złożyliśmy pasek w jeden rząd zgodnie z oryginałem: warianty
**„wszystkie"** przeniosły się **do nagłówka** nad paskiem, a warianty **„zaznaczone"**
są renderowane **warunkowo** — pokazują się dopiero, gdy coś zaznaczysz. Wcześniej wisiały
tam zawsze.

**Sprawdź:**
1. Nic nie zaznaczaj i popatrz na prawą stronę paska.
2. Zaznacz **jedną** pozycję, potem **drugą**.
3. Odznacz obie.

**Ma się stać:**
- krok 1: przycisków **„Akceptuj/Odrzuć zaznaczone"** **NIE MA**;
- krok 2: pojawiają się z liczbą **(1)**, potem **(2)**;
- krok 3: **znikają**;
- cały czas widoczne są **„Kolumny"**, **„Akceptuj widoczne"**, **„Odrzuć widoczne"**,
  a w nagłówku **„Akceptuj wszystkie (N)"** i **„Odrzuć wszystkie (N)"**;
- szukajka mówi teraz prawdę o tym, po czym szuka:
  **„Szukaj po kodzie, nazwie, dostawcy lub EAN..."**.

**⚠ Tylko warianty „wszystkie" pytają o potwierdzenie.** „Zaznaczone" i „widoczne" działają
od razu — tak jest w oryginale. Sprawdź to: kliknij „Akceptuj wszystkie (N)" → pojawi się
okienko **„Akceptacja wszystkich pozycji"** z pytaniem *„Zaakceptować wszystkie pasujące
pozycje (N)?"*; **anuluj je**.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 2.4 Wrócił przycisk „Kolumny"

> **Zgłosiłaś:** w starym Bridge da się włączać i wyłączać kolumny stagingu, u nas nie było
> takiego przycisku.

**Jak to naprawiliśmy.** W starym Bridge ta funkcja była **osobnym skryptem doklejanym obok
aplikacji**. Przenieśliśmy ją do środka jako normalną część ekranu — razem z listą 61 kolumn,
zapisywaniem wyboru w przeglądarce i wszystkimi trzema skrótami.

**Sprawdź:**
1. Kliknij **„Kolumny"**.
2. Policz sekcje i przeczytaj nagłówek panelu.
3. Kliknij **„Żadna"**, potem **„Wszystkie"**, potem **„Domyślne"**.

**Ma się stać:** panel nazywa się **„Widoczne kolumny (staging)"** i ma dwie sekcje:
**„W tabeli stagingu"** (10 przełączników) i **„Dodatkowe (z katalogu)"** (49 przełączników).
**„Żadna"** chowa wszystko, co da się schować; **„Wszystkie"** włącza całą pierwszą sekcję;
**„Domyślne"** przywraca stan startowy.

**⚠ Sekcja „Dodatkowe" nic nie zmienia w tabeli i tak ma być.** Panel sam to pisze:
*„Te kolumny nie są jeszcze wyświetlane w tabeli stagingu."* W starym Bridge ta sekcja też
była martwa — odtworzyliśmy ją razem z tą właściwością.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 2.5 ⚠ Trzy kolumny są domyślnie ukryte

**To konsekwencja 2.4, o której trzeba wiedzieć, zanim uznasz, że coś zniknęło.**

**Jak to działa.** **„Stan", „Cena zakupu" i „Cena sprzedaży"** nie są widoczne w tabeli.
W starym Bridge zachowują się dokładnie tak samo — jako jedyne kolumny tabeli nie mają
ustawionej domyślnej widoczności. Włączasz je przyciskiem **„Kolumny"**.

**Sprawdź:**
1. Po kliknięciu **„Domyślne"** spisz nagłówki tabeli po kolei.
2. Włącz w panelu **Stan**, **Cena zakupu**, **Cena sprzedaży** i spisz nagłówki ponownie.
3. Przeładuj stronę (F5).

**Ma się stać:**
- krok 1 daje: **☑ · Typ · Kod · Nazwa · Dostawca · Magazyn · Zmiana · Powód · Akcje**;
- krok 2: trzy nowe kolumny wchodzą **między „Magazyn" a „Zmiana"**;
- krok 3: ustawienie **przeżywa odświeżenie** (zapisuje się w przeglądarce).

**Przy okazji naprawiliśmy dwie rzeczy, których nie zgłaszałaś:** kolumna **„Magazyn"** stała
w złym miejscu (teraz jest szósta, jak w oryginale), a nagłówek kolumny **„Powód"** był
skrócony.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 3. Karta dostawcy

**Gdzie:** Konfiguracja → zakładka **Dostawcy**.

---

## 3.1 Przycisk nazywa się „Synchronizuj"

> **Zgłosiłaś:** przycisk ma złą nazwę.

**Jak to naprawiliśmy.** Sprawdziliśmy nazwę **w żywym pliku produkcji**, nie w dokumentacji:
jest **„Synchronizuj"**, bez „teraz". Poprawiliśmy etykietę.

**Sprawdź:**
1. Znajdź dostawcę o sposobie dostarczania **`url`** i przeczytaj etykietę przycisku.
2. Kliknij go i popatrz na etykietę w trakcie pobierania.
3. Znajdź dostawcę **`mail`** (MO1, MO7, MO8 albo MO10) i poszukaj tego przycisku.

**Ma się stać:** etykieta to **„Synchronizuj"**; w trakcie pobierania **„Synchronizuję…"**;
przy dostawcach `mail` przycisku **nie ma** i tak ma być.

**⚠ Pierwsza wersja mówi „Synchronizuj teraz" w dziewięciu miejscach** — to ta sama
akcja, stara nazwa.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 3.2 ⭐ Wrócił przycisk „Wgraj plik"

> **Zgłosiłaś:** w starym Bridge da się wgrać plik wprost z karty dostawcy, u nas nie było
> takiego przycisku.

**Jak to naprawiliśmy.** Dodaliśmy przycisk przy dostawcach **`upload`** i **`mail`** — czyli
tam, gdzie nie ma URL-a do pobrania. **Przy okazji znaleźliśmy błąd w samej produkcji:** dymek
po wgraniu czyta pola, których serwer nigdy nie odsyłał, i dlatego żywy Bridge do dziś pokazuje
*„undefined nowych, undefined zmian"*. **U nas czyta pola, które naprawdę przychodzą** — więc
w tym jednym miejscu odbudowa jest lepsza od oryginału, celowo.

**Sprawdź:**
1. Znajdź kartę dostawcy o sposobie **`upload`** lub **`mail`** (np. MO1).
2. Kliknij **„Wgraj plik"** i wskaż cennik.
3. Przeczytaj dymek — **zrób zrzut ekranu, zanim zniknie**.
4. Sprawdź kartę dostawcy **`url`** — czy tam też jest ten przycisk.

**Ma się stać:**
- przycisk jest przy `upload` i `mail`, **nie ma** go przy `url`;
- dymek **„Plik wczytany"** z treścią *„N produktów, N nowych, N zmienionych"* — **z liczbami**;
- przycisk „Synchronizuj" jest w tym czasie zablokowany (jeden wspólny stan zajętości,
  jak w oryginale).

**⚠ Tu polaryzacja jest odwrotna niż zwykle: jeśli zobaczysz „undefined" — TO JEST BŁĄD,
zgłoś go.** A jeśli porównujesz z produkcją i widzisz różnicę w tym dymku — **odbudowa ma
rację, produkcja nie.** Ten błąd nadal siedzi u Ciebie i warto go poprawić.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 3.3 Pole „liczba minut" schowane za osobną opcją

> **Zgłosiłaś:** w starym Bridge pole na własną liczbę minut nie wisi od razu obok listy.

**Jak to naprawiliśmy.** Odtworzyliśmy furtkę z oryginału: pole pojawia się **dopiero po
wybraniu „Inna wartość (minuty)…"**.

**Sprawdź:**
1. Przy dowolnym dostawcy kliknij **„Zmień"**.
2. Rozwiń listę **„Co ile sprawdzać cennik"** i spisz opcje.
3. Wybierz **„4 godz."** — popatrz, czy pod listą jest pole na liczbę.
4. Przestaw na **„Inna wartość (minuty)…"** — popatrz na pole.
5. Wpisz `90` i kliknij **„Zapisz"**.
6. Popatrz na odznakę na karcie, potem wejdź w **„Zmień"** jeszcze raz.

**Ma się stać:**
- lista ma jedenaście gotowych wartości: *5 min · 15 min · 30 min · 1 godz. · 2 godz. ·
  4 godz. · 6 godz. · 12 godz. · **1 dni** · 2 dni · 7 dni*, a pod nimi
  **„Inna wartość (minuty)…"**;
- w kroku 3 pola na liczbę **nie ma**;
- w kroku 4 pole **się pojawia i jest PUSTE**;
- po zapisie odznaka pokazuje **„2 godz."** (etykieta zaokrągla 90 minut), a po ponownym
  wejściu w edycję lista stoi na **„Inna wartość (minuty)…"** z wpisanym `90`.

**⚠ Dwie rzeczy, które wyglądają na błąd, a są odtworzone 1:1:**
- **„1 dni"** zamiast „1 dzień" — stary Bridge skleja liczbę ze słowem bez odmiany;
- **puste pole** po przełączeniu z gotowej wartości — nie przepisuje tam poprzedniej liczby.
  Dzięki temu da się jawnie wyczyścić harmonogram.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 4. Trzy dziwactwa, które zniknęły

Na Twojej liście „dziwactw odtworzonych celowo" były pozycje, które **już nie obowiązują**.
Dwie pierwsze naprawiłaś u siebie **1 września**; my wciągnęliśmy Twoją poprawkę i
**potwierdziliśmy ją pomiarem** 8 września. **Trzecia (4.3) to Twoja decyzja z 18 września** —
tę wdrożyliśmy my i jest gotowa do sprawdzenia.

---

## 4.1 WULSTBAND nie trafia już do stagingu jako opona

**Jak to naprawiliśmy.** Przenieśliśmy Twoją poprawkę (filtr akcesoriów przestał rozróżniać
wielkość liter) i zmierzyliśmy efekt: dla MO1 licznik odrzuceń spadł **z 1 na 0** przy tych
samych **199 kodach** — rekord jest odrzucany już w parserze, a nie dopiero dalej.

**Sprawdź:** po imporcie cennika MO1 wpisz **WULSTBAND** w szukajkę na **Stagingu**
(filtr „Wszystkie"), a potem w **Katalogu**.

**Ma się stać:** **zero wyników** w obu miejscach.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 4.2 NRO i CHO to „Tak" albo puste pole, nie 0/1

**Jak to naprawiliśmy.** Przenieśliśmy Twoją poprawkę i zmierzyliśmy: `1` → **„Tak"**,
`0` → **puste pole**; zmiana dotknęła **MO1 199, MO3 44 i MO9 12 rekordów**.

**Sprawdź:** w **Katalogu** przejrzyj kilkadziesiąt wierszy w kolumnach **NRO** i **CHO**.

**Ma się stać:** wyłącznie **„Tak"** albo **puste pole**. **Nigdzie `0` ani `1`.**

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 4.3 EAN zepsuty zapisem naukowym nie trafia już do Katalogu

**Co zgłaszałaś.** Przy niektórych pozycjach na Stagingu pojawia się ostrzeżenie
**„zapis naukowy ma tylko null cyfr znaczących — EAN niepewny"**. Bierze się stąd, że Excel
zamienia długi numer EAN na skrót w rodzaju **`6,41944E+12`** i po drodze **gubi cyfry**.
Stary Bridge mimo to zapisywał do Katalogu „odtworzoną" wartość — numer, który wygląda
na prawdziwy EAN, a nim nie jest.

**Twoja decyzja z 18 września:** taki EAN ma trafiać do Katalogu jako **PUSTE pole**.

**Jak to zrobiliśmy.** Pozycja przechodzi przez import normalnie, a pole **EAN w Katalogu
zostaje puste**. Celowo zostawiliśmy przy tym dwie rzeczy:

- **ostrzeżenie na Stagingu nadal się pojawia** — żeby pominięty EAN nie zniknął po cichu;
- w Katalogu **zostaje surowa wartość z cennika** (`6,41944E+12`) w kolumnach pomocniczych,
  więc zawsze widać, **dlaczego** pole EAN jest puste i da się je potem uzupełnić ręcznie.

> ⚠ **To jedyne miejsce w tej iteracji, gdzie ŚWIADOMIE robimy inaczej niż stary Bridge.**
> Produkcja dalej zapisuje tam zmyśloną wartość. Różnica jest zamierzona i jest nią Twoja decyzja.

**Sprawdź — tylko jeśli natrafisz.** Ta sytuacja zdarza się **rzadko**: prawie wszystkie cenniki
są czyszczone wcześniej i EAN dociera do importu już jako same cyfry. Nie ma sensu, żebyś jej
szukała na siłę. Jeśli natomiast **zobaczysz na Stagingu ostrzeżenie o zapisie naukowym**:

1. zaakceptuj tę pozycję,
2. odszukaj ją w **Katalogu** (po kodzie albo nazwie),
3. spójrz na kolumnę **EAN**.

**Ma się stać:** kolumna **EAN pusta**. Ostrzeżenie na Stagingu **ma tam zostać** — to nie błąd.

> **Twoja ocena:** ☐ OK ☐ ŹLE ☐ nie natrafiłam — uwagi: _______________

---

> **Wszystkie trzy pozycje wykreśl ze swojej listy dziwactw.**

---

# 5. Czego NIE zgłaszaj ponownie

Rzeczy, które **zostają takie, jakie są**. Tu nie ma czego klikać — to jest wyjaśnienie,
żebyś nie traciła czasu na ponowne zgłaszanie.

## 5.1 ⏳ Status dostawcy — czeka na Twoją decyzję

Ustawiasz status **wstrzymany**, zapisujesz — a karta dalej pokazuje *aktywny* albo *błąd*.
Bridge (stary i nowy tak samo) **wylicza status wyświetlany na bieżąco** i nadpisuje nim to,
co zapisałaś:

| Sytuacja dostawcy | Co pokaże karta |
|---|---|
| ostatni import udany, są produkty w katalogu | *aktywny* |
| ostatni import udany, zero produktów w katalogu | *błąd* |
| ostatni import ponad **30 dni** temu | *wstrzymany* |
| nigdy nic nie zaimportował | *wstrzymany* |
| nigdy nic nie zaimportował, ale ma produkty | Twoja wartość z pola **Status** |

**Twoje wstrzymanie mimo to DZIAŁA** — jest zapisane i to ono, a nie napis na karcie, blokuje
automatyczne pobieranie. Ręczne **„Synchronizuj"** przechodzi mimo wstrzymania i tak ma być.

**Poprosiłaś, żeby karta pokazywała dwa pola osobno** — Twoje ustawienie ręczne i wyliczony
status techniczny. **Prośba jest zapisana i czeka na Twoją decyzję.** Nie weszła do tej
iteracji, bo zmieniłaby zachowanie, które dziś jest odtworzone 1:1 — a to wymaga osobnego
ustalenia, nie decyzji programisty.

## 5.2 ✅ EAN w zapisie naukowym — WDROŻONE, przeniesione do punktu 4.3

Twoja decyzja z 18 września **jest już wdrożona** — opis i sprawdzenie przeniosły się do
**punktu 4.3**. Zostaje jedna rzecz warta zapamiętania: **ostrzeżenie „zapis naukowy ma tylko
null cyfr znaczących" nadal pojawia się na Stagingu** i tak ma być. Samo dziwnie brzmiące
słowo **„null"** w tym komunikacie to usterka starego Bridge'a, którą **odtworzyliśmy celowo**,
żeby nie mieszać dwóch zmian naraz — jest zapisana osobno. **Nie zgłaszaj jej ponownie.**

## 5.3 ✅ Daty promocji — WDROŻONE kartą 14f (2026-09-19)

Silnik cen teraz honoruje daty w obie strony: promocja z minioną datą końca sama przestaje
obniżać ceny, a promocja z datą startu w przyszłości sama się włącza, gdy ta data nadejdzie.
Zmiana statusu jest widoczna od razu po zapisie dowolnej reguły i po restarcie procesu; jeśli
nikt niczego nie zapisuje, a mija sama data, pilnuje tego automat co 5 minut — więc bywa
widoczna z kilkuminutowym opóźnieniem. Szczegóły:
`docs/tickets/64-FEATURE-i14f-daty-koncza-promocje/`.

---

# 6. ⭐ Test rozstrzygający — jedyne zadanie po Twojej stronie

**To najcenniejszy test całego zestawu i wciąż nie został zrobiony. Nikt poza Tobą go nie
wykona**, bo wymaga dostępu do starego Bridge.

**Na czym polega:** wgrać **ten sam plik** do starego Bridge i do odbudowy, a potem porównać
**liczbę pozycji**, które z niego weszły. Zgadzają się — parsery odtworzyliśmy wiernie.
Nie zgadzają się — to najszybszy sposób, żeby to wykryć przed przejściem na nową wersję.

**Jak go zrobić — dla każdego dostawcy:**
1. Wgraj plik do **starego Bridge**. Zapisz liczbę **wczytanych pozycji** i liczbę pozycji,
   które trafiły **do poczekalni**.
2. Wgraj **dokładnie ten sam plik** na https://test.agritires.eu.
3. Z dymka podsumowania zapisz człony **„Pozycji w plikach"** i **„Do akceptacji w stagingu"**.
4. Wpisz liczby do tabeli i porównaj.

⚠ **Nie oceniaj „na oko" — wpisz liczby.** Poprzednie podejście do MO1 zrobiono bez liczb
i dlatego nie liczy się jako wykonane.

| Dostawca | Stary: w plikach | Stary: w poczekalni | Nowy: w plikach | Nowy: w stagingu | Zgodne? |
|---|---|---|---|---|---|
| MO1 Bohnenkamp | | | | | |
| MO2 | | | | | |
| MO3 | | | | | |
| MO4 | | | | | |
| MO5 | | | | | |
| MO6 Uniglory | — | — | — | — | nie dotyczy (wyłączony) |
| MO7 | | | | | |
| MO8 Trelleborg (CSV) | | | | | |
| MO8 Trelleborg (XLSX) | | | | | |
| MO9 Agrorami | — | — | — | — | ⛔ niewykonalne (API, brak pliku) |
| MO10 GRI (XLSX) | | | | | |

**Każda rozbieżność to znalezisko — zgłoś ją razem z plikiem.**

> **Wykonane:** ☐ tak ☐ częściowo ☐ nie — uwagi: _______________

---

# 7. Podsumowanie

| Punkt | Co sprawdzasz | OK | ŹLE | Uwagi |
|---|---|:--:|:--:|---|
| 1.1 | Wgrywanie w okienku, dymek, „Ostatni import" | ☐ | ☐ | |
| 1.2 | Brak licznika na przycisku importu | ☐ | ☐ | |
| **1.3** ⭐ | **Kafle dostawców, wymuszenie MO1 → MO3** | ☐ | ☐ | |
| 1.4 | Poprawianie dostawcy w okienku | ☐ | ☐ | |
| 1.5 | Wadliwy plik nie blokuje reszty | ☐ | ☐ | |
| 1.6 | Plik XLSX wchodzi | ☐ | ☐ | |
| 1.7 | MO6 odmawia importu | ☐ | ☐ | |
| **2.1** ⭐ | **Domyślny filtr „Nowe produkty"** | ☐ | ☐ | |
| **2.2** ⭐ | **Zakres „Akceptuj wszystkie" zależy od filtra** | ☐ | ☐ | |
| 2.3 | Pasek narzędzi, warunkowe przyciski, potwierdzenia | ☐ | ☐ | |
| 2.4 | Przycisk „Kolumny" i trzy skróty | ☐ | ☐ | |
| 2.5 | Trzy ukryte kolumny dają się włączyć | ☐ | ☐ | |
| 3.1 | Etykieta „Synchronizuj" | ☐ | ☐ | |
| **3.2** ⭐ | **„Wgraj plik" pokazuje liczby, nie „undefined"** | ☐ | ☐ | |
| 3.3 | Pole minut za „Inna wartość" | ☐ | ☐ | |
| 4.1 | Brak WULSTBAND-u | ☐ | ☐ | |
| 4.2 | NRO/CHO jako „Tak"/puste | ☐ | ☐ | |
| 4.3 | EAN z zapisu naukowego → puste pole w Katalogu *(tylko jeśli natrafisz)* | ☐ | ☐ | |
| **6** ⭐ | **Test rozstrzygający — tabela z liczbami** | ☐ | ☐ | |

**Sprawdzonych ____ / 19 · błędów ____ · pominiętych ____**

*(punkt 4.3 zdarza się rzadko — jeśli nie natrafisz, policz go jako pominięty)*

---

# 8. Jak zgłosić znalezisko

**Najpierw sprawdź ramki ⚠ przy danym punkcie i rozdział 5.** Sześć rzeczy wygląda na błąd,
a jest poprawnych: podgląd pozycji po imporcie zamiast przed (1.1), brak licznika na przycisku
(1.2), MO6 na kaflach (1.7), martwa sekcja „Dodatkowe" i trzy ukryte kolumny (2.4, 2.5),
napis **„1 dni"** i puste pole minut (3.3), ostrzeżenie o zapisie naukowym na Stagingu (4.3, 5.2).

**W zgłoszeniu podaj:**

- **numer punktu** (np. „2.2") i **numer kroku**, na którym się wywróciło,
- **co zobaczyłaś** zamiast tego, co miało się stać,
- **zrzut ekranu** — przy dymkach szczególnie, bo znikają po kilku sekundach,
- **który plik** wgrywałaś (nazwa i dostawca), jeśli rzecz dotyczy importu,
- czy to samo dzieje się **w starym Bridge** — jeśli tak, prawdopodobnie odtworzyliśmy
  zachowanie celowo i wystarczy, że dasz znać, czy chcesz je zmienić.
