# Iteracja 9 (Waga gabarytowa) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-03 · **Zaktualizowano:** 2026-09-04 (sekcje 4.8 i 5 — statusy iteracji)

> **To jest STAGING, nie produkcja.** Cokolwiek tu ustawisz albo zepsujesz — produkcji nie
> dotyka. Testuj bez skrupułów.

> **⚠ Jedna rzecz, o której trzeba wiedzieć ZANIM zaczniesz.** Ten kalkulator **nie rozmawia
> z serwerem** — liczy w Twojej przeglądarce, a lista przewoźników i dzielników zapisuje się
> **lokalnie, na tym komputerze**. Nie na serwerze. Wnioski praktyczne są trzy: kalkulator
> zadziała nawet gdyby backend leżał; Twoje zmiany w liście przewoźników **nie zobaczy nikt
> inny i nie przeniosą się na inny komputer**; a wyczyszczenie danych witryny w przeglądarce
> je skasuje. Tak działa stary Bridge i tak zostało odtworzone.

---

## 1. Co dowozi Iteracja 9

Widok **Waga gabarytowa** — kalkulator wagi wolumetrycznej dla przesyłki, plus edytowalna lista
przewoźników i ich dzielników.

**Sedno do sprawdzenia — cztery rzeczy:**

1. **Wzór jest jeden:** `długość × szerokość × wysokość ÷ dzielnik przewoźnika`, wymiary w cm,
   wynik w kg. Dla paczki 60 × 50 × 50 u GEIS-a (dzielnik 10 000) daje to **15 kg**.
2. **Dzielnik zależy od przewoźnika i to on decyduje o wyniku.** Im **mniejszy** dzielnik, tym
   **cięższa** wychodzi ta sama paczka. Ta sama paczka: GEIS 15 kg, DPD 25 kg, GLS 37,50 kg.
3. **„Waga do wyceny" to większa z dwóch** — gabarytowej i rzeczywistej. Pojawia się tylko
   wtedy, gdy podasz wagę rzeczywistą; bez niej nie ma czego porównywać.
4. **Listę przewoźników możesz zmieniać** — poprawić dzielnik, zmienić nazwę, usunąć,
   dodać własnego, wrócić do domyślnych.

---

## 2. Przygotowanie

**Czego potrzebujesz:** tylko konta w panelu. Ten widok **nie potrzebuje produktów w katalogu**
ani wgranego cennika — jest samodzielny.

Widok znajdziesz w menu po lewej: **Waga gabarytowa**. Składa się z trzech części:
- **Wymiary paczki** (po lewej) — formularz,
- **Wynik** (po prawej) — rozbicie obliczenia,
- **Przewoźnicy i dzielniki** (pod spodem) — tabela z listą i trybem edycji.

**Przy pierwszym wejściu** formularz jest wypełniony przykładem **60 / 50 / 50**, waga
rzeczywista pusta, przewoźnik **GEIS Polska**, a po stronie wyniku widnieje
*Wypełnij wymiary i kliknij „Oblicz wagę gabarytową"*.

> **Wpisuj liczby z kropką** (`12.5`), nie z przecinkiem — przecinek też jest obsłużony, ale
> pola liczbowe w niektórych przeglądarkach same go nie wpuszczają.

---

## 3. Scenariusze — po kolei

Każdy scenariusz: **co zrobić** → **czego oczekiwać**. Jeśli wyjdzie inaczej — zapisz i zgłoś
wg [sekcji 7](#7-jak-zgłaszać-problemy).

### 3.1 Pierwsze obliczenie — na wartościach domyślnych

1. Wejdź w **Waga gabarytowa**, niczego nie zmieniaj.
2. Kliknij **Oblicz wagę gabarytową**.

**Oczekiwane:** po prawej pojawia się blok **Waga gabarytowa (GEIS Polska)** z wartością
**15.00 kg**, a pod nim rozbicie:

| Pozycja | Wartość |
|---|---|
| Obliczenie | `60 × 50 × 50 ÷ 10000` |
| Objętość | `0.1500 m³` |

Na dole notka: *Wynik został zapisany lokalnie — pokaże się przy następnym wejściu.*

**Bloku „Waga do wyceny" jeszcze NIE MA** — bo nie podałaś wagi rzeczywistej. To poprawne.

---

### 3.2 ⭐ Zmiana przewoźnika — dzielnik naprawdę steruje wynikiem

1. Bez zmiany wymiarów wybierz w polu **Przewoźnik** kolejno: **DPD**, potem **GLS**.
2. Po każdym wyborze kliknij **Oblicz wagę gabarytową**.

**Oczekiwane:** ta sama paczka waży inaczej u każdego przewoźnika:

| Przewoźnik | Dzielnik | Waga paczki 60×50×50 |
|---|---|---|
| GEIS Polska | 10 000 | **15.00 kg** |
| DPD | 6 000 | **25.00 kg** |
| GLS | 4 000 | **37.50 kg** |
| InPost Kurier / UPS / DHL Parcel | 5 000 | **30.00 kg** |

Nagłówek bloku wyniku zmienia się razem z wyborem — *Waga gabarytowa (DPD)* itd. Wiersz
**Obliczenie** pokazuje nowy dzielnik. **Objętość zostaje ta sama (0.1500 m³)** — bo zależy
od wymiarów, nie od przewoźnika. To poprawne.

---

### 3.3 ⭐ Waga do wyceny — gdy gabarytowa wygrywa

1. Ustaw przewoźnika **GEIS Polska** i wymiary **60 / 50 / 50**.
2. W polu **Waga rzeczywista (kg) — opcjonalnie** wpisz `12`.
3. **Oblicz wagę gabarytową**.

**Oczekiwane:** pojawia się pomarańczowy blok **Waga do wyceny (większa z dwóch)** z wartością
**15.00 kg** i wyjaśnieniem *Gabarytowa > rzeczywista → liczy się gabarytowa*. W rozbiciu
dochodzi wiersz **Waga rzeczywista — 12.00 kg**.

Sens praktyczny: paczka lekka, ale duża — przewoźnik policzy jak za 15 kg.

---

### 3.4 Waga do wyceny — gdy rzeczywista wygrywa

1. To samo co wyżej, ale w **Waga rzeczywista** wpisz `22.5`.
2. **Oblicz wagę gabarytową**.

**Oczekiwane:** **Waga do wyceny** = **22.50 kg**, wyjaśnienie *Rzeczywista > gabarytowa →
liczy się rzeczywista*. Waga gabarytowa dalej pokazuje 15.00 kg — obie liczby są widoczne obok
siebie i o to chodzi.

---

### 3.5 Realny przypadek — opona

1. Wpisz wymiary opony, np. **60 / 60 / 25**, przewoźnik **GEIS Polska**.
2. **Oblicz wagę gabarytową**.

**Oczekiwane:** **9.00 kg**, objętość **0.0900 m³**, obliczenie `60 × 60 × 25 ÷ 10000`.

Sprawdź to samo u **GLS** (dzielnik 4 000) — powinno wyjść **22.50 kg**. Różnica 2,5-krotna
na tej samej oponie to dokładnie ta informacja, po którą się tu przychodzi.

---

### 3.6 Niepoprawne wymiary

1. W polu **Długość** wpisz `0` (albo zostaw puste, albo wpisz wartość ujemną).
2. **Oblicz wagę gabarytową**.

**Oczekiwane:** czerwony komunikat **Niepoprawne wymiary** — *Wprowadź dodatnie liczby dla
długości, szerokości i wysokości.* Wynik po prawej **nie zmienia się** (zostaje poprzedni albo
tekst zachęty). Nic się nie psuje.

> **Waga rzeczywista jest wyjątkiem** — może zostać pusta i wtedy po prostu nie ma bloku „waga
> do wyceny". Jeśli wpiszesz w nią coś, co nie jest liczbą, obliczenie i tak przejdzie, a blok
> „waga do wyceny" się nie pokaże. To zamierzone — lepiej pominąć porównanie niż pokazać bzdurę.

---

### 3.7 ⭐ Wynik przeżywa wyjście z widoku

1. Policz cokolwiek (np. scenariusz 3.4).
2. Przejdź do innego widoku, np. **Katalog**.
3. Wróć do **Waga gabarytowa**.

**Oczekiwane:** formularz ma **te same wymiary**, co przed wyjściem, a po prawej **wisi ostatni
wynik**. Nie trzeba liczyć od nowa.

**Sprawdź też odświeżenie strony (F5)** — powinno zachować się tak samo.

> **Uwaga na jedną subtelność:** zapamiętują się wymiary **z ostatniego kliknięcia „Oblicz"**,
> a nie to, co masz aktualnie wpisane w polach. Jeśli zmienisz liczby i wyjdziesz **bez
> liczenia**, wrócą stare. To zachowanie starego Bridge.

---

### 3.8 Tabela przewoźników — odczyt

Zjedź na dół, do sekcji **Przewoźnicy i dzielniki**.

**Oczekiwane:** sześć wierszy i trzy kolumny — **Przewoźnik**, **Dzielnik**, **Przykład dla
paczki 60×50×50**:

| Przewoźnik | Dzielnik | Przykład |
|---|---|---|
| GEIS Polska | 10 000 | 15.00 kg |
| DPD | 6 000 | 25.00 kg |
| GLS | 4 000 | 37.50 kg |
| InPost Kurier | 5 000 | 30.00 kg |
| UPS | 5 000 | 30.00 kg |
| DHL Parcel | 5 000 | 30.00 kg |

Kolumna „Przykład" to ta sama paczka u każdego przewoźnika — służy do porównania na jeden rzut
oka, bez klikania.

---

### 3.9 ⭐ Edycja dzielnika

1. Kliknij **Edytuj listę** (przycisk zmienia się na **Gotowe**).
2. Nazwy i dzielniki zamieniają się w pola do wpisywania, dochodzi kolumna **Akcje**.
3. Zmień dzielnik **GEIS Polska** z `10000` na `8000`.
4. Kliknij **Gotowe**.
5. Upewnij się, że w formularzu wybrany jest **GEIS Polska**, ustaw wymiary **60 / 50 / 50**
   i kliknij **Oblicz wagę gabarytową**.

**Oczekiwane:** kolumna „Przykład" przy GEIS-ie od razu pokazuje **18.75 kg**, a wynik po
obliczeniu też **18.75 kg** (150 000 ÷ 8 000). Etykieta w polu wyboru przewoźnika zmienia się
na *GEIS Polska — dzielnik 8000*.

> **Wpisanie zera, liczby ujemnej albo tekstu w pole dzielnika jest po cichu ignorowane** —
> pole zostaje przy poprzedniej wartości. Zamierzone: dzielnik zero wysadziłby obliczenie.

---

### 3.10 Dodanie własnego przewoźnika

1. W trybie edycji, pod tabelą: **Dodaj nowego przewoźnika**.
2. **Nazwa** → `Pocztex`, **Dzielnik** → `3000`.
3. **Dodaj**.

**Oczekiwane:** nowy wiersz na końcu tabeli, w kolumnie „Przykład" **50.00 kg**
(150 000 ÷ 3 000). Nowy przewoźnik pojawia się też **na liście wyboru w formularzu** — wybierz
go i policz: dla 60 / 50 / 50 wyjdzie **50.00 kg**.

**Spróbuj dodać bez nazwy albo z dzielnikiem `0`** — oczekiwane: czerwony komunikat
**Brak danych** — *Podaj nazwę i dodatni dzielnik.*, nic się nie dodaje.

---

### 3.11 Usuwanie przewoźnika

1. W trybie edycji kliknij ikonę kosza przy **DHL Parcel**.

**Oczekiwane:** wiersz znika natychmiast, **bez pytania o potwierdzenie**, i przewoźnik znika
też z listy wyboru w formularzu.

2. Teraz usuń przewoźnika, który jest **aktualnie wybrany** w formularzu.

**Oczekiwane:** znika, a wybór **przeskakuje na pierwszego z pozostałych**. Kalkulator dalej
działa — nie zostaje bez dzielnika.

3. Usuń wszystkich poza jednym, a potem spróbuj usunąć ostatniego.

**Oczekiwane:** komunikat **Nie można usunąć** — *Musi pozostać co najmniej jeden przewoźnik.*
Wiersz zostaje.

---

### 3.12 Przywróć domyślne

1. Po zabawie z sekcji 3.9–3.11 kliknij **Przywróć domyślne**.

**Oczekiwane:** komunikat **Przywrócono** — *Domyślna lista przewoźników i dzielników.*, tabela
wraca do sześciu pozycji z pierwotnymi dzielnikami, a wybrany przewoźnik wraca na
**GEIS Polska**. Twój `Pocztex` i zmieniony dzielnik GEIS-a znikają.

---

### 3.13 ⭐ Ustawienia przeżywają zamknięcie przeglądarki

1. Zmień coś w liście (np. dodaj przewoźnika albo popraw dzielnik).
2. Zamknij kartę, otwórz panel od nowa, wejdź w **Waga gabarytowa**.

**Oczekiwane:** Twoja zmieniona lista **jest na miejscu**.

3. **Teraz test odwrotny, ważniejszy:** otwórz ten sam adres w **innej przeglądarce** albo
   w oknie prywatnym (możesz też poprosić kogoś o zalogowanie się na innym komputerze).

**Oczekiwane:** tam lista jest **domyślna** — Twoich zmian nie ma. **To nie jest błąd.**
Ustawienia siedzą w Twojej przeglądarce, nie na serwerze — patrz ramka na górze i punkt 1
w [sekcji 4](#4-rzeczy-które-wyglądają-na-błąd-a-są-zamierzone).

---

## 4. Rzeczy, które wyglądają na błąd, a są zamierzone

**1. ⭐ Lista przewoźników nie przenosi się między komputerami ani przeglądarkami.**
Zapisuje się lokalnie (w pamięci przeglądarki), nie na serwerze. Nikt inny Twoich zmian nie
zobaczy, a wyczyszczenie danych witryny je skasuje. Tak działa stary Bridge — nie ma dla tej
listy ani tabeli w bazie, ani żadnego zapisu na serwer. **Jeśli chcesz, żeby ustawienia były
wspólne dla wszystkich i trzymane na serwerze, to nowa funkcja, nie poprawka** — zapisane
w backlogu jako pozycja do Twojej decyzji.

**2. Kalkulator w ogóle nie pyta serwera.**
Liczy w przeglądarce. Zadziała nawet wtedy, gdy backend jest wyłączony. To też zachowanie
oryginału.

**3. ⭐ Na serwerze istnieje DRUGI, zupełnie inny kalkulator wagi gabarytowej.**
Liczy wagę **paletową**: zaokrągla szerokość do progów półpalety (do 55 cm liczy jak 60 cm)
i palety (do 80 cm liczy jak 80 cm), dolicza 10 cm na samą paletę i mnoży przez współczynnik
z konfiguracji. To **inny wzór do innego celu** niż ten w widoku — nie pomyłka i nie duplikat.
W starym Bridge też istnieje i **też nie jest podpięty pod żaden ekran**. Odbudowaliśmy oba
osobno, każdy wiernie. Gdybyś chciała mieć ten paletowy dostępny w panelu — to osobna decyzja,
zapisana w backlogu.

**4. Usunięcie przewoźnika nie pyta o potwierdzenie.**
Zamierzone, jak w oryginale. Ratunek jest jeden: **Przywróć domyślne** (ale skasuje też Twoje
inne zmiany).

**5. Zapamiętują się wymiary z ostatniego „Oblicz", a nie to, co masz wpisane.**
Patrz [3.7](#37--wynik-przeżywa-wyjście-z-widoku).

**6. Zapamiętany wynik trzyma nazwę przewoźnika sprzed zmiany.**
Jeśli policzysz coś u „GEIS Polska", potem zmienisz mu nazwę albo go usuniesz, a następnie
wrócisz do widoku — w nagłówku wyniku dalej zobaczysz starą nazwę. Wynik jest migawką z chwili
obliczenia i taki miał zostać.

**7. Zmiana dzielnika nie przelicza wyniku, który już wisi na ekranie.**
Trzeba kliknąć **Oblicz wagę gabarytową** jeszcze raz. Kolumna „Przykład" w tabeli aktualizuje
się natomiast od razu — i to jest różnica zamierzona.

**8. Nie ma pól do ustawienia progów palety.**
Cztery ustawienia serwerowego kalkulatora paletowego (`waga_gab.*`) nie mają ekranu. Pierwotnie
miała je dowieźć Iteracja 11 — **iteracja jest już zamknięta (2026-09-03) i tych czterech pól
nie objęła**, więc dalej działają na wartościach domyślnych (55 cm / 80 cm / 10 cm / 0,000167).
Skoro sam kalkulator paletowy nie jest podpięty pod żaden ekran (punkt 3 wyżej), ustawianie jego
progów czeka na tę samą decyzję co on.

**9. Przycisk kasowania to sama ikona kosza, bez opisu.**
Czytnik ekranu nie przeczyta, czego dotyczy. Tak jest w oryginale i odtworzyliśmy to wiernie;
poprawa dostępności to zmiana obejmująca cały panel, nie ten jeden przycisk.

---

## 5. Czego jeszcze NIE MA — świadomie

| Czego brakuje | Kiedy |
|---|---|
| Wspólna lista przewoźników trzymana na serwerze | ⬜ decyzja — dziś, jak w starym Bridge, tylko lokalnie |
| Kalkulator paletowy (formuła serwerowa) dostępny w panelu | ⬜ decyzja — w starym Bridge też nie jest podpięty |
| Etykiety dla czytnika ekranu przy przyciskach z ikoną | ⬜ decyzja — dotyczy całego panelu |
| Ustawianie progów palety i współczynnika (`waga_gab.*`) | ⬜ decyzja — Iteracja 11 zamknięta 2026-09-03 i tych pól nie objęła |
| Atrybuty | Iteracja 7 |

> **W międzyczasie doszły dwa ekrany**, które ta instrukcja wymieniała jako brakujące:
> **Alerty** (Iteracja 6, 2026-09-03 — [instrukcja](instrukcja-testow-I6.md)) oraz
> **Pulpit i Analityka** (Iteracja 10, 2026-09-04 — [instrukcja](instrukcja-testow-I10.md)).

---

## 6. Szybka lista kontrolna

- [ ] Domyślne 60 / 50 / 50 u GEIS-a daje **15.00 kg** i objętość **0.1500 m³**
- [ ] **Zmiana przewoźnika zmienia wynik** (DPD 25.00, GLS 37.50) ⭐
- [ ] Objętość NIE zmienia się przy zmianie przewoźnika
- [ ] **Waga do wyceny = większa z dwóch, z wyjaśnieniem która wygrała** ⭐
- [ ] Bez wagi rzeczywistej blok „waga do wyceny" się nie pokazuje
- [ ] Zero, wartość ujemna i puste pole dają komunikat *Niepoprawne wymiary*
- [ ] **Wynik i wymiary są na miejscu po wyjściu z widoku i po F5** ⭐
- [ ] Tabela pokazuje sześciu przewoźników z kolumną „Przykład"
- [ ] **Zmiana dzielnika przelicza kolumnę „Przykład" od razu, a wynik po kliknięciu „Oblicz"** ⭐
- [ ] Nowy przewoźnik pojawia się w tabeli i na liście wyboru
- [ ] Dodanie bez nazwy albo z dzielnikiem 0 daje *Brak danych*
- [ ] Usunięcie wybranego przewoźnika przenosi wybór na kolejnego
- [ ] Ostatniego przewoźnika nie da się usunąć
- [ ] „Przywróć domyślne" cofa listę **i** wybór
- [ ] **W innej przeglądarce lista jest domyślna — to poprawne** ⭐

---

## 7. Jak zgłaszać problemy

Napisz Pawłowi, podając:

1. **Co robiłaś** — konkretny krok z tej instrukcji albo opis kliknięć.
2. **Czego oczekiwałaś** i **co się stało**.
3. **Wymiary, przewoźnika i dzielnik** — bez tego nie da się odtworzyć liczby.
4. **Godzinę** (z dokładnością do minuty).
5. **Zrzut ekranu** — najlepiej taki, na którym widać jednocześnie formularz i blok wyniku
   razem z wierszem **Obliczenie**.

Najcenniejsze zgłoszenia to trzy:
- **liczba się nie zgadza** — wynik różni się od `długość × szerokość × wysokość ÷ dzielnik`
  policzonego na kalkulatorze; podaj wtedy koniecznie wiersz **Obliczenie** ze zrzutu;
- **„waga do wyceny" wskazuje mniejszą z dwóch wartości** albo pokazuje się mimo pustej wagi
  rzeczywistej;
- **ustawienia zniknęły same** — lista wróciła do domyślnej, choć nie klikałaś „Przywróć
  domyślne" i nie czyściłaś danych przeglądarki.
