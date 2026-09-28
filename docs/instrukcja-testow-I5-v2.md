# Iteracja 5 (Historia) — wersja 2: po Twoich odpowiedziach

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-21 · **Dla:** Ania
**Uzupełnia:** [pierwszą wersję](instrukcja-testow-I5.md) z 2026-09-02, w punktach opisanych niżej

> **To jest STAGING, nie produkcja.** Cokolwiek tu klikniesz, produkcji nie dotyka.

---

## Po co ta kartka

**To jest WERSJA 2 i zawiera TYLKO DELTĘ**, czyli wyłącznie to, co zmieniło się od czasu, gdy
przeszłaś pierwszą wersję. **Nie jest to instrukcja od nowa.** Nie przechodzisz Historii drugi raz:
wszystko, co w pierwszej wersji potwierdziłaś („Działa", „tak działa", „bez zarzutów"), **zostaje
aktualne** i nie musisz tego powtarzać.

**W Iteracji 5 niczego nie reklamowałaś**, dlatego ta kartka jest krótka. Zawiera trzy rzeczy:

- **rozdział 1:** Twoje odpowiedzi na nasze pytania i co z nimi zrobiliśmy. Tu nie ma nic do
  klikania;
- **rozdział 2:** dwie zmiany, **o które nie prosiłaś**. Znaleźliśmy je sami. Jedną da się
  sprawdzić, drugiej dziś nie widać;
- **rozdział 3:** zdania z pierwszej wersji, które **przestały być prawdą**.

**Pierwsza wersja zostaje w repozytorium bez zmian.** Obowiązuje we wszystkim, czego tu nie ma.
Tam, gdzie coś się różni, **prawdą jest ta kartka.**

**Ile to zajmuje:** około 10 minut. Do klikania jest jeden punkt (2.2), reszta to czytanie.

### Jak wypełniać

Punkt do sprawdzenia kończy się linijką **Twoja ocena**:

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

Przy „ŹLE" napisz, **co zobaczyłaś zamiast** oczekiwanego, i **zrób zrzut ekranu**. Zbiorcze
podsumowanie jest w rozdziale 4.

---

# 1. Twoje odpowiedzi — co z nimi zrobiliśmy

## 1.1 Import z adresu i automat nadal NIE zostawiają śladu w Historii

> **Zdecydowałaś** (§3.2 pierwszej wersji, pytanie o to, czy pokazywać tu automatyczne
> pobieranie cenników): **NIE** — *„importy są co 60 minut i cała historia będzie zawalona
> importami"*.

**Jest teraz:** zrobiliśmy tak, jak zdecydowałaś, czyli **niczego nie zmieniliśmy**. Tabela
z §3.2 pierwszej wersji **zostaje prawdą**: wgranie cennika z przeglądarki zostawia wpis,
a „Synchronizuj teraz", automatyczne pobieranie, działania w Stagingu, zmiany ustawień dostawcy
ani narzuty i promocje — nie. Pytanie jest zamknięte i nie wrócimy do niego bez Twojej prośby.
*(Ramka „W praktyce" pod tą tabelą jest już nieaktualna, ale z innego powodu, patrz punkt 3.2.)*

**Sprawdź:** nic. To zachowanie potwierdziłaś już w pierwszej rundzie.

## 1.2 Powrót na stronę 1 po zmianie filtra (§6) — nie musisz go sprawdzać

> **Napisałaś:** *„nie ma tam aż tylu pozycji do danego filtru, żeby ocenić, czy powraca się do
> starej strony — każdy wybrany filtr daje max 1 stronę"*.

**Jest teraz:** tego nie da się sprawdzić ręcznie na danych, które są na stagingu, więc
**sprawdza to automat przy każdej zmianie programu**: przechodzi na dalszą stronę, zmienia filtr
i pilnuje, żeby ekran wrócił na stronę 1. **Nie musisz tego powtarzać.**

## 1.3 Porównanie ze starym Bridge (§9) — zrobiliśmy je za Ciebie

> **§9 zostawiłaś pusty.**

**Jest teraz:** porównaliśmy obie Historie automatycznie, na tej samej kopii danych i przy
wszystkich filtrach. Wyszło **0 różnic na 49 813 porównanych wpisach**. Porównanie zostało
w programie i powtarza się samo przy każdej zmianie. **Nie musisz robić §9 ręcznie.**

> **Czy dobrze zapamiętaliśmy Twoje odpowiedzi?**
> ☐ tak, wszystkie trzy ☐ nie — która i co jest inaczej: _______________

---

# 2. Przy okazji — zmiany, o które nie prosiłaś

> **Żadnej z tych dwóch rzeczy nie zgłaszałaś.** Obie wyszły przy porównaniu z punktu 1.3,
> które zrobiliśmy za Ciebie. Opisujemy je, bo zmieniają zdania z pierwszej wersji (rozdział 3),
> a jedna z nich pokaże Ci w nowym Bridge coś, czego w starym nie ma.

---

## 2.1 Historia przestała gubić najstarsze wpisy — dziś nie ma tu czego klikać

**Co było.** Ekran brał z dziennika zdarzeń **5000 najświeższych** i dopiero spośród nich
wybierał te, które pokazuje. Większości zdarzeń w dzienniku ekran i tak nie pokazuje (§3.2):
na kopii produkcji to **93%**, a samo automatyczne pobieranie cenników to **2869 z 3873**
zdarzeń. Przy dłuższym dzienniku ten limit zjadałby więc najstarsze wpisy Historii. Znikałyby
z listy na każdej stronie, a licznik `N wpisów` przestałby pokazywać, ile ich jest naprawdę.
Pierwsza wersja opisała to w §11 pkt 9 jako dziwactwo, które odtwarzamy celowo.

**Jak jest teraz.** Limitu nie ma. Ekran bierze **cały** dziennik i pokazuje **wszystkie** wpisy
swoich pięciu rodzajów, bez względu na ich wiek.

**Czy zobaczysz różnicę? Nie.** Na stagingu dziennik ma mniej niż 5000 zdarzeń (kopia produkcji
ma 3873), a automatyczne pobieranie jest tam wyłączone, więc do progu nie dojdzie. Kolejność
wpisów, licznik i wyniki wyszukiwarki są **dokładnie takie jak przed zmianą**. Sprawdziliśmy to
na kopii produkcji. **Nie ma czego klikać.** To zabezpieczenie na czas po przełączeniu
produkcji na nowy Bridge, gdzie automat pobierający cenniki stale dopisuje nowe zdarzenia.

**⚠ Jedyne miejsce, w którym możesz to zauważyć, to stary Bridge.** Tam limit został. Jeśli
kiedyś zobaczysz, że Historia w starym Bridge **zaczyna się później** niż w nowym (nowy sięga
dalej wstecz), to jest właśnie ten limit. **Nie zgłaszaj tego.**

> **Przeczytane:** ☐ tak ☐ niejasne — co: _______________

---

## 2.2 ⭐ Eksport wszystkich dostawców do ZIP-a zostawia wpis w Historii — tylko w nowym Bridge

**Co to jest.** Bridge potrafi oddać cały katalog jako jedno archiwum ZIP, w którym jest osobny
plik dla każdego dostawcy, w układzie dla Shopera. **Nie ma do tego przycisku** ani w starym,
ani w nowym Bridge. Otwiera się go wyłącznie linkiem. Przycisk „Pobierz CSV" w Katalogu to coś
innego: robi plik w Twojej przeglądarce i nie zostawia śladu w Historii.

**Dlaczego nowy Bridge robi tu co innego niż stary.** W starym Bridge ten eksport **od zawsze
kończy się błędem**, bo program korzysta ze starszej wersji jednego z elementów, z których jest
zbudowany. W nowym eksport działa. Zdecydowaliśmy **18 września**, że **tego błędu nie
odtwarzamy**. Byłoby to odtwarzanie usterki, a nie zachowania.

**Konsekwencja dla Historii.** Po eksporcie ZIP w nowym Bridge pojawia się wpis typu
**eksport**. W starym Bridge taki wpis **nie może się pojawić**, bo eksport pada, zanim cokolwiek
zapisze. **To jedyny rodzaj wpisu, który nowy Bridge pokazuje celowo, a stary nie.**

**Sprawdź:**
1. Zaloguj się na https://test.agritires.eu, wejdź w **Historię** i zanotuj licznik
   `N wpisów` po prawej.
2. **W tej samej przeglądarce** kliknij ten link:
   **https://test.agritires.eu/api/export-shoper**
3. Przeglądarka pobierze plik `shoper_wszyscy_<dzisiejsza data>.zip`. Możesz go otworzyć, ale
   nie musisz.
4. Wróć na **Historię** i odśwież stronę.
5. Ustaw filtr **Typ** na *Eksporty*.

**Ma się stać:**
- krok 3: **pobiera się plik ZIP**, a w środku jest po jednym pliku na każdego dostawcę;
- krok 4: na górze listy jest **nowy wiersz** z dzisiejszą datą i godziną:
  - **Typ** to zielona odznaka `eksport`,
  - **Dostawca** to **„—"**,
  - **Użytkownik** to Ty,
  - **Pozycji** to **liczba dostawców** (tylu, ilu jest w Konfiguracji; na kopii produkcji 10),
  - **Szczegóły** pokazują **„Format: csv Format: csv"**;
- krok 4: licznik `N wpisów` urósł o jeden;
- krok 5: ten wiersz jest na liście *Eksporty*.

**⚠ „—" w kolumnie Dostawca jest poprawne.** Eksport dotyczy wszystkich dostawców naraz, więc
nie ma jednego kodu do wpisania. Z tego samego powodu **nie znajdziesz tego wpisu filtrem
Dostawca**, tylko filtrem *Typ*.

**⚠ „Format: csv" dwa razy to nie błąd.** Stary Bridge wypisuje tak każdy wpis eksportu i my
odtworzyliśmy to 1:1.

**⚠ Jeśli zamiast pobierania zobaczysz krótki napis ze słowem „Nieautoryzowany"**, to
przeglądarka nie wie, że jesteś zalogowana. Zaloguj się w tej samej przeglądarce i kliknij link jeszcze raz.

**⚠ Nie zgłaszaj tego wpisu jako rozbieżności ze starym Bridge.** W starym go nie ma i mieć nie
będzie. Dla porządku: w starym Bridge ten sam eksport kończy się błędem, więc nie ma sensu
próbować go tam dla porównania.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 3. Co w pierwszej wersji przestało być prawdą

Jeśli wracasz do [pierwszej wersji](instrukcja-testow-I5.md), te zdania są już nieaktualne.
**Reszta tamtego dokumentu obowiązuje bez zmian.**

## 3.1 Zdania unieważnione przez zmiany z rozdziału 2

| Punkt pierwszej wersji | Co mówił | Jak jest teraz |
|---|---|---|
| **§8.2** Eksport | „Nowych eksportów **nie wygenerujesz** — eksport przychodzi w późniejszej iteracji" | Z **ekranów** nadal nie wygenerujesz. Przycisku nie ma i nie będzie, bo w starym Bridge też go nie ma. Eksport jednak już działa: **link z punktu 2.2** dodaje wpis `eksport`. |
| **§9** i **§13** Porównanie | „**Te same wpisy, w tej samej kolejności** (najnowsze na górze)", „**Ta sama liczba wpisów** w liczniku" | Są **dwa wyjątki**: wpis eksportu ZIP jest tylko w nowym Bridge (**2.2**), a najstarsze wpisy mogą być widoczne tylko w nowym (**2.1**). Samego §9 nie musisz robić (**1.3**). |
| **§9**, ramka | „jeśli któryś wpis jest w starym Bridge, a nie ma go w nowym (albo odwrotnie) — **napisz od razu**" | „Albo odwrotnie" ma te same **dwa wyjątki** (**2.1** i **2.2**). Wpis, który jest w starym, a nie ma go w nowym, dalej zgłaszaj od razu. |
| **§10** Świadome odstępstwa | „Trzy rzeczy zmieniliśmy celowo." | Jest ich **pięć**. Do trzech z tabeli doszły: **brak limitu 5000** (**2.1**) i **działający eksport ZIP** (**2.2**). |
| **§11 pkt 9** | „**Ekran czyta 5000 najświeższych zdarzeń** i dopiero na nich filtruje. (…) Dziś to niewidoczne, ale z czasem wypłynie." | **Nieaktualne w nowym Bridge**, bo limitu już nie ma (**2.1**). Limit został tylko w starym. |
| **§12** Czego jeszcze nie ma | wiersz „Eksporty — źródło nowych wpisów *eksport* (§8.2)" → „późniejsza iteracja" | Nie będzie przycisku. Jedyna droga do nowego wpisu `eksport` to **link z punktu 2.2**. |
| **§14** Najcenniejsze zgłoszenia, poz. 1 i 4 | „**Wpis jest w starym Bridge, a nie ma go w nowym** (albo odwrotnie)" · „a nie ma tego w rozdziale 10 ani 11" | Obowiązują z wyjątkami z **2.1** i **2.2**. Do listy rzeczy, których nie zgłaszasz, dochodzi **rozdział 2 tej kartki**. |

## 3.2 Zdania nieaktualne głównie z innego powodu — edycja produktu w Katalogu

Te zdania zdezaktualizowały się przede wszystkim wcześniej, kiedy do Katalogu doszła ręczna
edycja produktu. Wypisujemy je, bo pierwsza wersja jest tu po prostu nieprawdziwa.

| Punkt pierwszej wersji | Co mówił | Jak jest teraz |
|---|---|---|
| **§1**, **§3.2** (ramka „W praktyce") i **§5** | „bez wgrania pliku nie zobaczysz nowych wpisów" · „jedyne kliknięcie w nowym Bridge, które **na pewno** doda wiersz do Historii, to wgranie pliku z cennikiem przez przeglądarkę" · „To jedyna droga, którą wygenerujesz nowy wpis (§3.2)." | Dróg są **trzy**: wgranie cennika, **edycja produktu w Katalogu** (wiersz niżej) i **link eksportu z punktu 2.2**. Druga połowa ramki zostaje prawdą: „Synchronizuj teraz" nadal nie dodaje wiersza (**1.1**). |
| **§3.3** Typ „Edycje" | „Nowy Bridge ma na razie katalog **tylko do odczytu** (edycja produktu przychodzi w późniejszej iteracji), więc *edycje*, które zobaczysz, pochodzą **wyłącznie z kopii starej produkcji**." | Produkt da się edytować: w **Katalogu** menu **„Akcje"** przy wierszu → **„Edytuj"** → **„Zapisz zmiany"**. Każdy taki zapis dodaje do Historii wpis `edycja` z kodem produktu i nazwami zmienionych pól, tak samo jak w starym Bridge (sprawdziliśmy to przy porównaniu z punktu 1.3). |
| **§12** Czego jeszcze nie ma | wiersz „Ręczna edycja produktu w katalogu — czyli źródło nowych wpisów *edycja* (§3.3)" → „późniejsza iteracja" | Już jest (patrz wiersz wyżej). |

---

# 4. Podsumowanie

| Punkt | Co sprawdzasz | OK | ŹLE | Uwagi |
|---|---|:--:|:--:|---|
| 1 | Trzy Twoje odpowiedzi zapamiętane poprawnie | ☐ | ☐ | |
| 2.1 | Przeczytane: limit 5000 zniknął, dziś nic do klikania | ☐ | ☐ | |
| **2.2** ⭐ | **Link pobiera ZIP, w Historii pojawia się wpis `eksport` z „—" jako dostawcą** | ☐ | ☐ | |
| 3 | Przeczytane: co w pierwszej wersji jest nieaktualne | ☐ | ☐ | |

**Sprawdzonych ____ / 4 · błędów ____ · pominiętych ____**

---

# 5. Jak zgłosić znalezisko

**Zasady zgłaszania są te same co w [pierwszej wersji, rozdział 14](instrukcja-testow-I5.md)**:
podaj numer punktu, co zobaczyłaś zamiast oczekiwanego, datę i godzinę wpisu (pierwsza kolumna)
i zrób zrzut ekranu.

**Najpierw sprawdź ramki ⚠ przy punkcie.** Cztery rzeczy w tej kartce wyglądają na błąd,
a są poprawne:

1. **stary Bridge zaczyna Historię później niż nowy** (2.1);
2. **„—" w kolumnie Dostawca** przy wpisie eksportu ZIP i brak tego wpisu pod filtrem
   *Dostawca* (2.2);
3. **„Format: csv" wypisane dwa razy** w Szczegółach (2.2);
4. **wpis eksportu, którego w starym Bridge nie ma** (2.2).

**Dwie rzeczy, przy których jest ODWROTNIE.** Tutaj błędem jest to, że coś *nie* działa, i
chcemy o tym wiedzieć od razu:

- **link z punktu 2.2 nie pobiera pliku**, mimo że jesteś zalogowana. Zamiast ZIP-a widzisz
  stronę błędu albo nic się nie dzieje;
- **po pobraniu ZIP-a w Historii nie ma nowego wiersza** po odświeżeniu strony.
