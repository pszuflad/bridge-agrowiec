# Iteracja 4 (Narzuty i promocje) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-02

> **To jest STAGING, nie produkcja.** Cokolwiek tu ustawisz albo zepsujesz — produkcji nie
> dotyka. Testuj bez skrupułów.

> **⚠ Jedna rzecz, o której trzeba wiedzieć ZANIM zaczniesz.** Każdy zapis reguły — dodanie,
> edycja, usunięcie, nawet kliknięcie w status — **przelicza ceny CAŁEGO katalogu**, wszystkich
> ~7 400 produktów naraz. To nie jest awaria ani nadgorliwość: tak działa stary Bridge i tak
> zostało odtworzone. Dwa wnioski praktyczne: zapis potrafi chwilę potrwać, a ceny w `/katalog`
> po każdej zabawie regułami będą inne niż przed nią.

---

## 1. Co dowozi Iteracja 4

Silnik cen: reguły narzutu i czasowe promocje, które ustalają **cenę sprzedaży** i **marżę**
każdego produktu. Plus widok **Narzuty i promocje**, w którym te reguły ustawiasz.

**Sedno do sprawdzenia — cztery reguły:**

1. **Cena sprzedaży powstaje z jednej formuły:**
   `cena zakupu × (1 + narzut%) × (1 − rabat%) × (1 + VAT%)`, zaokrąglona **w dół**.
2. **Wygrywa reguła NAJBARDZIEJ SZCZEGÓŁOWA, nie ta o najwyższym priorytecie.** Reguła „dla
   dostawcy MO5" bije regułę globalną, nawet jeśli globalna ma wyższy priorytet.
3. **Reguły wchodzą też do importu.** Od momentu, gdy istnieje pierwsza reguła, akceptacja
   pozycji ze stagingu liczy cenę z reguł — a nie ze starego „zakup × 1,25".
4. **Kolumna „marża" pokazuje PROCENT NARZUTU, nie policzoną marżę.** Przy narzucie 6% zobaczysz
   tam 6, choć realna marża jest wyższa. To zachowanie starego Bridge, odtworzone celowo.

---

## 2. Przygotowanie

**Czego potrzebujesz:**
- konta w panelu (to samo co zwykle),
- **produktów w katalogu** — jeśli katalog jest pusty, nie będzie czego przeliczać. Jeśli
  trzeba, wgraj najpierw cennik wg [instrukcji I3](instrukcja-testow-I3.md), sekcja 2.

**Zanim ruszysz — zanotuj stan wyjściowy.** Wejdź w **Katalog**, wybierz jeden produkt
i zapisz sobie jego **kod**, **cenę zakupu**, **cenę sprzedaży** i **marżę**. W tabeli katalogu
te kolumny nazywają się `cena_zakupu`, `cena_sprzedazy` i `marza_pct` — nagłówki są surowymi
nazwami z bazy, tak jak w starym Bridge. Będziesz do niego
wracać po każdej zmianie reguły — po tym poznasz, że silnik faktycznie zadziałał.

Widok znajdziesz w menu po lewej: **Narzuty i promocje**. Ma dwie zakładki:
- **Narzuty** — reguły stałego narzutu **oraz Symulator ceny** pod tabelą,
- **Promocje** — czasowe rabaty.

> **Na czysto zaczyna się szybciej.** Jeśli w tabelach są już jakieś reguły z wcześniejszych
> prób, skasuj je — inaczej trudno powiedzieć, która z nich zadziałała na dany produkt.

---

## 3. Scenariusze — po kolei

Każdy scenariusz: **co zrobić** → **czego oczekiwać**. Jeśli wyjdzie inaczej — zapisz i zgłoś
wg [sekcji 7](#7-jak-zgłaszać-problemy).

### 3.1 Pierwsza reguła — narzut globalny

1. Zakładka **Narzuty** → **Dodaj regułę**.
2. Wpisz nazwę, np. *Reguła globalna*.
3. Zaznacz **Reguła globalna (wszystkie produkty, bez warunków)**.
4. W polu **Wartość narzutu (%)** wpisz `6`.
5. **Zapisz regułę**.

**Oczekiwane:** komunikat *Reguła dodana*, a w tabeli wiersz z odznaką **GLOBALNY**, wartością
**+6%** i zielonym statusem **aktywny**.

**Teraz sprawdź skutek.** Wejdź w **Katalog** i znajdź produkt zanotowany w sekcji 2. Jego cena
sprzedaży powinna wynosić `cena zakupu × 1,06 × 1,23`, **zaokrąglone w dół**. Dla zakupu
5562,40 zł daje to **7252** zł. Marża pokazuje **6**.

> **Nie zdziw się, jeśli cena się nie zmieniła.** Jeśli produkt miał już dokładnie taką cenę,
> Bridge jej nie przepisuje. Sprawdź na produkcie, który miał inną.

---

### 3.2 ⭐ Symulator — „dlaczego ten produkt ma taką cenę"

To jest narzędzie, które będzie Ci potrzebne najczęściej: pokazuje, **która reguła zadziałała**
i jak z ceny zakupu powstała cena sprzedaży.

1. Zakładka **Narzuty**, pod tabelą: **Symulator ceny**.
2. W polu **Wyszukaj produkt** wpisz rozmiar, markę, model albo fragment nazwy lub kodu.
3. Kliknij produkt z listy.

**Oczekiwane:** rozbicie krok po kroku — *Cena zakupu (baza)* → *Narzut* (z nazwą reguły, która
wygrała) → *Promocja* (albo „brak") → *VAT* → **Cena sprzedaży w katalogu**. Przy każdym kroku
widać, o ile złotych zmieniła się kwota.

**Najważniejszy sprawdzian:** ostatnia linia symulatora — *Cena sprzedaży w katalogu* — musi być
**identyczna** z ceną tego produktu w `/katalog`. Jeśli się różni, to jest błąd i chcemy o nim
wiedzieć od razu.

> Jeśli szukanie zwróci dużo pozycji, zobaczysz *Pokazane pierwsze 50 — zawęź wyszukiwanie*.
> To normalne, wpisz więcej znaków.

---

### 3.3 ⭐ Reguła szczegółowa BIJE globalną — najważniejszy test

To zachowanie zaskakuje najczęściej, więc warto je zobaczyć na własne oczy.

1. Zostaw regułę globalną +6% z 3.1.
2. **Dodaj regułę** drugą: nazwa *MO9 premium*, **odznacz** „Reguła globalna", w warunku wybierz
   typ **Dostawca** i wartość **MO9** (albo innego dostawcę, który masz w katalogu).
3. Wartość narzutu: `20`. **Zapisz**.

**Oczekiwane:**
- produkty dostawcy **MO9** mają cenę liczoną z narzutem **20%**,
- wszystkie pozostałe — dalej **6%**,
- **Symulator** na produkcie MO9 pokazuje w wierszu *Narzut* nazwę **MO9 premium**, a nie
  *Reguła globalna*.

**To jest sedno:** reguła szczegółowa wygrywa **niezależnie od priorytetu**. Nie ma pola
priorytetu w formularzu i to jest zamierzone — o wyborze decyduje szczegółowość, nie kolejność.

---

### 3.4 Warunki łączone „i"

1. **Dodaj regułę**, odznacz „Reguła globalna".
2. Pierwszy warunek: **Kategoria** → wybierz np. *Rolnicze*.
3. **Dodaj warunek** → **Marka** → wybierz np. *BKT*.
4. Wartość `30`, **Zapisz**.

**Oczekiwane:** reguła działa **tylko** na produkty, które są jednocześnie w kategorii
*Rolnicze* **i** marki *BKT*. Produkt spełniający jeden warunek, ale nie drugi, nie łapie się.
W tabeli warunki widać jako dwie odznaki obok siebie.

> **Uwaga na sposób porównania.** *Dostawca* i *Średnica* muszą się zgadzać **dokładnie**
> (`MO5` to nie to samo co `MO`), a *Kategoria*, *Marka*, *Rozmiar*, *Bieżnik*, *Konstrukcja*
> i *VF/IF* łapią **fragment** tekstu. Tak działa stary Bridge.

---

### 3.5 Włączanie i wyłączanie reguły jednym kliknięciem

W tabeli narzutów **kliknij zieloną odznakę „aktywny"**.

**Oczekiwane:** odznaka zmienia się na szarą **nieaktywny**, a ceny w katalogu przeliczają się
tak, jakby tej reguły nie było. Kliknij ponownie — wraca.

To najszybszy sposób sprawdzenia, czy dana reguła faktycznie odpowiada za cenę: wyłącz ją
i zobacz, czy cena się zmieniła.

---

### 3.6 Usunięcie reguły

Kliknij ikonę kosza przy regule.

**Oczekiwane:** reguła znika **od razu, bez pytania o potwierdzenie**, pojawia się komunikat
*Reguła usunięta*, a ceny przeliczają się ponownie.

> **Brak potwierdzenia jest odtworzeniem starego Bridge**, nie przeoczeniem. Jeśli uważasz,
> że powinno pytać — powiedz, to jest do zmiany, ale wymaga świadomej decyzji.

---

### 3.7 Promocje — pierwszy rabat

1. Zakładka **Promocje** → **Dodaj promocję**.
2. Nazwa: *Wyprzedaż testowa*.
3. **Odznacz** „Reguła globalna" i ustaw warunek — np. **Marka** → *BKT*.
   **(To ważne — patrz ostrzeżenie niżej.)**
4. **Rabat (%)**: `10`. Daty zostaw domyślne (dziś → za 30 dni).
5. **Zapisz promocję**.

**Oczekiwane:** wiersz w tabeli z rabatem **−10%**, datami i zielonym statusem **aktywna**.
W katalogu produkty BKT tanieją: `zakup × (1 + narzut) × 0,9 × 1,23`. Symulator pokazuje
promocję w wierszu *Promocja*.

> **⚠ NIE UŻYWAJ „Reguła globalna" przy promocji.** Promocja globalna **nie obniża cen**
> zwykłym produktom — zadziała tylko na pozycje, które nie mają marki ani kategorii. To defekt
> starego Bridge, odtworzony 1:1; opis w [sekcji 4, punkt 4](#4--rzeczy-które-wyglądają-na-błąd-a-są-poprawne).
> Zawsze ustawiaj promocji jakiś warunek.

---

### 3.8 ⭐ Ostrzeżenie przed sprzedażą poniżej kosztu

1. **Dodaj promocję**, ustaw warunek (np. **Marka** → *BKT*), wpisz rabat **90**.

**Oczekiwane — jeszcze zanim klikniesz „Zapisz":** pod polem rabatu pojawia się **czerwony
pasek**: *⚠ UWAGA: N produkt(ów) będzie miało cenę sprzedaży PONIŻEJ ceny zakupu*.

2. Kliknij **Zapisz promocję**.

**Oczekiwane:** okno z listą konkretnych produktów — kod, cena zakupu, cena po rabacie — i pytanie
*Czy na pewno chcesz zapisać tę promocję?*
- **Anuluj** → nic się nie zapisuje, promocji nie ma w tabeli;
- **Zapisz mimo to** → promocja powstaje, ceny lecą w dół.

Zmniejsz rabat do `1` — czerwony pasek powinien zniknąć.

> Ostrzeżenie liczy „ile spadnie cena, którą widzisz dziś w katalogu". To przybliżenie —
> po zapisie backend przelicza ceny od nowa, od ceny zakupu. Tak liczy stary Bridge.

---

### 3.9 ⭐ Wygasła promocja NADAL obniża ceny

To najdziwniejsza rzecz w tej iteracji i jedyna, przy której **dołożyliśmy coś od siebie**.

1. Wejdź w **edycję** promocji utworzonej w 3.7 (ikona ołówka).
2. Ustaw **Datę końca** na dzień z przeszłości, np. `2020-03-31`, a **Datę startu** na
   `2020-01-01`. **Zapisz**.

**Oczekiwane:**
- status w tabeli zmienia się na **zakończona**,
- **ale pod nim pojawia się pomarańczowy znacznik z ostrzeżeniem**: *Wg dat zakończona, ale
  w bazie ma status „aktywna" — NADAL obniża ceny.*,
- i faktycznie: w katalogu produkty **dalej mają obniżoną cenę**.

**Dlaczego tak.** Silnik cen w ogóle nie czyta dat — patrzy wyłącznie na status. Etykieta
„zakończona" wyliczana jest z dat tylko na potrzeby wyświetlania i nigdy nie wraca do bazy.
W starym Bridge wygląda to identycznie, z jedną różnicą: **stary Bridge o tym milczy**, pokazuje
„zakończona" i tyle. Pomarańczowy znacznik to nasz dodatek, żeby ta pułapka przestała być
niewidoczna.

**Żeby naprawdę wyłączyć promocję**, musisz zmienić jej **status**, a nie datę. Dziś robi się to
usunięciem promocji — przełącznika statusu przy promocjach (takiego jak przy narzutach) nie ma.

> Jeśli uznasz, że to powinno działać po ludzku — czyli że upływ daty ma wyłączać promocję —
> powiedz. To jest zapisane jako decyzja do podjęcia, wymaga zmiany w silniku cen.

---

### 3.10 ⭐ Reguły wchodzą do importu — i wygrywają z ceną wpisaną ręcznie

To domyka lukę z Iteracji 3 i jest najważniejszym testem integracyjnym tej iteracji.

1. Upewnij się, że masz **aktywną regułę narzutu** (np. globalną +6% z 3.1).
2. Wgraj cennik wg [instrukcji I3](instrukcja-testow-I3.md), sekcja 2, tak żeby w **Stagingu**
   pojawiły się pozycje.
3. Wejdź w **Staging**, otwórz edycję jednej pozycji i **wpisz ręcznie cenę sprzedaży**, np.
   `9999`. Zapisz.
4. **Zaakceptuj** tę pozycję.
5. Znajdź produkt w **Katalogu**.

**Oczekiwane:** cena sprzedaży **NIE wynosi 9999**. Wynosi tyle, ile wyliczyła reguła —
`zakup × 1,06 × 1,23`, zaokrąglone w dół. **Reguła cenowa nadpisuje cenę wpisaną ręcznie.**

**To jest zamierzone i tak działa stary Bridge**, ale jest zaskakujące, więc warto zobaczyć to
raz na własne oczy: dopóki istnieje pasująca reguła, ręczne wpisanie ceny w stagingu nic nie da.

**Kontrolnie:** usuń wszystkie reguły, powtórz kroki 2–5. Teraz cena wpisana ręcznie **zostaje**,
a pozycja bez wpisanej ceny dostaje stare `zakup × 1,25` z marżą 25.

---

### 3.11 Edycja reguły

1. Kliknij ikonę ołówka przy regule.
2. Zmień wartość narzutu i **Zapisz regułę**.

**Oczekiwane:** komunikat *Reguła zaktualizowana*, nowa wartość w tabeli, przeliczone ceny.
Reguła, która była **nieaktywna**, po edycji **dalej jest nieaktywna** — zapis z formularza nie
włącza jej z powrotem.

> **Formularz pamięta ostatnie wpisy.** Jeśli otworzysz „Dodaj regułę" po wcześniejszej edycji,
> pola mogą być wypełnione poprzednimi wartościami. To zachowanie starego Bridge — pola nie
> czyszczą się same. Przejrzyj je przed zapisem.

---

## 4. ⚠ Rzeczy, które WYGLĄDAJĄ na błąd, a są poprawne

Przeczytaj, zanim coś zgłosisz — to najczęstsze fałszywe alarmy.

**1. Kolumna „Promocja" w Katalogu jest ZAWSZE pusta.**
Nawet gdy promocja działa i obniża ceny. Ta kolumna w starym Bridge **nigdy nie pokazywała
niczego** — czyta pole, którego nikt nie wypełnia. Odtworzyliśmy to 1:1, zamiast po cichu
dorabiać funkcję, której produkcja nie ma. Jeśli chcesz, żeby zaczęła działać, to jest osobna
decyzja i osobna praca po stronie backendu.

**2. Zapis reguły trwa zauważalnie długo.**
Bo przelicza ceny wszystkich ~7 400 produktów. Przycisk pokazuje wtedy *Zapisywanie…* i jest
zablokowany, żeby nie dało się kliknąć dwa razy.

**3. Marża pokazuje procent narzutu, a nie policzoną marżę.**
Przy narzucie 6% w kolumnie marży zobaczysz `6`, choć realna marża liczona z ceny sprzedaży
jest inna. Stary Bridge wpisuje tam wartość narzutu i tak zostało.

**4. ⭐ Promocja z zaznaczoną „Reguła globalna" nie obniża żadnych cen.**
Sprawdzone pomiarem: taka promocja pasuje **wyłącznie** do produktów, które nie mają marki ani
kategorii — czyli praktycznie do niczego. A jednocześnie **ostrzeżenie o sprzedaży poniżej
kosztu traktuje ją tak, jakby obejmowała cały katalog**, więc zobaczysz groźny czerwony pasek
o tysiącach produktów, po czym zapis nie zmieni ani jednej ceny.

To niespójność **starego Bridge**, nie nasza — ostrzeżenie i silnik cen liczą dopasowanie
dwoma różnymi sposobami. Odtworzyliśmy oba 1:1. **Praktyczny wniosek: promocjom zawsze
ustawiaj warunek.** Zgłoszone osobno, czeka na Twoją decyzję, czy prostować.

**5. Status promocji „zakończona", a ceny dalej obniżone.**
Patrz [3.9](#39--wygasła-promocja-nadal-obniża-ceny). Pomarańczowy znacznik przy statusie mówi
wprost, kiedy tak jest.

**6. Promocja z datą startu w przyszłości od razu obniża ceny.**
Ta sama przyczyna: silnik nie czyta dat. Etykieta pokaże **zaplanowana**, znacznik ostrzeże
o rozbieżności, a rabat będzie działał już teraz.

**7. Nie ma pola „priorytet" w formularzu.**
Bo w starym Bridge też go nie ma — jest ukryte. O tym, która reguła wygrywa, decyduje jej
**szczegółowość**, nie priorytet. Przy edycji istniejącej reguły jej priorytet jest zachowywany.

**8. Usunięcie reguły nie pyta o potwierdzenie.**
Zamierzone, patrz [3.6](#36-usunięcie-reguły).

**9. Lista kategorii i marek w warunkach pochodzi tylko z produktów w katalogu.**
Stary Bridge dokłada tam jeszcze słownik atrybutów. Słownika jeszcze nie mamy — wchodzi
w **Iteracji 7**. Skutkiem jest to, że kategorii, której nie ma na żadnym produkcie, nie
wybierzesz z listy.

**10. Reguła z literówką w typie warunku łapie wszystko.**
Jeśli warunek ma nieznany typ, silnik traktuje go jako spełniony. To zachowanie oryginału.
Z poziomu formularza nie da się tego wywołać (typy wybierasz z listy) — ale gdyby taka reguła
trafiła się w danych, tak właśnie zadziała.

---

## 5. Czego jeszcze NIE MA — świadomie

| Czego brakuje | Kiedy |
|---|---|
| Kolumna „Promocja" w Katalogu pokazująca cokolwiek | ⬜ decyzja — w starym Bridge też nie działa |
| Wyłączanie promocji datą (dziś tylko usunięcie) | ⬜ decyzja — wymaga zmiany w silniku cen |
| Przełącznik statusu przy promocjach (jak przy narzutach) | ⬜ decyzja |
| Edycja priorytetu reguły z formularza | ⬜ decyzja — w starym Bridge pole jest ukryte |
| Słownik kategorii i marek w warunkach | Iteracja 7 |
| Widok alertów | Iteracja 6 |
| Atrybuty | Iteracja 7 |

---

## 6. Szybka lista kontrolna

- [ ] Reguła globalna zmienia ceny w katalogu wg formuły (zaokrąglenie **w dół**)
- [ ] **Symulator pokazuje tę samą cenę, co katalog** ⭐
- [ ] Symulator nazywa regułę, która wygrała
- [ ] **Reguła szczegółowa bije globalną** ⭐
- [ ] Dwa warunki działają jak „i", nie jak „lub"
- [ ] Dostawca porównuje się dokładnie, kategoria/marka po fragmencie
- [ ] Kliknięcie w status włącza i wyłącza regułę, ceny idą za tym
- [ ] Usunięcie reguły przelicza ceny
- [ ] Promocja **z warunkiem** obniża ceny
- [ ] **Czerwony pasek ostrzega o sprzedaży poniżej kosztu jeszcze przed zapisem** ⭐
- [ ] Okno potwierdzenia wymienia konkretne produkty; „Anuluj" nic nie zapisuje
- [ ] **Wygasła promocja dalej obniża ceny, a znacznik mówi o tym wprost** ⭐
- [ ] **Reguła nadpisuje cenę wpisaną ręcznie w stagingu** ⭐
- [ ] Bez reguł import wraca do `zakup × 1,25` i marży 25
- [ ] Edycja nieaktywnej reguły nie włącza jej z powrotem
- [ ] Edycja zachowuje priorytet reguły

---

## 7. Jak zgłaszać problemy

Napisz Pawłowi, podając:

1. **Co robiłaś** — konkretny krok z tej instrukcji albo opis kliknięć.
2. **Czego oczekiwałaś** i **co się stało**.
3. **Kod produktu** i **treść reguły** (typ, warunek, wartość) — bez tego trudno odtworzyć.
4. **Godzinę** (z dokładnością do minuty).
5. **Zrzut ekranu**, jeśli coś wygląda nie tak — najlepiej razem z **rozbiciem z Symulatora**.

Najcenniejsze zgłoszenia to trzy:
- **cena z Symulatora różni się od ceny w Katalogu** — to znaczy, że dwa liczniki cen się
  rozjechały i jest to błąd krytyczny;
- **zadziałała inna reguła, niż się spodziewałaś** — zwłaszcza gdy globalna wygrała ze
  szczegółową;
- **reguła nie weszła do importu** — zaakceptowana pozycja dostała cenę `zakup × 1,25` mimo
  istniejącej, aktywnej reguły.
