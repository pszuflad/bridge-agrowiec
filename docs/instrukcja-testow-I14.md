# Iteracja 14 (Twoje uwagi z testów Importu) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-18

> **To jest STAGING, nie produkcja.** Cokolwiek tu zaakceptujesz, odrzucisz albo zepsujesz —
> produkcji nie dotyka. Testuj bez skrupułów.

> **⚠ PRZECZYTAJ TO NAJPIERW.**
>
> Ta iteracja **nie dodaje żadnego nowego ekranu.** Powstała **z Twoich uwag** wpisanych do
> instrukcji Iteracji 3 — poprawiliśmy trzy ekrany, które codziennie klikasz, żeby wyglądały
> tak jak w starym Bridge: **Wgrywanie ręczne**, **Staging** i **kartę dostawcy**.
>
> Produkcja się nie zmieniła. Zmieniła się odbudowa — **dogoniła** produkcję.
>
> Dlatego **instrukcja Iteracji 3 jest miejscami nieaktualna** — pisano ją przed tymi
> poprawkami. **Nie trzeba jej czytać na nowo ani niczego w niej naprawiać.** Zasada jest
> prosta: **gdy coś różni się od tamtej kartki, prawdą jest to, co piszę TUTAJ.** Rozdział 10
> wymienia konkretnie, co w Iteracji 3 przestało być prawdą.
>
> Jeśli staging jest pusty — najpierw zaimportuj jakiś cennik (rozdział 3), inaczej nie będzie
> czego oglądać.

---

## 1. Co zmienia Iteracja 14 — w skrócie

Trzy ekrany dociągnięte do kształtu starego Bridge:

- **Wgrywanie ręczne** — wgrywanie przeniosło się z zakładki **do okienka**, a pod spodem
  doszła brakująca sekcja z **kaflami dostawców** (wgrywanie z wymuszonym dostawcą).
- **Staging** — otwiera się teraz na filtrze **„Nowe produkty"**, a nie „Wszystkie"; pasek
  narzędzi jest poukładany jak w oryginale i doszedł przycisk **„Kolumny"**.
- **Karta dostawcy** — doszedł przycisk **„Wgraj plik"**, przycisk synchronizacji nazywa się
  **„Synchronizuj"** (bez „teraz"), a pole liczby minut schowało się za osobną opcją.

Przy okazji: **dwa dziwactwa z Twojej listy już nie istnieją** — WULSTBAND i `0`/`1` w NRO/CHO
zostały naprawione (rozdział 6).

**To jest pierwsza fala Iteracji 14.** Druga fala (silnik cen: daty promocji, EAN w notacji
naukowej) jest zaplanowana, ale jeszcze nie zrobiona — rozdziały 8 i 11.

---

## 2. Co zobaczysz INACZEJ niż wcześniej

| Gdzie | Jak było | Jak jest teraz (Iteracja 14) |
|---|---|---|
| Konfiguracja → Wgrywanie ręczne | pliki wybierało się wprost na zakładce, przycisk **„Wgraj (N)"** z licznikiem | przycisk **„Wgraj pliki"** otwiera **okienko**; w okienku **„Importuj do staging"**, **bez licznika** |
| Konfiguracja → Wgrywanie ręczne | brak | nowa sekcja **„Wgrywanie pojedyncze (z wymuszonym dostawcą)"** — kafle wszystkich dostawców |
| Konfiguracja → Wgrywanie ręczne | komunikaty pod formularzem | **toast** (dymek w rogu) z podsumowaniem importu |
| Staging → filtr „Typ sprawy" | startowo **„Wszystkie"** | startowo **„Nowe produkty"** |
| Staging → tabela | wszystkie kolumny widoczne | **„Stan", „Cena zakupu", „Cena sprzedaży" są domyślnie UKRYTE** — włączasz je przyciskiem **„Kolumny"** |
| Staging → pasek narzędzi | akcje masowe w pasku | „Akceptuj/Odrzuć **wszystkie** (N)" przeniosły się **do nagłówka**; „…**zaznaczone**" pokazują się dopiero, gdy coś zaznaczysz |
| Staging → szukajka | ogólny opis | placeholder mówi prawdę: **„Szukaj po kodzie, nazwie, dostawcy lub EAN..."** |
| Karta dostawcy → przycisk synchronizacji | **„Synchronizuj teraz"** | **„Synchronizuj"** |
| Karta dostawcy | brak | nowy przycisk **„Wgraj plik"** (przy dostawcach `upload` i `mail`) |
| Karta dostawcy → częstotliwość | pole „liczba minut" widoczne od razu obok listy | pole ukryte; odsłania je opcja **„Inna wartość (minuty)…"** |

---

## 3. Wgrywanie ręczne — nowy przepływ

**Gdzie:** Konfiguracja → zakładka **Wgrywanie ręczne**.

Zakładka ma teraz **dwie karty** i **dwie różne ścieżki wgrywania**. To nie jest to samo — druga
ścieżka pomija rozpoznawanie dostawcy.

### 3.1 Ścieżka A — wiele plików, Bridge sam rozpoznaje dostawcę

Karta **„Wgraj wiele plików — auto-detekcja"**.

1. Kliknij **„Wgraj pliki"**. Otwiera się **okienko** — wcześniej wszystko działo się wprost
   na zakładce.
2. W okienku przeciągnij pliki na pole **„Przeciągnij pliki tutaj"** albo kliknij
   **„Wybierz pliki z dysku"**. Przyjmowane są **CSV i XLSX, do 50 MB każdy**.
3. Każdy dodany plik pojawia się na liście **„Wczytane pliki (N)"**. Przy nim zobaczysz:
   nazwę, rozmiar, liczbę wierszy i **wynik rozpoznania** — np. *„MO1 · wysoka pewność ·
   Nazwa pliku pasuje do wzorca"* albo *„Nie rozpoznano"*.
4. **Jeśli Bridge się pomylił — popraw ręcznie.** Obok każdej pozycji jest lista dostawców;
   wybierz właściwego. Przycisk **„Usuń"** wyrzuca pozycję z listy.
5. **„Dodaj kolejny plik"** dokłada następne pliki bez zamykania okienka.
6. Kliknij **„Importuj do staging"**.

⚠ **Przycisk NIE ma licznika.** Wcześniej pisało na nim „Wgraj (N)" i po udanym imporcie
pokazywał „Wgraj (0)" — to był błąd odbudowy, stary Bridge nigdy licznika tu nie miał.
**Brak liczby na przycisku jest poprawny, nie zgłaszaj tego.**

Przycisk **„Wyczyść"** czyści listę plików, ale **nie zamyka okienka**.

### 3.2 Ścieżka B — jeden plik, dostawca wymuszony

Karta **„Wgrywanie pojedyncze (z wymuszonym dostawcą)"** — **tej sekcji wcześniej w ogóle
nie było, instrukcja Iteracji 3 jej nie zna.**

Pod spodem jest siatka **kafli wszystkich dostawców**: kod, nazwa, e-mail i przycisk
**„Wgraj plik"**. Klikasz kafel wybranego dostawcy → otwiera się to samo okienko, ale
**z góry ustawionym dostawcą**, bez zgadywania po nazwie pliku.

**Do czego to służy:** gdy auto-detekcja się myli albo plik ma nietypową nazwę.

**Test wart zrobienia:** weź plik, który nazwą wskazuje na MO1, i wgraj go przez kafel **MO3**.
Pozycje mają wylądować pod **MO3** — wymuszenie ma wygrać z nazwą pliku.

⚠ **Kafle pokazują WSZYSTKICH dostawców, także MO6.** MO6 jest wyłączony z importu, więc
wgranie przez jego kafel skończy się odmową — **tak samo jak w starym Bridge**, który też
nie filtrował kafli. To nie jest błąd.

### 3.3 Co zobaczysz po imporcie

**Dymek (toast) w rogu ekranu.** Tytuł to albo *„N pozycji czeka na akceptację"*, albo
*„Import zakończony"* (gdy nic nie poszło do stagingu). Pod spodem podsumowanie — sklejone
kropkami, **pokazywane są tylko niezerowe pozycje**:

> Pozycji w plikach: N • Do akceptacji w stagingu: N • Nowe: N • Zmienione: N •
> Wycofane: N • Bez zmian: N • Odrzucone (nie opony): N • Pominięte pliki: N

**Sekcja „Ostatni import"** pod kaflami — pojawia się dopiero po pierwszym imporcie i pokazuje
wynik dla każdego pliku: *„Wczytano N pozycji · do stagingu: N · nowe: N · zmienione: N ·
wycofane: N · auto-zatwierdzone: N"*, a pod tym podgląd pierwszych pięciu pozycji.

⚠ **Podgląd jest PO imporcie, nie przed.** Stary Bridge pokazywał tabelkę podglądu **zanim**
zaimportował, bo parsował plik w przeglądarce. Odbudowa parsuje po stronie serwera, więc
podgląd mogła pokazać dopiero po. **To świadome odstępstwo, uzgodnione — nie zgłaszaj go.**

### 3.4 Co się dzieje, gdy coś pójdzie nie tak

| Sytuacja | Co zobaczysz | Co jest poprawne |
|---|---|---|
| Jeden z plików jest wadliwy (nie da się odczytać) | czerwony dymek **„Błąd pliku {nazwa}"** | **pozostałe pliki idą dalej**; pominięty plik liczy się w członie „Pominięte pliki: N" |
| Import pada na którymś pliku | czerwony dymek **„Błąd importu"** | **okienko ZOSTAJE otwarte, lista plików nie znika** — żebyś mogła spróbować ponownie. Pliki wgrane **przed** błędem **są już w stagingu** i mają być tam widoczne |
| Lista dostawców jest pusta | pusta siatka kafli, bez komunikatu | tak samo zachowuje się stary Bridge |

---

## 4. Staging — nowy domyślny filtr i przycisk „Kolumny"

**Gdzie:** `/staging`.

### 4.1 ⭐ Ekran startuje z filtrem „Nowe produkty"

To **najważniejsza zmiana** tego ekranu i najłatwiejsza do przeoczenia.

Filtr **„Typ sprawy"** ma teraz startowo wartość **„Nowe produkty"**, a nie „Wszystkie".
Pełna lista opcji: *Wszystkie · Nowe produkty · Nowe produkty (stare) · Wycofane ·
Zmiany kluczowe · Błędy importu*.

**Dlaczego to ma znaczenie:** przyciski **„Akceptuj wszystkie (N)"** i **„Odrzuć wszystkie (N)"**
działają **na tym, co przepuszcza filtr** — nie na całym stagingu. Przy domyślnym filtrze
licznik `N` pokazuje liczbę **nowych** pozycji i przycisk zatwierdza **tylko je**.

**Żeby ruszyć cały staging, musisz świadomie przestawić „Typ sprawy" na „Wszystkie".**

Tak działa stary Bridge — i to właśnie chroni przed zatwierdzeniem błędów importu i wycofań
jednym kliknięciem.

### 4.2 ⚠ Trzy kolumny są domyślnie UKRYTE

**„Stan", „Cena zakupu" i „Cena sprzedaży" nie są widoczne w tabeli.** Włączasz je przyciskiem
**„Kolumny"** w pasku narzędzi.

To **nie są zgubione kolumny** — w starym Bridge zachowują się dokładnie tak samo (jako jedyne
kolumny tabeli nie mają ustawionej domyślnej widoczności). Ale jeśli znasz tylko odbudowę,
zobaczysz różnicę i pomyślisz, że coś zniknęło.

**Domyślna kolejność nagłówków:** ☑ · Typ · Kod · Nazwa · Dostawca · Magazyn · Zmiana ·
Powód · Akcje.

### 4.3 Przycisk „Kolumny"

Klikasz **„Kolumny"** → otwiera się panel **„Widoczne kolumny (staging)"**:

- **trzy skróty:** **„Wszystkie"** (włącza wszystko z pierwszej sekcji), **„Domyślne"**
  (przywraca stan startowy — **razem z sekcją „Dodatkowe"**), **„Żadna"** (chowa wszystko,
  co da się schować),
- sekcja **„W tabeli stagingu"** — **10 przełączników** (7 włączonych, 3 wyłączone: Stan,
  Cena zakupu, Cena sprzedaży),
- sekcja **„Dodatkowe (z katalogu)"** — **49 przełączników**.

⚠ **Sekcja „Dodatkowe" nic nie robi i tak ma być.** Panel sam to pisze: *„Te kolumny nie są
jeszcze wyświetlane w tabeli stagingu."* Przełączniki zapisują się, ale tabela ich nie pokazuje —
**dokładnie tak jak w starym Bridge**, gdzie ta sekcja też była martwa. Nie zgłaszaj tego.

Ustawienia kolumn **zapamiętują się w przeglądarce**. ⚠ Jeśli kiedyś dojdzie nowa kolumna,
w Twojej zapisanej konfiguracji będzie ukryta, dopóki nie klikniesz **„Domyślne"** — tak samo
działał stary Bridge.

### 4.4 Pasek narzędzi — co gdzie jest

- **W nagłówku** (nad paskiem): **„Akceptuj wszystkie (N)"** i **„Odrzuć wszystkie (N)"**.
  Są widoczne zawsze, a `N` odpowiada **aktualnemu filtrowi**. **Pytają o potwierdzenie** —
  np. *„Zaakceptować wszystkie pasujące pozycje (N)?"*.
- **W pasku, od lewej:** szukajka → napis „Typ sprawy" i lista → licznik *„N zmian"*.
- **Po prawej:** **„Akceptuj zaznaczone (N)"** i **„Odrzuć zaznaczone (N)"** — **pokazują się
  dopiero, gdy zaznaczysz przynajmniej jedną pozycję** (wcześniej wisiały tam zawsze);
  dalej **„Kolumny"**, **„Akceptuj widoczne"** i **„Odrzuć widoczne"** (bez licznika).
- **Placeholder szukajki:** *„Szukaj po kodzie, nazwie, dostawcy lub EAN..."* — cztery pola,
  po których backend naprawdę szuka.

⚠ **„Zaznaczone" i „widoczne" NIE pytają o potwierdzenie** — działają od razu. Pytają tylko
warianty „wszystkie". Tak jest w oryginale.

---

## 5. Karta dostawcy — „Synchronizuj", „Wgraj plik", częstotliwość

**Gdzie:** Konfiguracja → zakładka **Dostawcy**.

### 5.1 Przycisk nazywa się „Synchronizuj"

Nie **„Synchronizuj teraz"**. Etykieta została sprawdzona w żywym bundlu produkcji — stary
Bridge mówi „Synchronizuj". Podczas pobierania przycisk pokazuje *„Synchronizuję…"*.

⚠ **Instrukcja Iteracji 3 używa starej nazwy w dziewięciu miejscach.** To ta sama akcja —
patrz rozdział 10.

Bez zmian zostaje: **przycisk jest tylko przy dostawcach `url`.** Przy MO1, MO7, MO8 i MO10
(`mail`) go nie ma i tak ma być.

### 5.2 Nowy przycisk „Wgraj plik"

Pojawia się przy dostawcach o sposobie dostarczania **`upload`** i **`mail`** — czyli tam,
gdzie nie ma URL-a do pobrania. **Instrukcja Iteracji 3 tego przycisku nie zna.**

- Przyjmuje pliki **`.csv`, `.xml`, `.xlsx`**.
- Po udanym wgraniu pokazuje dymek **„Plik wczytany"** z treścią
  *„N produktów, N nowych, N zmienionych"*.
- Przy błędzie: dymek **„Błąd"** z treścią komunikatu.
- W trakcie wgrywania przycisk **„Synchronizuj"** też jest zablokowany — to jeden wspólny
  stan zajętości, jak w oryginale.

⚠ **Tu odbudowa jest LEPSZA od produkcji — celowo.** Żywy Bridge pokazuje w tym dymku
*„undefined nowych, undefined zmian"*, bo czyta pola, których serwer nigdy nie odsyłał.
Naprawiliśmy to w odbudowie. **Jeśli porównujesz z produkcją i widzisz różnicę — odbudowa ma
rację.** Ten błąd nadal siedzi w produkcji i warto go u siebie poprawić.

### 5.3 Pole „liczba minut" jest teraz schowane

Częstotliwość wybierasz z listy gotowych wartości (5 min, 15 min, 30 min, 1 godz., 2 godz.,
4 godz., 6 godz., 12 godz., 1 dzień, 2 dni, 7 dni).

**Pole na wpisanie własnej liczby minut pojawia się dopiero po wybraniu opcji
„Inna wartość (minuty)…"** — wcześniej w odbudowie wisiało od razu obok listy.
**Instrukcja Iteracji 3 (§3.12) opisuje stary układ i jest w tym miejscu nieaktualna.**

⚠ **Po przełączeniu z gotowej wartości na „Inna wartość" pole jest PUSTE** — nie przepisuje
tam poprzedniej liczby. To odtworzone ze starego Bridge 1:1. Dzięki temu da się jawnie
wyczyścić harmonogram. **Nie zgłaszaj pustego pola jako błędu.**

---

## 6. Co PRZESTAŁO być dziwactwem — dwie rzeczy naprawione

Na Twojej liście „dziwactw odtworzonych celowo" były dwie pozycje, które **już nie obowiązują**.
Naprawiłaś je u siebie **1 września**, a odbudowa wciągnęła Twoją poprawkę i **potwierdziła ją
pomiarem** (2026-09-08).

### 6.1 ✅ WULSTBAND już nie trafia do stagingu jako opona

Taśma obręczy (WULSTBAND) z Bohnenkampa i Agrorami była importowana jako opona. Twoja poprawka
z 1 września (filtr akcesoriów przestał rozróżniać wielkość liter) jest w odbudowie.

**Pomiar:** dla MO1 licznik `odrzuconePrzezAdapter` spadł **z 1 na 0** przy tych samych
**199 kodach** — rekord jest teraz odrzucany już w parserze, a nie dopiero w adapterze.

**Co sprawdzić:** wgraj cennik Bohnenkampa (MO1) i przejrzyj staging — **żadnego WULSTBAND-a**.

### 6.2 ✅ NRO i CHO to „Tak" albo puste pole, nie 0/1

Oznaczenia NRO i CHO zapisywały się jako `0`/`1`, podczas gdy wszystkie pozostałe flagi miały
już „Tak"/pusto. Twoja poprawka z 1 września jest w odbudowie.

**Pomiar:** `1` → **„Tak"**, `0` → **puste pole**; dotknęło **MO1 199, MO3 44 i MO9 12 rekordów**.

**Co sprawdzić:** w Katalogu spójrz na kolumny NRO i CHO — mają być „Tak" albo pusto,
**nigdzie zera ani jedynki**.

> Obie te pozycje **wykreśl ze swojej listy dziwactw** — są zamknięte.

---

## 7. Co ZOSTAJE dziwactwem — status dostawcy

**To dalej działa tak, jak opisywała instrukcja Iteracji 3 (§4 pkt 11) — nic się nie zmieniło.**

Ustawiasz status **wstrzymany**, zapisujesz — a karta dalej pokazuje *aktywny* albo *błąd*.
Bridge (stary i nowy tak samo) **wylicza status wyświetlany na bieżąco** i nadpisuje nim to,
co zapisałaś:

| Sytuacja dostawcy | Co pokaże karta |
|---|---|
| ostatni import udany, są produkty w katalogu | *aktywny* |
| ostatni import udany, zero produktów w katalogu | *błąd* |
| ostatni import ponad **30 dni** temu | *wstrzymany* |
| nigdy nic nie zaimportował | *wstrzymany* |
| nigdy nic nie zaimportował, ale ma produkty | Twoja wartość z pola **Status** |

**Twoje wstrzymanie mimo to DZIAŁA** — jest zapisane i to ono, a nie napis na karcie, blokuje
automatyczne pobieranie. Ręczne **„Synchronizuj"** przechodzi mimo wstrzymania i tak ma być.

### ⏳ Twoja prośba czeka na decyzję

Poprosiłaś, żeby karta pokazywała **dwa pola osobno**: Twoje ustawienie ręczne i wyliczony
status techniczny — zamiast jednego, w którym jedno nadpisuje drugie.

**To jest zapisane i czeka na decyzję** (pozycja #18 w naszym rejestrze zmian). **Nie mieści
się w Iteracji 14** — zmienia zachowanie, które dziś jest odtworzone 1:1, więc wymaga
osobnego ustalenia. **Nie zgłaszaj tego ponownie jako błędu** — wiemy o tym.

---

## 8. Zmiana zatwierdzona, ale jeszcze NIE wdrożona

### EAN zapisany w notacji naukowej

Na liście dziwactw był komunikat **„zapis naukowy ma tylko null cyfr znaczących"** — dziwaczna
wiadomość biorąca się z błędu w starym Bridge (funkcja licząca cyfry została przesłonięta inną
o tej samej nazwie).

**18 września zdecydowałaś, że taki EAN ma trafiać do katalogu jako PUSTE pole** — zamiast
komunikatu i zamiast zepsutej wartości.

⚠ **Ta zmiana NIE JEST jeszcze wdrożona.** Karta, która ma ją zrobić (14i), jest zaplanowana,
ale nie zrealizowana.

**Czego się spodziewać podczas testów:** komunikat *„zapis naukowy ma tylko null cyfr
znaczących"* **nadal się pojawia** i nadal wygląda identycznie jak w produkcji.
**To nie jest regres — to stan przed wdrożeniem Twojej decyzji.** Nie zgłaszaj go.

---

## 9. ⭐ Test rozstrzygający — NIEWYKONANY

**To najcenniejszy test całej instrukcji i wciąż nie został zrobiony.**

**Na czym polega:** wgrać **ten sam plik cennika** do starego Bridge i do odbudowy, a potem
porównać **liczbę pozycji**, które z niego weszły. Jeśli liczby się zgadzają dla wszystkich
dostawców — parsery i klasyfikator odtworzyliśmy wiernie. Jeśli się nie zgadzają, to najszybszy
sposób, żeby to wykryć, zanim przejdziemy na nową wersję.

**Stan na dziś:**

| Dostawca | Stary Bridge | Odbudowa | Zgodność | Uwaga |
|---|---|---|---|---|
| MO1 Bohnenkamp | — | — | ⚠ **„na oko, bez liczb"** | jedyny sprawdzany; **wymaga powtórzenia z liczbami** |
| MO2 | — | — | ❌ **nieporównane** | |
| MO3 | — | — | ❌ **nieporównane** | |
| MO4 | — | — | ❌ **nieporównane** | |
| MO5 | — | — | ❌ **nieporównane** | |
| MO6 Uniglory | — | — | **nie dotyczy** | wyłączony z importu |
| MO7 | — | — | ❌ **nieporównane** | |
| MO8 Trelleborg | — | — | ❌ **nieporównane** | plik XLSX **i** CSV |
| MO9 Agrorami | — | — | ⛔ **niewykonalne** | dane z API, **nie ma pliku** do wgrania do obu wersji |
| MO10 GRI | — | — | ❌ **nieporównane** | plik XLSX |

**Jak go zrobić:** dla każdego dostawcy weź **jeden i ten sam plik**, wgraj go do starego
Bridge i do https://test.agritires.eu, a potem wpisz do tabeli **dwie liczby** — ile pozycji
wykazał każdy. Liczbę bierz z podsumowania importu (człon *„Pozycji w plikach"* i
*„Do akceptacji w stagingu"*), nie „na oko".

⚠ **Ten rozdział ma zostać w instrukcji, dopóki tabela nie będzie wypełniona liczbami.**

---

## 10. Co jest NIEAKTUALNE w instrukcji Iteracji 3

Instrukcja `instrukcja-testow-I3.md` **zostaje bez zmian** — nie trzeba jej poprawiać ani
czytać na nowo. Poniżej lista miejsc, w których **wierz tej kartce, nie tamtej**.

| Gdzie w Iteracji 3 | Co przestało być prawdą |
|---|---|
| **§2 Przygotowanie**, kroki 2–5 | opisują **stary przepływ**: „kliknij pole wyboru pliku" wprost na zakładce i przycisk **„Wgraj"**. Dziś: „Wgraj pliki" → okienko → „Importuj do staging". Aktualny opis: **rozdział 3 tutaj** |
| **§2**, „Oczekiwane" | obiecuje podgląd 5 pozycji **przy pliku** — dziś jest w sekcji **„Ostatni import"** pod kaflami, patrz **3.3** |
| **§2** | nie zna sekcji **„Wgrywanie pojedyncze"** (kafle dostawców) — patrz **3.2** |
| **§2**, ramka „Czego tu jeszcze nie ma" | mówi, że zakładki *Spedycja*, *Shoper*, *Katalog* i *AI Fallback* są **puste** — **już nie są**, patrz **rozdział 11** |
| **§3.1 Lista pozycji** i **§6 Lista kontrolna** | mówią o liście „z kompletem kolumn" — dziś **Stan, Cena zakupu i Cena sprzedaży są ukryte**, patrz **4.2** |
| **§3.2 Filtr i wyszukiwarka** | każe „wrócić na **Wszystkie**" po sprawdzeniu filtra „Błędy importu" — to **już nie jest powrót do stanu startowego**, bo ekran startuje na „Nowe produkty", patrz **4.1** |
| **§3.10, §3.11, §3.12, §3.13, §4 pkt 11, §6** | nazywają przycisk **„Synchronizuj teraz"** (9 miejsc) — dziś **„Synchronizuj"**, patrz **5.1** |
| **§3.12 Zmiana częstotliwości** | opisuje pole „liczba minut" jako widoczne od razu obok listy — dziś schowane za **„Inna wartość (minuty)…"**, patrz **5.3** |
| **§4 Rzeczy, które WYGLĄDAJĄ na błąd** | nie zna przycisku **„Wgraj plik"** na karcie dostawcy, patrz **5.2** |
| **§5 Czego jeszcze NIE MA** | w większości **nieaktualny** — historia, alerty, atrybuty, analityka, narzuty i promocje oraz zakładki Konfiguracji **są dowiezione**. Aktualna lista: **rozdział 11 tutaj** |
| **całość** | nie zna testu rozstrzygającego z **rozdziału 9** |

Pozycje **§4 pkt 4** („zapis naukowy") i **§4 pkt 11** (status dostawcy) **dalej obowiązują** —
patrz rozdziały 8 i 7.

---

## 11. Czego jeszcze NIE MA

Zweryfikowane wobec tablicy postępu — **wszystkie ekrany produkcji mają już swój odpowiednik**
w odbudowie (Katalog, Staging, Konfiguracja, Historia, Narzuty, Alerty, Atrybuty, Waga
gabarytowa, Analityka, Selly, Moje konto, Pulpit). Braki są **wewnątrz** ekranów:

| Czego brakuje | Kiedy |
|---|---|
| **Daty promocji** — silnik cen nalicza promocję **niezależnie od dat obowiązywania** | druga fala Iteracji 14 (karta 14f) — decyzja podjęta, jeszcze nie zrobione |
| **EAN w notacji naukowej → puste pole** | druga fala Iteracji 14 (karta 14i) — patrz rozdział 8 |
| **Status dostawcy w dwóch polach** (ręczny + wyliczony) | czeka na decyzję, patrz rozdział 7 |
| **Nowa synchronizacja z Selly przez REST** (`sync_full`, warianty magazynów) | świadomie odłożone, aż ustabilizuje się u Ciebie — panel Selly działa jak dotąd |
| Lista „cena na zapytanie" i powody wstrzymania | nie planowane w tej fali |

**Już NIE są brakami** (a instrukcja Iteracji 3 tak je wymienia): automatyczne pobieranie
cenników, narzuty i promocje, Historia, Alerty, Atrybuty, Analityka i pulpit, zakładki
Konfiguracji (Spedycja, Shoper, Katalog, AI Fallback).

---

## 12. Szybka lista kontrolna

**Wgrywanie ręczne**

- [ ] „Wgraj pliki" otwiera **okienko**, nie formularz na zakładce
- [ ] Na przycisku importu **nie ma licznika** („Importuj do staging", nie „Wgraj (0)")
- [ ] Pod spodem jest sekcja **„Wgrywanie pojedyncze"** z kaflami dostawców
- [ ] ⭐ Plik o nazwie wskazującej MO1, wgrany przez **kafel MO3**, ląduje pod **MO3**
- [ ] Po imporcie pokazuje się **dymek** z podsumowaniem, a pod kaflami **„Ostatni import"**
- [ ] Plik XLSX (MO8 / MO10) też się wgrywa
- [ ] Po błędzie importu **okienko zostaje otwarte**, a pliki wgrane wcześniej są w stagingu

**Staging**

- [ ] ⭐ Ekran startuje na filtrze **„Nowe produkty"**
- [ ] Licznik przy „Akceptuj wszystkie (N)" zmienia się razem z filtrem
- [ ] „Akceptuj/Odrzuć **zaznaczone**" pokazują się dopiero **po zaznaczeniu** pozycji
- [ ] „Akceptuj/Odrzuć **wszystkie**" **pytają o potwierdzenie**
- [ ] Przycisk **„Kolumny"** włącza ukryte „Stan", „Cena zakupu", „Cena sprzedaży"
- [ ] Skrót **„Domyślne"** przywraca stan startowy

**Karta dostawcy**

- [ ] Przycisk nazywa się **„Synchronizuj"**
- [ ] Przy dostawcach `upload`/`mail` jest przycisk **„Wgraj plik"**
- [ ] Dymek po wgraniu pokazuje **liczby**, nie „undefined"
- [ ] Pole minut odsłania się dopiero po **„Inna wartość (minuty)…"** i jest wtedy **puste**

**Naprawione dziwactwa**

- [ ] W stagingu po imporcie MO1 **nie ma WULSTBAND-a**
- [ ] W Katalogu kolumny **NRO/CHO** pokazują „Tak" albo pusto, **nigdzie 0/1**

**Test rozstrzygający**

- [ ] ⭐ Tabela z rozdziału 9 wypełniona **liczbami** dla MO1–MO5, MO7, MO8, MO10

---

## 13. Jak zgłaszać problemy

**Zanim zgłosisz — sprawdź rozdziały 6, 7 i 8.** Trzy najczęstsze fałszywe alarmy tej iteracji:

1. brak licznika na przycisku importu (**tak ma być**, rozdział 3.1),
2. brak kolumn „Stan"/„Cena zakupu"/„Cena sprzedaży" w stagingu (**są ukryte**, rozdział 4.2),
3. komunikat o „zapisie naukowym" (**decyzja podjęta, wdrożenie czeka**, rozdział 8).

**Co dopisać do zgłoszenia:**

- **gdzie** — ekran i sekcja (np. „Konfiguracja → Wgrywanie ręczne, okienko"),
- **co kliknęłaś** i **co się stało** zamiast tego, czego się spodziewałaś,
- **zrzut ekranu** — przy dymkach (toastach) szczególnie, bo znikają,
- **który plik** wgrywałaś (nazwa i dostawca), jeśli rzecz dotyczy importu,
- czy to samo dzieje się **w starym Bridge** — jeśli tak, to prawdopodobnie odtworzyliśmy
  zachowanie celowo i wystarczy, że dasz znać, czy chcesz to zmienić.
