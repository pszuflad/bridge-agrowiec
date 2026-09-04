# Iteracja 10 (Analityka + Pulpit) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-04

> **To jest STAGING, nie produkcja.** Cokolwiek tu ustawisz albo zepsujesz — produkcji nie
> dotyka. Testuj bez skrupułów.

> **⚠ NAJWAŻNIEJSZA RZECZ, ZANIM ZACZNIESZ — inaczej połowa ekranów wyda Ci się zepsuta.**
>
> Analityka ma dwa rodzaje widoków. Jedne liczą z **bieżącego katalogu** — te zadziałają od
> razu, jak tylko będą produkty. Drugie liczą ze **zmian cen w czasie** — a tych na stagingu
> jeszcze prawie nie ma, bo **historia cen rośnie wyłącznie wtedy, gdy import sam zatwierdzi
> zmianę ceny**. Jeden import to jeden punkt na wykresie; wykres potrzebuje co najmniej dwóch,
> w różnych miesiącach.
>
> **Świeżo po wdrożeniu widoki czasowe będą więc puste i to jest poprawne.** Powie Ci to wprost
> banner na górze `/analityka`: *„Historia cen dopiero zacznie się zbierać po wdrożeniu…"*.
> Kiedy historia się pojawi, banner zamieni się w *„Historia cen: N snapshotów od …"*.
>
> **Dwie karty są puste ZAWSZE, niezależnie od danych** — to znany błąd starego Bridge'a,
> odtworzony celowo. Które i dlaczego: [sekcja 6](#6--rzeczy-które-wyglądają-na-błąd-a-są-poprawne).

---

## 1. Co dowozi Iteracja 10

Dwa ekrany:

- **Pulpit** (`/`, strona główna po zalogowaniu) — dotąd był zaślepką „widok w przygotowaniu".
  Teraz pokazuje cztery kafle z kluczowymi liczbami, najnowsze powiadomienia i tabelę
  aktywności dostawców.
- **Analityka** (`/analityka`) — pięć zakładek, **dwanaście kart** z tabelami i wykresami,
  wspólny pasek sześciu filtrów, oraz **eksport CSV** z dziesięciu kart.

**Sedno do sprawdzenia — pięć rzeczy:**

1. **Liczby się zgadzają z tym, co widzisz w katalogu i stagingu.** Kafle Pulpitu i nagłówka
   analityki liczą to samo, co odpowiednie ekrany.
2. **Filtry działają wspólnie na całą stronę** — zaznaczasz dostawcę raz, a zawężają się
   wszystkie karty, które umieją to zastosować. Te, które nie umieją, **mówią o tym wprost**.
3. **Eksport CSV otwiera się w Excelu poprawnie** — z polskimi znakami i podziałem na kolumny.
4. **Eksport CSV to NIE jest to samo, co widać w tabeli** — i tak ma być. Szczegóły niżej.
5. **Puste karty to najczęściej brak historii cen, a nie awaria** — trzeba umieć odróżnić
   jedno od drugiego.

---

## 2. Przygotowanie

**Czego potrzebujesz:** konta w panelu i **produktów w katalogu**. Bez produktów wszystkie
tabele będą puste i nie sprawdzisz niczego.

### 2.1 Minimum — żeby cokolwiek się policzyło

Jeśli katalog jest pusty, zaimportuj cennik choć jednego dostawcy:
**Konfiguracja → Dostawcy → Wgraj plik** albo **Synchronizuj teraz**
(dokładnie jak w [instrukcji I3](instrukcja-testow-I3.md), sekcja 2).

Najlepiej zaimportuj **co najmniej dwóch różnych dostawców** — inaczej karty porównujące
dostawców (1.1, 1.4/1.5, 2.1-2.4) będą miały po jednym wierszu i nie będzie czego porównywać.

### 2.2 Jeśli chcesz zobaczyć widoki czasowe (opcjonalnie, wymaga cierpliwości)

Historia cen rośnie **tylko przy imporcie, który sam zatwierdzi zmianę ceny**. Żeby powstał
choć jeden punkt:

1. Zaimportuj cennik dostawcy.
2. Podmień w pliku kilka cen (drobna zmiana, poniżej progu wymagającego decyzji człowieka).
3. Zaimportuj **ten sam** cennik ponownie.

Każdy taki import dokłada migawki do historii. **Wykresy czasowe (3.6, 4.4) potrzebują
danych z co najmniej dwóch różnych MIESIĘCY** — na świeżym stagingu ich nie zobaczysz i to
nie jest błąd. Tabele pod wykresami zapełnią się wcześniej niż same wykresy.

> **Nie ma przycisku „utwórz migawkę cen".** Stary Bridge też go nie ma — mechanizm, który
> to robi, przy każdym kliknięciu dokładałby duplikaty, więc świadomie nie dostał przycisku.

### 2.3 Jeśli chcesz zobaczyć powiadomienia na Pulpicie

Karta „Najnowsze powiadomienia" pokazuje **alerty importu** — te same, które widzisz na
ekranie **Alerty**. Jeśli chcesz je sobie wyprodukować, użyj sztuczki z
[instrukcji I6](instrukcja-testow-I6.md), sekcja 2 (zepsuty URL dostawcy → **Synchronizuj
teraz**). Karta pokazuje wyłącznie alerty o statusie **nowy** i poziomie **krytyczny** lub
**ostrzeżenie**.

---

## 3. Pulpit (`/`) — strona główna

Wchodzisz na nią automatycznie po zalogowaniu, albo klikając **Pulpit** w menu po lewej.

### 3.1 Pierwsze wejście

**Zrób:** zaloguj się.

**Oczekuj:** tytuł **Pulpit**, podtytuł *„Codzienny obraz kanału dostawców i katalogu
produktów"*, a pod nim **cztery kafle** w tej kolejności:

| Kafel | Co pokazuje | Klik prowadzi do |
|---|---|---|
| **Produkty w katalogu** | liczba produktów; pod spodem *„+N w tym tygodniu"* albo *„Brak nowych w tym tygodniu"* | `/katalog` |
| **Oczekujące w staging** | liczba pozycji w stagingu; *„+N nowych dziś"* albo *„Bez nowych dziś"* | `/staging` |
| **Aktywne alerty** | liczba alertów o statusie *nowy*; *„N krytycznych"* albo *„Brak alertów"* | `/alerty` |
| **Ostatni eksport CSV** | **zawsze „—"** i *„Brak eksportów ani importów"* | `/historia` |

⚠ Czwarty kafel jest **celowo martwy** — patrz [sekcja 6.2](#62-kafel-ostatni-eksport-csv-zawsze-pokazuje-).

### 3.2 Kafle są klikalne

**Zrób:** kliknij po kolei każdy z czterech kafli.

**Oczekuj:** przenoszą na `/katalog`, `/staging`, `/alerty` i `/historia`. Kafel podświetla
się pod kursorem.

### 3.3 Liczby zgadzają się z ekranami

**Zrób:** zapamiętaj liczbę z kafla **Produkty w katalogu**, wejdź na `/katalog`. To samo
z **Oczekujące w staging** → `/staging` i **Aktywne alerty** → `/alerty`.

**Oczekuj:** liczby są takie same. Przy alertach porównuj z liczbą alertów **nowych**
(nierozwiązanych).

### 3.4 Karta „Najnowsze powiadomienia"

**Zrób:** wyprodukuj sobie alerty wg [sekcji 2.3](#23-jeśli-chcesz-zobaczyć-powiadomienia-na-pulpicie), wróć na Pulpit.

**Oczekuj:**
- karta z dzwonkiem i tytułem **Najnowsze powiadomienia**, pod nim *„N aktywnych alertów
  łącznie"*;
- **najwyżej pięć wierszy**, nawet gdy alertów jest więcej;
- **krytyczne na górze**, potem ostrzeżenia; w obrębie poziomu — od najnowszego;
- przycisk **Zobacz wszystkie** po prawej, prowadzący na `/alerty`;
- kliknięcie dowolnego wiersza też prowadzi na `/alerty`;
- czas po prawej stronie wiersza w formie *„12 min temu"*, *„dzisiaj, 14:32"*, *„wczoraj,
  09:15"*, *„3 dni temu"* albo pełnej daty dla starszych.

### 3.5 Brak alertów — karty NIE MA WCALE

**Zrób:** wejdź na `/alerty` i oznacz wszystkie alerty jako rozwiązane. Wróć na Pulpit.

**Oczekuj:** karta „Najnowsze powiadomienia" **znika w całości** — nie zostaje pusta ramka
z napisem „brak alertów". Kafel **Aktywne alerty** pokazuje `0` i *„Brak alertów"*.

### 3.6 Tabela „Ostatnia aktywność dostawców"

**Oczekuj:** tytuł, podtytuł *„10 dostawców M1–M10 monitorowanych przez Bridge"* i tabela
o dziewięciu kolumnach:

**Kod · Dostawca · Email · Format · Ostatni plik · Ostatnia aktualizacja ceny · Ostatnia
aktualizacja stanu magazynowego · Produkty · Status**

Sprawdź trzy rzeczy:
1. **Kolejność wierszy: MO1, MO2, … MO9, MO10** — po numerze, a nie alfabetycznie
   (alfabetycznie „MO10" wypadłoby zaraz po „MO1").
2. **Status** to odznaka: zielone **OK** dla aktywnego, czerwone **Błąd**, szare
   **Wstrzymany**. Porównaj z **Konfiguracja → Dostawcy**.
3. **Puste daty pokazują `—`**, a nie pustą komórkę ani „Invalid Date".

---

## 4. Analityka (`/analityka`) — nagłówek i filtry

### 4.1 Pierwsze wejście

**Oczekuj:** tytuł **Analityka**, podtytuł *„Dostawcy, porównanie EAN, ceny w czasie,
dostępność, marża i rotacja"*, a pod nim:

- **banner o historii cen** — albo *„Historia cen dopiero zacznie się zbierać po wdrożeniu.
  Widoki czasowe pokazują teraz dane bieżące albo pustą tabelę."*, albo *„Historia cen:
  N snapshotów od …"*;
- **cztery kafle**: Produkty · Dostawcy · Śr. marża · Staging oczekujące;
- **pasek sześciu filtrów**;
- **pięć zakładek**, domyślnie otwarta **Dostawcy**.

> Ten ekran wczytuje się chwilę dłużej niż inne — ciągnie ze sobą bibliotekę wykresów.
> Przy pierwszym wejściu zobaczysz krótkie *„Wczytywanie…"*. To normalne.

### 4.2 Sześć filtrów — wspólnych dla całej strony

Filtry: **Dostawcy · Marki · Modele · Rozmiary · Indeksy nośności · Indeksy prędkości**.
Każdy to lista z wyszukiwarką (*„Szukaj marki…"* itd.), można zaznaczyć wiele pozycji.

**Zrób:** zaznacz jednego dostawcę.

**Oczekuj:** karty zawężają się od razu, bez przeładowania strony. Pod tytułem karty pojawia
się notka **„Filtry ukryły N z M …"**.

**Zrób:** zaznacz **drugiego** dostawcę.

**Oczekuj:** wierszy **przybywa**, nie ubywa — wewnątrz jednego filtra działa „albo/albo".
Ale gdy zaznaczysz dostawcę **i** markę naraz, zostają tylko wiersze spełniające **oba**
warunki.

**Zrób:** kliknij **Wyczyść filtry**.

**Oczekuj:** wszystkie zaznaczenia znikają, karty wracają do pełnych danych.

### 4.3 ⭐ Karty, które nie stosują wszystkich filtrów — mówią to wprost

**Zrób:** zaznacz filtr **Modele** albo **Rozmiary**, przejdź po wszystkich zakładkach.

**Oczekuj:** część kart się nie zmieni, ale **napisze pod tytułem, dlaczego** — np.
*„Ta karta grupuje po EAN-ie i nie niesie kolumn katalogu, więc nie stosuje filtrów: Modele,
Rozmiary"* albo *„Odpowiedź tej sekcji nie niesie indeksów, więc nie stosuje filtrów: …"*.

To jest **zamierzone**: taka karta zwyczajnie nie ma w swoich danych kolumny, po której
mogłaby filtrować. Bez tej notki wyglądałoby to na zacięty filtr — **jeśli gdzieś filtr nic
nie robi i NIE MA takiej notki, to jest błąd i warto go zgłosić.**

---

## 5. Analityka — zakładka po zakładce

Każda karta ma tytuł z numeracją starego Bridge'a (numery mają luki — „4.3" i „4.5" siedzą
w innych zakładkach; tak jest w oryginale i zostaje).

Wszędzie obowiązują trzy zasady:
- pusta tabela pokazuje **„Brak danych"**, w trakcie ładowania — **„Wczytywanie…"**;
- tabela pokazuje **maksymalnie 300 wierszy**; przy większej liczbie na dole pojawia się
  *„Pokazano 300 z N wierszy — zawęź filtry, żeby zobaczyć pozostałe …"*;
- **wykresy to dodatek** — pod każdym jest tabela z tymi samymi liczbami. Stary Bridge nie
  miał ani jednego wykresu; te są świadomym ulepszeniem.

### 5.1 Zakładka **Dostawcy** (domyślna)

| Karta | Co pokazuje | CSV |
|---|---|---|
| **1.1 Stabilność cennika dostawcy** | jak często i jak mocno dany dostawca zmienia ceny | ✔ |
| **1.2 Nowości i wycofania** | pozycje, które u dostawcy pojawiły się albo zniknęły | ✔ |
| **1.4 / 1.5 Stan i dostępność dostawcy** | ile produktów, jaki średni stan, jaki procent dostępnych (pasek postępu) | ✔ |

**Sprawdź:** w karcie **1.4 / 1.5** procent dostępności ma **pasek postępu** w komórce,
nie samą liczbę. Porównaj wartości z `/katalog` zawężonym do tego dostawcy.

⚠ Karta **1.1** bez historii cen liczy z bieżącego katalogu i pokaże mniej, niż będzie
pokazywać za miesiąc. To nie błąd.

### 5.2 Zakładka **EAN i ceny**

| Karta | Co pokazuje | CSV |
|---|---|---|
| **2.1-2.4 Porównanie cen po EAN** | ten sam EAN u kilku dostawców: cena min, max, rozrzut w zł i w % | ✔ |
| **2.5 Pozycje unikalne** | EAN-y, które ma tylko jeden dostawca | ✔ |
| **2.6 Pokrycie wspólne i ranking dostawcy** | dwa wykresy i dwie tabele obok siebie, plus liczba **„EAN-y u co najmniej dwóch dostawców"** w procentach | ✘ |

**Sprawdź:** w karcie **2.1-2.4** rozrzut jest policzony poprawnie — wybierz wiersz i porównaj
z `/katalog`: wyszukaj ten EAN i zobacz ceny obu dostawców.

⚠ Karta **2.6** ma **dwie tabele, które reagują na filtry RÓŻNIE** — ranking dostawców
filtruje, histogram pokrycia nie. Obie mówią o tym własną notką.

### 5.3 Zakładka **Ceny w czasie**

| Karta | Co pokazuje | CSV |
|---|---|---|
| **3.1 Zmiany cen z ostatnich importów** | co się zmieniło przy ostatnich importach: cena stara, nowa, zmiana % | ✔ |
| **3.2 / 3.3 Historia ceny wybranej opony** | wykres i tabela dla JEDNEJ pozycji — szukasz jej po EAN-ie albo kodzie | ✘ |
| **3.6 Inflacja cennika** | jak zmienia się średnia cena dostawcy miesiąc do miesiąca | ✘ |

**Karta 3.2 / 3.3 — jak używać:** wpisz **EAN** albo **Kod** w pola u góry karty. Wyniki
pojawią się chwilę po tym, jak przestaniesz pisać (celowe opóźnienie — bez niego panel
pytałby serwer po każdej literze).

**Oczekuj:** dopóki oba pola są puste, **nie ma żadnego zapytania** i tabela jest pusta.
Napis *„Wykres/tabela zapełnią się po zebraniu historii cen."* jest tam **zawsze**, także
gdy dane już są — tak jest w starym Bridge'u.

⚠ Karty **3.2/3.3** i **3.6** zapełnią się dopiero, gdy będzie historia cen (patrz
[sekcja 2.2](#22-jeśli-chcesz-zobaczyć-widoki-czasowe-opcjonalnie-wymaga-cierpliwości)).

### 5.4 Zakładka **Dostępność**

| Karta | Co pokazuje | CSV |
|---|---|---|
| **4.1 Historia dostępności pozycji** | **PUSTA ZAWSZE** — patrz [sekcja 6.1](#61-karty-41-i-42-są-puste-zawsze) | ✔ (pusty plik) |
| **4.2 Tempo schodzenia z magazynu** | **PUSTA ZAWSZE** — patrz [sekcja 6.1](#61-karty-41-i-42-są-puste-zawsze) | ✔ (pusty plik) |
| **4.4 Sezonowy wzorzec cen** | średnia cena w kolejnych miesiącach, wykres liniowy | ✘ |

### 5.5 Zakładka **Marża i rotacja**

| Karta | Co pokazuje | CSV |
|---|---|---|
| **Marża per dostawca/kategoria/marka** | marża zgrupowana po trzech wymiarach: ile produktów, średnia, min, max | ✔ |
| **Rotacja / produkty bez aktualizacji** | pozycje, których nikt nie ruszał od N dni — z polem **„Bez ruchu dni"** | ✔ |
| **4.6 Cykl życia modelu** | jak długo model jest w katalogu | ✘ |

**Karta „Rotacja" — jedyny filtr liczony po stronie serwera.**

**Zrób:** zmień wartość w polu **Bez ruchu dni** (domyślnie `60`) na `7`, potem na `365`.

**Oczekuj:** lista realnie się przelicza — przy `7` wierszy jest więcej niż przy `365`.
To jedyne pole w całej analityce, które wysyła zapytanie do serwera; reszta filtruje
w przeglądarce.

---

## 6. ⚠ Rzeczy, które WYGLĄDAJĄ na błąd, a są poprawne

To najważniejsza sekcja tej instrukcji. **Nie zgłaszaj poniższych jako usterek** — wszystkie
są świadomie odtworzonym zachowaniem starego Bridge'a.

### 6.1 Karty „4.1" i „4.2" są puste ZAWSZE

Karty **4.1 Historia dostępności pozycji** i **4.2 Tempo schodzenia z magazynu** pokazują
„Brak danych" **niezależnie od tego, ile masz danych**. Nie zapełnią się nigdy — ani po
imporcie, ani po zebraniu historii cen.

**Dlaczego:** ich zapytania pytają tabelę historii o kolumnę, której ta tabela nie ma.
Stary Bridge połyka ten błąd i oddaje pustą listę, więc w produkcji te dwie karty są puste
od zawsze. Odtworzyliśmy to 1:1, zamiast po cichu „naprawiać" — bo naprawa zmieniłaby
zachowanie, które znasz z produkcji, i to jest **decyzja do podjęcia przez Ciebie**, nie
przez nas.

**Jeśli chcesz, żeby te dwie karty zaczęły działać — powiedz.** Jest to zapisane jako
otwarta sprawa i czeka na Twoją decyzję.

### 6.2 Kafel „Ostatni eksport CSV" zawsze pokazuje „—"

Na Pulpicie czwarty kafel **nigdy** nie pokaże daty — zawsze „—" i *„Brak eksportów ani
importów"*, choćbyś przed chwilą pobrała dziesięć plików CSV.

**Dlaczego:** kafel szuka informacji o eksporcie w miejscu, gdzie jej nie ma — stary Bridge
odpytuje tabelę zmian pól produktu, a ta nie zawiera rodzaju zdarzenia. Dane o eksportach
i importach są, ale w **innym** miejscu (ekran **Historia**). Odtworzone 1:1; naprawa też
czeka na Twoją decyzję.

### 6.3 Dwa eksporty CSV dają PUSTY plik

Przyciski **CSV** przy kartach **4.1** i **4.2** pobiorą plik, który po otwarciu w Excelu
będzie **pusty** (sam nagłówek arkusza, żadnych wierszy). To ta sama przyczyna co
w [6.1](#61-karty-41-i-42-są-puste-zawsze) — pusta karta, pusty eksport.

Pozostałe osiem eksportów zwraca dane.

### 6.4 ⭐ Plik CSV NIE zawiera tego, co widzisz w tabeli

To najbardziej mylące zachowanie w całej iteracji i **jest zgodne z produkcją**.

Eksport **nie jest** „tą samą tabelą w innym formacie". Każdy przycisk CSV pobiera dane
**własnym zapytaniem**, innym niż karta nad nim. Trzy konsekwencje, które zobaczysz:

1. **Eksport nie zna Twoich filtrów.** Zaznacz jednego dostawcę, kliknij CSV — w pliku będą
   **wszyscy**. Eksport to zwykłe pobranie pliku, nie „zapisz to, co widzę".
2. **CSV z karty „Marża" ma inne kolumny niż tabela.** Tabela pokazuje marżę **zgrupowaną**
   (dostawca / kategoria / marka, ze średnią, min i max), a plik — **każdy produkt osobno**
   (kod, nazwa, dostawca, kategoria, marka, marża %).
3. **CSV z karty „Rotacja" ignoruje pole „Bez ruchu dni".** Ustaw `7`, kliknij CSV —
   w pliku będzie **cały aktywny katalog**, nie siedmiodniowy podzbiór.

Podobnie CSV z karty **1.1** ma inne kolumny niż sama karta.

### 6.5 Pusty banner i puste widoki czasowe

Napis *„Historia cen dopiero zacznie się zbierać po wdrożeniu…"* i puste karty 3.2/3.3, 3.6,
4.4 to **stan przejściowy**, nie awaria. Zapełnią się w miarę, jak importy będą dokładać
migawki. Patrz [sekcja 2.2](#22-jeśli-chcesz-zobaczyć-widoki-czasowe-opcjonalnie-wymaga-cierpliwości).

### 6.6 Karta 3.2 / 3.3 mówi o historii, nawet gdy dane są

Napis *„Wykres/tabela zapełnią się po zebraniu historii cen."* siedzi w tej karcie **na
stałe** i nie znika po pojawieniu się danych. Tak jest w oryginale.

### 6.7 Wykres czasem mówi, że nie pokazuje Twojego dostawcy

W karcie **3.6 Inflacja cennika** może pojawić się notka *„Wykres pokazuje dostawców
o najdłuższej historii cen — wybrani filtrem nie są wśród nich. Ich dane są w tabeli
poniżej."*. To zamierzone: wykres pokazuje najwyżej kilka serii naraz (więcej byłoby
nieczytelne), a komplet zawsze jest w tabeli pod spodem.

### 6.8 Powiadomienia na Pulpicie to alerty IMPORTU

Stary Bridge pokazywał na pulpicie inne powiadomienia — wyliczane w przeglądarce z katalogu
(ujemna marża, bardzo niska marża, „to nie jest opona"). Nowy Pulpit pokazuje **alerty
importu** — te same, co ekran **Alerty**.

To **świadoma zmiana**, ta sama, którą podjęliśmy przy Iteracji 6: dzięki niej przycisk
„Zobacz wszystkie" prowadzi do listy **tych samych** alertów, a nie do zupełnie innego
zbioru. Stare pseudo-alerty katalogowe czekają na Twoją decyzję, czy mają wrócić i gdzie.

### 6.9 Tabela urywa się na 300 wierszach

To limit ze starego Bridge'a. Przy większej liczbie zobaczysz stopkę *„Pokazano 300 z N wierszy…"*.
Zawęź filtry albo pobierz CSV — **eksport nie ma limitu 300** (ma własne, znacznie wyższe).

---

## 7. Eksport CSV — jak sprawdzić, że działa

Przycisk **CSV** siedzi w prawym górnym rogu karty. Ma go **dziesięć kart**:

**1.1** · **1.2** · **1.4/1.5** · **2.1-2.4** · **2.5** · **3.1** · **4.1** · **4.2** ·
**Marża** · **Rotacja**

Nie mają go: **2.6**, **3.2/3.3**, **3.6**, **4.4**, **4.6** — i tak jest w oryginale.

### 7.1 Pobranie

**Zrób:** kliknij **CSV** przy karcie **Marża per dostawca/kategoria/marka**.

**Oczekuj:** przeglądarka pobiera plik o nazwie **`margins.csv`**. Nazwa pliku odpowiada
karcie (`suppliers-stability.csv`, `unique.csv`, `rotation-inactive.csv` itd.).

### 7.2 ⭐ Otwarcie w Excelu — najważniejszy test

**Zrób:** otwórz pobrany plik **dwuklikiem w Excelu**.

**Oczekuj — trzy rzeczy naraz:**
1. **Dane są rozbite na kolumny**, a nie wciśnięte w jedną (plik używa **średnika**, tak jak
   lubi polski Excel).
2. **Polskie znaki są poprawne** — „Rolnicze", „Marża", nazwy dostawców. Jeśli zobaczysz
   krzaczki typu `MarÅ¼a`, to jest błąd i **koniecznie zgłoś**.
3. **Pierwszy wiersz to nagłówki kolumn**.

> Jeśli otwierasz przez **Dane → Z pliku tekstowego**, wybierz kodowanie **UTF-8**
> i separator **średnik**.

### 7.3 Pole z średnikiem albo cudzysłowem w nazwie

**Zrób:** poszukaj w pobranym pliku produktu, którego nazwa zawiera cudzysłów (np. rozmiar
w calach) albo średnik.

**Oczekuj:** taka nazwa jest w cudzysłowach i **nie rozjeżdża kolumn**. Wiersz ma tyle samo
kolumn co pozostałe.

### 7.4 Eksport działa też po odświeżeniu i w innej przeglądarce

**Zrób:** odśwież stronę (`F5`), kliknij CSV. Potem zaloguj się w innej przeglądarce
i kliknij CSV tam.

**Oczekuj:** plik pobiera się za każdym razem. **Jeśli zamiast pliku zobaczysz stronę
logowania albo komunikat „Nieautoryzowany" — to jest błąd i trzeba go zgłosić** (eksport
korzysta z sesji inaczej niż reszta panelu, więc akurat tu warto zwrócić uwagę).

### 7.5 Eksport z kart 4.1 i 4.2

**Zrób:** kliknij CSV przy karcie **4.1** i **4.2**.

**Oczekuj:** plik się pobiera, ale jest **pusty**. To poprawne — patrz
[sekcja 6.3](#63-dwa-eksporty-csv-dają-pusty-plik).

---

## 8. Czego jeszcze NIE MA — świadomie

- **Przycisku CSV przy kartach 2.6, 3.2/3.3, 3.6, 4.4 i 4.6** — stary Bridge też ich tam
  nie ma.
- **Przycisku „utwórz migawkę cen"** — mechanizm istnieje po stronie serwera, ale przy każdym
  kliknięciu dokładałby duplikaty, więc nie dostał przycisku. Jeśli chcesz go mieć, trzeba
  najpierw poprawić samo działanie.
- **Kilku ekranów, których stary Bridge nigdy nie pokazywał**, mimo że dane są policzone:
  największe zmiany cen, ceny grup rynkowych, oś czasu importów, szczegóły pojedynczego EAN-u.
  Nie zostały dorobione, bo to byłyby **nowe ekrany**, a nie odbudowa. Jeśli któryś by się
  przydał — powiedz, zrobimy z tego osobne zadanie.
- **Trybu „zapisz to, co widzę" w eksporcie** — patrz [sekcja 6.4](#64--plik-csv-nie-zawiera-tego-co-widzisz-w-tabeli).

---

## 9. Szybka lista kontrolna

Do odhaczenia jednym przejściem:

**Pulpit**
- [ ] po zalogowaniu widzę Pulpit, nie zaślepkę „widok w przygotowaniu"
- [ ] cztery kafle, liczby zgadzają się z `/katalog`, `/staging` i `/alerty`
- [ ] każdy kafel jest klikalny i prowadzi we właściwe miejsce
- [ ] kafel „Ostatni eksport CSV" pokazuje „—" *(poprawne — sekcja 6.2)*
- [ ] karta „Najnowsze powiadomienia": maks. 5 wierszy, krytyczne na górze
- [ ] przy zerze alertów karty powiadomień nie ma wcale
- [ ] tabela dostawców: kolejność MO1 → MO10, statusy jako odznaki, puste daty jako `—`

**Analityka — nagłówek**
- [ ] banner o historii cen, cztery kafle, sześć filtrów, pięć zakładek
- [ ] domyślnie otwarta zakładka **Dostawcy**
- [ ] filtr zawęża wszystkie karty naraz; notka „Filtry ukryły N z M"
- [ ] dwa zaznaczenia w jednym filtrze **poszerzają** wynik
- [ ] karty, które filtra nie stosują, **piszą o tym wprost**
- [ ] **Wyczyść filtry** kasuje wszystkie zaznaczenia

**Analityka — zakładki**
- [ ] **Dostawcy**: karty 1.1, 1.2, 1.4/1.5; pasek dostępności w 1.4/1.5
- [ ] **EAN i ceny**: karty 2.1-2.4, 2.5, 2.6; procent „EAN-y u ≥2 dostawców"
- [ ] **Ceny w czasie**: karty 3.1, 3.2/3.3, 3.6; szukanie po EAN/kodzie działa
- [ ] **Dostępność**: karty 4.1, 4.2, 4.4 *(4.1 i 4.2 puste — poprawne)*
- [ ] **Marża i rotacja**: Marża, Rotacja, 4.6; pole „Bez ruchu dni" realnie przelicza

**Eksport CSV**
- [ ] przycisk CSV jest w dziesięciu kartach wymienionych w [sekcji 7](#7-eksport-csv--jak-sprawdzić-że-działa)
- [ ] plik pobiera się pod właściwą nazwą
- [ ] **otwiera się w Excelu z kolumnami i polskimi znakami**
- [ ] eksport działa po odświeżeniu i w innej przeglądarce
- [ ] pliki z 4.1 i 4.2 są puste *(poprawne)*

---

## 10. Jak zgłaszać problemy

Przy każdym zgłoszeniu podaj:

1. **Gdzie** — ekran i karta (np. „Analityka → Dostępność → karta 4.4").
2. **Co zrobiłaś** — krok po kroku, tak żeby dało się powtórzyć.
3. **Czego się spodziewałaś** i **co zobaczyłaś**.
4. **Zrzut ekranu** — przy analityce szczególnie pomocny, bo widać na nim stan filtrów.
5. **Czy filtry były zaznaczone** — to najczęstsza przyczyna „zniknęły mi dane".
6. Przy problemie z CSV: **załącz pobrany plik** i napisz, w czym go otwierałaś.

**Zanim zgłosisz — sprawdź [sekcję 6](#6--rzeczy-które-wyglądają-na-błąd-a-są-poprawne).**
Większość „dziwnych" zachowań analityki jest tam opisana i jest zamierzona. Jeśli coś
z sekcji 6 Ci przeszkadza i chcesz to zmienić — **to też zgłoś**, tylko jako życzenie,
a nie jako błąd. Kilka z tych spraw czeka wyłącznie na Twoją decyzję.
