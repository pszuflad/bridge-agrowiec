# Iteracja 15 — co z Twoich wrześniowych zmian jest już w nowym Bridge

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-24 · **Dla:** Ani

> **To jest STAGING, nie produkcja.** Cokolwiek tu klikniesz, produkcji nie dotyka.

---

## Po co ta kartka

We wrześniu wprowadziłaś na produkcji szereg zmian. **Odtworzyliśmy je w nowym Bridge — ta kartka
mówi, gdzie je zobaczyć.** Każdy punkt jest w układzie: *co zmieniliśmy → polecenie → rezultat*.

**Czym ta kartka NIE jest.** To nie jest test systemu. Nie przechodzisz importu od początku do końca
ani nie sprawdzasz ekranów po kolei — do tego są osobne kartki:

| Kartka | O czym |
|---|---|
| **ta** | co z Twoich wrześniowych zmian jest już w nowym Bridge |
| [Ścieżka krytyczna](instrukcja-testu-sciezki-krytycznej.md) | import → parsery → baza → CSV → Selly, od początku do końca |
| [Pełny test](instrukcja-pelnego-testu.md) | reszta systemu, ekran po ekranie |

**Kolejność:** najpierw ta, potem ścieżka krytyczna, potem reszta. Tam, gdzie tematy się pokrywają
(MO9, Staging, CSV), zostawiamy tu samo „jest teraz tak" i odsyłamy dalej.

**Ile to zajmuje:** około 30 minut. Wszystko poza punktem 1.3 robisz samym klikaniem w panelu.

> **⚠ Trzy punkty odwołują nasze wcześniejsze obietnice.** Dostałaś kiedyś inną informację i ona już
> nie obowiązuje. Są oznaczone **⚠ SPROSTOWANIE** i zebrane w rozdziale 3.

### Jak wypełniać

Punkt kończy się linijką **Twoja ocena**:

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

Przy „ŹLE" napisz, **co zobaczyłaś zamiast** oczekiwanego, i zrób zrzut ekranu. Zbiorcza tabelka
jest w rozdziale 5. **Punkty ⭐ są najważniejsze** — jeśli masz mało czasu, zrób 1.1, 1.4 i 1.5.

---

## Warunki — stan stagingu na 24 września

| Co | Stan |
|---|---|
| Baza | kopia produkcji z **23.09**, 8329 produktów — Twoje wrześniowe poprawki danych są już w środku |
| Import (pobieranie cenników po URL) | **włączony** |
| MO9 (Agro-Rami) — hasła do API | **uzupełnione**, więc import MO9 da się wywołać (punkt 1.3) |
| Selly | **wyłączone trzema blokadami** — tryb, harmonogram i brak sekretów |

**Co z tego wynika dla Selly (punkt 1.8).** Na stagingu **nie sprawdzisz** ani torów API, ani tego,
czy sklep zaciąga plik. To jest do sprawdzenia dopiero po przełączeniu na produkcję — i tak jest
celowo, żeby staging nie zapisywał niczego do prawdziwego sklepu.

---

# 1. Twoje wrześniowe zmiany

## 1.1 ⭐ Blokowane formy płatności — nowa kolumna w Katalogu

**Co zmieniliśmy.** W Katalogu przybyła kolumna **„Blokowane formy płatności"**, a w pliku CSV
dla Selly — 60. kolumna `Blokowane-formy-platnosci`.

**Polecenie.**
1. Menu → **Katalog**.
2. Znajdź dowolny produkt dostawcy **MO1–MO5** albo **MO7–MO10**. Spójrz na kolumnę
   **„Blokowane formy płatności"**.
3. Teraz znajdź produkt dostawcy **MO6 (Uniglory)**.

**Rezultat.**
- krok 2: kolumna pokazuje **listę numerów** form płatności oddzielonych przecinkami — dla MO1
  jest to `203, 204, 205, … 219`. **Każdy dostawca ma inny zestaw** i ma się on zgadzać z tym,
  co dziś pokazuje produkcja. Jeśli kolumna jest za wąska, najedź na nią myszą — pełna lista
  pokaże się w dymku;
- krok 3: przy MO6 (i przy dostawcy spoza listy) kolumna pokazuje **„—"**.

> **⚠ To mają być numery, a nie nazwy form płatności.** Kolumna pokazuje identyfikatory
> z Selly — dokładnie tak, jak dziś na produkcji. **Nie zgłaszaj tego jako błędu.** Jeśli wolisz
> widzieć nazwy zamiast numerów, to osobna decyzja: punkt **4.6**.

**Kolumny nie musisz włączać** — jest widoczna od razu, także jeśli masz zapisane własne ustawienia
kolumn z wcześniejszych testów.

> **⚠ Dwie rzeczy, które wyglądają na brak, a są poprawne.**
> 1. Wartość liczy się **w Twojej przeglądarce**, a nie przychodzi z serwera — dokładnie tak samo
>    jak dziś na produkcji. Nie da się jej sprawdzić przez API.
>    **MO6 nie ma wpisu celowo** („nie będzie na razie w sprzedaży", Twój wpis z 10.09).
> 2. **Pliku CSV nie pobierzesz z panelu** — nie ma takiego przycisku i nigdy nie było. Plik powstaje
>    na serwerze o 6:00, a Selly zabiera go o 12:00. Zawartość CSV (w tym pełne nazwy kategorii:
>    **„Opony rolnicze"** zamiast „Rolnicze", **„Opony leśne"**, **„Opony przemysłowe"**,
>    **„Opony ciężarowe"**) sprawdzasz w [ścieżce krytycznej](instrukcja-testu-sciezki-krytycznej.md),
>    nie tutaj.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.2 „Ładowarka" zniknęła z zastosowań rolniczych

**Co zmieniliśmy.** W kategorii **Rolnicze** zastosowanie „Ładowarka" nie jest już dopuszczalną
wartością — import zamienia ją na **„Ciągnik"** (razem z wariantami „ładowarka kołowa"
i „ładowarka rolnicza"). W **Przemysłowych** „Ładowarka" zostaje bez zmian.

**Polecenie.**
1. Menu → **Katalog** → filtr **Kategoria** → zaznacz **Rolnicze**.
2. Przejrzyj kolumnę **„Zastosowanie"**.
3. Zmień filtr **Kategoria** na **Przemysłowe** i znowu spójrz na tę kolumnę.

**Rezultat.**
- krok 2: **ani jednego** „Ładowarka". Produkty, które ją miały, pokazują **„Ciągnik"**.
  W Rolniczych zostaje siedem wartości: *Ciągnik · Kombajn · Opryskiwacz · Przyczepa ·
  Kosiarka/ogród · Wózek widłowy · Uniwersalne/pozostałe*;
- krok 3: w Przemysłowych **„Ładowarka" nadal jest** — i tak ma być.

Na produkcji przestawiło to 265 rekordów. Baza stagingu jest kopią produkcji z 23.09, więc zmiana
jest już w danych — nie musisz niczego importować, żeby ją zobaczyć.

> **⚠ Filtra „Zastosowanie" nie ma** i nie jest to przeoczenie — w panelu filtruje się po
> **Kategorii**, a zastosowanie się ogląda w kolumnie. Szukajka też po nim nie szuka. Tak samo
> jest na produkcji.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.3 MO9 — opony do quadów i kosiarek nie wchodzą do katalogu

**Co zmieniliśmy.** Import MO9 odrzuca teraz całą kategorię **„Opony do quadów i kosiarek"** po jej
stałym numerze u dostawcy, a nie po szukaniu słowa „quad" w nazwie — więc nie przecieka już nic,
co tego słowa w nazwie nie ma.

**Polecenie.**
1. Menu → **Konfiguracja** → zakładka **Dostawcy**.
2. Wiersz **MO9 (Agrorami)** → przycisk **„Synchronizuj"**.
3. Poczekaj na koniec importu i spójrz na wynik.

**Rezultat.** Import **kończy się bez błędu** i wciąga jakieś pozycje. Tyle sprawdzamy.

> **Stanów magazynowych tu nie sprawdzamy** — zgodnie z Twoją odpowiedzią z 22.09 („trzeba ufać").
> Ten punkt ma tylko potwierdzić, że import MO9 w ogóle przechodzi. Dla porównania: na produkcji
> 17.09 przyszło 1114 pozycji, z czego 991 weszło, a 123 zostały odrzucone.
>
> MO9 to **jedyny dostawca z API** — pliku mu nie wgrasz. Pełny scenariusz jest w
> [ścieżce krytycznej](instrukcja-testu-sciezki-krytycznej.md).

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.4 ⭐ ⚠ SPROSTOWANIE — szerokość jest teraz zapisywana bez końcowych zer

> **Obiecaliśmy Ci co innego.** W [instrukcji do Iteracji 3](instrukcja-testow-I3.md), rozdział 4
> („Rzeczy, które WYGLĄDAJĄ na błąd"), punkt 3, napisaliśmy, że nowe importy zapisują szerokość
> *„poprawnie (`620`, `14.9`, `10.00`)"* — czyli że **`10.00` zostaje**. **To już nieaktualne.**

**Co zmieniliśmy.** Końcowe zera są obcinane: **`10.00` i `10.0` zapisują się jako `10`**. Zmienia
się sam zapis, nie wartość opony.

**Polecenie.** Menu → **Katalog** → kolumna **„Szerokość"**. Przejrzyj kilkanaście pozycji
różnych dostawców.

**Rezultat.** Szerokości bez końcowych zer — `10` zamiast `10.00`, `14.9` bez zmian. Na wzorcu
dziesięciu dostawców przestawiło to 172 pozycje u dziewięciu z nich (wszyscy poza MO6).

> **To działa też na Twoją korzyść, w miejscu, którego się nie spodziewasz.** Katalog trzymał `10`,
> a cennik przysyłał `10.0` — i sama ta różnica w zapisie robiła z pozycji „zmianę do decyzji",
> którą ktoś musiał ręcznie przeklikać. Teraz obie strony mają ten sam zapis i pozycja przechodzi
> bez zatrzymania. **Powinnaś zauważyć mniej pozycji w „Do zatwierdzenia"** — u Trelleborga i GRI
> wyraźnie.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.5 ⭐ ⚠ SPROSTOWANIE — błędny EAN blokuje akceptację, zamiast wchodzić jako puste pole

> **Obiecaliśmy Ci co innego.** W [instrukcji do Iteracji 3, wersja 2](instrukcja-testow-I3-v2.md),
> punkt 4.3, napisaliśmy, że EAN zepsuty zapisem naukowym *„ma trafiać do Katalogu jako **PUSTE
> pole**"*. **To już nieaktualne** — Twoja wrześniowa wersja zastąpiła tamto rozwiązanie.

**Co zmieniliśmy.** EAN w zapisie naukowym (np. `6,41944E+12`) **nie wchodzi już po cichu jako puste
pole** — zatrzymuje akceptację zgłoszenia, dopóki ktoś nie poprawi numeru ręcznie.

**Polecenie.**
1. Menu → **Staging**. Znajdź zgłoszenie z błędnym EAN-em.
2. Spróbuj je zaakceptować.

**Rezultat.** Zgłoszenie **nie zostaje zaakceptowane**. Pojawia się okno **„Nie zapisano zmian"**
z komunikatem:

> „Błędny EAN: popraw numer w edycji zgłoszenia przed akceptacją."

Popraw numer w edycji zgłoszenia i zaakceptuj jeszcze raz — wtedy przechodzi.

**Przy okazji: przycisk „Rozstrzygnij".** Na Stagingu, w kolumnie **„Akcje"**, tuż za „Szczegóły",
jest przycisk **„Rozstrzygnij"** (czasem podpisany „Sprawdź kartę"). Otwiera okno w jednej z trzech
postaci, zależnie od sprawy: stara karta produktu · niejednoznaczne dopasowanie · sprzeczne wiersze
z jednego pliku (sam podgląd). Pełny scenariusz Stagingu jest w
[ścieżce krytycznej](instrukcja-testu-sciezki-krytycznej.md).

> **⚠ Wyjątek, który jest poprawny.** Pozycje typu „Brak w cenniku" (punkt 1.6) blokady EAN **nie
> mają** — ich EAN i tak nie jedzie do katalogu.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.6 „Wycofane" nazywają się teraz „Braki w cenniku"

**Co zmieniliśmy.** **Tylko nazwę — w czterech miejscach.** Żadnej nowej kolumny, przycisku ani
okna. To jest to samo, co znałaś jako „Wycofane".

| Gdzie | Było | Jest |
|---|---|---|
| Staging → filtr **„Typ sprawy"** | „Wycofane" | **„Braki w cenniku"** |
| Staging → odznaka przy wierszu | „Wycofana" | **„Brak w cenniku"** |
| Wgrywanie cenników → podsumowanie po imporcie | „Wycofane: 3" | **„Braki w cenniku: 3"** |

**Polecenie.**
1. Menu → **Staging** → rozwiń **„Typ sprawy"** → wybierz **„Braki w cenniku"**.
2. Menu → **Konfiguracja** → **Wgrywanie ręczne** → wgraj cennik i spójrz na podsumowanie.

**Rezultat.** Lista pokazuje pozycje, których dostawca nie przysłał — te same co dawne „Wycofane",
każda z czerwoną odznaką **„Brak w cenniku"**. Podsumowanie importu liczy je jako
*„Braki w cenniku: N"*.

> **⚠ Pusta lista jest tu NORMALNA — nie zgłaszaj jej jako awarii.** Zobaczysz zwykłe
> *„Brak elementów do wyświetlenia"*. Wiersze „Brak w cenniku" powstają tylko w przebiegu
> weryfikacyjnym (trzy różne kompletne oferty i minimum 24 h między potwierdzeniami), a nie
> w zwykłym imporcie — zwykły import po prostu wstrzymuje produkt. Na świeżej bazie stagingu ta
> lista **będzie pusta** i tak ma być.
>
> Jeśli przy akceptacji zobaczysz *„Brak trzech wiarygodnych potwierdzeń nieobecności. Wczytaj
> aktualny cennik."* — to znaczy, że pozycja nie zebrała jeszcze trzech potwierdzeń. Nie ma czego
> naprawiać, trzeba wczytać aktualny cennik.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.7 Uszkodzony cennik zatrzymuje import, zamiast wejść połową

**Co zmieniliśmy.** Jeśli plik cennika ma błędy odczytu, import **zatrzymuje się w całości**,
zamiast wciągnąć część pozycji.

**Polecenie.** Menu → **Konfiguracja** → **Wgrywanie ręczne** → wgraj uszkodzony plik (albo poczekaj,
aż trafi się taki z automatu).

**Rezultat.** Komunikat:

> „Błędy odczytu cennika (N). Import zatrzymany bez przełączania na stary format."

Katalog zostaje nietknięty. **Pusty cennik** nadal daje dotychczasowy komunikat o braku pozycji —
to osobna sprawa.

Wcześniej taki plik wchodził częściowo, a po trzech takich przebiegach katalog dostawcy potrafił
zostać wycofany.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 1.8 Selly — nocna synchronizacja i co się dzieje w ciągu dnia

**Co zmieniliśmy.** Odtworzyliśmy oba tory wysyłania danych do Selly:

| Tor | Kiedy | Co robi |
|---|---|---|
| **W ciągu dnia** | co godzinę o **HH:55**, z dogrywkami o HH:10, HH:25 i HH:40 | wysyła zmiany cen i stanów |
| **Nocny, pełny** | **04:30**, po jednym dniu na dostawców | pn MO1+MO2 · wt MO3+MO4 · **śr MO5+MO6** · czw MO9 · pt MO10 · pierwsza sobota MO7 · pierwsza niedziela MO8 |

**Polecenie.** Menu → **Selly**. Rozejrzyj się po ekranie, ale **niczego nie wysyłaj**.

**Rezultat.** Ekran działa i pokazuje stan pliku CSV oraz dziennik. **Obu torów z tabelki wyżej tu
nie uruchomisz** — chodzą wyłącznie z harmonogramu, a na stagingu Selly jest wyłączone. Do
sprawdzenia dopiero po przełączeniu na produkcję, razem ze
[ścieżką krytyczną](instrukcja-testu-sciezki-krytycznej.md).

> **⚠ Przyciski, które na tym ekranie zobaczysz, to COŚ INNEGO niż te dwa tory.** Na ekranie
> **Selly** są *„Test dry-run (5 szt.)"* i *„Wyślij do Selly"* — to ręczna wysyłka jednego dostawcy,
> ta sama, którą znasz z produkcji. **Nocna synchronizacja i ta w ciągu dnia nie mają żadnego
> przycisku** — ani u nas, ani na produkcji. Jeśli chciałabyś móc je odpalić ręcznie, to osobna
> decyzja: punkt **4.3**.
>
> **Nie klikaj „Wyślij do Selly" na produkcji „żeby zobaczyć, co będzie"** — to zapisuje do
> prawdziwego sklepu. Na stagingu jest bezpiecznie, bo Selly jest wyłączone i zobaczysz tylko błąd.
>
> **Dwie rzeczy nie zgadzają się z Twoim opisem** — patrz punkty **4.1** i **4.2**.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 2. Przy okazji — rzeczy, o które nie pytałaś

Te dwie zmiany zrobiliśmy my, nie Ty. Zobaczysz je przy okazji, więc lepiej, żebyś wiedziała.

## 2.1 ⚠ SPROSTOWANIE — pliki CSV z Analityki są teraz pełne

> **Odpowiedziałaś 23.09** na nasze pytanie z Iteracji 10: *„chcę pełne pliki"*. Zrobiliśmy to —
> i przy okazji **unieważnia to zdanie** z [instrukcji do Iteracji 10, wersja 2](instrukcja-testow-I10-v2.md),
> punkt 1.3: *„Plik ma tyle wierszy, ile mówi stopka"*.

**Co zmieniliśmy.** Plik z karty, która ma ograniczenie, zawiera teraz **wszystkie wiersze po
filtrach**, a nie tylko te, które zmieściły się w tabeli.

| Karta | Plik miał | Plik ma |
|---|---|---|
| 2.5 Pozycje unikalne | 1000 | **5109** |
| 4.1 Historia dostępności · 4.2 Tempo schodzenia *(zakładka „Dostępność”)* | po 500 | **po 5184** |
| 1.2 Nowości i wycofania | 500 | **1716** |
| 3.1 Zmiany cen | 500 | **1644** |
| Rotacja | 1000 | **1100** |

Karty **EAN wspólne** (769) i **Marża** (335) mieściły się w limicie — u nich plik się nie zmienił.

**Polecenie.** Menu → **Analityka** → zakładka **„EAN i ceny”** → karta **2.5 Pozycje unikalne** →
przycisk **CSV**. Otwórz plik i sprawdź liczbę wierszy.

**Rezultat.** Plik ma **więcej wierszy, niż mówi stopka tabeli**.

> **⚠ Trzy rzeczy, które wyglądają na błąd, a są poprawne.**
> 1. **Plik jest większy niż liczba w stopce** — to jest właśnie sens tej zmiany.
> 2. **Tabela nadal pokazuje najwyżej 300 wierszy**, stopka nadal mówi *„Pokazano 300 z N…"*,
>    a kafel „Pozycje unikalne" nadal liczy do 1000. Ekran się nie zmienił — zmienił się plik.
> 3. **Przycisk CSV na chwilę gaśnie i pokazuje kręciółkę** — dociąga pełne dane osobnym
>    zapytaniem. Jeśli coś pójdzie nie tak (np. wygaśnie sesja), zobaczysz komunikat, a plik
>    **nie powstanie**. Wcześniej po cichu zapisałby się plik ucięty.
>
> Liczby w tabeli zmierzyliśmy na starszej kopii bazy — na dzisiejszym stagingu będą **wyższe**.
> Mechanizm jest ten sam.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 2.2 Kolejka „Do akceptacji" w Atrybutach jest krótsza o 526 pozycji

**Co zmieniliśmy.** Pozycja, której wartość **już jest w słowniku**, znika z kolejki zamiast
podpowiadać samą siebie ze 100% pewności. Na danych z produkcji dotyczy to **526 pozycji**.

**Polecenie.** Menu → **Atrybuty** → kolejka **„Do akceptacji"**.

**Rezultat.** Kolejka jest **wyraźnie krótsza**, niż pamiętasz z produkcji.

> **⚠ Nic nie zostało usunięte z katalogu.** Zniknęły wyłącznie podpowiedzi, które nie miały czego
> podpowiadać — wartość i tak była już w słowniku. Żaden produkt ani żadna wartość słownika nie
> ubyły.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 3. Co przestało być prawdą

Trzy zdania z wcześniejszych kartek są nieaktualne. **Reszta tamtych dokumentów obowiązuje.**

| Gdzie to napisaliśmy | Co mówiło | Jak jest teraz |
|---|---|---|
| [Iteracja 3](instrukcja-testow-I3.md), rozdz. 4 pkt 3 | nowe importy zapisują szerokość *„poprawnie (`620`, `14.9`, `10.00`)"* — czyli `10.00` zostaje | Końcowe zera są obcinane: `10.00` → `10` — **punkt 1.4** |
| [Iteracja 3 v2](instrukcja-testow-I3-v2.md), pkt 4.3 | EAN zepsuty zapisem naukowym *„ma trafiać do Katalogu jako **PUSTE pole**"* | EAN naukowy **blokuje akceptację** zgłoszenia — **punkt 1.5** |
| [Iteracja 10 v2](instrukcja-testow-I10-v2.md), pkt 1.3 | *„Plik ma tyle wierszy, ile mówi stopka"* | Plik ma **wszystkie** wiersze po filtrach, zwykle więcej niż stopka — **punkt 2.1** |

> **Czy któryś z tych punktów zachowuje się u Ciebie nadal po staremu?**
> ☐ nie ☐ tak — który: _______________

---

# 4. Do Twojej decyzji

Pięć rzeczy, w których nowy Bridge zachowuje się wiernie wobec produkcji, ale **rozjeżdża się z tym,
co nam opisałaś** albo bywa mylące. Niczego tu nie zmieniamy z własnej inicjatywy — zaznacz, co robimy.

## 4.1 Godzina nocnej synchronizacji Selly

Mówiłaś, że pełna synchronizacja idzie **„w nocy między 3 a 4 rano"**. W kodzie produkcji stoi
**04:30** i to odtworzyliśmy.

☐ zostaw 04:30 ☐ przestaw na godzinę: _______ ☐ porozmawiajmy o tym

## 4.2 Środa — MO5 czy MO5 i MO6?

Twoja specyfikacja podaje dla środy samo **MO5**. Kod produkcji robi w środę **MO5 i MO6** — i tak
jest u nas.

☐ zostaw MO5+MO6 ☐ ma być samo MO5 ☐ porozmawiajmy o tym

## 4.3 Brak przycisków synchronizacji Selly w panelu

Oba tory z punktu 1.8 (ten w ciągu dnia i nocny) chodzą **wyłącznie z harmonogramu** — nie ma
przycisku, żeby je odpalić ręcznie. Przyciski na ekranie Selly (*„Wyślij do Selly"*) robią co innego:
wysyłają jednego wybranego dostawcę. Tak jest dziś na produkcji i tak odtworzyliśmy. Po stronie
serwera wszystko jest gotowe, brakuje tylko przycisków.

☐ zostaw jak jest ☐ dorób przyciski (powiedz, na którym ekranie) ☐ porozmawiajmy o tym

## 4.4 Pusta lista „Braki w cenniku" nic nie tłumaczy

Gdy braków nie ma, ekran mówi tylko *„Brak elementów do wyświetlenia"* — bez wyjaśnienia, że lista
zapełnia się dopiero po przebiegu weryfikacyjnym. Produkcja zachowuje się tak samo.

☐ zostaw jak jest ☐ dopisz krótkie wyjaśnienie na pustym ekranie ☐ porozmawiajmy o tym

## 4.5 Nie widać, dlaczego pozycja czeka na potwierdzenia

System liczy i przechowuje dowody nieobecności (trzy oferty, odstęp 24 h, źródła), ale **nigdzie ich
nie pokazuje** — produkcja też nigdy ich nie pokazywała. Jedyne, co zobaczysz, to komunikat przy
próbie akceptacji.

☐ zostaw jak jest ☐ pokaż dowody w oknie „Rozstrzygnij" ☐ porozmawiajmy o tym

## 4.6 Blokowane formy płatności pokazują numery, nie nazwy

Kolumna w Katalogu i w pliku CSV pokazuje **identyfikatory** form płatności (`203, 204, …`),
bo tak trzyma je Selly i tak robi dzisiejsza produkcja. Nigdzie nie mamy listy „numer → nazwa",
więc żeby pokazać nazwy, musiałabyś nam ją podać.

☐ zostaw numery ☐ chcę nazwy — podam listę numer→nazwa ☐ porozmawiajmy o tym

---

# 5. Podsumowanie

| Punkt | Co sprawdzasz | OK | ŹLE | Uwagi |
|---|---|:--:|:--:|---|
| **1.1** ⭐ | Kolumna „Blokowane formy płatności"; MO6 → „—" | ☐ | ☐ | |
| 1.2 | Rolnicze bez „Ładowarki", Przemysłowe z „Ładowarką" | ☐ | ☐ | |
| 1.3 | Import MO9 przechodzi bez błędu | ☐ | ☐ | |
| **1.4** ⭐ | Szerokość bez końcowych zer; mniej pozycji do zatwierdzenia | ☐ | ☐ | |
| **1.5** ⭐ | Błędny EAN blokuje akceptację; przycisk „Rozstrzygnij" jest | ☐ | ☐ | |
| 1.6 | Filtr i odznaka „Braki w cenniku"; pusta lista = poprawnie | ☐ | ☐ | |
| 1.7 | Uszkodzony cennik zatrzymuje import w całości | ☐ | ☐ | |
| 1.8 | Ekran Selly działa; oba tory bez przycisków, na stagingu wyłączone | ☐ | ☐ | |
| 2.1 | Plik CSV z Analityki większy niż stopka tabeli | ☐ | ☐ | |
| 2.2 | Krótsza kolejka w Atrybutach; katalog nietknięty | ☐ | ☐ | |
| 3 | Żadne z trzech unieważnionych zdań nie działa po staremu | ☐ | ☐ | |

**Sprawdzonych ____ / 11 · błędów ____ · pominiętych ____ · decyzji z rozdz. 4 ____ / 6**

---

# 6. Jak zgłosić znalezisko

Zasady są w osobnej kartce: [Jak zgłaszać uwagi](instrukcja-pracy-dla-ani.md). W skrócie — podaj
**numer punktu i kroku**, ekran, **czy miałaś włączone filtry**, co zobaczyłaś zamiast oczekiwanego,
godzinę i zrzut ekranu. Przy problemie z plikiem **załącz plik** i napisz, w czym go otwierałaś.

**Najpierw sprawdź ramki ⚠ przy punkcie.** Siedem rzeczy w tej kartce wygląda na błąd, a jest
poprawnych:

1. **numery zamiast nazw** w kolumnie blokowanych form płatności, i **„—"** przy MO6 (1.1);
2. **brak filtra „Zastosowanie"** w Katalogu (1.2);
3. **pusta lista „Braki w cenniku"** (1.6);
4. **brak przycisku dla nocnej synchronizacji Selly** — przyciski na ekranie Selly robią co innego (1.8);
5. **plik CSV większy niż liczba w stopce tabeli** (2.1);
6. **tabela Analityki nadal pokazuje 300 wierszy**, choć plik ma wszystkie (2.1);
7. **krótsza kolejka w Atrybutach** (2.2).
