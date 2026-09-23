# Pełny test systemu — dokument 1 z 3

**Dla kogo:** Ania · **Środowisko:** https://test.agritires.eu · **Data:** 2026-09-24

> **To jest STAGING, nie produkcja.** Cokolwiek tu zmienisz albo zepsujesz — produkcji nie dotyka.
> Klikaj bez skrupułów.

---

## Najpierw przeczytaj te trzy akapity

**Ścieżkę główną testujesz osobnym dokumentem.** Import od dostawców, parsery, zapis do bazy,
plik CSV i przekazanie go do Selly — to wszystko jest w **dokumencie 2 („Test ścieżki
krytycznej")** i **od niego zaczynasz**. Tutaj tych scenariuszy nie ma i nie trzeba ich powtarzać.

**Ten dokument nie zastępuje „Przeglądu widoków".** Lista kontrolna wszystkich 13 ekranów —
co ma się pokazać i co kliknąć — została bez zmian w `przeglad-12-widokow.md`. Tutaj jest tylko
to, **co zmieniło się po 22 września** i czego tamten dokument nie obejmuje. Jeśli przechodzisz
system pierwszy raz, weź oba: najpierw przegląd, potem ten.

**Zaznaczaj kratki ✅/❌.** Przy ❌ dopisz jedno zdanie, co było nie tak — „kliknęłam zapisz
i nic się nie stało" w zupełności wystarczy.

---

## Na czym testujesz

| | |
|---|---|
| **Adres** | https://test.agritires.eu |
| **Wersja** | najnowsza z gałęzi roboczej (`develop`) |
| **Baza** | kopia produkcji z **23 września**, 8329 produktów — Twoje prawdziwe dane sprzed kilku dni |
| **Automatyczny import** | **WŁĄCZONY** — cenniki z adresów URL pobierają się same, tak jak na produkcji |
| **Selly** | **WYŁĄCZONE** — trzema niezależnymi blokadami, nic nie dotrze do sklepu |

**Co znaczy „Selly wyłączone":** integracja odmawia każdej operacji, nocna i dzienna
synchronizacja nie chodzi, a hasła do sklepu celowo nie są tu wpisane. Nawet gdyby ktoś je
wpisał, staging i tak nic nie wyśle. Wszystko, co zobaczysz na ekranie Selly w stylu „tryb
wyłączony", jest **poprawne**.

⚠ **Jedna rzecz, która z tego wynika i wygląda jak awaria.** Po imporcie, który zmienił
dostępność produktu, **nie powstanie nowy plik CSV** — bo to część integracji ze sklepem,
a ta jest wyłączona. Nie ma błędu, nie ma komunikatu, po prostu nic się nie dzieje.
**Tak ma być.** Włączymy to dopiero na produkcji.

Nie myl tego z przyciskiem **„Wygeneruj CSV teraz"** na ekranie Selly — ten **działa** i plik
po nim powstaje. Wyłączone jest tylko samoczynne odświeżanie pliku po imporcie.

---

## Zanim klikniesz cokolwiek w poczekalni

**Co zmieniliśmy:** od 22 września panel sprawdza, czy zgłoszenie w poczekalni jest wiarygodne,
zanim pozwoli je zaakceptować.

**Czego się spodziewać:** baza jest kopią produkcji z 23 września, więc w poczekalni leży
**dużo zgłoszeń sprzed tej zmiany** — przyszły wcześniej i nie przeszły przez nowe sprawdzenia.
Panel **odmówi ich zaakceptowania** i pokaże okno **„Nie zapisano zmian"** z wyjaśnieniem — najczęściej *„To zgłoszenie pochodzi
ze starego importu. Odśwież cennik przed akceptacją."*, a przy pozycjach z odznaką
„Brak w cenniku" *„Brak trzech wiarygodnych potwierdzeń nieobecności. Wczytaj aktualny cennik."*
Które wyjaśnienie dostaniesz, zależy od tego, czego akurat brakuje danej pozycji.

**To nie jest usterka — to działające zabezpieczenie.** Żeby przetestować akceptację normalnie:

**Polecenie:** wejdź w **Konfiguracja → Dostawcy**, kliknij „Synchronizuj" przy dowolnym
dostawcy z adresem URL. Poczekaj, aż import się skończy, i wróć do **Staging**.

**Rezultat:** świeże pozycje z tego importu akceptują się normalnie. Stare dalej odmawiają — i tak
ma zostać.

- [ ] ✅ / ❌ — stare zgłoszenie odmawia akceptacji z czytelnym wyjaśnieniem (a nie pustą stroną).
- [ ] ✅ / ❌ — po imporcie świeże pozycje akceptują się bez przeszkód.

⚠ **„Akceptuj wszystkie" na kilku tysiącach pozycji potrafi mielić kilkanaście minut** i panel
wygląda wtedy na zawieszony. To nie zawieszenie — zaczekaj albo zawęź wcześniej listę filtrem.

---

# Część 1 — co się zmieniło po 22 września

To jest sedno tego dokumentu. Każdy punkt: co zmieniliśmy → co zrobić → co ma się pokazać.

## 1.1 Staging — przycisk „Rozstrzygnij"

**Co zmieniliśmy:** zgłoszenia, których nie wolno rozstrzygnąć zwykłą akceptacją, mają teraz
w kolumnie „Akcje" własny przycisk **„Rozstrzygnij"** (przy starej karcie w katalogu napis brzmi
**„Sprawdź kartę"**).

**Polecenie:** wejdź na **Staging**, poszukaj wiersza z tym przyciskiem i kliknij go.

**Rezultat:** otwiera się okno, które pokazuje jedną z trzech spraw — zależnie od tego, co jest
nie tak z pozycją:

| Co zobaczysz | O co chodzi | Co możesz zrobić |
|---|---|---|
| **„Porównaj starą kartę z obecną ofertą"** | w katalogu jest stara karta, a w cenniku pozycja, która może być tą samą oponą albo inną | zaznaczasz właściwą kartę i klikasz „Zapisz wybór w katalogu" |
| **„Sprawdź dopasowanie opony"** | panel nie jest pewien, do którego produktu przypisać pozycję | wybierasz produkt z listy albo „To osobna opona. Przygotuj ją jako nowy produkt." i klikasz „Zapisz wybór" |
| **dwa wiersze z jednego pliku** | dostawca przysłał dwa wiersze na jedną kartę i dane się różnią | tylko oglądasz — tego nie da się rozstrzygnąć kliknięciem, trzeba wyjaśnić u dostawcy |

- [ ] ✅ / ❌ — przycisk otwiera okno, a okno mówi zrozumiale, o co chodzi w tej konkretnej pozycji.
- [ ] ✅ / ❌ — „Zamknij" nic nie zmienia.
- [ ] ✅ / ❌ — po zapisaniu wyboru pozycja znika z poczekalni, a katalog wygląda zgodnie z Twoim wyborem.

> ⚠ **Przy różnym DOT-cie okno odradza łączenie kart** („RÓŻNY — nie łączyć"). Różny DOT oznacza
> inną oponę — wtedy nie wybieraj jednej karty.

## 1.2 Staging — dlaczego panel odmawia akceptacji

**Co zmieniliśmy:** zamiast zapisać wątpliwą zmianę, panel pokazuje okno **„Nie zapisano zmian"**
i mówi, czego brakuje.

**Polecenie:** spróbuj zaakceptować różne pozycje w poczekalni — zwłaszcza te z odznaką
„Brak w cenniku" i te, które mają przycisk „Rozstrzygnij".

**Rezultat:** zamiast cichego zapisu dostajesz jedno z wyjaśnień, np.:
- *„Brak trzech wiarygodnych potwierdzeń nieobecności. Wczytaj aktualny cennik."* — opona musi
  zniknąć z trzech kolejnych kompletnych cenników, zanim uznamy ją za wycofaną;
- *„Najpierw rozstrzygnij dopasowanie opony przyciskiem «Rozstrzygnij»."*;
- *„Produkt zmienił się po utworzeniu zgłoszenia. Wczytaj aktualny cennik…"*;
- *„Błędny EAN: popraw numer w edycji zgłoszenia przed akceptacją."*

- [ ] ✅ / ❌ — komunikat mówi, **co zrobić**, a nie tylko że się nie udało.
- [ ] ✅ / ❌ — po wykonaniu tego, o co prosi, akceptacja przechodzi.

## 1.3 Staging — „Braki w cenniku" zamiast „Wycofane"

**Co zmieniliśmy:** nazwę, nie zachowanie — filtr nazywa się teraz **„Braki w cenniku"**,
a odznaka przy wierszu **„Brak w cenniku"**. To ta sama zmiana, którą wprowadziliście
na produkcji.

**Polecenie:** rozwiń filtr typu zmiany na ekranie Staging.

**Rezultat:** opcje to „Wszystkie", „Nowe produkty", „Nowe produkty (stare)", **„Braki w cenniku"**,
„Zmiany kluczowe", „Błędy importu". Wybranie „Braki w cenniku" pokazuje pozycje z czerwoną odznaką
„Brak w cenniku".

- [ ] ✅ / ❌ — nazwy są takie jak wyżej i filtr faktycznie zawęża listę.

> ⚠ **„Nowe produkty (stare)"** to pozostałość po starszym zapisie danych — dziś nic nie znajdzie.
> Jest w oryginale, więc zostawiliśmy. Nie zgłaszaj.

## 1.4 Katalog — kolumna „Blokowane formy płatności"

**Co zmieniliśmy:** w katalogu jest kolumna z numerami form płatności zablokowanych dla danego
magazynu — ta sama lista, którą macie na produkcji.

**Polecenie:** wejdź na **Katalog** i znajdź kolumnę „Blokowane formy płatności" (jest szeroka,
może trzeba przewinąć tabelę w prawo).

**Rezultat:** przy produktach większości dostawców widać ciąg numerów; przy **MO6 (Uniglory)
kolumna pokazuje „—"** i **tak ma być** — ten dostawca celowo nie ma wpisu.

- [ ] ✅ / ❌ — kolumna jest, numery wyglądają sensownie, „—" tylko przy MO6.

## 1.5 Analityka — pliki CSV są teraz PEŁNE

**Co zmieniliśmy:** na Twoją prośbę z 23 września plik CSV zawiera **cały zbiór danych**, a nie
tylko to, co zmieściło się w tabeli na ekranie.

**Sprostowanie do „Przeglądu widoków":** tamten dokument mówi, że plik CSV to „dokładnie to,
co widać w tabeli — ta sama liczba wierszy". **Od 23 września to już nieprawda** — tabela na
ekranie rysuje najwyżej 300 wierszy, a plik ma wszystko.

**Polecenie:** wejdź na **Analityka**, ustaw dowolne filtry, na kilku kartach kliknij przycisk
**„CSV"** i otwórz pobrane pliki.

**Rezultat:**
- plik ma **wyraźnie więcej wierszy niż tabela na ekranie** — na naszych danych testowych karta
  „Dostępność produktów" dała ponad 5000 wierszy zamiast dawnych 500, a „Zmiany cen" ponad 1600
  zamiast 500. U Ciebie liczby będą inne; ważne jest to, że plik jest wielokrotnie większy
  niż tabela;
- **Twoje filtry działają na plik tak samo jak na tabelę** — plik to przefiltrowane dane,
  nie wszystko jak leci;
- jeśli pobieranie się nie uda, **nie dostaniesz niepełnego pliku** — pojawi się komunikat o błędzie.
  Tak ustaliliśmy: lepiej żaden plik niż po cichu ucięty.

- [ ] ✅ / ❌ — plik ma wyraźnie więcej wierszy niż tabela na ekranie.
- [ ] ✅ / ❌ — po zawężeniu filtrów plik też się zawęża.
- [ ] ✅ / ❌ — kolumny w pliku zgadzają się z kolumnami tabeli.

> ⚠ **Dwie karty nie mają przycisku „CSV"** — „Sezonowy wzorzec cen" i „Cykl życia modeli".
> W starym Bridgu też ich nie mają. Nie zgłaszaj.

## 1.6 Wgrywanie ręczne — podsumowanie po wgraniu pliku

**Co zmieniliśmy:** w podsumowaniu, które wyskakuje po wgraniu cennika, człon „Wycofane"
nazywa się teraz **„Braki w cenniku"** — spójnie ze Stagingiem.

**Polecenie:** **Konfiguracja → Wgrywanie ręczne**, wgraj dowolny cennik.

**Rezultat:** podsumowanie wymienia m.in. „Do akceptacji w stagingu", „Nowe", „Zmienione",
**„Braki w cenniku"**, „Bez zmian".

- [ ] ✅ / ❌ — podsumowanie się pokazuje i liczby wyglądają sensownie.

---

# Część 2 — lista kontrolna reszty systemu

Tutaj **nie ma rozpisanych scenariuszy** — szczegóły są w „Przeglądzie widoków". Chodzi o jedno:
wejdź, sprawdź, że ekran działa i wygląda sensownie, i zaznacz kratkę.

- [ ] ✅ / ❌ — **Pulpit** — kafelki mają sensowne liczby, kliknięcie kafelka z alertami przenosi na Alerty.
- [ ] ✅ / ❌ — **Katalog** — filtry, szukajka, edycja i usunięcie produktu działają; ceny zgadzają się z narzutami.
- [ ] ✅ / ❌ — **Narzuty i promocje** — dodanie, edycja i usunięcie działa, a zmiana narzutu przelicza ceny w Katalogu.
- [ ] ✅ / ❌ — **Atrybuty** — dodanie rodzaju i wartości działa; kolejka propozycji przyjmuje i odrzuca.
- [ ] ✅ / ❌ — **Alerty, zakładka „Import"** — stany alertu (nowy → przejrzany → rozwiązany) i „Otwórz ponownie" działają; szukajka po treści zawęża listę.
- [ ] ✅ / ❌ — **Alerty, zakładka „Katalog"** — lista **nie jest pusta** i filtr po poziomie działa.
- [ ] ✅ / ❌ — **Waga gabarytowa** — kalkulator liczy (paczka 60 × 50 × 50 u GEIS-a = 15 kg), dodanie i usunięcie przewoźnika działa.
- [ ] ✅ / ❌ — **Analityka** — wykresy się rysują, zakładki się przełączają, filtry zawężają dane.
- [ ] ✅ / ❌ — **Historia** — widać wpisy z ostatnich importów, filtry po dostawcy i typie działają.
- [ ] ✅ / ❌ — **Archiwum importów** — filtry działają, a „Pobierz" zapisuje plik pod nazwą od dostawcy.
- [ ] ✅ / ❌ — **Konfiguracja** — wszystkie osiem zakładek otwiera się, a ustawienia zapisują się i przeżywają odświeżenie strony.
- [ ] ✅ / ❌ — **Selly** — ekran się otwiera i pokazuje „tryb wyłączony" (to poprawne, patrz wyżej).
- [ ] ✅ / ❌ — **Moje konto** — dane się zgadzają, zmiana hasła działa, „Wyloguj" wylogowuje.
- [ ] ✅ / ❌ — **menu po lewej jest widoczne na KAŻDYM ekranie.**

**Zakładka „Katalog" w Alertach — czego się spodziewać.** Liczy cztery rzeczy na żywo z katalogu:
marża ujemna (sprzedaż pod kosztem), bardzo niska marża, pozycja rozpoznana jako nie-opona,
oraz dostawca, od którego długo nie przyszedł cennik. Nie trzeba nic uruchamiać — liczy się samo
po wejściu na ekran.

---

# Czego NIE zgłaszać

Trzy rzeczy są nam **znane, zmierzone i świadomie odłożone na po przełączeniu**. Zobaczysz je,
ale nie są to nowe usterki:

1. **Atrybuty, rodzaj „bieżnik" — cztery bieżniki widać podwójnie.** `FLOTATION T422` i
   `Flotation T422`, `LOGGER KING TRS-2` i `Logger King TRS-2`, `MAGLIFT LIP` i `Maglift LIP`,
   `MG121 PROWADZĄCA` i `MG121 prowadząca` — 8 wierszy zamiast 4. Porządkowaliśmy pisownię marek,
   ale nie bieżników. *(Jest o tym pytanie niżej.)*

2. **Analityka, „Sezonowy wzorzec cen" — `Alliance` i `ALLIANCE` jako dwie marki.** Dla lipca
   zobaczysz dwa wiersze tej samej marki z różną średnią ceną. Ta karta czyta archiwalny zapis
   cen, a archiwum celowo zostawiliśmy nietknięte — to dziennik stanu z chwili zapisu.

3. **Analityka, „Historia dostępności" — kilka pozycji z niewłaściwym EAN-em i zawyżonym
   procentem.** Przy dokładnym sprawdzaniu znajdziesz 9 takich pozycji. To usterka odziedziczona
   po starym Bridgu; wcześniej jej nie było widać, bo ta karta była zawsze pusta.

Poza tym nadal obowiązuje wszystko z sekcji **„Rzeczy, które wyglądają inaczej — i to jest
w porządku"** w „Przeglądzie widoków" (adresy bez `#`, okna potwierdzeń w stylu panelu,
ustawienia spedycji na serwerze, wypełniona kolumna „Konstrukcja opony" i tak dalej).

---

# Do Twojej decyzji

Cztery rzeczy, które znaleźliśmy przy pracy i które **nie są usterkami do naprawy, tylko
pytaniami o to, jak ma być**. Zaznacz wariant przy każdej.

### 1. Reguły narzutu nie mają pola „priorytet"

**Rzecz w skrócie:** gdy dwie reguły pasują do tego samego produktu, o wyniku decyduje ukryty
priorytet, którego nie widać w formularzu i nie da się ustawić. Dziś to bez znaczenia — macie
jeden narzut i zero promocji, więc nie ma czemu wchodzić w konflikt. Pytanie wisi od 19 września.

- [ ] **A.** Zostaw jak jest — wrócimy do tego, gdy reguł będzie więcej.
- [ ] **B.** Dodaj pole „priorytet" do formularza, żebym sama decydowała, która reguła wygrywa.

### 2. Każdy zalogowany widzi zakładki „Admin" i „Dziennik"

**Rzecz w skrócie:** konfigurację dostawców, usuwanie pozycji, czyszczenie katalogu i pełny
dziennik działań widzi każdy, kto się zaloguje. **Tak samo jest dziś w starym Bridgu** — nowa
wersja niczego nie pogarsza, ale też niczego nie naprawia.

- [ ] **A.** Zostaw jak jest — tak działa dzisiaj i to wystarcza.
- [ ] **B.** Zróbcie podział: tylko ja mam dostęp do tych zakładek, reszta ich nie widzi.

### 3. Ręczne poprawki Marty nadpisują się po cichu

**Rzecz w skrócie:** ręczna poprawka nadal **wygrywa** z plikiem dostawcy — ta zasada się nie
zmieniła. Zmieniło się to, że gdy plik przynosi wartość sprzeczną z jej decyzją, **nikt się o tym
nie dowiaduje**: pozycja wygląda na niezmienioną, a cena z pliku wchodzi bez pytania. Wcześniej
panel wystawiał wtedy ostrzeżenie i wstrzymywał automatyczne zatwierdzenie całej pozycji.

- [ ] **A.** Zostaw jak jest — poprawka wygrywa, sprzeczność nie ma znaczenia.
- [ ] **B.** Pokazuj ostrzeżenie w zgłoszeniu, ale nie blokuj akceptacji *(nasza propozycja)*.
- [ ] **C.** Pokazuj ostrzeżenie i wstrzymuj automat — każda taka pozycja czeka na kliknięcie człowieka.

### 4. Cztery bieżniki widać podwójnie — złączyć?

**Rzecz w skrócie:** to punkt 1 z listy „czego nie zgłaszać". Przy markach złączyliśmy takie pary
automatycznie. Przy bieżnikach jedna z par to `MG121 PROWADZĄCA` / `MG121 prowadząca` — polski
znak sprawia, że to samo narzędzie tu nie zadziała i trzeba innego podejścia.

- [ ] **A.** Złączcie automatycznie wszystkie cztery pary (z osobnym podejściem do polskich znaków).
- [ ] **B.** Złączcie trzy proste pary, `MG121` poprawię ręcznie.
- [ ] **C.** Zostaw — poprawię wszystkie ręcznie.
- [ ] **D.** Zostaw na później, to nie przeszkadza.

---

# Co po teście

Odeślij ten dokument z zaznaczonymi kratkami i wariantami z sekcji „Do Twojej decyzji".

Jeśli wszystko na ✅ i **dokument 2 (ścieżka krytyczna) też przeszedł** — ustalamy termin
przełączenia. Jeśli są ❌ — najpierw je zamykamy.

Jeden ❌ w tym dokumencie nie blokuje przełączenia tak jak ❌ w dokumencie 2: tutaj chodzi
o rzeczy, które da się poprawić po cutoverze. O tym, czy przełączamy, decyduje ścieżka krytyczna.
