# Podsumowanie: format wyświetlania ceny sprzedaży (2026-07-31)

## Zmiana
Kolumna `cena_sprzedazy` w tabeli katalogu produktów (panel) oraz w eksporcie CSV do Selly pokazuje teraz gołą liczbę całkowitą ze znakiem `,-` (np. `7624,-`) zamiast poprzedniego formatu z kropką i dwoma miejscami po przecinku (np. `7624.00`). Kolumna `cena_zakupu` pozostała bez zmian — nadal pokazuje pełne grosze (np. `5562.40`), bo to rzeczywista cena od dostawcy.

## Lokalizacja
- Frontend panelu: funkcja formatująca kolumny tabeli w `index.cjs`/pliku JS frontendu — rozdzielono wspólną gałąź `cenaZakupu`/`cenaSprzedazy` na dwie osobne, `cenaSprzedazy` renderuje `` `${Math.floor(n)},-` ``.
- Eksport CSV: `generate_selly_export.cjs` na serwerze — dodano formatowanie kolumny `cena_sprzedazy` na `` `${Math.floor(v)},-` `` przed zapisem do pliku.

## Wdrożenie
- Nowa wersja JS frontendu wdrożona jako `index-PRICEFMT1783512500.js`, podpięta w `index.html` (backup poprzedniego `index.html` zachowany na serwerze).
- Skrypt eksportu CSV zaktualizowany i przetestowany (`node --check` OK), wykonano backup poprzedniej wersji na serwerze.
- Wygenerowano nowy plik CSV (7036 produktów) — wszystkie wiersze mają cenę w formacie `N,-`.

## Weryfikacja
Panel: 50 sprawdzonych wierszy w tabeli katalogu — wszystkie w formacie `N,-`, kolumna cena_zakupu nadal z groszami, brak błędów JS w konsoli. CSV: wszystkie 7036 wierszy zweryfikowane programowo — cena_sprzedazy kończy się na `,-`.

## Uwaga / ryzyko
Format `N,-` w CSV to tekst, nie liczba — użytkownik świadomie zaakceptował ryzyko, że import do Selly może wymagać dostosowania po stronie Selly, jeśli oczekuje tam czystej wartości liczbowej.

## Pliki w tym pakiecie
- `backup_kod_produkcyjny/frontend_index-PRICEFMT1783512500.js` — wdrożona wersja frontendu.
- `backup_kod_produkcyjny/generate_selly_export_2026-07-31.cjs` — wdrożona wersja skryptu eksportu CSV.
