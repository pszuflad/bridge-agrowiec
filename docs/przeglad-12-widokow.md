# Przegląd widoków — finalna akceptacja nowego Bridge'a

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-08 · **Aktualizacja:** 2026-09-22
**Dla kogo:** Ania · **Po co:** to ostatnie sprawdzenie przed przełączeniem produkcji.

> **To jest STAGING, nie produkcja.** Cokolwiek tu ustawisz, zmienisz albo zepsujesz —
> produkcji nie dotyka. Klikaj bez skrupułów, próbuj popsuć.

> **Co nowego od pierwszej wersji (2026-09-08).** Doszedł ekran „Archiwum importów" (punkt 10 —
> dlatego kolejne ekrany mają numer o jeden wyższy niż w Twoim pierwszym przejściu), a na kilku
> ekranach poprawiliśmy to, co zgłosiłaś. Takie miejsca mają dopisek **„Zgłosiłaś → Jest teraz →
> Sprawdź"**. Punkty bez zmian zostały tak, jak były.

> **Czym to się różni od poprzednich instrukcji.** Wcześniejsze instrukcje testów
> (I3, I4, I6…) sprawdzały po jednej nowej funkcji. **Ta sprawdza CAŁOŚĆ** — czy wszystko, co
> robisz w starym Bridgu, da się zrobić tutaj. Nie musisz jej przechodzić za jednym razem;
> możesz brać po jednym ekranie dziennie i odhaczać.

---

## Jak z tego korzystać

Każdy ekran ma trzy rzeczy:

1. **Ma się pokazać** — co powinnaś zobaczyć od razu po wejściu.
2. **Do kliknięcia** — konkretne czynności. To one są sednem: samo „ładnie wygląda" nie
   wystarczy, chodzi o to, czy da się PRACOWAĆ.
3. **Kratki ✅/❌** — zaznacz. Przy ❌ dopisz jednym zdaniem, co było nie tak. Nie musisz
   opisywać technicznie — „kliknęłam zapisz i nic się nie stało" w zupełności wystarczy.

**Zanim zaczniesz — jedna rzecz, którą warto sprawdzić na każdym ekranie:**
**menu po lewej (sidebar) ma być widoczne ZAWSZE**, na każdym z 13 ekranów. Do niedawna
znikało na siedmiu z nich — to była usterka odbudowy i została naprawiona. Jeśli gdziekolwiek
menu zniknie, to jest błąd i zaznacz go od razu.

---

## 0. Logowanie

- [ ] ✅ / ❌ — logujesz się swoim e-mailem i hasłem (**tym samym co w starym Bridgu**).
- [ ] ✅ / ❌ — złe hasło daje czytelny komunikat, a nie pustą stronę.
- [ ] ✅ / ❌ — po zalogowaniu w lewym dolnym rogu widać Twoje imię i e-mail.
- [ ] ✅ / ❌ — na ekranie logowania menu po lewej **NIE MA** (i tak ma być).

---

## 1. Pulpit — adres `/`

**Ma się pokazać:** cztery kafelki na górze (m.in. liczba produktów, alerty), pod nimi obraz
stanu dostawców i katalogu.

**Do kliknięcia:**
- [ ] ✅ / ❌ — liczby na kafelkach wyglądają sensownie (nie zera, nie puste miejsca).
- [ ] ✅ / ❌ — kliknięcie kafelka z alertami przenosi na ekran Alerty.
- [ ] ✅ / ❌ — przełącznik jasny/ciemny (ikona słońca/księżyca w menu) działa, a wybór
      zostaje po odświeżeniu strony.

- [ ] ✅ / ❌ — kafel „Ostatni eksport CSV" pokazuje prawdziwą informację: kiedy był ostatni
      eksport i ile produktów (albo — gdy eksportu jeszcze nie było — „Ostatni import: …").

> ⚠ **Kafel „Aktywne alerty" i karta „Najnowsze powiadomienia" liczą dwa rodzaje alertów
> razem:** alerty z importu i alerty katalogowe (ujemna lub bardzo niska marża, pozycja uznana
> za nie-oponę, dostawca bez importu cennika). Alerty katalogowe w karcie prowadzą do zakładki
> „Katalog" na ekranie Alerty.

> ⚠ **Kafel „Ostatni eksport CSV" w starym Bridgu jest zepsuty i zawsze pusty** („—"). Tutaj
> działa — to poprawka, nie błąd.

---

## 2. Staging — adres `/staging`

To poczekalnia: zmiany z importu, które czekają na Twoją decyzję.

**Ma się pokazać:** tabela pozycji z filtrem typu zmiany, szukajką i stronicowaniem.

**Do kliknięcia:**
- [ ] ✅ / ❌ — filtr typu zmiany (nowa / zmieniona / wycofana) faktycznie zawęża listę.
- [ ] ✅ / ❌ — szukajka znajduje po kodzie i po nazwie.
- [ ] ✅ / ❌ — kliknięcie wiersza pokazuje szczegóły pozycji.
- [ ] ✅ / ❌ — zaznaczasz kilka pozycji i akceptujesz — znikają z poczekalni.
- [ ] ✅ / ❌ — **„Akceptuj wszystkie" i „Odrzuć wszystkie" pytają o potwierdzenie.**
      ⚠ **To wygląda inaczej niż w starym Bridgu**: zamiast szarego okienka przeglądarki
      pojawia się okno w stylu reszty panelu. **Treść pytania jest dokładnie ta sama.**
      Sprawdź, że „Anuluj" naprawdę nic nie robi.

---

## 3. Katalog — adres `/katalog`

Najważniejszy ekran. Poświęć mu najwięcej czasu.

**Ma się pokazać:** tabela produktów, zakładki dostawców, filtry, szukajka, stronicowanie.

**Do kliknięcia:**
- [ ] ✅ / ❌ — liczba pozycji zgadza się z tym, co pamiętasz ze starego Bridge'a.
- [ ] ✅ / ❌ — przełączanie zakładek dostawców zmienia listę.
- [ ] ✅ / ❌ — filtry (marka, kategoria, dostępność) zawężają wyniki.
- [ ] ✅ / ❌ — **marka ALLIANCE jest w filtrze raz.**
      Zgłosiłaś: w filtrze marek są „ALLIANCE" i „Alliance". → Jest teraz: jedna marka
      „ALLIANCE" (na kopii danych — 849 pozycji). → Sprawdź: rozwiń filtr marki, wpisz „alli" —
      ma być jedna pozycja; wybierz ją i zobacz, że na liście są opony Alliance od wszystkich
      dostawców.
      (W filtrze marek mogą się trafić „marki" wyglądające jak rozmiar, np. „21x7.00-15" — to
      zapisy z plików dostawców, osobny temat; nie zgłaszaj tego tutaj.)
- [ ] ✅ / ❌ — szukajka po kodzie, nazwie i rozmiarze.
- [ ] ✅ / ❌ — **przycisk „Wszystkie" przy rozmiarze strony** (pokazuje cały katalog naraz):
      lista przewija się płynnie do samego końca. ⚠ To miejsce było zepsute i zostało
      naprawione — jeśli przewijanie się zatnie albo lista skończy się za wcześnie, zaznacz ❌.
- [ ] ✅ / ❌ — menu „Akcje" przy wierszu otwiera się i ma pozycje: edytuj, wstrzymaj, usuń.
      (Jest tam też wyszarzona „Historia" — tak samo nieaktywna jak w starym Bridgu, nie zgłaszaj.)
- [ ] ✅ / ❌ — **edycja produktu**: zmieniasz coś, zapisujesz, zmiana widać w tabeli.
- [ ] ✅ / ❌ — **usunięcie produktu** pyta o potwierdzenie i po nim produkt znika.
- [ ] ✅ / ❌ — ceny w kolumnach zgadzają się z tym, czego się spodziewasz po narzutach.
- [ ] ✅ / ❌ — eksport do Shopera działa (przycisk pobiera plik).

> ⚠ **Kolumna „Konstrukcja opony" wygląda inaczej niż u Ciebie — i tutaj rację mamy my.**
> W starym Bridgu widzisz w niej dziś kreski („—") i pustą kolumnę w eksporcie CSV: poprawka
> z 1 września trafiła do pliku panelu, którego produkcja nie ładuje. Tutaj zobaczysz „Radialna"
> i „Diagonalna". Nie zgłaszaj tego jako błąd.

---

## 4. Narzuty i promocje — adres `/narzuty`

**Ma się pokazać:** dwie listy — narzuty i promocje — z możliwością dodawania i edycji.

**Do kliknięcia:**
- [ ] ✅ / ❌ — dodajesz narzut, pojawia się na liście.
- [ ] ✅ / ❌ — edytujesz istniejący narzut i zmiana się zapisuje.
- [ ] ✅ / ❌ — usuwasz narzut — pyta o potwierdzenie.
- [ ] ✅ / ❌ — to samo dla promocji.
- [ ] ✅ / ❌ — po zmianie narzutu ceny w Katalogu faktycznie się przeliczają.

> ⚠ **Rzecz, którą naprawiliśmy celowo, inaczej niż stary Bridge:** promocja z datą, która
> już minęła, **przestaje obniżać ceny** — tutaj data naprawdę kończy promocję (świadome
> odstępstwo od oryginału, Twoje ustalenie z 2026-09-18). W starym Bridgu taka
> promocja dalej by obniżała ceny. Tak samo promocja zaplanowana na przyszłość **włącza się
> sama**, gdy nadejdzie jej data startu — w starym Bridgu zostawałaby zaplanowana na zawsze.
> Promocja po terminie **zostaje na liście** (oznaczona jako zakończona) — znika tylko jej wpływ
> na ceny.

---

## 5. Atrybuty — adres `/atrybuty`

**Ma się pokazać:** lista rodzajów atrybutów, panel wartości i kolejka propozycji („pending").

**Do kliknięcia:**
- [ ] ✅ / ❌ — dodajesz nowy rodzaj — **zapisuje się** (w starym Bridgu ten przycisk był
      zepsuty i nic nie robił; tutaj naprawione).
- [ ] ✅ / ❌ — dodajesz i usuwasz wartość w wybranym rodzaju.
- [ ] ✅ / ❌ — kolejka propozycji: akceptujesz jedną, znika z kolejki.
- [ ] ✅ / ❌ — odrzucasz inną, też znika.
- [ ] ✅ / ❌ — kolejka **nie podpowiada już „zamień X na X"** (tej samej wartości na samą
      siebie). Podobieństwo liczy się bez względu na wielkość liter, więc np. „rolnicze" dostaje
      podpowiedź „Rolnicze". Jeśli zobaczysz podpowiedź zamiany wartości na identyczną — ❌.
- [ ] ✅ / ❌ — akceptacja **z poprawką** albo **jako alias** zostawia ślad: okno przed
      akceptacją mówi, że wpis pojawi się w Historii, a na ekranie Historia (filtr „Edycje")
      widać go z liczbą zmienionych produktów.

> ⚠ **Czytaj podpowiedzi, zanim klikniesz.** Podpowiedź czasem proponuje jako „właściwy" zapis
> z małymi literami (np. „Farmax R75" zamiast „FARMAX R75"). Akceptacja przepisze wszystkie
> pasujące produkty w katalogu na tę formę.

> ⚠ **Czego tu nie ma, a było:** filtr „Źródło" nad listą wartości. W starym Bridgu ten filtr
> **nic nie robił** — zawsze pokazywał „user" i niczego nie zawężał. Świadomie go nie
> przenieśliśmy. Jeśli jednak chcesz mieć działający filtr źródła, powiedz — to osobne zadanie.

---

## 6. Alerty — adres `/alerty`

**Ma się pokazać:** dwie zakładki, „Import" (domyślna) i „Katalog". „Import" — lista alertów
o dostawcach i imporcie, z poziomami ważności. „Katalog" — pseudo-alerty liczone na żywo z
katalogu (marża ujemna, bardzo niska marża, produkt sklasyfikowany jako nie-opona, brak
importu cennika u dostawcy).

**Do kliknięcia:**
- [ ] ✅ / ❌ — alerty są pogrupowane i da się je odczytać.
- [ ] ✅ / ❌ — alert ma trzy stany: nowy → przejrzany → rozwiązany. Przyciski „Oznacz jako
      przejrzany" i „Rozwiąż" zmieniają stan, „Otwórz ponownie" cofa pomyłkę.
- [ ] ✅ / ❌ — filtr stanu domyślnie pokazuje „Nierozwiązane" (nowe i przejrzane razem).
- [ ] ✅ / ❌ — na zakładce „Import" pole „Szukaj w treści" zawęża listę po treści alertu
      (wielkość liter nie ma znaczenia; kilka słów = alert musi mieć wszystkie).
- [ ] ✅ / ❌ — **polskie litery w alertach.**
      Zgłosiłaś: „B??d HTTP" i podobne znaki zapytania. → Jest teraz: „Błąd pobierania",
      „Błąd HTTP", „Ręczny upload", a w treściach „produktów" — bez znaków zapytania, także
      w starych alertach. → Sprawdź: rozwiń filtr typu i przejrzyj nazwy; wpisz w szukajkę
      „Błąd" albo „Ręczny" — alerty mają się znaleźć. Liczba grup się nie zmienia, zmieniają
      się tylko nazwy.
- [ ] ✅ / ❌ — na zakładce „Katalog" filtr po poziomie (krytyczny / ostrzeżenie / info) działa.
- [ ] ✅ / ❌ — na zakładce „Katalog" „Zaakceptuj wszystko" od razu rozwiązuje wszystkie
      widoczne alerty — **bez pytania o potwierdzenie**, tak jak w starym Bridgu. Pomyłkę cofasz
      pojedynczo przyciskiem „Otwórz ponownie".

> ⚠ **Stary Bridge nadal będzie zapisywał „B??d…"** w nowych alertach aż do dnia
> przełączenia — to jego wada. Nowy panel poprawia takie zapisy przy przełączeniu.

---

## 7. Waga gabarytowa — adres `/waga-gabarytowa`

**Ma się pokazać:** kalkulator wymiarów + lista przewoźników z dzielnikami, a pod listą
osobny kalkulator „Waga paletowa (opony) — inny wzór".

**Do kliknięcia:**
- [ ] ✅ / ❌ — paczka 60 × 50 × 50 u GEIS-a (dzielnik 10 000) daje **15 kg**.
- [ ] ✅ / ❌ — zmiana przewoźnika zmienia wynik (DPD 25 kg, GLS 37,50 kg dla tej samej paczki).
- [ ] ✅ / ❌ — po podaniu wagi rzeczywistej pojawia się „waga do wyceny" (większa z dwóch).
- [ ] ✅ / ❌ — dodajesz własnego przewoźnika i po odświeżeniu strony nadal tam jest —
      także na innym komputerze albo w innej przeglądarce.
- [ ] ✅ / ❌ — usuwasz przewoźnika — pyta o potwierdzenie. Jeśli to przewoźnik akurat
      wybrany w kalkulatorze, okno dodatkowo ostrzega i mówi, na którego kalkulator się przełączy.
- [ ] ✅ / ❌ — „Przywróć domyślne" pyta o potwierdzenie i przywraca domyślną listę przewoźników.
- [ ] ✅ / ❌ — kalkulator paletowy: wpisujesz wymiary, klikasz „Oblicz wagę paletową" i
      dostajesz wynik (liczony innym wzorem niż kalkulator na górze strony).

> ⚠ **Świadoma zmiana, uzgodniona z Tobą:** lista przewoźników zapisuje się teraz **na
> serwerze i jest wspólna dla wszystkich**, którzy się logują. W starym Bridgu każdy komputer
> miał własną listę. Zmiana u Ciebie = zmiana u wszystkich.

---

## 8. Analityka — adres `/analityka`

**Ma się pokazać:** cztery kafle na górze, pasek filtrów, zakładki (Dostawcy, EAN i ceny,
Ceny w czasie, Dostępność, Marża i rotacja), a w nich wykresy i tabele. ⚠ Ten ekran ładuje się
chwilę dłużej niż inne — to normalne, wykresy są ciężkie.

**Do kliknięcia:**
- [ ] ✅ / ❌ — wykresy się rysują (nie same puste ramki).
- [ ] ✅ / ❌ — przełączanie zakładek analityki działa.
- [ ] ✅ / ❌ — filtry nad zakładkami (dostawcy, marki, modele, rozmiary, indeksy nośności,
      indeksy prędkości) zawężają dane w tabelach.
- [ ] ✅ / ❌ — **kafle na górze jak w starym Bridgu.**
      Zgłosiłaś: kafle są inne niż na produkcji. → Jest teraz: te same cztery co w starym Bridgu, w tej
      samej kolejności — Dostawcy, EAN wspólne, Pozycje unikalne, Snapshoty. → Sprawdź: porównaj
      nazwy i liczby ze starym Bridgiem.
- [ ] ✅ / ❌ — **karty na zakładce „Dostępność" mają dane** — także dwie, które w starym
      Bridgu są zawsze puste. Pusto może być tylko wtedy, gdy dla danych opon nie ma jeszcze
      historii cen.
- [ ] ✅ / ❌ — przycisk „CSV" przy karcie pobiera plik z **dokładnie tym, co widać w tabeli**
      (po filtrach) — ta sama liczba wierszy i te same kolumny.

> ⚠ **Kafle na górze liczą CAŁOŚĆ i nie reagują na filtry** — tak samo jak w starym Bridgu.
> „EAN wspólne" i „Pozycje unikalne" pokażą najwyżej 1000, nawet gdy pozycji jest więcej —
> też tak jak w oryginale.

---

## 9. Historia — adres `/historia`

**Ma się pokazać:** lista zmian w katalogu, z filtrem po dostawcy i stronicowaniem.

**Do kliknięcia:**
- [ ] ✅ / ❌ — widać wpisy z ostatnich importów.
- [ ] ✅ / ❌ — filtr po dostawcy zawęża listę.
- [ ] ✅ / ❌ — stronicowanie przechodzi na kolejne strony — **aż do najstarszych wpisów**
      (wcześniej lista urywała się na 5000 zdarzeniach; teraz nie ma limitu).
- [ ] ✅ / ❌ — filtr typu ma cztery opcje: wszystkie, Importy, Eksporty, **Edycje**. W „Edycjach"
      widać akceptacje z kolejki atrybutów (z poprawką albo jako alias), z liczbą zmienionych
      produktów.

> ⚠ **Tak jak w starym Bridgu:** historia **nie pokazuje** importów z adresów URL ani ręcznych
> synchronizacji — tylko zmiany katalogu (Twoja decyzja z 2026-09-21).

---

## 10. Archiwum importów — adres `/archiwum`

**Nowy ekran** — w menu zaraz za „Historią". Tu leżą pliki, które przyszły od dostawców
(pobrane automatycznie, ręcznie z adresu albo wgrane z panelu). Służy do tego, o czym pisałaś:
pobierasz plik dostawcy i porównujesz go z katalogiem.

**Ma się pokazać:** przycisk „Odśwież", trzy filtry (Dostawca, Miesiąc, Status), pasek zajętości
archiwum (ile miejsca zajęte z limitu, ile plików, ile dni pliki są trzymane) i tabela z
kolumnami: Data, Dostawca, Źródło, Plik, Rozmiar, Rekordy, Status (OK / BŁĄD), Pobierz.

**Do kliknięcia:**
- [ ] ✅ / ❌ — filtry dostawca / miesiąc / status zawężają listę.
- [ ] ✅ / ❌ — **„Pobierz" zapisuje plik pod tą samą nazwą, jaką miał u dostawcy** — da się go
      otworzyć i porównać z katalogiem.
- [ ] ✅ / ❌ — przy pliku ze statusem BŁĄD widać pod nazwą, co poszło nie tak.
- [ ] ✅ / ❌ — „Odśwież" wczytuje listę na nowo (np. po imporcie z zakładki Konfiguracja).

> ⚠ **Tak jak w starym Bridgu:** listy w filtrach Dostawca i Miesiąc pokazują tylko to, co jest
> na aktualnie przefiltrowanej liście. Np. po wybraniu statusu BŁĄD w filtrze dostawców zostaną
> tylko ci, którzy mają pliki z błędem. To nie usterka.

---

## 11. Konfiguracja — adres `/konfiguracja`

Najbardziej rozbudowany ekran — osiem zakładek: Dostawcy, Wgrywanie ręczne, Spedycja, Shoper,
Katalog, AI Fallback, Admin, Dziennik.

**Zakładka „Dostawcy":**
- [ ] ✅ / ❌ — lista dostawców z ich statusami.
- [ ] ✅ / ❌ — „Synchronizuj" przy dostawcy z adresem URL uruchamia pobranie.

**Zakładka „Wgrywanie ręczne":**
- [ ] ✅ / ❌ — wgrywasz plik cennika ręcznie i pozycje trafiają do Staging.

**Zakładka „Spedycja":**
- [ ] ✅ / ❌ — ustawienia zapisują się i są widoczne po odświeżeniu.

> ⚠ **Świadoma zmiana na lepsze:** w starym Bridgu ustawienia spedycji żyły **tylko w Twojej
> przeglądarce**. Tutaj zapisują się na serwerze, więc przetrwają zmianę komputera.
> Tak było uzgodnione — to jedna z niewielu rzeczy, które celowo robimy inaczej.

**Zakładki „Shoper" i „AI Fallback":**
- [ ] ✅ / ❌ — pola zapisują się i utrzymują po odświeżeniu.

**Zakładka „Admin":**
- [ ] ✅ / ❌ — lista użytkowników.
- [ ] ✅ / ❌ — konfiguracja dostawcy (adres URL, częstotliwość, status) zapisuje się.
- [ ] ✅ / ❌ — „Usuń pozycje, które nie są oponami" pyta o potwierdzenie i pokazuje
      podsumowanie (ile usunięto, u których dostawców). ⚠ **To okno też wygląda inaczej niż
      w starym Bridgu** — treść pytania jest ta sama.

**Zakładka „Katalog":**
- [ ] ✅ / ❌ — „Usuń wszystko z katalogu" pyta o potwierdzenie **szarym okienkiem
      przeglądarki**. ⚠ Tutaj zostawiliśmy je celowo — operacja jest nieodwracalna i dotyczy
      wszystkich dostawców naraz, więc twarde okno jest zaletą.
      **Uwaga: jeśli potwierdzisz, katalog na staging będzie pusty.** Zrób to na końcu przeglądu
      albo wcale.

**Zakładka „Dziennik":**
- [ ] ✅ / ❌ — widać zapis Twoich działań (edycje, usunięcia, czyszczenia).

---

## 12. Selly — adres `/selly`

**Ma się pokazać:** panel integracji ze sklepem Selly.pl — bez zakładek, pięć kart jedna pod
drugą: „Status połączenia", „Codzienna synchronizacja CSV", „Mapowanie dostawców",
„Sync dostawcy", „Historia operacji".

**Do kliknięcia:**
- [ ] ✅ / ❌ — karta „Status połączenia" pokazuje stan integracji.
- [ ] ✅ / ❌ — karta „Historia operacji" pokazuje historię synchronizacji.
- [ ] ✅ / ❌ — **„Wygeneruj CSV teraz" — plik zostaje.**
      Zgłosiłaś: po kliknięciu nadal „Brak pliku CSV". → Jest teraz: plik powstawał, ale
      kasowało go każde nasze wgranie nowej wersji na staging — to było naprawione po naszej
      stronie, przycisk był w porządku. → Sprawdź w dwóch krokach:
      1. Kliknij „Wygeneruj CSV teraz" i potwierdź. Pod przyciskiem pojawi się „✓ Wygenerowano…",
         a w tabeli data w wierszu „Ostatnia synchronizacja".
      2. **Wróć tu następnego dnia** (albo po kilku dniach): data ma zostać ta sama, a **nie**
         „Brak pliku CSV". Czerwony napis „Plik nie zostal wygenerowany dzisiaj" jest wtedy
         poprawny — staging nie generuje pliku sam o 6:00 rano, tylko po Twoim kliknięciu.

> ⚠ **Na staging Selly jest CELOWO WYŁĄCZONY.** Operacje wysyłające cokolwiek do sklepu
> odmówią działania, nawet gdyby ktoś wpisał prawdziwe hasła. Tak ma być — staging nie ma
> prawa dotknąć Waszego sklepu. Jeśli zobaczysz „tryb wyłączony", to jest poprawne zachowanie,
> a nie usterka. Pełną integrację włączymy dopiero na produkcji.

---

## 13. Moje konto — adres `/moje-konto`

**Do kliknięcia:**
- [ ] ✅ / ❌ — widać Twoje dane (imię, e-mail).
- [ ] ✅ / ❌ — zmieniasz hasło: ze złym starym hasłem dostajesz błąd, z dobrym — potwierdzenie.
- [ ] ✅ / ❌ — po zmianie hasła wylogowujesz się i logujesz **nowym** hasłem.
      (Pamiętaj, żeby zapisać nowe hasło — to staging, ale odzyskanie wymaga naszej pomocy.)
- [ ] ✅ / ❌ — „Wyloguj" w menu na dole faktycznie wylogowuje.

---

## Rzeczy, które wyglądają inaczej — i to jest w porządku

Zebrane w jednym miejscu, żebyś nie musiała ich zgłaszać:

1. **Adresy stron bez `#`.** Stary Bridge miał `/#/katalog`, nowy ma `/katalog`. Stare zakładki
   w przeglądarce trzeba będzie zapisać na nowo.
2. **Okna potwierdzeń** w stylu panelu zamiast szarych okienek przeglądarki — z jednym
   wyjątkiem („Usuń wszystko z katalogu"), gdzie zostało twarde okno. Treść pytań bez zmian.
3. **Ustawienia spedycji i lista przewoźników w Wadze gabarytowej zapisują się na serwerze**
   i są wspólne dla wszystkich — w starym Bridgu żyły tylko w przeglądarce (uzgodnione).
4. **Selly na staging nie wysyła nic do sklepu** (zabezpieczenie środowiska).
5. **Brak filtru „Źródło"** w atrybutach — w starym Bridgu i tak nic nie robił.
6. **Promocja po terminie przestaje obniżać ceny**, a zaplanowana włącza się sama w dniu startu
   — w starym Bridgu daty nic nie zmieniały (uzgodnione).
7. **Kolumna „Konstrukcja opony" jest wypełniona** („Radialna"/„Diagonalna") tam, gdzie w starym
   Bridgu są dziś kreski — w produkcji wrześniowa poprawka trafiła do nieużywanego pliku panelu.
   To zmiana na lepsze, nie usterka.
8. **Rzeczy, które w starym Bridgu są zepsute, a tu działają:** kafel „Ostatni eksport CSV" na
   Pulpicie, dwie karty „Dostępności" w Analityce, polskie litery w nazwach alertów, jedna
   marka ALLIANCE w filtrze Katalogu, Historia bez limitu 5000 zdarzeń.
9. **Eksport CSV w Analityce to dokładnie tabela z ekranu** (po Twoich filtrach), a nie osobny
   zestaw danych.
10. **Archiwum importów:** przy błędzie pobierania pliku pojawia się komunikat w rogu ekranu
    zamiast szarego okienka; wybrany w filtrze dostawca albo miesiąc zostaje widoczny, nawet
    gdy zniknie z listy (w starym Bridgu filtr wracał wtedy do „Wszyscy dostawcy"); komunikat
    o błędzie wczytywania znika po udanym „Odśwież" (w starym Bridgu wisiał do przeładowania
    strony).
11. **Alerty mają przycisk „Otwórz ponownie"** — w starym Bridgu rozwiązanego alertu nie
    dało się cofnąć. Filtr stanu ma dodatkową opcję „Nierozwiązane" i od niej startuje.
12. **Waga gabarytowa pyta o potwierdzenie** przy usuwaniu przewoźnika i przy „Przywróć
    domyślne" — w starym Bridgu oba działały od razu.

## Rzecz znana i nienaprawiona

**Każdy zalogowany użytkownik widzi zakładki „Admin" i „Dziennik"** — czyli konfigurację
dostawców, usuwanie pozycji, czyszczenie katalogu i pełny dziennik działań. Nie ma technicznego
rozróżnienia na administratora i zwykłego użytkownika.

**Tak samo jest dziś w starym Bridgu**, więc nowa wersja niczego nie pogarsza — ale też niczego
nie naprawia. Wprowadzenie ról to zmiana w bazie i osobna decyzja Twoja. Jeśli chcesz, żeby
tylko Ty miała dostęp do tych zakładek, powiedz — zrobimy to osobnym zadaniem.

---

## Co po przeglądzie

Odeślij tę listę z zaznaczonymi kratkami. Jeśli wszystko na ✅ — przechodzimy do ustalenia
terminu przełączenia produkcji. Jeśli są ❌ — najpierw je zamykamy.

**Przełączenie jest jednorazowe i obejmuje wszystko naraz** (nie da się „częściowo"), a nowy
panel będzie pracował na **tej samej bazie** co obecny — nic z Twoich danych nie przepada.
Po przełączeniu trzeba będzie zalogować się od nowa; hasło zostaje bez zmian.
