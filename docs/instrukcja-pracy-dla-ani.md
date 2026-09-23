# Jak zgłaszać uwagi i poprawki

**Dla:** Ania · **Data przygotowania:** 2026-09-24 · **Dotyczy:** nowego Bridge'a, po testach i po przełączeniu

> **To nie jest instrukcja testu.** Instrukcje testów mówią, co sprawdzić. Ta kartka mówi, **co zrobić
> ze znaleziskiem** — czy to błąd, czy „u mnie ma być inaczej", czy tylko pytanie.

---

## Po co ta kartka

Do tej pory poprawka wyglądała tak: zmiana dopisana wprost do plików działającego Bridge'a. Szybko
i bez czekania — to była jej największa zaleta i jednocześnie jej cena.

Od teraz każda uwaga i każda poprawka wchodzi **jedną drogą**: wpisujesz w Claude Code polecenie
`/feature` i opisujesz, co jest nie tak. Wszystko pozostałe — przeczytanie, jak to działało
w starym Bridge'u, pytania do Ciebie, plan, sprawdzenie, wdrożenie — dzieje się po tej komendzie.

**Nie ma drugiej drogi.** Nie ma „popraw mi to szybko w czacie". Niżej jest napisane, dlaczego —
i co dzięki temu dostajesz.

---

## Dlaczego nie poprawiamy już plików produkcji bezpośrednio

Trzy rzeczy, które dziś są w działającym Bridge'u i których nikt nie zauważył przez tygodnie:

- **Kolumna „Konstrukcja opony" pokazuje „—"**, choć poprawka została napisana 1 września.
  Trafiła do pliku, którego przeglądarka nie ładuje — Bridge ma kilka takich plików i tylko jeden
  jest żywy. Poprawka jest, działania nie ma.
- **Komunikat „zapis naukowy ma tylko null cyfr znaczących"** — w miejscu, gdzie powinna być liczba,
  jest słowo „null". Dwie poprawki dołożyły funkcję o tej samej nazwie; druga przesłoniła pierwszą
  i to, co miało policzyć cyfry, zaczęło robić coś zupełnie innego.
- **Kopia zapasowa nazwana `szer_marka`** (czyli „szerokość i marka") w rzeczywistości zmieniała
  zapis rozmiaru w 587 pozycjach i filtr na liście marek. Nazwa mówiła jedno, plik robił drugie.
  Rozkładanie tego zajęło osobne pół dnia.

**To nie kwestia czyjejś pomyłki.** Każda z tych trzech rzeczy była poprawną myślą, zapisaną
w pośpiechu i **wysłaną bez przeczytania przez kogokolwiek innego**. Nie było momentu, w którym
ktoś sprawdza: czy ten plik jest właściwy, czy ta nazwa już nie jest zajęta, czy to nie psuje
czegoś obok. Komenda `/feature` jest dokładnie tym brakującym momentem.

---

## Co dostajesz w zamian

Pięć rzeczy, których przy poprawce wpisanej wprost do plików produkcji nie ma **w ogóle**:

1. **Ktoś czyta stary Bridge, zanim napisze nowy kod.** Mamy zapisane, co stary Bridge odpowiada
   na każdym ekranie — łącznie z nagranymi, prawdziwymi odpowiedziami. Twoje zgłoszenie jest z tym
   porównywane, więc poprawka nie „ulepsza" po cichu czegoś, co u Ciebie działało dobrze.
2. **Pytania dostajesz ZANIM cokolwiek się zmieni.** Jeśli Twoje zgłoszenie da się zrozumieć
   na dwa sposoby, dowiesz się o tym na początku i wybierzesz — a nie po tygodniu, patrząc na efekt,
   którego nie chciałaś.
3. **Plan do zatwierdzenia.** Przed pisaniem kodu dostajesz krótkie podsumowanie: co się zmieni,
   czego świadomie nie ruszamy. Dopóki nie powiesz „tak", nic się nie dzieje.
4. **Sprawdzenie i aktualizacja dokumentacji.** Gotową zmianę czyta drugi, niezależny przebieg,
   a opisy w dokumentach są poprawiane razem z kodem. Bez tego dokumentacja rozjeżdża się z programem
   w ciągu tygodnia i po miesiącu nikt już nie wie, jak to ma działać.
5. **Zmiana wchodzi jako propozycja, nie jako fakt.** Nazywa się to PR — „propozycja zmiany", którą
   widać w całości przed włączeniem i którą da się wycofać jednym kliknięciem. Poprawka wpisana wprost
   do plików produkcji działa od sekundy zapisu i nie ma czego wycofać.

---

## Jak wejść

1. Wejdź na **`claude.ai/code`** i zaloguj się na swoje konto.
2. Wybierz **repozytorium** `bridge` (to nasz zbiór plików z całym nowym Bridge'em i dokumentacją).
3. Wybierz gałąź **`develop`**. „Gałąź" to wersja robocza zbioru plików; `develop` jest tą, na której
   powstaje nowa wersja, i tam trafiają wszystkie nasze zmiany. **Nie zaczynaj pracy na `main`** —
   to gałąź wydana, do niej zmiany dochodzą dopiero po sprawdzeniu.
4. Wpisz **`/feature`** i za nim swoje zgłoszenie. Sesja sama zakłada osobną kopię plików do pracy
   (zobaczysz słowo *worktree* — to właśnie ona). **Dlatego nie da się przypadkiem zepsuć niczyjej
   roboty ani produkcji**: dopóki nie powstanie propozycja zmiany i ktoś jej nie włączy, wszystko
   dzieje się w tej kopii.

To wszystko. Jednej sesji = jedno zgłoszenie; drugą sprawę zgłaszasz od nowa, osobno.

---

## Jak napisać zgłoszenie

Cztery linijki. Wpisujesz je od razu za `/feature`:

| Linijka | Co napisać |
|---|---|
| **Co zrobiłam** | ekran i kliknięcia, po których to zobaczyłaś |
| **Co się stało** | dokładnie to, co widzisz — z liczbą albo z treścią komunikatu |
| **Czego oczekiwałam** | jak to wygląda w starym Bridge'u albo jak ma wyglądać |
| **Zrzut / adres** | zrzut ekranu i adres strony z paska przeglądarki |

**Szablon do skopiowania:**

```
/feature
Co zrobiłam:
Co się stało:
Czego oczekiwałam:
Adres strony:
(zrzut ekranu w załączniku)
```

**Przykład dobry:**

> Co zrobiłam: Katalog, filtr dostawcy MO3, sortowanie po cenie zakupu rosnąco.
> Co się stało: pierwsza pozycja ma cenę 0,00 zł, w starym Bridge'u tej pozycji w ogóle nie było.
> Czego oczekiwałam: pozycje bez ceny zakupu nie powinny wchodzić na listę.
> Adres: test.agritires.eu/katalog?dostawca=MO3

**Ten sam błąd zgłoszony źle:**

> „W katalogu są zerowe ceny, popraw to."

Gubimy trzy rzeczy: **którego dostawcy** to dotyczy (może tylko jednego), **czy to ma znikać
z listy, czy tylko wyglądać inaczej** (to dwie różne poprawki), i **czy stary Bridge robił to samo**
(bo jeśli robił, to być może właśnie tak ma być). Każda z tych trzech rzeczy to runda pytań
do Ciebie — a Ty w tym momencie masz to jeszcze przed oczami i odpowiadasz bez zastanowienia.

⭐ **Zrzut ekranu jest wart więcej niż akapit opisu.** Jeśli masz zrobić jedną rzecz z tej listy,
zrób zrzut.

---

## Trzy rodzaje zgłoszeń

Zanim wyślesz, rozstrzygnij jedną rzecz: **czy nowy Bridge jest zepsuty, czy po prostu robi to,
co robił stary, a Ty chcesz tego inaczej?** To jedyne rozróżnienie, o które Cię prosimy — reszta
jest po naszej stronie.

| Rodzaj | Jak rozpoznać | Co dopisać w zgłoszeniu | Co się stanie |
|---|---|---|---|
| **Błąd** | w starym Bridge'u było inaczej — lepiej | nic, sam opis wystarczy | traktujemy jako usterkę i naprawiamy tak, żeby było jak w starym |
| **Świadoma zmiana** | stary Bridge robił dokładnie to samo, ale to Ci nie odpowiada | **„To zmiana świadoma, nie błąd"** | zapisujemy jako Twoją decyzję na naszej liście zmian, dopiero potem wchodzi do programu |
| **Obserwacja albo pytanie** | nie wiesz, czy to błąd; coś Cię zastanowiło | **„To pytanie, nie zgłoszenie błędu"** | dostajesz odpowiedź na piśmie, a pytanie zostaje w dokumentacji |

Dlaczego to rozróżnienie jest ważne właśnie dla Ciebie: **nowy Bridge domyślnie odtwarza stary
w każdym szczególe.** Jeśli nie powiesz, że chcesz odejścia od starego zachowania, dostaniesz
dokładnie to, co miałaś — i będzie to uznane za poprawne. A jeśli powiesz, to zostaje zapisane jako
Twoja decyzja z datą, więc pół roku później widać, że to był wybór, nie przypadek.

⚠ **Nie musisz nic sama wpisywać na żadną listę.** Wystarczy jedno zdanie w zgłoszeniu; zapisanie
decyzji robi sesja.

**Trzeci rodzaj też idzie przez `/feature`** — nawet zwykłe pytanie. Powód jest praktyczny: odpowiedź
udzielona w czacie ginie razem z czatem, a ta z `/feature` trafia do dokumentacji i za trzy miesiące
nie musisz pytać drugi raz.

---

## Czego nie robimy

Pięć rzeczy. Przy każdej jest napisane, **co się stanie**, jeśli — bo zakaz bez powodu i tak nie działa.

**1. Nie wpisujemy zmian prosto do `develop` ani `main`.** Zmiana idzie jako propozycja (PR),
którą ktoś włącza po przeczytaniu.
*Co się stanie:* zmiana bez propozycji nie zostaje przez nikogo przeczytana i wraca dokładnie ta
sytuacja, od której uciekamy — poprawka w złym pliku, o której wiemy po tygodniach.
⚠ **Uczciwie:** technicznie nikt Ci tego nie zablokuje. Mamy ostrzeżenie przy zapisie i sygnał
w propozycji zmiany, ale to **umowa, nie zamek** — da się ją obejść. Dlatego ją tu opisujemy,
a nie zostawiamy programowi.

**2. Nie pracujemy bezpośrednio na produkcji.** Do przełączenia testujemy na `test.agritires.eu`
(„staging", czyli kopia do testów) — cokolwiek tam zrobisz, produkcji nie dotyka.
*Co się stanie:* stary Bridge jest **zamrożony od 22 września** — nie wchodzą do niego żadne zmiany,
żeby dało się udowodnić, że nowy robi to samo. Jedna poprawka wpisana w starego Bridge'a psuje
to porównanie i nie mamy już czego z czym zestawiać.

**3. Nie uruchamiamy synchronizacji dostawcy z wyłączonym trybem próbnym.** W panelu Selly przy
synchronizacji jest opcja „na próbę" (w kodzie: `dry_run`). Z próbą włączoną nic nie wychodzi
na zewnątrz i możesz klikać.
*Co się stanie z próbą wyłączoną:* program **naprawdę tworzy i zmienia produkty w sklepie**
`agroopony.selly24.pl`. To jedyne miejsce w całym nowym Bridge'u, które wychodzi do świata poza
naszym serwerem, i jedyne, którego nie da się cofnąć z naszej strony.

**4. Nie generujemy pliku CSV „na próbę".** Jeśli chcesz zobaczyć, co jest w pliku dla Selly,
napisz to w zgłoszeniu — sesja zrobi to w bezpiecznym katalogu.
*Co się stanie przy uruchomieniu bez ustawień:* program ma **wpisany na stałe katalog produkcyjny**
i nadpisze tam prawdziwy plik, po który sklep przychodzi codziennie o 12:00. Do tego plik zawiera
kolumnę **`Cena-zakupu`** i leży pod adresem dostępnym z internetu — nadpisany wersją testową jest
zarazem błędny i widoczny na zewnątrz.

**5. Nie wklejamy haseł i kluczy do czatu.** Dotyczy danych logowania do Selly (`SELLY_CLIENT_ID`,
`SELLY_CLIENT_SECRET`) i do hurtowni Agro-Rami (`AGRORAMI_EMAIL`, `AGRORAMI_PASSWORD`).
*Co się stanie:* czat zostaje zapisany, a klucz raz zapisany trzeba wymienić — łącznie z wszystkimi
miejscami, w których jest używany. Jeśli już się wkleiło: **nie usuwaj wiadomości po cichu**,
powiedz Pawłowi. Usunięcie z widoku nie unieważnia klucza, a wymiana zajmuje kwadrans.
*Co zamiast:* sesja potrzebuje wiedzieć, **czy** klucz jest ustawiony, nie jaki jest — i umie
to sprawdzić sama.

---

## Gdy pali się

Po przełączeniu nowy Bridge **jest** produkcją. Jeśli zobaczysz coś, co zatrzymuje sprzedaż —
na przykład **do Selly poszedł plik ze złymi cenami** albo **import wyzerował stany magazynowe** —
to nie jest sytuacja na zgłoszenie z pytaniami i planem.

**Wtedy: dzwoń do Pawła.** Nie naprawiaj sama i nie proś o szybką łatkę — decyzję, czy cofamy
całość, czy poprawiamy w miejscu, podejmuje Paweł i zna koszt obu wariantów.

To jedyne wyjście awaryjne, jakie jest. Nie jest nim czat — **jest nim człowiek.**

Wszystko, co nie zatrzymuje sprzedaży, idzie normalną drogą, przez `/feature`. Nawet jeśli wygląda
groźnie: krzywa kolumna, brzydki komunikat czy zły format ceny mogą poczekać do rana i lepiej,
żeby czekały, niż żeby weszła w nocy poprawka, której nikt nie przeczytał.

---

## Czego się spodziewać po drodze

Cztery momenty, w każdym wiesz, co masz zrobić:

1. **Pytania — na początku, nie na końcu.** Dostajesz listę pytań z wariantami do wyboru, zanim
   powstanie choćby linijka kodu. **Twoja odpowiedź rozstrzyga** — jeśli powiesz, że ma być inaczej
   niż w starym Bridge'u, tak będzie, i zostanie to zapisane jako Twoja decyzja.
2. **Plan do zatwierdzenia.** Kilka zdań: co robimy, jakie decyzje przyjęliśmy, czego świadomie
   nie ruszamy. Twoja odpowiedź to jedno słowo — „go" albo co zmienić. Wcześniej nic się nie zmienia.
3. **Propozycja zmiany (PR) i krótki raport.** Na koniec dostajesz odsyłacz i podsumowanie: co zostało
   zrobione, co wymaga Twojego sprawdzenia, co odłożyliśmy świadomie na później. Między punktem 2 a 3
   sesja pracuje sama i nie zawraca Ci głowy.
4. **Włączenie zmiany robi Paweł.** Propozycja czeka, aż ktoś ją przeczyta i włączy — to ostatni
   moment, w którym da się coś zatrzymać bez kosztów.

**Ile to trwa:** zależy od zgłoszenia i nie chcemy podawać liczby, której nie umiemy dowieść.
Pewne jest za to jedno: **pytania dostajesz na początku**, więc nie czekasz tygodnia, żeby dowiedzieć
się, że zrozumieliśmy Cię inaczej. Jeśli coś pilnie potrzebujesz mieć wcześniej, napisz to
w zgłoszeniu — kolejność ustalamy my, ale tylko jeśli wiemy, co jest dla Ciebie pierwsze.

---

## Do Twojej decyzji

**1. Dostęp do Claude Code.** Ta kartka zakłada, że wchodzisz na `claude.ai/code` **na swoje konto**
i widzisz tam repozytorium `bridge`. Jeśli jeszcze tego nie masz — powiedz, założenie dostępu jest
po naszej stronie i zajmuje chwilę. Wariant zapasowy: piszesz zgłoszenie w formacie z tej kartki
(cztery linijki plus zrzut), a `/feature` odpala Paweł. Tracisz wtedy tylko możliwość odpowiadania
na pytania od razu.

**2. Telefon jako droga awaryjna.** Przyjęliśmy, że przy sytuacji zatrzymującej sprzedaż dzwonisz
do Pawła. Jeśli wolisz inny kanał na takie przypadki — powiedz jaki; ważne, żeby to był **jeden**
ustalony kanał, a nie „gdzie się da".
