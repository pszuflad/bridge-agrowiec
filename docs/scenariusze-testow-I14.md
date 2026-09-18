# Scenariusze testowe — Iteracja 14

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-18
**Dla:** Ania · **Towarzyszy:** [instrukcja Iteracji 14](instrukcja-testow-I14.md)

> **To jest STAGING, nie produkcja.** Cokolwiek tu zaakceptujesz, odrzucisz albo zepsujesz —
> produkcji nie dotyka. Testuj bez skrupułów.

---

## Jak korzystać z tej kartki

**Ta kartka mówi CO KLIKAĆ. Sąsiednia (`instrukcja-testow-I14.md`) mówi DLACZEGO** — jeśli
gdzieś nie zgadza się to, co widzisz, najpierw zajrzyj tam, bo część „dziwnych" zachowań jest
odtworzona ze starego Bridge celowo.

Każdy scenariusz ma ten sam układ:

| Pole | Co znaczy |
|---|---|
| **Cel** | co ten scenariusz sprawdza, jednym zdaniem |
| **Warunki wstępne** | co musi być zrobione wcześniej |
| **Kroki** | ponumerowane, klikasz po kolei |
| **Oczekiwany wynik** | co ma się stać; **to jest kryterium zaliczenia** |
| **⚠ Uwaga** | pułapka, która wygląda na błąd, a jest poprawna |

**Wynik notuj w arkuszu na końcu** (rozdział 7): **OK** · **BŁĄD** · **POMINIĘTY**.
Przy **BŁĄD** dopisz, co konkretnie zobaczyłaś, i zrób zrzut ekranu.

**Scenariusze oznaczone ⭐ są najważniejsze.** Jeśli masz mało czasu, zrób przynajmniej te:
**S1.4, S2.1, S2.2, S3.2, S5.1**.

**Kolejność ma znaczenie** w rozdziale 1 (S1.4 → S1.5) i w rozdziale 4 (potrzebny wcześniejszy
import MO1). Poza tym scenariusze są niezależne.

---

## 0. Przygotowanie

### P1 — Zaloguj się i ustal punkt wyjścia

**Cel:** upewnić się, że pracujesz na stagingu i że masz dane do oglądania.

**Kroki:**
1. Wejdź na https://test.agritires.eu i zaloguj się swoim kontem.
2. Sprawdź w nagłówku nazwę aplikacji — ma być **„Bridge ONE"**.
3. Wejdź na **Staging** w menu po lewej.

**Oczekiwany wynik:** panel się otwiera, w nagłówku „Bridge ONE".

**Jeśli staging jest pusty** — to normalne po świeżym zresetowaniu bazy. Zrób najpierw **S1.1**
(import cennika), a dopiero potem scenariusze z rozdziału 2.

---

### P2 — Skompletuj pliki testowe

**Cel:** mieć pod ręką wszystko, czego wymagają scenariusze.

**Potrzebujesz:**

| Plik | Do czego | Scenariusze |
|---|---|---|
| cennik **MO1 Bohnenkamp** (CSV) | import podstawowy, sprawdzenie WULSTBAND | S1.1, S1.4, S4.1, S4.2 |
| cennik **MO8 Trelleborg** albo **MO10 GRI** (XLSX) | sprawdzenie, że XLSX wchodzi | S1.9 |
| **plik celowo wadliwy** | sprawdzenie, że jeden zły plik nie blokuje reszty | S1.6 |
| po jednym cenniku od **MO2, MO3, MO4, MO5, MO7, MO8, MO10** | test rozstrzygający | S5.1 |

**Jak zrobić plik celowo wadliwy (do S1.6):** weź dowolny plik tekstowy niebędący cennikiem —
np. zmień rozszerzenie zdjęcia albo dokumentu na `.csv` — i nazwij go `zepsuty.csv`.
Chodzi o to, żeby parser nie rozumiał zawartości.

⚠ **MO6 (Uniglory) jest wyłączony z importu** — nie szukaj jego cennika, poza scenariuszem S1.8,
gdzie sprawdzamy właśnie odmowę.

---

## 1. Wgrywanie ręczne

**Gdzie:** Konfiguracja → zakładka **Wgrywanie ręczne**.

### S1.1 — Import zbiorczy przez okienko

**Cel:** wgrywanie odbywa się w okienku, a nie na zakładce.

**Warunki wstępne:** P1, cennik MO1 na dysku.

**Kroki:**
1. Konfiguracja → **Wgrywanie ręczne**.
2. Na karcie **„Wgraj wiele plików — auto-detekcja"** kliknij **„Wgraj pliki"**.
3. W okienku kliknij **„Wybierz pliki z dysku"** i wskaż cennik MO1.
4. Sprawdź, co pokazał przy pliku (nazwa, rozmiar, liczba wierszy, rozpoznany dostawca).
5. Kliknij **„Importuj do staging"**.

**Oczekiwany wynik:**
- krok 2 otwiera **okienko**, nie formularz na zakładce;
- przy pliku widnieje rozpoznanie w rodzaju *„MO1 · wysoka pewność · Nazwa pliku pasuje
  do wzorca"*;
- po imporcie okienko **zamyka się**, lista plików znika;
- w rogu pojawia się **dymek** z tytułem *„N pozycji czeka na akceptację"* (albo
  *„Import zakończony"*, gdy nic nie poszło do stagingu) i podsumowaniem sklejonym kropkami:
  *Pozycji w plikach · Do akceptacji w stagingu · Nowe · Zmienione · Wycofane · Bez zmian ·
  Odrzucone (nie opony) · Pominięte pliki*;
- pod kaflami pojawia się sekcja **„Ostatni import"** z wynikiem i podglądem pięciu pozycji.

**⚠ Uwaga:** w podsumowaniu **pokazywane są tylko niezerowe** człony — brak „Wycofane" przy
pierwszym imporcie jest poprawny. Podgląd pozycji jest **PO** imporcie, nie przed.

---

### S1.2 — Przycisk importu nie ma licznika

**Cel:** zniknęła regresja „Wgraj (0)".

**Warunki wstępne:** S1.1 wykonany.

**Kroki:**
1. Otwórz okienko przyciskiem **„Wgraj pliki"**.
2. Dodaj plik i popatrz na przycisk akcji.
3. Zaimportuj, otwórz okienko ponownie i znowu popatrz na przycisk.

**Oczekiwany wynik:** przycisk zawsze nazywa się **„Importuj do staging"** — **bez nawiasu
z liczbą**, ani przed importem, ani po.

**⚠ Uwaga:** **brak liczby jest poprawny.** Stary Bridge nigdy licznika w tym miejscu nie miał.

---

### S1.3 — Ręczna korekta rozpoznanego dostawcy

**Cel:** gdy auto-detekcja się myli, da się ją nadpisać w okienku.

**Warunki wstępne:** P1, dowolny cennik.

**Kroki:**
1. Otwórz okienko **„Wgraj pliki"** i dodaj plik.
2. Przy pozycji rozwiń listę dostawców i wybierz **innego** niż rozpoznany.
3. Popatrz, jak zmienił się opis pod nazwą pliku.
4. Kliknij **„Dodaj kolejny plik"** i dodaj drugi plik.
5. Przy jednej z pozycji kliknij **„Usuń"**.
6. Kliknij **„Wyczyść"**.

**Oczekiwany wynik:**
- po kroku 2 opis zmienia się na wariant mówiący o wyborze ręcznym;
- krok 4 dokłada plik **bez zamykania okienka**;
- krok 5 usuwa **tylko tę jedną** pozycję;
- krok 6 czyści listę, ale **okienko zostaje otwarte**.

---

### S1.4 ⭐ — Wymuszenie dostawcy z kafla

**Cel:** wgranie przez kafel ma zignorować nazwę pliku i przypisać pozycje wybranemu dostawcy.
**To najważniejszy scenariusz tego rozdziału.**

**Warunki wstępne:** P1, cennik **MO1** na dysku.

**Kroki:**
1. Konfiguracja → **Wgrywanie ręczne**, zjedź do sekcji
   **„Wgrywanie pojedyncze (z wymuszonym dostawcą)"**.
2. Znajdź kafel **MO3** i kliknij na nim **„Wgraj plik"**.
3. Wskaż cennik, którego nazwa wskazuje na **MO1**.
4. Kliknij **„Importuj do staging"**.
5. Wejdź na **Staging**, ustaw „Typ sprawy" na **„Wszystkie"** i wpisz w szukajkę **MO3**.

**Oczekiwany wynik:**
- sekcja z kaflami **istnieje** i pokazuje wszystkich dostawców (kod, nazwa, e-mail);
- tytuł okienka zawiera kod wymuszonego dostawcy;
- zaimportowane pozycje mają dostawcę **MO3**, **nie MO1** — wymuszenie wygrało z nazwą pliku.

**⚠ Uwaga:** **wykonaj zaraz potem S1.5** — te pozycje są celowo źle przypisane.

---

### S1.5 — Sprzątanie po S1.4

**Cel:** nie zostawić w poczekalni celowo błędnych danych.

**Warunki wstępne:** S1.4 wykonany.

**Kroki:**
1. Na **Stagingu** ustaw „Typ sprawy" na **„Wszystkie"**.
2. Wpisz w szukajkę **MO3**.
3. Zaznacz pozycje z S1.4.
4. Kliknij **„Odrzuć zaznaczone"**.

**Oczekiwany wynik:** pozycje znikają z poczekalni. **Nie akceptuj ich** — trafiłyby
do katalogu pod złym dostawcą.

**⚠ Uwaga:** „Odrzuć zaznaczone" **nie pyta o potwierdzenie** — działa od razu. Tak ma być.

---

### S1.6 — Wadliwy plik nie zatrzymuje pozostałych

**Cel:** jeden zły plik jest pomijany, reszta wchodzi.

**Warunki wstępne:** P2 — plik `zepsuty.csv` oraz poprawny cennik.

**Kroki:**
1. Otwórz okienko **„Wgraj pliki"**.
2. Dodaj **oba** pliki naraz: poprawny cennik i `zepsuty.csv`.
3. Kliknij **„Importuj do staging"**.

**Oczekiwany wynik:**
- pojawia się czerwony dymek **„Błąd pliku zepsuty.csv"**;
- **poprawny plik i tak się importuje** — w podsumowaniu jest człon
  **„Pominięte pliki: 1"**;
- pozycje z poprawnego pliku są w stagingu.

---

### S1.7 — Błąd importu zostawia okienko otwarte *(scenariusz warunkowy)*

**Cel:** po awarii importu nie tracisz listy plików.

**Warunki wstępne:** **wykonaj tylko, jeśli import padnie** — tego nie da się wywołać
na życzenie. Jeśli podczas testów nie trafisz na taki przypadek, zanotuj **POMINIĘTY**.

**Oczekiwany wynik, gdy się zdarzy:**
- czerwony dymek **„Błąd importu"**;
- **okienko zostaje otwarte, lista plików NIE znika**;
- pliki zaimportowane **przed** błędem **są już w stagingu** — sprawdź to.

---

### S1.8 — MO6 odmawia importu

**Cel:** dostawca wyłączony z importu nadal jest widoczny na kaflach, ale odmawia.

**Warunki wstępne:** P1, dowolny plik CSV.

**Kroki:**
1. W sekcji kafli znajdź **MO6 (Uniglory)** i kliknij **„Wgraj plik"**.
2. Wskaż dowolny plik i kliknij **„Importuj do staging"**.

**Oczekiwany wynik:** import kończy się **odmową** z komunikatem o wyłączeniu MO6 z importu.

**⚠ Uwaga:** **kafel MO6 MA być widoczny na liście.** Stary Bridge też nie filtrował kafli —
to nie jest błąd do zgłoszenia.

---

### S1.9 — Plik XLSX wchodzi tak samo jak CSV

**Cel:** format XLSX (MO8 Trelleborg, MO10 GRI) nie jest gorzej obsłużony.

**Warunki wstępne:** P2 — cennik XLSX.

**Kroki:**
1. Otwórz okienko **„Wgraj pliki"** i dodaj cennik XLSX.
2. Popatrz na opis pozycji.
3. Zaimportuj.

**Oczekiwany wynik:** przy pozycji widać oznaczenie arkusza XLSX i liczbę wierszy; import
przechodzi, pozycje są w stagingu. Okienko informuje, że przyjmuje **CSV i XLSX do 50 MB każdy**.

---

## 2. Staging

**Gdzie:** `/staging`.

### S2.1 ⭐ — Domyślny filtr to „Nowe produkty"

**Cel:** ekran startuje tak jak stary Bridge.

**Warunki wstępne:** P1, w stagingu są jakieś pozycje (po S1.1).

**Kroki:**
1. Przeładuj stronę (F5) i wejdź na **Staging**.
2. Popatrz na filtr **„Typ sprawy"**.
3. Rozwiń listę i obejrzyj wszystkie opcje.

**Oczekiwany wynik:**
- filtr stoi na **„Nowe produkty"**, **nie** na „Wszystkie";
- na liście jest sześć opcji: *Wszystkie · Nowe produkty · Nowe produkty (stare) · Wycofane ·
  Zmiany kluczowe · Błędy importu*.

**⚠ Uwaga:** **„Nowe produkty (stare)" nic nie znajdzie** — to pozostałość po starszym
oznaczeniu, zostawiona bo jest w oryginale.

---

### S2.2 ⭐ — Zakres „Akceptuj wszystkie" zależy od filtra

**Cel:** zrozumieć konsekwencję S2.1 — **to jest zabezpieczenie, nie usterka.**

**Warunki wstępne:** S2.1; w stagingu pozycje różnych typów (najlepiej też jakieś błędy
albo wycofania).

**Kroki:**
1. Przy filtrze **„Nowe produkty"** zapisz liczbę `N` z przycisku **„Akceptuj wszystkie (N)"**.
2. Przestaw filtr na **„Wszystkie"**.
3. Zapisz nową liczbę z tego samego przycisku.
4. Przestaw filtr na **„Błędy importu"** i zapisz liczbę raz jeszcze.

**Oczekiwany wynik:** liczba `N` **zmienia się razem z filtrem**. Przy „Nowe produkty" przycisk
obejmuje tylko nowe pozycje, a nie cały staging.

**⚠ Uwaga:** **żeby ruszyć CAŁY staging, trzeba świadomie przestawić filtr na „Wszystkie".**
To właśnie chroni przed zatwierdzeniem błędów importu i wycofań jednym kliknięciem.

---

### S2.3 — Przyciski „zaznaczone" pojawiają się warunkowo

**Cel:** pasek narzędzi układa się jak w oryginale.

**Warunki wstępne:** S2.1, w stagingu co najmniej dwie pozycje.

**Kroki:**
1. Nic nie zaznaczaj. Popatrz na prawą stronę paska narzędzi.
2. Zaznacz **jedną** pozycję.
3. Zaznacz **drugą**.
4. Odznacz obie.

**Oczekiwany wynik:**
- krok 1: przycisków **„Akceptuj zaznaczone"** i **„Odrzuć zaznaczone"** **NIE MA**;
- krok 2: pojawiają się z liczbą **(1)**;
- krok 3: liczba zmienia się na **(2)**;
- krok 4: **znikają** ponownie;
- przez cały czas widoczne pozostają **„Kolumny"**, **„Akceptuj widoczne"**
  i **„Odrzuć widoczne"**, a w nagłówku **„Akceptuj wszystkie (N)"** i **„Odrzuć wszystkie (N)"**.

---

### S2.4 — Które akcje pytają o potwierdzenie

**Cel:** potwierdzenie jest tylko przy wariantach „wszystkie".

**Warunki wstępne:** S2.3.

**Kroki:**
1. Zaznacz jedną pozycję i kliknij **„Odrzuć zaznaczone"**.
2. Kliknij **„Odrzuć widoczne"**, a gdy pojawi się pytanie — obserwuj.
3. Kliknij **„Akceptuj wszystkie (N)"** i przeczytaj okienko, po czym **anuluj**.

**Oczekiwany wynik:**
- kroki 1 i 2 działają **od razu, bez pytania**;
- krok 3 otwiera okienko **„Akceptacja wszystkich pozycji"** z pytaniem
  *„Zaakceptować wszystkie pasujące pozycje (N)?"* i przyciskiem **„Akceptuj wszystkie"**;
- anulowanie **nic nie zmienia**.

**⚠ Uwaga:** brak potwierdzenia przy „zaznaczone" i „widoczne" jest **zgodny ze starym
Bridge** — nie zgłaszaj tego.

---

### S2.5 — Konfigurator kolumn i trzy skróty

**Cel:** przycisk „Kolumny" wrócił i działa.

**Warunki wstępne:** S2.1.

**Kroki:**
1. Kliknij **„Kolumny"**.
2. Przeczytaj nagłówek panelu i policz sekcje.
3. Kliknij skrót **„Żadna"** i popatrz na tabelę.
4. Kliknij **„Wszystkie"**.
5. Kliknij **„Domyślne"**.

**Oczekiwany wynik:**
- panel nazywa się **„Widoczne kolumny (staging)"**;
- ma dwie sekcje: **„W tabeli stagingu"** (10 przełączników) i **„Dodatkowe (z katalogu)"**
  (49 przełączników);
- **„Żadna"** chowa wszystko, co da się schować (zostają zaznaczenie i akcje);
- **„Wszystkie"** włącza całą pierwszą sekcję;
- **„Domyślne"** przywraca stan startowy.

**⚠ Uwaga:** **sekcja „Dodatkowe" nic nie zmienia w tabeli i tak ma być** — panel sam pisze
*„Te kolumny nie są jeszcze wyświetlane w tabeli stagingu."* W starym Bridge też była martwa.

---

### S2.6 — Trzy ukryte kolumny dają się włączyć

**Cel:** „Stan", „Cena zakupu" i „Cena sprzedaży" są ukryte **celowo**, nie zgubione.

**Warunki wstępne:** S2.5, po kliknięciu **„Domyślne"**.

**Kroki:**
1. Spisz nagłówki tabeli po kolei.
2. Kliknij **„Kolumny"** i włącz **Stan**, **Cena zakupu**, **Cena sprzedaży**.
3. Spisz nagłówki ponownie.

**Oczekiwany wynik:**
- krok 1 daje: **☑ · Typ · Kod · Nazwa · Dostawca · Magazyn · Zmiana · Powód · Akcje**;
- krok 3: trzy nowe kolumny wchodzą **między „Magazyn" a „Zmiana"**.

---

### S2.7 — Ustawienia kolumn przeżywają odświeżenie

**Cel:** wybór kolumn zapisuje się w przeglądarce.

**Warunki wstępne:** S2.6 — trzy kolumny włączone.

**Kroki:**
1. Przeładuj stronę (F5).
2. Popatrz na nagłówki tabeli.
3. Kliknij **„Kolumny"** → **„Domyślne"** i przeładuj jeszcze raz.

**Oczekiwany wynik:** po kroku 1 kolumny **nadal są włączone**; po kroku 3 wracają do stanu
domyślnego (znów ukryte).

---

### S2.8 — Szukajka szuka po czterech polach

**Cel:** placeholder mówi prawdę o zakresie wyszukiwania.

**Warunki wstępne:** S2.1, filtr ustawiony na **„Wszystkie"**.

**Kroki:**
1. Przeczytaj tekst w pustym polu szukajki.
2. Wpisz fragment **kodu** produktu.
3. Wyczyść i wpisz fragment **nazwy**.
4. Wyczyść i wpisz **kod dostawcy** (np. `MO1`).

**Oczekiwany wynik:** placeholder brzmi **„Szukaj po kodzie, nazwie, dostawcy lub EAN..."**,
a każde z trzech wyszukiwań coś znajduje.

---

## 3. Karta dostawcy

**Gdzie:** Konfiguracja → zakładka **Dostawcy**.

### S3.1 — Etykieta przycisku synchronizacji

**Cel:** przycisk nazywa się tak jak w produkcji.

**Warunki wstępne:** P1.

**Kroki:**
1. Konfiguracja → **Dostawcy**.
2. Znajdź dostawcę o sposobie dostarczania **`url`** i przeczytaj etykietę przycisku.
3. Kliknij go i popatrz na etykietę w trakcie pobierania.
4. Znajdź dostawcę **`mail`** (MO1, MO7, MO8 albo MO10) i poszukaj tego przycisku.

**Oczekiwany wynik:**
- etykieta to **„Synchronizuj"** — **bez słowa „teraz"**;
- w trakcie pobierania: **„Synchronizuję…"**;
- przy dostawcach `mail` przycisku **nie ma** i tak ma być.

**⚠ Uwaga:** instrukcja Iteracji 3 mówi „Synchronizuj teraz" w dziewięciu miejscach — to ta
sama akcja, stara nazwa.

---

### S3.2 ⭐ — „Wgraj plik" pokazuje liczby, nie „undefined"

**Cel:** wrócił przycisk wgrywania z karty, a dymek pokazuje sensowne dane.
**Tu odbudowa jest LEPSZA od produkcji — celowo.**

**Warunki wstępne:** P1, cennik dostawcy `upload` albo `mail` (np. MO1).

**Kroki:**
1. Konfiguracja → **Dostawcy**, znajdź kartę dostawcy o sposobie **`upload`** lub **`mail`**.
2. Kliknij **„Wgraj plik"** i wskaż cennik.
3. Przeczytaj dymek, który się pojawi — **zrób zrzut ekranu, zanim zniknie**.
4. Znajdź kartę dostawcy **`url`** i sprawdź, czy tam przycisk „Wgraj plik" też jest.

**Oczekiwany wynik:**
- przycisk **„Wgraj plik"** jest przy `upload` i `mail`, **nie ma** go przy `url`;
- po wgraniu dymek **„Plik wczytany"** z treścią
  *„N produktów, N nowych, N zmienionych"* — **z liczbami**;
- w trakcie wgrywania przycisk **„Synchronizuj"** też jest zablokowany.

**⚠ Uwaga:** **jeśli zobaczysz „undefined nowych, undefined zmian" — TO JEST BŁĄD, zgłoś go.**
Tak zachowuje się żywa produkcja i to naprawiliśmy. Jeśli porównujesz z produkcją i widzisz
różnicę w tym dymku — **odbudowa ma rację, produkcja nie**.

---

### S3.3 — Pole minut za opcją „Inna wartość"

**Cel:** pole na własną liczbę minut nie wisi od razu obok listy.

**Warunki wstępne:** P1.

**Kroki:**
1. Przy dowolnym dostawcy kliknij **„Zmień"**.
2. Rozwiń listę **„Co ile sprawdzać cennik"** i spisz wszystkie opcje.
3. Wybierz **„4 godz."**. Popatrz, czy pod listą jest pole na liczbę.
4. Przestaw na **„Inna wartość (minuty)…"**. Popatrz na pole.
5. Wpisz `90`.

**Oczekiwany wynik:**
- lista ma **jedenaście** gotowych wartości: *5 min · 15 min · 30 min · 1 godz. · 2 godz. ·
  4 godz. · 6 godz. · 12 godz. · **1 dni** · 2 dni · 7 dni*, a pod nimi
  **„Inna wartość (minuty)…"**;
- w kroku 3 pola na liczbę **nie ma**;
- w kroku 4 pole **się pojawia i jest PUSTE**.

**⚠ Uwaga — dwie rzeczy, które NIE są błędem:**
- **„1 dni"** zamiast „1 dzień" — stary Bridge skleja liczbę ze słowem bez odmiany;
- **puste pole** po przełączeniu z gotowej wartości — dzięki temu da się jawnie wyczyścić
  harmonogram.

---

### S3.4 — Zapis częstotliwości nadal działa *(regresja po S3.3)*

**Cel:** przeniesienie pola nie zepsuło zapisywania.

**Warunki wstępne:** S3.3, formularz otwarty z wpisaną wartością `90`.

**Kroki:**
1. Kliknij **„Zapisz"**.
2. Popatrz na odznakę częstotliwości na karcie.
3. Kliknij **„Zmień"** ponownie i sprawdź, co pokazuje lista.

**Oczekiwany wynik:** zapis przechodzi, a odznaka na karcie pokazuje nową wartość
(dla 90 minut: **„2 godz."**, bo etykieta zaokrągla). Po ponownym wejściu w edycję
lista stoi na **„Inna wartość (minuty)…"** z wpisanym `90`, bo 90 nie jest gotową wartością.

**⚠ Uwaga:** **pole Status zachowuje się inaczej niż reszta** — patrz rozdział 5.1 instrukcji
Iteracji 14. To osobna, znana sprawa.

---

## 4. Naprawione dziwactwa

### S4.1 — WULSTBAND nie trafia do stagingu

**Cel:** potwierdzić, że Twoja poprawka z 1 września działa w odbudowie.

**Warunki wstępne:** świeży import cennika **MO1 Bohnenkamp** (S1.1).

**Kroki:**
1. Wejdź na **Staging**, ustaw „Typ sprawy" na **„Wszystkie"**.
2. Wpisz w szukajkę **WULSTBAND**.
3. Powtórz wyszukiwanie w **Katalogu**.

**Oczekiwany wynik:** **zero wyników** w obu miejscach.

*Nasz pomiar:* dla MO1 licznik odrzuceń spadł **z 1 na 0** przy tych samych **199 kodach** —
rekord jest odrzucany już w parserze.

---

### S4.2 — NRO i CHO jako „Tak" albo puste pole

**Cel:** potwierdzić, że zera i jedynki zniknęły.

**Warunki wstępne:** import zaakceptowany do katalogu (po S1.1 zaakceptuj kilka pozycji).

**Kroki:**
1. Wejdź na **Katalog**.
2. Znajdź kolumny **NRO** i **CHO**.
3. Przejrzyj kilkadziesiąt wierszy.

**Oczekiwany wynik:** w obu kolumnach jest wyłącznie **„Tak"** albo **puste pole**.
**Nigdzie `0` ani `1`.**

*Nasz pomiar:* `1` → „Tak", `0` → puste; dotknęło **MO1 199, MO3 44, MO9 12 rekordów**.

---

## 5. Test rozstrzygający

### S5.1 ⭐ — Ta sama liczba pozycji w starym i nowym Bridge

**Cel:** dowieść, że parsery odtworzyliśmy wiernie. **To najcenniejszy test całego zestawu
i nikt poza Tobą go nie wykona** — wymaga dostępu do starego Bridge.

**Warunki wstępne:** P2 — po jednym cenniku od MO1, MO2, MO3, MO4, MO5, MO7, MO8, MO10.
**Dla każdego dostawcy musi to być DOKŁADNIE TEN SAM plik** w obu systemach.

**Kroki — powtórz dla każdego dostawcy:**
1. Wgraj plik do **starego Bridge**. Zapisz z podsumowania importu liczbę **wczytanych pozycji**
   i liczbę **pozycji w poczekalni**.
2. Wgraj **ten sam** plik na https://test.agritires.eu.
3. Z dymka podsumowania zapisz człony **„Pozycji w plikach"** i
   **„Do akceptacji w stagingu"**.
4. Wpisz obie liczby do tabeli poniżej i porównaj.

**Oczekiwany wynik:** liczby **zgadzają się** dla każdego dostawcy. Każda rozbieżność
to znalezisko — zgłoś ją razem z plikiem.

⚠ **Nie oceniaj „na oko".** Wpisz liczby. Poprzednie podejście do MO1 zostało zrobione
bez liczb i dlatego nie liczy się jako wykonane.

| Dostawca | Stary Bridge: w plikach | Stary Bridge: w poczekalni | Odbudowa: w plikach | Odbudowa: w stagingu | Zgodne? |
|---|---|---|---|---|---|
| MO1 Bohnenkamp | | | | | |
| MO2 | | | | | |
| MO3 | | | | | |
| MO4 | | | | | |
| MO5 | | | | | |
| MO6 Uniglory | — | — | — | — | nie dotyczy (wyłączony) |
| MO7 | | | | | |
| MO8 Trelleborg (CSV) | | | | | |
| MO8 Trelleborg (XLSX) | | | | | |
| MO9 Agrorami | — | — | — | — | ⛔ niewykonalne (API, brak pliku) |
| MO10 GRI (XLSX) | | | | | |

---

## 6. Czego ten zestaw NIE sprawdza

Żebyś nie szukała tego w scenariuszach:

- **status dostawcy w dwóch polach** — Twoja prośba czeka na decyzję, dziś zachowanie jest
  odtworzone 1:1 (instrukcja I14, rozdz. 5.1);
- **EAN w zapisie naukowym** — decyzja podjęta 18 września, **wdrożenie jeszcze nie zrobione**;
  komunikat *„zapis naukowy ma tylko null cyfr znaczących"* **nadal się pojawia** i to nie jest
  regres (rozdz. 5.2);
- **daty promocji** — zmierzone, naprawa zaplanowana (rozdz. 5.3);
- **wszystko, czego nie zgłaszałaś** — scenariusze Iteracji 3 dla silnika importu, dopasowania
  i wycofań **zostają aktualne** i nie trzeba ich powtarzać.

---

## 7. Arkusz wyników

Wpisz **OK** · **BŁĄD** · **POMINIĘTY**. Przy „BŁĄD" dopisz, co zobaczyłaś, i dołącz zrzut.

| ID | Scenariusz | Wynik | Uwagi |
|---|---|---|---|
| P1 | Logowanie i punkt wyjścia | | |
| P2 | Pliki testowe skompletowane | | |
| S1.1 | Import zbiorczy przez okienko | | |
| S1.2 | Przycisk importu bez licznika | | |
| S1.3 | Ręczna korekta dostawcy | | |
| **S1.4** ⭐ | **Wymuszenie dostawcy z kafla** | | |
| S1.5 | Sprzątanie po S1.4 | | |
| S1.6 | Wadliwy plik nie blokuje reszty | | |
| S1.7 | Błąd importu — okienko zostaje *(warunkowy)* | | |
| S1.8 | MO6 odmawia importu | | |
| S1.9 | Plik XLSX wchodzi | | |
| **S2.1** ⭐ | **Domyślny filtr „Nowe produkty"** | | |
| **S2.2** ⭐ | **Zakres „Akceptuj wszystkie" zależy od filtra** | | |
| S2.3 | Przyciski „zaznaczone" warunkowo | | |
| S2.4 | Które akcje pytają o potwierdzenie | | |
| S2.5 | Konfigurator kolumn i trzy skróty | | |
| S2.6 | Trzy ukryte kolumny dają się włączyć | | |
| S2.7 | Ustawienia kolumn przeżywają odświeżenie | | |
| S2.8 | Szukajka po czterech polach | | |
| S3.1 | Etykieta „Synchronizuj" | | |
| **S3.2** ⭐ | **„Wgraj plik" pokazuje liczby** | | |
| S3.3 | Pole minut za „Inna wartość" | | |
| S3.4 | Zapis częstotliwości nadal działa | | |
| S4.1 | WULSTBAND nie trafia do stagingu | | |
| S4.2 | NRO/CHO jako „Tak"/puste | | |
| **S5.1** ⭐ | **Test rozstrzygający — tabela z liczbami** | | |

**Podsumowanie:** wykonanych ____ / 26 · błędów ____ · pominiętych ____

---

## 8. Jak zgłaszać znalezisko

**Najpierw sprawdź ramki ⚠ w scenariuszu i rozdział 5 instrukcji Iteracji 14** — pięć rzeczy
wygląda na błąd, a jest poprawnych: brak licznika na przycisku importu (S1.2), MO6 na kaflach
(S1.8), brak trzech kolumn w stagingu (S2.6), „1 dni" i puste pole minut (S3.3), komunikat
o zapisie naukowym.

**W zgłoszeniu podaj:**

- **ID scenariusza** (np. „S2.2") i **numer kroku**, na którym się wywróciło,
- **co zobaczyłaś** zamiast oczekiwanego wyniku,
- **zrzut ekranu** — przy dymkach szczególnie, bo znikają po kilku sekundach,
- **który plik** wgrywałaś (nazwa i dostawca), jeśli rzecz dotyczy importu,
- czy to samo dzieje się **w starym Bridge** — jeśli tak, prawdopodobnie odtworzyliśmy
  zachowanie celowo i wystarczy, że dasz znać, czy chcesz je zmienić.
