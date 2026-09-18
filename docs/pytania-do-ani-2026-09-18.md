# Pytania do Ani — zbiorczo

| Pole | Wartość |
|---|---|
| Data | 2026-09-18 |
| Skąd te pytania | testy Iteracji 3, 4, 5, 6, 7, 9, 10 i Przeglądu 12 widoków |
| Ile pytań | 25 (plus pole na uwagi końcowe) |
| Ile to zajmuje | 30–40 minut, nie trzeba nic klikać |

Aniu, to jest zebrane w jedno miejsce wszystko, na co czekamy. **Żadne z tych pytań nie wymaga
testowania ani klikania** — to są decyzje i doprecyzowania. Przy większości wystarczy zakreślić
jeden z gotowych wariantów.

## Jak odpowiadać

Pod każdym pytaniem jest pole **ODPOWIEDŹ**. Wpisz w nie wariant (a / b / c) albo zdanie własnymi
słowami. Jeśli nie masz zdania — napisz „nie wiem" albo „nie używam"; to też jest odpowiedź i też
nam pomaga.

**Pytania oznaczone ⭐ blokują pracę** — jeśli miałabyś odpowiedzieć tylko na część, zacznij od nich.
Jest ich pięć: 0.1, 5.1, 7.1, 10.1 i 12.1.

---

## 0. Zanim przejdziesz do reszty

### ⭐ 0.1 Czy testowałaś Atrybuty (Iteracja 7) i Analitykę (Iteracja 10)?

Obie instrukcje wróciły do nas **całkowicie puste** — ani jednej uwagi, ani jednego „OK".
Pozostałe dokumenty (Import, Narzuty, Historia, Alerty, Waga, Przegląd) przyszły z Twoimi
komentarzami, więc sam mechanizm zapisywania działa.

- **(a)** testowałam, ale uwagi gdzieś się zgubiły przy zapisywaniu pliku
- **(b)** nie zdążyłam — to były najdłuższe dokumenty
- **(c)** coś innego

**Dlaczego pytam:** jeśli (a), to szkoda Twojej roboty i poszukajmy oryginału, zamiast prosić Cię
o powtórkę dwóch najdłuższych instrukcji.

> **ODPOWIEDŹ:**
>
>

---

## 3. Iteracja 3 — Import

Wszystkie pytania z tej iteracji już rozstrzygnęłaś. Zostało jedno zadanie.

### 3.1 Test „ten sam plik w starym i nowym Bridge" — nadal niewykonany

To najcenniejszy test z całej instrukcji importu: bierzesz ten sam cennik, wgrywasz do obu
Bridge'ów i porównujesz **liczbę wczytanych pozycji**. Wypełniłaś go tylko dla MO1 i to „na oko".
Brakuje MO2, MO3, MO4, MO5, MO7, MO8 i MO10 (MO9 się nie da — to API, nie ma pliku).

- **(a)** zrobię, potrzebuję tylko czasu
- **(b)** zrobię, ale potrzebuję pomocy — nie mam pod ręką wszystkich plików
- **(c)** nie dam rady — zróbcie to inaczej

**Dlaczego to ważne:** jeśli liczby się różnią choćby o jedną pozycję, znaczy to, że parser czyta
plik inaczej niż stary Bridge — a tego nie wykryje żaden nasz test automatyczny.

> **ODPOWIEDŹ:**
>
>

---

## 5. Iteracja 5 — Historia

### ⭐ 5.1 Czy Historia ma pokazywać pobrania cenników z adresu URL?

Dziś wiersz w Historii dodaje **tylko ręczne wgranie pliku**. Kliknięcie „Synchronizuj teraz"
i automatyczne pobranie co godzinę **nie zostawiają śladu** — tak działa stary Bridge i tak to
odtworzyliśmy. Ale to właśnie automat jest dziś główną drogą, którą dane wchodzą do Bridge'a.

- **(a)** tak, chcę widzieć w Historii również pobrania z URL i „Synchronizuj teraz"
- **(b)** nie, zostawiamy jak jest

> **ODPOWIEDŹ:**
>
>

### 5.2 Zmiany cen konkretnych opon — znalazłaś je w Analityce?

W instrukcji pisaliśmy, że tego nie ma na ekranie Historii i że przyjdzie w Iteracji 10.
**Iteracja 10 już to dowiozła** — w Analityce są sekcje „Zmiany cen z ostatnich importów"
oraz „Historia ceny wybranej opony".

- **(a)** znalazłam, to mi wystarcza
- **(b)** znalazłam, ale wolałabym mieć to też na ekranie Historii
- **(c)** nie zaglądałam tam

> **ODPOWIEDŹ:**
>
>

### 5.3 Porównanie Historii ze starym Bridge — zrobimy automatem

To pole zostało puste, a był to najważniejszy test tamtej iteracji. Nie prosimy Cię o przejście
całej listy — przygotowujemy automatyczne porównanie obu Bridge'ów wpis po wpisie. Poprosimy Cię
tylko o sprawdzenie **dwóch–trzech wpisów** i potwierdzenie, że się zgadzają.

- **(a)** OK, dajcie znać kiedy
- **(b)** wolę przejść to sama w całości

> **ODPOWIEDŹ:**
>
>

---

## 6. Iteracja 6 — Alerty

Ta iteracja wypadła najlepiej ze wszystkich — nie znalazłaś ani jednej usterki.

### 6.1 Grupy zamknięte i otwarte — łączyć czy nie?

Napisałaś, że rozbijanie na dwie grupy „nie jest konieczne, bo zrobi się długa lista pełna
śmieci". Zanim to zmienimy, jedna rzecz: **po wejściu na ekran widzisz wyłącznie alerty
niezałatwione** — zamknięte są schowane i pojawiają się dopiero, gdy sama zdejmiesz filtr statusu.
Czyli w codziennej pracy tych „śmieci" nie widać.

Rozbicie ma jeden zysk: gdy zamkniesz 3 z 5 powtórek, widzisz osobno „2 do zrobienia"
i „3 odhaczone". Po połączeniu zobaczyłabyś jeden wiersz „5×" bez informacji, ile już obsłużyłaś.

- **(a)** zostawiamy jak jest (osobne grupy)
- **(b)** łączymy w jeden wiersz

> **ODPOWIEDŹ:**
>
>

### 6.2 Przy punkcie 3.1 wkleiłaś zrzut ekranu „Historia zmian", a nie Alertów

Podejrzewamy pomyłkę przy wklejaniu. Jeśli masz zrzut **Alertów** ze starego panelu — prześlij go,
bo właśnie o porównanie tego ekranu chodziło.

> **ODPOWIEDŹ:**
>
>

### 6.3 Przy punkcie 3.10 (filtry) jest wpisane „JUż gdzie"

Nie wiemy, co to znaczy. Filtry działały poprawnie, czy natrafiłaś na coś dziwnego?

> **ODPOWIEDŹ:**
>
>

### 6.4 Czy przydałaby się wyszukiwarka po treści alertu?

Dziś, żeby odróżnić awarię sieci od błędu formatu pliku, trzeba rozwinąć grupę i przeczytać wpisy
— bo oba dostają tę samą etykietę „Błąd pobierania". Wyszukiwarka po treści pozwoliłaby znaleźć je
od razu.

- **(a)** tak, przydałaby się
- **(b)** nie, radzę sobie rozwijaniem grup

> **ODPOWIEDŹ:**
>
>

---

## 7. Iteracja 7 — Atrybuty

Te cztery pytania czekają od początku września. **Nie musisz nic sprawdzać, żeby odpowiedzieć.**

### ⭐ 7.1 Czy akcje z kolejki „Do akceptacji" mają zostawiać ślad?

Dwie z nich — **„Edytuj"** i **kliknięcie w podpowiedź aliasu** — potrafią jednym kliknięciem
zmienić markę albo bieżnik **w kilkuset produktach naraz**. Dziś nie zostaje po tym żaden ślad:
ani w Historii, ani nigdzie indziej. Nie da się sprawdzić, kto i kiedy to zrobił, ani tego cofnąć.
Stary Bridge też tego nie zapisuje.

- **(a)** tak, ma zostawiać ślad w Historii
- **(b)** nie trzeba, zostawiamy jak jest

**Nasza rekomendacja: (a).** To operacja nieodwracalna i szeroka — warto wiedzieć, że się wydarzyła.

> **ODPOWIEDŹ:**
>
>

### 7.2 Bieżniki podpowiadają same siebie ze 100% — naprawiamy?

W kolejce zobaczysz np. „AGRI STAR II" z podpowiedzią „AGRI STAR II (100%)". Dzieje się tak,
bo słownik bieżników został kiedyś zasiany z **nazw modeli** produktów zamiast z pola „bieżnik",
więc ta sama wartość siedzi jednocześnie w słowniku i w kolejce.

- **(a)** tak, przeszkadza mi to
- **(b)** nie, mogę to ignorować

> **ODPOWIEDŹ:**
>
>

### 7.3 „BKT" i „bkt" nie rozpoznają się nawzajem

Wartości różniące się tylko wielkością liter mają podobieństwo zero, więc zamiast oczywistej
podpowiedzi zobaczysz „brak podobnych".

- **(a)** tak, zdarza się to w praktyce — dostawcy przysyłają raz wielkimi, raz małymi literami
- **(b)** nie spotykam tego

> **ODPOWIEDŹ:**
>
>

### 7.4 Przy rodzajach „model" i „zastosowanie" część akcji nie działa

Te dwa rodzaje trafiają do kolejki, ale „Edytuj" i alias zwracają przy nich błąd „Nieznany rodzaj"
— działa tylko „Akceptuj".

- **(a)** używam tych rodzajów w kolejce, to trzeba naprawić
- **(b)** nie używam, można zostawić

> **ODPOWIEDŹ:**
>
>

---

## 9. Iteracja 9 — Waga gabarytowa

Obie Twoje odpowiedzi są jasne i wchodzą do planu: **usuwanie przewoźnika będzie pytać
o potwierdzenie**, a **lista przewoźników przeniesie się na serwer**. Zostały dwa doprecyzowania.

### 9.1 Kto ma móc zmieniać listę przewoźników, gdy będzie już wspólna?

Dziś każdy edytuje swoją kopię, więc pytanie nie istniało. Po przeniesieniu na serwer zmiana
dzielnika przez jedną osobę zmieni wyceny **wszystkim**.

- **(a)** każdy zalogowany
- **(b)** tylko konto administratora

> **ODPOWIEDŹ:**
>
>

### 9.2 Czy przydałby Ci się w panelu drugi kalkulator — paletowy?

W Bridge istnieje jeszcze jedna formuła: zaokrągla szerokość do progów półpalety i palety, dolicza
10 cm na samą paletę i mnoży przez współczynnik. Działa i jest przetestowana, ale **nie jest
podpięta pod żaden ekran** — tak samo jak w starym Bridge.

- **(a)** tak, liczę czasem przesyłki paletowe
- **(b)** nie, nie jest mi potrzebny

> **ODPOWIEDŹ:**
>
>

### 9.3 Twoje obecne dzielniki — masz je gdzieś zapisane?

Po przeniesieniu listy na serwer wystartuje ona od wartości domyślnych; ustawienia z Twojej
przeglądarki nie przeniosą się automatycznie. Jeśli masz gdzieś zapisane dzielniki, które mają
obowiązywać w firmie — prześlij je, wprowadzimy od razu.

> **ODPOWIEDŹ:**
>
>

---

## 10. Iteracja 10 — Analityka i Pulpit

### ⭐ 10.1 Dwie karty w zakładce „Dostępność" są puste zawsze

„Historia dostępności pozycji" i „Tempo schodzenia z magazynu" nie zapełnią się nigdy — pytają
bazę o coś, czego w niej nie ma. Ich pliki CSV też wychodzą puste. Stary Bridge ma to tak samo.

- **(a)** tak, chcę żeby zaczęły działać
- **(b)** nie, nie używam ich
- **(c)** nie wiem, nie zaglądałam tam

> **ODPOWIEDŹ:**
>
>

### 10.2 Kafel „Ostatni eksport CSV" na Pulpicie zawsze pokazuje kreskę

Choćbyś pobrała dziesięć plików. Też odtworzone ze starego Bridge'a.

- **(a)** niech zacznie pokazywać prawdziwą datę
- **(b)** niech zniknie z Pulpitu, skoro i tak nic nie mówi
- **(c)** zostawiamy jak jest

> **ODPOWIEDŹ:**
>
>

### 10.3 Pliki CSV z Analityki nie znają Twoich filtrów

Zaznaczasz jednego dostawcę, a w pliku i tak są wszyscy. Tak działa stary Bridge.

- **(a)** przeszkadza mi to — dorobcie tryb „zapisz to, co widzę"
- **(b)** nie przeszkadza

> **ODPOWIEDŹ:**
>
>

---

## 12. Przegląd 12 widoków

Ten przegląd był najbardziej wartościowy ze wszystkiego, co przeszłaś — wyłapałaś rzecz, którą
przegapiliśmy. Najpierw odpowiedzi na Twoje punkty, potem nasze pytania.

**Kolumna „Blokowane formy płatności" — nic nie zginęło.** To funkcja dodana na produkcji
**10 września**, już po zamknięciu odbudowy. Mamy ją zapisaną i wejdzie razem z pozostałymi
wrześniowymi zmianami. Nie musisz sprawdzać pikera kolumn.

**„B??d HTTP" w filtrze — znaleźliśmy przyczynę i to nie jest usterka nowego panelu.** W bazie
produkcji leży 339 alertów z zepsutymi polskimi znakami, zapisanych tam dawno temu. Nowy panel po
prostu jako pierwszy je pokazuje — stary ekran Alerty w ogóle nie czytał tej tabeli. Poprawimy
same dane.

**„Archiwum importów" — to nasze przeoczenie.** Ta funkcja faktycznie jest na produkcji i faktycznie
jej u nas nie ma. Pliki są archiwizowane także w nowej wersji; brakuje ekranu do ich przeglądania.
Robimy.

### ⭐ 12.1 Do czego używasz Archiwum importów?

Od tego zależy, co odtworzymy najpierw.

- **(a)** żeby pobrać stary plik od dostawcy
- **(b)** żeby sprawdzić, czy import w ogóle przyszedł i ile miał pozycji
- **(c)** jedno i drugie
- **(d)** prawie nie zaglądam

> **ODPOWIEDŹ:**
>
>

### 12.2 Alerty — czy stare ostrzeżenia marżowe są Ci potrzebne?

Masz rację, że to dwa różne mechanizmy, i była to nasza świadoma decyzja. Nowy ekran pokazuje
realne błędy importu; stary liczył ostrzeżenia z katalogu (ujemna marża, bardzo niska marża,
„to nie jest opona") w Twojej przeglądarce.

- **(a)** tak, potrzebuję ich — niech wrócą jako osobna lista
- **(b)** tak, ale wystarczy mi to raz na jakiś czas, nie musi być osobny ekran
- **(c)** nie, wystarczą mi błędy importu

> **ODPOWIEDŹ:**
>
>

### 12.3 Kafelki KPI w Analityce — wrócić do wersji z produkcji?

Też masz rację. Zrobiliśmy je inaczej, bo w chwili budowy tamtego ekranu brakowało jeszcze danych
do wersji oryginalnej. Dziś już ich nie brakuje.

- **(a)** jak na produkcji: Dostawcy / EAN wspólne / Pozycje unikalne / Snapshoty
- **(b)** zostawiamy obecne: Produkty / Dostawcy / Śr. marża / Staging oczekujące
- **(c)** mieszanka — napisz które

> **ODPOWIEDŹ:**
>
>

### 12.4 „Powielone marki" — gdzie to widziałaś?

W podsumowaniu wspomniałaś o tym jako o drobiazgu „opisanym przy odpowiedniej sekcji", ale nie
znaleźliśmy tej uwagi w żadnym punkcie.

> **ODPOWIEDŹ:**
>
>

### 12.5 Czy chcesz podziału na administratora i zwykłego użytkownika?

Dziś każdy zalogowany widzi zakładki „Admin" i „Dziennik" — czyli konfigurację dostawców, usuwanie
pozycji, czyszczenie katalogu i pełny dziennik działań. W starym Bridge jest tak samo, więc nowa
wersja niczego nie pogarsza, ale też niczego nie naprawia.

- **(a)** tak, tylko ja mam mieć dostęp do tych zakładek
- **(b)** nie trzeba, zostawiamy jak jest

> **ODPOWIEDŹ:**
>
>

### 12.6 Selly — „Wygeneruj CSV teraz" na stagingu

Zgłosiłaś, że po kliknięciu nadal widać „Brak pliku CSV". Sprawdzamy to u siebie — nie musisz nic
robić. Jeśli pamiętasz **datę i godzinę** kliknięcia, dopisz, bo ułatwi nam to znalezienie śladu
w logach.

> **ODPOWIEDŹ:**
>
>

---

## Uwagi końcowe

Miejsce na wszystko, co nie pasowało do żadnego pytania — wrażenia, życzenia, rzeczy, które Cię
uwierają, a o które nie zapytaliśmy.

> **ODPOWIEDŹ:**
>
>
>
>

---

*Odeślij plik z wypełnionymi polami. Pytania ⭐ (0.1, 5.1, 7.1, 10.1, 12.1) blokują konkretne
prace — jeśli masz czas tylko na część, zacznij od nich.*
