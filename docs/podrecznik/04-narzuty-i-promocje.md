# Podręcznik Bridge — rozdział 4: Narzuty i promocje

> Wersja robocza (2026-10-16). Konwencje: [rozdział 0](00-start-i-nawigacja.md).
> ⚠ Reguły i promocje **przeliczają ceny w całym Katalogu**. Ćwiczenia wykonuj na środowisku testowym
> (**https://training.agroopony.eu**).

📍 **Jak tu wejść:** menu po lewej → **Narzuty i promocje** (czwarta pozycja od góry, ikona %).

## Do czego służy

Cena sprzedaży w Katalogu to **cena zakupu + narzut**, ewentualnie pomniejszona o **promocję**. Tu ustawiasz reguły:
- **Narzut** — stała marża dla grupy produktów (np. wszystkie opony Alliance od dostawcy MO2),
- **Promocja** — czasowy rabat z datą startu i końca.

Po każdej zmianie ceny całego katalogu przeliczają się od nowa. Gdy pasuje kilka narzutów, **wygrywa najbardziej
szczegółowa reguła**; warunki w jednej regule łączą się operatorem **ORAZ** (produkt musi spełnić wszystkie).

## Jak wygląda ekran

Nagłówek „Narzuty i promocje", pod nim **dwie zakładki**: **Narzuty** (otwarta domyślnie) i **Promocje**.

- Zakładka **Narzuty**: u góry krótki opis i **przycisk „Dodaj regułę" po prawej** (nad tabelą), niżej tabela reguł
  (Nazwa, warunki, **Narzut**, **Status**, ikony akcji na końcu wiersza), a **pod tabelą karta „Symulator ceny"**.
- Zakładka **Promocje**: opis i **przycisk „Dodaj promocję" po prawej**, tabela z kolumnami m.in. **Rabat, Start, Koniec,
  Status** i ikonami akcji.

W wierszu po prawej są dwie ikonki: **ołówek (Edytuj)** i **kosz (Usuń)**. W kolumnie **Status** narzutu możesz
**kliknąć plakietkę** („aktywny"/„nieaktywny"), aby włączyć lub wyłączyć regułę bez usuwania.

---

## 1. Dodawanie reguły narzutu ⚠

📍 Zakładka **Narzuty** → **Dodaj regułę** (nad tabelą, po prawej).

Okno **„Nowa reguła cenowa"**:
1. **Typ reguły** — „Narzut (stała marża)" lub „Promocja (czasowy rabat)".
2. **Nazwa** — np. „Premia za Alliance rolnicze".
3. **Reguła globalna** (haczyk) — dotyczy wszystkich produktów, bez warunków.
4. **Warunki** — przycisk **+ Dodaj warunek**; w wierszu wybierasz *typ* (Dostawca, Kategoria, Marka, Rozmiar,
   Bieżnik, Konkretny produkt (kod), Konstrukcja, Średnica, VF/IF) i *wartość* (z listy lub wpisaną). Ikona kosza
   usuwa warunek.
5. **Wartość narzutu (%)** — liczba nieujemna.
6. **Zapisz regułę** (dół okna po prawej) lub **Anuluj**.

Jeśli reguła spowodowałaby cenę sprzedaży **poniżej ceny zakupu**, pojawia się dodatkowe okno
**„Uwaga: sprzedaż poniżej ceny zakupu"** z liczbą produktów, których to dotyczy — **Anuluj** wraca do formularza,
**Zapisz mimo to** zapisuje.

### ✍️ Ćwiczenia 4.1 — nowy narzut ⚠ (środowisko testowe)
1. Menu po lewej → **Narzuty i promocje** → zakładka **Narzuty**. Zobacz istniejące reguły.
2. Kliknij **Dodaj regułę**. Wybierz typ „Narzut", wpisz nazwę „TEST narzut".
3. Kliknij **+ Dodaj warunek**, wybierz typ **Marka** i jakąś markę z listy. Wartość narzutu: `5`.
4. Kliknij **Zapisz regułę**. Sprawdź komunikat „Reguła dodana" i nowy wiersz w tabeli.
5. Wejdź w **Katalog**, wyszukaj produkt tej marki i zobacz, czy kolumna „cena_sprzedazy" jest zgodna z oczekiwaną.
6. Wróć do Narzutów. Spróbuj dodać regułę **bez warunków i bez haczyka „globalna"** — przeczytaj komunikat „Brak warunków".

## 2. Edycja, wyłączanie, usuwanie ⚠

- **Edycja:** ikona **ołówka** w wierszu → okno „Edytuj regułę" → **Zapisz regułę**.
- **Wyłączenie/włączenie:** kliknij plakietkę w kolumnie **Status** (podpowiedź „Kliknij aby przełączyć").
- **Usuwanie:** ikona **kosza** → okno „Usunąć regułę narzutu?" z informacją, ile produktów wyceniała reguła →
  **Usuń regułę** (czerwony) lub **Anuluj**. Tej operacji nie można cofnąć.

### ✍️ Ćwiczenia 4.2 — edycja i usuwanie ⚠
1. W wierszu „TEST narzut" kliknij ołówek, zmień wartość na `7`, **Zapisz regułę**.
2. Kliknij plakietkę **Status** — reguła staje się „nieaktywna". Kliknij ponownie, aby ją włączyć.
3. Kliknij kosz. Przeczytaj, ile produktów dotyczy reguła. Kliknij **Anuluj**.
4. Ponów i tym razem potwierdź **Usuń regułę**. Sprawdź komunikat „Reguła usunięta".

## 3. Symulator ceny

📍 Zakładka **Narzuty** → **zjedź pod tabelę reguł** → karta **„Symulator ceny"**.

Pozwala sprawdzić, jak wyliczy się cena konkretnego produktu — bez zmieniania czegokolwiek.
Wpisz w **Wyszukaj produkt** rozmiar, markę, model lub fragment nazwy i wybierz produkt z listy. Zobaczysz kolejno:
**Cena zakupu (baza)**, użyty **Narzut**, **Promocję**, **VAT** i **Cenę sprzedaży w katalogu**.

### ✍️ Ćwiczenia 4.3 — symulator
1. Zjedź pod tabelę narzutów do karty **Symulator ceny**.
2. Wpisz w „Wyszukaj produkt" markę i rozmiar. Wybierz produkt.
3. Odczytaj, który narzut został użyty. Czy zgadza się z tym, co oczekujesz?
4. Wybierz produkt z innej marki i porównaj narzut.

## 4. Promocje ⚠

📍 Zakładka **Promocje** (obok „Narzuty") → **Dodaj promocję** (po prawej nad tabelą).

Formularz jest taki sam jak dla narzutu, ale typ to „Promocja", wartość to **Rabat (%)**, a dodatkowo są
**Data startu** i **Data końca**.
- Przed datą startu promocja ma status **zaplanowana** i **nie obniża cen**.
- Po dacie końca **sama się wyłącza** (status „zakończona") — zostaje na liście, ale nie wpływa już na ceny.
- Zmiana bywa widoczna z kilkuminutowym opóźnieniem.
- Koniec nie może być przed startem (komunikat „Niepoprawne daty").

### ✍️ Ćwiczenia 4.4 — promocja ⚠ (środowisko testowe)
1. Przejdź do zakładki **Promocje**. Zobacz statusy istniejących promocji.
2. Kliknij **Dodaj promocję**: nazwa „TEST promo", warunek Marka (jak wcześniej), rabat `3`.
3. Ustaw Data startu na dziś, Data końca na jutro. **Zapisz promocję**.
4. W Symulatorze (zakładka Narzuty) wyszukaj produkt tej marki — czy widać promocję?
5. Edytuj promocję: ustaw koniec na wczoraj. Zapisz i sprawdź, że status to „zakończona".
6. Usuń „TEST promo" (kosz → **Usuń promocję**).

✅ *Umiesz, gdy:* potrafisz dodać narzut i promocję, wyłączyć je bez usuwania i sprawdzić efekt w Symulatorze i Katalogu.
