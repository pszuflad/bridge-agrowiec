# Iteracja 3 (Import) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-01

> **To jest STAGING, nie produkcja.** Baza to kopia produkcji z 2026-08-13. Cokolwiek tu
> zaakceptujesz, odrzucisz albo zepsujesz — produkcji nie dotyka. Testuj bez skrupułów.

---

## 1. Co dowozi Iteracja 3

Cały silnik importu: od wczytania cennika, przez dopasowanie pozycji do katalogu i klasyfikację
zmian, po zatwierdzanie i wycofania. Plus widok `/staging`, w którym te decyzje podejmujesz.

**Sedno do sprawdzenia — trzy reguły:**

1. **Import zatwierdza SAM tylko to, co nieryzykowne** — samą cenę, marżę, stan albo magazyn.
   Wszystko, co rusza tożsamość opony (nazwa, marka, model, rozmiar, indeksy, kod dostawcy),
   idzie do Ciebie na `/staging`.
2. **Twoja ręczna poprawka WYGRYWA z plikiem dostawcy.** Zawsze. Import jej nie nadpisze —
   zgłosi konflikt i zostawi Twoją wartość.
3. **Produkt znika z cennika → wycofanie po TRZECH nieobecnościach pod rząd**, nie po pierwszej.
   Wycofanie nie kasuje produktu, tylko prosi Cię o decyzję.

---

## 2. Przygotowanie — wgraj cennik sama

**Cennik wgrywasz z przeglądarki — nie potrzebujesz Pawła ani konsoli.**

1. Wejdź w **Konfiguracja** w menu po lewej. Otworzy się na zakładce **Dostawcy** —
   przejdź na **Wgrywanie ręczne**.
2. Kliknij pole wyboru pliku i wskaż cennik z dysku. Możesz zaznaczyć **kilka plików naraz**.
3. Przy każdym pliku zobaczysz, **jakiego dostawcę Bridge rozpoznał i dlaczego** — np.
   *MO1 · wysoka pewność · Nazwa pliku pasuje do wzorca*.
4. **Sprawdź ten kod, zanim wgrasz.** Jeśli jest zły albo pusty — wybierz dostawcę z listy
   obok. Napis zmieni się wtedy na *wybrane ręcznie*.
5. Kliknij **Wgraj**.

**Oczekiwane:** przy pliku pojawia się podsumowanie — *Wczytano N pozycji · do stagingu: N ·
nowe · zmienione · wycofane · auto-zatwierdzone* — a pod nim **podgląd pierwszych 5 pozycji**
tak, jak je zrozumiał Bridge. Potem wejdź w **Staging**: pozycje tam są.

**Obsługiwane pliki:** CSV oraz **XLSX** (tak wygląda cennik MO8 Trelleborg i MO10 GRI),
do 50 MB.

> **Jeśli plik się nie wczyta**, dostaniesz czerwony komunikat z powodem — np. że parser nie
> rozumie formatu. **To jest zamierzone i chcemy o tym wiedzieć.** Bridge celowo NIE próbuje
> po cichu drugiego parsera: wolimy pokazać błąd, niż wgrać dane, których nikt nie sprawdził.
> Zgłoś taki przypadek razem z plikiem — patrz [sekcja 7](#7-jak-zgłaszać-problemy).

**Do testu potrzebujesz:**
- konta w panelu (to samo co zwykle),
- pliku cennika któregoś z dostawców (MO1…MO10, **poza MO6** — ten jest wyłączony z importu
  i Bridge odmówi jego wgrania; to poprawne zachowanie).

> **Czego tu jeszcze nie ma.** Zakładki *Spedycja*, *Shoper*, *Katalog* i *AI Fallback* są
> na razie puste — każda mówi, co ją wypełni. **Automatyczne pobieranie cenników co N minut
> już jest** (sekcja 3.13), ale domyślnie WYŁĄCZONE — trzeba je świadomie włączyć; poza tym
> synchronizację uruchamiasz ręcznie (sekcja 3.10).

---

## 3. Scenariusze — po kolei

Każdy scenariusz: **co zrobić** → **czego oczekiwać**. Jeśli wyjdzie inaczej — zapisz i zgłoś
wg [sekcji 7](#7-jak-zgłaszać-problemy).

### 3.1 Lista pozycji

1. Zaloguj się i wejdź w **Staging** w menu po lewej.
2. Zobacz tabelę.

**Oczekiwane:** lista pozycji z kolumnami *Typ · Kod · Nazwa · Dostawca · Stan · Cena zakupu ·
Cena sprzedaży · Magazyn · Zmiana · Powód / co sprawdzić · Akcje*. Kolumny „Stan" i „Cena zakupu"
pokazują zmianę w formie `stara → nowa`, gdy wartość się zmieniła.

**Odznaki typu:** zielona *Nowa*, niebieska *Zmiana kluczowa*, ciemnoczerwona *Błąd*,
czerwona *Wycofana*.

### 3.2 Filtr i wyszukiwarka

1. Zmień **Typ sprawy** na *Błędy importu* → tabela pokazuje tylko pozycje z odznaką *Błąd*.
2. Wróć na *Wszystkie*.
3. Wpisz w wyszukiwarkę fragment kodu albo nazwy → lista się zawęża.

**Oczekiwane:** filtrowanie i szukanie działają **na całym zbiorze**, nie tylko na bieżącej
stronie — licznik „(N pozycji)" na dole ma się zmienić.

### 3.3 Stronicowanie

1. Na dole zmień **Na stronie** na 50 albo 100.
2. Przejdź *Następna* / *Poprzednia* / *« Pierwsza*.

**Oczekiwane:** zmiana rozmiaru strony wraca na stronę 1 (to celowe — inaczej łatwo wylądować
poza zakresem i zobaczyć pustą tabelę).

### 3.4 Podgląd różnic

1. Kliknij **Szczegóły** przy dowolnej pozycji typu *Zmiana kluczowa* albo *Błąd*.

**Oczekiwane:** okno z trzema rzeczami:
- **Powód / co sprawdzić** — pełny opis, co się zmieniło i dlaczego pozycja trafiła do Ciebie,
- **Podgląd różnic** — komplet pól pozycji po normalizacji,
- **Edycja** — osiem pól do poprawienia.

Jeśli pozycja ma ostrzeżenie (np. o konflikcie EAN albo błędnym zapisie nazwy) — pokaże się
na pomarańczowo. **Ostrzeżenia mają być widoczne w całości, nie skracane.**

### 3.5 ⭐ Edycja i poprawka — NAJWAŻNIEJSZY TEST

To jest sedno całej iteracji. Sprawdza, czy Twoja ręczna decyzja przeżywa kolejny import.

1. Otwórz **Szczegóły** dowolnej pozycji.
2. Zmień jedno pole — np. **Kategoria** — na wartość, której nie ma w pliku dostawcy.
3. W **Uzasadnienie** wpisz np. „test poprawki".
4. Kliknij **Zapisz**.
5. Otwórz tę pozycję ponownie.

**Oczekiwane po zapisie:** okno się zamyka, a po ponownym otwarciu w podglądzie widać Twoją
wartość, nie tę z pliku.

**Oczekiwane po ponownym imporcie tego samego cennika** (poproś Pawła o powtórzenie importu):
- pozycja wraca na staging z typem **Błąd**,
- w **Powodzie** jest zdanie: *„konflikt z poprawka Marty — ZOSTANIE ZACHOWANA wartosc Marty,
  plik NIE nadpisuje"*,
- w oknie szczegółów pojawia się pomarańczowa ramka **„Plik dostawcy chciał nadpisać poprawkę
  Marty"** z wartością, której chciał plik,
- **Twoja wartość jest nienaruszona.**

**Oczekiwane po zaakceptowaniu takiej pozycji:** przy KOLEJNYM imporcie ten sam konflikt
**już nie alarmuje** (system zapamiętał, że tę wartość z pliku już widziałaś i odrzuciłaś),
ale Twoja poprawka dalej wygrywa.

To jest cały mechanizm w jednym zdaniu: **plik nigdy nie wygrywa z Tobą, a alarm nie powtarza
się w nieskończoność.**

### 3.6 Akceptacja pojedynczej pozycji

1. Zapamiętaj **Kod** pozycji.
2. Zaznacz ją i kliknij **Akceptuj zaznaczone (1)**.
3. Wejdź w **Katalog** i wyszukaj ten kod.

**Oczekiwane:** pozycja znika ze stagingu, a produkt jest w katalogu z wartościami z pozycji.
Produkt nowy dostaje: cenę sprzedaży = zakup × 1,25 (gdy plik jej nie podał), marżę 25%,
kategorię „Rolnicze" i VAT 23%, jeśli plik nie powiedział inaczej.

> ⚠ To dotyczy stanu z **pustymi** tabelami narzutów/promocji. Od Iteracji 4a: jeśli w
> `/api/markups` lub `/api/promotions` jest choć jedna pasująca, aktywna reguła, akceptacja
> liczy cenę sprzedaży **z tej reguły** (i nadpisuje nią nawet wartość wpisaną ręcznie
> w podglądzie stagingu), nie ze wzoru `zakup × 1,25`.

### 3.7 Odrzucenie

1. Zaznacz pozycję i kliknij **Odrzuć zaznaczone**.

**Oczekiwane:** pozycja znika ze stagingu, a **katalog się NIE zmienia**. Odrzucenie to
„nie chcę tej zmiany", nie „skasuj produkt".

### 3.8 Akcje masowe — trzy różne rzeczy

| Przycisk | Co robi |
|---|---|
| **Akceptuj/Odrzuć zaznaczone** | tylko pozycje z zaznaczonym haczykiem |
| **Akceptuj/Odrzuć widoczne** | wszystkie z BIEŻĄCEJ strony |
| **Akceptuj/Odrzuć wszystkie (N)** | wszystkie pasujące do filtru, **niezależnie od strony** |

1. Ustaw filtr na jakiś typ, kliknij **Odrzuć wszystkie (N)**.

**Oczekiwane:** pytanie o potwierdzenie, a po zgodzie — zniknięcie wszystkich pozycji tego typu,
także z dalszych stron. Licznik wraca do zera.

> Potwierdzenie to nasz dodatek — stary Bridge pytał. Jeśli uznasz je za zbędne, powiedz,
> usuniemy.

### 3.9 Wycofania

Wycofanie pojawia się, gdy produkt zniknie z cennika **trzy razy pod rząd**.

1. Poproś Pawła o trzy importy cennika bez którejś pozycji.
2. Po trzecim wejdź na staging i ustaw filtr **Wycofane**.

**Oczekiwane:** pozycja z odznaką *Wycofana*, powodem „Brak w cenniku — pozycja wycofana"
i stanem docelowym 0. W szczegółach **nie ma podglądu różnic** — jest komunikat, że pozycja
została wycofana i po akceptacji produkt zostanie wstrzymany.

**Po zaakceptowaniu:** produkt **zostaje w katalogu**, ale ze statusem *wstrzymany* i stanem 0.
Nie znika — decyzja o skasowaniu należy do Ciebie, nie do automatu.

### 3.10 ⭐ Pobranie cennika z URL — „Synchronizuj teraz"

Pięciu dostawców (MO2, MO3, MO4, MO5, MO9) nie przysyła plików mailem — Bridge sam pobiera
ich cennik spod adresu URL. Do tej pory dało się to uruchomić tylko z konsoli.

1. Wejdź w **Konfiguracja → Dostawcy**.
2. Znajdź kartę dostawcy z odznaką **url** — np. **MO2**. Zobaczysz na niej adres cennika,
   odznakę *co 1 godz.*, status i napis *ostatnia próba: …*.
3. Kliknij **Synchronizuj teraz**.

**Oczekiwane:** przycisk zmienia się na *Synchronizuję…*, a po chwili pod kartą pojawia się
zielony napis **„Pobrano N produktów"**. Wejdź w **Staging** — pozycje tam są, dokładnie tak
samo jak po ręcznym wgraniu pliku. Na karcie odświeża się *ostatnia próba* i status
**aktywny**.

> **Przycisk „Synchronizuj teraz" jest TYLKO przy dostawcach `url`.** Przy MO1, MO7, MO8
> i MO10 (`mail`) go nie ma i tak ma być — ich cenniki wgrywasz z dysku (sekcja 2).

### 3.11 ⭐ Awaria dostawcy przestaje być cicha

To jest sedno tego bloku: **do tej pory nieudane pobranie nie zostawiało po sobie NICZEGO.**

1. Wejdź w **Konfiguracja → Dostawcy** i kliknij **Zmień** przy dowolnym dostawcy `url`.
2. Wpisz w pole **Adres cennika (URL)** adres, którego nie ma — np.
   `https://test.agritires.eu/nie-ma-takiego-pliku.csv`. Kliknij **Zapisz**.
3. Kliknij **Synchronizuj teraz**.

**Oczekiwane:** czerwony komunikat **„Błąd synchronizacji: HTTP 404"** (albo inny kod),
a odznaka statusu na karcie zmienia się na **błąd**. *Ostatnia próba* aktualizuje się mimo
niepowodzenia — to jest znacznik próby, nie sukcesu.

**Co jeszcze się stało, choć tego nie widzisz:** Bridge zapisał **alert**. Widok alertów
dowozi Iteracja 6; do tego czasu Paweł odczyta je z bazy. Jeśli serwer dostawcy w ogóle nie
odpowie (zamiast zwrócić błąd), komunikat będzie inny — np. *„fetch failed"* albo *„This
operation was aborted"* — i to też jest poprawne: to dosłowna treść błędu sieci.

> **Nie zapomnij przywrócić prawidłowego adresu** po tym teście — kliknij **Zmień** i wpisz
> z powrotem oryginalny URL.

### 3.12 Zmiana częstotliwości i pozostałych pól dostawcy

Dotąd zmiana „co ile sprawdzać cennik" była doklejonym skryptem obok właściwej aplikacji.
Teraz jest jej normalną częścią.

1. **Konfiguracja → Dostawcy** → **Zmień** przy dostawcy `url`.
2. Wybierz wartość z listy **Co ile sprawdzać cennik** (5 min … 7 dni) albo wpisz własną
   liczbę minut w polu poniżej. Puste pole = **bez harmonogramu**.
3. Możesz tu też zmienić adres cennika, **sposób dostarczania** i **status**
   (np. *wstrzymany*, żeby wyłączyć dostawcę z automatu).
4. **Zapisz**.

**Oczekiwane:** napis *Zapisano*, a odznaka na karcie pokazuje nową wartość — np. *co 4 godz.*
⚠ Dotyczy to częstotliwości, URL-a i sposobu dostarczania. **Pole Status zachowuje się
inaczej** — karta zwykle pokaże wartość wyliczoną, nie tę wybraną. To poprawne; wyjaśnienie
w punkcie 11 rozdziału 4.

**Sprawdź też blokadę:** ustaw dostawcy status **wstrzymany**, zapisz i kliknij
**Synchronizuj teraz**. **Ręczna synchronizacja MA PRZEJŚĆ** mimo wstrzymania — wstrzymanie
wyłącza tylko automat (blok 3f-3), nie Twoją decyzję.

---

### 3.13 ⭐ Automat — pobieranie cenników bez klikania (scheduler)

Pięciu dostawców (**MO2, MO3, MO4, MO5, MO9**) ma w produkcji ustawione pobieranie
**co 60 minut**. Ten sam mechanizm jest już w nowym Bridge, ale — inaczej niż w produkcji —
**startuje wyłącznie wtedy, gdy ktoś świadomie go włączy**. Zrobiliśmy tak celowo: włączony
automat odpytuje PRAWDZIWE serwery dostawców i podmienia dane pod Tobą w trakcie testów,
a przy dostawcy, który akurat pada, dopisuje alert za każdym razem (patrz punkt 10 niżej).

**Jak go włączyć (robi to Paweł na stagingu — tu masz, o co poprosić):**

W pliku `.env` backendu:

```
IMPORT_SCHEDULER=true
IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG=true
```

…i restart backendu. Druga zmienna jest po to, żebyś **nie czekała godziny** — bez niej
pierwsze pobranie następuje dopiero po pełnym interwale (60 min), dokładnie jak w starym
Bridge. Z nią pięciu dostawców rusza od razu po starcie, jeden po drugim co ~5 sekund.

**Po czym POZNASZ, że działa** — w logu backendu, zaraz po starcie:

```
[scheduler] zaplanowano 5 dostawców z URL polling
```

Jeśli zobaczysz `zaplanowano 0`, **spójrz na linię pod spodem** — wypisuje każdego
pominiętego dostawcę z powodem, np.:

```
[scheduler] pominięto: MO1 (sposób dostarczania: mail), MO6 (brak częstotliwości),
            MO9 (status wstrzymany PRZELICZONY — ostatni plik sprzed 41 dni (próg: 30))
```

**Trzy powody, dla których automat potrafi zaplanować ZERO mimo poprawnych ustawień** —
wszystkie odziedziczone po starym Bridge, żadnego nie zmienialiśmy:

| Co widzisz w logu | Co się dzieje | Co z tym zrobić |
|---|---|---|
| `sposób dostarczania: mail` | Dostawca odbiera cennik mailem, nie spod URL | Nic — tak ma być |
| `brak URL` / `brak częstotliwości` | Pole puste na karcie dostawcy | Uzupełnij w **Konfiguracja → Dostawcy** |
| `status wstrzymany PRZELICZONY — ostatni plik sprzed N dni` | Dostawca nie miał udanego importu od ponad **30 dni**, więc Bridge sam liczy go jako wstrzymanego — i już nigdy go nie odpyta | Zrób raz **Synchronizuj teraz**; to odświeży znacznik i przy następnym restarcie dostawca wróci do automatu |
| `status wstrzymany PRZELICZONY — brak pliku i zero produktów` | Świeża baza: dostawca nigdy nic nie zaimportował | Wgraj cennik albo zrób **Synchronizuj teraz** raz ręcznie |

**Test właściwy** (przy włączonych obu zmiennych):

1. Poproś o restart backendu z włączonym schedulerem.
2. W ciągu ~30 sekund w **Konfiguracja → Dostawcy** odśwież stronę.
3. **Oczekiwane:** u dostawców `url` pole **ostatnia próba** pokazuje przed chwilą,
   a w **stagingu** przybyło pozycji. W tabeli alertów przybyły wpisy *Synchronizacja*
   (albo *Błąd HTTP* / *Błąd pobierania*, jeśli któryś dostawca akurat nie odpowiada —
   to też jest poprawny wynik testu, patrz 3.11).

**Zmiana częstotliwości działa OD RAZU, bez restartu.** Ustaw dostawcy np. *co 5 min*
i zapisz — automat przeplanuje się sam. ⚠ W starym Bridge tak **nie** było: tam zmiana
częstotliwości nie ruszała automatu aż do restartu procesu, więc panel mówił „Zapisano"
o czymś, co nie zadziałało. To jedna z niewielu rzeczy, które świadomie poprawiliśmy.

⚠ **Uwaga uboczna:** zapis na karcie **któregokolwiek** dostawcy przebudowuje harmonogram
**wszystkich** i zeruje im odliczanie. Przy edycji raz na jakiś czas to niewidoczne; nie
klikaj „Zapisz" co kilka minut w kółko, bo automat nie zdąży się odpalić.

---

## 4. ⚠ Rzeczy, które WYGLĄDAJĄ na błąd, a są poprawne

Przeczytaj, zanim coś zgłosisz — to najczęstsze fałszywe alarmy.

**1. Zmian samej ceny i stanu NIE MA na stagingu.**
Import zatwierdza je sam i wpisuje wprost do katalogu. Na staging trafia tylko to, co wymaga
Twojej decyzji. Jeśli po imporcie staging jest chudy, a ceny w katalogu się zmieniły — tak ma być.
Liczbę auto-zatwierdzeń widać w statystykach importu (Paweł poda).

**2. Po pierwszym imporcie nie ma żadnych wycofań.**
Próg to trzy nieobecności pod rząd. `wycofane: 0` przy pierwszym przebiegu jest poprawne.

**3. Kolumna „szerokość" w katalogu pokazuje czasem `620.0` zamiast `620`.**
To zastane dane sprzed Twojej poprawki `szertxt` — kolumna była wcześniej liczbowa i przy
przejściu na tekst zostawiła po sobie takie zapisy. Nowe importy zapisują poprawnie (`620`,
`14.9`, `10.00`), więc z czasem samo się wyprostuje.

**4. Komunikat „zapis naukowy ma tylko null cyfr znaczących".**
To **odtworzony błąd starego Bridge**, nie nowa usterka. W produkcji ta wiadomość wygląda
identycznie. Zostawiliśmy ją celowo, żeby nic nie zmieniać po cichu — zgłoszona osobno
i czeka na Twoją decyzję, czy naprawiamy.

**5. MO6 (Uniglory) odmawia importu.**
Komunikat: *„Dostawca MO6 jest wyłączony z importu"*. Tak ustaliliśmy — MO6 został świadomie
wyłączony.

**6. Filtr „Nowe produkty (stare)" nic nie znajduje.**
To pozostałość po starszym oznaczeniu pozycji. Zostawiliśmy ją, bo jest w oryginale, ale nowy
import jej nie produkuje.

**7. Liczba „do akceptacji" w statystykach bywa większa niż liczba wierszy na stagingu.**
Statystyka liczy pozycje przetworzone, a staging skleja powtórzenia tej samej pozycji w jeden
wiersz. Różnica jest poprawna.

**8. Licznik „N produktów w katalogu" na karcie dostawcy zostaje ZEROWY po imporcie.**
Ta liczba to realna zawartość katalogu, a świeżo zaimportowane pozycje siedzą w **stagingu** —
do katalogu wchodzą dopiero po Twojej akceptacji. Czy import się udał, poznasz po polu
*ostatnia próba* i po zawartości stagingu, nie po tym liczniku.

**9. „Ostatnia próba" aktualizuje się także wtedy, gdy pobranie PADŁO.**
Tak ma być — to znacznik ostatniej PRÓBY, nie ostatniego sukcesu. Gdyby aktualizował się tylko
przy powodzeniu, nie dałoby się odróżnić dostawcy, który milczy od tygodnia, od takiego,
którego Bridge próbuje bezskutecznie odpytywać co godzinę.

**10. Ten sam dostawca produkuje wiele identycznych alertów o awarii.**
Bridge zapisuje alert przy KAŻDEJ nieudanej próbie, bez sklejania powtórek — dokładnie jak
stary Bridge. Liczba powtórzeń to informacja („pada od trzech dni, 23 razy na dobę"), a nie
usterka. Zwijaniem powtórek w czytelną listę zajmie się widok alertów w **Iteracji 6**.

**11. ⭐ Ustawiasz status *wstrzymany*, zapisujesz — a karta dalej pokazuje *aktywny*
albo *błąd*.**
To NIE jest zignorowany zapis. Bridge (stary i nowy tak samo) **wylicza status wyświetlany
na bieżąco** i w większości przypadków nadpisuje nim to, co zapisałaś:

| Sytuacja dostawcy | Co pokaże karta |
|---|---|
| ostatni import udany, są produkty w katalogu | *aktywny* |
| ostatni import udany, zero produktów w katalogu | *błąd* |
| ostatni import ponad **30 dni** temu | *wstrzymany* |
| nigdy nic nie zaimportował | *wstrzymany* |
| nigdy nic nie zaimportował, ale ma produkty | Twoja wartość z pola **Status** |

**Twoje wstrzymanie mimo to DZIAŁA** — jest zapisane i to ono, a nie napis na karcie,
blokuje automatyczne pobieranie. Sprawdzisz to tak: wstrzymaj dostawcę, poczekaj na cykl
automatu i zobacz, że **ostatnia próba** się nie zmieniła, a **Synchronizuj teraz** dalej
przechodzi. Zachowanie odtworzone 1:1 ze starego Bridge — zgłoszone osobno, czeka na
decyzję, czy je prostować.

---

## 5. Czego jeszcze NIE MA — świadomie

| Czego brakuje | Kiedy |
|---|---|
| ~~Automatyczne pobieranie cenników co N minut~~ | ✅ **jest** — sekcja 3.13, domyślnie wyłączone |
| **Widok** alertów (same alerty już się zapisują) | Iteracja 6 |
| Zakładki *Spedycja*, *Shoper*, *Katalog*, *AI Fallback* | Iteracja 11 |
| ~~Narzuty i promocje przeliczające cenę sprzedaży~~ | ✅ **jest** (backend, 4a) — brakuje widoku `/narzuty` (4b) |
| Ekran ze **zmianami cen poszczególnych opon** z auto-zatwierdzenia | Iteracja 10 |
| Alerty | Iteracja 6 |
| Atrybuty | Iteracja 7 |
| Lista „cena na zapytanie" i powody wstrzymania | Iteracja 12 |

Zmiany cen **są zapisywane** przy każdym auto-zatwierdzeniu — brakuje tylko ekranu, który
je pokaże, i przychodzi on w Iteracji 10, nie 5.

> **Sprostowanie (2026-09-02, Iteracja 5).** Ekran **Historia** już działa i ma własną
> instrukcję: `docs/instrukcja-testow-I5.md`. Ale **nie pokazuje zmian cen** — to log
> zdarzeń (import / eksport / ręczna edycja produktu). Wcześniejsze zdanie w tym miejscu
> obiecywało co innego; poprawione.

---

## 6. Szybka lista kontrolna

- [ ] **Cennik wgrany z przeglądarki daje pozycje w stagingu** ⭐
- [ ] **Automat pobiera sam po włączeniu `IMPORT_SCHEDULER`** ⭐ (sekcja 3.13)
- [ ] Log mówi `zaplanowano N dostawców z URL polling`, a przy `0` wypisuje powody
- [ ] Zmiana częstotliwości wchodzi w życie bez restartu backendu
- [ ] Rozpoznany dostawca zgadza się z plikiem (i da się go poprawić ręcznie)
- [ ] Plik XLSX (MO8 / MO10) też się wgrywa
- [ ] Zepsuty plik daje CZYTELNY błąd, a nie ciszę
- [ ] MO6 zostaje odrzucony jako wyłączony z importu
- [ ] Lista pozycji renderuje się z kompletem kolumn
- [ ] Filtr typu zawęża listę
- [ ] Wyszukiwarka działa na całym zbiorze
- [ ] Stronicowanie i zmiana „Na stronie"
- [ ] Podgląd różnic pokazuje powód i ostrzeżenia w całości
- [ ] **Edycja zapisuje się i przeżywa kolejny import** ⭐
- [ ] **Konflikt z poprawką jest zgłaszany, a wartość zachowana** ⭐
- [ ] Akceptacja przenosi pozycję do katalogu
- [ ] Odrzucenie nie rusza katalogu
- [ ] Akcje masowe (zaznaczone / widoczne / wszystkie)
- [ ] Wycofanie po trzecim imporcie, produkt wstrzymany a nie skasowany
- [ ] **„Synchronizuj teraz" pobiera cennik z URL i daje pozycje w stagingu** ⭐
- [ ] **Zły adres → czerwony komunikat i status „błąd" na karcie — a nie cisza** ⭐
- [ ] Przycisk synchronizacji jest tylko przy dostawcach `url`
- [ ] Zmiana częstotliwości zapisuje się i widać ją na odznace
- [ ] Dostawca „wstrzymany" DAJE się zsynchronizować ręcznie

---

## 7. Jak zgłaszać problemy

Napisz Pawłowi, podając:

1. **Co robiłaś** — konkretny krok z tej instrukcji albo opis kliknięć.
2. **Czego oczekiwałaś** i **co się stało**.
3. **Kod pozycji** i **dostawcę** (bez tego trudno odtworzyć).
4. **Godzinę** (z dokładnością do minuty — po niej znajdziemy wpis w logach).
5. **Zrzut ekranu**, jeśli coś wygląda nie tak.

Najcenniejsze zgłoszenia to te z sekcji 3.5 — jeśli poprawka NIE przeżyła importu albo plik
nadpisał Twoją wartość, to jest błąd krytyczny i chcemy o nim wiedzieć od razu.

---

## 8. Dodatek — wgrywanie cennika z konsoli

Ta sekcja NIE jest już potrzebna do testów — cennik wgrywasz klikając, wg
[sekcji 2](#2-przygotowanie--wgraj-cennik-sama). Zostaje dla Pawła i na wypadek, gdyby
trzeba było wgrać plik skryptem albo porównać wynik obu dróg.

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

Dostawcy z własnym adresem cennika mają też pobieranie po URL:

```bash
curl -s -X POST https://test.agritires.eu/api/import/from-url \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"dostawcaKod":"MO1"}'
```
