# Iteracja 9 (Waga gabarytowa) — wersja 2: po Twoich uwagach i odpowiedziach

**Środowisko:** https://test.agritires.eu · **Data przygotowania:** 2026-09-21 · **Dla:** Ania
**Uzupełnia:** [pierwszą wersję](instrukcja-testow-I9.md) z 2026-09-03, w punktach opisanych niżej

> **To jest STAGING, nie produkcja.** Cokolwiek tu ustawisz albo zepsujesz, produkcji nie
> dotyka. Testuj bez skrupułów.

---

## Po co ta kartka

**To jest WERSJA 2 i zawiera TYLKO DELTĘ**, czyli wyłącznie to, co zmieniło się od czasu, gdy
przeszłaś pierwszą wersję. **Nie jest to instrukcja od nowa.** Nie przechodzisz Wagi gabarytowej
drugi raz: sam wzór, zmiana przewoźnika, „waga do wyceny", zapamiętywanie wyniku i dodawanie
przewoźnika działają tak jak w pierwszej wersji.

**Co się zmieniło.** W pierwszej wersji odpowiedziałaś na dwa pytania: o potwierdzenie przed
usunięciem przewoźnika (§3.11) i o to, gdzie ma być zapisana lista przewoźników (§3.13). Potem
w drugiej rundzie pytań zbiorczych podjęłaś trzy decyzje. Wszystkie pięć jest zrobionych:

- **rozdział 1:** przeczytaj **przed** klikaniem — lista przewoźników jest teraz wspólna dla firmy;
- **rozdział 2:** Twoje dwa zgłoszenia (**„Zgłosiłaś"**) — tu są kliknięcia;
- **rozdział 3:** Twoje trzy decyzje (**„Zdecydowałaś"**) — jedno kliknięcie i jedno pytanie
  do Ciebie;
- **rozdział 4:** zdania z pierwszej wersji, które **przestały być prawdą**.

**Pierwsza wersja zostaje w repozytorium bez zmian.** Obowiązuje we wszystkim, czego tu nie ma.
Tam, gdzie coś się różni, **prawdą jest ta kartka.**

**Ile to zajmuje:** około 15 minut. Do punktu 2.2 potrzebujesz **drugiej przeglądarki albo okna
prywatnego** (w Chrome: Ctrl+Shift+N).

### Jak wypełniać

Punkt do sprawdzenia kończy się linijką **Twoja ocena**:

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

Przy „ŹLE" napisz, **co zobaczyłaś zamiast** oczekiwanego, i **zrób zrzut ekranu**. Tam, gdzie
potrzebujemy Twojej decyzji, zamiast oceny jest **pytanie z wariantami** — zaznacz jeden.

---

# 1. ⚠ Zanim klikniesz — lista przewoźników jest teraz wspólna dla całej firmy

W pierwszej wersji ramka na górze mówiła, że lista przewoźników i dzielników **siedzi w Twojej
przeglądarce**. To już nieprawda: zgodnie z Twoją odpowiedzią lista jest **zapisana w Bridge
i taka sama na każdym komputerze**. Wynikają z tego trzy rzeczy, o których trzeba wiedzieć:

1. **Lista wystartowała od sześciu przewoźników, których dzielniki potwierdziłaś** (GEIS Polska
   10 000 · DPD 6 000 · GLS 4 000 · InPost Kurier, UPS i DHL Parcel po 5 000). **Zmiany, które
   kiedyś zrobiłaś w liście u siebie w przeglądarce, NIE przeniosły się** — jeśli dodałaś
   własnego przewoźnika albo poprawiłaś dzielnik, trzeba to wprowadzić jeszcze raz.
2. **Zmiana dzielnika albo usunięcie przewoźnika zmienia wycenę WSZYSTKIM**, nie tylko Tobie.
   Mówi o tym też opis nad tabelą przewoźników: *„Lista jest wspólna — zmiana obowiązuje wszystkich
   użytkowników."*
3. **„Przywróć domyślne" cofa listę całej firmie**, dlatego teraz najpierw pyta (treść okna
   w punkcie 2.2).

**Co zostaje w Twojej przeglądarce, tak jak było:** który przewoźnik jest **wybrany**
w formularzu, **ostatnie wymiary** i **ostatni wynik**. To są Twoje osobiste ustawienia, więc
w drugiej przeglądarce możesz mieć wybranego innego przewoźnika i pusty wynik. **To nie jest
niespójność — nie zgłaszaj tego.**

**Nowe przy edycji listy:** poprawiona nazwa albo dzielnik zapisuje się **w chwili, gdy
opuścisz pole** (Tab, kliknięcie obok albo „Gotowe"), a nie przy każdym wpisanym znaku.
Kolumna „Przykład" zmienia się właśnie wtedy.

> **Przeczytane:** ☐ tak ☐ niejasne — co: _______________

---

# 2. Twoje zgłoszenia

## 2.1 ⭐ Usunięcie przewoźnika pyta o potwierdzenie — mocniej, gdy jest wybrany

> **Zgłosiłaś** (§3.11 pierwszej wersji): *„Tak, powinno być potwierdzenie przed usunięciem
> przewoźnika, szczególnie gdy jest aktualnie wybrany. Dobrze, że system nie pozwala usunąć
> ostatniego przewoźnika."*

**Jest teraz.** Kosz nie usuwa już od razu. Są **dwa różne okna**:

| Kogo usuwasz | Tytuł okna | Treść |
|---|---|---|
| przewoźnika, którego **nie** masz wybranego | **„Usunąć przewoźnika?"** | *„Przewoźnik „DHL Parcel" zniknie z listy. Lista jest wspólna — zmiana obowiązuje wszystkich użytkowników."* |
| przewoźnika, którego **masz wybranego** w formularzu | **„Usunąć wybranego przewoźnika?"** | *„Przewoźnik „DPD" jest teraz wybrany w Twoim kalkulatorze. Lista jest wspólna — zmiana obowiązuje wszystkich użytkowników."*, a pod spodem **żółta ramka z trójkątem ostrzegawczym**: *„Po usunięciu kalkulator przełączy się na „GEIS Polska" i przeliczy wynik jego dzielnikiem."* |

W obu oknach przycisk usuwania to **„Usuń przewoźnika"**, obok jest **„Anuluj"**. W ramce pada
zawsze nazwa przewoźnika, na którego przełączy się formularz — **pierwszego z pozostałych na
liście**.

**Blokadę ostatniego przewoźnika zachowaliśmy bez zmian:** przy ostatnim na liście nie pojawia
się żadne okno, tylko komunikat *„Nie można usunąć"*.

**Sprawdź:**
1. W formularzu zostaw wybranego **GEIS Polska**. Kliknij **Edytuj listę**, potem kosz przy
   **DHL Parcel**. Przeczytaj okno i kliknij **Anuluj**.
2. Kliknij **Gotowe**. W formularzu wybierz **DPD** i kliknij **Oblicz wagę gabarytową**
   (60 / 50 / 50 daje *Waga gabarytowa (DPD)* **25.00 kg**).
3. **Edytuj listę** → kosz przy **DPD**. Przeczytaj okno i kliknij **Usuń przewoźnika**.
4. Kliknij **Oblicz wagę gabarytową**.

**Ma się stać:**
- krok 1: okno **„Usunąć przewoźnika?"**, bez żółtej ramki; po „Anuluj" DHL Parcel **zostaje**;
- krok 3: okno **„Usunąć wybranego przewoźnika?"** z żółtą ramką i nazwą **„GEIS Polska"**;
  po potwierdzeniu DPD znika z tabeli, a pole **Przewoźnik** pokazuje *GEIS Polska — dzielnik
  10000*;
- krok 4: wynik **15.00 kg** z nagłówkiem *Waga gabarytowa (GEIS Polska)*.

**⚠ Między krokiem 3 a 4 po prawej wisi jeszcze stary wynik** *Waga gabarytowa (DPD)
25.00 kg*. Ramka w oknie obiecuje „przeliczy wynik", ale wynik przelicza się dopiero po
kliknięciu **Oblicz**, tak samo jak po każdej innej zmianie przewoźnika (§4 pkt 7 pierwszej
wersji). Wiemy o tym i poprawimy treść ramki. **Nie zgłaszaj tego.**

**DPD nie przywracaj jeszcze** — przyda się w punkcie 2.2.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

## 2.2 ⭐ Lista jest ta sama na każdym komputerze

> **Zgłosiłaś** (§3.13 pierwszej wersji): *„To konfiguracja firmowa wpływająca na wycenę
> transportu, a nie osobiste ustawienie przeglądarki. Powinna być zapisana w Bridge i dostępna na
> każdym komputerze."*

**Jest teraz.** Lista przewoźników i dzielników jest zapisana w Bridge. Zmiana zrobiona na
jednym komputerze jest widoczna na każdym innym po odświeżeniu strony.

**„Przywróć domyślne" pyta teraz o potwierdzenie.** Okno ma tytuł **„Przywrócić domyślną listę
przewoźników?"** i treść w dwóch linijkach:

> *„Lista wróci do sześciu domyślnych przewoźników: GEIS Polska, DPD, GLS, InPost Kurier, UPS
> i DHL Parcel.*
> *To zmienia listę dla całej firmy — dodani przewoźnicy i poprawione dzielniki znikną
> u wszystkich."*

Przycisk: **„Przywróć domyślne"**.

**Sprawdź:**
1. **Przeglądarka A** (ta, w której robiłaś 2.1): **Edytuj listę**, zmień dzielnik **GLS**
   z `4000` na `3000` i naciśnij **Tab**. Kliknij **Gotowe**.
2. **Przeglądarka B** (inna przeglądarka albo okno prywatne): zaloguj się, wejdź w **Waga
   gabarytowa** i zjedź do tabeli.
3. **A:** kliknij **Przywróć domyślne**, przeczytaj okno i potwierdź przyciskiem
   **Przywróć domyślne**.
4. **B:** odśwież stronę (F5).

**Ma się stać:**
- krok 1: w kolumnie „Przykład" przy GLS od razu **50.00 kg**;
- krok 2: w B **GLS ma dzielnik 3 000** (Przykład 50.00 kg), a **DPD nie ma** — obie zmiany
  z A są widoczne;
- krok 3: okno z treścią jak wyżej, po potwierdzeniu komunikat **„Przywrócono"** i sześciu
  przewoźników;
- krok 4: w B znów **sześciu przewoźników**, **GLS 4 000**, DPD wrócił.

**⚠ B nie odświeży się sama** — zmiany z A widać dopiero po F5. To zamierzone.

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

---

# 3. Twoje decyzje — co z nimi zrobiliśmy

## 3.1 Listę może zmieniać każdy zalogowany

> **Zdecydowałaś** (pytania zbiorcze, 9.1): listę edytuje **każdy zalogowany**, nie tylko
> administrator.

**Jest teraz:** tak właśnie działa — każdy, kto jest zalogowany, widzi przyciski „Edytuj listę"
i „Przywróć domyślne". **Sprawdź:** nic.

## 3.2 ⭐ Kalkulator paletowy jest w panelu

> **Zdecydowałaś** (pytania zbiorcze, 9.2): *„Tak, przyda się"*.

**Gdzie.** Na samym dole strony **Waga gabarytowa**, pod tabelą przewoźników, jest nowa część
**„Waga paletowa (opony) — inny wzór"**.

**Czym różni się od kalkulatora na górze.** Ten na górze dzieli objętość paczki przez **dzielnik
wybranego przewoźnika**. Paletowy **nie zależy od przewoźnika**: zaokrągla szerokość w górę do
półpalety albo palety, dolicza wysokość samej palety i mnoży przez stały współczynnik.

**Progi, na których liczy:**
- szerokość **do 55 cm** liczy się jak **60 cm** (półpaleta);
- szerokość **powyżej 55 cm, do 80 cm** liczy się jak **80 cm** (paleta);
- szerokość **powyżej 80 cm** — bez zaokrąglenia;
- do wysokości doliczane jest **10 cm** na paletę;
- współczynnik **0,000167** (1 m³ = 167 kg).

**Sprawdź:**
1. W części **Waga paletowa** wpisz **Szerokość** `50`, **Długość** `60`, **Wysokość** `25`
   i kliknij **Oblicz wagę paletową**.
2. Zmień **Szerokość** na `70` i kliknij jeszcze raz.

**Ma się stać:**

| | Krok 1 | Krok 2 |
|---|---|---|
| **Waga gabarytowa paletowa** | **21.042 kg** | **28.056 kg** |
| Szerokość do wyliczenia | 60 cm | 80 cm |
| Wysokość z paletą | 35 cm | 35 cm |
| Współczynnik | 0.000167 | 0.000167 |
| Opis pod spodem | *Szerokość 50 cm ≤ 55 cm (półpaleta) → zaokrąglone do 60 cm* | *Szerokość 70 cm > 55 cm, ≤ 80 cm (paleta) → zaokrąglone do 80 cm* |

Rachunek dla kroku 1: 60 × 60 × 35 × 0,000167 = 21,042.

**⚠ Ten kalkulator nie zapamiętuje wyniku** — po wyjściu z widoku część paletowa jest pusta.
**⚠ Jeśli w wierszu „Współczynnik" zobaczysz inną liczbę niż 0.000167**, ustawienia na stagingu
są inne niż w naszej kopii i wyniki też będą inne — zapisz wtedy, co widzisz, i zaznacz „ŹLE".

> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: _______________

**Progów palety nadal nie da się zmienić z ekranu.** Te cztery liczby (55 cm, 80 cm, 10 cm,
0,000167) są zapisane w ustawieniach Bridge, ale żaden ekran nie pozwala ich zmieniać. Jeśli
trzeba je zmienić, zrobimy to za Ciebie. Na stałe wpisane jest też to, że półpaleta liczy się jak **60 cm**.

> **Czy te progi są dla Ciebie właściwe?**
> ☐ **tak**, zostają jak są
> ☐ **do zmiany** — podaj nowe wartości: półpaleta do ____ cm (liczona jak ____ cm) · paleta
> do ____ cm · wysokość palety ____ cm · współczynnik ________
> ☐ **nie wiem** — nie liczę tym, sprawdzę z kimś: _______________

## 3.3 Dzielniki są dokładnie te, które potwierdziłaś

> **Zdecydowałaś** (pytania zbiorcze, 9.3): przy wszystkich sześciu dzielnikach *„zgadza się"*,
> a wiersze na dodatkowych przewoźników zostawiłaś puste.

**Jest teraz:** wspólna lista startuje dokładnie od tych sześciu wartości, bez żadnego
dodatkowego przewoźnika. Widziałaś je w punkcie 2.2. **Sprawdź:** nic.

---

# 4. Co w pierwszej wersji przestało być prawdą

Jeśli wracasz do [pierwszej wersji](instrukcja-testow-I9.md), te zdania są już nieaktualne.
**Reszta tamtego dokumentu obowiązuje bez zmian.**

## 4.1 Zdania unieważnione przez zmiany z rozdziałów 1–3

| Punkt pierwszej wersji | Co mówił | Jak jest teraz |
|---|---|---|
| **Ramka na górze** | „Ten kalkulator **nie rozmawia z serwerem** — liczy w Twojej przeglądarce, a lista przewoźników i dzielników zapisuje się **lokalnie, na tym komputerze**." | Kalkulator dalej liczy w przeglądarce, ale **listę przewoźników bierze z Bridge**, wspólną dla wszystkich — **rozdział 1**. |
| **§1** Sedno do sprawdzenia | „cztery rzeczy" | Doszła piąta: **kalkulator paletowy** — **punkt 3.2**. |
| **§2** Przygotowanie | „Składa się z trzech części" | Z **czterech** — na dole doszła **„Waga paletowa (opony) — inny wzór"** (**3.2**). |
| **§3.9**, ramka | „Wpisanie zera, liczby ujemnej albo tekstu w pole dzielnika jest **po cichu ignorowane**" | Po opuszczeniu pola pojawia się czerwony komunikat **„Niepoprawny dzielnik"** (*„Dzielnik musi być liczbą dodatnią."*) i pole wraca do poprzedniej wartości. Pusta nazwa daje **„Brak nazwy"**. |
| **§3.11** krok 1 | „wiersz znika natychmiast, **bez pytania o potwierdzenie**" | Pyta — **punkt 2.1**. |
| **§3.11** krok 2 | usunięcie wybranego: „znika, a wybór przeskakuje na pierwszego z pozostałych" | Najpierw **mocniejsze okno** z nazwą następcy — **punkt 2.1**. Samo przeskoczenie wyboru bez zmian. |
| **§3.12** Przywróć domyślne | kliknięcie od razu przywraca listę | Najpierw **okno potwierdzenia**, a lista wraca **całej firmie** — **punkt 2.2**. Wybór wraca na GEIS Polska tylko u Ciebie. |
| **§3.13** krok 3 | „tam lista jest **domyślna** — Twoich zmian nie ma. **To nie jest błąd.**" | **Odwrotnie:** w innej przeglądarce lista jest **taka sama** jak u Ciebie. Lista domyślna zamiast Twojej **to teraz błąd** — **punkt 2.2**. |
| **§4 pkt 1** | „Lista przewoźników nie przenosi się między komputerami ani przeglądarkami." | Przenosi się — **punkt 2.2**. |
| **§4 pkt 2** | „Kalkulator w ogóle nie pyta serwera. (…) Zadziała nawet wtedy, gdy backend jest wyłączony." | Bez połączenia z Bridge nie policzysz: zamiast tabeli pojawia się *„Nie udało się wczytać listy przewoźników. Odśwież stronę albo zaloguj się ponownie."*, a przycisk **Oblicz** jest nieaktywny. |
| **§4 pkt 3** | kalkulator paletowy „**też nie jest podpięty pod żaden ekran**" | Jest na ekranie — **punkt 3.2**. W starym Bridge nadal go nie ma. |
| **§4 pkt 4** | „Usunięcie przewoźnika nie pyta o potwierdzenie. Zamierzone, jak w oryginale." | Pyta — **punkt 2.1**. |
| **§4 pkt 8** | brak pól progów palety; „ustawianie jego progów czeka na tę samą decyzję co on" | Pól nadal nie ma, ale kalkulator już jest. O progi pytamy Cię w **punkcie 3.2**. |
| **§6**, pozycja listy | „**W innej przeglądarce lista jest domyślna — to poprawne** ⭐" | **Wykreśl** — sprawdzasz teraz odwrotną rzecz (**2.2**). |
| **§7**, trzecie najcenniejsze zgłoszenie | „**ustawienia zniknęły same** — lista wróciła do domyślnej, choć nie klikałaś „Przywróć domyślne" i nie czyściłaś danych przeglądarki" | Listę mógł zmienić **ktoś inny** — to nie błąd. Czyszczenie danych przeglądarki **listy nie kasuje** (kasuje tylko Twój wybór, wymiary i wynik). |

## 4.2 §5 „Czego jeszcze NIE MA" — rozliczenie wszystkich pięciu pozycji

| Pozycja z §5 | Status |
|---|---|
| Wspólna lista przewoźników trzymana na serwerze | ✅ **jest** — **punkt 2.2** |
| Kalkulator paletowy dostępny w panelu | ✅ **jest** — **punkt 3.2** |
| Etykiety dla czytnika ekranu przy przyciskach z ikoną | ⬜ **nadal nie ma** — bez zmian, dotyczy całego panelu |
| Ustawianie progów palety i współczynnika | ⬜ **nadal nie ma ekranu** — pytanie w **punkcie 3.2** |
| Atrybuty | ✅ **są** — ekran **Atrybuty** w menu po lewej |

Notka pod tabelą (Alerty, Pulpit i Analityka już są) zostaje prawdziwa.

> **Czy któryś z tych punktów zachowuje się u Ciebie nadal po staremu?**
> ☐ nie ☐ tak — który: _______________

---

# 5. Podsumowanie

| Punkt | Co sprawdzasz | OK | ŹLE | Uwagi |
|---|---|:--:|:--:|---|
| 1 | Przeczytane: lista wspólna, Twoje stare zmiany się nie przeniosły | ☐ | ☐ | |
| **2.1** ⭐ | **Dwa okna usuwania; przy wybranym żółta ramka z nazwą następcy** | ☐ | ☐ | |
| **2.2** ⭐ | **Zmiana z przeglądarki A widoczna w B; „Przywróć domyślne" pyta** | ☐ | ☐ | |
| **3.2** ⭐ | **Paletowy: 21.042 kg i 28.056 kg** | ☐ | ☐ | |
| 3.2, pytanie | Progi palety: tak / do zmiany / nie wiem (zaznacz w punkcie 3.2) | | | |
| 4 | Żaden z nieaktualnych punktów nie działa po staremu | ☐ | ☐ | |

**Sprawdzonych ____ / 5 · błędów ____ · pominiętych ____**

---

# 6. Jak zgłosić znalezisko

**Zasady zgłaszania są te same co w [pierwszej wersji, rozdział 7](instrukcja-testow-I9.md)**:
podaj numer punktu i kroku, co zobaczyłaś zamiast oczekiwanego, wymiary i przewoźnika, godzinę
i zrzut ekranu.

**Najpierw sprawdź ramki ⚠ przy punkcie.** Cztery rzeczy w tej kartce wyglądają na błąd,
a są poprawne:

1. **po usunięciu wybranego przewoźnika wisi stary wynik** do kliknięcia „Oblicz", mimo że
   ramka mówi „przeliczy wynik" (2.1);
2. **w drugiej przeglądarce inny wybrany przewoźnik albo pusty wynik** — to Twoje osobiste
   ustawienia (rozdział 1);
3. **druga przeglądarka nie widzi zmiany bez odświeżenia** (2.2);
4. **kalkulator paletowy jest pusty po powrocie do widoku** (3.2).

**Trzy rzeczy, przy których jest ODWROTNIE.** Tu błędem jest to, że coś *nie* działa, i
chcemy o tym wiedzieć od razu:

- **w drugiej przeglądarce po F5 lista jest inna niż w pierwszej** (2.2);
- **kosz usuwa bez żadnego okna** albo **przy ostatnim przewoźniku pojawia się okno** (2.1);
- **„Przywróć domyślne" działa bez pytania** (2.2).
