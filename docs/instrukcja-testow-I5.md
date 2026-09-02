# Iteracja 5 (Historia) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Ekran:** *Historia* w menu bocznym
**Wersja instrukcji:** 2026-09-02 (ticket `15-FEATURE-historia-zmian`)

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

**Od czego zacząć, jeśli masz mało czasu:** rozdział 3 (przeczytaj), potem rozdział 9
(porównanie ze starym Bridge — tam siedzi sedno).

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

### 3.3 Typ „Edycje" — nowych wpisów nie przybędzie

Wpisy typu *edycja* powstają przy **ręcznej edycji produktu w katalogu**. Nowy Bridge ma
na razie katalog **tylko do odczytu** (edycja produktu przychodzi w późniejszej iteracji),
więc *edycje*, które zobaczysz, pochodzą **wyłącznie z kopii starej produkcji**. To dobrze —
świetnie nadają się do porównania ze starym Bridge (rozdział 9).

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

### 8.2 Eksport

Pokazuje `Format: csv` albo `Format: shoper`.

- [ ] Jeśli w kopii produkcji są eksporty — format się wyświetla
- [ ] Nowych eksportów **nie wygenerujesz** — eksport przychodzi w późniejszej iteracji

### 8.3 Edycja

Pokazuje kod produktu, a pod nim listę **nazw** zmienionych pól.

- [ ] Kod produktu jest widoczny
- [ ] Pola wypisane jedno pod drugim
- [ ] ⭐ Przy więcej niż sześciu polach widać **pierwsze sześć** i napis *„… i N więcej"* —
      tak samo jak w starym Bridge
- [ ] **Nie ma** starej i nowej wartości — tylko nazwy pól (§3.1)

---

## 9. ⭐ Porównanie ze starym Bridge — najważniejszy test

Otwórz **Historię w obu Bridge'ach** obok siebie i ustaw te same filtry.

- [ ] **Te same wpisy, w tej samej kolejności** (najnowsze na górze)
- [ ] **Ta sama liczba wpisów** w liczniku
- [ ] Ten sam wiersz ma tę samą datę, dostawcę, użytkownika i liczbę pozycji
- [ ] Ten sam wpis typu *edycja* ma **tę samą listę zmienionych pól**
- [ ] Filtr *Dostawca* ma **tę samą listę kodów** w obu

**To jest najcenniejsze zgłoszenie z całej iteracji:** jeśli któryś wpis jest w starym
Bridge, a nie ma go w nowym (albo odwrotnie) — **napisz od razu**, podając datę, godzinę
i dostawcę.

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
   liczbą wszystkich zdarzeń. Dziś to niewidoczne, ale z czasem wypłynie.

---

## 12. Czego jeszcze NIE MA — świadomie

| Czego brakuje | Kiedy |
|---|---|
| **Zmiany cen poszczególnych opon** z auto-zatwierdzenia importu (§3.1) | Iteracja 10 |
| Widok pełnego dziennika działań (wszystkie zdarzenia, bez filtra pięciu typów) | Iteracja 12 |
| Ręczna edycja produktu w katalogu — czyli źródło nowych wpisów *edycja* (§3.3) | późniejsza iteracja |
| Eksporty — źródło nowych wpisów *eksport* (§8.2) | późniejsza iteracja |

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

**Porównanie — najważniejsze**
- [ ] ⭐⭐ **Te same wpisy i ta sama ich liczba co w starym Bridge** (§9)
- [ ] ⭐⭐ **Ten sam wpis *edycja* ma tę samą listę zmienionych pól** (§9)

**Twoje zdanie**
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
