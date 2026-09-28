# Wejście dla I15.9 od ticketu 126 (126-FEATURE-pelne-pliki-csv-analityki) · 2026-09-23 — pliki CSV z Analityki są teraz pełne

**Zgłosiła:** pytanie A z `docs/instrukcja-testow-I10-v2.md` §1.3 — „czy potrzebujesz pełnych plików z kart, które
mają sufit?”. Odpowiedź Ani 2026-09-23: „chcę pełne pliki”.

**Jest teraz:** plik CSV z każdej karty, która ma sufit, ma teraz WSZYSTKIE wiersze po filtrach (nie tylko te
mieszczące się w suficie tabeli). Liczby zmierzone na `db/snapshot.db` (patrz niżej — uwaga o podstawie pomiaru):
- 2.5 Pozycje unikalne: 1000 → **5109**
- 4.1 Historia dostępności i 4.2 Tempo schodzenia: po 500 → **5184**
- 1.2 Nowości i wycofania: 500 → **1716**
- 3.1 Zmiany cen: 500 → **1644**
- Rotacja: 1000 → **1100**

Karty 2.1-2.4 EAN wspólne (769) i Marża (335) mieszczą się w suficie 1000 — u nich plik się nie zmienił.

**Co się NIE zmieniło (ważne, Ania to zobaczy):** tabela na ekranie nadal pokazuje najwyżej 300 wierszy, stopka
nadal mówi „Pokazano 300 z N wierszy…”, a kafel „Pozycje unikalne” nadal liczy 1000. **Plik jest teraz WIĘKSZY niż
N ze stopki** — to nie jest błąd, to jest sens tej zmiany. Zdanie z `docs/instrukcja-testow-I10-v2.md` §1.3 „Plik
ma tyle wierszy, ile mówi stopka” jest od teraz NIEAKTUALNE dla ośmiu kart z sufitem (2.5, 4.1, 4.2, 1.2, 3.1,
Rotacja, 2.1-2.4, Marża) — I15.9 powinna to sprostować.

**Czego się spodziewać przy klikaniu:** przycisk CSV na chwilę gaśnie i pokazuje kręciółkę — dociąga pełne dane
osobnym zapytaniem. Przy błędzie (np. wygasła sesja) pojawia się komunikat i plik NIE powstaje; wcześniej po cichu
zapisałby się plik ucięty do sufitu.

**Uwaga o podstawie liczb:** zmierzone na `db/snapshot.db` z 2026-08-13; na odświeżonej bazie stagingu
(decyzja D2 dla I15) liczby będą wyższe — mechanizm i sens zmiany się nie zmieniają.

Szczegóły mechanizmu (dla dociekliwych, nie do delty): `docs/tickets/126-FEATURE-pelne-pliki-csv-analityki/`,
karta `docs/karty/P10.5/karta.md`.
