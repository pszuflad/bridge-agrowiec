# Podsumowanie: naprawa i porządki w zakładce Atrybuty — 2026-08-05

## 1. Ujednolicenie backendu atrybutów
Usunięto 6 zduplikowanych, niezabezpieczonych tras `/api/atrybuty*` w `index.cjs`, które przechwytywały żądania przed właściwym `atrybuty_module.cjs` (Express: pierwsza zarejestrowana trasa wygrywa). Po zmianie endpoint poprawnie wymaga autoryzacji (zweryfikowano: bez tokenu zwraca `401` zamiast `200` z pełnymi danymi jak wcześniej).

## 2. Naprawa mapowania i rozszerzenie podglądu
W `atrybuty_module.cjs` naprawiono błędne mapowanie `bieznik→model` (powinno być `bieznik→bieznik`) i rozszerzono `RODZAJ_KOLUMNA` z 6 do wszystkich 15 typów atrybutów. Dodano widoczny komunikat błędu w `pending-injection.js` zamiast cichego "0 rodzajów, 0 wartości" oraz przycisk "Podgląd" przy każdej wartości atrybutu (lista produktów używających danej wartości).

## 3. Czyszczenie nieużywanych wartości atrybutów
Na żądanie użytkowniczki policzono wykorzystanie wszystkich 6899 wartości w `atrybuty_wartosci` względem realnych danych w `products` (dokładne dopasowanie, wg tego samego mapowania co `/api/atrybuty/uzycie`). Usunięto **1755 wartości z zerowym wykorzystaniem** (0 produktów w katalogu). Pozostało 5144 wartości.

Podział usuniętych per rodzaj: bieznik (706), model (642), indeks_nosnosci (155), rozmiar (104), marka (71), indeks_predkosci (29), zastosowanie (19), oznaczenie_bieznika (10), rodzaj (10), kategoria (5), vfIf (3), sezon (1).

**Uwaga:** rodzaje **sezon** i **wentyl** mają teraz 0 wartości — nie jest to błąd usuwania, tylko odzwierciedlenie faktu, że kolumny `sezon` i `wentyl` w `products` są całkowicie puste dla wszystkich 7465 produktów (te atrybuty nie mają jeszcze żadnych danych wprowadzonych w katalogu).

## 4. Backup i weryfikacja
Backup bazy przed usunięciem: `data.db.bak_pre_atrybutycleanup_20260805095548` (na serwerze, 219 MB). `PRAGMA integrity_check` po usunięciu: `ok`. Backend zrestartowany przez PM2, składnia zweryfikowana (`node --check`) przed wdrożeniem.

## Pliki w tym backupie
- `index.cjs` — backend po usunięciu duplikatów tras (stan produkcyjny na 2026-08-05)
- `atrybuty_module.cjs` — moduł z naprawionym i rozszerzonym mapowaniem
- `pending-injection.js` — frontend z widocznym błędem i przyciskiem Podgląd
- `usuniete_wartosci_atrybutow.csv` — pełna lista 1756 usuniętych wartości (rodzaj, wartość, id) — liczba w pliku różni się o 1 od faktycznie usuniętych (1755) z powodu niewielkiego przesunięcia czasowego backupu bazy vs. moment liczenia; nie wpływa to na poprawność operacji usuwania.

## Otwarte pytania
- Czy atrybuty "sezon" i "wentyl" powinny pozostać w systemie jako puste kategorie na przyszłość, czy też produkty powinny zacząć być tagowane tymi wartościami?
