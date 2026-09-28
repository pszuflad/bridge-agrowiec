# Iteracja 7 (Atrybuty) — wersja 2: po Twoich odpowiedziach

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-21 · **Dla:** Ania
**Uzupełnia:** [pierwszą wersję](instrukcja-testow-I7.md) z 2026-09-04, w punktach opisanych niżej

> **To jest STAGING, nie produkcja.** Cokolwiek tu klikniesz, produkcji nie dotyka.

---

## Po co ta kartka

**To jest WERSJA 2 i zawiera TYLKO DELTĘ**, czyli wyłącznie to, co zmieniło się od czasu, gdy
przeszłaś pierwszą wersję. **Nie jest to instrukcja od nowa.** Nie przechodzisz Atrybutów drugi
raz. Na pytanie o pierwszą wersję odpowiedziałaś *„tak testowałam, działa dobrze”*, więc
wszystko, czego ta kartka nie wymienia, **zostaje aktualne** i nie musisz tego powtarzać.

**W Iteracji 7 niczego nie reklamowałaś.** Odpowiedziałaś natomiast na cztery nasze pytania
(pytania 7.1–7.4 z 18 września). Ta kartka zawiera:

- **rozdział 1:** Twoje cztery odpowiedzi i co z nimi zrobiliśmy. Trzy dały zmiany do
  sprawdzenia. Przy czwartej musimy sprostować nasz błąd i zadać Ci jedno pytanie;
- **rozdział 2:** trzy rzeczy, **o które nie pytałaś**. Wyszły przy tych zmianach i widać je na
  ekranie;
- **rozdział 3:** zdania z pierwszej wersji, które **przestały być prawdą**.

**Pierwsza wersja zostaje w repozytorium bez zmian.** Obowiązuje we wszystkim, czego tu nie ma.
Tam, gdzie coś się różni, **prawdą jest ta kartka.**

**Ile to zajmuje:** około 25 minut. Najdłuższy jest punkt 1.1, bo zaczyna się od krótkiego
przygotowania.

> **⚠ Zanim zaczniesz: NIE klikaj „Wyczyść pending” przed skończeniem rozdziału 1.** Punkty 1.2
> i 1.3 oglądają pozycje, które są dziś w kolejce. Po wyczyszczeniu większość z nich już by nie
> wróciła (dlaczego, wyjaśnia punkt 2.2).

### Jak wypełniać

Punkt do sprawdzenia kończy się linijką **Twoja ocena**:

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

Przy „ŹLE” napisz, **co zobaczyłaś zamiast** oczekiwanego, i **zrób zrzut ekranu**. Zbiorcze
podsumowanie jest w rozdziale 4.

**Punkty oznaczone ⭐ są najważniejsze.** Jeśli masz mało czasu, zrób przynajmniej **1.1** i
odpowiedz na pytanie w **1.4**.

---

# 1. Twoje odpowiedzi — co z nimi zrobiliśmy

## 1.1 ⭐ Poprawki z kolejki zostawiają ślad w Historii

> **Zdecydowałaś** (pytanie 7.1): *„tak, ma zostawiać ślad w historii”*.

**Jest teraz.** Dwie akcje kolejki „Do akceptacji”, które przepisują produkty w całym katalogu,
czyli **Edytuj** (akceptacja z edycją) i **kliknięcie w podpowiedź aliasu**, zostawiają wpis
w **Historii**. Wpis wygląda tak:

| Kolumna w Historii | Co w niej jest |
|---|---|
| **Typ** | odznaka `edycja` |
| **Dostawca** | „—” (zmiana dotyczy produktów wszystkich dostawców naraz) |
| **Użytkownik** | Ty |
| **Pozycji** | liczba produktów, które akcja naprawdę przepisała |
| **Szczegóły** | pogrubione **pole: „stara wartość” → „nowa wartość”**, pod spodem mniejszym drukiem `pole (edycja z kolejki)` albo `pole (alias z kolejki)` |

Przykład wpisu po aliasie: Pozycji **312**, Szczegóły **marka: „NOKIAN HAKKA” → „NOKIAN”**
i pod spodem `marka (alias z kolejki)`.

Zmieniło się też ostrzeżenie w obu okienkach. Teraz brzmi:

> *„Zmiana przepisze pole **bieznik** w **3** produktach katalogu. Operacji nie da się cofnąć.
> Zostanie po niej wpis w Historii (typ „edycja”).”*

(W miejsce *bieznik* i *3* wchodzą pole i liczba z Twojej pozycji.) Okienko aliasu ma pod spodem
dodatkowe, niezmienione zdanie *„Do słownika nie trafi nic — mapowanie nie jest nigdzie
zapisywane, zmieniają się wyłącznie produkty.”*

**Cofnięcia nadal nie ma.** Wpis pozwala sprawdzić, kto, kiedy i co przepisał, ale go nie
odwraca. Żeby wrócić do starej wartości, trzeba ją poprawić ręcznie.

**⚠ Pozostałe akcje kolejki w Historii się NIE pokazują. Nie szukaj ich tam.** Chodzi o
**Akceptuj**, **Odrzuć** i **Wyczyść pending**. Żadna z nich nie zmienia produktów, a Historia
pokazuje tylko to, co zmienia katalog. Te trzy akcje zapisują się w dzienniku zdarzeń. Jeśli
chcesz je zobaczyć, są w **Konfiguracja → zakładka Dziennik**, pod technicznymi nazwami
zaczynającymi się od `atrybut_pending_`. Samo sprawdzanie kolejki po zatwierdzeniu importu nie
zapisuje się nigdzie.

### Przygotowanie (ok. 5 minut)

**Dlaczego trzeba coś przygotować:** każda pozycja, która jest dziś w kolejce na stagingu, ma
**0 produktów** w katalogu (wyjaśnienie w punkcie 2.2). Edycja na takiej pozycji dałaby wpis
w Historii z „Pozycji: 0”, a to niczego nie dowodzi. Dlatego najpierw sama wstawisz do kolejki
bieżnik, który ma prawdziwe produkty.

1. Menu po lewej → **Atrybuty** → kafel **Bieżnik**. W szukajce wpisz `307`.
2. Znajdź wiersz, który brzmi **dokładnie** `307` (mogą się pokazać też dłuższe wartości
   z tymi cyframi). Kliknij **Podgląd**: powinny być **3 produkty** marki ALLIANCE. Zamknij
   podgląd.
3. W tym samym wierszu kliknij **Usuń** i potwierdź. Wartość znika ze słownika, a produkty
   zostają nietknięte.
4. Menu → **Staging**. **Zaznacz jedną dowolną pozycję** (najlepiej innej marki niż ALLIANCE)
   i kliknij **Akceptuj zaznaczone (1)**. To zatwierdzenie uruchamia sprawdzanie kolejki.
5. Wróć do **Atrybuty → Do akceptacji** i wpisz w szukajkę `307`.

**Ma się stać:** w kolejce jest pozycja **bieznik · 307**, a w kolumnie **Wystąpień** stoi **3**.

**⚠ Kroki 1–5 i całe „Sprawdź” niżej zrób za jednym podejściem.** Gdyby w międzyczasie serwer
został uruchomiony ponownie (na przykład przy wdrożeniu nowej wersji), Bridge dopisze `307` z
powrotem do słownika, a pozycja zniknie z kolejki (punkt 2.3). Jeśli w kroku 5 pozycji nie ma,
powtórz przygotowanie od kroku 1.

### Sprawdź

1. Przy pozycji **307** kliknij **Edytuj**. Przeczytaj ostrzeżenie pod polem.
2. Zmień wartość na `307 TEST` i kliknij **Zapisz**.
3. Menu → **Historia**. Odśwież stronę i spójrz na pierwszy wiersz.
4. Ustaw filtr **Typ** na *Edycje*.
5. Wyczyść filtr i wpisz w wyszukiwarkę słowo `kolejka`. Potem spróbuj też `307 TEST`.

**Ma się stać:**
- krok 1: ostrzeżenie mówi o polu **bieznik** i o **3** produktach, a kończy się zdaniem
  *„Zostanie po niej wpis w Historii (typ „edycja”).”*;
- krok 2: komunikat **„Zapisano: 307 TEST”** i pod nim **„Zaktualizowano produktów: 3”**;
- krok 3: na górze jest nowy wiersz z dzisiejszą datą: Typ `edycja`, Dostawca „—”, Użytkownik
  Ty, **Pozycji 3**, Szczegóły **bieznik: „307” → „307 TEST”** i pod spodem
  `bieznik (edycja z kolejki)`;
- krok 4: ten wiersz jest na liście *Edycje*;
- krok 5: wyszukiwarka znajduje go i po słowie `kolejka`, i po `307 TEST`. Po słowie `alias`
  znalazłabyś wpisy po kliknięciu w podpowiedź aliasu, ale ten wpis nie jest aliasem.

**Najważniejsze:** trzy liczby muszą być równe: **3 w ostrzeżeniu, 3 w komunikacie, 3 w Historii.**

**⚠ „bieznik” bez ogonka w Szczegółach to nie błąd.** Historia pokazuje techniczną nazwę pola
produktu, a nie nazwę rodzaju ze słownika.

**⚠ „—” w kolumnie Dostawca jest poprawne.** Zmiana z kolejki dotyczy produktów wszystkich
dostawców naraz. Z tego samego powodu tego wpisu **nie znajdziesz filtrem Dostawca**, tylko
filtrem *Typ* albo wyszukiwarką.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.2 Kolejka nie podpowiada już samej siebie

> **Zdecydowałaś** (pytanie 7.2, o pozycjach podpowiadających same siebie ze 100%):
> *„tak, przeszkadza mi to”*.

**Jest teraz.** Zmieniły się trzy rzeczy:

1. **Pozycja, która jest już w słowniku, znika z kolejki.** Chodzi o wartość zapisaną dokładnie
   tak samo, z tymi samymi wielkimi i małymi literami. Znika przy każdym uruchomieniu serwera
   i po każdym zatwierdzeniu importu. Działa to tak jak **Akceptuj**: wartość i tak jest
   w słowniku, a produkty zostają nietknięte.
2. **Podpowiedź nigdy nie jest identyczna z pozycją.** *„AGRI STAR II (100%)”* przy pozycji
   *AGRI STAR II* już się nie pokaże.
3. **Słownik bieżników uzupełnia się z pola „bieżnik” produktów**, a nie z nazw modeli.

**Ile tego było.** Na kopii produkcji kolejka miała **498 pozycji**, z czego **437** podpowiadało
same siebie. Po zmianie zostaje **61**. Zniknęło 242 bieżników, 99 rozmiarów, 68 marek,
27 indeksów nośności i 1 konstrukcja.

**Musimy doprecyzować, co napisaliśmy w pytaniu 7.2.** Podaliśmy tam jedną przyczynę: słownik
bieżników zasiany z nazw modeli. To była tylko część prawdy. Z tego źródła brało się najwyżej
72 z 437 takich pozycji, a większość dotyczyła marek, rozmiarów i indeksów. Prawdziwa przyczyna
jest szersza: wartość mogła trafić do słownika później niż do kolejki (na przykład gdy Bridge
przy uruchomieniu dopisuje do słownika marki z produktów), a kolejka nigdy nie sprzątała takich
pozycji. Dlatego naprawą jest sprzątanie kolejki, a nie sama zmiana źródła bieżników.

**Słownika bieżników nie czyściliśmy, bo nie było czego.** Sprawdziliśmy wszystkie 1665 wartości:
**żadna** nie pochodzi wyłącznie z nazwy modelu. 1660 jest jednocześnie w polu „bieżnik”
i w modelu produktu, a 3 tylko w polu „bieżnik”. Dwie nie występują na żadnym produkcie:
**„AGRIMAX RT 851”** i **„RM 500 STBT”**. Te dwie nadal zobaczysz w słowniku, a ich **Podgląd**
powie *„Żaden produkt w katalogu nie używa tej wartości atrybutu.”* Jeśli są zbędne, możesz je
usunąć ręcznie.

**Sprawdź:**
1. **Atrybuty → Do akceptacji.** Spójrz na odznakę przy przycisku.
2. W szukajce kolejki wpisz `AGRI STAR`.
3. Wyczyść szukajkę i przejrzyj kolumnę **Sugerowane aliasy** na całej liście.

**Ma się stać:**
- krok 1: odznaka pokazuje **około 60** pozycji (61, a po zatwierdzeniu importu z punktu 1.1
  kilka więcej), a nie około 500. Jeśli w pierwszej rundzie coś akceptowałaś albo czyściłaś,
  może być mniej. To też jest poprawne;
- krok 2: **nie ma** pozycji *AGRI STAR II*;
- krok 3: **żadna** pozycja nie podpowiada samej siebie. Większość ma *brak podobnych*.
  Podpowiedzi jest dziś kilkanaście (o nich punkt 1.3).

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.3 Wielkość liter nie przeszkadza już podpowiedziom

> **Zdecydowałaś** (pytanie 7.3, o „BKT” i „bkt”): *„tak, bo mamy logikę, że katalog ma się
> zmieniać na drukowane litery, a w plikach przychodzi różnie”*.

**Jest teraz.** Porównywarka podpowiedzi ignoruje wielkość liter i nadmiarowe spacje. Pozycja
*bkt* dostałaby podpowiedź **BKT (100%)**, a nie *brak podobnych*. Reszta zasad się nie
zmieniła: podpowiedź pokazuje się od 90% podobieństwa i jest ich najwyżej pięć.

Na kopii produkcji dało to **13 nowych podpowiedzi**, na przykład:
- kategorie: *rolnicze* → **Rolnicze (100%)**, *ciężarowe* → **Ciężarowe (100%)**,
  *leśne* → **Leśne (100%)**, *przemyslowe* → **Przemysłowe (91%)**;
- bieżniki: *FARMAX R75* → **Farmax R75 (100%)**, *Conti CrossTrac 3* → **CONTI CROSSTRAC 3
  (100%)**, *MG638 NAPĘD* → **MG638  napęd (100%)**.

**Sprawdź** (tylko patrzysz, **nic nie klikasz**):
1. **Atrybuty → Do akceptacji**, filtr **Rodzaj** → *kategoria*. Znajdź pozycję *rolnicze*.
2. Filtr **Rodzaj** → *bieznik*. Znajdź *FARMAX R75* i *Conti CrossTrac 3*.

**Ma się stać:**
- krok 1: przy *rolnicze* w kolumnie **Sugerowane aliasy** jest **Rolnicze (100%)**. Wcześniej
  było tam *brak podobnych*;
- krok 2: przy *FARMAX R75* jest **Farmax R75 (100%)**, a przy *Conti CrossTrac 3* jest
  **CONTI CROSSTRAC 3 (100%)**.

Jeśli którejś z tych pozycji nie ma w kolejce (bo na przykład zaakceptowałaś ją w pierwszej
rundzie), zaznacz niżej „nie było” i wpisz, których brakowało.

**⚠ Zanim zaczniesz klikać podpowiedzi, przeczytaj te cztery rzeczy:**

1. **Podpowiedzi jest więcej niż dotąd, a alias nadal przepisuje produkty w CAŁYM katalogu
   i nie da się go cofnąć.** Różnica jest taka, że teraz zostaje po nim wpis w Historii (1.1).
2. **Forma w podpowiedzi bywa pisana małymi literami.** *Farmax R75* i *MG638  napęd* są
   w słowniku zapisane wbrew zasadzie drukowanych liter. Kliknięcie takiej podpowiedzi przepisze
   produkty **na tę małoliterową formę**. Jeśli chcesz mieć wielkie litery, użyj **Edytuj**
   i wpisz formę sama.
3. **91% nie znaczy „to samo”.** *MG628 NAPĘD* dostaje podpowiedź *MG638  napęd* (91%), czyli
   różnica jednej cyfry, prawdopodobnie inny bieżnik. *Conti EfficientPro 5* dostaje dwie
   podpowiedzi po 91%: *…HD5* i *…HS5*, a to dwa różne warianty. Zanim klikniesz, sprawdź, czy
   to naprawdę ta sama rzecz.
4. **Przy *rolnicze* ostrzeżenie w okienku pokaże 0 produktów, mimo że kolumna Wystąpień mówi
   334.** Katalog ma już te kategorie z Wielkiej litery, więc nie ma czego przepisywać.
   Wyjaśnienie jest w punkcie 2.2.

> **Twoja ocena:** ☐ OK ☐ ŹLE ☐ nie było tych pozycji — uwagi: _______________

---

## 1.4 ⭐ „model” i „zastosowanie” — sprostowanie i jedno pytanie

> **Odpowiedziałaś** (pytanie 7.4): *„trzeba naprawić”*, zaznaczając wariant *„używam tych
> rodzajów w kolejce”*.

**Musimy sprostować nasz błąd.** Zdanie *„Te dwa rodzaje trafiają do kolejki”* było
nieprawdziwe. Stało w pierwszej wersji instrukcji (§4 pkt 4) i w pytaniu 7.4. Rodzaje „model”
i „zastosowanie” **nigdy nie trafiały do kolejki, ani w starym, ani w nowym Bridge**: kolejka
sprawdza 13 innych rodzajów, a na kopii produkcji nie ma ani jednej takiej pozycji. Twoja
odpowiedź opierała się na naszym błędnym opisie, dlatego pytamy jeszcze raz, inaczej.

**Co jest teraz.** Gdyby taka pozycja jednak się w kolejce pojawiła, **Edytuj** i alias
zadziałają. Błędu *„Nieznany rodzaj”* z pierwszej wersji już nie ma. Nie ma tu czego klikać,
bo takich pozycji w kolejce nie ma.

**Pytanie: gdzie używasz rodzajów „model” i „zastosowanie”?** Można zaznaczyć kilka.

- **(a)** w słowniku atrybutów: dodaję i poprawiam ich wartości w **Atrybutach**
- **(b)** w filtrach **Katalogu** albo w regułach **Narzutów i promocji**
- **(c)** oczekuję, że **nowe** modele i zastosowania z importów **będą trafiać do kolejki**
  „Do akceptacji”, żebym mogła je zatwierdzić
- **(d)** nie używam ich

**Uwaga przy (c):** to byłaby nowa funkcja, a nie naprawa, i wymagałaby osobnej rozmowy.
W katalogu jest około 1670 różnych modeli. Samo pierwsze sprawdzenie dorzuciłoby do kolejki
**około 200 modeli**, których dziś nie ma w słowniku (kolejka urosłaby z około 60 do około
270 pozycji), a potem każdy import z nowymi modelami dokładałby kolejne.

> **ODPOWIEDŹ:** ☐ (a) ☐ (b) ☐ (c) ☐ (d) — komentarz: _______________

---

# 2. Przy okazji — rzeczy, o które nie pytałaś

> **O żadną z tych trzech rzeczy nie pytałaś i żadnej nie zgłaszałaś.** Wyszły przy zmianach
> z rozdziału 1 i widać je na ekranie, dlatego o nich piszemy.

## 2.1 Liczba w ostrzeżeniu jest teraz pilnowana automatycznie

Sprawdziliśmy na kopii produkcji **wszystkie** pozycje kolejki i obie akcje, które przepisują
produkty (Edytuj i alias). Liczba produktów w ostrzeżeniu była **za każdym razem równa**
liczbie produktów, które akcja naprawdę przepisała, i liczbie w komunikacie „Zaktualizowano
produktów”. Wyszło **0 różnic na 4148 próbach**. To sprawdzenie zostało w programie i powtarza
się samo przy każdej zmianie.

Dlatego zgłoszenie z §7 pierwszej wersji *„liczba produktów w ostrzeżeniu nie zgadza się z tym,
co realnie się zmieniło”* ma dziś mniejszą wagę. Jeśli jednak zobaczysz, że ostrzeżenie,
komunikat po zapisie i Katalog pokazują różne liczby, **zgłoś to od razu**.

> **Przeczytane:** ☐ tak ☐ niejasne — co: _______________

## 2.2 Kolumna „Wystąpień” i liczba w ostrzeżeniu mogą się różnić. To nie błąd

**Skąd biorą się te liczby:**
- **kolumna „Wystąpień”** pokazuje liczbę produktów z chwili, gdy pozycja trafiła do kolejki;
- **ostrzeżenie w okienku** liczy produkty **na bieżąco**, w chwili otwarcia okienka. Przez
  ułamek sekundy, zanim policzy, pokazuje liczbę z kolumny.

Jeśli między tymi chwilami katalog się zmienił (import, poprawka kategorii na Wielką literę),
liczby się różnią. **Wiarygodna jest liczba z ostrzeżenia.** Ona jest równa temu, co akcja
naprawdę przepisze (punkt 2.1).

**Na stagingu widać to dziś przy każdej pozycji w kolejce.** Wszystkie pozycje, które zostały po
sprzątaniu z punktu 1.2, mają dziś **0 produktów** w katalogu, choć kolumna pokazuje więcej.
Przykłady: *rolnicze* ma w kolumnie **334**, a w ostrzeżeniu **0** (katalog ma już *Rolnicze*).
*CONTI ECO 5* ma w kolumnie **9**, a w ostrzeżeniu **0** (tych produktów nie ma już w katalogu).
Dlatego punkt 1.1 zaczyna się od przygotowania własnej pozycji.

**Co się stanie, gdy klikniesz akcję na takiej pozycji:** żaden produkt się nie zmieni, pozycja
zniknie z kolejki, a przy Edytuj i aliasie powstanie wpis w Historii z „Pozycji: 0”. Przy
Edytuj poprawiona wartość trafi też do słownika. Nic się nie psuje. Po prostu nie ma czego
przepisywać.

**Wyczyszczonej kolejki import już nie odbuduje.** Pozycja wraca do kolejki tylko wtedy, gdy
jej wartość jest jeszcze na jakimś produkcie. Tych 61 pozycji nie ma na żadnym produkcie, więc
po **Wyczyść pending** już nie wrócą. Stąd ostrzeżenie na początku kartki.

> **Przeczytane:** ☐ tak ☐ niejasne — co: _______________

## 2.3 Nowa marka albo nowy bieżnik z importu znika z kolejki przy uruchomieniu serwera

Przy każdym uruchomieniu serwera (na przykład po wdrożeniu nowej wersji) Bridge dopisuje do
słownika **wszystkie marki i bieżniki, które są na produktach**. Tak robi też stary Bridge.
Nowe jest tylko to, że kolejka teraz sprząta pozycje obecne w słowniku (punkt 1.2).

**Skutek:** nowa marka albo nowy bieżnik, który przyszedł z importu i czeka w kolejce, **sam
zniknie z niej przy najbliższym uruchomieniu serwera**, bo w tej chwili trafi do słownika. Tak,
jakby ktoś kliknął **Akceptuj**. Produkty się nie zmieniają. Pozostałych rodzajów (rozmiary,
indeksy, kategorie…) to nie dotyczy.

W starym Bridge działo się podobnie, tylko było to ukryte: pozycja zostawała w kolejce
i podpowiadała samą siebie ze 100%.

**Czy to Ci odpowiada?**

> **ODPOWIEDŹ:** ☐ tak, może tak zostać ☐ nie — wolę, żeby nowe marki i bieżniki czekały
> w kolejce, aż sama je zatwierdzę — komentarz: _______________

---

# 3. Co w pierwszej wersji przestało być prawdą

Jeśli wracasz do [pierwszej wersji](instrukcja-testow-I7.md), te zdania są już nieaktualne.
**Reszta tamtego dokumentu obowiązuje bez zmian.**

## 3.1 Zdania unieważnione przez zmiany z rozdziałów 1 i 2

| Punkt pierwszej wersji | Co mówił | Jak jest teraz |
|---|---|---|
| **Ramka na górze** („Jedna rzecz do przeczytania ZANIM zaczniesz”) | „Nie da się tego cofnąć przyciskiem i **nie zostaje po tym ślad w historii zmian**.” | Cofnąć nadal się nie da, ale **ślad w Historii zostaje** — **punkt 1.1**. |
| **§1** Skala danych | „**ok. 500 pozycji** w kolejce „Do akceptacji"” | **Około 60** (na kopii produkcji 61) — **punkt 1.2**. |
| **§1** Sedno do sprawdzenia, pkt 3 | „**„Wyczyść pending" to schowanie, nie odrzucenie** — wartości wrócą przy następnym imporcie.” | Nadal schowanie, nie odrzucenie, ale wraca tylko wartość, która jest jeszcze na produktach. Dzisiejszych 61 pozycji **nie wróci** — **punkt 2.2**. |
| **§2** Skąd się bierze kolejka | „Na stagingu kolejka powinna już być pełna (snapshot produkcji, ok. 500 pozycji)” | **Około 60** — **punkt 1.2**. |
| **§2** Skąd się bierze kolejka | „Jeśli pokazuje **0**, znaczy że ktoś ją wcześniej wyczyścił; żeby ją odbudować, wystarczy zatwierdzić dowolny import w *Stagingu*” | Import przywróci tylko pozycje, których wartość jest jeszcze na produktach. Dzisiejszych 61 pozycji **nie wróci** — **punkt 2.2**. |
| **§3.9** Kolejka — pierwsze wejście | „odznaka przy przycisku pokazuje liczbę pozycji (ok. 500)” · „serwer dla **każdej** z ~500 pozycji porównuje ją z całym słownikiem (…)” | Pozycji jest **około 60** — **punkt 1.2**. |
| **§3.9**, przykład podpowiedzi | „np. *AGRISTAR II (92%)*” | Pozycja *AGRI STAR II* **zniknęła z kolejki**, bo jest w słowniku, więc tego przykładu już nie zobaczysz — **punkt 1.2**. Zasada („do pięciu podobnych wartości z procentem”) obowiązuje. |
| **§3.11** Akceptuj z edycją, ostrzeżenie | „*Zmiana przepisze pole **bieznik** w **186** produktach katalogu. Operacji nie da się cofnąć ani odtworzyć z dziennika…*” | Ostrzeżenie brzmi teraz: *„…Operacji nie da się cofnąć. Zostanie po niej wpis w Historii (typ „edycja”).”* — **punkt 1.1**. |
| **§3.11** Akceptuj z edycją | „liczba ma odpowiadać temu, co pokazuje kolumna *Wystąpień*” | **Nie musi.** Kolumna to liczba z chwili trafienia do kolejki, ostrzeżenie liczy na bieżąco. Wiarygodne jest ostrzeżenie — **punkt 2.2**. |
| **§3.12** Alias | „plus to samo ostrzeżenie o liczbie produktów” | Ostrzeżenie jest nadal wspólne dla obu okienek, ale ma nowe brzmienie z punktu **1.1**. Przykład *AGRI STAR II → AGRISTAR II* z tego punktu **nie jest już w kolejce** (**1.2**). |
| **§4 pkt 1** | „**Pozycja w kolejce podpowiada samą siebie ze 100%.** (…) słownik bieżników został zasiany z **nazw modeli** produktów” | **Nieaktualne** — takie pozycje znikają z kolejki, a podpowiedź nigdy nie jest identyczna z pozycją. Przyczyna była też szersza niż same nazwy modeli — **punkt 1.2**. |
| **§4 pkt 2** | „**„BKT" i „bkt" nie podpowiadają się nawzajem.** Porównywarka podobieństwa nie zrównuje wielkich i małych liter (…)” | **Nieaktualne** — zrównuje. *bkt* dostaje **BKT (100%)** — **punkt 1.3**. |
| **§4 pkt 7** | „**Akcje kolejki nie zostawiają śladu w historii zmian.** Ani „Akceptuj z edycją", ani alias nie pojawią się w widoku *Historia* (…)” | **Nieaktualne** — obie się pojawiają. Akceptuj, Odrzuć i Wyczyść nadal nie — **punkt 1.1**. |
| **§4 pkt 8** | „**Kolejka ładuje się wolno.** Przyczyna jest po stronie serwera (liczenie podobieństwa dla ~500 pozycji wobec całego słownika)” | Mechanizm jest ten sam, ale pozycji jest około 60 zamiast około 500, więc serwer liczy **mniej więcej ośmiokrotnie mniej**. Jeśli kolejka nadal ładuje się chwilę, to nie błąd. |
| **§5** Czego jeszcze nie ma | wiersz „Ślad akcji kolejki w Historii” → „do decyzji — patrz punkt 7 wyżej” | **Już jest** dla Edytuj i aliasu — **punkt 1.1**. |
| **§7** Najcenniejsze zgłoszenia, poz. 2 | „**liczba produktów w ostrzeżeniu nie zgadza się z tym, co realnie się zmieniło**” | Nadal zgłaszaj, ale to jest teraz sprawdzane automatycznie — **punkt 2.1**. Różnica między kolumną *Wystąpień* a ostrzeżeniem **nie jest** takim błędem — **punkt 2.2**. |

> **Czy któryś z tych punktów zachowuje się u Ciebie nadal po staremu?**
> ☐ nie ☐ tak — który: _______________

## 3.2 ⚠ §4 pkt 4 był NIEPRAWDZIWY od samego początku

**Co Ci napisaliśmy** (§4 pkt 4, na liście „rzeczy, które wyglądają na błąd, a są poprawne”):
*„Przy rodzajach „model" i „zastosowanie" akcje Edytuj i alias mogą zwrócić błąd „Nieznany
rodzaj". Te dwa rodzaje trafiają do kolejki, ale mechanizm przepisywania produktów ich nie
obsługuje”*.

**Jak było naprawdę.** Te dwa rodzaje **nigdy nie trafiały do kolejki**, więc tego błędu nie
dało się zobaczyć z ekranu. Pisaliśmy na podstawie kodu, bez sprawdzenia, czy takie pozycje
w ogóle powstają. Tę samą nieprawdę powtórzyliśmy w pytaniu 7.4. **Jak jest teraz** i pytanie
do Ciebie: **punkt 1.4**.

---

# 4. Podsumowanie

| Punkt | Co sprawdzasz | OK | ŹLE | Uwagi |
|---|---|:--:|:--:|---|
| **1.1** ⭐ | **Edytuj na przygotowanej pozycji → wpis w Historii; 3 = 3 = 3** | ☐ | ☐ | |
| 1.2 | Kolejka ma około 60 pozycji, nic nie podpowiada samej siebie | ☐ | ☐ | |
| 1.3 | *rolnicze* → *Rolnicze (100%)*; przeczytane cztery uwagi o aliasach | ☐ | ☐ | |
| **1.4** ⭐ | **Odpowiedź: gdzie używasz „model” i „zastosowanie”** | — | — | |
| 2.1 | Przeczytane: liczba w ostrzeżeniu pilnowana automatycznie | ☐ | ☐ | |
| 2.2 | Przeczytane: kolumna *Wystąpień* a ostrzeżenie | ☐ | ☐ | |
| 2.3 | Odpowiedź: nowe marki i bieżniki znikają z kolejki przy uruchomieniu | — | — | |
| 3 | Żaden z unieważnionych punktów nie działa po staremu | ☐ | ☐ | |

**Sprawdzonych ____ / 6 · błędów ____ · pominiętych ____ · odpowiedzi ____ / 2**

---

# 5. Jak zgłosić znalezisko

**Zasady zgłaszania są te same co w [pierwszej wersji, rozdział 7](instrukcja-testow-I7.md)**:
podaj numer punktu, **rodzaj i wartość** pozycji (np. *bieznik / 307*), **którą akcję** kliknęłaś
(Akceptuj / Edytuj / alias / Odrzuć), co zobaczyłaś zamiast oczekiwanego, godzinę i zrzut ekranu.

**Najpierw sprawdź ramki ⚠ przy punkcie.** Sześć rzeczy w tej kartce wygląda na błąd, a jest
poprawnych:

1. **kolumna *Wystąpień* pokazuje co innego niż ostrzeżenie**, na przykład 334 i 0 (2.2);
2. **Akceptuj, Odrzuć i Wyczyść nie pokazują się w Historii** (1.1);
3. **„bieznik” bez ogonka i „—” jako dostawca** we wpisie z kolejki w Historii (1.1);
4. **pozycja `307` nie wróciła do kolejki**, jeśli po drodze serwer był uruchomiony ponownie.
   Powtórz przygotowanie (1.1, 2.3);
5. **podpowiedź w formie małymi literami** albo **91% przy różnych produktach** (1.3);
6. **nowa marka lub bieżnik zniknęły z kolejki bez Twojego kliknięcia** po uruchomieniu serwera (2.3).

**Cztery rzeczy, przy których jest ODWROTNIE.** Tutaj błędem jest to, że coś się pojawia albo
*nie* działa, i chcemy o tym wiedzieć od razu:

- **jakaś pozycja podpowiada samą siebie** (np. *X* z podpowiedzią *X (100%)*) — miało zniknąć (1.2);
- **po Edytuj albo aliasie nie ma nowego wiersza w Historii** po odświeżeniu strony (1.1);
- **ostrzeżenie, komunikat „Zaktualizowano produktów” i Historia pokazują różne liczby** (1.1, 2.1);
- **ostrzeżenie w okienku mówi, że akcje kolejki „nie trafiają do audytu”** — tego zdania już
  nie powinno być (1.1).
