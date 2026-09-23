# Test ścieżki krytycznej — instrukcja dla Ani

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-24 · **Dla:** Ania

> **To jest STAGING, nie produkcja.** Cokolwiek tu klikniesz, produkcji nie dotyka — łącznie
> z przyciskiem generowania CSV, który na stagingu pisze do własnego pliku testowego.
> Sklep Selly **nie** zobaczy niczego, co tu zrobisz.

To jest **najważniejszy z trzech dokumentów**. Sprawdzasz tu jeden ciąg od początku do końca:
plik od dostawcy → parser → baza → katalog → plik CSV dla Selly. Jeśli ten ciąg działa,
przełączenie jest możliwe. Reszta systemu ma osobną instrukcję (pełny test) — tam usterki
możemy poprawiać po przełączeniu, tutaj nie.

Liczę, że zajmie Ci to **jedno posiedzenie**. Pięć odcinków, po kolei.

---

## Zanim zaczniesz

**Co stoi na stagingu.** Wersja z gałęzi `develop` (stan z 24.09). Baza to **kopia produkcji
z 23.09** — czyli katalog i staging wyglądają tak, jak wyglądały u Ciebie tamtego dnia,
i od tamtej pory nie dochodzą tam Twoje produkcyjne importy.

**Co chodzi samo.** Automatyczne pobieranie od dostawców z adresu URL jest **włączone** i odpala
się co 60 minut. Dlatego w `Archiwum importów` zobaczysz wpisy, których sama nie wywołałaś —
**to normalne, nie błąd.** W scenariuszach niżej klikamy ręcznie, żeby wynik był od razu
i żeby dało się go powiązać z konkretnym plikiem.

**Co jest wyłączone.** Cała integracja z Selly (wysyłka do sklepu, harmonogramy). Szczegóły
i powód — w sekcji „Czego na stagingu sprawdzić NIE MOŻNA" na końcu. Generowanie samego pliku
CSV **działa** i to sprawdzamy.

**Jak zgłaszać.** Przy każdym punkcie jest `☐ OK ☐ ŹLE`. Przy „ŹLE" napisz krótko: co kliknęłaś,
co się stało, czego się spodziewałaś. Zrzut ekranu bardzo pomaga.

---

## Odcinek 1 — Import od dostawców

Dziesięciu dostawców dostarcza pliki **trzema drogami**. Nie musisz przechodzić wszystkich
dziesięciu — wystarczy **po jednym z każdej drogi**, plus MO9 osobno.

| Droga | Dostawcy | Jak plik przychodzi |
|---|---|---|
| `url` | MO2 JMK, MO3 Grasdorf, MO4 Handlopex Wrocław, MO5 Handlopex Rzeszów, MO9 Agro-Rami | system sam pobiera z adresu, co 60 min |
| `mail` | MO1 Bohnenkamp, MO7 Nokian, MO8 Trelleborg, MO10 GRI | plik przychodzi pocztą, wgrywasz go ręcznie |
| `upload` | MO6 Agrowiec / Uniglory (SMARTAGRO) | wgrywasz ręcznie |

Wszystko dzieje się na jednym ekranie: **menu po lewej → Konfiguracja → zakładka „Dostawcy"**.

### 1.1 Droga `url` — pobranie z adresu ⭐

**Jest teraz.** Przy dostawcach z adresem URL jest przycisk, który pobiera plik natychmiast,
bez czekania na automat.

**Sprawdź:**
- [ ] Konfiguracja → **Dostawcy**. Znajdź **MO2 (JMK)**.
- [ ] Zapisz sobie, co jest w kolumnie z liczbą produktów i datą ostatniej synchronizacji
      (będziesz to porównywać za chwilę).
- [ ] Kliknij **„Synchronizuj"**.

**Ma się stać:**
- przycisk zmienia napis na *„Synchronizuję…"* i jest nieaktywny, dopóki trwa pobieranie;
- po chwili liczba produktów i data ostatniej synchronizacji **odświeżają się**;
- w menu → **Archiwum importów** pojawia się **nowy wiersz na górze**: dzisiejsza data,
  `MO2`, nazwa pliku, jego rozmiar, liczba rekordów i status;
- w menu → **Alerty** pojawia się wpis typu **„Synchronizacja"**.

> ☐ OK ☐ ŹLE — uwagi: ______________________________________________

**Powtórz to dla jeszcze jednego dostawcy `url`** — proponuję **MO5 (Handlopex Rzeszów)**,
bo ma najwięcej pozycji, więc łatwiej zauważyć, gdyby czegoś brakowało.

> ☐ OK ☐ ŹLE — uwagi: ______________________________________________

**Jeśli pobranie się nie uda** (serwer dostawcy nie odpowiada, zmienione hasło do katalogu):
w **Alertach** ma się pojawić czytelny wpis **„Błąd pobierania"** albo **„Błąd HTTP"**, a liczba
produktów **nie** ma się zmienić. To też jest poprawny wynik — zgłoś go, ale jako „OK, dostawca
nie odpowiada", nie jako błąd systemu.

### 1.2 Droga `mail` — plik z poczty

**Jest teraz.** Dostawcy, którzy wysyłają cennik mailem, mają przycisk do wgrania pliku ręcznie —
ten sam, co przy `upload`.

**Sprawdź:**
- [ ] Przygotuj plik od jednego z nich: **MO1 (Bohnenkamp)**, MO7, MO8 albo MO10.
      Przyjmowane rozszerzenia: **`.csv`, `.xml`, `.xlsx`**.
- [ ] Konfiguracja → **Dostawcy** → przy wybranym dostawcy kliknij **„Wgraj plik"** i wskaż plik.

**Ma się stać:**
- pojawia się potwierdzenie **„Plik wczytany"**;
- liczba produktów i data ostatniej synchronizacji się odświeżają;
- w **Archiwum importów** nowy wiersz — w kolumnie **„Źródło"** ma być widać, że to wgranie
  ręczne, a nie pobranie z adresu;
- jeśli plik jest w złym formacie, dostajesz komunikat **„Błąd uploadu"** z powodem,
  a **nic się nie zapisuje**.

> ☐ OK ☐ ŹLE — uwagi: ______________________________________________

### 1.3 Droga `upload` — MO6

**Jest teraz.** MO6 (Agrowiec / Uniglory) to jedyny dostawca wyłącznie na wgrywanie ręczne.
Obsługa jest identyczna jak w 1.2.

**Sprawdź:**
- [ ] Konfiguracja → **Dostawcy** → **MO6** → **„Wgraj plik"**.
- [ ] Po wgraniu sprawdź w **Archiwum importów**, ile rekordów system policzył.

> ☐ OK ☐ ŹLE — uwagi: ______________________________________________

⚠ **Uwaga do MO6 — proszę o Twoją opinię.** W kopii bazy, którą mierzyliśmy, **MO6 nie ma
ani jednego produktu w katalogu**, a jego automatyczny import jest wyłączony. Może tak ma być
(sami wgrywacie ten plik, gdy trzeba), ale chcemy to potwierdzić — patrz sekcja
**„Do Twojej decyzji"**, punkt 1.

### 1.4 MO9 (Agro-Rami / BKT) — jedyny dostawca przez API ⭐

**Jest teraz.** MO9 jako jedyny **nie przysyła pliku** — system loguje się do jego systemu
i pobiera dane wprost stamtąd. W tabeli dostawców MO9 ma wpisany adres URL, ale to tylko
zaszłość; realnie plik spod tego adresu **nie jest używany**. Dlatego MO9 sprawdzamy osobno:
nie da się go przetestować, podkładając plik.

**Sprawdź:**
- [ ] Konfiguracja → **Dostawcy** → **MO9** → **„Synchronizuj"**.

**Ma się stać:**
- synchronizacja trwa **zauważalnie dłużej** niż przy zwykłym pliku (to pobieranie po sieci
  z cudzego systemu, nie odczyt pliku) — to normalne;
- liczba produktów się odświeża, w **Archiwum** pojawia się wpis, w **Alertach**
  **„Synchronizacja"**;
- w katalogu pozycje MO9 mają **sensowne stany magazynowe**.

> ☐ OK ☐ ŹLE — uwagi: ______________________________________________

> **⭐ To jest ważna zmiana wobec starego Bridge'a — nie musisz nic klikać, po prostu wiedz.**
> Gdy dane logowania do Agro-Rami przestaną działać (zmienione hasło, wygasłe konto),
> **stary Bridge po cichu podstawiał** w ich miejsce stary plik CSV o znanych, niewiarygodnych
> stanach — i zapisywał alert **„Synchronizacja"**, czyli **sukces**. Z zewnątrz wyglądało to
> jak udany import, a do sklepu szły złe stany.
> **Nowy system tego nie robi**: przy braku danych logowania synchronizacja MO9 kończy się
> **widocznym błędem** w Alertach, a stare dane zostają nietknięte. Wolimy o awarii wiedzieć
> niż dostać ciche śmieci.
> Na stagingu dane logowania **są** ustawione, więc MO9 zaimportuje się normalnie i tego
> komunikatu nie zobaczysz — i dobrze, nie chcemy psuć importu tylko po to, żeby go pokazać.

---

## Odcinek 2 — Z pliku do bazy i do katalogu

### 2.1 Czy liczby się zgadzają

**Sprawdź** dla dostawcy, którego importowałaś w odcinku 1:
- [ ] **Archiwum importów** → kolumna **„Rekordy"** — tyle pozycji system odczytał z pliku.
- [ ] Otwórz plik dostawcy i policz w nim wiersze z towarem (bez nagłówka).

**Ma się stać:** obie liczby są takie same albo różnią się o pozycje, które plik ma puste
lub zdublowane. **Duża różnica (np. połowa) to błąd** — zgłoś z nazwą pliku.

> ☐ OK ☐ ŹLE — uwagi: ______________________________________________

### 2.2 ⭐⭐ Jedna pozycja przez cały łańcuch — najważniejszy punkt instrukcji

Zgodna suma kontrolna nie mówi, czy **konkretne dane trafiły we właściwe rubryki**. Dlatego
proszę Cię o przeprowadzenie **jednej pozycji** od pliku aż do katalogu. To zajmuje pięć minut
i wyłapuje błędy, których nie widać w żadnej liczbie zbiorczej.

**Krok 1 — wybierz pozycję w pliku dostawcy.**
- [ ] Otwórz plik, który przed chwilą zaimportowałaś. Wybierz **jeden wiersz** — najlepiej taki,
      który ma wypełniony **EAN** (będzie kluczem wyszukiwania) i jest czymś rozpoznawalnym.
- [ ] Wypisz sobie na kartce **sześć wartości** z tego wiersza:
      **EAN · rozmiar · marka · bieżnik/model · cena zakupu · stan magazynowy**.

**Krok 2 — znajdź ją w `Staging`.**
- [ ] Menu → **Staging**. W polu szukania (*„Szukaj po kodzie, nazwie, dostawcy lub EAN…"*)
      wklej **EAN**.
- [ ] Domyślnie nie wszystkie rubryki są widoczne. Kliknij przycisk **„Kolumny"** nad tabelą
      i włącz: **EAN**, **Rozmiar**, **Producent-opony**, **Bieznik/model**, **Cena zakupu**,
      **Stan**.

**Ma się stać:** wszystkie sześć wartości zgadza się z Twoją kartką. Zwróć szczególną uwagę na:
- **rozmiar** — czy nie rozsypał się na kawałki ani nie skleił w jedno;
- **cenę zakupu** — czy przecinek dziesiętny jest tam, gdzie ma być (nie 10× za dużo ani za mało);
- **markę i bieżnik** — czy nie zamieniły się miejscami.

> ☐ OK ☐ ŹLE — uwagi: ______________________________________________

**Krok 3 — znajdź tę samą pozycję w `Katalog`.**
- [ ] Menu → **Katalog**. W polu **„Szukaj"** wklej ten sam **EAN**.

**Ma się stać:** pozycja jest, a rozmiar, marka, bieżnik, cena i stan zgadzają się z tym,
co widziałaś w Stagingu.

> ☐ OK ☐ ŹLE — uwagi: ______________________________________________

> **Jeśli pozycji nie ma w Katalogu, a jest w Stagingu — to nie musi być błąd.** Staging jest
> poczekalnią: pozycja nowa albo taka, której cena podejrzanie skoczyła, czeka tam na Twoją
> decyzję i wchodzi do katalogu dopiero po zatwierdzeniu. Sprawdź wtedy kolumny **„Zmiana"**
> i **„Powód"** — powinny mówić, dlaczego pozycja czeka. Cały ten mechanizm (wstrzymania,
> „Rozstrzygnij", braki w cenniku) jest opisany w **instrukcji pełnego testu**, tutaj go
> nie rozbieramy.

**Powtórz kroki 1–3 dla drugiej pozycji, od innego dostawcy** — najlepiej od MO9, bo on jako
jedyny idzie przez API i ma zupełnie inną drogę do bazy.

> ☐ OK ☐ ŹLE — uwagi: ______________________________________________

---

## Odcinek 3 — Plik CSV dla Selly

**Jest teraz.** Plik dla sklepu powstaje **jednym kodem** niezależnie od tego, czy odpali go
automat o 6:00, czy Ty przyciskiem. To nie są dwie kopie formatu, które mogłyby się rozjechać —
to jedno i to samo.

**Sprawdź:**
- [ ] Menu → **Selly** → sekcja **„Codzienna synchronizacja CSV"**.
- [ ] Kliknij **„Wygeneruj CSV teraz"**.
- [ ] Potwierdź pytanie: *„Wygenerować plik CSV teraz? Zastąpi bieżący plik pobierany przez Selly."*

**Ma się stać:**
- pojawia się *„⏳ Generuję plik CSV, to może potrwać kilkanaście sekund…"*;
- potem **✓ Wygenerowano — N produktów (X MB) w Y s**;
- status sekcji przechodzi na **OK** z opisem *„✓ Synchronizacja OK — plik wygenerowany dzisiaj"*;
- **„Ostatnia synchronizacja"** pokazuje dzisiejszą datę i godzinę.

> ☐ OK ☐ ŹLE — uwagi: ______________________________________________

**Teraz zajrzyj do środka pliku:**
- [ ] Kliknij **„Pobierz / podgląd CSV ↗"** w nagłówku sekcji i zapisz plik.
- [ ] Otwórz go w Excelu.

**Ma się stać:**
- **polskie znaki wyglądają poprawnie** (`ł`, `ą`, `ę` — nie „krzaki" ani znaki zapytania);
- wierszy jest **rzędu kilku tysięcy** — nie zero i nie kilkanaście;
- pierwsza kolumna to **`Nazwa-produktu`**, a **ostatnia, sześćdziesiąta** to
  **`Blokowane-formy-platnosci`** i jest **wypełniona** (lista numerów), nie pusta;
- weź EAN pozycji z punktu 2.2 i znajdź ją w tym pliku — cena i stan mają się zgadzać
  z tym, co widziałaś w Katalogu.

> ☐ OK ☐ ŹLE — uwagi: ______________________________________________

> ⚠ **Dwie rzeczy o stagingu, żeby Cię nie zaskoczyły.**
> 1. Plik na stagingu nazywa się **`sellycsv-staging.csv`** i leży pod adresem testowym
>    `test.agritires.eu/ex-port-files/` — **nie** pod produkcyjnym. To celowe zabezpieczenie:
>    przycisk tutaj fizycznie nie ma jak nadpisać pliku, po który przychodzi sklep.
> 2. Na produkcji plik odświeża się też **sam po każdym imporcie**. Na stagingu ta automatyka
>    jest **wyłączona** razem z całym Selly — więc po imporcie plik się **nie** odświeży,
>    dopóki nie klikniesz. Jeśli chcesz zobaczyć w pliku świeżo zaimportowaną pozycję,
>    **najpierw zaimportuj, potem kliknij „Wygeneruj CSV teraz"**.

---

## Odcinek 4 — Czy nowy plik jest taki sam jak stary

**To sprawdziliśmy za Ciebie i jest zrobione — nie musisz nic robić.** Piszę o tym, żebyś
wiedziała, na jakiej podstawie twierdzimy, że sklep nie zauważy podmiany.

**Dlaczego nie da się tego sprawdzić „na oko".** Porównanie dzisiejszego pliku ze stagingu
z dzisiejszym plikiem z produkcji **nic by nie dowiodło**: baza stagingu to kopia z 23.09,
a produkcja importuje dalej. Różnice pokazałyby rozjazd **danych**, a nie to, czy generator
liczy tak samo. Sensowne jest tylko porównanie **obu generatorów puszczonych na tej samej bazie**.

**Co zrobiliśmy (2026-09-24).** Wzięliśmy kopię bazy, uruchomiliśmy na niej **stary generator
produkcyjny** — dokładnie ten plik, który dziś o 6:00 robi plik dla sklepu — i **nowy**,
a potem porównaliśmy wyniki bajt po bajcie.

**Wynik:**

| | Stary generator | Nowy generator |
|---|---|---|
| Pozycji w pliku | 6898 | 6898 |
| Kolumn | 60 | 60 |
| Rozmiar pliku | 3 177 786 B | 3 177 786 B |
| Suma kontrolna | `70dacfd7…b87c5` | `70dacfd7…b87c5` |

**Pliki są identyczne co do bajtu** — ta sama suma kontrolna. Nie „prawie takie same"
i nie „takie same po zaokrągleniu": bez jednej różnicy, łącznie ze znacznikiem kodowania
na początku pliku i znakami końca linii.

Dodatkowo w systemie stoi **stały test**, który przy każdej zmianie kodu porównuje wiersz
nagłówkowy nowego generatora z **prawdziwym plikiem zdjętym z produkcji**. Gdyby ktoś
kiedykolwiek zmienił nazwę albo kolejność którejkolwiek z 60 kolumn, ten test zapali się
na czerwono, zanim zmiana gdziekolwiek trafi.

**Co mimo to warto, żebyś sprawdziła** — to jest punkt 3 wyżej: czy plik w ogóle powstaje,
czy liczba wierszy jest sensowna i czy otwiera się w Excelu z polskimi znakami. Dowód mówi
o **generatorze**; Ty patrzysz na **dane**, które do niego wchodzą, a tego żaden test za Ciebie
nie oceni.

> ☐ Przeczytałam, rozumiem — ☐ mam pytanie: _______________________

---

## Odcinek 5 — Adres pliku w panelu Selly

**Jak to działa dzisiaj.** Bridge **nie wysyła** pliku do Selly. **To sklep sam po niego
przychodzi** — codziennie około **12:00** — pod adres, który jest wpisany **w panelu Selly**,
po Waszej stronie. Bridge tylko kładzie plik pod tym adresem, cronem o **6:00**.

To jest ważne, bo odpowiada na pytanie „co trzeba przepiąć przy przełączeniu".

### Wariant docelowy: **nic nie przepinamy** ⭐

Nowy system zapisuje plik pod **dokładnie tę samą ścieżkę produkcyjną**, co stary — ta sama
nazwa, ten sam katalog. Z punktu widzenia sklepu **nic się nie zmienia**: przychodzi o 12:00
pod ten sam adres i zastaje plik, tyle że zrobiony nowym kodem.

**To jest wariant, który wybieramy.** W panelu Selly **nie zmieniamy nic**, a skoro nie
zmieniamy — nie ma czego zepsuć ani czego cofać. To zarazem argument, żeby **nie ruszać**
konfiguracji sklepu „przy okazji" przełączenia.

### Wariant testowy: przestawienie adresu na plik stagingu — **odradzamy**

Można by na próbę wpisać w panelu Selly adres pliku stagingowego, żeby zobaczyć, jak sklep
zachowa się z plikiem z nowego systemu. **Ma to realną cenę i trzeba ją znać:**

- przestawienie adresu **przełącza ŻYWY sklep na dane testowe** — z bazy z 23.09.
  Klienci zobaczą nieaktualne ceny i stany, dopóki nie wrócicie;
- wymaga **umówionego okna** i obecności integratora Selly, żeby zmianę wprowadzić i cofnąć;
- katalog stagingu trzeba wtedy najpierw zamknąć **listą dozwolonych adresów IP**, tak jak jest
  zamknięty produkcyjny — bo plik zawiera kolumnę **`Cena-zakupu`** i nie może być publiczny.

**Nasza rekomendacja: nie robić tego.** Dowód z odcinka 4 pokazuje, że plik jest identyczny
co do bajtu, więc test „czy sklep to zaciągnie" nie sprawdziłby niczego nowego, a ryzykuje
pokazanie klientom złych cen. Jeśli mimo to chcesz to przejść — patrz **„Do Twojej decyzji"**,
punkt 2.

> ☐ Przeczytałam, zgadzam się na wariant „nic nie przepinamy"
> ☐ Chcę porozmawiać o teście przed przełączeniem

---

## Czego na stagingu sprawdzić NIE MOŻNA

Piszę to wprost, żeby nie było wrażenia, że całe Selly jest przetestowane. **Nie jest i nie może
być** — na stagingu integracja ze sklepem jest wyłączona **trzema niezależnymi blokadami**:
tryb pracy ustawiony na „wyłączony", nieuruchomiony harmonogram i celowo niewgrane dane dostępowe
do sklepu. Każda z nich osobno wystarczy; są trzy, żeby żadna pomyłka nie wypuściła testów
na żywy sklep.

**Co potwierdzasz na stagingu:**
- [x] plik CSV **powstaje** — ręcznie, przyciskiem;
- [x] **treść pliku** — liczba pozycji, 60 kolumn, polskie znaki, zgodność z katalogiem;
- [x] cały import od dostawców wszystkimi trzema drogami i MO9 przez API.

**Czego NIE da się sprawdzić przed przełączeniem — i dlaczego:**

| Czego nie sprawdzimy | Dlaczego | Kiedy się to zweryfikuje |
|---|---|---|
| Czy sklep **zaciągnie** plik o 12:00 | sklep przychodzi pod adres produkcyjny, a staging pisze do własnego pliku testowego | pierwszego dnia po przełączeniu, po 12:00 |
| **Aktualizacja cen i stanów w ciągu dnia** (Tor 1) | wymaga danych dostępowych do sklepu, których na stagingu celowo nie ma | po przełączeniu |
| **Nocna pełna synchronizacja** (Tor 2, 04:30) | jak wyżej + harmonogram nie chodzi | pierwszej nocy po przełączeniu |
| **Cron o 6:00** | na stagingu nie jest ustawiony; sprawdzamy to samo polecenie uruchamiane ręcznie | pierwszego poranka po przełączeniu |

**Plan na te cztery punkty** jest w dokumencie przełączenia (`docs/cutover.md`) — pierwszego dnia
sprawdzamy je po kolei: rano plik z crona, po południu czy sklep go wziął, w nocy pełną
synchronizację. Nie zostają niesprawdzone, tylko sprawdzają się **później** i na produkcji.

---

## Do Twojej decyzji

To są rzeczy, których **nie rozstrzygamy sami**, bo to pytania o Waszą logikę biznesową,
nie o działanie systemu.

### 1. MO6 (Agrowiec / Uniglory) nie ma żadnych produktów w katalogu

**Co widzimy.** W kopii bazy, na której liczyliśmy, MO6 ma **zero** pozycji w katalogu —
ani aktywnych, ani wstrzymanych. Jego automatyczny import jest wyłączony (co ma sens: to jedyny
dostawca wyłącznie „na wgranie ręczne"). W efekcie **w pliku CSV dla Selly nie ma ani jednej
pozycji MO6** — jest dziewięciu dostawców z dziesięciu.

**Pytanie.** Czy tak ma być?
- ☐ **Tak, zostawiamy** — MO6 wgrywamy tylko wtedy, gdy jest potrzeba, i teraz akurat nie ma.
- ☐ **Nie, to błąd** — pozycje MO6 powinny być w katalogu i w pliku dla sklepu.
  Wtedy sprawdzimy, na którym etapie wypadają.
- ☐ Nie wiem — sprawdzę u siebie i wrócę z odpowiedzią.

### 2. Czy chcesz testu z przepięciem adresu w Selly przed przełączeniem?

**Nasze zdanie: nie warto** (uzasadnienie w odcinku 5 — plik jest identyczny co do bajtu,
a test przełącza żywy sklep na dane z 23.09).

- ☐ **Zgadzam się, pomijamy** — przy przełączeniu nie ruszamy panelu Selly.
- ☐ **Chcę to przejść** — wtedy ustalamy okno, angażujemy integratora Selly i **najpierw**
  zamykamy katalog stagingu listą dozwolonych IP.

### 3. Czy chcesz, żeby porównanie generatorów działało na stałe?

Dowód z odcinka 4 jest **jednorazowy** — zrobiliśmy go 24.09. Na stałe pilnowany jest tylko
wiersz nagłówkowy (nazwy i kolejność 60 kolumn).

- ☐ **Wystarczy** — pełne porównanie było potrzebne raz, przed przełączeniem.
- ☐ **Chcę je na stałe** — żeby każda przyszła zmiana w generatorze była automatycznie
  porównywana ze starym. Dorobimy to jako osobne zadanie.

---

## Skrót — ścieżka krytyczna w ośmiu krokach

Jeśli chcesz przejść wszystko szybko i wrócić do szczegółów tylko tam, gdzie coś nie zagra:

1. Konfiguracja → Dostawcy → **MO2** → „Synchronizuj" → Archiwum ma nowy wiersz.
2. To samo dla **MO5**.
3. Wgraj plik dla **MO1** (droga mailowa) → „Plik wczytany".
4. Wgraj plik dla **MO6** (droga ręczna).
5. **MO9** → „Synchronizuj" → trwa dłużej, stany wyglądają sensownie.
6. Weź jedną pozycję z pliku → znajdź po **EAN** w **Stagingu** → i w **Katalogu**.
7. Selly → **„Wygeneruj CSV teraz"** → ✓ Wygenerowano.
8. Pobierz plik → Excel → polskie znaki, kilka tysięcy wierszy, 60. kolumna wypełniona.

Jeśli te osiem kroków przeszło — **ścieżka krytyczna działa**.
