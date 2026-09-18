# Iteracja 14 — co poprawiliśmy po Twoich uwagach

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-18

> **To jest STAGING, nie produkcja.** Cokolwiek tu zaakceptujesz, odrzucisz albo zepsujesz —
> produkcji nie dotyka. Testuj bez skrupułów.

> **⚠ Ta kartka jest krótka i celowo niekompletna.**
>
> Jest w niej **wyłącznie to, co zgłosiłaś**, przechodząc instrukcję Iteracji 3 — plus
> odpowiedź, co z tym zrobiliśmy i co masz sprawdzić. **Nie ma tu nic, co już działało**
> i czego nie reklamowałaś. Nie musisz przechodzić testów od początku.
>
> Instrukcja Iteracji 3 **zostaje bez zmian** — miejscami opisuje stan sprzed tych poprawek.
> Gdy coś się różni, **prawdą jest ta kartka**.
>
> Jeśli staging jest pusty — najpierw wgraj jakiś cennik (rozdział 1), inaczej nie będzie
> czego oglądać.

> **Do klikania jest osobna kartka:** [scenariusze testowe](scenariusze-testow-I14.md) —
> 26 ponumerowanych scenariuszy z krokami, oczekiwanym wynikiem i arkuszem na wyniki.
> Ta kartka mówi **dlaczego**, tamta **co kliknąć po kolei**.

**Zgłosiłaś dziesięć rzeczy. Osiem poprawiliśmy, jedna czeka na Twoją decyzję, jednej
świadomie nie ruszamy.** Rozdziały 1–4 to poprawki do sprawdzenia, rozdział 5 to lista
„tego nie zgłaszaj ponownie", rozdział 6 to jedyne zadanie, które zostaje po Twojej stronie.

---

## 1. Wgrywanie ręczne — trzy poprawki

**Gdzie:** Konfiguracja → zakładka **Wgrywanie ręczne**.

### 1.1 Wgrywanie wróciło do okienka

> **Zgłosiłaś:** w starym Bridge wgrywanie otwierało się w okienku, a u nas wszystko było
> wprost na zakładce.

**Jest teraz:** przycisk **„Wgraj pliki"** otwiera **okienko**. W nim: przeciągasz pliki albo
klikasz **„Wybierz pliki z dysku"**, każdy plik dostaje rozpoznanie dostawcy (np.
*MO1 · wysoka pewność · Nazwa pliku pasuje do wzorca*), obok jest lista do ręcznej poprawki
i przycisk **„Usuń"**. **„Dodaj kolejny plik"** dokłada następne bez zamykania okienka,
**„Wyczyść"** czyści listę (okienka nie zamyka). Na koniec **„Importuj do staging"**.

**Sprawdź:** kliknij „Wgraj pliki" → ma się otworzyć okienko, nie formularz na zakładce.

### 1.2 Zniknął licznik „Wgraj (0)"

> **Zgłosiłaś:** po udanym imporcie przycisk pokazywał „Wgraj (0)".

**Jest teraz:** przycisk nazywa się **„Importuj do staging"** i **nie ma żadnej liczby**.
Stary Bridge nigdy licznika w tym miejscu nie miał.

**Sprawdź:** po imporcie na przycisku nie ma nawiasu z liczbą. ⚠ **Brak liczby jest poprawny.**

### 1.3 Wróciła sekcja „Wgrywanie pojedyncze"

> **Zgłosiłaś:** brakuje kafli dostawców, przez które wgrywa się plik z góry ustawionemu
> dostawcy, bez zgadywania po nazwie.

**Jest teraz:** pod pierwszą kartą jest sekcja **„Wgrywanie pojedyncze (z wymuszonym
dostawcą)"** — siatka kafli wszystkich dostawców (kod, nazwa, e-mail) z przyciskiem
**„Wgraj plik"**. Klikasz kafel → to samo okienko, ale dostawca ustawiony na sztywno.

**Sprawdź (najważniejszy test tego rozdziału):** weź plik, który **nazwą** wskazuje na MO1,
i wgraj go przez kafel **MO3**. Pozycje mają wylądować pod **MO3** — wymuszenie ma wygrać
z nazwą pliku.

**Po sprawdzeniu posprzątaj:** to są celowo źle przypisane pozycje, **nie akceptuj ich**.
Wejdź na `/staging`, ustaw „Typ sprawy" na **„Wszystkie"**, wpisz w szukajkę **MO3**, zaznacz
je i kliknij **„Odrzuć zaznaczone"**.

⚠ **Kafle pokazują też MO6**, który jest wyłączony z importu — wgranie przez jego kafel
skończy się odmową. Stary Bridge też nie filtrował kafli, więc **to nie jest błąd**.

### Przy okazji zmieniło się jeszcze to

- **Komunikaty zastąpił dymek (toast)** w rogu ekranu. Tytuł: *„N pozycji czeka na
  akceptację"* albo *„Import zakończony"*. Pod spodem, sklejone kropkami, **tylko niezerowe**
  człony: *Pozycji w plikach · Do akceptacji w stagingu · Nowe · Zmienione · Wycofane ·
  Bez zmian · Odrzucone (nie opony) · Pominięte pliki*.
- **Sekcja „Ostatni import"** pod kaflami — wynik dla każdego pliku plus podgląd pięciu pozycji.
  ⚠ **Podgląd jest PO imporcie, nie przed.** Stary Bridge pokazywał tabelkę zanim zaimportował,
  bo czytał plik w przeglądarce; my czytamy go na serwerze. **To uzgodnione odstępstwo.**
- **Gdy jeden plik jest wadliwy** — czerwony dymek *„Błąd pliku {nazwa}"*, **pozostałe pliki
  idą dalej**.
- **Gdy padnie sam import** — dymek *„Błąd importu"*, a **okienko zostaje otwarte z listą
  plików**, żebyś mogła spróbować ponownie. Pliki wgrane **przed** błędem **są już w stagingu**.

---

## 2. Staging — cztery poprawki

**Gdzie:** `/staging`.

### 2.1 ⭐ Ekran startuje na filtrze „Nowe produkty"

> **Zgłosiłaś:** stary Bridge otwiera staging na „Nowych produktach", u nas było „Wszystkie".

**Jest teraz:** filtr **„Typ sprawy"** startuje na **„Nowe produkty"**.

⚠ **To zmienia działanie przycisków, nie tylko widok.** „Akceptuj wszystkie (N)" i „Odrzuć
wszystkie (N)" działają **na tym, co przepuszcza filtr**. Przy starcie licznik pokazuje liczbę
**nowych** pozycji i przycisk rusza **tylko je**. **Żeby objąć cały staging, musisz świadomie
przestawić filtr na „Wszystkie".** Tak działa stary Bridge — i to właśnie chroni przed
zatwierdzeniem błędów importu i wycofań jednym kliknięciem.

**Sprawdź:** wejdź na `/staging` → filtr stoi na „Nowe produkty"; przestaw na „Wszystkie"
i zobacz, że licznik przy „Akceptuj wszystkie" się zmienia.

### 2.2 Pasek narzędzi ułożony jak w oryginale

> **Zgłosiłaś:** przyciski akcji masowych są w innych miejscach niż w starym Bridge.

**Jest teraz:**

- **w nagłówku** (nad paskiem): **„Akceptuj wszystkie (N)"** i **„Odrzuć wszystkie (N)"** —
  widoczne zawsze, **pytają o potwierdzenie**;
- **w pasku od lewej:** szukajka → „Typ sprawy" z listą → licznik *„N zmian"*;
- **po prawej:** **„Akceptuj zaznaczone (N)"** i **„Odrzuć zaznaczone (N)"** — **pokazują się
  dopiero, gdy coś zaznaczysz** (wcześniej wisiały zawsze); dalej **„Kolumny"**,
  **„Akceptuj widoczne"** i **„Odrzuć widoczne"**.

⚠ **„Zaznaczone" i „widoczne" NIE pytają o potwierdzenie** — działają od razu. Pytają tylko
warianty „wszystkie". Tak jest w oryginale.

**Sprawdź:** przy niczym niezaznaczonym po prawej nie ma przycisków „…zaznaczone"; po
zaznaczeniu jednej pozycji pojawiają się z liczbą „(1)".

### 2.3 Wrócił przycisk „Kolumny"

> **Zgłosiłaś:** w starym Bridge da się włączać i wyłączać kolumny stagingu, u nas nie było
> takiego przycisku.

**Jest teraz:** przycisk **„Kolumny"** otwiera panel **„Widoczne kolumny (staging)"**:
trzy skróty — **„Wszystkie"**, **„Domyślne"** (przywraca stan startowy), **„Żadna"** — oraz
dwie sekcje: **„W tabeli stagingu"** (10 przełączników) i **„Dodatkowe (z katalogu)"**
(49 przełączników). Ustawienia zapamiętują się w przeglądarce.

⚠ **Sekcja „Dodatkowe" nic nie robi i tak ma być.** Panel sam to pisze: *„Te kolumny nie są
jeszcze wyświetlane w tabeli stagingu."* W starym Bridge ta sekcja też była martwa.

### 2.4 ⚠ Trzy kolumny są domyślnie UKRYTE

To **konsekwencja poprawki 2.3**, o której warto wiedzieć, zanim uznasz, że coś zniknęło.

**„Stan", „Cena zakupu" i „Cena sprzedaży" nie są widoczne w tabeli.** Włączasz je przyciskiem
**„Kolumny"**. W starym Bridge zachowują się dokładnie tak samo — jako jedyne kolumny tabeli
nie mają ustawionej domyślnej widoczności.

**Domyślna kolejność nagłówków:** ☑ · Typ · Kod · Nazwa · Dostawca · Magazyn · Zmiana ·
Powód · Akcje.

**Sprawdź:** w tabeli nie ma tych trzech kolumn → kliknij „Kolumny" → włącz je → pojawiają się
na właściwych miejscach (Stan, Cena zakupu i Cena sprzedaży wchodzą między „Magazyn"
a „Zmiana").

### Przy okazji — dwie rzeczy, których nie zgłaszałaś

Znaleźliśmy je sami przy okazji i naprawiliśmy:

- **kolumna „Magazyn"** stała w złym miejscu (teraz jest szósta, jak w oryginale),
- **nagłówek kolumny „Powód"** był skrócony,
- **szukajka mówi teraz prawdę** o tym, po czym szuka: *„Szukaj po kodzie, nazwie, dostawcy
  lub EAN..."*.

---

## 3. Karta dostawcy — trzy poprawki

**Gdzie:** Konfiguracja → zakładka **Dostawcy**.

### 3.1 Przycisk nazywa się „Synchronizuj"

> **Zgłosiłaś:** przycisk ma złą nazwę.

**Jest teraz:** **„Synchronizuj"**, bez „teraz" — sprawdzone w żywym bundlu produkcji.
W trakcie pobierania pokazuje *„Synchronizuję…"*.

⚠ **Instrukcja Iteracji 3 używa starej nazwy w dziewięciu miejscach.** To ta sama akcja.

Bez zmian zostaje: **przycisk jest tylko przy dostawcach `url`.** Przy MO1, MO7, MO8 i MO10
(`mail`) go nie ma i tak ma być.

### 3.2 Wrócił przycisk „Wgraj plik"

> **Zgłosiłaś:** w starym Bridge da się wgrać plik wprost z karty dostawcy, u nas nie było
> takiego przycisku.

**Jest teraz:** przycisk **„Wgraj plik"** przy dostawcach o sposobie dostarczania **`upload`**
i **`mail`** (czyli tam, gdzie nie ma URL-a do pobrania). Przyjmuje **`.csv`, `.xml`, `.xlsx`**.
Po udanym wgraniu dymek **„Plik wczytany"** z treścią *„N produktów, N nowych, N zmienionych"*.
Przy błędzie: dymek **„Błąd"**. W trakcie wgrywania przycisk „Synchronizuj" też jest
zablokowany — jeden wspólny stan zajętości, jak w oryginale.

**Sprawdź:** wgraj plik z karty MO1 → dymek pokazuje **liczby**.

⚠ **Tu odbudowa jest LEPSZA od produkcji — celowo.** Żywy Bridge pokazuje w tym dymku
*„undefined nowych, undefined zmian"*, bo czyta pola, których serwer nigdy nie odsyłał.
Naprawiliśmy to. **Jeśli porównujesz z produkcją i widzisz różnicę — odbudowa ma rację.**
Ten błąd nadal siedzi w produkcji i warto go u siebie poprawić.

### 3.3 Pole „liczba minut" schowane za osobną opcją

> **Zgłosiłaś:** w starym Bridge pole na własną liczbę minut nie wisi od razu obok listy.

**Jest teraz:** częstotliwość wybierasz z listy jedenastu gotowych wartości: *5 min · 15 min ·
30 min · 1 godz. · 2 godz. · 4 godz. · 6 godz. · 12 godz. · **1 dni** · 2 dni · 7 dni*.
Pole na własną liczbę pojawia się **dopiero po wybraniu „Inna wartość (minuty)…"**.

⚠ **Dwie rzeczy, które wyglądają na błąd, a nie są:**
- **„1 dni"** — stary Bridge skleja liczbę ze słowem „dni" bez odmiany. Odtworzone 1:1.
- **Po przełączeniu z gotowej wartości na „Inna wartość" pole jest PUSTE** — nie przepisuje
  tam poprzedniej liczby. Też odtworzone 1:1; dzięki temu da się jawnie wyczyścić harmonogram.

**Sprawdź:** wybierz „4 godz.", potem przełącz na „Inna wartość (minuty)…" → pole się pojawia
i jest puste.

---

## 4. Dwa dziwactwa, które zniknęły

Na Twojej liście „dziwactw odtworzonych celowo" były dwie pozycje, które **już nie obowiązują**.
Naprawiłaś je u siebie **1 września**, my wciągnęliśmy Twoją poprawkę i **potwierdziliśmy ją
pomiarem** (8 września).

**4.1 ✅ WULSTBAND już nie trafia do stagingu jako opona.** Taśma obręczy z Bohnenkampa
i Agrorami była importowana jako opona.
*Pomiar:* dla MO1 licznik odrzuceń spadł **z 1 na 0** przy tych samych **199 kodach** —
rekord jest odrzucany już w parserze, a nie dopiero dalej.
**Sprawdź:** wgraj cennik MO1 i przejrzyj staging — **żadnego WULSTBAND-a**.

**4.2 ✅ NRO i CHO to „Tak" albo puste pole, nie 0/1.**
*Pomiar:* `1` → **„Tak"**, `0` → **puste pole**; dotknęło **MO1 199, MO3 44 i MO9 12 rekordów**.
**Sprawdź:** w Katalogu kolumny NRO i CHO — „Tak" albo pusto, **nigdzie zera ani jedynki**.

> **Wykreśl obie pozycje ze swojej listy dziwactw.**

---

## 5. Czego NIE zgłaszaj ponownie

Trzy rzeczy z Twojej listy, które **zostają takie, jakie są** — i dlaczego.

### 5.1 ⏳ Status dostawcy — czeka na Twoją decyzję

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
status techniczny. **Prośba jest zapisana i czeka na decyzję.** Nie mieści się w tej iteracji,
bo zmienia zachowanie, które dziś jest odtworzone 1:1.

### 5.2 ⏳ EAN w zapisie naukowym — decyzja podjęta, wdrożenie czeka

Komunikat **„zapis naukowy ma tylko null cyfr znaczących"** bierze się z błędu w starym Bridge.
**18 września zdecydowałaś, że taki EAN ma trafiać do katalogu jako PUSTE pole.**

⚠ **Ta zmiana NIE JEST jeszcze wdrożona.** Komunikat **nadal się pojawia** i wygląda identycznie
jak w produkcji. **To nie jest regres — to stan przed wdrożeniem Twojej decyzji.**

### 5.3 Daty promocji — zmierzone, naprawa zaplanowana

Silnik cen **nie pilnuje dat obowiązywania promocji w obie strony**: promocja z datą końca
w **przeszłości** dalej obniża ceny, a promocja z datą startu w **przyszłości** nigdy się sama
nie włącza. Zmierzyliśmy to i wyceniliśmy; naprawa jest zaplanowana, ale jeszcze nie zrobiona.

---

## 6. ⭐ Test rozstrzygający — jedyne zadanie po Twojej stronie

**To najcenniejszy test i wciąż nie został zrobiony.** Nikt poza Tobą go nie wykona, bo wymaga
dostępu do starego Bridge i tych samych plików cennika.

**Na czym polega:** wgrać **ten sam plik** do starego Bridge i do odbudowy, a potem porównać
**liczbę pozycji**, które z niego weszły. Zgadzają się — parsery odtworzyliśmy wiernie.
Nie zgadzają się — to najszybszy sposób, żeby to wykryć przed przejściem na nową wersję.

| Dostawca | Stary Bridge | Odbudowa | Stan |
|---|---|---|---|
| MO1 Bohnenkamp | | | ⚠ sprawdzone **„na oko, bez liczb"** — do powtórzenia |
| MO2 | | | ❌ nieporównane |
| MO3 | | | ❌ nieporównane |
| MO4 | | | ❌ nieporównane |
| MO5 | | | ❌ nieporównane |
| MO6 Uniglory | — | — | nie dotyczy (wyłączony z importu) |
| MO7 | | | ❌ nieporównane |
| MO8 Trelleborg | | | ❌ nieporównane (plik XLSX **i** CSV) |
| MO9 Agrorami | — | — | ⛔ niewykonalne — dane z API, **nie ma pliku** |
| MO10 GRI | | | ❌ nieporównane (plik XLSX) |

**Jak go zrobić:** dla każdego dostawcy weź **jeden i ten sam plik**, wgraj go do starego
Bridge i na https://test.agritires.eu, a potem wpisz do tabeli **dwie liczby**. Liczbę bierz
z podsumowania importu (człony *„Pozycji w plikach"* i *„Do akceptacji w stagingu"*),
**nie „na oko"**.

---

## 7. Lista kontrolna

**Wgrywanie ręczne**

- [ ] „Wgraj pliki" otwiera **okienko**, nie formularz na zakładce (1.1)
- [ ] Na przycisku importu **nie ma licznika** (1.2)
- [ ] Jest sekcja **„Wgrywanie pojedyncze"** z kaflami dostawców (1.3)
- [ ] ⭐ Plik o nazwie MO1, wgrany przez **kafel MO3**, ląduje pod **MO3** (1.3)
- [ ] Po sprawdzeniu **odrzuciłam** te testowe pozycje ze stagingu (1.3)
- [ ] Po błędzie importu **okienko zostaje otwarte**, a wcześniejsze pliki są w stagingu

**Staging**

- [ ] ⭐ Ekran startuje na filtrze **„Nowe produkty"** (2.1)
- [ ] Licznik przy „Akceptuj wszystkie (N)" zmienia się razem z filtrem (2.1)
- [ ] „…**zaznaczone**" pokazują się dopiero **po zaznaczeniu** pozycji (2.2)
- [ ] „…**wszystkie**" **pytają o potwierdzenie**, „…zaznaczone" i „…widoczne" nie (2.2)
- [ ] Przycisk **„Kolumny"** działa, a skrót **„Domyślne"** przywraca stan startowy (2.3)
- [ ] „Stan", „Cena zakupu", „Cena sprzedaży" są ukryte i **dają się włączyć** (2.4)

**Karta dostawcy**

- [ ] Przycisk nazywa się **„Synchronizuj"** (3.1)
- [ ] Przy dostawcach `upload`/`mail` jest przycisk **„Wgraj plik"** (3.2)
- [ ] Dymek po wgraniu pokazuje **liczby**, nie „undefined" (3.2)
- [ ] Pole minut odsłania się po **„Inna wartość (minuty)…"** i jest wtedy **puste** (3.3)

**Naprawione dziwactwa**

- [ ] W stagingu po imporcie MO1 **nie ma WULSTBAND-a** (4.1)
- [ ] W Katalogu **NRO/CHO** to „Tak" albo pusto, **nigdzie 0/1** (4.2)

**Zadanie**

- [ ] ⭐ Tabela z rozdziału 6 wypełniona **liczbami** dla MO1–MO5, MO7, MO8, MO10

---

## 8. Jak zgłaszać

**Zanim zgłosisz — sprawdź rozdział 5 i ramki ⚠.** Pięć rzeczy, które wyglądają na błąd,
a są poprawne: brak licznika na przycisku importu (1.2), MO6 na liście kafli (1.3), brak
trzech kolumn w stagingu (2.4), napis **„1 dni"** i puste pole minut po przełączeniu (3.3),
komunikat o zapisie naukowym (5.2).

**Co dopisać do zgłoszenia:**

- **gdzie** — ekran i sekcja (np. „Konfiguracja → Wgrywanie ręczne, okienko"),
- **co kliknęłaś** i **co się stało** zamiast tego, czego się spodziewałaś,
- **zrzut ekranu** — przy dymkach szczególnie, bo znikają,
- **który plik** wgrywałaś (nazwa i dostawca), jeśli rzecz dotyczy importu,
- czy to samo dzieje się **w starym Bridge** — jeśli tak, prawdopodobnie odtworzyliśmy
  zachowanie celowo i wystarczy, że dasz znać, czy chcesz to zmienić.
