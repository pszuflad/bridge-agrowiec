# Pytania do Ani — runda 3 (przed pełnym testem i przełączeniem)

**Data:** 22.09.2026 · **Od:** Paweł

## Po co ta runda

Zostało nam niewiele do końca odbudowy. Żeby zaplanować ostatnie prace i dać Ci do testów
**pełny system**, potrzebujemy Twoich odpowiedzi w czterech sprawach: synchronizacja z Selly,
Twoje zmiany z września, dwie zaległe odpowiedzi i sam termin przełączenia.

Pytania oznaczone ⭐ blokują konkretne prace. Jeśli masz czas tylko na część, zacznij od nich.

## Najpierw dwie informacje (bez pytań)

- **Selly, „Wygeneruj CSV teraz" na stagingu:** znaleźliśmy przyczynę i naprawiliśmy. Plik
  kasowała każda aktualizacja stagingu. Nie musisz już szukać godziny kliknięcia (pytanie 12.6
  jest zamknięte). Po najbliższej aktualizacji stagingu kliknij przycisk raz, żeby plik powstał
  od nowa.
- **Zepsute polskie znaki w alertach:** w poprzedniej rundzie pisaliśmy o 339 alertach. Było
  ich więcej: 435 alertów z zepsutą nazwą typu i ponad 2000 z zepsutą treścią. Wszystkie
  poprawimy w dniu przełączenia. Stary Bridge psuje znaki w każdym nowym alercie, nowy zapisuje
  je poprawnie.

---

## 1. Synchronizacja z Selly

Nowy podsystem synchronizacji z Selly, który uruchomiłaś we wrześniu, to ostatnia duża
funkcja, której nowy Bridge jeszcze nie ma. Wstrzymaliśmy jego przenoszenie 9.09, bo wtedy
jeszcze go poprawiałaś. Od 17.09 nie widzimy w nim zmian.

### ⭐ 1.1 Czy synchronizacja z Selly jest już skończona?

- **(a)** tak, działa stabilnie i nie planuję w niej zmian — możecie przenosić
- **(b)** działa, ale planuję jeszcze zmiany (napisz jakie i mniej więcej kiedy)
- **(c)** nadal ją poprawiam

> **ODPOWIEDŹ:**
>
>

### ⭐ 1.2 Z których części korzystasz?

Zaznacz wszystkie, których używasz.

- **(a)** nocna pełna synchronizacja (ceny, stany, cechy, kategorie)
- **(b)** aktualizacja cen i stanów w ciągu dnia (tylko zmienione produkty)
- **(c)** przyciski ręcznej synchronizacji w panelu Selly
- **(d)** eksport pliku CSV dla Selly (stary mechanizm, plik o 6:00)
- **(e)** coś innego (napisz)

> **ODPOWIEDŹ:**
>
>

### 1.3 Nowe produkty w Selly

Gdy w katalogu pojawia się produkt, którego w Selly jeszcze nie ma, kod synchronizacji ma
miejsce na jego automatyczne założenie. Dziś ta ścieżka w starym Bridge **nie działa**: jest
zablokowana i kończy się błędem.

- **(a)** zakładam nowe produkty w Selly ręcznie — tak ma zostać
- **(b)** chcę, żeby Bridge zakładał je sam
- **(c)** nie wiem, jak to dziś wygląda

> **ODPOWIEDŹ:**
>
>

### 1.4 Dwie usterki, które znaleźliśmy w starym Bridge

1. **Mylące statusy w panelu:** część produktów pokazuje status „oczekuje na założenie", choć
   synchronizacja się udała. Działaniu synchronizacji to nie szkodzi, tylko diagnostyce.
2. **Usunięcie produktu z katalogu nie czyści jego powiązania z Selly.** Stary rekord potrafi
   trzymać w wyszukiwarce sklepu nieaktualne dane. 17.09 poprawiałaś taki przypadek ręcznie.

- **(a)** naprawcie obie
- **(b)** naprawcie tylko: ____
- **(c)** zostawcie jak jest

> **ODPOWIEDŹ:**
>
>

---

## 2. Twoje zmiany z września (10–18.09)

Przenosimy do nowego Bridge wszystko, co zmieniłaś na produkcji we wrześniu: blokady form
płatności, listę zastosowań per kategoria, porządki w kategoriach, Forwarder/Harwester,
Ładowarka → Ciągnik, odrzucanie quadów i kosiarek w MO9 oraz szerokość bez zer końcowych.
Sprawdziliśmy to na Twoich ośmiu cennikach: nowy Bridge czyta je identycznie, a jedyne różnice
to właśnie te zmiany.

### ⭐ 2.1 Czy planujesz jeszcze zmiany na produkcji przed przełączeniem?

Każda zmiana w starym Bridge musi zostać przeniesiona także do nowego. Proponujemy, żeby od
ustalonego dnia zmiany w starym Bridge były tylko po wcześniejszym uzgodnieniu (poza pilnymi
awariami).

- **(a)** nie planuję więcej zmian
- **(b)** planuję (napisz jakie)
- **(c)** zgoda na „zamrożenie" od dnia: ____

> **ODPOWIEDŹ:**
>
>

### 2.2 Czy lista zastosowań i blokady płatności są ostateczne?

- **(a)** tak, obie są ostateczne
- **(b)** jeszcze je zmienię (napisz, co)

> **ODPOWIEDŹ:**
>
>

### ⭐ 2.3 Świeża kopia bazy na stagingu

Staging ma dziś bazę z połowy sierpnia, więc **nie zobaczysz na nim swoich wrześniowych
porządków w danych** (kategorie, szerokości, zastosowania). Do pełnego testu chcemy wgrać na
staging świeżą kopię bazy produkcji. Staging stoi na tym samym serwerze, więc dane nigdzie nie
wyjeżdżają. Produkcji nic się nie dzieje.

- **(a)** zgoda — w dowolnym momencie
- **(b)** zgoda, ale w terminie: ____
- **(c)** nie (napisz dlaczego)

> **ODPOWIEDŹ:**
>
>

### 2.4 Szerokość opony — potwierdzenie

W instrukcji testów Iteracji 3 napisaliśmy, że szerokość „10.00" zostanie taka, jak w pliku.
18.09 zmieniłaś to na produkcji: szerokość traci zera końcowe („10.00" zamienia się na „10"),
żeby filtr nie rozdzielał tych samych wartości. **Przyjmujemy Twoją nową wersję** i poprawimy
instrukcję. Zaznacz tylko, jeśli coś się nie zgadza.

> **ODPOWIEDŹ (tylko jeśli coś się nie zgadza):**
>
>

### 2.5 Agro-Rami (MO9) — stany magazynowe z hurtowni

MO9 to jedyny dostawca, z którym Bridge łączy się bezpośrednio z hurtownią (od 10.07), a nie
przez plik. Dzięki temu widać prawdziwe stany, np. „5+" albo „15+". Tego połączenia nie
testowaliśmy jeszcze z Tobą — dojdzie do instrukcji pełnego testu.

- **(a)** stany MO9 w starym Bridge zgadzają się z tym, co widzę w hurtowni Agro-Rami
- **(b)** widzę rozbieżności (napisz przykład: kod produktu, stan w Bridge, stan w hurtowni)
- **(c)** nie porównywałam

> **ODPOWIEDŹ:**
>
>

---

## 3. Dwie zaległe odpowiedzi z poprzedniej rundy

Tych odpowiedzi nie mamy zapisanych. Jeśli już odpowiadałaś, przepraszamy za powtórkę.

### ⭐ 3.1 Kafelki na górze Analityki

- **(a)** jak w starym Bridge: Dostawcy / EAN wspólne / Pozycje unikalne / Snapshoty
- **(b)** zostawiamy obecne: Produkty / Dostawcy / Śr. marża / Staging oczekujące
- **(c)** mieszanka (napisz które)

> **ODPOWIEDŹ:**
>
>

### 3.2 Podział na administratora i zwykłego użytkownika

Dziś każdy zalogowany widzi zakładki „Admin" i „Dziennik": konfigurację dostawców, usuwanie
pozycji, czyszczenie katalogu i pełny dziennik działań. W starym Bridge jest tak samo.

- **(a)** tylko ja mam mieć dostęp do tych zakładek
- **(b)** zostawiamy jak jest

> **ODPOWIEDŹ:**
>
>

---

## 4. Pełny test i przełączenie

### ⭐ 4.1 Kto będzie testował i ile czasu potrzebujesz?

Po zakończeniu prac dostaniesz jedną instrukcję pełnego testu całego systemu, zamiast osobnych
kartek dla każdej iteracji.

- Kto testuje (Ty, Marta, ktoś jeszcze): ____
- Ile dni roboczych potrzebujesz na test: ____
- Od kiedy możesz zacząć: ____

> **ODPOWIEDŹ:**
>
>

### 4.2 Kiedy najlepiej przełączyć?

Przełączenie trwa krótko, ale na ten czas wstrzymujemy importy (idą co godzinę)
i synchronizację z Selly.

- Preferowany dzień tygodnia: ____
- Preferowana pora (np. wieczór po pracy, wcześnie rano przed 6:00): ____
- Dni, których na pewno nie (np. duże zamówienia, wysyłki): ____

> **ODPOWIEDŹ:**
>
>

### 4.3 Stary Bridge po przełączeniu

- **(a)** może zniknąć od razu
- **(b)** niech zostanie dostępny tylko do podglądu przez: ____ (np. 2 tygodnie)

> **ODPOWIEDŹ:**
>
>

---

## Uwagi końcowe

Miejsce na wszystko, o co nie zapytaliśmy.

> **ODPOWIEDŹ:**
>
>

---

*Pytania z instrukcji testów w wersji 2 (Historia, Alerty, Atrybuty, Waga gabarytowa) zostają
w tamtych dokumentach: m.in. gdzie używasz rodzajów „model" i „zastosowanie", progi kalkulatora
paletowego i pole „priorytet" w regułach cen. Odpowiedz tam, kiedy będziesz je testować.*
