# Iteracja 4 (Narzuty i promocje) — wersja 2: poprawki po Twoich uwagach

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-19 · **Dla:** Ania
**Zastępuje:** [pierwszą wersję](instrukcja-testow-I4.md) z 2026-09-02 — w punktach opisanych niżej

> **To jest STAGING, nie produkcja.** Cokolwiek tu ustawisz albo zepsujesz — produkcji nie
> dotyka. Testuj bez skrupułów.

---

## Po co ta kartka

**To jest WERSJA 2 i zawiera TYLKO DELTĘ** — czyli wyłącznie to, co zmieniło się od czasu, gdy
przeszłaś pierwszą wersję. **Nie jest to instrukcja od nowa.** Nie masz przechodzić Iteracji 4
po raz drugi: scenariusze 3.1–3.5, 3.7, 3.8, 3.10 i 3.11 z pierwszej wersji **zostają aktualne**
i nie ma potrzeby ich powtarzać.

**Pierwsza wersja zostaje w repozytorium bez zmian** i miejscami opisuje stan sprzed tych
poprawek. **Oryginalna instrukcja I4 pozostaje ważna dla wszystkiego, czego tu nie ma.**
A tam, gdzie coś się różni — **prawdą jest ta kartka.**

**Co się zmieniło: sześć rzeczy.** Jedna w Katalogu (rozdział 2), cztery w promocjach
(rozdział 3), jedna w usuwaniu reguł (rozdział 4). Do tego trzy rzeczy, których **świadomie nie
zmieniliśmy, bo tak zdecydowałaś** (rozdział 5), i lista punktów starej instrukcji, które
**przestały być prawdą** (rozdział 6) — w tym jeden, który nigdy prawdą nie był i musimy Ci to
uczciwie powiedzieć.

**Trzy z tych sześciu zmian to rzeczy, których nie zgłaszałaś** — znaleźliśmy je sami, badając
Twoje zgłoszenia. Przy takich punktach zamiast „Zgłosiłaś" jest napisane wprost „Tego nie
zgłaszałaś" i skąd się wzięły.

### Jak wypełniać

Każdy punkt kończy się linijką **Twoja ocena**. Zaznacz i dopisz uwagi:

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

Przy „ŹLE" napisz, **co zobaczyłaś zamiast** oczekiwanego, i **zrób zrzut ekranu**. Zbiorcze
podsumowanie jest w rozdziale 7.

**Punkty oznaczone ⭐ są najważniejsze.** Jeśli masz mało czasu, zrób przynajmniej
**rozdział 1, 2.1, 3.1 i 3.2**.

---

# 1. ⚠ Zanim klikniesz cokolwiek — dwie rzeczy, które Cię zaskoczą

**Przeczytaj ten rozdział przed testami, nie po.** Opisuje dwa skutki uboczne, które zobaczysz
przy pierwszym zapisie dowolnej reguły — i oba wyglądają jak awaria, a nie są nią.

## Pierwszy zapis reguły przepisze ceny ~2050 produktów, i to bez żadnej promocji

Zmierzyliśmy to: samo przeliczenie katalogu — **bez zakładania jakiejkolwiek promocji**,
wystarczy zapisać cokolwiek — zmienia **2050 cen z 7405**. Nie dlatego, że coś się zepsuło,
a dlatego, że tyle pozycji w katalogu ma dziś cenę **rozjechaną z aktualnym narzutem**
(np. wpisaną ręcznie kiedyś dawno albo pochodzącą ze starszej reguły). Masowe przeliczenie je
**prostuje**.

**Tak działa stary Bridge** i tak zostało odtworzone — to nie jest defekt. Ale wygląda jak
masowa, niezamówiona zmiana cen, dlatego mówimy o tym zawczasu: **jeśli po pierwszym zapisie
reguły zobaczysz, że zmieniły się ceny setek produktów, których Twoja reguła w ogóle nie
dotyczy — to jest oczekiwane.**

Wniosek praktyczny: zanim zaczniesz zabawę regułami, **zanotuj cenę jednego–dwóch produktów**
(tak jak mówi sekcja 2 pierwszej wersji). Wtedy będziesz umiała rozróżnić „zadziałała moja
reguła" od „katalog się wyprostował".

## Pierwsze uruchomienie po tej aktualizacji poprawi statusy starych promocji

Nowy mechanizm z rozdziału 3 przy starcie przegląda wszystkie promocje i ustawia im status
zgodny z datami. Jeśli w bazie wisiała promocja z minioną datą końca, ale statusem „aktywna",
**zostanie wygaszona przy pierwszym uruchomieniu.** Na dziś w bazie **nie ma ani jednej
promocji**, więc realnie nie zmieni to nic — ale gdybyś w międzyczasie jakieś założyła, to jest
wyjaśnienie, skąd wzięła się zmiana, której nie klikałaś.

> **Przeczytane i rozumiem, czego się spodziewać:** ☐ tak ☐ nie — co jest niejasne: ____________

---

# 2. Katalog — kolumna „Promocja" ożyła

**Gdzie:** menu po lewej → **Katalog**.

---

## 2.1 ⭐ Kolumna „Promocja" pokazuje rabat i nazwę promocji

> **Zgłosiłaś:** „Rabaty nie działają mimo wprowadzenia promocji, nie zaczytała się ona ani
> w katalogu w kolumnie promocje ani nie zmieniło na tej podstawie ceny", a potem, po naszym
> pomiarze, doprecyzowałaś: **„tylko się nie wyświetlało, cena się oblicza prawidłowo"**.
> *(zgłoszenie z testów I4, doprecyzowanie 19.09)*

**Jak to naprawiliśmy.** Miałaś rację co do rozpoznania: ceny liczyły się dobrze od początku
(sprawdziliśmy — promocja „marka → BKT" 10% obniżyła ceny **954 produktów** poprawnie),
a zepsuta była wyłącznie **widoczność**. Serwer nigdy nie dosyłał do katalogu informacji o tym,
która promocja dotyczy którego produktu, więc kolumna nie miała skąd wziąć wartości. Teraz
dosyła — i wylicza to **tym samym silnikiem cen**, który liczy ceny, więc kolumna nie może
pokazać czegoś innego, niż naprawdę zadziałało.

**Sprawdź:**
1. Wejdź w **Narzuty i promocje** → zakładka **Promocje** → **Dodaj promocję**.
2. Nazwij ją rozpoznawalnie, np. *Wyprzedaż BKT*, **odznacz** „Reguła globalna", ustaw warunek
   **Marka** → *BKT*, rabat **10**, daty zostaw domyślne. **Zapisz promocję.**
3. Wejdź w **Katalog** i znajdź kolumnę **Promocja** (jest widoczna od startu, nie musisz jej
   włączać).
4. Popatrz na wiersz produktu marki **BKT** i na wiersz produktu **innej** marki.
5. Dla pewności otwórz **Symulator ceny** (zakładka Narzuty, pod tabelą) na tym samym produkcie
   BKT i porównaj wiersz *Promocja* z tym, co pokazuje kolumna.

**Ma się stać:**
- przy produkcie **BKT** w kolumnie **Promocja** jest **pomarańczowa odznaka `-10%`**, a obok
  niej **nazwa promocji** (*Wyprzedaż BKT*);
- przy produkcie innej marki jest **„—"**;
- nazwa i procent z kolumny **zgadzają się z tym, co pokazuje Symulator**.

> **⚠ To jest NOWA FUNKCJA, nie powrót do stanu sprzed backupu.**
>
> Prosząc o tę kolumnę, napisałaś: *„w starym Bridge działała, było to sprawdzane, być może
> któryś backup to zastąpił i już nie działa"*. **Sprawdziliśmy to i musimy powiedzieć wprost:
> nie działała w żadnej wersji, jaką mamy.** Nie chodzi o to, że nie znaleźliśmy dowodu — chodzi
> o to, że sprawdziliśmy cztery niezależne miejsca i wszystkie mówią to samo:
>
> - **żywy plik Twojej produkcji** (ten, który przeglądarka naprawdę ładuje) — kolumna **czyta**
>   to pole, ale nikt go nigdy nie **zapisywał**;
> - **kopia sprzed czterech Twoich łatek** (13 sierpnia) — identycznie, żadna łatka tego nie
>   dodała ani nie usunęła;
> - **cały backend produkcji wraz ze wszystkimi kilkunastu łatkami** — **zero** miejsc, w których
>   to pole jest wypełniane;
> - **pełna historia zmian w repozytorium** — jedyny ślad tego pola to nasz własny wpis
>   dokumentacyjny.
>
> Czyli: kolumna **od zawsze** była w domyślnym zestawie kolumn i **od zawsze** pokazywała „—".
> **Dostajesz coś nowego, a nie odzyskujesz coś starego.** Mówimy o tym dlatego, że ma to
> praktyczny skutek: to nie jest funkcja „sprawdzona kiedyś w starym Bridge", więc nie ma z czym
> jej porównać — jesteś pierwszą osobą, która ją testuje.

**⚠ Dziś w bazie nie ma ani jednej promocji.** Zanim ją założysz (krok 2), kolumna **będzie
pokazywać „—" przy każdym produkcie** — i to jest poprawne, nie „dalej nie działa". Zmierzyliśmy:
7405 produktów, **0 promocji**.

**⚠ Kliknięcie nagłówka „Promocja" nic nie sortuje.** Wszystkie inne nagłówki sortują tabelę,
ten jeden — nie, bo „Promocja" nie jest kolumną produktu, tylko wartością dokładaną obok.
**W starym Bridge jest dokładnie tak samo** (ta sama funkcja sortująca). Nie zgłaszaj tego jako
błędu; jeśli sortowanie po promocji byłoby Ci przydatne, napisz — to osobna praca.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 3. Promocje — daty naprawdę rządzą

**Gdzie:** menu po lewej → **Narzuty i promocje** → zakładka **Promocje**.

**Cały ten rozdział to jedna zmiana widziana z czterech stron.** Wcześniej silnik cen patrzył
wyłącznie na *status* promocji, a daty były tylko napisem na ekranie. Teraz **status jest
wyliczany z dat** — i to zmienia cztery rzeczy naraz.

---

## 3.1 ⭐ Data końca naprawdę wyłącza promocję

> **Zgłosiłaś** (§3.9 pierwszej wersji): *„Tak, data końcowa powinna automatycznie wyłączać
> promocję. (…) Po wygaśnięciu system powinien przeliczyć ceny bez tej promocji."*
> A po naszym pytaniu kontrolnym, już wiedząc, jak jest naprawdę, zdecydowałaś **18 września**:
> **„data ma naprawdę kończyć promocje"**.

**Jak to naprawiliśmy.** Dołożyliśmy **wygaszacz** — mechanizm po stronie serwera, który
przegląda promocje i ustawia im status zgodny z datami. **Działa w obie strony:** promocja
z minioną datą końca dostaje status *zakończona* (i przestaje obniżać ceny), a promocja, której
data startu właśnie nadeszła, dostaje *aktywna* (o tym jest punkt 3.2).

Silnika cen **nie ruszaliśmy** — on dalej patrzy na status, tak jak stary Bridge. Zmieniło się
to, że **status wreszcie mówi prawdę**.

**Wygaszacz odpala się w trzech momentach**, i to jest jedyna rzecz, o której trzeba pamiętać
przy testowaniu:
1. przy **uruchomieniu** Bridge'a,
2. za każdym razem, gdy **zapisujesz dowolną regułę** (narzut albo promocję),
3. **sam, co 5 minut.**

**Sprawdź:**
1. Założ promocję z warunkiem (np. **Marka** → *BKT*), rabat **10**, daty domyślne. **Zapisz.**
2. Sprawdź w **Katalogu**, że produkty BKT **potaniały** (kolumna **Promocja** pokazuje `-10%`).
3. Wejdź w **edycję** tej promocji (ikona ołówka), ustaw **Datę startu** na `2020-01-01`,
   a **Datę końca** na `2020-03-31`. **Zapisz.**
4. Popatrz na status w tabeli promocji.
5. Wejdź w **Katalog** i popatrz na cenę produktu BKT oraz na kolumnę **Promocja**.

**Ma się stać:**
- krok 4: status **zakończona**;
- krok 5: cena **wróciła do poziomu bez rabatu**, a w kolumnie **Promocja** jest **„—"**;
- **nie ma już żadnego pomarańczowego ostrzeżenia** pod statusem (o tym punkt 3.4).

**⚠ Zmiana może być widoczna z opóźnieniem do ok. 5 minut — ale nie w tym teście.** W kroku 3
sama **zapisujesz** promocję, więc wygaszacz rusza od razu i efekt jest natychmiastowy.
Opóźnienie zobaczysz tylko wtedy, gdy **nikt nic nie zapisuje, a data mija sama** — np. założysz
dziś promocję kończącą się o 14:00 i o 14:01 nikt nic nie klika. Wtedy rabat zniknie przy
najbliższym przebiegu automatu, czyli w ciągu 5 minut. **Poczekaj 5 minut, zanim to zgłosisz.**

**⚠ Wiersz promocji NIE znika z tabeli.** Pisząc o tym zachowaniu, użyłaś sformułowania „reguła
znika po końcu obowiązywania" — chcemy uprzedzić: promocja **zostaje w tabeli**, z odznaką
*zakończona*. Przestaje działać, ale nadal ją widzisz i możesz ją edytować albo usunąć. Tak jest
w starym Bridge. Jeśli wolałabyś, żeby wygasłe promocje były ukrywane — napisz, to osobna zmiana.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 3.2 ⭐ Promocja „zaplanowana" wreszcie się włącza

> **Tego nie zgłaszałaś** — znaleźliśmy to sami **18 września**, wyceniając warianty naprawy
> z punktu 3.1. Nie miałaś jak tego zauważyć, bo kolumna „Promocja" z rozdziału 2 była wtedy
> martwa, a na ekranie promocji wszystko wyglądało poprawnie.

**To najbardziej „niewidzialna" naprawa w całej iteracji** i dlatego opisujemy ją osobno.

**Co było zepsute.** Status promocji zapisywał się **raz — w chwili jej utworzenia** — i nigdy
potem. Przy tworzeniu był wyliczany z dat poprawnie, więc promocja z datą startu w przyszłości
dostawała status *zaplanowana* i słusznie nie obniżała cen. Ale **nic w systemie nigdy tego
statusu nie przeliczało ponownie.** Skutek: **taka promocja nigdy się nie włączała.** Data
startu nadchodziła, mijała, ekran dalej pokazywał *zaplanowana*, rabat nie działał **nigdy** —
choćbyś czekała rok.

**Od kiedy.** Od samego początku Iteracji 4, czyli od **2 września 2026** — od dnia, w którym
promocje w ogóle powstały w odbudowie. Nigdy nie działało inaczej. **W Twoim starym Bridge ten
sam defekt jest do dziś** i nie jest to naprawione po tamtej stronie.

**Co teraz działa.** Wygaszacz z punktu 3.1 przestawia status **w obie strony**, więc
*zaplanowana* → *aktywna* dzieje się dokładnie tym samym mechanizmem co *aktywna* →
*zakończona*. Promocja zaplanowana na przyszły tydzień **naprawdę się w przyszłym tygodniu
włączy**.

**Sprawdź** (test dwustronny — najpierw że NIE działa przed czasem, potem że działa po czasie):
1. Założ promocję z warunkiem **Marka** → *BKT*, rabat **10**, **Datę startu** ustaw na
   **jutro**, datę końca na za miesiąc. **Zapisz.**
2. Popatrz na status w tabeli, a potem wejdź w **Katalog** — na cenę produktu BKT i na kolumnę
   **Promocja**.
3. Wróć do **edycji** tej promocji i przestaw **Datę startu** na **wczoraj** (datę końca
   zostaw). **Zapisz.**
4. Popatrz jeszcze raz na status, cenę w Katalogu i kolumnę **Promocja**.

**Ma się stać:**
- krok 2: status **zaplanowana**, cena **bez rabatu**, w kolumnie **Promocja** jest **„—"**;
- krok 4: status **aktywna**, cena **obniżona o 10%**, w kolumnie **Promocja** odznaka `-10%`.

**⚠ Przed naprawą krok 4 pokazywałby dalej „zaplanowana" i cenę bez rabatu** — i to niezależnie
od tego, ile byś czekała. Jeśli taki właśnie efekt zobaczysz, **to jest błąd i chcemy o nim
wiedzieć od razu.**

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 3.3 Rada „żeby wyłączyć promocję, zmień jej status" PRZESTAJE OBOWIĄZYWAĆ

> **Tego nie zgłaszałaś** — to techniczna konsekwencja naprawy z punktu 3.1, podjęta razem
> z decyzją o niej **18 września**. Opisujemy to osobno, bo **unieważnia konkretną radę
> z pierwszej wersji instrukcji**.

**Co mówiła pierwsza wersja.** W §3.9 napisaliśmy Ci: *„Żeby naprawdę wyłączyć promocję, musisz
zmienić jej status, a nie datę."* **Ta rada jest nieaktualna i nie da się jej już wykonać.**

**Jak to teraz działa.** Skoro status jest wyliczany z dat (punkt 3.1), to **nie może być
jednocześnie ustawiany z zewnątrz** — byłyby dwa źródła prawdy i wygaszacz i tak nadpisałby
Twoje ustawienie przy najbliższym przebiegu. Dlatego **status przestał być polem, które da się
zmienić.** Formularz promocji nigdy go nie miał, a teraz nie przyjmuje go już także sama
aplikacja: jeśli coś prześle status, **jest po cichu pomijany** — nie ma błędu, nie ma
komunikatu, po prostu nie ma skutku.

**Czym zastąpić tę radę — dwa sposoby, oba działają:**

| Chcesz | Zrób |
|---|---|
| wyłączyć promocję, ale **zachować ją w tabeli** (np. na później) | ustaw **Datę końca** na przeszłość — punkt 3.1 |
| wyłączyć promocję **na dobre** | **usuń ją** (ikona kosza) — punkt 4.1 |

**Sprawdź:**
1. Otwórz **edycję** dowolnej promocji i przejrzyj wszystkie pola formularza.
2. Poszukaj czegokolwiek, czym dałoby się ustawić status ręcznie.
3. Dla porównania otwórz zakładkę **Narzuty** i **kliknij zieloną odznakę „aktywny"** przy
   regule narzutu.

**Ma się stać:**
- w formularzu promocji **nie ma pola status** i nie ma go czym ustawić;
- **kliknięcie odznaki statusu przy PROMOCJI nic nie robi** — nie jest przełącznikiem;
- **kliknięcie odznaki przy NARZUCIE dalej przełącza** aktywny ↔ nieaktywny, jak opisuje §3.5
  pierwszej wersji. **Ta różnica jest zamierzona** — patrz rozdział 5, to Twoja decyzja.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 3.4 Zniknął pomarańczowy znacznik ostrzegawczy, a nota w okienku mówi coś innego

> **Tego nie zgłaszałaś** — to my dołożyliśmy ten znacznik w Iteracji 4 i to my go teraz
> zabieramy, jako skutek naprawy z punktu 3.1 (**19 września**).

**Skąd się wziął i dlaczego znika.** Pierwsza wersja instrukcji opisywała go w §3.9: pomarańczowe
ostrzeżenie *„Wg dat zakończona, ale w bazie ma status «aktywna» — NADAL obniża ceny."* Był to
**nasz dodatek**, żeby pułapka ze starego Bridge'a przestała być niewidzialna: daty mówiły jedno,
a rabat robił drugie.

Po naprawie z punktu 3.1 **nie ma już czego sygnalizować** — daty i status zawsze się zgadzają,
więc znacznik nie miałby się jak zapalić. Zostawienie go byłoby zostawieniem napisu, który nigdy
się nie pokaże. **Usunęliśmy go.**

Razem z nim **zmieniła się nota w okienku dodawania i edycji promocji.** Stara mówiła, że upływ
daty sam promocji nie wyłącza — czyli **dokładnie odwrotnie niż jest teraz**. Nowa brzmi tak:

> *„Daty rządzą promocją: przed datą początku jest «zaplanowana» i nie obniża cen, po dacie
> końca sama się wyłącza. Zmiana bywa widoczna z kilkuminutowym opóźnieniem."*

**Sprawdź:**
1. Powtórz krok 3 z punktu 3.1 (przestaw promocję na daty z 2020) i popatrz **pod odznakę
   statusu** w tabeli.
2. Otwórz **Dodaj promocję** i przeczytaj małą notkę pod polami dat.

**Ma się stać:**
- krok 1: pod statusem **nie ma żadnego pomarańczowego ostrzeżenia** — jest sama odznaka
  *zakończona*;
- krok 2: notka brzmi jak powyżej i mówi o tym, że **daty rządzą promocją** (a nie że jej nie
  wyłączają).

**⚠ Brak pomarańczowego znacznika jest poprawny.** Jeśli gdzieś go jeszcze zobaczysz — **to jest
błąd**, zgłoś go razem ze zrzutem ekranu. Tu polaryzacja jest odwrotna niż zwykle: **znikniecie
funkcji jest tu dobrą wiadomością.**

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 4. Usuwanie reguły pyta o potwierdzenie i mówi, ilu produktów dotyczy

**Gdzie:** **Narzuty i promocje**, obie zakładki.

---

## 4.1 ⭐ Kosz otwiera okienko z pytaniem i liczbą dotkniętych produktów

> **Zgłosiłaś** *(streszczenie z naszych notatek — dosłownego zapisu Twoich słów nie mamy)*:
> usuwanie reguły **ma pytać o potwierdzenie**, a razem z pytaniem podawać **informację, ilu
> produktów dotyczy zmiana**. *(uwaga do §3.6, testy I4)*

**Jak to naprawiliśmy.** Kosz nie usuwa już od razu. Otwiera okienko z pytaniem, nazwą
usuwanej reguły i **zdaniem o liczbie produktów, które ta reguła dziś realnie obsługuje**.
Dotyczy to **obu zakładek** — narzutów i promocji — i oba okienka mówią tym samym językiem.

To jest **świadome odstępstwo od starego Bridge'a**, na Twoją prośbę: stary Bridge kasuje bez
pytania (tak opisywał to §3.6 pierwszej wersji). **Tutaj odbudowa robi celowo coś innego niż
produkcja.**

**Co dokładnie zobaczysz.** Okienko narzutu: tytuł **„Usunąć regułę narzutu?"** i treść
*„Reguła «nazwa» zostanie usunięta, a ceny całego katalogu przeliczone od nowa. Tej operacji
nie można cofnąć."*, przycisk **„Usuń regułę"**. Okienko promocji jest bliźniacze: **„Usunąć
promocję?"** i przycisk **„Usuń promocję"**.

Pod tym jest **zdanie o liczbie produktów**, w jednym z trzech brzmień:

| Sytuacja | Co przeczytasz |
|---|---|
| katalog jeszcze się wczytuje | *„Liczba dotkniętych produktów: ładowanie katalogu…"* |
| reguła dziś nikogo nie obejmuje | *„Dziś ta reguła nie obejmuje żadnego produktu — usunięcie nie zmieni cen."* |
| reguła kogoś obejmuje | *„Zmiana dotyczy 954 produktów — tyle pozycji katalogu obniża dziś ta promocja."* (przy narzucie końcówka brzmi *„wycenia dziś ta reguła"*) |

**Sprawdź:**
1. Zakładka **Promocje** — kliknij **kosz** przy promocji „marka → BKT" z punktu 2.1.
2. Przeczytaj tytuł, treść i zdanie o liczbie produktów. Kliknij **Anuluj**.
3. Sprawdź, że promocja **nadal jest w tabeli**.
4. Zakładka **Narzuty** — kliknij **kosz** przy dowolnej regule i przeczytaj okienko.
   Kliknij **Anuluj**.
5. Wróć do promocji, kliknij kosz i tym razem **potwierdź** przyciskiem **„Usuń promocję"**.
6. Zajrzyj do **Katalogu** — na cenę produktu BKT i na kolumnę **Promocja**.

**Ma się stać:**
- kroki 1–2: okienko z **nazwą usuwanej reguły** w treści i z **konkretną liczbą** produktów
  (dla promocji BKT rzędu kilkuset — w naszym pomiarze było **954**);
- krok 3: **Anuluj nic nie usuwa**;
- krok 4: okienko narzutu mówi **„Usunąć regułę narzutu?"** i końcówkę *„wycenia dziś ta
  reguła"*;
- krok 5: promocja znika z tabeli, pojawia się komunikat o usunięciu;
- krok 6: cena bez rabatu, w kolumnie **Promocja** jest **„—"**.

**⚠ Liczba w okienku to nie to samo, co liczba z czerwonego paska „poniżej kosztu".** Czerwony
pasek z §3.8 pierwszej wersji liczy dopasowanie **trzecim, osobnym sposobem** i jest ślepy na
warunki **Konstrukcja**, **Średnica** i **VF/IF** — to dziwactwo starego Bridge'a i zostało
odtworzone. **Okienko usuwania liczy wiernym silnikiem**, więc dla reguły z warunkiem
*Konstrukcja* poda prawdziwą liczbę, a czerwony pasek w tym samym miejscu pokazałby zero.
**Rozbieżność między tymi dwiema liczbami nie jest błędem.**

**⚠ „Dziś" w tym zdaniu jest istotne, nie stylistyczne.** Przy promocji *zaplanowanej* albo
*zakończonej* zobaczysz „nie obejmuje żadnego produktu" — bo dziś faktycznie nie obejmuje.
Nie znaczy to, że nie obejmie nikogo nigdy.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 5. Czego świadomie NIE zmieniliśmy — bo tak zdecydowałaś

**Ten rozdział jest równie ważny jak lista zmian**, bo oszczędza Ci testowania i pisania. Trzy
rzeczy z pierwszej wersji instrukcji **zostały dokładnie tak, jak były**, i to na **Twoją własną
decyzję z 18 września 2026**. Tu nie ma czego klikać — to wyjaśnienie, żebyś nie zgłaszała ich
ponownie.

## 5.1 Promocja z zaznaczonym „Reguła globalna" nadal nie obniża żadnych cen

Dotyczy §3.7 i §4 pkt 4 pierwszej wersji. Taka promocja pasuje wyłącznie do produktów, które nie
mają ani marki, ani kategorii — czyli praktycznie do niczego. A jednocześnie czerwony pasek
„poniżej kosztu" traktuje ją, jakby obejmowała cały katalog, więc straszy tysiącami produktów,
po czym zapis nie zmienia ani jednej ceny.

**Twoja decyzja:** *„nie, zostawiamy tak jak jest, nie dodajemy nowych reguł"*.

**Zmierzyliśmy zasięg tej pułapki, żeby wiedzieć, o co gramy: 1 produkt na 7405** — identycznie
w starym Bridge i w odbudowie. **Praktyczny wniosek bez zmian: promocjom zawsze ustawiaj
warunek.**

## 5.2 Komunikat po edycji reguły dalej brzmi „Reguła dodana"

Dotyczy §3.11 pierwszej wersji, która obiecywała komunikat *„Reguła zaktualizowana"*.

**Twoja decyzja:** *„dodana czy zaktualizowana to nie ma różnicy, zostaw to tak jak jest"*.

Sprawdziliśmy przy okazji, czy pod tym komunikatem nie kryje się prawdziwy defekt — czyli czy
edycja przypadkiem nie tworzy drugiej reguły obok pierwszej. **Nie tworzy.** Zapis z edycji
naprawdę aktualizuje istniejącą regułę, myli tylko napis.

## 5.3 Przełącznika statusu przy promocjach nie dokładamy

Dotyczy §3.9 pierwszej wersji i §5 poz. 3. Przy narzutach klikasz odznakę i reguła się wyłącza;
przy promocjach takiego przełącznika nie ma i nie będzie.

**Twoja decyzja:** *„zostawiamy tak jak obecnie działa, promocje po prostu się usuwa"*.

Po naprawie z rozdziału 3 ta decyzja jest jeszcze mocniej przesądzona: status promocji jest teraz
**wyliczany z dat** i celowo nie da się go ustawić ręcznie (punkt 3.3). Gdybyśmy dołożyli
przełącznik, wygaszacz i tak nadpisałby jego ustawienie w ciągu 5 minut. **Zamiast przełącznika
masz dwa sposoby z tabelki w punkcie 3.3: datę albo usunięcie.**

> **Czy któraś z tych trzech decyzji wygląda dziś inaczej, niż ją zapamiętałaś?**
> ☐ nie, wszystkie trzy są w porządku ☐ tak — która i co zmienić: _______________

---

# 6. Co w pierwszej wersji instrukcji przestało być prawdą

Jeśli wracasz do [pierwszej wersji](instrukcja-testow-I4.md), te punkty są już nieaktualne.
**Reszta tamtego dokumentu obowiązuje bez zmian.**

## 6.1 Punkty unieważnione przez zmiany z rozdziałów 2–4

| Punkt pierwszej wersji | Co mówił | Jak jest teraz |
|---|---|---|
| **§3.6** Usunięcie reguły | „znika od razu, **bez pytania o potwierdzenie**" | pyta o potwierdzenie i podaje liczbę produktów — **punkt 4.1** |
| **§3.9** Wygasła promocja NADAL obniża ceny | wygasła promocja dalej obniża ceny, pod statusem pomarańczowy znacznik | **cały punkt nieaktualny**: data końca naprawdę wyłącza promocję, znacznika nie ma — **punkty 3.1 i 3.4** |
| **§3.9**, rada końcowa | „żeby naprawdę wyłączyć promocję, musisz zmienić jej **status**" | **niewykonalne** — statusu nie da się już ustawić; wyłącza się datą albo usunięciem — **punkt 3.3** |
| **§4 pkt 1** Kolumna „Promocja" jest ZAWSZE pusta | „nigdy nie pokazywała niczego… odtworzyliśmy to 1:1" | kolumna **pokazuje rabat i nazwę promocji** — **punkt 2.1** |
| **§4 pkt 5** Status „zakończona", a ceny dalej obniżone | „pomarańczowy znacznik mówi wprost, kiedy tak jest" | **taka sytuacja już nie powstaje**, znacznika nie ma — **punkty 3.1 i 3.4** |
| **§4 pkt 8** Usunięcie reguły nie pyta o potwierdzenie | „zamierzone, patrz §3.6" | pyta — **punkt 4.1** |
| **§6**, pozycja checklisty | „Wygasła promocja dalej obniża ceny, a znacznik mówi o tym wprost ⭐" | **wykreśl ją** — sprawdzasz teraz odwrotną rzecz, punkt 3.1 |

> **Czy któryś z tych punktów zachowuje się u Ciebie nadal po staremu?**
> ☐ nie, wszystkie siedem jest już poprawione ☐ tak — który: _______________

## 6.2 ⚠ §4 pkt 6 był NIEPRAWDZIWY, jeszcze zanim cokolwiek zmieniliśmy

**Tu musimy się przed Tobą przyznać do błędu w dokumencie.**

**Co Ci napisaliśmy** (§4 pkt 6, na liście „rzeczy, które wyglądają na błąd, a są poprawne"):
*„Promocja z datą startu w przyszłości od razu obniża ceny. (…) Etykieta pokaże zaplanowana,
znacznik ostrzeże o rozbieżności, a rabat będzie działał już teraz."*

**Jak było naprawdę.** Nie obniżała cen. **Nie obniżała ich nigdy** — ani od razu, ani po
nadejściu daty startu. Promocja zaplanowana dostawała status *zaplanowana*, silnik ten status
respektował i rabat się nie włączał, a ponieważ nic potem statusu nie przeliczało, **nie włączał
się już nigdy**. Czyli: instrukcja mówiła „działa za wcześnie", a prawda była odwrotna — **nie
działało w ogóle**. To ten sam defekt, który naprawiła zmiana z **punktu 3.2**.

**Skąd wziął się ten błąd w instrukcji.** Napisaliśmy §4 pkt 6 przez analogię do §3.9: skoro
silnik nie czyta dat, to „pewnie" ignoruje je w obie strony. Zabrakło pomiaru — wystarczyło
założyć promocję z datą startu w przyszłości i spojrzeć na cenę. Zrobiliśmy to dopiero
18 września, przy okazji naprawy dat, i wtedy to wyszło.

**Jak jest teraz.** Promocja zaplanowana **nie obniża cen przed datą startu** (to było prawdą
i zostaje) **i włącza się, gdy ta data nadejdzie** (to jest nowe). Sprawdzasz to w **punkcie 3.2**
— test jest tam celowo dwustronny.

**Konsekwencja praktyczna dla Ciebie:** jeśli kiedyś w starym Bridge założyłaś promocję
z datą startu w przyszłości i zdziwiłaś się, że nigdy nie zadziałała — **to nie było Twoje
przeoczenie.** Tak samo jest tam do dziś.

> **Czy ta informacja coś Ci wyjaśnia z wcześniejszych testów?**
> ☐ nie, nie natrafiłam na to ☐ tak — opisz sytuację: _______________

## 6.3 §5 „Czego jeszcze NIE MA" — rozliczenie wszystkich czterech pozycji

Tabela z §5 pierwszej wersji miała cztery pozycje. **Dwie są dowiezione**, jedna zamknięta Twoją
decyzją, jedna **nadal otwarta**:

| Pozycja z §5 | Status | Gdzie / kiedy |
|---|---|---|
| Kolumna „Promocja" w Katalogu pokazująca cokolwiek | ✅ **dowieziona** | 2026-09-18 — opis w **punkcie 2.1** |
| Wyłączanie promocji datą (dziś tylko usunięcie) | ✅ **dowiezione** | 2026-09-19 — opis w **punktach 3.1 i 3.2** |
| Przełącznik statusu przy promocjach (jak przy narzutach) | ❌ **świadomie nie** — Twoja decyzja | 2026-09-18 — **punkt 5.3** |
| Edycja priorytetu reguły z formularza | ⬜ **nadal otwarte** | nikt jeszcze nie decydował — patrz niżej |

**O czwartej pozycji, bo wymaga Twojego zdania.** W formularzu reguły nie ma pola „priorytet"
i pierwsza wersja wyjaśniała, dlaczego (§4 pkt 7): w starym Bridge to pole jest ukryte, a o tym,
która reguła wygrywa, decyduje jej **szczegółowość**, nie priorytet. Reguła „dla dostawcy MO5"
bije globalną niezależnie od priorytetów — i to działa, sprawdziłaś to w §3.3.

Priorytet ma znaczenie tylko w jednej sytuacji: **gdy dwie reguły są równie szczegółowe**.
Wtedy rozstrzyga on, która wygra — a Ty nie masz jak na to wpłynąć z ekranu.

**Ta pozycja wisi od 2 września bez czyjejkolwiek decyzji** — ani nie zdecydowaliśmy jej dowieźć,
ani zamknąć. Nie chcemy jej rozstrzygać za Ciebie, więc pytamy wprost:

> **Czy brak pola „priorytet" w formularzu reguły Ci przeszkadza?**
> ☐ nie, szczegółowość mi wystarcza ☐ tak — opisz, kiedy tego potrzebowałaś: _______________

---

# 7. Podsumowanie

| Punkt | Co sprawdzasz | OK | ŹLE | Uwagi |
|---|---|:--:|:--:|---|
| **1** | Przeczytane: ~2050 cen zmienia się samo, statusy się poprawią | ☐ | ☐ | |
| **2.1** ⭐ | **Kolumna „Promocja" pokazuje `-10%` i nazwę; „—" bez promocji** | ☐ | ☐ | |
| **3.1** ⭐ | **Data końca naprawdę wyłącza promocję, cena wraca** | ☐ | ☐ | |
| **3.2** ⭐ | **Promocja zaplanowana włącza się po nadejściu daty** | ☐ | ☐ | |
| 3.3 | Statusu promocji nie da się ustawić; narzut dalej się przełącza | ☐ | ☐ | |
| 3.4 | Brak pomarańczowego znacznika; nowa notka o datach | ☐ | ☐ | |
| **4.1** ⭐ | **Kosz pyta o potwierdzenie i podaje liczbę produktów** | ☐ | ☐ | |
| 5 | Trzy Twoje decyzje zapamiętane poprawnie | ☐ | ☐ | |
| 6.1 | Żaden z siedmiu unieważnionych punktów nie działa po staremu | ☐ | ☐ | |
| 6.2 | §4 pkt 6 — sprostowanie coś wyjaśnia / nie dotyczy | ☐ | ☐ | |
| 6.3 | Pole „priorytet" — potrzebne czy nie | ☐ | ☐ | |

**Sprawdzonych ____ / 11 · błędów ____ · pominiętych ____**

---

# 8. Jak zgłosić znalezisko

**Zasady zgłaszania są te same co w [pierwszej wersji, sekcja 7](instrukcja-testow-I4.md)** —
podaj numer punktu i kroku, co zobaczyłaś zamiast oczekiwanego, kod produktu, treść reguły,
godzinę i zrzut ekranu. Najcenniejsze jest **rozbicie z Symulatora** obok ceny z Katalogu.

**Najpierw jednak sprawdź ramki ⚠ przy danym punkcie.** Sześć rzeczy w tej kartce wygląda na
błąd, a jest poprawnych:

1. **~2050 cen zmienia się przy pierwszym zapisie**, mimo że Twoja reguła ich nie dotyczy
   (rozdział 1);
2. **„—" w kolumnie Promocja przy każdym produkcie**, dopóki nie założysz promocji (2.1);
3. **kliknięcie nagłówka „Promocja" nie sortuje** tabeli (2.1);
4. **do 5 minut opóźnienia**, gdy data mija sama i nikt nic nie zapisuje (3.1);
5. **wygasła promocja zostaje w tabeli** z odznaką *zakończona*, nie znika (3.1);
6. **brak pomarańczowego znacznika** pod statusem (3.4) — tu odwrotnie niż zwykle: **gdybyś go
   zobaczyła, TO jest błąd.**

**Dwie rzeczy warte zgłoszenia natychmiast**, bo znaczyłyby, że naprawa nie zadziałała:

- promocja **zaplanowana nie włącza się** po przestawieniu daty startu na przeszłość (3.2);
- promocja z **datą końca w przeszłości dalej obniża ceny** po odczekaniu 5 minut (3.1).
