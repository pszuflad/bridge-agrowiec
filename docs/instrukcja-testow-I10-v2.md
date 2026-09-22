# Iteracja 10 (Analityka + Pulpit) — wersja 2: po Twoich odpowiedziach

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-22 · **Dla:** Ania
**Uzupełnia:** [pierwszą wersję](instrukcja-testow-I10.md) z 2026-09-04, w punktach opisanych niżej

> **To jest STAGING, nie produkcja.** Cokolwiek tu klikniesz, produkcji nie dotyka.

---

## Po co ta kartka

**To jest WERSJA 2 i zawiera TYLKO DELTĘ**, czyli wyłącznie to, co zmieniło się od czasu, gdy
przeszłaś pierwszą wersję. **Nie jest to instrukcja od nowa.** Nie przechodzisz Analityki ani
Pulpitu drugi raz. Na pytanie o pierwszą wersję odpowiedziałaś *„tak testowałam, działa dobrze”*,
więc wszystko, czego ta kartka nie wymienia, **zostaje aktualne** i nie musisz tego powtarzać.

**W Iteracji 10 niczego nie reklamowałaś.** Odpowiedziałaś natomiast na trzy nasze pytania
(pytania 10.1–10.3 z 18 września), a w przeglądzie 12 widoków zauważyłaś, że kafle w nagłówku
Analityki wyglądają inaczej niż na produkcji. Ta kartka zawiera:

- **rozdział 1:** Twoje trzy decyzje (**„Zdecydowałaś”**) i co z nimi zrobiliśmy. Przy dwóch
  z nich mamy do Ciebie razem trzy krótkie pytania;
- **rozdział 2:** Twoje zgłoszenie z przeglądu (**„Zgłosiłaś”**), czyli kafle w nagłówku Analityki;
- **rozdział 3:** dwie rzeczy, **o które nie pytałaś**. Zmieniły się przy innych poprawkach;
- **rozdział 4:** zdania z pierwszej wersji, które **przestały być prawdą**.

**Pierwsza wersja zostaje w repozytorium bez zmian.** Obowiązuje we wszystkim, czego tu nie ma.
Tam, gdzie coś się różni, **prawdą jest ta kartka.**

**Ile to zajmuje:** około 25 minut. Do punktu 1.2 potrzebujesz **jednego pliku cennika**
dowolnego dostawcy, takiego, jaki zwykle wgrywasz. Do punktu 1.3 potrzebujesz **Excela**.

### Jak wypełniać

Punkt do sprawdzenia kończy się linijką **Twoja ocena**:

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

Przy „ŹLE” napisz, **co zobaczyłaś zamiast** oczekiwanego, i **zrób zrzut ekranu**. Tam, gdzie
potrzebujemy Twojej decyzji, zamiast oceny jest **pytanie z wariantami** — zaznacz jeden.
Zbiorcze podsumowanie jest w rozdziale 5.

**Punkty oznaczone ⭐ są najważniejsze.** Jeśli masz mało czasu, zrób przynajmniej **1.1** i **1.3**.

---

# 1. Twoje decyzje — co z nimi zrobiliśmy

## 1.1 ⭐ Karty „4.1” i „4.2” w zakładce Dostępność działają

> **Zdecydowałaś** (pytanie 10.1, o dwóch kartach, które były puste zawsze): *„tak chcę, żeby
> zaczęły działać”*.

**Jest teraz.** Karty **4.1 Historia dostępności pozycji** i **4.2 Tempo schodzenia z magazynu**
pokazują wiersze liczone z historii cen. Działają też ich przyciski **CSV**: plik ma nagłówek
i wiersze, a nie jest pusty.

Kilka rzeczy, które zobaczysz:

- **Nazwę produktu karta bierze z katalogu**, po parze *dostawca + kod*. Ten sam kod u dwóch
  dostawców to dwie różne pozycje, więc nazwy się nie mieszają.
- **Pozycja, której już nie ma w katalogu, ma „—” w kolumnie Nazwa.** Historia pamięta ją
  nadal, ale katalog już nie ma jej nazwy. Takich wierszy jest sporo: na kopii produkcji mniej
  więcej połowa wierszy w 4.1 i co czwarty w 4.2.
- **Każda z tych dwóch kart dostaje najwyżej 500 wierszy.** Tak jest też w starym Bridge.
  W stopce tabeli zobaczysz więc zwykle *„Pokazano 300 z 500 wierszy…”*, choć pozycji z historią
  jest więcej (na kopii produkcji około 5200).

**Sprawdź:**
1. Menu po lewej → **Analityka**. Spójrz na napis na górze ekranu, nad kaflami.
2. Zakładka **Dostępność** → karta **4.1 Historia dostępności pozycji**.
3. Wybierz wiersz, który **ma** nazwę. Zapamiętaj kod i dostawcę. W nowej karcie przeglądarki
   otwórz **Katalog**, wyszukaj ten kod i porównaj nazwę produktu tego dostawcy.
4. Wróć do Analityki, zakładka **Dostępność** → karta **4.2 Tempo schodzenia z magazynu**.
5. Przy karcie **4.1** kliknij **CSV** i otwórz plik w Excelu. To samo przy karcie **4.2**.

**Ma się stać:**
- krok 1: napis brzmi *„Historia cen: N snapshotów od …”*. Jeśli widzisz zamiast tego
  *„Historia cen dopiero zacznie się zbierać po wdrożeniu…”*, zatrzymaj się tutaj i napisz nam
  to w uwagach. Znaczy to, że na stagingu nie ma historii, a karta 4.2 bez niej zostaje pusta;
- krok 2: tabela ma wiersze, a nie *„Brak danych”*. W części wierszy kolumna **Nazwa** pokazuje „—”;
- krok 3: nazwa w karcie 4.1 jest taka sama jak nazwa w Katalogu;
- krok 4: tabela ma wiersze z kolumnami **Dostawca**, **Kod**, **Nazwa**, **Zeszło sztuk**;
- krok 5: oba pliki mają wiersz nagłówków i pod nim dane. Tam, gdzie tabela pokazuje „—”, plik
  ma **pustą komórkę**. Każdy plik ma tyle wierszy danych, ile mówi stopka tabeli (zwykle 500).

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.2 Kafel „Ostatni eksport CSV” na Pulpicie ożył, ale o eksporcie z Katalogu nie wie

> **Zdecydowałaś** (pytanie 10.2, o kaflu, który zawsze pokazywał kreskę): *„niech zacznie
> pokazywać datę”*.

**Jest teraz.** Kafel czyta te same wpisy, które widzisz w **Historii** pod typami *Eksporty*
i *Importy*. Pokazuje jedną z czterech rzeczy:

| Sytuacja | Duża liczba na kaflu | Podpis pod nią |
|---|---|---|
| w Historii jest eksport | kiedy był, np. *„przed chwilą”*, *„12 min temu”*, *„wczoraj, 09:15”* | *„<dostawca> — N produktów”* |
| eksportu nie ma, ale jest import | „—” | *„Ostatni import: <kiedy>”* |
| nie ma ani eksportu, ani importu | „—” | *„Brak eksportów ani importów”* |
| nie udało się pobrać Historii | „—” | *„Nie udało się pobrać historii”* (reszta Pulpitu działa dalej) |

„Kiedy” ma tę samą postać co czas w powiadomieniach: *„przed chwilą”*, *„N min temu”*,
*„dzisiaj, 14:32”*, *„wczoraj, 09:15”*, *„N dni temu”*, a dla starszych pełna data, np.
*„27.07.2026”*.

**⚠ Pierwszego wiersza tej tabeli z panelu nie wywołasz. Musimy to powiedzieć uczciwie.**
Eksport CSV z **Katalogu** (przycisk *„Pobierz CSV…”*) **nie zostawia wpisu w Historii**. Plik
powstaje w Twojej przeglądarce i nikt poza nią o nim nie wie. Tak samo było w starym Bridge.
Plik dla Selly też nie zostawia wpisu. Innego przycisku eksportu w panelu nie ma. Dlatego dziś
kafel pokazuje **„—” i datę ostatniego importu**, nawet zaraz po pobraniu pliku z Katalogu.
**To nie jest błąd kafla.** Pytanie, co z tym zrobić, jest pod punktem.

**Sprawdź:**
1. Menu → **Historia**. Ustaw filtr **Typ** na *Importy*. Zapamiętaj datę i godzinę w pierwszym wierszu.
2. Menu → **Pulpit**. Spójrz na czwarty kafel.
3. Menu → **Konfiguracja** → zakładka **Dostawcy**. Przy dostawcy, który ma przycisk
   **Wgraj plik**, wgraj jego cennik. Nie musisz potem niczego akceptować w Stagingu.
4. Wróć na **Pulpit**.
5. Menu → **Katalog** → pobierz dowolny plik CSV. Wróć na **Pulpit**.
6. Kliknij czwarty kafel.

**Ma się stać:**
- krok 2: duża liczba to „—”, a podpis to *„Ostatni import: …”* z tą samą chwilą co w kroku 1
  (jeśli ten import był ponad tydzień temu, zobaczysz pełną datę);
- krok 4: podpis zmienił się na *„Ostatni import: przed chwilą”* albo *„Ostatni import: 1 min temu”*;
- krok 5: kafel **się nie zmienił**. Nadal „—” i ostatni import (wyjaśnia to ramka ⚠ wyżej);
- krok 6: otwiera się **Historia**.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

**Pytanie: czy eksport z Katalogu ma zostawiać wpis w Historii?**

- **(a)** tak. Wtedy każdy plik pobrany z Katalogu pojawi się w Historii jako eksport, a kafel
  pokaże jego datę i *„<dostawca> — N produktów”*
- **(b)** nie, wystarczy mi na kaflu data ostatniego importu
- **(c)** nie wiem

**Uwaga przy (a):** to byłaby nowa rzecz, której stary Bridge nie ma, więc zrobimy z niej osobne zadanie.

> **ODPOWIEDŹ:** ☐ (a) ☐ (b) ☐ (c) — komentarz: _______________

---

## 1.3 ⭐ Plik CSV to teraz to, co widzisz w tabeli

> **Zdecydowałaś** (pytanie 10.3, o plikach CSV, które nie znały Twoich filtrów): *„można
> dorobić filtry”*.

**Jest teraz.** Każdy z dziesięciu przycisków **CSV** w Analityce robi plik **z tych wierszy
i kolumn, które ma tabela karty po Twoich filtrach**. Liczą się filtry z paska na górze (sześć
list) i pole w samej karcie (**Bez ruchu dni** w Rotacji). Plik powstaje w Twojej przeglądarce,
od razu po kliknięciu.

**Jak wygląda plik:**
- **nagłówki kolumn** brzmią tak jak nagłówki tabeli (np. *Śr. marża*), w tej samej kolejności;
- **liczby mają przecinek** i nie mają odstępu między tysiącami: `1234,567`, choć tabela
  pokazuje `1 234,57`. Plik ma pełną dokładność, tabela zaokrągla;
- **Dostępność to sama liczba**, np. `87,5`, bez znaku `%` i bez paska;
- **tam, gdzie tabela pokazuje „—”, plik ma pustą komórkę**;
- **daty** są zapisane tak jak w tabeli, np. `2026-08-17T14:44:40.244Z`;
- **karta Marża** daje plik z grupami *dostawca / kategoria / marka*, jak tabela. Poprzednio
  plik miał każdy produkt osobno;
- **pusta tabela po filtrach** daje plik z samym wierszem nagłówków. Przycisk CSV jest
  nieaktywny tylko przez chwilę, gdy karta się wczytuje;
- **nazwy plików się nie zmieniły** (`margins.csv`, `unique.csv`, `rotation-inactive.csv` itd.).

**Plik nie jest ucięty do 300 wierszy.** 300 to limit samego rysowania tabeli. Plik ma
**tyle wierszy, ile mówi stopka** *„Pokazano 300 z N wierszy…”*, czyli N.

**⚠ Część kart ma własny sufit i ten sufit ma teraz także plik.** Karty **2.1-2.4**, **2.5**,
**Marża** i **Rotacja** dostają najwyżej **1000** wierszy. Karty **1.2**, **3.1**, **4.1**
i **4.2** najwyżej **500**. Tak jest w starym Bridge i nie zmienialiśmy tego. Wcześniej jednak
plik CSV pobierał dane osobno i był pełniejszy. Najbardziej widać to na karcie **2.5 Pozycje
unikalne**: na kopii produkcji takich pozycji jest około **5100**, karta i plik mają **1000**.
Filtr zawęża te 1000, a nie wszystkie 5100. Pytanie o to jest pod punktem.

**Sprawdź:**
1. **Analityka → Marża i rotacja** → karta **Marża per dostawca/kategoria/marka** → **CSV**.
   Otwórz plik w Excelu.
2. Zakładka **EAN i ceny** → karta **2.5 Pozycje unikalne**, bez żadnych filtrów. Przeczytaj stopkę
   tabeli. Kliknij **CSV**.
3. W pasku filtrów zaznacz **jednego** dostawcę. Przeczytaj notkę pod tytułem karty 2.5
   (*„Filtry ukryły X z 1000 pozycji.”*). Kliknij **CSV**.
4. Kliknij **Wyczyść filtry**. Zakładka **Marża i rotacja** → karta **Rotacja**. Wpisz w pole
   **Bez ruchu dni** `7` i kliknij **CSV**. Potem wpisz `365` i znów kliknij **CSV**.
5. Zakładka **Dostawcy** → karta **1.4 / 1.5 Stan i dostępność dostawcy** → **CSV**.
6. Zaznacz filtry tak, żeby któraś tabela pokazała *„Brak danych”* (np. dostawca i marka, których
   razem nie ma). Kliknij **CSV** przy tej karcie.

**Ma się stać:**
- krok 1: kolumny to **Dostawca, Kategoria, Marka, Produkty, Śr. marża, Min, Max**. Wierszy jest
  tyle, co w tabeli. Liczby z przecinkiem Excel traktuje jak liczby: stoją przy prawej krawędzi
  komórki;
- krok 2: stopka mówi *„Pokazano 300 z 1000 wierszy…”*, a plik ma **1000 wierszy danych**
  (w Excelu to ostatni wiersz numer 1001, bo pierwszy to nagłówki);
- krok 3: w pliku jest **tylko ten dostawca**, a wierszy danych jest **1000 minus X**;
- krok 4: dwa różne pliki. Każdy ma tyle wierszy, ile tabela przy danej wartości pola
  (N ze stopki albo liczba wierszy tabeli, jeśli jest ich mniej niż 300). Przy `7` jest ich
  więcej niż przy `365`;
- krok 5: kolumna **Dostępność** ma same liczby, bez `%`;
- krok 6: plik ma tylko wiersz nagłówków.

**⚠ Długi EAN Excel może pokazać jako `5,9E+12`.** Tak Excel wyświetla długie liczby i tak było
też ze starym plikiem. Cyfry w pliku są pełne. Widać je po kliknięciu w komórkę albo po zmianie
formatu kolumny na *Tekst*.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

**Pytanie A: czy potrzebujesz pełnych plików z kart, które mają sufit?** Najbardziej chodzi o
**2.5** (1000 zamiast około 5100) i **4.1 / 4.2** (500 zamiast około 5200). Ten sam sufit
mają karty 2.1-2.4, Marża, Rotacja, 1.2 i 3.1 — napisz w komentarzu, jeśli któraś z nich też.

- **(a)** tak. Plik ma mieć komplet, nawet jeśli tabela pokazuje mniej
- **(b)** nie, tyle mi wystarczy
- **(c)** nie wiem, nie używam tych plików

> **ODPOWIEDŹ:** ☐ (a) ☐ (b) ☐ (c) — komentarz: _______________

**Pytanie B: czy brakuje Ci pliku marży z każdym produktem osobno?** Tak wyglądał plik z karty
Marża przed zmianą: kod, nazwa, dostawca, kategoria, marka, marża %. Teraz plik ma grupy, jak tabela.

- **(a)** tak, potrzebuję go. Niech wróci jako osobny przycisk obok obecnego
- **(b)** nie, wystarczą mi grupy

> **ODPOWIEDŹ:** ☐ (a) ☐ (b) — komentarz: _______________

---

# 2. Twoje zgłoszenie z przeglądu

## 2.1 Kafle w nagłówku Analityki są takie jak na produkcji

> **Zgłosiłaś** (przegląd 12 widoków, Analityka): kafle w nagłówku wyglądają inaczej niż na
> produkcji.

**Jest teraz.** Nagłówek Analityki ma cztery kafle ze starego Bridge'a, w tej kolejności:

| Kafel | Co liczy |
|---|---|
| **Dostawcy** | ilu dostawców jest na liście w filtrze **Dostawcy** |
| **EAN wspólne** | ile wierszy ma karta **2.1-2.4 Porównanie cen po EAN** (EAN-y u co najmniej dwóch dostawców) |
| **Pozycje unikalne** | ile wierszy ma karta **2.5 Pozycje unikalne** (EAN-y tylko u jednego dostawcy) |
| **Snapshoty** | ile migawek ma historia cen. Ta sama liczba co w napisie nad kaflami |

Zamiast dotychczasowych *Produkty / Dostawcy / Śr. marża / Staging oczekujące*.

**⚠ Kafle nie reagują na pasek filtrów.** Liczą zawsze całość. Tak jest na produkcji.

**⚠ „Pozycje unikalne” pokazuje 1000, choć naprawdę jest ich więcej.** To ten sam sufit karty
2.5, o którym jest mowa w punkcie 1.3. Stary Bridge pokazuje tu tę samą liczbę.

**⚠ Liczby na kaflach nie mają odstępu między tysiącami** (`14513`, a nie `14 513`). Tak jest na produkcji.

**Sprawdź:**
1. **Analityka**, bez żadnych filtrów. Przeczytaj cztery kafle i napis nad nimi.
2. Zakładka **EAN i ceny**. Przeczytaj stopki kart **2.1-2.4** i **2.5**.
3. Otwórz listę filtra **Dostawcy** i policz pozycje.
4. Zaznacz jednego dostawcę.

**Ma się stać:**
- krok 1: kafle w kolejności **Dostawcy · EAN wspólne · Pozycje unikalne · Snapshoty**.
  Liczba na kaflu **Snapshoty** jest równa N z napisu *„Historia cen: N snapshotów od …”*;
- krok 2: **EAN wspólne** = N ze stopki karty 2.1-2.4 (*„Pokazano 300 z N wierszy…”*).
  **Pozycje unikalne** = N ze stopki karty 2.5, czyli 1000. Jeśli któraś karta ma mniej niż 300
  wierszy i stopki nie ma, porównaj z liczbą wierszy tabeli;
- krok 3: tyle samo pozycji co na kaflu **Dostawcy**;
- krok 4: **żaden** kafel się nie zmienia.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 3. Przy okazji — rzeczy, o które nie pytałaś

> **O żadną z tych dwóch rzeczy nie pytałaś i żadnej nie zgłaszałaś.** Zmieniły się przy innych
> poprawkach, a pierwsza wersja opisuje je po staremu. Dlatego o nich piszemy.

## 3.1 Pulpit pokazuje powiadomienia z obu zakładek Alertów

To zmiana z Iteracji 6. Kafel **Aktywne alerty** liczy nowe alerty z **obu** zakładek (Import
i Katalog), a karta **Najnowsze powiadomienia** ma dwie sekcje, **IMPORT** i **KATALOG**, po
najwyżej pięć wierszy. Wiersz otwiera Alerty na właściwej zakładce.

**Nie powtarzamy tu scenariusza.** Opisuje go i każe sprawdzić
[instrukcja Iteracji 6, wersja 2, punkt 2.5](instrukcja-testow-I6-v2.md#25-pulpit-liczy-i-pokazuje-alerty-z-obu-zakładek).
Jeśli już ją przeszłaś, nic tu nie klikasz. Jeśli nie, zrób tamten punkt.

**⚠ Na stagingu karta „Najnowsze powiadomienia” praktycznie nie zniknie.** Nawet gdy rozwiążesz
wszystkie alerty, następnego dnia wraca „Brak importu cennika”. Punkt 3.5 pierwszej wersji
(„karty NIE MA WCALE”) jest nadal prawdziwy, ale na stagingu go nie sprawdzisz.

> **Przeczytane:** ☐ tak ☐ niejasne — co: _______________

## 3.2 Migawka cen nie dubluje się już przy ponownym uruchomieniu

Pierwsza wersja pisała, że przycisku „utwórz migawkę cen” nie ma, bo mechanizm przy każdym
kliknięciu dokładałby duplikaty. **Mechanizm jest już poprawiony:** drugie uruchomienie tego
samego dnia niczego nie dokłada. **Przycisku nadal nie ma**, więc na ekranie nic się nie
zmieniło i nie ma czego klikać.

> **Przeczytane:** ☐ tak ☐ niejasne — co: _______________

---

# 4. Co w pierwszej wersji przestało być prawdą

Jeśli wracasz do [pierwszej wersji](instrukcja-testow-I10.md), te zdania są już nieaktualne.
**Reszta tamtego dokumentu obowiązuje bez zmian.**

## 4.1 Zdania unieważnione

| Punkt pierwszej wersji | Co mówił | Jak jest teraz |
|---|---|---|
| **Ramka na górze** („NAJWAŻNIEJSZA RZECZ”) | „**Dwie karty są puste ZAWSZE, niezależnie od danych** — to znany błąd starego Bridge'a, odtworzony celowo.” | Obie karty mają wiersze — **punkt 1.1**. |
| **§1** Sedno do sprawdzenia, pkt 4 | „**Eksport CSV to NIE jest to samo, co widać w tabeli** — i tak ma być. Szczegóły niżej.” | **Odwrotnie:** plik to tabela po filtrach — **punkt 1.3**. |
| **§2.2**, ramka | „mechanizm, który to robi, przy każdym kliknięciu dokładałby duplikaty, więc świadomie nie dostał przycisku.” | Duplikatów już nie dokłada. Przycisku nadal nie ma — **punkt 3.2**. |
| **§2.3** | „Karta „Najnowsze powiadomienia" pokazuje **alerty importu** — te same, które widzisz na ekranie **Alerty**.” | Pokazuje alerty z **obu** zakładek, w dwóch sekcjach — **punkt 3.1**. Alerty importu wyprodukujesz dalej tą samą sztuczką. |
| **§3.1**, wiersz „Aktywne alerty” | „liczba alertów o statusie *nowy*” | Suma **nowych** z obu zakładek, Import i Katalog — **punkt 3.1**. |
| **§3.1**, wiersz „Ostatni eksport CSV” i zdanie pod tabelą | „**zawsze „—"** i *„Brak eksportów ani importów"*” · „⚠ Czwarty kafel jest **celowo martwy**” | Kafel pokazuje prawdziwe dane z Historii. Dziś zwykle „—” i *„Ostatni import: …”* — **punkt 1.2**. |
| **§3.3** | „Przy alertach porównuj z liczbą alertów **nowych** (nierozwiązanych).” | Porównuj z sumą alertów **nowych** z obu zakładek. „Nierozwiązane” to nie to samo: obejmują też przejrzane, a kafel ich nie liczy — **punkt 3.1**. |
| **§3.4** | „**najwyżej pięć wierszy**, nawet gdy alertów jest więcej” · „kliknięcie dowolnego wiersza też prowadzi na `/alerty`” | Najwyżej pięć **w każdej z dwóch sekcji**. Wiersz otwiera Alerty **na właściwej zakładce** — **punkt 3.1**. |
| **§3.5** | „wejdź na `/alerty` i oznacz wszystkie alerty jako rozwiązane. Wróć na Pulpit.” | Na stagingu nieosiągalne: „Brak importu cennika” wraca następnego dnia — **punkt 3.1**. |
| **§4.1** Pierwsze wejście | „**cztery kafle**: Produkty · Dostawcy · Śr. marża · Staging oczekujące;” | **Dostawcy · EAN wspólne · Pozycje unikalne · Snapshoty** — **punkt 2.1**. |
| **§5.4**, tabela | „**PUSTA ZAWSZE**” (karty 4.1 i 4.2) · „✔ (pusty plik)” | Karty mają wiersze, pliki też — **punkt 1.1**. |
| **§6.1** w całości | „Karty „4.1" i „4.2" są puste ZAWSZE” · „Nie zapełnią się nigdy — ani po imporcie, ani po zebraniu historii cen.” | **Nieaktualne** — zdecydowałaś, że mają działać, i działają — **punkt 1.1**. |
| **§6.2** w całości | „Kafel „Ostatni eksport CSV" zawsze pokazuje „—"” · „Na Pulpicie czwarty kafel **nigdy** nie pokaże daty” | **Nieaktualne** — kafel czyta Historię. Eksport z Katalogu nadal go nie zmienia, bo nie zostawia wpisu w Historii — **punkt 1.2**. |
| **§6.3** w całości | „Dwa eksporty CSV dają PUSTY plik” · „Pozostałe osiem eksportów zwraca dane.” | Wszystkie dziesięć plików ma dane — **punkt 1.1**. |
| **§6.4** w całości | „⭐ Plik CSV NIE zawiera tego, co widzisz w tabeli” · „**Eksport nie zna Twoich filtrów.**” · „**CSV z karty „Marża" ma inne kolumny niż tabela.**” · „**CSV z karty „Rotacja" ignoruje pole „Bez ruchu dni".**” · „Podobnie CSV z karty **1.1** ma inne kolumny niż sama karta.” | **Nieaktualne w każdym punkcie.** Plik zna filtry, ma kolumny tabeli (także w Marży i 1.1) i słucha pola „Bez ruchu dni” — **punkt 1.3**. |
| **§6.8** w całości | „Nowy Pulpit pokazuje **alerty importu** — te same, co ekran **Alerty**.” · „Stare pseudo-alerty katalogowe czekają na Twoją decyzję, czy mają wrócić i gdzie.” | Wróciły jako zakładka **Katalog** w Alertach, a Pulpit pokazuje oba źródła — **punkt 3.1**. |
| **§6.9** | „Zawęź filtry albo pobierz CSV — **eksport nie ma limitu 300** (ma własne, znacznie wyższe).” | Plik nie ma limitu 300, ale **nie ma już własnego, wyższego**. Ma tyle wierszy, ile N w stopce, a część kart ma sufit 500 albo 1000 — **punkt 1.3**. |
| **§7.4** | „eksport korzysta z sesji inaczej niż reszta panelu, więc akurat tu warto zwrócić uwagę” | Ten powód odpadł: plik powstaje w przeglądarce, bez osobnego pytania do serwera. Samo sprawdzenie po `F5` i w innej przeglądarce możesz zostawić. |
| **§7.5** w całości | „**Oczekuj:** plik się pobiera, ale jest **pusty**. To poprawne” | Plik ma dane — **punkt 1.1**. |
| **§10** Jak zgłaszać, ostatnie zdanie | „Kilka z tych spraw czeka wyłącznie na Twoją decyzję.” | Sprawy z §6.1, §6.2, §6.4 i §6.8 są rozstrzygnięte (rozdział 1 i punkt 3.1). Nowe pytania są w punktach **1.2** i **1.3**. |

> **Czy któryś z tych punktów zachowuje się u Ciebie nadal po staremu?**
> ☐ nie ☐ tak — który: _______________

## 4.2 §8 „Czego jeszcze NIE MA” — rozliczenie wszystkich czterech pozycji

| Pozycja z §8 | Status |
|---|---|
| Przycisku CSV przy kartach 2.6, 3.2/3.3, 3.6, 4.4 i 4.6 | ⬜ **nadal nie ma** — bez zmian, jak w starym Bridge |
| Przycisku „utwórz migawkę cen” | ⬜ **nadal nie ma przycisku**. Zdanie o duplikatach jest nieaktualne — **punkt 3.2** |
| Kilku ekranów, których stary Bridge nigdy nie pokazywał | ⬜ **nadal nie ma** — bez zmian |
| Trybu „zapisz to, co widzę” w eksporcie | ✅ **jest** — **punkt 1.3** |

## 4.3 §9 Szybka lista kontrolna — wiersze do poprawienia

| Wiersz pierwszej wersji | Teraz odhaczasz |
|---|---|
| „kafel „Ostatni eksport CSV" pokazuje „—" *(poprawne — sekcja 6.2)*” | kafel pokazuje „—” i *„Ostatni import: …”*, a po wgraniu pliku *„przed chwilą”* (**1.2**) |
| „karta „Najnowsze powiadomienia": maks. 5 wierszy, krytyczne na górze” | maks. 5 wierszy **w każdej sekcji**, krytyczne na górze (**3.1**) |
| „przy zerze alertów karty powiadomień nie ma wcale” | nadal prawda, ale na stagingu nie do sprawdzenia (**3.1**) |
| „banner o historii cen, cztery kafle, sześć filtrów, pięć zakładek” | kafle to **Dostawcy · EAN wspólne · Pozycje unikalne · Snapshoty** (**2.1**) |
| „**Dostępność**: karty 4.1, 4.2, 4.4 *(4.1 i 4.2 puste — poprawne)*” | karty 4.1 i 4.2 **mają wiersze** (**1.1**) |
| „pliki z 4.1 i 4.2 są puste *(poprawne)*” | pliki z 4.1 i 4.2 **mają dane**, a każdy plik ma to, co tabela po filtrach (**1.1**, **1.3**) |

---

# 5. Podsumowanie

| Punkt | Co sprawdzasz | OK | ŹLE | Uwagi |
|---|---|:--:|:--:|---|
| **1.1** ⭐ | **Karty 4.1 i 4.2 mają wiersze, „—” przy usuniętych, pliki z danymi** | ☐ | ☐ | |
| 1.2 | Kafel: „Ostatni import: …”, po wgraniu „przed chwilą”; eksport z Katalogu go nie zmienia | ☐ | ☐ | |
| 1.2, pytanie | Eksport z Katalogu w Historii: (a) / (b) / (c) | — | — | |
| **1.3** ⭐ | **Plik = tabela po filtrach; 1000 wierszy z karty 2.5; przecinki; Dostępność bez %** | ☐ | ☐ | |
| 1.3, pytanie A | Pełne pliki z kart z sufitem: (a) / (b) / (c) | — | — | |
| 1.3, pytanie B | Plik marży per produkt: (a) / (b) | — | — | |
| 2.1 | Cztery kafle jak na produkcji; Snapshoty = napis; nie reagują na filtry | ☐ | ☐ | |
| 3.1 | Przeczytane: Pulpit z dwoma źródłami (sprawdzenie w I6 v2, 2.5) | ☐ | ☐ | |
| 3.2 | Przeczytane: migawka cen | ☐ | ☐ | |
| 4 | Żaden z unieważnionych punktów nie działa po staremu | ☐ | ☐ | |

**Sprawdzonych ____ / 7 · błędów ____ · pominiętych ____ · odpowiedzi ____ / 3**

---

# 6. Jak zgłosić znalezisko

**Zasady zgłaszania są te same co w [pierwszej wersji, rozdział 10](instrukcja-testow-I10.md)**:
podaj numer punktu i kroku, ekran i kartę, **czy filtry były zaznaczone**, co zobaczyłaś
zamiast oczekiwanego, godzinę i zrzut ekranu. Przy problemie z plikiem **załącz pobrany plik**
i napisz, w czym go otwierałaś.

**Najpierw sprawdź ramki ⚠ przy punkcie.** Sześć rzeczy w tej kartce wygląda na błąd, a jest
poprawnych:

1. **kafel „Ostatni eksport CSV” nie zmienia się po pobraniu pliku z Katalogu** (1.2);
2. **„—” w kolumnie Nazwa** w kartach 4.1 i 4.2 (1.1);
3. **1000 na kaflu „Pozycje unikalne” i 1000 wierszy w pliku z karty 2.5**, choć takich pozycji
   jest więcej; **500** w kartach 4.1 i 4.2 (1.3, 2.1);
4. **kafle nagłówka Analityki nie reagują na filtry** i nie mają odstępu między tysiącami (2.1);
5. **w pliku liczby z przecinkiem, Dostępność bez `%`, puste komórki zamiast „—”**, a długi EAN
   w Excelu jako `5,9E+12` (1.3);
6. **karta „Najnowsze powiadomienia” nie znika** po rozwiązaniu wszystkich alertów (3.1).

**Pięć rzeczy, przy których jest ODWROTNIE.** Tutaj błędem jest to, że coś się pojawia albo
*nie* działa, i chcemy o tym wiedzieć od razu:

- **karta 4.1 albo 4.2 pokazuje „Brak danych”**, choć napis na górze mówi *„Historia cen: N
  snapshotów…”* (1.1);
- **w pliku są wiersze, których tabela po filtrach nie pokazuje**, np. inny dostawca niż
  zaznaczony (1.3);
- **plik ma 300 wierszy, choć stopka mówi „z N”**, albo ma inną liczbę wierszy niż N (1.3);
- **podpis kafla nie zmienia się na „przed chwilą” po wgraniu pliku** albo pokazuje *„Nie udało
  się pobrać historii”* (1.2);
- **krzaczki zamiast polskich znaków** w pliku, np. `MarÅ¼a` (1.3).
