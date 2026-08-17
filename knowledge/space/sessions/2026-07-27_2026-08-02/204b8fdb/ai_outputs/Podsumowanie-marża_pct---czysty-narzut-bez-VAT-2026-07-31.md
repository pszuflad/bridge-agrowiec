# Podsumowanie: naprawa kolumny marża_pct (2026-07-31)

## Problem
Po wcześniejszej naprawie VAT w `cena_sprzedazy` tego samego dnia, kolumna `marza_pct` zaczęła pokazywać ~30% zamiast rzeczywistych ~6% narzutu — bo była liczona wstecz ze wzoru `(cena_sprzedazy - cena_zakupu) / cena_zakupu`, co po dodaniu VAT do ceny sprzedaży mieszało VAT z marżą.

## Zmiana
Naprawiono 4 miejsca w `index.cjs`, w których `marzaPct` była liczona wstecz z ceny — zamieniono na bezpośredni odczyt wartości narzutu z dopasowanej reguły (tabela `markups`), niezależnie od VAT-u:
- Funkcja `recalcPricesFromRules` (auto-uruchamiana przy każdej zmianie reguły narzutu/promocji): `marzaPct = narzutPct`.
- Dwa miejsca w głównym imporcie od dostawców: `marzaPct = __narz` (wartość reguły).
- Fallback bez dopasowanej reguły: `marzaPct = 25` (odpowiada domyślnemu mnożnikowi ×1,25 używanemu w tym samym miejscu).

## Naprawiona regresja przy okazji
Funkcja `recalcPricesFromRules` liczyła `cena_sprzedazy` z zaokrągleniem do groszy (`Math.round(...*100)/100`), a nie zgodnie z wcześniej ustaloną zasadą "w dół, bez groszy". Naprawiono na `Math.floor(...)` — bez tego przeliczenie marży cofnęłoby ceny do formatu z groszami.

## Wdrożenie i przeliczenie
- Backupy: `index.cjs.bak_pre_marzapct_fix_20260731_1505`, `index.cjs.bak_pre_recalcfix_20260731_1510` (serwer).
- PM2 zrestartowany dwukrotnie, bez błędów.
- Przeliczenie wszystkich 7036 aktywnych produktów wykonane przez wywołanie istniejącego endpointu `PATCH /api/markups/10` (dotknięcie jedynej aktywnej reguły globalnej 6%) — uruchomiło to wbudowany mechanizm `recalcPricesFromRules()` dla całej bazy.
- Zregenerowano eksport CSV Selly.

## Weryfikacja
Wszystkie 7036 aktywnych produktów: `marza_pct = 6.0` (czysty narzut z reguły), `cena_sprzedazy` bez groszy. Potwierdzone matematycznie na próbkach i wizualnie w panelu (kolumna Marża_pct pokazuje 6%, brak błędów JS).

## Uwaga na przyszłość
`recalcPricesFromRules()` uruchamia się automatycznie przy każdej zmianie reguły narzutu/promocji w panelu — kolejne edycje reguł same przeliczą ceny i marże dla pasujących produktów, bez potrzeby ręcznej interwencji.

## Pliki w tym pakiecie
- `backup_kod_produkcyjny/index.cjs_2026-07-31_v2_marza_fix.txt` — pełna wersja backendu wdrożona po tej poprawce.
