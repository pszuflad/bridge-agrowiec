# Iteracja 6 (Alerty) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-03

> **To jest STAGING, nie produkcja.** Cokolwiek tu ustawisz albo zepsujesz — produkcji nie
> dotyka. Testuj bez skrupułów.

> **⚠ Jedna rzecz, o której trzeba wiedzieć ZANIM zaczniesz.** Ten widok **nie tworzy
> alertów** — tylko je pokazuje i pozwala zamykać. Alerty pisze **import**: przy nieudanym
> pobraniu cennika, przy błędzie serwera dostawcy i przy ręcznym wgraniu pliku. Żeby więc było
> co testować, najpierw trzeba je **wyprodukować** — sekcja 2 mówi jak, zajmuje to dwie minuty.

---

## 1. Co dowozi Iteracja 6

Widok **Alerty** (menu po lewej): lista zdarzeń importu i możliwość oznaczania ich jako
załatwione. Do tej pory alerty zapisywały się do bazy, ale **nie było ich gdzie zobaczyć** —
trzeba było prosić Pawła o zajrzenie do bazy.

**Sedno do sprawdzenia — cztery rzeczy:**

1. **Lista ZWIJA POWTÓRKI.** Import zapisuje alert przy **każdej** nieudanej próbie, bez
   żadnego ograniczenia. W produkcyjnej bazie leży przez to **339 alertów „Błąd pobierania"**,
   a rekord to **23 alerty jednego dostawcy w ciągu doby**. Surowa lista byłaby nie do
   czytania, więc widok skleja powtórki w jeden wiersz: *„MO3 — Błąd pobierania · 23× ·
   ostatnio 14:45"*, rozwijany do pojedynczych wpisów.
2. **Po wejściu widzisz tylko to, co niezałatwione.** Domyślny filtr to status **nowy**.
   Zdarzenia informacyjne (*Synchronizacja*, *Ręczny upload*) są od razu zapisywane jako
   rozwiązane i domyślnie schowane — w produkcji jest ich **2127**, czyli 83% całej tabeli.
3. **Zmiana statusu idzie na serwer, nie do przeglądarki.** Alert zamknięty na laptopie jest
   zamknięty także w telefonie i po wyczyszczeniu historii. Stary Bridge trzymał to lokalnie
   w przeglądarce — tutaj zmieniliśmy to świadomie.
4. **Jedno kliknięcie zamyka całą grupę.** Przy 23 powtórkach klikanie pojedynczo nie ma sensu.

---

## 2. Przygotowanie — wyprodukuj sobie alerty

**Czego potrzebujesz:** konta w panelu (to samo co zwykle) i dwóch minut na zepsucie jednego
dostawcy. Skorzystamy z tej samej sztuczki co w [instrukcji I3](instrukcja-testow-I3.md),
sekcja 3.11 — tylko powtórzonej kilka razy, żeby powstała **grupa**, a nie pojedynczy wpis.

### 2.1 Zrób sobie grupę powtórek (typ *Błąd HTTP*)

1. **Konfiguracja → Dostawcy**, kliknij **Zmień** przy dostawcy `MO3`.
2. W polu **Adres cennika (URL)** wpisz adres, którego nie ma:
   `https://test.agritires.eu/nie-ma-takiego-pliku.csv`. **Zapisz**.
3. Kliknij **Synchronizuj teraz**. Poczekaj na czerwony komunikat.
4. **Kliknij Synchronizuj teraz jeszcze cztery razy.** Za każdym razem czekaj na komunikat.

Masz teraz **pięć** alertów tego samego rodzaju dla MO3. O to chodziło.

### 2.2 Dorzuć drugi typ (*Błąd pobierania*) i drugiego dostawcę

5. U dostawcy `MO5` ustaw URL na adres z domeną, której nie ma w ogóle:
   `https://nie-ma-takiej-domeny-agritires.invalid/cennik.csv`. **Zapisz**.
6. **Synchronizuj teraz** — dwa razy.

Różnica jest celowa: adres 404 na istniejącym serwerze daje **Błąd HTTP**, a nieistniejąca
domena — **Błąd pobierania**. Chcemy obu typów, żeby było widać, że grupują się osobno.

### 2.3 Dorzuć zdarzenie informacyjne

7. **Konfiguracja → Dostawcy → Wgraj plik** — wgraj dowolny poprawny cennik dla `MO1`
   (jak w [instrukcji I3](instrukcja-testow-I3.md), sekcja 2).

To zapisze alert *Ręczny upload* ze statusem **rozwiązany** — przyda się w sekcji 3.9.

> **Nie zapomnij przywrócić prawidłowych adresów** u MO3 i MO5, kiedy skończysz testy —
> **Zmień** i wpisz z powrotem oryginalny URL. Inaczej następne testy będą się wywalać.

---

## 3. Scenariusze — po kolei

Każdy scenariusz: **co zrobić** → **czego oczekiwać**. Jeśli wyjdzie inaczej — zapisz i zgłoś
wg [sekcji 7](#7-jak-zgłaszać-problemy).

### 3.1 Pierwsze wejście

1. Kliknij **Alerty** w menu po lewej.

**Oczekiwane:** nagłówek **Alerty** z podpisem *„Zdarzenia importu — powtórki zwinięte w grupy
(dostawca, typ, status)"*, pasek z trzema filtrami (**Status**, **Dostawca**, **Typ**),
a po prawej stronie paska licznik w rodzaju **„2 grupy / 7 alertów"**.

Poniżej lista. Powinny być na niej **dwa wiersze** (MO3 i MO5) — nie siedem.

> **Ekran „w przygotowaniu" nie powinien się już pojawić.** Jeśli widzisz komunikat
> o widoku w przygotowaniu — to jest błąd, zgłoś od razu.

### 3.2 ⭐ Zwijanie powtórek — NAJWAŻNIEJSZY TEST

Popatrz na wiersz dotyczący MO3.

**Oczekiwane:** **jeden** wiersz, a w nim po kolei:
- strzałka rozwijania,
- ikona ostrzeżenia (żółty trójkąt),
- kod dostawcy **MO3**,
- typ **Błąd HTTP**,
- odznaka **5×** — tyle było prób,
- odznaka statusu **nowy**,
- po prawej **ostatnio HH:MM** — godzina Twojej **ostatniej** próby, nie pierwszej.

**Czego NIE powinno być:** pięciu osobnych wierszy z tą samą treścią. To jest sedno tej
iteracji — jeśli lista wysypuje powtórki surowo, test jest niezaliczony.

Licznik na pasku filtrów powinien mówić **„2 grupy / 7 alertów"** — czyli że siedem zdarzeń
zmieściło się w dwóch wierszach.

### 3.3 Rozwinięcie grupy

1. Kliknij strzałkę przy wierszu MO3.

**Oczekiwane:** pod wierszem rozwija się **pięć** pojedynczych wpisów, każdy z godziną
i treścią błędu, i każdy z własnym przyciskiem **Oznacz jako rozwiązane**. Strzałka obraca
się w dół. Ponowne kliknięcie zwija grupę z powrotem.

**Treść wpisów** to dosłowny komunikat błędu — np. *„HTTP 404"*. Jest ona **jedynym** miejscem,
gdzie widać, co konkretnie się stało; sam typ alertu tego nie mówi (patrz sekcja 4, punkt 1).

### 3.4 Grupa jednoelementowa

Popatrz na wiersz dotyczący MO5, jeśli kliknęłaś **Synchronizuj teraz** tylko raz.

**Oczekiwane:** wiersz **bez strzałki** rozwijania, za to z **treścią błędu widoczną od razu**
pod nazwą typu. Nie ma odznaki z licznikiem — jeden alert to nie „powtórka".

Jeśli kliknęłaś dwa razy, zobaczysz **2×** i strzałkę. Wtedy sprawdź to na innym dostawcy.

### 3.5 ⭐ Zamknięcie całej grupy jednym kliknięciem

1. Przy wierszu MO3 kliknij **Oznacz jako rozwiązane (5)**.

**Oczekiwane:** komunikat **„Zmieniono status 5 alertów"**, a wiersz MO3 **znika z listy**.

**To jest poprawne, nic nie zostało skasowane.** Alerty zmieniły status na *rozwiazany*,
a domyślny filtr pokazuje tylko *nowy*. Zaraz je odzyskasz w sekcji 3.7.

Liczba w nawiasie przy przycisku mówi, ilu alertów dotyczy kliknięcie — przy grupie
jednoelementowej nawiasu nie ma.

### 3.6 Zamknięcie pojedynczego alertu

1. Rozwiń grupę MO5 (jeśli ma więcej niż jeden wpis).
2. Przy **jednym** wpisie kliknij **Oznacz jako rozwiązane**.

**Oczekiwane:** komunikat **„Status alertu zmieniony"**, ten jeden wpis znika,
a **licznik grupy zmniejsza się o jeden** (np. z **2×** na wiersz bez licznika).

### 3.7 Otwieranie z powrotem — przełącznik działa w obie strony

1. W filtrze **Status** wybierz **Wszystkie statusy**.

**Oczekiwane:** wracają grupy zamknięte w punktach 3.5 i 3.6 — tym razem z odznaką statusu
**rozwiazany**, a przycisk przy nich mówi **Otwórz ponownie (5)**.

2. Kliknij **Otwórz ponownie** przy grupie MO3.

**Oczekiwane:** komunikat o zmianie statusu, a grupa wraca do statusu **nowy**.

> **Zamknięte i otwarte to dwa OSOBNE wiersze**, nawet dla tego samego dostawcy i typu. Jeśli
> zamkniesz połowę powtórek, zobaczysz dwie grupy MO3 — jedną *nowy*, drugą *rozwiazany*. Tak
> ma być: inaczej nie byłoby widać, ile roboty już odhaczyłaś.

### 3.8 ⭐ Status przeżywa odświeżenie — i inną przeglądarkę

To jest zmiana względem starego Bridge, która wymaga sprawdzenia.

1. Zamknij dowolną grupę (**Oznacz jako rozwiązane**).
2. Wciśnij **F5** — przeładuj stronę.

**Oczekiwane:** grupa nadal jest zamknięta.

3. Otwórz panel w **innej przeglądarce** albo w oknie prywatnym, zaloguj się i wejdź w Alerty.

**Oczekiwane:** ta sama grupa jest zamknięta również tam.

**Dlaczego to ważne:** stary Bridge zapisywał „przejrzane" wyłącznie w pamięci przeglądarki —
po wyczyszczeniu historii albo na drugim komputerze cała praca znikała. Teraz status siedzi na
serwerze. Jeśli po F5 alert wraca jako *nowy*, to jest błąd i trzeba go zgłosić.

### 3.9 Ukryty szum — *Synchronizacja* i *Ręczny upload*

1. Filtr **Status** → **Wszystkie statusy**.

**Oczekiwane:** pojawiają się grupy typu **Synchronizacja** (udane pobrania) i **Ręczny
upload** (Twoje wgranie pliku z punktu 2.3), z ikoną informacji (nie ostrzeżenia) i statusem
**rozwiazany**.

**To jest cała odpowiedź na pytanie „gdzie są moje alerty".** Zdarzenia informacyjne zapisują
się od razu jako załatwione, więc domyślny widok ich nie pokazuje. W produkcyjnej bazie jest
ich 2127 wobec 343 awaryjnych — bez tego filtra ekran byłby bezużyteczny.

### 3.10 Filtry

1. Filtr **Dostawca** → **MO3**.

**Oczekiwane:** zostają wyłącznie grupy MO3, licznik na pasku odpowiednio spada.

2. Filtr **Typ** → **Błąd HTTP**.

**Oczekiwane:** zawężenie działa **łącznie** z poprzednim (MO3 **i** Błąd HTTP), nie zamiast
niego.

3. Ustaw filtry tak, żeby nic nie pasowało (np. MO3 + Ręczny upload).

**Oczekiwane:** komunikat **„Brak alertów spełniających filtry."** — a nie pusta, biała strona.

> **Listy w filtrach biorą się z danych, nie z zaszytej listy.** Zobaczysz tylko tych dostawców
> i te typy, które faktycznie występują w alertach. Jeśli import zacznie kiedyś zapisywać nowy
> rodzaj zdarzenia, pojawi się tu sam.

### 3.11 Kolejność grup

Popatrz na kolejność wierszy przy zdjętym filtrze statusu.

**Oczekiwane:** na górze grupa, w której **ostatnie** zdarzenie było **najświeższe**.

> **Grupa z 5 powtórkami potrafi stać NIŻEJ niż pojedynczy alert.** Liczy się godzina
> ostatniego wystąpienia, nie liczba powtórzeń — chodzi o to, żeby na górze było to, co psuje
> się **teraz**, a nie to, co psuło się najczęściej w lipcu.

---

## 4. ⚠ Rzeczy, które WYGLĄDAJĄ na błąd, a są poprawne

1. **Typ „Błąd pobierania" pojawia się także wtedy, gdy plik pobrał się poprawnie.**
   Stary Bridge obejmuje jednym workiem całe pobranie *i* przetworzenie pliku, więc błąd
   parsera — czyli cennika w złym formacie — też dostaje etykietę „Błąd pobierania". Nazwa myli,
   ale **odtworzyliśmy ją 1:1 celowo**: w bazie leży 339 historycznych alertów z tym typem
   i zmiana etykiety rozjechałaby grupowanie względem nich. **Prawdziwa przyczyna jest zawsze
   w treści wpisu** — rozwiń grupę i przeczytaj. Błąd sieci to dosłowny komunikat
   (*„fetch failed"*, *„terminated"*, *„This operation was aborted"*), błąd parsera to
   komunikat o formacie pliku.

2. **Status pisze się `rozwiazany`, bez ogonka.** To surowa wartość z bazy, pokazywana bez
   upiększania — dokładnie jak nagłówki kolumn w Katalogu. Nie jest to literówka do poprawienia
   w tej iteracji.

3. **Jedna grupa może mieszać dwie różne przyczyny.** Skoro „Błąd pobierania" obejmuje i sieć,
   i parser (punkt 1), to licznik **23×** może oznaczać np. 20 błędów sieci i 3 błędy formatu.
   Rozwinięcie grupy jest jedynym sposobem, żeby je rozdzielić.

4. **Zamknięcie grupy sprawia, że znika ona z ekranu.** Nic nie zostało skasowane — zmienił się
   status, a domyślny filtr pokazuje tylko *nowy*. Zdejmij filtr statusu, żeby ją zobaczyć.

5. **Godzina bez daty oznacza „dzisiaj".** Wpisy z dzisiaj pokazują samo **16:45**, starsze —
   pełną datę **8.08.2026, 16:45** (dzień bez zera wiodącego). Chodzi o to, żeby alert sprzed
   tygodnia nie wyglądał na świeży.

6. **Godzina w widoku jest CZASEM LOKALNYM, a w bazie i logach — UTC.** Latem różnica wynosi
   dwie godziny: alert zapisany o `14:45` w logu backendu pokaże się na liście jako **16:45**.
   To nie jest przesunięcie ani błąd zapisu — przeglądarka tłumaczy czas na Twoją strefę.
   Gdybyś porównywała zrzut ekranu z logiem, pamiętaj o tej różnicy.

7. **Alertów nie da się usunąć ani dodać ręcznie.** Ten widok tylko czyta i zmienia status.
   Alerty tworzy wyłącznie import; kasowania nie ma nigdzie — tak samo jak w starym Bridge.

8. **Zamknięcie 23 alertów potrafi chwilę potrwać.** Nie ma jednej operacji „zamknij grupę" —
   są 23 osobne zapisy, wysyłane po osiem naraz. Przycisk jest w tym czasie nieaktywny.
   Jeśli część zapisów padnie, zobaczysz komunikat w rodzaju *„Zmieniono 18 z 23 alertów"* —
   i to jest uczciwa informacja, a nie błąd interfejsu.

9. **Poziom alertu widać jako ikonę, nie jako tekst.** Żółty trójkąt to ostrzeżenie
   (awarie), niebieska litera „i" to zdarzenie informacyjne (udane pobrania, ręczne wgrania).

10. **Cała lista wczytuje się naraz, bez stronicowania.** Tak działa stary Bridge i tak zostało
   odtworzone — grupowanie i tak potrzebuje kompletu, bo inaczej licznik przy grupie kłamałby.
   Przy kilku tysiącach alertów pierwsze wejście może chwilę potrwać.

---

## 5. Czego jeszcze NIE MA — świadomie

| Czego brakuje | Kiedy |
|---|---|
| Wyszukiwarka po treści alertu (odróżniłaby błąd sieci od błędu parsera bez rozwijania) | ⬜ decyzja — świadomie pominięta w tej iteracji |
| Alerty o jakości danych w katalogu (ujemna marża, „nie-opona") — stary Bridge liczył je pod tym samym adresem | ⬜ decyzja — opisane w `docs/rebuild-backlog.md` #26 |
| Usuwanie alertów | ⬜ decyzja — w starym Bridge też go nie ma |
| Stronicowanie / limit listy | Przy włączeniu automatu pobierania (patrz niżej) |
| Ślad w dzienniku zmian, kto zamknął alert | ⬜ decyzja — stary Bridge tego nie zapisuje |
| Alerty na pulpicie („najświeższe alerty") | Iteracja 10 |

> **Uwaga na przyszłość.** Kiedy włączymy automatyczne pobieranie cenników
> ([instrukcja I3](instrukcja-testow-I3.md), sekcja 3.13), alertów będzie przybywać
> ok. **120 dziennie**. Wtedy wrócimy do tematu stronicowania.

---

## 6. Szybka lista kontrolna

- [ ] Widok **Alerty** otwiera się z menu i nie jest „w przygotowaniu"
- [ ] **Pięć nieudanych prób tego samego dostawcy to JEDEN wiersz z odznaką 5×** ⭐
- [ ] Licznik na pasku pokazuje „ile grup / ile alertów"
- [ ] Wiersz grupy pokazuje godzinę **ostatniej** próby, nie pierwszej
- [ ] Strzałka rozwija grupę do pojedynczych wpisów z treścią błędu
- [ ] Grupa jednoelementowa nie ma strzałki i pokazuje treść od razu
- [ ] **Jedno kliknięcie zamyka całą grupę** ⭐
- [ ] Pojedynczy wpis da się zamknąć osobno, a licznik grupy spada
- [ ] **Otwórz ponownie** przywraca status *nowy*
- [ ] **Zamknięty alert jest nadal zamknięty po F5 i w innej przeglądarce** ⭐
- [ ] Po wejściu widać tylko status *nowy*; *Synchronizacja* i *Ręczny upload* są schowane
- [ ] Zdjęcie filtra statusu odsłania zdarzenia informacyjne
- [ ] Filtry dostawcy i typu działają łącznie, nie zamiast siebie
- [ ] Puste wyniki dają komunikat, a nie białą stronę
- [ ] Najświeższa grupa jest na górze, niezależnie od liczby powtórek
- [ ] Przywrócone prawidłowe adresy URL u MO3 i MO5 po testach

---

## 7. Jak zgłaszać problemy

Napisz Pawłowi, podając:

1. **Co robiłaś** — konkretny krok z tej instrukcji albo opis kliknięć.
2. **Czego oczekiwałaś** i **co się stało**.
3. **Kod dostawcy** i **typ alertu** (np. MO3 / Błąd HTTP) — bez tego trudno odtworzyć.
4. **Godzinę** (z dokładnością do minuty).
5. **Zrzut ekranu** — najlepiej z **rozwiniętą** grupą, żeby było widać treść wpisów.

Najcenniejsze zgłoszenia to trzy:
- **lista wysypuje powtórki surowo** zamiast zwijać je w grupy — to unieważnia całą iterację;
- **zamknięty alert wraca jako *nowy* po odświeżeniu** — to znaczy, że status nie zapisał się
  na serwerze, tylko w przeglądarce;
- **licznik przy grupie nie zgadza się z liczbą wpisów po rozwinięciu** — to znaczy, że
  grupowanie liczy co innego, niż pokazuje.
