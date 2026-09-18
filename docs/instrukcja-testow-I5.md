# Iteracja 5 (Historia) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Ekran:** *Historia* w menu bocznym
**Wersja instrukcji:** 2026-09-18 — **zaktualizowana** (`59-CHORE-i14j`, `62-DOCS`)
**Wersja pierwotna:** 2026-09-02 (`15-FEATURE-historia-zmian`)

> ## ⭐ CO SIĘ ZMIENIŁO OD WERSJI Z 02.09 — PRZECZYTAJ, ZANIM ZACZNIESZ
>
> **Najważniejsze: rozdział 9 (porównanie ze starym Bridge) jest już ZROBIONY — maszynowo.**
> Zostawiłaś przy nim puste pole i miałaś rację, że to żmudne. Porównaliśmy za Ciebie **wszystkie
> wpisy automatem**: postawiliśmy stary i nowy Bridge obok siebie na tej samej kopii bazy
> i zestawiliśmy ich odpowiedzi co do znaku. **Wynik: 49 813 porównanych wpisów, zero różnic.**
> Zostają Ci **trzy wpisy do obejrzenia na oczy** — rozdział 9.
>
> **Dwie rzeczy, które ta instrukcja Ci wcześniej obiecała, przestały być prawdą:**
> - **§3.3** mówił, że wpisów typu *edycja* nie przybędzie, bo katalog jest tylko do odczytu.
>   **Już przybywa** — edycja produktu w katalogu działa i zostawia ślad;
> - **§8.2** mówił, że nowych eksportów nie wygenerujesz. **Wygenerujesz.**
>
> Oba rozdziały są poniżej poprawione i **oba mają nowe rzeczy do sprawdzenia.**

> **To jest STAGING, nie produkcja.** Baza to kopia produkcji. Cokolwiek tu zrobisz,
> produkcji nie dotyka. Ten ekran jest **tylko do odczytu** — nie da się z niego niczego
> zmienić ani skasować.

---

## ⭐ Najważniejsze zdanie w tej instrukcji

**Ten ekran nie pokazuje tego, co sugeruje jego nazwa.**

„Historia" brzmi jak lista zmian cen: *opona X podrożała z 500 na 540*. **Tak nie jest** —
ani w nowym Bridge, ani w starym. To jest **log zdarzeń**: jeden wiersz = jeden import,
jeden eksport albo jedna ręczna edycja produktu. Zobaczysz „*import od MO1, 120 pozycji,
plik mo1-cennik.xlsx*", a nie to, która opona i o ile podrożała.

Napis pod tytułem ekranu mówi to wprost: *„Log każdego importu, eksportu i ręcznej edycji
produktu w katalogu"*. Sprawdziliśmy stary Bridge linia po linii — u Ciebie działa
dokładnie tak samo. **Odtworzyliśmy to 1:1 i nie zamierzamy tego zmieniać bez Twojej decyzji.**

Jeśli to nie jest to, czego od tego ekranu oczekujesz — **napisz nam.** To jest właśnie
najcenniejsza informacja z tego testu. Rozdział 3 mówi, gdzie naprawdę leżą zmiany cen.

---

## 1. Zanim zaczniesz

**Czego potrzebujesz:**
- konta w panelu (to samo co zwykle) — **ekran wymaga zalogowania**,
- dostępu do starego Bridge, żeby mieć z czym porównywać,
- **jednego cennika** od dowolnego dostawcy — bez wgrania pliku nie zobaczysz nowych wpisów.

**Ile to zajmuje:** 30–45 minut. Rozdziały 5–8 są od siebie niezależne.

**Od czego zacząć, jeśli masz mało czasu:** rozdział 3 (przeczytaj), potem rozdział 9 —
trzy wpisy do obejrzenia obok siebie w obu Bridge'ach. Reszta porównania poszła automatem,
więc rozdział 9 zajmuje dziś **pięć minut, nie godzinę**.

---

## 2. Co obejmuje Iteracja 5

Jeden ekran — **Historia** — plus trzy adresy, z których bierze dane. Nic poza tym.
Placeholder „w przygotowaniu" znika, w menu bocznym pozycja *Historia* zaczyna działać.

---

## 3. ⭐⭐ Czego ten ekran NIE pokazuje — przeczytaj, zanim zaczniesz zgłaszać

To najważniejszy rozdział. Trzy rzeczy, których tu **nie będzie**, i to jest poprawne.

### 3.1 Nie ma zmian cen poszczególnych opon

Kiedy import sam zatwierdza podwyżkę ceny (bo cena i stan idą bez pytania Ciebie), zapisuje
to do osobnej tabeli — **i ta tabela ma swój własny ekran, ale dopiero w Iteracji 10
(Analityka)**. Tutaj tego nie ma i nie będzie.

Tak samo nie ma prezentacji **„przed → po"**. Przy wpisie typu *edycja* zobaczysz tylko
**nazwy** zmienionych pól (`kategoria`, `labelSnow`…), bez starej i nowej wartości. Stary
Bridge robi dokładnie to samo.

### 3.2 Większość Twoich działań nie zostawia tu śladu

Ekran rozpoznaje **pięć** rodzajów zdarzeń i **wszystko inne po cichu pomija.**
To zachowanie starego Bridge, odtworzone celowo.

| Co robisz | Czy pojawi się w Historii |
|---|---|
| **Wgrywasz cennik z przeglądarki** (Konfiguracja → Wgrywanie) | ✅ **TAK** |
| Wgrywasz cennik z konsoli (`/api/staging/import`) | ✅ tak, ale bez nazwy pliku — patrz §8.1 |
| Klikasz **„Synchronizuj teraz"** (pobranie z URL) | ❌ **NIE** |
| **Automat** pobiera cennik sam (scheduler) | ❌ **NIE** |
| Akceptujesz / odrzucasz pozycje w Stagingu | ❌ NIE |
| Poprawiasz pozycję w Stagingu | ❌ NIE |
| Zmieniasz ustawienia dostawcy | ❌ NIE |
| Dodajesz narzut albo promocję | ❌ NIE |

> **W praktyce:** jedyne kliknięcie w nowym Bridge, które **na pewno** doda wiersz do
> Historii, to **wgranie pliku z cennikiem przez przeglądarkę.** Jeśli klikniesz
> „Synchronizuj teraz" i Historia się nie zmieni — **to nie jest usterka.**

**To jest kandydat do zmiany i chcemy Twojego zdania.** Od niedawna automatyczne pobieranie
z URL jest głównym sposobem, w jaki dane wchodzą do Bridge'a — a Historia go nie pokazuje.
Zapisaliśmy to jako pytanie do Ciebie (backlog #21). Napisz, czy chcesz, żeby te zdarzenia
też były widoczne — to byłoby świadome odejście od starego Bridge, więc decyzja jest Twoja.

### 3.3 Typ „Edycje" — ⚠ POPRAWKA: wpisów JUŻ PRZYBYWA

**Wcześniejsza wersja tej instrukcji mówiła, że wpisów typu *edycja* nie przybędzie, bo katalog
jest tylko do odczytu. To już nieprawda** — ręczna edycja produktu w katalogu działa i od tej
pory każda taka edycja zostawia tu ślad.

Jak to działa: **jedno zapisanie produktu daje tyle wierszy, ile pól faktycznie zmieniłaś.**
Zmienisz dwa pola — będą dwa wiersze. Pole, które otworzyłaś i zostawiłaś bez zmiany, wiersza
nie tworzy.

Sprawdziliśmy to pomiarem na obu Bridge'ach naraz: ta sama edycja tego samego produktu daje
**identyczne wiersze po obu stronach** — to samo pole, ta sama stara i nowa wartość, ten sam
użytkownik. Nie musisz tego weryfikować, ale jeśli chcesz:

- [ ] Wejdź w *Katalog*, zmień dowolnemu produktowi jedno pole i zapisz
- [ ] W *Historii* pojawia się **jeden** nowy wiersz typu *edycja*, z kodem tego produktu
      i nazwą zmienionego pola

⚠ Jedno zastane dziwactwo, gdybyś na nie trafiła: jeśli pole miało wcześniej **puste** wartość,
w szczegółach zobaczysz napis `null`, a nie puste miejsce. Stary Bridge robi dokładnie to samo,
więc zostawiamy — **nie zgłaszaj.**

---

## 4. Ekran — co gdzie jest

**Góra:** tytuł *Historia zmian* i podtytuł *Log każdego importu, eksportu i ręcznej edycji
produktu w katalogu*.

**Pasek filtrów:** wyszukiwarka, filtr *Typ*, filtr *Dostawca*, a po prawej licznik `N wpisów`.

**Tabela — sześć kolumn:**

| Kolumna | Co zawiera |
|---|---|
| **Data** | data i godzina zdarzenia |
| **Typ** | kolorowa odznaka: `import` (niebieska), `eksport` (zielona), `edycja` (bursztynowa) |
| **Dostawca** | kod dostawcy albo `—` |
| **Użytkownik** | kto to zrobił, albo `—` |
| **Pozycji** | ile pozycji obejmowało zdarzenie (przy edycji zawsze `1`) |
| **Szczegóły** | zależy od typu — patrz rozdział 8 |

**Dół:** *Na stronie:* 25 / 50 / 100, napis `Strona X z Y · Z wpisów` i cztery przyciski
*« Pierwsza · Poprzednia · Następna · Ostatnia »*.

**Gdy nic nie ma:** *Brak wpisów w historii.*

- [ ] Ekran otwiera się z menu bocznego i nie pokazuje już „w przygotowaniu"
- [ ] Widzę wszystkie sześć kolumn, nagłówki nazywają się dokładnie jak wyżej
- [ ] Odznaki typów mają właściwe kolory

---

## 5. Test A — wgranie cennika zostawia ślad

To jedyna droga, którą wygenerujesz nowy wpis (§3.2).

1. Zapamiętaj, ile wpisów pokazuje licznik po prawej (`N wpisów`).
2. Idź do **Konfiguracja → Wgrywanie**, wgraj cennik dowolnego dostawcy.
3. Wróć na **Historię** i odśwież stronę.

- [ ] Na górze listy jest **nowy wiersz** z dzisiejszą datą i godziną
- [ ] Typ to `import`, **Dostawca** to kod tego dostawcy
- [ ] **Użytkownik** to Ty
- [ ] **Pozycji** zgadza się z liczbą pozycji, którą Bridge wczytał z pliku
- [ ] **Szczegóły** pokazują `Plik: <nazwa Twojego pliku>`
- [ ] Licznik `N wpisów` urósł o jeden

---

## 6. Filtry

**Wyszukiwarka** — wpisz kod produktu albo kod dostawcy.

- [ ] Lista zawęża się do pasujących wpisów, licznik `N wpisów` też
- [ ] Wielkość liter nie ma znaczenia
- [ ] Skasowanie tekstu przywraca pełną listę

**Filtr *Typ*** — *Wszystkie typy / Importy / Eksporty / Edycje*.

- [ ] Każda opcja zawęża listę do jednego rodzaju odznaki
- [ ] *Wszystkie typy* przywraca pełną listę

**Filtr *Dostawca*** — *Wszyscy dostawcy* + lista kodów.

- [ ] Wybranie kodu pokazuje tylko wpisy tego dostawcy
- [ ] Filtry **łączą się** — *Importy* + *MO1* daje tylko importy od MO1

**Ważne przy każdej zmianie filtra:**

- [ ] ⭐ Po zmianie filtra wracasz na **stronę 1**. Jeśli byłaś na stronie 4 i po zmianie
      filtra widzisz pustą tabelę zamiast wyników — **to jest usterka, zgłoś.**

---

## 7. Stronicowanie

- [ ] Przyciski *25 / 50 / 100* zmieniają liczbę wierszy; podświetlony jest aktywny
- [ ] *Następna* / *Poprzednia* przesuwają o jedną stronę, a wiersze faktycznie się zmieniają
- [ ] *« Pierwsza* i *Ostatnia »* skaczą na skraje
- [ ] Na pierwszej stronie *Pierwsza* i *Poprzednia* są **wyszarzone**; na ostatniej —
      *Następna* i *Ostatnia*
- [ ] Napis `Strona X z Y · Z wpisów` zgadza się z tym, co widać
- [ ] Zmiana *Na stronie* wraca na stronę 1

---

## 8. Kolumna Szczegóły — trzy warianty

### 8.1 Import

Pokazuje `Plik: <nazwa>`.

- [ ] Przy imporcie z przeglądarki widać prawdziwą nazwę pliku
- [ ] ⭐ Przy imporcie z **konsoli** widać `Plik: ?` — **tak ma być.** Tamta droga nie
      przekazuje nazwy pliku, bo żadnego pliku tam nie ma. Nie zgłaszaj.

### 8.2 Eksport — ⚠ POPRAWKA: eksporty JUŻ DZIAŁAJĄ

Pokazuje `Format: csv` albo `Format: shoper`.

**Wcześniejsza wersja mówiła, że nowych eksportów nie wygenerujesz. Wygenerujesz** — eksport
działa i zostawia tu wpis.

- [ ] Format wyświetla się przy wpisach eksportu
- [ ] Po zrobieniu eksportu pojawia się nowy wiersz typu *eksport*

⚠ **Jedna różnica na Twoją korzyść, i to nie pomyłka.** Pobranie **wszystkich dostawców naraz**
(jeden plik ZIP) w **starym** Bridge nie działa — wywala błąd i nie zostawia po sobie żadnego
wpisu w Historii. W **nowym** działa i wpis zostawia. Sprawdziliśmy to pomiarem: to defekt
starego Bridge, który siedzi tam od dawna. **Zapadła decyzja, żeby go nie odtwarzać** — nowy
Bridge ma po prostu działać. Jeśli więc pamiętasz, że „ten przycisk nigdy nie działał" — teraz
działa i tak ma być.

Pobieranie **pojedynczego dostawcy** działa w obu Bridge'ach tak samo.

### 8.3 Edycja

Pokazuje kod produktu, a pod nim listę **nazw** zmienionych pól.

- [ ] Kod produktu jest widoczny
- [ ] Pola wypisane jedno pod drugim
- [ ] ⭐ Przy więcej niż sześciu polach widać **pierwsze sześć** i napis *„… i N więcej"* —
      tak samo jak w starym Bridge
- [ ] **Nie ma** starej i nowej wartości — tylko nazwy pól (§3.1)

---

## 9. ⭐ Porównanie ze starym Bridge — ZROBIONE AUTOMATEM, zostają trzy wpisy

**Ten rozdział był wcześniej najżmudniejszym zadaniem w całej instrukcji i dlatego zrobiliśmy
go za Ciebie maszynowo.** Stary i nowy Bridge stanęły obok siebie na tej samej kopii bazy,
a ich odpowiedzi zostały zestawione co do znaku — cała tabela, wszystkie filtry, wszystkie
strony, wszystkie liczniki.

> ### Wynik: **49 813 porównanych wpisów · 0 różnic**
> Sprawdzone: 46 916 wierszy dziennika zmian, 270 wpisów widocznych na ekranie, filtry *Typ*
> i *Dostawca* (każdy kod osobno), dwanaście fraz w wyszukiwarce, stronicowanie 25/50/100 na
> kolejnych stronach oraz wartości skrajne. Do tego osobny przebieg dla eksportów.

Ten pomiar **zostaje w projekcie na stałe** i uruchamia się przy każdej zmianie, więc jeśli
kiedykolwiek coś się rozjedzie, dowiemy się o tym sami, bez Twojego udziału.

### Co zostaje dla Ciebie — trzy wpisy, jakieś pięć minut

Otwórz *Historię* w obu Bridge'ach obok siebie. **Bez filtrów.**

**1. Najnowszy wpis na samej górze** — sprawdza kolejność i kształt wpisu typu *edycja*:
- [ ] `28.07.2026, 06:22` · typ **Edycja** · produkt **`MO2_1147700`** · pola: `kategoria`,
      `labelSnow` · Pozycji: **1** · kolumna *Dostawca* **pusta**
- [ ] Licznik u góry pokazuje **270 wpisów**, stron jest **6**

Pusty dostawca przy edycji **jest poprawny** — patrz rozdział 11, punkt 6.

**2. Wpis importu** — sprawdza kolumnę *Szczegóły*. Ustaw filtr *Typ* = **Import** albo
*Dostawca* = **MO1** i spójrz na pierwszy wiersz:
- [ ] `27.07.2026, 10:27` · typ **Import** · dostawca **MO1** · Pozycji: **612**
- [ ] *Szczegóły*: **`Plik: BOH_PL_200015PL.csv`**
- [ ] Filtr *Dostawca* = MO1 daje **40 wpisów** w obu Bridge'ach

**3. Lista dostawców w filtrze** — sprawdza dwa dziwactwa naraz. Rozwiń *Dostawca*:
- [ ] Jest **dokładnie osiem** kodów, w tej kolejności:
      **MO1, MO10, MO2, MO3, MO6, MO7, MO8, MO9**

„MO10" **ma** stać między „MO1" a „MO2" — to sortowanie alfabetyczne, nie błąd (rozdział 11,
punkt 3). Brak MO4 i MO5 też jest poprawny (rozdział 11, punkt 5).

**Jeśli którakolwiek z tych trzech rzeczy różni się między Bridge'ami — napisz od razu.**
To by znaczyło, że automat porównuje coś innego, niż pokazuje ekran, i jest to najpoważniejsze
zgłoszenie, jakie można z tego testu wysłać.

---

## 10. Świadome ODSTĘPSTWA od starego Bridge — NIE zgłaszaj

Trzy rzeczy zmieniliśmy celowo.

| Co | Stary Bridge | Nowy Bridge | Dlaczego |
|---|---|---|---|
| **Logowanie** | ekran działał bez zalogowania | wymaga zalogowania | Ta sama zmiana co na Katalogu i Stagingu — dane firmy nie mają być publiczne. |
| **Wczytywanie** | pokazywał *„Brak wpisów w historii."* zanim dane doszły | pokazuje *„Wczytywanie historii…"* | Stary komunikat był po prostu nieprawdziwy — wyglądało, jakby historia była pusta. |
| **Błąd połączenia** | też pokazywał *„Brak wpisów w historii."* | pokazuje *„Nie udało się pobrać historii zmian."* | Awaria sieci wyglądała identycznie jak pusta historia. Teraz widać różnicę. |

---

## 11. Dziwactwa ODTWORZONE CELOWO — NIE zgłaszaj

Wiemy o nich. Tak działa stary Bridge i zrobiliśmy tak samo.

1. **Ekran pomija większość zdarzeń** — rozpoznaje tylko pięć rodzajów (§3.2).
2. **Import z konsoli pokazuje `Plik: ?`** (§8.1).
3. **Kolejność dostawców w filtrze to `MO1, MO10, MO2, MO3…`** — nie `MO1, MO2, MO3, MO10`.
   Sortowanie jest alfabetyczne, nie liczbowe. Wygląda jak błąd, ale stary Bridge robi
   dokładnie to samo.
4. **Wyszukiwarka szuka szerzej, niż mówi podpowiedź.** Napis mówi „kod produktu, dostawcy
   lub treść zmiany", a naprawdę przeszukuje **cały wpis** — wpisanie `import` albo `edycja`
   znajdzie wpisy po nazwie typu. To nie jest usterka.
5. **Filtr *Dostawca* nie zna wszystkich dostawców** — pokazuje tylko tych, którzy występują
   we wpisach, które przeszły przez filtr z punktu 1.
6. **Kolumna *Dostawca* to surowy kod z zapisu zdarzenia**, niepowiązany z listą dostawców.
   Może się tam pojawić kod, którego już nie ma w Konfiguracji — bo zdarzenie zapisało
   *zamiar*, zanim cokolwiek się wydarzyło.
7. **Kolumny nie da się kliknąć, żeby posortować.** Zawsze najnowsze na górze.
8. **Przy edycji *Pozycji* to zawsze `1`.**
9. **Ekran czyta 5000 najświeższych zdarzeń** i dopiero na nich filtruje. Przy bardzo długim
   dzienniku najstarsze wpisy przestaną być osiągalne, a licznik `N wpisów` przestanie być
   liczbą wszystkich zdarzeń. **Zmierzyliśmy, jak blisko jesteśmy: dziennik ma dziś 3873
   zdarzenia, czyli 77% progu.** Decyzja z 18.09: **zostawiamy 5000 i nie ruszamy tego teraz**
   — stary Bridge ma dokładnie tyle samo. Wrócimy do tematu, gdy próg zacznie doskwierać
   (backlog #87). Jeśli kiedyś zauważysz, że nie możesz dokopać się do starszego wpisu —
   to będzie właśnie to i **wtedy warto napisać.**

---

## 12. Czego jeszcze NIE MA — świadomie

| Czego brakuje | Kiedy |
|---|---|
| **Zmiany cen poszczególnych opon** z auto-zatwierdzenia importu (§3.1) | Iteracja 10 |
| Widok pełnego dziennika działań (wszystkie zdarzenia, bez filtra pięciu typów) | Iteracja 12 |
| ~~Ręczna edycja produktu w katalogu~~ | ✅ **JUŻ JEST** — patrz §3.3 |
| ~~Eksporty~~ | ✅ **JUŻ SĄ** — patrz §8.2 |

---

## 13. Lista kontrolna

**Zanim zaczniesz**
- [ ] Przeczytany rozdział 3 — wiem, czego ten ekran **nie** pokazuje

**Ekran**
- [ ] Otwiera się z menu, sześć kolumn, właściwe nagłówki (§4)
- [ ] Odznaki `import` / `eksport` / `edycja` mają właściwe kolory

**Dane**
- [ ] ⭐ Wgranie cennika dodaje wiersz z nazwą pliku i liczbą pozycji (§5)
- [ ] „Synchronizuj teraz" **nie** dodaje wiersza — i wiem, że tak ma być (§3.2)

**Filtry i strony**
- [ ] Wyszukiwarka zawęża listę i licznik (§6)
- [ ] Filtr *Typ* i filtr *Dostawca* działają, także razem (§6)
- [ ] ⭐ Zmiana filtra wraca na stronę 1 (§6)
- [ ] Stronicowanie 25/50/100, skrajne przyciski wyszarzone (§7)

**Szczegóły**
- [ ] Import pokazuje nazwę pliku (§8.1)
- [ ] Edycja pokazuje kod i nazwy pól, ucięcie po sześciu (§8.3)
- [ ] Eksport zostawia wpis — **nowe, §8.2**

**Nowe ścieżki, których wcześniej nie było**
- [ ] Edycja produktu w katalogu dodaje wiersz typu *edycja* (§3.3)

**Porównanie ze starym Bridge — reszta poszła automatem (§9)**
- [ ] ⭐ Wpis 1: najnowszy na górze, `MO2_1147700`, licznik **270 wpisów** / 6 stron
- [ ] ⭐ Wpis 2: import MO1, `Plik: BOH_PL_200015PL.csv`, filtr MO1 daje **40 wpisów**
- [ ] ⭐ Wpis 3: filtr *Dostawca* ma **osiem** kodów w kolejności MO1, MO10, MO2, …

**Twoje zdanie** — to jedyne miejsce, gdzie potrzebujemy Twojej decyzji
- [ ] Odpowiedziałam, czy Historia bez importów z URL i synchronizacji mi wystarcza (§3.2)
- [ ] Odpowiedziałam, czy brak zmian cen per opona na tym ekranie mi nie przeszkadza (§3.1)

---

## 14. Jak zgłaszać problemy

Napisz Pawłowi, podając:

1. **Co robiłaś** — punkt z tej instrukcji albo opis kliknięć.
2. **Czego oczekiwałaś** i **co się stało.**
3. **Datę i godzinę wpisu**, którego dotyczy sprawa (widać je w pierwszej kolumnie).
4. **Dostawcę** i **kod produktu**, jeśli wpis je ma.
5. **Zrzut ekranu** — przy tym ekranie zwykle wystarcza za cały opis.

**Najcenniejsze zgłoszenia, w kolejności:**

1. **Wpis jest w starym Bridge, a nie ma go w nowym** (albo odwrotnie) — najpoważniejsze.
2. **Ten sam wpis ma inne dane** w obu Bridge'ach — inną datę, dostawcę, liczbę pozycji
   albo inną listę zmienionych pól.
3. **Twoja odpowiedź na dwa pytania z rozdziału 3** — czy ten ekran daje Ci to, czego od
   niego potrzebujesz. Tu nie ma złej odpowiedzi i nie musisz niczego uzasadniać.
4. **Cokolwiek, co działa inaczej niż w starym Bridge**, a nie ma tego w rozdziale 10 ani 11.
