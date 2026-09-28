# Wejście dla I15.9 od ticketu 120 (karta I15.2, resync parserów) · 2026-09-23

## #83 łamie obietnicę złożoną Ani w instrukcji testów — trzeba ją odwołać w delcie

`docs/instrukcja-testow-I3.md` §11 pkt 10 obiecuje, że **„10.00 zostaje"** — czyli że zapis szerokości
z cennika nie jest zmieniany. Po resyncu parserów (#83, zatwierdzone w triażu 18.09) tak już **nie jest**:
końcowe zera są obcinane, `"10.0"` → `"10"`.

**Skala, zmierzona na wzorcu charakteryzacji (10 dostawców, 2 606 rekordów): 172 zmiany pola `szerokosc`**,
u dziewięciu dostawców (wszyscy poza MO6). Przykład: `MO1_10000255` `"10.0"` → `"10"`.

### To NIE jest regresja — i warto to Ani powiedzieć wprost

Zmiana daje efekt uboczny **na plus**, zmierzony na charakteryzacji silnika:

| Dostawca | Było | Jest | Znaczenie |
|---|---|---|---|
| MO8 | `zmienione` 30 | 27 | trzy pozycje mniej do ręcznego przeklikania |
| MO10 | `zmienione` 2, `autoZatwierdzone` 15 | `zmienione` 0, `autoZatwierdzone` 17 | żadna pozycja nie trafia już do stagingu |

Powód: katalog trzyma `"10"`, cennik podawał `"10.0"` — różnica w samym ZAPISIE, nie w wartości,
produkowała fałszywą „zmianę kluczową" wymagającą decyzji człowieka. Po #83 obie strony mają ten sam
zapis i pozycja przechodzi bez zatrzymania.

### Co powinno trafić do delty instrukcji

W układzie „Zgłosiłaś → Jest teraz → Sprawdź":

- **Zgłosiłaś:** w §11 pkt 10 umówiliśmy się, że `10.00` zostaje bez zmian.
- **Jest teraz:** szerokość jest zapisywana bez końcowych zer — `10.00` i `10.0` pokazują się jako `10`.
  Wartość opony się nie zmienia, zmienia się sam zapis. Dotyczy 172 pozycji u dziewięciu dostawców.
- **Sprawdź:** czy w katalogu i w eksporcie CSV szerokości wyglądają poprawnie; przy okazji mniej pozycji
  powinno wpadać do „Do zatwierdzenia" — u Trelleborga i GRI zauważalnie.

## Drugi drobiazg do tej samej delty

Import **zatrzymuje się teraz na błędach odczytu cennika** (#103), zamiast wczytać część pozycji.
Komunikat, który Ania zobaczy: *„Błędy odczytu cennika (N). Import zatrzymany bez przełączania na
stary format."* Wcześniej taki plik wchodził częściowo i po trzech takich przebiegach katalog dostawcy
bywał wycofywany. Pusty cennik nadal daje dotychczasowy komunikat o braku pozycji.
