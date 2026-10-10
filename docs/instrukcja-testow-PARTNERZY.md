# Moduł partnerów B2B — co już działa i jak to sprawdzić

**Środowisko:** https://training.agroopony.eu (środowisko testowe) · **Data przygotowania:** 2026-10-10 · **Dla:** Ani

> **To jest środowisko testowe, nie produkcja.** Cokolwiek tu klikniesz, produkcji nie dotyka.
> Moduł jest **nową funkcją** (nie ma go w starym systemie), więc nie ma tu czego „porównywać z oryginałem" — sprawdzasz, czy robi to, co opisano w specyfikacji.

---

## Po co ta kartka

Moduł „Partnerzy" generuje dla każdego partnera (na start TyreWorld i Adtyres) plik z cennikiem w EUR: z wybranych magazynów, z narzutem, kursem i kosztem przesyłki. Ta kartka prowadzi przez to, co **już jest**. Zamówień, trackingu i wysyłki plików na serwer partnera **jeszcze nie ma** (rozdział 3).

**Ile to zajmuje:** około 30–40 minut. Wszystko robisz klikaniem w panelu: menu → **Partnerzy**.

### Jak wypełniać

Każdy punkt kończy się linijką **Twoja ocena:**

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

Przy „ŹLE" napisz, **co zobaczyłaś zamiast** oczekiwanego, i zrób zrzut ekranu.

---

## 1. Kroki

### 1.1 Lista partnerów ⭐
Wejdź w **Partnerzy** w menu. Powinnaś zobaczyć dwóch partnerów: **TyreWorld** i **Adtyres**, obaj **Nieaktywni**, bez harmonogramu, „0 mag. · 0 krajów".
Spróbuj dodać trzeciego (np. „Test"): wpisz nazwę → **Dodaj partnera**. Pojawia się nieaktywny. Ta sama nazwa drugi raz → komunikat „Partner o tej nazwie już istnieje".

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

### 1.2 Konfiguracja partnera ⭐
Przy partnerze kliknij **Konfiguruj**. Na stronie:

1. **Ustawienia** — stan minimalny (domyślnie 2: nie eksportujemy stanu 0 i 1), zaokrąglanie cen, harmonogram w minutach (puste = brak), tolerancja ceny, format pliku (CSV / XML), separator, kanały zamówień. Zmień stan minimalny na 3 → **Zapisz ustawienia** → odśwież stronę: wartość została.
2. **Magazyny** — zaznacz, z których magazynów ma być eksport (przy każdym widać liczbę pozycji). **Bez zaznaczonego magazynu plik będzie pusty.**
3. **Wykluczone produkty** — wklej numery katalogowe, jeden w wierszu; te pozycje nie trafią do pliku.
4. **Kraje** — dodaj np. **FR** i **DE**: narzut w **%** (12 = 12%, liczony od ceny zakupu: zakup × 1,12 — to narzut, nie marża), źródło kursu (NBP tabela A albo ręczny — wtedy podaj kurs), koszty dodatkowe w **PLN** doliczane do każdej opony. Kraj możesz usunąć (pyta o potwierdzenie).

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

### 1.3 Kolumny pliku i pola obliczeniowe
Dalej na tej samej stronie:

1. **Pola obliczeniowe** — własne kolumny z formułą, np. nazwa `CenaDAP`, formuła `cena_FR + 10`. Zmienne: `zakup, stan, waga, dlugosc, szerokosc_paczki, wysokosc` oraz `cena_FR`, `cena_DE` (cena EUR w danym kraju). Separator dziesiętny to **kropka**. Wpisz błędną formułę (np. `zakup *`) → **Zapisz pola** → błąd pokazuje się przy polu, z numerem znaku.
2. **Kolumny pliku** — ustal, co jest w pliku: nazwa w pliku, źródło (pole katalogu / cena kraju / pole obliczeniowe), kolejność strzałkami. Dwie lub więcej kolumn z cenami różnych krajów daje **jeden plik z kolumnami krajów** (jak TyreWorld); jedna kolumna z ceną daje **osobny plik na kraj** (jak Adtyres). Kolejność pracy: najpierw zapisz pola, potem kolumny.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

### 1.4 Podgląd pliku ⭐
Kliknij **Pokaż podgląd**: zobaczysz pierwsze 20 wierszy tak, jak wyglądałby plik, oraz listę błędów i ostrzeżeń. **Nic nie jest zapisywane.** Sprawdź:
- nagłówki kolumn (bez spacji na końcu), ceny z dwoma miejscami po kropce,
- czy pozycje ze stanem 0 i 1 nie wystąpiły,
- błędy: pozycja **bez wagi** lub wymiarów jest pomijana i opisana jako błąd (nigdy cena 0),
- ostrzeżenia: waga uzupełniona automatycznie lub szacowana jest użyta, ale oznaczona.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

### 1.5 Generuj teraz i logi
Kliknij **Generuj teraz**. Pojawia się wynik per plik („zapisano (N pozycji…)") i toast. Niżej w **Logi operacji** nowa linia, a w **Błędy i ostrzeżenia** szczegóły (filtr: wszystkie / błędy / ostrzeżenia). Plik powstaje **w katalogu na serwerze** — partner go nie dostaje (rozdział 3).
Spróbuj przy partnerze bez magazynów albo bez krajów: dostajesz czytelny błąd, a poprzedni plik **nie zostaje nadpisany pustym**.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

### 1.6 Aktywacja
**Aktywuj** / **Dezaktywuj** (na liście i na stronie partnera) zmienia status; partner nigdy nie jest usuwany. Aktywacja **nie uruchamia** automatycznego generowania — harmonogram jest wyłączony na całym serwerze, dopóki go świadomie nie włączymy.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

### 1.7 Zamówienia z e-maila (odbiór i podgląd)
Na stronie partnera sekcja **Zamówienia od partnera**. **Odbierz teraz** jest aktywne tylko, gdy w ustawieniach partnera jest włączony **kanał e-mail** i podany **adres skrzynki**.
Działa też dla partnera nieaktywnego i **nie wymaga** włączania harmonogramu. Wynik: toast „Odebrano pocztę" (wiadomości / nowe zamówienia / powtórzone / błędne) albo „Nie odebrano zamówień" z powodem.
- Bez ustawionych na serwerze `PARTNERZY_IMAP_HOST` i hasła skrzynki dostajesz komunikat z **nazwą brakującej zmiennej** — to oczekiwane, dopóki nie zapadną decyzje o skrzynkach i hasłach.
- Gdy skrzynka testowa jest podłączona: wyślij na nią wiadomość z załącznikiem XML zamówienia (wzór w karcie PARTNERZY), kliknij **Odbierz teraz** — zamówienie pojawia się na liście; kliknięcie wiersza pokazuje pozycje i adres dostawy. Ten sam plik drugi raz nie tworzy duplikatu.
- **Walidacja względem katalogu:** każde odebrane zamówienie dostaje status **przyjęte** (kody są w katalogu, produkty aktywne, stan wystarczy) albo **błąd importu** (czerwony): nieznany kod, produkt nieaktywny lub za mały stan. Zamówienie jest wtedy i tak zapisane,
  a po rozwinięciu widzisz ramkę z opisem i powód przy każdej pozycji. **Partner nie dostaje żadnego powiadomienia.** Po poprawie katalogu kliknij **Sprawdź ponownie** — zamówienie powinno przejść na „przyjęte”.
  Cena i tolerancja cenowa **nie są** jeszcze sprawdzane (czekamy na decyzję o wartości tolerancji).
- Błędny plik albo wiadomość bez XML: zamówienie się nie pojawia, a szczegóły są w **Błędy i ostrzeżenia**.
- **Połączenie z prawdziwym serwerem poczty nie było jeszcze sprawdzone** — to pierwszy test na środowisku testowym; zgłoś każdy komunikat błędu.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 2. Jak liczona jest cena (do sprawdzenia rachunkiem)

```
cena EUR = zakup × (1 + narzut%) ÷ kurs  +  przesyłka GEIS (EUR, z paliwem)  +  koszty dodatkowe PLN ÷ kurs
```

Wynik zaokrąglany dopiero na końcu, wg reguły partnera (2 miejsca / pełne EUR / w górę do 5 lub 10 EUR). Kurs: NBP tabela A (w weekend ostatni znany; gdy NBP nie odpowiada — ostatni zapisany, z ostrzeżeniem) albo ręczny.
Przykład z karty: półpaleta 80×60×85 cm, 56 kg do FR → waga gabarytowa 102 kg → próg 200 kg → stawka 163 → z paliwem 11% ≈ 181 EUR.

**Potwierdź założenia** (odpowiedz w uwagach): przesyłka z tabel GEIS jest w **EUR** (nie dzielimy jej przez kurs); narzut w **%**; koszty dodatkowe w **PLN**; do pliku idą tylko produkty o statusie **aktywny**.

---

## 3. Czego jeszcze NIE ma (nie zgłaszaj jako błąd)

| Brak | Dlaczego |
|---|---|
| **Dane GEIS** (tabele transportowe 13 krajów) | Plik `GEIS_tabele_13_krajow.xlsx` nie jest w repozytorium. Dopóki nie zostanie wgrany, ceny pokażą błąd „Brak tabeli transportowej GEIS dla kraju …" — to oczekiwane. |
| **Serwer plików (FTP)** dla partnerów | Czeka na decyzję o protokole i kontach. Pliki powstają tylko w katalogu serwera. |
| **Kontrola ceny zamówienia, wysyłka do Selly, tracking** | Kolejne etapy; wymagają decyzji (rozdział w karcie). Zamówienia z e-maila można już odebrać, obejrzeć i sprawdzić względem katalogu (1.7). |
| **Numeracja katalogowa `KK PP NNNNN`** | Czeka na decyzję. Kolumna „kod" to dziś numer pozycji z katalogu. |
| **Nazwy plików** | Robocze (`tyreworld.csv`, `adtyres_AT.csv`) — czekamy na Twój schemat. |
| **XML Ceneo** | Struktura wg publicznego formatu; nie mamy wzorca od partnera. |
| **Automatyczny harmonogram** | Wyłączony domyślnie (flaga serwera). Pole „Harmonogram" w ustawieniach jest zapisywane, ale nic jeszcze nie uruchamia samo. |

---

## 4. Zbiorcza tabelka

| Punkt | Co | OK / ŹLE |
|---|---|---|
| 1.1 ⭐ | Lista, dodanie, duplikat | ☐ / ☐ |
| 1.2 ⭐ | Konfiguracja: ustawienia, magazyny, wykluczenia, kraje | ☐ / ☐ |
| 1.3 | Pola obliczeniowe i kolumny | ☐ / ☐ |
| 1.4 ⭐ | Podgląd pliku | ☐ / ☐ |
| 1.5 | Generuj teraz i logi | ☐ / ☐ |
| 1.6 | Aktywacja | ☐ / ☐ |
| 1.7 | Zamówienia z e-maila (Odbierz teraz, lista, szczegóły) | ☐ / ☐ |
| 2 | Założenia ceny potwierdzone | ☐ / ☐ |
