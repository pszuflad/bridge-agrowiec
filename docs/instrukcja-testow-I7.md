# Iteracja 7 (Atrybuty) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-04

> **To jest STAGING, nie produkcja.** Cokolwiek tu ustawisz albo zepsujesz — produkcji nie
> dotyka. Testuj bez skrupułów.

> **⚠ Jedna rzecz do przeczytania ZANIM zaczniesz.** Dwie akcje w kolejce „Do akceptacji"
> (**Edytuj** i **kliknięcie w podpowiedź aliasu**) **przepisują pole w całym katalogu naraz** —
> jednym kliknięciem możesz zmienić markę albo bieżnik w kilkuset produktach. Nie da się tego
> cofnąć przyciskiem i **nie zostaje po tym ślad w historii zmian**. Na stagingu to bez znaczenia
> (danych i tak nie szkoda), ale warto o tym wiedzieć, zanim ta sama funkcja trafi na produkcję.
> Widok ostrzega przed każdą taką zmianą i podaje liczbę produktów — sekcja 3.11 i 3.12.

---

## 1. Co dowozi Iteracja 7

Trzy rzeczy, w trzech różnych miejscach panelu:

1. **Nowy widok „Atrybuty"** (menu po lewej) — słownik wartości używanych w całej aplikacji
   (marki, kategorie, bieżniki, konstrukcje…) plus **kolejka „Do akceptacji"**: lista wartości,
   które przyszły z importów dostawców, a których jeszcze nie ma w słowniku. Do tej pory ten
   ekran w starym Bridge był łatany osobnym skryptem doklejanym z boku — teraz jest normalną,
   pełnoprawną częścią aplikacji.
2. **Listy wyboru w regułach cen** (*Narzuty i promocje* → dodaj regułę) czytają ten słownik.
   Najważniejszy skutek: **da się założyć regułę na kategorię, której nie ma jeszcze żaden
   produkt** — wcześniej było to niemożliwe.
3. **Filtry w Katalogu** (marka, kategoria) też czytają ten słownik, więc pokazują też wartości,
   których nie ma jeszcze na żadnym produkcie.

**Skala danych, które zobaczysz** (staging to snapshot produkcji): **15 rodzajów**,
**ok. 5100 wartości** w słowniku i **ok. 500 pozycji** w kolejce „Do akceptacji".

**Sedno do sprawdzenia — cztery rzeczy:**

1. **Słownik da się realnie edytować** — dodać, poprawić i usunąć wartość, a zmiana przeżywa
   odświeżenie strony (czyli zapisuje się na serwerze, a nie w przeglądarce).
2. **Kolejka „Do akceptacji" ma cztery różne akcje i one robią RÓŻNE rzeczy** — to jest
   najtrudniejsza i najważniejsza część tej iteracji (sekcja 3.10–3.13).
3. **„Wyczyść pending" to schowanie, nie odrzucenie** — wartości wrócą przy następnym imporcie.
4. **Słownik widać w trzech miejscach naraz** — dodana wartość ma się pojawić także w regułach
   cen i w filtrach katalogu, bez przeładowywania panelu.

---

## 2. Zanim zaczniesz — skąd się bierze kolejka

Kolejka **nie zapełnia się sama z niczego**. Wypełnia ją import: kiedy **zatwierdzasz** pozycje
w widoku *Staging*, system przegląda, jakie nowe marki, bieżniki i kategorie przyszły od
dostawców, i wrzuca do kolejki te, których nie ma w słowniku.

Na stagingu kolejka powinna już być pełna (snapshot produkcji, ok. 500 pozycji) — wejdź na
**Atrybuty** i spójrz na odznakę przy przycisku **Do akceptacji**. Jeśli pokazuje **0**, znaczy
że ktoś ją wcześniej wyczyścił; żeby ją odbudować, wystarczy zatwierdzić dowolny import
w *Stagingu* (patrz [instrukcja I3](instrukcja-testow-I3.md), sekcja o zatwierdzaniu).

**Nie ma i nie będzie przycisku „Skanuj kolejkę"** — w starym Bridge też go nie ma, skanowanie
dzieje się samo przy zatwierdzaniu importu.

---

## 3. Scenariusze — po kolei

Zaczynamy od menu po lewej → **Atrybuty**.

### 3.1 Pierwsze wejście — kafle rodzajów

Powinnaś zobaczyć:

- pasek u góry: **„● Zsynchronizowane z DB"** oraz liczby, np. *„15 rodzajów, 5144 wartości"*,
  i przycisk **Odśwież**;
- **kafle** — po jednym na rodzaj (Marka, Kategoria, Bieżnik, Konstrukcja…), każdy z opisem,
  dużą liczbą wartości i etykietką **wbudowany** albo **własny**;
- trzy przyciski u góry po prawej: **Do akceptacji** (z odznaką liczby), **Nowy rodzaj**,
  **Dodaj wartość**.

**Sprawdź:** liczba na kaflu *Marka* to liczba marek w słowniku, a nie liczba produktów.

> Jeśli pod kaflami zobaczysz sekcję **„Sieroty w DB"** — to nie błąd. Tak wygląda sytuacja,
> w której w bazie są wartości przypisane do rodzaju, którego nie ma na liście rodzajów.

### 3.2 Wejście w rodzaj — lista wartości

Kliknij kafel **Kategoria**.

- otwiera się lista wartości tego rodzaju, posortowana po polsku (ogonki na właściwych
  miejscach: *Ć* przy *C*, nie na końcu);
- u góry pole **„Nowa wartość dla…"** z przyciskiem **+ Dodaj**, niżej **szukajka** i licznik
  **„Wyświetlono: N"**;
- każdy wiersz ma trzy przyciski: **Podgląd**, **Edytuj**, **Usuń**;
- przycisk **← Wróć do kafli** wraca do siatki.

**Sprawdź:** wpisz w szukajkę fragment nazwy — lista i licznik mają się zawęzić od razu,
bez klikania czegokolwiek.

### 3.3 Dodanie wartości

W rodzaju **Kategoria** wpisz w pole u góry `Quady testowe` i kliknij **+ Dodaj**
(albo naciśnij Enter — działa tak samo).

- na dole wyskakuje potwierdzenie **„Dodano: Quady testowe"**;
- wartość pojawia się na liście, licznik na kaflu rośnie o 1;
- **naciśnij F5** — wartość ma tam nadal być. To sprawdza, że zapis poszedł na serwer.

**Sprawdź jeszcze:** kliknij **+ Dodaj** z pustym polem — ma pojawić się komunikat
**„Wpisz wartość"** i nic więcej się nie dzieje.

### 3.4 Edycja wartości

Przy `Quady testowe` kliknij **Edytuj**. Otworzy się okienko z wpisaną obecną wartością.

- zmień na `Quady testowe XL` i zapisz → komunikat **„Zmieniono: Quady testowe → Quady testowe XL"**;
- **spróbuj drugi raz i nie zmieniaj nic** — po prostu zapisz. Okno ma się zamknąć i **nic
  nie ma się wydarzyć** (żadnego komunikatu o zapisie). Tak ma być.

**Sprawdź duplikat:** spróbuj zmienić nazwę na wartość, która już w tym rodzaju istnieje
(np. `Rolnicze`). Powinnaś dostać czerwony komunikat **„Błąd: Taka wartość już istnieje dla
tego rodzaju"**.

### 3.5 Usunięcie wartości

Przy `Quady testowe XL` kliknij **Usuń**.

- pojawia się pytanie **„Usunąć wartość »Quady testowe XL« z rodzaju »kategoria«?"** —
  samo kliknięcie **Usuń** w wierszu jeszcze niczego nie kasuje;
- **Anuluj** → nic się nie dzieje;
- **Usuń** → komunikat „Usunięto…", wiersz znika, licznik na kaflu spada.

### 3.6 ⭐ Podgląd — „Produkty używające atrybutu"

W rodzaju **Marka** znajdź markę, która na pewno jest w katalogu (np. **BKT**) i kliknij
**Podgląd**.

- otwiera się okno z tabelą: Dostawca, Kod, Nazwa, Marka, Rozmiar, Stan;
- u góry napis **„Znaleziono N produkt(ów)"**.

**Najważniejsze:** jeśli produktów jest więcej niż 200, napis ma brzmieć
**„Znaleziono 954 produkt(ów) (pokazano pierwsze 200)"**. Liczba przed nawiasem to **pełna**
liczba, lista jest ucięta — i widok ma to mówić wprost, a nie udawać, że produktów jest 200.

**Sprawdź też:** podgląd wartości, której nie używa żaden produkt, ma dać komunikat
*„Żaden produkt w katalogu nie używa tej wartości atrybutu."*, a nie pustą tabelę.

### 3.7 Nowy rodzaj

Kliknij **Nowy rodzaj**, wpisz nazwę `Sezon`, opis `Letnie, Zimowe, Całoroczne`, zatwierdź
**Utwórz rodzaj**.

- komunikat **„Rodzaj dodany"**, nowy kafel pojawia się w siatce z etykietką **własny**;
- **naciśnij F5 — kafel ma tam nadal być.**

> ⚠ **To jest miejsce, w którym nowa wersja celowo różni się od starej.** W starym Bridge ten
> przycisk **nie zapisywał rodzaju na serwerze** — rodzaj znikał po odświeżeniu strony, choć
> panel pokazywał komunikat, że został dodany. Uznaliśmy to za usterkę, nie za funkcję.
> Jeśli więc pamiętasz, że „nowe rodzaje znikały" — teraz nie powinny.

**Sprawdź:** kliknij **Utwórz rodzaj** z pustą nazwą → komunikat **„Brak nazwy"**.

### 3.8 Dodanie wartości do nowego rodzaju jednym ruchem

Kliknij **Dodaj wartość**. W polu **Rodzaj** możesz wpisać dowolną nazwę (podpowiedzi
z istniejących rodzajów są pod strzałką), w polu **Wartość** — wartość.

Wpisz rodzaj `Sezon`, wartość `Zimowe`, zatwierdź. Wartość ma trafić do rodzaju *Sezon*.

> Jeśli wpiszesz rodzaj, którego jeszcze nie ma — zostanie założony automatycznie, a dopiero
> potem dodana wartość. Identyfikator rodzaju powstaje z nazwy bez polskich znaków
> (np. `Opona zimowa` → `opona_zimowa`) — to normalne, nazwa wyświetlana zostaje z ogonkami.

### 3.9 ⭐ Kolejka „Do akceptacji" — pierwsze wejście

Kliknij przycisk **Do akceptacji** u góry.

- odznaka przy przycisku pokazuje liczbę pozycji (ok. 500);
- tabela ma kolumny: **Rodzaj · Wartość · Wystąpień · Sugerowane aliasy · Akcje**;
- nad tabelą: filtr **Rodzaj** z licznikami, szukajka i napis **„Wyświetlono: X z Y"**;
- po prawej dwa przyciski czyszczące (o nich w 3.14).

**Uwaga na czas ładowania:** kolejka potrafi ładować się kilka sekund. To nie jest zacięcie
przeglądarki — serwer dla **każdej** z ~500 pozycji porównuje ją z całym słownikiem danego
rodzaju (dla marek to tysiące porównań), żeby wyliczyć podpowiedzi aliasów.

**Kolumna „Wystąpień"** to liczba produktów w katalogu z tą wartością — **jest klikalna**
i otwiera to samo okno co **Podgląd** z sekcji 3.6.

**Kolumna „Sugerowane aliasy"** pokazuje do **pięciu** podobnych wartości, które już są
w słowniku, z procentem podobieństwa — np. *AGRISTAR II (92%)*. Jeśli nic nie jest podobne,
zobaczysz *brak podobnych*.

### 3.10 ⭐ Akceptuj — najprostszy wariant

Wybierz pozycję i kliknij **Akceptuj**.

- komunikat **„Zaakceptowano: …"**, pozycja znika z kolejki;
- wartość pojawia się w słowniku (sprawdź: wróć do kafli, wejdź w ten rodzaj, poszukaj jej);
- **produkty w katalogu NIE zmieniają się** — nic nie jest przepisywane.

To jest wariant „ta wartość jest w porządku, po prostu jej jeszcze nie było w słowniku".

### 3.11 ⭐ Akceptuj z edycją — TO ZMIENIA KATALOG

Kliknij **Edytuj** przy dowolnej pozycji.

- otwiera się okno z obecną wartością do poprawienia;
- **pod polem jest ostrzeżenie**: *„Zmiana przepisze pole **bieznik** w **186** produktach
  katalogu. Operacji nie da się cofnąć ani odtworzyć z dziennika…"* — liczba ma odpowiadać
  temu, co pokazuje kolumna *Wystąpień*;
- popraw wartość (np. literówkę) i zapisz;
- komunikat **„Zapisano: …"** plus druga linia **„Zaktualizowano produktów: 186"**.

**Sprawdź, że to naprawdę zadziałało:** wejdź w Katalog i poszukaj któregoś z tych produktów —
ma mieć nową wartość.

To jest wariant „ta wartość jest zapisana błędnie i chcę ją poprawić **wszędzie**".

### 3.12 ⭐ Alias — kliknięcie w podpowiedź

W kolumnie **Sugerowane aliasy** kliknij podpowiedź (np. *AGRISTAR II (92%)*).

- pytanie **„Zmapować »AGRI STAR II« jako alias dla »AGRISTAR II«?"** plus to samo ostrzeżenie
  o liczbie produktów i zdanie, że **do słownika nie trafi nic**;
- po zatwierdzeniu: komunikat **„Alias: AGRI STAR II → AGRISTAR II"** i liczba zmienionych
  produktów.

**Co ma się stać:** produkty dostają wartość **kanoniczną** (tę z podpowiedzi), a pozycja znika
z kolejki. **Do słownika nie dochodzi nowa wartość** — bo uznałaś, że to był tylko inny zapis
tej samej rzeczy.

> ⚠ **Mapowanie nigdzie nie zostaje zapisane.** Nie ma listy aliasów do podejrzenia — jeśli
> ta sama błędna pisownia przyjdzie w kolejnym imporcie, wróci do kolejki i trzeba będzie
> kliknąć jeszcze raz. Tak działa stary Bridge i tego nie zmienialiśmy.

To jest wariant „to jest literówka istniejącej wartości, a nie nowa wartość".

### 3.13 Odrzuć

Kliknij **Odrzuć**. Możesz podać powód (**wolno zostawić puste**).

- komunikat **„Odrzucono: …"**, pozycja znika;
- wartość trafia na listę odrzuconych i **kolejne skany będą ją pomijać** — czyli nie wróci
  do kolejki przy następnym imporcie.

To jest wariant „to jest śmieć z pliku dostawcy i nie chcę go już nigdy widzieć".

### 3.14 ⭐ „Wyczyść pending" — to jest SCHOWANIE, nie odrzucenie

Dwa przyciski po prawej nad tabelą:

- **Wyczyść pending: <rodzaj>** — działa dopiero po wybraniu konkretnego rodzaju w filtrze
  (wcześniej jest szary i pokazuje kreskę);
- **Wyczyść wszystkie pending (N)**.

Kliknij ten drugi. Pytanie ma **wprost** mówić:

> *„UWAGA: to nie jest trwałe odrzucenie — jeśli te same wartości pojawią się w kolejnym
> imporcie, wrócą tutaj do ponownej akceptacji."*

**Sprawdź, że tak jest.** To rozróżnienie jest łatwe do przeoczenia, a różnica jest duża:
**Odrzuć** (3.13) zapamiętuje decyzję na stałe, **Wyczyść** tylko sprząta ekran.

### 3.15 Filtr rodzaju i szukajka w kolejce

- wybierz rodzaj w filtrze → tabela i napis „Wyświetlono: X z Y" zawężają się;
- wpisz fragment w szukajkę → zawęża się dalej;
- po wyczyszczeniu kolejki dla wybranego rodzaju filtr wraca sam na **Wszystkie**.

### 3.16 ⭐ Reguła cenowa na kategorię, której nie ma w katalogu

Idź do **Narzuty i promocje** → **Dodaj regułę**.

W warunku zostaw typ **Kategoria** i rozwiń listę wartości. **Powinna tam być kategoria, którą
dodałaś w sekcji 3.3** — mimo że nie ma jej na żadnym produkcie.

Załóż na nią regułę i zapisz. To jest funkcja, której wcześniej nie było: reguła „przygotowana
na zapas", zanim towar z tej kategorii w ogóle trafi do katalogu.

**Sprawdź też przy okazji:**

- typ **Dostawca** pokazuje pozycje w formie **`MO1 · Bohnenkamp`** (kod i nazwa);
- typy **Konstrukcja** i **VF / IF** to teraz **listy wyboru**, a nie pola do wpisania tekstu.

### 3.17 ⭐ Filtry w Katalogu widzą słownik

Idź do **Katalog** i rozwiń filtr **Marka**.

Powinna tam być marka dodana w słowniku, **nawet jeśli nie ma jej na żadnym produkcie**
(dodaj sobie taką w Atrybutach, jeśli nie masz pod ręką). Po jej wybraniu lista produktów
będzie oczywiście pusta — i o to chodzi: filtr pokazuje pełen słownik, a nie tylko to,
co akurat jest w magazynie.

### 3.18 Słownik odświeża się we wszystkich trzech miejscach

Bez przeładowywania panelu (bez F5):

1. dodaj nową kategorię w **Atrybutach**;
2. przejdź do **Narzuty i promocje** → dodaj regułę → rozwiń listę kategorii — ma tam być;
3. przejdź do **Katalogu** → filtr kategorii — też ma tam być.

---

## 4. ⚠ Rzeczy, które WYGLĄDAJĄ na błąd, a są poprawne

1. **Pozycja w kolejce podpowiada samą siebie ze 100%.** Zobaczysz np. *AGRI STAR II* z
   podpowiedzią *AGRI STAR II (100%)*. Powód: słownik bieżników został zasiany z **nazw modeli**
   produktów, a nie z pola „bieżnik", więc ta sama wartość jest jednocześnie w słowniku
   i w kolejce. To zastana usterka starego Bridge, odtworzona świadomie — jest zapisana
   do decyzji, czy ją naprawiać.

2. **„BKT" i „bkt" nie podpowiadają się nawzajem.** Porównywarka podobieństwa nie zrównuje
   wielkich i małych liter, więc wartości różniące się tylko wielkością liter mają podobieństwo
   zero i zobaczysz przy nich *brak podobnych*. Też zastane i zapisane do decyzji.

3. **Podpowiedzi jest najwyżej pięć**, nawet jeśli podobnych wartości jest więcej. Pokazywane
   są te najbardziej podobne.

4. **Przy rodzajach „model" i „zastosowanie" akcje Edytuj i alias mogą zwrócić błąd
   „Nieznany rodzaj".** Te dwa rodzaje trafiają do kolejki, ale mechanizm przepisywania
   produktów ich nie obsługuje — dwie listy w starym kodzie się rozjechały. Sama akcja
   **Akceptuj** działa. Zastane, zapisane do decyzji.

5. **Nie ma jak usunąć ani przemianować rodzaju.** Można tylko dodać nowy. W starym Bridge
   też się nie da — przycisk kasowania istnieje w kodzie, ale jest zasłonięty przez nakładkę
   i nic nie zapisuje. Nie odtwarzaliśmy nieosiągalnej funkcji.

6. **Nie ma filtra „Źródło" przy wartościach.** Stary Bridge go pokazuje, ale serwer nigdy nie
   przysyła tej informacji, więc filtr zawsze wyświetlał „user" i niczego nie zawężał. Pominęliśmy
   go świadomie, zamiast odtwarzać element, który nic nie robi.

7. **Akcje kolejki nie zostawiają śladu w historii zmian.** Ani „Akceptuj z edycją", ani alias
   nie pojawią się w widoku *Historia* — mimo że potrafią zmienić setki produktów. Tak działa
   stary Bridge; naprawa jest zapisana do decyzji, bo oznaczałaby różnicę wobec produkcji.

8. **Kolejka ładuje się wolno.** Przyczyna jest po stronie serwera (liczenie podobieństwa dla
   ~500 pozycji wobec całego słownika), nie po stronie ekranu. Znane i opisane.

9. **Kategoria zachowuje się inaczej w regułach cen niż w filtrach katalogu.** W regułach lista
   pochodzi **wyłącznie ze słownika** (żeby dało się zrobić regułę na zapas), a w filtrach
   katalogu to **słownik + to, co jest na produktach**. Wygląda niekonsekwentnie, ale dokładnie
   tak działa stary Bridge i celowo tego nie ujednolicaliśmy.

10. **W filtrze marek katalogu nie ma pozycji typu „11.2-24", ale wartość słownikowa z cyfrą
    już jest widoczna.** Filtr odsiewa marki z cyframi tylko wtedy, gdy pochodzą z produktów
    (tam to śmieci z importu — rozmiar wpisany w pole marki). Wartości wpisane ręcznie do
    słownika przechodzą bez tego sita. Ta asymetria jest w oryginale.

11. **Kategorie w filtrach katalogu sortują się „dziwnie"** — np. *Ćwiartki* na końcu, za *Z*.
    Marki sortują się po polsku, kategorie zwykłym sortowaniem komputerowym. Też zastane
    w oryginale i celowo zachowane.

12. **Okna „Nowy rodzaj" i „Dodaj wartość" nie czyszczą pól po kliknięciu „Anuluj".** Następne
    otwarcie pokazuje to, co wpisałaś poprzednio — pola czyści dopiero udany zapis. Tak samo
    zachowuje się stary Bridge; dzięki temu przypadkowe zamknięcie nie kasuje wpisanego tekstu.
    (Okna edycji wartości i pozycji kolejki zachowują się inaczej — te za każdym razem pokazują
    aktualną wartość edytowanego wiersza.)

---

## 5. Czego jeszcze NIE MA — świadomie

| Czego brakuje | Dlaczego |
|---|---|
| Usuwanie i przemianowanie rodzaju | w starym Bridge nieosiągalne (patrz punkt 5 wyżej) |
| Przycisk „Skanuj kolejkę" | skanowanie dzieje się samo po zatwierdzeniu importu |
| Kafel „Wszystkie atrybuty" (zbiorcza lista) | zasłonięty w starym Bridge nakładką — użytkownik go nie widzi |
| Lista aliasów do podejrzenia | mapowania nigdzie nie są zapisywane (punkt w 3.12) |
| Ślad akcji kolejki w Historii | do decyzji — patrz punkt 7 wyżej |
| Edycja produktu z poziomu Katalogu | należy do Iteracji 12 razem z resztą zmian w katalogu |

---

## 6. Szybka lista kontrolna

**Widok Atrybuty**

- [ ] Widok **Atrybuty** otwiera się z menu i nie jest „w przygotowaniu"
- [ ] Pasek pokazuje liczbę rodzajów i wartości, kafle mają etykietki *wbudowany* / *własny*
- [ ] Kliknięcie kafla otwiera listę wartości, **← Wróć do kafli** wraca
- [ ] Szukajka zawęża listę i licznik „Wyświetlono"
- [ ] **Dodana wartość jest tam nadal po F5** ⭐
- [ ] Edycja bez zmiany wartości nie robi nic; duplikat daje czytelny błąd
- [ ] Usunięcie pyta o potwierdzenie i dopiero wtedy kasuje
- [ ] **Podgląd mówi „pokazano pierwsze 200", gdy produktów jest więcej** ⭐
- [ ] **Nowy rodzaj jest tam nadal po F5** ⭐
- [ ] „Dodaj wartość" z nieistniejącym rodzajem zakłada rodzaj i dodaje wartość

**Kolejka „Do akceptacji"**

- [ ] Odznaka przy przycisku pokazuje liczbę pozycji
- [ ] Filtr rodzaju, szukajka i licznik „Wyświetlono X z Y" działają razem
- [ ] Kolumna *Wystąpień* jest klikalna i otwiera listę produktów
- [ ] **Akceptuj** → wartość w słowniku, katalog nietknięty ⭐
- [ ] **Edytuj** → ostrzeżenie z liczbą produktów, po zapisie katalog realnie zmieniony ⭐
- [ ] **Alias** → produkty dostają wartość kanoniczną, do słownika NIC nie wchodzi ⭐
- [ ] **Odrzuć** → wartość nie wraca przy kolejnym imporcie
- [ ] **„Wyczyść" mówi wprost, że wartości wrócą przy następnym imporcie** ⭐

**Reguły cen i katalog**

- [ ] **Kategoria dodana w Atrybutach jest wybieralna w regule, choć nie ma jej na produktach** ⭐
- [ ] Dostawca w regule pokazuje się jako `KOD · Nazwa`
- [ ] Konstrukcja i VF/IF to listy wyboru, nie pola tekstowe
- [ ] Filtr marki w Katalogu pokazuje marki ze słownika
- [ ] Nowa wartość widoczna w trzech miejscach bez F5

---

## 7. Jak zgłaszać problemy

Napisz Pawłowi, podając:

1. **Co robiłaś** — konkretny numer scenariusza z tej instrukcji albo opis kliknięć.
2. **Czego oczekiwałaś** i **co się stało**.
3. **Rodzaj i wartość**, których dotyczyła akcja (np. *bieznik / AGRI STAR II*) — bez tego
   trudno odtworzyć.
4. **Którą z czterech akcji kolejki** kliknęłaś (Akceptuj / Edytuj / alias / Odrzuć) — one
   robią różne rzeczy i mylą się najłatwiej.
5. **Godzinę** (z dokładnością do minuty) i **zrzut ekranu**.

Najcenniejsze zgłoszenia to cztery:

- **akcja kolejki zmieniła produkty, choć nie powinna** (albo odwrotnie — nie zmieniła, choć
  miała) — to najgroźniejszy możliwy błąd w tej iteracji;
- **liczba produktów w ostrzeżeniu nie zgadza się z tym, co realnie się zmieniło**;
- **wartość dodana w słowniku nie pojawia się w regułach cen albo w filtrach katalogu**;
- **cokolwiek zniknęło po odświeżeniu strony** — to znaczy, że zapis nie doszedł na serwer.
