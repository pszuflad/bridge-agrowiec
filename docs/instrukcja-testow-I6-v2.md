# Iteracja 6 (Alerty) — wersja 2: po Twoich odpowiedziach

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-21 · **Dla:** Ania
**Uzupełnia:** [pierwszą wersję](instrukcja-testow-I6.md) z 2026-09-03, w punktach opisanych niżej

> **To jest STAGING, nie produkcja.** Cokolwiek tu klikniesz, produkcji nie dotyka.

---

## Po co ta kartka

**To jest WERSJA 2 i zawiera TYLKO DELTĘ**, czyli wyłącznie to, co zmieniło się od czasu, gdy
przeszłaś pierwszą wersję. **Nie jest to instrukcja od nowa.** Nie przechodzisz Alertów drugi raz:
wszystko, co w pierwszej wersji sprawdziłaś i czego nie reklamowałaś (zwijanie powtórek, rozwijanie
grup, filtry dostawcy i typu, kolejność grup, status zapisany na serwerze), **zostaje aktualne**
i nie musisz tego powtarzać.

W Iteracji 6 nie znalazłaś ani jednej usterki. Na nasze pytania odpowiedziałaś jednak trzy rzeczy,
które zmieniły ekran **Alerty**, i o tym jest ta kartka:

- **rozdział 1:** Twoje trzy odpowiedzi i co z nimi zrobiliśmy. **Tu jest większość klikania;**
- **rozdział 2:** pięć zmian, **o które nie prosiłaś**. Wynikły z Twoich odpowiedzi albo dołożyliśmy
  je sami;
- **rozdział 3:** rzeczy, które wyglądają na błąd, a są odtworzone ze starego Bridge celowo.
  **Tego nie zgłaszaj;**
- **rozdział 4:** zdania z pierwszej wersji, które **przestały być prawdą**.

**Pierwsza wersja zostaje w repozytorium bez zmian.** Obowiązuje we wszystkim, czego tu nie ma.
Tam, gdzie coś się różni, **prawdą jest ta kartka.**

**Ile to zajmuje:** około 30 minut. Punkty 1.2 i 1.3 wymagają alertów importu. Jeśli po pierwszej
rundzie wszystkie zamknęłaś, wyprodukuj je sobie jeszcze raz według
[rozdziału 2 pierwszej wersji](instrukcja-testow-I6.md) (zepsuty adres u MO3 i MO5 →
**Synchronizuj teraz**). Na koniec **przywróć prawidłowe adresy**.

### Jak wypełniać

Punkt do sprawdzenia kończy się linijką **Twoja ocena**:

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

Przy „ŹLE" napisz, **co zobaczyłaś zamiast** oczekiwanego, i **zrób zrzut ekranu**. Zbiorcze
podsumowanie jest w rozdziale 5.

### ⚠ Zanim zaczniesz: dane na stagingu są stare, i to widać w zakładce „Katalog"

Staging stoi na **kopii produkcji z połowy sierpnia**, a automatyczne pobieranie cenników jest tam
wyłączone. Dwie konsekwencje, o których warto wiedzieć, zanim otworzysz nową zakładkę:

1. **„Brak importu cennika" zobaczysz prawie u wszystkich dostawców, i to jako krytyczny.** Ten
   alert liczy dni od **najnowszej daty aktualizacji produktów** danego dostawcy. Na stagingu od
   tamtej pory minęło ponad 30 dni, więc prawie każdy dostawca przekracza próg krytyczny. To jest
   **skutek wieku danych na stagingu**, nie błąd. Na produkcji, gdzie cenniki schodzą co godzinę,
   tych alertów prawie nie będzie. U dostawców, którym na stagingu wgrywałaś cennik, liczba dni
   może być mniejsza.
2. **Z czterech rodzajów ostrzeżeń najpewniej zobaczysz tylko dwa:** „Brak importu cennika"
   i „Bardzo niska marża". „Marży ujemnej" i „Nie-opony w katalogu" na tej kopii danych
   najpewniej nie ma ani jednej. **Nie szukaj ich.** Jeśli się jednak pojawią, to też jest
   w porządku.

---

# 1. Twoje odpowiedzi — co z nimi zrobiliśmy

## 1.1 ⭐ Ostrzeżenia liczone z katalogu wróciły, jako zakładka „Katalog"

> **Zgłosiłaś** (runda 2 pytań, pytanie 1a, po zobaczeniu swojego zrzutu ekranu Alertów ze starego
> Bridge): **„tak, potrzebuję jej w nowym Bridge"**. Chodziło o listę ostrzeżeń wyliczanych na żywo
> z katalogu (ujemna marża, bardzo niska marża, „to nie jest opona"), której w pierwszej wersji nie
> było ([§5](instrukcja-testow-I6.md#5-czego-jeszcze-nie-ma--świadomie), wiersz „Alerty o jakości
> danych w katalogu").

**Jest teraz:** ekran **Alerty** ma **dwie zakładki**:

- **Import** to lista z pierwszej wersji, czyli błędy pobierania cenników zwinięte w grupy.
  **Otwiera się domyślnie;**
- **Katalog** to ostrzeżenia liczone na żywo z katalogu, jak w starym Bridge. Są **obok** błędów
  importu, nie zamiast nich.

W zakładce **Katalog** są cztery rodzaje ostrzeżeń, z tymi samymi nazwami co w starym Bridge:

| Nazwa na liście | Kiedy się pojawia | Poziom |
|---|---|---|
| **Marża ujemna — sprzedaż pod kosztem** | marża produktu poniżej 0% | krytyczny |
| **Bardzo niska marża** | marża produktu poniżej 5% | ostrzeżenie |
| **Nie-opona w katalogu — błąd parsera** | w nazwie albo kategorii jest słowo, które przesądza, że to nie opona (np. dętka) | krytyczny |
| **Brak importu cennika** | od najnowszej aktualizacji produktów dostawcy minęło co najmniej 7 dni (ostrzeżenie) albo 30 dni (krytyczny) | ostrzeżenie / krytyczny |

Nagłówek strony też się zmienił: pod tytułem **Alerty** jest teraz podpis *„Zdarzenia importu
i ostrzeżenia liczone na żywo z katalogu"*.

**Sprawdź:**
1. Kliknij **Alerty** w menu po lewej.
2. **Ma się stać:** pod nagłówkiem dwie zakładki, **Import** i **Katalog**. Aktywna jest
   **Import**, a pod nią lista z pierwszej wersji (tylko z nowym polem wyszukiwania, patrz 1.3).
3. Kliknij zakładkę **Katalog**.
4. **Ma się stać:**
   - nad listą podpis w rodzaju *„N krytycznych · M ostrzeżeń · alerty wyliczane na żywo
     z katalogu"*, taki jak na Twoim zrzucie ze starego Bridge;
   - pasek: napis **FILTRY**, pole **Wszystkie poziomy**, pole **Nierozwiązane**, przycisk
     **Zaakceptuj wszystko** i po prawej licznik **„N alertów"**;
   - lista kart. Każda ma kolorową plakietkę poziomu (**krytyczny** na czerwono, **ostrzeżenie**
     na pomarańczowo), nazwę ostrzeżenia, opis, datę, a przy większości także **„· dostawca MOx"**.
     Na przykład „Bardzo niska marża" ma opis w rodzaju *„KOD · nazwa produktu (marża 0.0%)"*,
     a „Brak importu cennika" opis w rodzaju *„Dostawca MO3: ostatni import N dni temu (próg
     krytyczny: 30 dni)"*;
   - przy nowych ostrzeżeniach kolorowy pasek z lewej strony karty.
5. Otwórz **stary Bridge** i jego ekran Alerty, ten ze swojego zrzutu.
6. **Ma się stać:** układ i słowa są te same (plakietki, nazwy ostrzeżeń, budowa opisu, przyciski).
   **Liczb nie porównuj.** Stary Bridge liczy z dzisiejszej produkcji, a staging z kopii
   z sierpnia, więc liczby będą się różnić.
7. Będąc w zakładce **Katalog**, wciśnij **F5**.
8. **Ma się stać:** po przeładowaniu nadal jesteś w zakładce **Katalog**, nie w **Import**.
   Zakładka jest zapisana w adresie strony, więc link skopiowany z paska adresu też otworzy
   **Katalog**.

**⚠ Jeśli zamiast listy zobaczysz czerwony napis „Nie udało się policzyć alertów katalogu."** —
zgłoś od razu. To nie jest „brak danych", tylko awaria.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

## 1.2 ⭐ Dwa przyciski: „Oznacz jako przejrzany" i „Rozwiąż", w obu zakładkach

> **Zgłosiłaś** (runda 2, pytanie 1b, czy korzystasz z obu przycisków starego Bridge):
> **„używam obu"**.

**Jest teraz:** alert ma **trzy stany**: *nowy*, *przejrzany* i *rozwiązany*. Są przy nim **te same
dwa przyciski co w starym Bridge**, z tymi samymi słowami, w **obu** zakładkach:

- **Oznacz jako przejrzany** oznacza „widziałam, ale jeszcze nie załatwione". Alert **zostaje na
  liście**;
- **Rozwiąż** oznacza „załatwione". Alert **znika z domyślnego widoku**.

W pierwszej wersji był jeden przycisk **Oznacz jako rozwiązane**. Tego napisu już nie ma. Zastąpiło
go **Rozwiąż**.

Przy grupie w zakładce **Import** przycisk podaje w nawiasie, ilu alertów dotyczy, np.
**Rozwiąż (5)**. W zakładce **Katalog** nie ma grup, więc nie ma też nawiasów.

Plakietka przy alercie pokazuje stan tak, jak jest zapisany: `nowy`, `przejrzany`, `rozwiazany`
(bez ogonka, jak w pierwszej wersji, §4 pkt 2).

**Sprawdź, zakładka Import:**
1. Wyprodukuj grupę 5 alertów MO3 (pierwsza wersja, 2.1), wejdź w **Alerty → Import**.
2. **Ma się stać:** przy grupie MO3 dwa przyciski, **Oznacz jako przejrzany (5)** i **Rozwiąż (5)**.
3. Kliknij **Oznacz jako przejrzany (5)**.
4. **Ma się stać:** komunikat **„Zmieniono status 5 alertów"**. Grupa MO3 **zostaje na liście**,
   z plakietką `przejrzany` i przyciskami **Rozwiąż (5)** i **Otwórz ponownie (5)**.
5. Kliknij **Rozwiąż (5)**.
6. **Ma się stać:** komunikat **„Zmieniono status 5 alertów"**, a grupa znika z listy. Nic nie
   zostało skasowane, patrz 2.2.
7. Rozwiń inną grupę z powtórkami (np. MO5, jeśli ma 2×).
8. **Ma się stać:** każdy pojedynczy wpis ma własne, mniejsze przyciski **Oznacz jako przejrzany**
   i **Rozwiąż**, bez nawiasu.

**Sprawdź, zakładka Katalog:**
1. Przejdź na zakładkę **Katalog** i znajdź dowolne ostrzeżenie **Bardzo niska marża**. Zapamiętaj
   liczbę ostrzeżeń w podpisie nad listą.
2. **Ma się stać:** przy nim plakietka `nowy` oraz przyciski **Oznacz jako przejrzany** i **Rozwiąż**.
3. Kliknij **Oznacz jako przejrzany**.
4. **Ma się stać:**
   - komunikat **„Status alertu zmieniony"**;
   - ostrzeżenie **zostaje** na liście, z plakietką `przejrzany`;
   - kolorowy pasek z lewej strony karty znika (pasek mają tylko nowe);
   - przyciski zmieniają się na **Rozwiąż** i **Otwórz ponownie**;
   - liczba ostrzeżeń w podpisie nad listą spada o jeden, bo podpis liczy tylko nowe.
5. Kliknij **Rozwiąż** przy tym samym ostrzeżeniu.
6. **Ma się stać:** komunikat **„Status alertu zmieniony"** i ostrzeżenie znika z listy.

**⚠ Grupa w zakładce Import po kliknięciu wraca zwinięta**, nawet jeśli była rozwinięta. Tak było
już w pierwszej wersji. To drobna niewygoda, nie błąd zapisu.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

## 1.3 Wyszukiwarka po treści alertu, w zakładce Import

> **Zgłosiłaś** (pytanie 6.4, czy przydałaby się wyszukiwarka po treści): **„ta przydałaby się"**.

**Jest teraz:** w zakładce **Import**, na początku paska filtrów, jest pole **Szukaj w treści**.
Przeszukuje **treść** alertów, czyli ten tekst, który widzisz po rozwinięciu grupy, np.
*„MO3 (…): HTTP 404"*. Dzięki temu odróżnisz awarię sieci od błędu formatu pliku bez rozwijania
grup (w pierwszej wersji, §4 pkt 1 i 3: oba mają typ „Błąd pobierania").

Jak działa:
- **wielkość liter nie ma znaczenia**;
- przy kilku słowach **każde musi wystąpić** w treści (np. `fetch failed` znajdzie tylko wpisy,
  w których są oba słowa);
- łączy się z pozostałymi filtrami (status, dostawca, typ), tak jak one łączą się ze sobą;
- **grupa pokazuje tylko pasujące wpisy.** Jeśli w grupie 23× „Błąd pobierania" tylko 3 wpisy
  pasują do szukanego słowa, zobaczysz tę grupę jako **3×**, a **Rozwiąż (3)** zamknie tylko te trzy.
  Pozostałe 20 zostaje otwartych. W ten sposób zamkniesz same błędy formatu pliku, a awarie sieci
  z tej samej grupy zostawisz.

Wyszukiwarka jest **tylko w zakładce Import**. Zakładka Katalog jej nie ma, tak jak stary Bridge.

**Sprawdź:**
1. **Alerty → Import**. W filtrze statusu wybierz **Wszystkie statusy**, żeby widzieć też grupy
   zamknięte.
2. W polu **Szukaj w treści** wpisz `404`.
3. **Ma się stać:** zostają tylko grupy, w których treści jest „404". Wśród nich jest
   **Błąd HTTP** u MO3, a grupa MO5 („Błąd pobierania" z nieistniejącą domeną) znika. Licznik po
   prawej („N grup / M alertów") odpowiednio spada.
4. Dopisz drugie słowo, którego na pewno nie ma, np. `404 banan`.
5. **Ma się stać:** komunikat **„Brak alertów spełniających filtry."**, bo w żadnej treści nie ma
   obu słów naraz.
6. Wyczyść pole.
7. **Ma się stać:** wraca pełna lista.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

> **Czy dobrze zapamiętaliśmy Twoje odpowiedzi?**
> ☐ tak, wszystkie trzy ☐ nie — która i co jest inaczej: _______________

---

# 2. Przy okazji — zmiany, o które nie prosiłaś

> **Żadnej z tych pięciu rzeczy nie zgłaszałaś.** Część wynika z Twoich odpowiedzi z rozdziału 1
> (np. trzeci stan wymusił nowy domyślny filtr), a część dołożyliśmy sami. Tam, gdzie nowy Bridge
> robi co innego niż stary, piszemy to wprost.

---

## 2.1 „Otwórz ponownie" cofa każdą pomyłkę

**Co to jest.** Przy każdym alercie, który **nie jest** nowy, jest przycisk **Otwórz ponownie**,
w obu zakładkach. Przywraca stan *nowy*, niezależnie od tego, czy alert był przejrzany, czy
rozwiązany.

**Czym to się różni od starego Bridge.** W starym Bridge przycisku **Otwórz ponownie** nie ma.
Przejrzanego ani rozwiązanego ostrzeżenia nie da się tam z powrotem oznaczyć jako nowe. Przy trzech
stanach i przycisku **Zaakceptuj wszystko** (2.3) pomyłka musi dać się cofnąć, dlatego go
dołożyliśmy.

W zakładce **Import** ten przycisk był już w pierwszej wersji (§3.7), ale tylko przy rozwiązanych.
Teraz jest też przy przejrzanych.

**Sprawdź:**
1. **Alerty → Katalog**. Przy dowolnym nowym ostrzeżeniu kliknij **Oznacz jako przejrzany**.
2. Przy tym samym ostrzeżeniu kliknij **Otwórz ponownie**.
3. **Ma się stać:** plakietka wraca do `nowy`, wraca kolorowy pasek z lewej strony karty,
   a przyciski znów to **Oznacz jako przejrzany** i **Rozwiąż**.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 2.2 Domyślny filtr to teraz „Nierozwiązane", w obu zakładkach

**Co się zmieniło.** W pierwszej wersji po wejściu na ekran widziałaś tylko alerty w stanie *nowy*.
Teraz jest trzeci stan, więc taki filtr chowałby alerty przejrzane. „Oznacz jako przejrzany"
działałby wtedy jak „Rozwiąż". Dlatego domyślny filtr statusu to **Nierozwiązane**: nowe
**i** przejrzane. Znikają tylko rozwiązane.

Opcje filtra statusu w obu zakładkach:

| Opcja | Co pokazuje |
|---|---|
| **Nierozwiązane** (domyślna) | nowe i przejrzane |
| **Wszystkie statusy** | wszystko, **także rozwiązane** |
| **Nowy** / **Przejrzany** / **Rozwiązany** | tylko ten jeden stan |

W zakładce **Import** opcje **Nowy** / **Przejrzany** / **Rozwiązany** pojawiają się tylko wtedy,
gdy są alerty w takim stanie, tak jak listy dostawców i typów (pierwsza wersja, §3.10). Opcji
**Przejrzany** nie będzie więc, dopóki czegoś nie oznaczysz jako przejrzane.

**Czym to się różni od starego Bridge.** W starym Bridge ekran ostrzeżeń nie miał opcji
„Nierozwiązane", a jego **Wszystkie statusy** **chowało rozwiązane**. Żeby je zobaczyć, trzeba było
wybrać wprost „Rozwiązany". W nowym Bridge **Wszystkie statusy** znaczy dosłownie wszystkie.
Domyślny widok wygląda tak samo jak w starym (rozwiązanych nie widać), różni się tylko opcja
„Wszystkie statusy".

**Sprawdź:**
1. **Alerty → Katalog**. W filtrze statusu wybierz **Wszystkie statusy**.
2. **Ma się stać:** na liście jest też ostrzeżenie rozwiązane w punkcie 1.2, z plakietką
   `rozwiazany` i jednym przyciskiem **Otwórz ponownie**.
3. Wybierz **Rozwiązany**.
4. **Ma się stać:** zostają same rozwiązane.
5. Wróć do **Nierozwiązane**.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 2.3 „Zaakceptuj wszystko" rozwiązuje wszystko, co WIDAĆ, bez pytania

**Co to jest.** Przycisk **Zaakceptuj wszystko** w zakładce **Katalog**, taki jak w starym Bridge.
Oznacza jako rozwiązane **wszystkie ostrzeżenia widoczne w tej chwili na liście**, czyli po
zawężeniu filtrami poziomu i statusu. Tego, czego nie widać, nie rusza.

**Działa od razu, bez okienka „czy na pewno?"**, tak samo jak w starym Bridge.

**⚠ Jak cofnąć:** filtr statusu → **Rozwiązany**, potem **Otwórz ponownie** przy każdym ostrzeżeniu,
które chcesz przywrócić. **Cofa się pojedynczo.** Przycisku „otwórz wszystkie ponownie" nie ma.
Dlatego zanim klikniesz, zawęź listę filtrem do tego, co naprawdę chcesz zamknąć.

**Sprawdź:**
1. **Alerty → Katalog**. W filtrze poziomu wybierz **Ostrzeżenie**.
2. Zapamiętaj licznik „N alertów" po prawej.
3. Kliknij **Zaakceptuj wszystko**.
4. **Ma się stać:** komunikat **„Zmieniono status N alertów"** (to samo N, a przy jednym alercie
   „Status alertu zmieniony"). Lista pokazuje **„Brak alertów spełniających filtr."**
5. W filtrze poziomu wybierz **Wszystkie poziomy**.
6. **Ma się stać:** ostrzeżenia **krytyczne** nadal są na liście, bo nie było ich widać, kiedy
   klikałaś.
7. Cofnij jedno: filtr statusu → **Rozwiązany**, przy dowolnym ostrzeżeniu **Otwórz ponownie**.
8. **Ma się stać:** to jedno wraca do stanu `nowy`. Po powrocie do **Nierozwiązane** znów je
   widać.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 2.4 ⭐ Stan ostrzeżeń z zakładki „Katalog" jest wspólny dla wszystkich komputerów

**Czym to się różni od starego Bridge.** W starym Bridge stan tych ostrzeżeń („przejrzany",
„rozwiązany") zapisywał się **tylko w przeglądarce**. Na drugim komputerze albo po wyczyszczeniu
historii przeglądarki wszystkie ostrzeżenia wracały jako nowe. W nowym Bridge stan zapisuje się
**na serwerze**, tak samo jak w zakładce **Import** od pierwszej wersji (§3.8).

To oznacza też, że **stan w starym i nowym Bridge nie jest wspólny.** Ostrzeżenie przejrzane
w starym Bridge w nowym jest nowe, i odwrotnie. Nie zgłaszaj tej różnicy.

**Sprawdź** (jak §3.8 pierwszej wersji):
1. **Alerty → Katalog**. Oznacz jedno ostrzeżenie jako przejrzane i zapamiętaj, które to było.
2. Wciśnij **F5**.
3. **Ma się stać:** nadal jest `przejrzany`.
4. Otwórz panel w **innej przeglądarce** albo w oknie prywatnym, zaloguj się i wejdź w
   **Alerty → Katalog**.
5. **Ma się stać:** to samo ostrzeżenie jest `przejrzany` również tam.

**Wyjątek: „Brak importu cennika" po północy.** Ten alert po zmianie dnia wraca jako nowy, patrz
rozdział 3, pkt 1. Do tego testu weź więc ostrzeżenie **„Bardzo niska marża"**.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 2.5 Pulpit liczy i pokazuje alerty z obu zakładek

**Co się zmieniło na Pulpicie:**

- **Kafel „Aktywne alerty"** to suma alertów w stanie *nowy* z **obu** zakładek. Przejrzane się
  **nie** liczą. Podpis *„N krytycznych"* też liczy obie zakładki razem. W praktyce krytyczne są
  tylko w zakładce **Katalog**, bo alerty importu nie mają poziomu „krytyczny".
- **Karta „Najnowsze powiadomienia"** ma dwie sekcje, **IMPORT** i **KATALOG**. W każdej jest
  najwyżej **pięć** nowych alertów poziomu krytycznego albo ostrzeżenia. Pod tytułem karty jest
  *„N aktywnych alertów łącznie"*. Sekcja bez alertów znika. Cała karta znika dopiero wtedy, gdy
  obie sekcje są puste.
- **Kliknięcie wiersza** w sekcji **KATALOG** otwiera **Alerty** od razu na zakładce **Katalog**.
  Wiersz w sekcji **IMPORT** otwiera zakładkę **Import**.
- **Kafel** i przycisk **Zobacz wszystkie** otwierają **Alerty** na domyślnej zakładce **Import**.

**Czym to się różni od starego Bridge.** Pulpit starego Bridge pokazywał tylko ostrzeżenia
z katalogu. Nowy pokazuje oba źródła, osobno podpisane.

**Sprawdź:**
1. Wejdź na **Pulpit**. Zapamiętaj liczbę na kaflu **Aktywne alerty**.
2. **Ma się stać:** karta **Najnowsze powiadomienia** ma sekcję **KATALOG**, a jeśli masz nowe
   alerty importu, także sekcję **IMPORT**.
3. Kliknij dowolny wiersz w sekcji **KATALOG**.
4. **Ma się stać:** otwiera się **Alerty** z aktywną zakładką **Katalog**.
5. Oznacz tam jedno nowe ostrzeżenie jako przejrzane i wróć na **Pulpit**.
6. **Ma się stać:** liczba na kaflu **Aktywne alerty** spadła o jeden.

**⚠ Na stagingu karta „Najnowsze powiadomienia" praktycznie nie zniknie.** Nawet jeśli rozwiążesz
wszystko, „Brak importu cennika" następnego dnia wraca jako nowy (rozdział 3, pkt 1).

**⚠ Jeśli w sekcji KATALOG zobaczysz czerwony napis „Nie udało się policzyć alertów katalogu."** —
zgłoś od razu.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 3. ⚠ Czego NIE zgłaszaj ponownie — odtworzone celowo, jak w starym Bridge

Te rzeczy wyglądają na błąd, ale stary Bridge robi dokładnie to samo i przenieśliśmy je 1:1.

1. **„Brak importu cennika" oznaczony jako przejrzany (albo rozwiązany) wraca NASTĘPNEGO DNIA
   jako nowy.** Liczba dni od ostatniego importu jest częścią tego ostrzeżenia. Jutro to już inne
   ostrzeżenie („40 dni" zamiast „39 dni"), więc przychodzi jako nowe. Stary Bridge działa tak samo
   od swojej poprawki z 4 września.
2. **Zmiana marży produktu przywraca jego ostrzeżenie marżowe jako nowe.** Działa to tak samo: marża
   jest częścią ostrzeżenia. Jeśli np. po zmianie narzutu marża zmieni się choć o 0,1 punktu, a nadal
   jest poniżej 5%, ostrzeżenie wraca jako nowe. Jeśli wzrośnie do 5% lub więcej, ostrzeżenie
   znika. Dzięki temu przejrzenie nie przykleja się do produktu na zawsze.
3. **Dostawcy MO7 (Nokian) i MO8 (Trelleborg) nigdy nie dostają „Braku importu cennika"**, nawet po
   stu dniach. Stary Bridge ich świadomie pomija.
4. **„Marża" w ostrzeżeniach to procent narzutu z katalogu**, nie przeliczona marża, tak samo jak
   kolumna „marża" w Katalogu ([instrukcja I4](instrukcja-testow-I4.md), §1 pkt 4). Produkt
   z narzutem 0% ma *„(marża 0.0%)"* i dostaje „Bardzo niską marżę", choć realnie może zarabiać.
5. **Data przy ostrzeżeniu marżowym to data ostatniej aktualizacji produktu**, a nie chwila, w której
   ostrzeżenie się pojawiło. Może więc być sprzed wielu tygodni.
6. **Plakietki stanu w zakładce Katalog to `nowy`, `przejrzany`, `rozwiazany`**, pisane małą literą
   i bez ogonka, jak w starym Bridge i jak w zakładce Import (pierwsza wersja, §4 pkt 2).

> **Przeczytane:** ☐ tak ☐ niejasne — co: _______________

---

# 4. Co w pierwszej wersji przestało być prawdą

Jeśli wracasz do [pierwszej wersji](instrukcja-testow-I6.md), te zdania są już nieaktualne.
**Reszta tamtego dokumentu obowiązuje bez zmian.**

| Punkt pierwszej wersji | Co mówił | Jak jest teraz |
|---|---|---|
| **Ramka na początku** | „Ten widok **nie tworzy alertów** — tylko je pokazuje (…). Alerty pisze **import**" | Dotyczy tylko zakładki **Import**. Zakładka **Katalog** liczy ostrzeżenia sama, z katalogu, i nie trzeba ich produkować (**1.1**). |
| **§1** | „Widok **Alerty** (…): lista zdarzeń importu" | Dwie zakładki: **Import** (ta lista) i **Katalog** (**1.1**). |
| **§1 pkt 2** | „Domyślny filtr to status **nowy**." | Domyślny filtr to **Nierozwiązane**, czyli nowe i przejrzane (**2.2**). |
| **§3.1** | podpis *„Zdarzenia importu — powtórki zwinięte w grupy (dostawca, typ, status)"*, „pasek z **trzema** filtrami" | Podpis to *„Zdarzenia importu i ostrzeżenia liczone na żywo z katalogu"*, nad listą są zakładki **Import** / **Katalog**, a na pasku przed trzema filtrami jest pole **Szukaj w treści** (**1.1**, **1.3**). |
| **§3.3** | każdy wpis ma „własny przycisk **Oznacz jako rozwiązane**" | Każdy wpis ma **Oznacz jako przejrzany** i **Rozwiąż** (**1.2**). |
| **§3.5** | „kliknij **Oznacz jako rozwiązane (5)**" · „domyślny filtr pokazuje tylko *nowy*" | Ten przycisk to teraz **Rozwiąż (5)**. Grupa znika, bo domyślny filtr to **Nierozwiązane** (**1.2**, **2.2**). |
| **§3.6** | „kliknij **Oznacz jako rozwiązane**" | **Rozwiąż** (**1.2**). |
| **§3.7** | przycisk **Otwórz ponownie** tylko przy rozwiązanych | Jest też przy przejrzanych (**2.1**). Opcje filtra statusu to **Nierozwiązane**, **Wszystkie statusy**, **Nowy**, **Przejrzany**, **Rozwiązany** (**2.2**). |
| **§4 pkt 4** | „domyślny filtr pokazuje tylko *nowy*. Zdejmij filtr statusu" | Domyślny filtr pokazuje nowe i przejrzane. Żeby zobaczyć rozwiązane, wybierz **Wszystkie statusy** albo **Rozwiązany** (**2.2**). |
| **§4 pkt 7** | „Alerty tworzy wyłącznie import" | Dotyczy zakładki **Import**. Ostrzeżenia w zakładce **Katalog** liczą się z katalogu. Usuwać ani dodawać ręcznie nadal nie można w żadnej z zakładek. |
| **§4 pkt 9** | „Poziom alertu widać jako ikonę, nie jako tekst." | Tylko w zakładce **Import**. W zakładce **Katalog** poziom jest kolorową plakietką z napisem (**krytyczny**, **ostrzeżenie**), jak w starym Bridge. |
| **§5** | „Wyszukiwarka po treści alertu" → „⬜ decyzja — świadomie pominięta" | **Jest** (**1.3**). |
| **§5** | „Alerty o jakości danych w katalogu (…)" → „⬜ decyzja" | **Są**, zakładka **Katalog** (**1.1**). |
| **§5** | „Alerty na pulpicie" → „Iteracja 10" | Są od Iteracji 10, a teraz pokazują **obie** zakładki (**2.5**). |
| **§6** | „Po wejściu widać tylko status *nowy*" · „**Jedno kliknięcie zamyka całą grupę**" | Po wejściu widać nowe i przejrzane (**2.2**). Grupę nadal zamyka jedno kliknięcie, tylko przycisk nazywa się **Rozwiąż (N)**. |
| **§7**, najcenniejsze zgłoszenia, poz. 2 | „**zamknięty alert wraca jako *nowy* po odświeżeniu**" | Nadal zgłaszaj od razu, **z dwoma wyjątkami** w zakładce **Katalog**: „Brak importu cennika" następnego dnia i ostrzeżenie marżowe po zmianie marży (rozdział 3, pkt 1 i 2). |

**Uwaga o instrukcji do Iteracji 10 (Pulpit).** Ona też opisuje stan sprzed tych zmian. Jej §2.3,
§3.4 i §6.8 mówią, że karta „Najnowsze powiadomienia" pokazuje **tylko alerty importu**, a stare
ostrzeżenia z katalogu „czekają na Twoją decyzję". Tak już nie jest, patrz **2.5**. Poprawioną
wersję tamtej kartki dostaniesz osobno, a do tego czasu w sprawie Pulpitu prawdą jest punkt 2.5.

---

# 5. Podsumowanie

| Punkt | Co sprawdzasz | OK | ŹLE | Uwagi |
|---|---|:--:|:--:|---|
| **1.1** ⭐ | **Zakładki Import / Katalog; w Katalogu ostrzeżenia jak w starym Bridge; F5 zostawia na Katalogu** | ☐ | ☐ | |
| **1.2** ⭐ | **„Oznacz jako przejrzany" zostawia alert na liście, „Rozwiąż" go chowa — w obu zakładkach** | ☐ | ☐ | |
| 1.3 | Wyszukiwarka `404` zostawia same błędy HTTP; dwa słowa muszą wystąpić oba | ☐ | ☐ | |
| 1 | Trzy Twoje odpowiedzi zapamiętane poprawnie | ☐ | ☐ | |
| 2.1 | „Otwórz ponownie" przywraca stan nowy | ☐ | ☐ | |
| 2.2 | Domyślnie „Nierozwiązane"; „Wszystkie statusy" pokazuje też rozwiązane | ☐ | ☐ | |
| 2.3 | „Zaakceptuj wszystko" zamyka tylko widoczne; cofnięcie przez „Rozwiązany" → „Otwórz ponownie" | ☐ | ☐ | |
| **2.4** ⭐ | **Stan ostrzeżenia z Katalogu jest ten sam po F5 i w innej przeglądarce** | ☐ | ☐ | |
| 2.5 | Pulpit: wiersz z sekcji KATALOG otwiera zakładkę Katalog; przejrzenie zmniejsza kafel o 1 | ☐ | ☐ | |
| 3 | Przeczytane: czego nie zgłaszać | ☐ | ☐ | |

**Sprawdzonych ____ / 10 · błędów ____ · pominiętych ____**

> **Nie zapomnij przywrócić prawidłowych adresów** u MO3 i MO5, jeśli je psułaś.

---

# 6. Jak zgłosić znalezisko

**Zasady zgłaszania są te same co w [pierwszej wersji, rozdział 7](instrukcja-testow-I6.md#7-jak-zgłaszać-problemy)**:
co robiłaś (numer punktu z tej kartki), czego oczekiwałaś i co się stało, kod dostawcy i typ alertu,
godzina, zrzut ekranu. **Przy zakładce Katalog dopisz, która to zakładka** i przepisz opis
ostrzeżenia (np. *„KOD · nazwa (marża 0.0%)"*), bo tam nie ma grup.

**Najpierw sprawdź rozdział 3 i ramki ⚠.** Te rzeczy wyglądają na błąd, a są poprawne:

1. **„Brak importu cennika" krytyczny u prawie każdego dostawcy** na stagingu (ramka „Zanim
   zaczniesz");
2. **brak „Marży ujemnej" i „Nie-opony"** na stagingu (ta sama ramka);
3. **przejrzany „Brak importu cennika" wraca jutro jako nowy** (rozdział 3, pkt 1);
4. **„Wszystkie statusy" pokazuje rozwiązane**, choć w starym Bridge ich nie pokazywało (2.2);
5. **inny stan ostrzeżeń w starym i nowym Bridge** (2.4);
6. **grupa w zakładce Import po kliknięciu wraca zwinięta** (1.2).

**Trzy rzeczy, które zgłaszasz OD RAZU:**

- **czerwony napis „Nie udało się policzyć alertów katalogu."** w zakładce Katalog albo na Pulpicie;
- **ostrzeżenie „Bardzo niska marża" oznaczone jako przejrzane wraca jako nowe po F5** albo w innej
  przeglądarce, choć marża produktu się nie zmieniła. To znaczy, że stan nie zapisał się na
  serwerze;
- **„Oznacz jako przejrzany" chowa alert z domyślnego widoku.** Tak ma działać tylko „Rozwiąż".
