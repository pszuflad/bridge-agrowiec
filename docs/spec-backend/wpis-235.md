# Wpis 235 — nazwy plików cenników, koszty w EUR, stały koszt przesyłki

Ticket `235-FEATURE-partnerzy-nazwy-plikow-koszty-eur`. Nowa funkcjonalność, nie odtworzenie produkcji (migracja 030).

- Nazwa pliku: baza = `partnerzy.nazwa_pliku` albo slug nazwy; plik na kraj = `<baza>_<kraj małymi literami>.<ext>`.
- Archiwum: `archive/<YYYYMMDD>_<plik>`, jeden na dzień (nadpisywany), retencja 30 dni; stare kopie z godziną też są czyszczone po dacie z prefiksu.
- `koszty_dodatkowe` kraju są w EUR (wcześniej PLN, dzielone przez kurs). Zmienna formuły `koszty_dodatkowe` to teraz EUR.
- `przesylka_stala_eur` (kraj) ma pierwszeństwo przed tabelami GEIS; pozycje bez wagi/wymiarów wyceniają się wtedy bez błędu transportu.
- `narzut_proc <= 0` → ceny kraju `null` + jeden błąd „Narzut kraju nie jest ustawiony”; plik się nie zapisuje (pusty wynik nie nadpisuje poprzedniego).
- `GET /api/partnerzy/:id` zwraca przy kraju `ostatniKurs` ({kurs, zrodlo, zapisano} z `partner_kursy`) lub `null`.
