# Iteracja 3 (Import) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Wersja instrukcji:** 2026-09-02 (pełna Iteracja 3, po zamknięciu bloku 3f)

> **To jest STAGING, nie produkcja.** Baza to kopia produkcji z 2026-08-13. Cokolwiek tu
> zaakceptujesz, odrzucisz albo zepsujesz — produkcji nie dotyka. Testuj bez skrupułów.

---

## ⭐ Najważniejsze zdanie w tej instrukcji

**Nowy Bridge to ODBUDOWA starego, nie nowy program.** Zasada jest taka: zachowanie ma być
**identyczne**, a każda różnica musi być świadomą decyzją, nie przypadkiem.

Z tego wynika, czego od Ciebie potrzebujemy. Nie „czy to jest wygodne" i nie „czy to jest
poprawne biznesowo" — tylko:

> **Czy nowy Bridge robi to samo, co stary?**

Wszystko, co zobaczysz, wpada w jedną z trzech szuflad:

| Szuflada | Co to znaczy | Co robisz |
|---|---|---|
| **Ma być tak samo** | Zdecydowana większość | **Zgłoś każdą różnicę** wobec starego Bridge |
| **Zmieniliśmy świadomie** | 10 rzeczy, wypisane w [rozdziale 11](#11-świadome-odstępstwa-od-starego-bridge--nie-zgłaszaj) | Nie zgłaszaj — chyba że uznasz zmianę za złą |
| **Dziwactwo odtworzone celowo** | 13 rzeczy, wypisane w [rozdziale 12](#12-dziwactwa-odtworzone-celowo--nie-zgłaszaj) | Nie zgłaszaj — wiemy o nich |

**Zajrzyj do rozdziałów 11 i 12, ZANIM coś zgłosisz.** Oszczędzi Ci to pisania, a nam
tłumaczenia. Wszystko poza tymi dwiema listami jest podejrzane i chcemy o tym wiedzieć.

---

## 1. Zanim zaczniesz

**Czego potrzebujesz:**
- konta w panelu (to samo co zwykle),
- **prawdziwych cenników** od dostawców — najlepiej tych samych plików, które wgrywasz
  do starego Bridge. To one są w tym teście najcenniejsze,
- dostępu do starego Bridge, żeby mieć z czym porównywać (rozdział 8).

**Ile to zajmuje:** pełne przejście to kilka godzin. Da się w kawałkach — rozdziały
5, 6, 7 (trzy drogi importu) i rozdział 9 (staging) są od siebie niezależne.

**Od czego zacząć, jeśli masz mało czasu:** rozdział 8 (parsery, bo tam siedzi największe
ryzyko) i punkt 9.5 (poprawki Marty, bo to sedno całej iteracji).

---

## 2. Co obejmuje Iteracja 3

Cały silnik importu — od wczytania cennika, przez dopasowanie pozycji do katalogu
i klasyfikację zmian, po zatwierdzanie i wycofania. Plus ekrany, w których to widzisz.

Powstawało to w siedmiu kawałkach. Nie musisz ich pamiętać, ale przydają się przy zgłoszeniach:

| Kawałek | Co dowiózł | Gdzie to widać |
|---|---|---|
| **3a** | Przeniesienie **parserów** ze starego Bridge — kopia co do bajta | rozdz. 8 |
| **3b** | Wczytanie pliku i URL-a do stagingu | rozdz. 5, 6 |
| **3c** | **Dopasowanie** pozycji z pliku do produktu w katalogu | rozdz. 9 |
| **3d** | **Zatwierdzanie, wycofania, poprawki Marty** | rozdz. 9.5–9.9 |
| **3e** | Widok **Staging** | rozdz. 9 |
| **3f-1** | **Wgrywanie plików z przeglądarki** + zakładki Konfiguracji | rozdz. 5 |
| **3f-2** | Dostawcy: **URL, alerty, sterowanie z panelu** | rozdz. 6, 10 |
| **3f-3** | **Automat** — pobieranie bez klikania | rozdz. 7 |

**Najważniejsze:** do bloku 3f żadnej z dróg importu nie dało się uruchomić inaczej niż
z konsoli. Teraz **wszystkie trzy klikasz sama.**

---

## 3. Trzy reguły — sedno całej iteracji

Jeśli miałabyś sprawdzić tylko trzy rzeczy, to te:

1. **Import zatwierdza SAM tylko to, co nieryzykowne** — samą cenę, marżę, stan albo magazyn.
   Wszystko, co rusza tożsamość opony (nazwa, marka, model, rozmiar, indeksy, kod dostawcy),
   idzie do Ciebie na **Staging**.
2. **Twoja ręczna poprawka WYGRYWA z plikiem dostawcy.** Zawsze. Import jej nie nadpisze —
   zgłosi konflikt i zostawi Twoją wartość.
3. **Produkt znika z cennika → wycofanie po TRZECH nieobecnościach pod rząd**, nie po pierwszej.
   Wycofanie nie kasuje produktu, tylko prosi Cię o decyzję.

---

## 4. Ściąga — dziesięciu dostawców

Każdy dostawca ma własny parser, bo każdy przysyła plik w innym układzie.

| Kod | Dostawca | Jak przychodzi cennik | Format | Uwagi |
|---|---|---|---|---|
| **MO1** | Bohnenkamp | mail → wgrywasz | CSV | patrz [§12 pkt 12](#12-dziwactwa-odtworzone-celowo--nie-zgłaszaj) — `WULSTBAND` |
| **MO2** | JMK | **URL** — automat | CSV | |
| **MO3** | Grasdorf (kolarolnicze.pl) | **URL** — automat | CSV | najczęściej padał w produkcji |
| **MO4** | Handlopex Wrocław | **URL** — automat | CSV | ten sam parser co MO5 |
| **MO5** | Handlopex Rzeszów | **URL** — automat | CSV | ten sam parser co MO4 |
| **MO6** | Agrowiec / Uniglory | wgranie ręczne | CSV | ⛔ **wyłączony z importu** — odmówi wgrania |
| **MO7** | Nokian | mail → wgrywasz | CSV | |
| **MO8** | Trelleborg | mail → wgrywasz | **XLSX** | w bazie wpisany jako „csv" — patrz §8 |
| **MO9** | Agro-Rami (BKT) | **URL** — automat | **API (JSON)** | nie plik, tylko odpowiedź serwisu |
| **MO10** | GRI | mail → wgrywasz | **XLSX** | |

**Pięciu dostawców URL (MO2–MO5, MO9) ma w produkcji ustawione pobieranie co 60 minut.**
To jest ta połowa importu, która dotąd działa sama i której nikt z nas nie widział w panelu.

---

## 5. Droga A — wgranie cennika z dysku

Dotyczy MO1, MO7, MO8, MO10 (przychodzą mailem) oraz MO6 (który odmówi — i tak ma być).

1. **Konfiguracja** w menu po lewej → zakładka **Wgrywanie ręczne**.
2. Wskaż plik z dysku. Możesz zaznaczyć **kilka naraz**.
3. Przy każdym pliku zobaczysz, **jakiego dostawcę Bridge rozpoznał i dlaczego** — np.
   *MO1 · wysoka pewność · Nazwa pliku pasuje do wzorca*.
4. **Sprawdź ten kod, zanim wgrasz.** Zły albo pusty — wybierz dostawcę z listy obok.
   Napis zmieni się na *wybrane ręcznie*.
5. **Wgraj.**

**Oczekiwane:** podsumowanie *Wczytano N pozycji · do stagingu: N · nowe · zmienione ·
wycofane · auto-zatwierdzone*, a pod nim **podgląd pierwszych 5 pozycji** tak, jak je
zrozumiał Bridge. Potem w **Stagingu** te pozycje są.

**Obsługiwane:** CSV oraz **XLSX**, do 50 MB.

**Sprawdź też:**
- **MO6 ma odmówić** — komunikat *„Dostawca MO6 jest wyłączony z importu"*. To poprawne.
- **Zepsuty plik ma dać CZYTELNY błąd**, a nie ciszę. Zgłoś taki przypadek razem z plikiem.

---

## 6. Droga B — pobranie z URL na żądanie („Synchronizuj teraz")

Dotyczy MO2, MO3, MO4, MO5, MO9. Do tej pory dało się to uruchomić tylko z konsoli.

1. **Konfiguracja → Dostawcy.**
2. Znajdź kartę z odznaką **url** — np. **MO2**. Zobaczysz adres cennika, odznakę
   *co 1 godz.*, status i *ostatnia próba: …*.
3. **Synchronizuj teraz.**

**Oczekiwane:** przycisk zmienia się na *Synchronizuję…*, po chwili zielony napis
**„Pobrano N produktów"**. W **Stagingu** pozycje są — dokładnie tak samo jak po wgraniu
pliku z dysku. Na karcie odświeża się *ostatnia próba* i status **aktywny**.

> Przycisk jest **tylko przy dostawcach `url`**. Przy MO1, MO7, MO8, MO10 go nie ma i tak ma być.

### 6.1 ⭐ Awaria dostawcy przestaje być cicha

**To jest sedno bloku 3f-2: do tej pory nieudane pobranie nie zostawiało po sobie NICZEGO.**

1. **Zmień** przy dowolnym dostawcy `url` → w pole **Adres cennika (URL)** wpisz adres,
   którego nie ma, np. `https://test.agritires.eu/nie-ma-takiego-pliku.csv` → **Zapisz**.
2. **Synchronizuj teraz.**

**Oczekiwane:** czerwony komunikat **„Błąd synchronizacji: HTTP 404"**, odznaka statusu
zmienia się na **błąd**, a *ostatnia próba* aktualizuje się mimo niepowodzenia — to znacznik
**próby**, nie sukcesu.

Jeśli serwer w ogóle nie odpowie (zamiast zwrócić błąd), komunikat będzie inny — np.
*„fetch failed"* albo *„This operation was aborted"*. To też jest poprawne: to dosłowna
treść błędu sieci, dokładnie taka, jaka trafia do alertów w starym Bridge.

**Co jeszcze się stało, choć tego nie widzisz:** Bridge zapisał **alert**. Widok alertów
dowozi Iteracja 6; do tego czasu Paweł odczyta je z bazy.

> ⚠ **Przywróć prawidłowy adres** po tym teście.

---

## 7. Droga C — automat (scheduler)

Pięciu dostawców URL ma w produkcji pobieranie **co 60 minut**. Ten sam mechanizm jest
w nowym Bridge, ale — inaczej niż w produkcji — **startuje wyłącznie wtedy, gdy ktoś
świadomie go włączy.** Celowo: włączony automat odpytuje PRAWDZIWE serwery dostawców
i podmienia dane pod Tobą w trakcie testów.

**Jak go włączyć** (robi Paweł — tu masz, o co poprosić). W `.env` backendu:

```
IMPORT_SCHEDULER=true
IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG=true
```

…i restart backendu. **Druga zmienna jest po to, żebyś nie czekała godziny** — bez niej
pierwsze pobranie następuje dopiero po pełnym interwale, dokładnie jak w starym Bridge.
Z nią piątka rusza od razu, jeden po drugim co ~5 sekund.

**Po czym poznasz, że działa** — w logu backendu, zaraz po starcie:

```
[scheduler] zaplanowano 5 dostawców z URL polling
```

**Jeśli zobaczysz `zaplanowano 0`, spójrz na linię pod spodem** — wypisuje każdego
pominiętego dostawcę z powodem:

| Powód w logu | Co się dzieje | Co zrobić |
|---|---|---|
| `sposób dostarczania: mail` | Dostawca odbiera cennik mailem | Nic — tak ma być |
| `brak URL` / `brak częstotliwości` | Puste pole na karcie | Uzupełnij w **Konfiguracja → Dostawcy** |
| `status wstrzymany PRZELICZONY — ostatni plik sprzed N dni` | Brak udanego importu od ponad **30 dni**, więc Bridge sam liczy go jako wstrzymanego — i już nigdy nie odpyta | Zrób raz **Synchronizuj teraz**; przy następnym restarcie wróci do automatu |
| `status wstrzymany PRZELICZONY — brak pliku i zero produktów` | Świeża baza, dostawca nigdy nic nie zaimportował | Wgraj cennik albo **Synchronizuj teraz** raz ręcznie |

**Test właściwy:**

1. Poproś o restart backendu z włączonym schedulerem.
2. W ciągu ~30 sekund odśwież **Konfiguracja → Dostawcy**.
3. **Oczekiwane:** u dostawców `url` *ostatnia próba* pokazuje przed chwilą, a w **Stagingu**
   przybyło pozycji. Jeśli któryś dostawca akurat nie odpowiada — też jest poprawny wynik,
   patrz 6.1.

**Zmiana częstotliwości działa OD RAZU, bez restartu.** Ustaw np. *co 5 min* i zapisz.
⚠ W starym Bridge tak **nie** było — tam zmiana nie ruszała automatu aż do restartu procesu,
więc panel mówił „Zapisano" o czymś, co nie zadziałało. To jedna z rzeczy, które świadomie
poprawiliśmy.

⚠ **Uwaga uboczna:** zapis na karcie **któregokolwiek** dostawcy przebudowuje harmonogram
**wszystkich** i zeruje im odliczanie. Nie klikaj „Zapisz" co kilka minut w kółko, bo automat
nie zdąży się odpalić.

---

## 8. ⭐ Parsery — czy czytają plik tak samo jak stary Bridge

**To jest rozdział o największym ryzyku w całej iteracji.** Parsery to dziesięć osobnych
kawałków kodu, po jednym na dostawcę, które zamieniają cennik na pozycje. Zostały przeniesione
ze starego Bridge **kopią co do bajta** — nie przepisywaliśmy ich, bo każde przepisanie
to okazja do zgubienia czegoś, o czym nikt już nie pamięta.

Automatyczne testy porównują wynik na próbkach Twoich plików. **Ale test sprawdza tylko to,
co ktoś przewidział — a Ty masz pliki, których my nie mamy.**

### 8.1 Test rozstrzygający: ten sam plik w obu Bridge'ach

**To jest najcenniejszy test, jaki możesz zrobić.** Dla każdego dostawcy:

1. Weź **ten sam plik cennika**.
2. Wgraj go do **starego** Bridge. Zapisz liczbę wczytanych pozycji.
3. Wgraj go do **nowego** (https://test.agritires.eu, rozdział 5). Zapisz liczbę.
4. **Porównaj.**

**Oczekiwane: liczby mają się zgadzać co do sztuki.** Jeśli się różnią — to jest najpoważniejsze
znalezisko z możliwych i chcemy o nim wiedzieć natychmiast. Podaj plik, dostawcę i obie liczby.

Zrób to dla **każdego dostawcy, do którego masz plik** — a szczególnie dla MO8 i MO10 (XLSX)
oraz MO1 (najbardziej zawiły parser).

### 8.2 Podgląd pięciu pozycji — czy pola trafiły we właściwe miejsca

Po wgraniu pliku dostajesz **podgląd pierwszych 5 pozycji**. Otwórz obok plik w Excelu
i sprawdź na tych pięciu wierszach:

- [ ] **Nazwa** — czy to nazwa opony, a nie sklejka z kilku kolumn?
- [ ] **Rozmiar** — czy odczytany, czy pusty?
- [ ] **Cena zakupu** — czy ta sama liczba co w pliku (uwaga na przecinek vs kropka)?
- [ ] **Stan** — czy liczba sztuk, a nie kod magazynu?
- [ ] **Marka / model** — czy rozdzielone poprawnie?

**Najczęstsze objawy zepsutego parsera:** wszystkie ceny zerowe, wszystkie stany zerowe,
nazwa zawierająca średniki, rozmiar pusty przy każdej pozycji.

### 8.3 Rozpoznawanie dostawcy po pliku

Przy wgrywaniu Bridge **sam zgaduje**, czyj to cennik — po nazwie pliku i po układzie kolumn.

1. Wgraj plik **z oryginalną nazwą** → ma rozpoznać właściwego dostawcę z *wysoką pewnością*.
2. **Zmień nazwę pliku** na `cennik.csv` i wgraj ponownie → ma rozpoznać po zawartości,
   ewentualnie z niższą pewnością.
3. Podłóż plik **nie tego** dostawcy i sprawdź, czy da się poprawić ręcznie z listy.

> ⚠ **Tu naprawiliśmy błąd, którego stary Bridge nie ma naprawionego.** W starym, gdy plik
> miał pustą kolumnę, ta pustka pasowała do **każdego** wzorca naraz i rozpoznanie potrafiło
> wskazać dowolnego dostawcę. W nowym już nie. Jeśli więc stary rozpoznaje coś inaczej niż
> nowy — **nowy prawdopodobnie ma rację.** Zgłoś, ale bez alarmu.

### 8.4 Sprawy specyficzne dla poszczególnych dostawców

**MO8 Trelleborg — plik XLSX, a w bazie wpisany „csv".** W starym Bridge oznaczało to, że
gdy przyszedł CSV zamiast XLSX, import **po cichu wczytywał zero pozycji** i nikt się nie
dowiadywał. W nowym jest bezpiecznik: **pusty import przerywa się z błędem**, zamiast udawać
sukces. Jeśli zobaczysz taki błąd — to jest bezpiecznik przy pracy, nie usterka.

**MO9 Agro-Rami — to nie plik, tylko API.** Jego adres URL zwraca odpowiedź serwisu (JSON),
nie cennik do pobrania. Testuj go wyłącznie przez **Synchronizuj teraz** (rozdział 6).

**MO4 i MO5 Handlopex — jeden parser, dwaj dostawcy** (Wrocław i Rzeszów). Jeśli coś
zepsuje się u jednego, sprawdź od razu drugiego.

**MO1 Bohnenkamp — najbardziej zawiły.** Wyciąga model z nazwy po przecinku, odrzuca dętki
i akcesoria. Wiemy, że **16 pozycji `WULSTBAND` (taśma na obręcz) przechodzi jako opona** —
to znany błąd starego Bridge, patrz [§12 pkt 12](#12-dziwactwa-odtworzone-celowo--nie-zgłaszaj).

---

## 9. Staging — Twoje decyzje

### 9.1 Lista pozycji

**Staging** w menu po lewej.

**Oczekiwane:** tabela z kolumnami *Typ · Kod · Nazwa · Dostawca · Stan · Cena zakupu ·
Cena sprzedaży · Magazyn · Zmiana · Powód / co sprawdzić · Akcje*. „Stan" i „Cena zakupu"
pokazują `stara → nowa`, gdy wartość się zmieniła.

**Odznaki:** zielona *Nowa*, niebieska *Zmiana kluczowa*, ciemnoczerwona *Błąd*,
czerwona *Wycofana*.

### 9.2 Filtr i wyszukiwarka

Zmień **Typ sprawy** na *Błędy importu* → tylko pozycje z odznaką *Błąd*. Wpisz w wyszukiwarkę
fragment kodu albo nazwy → lista się zawęża.

**Oczekiwane:** filtrowanie i szukanie działają **na całym zbiorze**, nie tylko na bieżącej
stronie — licznik „(N pozycji)" na dole ma się zmienić.

### 9.3 Stronicowanie

Zmień **Na stronie** na 50 albo 100, przejdź *Następna* / *Poprzednia* / *« Pierwsza*.

**Oczekiwane:** zmiana rozmiaru strony wraca na stronę 1 (celowe — inaczej łatwo wylądować
poza zakresem i zobaczyć pustą tabelę).

### 9.4 Podgląd różnic

**Szczegóły** przy pozycji typu *Zmiana kluczowa* albo *Błąd* → okno z trzema rzeczami:
**Powód / co sprawdzić**, **Podgląd różnic** (komplet pól po normalizacji) i **Edycja**
(osiem pól). Ostrzeżenia — np. o konflikcie EAN — na pomarańczowo.
**Mają być widoczne w całości, nie skracane.**

### 9.5 ⭐⭐ Edycja i poprawka — NAJWAŻNIEJSZY TEST CAŁEJ ITERACJI

Sprawdza, czy Twoja ręczna decyzja przeżywa kolejny import.

1. Otwórz **Szczegóły** dowolnej pozycji.
2. Zmień jedno pole — np. **Kategoria** — na wartość, której nie ma w pliku dostawcy.
3. W **Uzasadnienie** wpisz np. „test poprawki". **Zapisz.**
4. Otwórz pozycję ponownie.

**Oczekiwane po zapisie:** okno się zamyka, a po ponownym otwarciu widać **Twoją** wartość,
nie tę z pliku.

**Oczekiwane po ponownym imporcie tego samego cennika:**
- pozycja wraca na staging z typem **Błąd**,
- w **Powodzie**: *„konflikt z poprawka Marty — ZOSTANIE ZACHOWANA wartosc Marty, plik NIE
  nadpisuje"*,
- pomarańczowa ramka **„Plik dostawcy chciał nadpisać poprawkę Marty"** z wartością, której
  chciał plik,
- **Twoja wartość jest nienaruszona.**

**Oczekiwane po zaakceptowaniu takiej pozycji:** przy KOLEJNYM imporcie ten sam konflikt
**już nie alarmuje** (system zapamiętał, że tę wartość widziałaś i odrzuciłaś), ale Twoja
poprawka dalej wygrywa.

Cały mechanizm w jednym zdaniu: **plik nigdy nie wygrywa z Tobą, a alarm nie powtarza się
w nieskończoność.**

### 9.6 Akceptacja pojedynczej pozycji

Zapamiętaj **Kod**, zaznacz pozycję, **Akceptuj zaznaczone (1)**, potem **Katalog** → wyszukaj kod.

**Oczekiwane:** pozycja znika ze stagingu, produkt jest w katalogu. Nowy produkt dostaje:
cenę sprzedaży = zakup × 1,25 (gdy plik jej nie podał), marżę 25%, kategorię „Rolnicze"
i VAT 23%, jeśli plik nie powiedział inaczej.

### 9.7 Odrzucenie

**Oczekiwane:** pozycja znika ze stagingu, a **katalog się NIE zmienia**. Odrzucenie to
„nie chcę tej zmiany", nie „skasuj produkt".

### 9.8 Akcje masowe — trzy różne rzeczy

| Przycisk | Co robi |
|---|---|
| **Akceptuj/Odrzuć zaznaczone** | tylko pozycje z haczykiem |
| **Akceptuj/Odrzuć widoczne** | wszystkie z BIEŻĄCEJ strony |
| **Akceptuj/Odrzuć wszystkie (N)** | wszystkie pasujące do filtru, **niezależnie od strony** |

Ustaw filtr, kliknij **Odrzuć wszystkie (N)**.

**Oczekiwane:** pytanie o potwierdzenie, a po zgodzie zniknięcie wszystkich pozycji tego typu,
także z dalszych stron. Licznik wraca do zera.

### 9.9 Wycofania

Wycofanie pojawia się, gdy produkt zniknie z cennika **trzy razy pod rząd**.

1. Poproś Pawła o trzy importy cennika bez którejś pozycji.
2. Po trzecim: staging → filtr **Wycofane**.

**Oczekiwane:** odznaka *Wycofana*, powód „Brak w cenniku — pozycja wycofana", stan docelowy 0.
W szczegółach **nie ma podglądu różnic** — jest komunikat, że po akceptacji produkt zostanie
wstrzymany.

**Po zaakceptowaniu:** produkt **zostaje w katalogu**, ale ze statusem *wstrzymany* i stanem 0.
Nie znika — decyzja o skasowaniu należy do Ciebie, nie do automatu.

---

## 10. Konfiguracja dostawcy — sterowanie z panelu

Dotąd zmiana ustawień dostawcy była doklejonym skryptem obok właściwej aplikacji. Teraz jest
jej normalną częścią.

1. **Konfiguracja → Dostawcy** → **Zmień**.
2. **Co ile sprawdzać cennik** — wartość z listy (5 min … 7 dni) albo własna liczba minut.
   Puste pole = **bez harmonogramu**.
3. Możesz też zmienić adres cennika, **sposób dostarczania** i **status**.
4. **Zapisz.**

**Oczekiwane:** *Zapisano*, a odznaka pokazuje nową wartość — np. *co 4 godz.*

⚠ **Pole Status zachowuje się inaczej niż reszta** — karta zwykle pokaże wartość wyliczoną,
nie tę wybraną. To poprawne, wyjaśnienie w [§12 pkt 10](#12-dziwactwa-odtworzone-celowo--nie-zgłaszaj).

**Sprawdź blokadę:** ustaw status **wstrzymany**, zapisz, kliknij **Synchronizuj teraz**.
**Ręczna synchronizacja MA PRZEJŚĆ** mimo wstrzymania — wstrzymanie wyłącza tylko automat,
nie Twoją decyzję.

---

## 11. Świadome ODSTĘPSTWA od starego Bridge — NIE zgłaszaj

Dziesięć rzeczy, które robimy **inaczej niż stary Bridge, na czyjąś decyzję**. Jeśli uznasz
którąś za złą — powiedz, ale to rozmowa o decyzji, nie zgłoszenie błędu.

1. **XLSX da się wgrać z panelu, i nie ma progu 10 MB.** Stary panel przyjmował tylko CSV
   do 10 MB, więc MO8 i MO10 (oba XLSX) były przez niego niewgrywalne. Limit to teraz 50 MB.
2. **Zepsuty plik daje błąd zamiast cichej drugiej próby.** Stary Bridge, gdy parser się
   wywrócił, po cichu próbował drugim, starszym zestawem parserów. Wolimy o awarii WIEDZIEĆ.
3. **MO6 jest wyłączony z importu** i odmawia wgrania — Twoja decyzja z 2026-08-26.
4. **Pusty import przerywa się z błędem.** Stary potrafił wczytać zero pozycji i zgłosić
   sukces (patrz §8.4, MO8).
5. **Rozpoznawanie dostawcy nie zgaduje z pustej kolumny** — naprawione u nas, w starym
   nadal obecne (§8.3).
6. **Akcje masowe pytają o potwierdzenie.** Stary pytał też — ale gdybyś uznała je za zbędne,
   usuniemy.
7. **Nie wszystkie pola dostawcy da się zmienić przez panel.** Kilka pól technicznych jest
   celowo odciętych, m.in. przełącznik wyłączający MO6 z importu — inaczej bramkę z punktu 3
   dałoby się zdjąć jednym kliknięciem.
8. **Zmiana częstotliwości działa od razu, bez restartu** (rozdział 7). W starym trzeba było
   restartować proces, a panel i tak mówił „Zapisano".
9. **Automat jest domyślnie WYŁĄCZONY** i wymaga świadomego włączenia (rozdział 7).
   W produkcji chodzi zawsze.
10. **Szerokość opony jest zapisywana jako tekst**, nie liczba — dzięki temu `10.00` i `620`
    zostają takie, jakie są w pliku. To Twoja poprawka `szertxt`, naniesiona na stałe.

---

## 12. Dziwactwa ODTWORZONE CELOWO — NIE zgłaszaj

Trzynaście rzeczy, które **wyglądają na błąd, a stary Bridge robi dokładnie tak samo.**
Odtworzyliśmy je świadomie: gdybyśmy je po cichu naprawili, nie dałoby się już porównać
obu systemów, a część z nich to sygnały diagnostyczne.

**1. Zmian samej ceny i stanu NIE MA na stagingu.** Import zatwierdza je sam i wpisuje wprost
do katalogu. Na staging trafia tylko to, co wymaga Twojej decyzji. Chudy staging przy
zmienionych cenach w katalogu = tak ma być.

**2. Po pierwszym imporcie nie ma żadnych wycofań.** Próg to trzy nieobecności pod rząd.
`wycofane: 0` przy pierwszym przebiegu jest poprawne.

**3. Kolumna „szerokość" pokazuje czasem `620.0` zamiast `620`.** Zastane dane sprzed Twojej
poprawki. Nowe importy zapisują poprawnie — z czasem samo się wyprostuje.

**4. Komunikat „zapis naukowy ma tylko null cyfr znaczących".** Odtworzony błąd starego
Bridge — w produkcji wygląda identycznie. **Czeka na Twoją decyzję, czy naprawiamy.**

**5. Filtr „Nowe produkty (stare)" nic nie znajduje.** Pozostałość po starszym oznaczeniu
pozycji. Jest w oryginale, ale nowy import jej nie produkuje.

**6. Liczba „do akceptacji" bywa większa niż liczba wierszy na stagingu.** Statystyka liczy
pozycje przetworzone, a staging skleja powtórzenia tej samej pozycji w jeden wiersz.

**7. Licznik „N produktów w katalogu" na karcie dostawcy zostaje ZEROWY po imporcie.**
To realna zawartość katalogu, a świeżo zaimportowane pozycje siedzą w **stagingu**. Czy import
się udał, poznasz po *ostatniej próbie* i po zawartości stagingu, nie po tym liczniku.

**8. „Ostatnia próba" aktualizuje się także wtedy, gdy pobranie PADŁO.** To znacznik PRÓBY,
nie sukcesu. Gdyby aktualizował się tylko przy powodzeniu, nie dałoby się odróżnić dostawcy,
który milczy od tygodnia, od takiego, którego Bridge bezskutecznie odpytuje co godzinę.

**9. Ten sam dostawca produkuje wiele identycznych alertów o awarii.** Alert przy KAŻDEJ
nieudanej próbie, bez sklejania powtórek. Liczba powtórzeń to informacja („pada od trzech dni,
23 razy na dobę"), a nie usterka. Zwijaniem powtórek zajmie się widok alertów w **Iteracji 6**.

**10. Ustawiasz status *wstrzymany*, zapisujesz — a karta pokazuje *aktywny* albo *błąd*.**
To nie jest zignorowany zapis. Bridge (stary i nowy tak samo) **wylicza status wyświetlany
na bieżąco** i w większości przypadków nadpisuje nim to, co zapisałaś:

| Sytuacja dostawcy | Co pokaże karta |
|---|---|
| ostatni import udany, są produkty w katalogu | *aktywny* |
| ostatni import udany, zero produktów w katalogu | *błąd* |
| ostatni import ponad **30 dni** temu | *wstrzymany* |
| nigdy nic nie zaimportował | *wstrzymany* |
| nigdy nic nie zaimportował, ale ma produkty | Twoja wartość z pola **Status** |

**Twoje wstrzymanie mimo to DZIAŁA** — jest zapisane i to ono blokuje automat. Sprawdzisz tak:
wstrzymaj dostawcę, poczekaj na cykl automatu, zobacz, że *ostatnia próba* się nie zmieniła,
a **Synchronizuj teraz** dalej przechodzi. **Zgłoszone osobno, czeka na decyzję.**

**11. Alert o nieudanym pobraniu nazywa się „Błąd pobierania" także wtedy, gdy plik pobrał się
poprawnie, a wywrócił się parser.** Nazwa myli, ale powód jest w treści alertu. Zobaczysz to
dopiero, gdy Paweł pokaże Ci alerty z bazy.

**12. `WULSTBAND` z cennika Bohnenkampa (MO1) wchodzi jako opona.** 16 pozycji taśmy na obręcz
z pustym rozmiarem. **Twoje zgłoszenie z 2026-08-26, zatwierdzone do naprawy — jeszcze nie
naprawione.** Na razie zachowuje się jak w produkcji.

**13. Pola `nro` i `cho` zapisują się jako `0`/`1` zamiast pustego i „Tak".** Tak samo
**Twoje zgłoszenie z 2026-08-26, zatwierdzone do naprawy — jeszcze nie naprawione.**

---

## 13. Czego jeszcze NIE MA — świadomie

| Czego brakuje | Kiedy |
|---|---|
| **Widok** alertów (same alerty już się zapisują) | Iteracja 6 |
| Zakładki *Spedycja*, *Shoper*, *Katalog*, *AI Fallback* w Konfiguracji | Iteracja 11 |
| Narzuty i promocje przeliczające cenę sprzedaży | Iteracja 4 |
| Widok Historia (zmiany cen z importów) | Iteracja 5 |
| Atrybuty | Iteracja 7 |
| Lista „cena na zapytanie" i powody wstrzymania | Iteracja 12 |

Historia cen **jest zapisywana** przy każdym auto-zatwierdzeniu — brakuje tylko widoku.

---

## 14. Lista kontrolna

**Parsery — najważniejsze**
- [ ] ⭐⭐ **Ten sam plik daje TĘ SAMĄ liczbę pozycji w starym i nowym Bridge** (§8.1)
- [ ] Podgląd 5 pozycji zgadza się z plikiem otwartym w Excelu (§8.2)
- [ ] Rozpoznanie dostawcy działa po nazwie i po zmianie nazwy pliku (§8.3)
- [ ] Sprawdzone dla każdego dostawcy, do którego mam plik: MO1 ☐ MO2 ☐ MO3 ☐ MO4 ☐ MO5 ☐ MO7 ☐ MO8 ☐ MO9 ☐ MO10 ☐

**Trzy drogi importu**
- [ ] Cennik wgrany z przeglądarki daje pozycje w stagingu (§5)
- [ ] XLSX (MO8 / MO10) też się wgrywa
- [ ] MO6 zostaje odrzucony jako wyłączony z importu
- [ ] Zepsuty plik daje CZYTELNY błąd, a nie ciszę
- [ ] „Synchronizuj teraz" pobiera cennik z URL (§6)
- [ ] ⭐ Zły adres → czerwony komunikat i status „błąd" — a nie cisza (§6.1)
- [ ] Przycisk synchronizacji jest tylko przy dostawcach `url`
- [ ] ⭐ Automat pobiera sam po włączeniu `IMPORT_SCHEDULER` (§7)
- [ ] Log mówi `zaplanowano N dostawców`, a przy `0` wypisuje powody

**Staging**
- [ ] Lista renderuje się z kompletem kolumn, filtr i wyszukiwarka działają na całym zbiorze
- [ ] Stronicowanie i zmiana „Na stronie"
- [ ] Podgląd różnic pokazuje powód i ostrzeżenia w całości
- [ ] ⭐⭐ **Edycja zapisuje się i przeżywa kolejny import** (§9.5)
- [ ] ⭐⭐ **Konflikt z poprawką jest zgłaszany, a Twoja wartość zachowana** (§9.5)
- [ ] Akceptacja przenosi pozycję do katalogu; odrzucenie nie rusza katalogu
- [ ] Akcje masowe (zaznaczone / widoczne / wszystkie)
- [ ] Wycofanie po trzecim imporcie, produkt wstrzymany a nie skasowany

**Konfiguracja**
- [ ] Zmiana częstotliwości zapisuje się i widać ją na odznace
- [ ] Zmiana częstotliwości wchodzi w życie bez restartu
- [ ] Dostawca „wstrzymany" DAJE się zsynchronizować ręcznie

---

## 15. Jak zgłaszać problemy

Napisz Pawłowi, podając:

1. **Co robiłaś** — konkretny punkt z tej instrukcji albo opis kliknięć.
2. **Czego oczekiwałaś** i **co się stało.**
3. **Kod pozycji** i **dostawcę** (bez tego trudno odtworzyć).
4. **Godzinę** z dokładnością do minuty — po niej znajdziemy wpis w logach.
5. **Zrzut ekranu**, jeśli coś wygląda nie tak.
6. **Plik cennika**, jeśli rzecz dotyczy importu. To najważniejszy załącznik.

**Najcenniejsze zgłoszenia, w kolejności:**

1. **Różnica w liczbie pozycji między starym a nowym Bridge** (§8.1) — najpoważniejsze.
2. **Poprawka nie przeżyła importu** albo plik nadpisał Twoją wartość (§9.5) — krytyczne.
3. **Cokolwiek, co działa inaczej niż w starym Bridge**, a nie ma tego w rozdziale 11 ani 12.

---

## 16. Dodatek — wgrywanie cennika z konsoli

Ta sekcja **nie jest już potrzebna do testów** — cennik wgrywasz klikając (rozdział 5).
Zostaje dla Pawła i na wypadek, gdyby trzeba było porównać wynik obu dróg.

⚠ To INNY endpoint niż przycisk w panelu: `POST /api/import/parse-file` (poniżej) kontra
`POST /api/dostawcy/{kod}/upload` (zakładka *Wgrywanie ręczne*). Oba kończą się pozycjami
w stagingu, ale ten z panelu dodatkowo zapisuje alert „Ręczny upload" i znaczniki na dostawcy.

```bash
# 1. Token (podstaw swój email i hasło)
TOKEN=$(curl -s -X POST https://test.agritires.eu/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"TWOJ@EMAIL","password":"TWOJE_HASLO"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# 2. Wgranie cennika (dostawcaKod: MO1…MO10, bez MO6)
curl -s -X POST 'https://test.agritires.eu/api/import/parse-file?dostawcaKod=MO1&nazwa=cennik.csv' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/octet-stream' \
  --data-binary @cennik_MO1.csv
```

Odpowiedź to statystyki przebiegu:

| Pole | Znaczenie |
|---|---|
| `doStagingu` | pozycje przetworzone do stagingu |
| `nowe` / `zmienione` | nowe pozycje / zmiany wymagające decyzji |
| `autoZatwierdzone` | **zatwierdzone automatycznie, prosto do katalogu** |
| `wycofane` | pozycje wycofane w tym przebiegu (po trzeciej nieobecności) |
| `bezZmian` | pozycje identyczne z katalogiem |
| `odrzuconeNieOpony` | odrzucone jako nie-opony |

Pobranie po URL:

```bash
curl -s -X POST https://test.agritires.eu/api/import/from-url \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"dostawcaKod":"MO1"}'
```
