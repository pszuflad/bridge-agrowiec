# Iteracja 13 (zmiany z produkcji 26.08–08.09) — instrukcja testów dla Ani

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-09

> **To jest STAGING, nie produkcja.** Cokolwiek tu ustawisz albo zepsujesz — produkcji nie
> dotyka. Testuj bez skrupułów.

> **⚠ PRZECZYTAJ TO NAJPIERW — ta iteracja jest inna niż poprzednie.**
>
> Iteracja 13 **nie dodaje żadnego nowego ekranu.** Zamiast tego **zmienia rzeczy na ekranach,
> które już testowałaś** (głównie Katalog i Import). To są zmiany, które **Ty sama wprowadziłaś
> na produkcji** między 26 sierpnia a 8 września — my odtworzyliśmy je tu **1:1**.
>
> Dlatego **niektóre starsze instrukcje** (np. Iteracja 2 „Katalog", Iteracja 3 „Import") mogą
> teraz pokazywać na ekranie **co innego, niż w nich napisano** — bo pisano je przed tymi zmianami.
> **Starsze instrukcje ZOSTAJĄ bez zmian.** Zasada jest prosta: **gdy coś różni się od starej
> instrukcji, prawdą jest to, co piszę TUTAJ.** Ta kartka mówi Ci, na co patrzeć i co jest już
> nieaktualne w poprzednich.
>
> Jeśli katalog na stagingu jest pusty — najpierw zaimportuj jakiś cennik (jak w instrukcji
> Iteracji 3), inaczej nie będzie czego oglądać.

---

## 1. Co zmienia Iteracja 13 — w skrócie

Osiem drobnych zmian, wszystkie Twoje z produkcji, pogrupowane w dwa miejsca:

- **W Katalogu** widać je od razu na wartościach: inne wielkości liter, słowa zamiast kodów,
  inny zapis szerokości, „Tak"/pusto zamiast 0/1.
- **W Imporcie** poprawiło się parsowanie kilku formatów rozmiaru i zniknęły śmieci, które
  wcześniej trafiały do poczekalni.

Nowa nazwa aplikacji: **„Bridge ONE"** (widoczna w nagłówku i tytule zakładki przeglądarki).

---

## 2. Co zobaczysz INACZEJ niż wcześniej

| Gdzie | Jak było wcześniej | Jak jest teraz (Iteracja 13) |
|---|---|---|
| Nagłówek / tytuł zakładki | „Bridge" / „Bridge dla Agrowca" | **„Bridge ONE"** |
| Katalog → nazwy produktów | mieszana wielkość liter | **WIELKIE LITERY** (cała nazwa) |
| Katalog → kolumna „Konstrukcja opony" + eksport CSV | kody `R` / `D` | **słowa: „Radialna" / „Diagonalna"** |
| Kategorie (wszędzie) | mała litera („rolnicze") | **Wielka litera („Rolnicze")** |
| Katalog → kolumny NRO / CHO | `0` / `1` | **„Tak" albo pusto** |
| Katalog → kolumna „Szerokość opony" | cały rozmiar, np. `8.00x20` | **pierwszy człon, np. `8.00`** (zmiana z 04.09) |
| Katalog → filtr marek | na liście bywały „marki" będące liczbami | **filtr pomija wartości będące samą liczbą** |
| Import (poczekalnia / staging) | patrz sekcja 3 | poprawione parsowanie + mniej śmieci |

---

## 3. Co poprawiło się w Imporcie (i co sprawdzić)

Wgraj cennik dostawcy jak zwykle i zajrzyj do poczekalni. Zmiany:

- **Rozmiary, które wcześniej wpadały puste, teraz się parsują** — stare zapisy typu `690x180-15`,
  `400/45Lx17`, `28LX26`, ułamkowe szerokości `6.5/75-14`. Jeśli miałaś produkty z pustą
  konstrukcją/szerokością dla takich rozmiarów — nowe importy je wypełnią.
- **MO8 Trelleborg z pliku CSV** — wcześniej taki plik importował **zero pozycji po cichu**;
  teraz przechodzi normalnie.
- **WULSTBAND (taśma obręczy) już nie trafia do poczekalni jako opona** (Bohnenkamp/Agrorami).
- **Pusta marka od dostawcy → w nazwie marki pojawia się „UNKNOWN"** (zamiast wpisania rozmiaru
  albo losowego słowa). To celowe — od razu widać, że trzeba markę poprawić ręcznie.
- **Import nie robi już „zmiany kluczowej" z samej wielkości liter w nazwie.** Jeśli plik
  dostawcy ma „Kleber GRIPKER", a w katalogu jest „KLEBER GRIPKER" — poczekalnia **nie zgłosi
  tego jako zmiany.** Wcześniej zgłaszała.

---

## 4. Co może być NIEAKTUALNE w starszych instrukcjach

Gdybyś wróciła do wcześniejszych kartek, to w nich może się już nie zgadzać:

- **Iteracja 2 (Katalog):** przykłady nazw pisane mieszaną wielkością liter, kody `R`/`D`
  w konstrukcji, kategorie małą literą, `0`/`1` w NRO/CHO, pełny rozmiar w kolumnie szerokości.
- **Iteracja 3 (Import):** opisy zachowania parsera dla nietypowych rozmiarów i MO8 CSV.
- **Wszędzie:** stara nazwa aplikacji „Bridge" / „Bridge dla Agrowca".

Nie trzeba tam nic „naprawiać" ani czytać na nowo — po prostu w razie rozbieżności **wierz tej
kartce (I13)**, nie tamtym.

---

## 5. Czego w tej wersji JESZCZE NIE MA

- **Nowa synchronizacja z Selly przez wariantowy sync (REST)** — ta, którą właśnie u siebie
  dopracowujesz (`sync_full`, warianty magazynów). **Świadomie NIE ma jej w tej wersji** —
  poczekamy, aż ustabilizuje się u Ciebie, żeby odtworzyć finalną wersję, a nie roboczą.
  **Nie szukaj jej tutaj** — panel Selly działa jak dotąd (eksport CSV + dotychczasowe przyciski).

---

## 6. Rzeczy, które wyglądają na błąd, a są POPRAWNE

- **Nazwa WIELKIMI literami, ale z małą polską literką w środku** (np. „PROWADZąCA", „OSKAR ORKAn").
  To nie błąd — zamiana na wielkie litery nie rusza polskich znaków (ą, ę, ł…), i **produkcja ma
  dokładnie tak samo.** Nie zgłaszaj tego.
- **Szerokość pokazuje tylko pierwszy człon** (`8.00` zamiast `8.00x20`, `14.9` zamiast `14.9x28`).
  To Twoja celowa zmiana z 4 września — tak ma być.
- **Filtr marek pomija wartości będące samą liczbą** — kategorie filtruje po staremu, marki nie;
  ta asymetria jest celowa (tak jest w produkcji).
- **Konstrukcja: jeśli gdzieś zobaczysz „—" albo pojedynczą literę** — daj znać, ale najpierw
  sprawdź: w odbudowie kolumna „Konstrukcja opony" pokazuje **poprawnie „Radialna"/„Diagonalna".**
  ⚠ **Uwaga porównawcza:** na ŻYWEJ produkcji ta kolumna pokazuje dziś „—" (pustą) — to skutek
  tego, że łatka trafiła w nieużywany plik. **Tutaj jest POPRAWNIE.** Więc jeśli porównujesz
  staging z produkcją i widzisz różnicę w tej kolumnie — **odbudowa ma rację, produkcja nie.**
  (To osobno zgłosimy do naprawy po Twojej stronie.)

---

## 7. Najkrótsza ścieżka testu

1. Zaloguj się → w nagłówku sprawdź nazwę **„Bridge ONE"**.
2. Otwórz **Katalog**. Popatrz na kolumny: nazwy WIELKIMI, konstrukcja słowami, kategorie z
   Wielkiej litery, NRO/CHO jako „Tak"/pusto, szerokość jako pierwszy człon.
3. Zrób **eksport CSV** z katalogu — konstrukcja w pliku też słowami.
4. Wgraj **cennik** dostawcy (np. MO8 Trelleborg) → zajrzyj do **poczekalni**: pozycje są,
   rozmiary wypełnione, żadnego WULSTBAND-a, pusta marka jako „UNKNOWN".
5. Gdyby coś wyglądało dziwnie — najpierw sekcja 6, potem pytaj.
