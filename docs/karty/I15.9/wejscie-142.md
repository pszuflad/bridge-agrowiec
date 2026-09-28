# Wejście dla I15.9 od ticketu 142 (karta I15.11 — „Braki w cenniku”) · 2026-09-24

Delta dla Ani. **To nie jest nowy panel — to nowa NAZWA tego, co już znała jako „Wycofane”.**
Instrukcja powinna to powiedzieć wprost, inaczej Ania będzie szukać na ekranie czegoś nowego.

## Co zmieniono → polecenie → rezultat

**Co zmieniono.** Cztery napisy. Nic poza nimi — żadnej nowej kolumny, przycisku ani okna.

| Gdzie | Było | Jest |
|---|---|---|
| Staging → filtr „Typ sprawy” (lista rozwijana u góry) | „Wycofane” | **„Braki w cenniku”** |
| Staging → odznaka przy wierszu | „Wycofana” | **„Brak w cenniku”** |
| Wgrywanie cenników → podsumowanie po imporcie | „Wycofane: 3” | **„Braki w cenniku: 3”** |

**Polecenie.** Wejdź na `/staging`, rozwiń „Typ sprawy” i wybierz **„Braki w cenniku”**.
Potem wgraj cennik i spójrz na podsumowanie importu.

**Rezultat.** Lista pokazuje pozycje, których dostawca nie przysłał — te same co dawne „Wycofane”.
Każdy wiersz ma czerwoną odznakę **„Brak w cenniku”**. Podsumowanie importu liczy je jako
„Braki w cenniku: N”.

## Co zobaczy przy braku danych

**„Brak elementów do wyświetlenia”** — zwykły pusty komunikat tabeli stagingu, ten sam co dla
każdego innego filtra. Nie ma osobnego ekranu „nie ma braków”.

⚠ **Pusta lista tu jest NORMALNA i spodziewana, a nie objaw awarii.** Wiersze „Brak w cenniku”
powstają wyłącznie w przebiegu weryfikacyjnym (trzy różne kompletne oferty + minimum 24 h między
potwierdzeniami), a nie w zwykłym imporcie — zwykły import wstrzymuje produkt od razu. Na świeżej
bazie stagingowej ta lista będzie **pusta** i to jest poprawne. Warto to w instrukcji napisać,
żeby Ania nie zgłosiła tego jako błędu.

## Czego NIE zobaczy (choć wpis backlogu #103 to sugeruje)

**Dowodów kompletności** — „trzy oferty”, „24 h”, dat sprawdzenia, źródeł. Backend je liczy
i przechowuje, ale **produkcja nigdy nie pokazywała ich w interfejsie** i odbudowa też nie pokazuje
(świadoma decyzja, `docs/karty/I15.11/karta.md`). Jedyne miejsce, gdzie Ania się o nie otrze, to
komunikat przy próbie akceptacji:

> „Brak trzech wiarygodnych potwierdzeń nieobecności. Wczytaj aktualny cennik.”

Pojawia się w oknie **„Nie zapisano zmian”**. Znaczy: pozycja jeszcze nie zebrała trzech potwierdzeń
— trzeba wczytać aktualny cennik, nie „naprawiać” zgłoszenie.

## Propozycja do decyzji Ani

Jeśli uzna, że pusta lista „Braki w cenniku” bez żadnego wyjaśnienia jest myląca — to jest materiał
na osobne zgłoszenie (produkcja zachowuje się tak samo, więc odbudowa jest tu wierna). Nie zmieniamy
tego z własnej inicjatywy.
