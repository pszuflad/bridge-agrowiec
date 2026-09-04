# Iteracja 8 (Selly + eksport CSV) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-04

> **⚠ TA ITERACJA JEST INNA NIŻ WSZYSTKIE POPRZEDNIE. Przeczytaj tę ramkę do końca.**
>
> Wszystkie dotychczasowe instrukcje zaczynały się od zdania „to jest staging, testuj bez
> skrupułów". **Tutaj to nieprawda.** Panel Selly potrafi wyjść poza staging i **naprawdę
> tworzyć oraz zmieniać produkty w sklepie Selly** — a sklep Selly jest jeden i jest
> prawdziwy. Staging i produkcja mogą pokazywać na ten sam sklep.
>
> Jeden przycisk w tym panelu — **„Wyślij do Selly"** — jest nieodwracalny z poziomu Bridge'a.
> Nie ma „cofnij".
>
> Dlatego zanim cokolwiek klikniesz, ustalcie z Pawłem, **w którym z trzech trybów pracujesz**
> ([sekcja 2](#2--trzy-tryby-testowania--ustal-to-przed-pierwszym-kliknięciem)). W trybie
> domyślnym (bez danych dostępowych) **nie da się nic zepsuć** i większość tej instrukcji
> i tak przetestujesz.

---

## 1. Co dowozi Iteracja 8

Dwie rzeczy:

- **Nowy ekran „Selly"** (`/selly`, ostatnia pozycja w menu po lewej) — do tej pory ten panel
  w ogóle nie był częścią aplikacji. Doklejał go z boku osobny skrypt; teraz jest normalnym
  ekranem, jak Katalog czy Analityka. **Ma robić dokładnie to samo, co robił wcześniej** —
  nic nowego, nic mniej.
- **Przycisk pobierania CSV w Katalogu** — funkcja, która była w starym Bridge'u, ale przy
  przepisywaniu katalogu została odłożona na później. To „później" jest teraz.

**Sedno do sprawdzenia — pięć rzeczy:**

1. **Ekran Selly pokazuje to samo, co stary panel** — te same pięć sekcji, te same liczby,
   te same napisy.
2. **Przed wysyłką do Selly pojawia się pytanie „na pewno?"** — tego wcześniej **nie było**.
   To jedyna celowa zmiana zachowania i chcemy wiedzieć, czy nie przeszkadza.
3. **Test „dry-run" naprawdę niczego nie wysyła** — to Twoja siatka bezpieczeństwa.
4. **Przycisk CSV w Katalogu tworzy plik, który otwiera się w Excelu poprawnie** — z polskimi
   znakami i podziałem na kolumny.
5. **Nazwa przycisku CSV Cię zaskoczy i to jest poprawne.** Domyślnie brzmi
   „Pobierz CSV (15 kol.)", a nie „Pobierz CSV (Shoper)". Wyjaśnienie: **sekcja 8.1**.

---

## 2. ⚠ Trzy tryby testowania — ustal to przed pierwszym kliknięciem

Panel Selly ma **dziesięć operacji**. Dzielą się na dwie grupy i to jest najważniejsza rzecz
do zrozumienia:

| Grupa | Ile | Co robią | Czy potrzebują połączenia z Selly |
|---|---|---|---|
| **Lokalne** | 4 | czytają bazę Bridge'a i plik CSV na serwerze | **NIE** — działają zawsze |
| **Zewnętrzne** | 6 | rozmawiają z prawdziwym API sklepu Selly | **TAK** — bez danych dostępowych zwracają błąd |

Lokalne to: **stan mapowania dostawców, historia operacji, status pliku CSV i generowanie CSV**.
Zewnętrzne to m.in. **test połączenia i cała synchronizacja produktów**.

### Tryb A — bez danych dostępowych (domyślny, **całkowicie bezpieczny**)

Nic nie ustawiasz. Tak staging wygląda dziś, jeśli nikt nie zmieniał konfiguracji.

- ✅ Przetestujesz: **trzy z pięciu sekcji** panelu, całą sekcję CSV, historię operacji,
  mapowanie dostawców i **cały przycisk CSV w Katalogu**.
- ✅ Przetestujesz też **komunikat o braku konfiguracji** — sekcja 4.1.
- ❌ Nie przetestujesz: testu połączenia i synchronizacji produktów.
- 🔒 **Ryzyko: zero.** Nie ma fizycznej możliwości, żeby cokolwiek poszło do Selly.

**Zacznij od tego trybu.** Przejdź sekcje 3, 4, 6 i 7 — to jakieś 80% instrukcji.

### Tryb B — podłączony, ale tylko do odczytu i „na sucho"

Paweł wpisuje dane dostępowe na serwerze, a Ty **używasz wyłącznie**:
przycisku **„Odśwież"**, sekcji **„Status połączenia"** i przycisku **„Test dry-run (5 szt.)"**.

- ✅ Dokładasz: test połączenia i pełną ścieżkę przygotowania danych do wysyłki.
- ❌ **Nie klikasz „Wyślij do Selly" ani „Sync" w tabeli.**
- 🔒 Ryzyko: niskie, ale **nie zerowe** — patrz ostrzeżenie o pierwszym dry-runie w
  [sekcji 5.2](#52-test-dry-run-5-szt--siatka-bezpieczeństwa).

### Tryb C — pełny zapis do sklepu

Wysyłasz produkty naprawdę. **Tylko po wyraźnym ustaleniu z Pawłem i tylko na sklepie,
na którym wolno to robić.**

- 🔒 **Ryzyko: realne i nieodwracalne z poziomu Bridge'a.**

### A co z sandboxem?

Pytanie „podpiąć do sandboxa czy do prawdziwego sklepu" pada naturalnie — i tu trzeba
powiedzieć wprost, jak jest:

> **Bridge nie ma i nigdy nie miał żadnego sandboxa Selly.** W kodzie jest jedno pole na adres
> sklepu (`SELLY_SHOP_URL`) i tyle. Stary Bridge miał ten adres wpisany na sztywno w kodzie —
> odbudowa przeniosła go do konfiguracji, więc **da się** wskazać inny sklep, ale żaden „testowy
> Selly" nie jest nigdzie przygotowany ani skonfigurowany.

Masz więc trzy możliwości, w kolejności od najbezpieczniejszej:

1. **Tryb A (bez danych dostępowych)** — to jest praktyczny odpowiednik sandboxa i pokrywa
   większość tej instrukcji. **Rekomendacja: zacznij tutaj.**
2. **Zapytać Selly.pl, czy udostępniają instancję testową.** Jeśli tak — jej adres wpisuje się
   w `SELLY_SHOP_URL` i wtedy nawet tryb C jest bezpieczny. *Nie wiem, czy Selly.pl coś takiego
   oferuje — tego trzeba się dowiedzieć u nich, nie w tym repo.*
3. **Drugi, własny sklep Selly jako testowy** — działa tak samo jak punkt 2, ale kosztuje
   osobne konto.

**Czego NIE robić:** nie wpisujcie danych do prawdziwego sklepu tylko po to, żeby „zobaczyć,
czy działa". Do sprawdzenia, czy panel żyje, wystarczy tryb A.

### Jak Paweł ustawia dane dostępowe (dla niego, nie dla Ciebie)

Plik `~/private_apps/bridge-staging/.env` na serwerze, potem `pm2 reload bridge-backend-staging`:

```
SELLY_SHOP_URL=https://<adres-sklepu>
SELLY_CLIENT_ID=<...>
SELLY_CLIENT_SECRET=<...>
SELLY_SCOPE=READWRITE          # do samych odczytów wystarczy READ, jeśli Selly to obsługuje
```

Wzór wszystkich zmiennych: `rebuild/backend/.env.example`. Szczegóły wdrożenia:
`docs/deploy-setup.md`.

---

## 3. Ekran Selly — pierwsze wejście

**Menu po lewej ma teraz 11 pozycji** — na samym dole, pod „Konfiguracją", doszła **„Selly"**
z ikoną otwartego kartonu.

> **To jest jedyna pozycja menu, której nie było w starym Bridge'u jako normalny link.**
> Wcześniej doklejał ją ten sam skrypt, który rysował panel. Efekt dla Ciebie jest ten sam,
> ale teraz to zwykły link — działa wstecz/dalej w przeglądarce i można go dodać do zakładek.

Kliknij **Selly**. Powinnaś zobaczyć nagłówek **„Integracja Selly.pl"**, podtytuł
*„Synchronizacja produktów z Bridge do sklepu w Selly przez API v3."* i **pięć kart**
jedna pod drugą:

1. Status połączenia
2. Codzienna synchronizacja CSV
3. Mapowanie dostawców
4. Sync dostawcy
5. Historia operacji

**Sprawdź:** czy jest ich dokładnie pięć i w tej kolejności. Przy każdym nagłówku jest
**kolorowa kropka**: zielona = w porządku, czerwona = błąd, **pulsująca pomarańczowa = trwa
ładowanie** (zniknie po sekundzie).

---

## 4. Karta „Status połączenia"

To jedyna karta w tej sekcji, która wymaga połączenia z Selly.

### 4.1 Tryb A — komunikat o braku konfiguracji ⭐

**To jest test sam w sobie, nie awaria.** W trybie A karta ma pokazać:

> **Selly nieskonfigurowane**
> Brakuje sekretów połączenia (`SELLY_SHOP_URL`, `SELLY_CLIENT_ID`, `SELLY_CLIENT_SECRET`).
> Trasy rozmawiające z API Selly.pl będą zwracać błąd, dopóki nie zostaną ustawione na serwerze.

**Sprawdź trzy rzeczy:**

- [ ] Komunikat jest **po ludzku**, a nie surowym błędem serwera z nawiasami klamrowymi.
- [ ] Kropka przy nagłówku jest **czerwona**.
- [ ] **Pozostałe cztery karty działają normalnie** — to najważniejsze. Brak konfiguracji Selly
      psuje *tę jedną* kartę, a nie cały ekran.

> **Uwaga dla porównujących ze starym panelem:** stary Bridge wyrzucał w tym miejscu surowy
> błąd techniczny. Czytelny komunikat to **celowa zmiana** (decyzja D4) — jedyna w tej karcie.
> Każdy **inny** błąd (np. odrzucone hasło) nadal pokaże się surowo, żeby dało się go zgłosić.

### 4.2 Tryb B/C — połączenie działa

Karta pokazuje jedną linię:

> ✓ Połączono · **https://…** · token wygasa za **3596s** · OK (15 stawek)

- [ ] Zaczyna się od **„✓ Połączono"**, kropka jest **zielona**.
- [ ] Adres sklepu to ten, który ustawiliście — **przeczytaj go uważnie**. To jedyne miejsce,
      w którym zobaczysz, do czego naprawdę jesteś podłączona.
- [ ] Na końcu jest wynik sprawdzenia stawek VAT.

> **Czego tu NIE MA i tak ma zostać:** fragmentu hasła dostępowego. Stary panel go nie
> pokazywał, więc nowy też nie — mimo że serwer go zwraca.

---

## 5. Karta „Sync dostawcy" — najważniejsza i najgroźniejsza

**Pomiń całą tę sekcję, jeśli jesteś w trybie A** (przyciski będą nieaktywne — patrz 5.4).

### 5.1 Co jest w formularzu

- **Dostawca** — lista rozwijana.
- **Limit (0=wszystko)** — ile produktów wysłać. `0` znaczy „wszystkie".
- **☐ tylko zmienione od ostatniego syncu** — zawęża do tego, co się zmieniło.
- Dwa przyciski: **„Test dry-run (5 szt.)"** i **„Wyślij do Selly"**.

> **Różnica wobec starego panelu:** stary miał listę dostawców wpisaną na sztywno (MO1–MO10).
> Nowy **bierze ją z realnego stanu bazy** (decyzja D5), więc jeśli dojdzie nowy dostawca,
> pojawi się sam. **Sprawdź:** czy lista zgadza się z tabelą „Mapowanie dostawców" nad nią
> i czy MO10 jest **na końcu**, a nie zaraz po MO1.

### 5.2 „Test dry-run (5 szt.)" — siatka bezpieczeństwa

Ten przycisk przechodzi **całą** drogę przygotowania danych, ale **nie wysyła nic**. Pokazuje,
co *poszłoby* do Selly.

- [ ] Kliknij. **Nie pojawia się żadne pytanie o potwierdzenie** — i tak ma być, bo nic
      nie zapisuje.
- [ ] Wynik ma odznakę **„DRY-RUN"** i pięć liczb: OK, Błędy, Pominięto, Utworzono,
      Zaktualizowano.
- [ ] Jest zwijka **„Podgląd payloadów"** — rozwiń i zobacz, jak Bridge widzi Twoje produkty.
- [ ] Pole **Limit jest ignorowane** — dry-run zawsze bierze 5 sztuk. Ustaw 50 i sprawdź,
      że i tak dostajesz maksymalnie 5 podglądów.

> **⚠ Jedyny haczyk trybu B.** Dry-run *sam* nic nie wysyła, ale przy **pierwszym** uruchomieniu
> może dociągnąć ze sklepu słowniki (listę producentów i kategorii), jeśli Bridge jeszcze ich
> nie ma. To **odczyt**, nie zapis — niczego w sklepie nie zmienia. Kolejne dry-runy działają
> już z lokalnej kopii.

### 5.3 ⭐ „Wyślij do Selly" — pytanie o potwierdzenie

**To jest jedyna celowa zmiana zachowania w tej iteracji (decyzja D3) i chcemy Twoją opinię.**

Stary panel wysyłał **natychmiast po kliknięciu**, bez pytania. Nowy najpierw pokazuje okno:

> **Wysłać produkty do Selly?**
> Dostawca **MO1** zostanie zsynchronizowany do sklepu Selly (bez limitu). Operacja
> **tworzy i modyfikuje produkty w żywym sklepie** i nie da się jej cofnąć z tego panelu.

- [ ] Kliknij **„Wyślij do Selly"** i **naciśnij „Anuluj"**. Sprawdź, że **nic się nie wysłało** —
      historia operacji na dole się nie zmieniła.
- [ ] Sprawdź, że w oknie jest **nazwa dostawcy** i informacja o limicie — żeby dało się złapać
      pomyłkę zanim będzie za późno.
- [ ] **Powiedz nam, czy to pytanie nie przeszkadza w codziennej pracy.** Jeśli synchronizujesz
      dostawców seryjnie, jedno kliknięcie więcej za każdym razem może irytować — wtedy to
      zmienimy.

### 5.4 Tryb A — przyciski są nieaktywne

Bez połączenia z Selly lista dostawców jest pusta, więc:

- [ ] Lista rozwijana pokazuje **„Brak dostawców"** i jest wyszarzona.
- [ ] **Oba przyciski są nieaktywne** — nie da się kliknąć.

To celowe zabezpieczenie: bez wybranego dostawcy wysyłka nie miałaby sensu.

---

## 6. Karta „Mapowanie dostawców" — ⚠ uwaga na przycisk w wierszu

Tabela: **Dostawca · W Bridge · W Selly · Błędy**, a w ostatniej kolumnie przycisk **„Sync"**.

- [ ] Kolumna **„W Bridge"** zgadza się z liczbami produktów w Katalogu.
- [ ] Kolumna **„W Selly"** to licznik tego, co już poszło do sklepu — **świeżo po wdrożeniu
      będzie wszędzie `0` i to jest poprawne**.
- [ ] Przycisk **„Odśwież"** przeładowuje tabelę.

> **⚠ NAJGROŹNIEJSZY PRZYCISK W CAŁYM PANELU.** Ten mały **„Sync"** w wierszu tabeli w starym
> Bridge'u odpalał **pełną synchronizację dostawcy natychmiast, bez żadnego pytania**. Jedno
> przypadkowe kliknięcie i produkty leciały do sklepu.
>
> **W nowej wersji przechodzi przez to samo okno potwierdzenia, co „Wyślij do Selly"** —
> to część decyzji D3.
>
> - [ ] **Sprawdź to koniecznie:** kliknij „Sync" przy dowolnym wierszu i upewnij się, że
>       pojawia się pytanie, a nie natychmiastowa wysyłka.
> - [ ] Po kliknięciu „Sync" **lista dostawców w sekcji poniżej przestawia się** na tego
>       dostawcę — żeby było widać, kogo dotyczy operacja.

---

## 7. Karta „Codzienna synchronizacja CSV"

Działa **w każdym trybie**, także bez danych dostępowych.

To osobny mechanizm niż synchronizacja produktów: raz dziennie (ok. 6:00) Bridge zapisuje na
serwerze plik CSV, po który **Selly przychodzi samo**. Ta karta pokazuje stan tego pliku.

- [ ] Tabela ma cztery wiersze: **Status · Ostatnia synchronizacja · Liczba produktów
      w pliku · Rozmiar pliku**.
- [ ] Status to odznaka **„OK"** albo **„BŁĄD"** — nie surowe słowo z serwera.
- [ ] Nad tabelą jest zdanie: *„✓ Synchronizacja OK — plik wygenerowany dzisiaj"* albo
      *„✗ Błąd synchronizacji — …"* z powodem.
- [ ] Wiek pliku („12 min temu") jest **zielony**, gdy plik jest z dzisiaj, i **pomarańczowy**,
      gdy starszy.
- [ ] Liczba produktów ma spację jako separator tysięcy (`6 898`, nie `6898`).
- [ ] Link **„Pobierz / podgląd CSV ↗"** w prawym górnym rogu otwiera plik **w nowej karcie**.

### 7.1 Przycisk „Wygeneruj CSV teraz" — ⚠ przeczytaj, zanim klikniesz

To przycisk awaryjny „zrób plik od razu, nie czekaj do 6:00". **Nadpisuje istniejący plik.**

- [ ] Kliknij — pojawia się pytanie: *„Wygenerować plik CSV teraz? Zastąpi bieżący plik
      pobierany przez Selly."* (**tak było też w starym panelu** — to nie jest nowość).
- [ ] Po potwierdzeniu pojawia się *„⏳ Generuję plik CSV…"*, a potem *„✓ Wygenerowano —
      N produktów (X MB) w Y s"*.
- [ ] Tabela wyżej odświeża się sama.

> **⚠ Pytanie do Pawła, zanim Ania to kliknie na produkcji:** ścieżka pliku jest domyślnie
> **ścieżką produkcyjną**. Na stagingu to nieszkodliwe (plik powstaje obok), ale **na produkcji
> ten przycisk podmienia dokładnie ten plik, po który przychodzi Selly**. Jeśli wygenerowany
> plik byłby wadliwy, Selly zaciągnie wadliwy. Na stagingu — klikaj bez obaw.

---

## 8. Przycisk CSV w Katalogu

Wejdź w **Katalog**. Obok przycisku „Kolumny" jest nowy przycisk z ikoną pobierania.

### 8.1 ⭐ Przycisk nazywa się „Pobierz CSV (15 kol.)", a nie „Shoper"

**To jest poprawne i tak samo działał stary Bridge** — choć wygląda na pomyłkę, więc wyjaśniam.

Przycisk ma **trzy nazwy**, zależnie od tego, co masz ustawione w „Kolumnach":

| Kiedy | Nazwa przycisku | Co robi |
|---|---|---|
| **Normalnie** (masz zaznaczone jakiekolwiek kolumny) | **„Pobierz CSV (N kol.)"** | eksportuje **Twoje kolumny**, plik `katalog_…_wybrane_….csv` |
| Odznaczysz **wszystkie** kolumny, zakładka „Wszyscy" | „Pobierz CSV (Shoper)" | eksportuje **stały format Shopera** (13 kolumn), plik `shoper_wszyscy_….csv` |
| Odznaczysz **wszystkie** kolumny, wybrany dostawca | „Pobierz CSV dla Shopera" | jw., plik `shoper_MO3_….csv` |

Czyli: **format Shopera włącza się dopiero po odznaczeniu wszystkich kolumn** w konfiguratorze
(przycisk „Kolumny" → „Żadna"). Brzmi odwrotnie do intuicji — ale dokładnie tak działał stary
Bridge i celowo tego nie zmienialiśmy.

### 8.2 Co sprawdzić

- [ ] **Domyślnie** przycisk pokazuje liczbę kolumn, np. „Pobierz CSV (15 kol.)".
- [ ] Kliknij — plik się pobiera, na dole pojawia się zielony komunikat **„Eksport gotowy"**
      z liczbą produktów i nazwą pliku.
- [ ] **Otwórz plik w Excelu.** To najważniejszy test: **polskie znaki mają być poprawne**
      (żadnych „krzaczków") i **dane mają być w osobnych kolumnach**, nie w jednej.
- [ ] Zmień kolumny („Kolumny" → odznacz kilka) i pobierz ponownie — **plik ma inne kolumny**,
      a nazwa przycisku inną liczbę.
- [ ] Kliknij „Kolumny" → **„Żadna"** → nazwa zmienia się na **„Pobierz CSV (Shoper)"**,
      a pobrany plik ma stałe 13 kolumn i inną nazwę.
- [ ] Wejdź w zakładkę **konkretnego dostawcy** i pobierz — plik zawiera **tylko jego produkty**,
      a jego kod jest w nazwie pliku.

### 8.3 Produkty bez ceny wypadają z eksportu

- [ ] Jeśli produkt ma **cenę zakupu albo sprzedaży równą zeru**, **nie trafia do pliku**.
      To zachowanie starego Bridge'a. Porównaj: liczba w komunikacie „Eksport gotowy" bywa
      **mniejsza** niż liczba wierszy widoczna w tabeli — i tak ma być.
- [ ] Wejdź w zakładkę dostawcy, który **nie ma żadnych produktów**. Kliknij eksport —
      ma się pojawić czerwony komunikat **„Brak produktów do eksportu"** z opisem
      *„Dostawca MO3 nie ma produktów"*, i **żaden plik się nie pobiera**.

---

## 9. Karta „Historia operacji"

Ostatnie 10 operacji z dziennika synchronizacji.

- [ ] Kolumny: **Data · Operacja · Dostawca · OK · Błąd · Skip · Status**.
- [ ] Świeżo po wdrożeniu: *„Brak wpisów — jeszcze nie było żadnej operacji."*
- [ ] Po dry-runie **pojawia się wpis** — dry-run też się loguje, choć nic nie wysłał.
- [ ] **„Odśwież"** przeładowuje listę.

---

## 10. ⚠ Rzeczy, które WYGLĄDAJĄ na błąd, a są poprawne

### 10.1 Kolumna „W Selly" wszędzie pokazuje 0
Licznik rośnie dopiero po **prawdziwej** synchronizacji. W trybie A i B zostanie na zerze.

### 10.2 Status operacji w historii nie jest zielony
Wpisy mają w kolumnie Status słowo `zakonczono` na **szarej** odznace. Wyróżniona odznaka
należy się tylko słowu `success`, którego backend w tym miejscu nie używa — a czerwona słowu
`error`. Stary Bridge zachowywał się identycznie, więc szara odznaka przy udanej operacji
to nie pomyłka.

### 10.3 Ekran Selly ma menu boczne, a Katalog i Analityka nie
**To znany błąd odbudowy, nie tej iteracji.** Stary Bridge pokazywał menu na **każdym** ekranie
po zalogowaniu. W nowym pokazuje się na pięciu z dwunastu — `/selly` jest jednym z tych pięciu,
bo przy tej okazji zrobiliśmy go poprawnie. Pozostałe siedem ekranów jest zgłoszone jako
osobna usterka do naprawy (`docs/rebuild-backlog.md` #36).

### 10.4 Kafel „Ostatni eksport CSV" na Pulpicie nadal pokazuje „—"
Nie zmieniło się i nie miało. To osobna, świadomie martwa rzecz z Iteracji 10.

### 10.5 W panelu nie ma słowników, producentów ani kategorii
Backend ma cztery dodatkowe operacje (słowniki, producenci, kategorie, wysyłka pojedynczego
produktu), ale **stary panel nigdy ich nie pokazywał** — używano ich z konsoli programisty.
Odtworzyliśmy panel 1:1 (decyzja D1). Jeśli któraś przydałaby Ci się na ekranie — powiedz,
dorobimy świadomie.

---

## 11. Zgłaszanie błędów

Przy każdym zgłoszeniu podaj **w którym trybie** (A / B / C) pracowałaś — bez tego połowa
objawów jest nie do odróżnienia od poprawnego zachowania.

Przydatne: nazwa karty, nazwa przycisku, co miało się stać, co się stało, zrzut ekranu.
Jeśli pojawił się surowy błąd techniczny — **skopiuj go w całości**, tam jest przyczyna.

---

## 12. Czego ta iteracja NIE obejmuje

| Rzecz | Dlaczego |
|---|---|
| Sandbox / testowa instancja Selly | nie istnieje w Bridge; do ustalenia z Selly.pl (sekcja 2) |
| Cofanie wysłanej synchronizacji | nie ma takiej funkcji ani w starym, ani w nowym Bridge |
| UI dla słowników, producentów, kategorii, pojedynczego produktu | stary panel ich nie miał (D1) |
| Menu boczne na siedmiu pozostałych ekranach | osobna usterka, backlog #36 |
| Automatyczne ustawienie danych Selly na stagingu | decyzja Pawła, nie zadanie tej iteracji |

---

## 13. Ściąga — lista kontrolna na jedno przejście

Skrót całej instrukcji. Kolumna „Tryb" mówi, w którym trybie da się to sprawdzić.

### Ekran Selly

| ✔ | Co sprawdzić | Tryb |
|---|---|---|
| ☐ | Menu po lewej ma **11 pozycji**, „Selly" jest ostatnia, pod „Konfiguracją" | A |
| ☐ | Ekran ma **pięć kart** w kolejności z sekcji 3 | A |
| ☐ | Bez konfiguracji: **„Selly nieskonfigurowane"** po ludzku, nie surowy błąd | A |
| ☐ | Brak konfiguracji psuje **tylko kartę połączenia**, reszta działa | A |
| ☐ | „W Bridge" w mapowaniu zgadza się z liczbami w Katalogu | A |
| ☐ | Każda karta ma działający **„Odśwież"** | A |
| ☐ | Status pliku CSV: odznaka **OK/BŁĄD**, zdanie podsumowania, wiek pliku na kolor | A |
| ☐ | Liczba produktów w CSV ma spację jako separator tysięcy (`6 898`) | A |
| ☐ | Link **„Pobierz / podgląd CSV ↗"** otwiera plik w nowej karcie | A |
| ☐ | **„Wygeneruj CSV teraz"** pyta o potwierdzenie i odświeża tabelę po sukcesie | A |
| ☐ | Bez konfiguracji: lista dostawców **„Brak dostawców"**, oba przyciski sync **nieaktywne** | A |
| ☐ | Historia operacji: pusta na start, po dry-runie **pojawia się wpis** | A/B |
| ☐ | **„✓ Połączono"** i **adres sklepu się zgadza** | B/C |
| ☐ | Lista dostawców zgadza się z tabelą mapowania, **MO10 na końcu** | B/C |
| ☐ | **Dry-run nie pyta o potwierdzenie** i pokazuje odznakę „DRY-RUN" | B/C |
| ☐ | Dry-run **ignoruje pole Limit** — zawsze maks. 5 podglądów | B/C |
| ☐ | ⭐ **„Wyślij do Selly" pyta o potwierdzenie**; „Anuluj" **nic nie wysyła** | B/C |
| ☐ | ⭐ **„Sync" w wierszu tabeli też pyta** — a nie wysyła od razu jak dawniej | B/C |
| ☐ | Po kliknięciu „Sync" lista dostawców **przestawia się** na tego dostawcę | B/C |
| ☐ | **Opinia: czy pytanie o potwierdzenie nie przeszkadza w seryjnej pracy?** | B/C |

### Przycisk CSV w Katalogu — cały do sprawdzenia w trybie A

| ✔ | Co sprawdzić |
|---|---|
| ☐ | Domyślna nazwa to **„Pobierz CSV (15 kol.)"**, nie „Shoper" |
| ☐ | Po kliknięciu: plik się pobiera + zielony komunikat **„Eksport gotowy"** |
| ☐ | ⭐ **Plik otwiera się w Excelu: polskie znaki OK, dane w osobnych kolumnach** |
| ☐ | Zmiana kolumn zmienia **zawartość pliku** i **liczbę w nazwie przycisku** |
| ☐ | „Kolumny" → **„Żadna"** → nazwa **„Pobierz CSV (Shoper)"**, plik `shoper_…` z 13 kolumnami |
| ☐ | Zakładka dostawcy → plik ma **tylko jego produkty**, kod w nazwie pliku |
| ☐ | Produkty z **ceną zero nie trafiają** do pliku (liczba w komunikacie bywa mniejsza niż w tabeli) |
| ☐ | Pusty dostawca → czerwone **„Brak produktów do eksportu"**, **żaden plik się nie pobiera** |

### Rzeczy, które mają wyglądać „źle" i tak zostać

| ✔ | Co zobaczysz | Dlaczego OK |
|---|---|---|
| ☐ | „W Selly" wszędzie `0` | licznik rośnie po prawdziwym syncu |
| ☐ | Status `zakonczono` na **szarej** odznace | tak samo jak stary Bridge |
| ☐ | Menu boczne jest na Selly, ale nie na Katalogu | znana usterka, backlog #36 |
| ☐ | Kafel „Ostatni eksport CSV" na Pulpicie: `—` | świadomie martwy od I10 |
| ☐ | Brak słowników/producentów/kategorii w panelu | stary panel ich nie pokazywał (D1) |
