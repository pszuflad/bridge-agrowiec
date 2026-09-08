# Przegląd 12 widoków — finalna akceptacja nowego Bridge'a

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-08
**Dla kogo:** Ania · **Po co:** to ostatnie sprawdzenie przed przełączeniem produkcji.

> **To jest STAGING, nie produkcja.** Cokolwiek tu ustawisz, zmienisz albo zepsujesz —
> produkcji nie dotyka. Klikaj bez skrupułów, próbuj popsuć.

> **Czym to się różni od poprzednich instrukcji.** Wcześniejsze (`instrukcja-testow-I3`,
> `I4`, `I6`…) sprawdzały po jednej nowej funkcji. **Ta sprawdza CAŁOŚĆ** — czy wszystko, co
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
**menu po lewej (sidebar) ma być widoczne ZAWSZE**, na każdym z 12 ekranów. Do niedawna
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
- [ ] ✅ / ❌ — szukajka po kodzie, nazwie i rozmiarze.
- [ ] ✅ / ❌ — **przycisk „Wszystkie" przy rozmiarze strony** (pokazuje cały katalog naraz):
      lista przewija się płynnie do samego końca. ⚠ To miejsce było zepsute i zostało
      naprawione — jeśli przewijanie się zatnie albo lista skończy się za wcześnie, zaznacz ❌.
- [ ] ✅ / ❌ — menu „Akcje" przy wierszu otwiera się i ma pozycje: edytuj, wstrzymaj, usuń.
- [ ] ✅ / ❌ — **edycja produktu**: zmieniasz coś, zapisujesz, zmiana widać w tabeli.
- [ ] ✅ / ❌ — **usunięcie produktu** pyta o potwierdzenie i po nim produkt znika.
- [ ] ✅ / ❌ — ceny w kolumnach zgadzają się z tym, czego się spodziewasz po narzutach.
- [ ] ✅ / ❌ — eksport do Shopera działa (przycisk pobiera plik).

---

## 4. Narzuty i promocje — adres `/narzuty`

**Ma się pokazać:** dwie listy — narzuty i promocje — z możliwością dodawania i edycji.

**Do kliknięcia:**
- [ ] ✅ / ❌ — dodajesz narzut, pojawia się na liście.
- [ ] ✅ / ❌ — edytujesz istniejący narzut i zmiana się zapisuje.
- [ ] ✅ / ❌ — usuwasz narzut — pyta o potwierdzenie.
- [ ] ✅ / ❌ — to samo dla promocji.
- [ ] ✅ / ❌ — po zmianie narzutu ceny w Katalogu faktycznie się przeliczają.

> ⚠ **Rzecz, którą odtworzyliśmy celowo, mimo że wygląda na błąd:** promocja z datą, która
> już minęła, **dalej obniża ceny**. Tak działa stary Bridge i tak zostało przeniesione
> (wpis #19 w naszej liście). Jeśli chcesz to naprawić — to osobna decyzja, nie zgłaszaj jako błąd.

---

## 5. Atrybuty — adres `/atrybuty`

**Ma się pokazać:** lista rodzajów atrybutów, panel wartości i kolejka propozycji („pending").

**Do kliknięcia:**
- [ ] ✅ / ❌ — dodajesz nowy rodzaj — **zapisuje się** (w starym Bridgu ten przycisk był
      zepsuty i nic nie robił; tutaj naprawione).
- [ ] ✅ / ❌ — dodajesz i usuwasz wartość w wybranym rodzaju.
- [ ] ✅ / ❌ — kolejka propozycji: akceptujesz jedną, znika z kolejki.
- [ ] ✅ / ❌ — odrzucasz inną, też znika.

> ⚠ **Czego tu nie ma, a było:** filtr „Źródło" nad listą wartości. W starym Bridgu ten filtr
> **nic nie robił** — zawsze pokazywał „user" i niczego nie zawężał. Świadomie go nie
> przenieśliśmy. Jeśli jednak chcesz mieć działający filtr źródła, powiedz — to osobne zadanie.

---

## 6. Alerty — adres `/alerty`

**Ma się pokazać:** lista alertów o dostawcach i imporcie, z poziomami ważności.

**Do kliknięcia:**
- [ ] ✅ / ❌ — alerty są pogrupowane i da się je odczytać.
- [ ] ✅ / ❌ — oznaczasz alert jako obsłużony i zmienia stan.
- [ ] ✅ / ❌ — filtr po poziomie (krytyczny / ostrzeżenie) działa.

---

## 7. Waga gabarytowa — adres `/waga-gabarytowa`

**Ma się pokazać:** kalkulator wymiarów + lista przewoźników z dzielnikami.

**Do kliknięcia:**
- [ ] ✅ / ❌ — paczka 60 × 50 × 50 u GEIS-a (dzielnik 10 000) daje **15 kg**.
- [ ] ✅ / ❌ — zmiana przewoźnika zmienia wynik (DPD 25 kg, GLS 37,50 kg dla tej samej paczki).
- [ ] ✅ / ❌ — po podaniu wagi rzeczywistej pojawia się „waga do wyceny" (większa z dwóch).
- [ ] ✅ / ❌ — dodajesz własnego przewoźnika i po odświeżeniu strony nadal tam jest.

> ⚠ **Tak jak w starym Bridgu:** lista przewoźników zapisuje się **tylko na tym komputerze
> i w tej przeglądarce**. Nikt inny jej nie zobaczy. To nie usterka — tak działa oryginał.

---

## 8. Analityka — adres `/analityka`

**Ma się pokazać:** zestaw wykresów i tabel. ⚠ Ten ekran ładuje się chwilę dłużej niż inne —
to normalne, wykresy są ciężkie.

**Do kliknięcia:**
- [ ] ✅ / ❌ — wykresy się rysują (nie same puste ramki).
- [ ] ✅ / ❌ — przełączanie zakładek analityki działa.
- [ ] ✅ / ❌ — zmiana zakresu dat przelicza dane.
- [ ] ✅ / ❌ — eksport CSV pobiera plik z danymi.

> ⚠ **Dwie karty „Dostępności" mogą być puste** — to znany, odtworzony 1:1 błąd starego
> Bridge'a (baza nie ma potrzebnej kolumny; wpis #32). Pusto = zgodnie z oryginałem, nie
> zgłaszaj. Jeśli chcesz, żeby działały — to osobne zadanie.

---

## 9. Historia — adres `/historia`

**Ma się pokazać:** lista zmian w katalogu, z filtrem po dostawcy i stronicowaniem.

**Do kliknięcia:**
- [ ] ✅ / ❌ — widać wpisy z ostatnich importów.
- [ ] ✅ / ❌ — filtr po dostawcy zawęża listę.
- [ ] ✅ / ❌ — stronicowanie przechodzi na kolejne strony.

> ⚠ **Tak jak w starym Bridgu:** historia **nie pokazuje** importów z adresów URL ani ręcznych
> synchronizacji — tylko zmiany katalogu (wpis #21).

---

## 10. Konfiguracja — adres `/konfiguracja`

Najbardziej rozbudowany ekran — kilka zakładek.

**Zakładka „Dostawcy":**
- [ ] ✅ / ❌ — lista dostawców z ich statusami.
- [ ] ✅ / ❌ — wgrywasz plik cennika ręcznie i pozycje trafiają do Staging.
- [ ] ✅ / ❌ — „Synchronizuj teraz" przy dostawcy z adresem URL uruchamia pobranie.

**Zakładka „Spedycja":**
- [ ] ✅ / ❌ — ustawienia zapisują się i są widoczne po odświeżeniu.

> ⚠ **Świadoma zmiana na lepsze:** w starym Bridgu ustawienia spedycji żyły **tylko w Twojej
> przeglądarce**. Tutaj zapisują się na serwerze, więc przetrwają zmianę komputera (wpis #29).
> Tak było uzgodnione — to jedna z niewielu rzeczy, które celowo robimy inaczej.

**Zakładka „Shoper" i „AI":**
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

## 11. Selly — adres `/selly`

**Ma się pokazać:** panel integracji ze sklepem Selly.pl.

**Do kliknięcia:**
- [ ] ✅ / ❌ — zakładka „Status" pokazuje stan integracji.
- [ ] ✅ / ❌ — zakładka „Dziennik" pokazuje historię synchronizacji.
- [ ] ✅ / ❌ — „Wygeneruj CSV teraz" tworzy plik i pokazuje jego datę.

> ⚠ **Na staging Selly jest CELOWO WYŁĄCZONY.** Operacje wysyłające cokolwiek do sklepu
> odmówią działania, nawet gdyby ktoś wpisał prawdziwe hasła. Tak ma być — staging nie ma
> prawa dotknąć Waszego sklepu. Jeśli zobaczysz „tryb wyłączony", to jest poprawne zachowanie,
> a nie usterka. Pełną integrację włączymy dopiero na produkcji.

---

## 12. Moje konto — adres `/moje-konto`

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
3. **Ustawienia spedycji zapisują się na serwerze**, a nie tylko w przeglądarce (uzgodnione).
4. **Selly na staging nie wysyła nic do sklepu** (zabezpieczenie środowiska).
5. **Brak filtru „Źródło"** w atrybutach — w starym Bridgu i tak nic nie robił.
6. **Wygasłe promocje nadal obniżają ceny** i **dwie karty „Dostępności" są puste** — oba
   odtworzone 1:1 ze starego Bridge'a. Jeśli chcesz je naprawić, powiedz — zrobimy osobno.

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
terminu przełączenia produkcji (`docs/cutover.md`). Jeśli są ❌ — najpierw je zamykamy.

**Przełączenie jest jednorazowe i obejmuje wszystko naraz** (nie da się „częściowo"), a nowy
panel będzie pracował na **tej samej bazie** co obecny — nic z Twoich danych nie przepada.
Po przełączeniu trzeba będzie zalogować się od nowa; hasło zostaje bez zmian.
