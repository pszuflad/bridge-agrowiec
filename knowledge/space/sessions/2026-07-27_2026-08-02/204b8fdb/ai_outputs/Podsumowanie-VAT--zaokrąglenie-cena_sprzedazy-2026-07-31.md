# Podsumowanie: naprawa VAT + zaokrąglenie ceny sprzedaży (2026-07-31)

## Problem
`cena_sprzedazy` w bazie Bridge była liczona BEZ VAT-u mimo że kod deklarował zmienną `__vat` — była pobierana, ale nigdy nie mnożona w finalnym wzorze (martwy kod w 2 miejscach `index.cjs`, logika importu bulk od dostawców). Potwierdzone empirycznie na próbce produktów: cena_sprzedazy = cena_zakupu × (1+marża/100), VAT nigdzie się nie pojawiał.

## Zmiana
Naprawiono formułę w obu miejscach: `cena_sprzedazy = Math.floor(cena_zakupu × (1+narzut/100) × (1-rabat/100) × (1+VAT/100))`. Dodano mnożenie przez VAT oraz zmieniono zaokrąglanie z `Math.round` (do groszy) na `Math.floor` (w dół, do pełnych złotych — bez groszy), na wyraźne życzenie użytkownika. `cena_zakupu` pozostaje nietknięta.

## Wdrożenie
- Backup przed edycją: `index.cjs.bak_pre_vat_fix_20260731_1430` (serwer).
- Plik wdrożony na `/home/admin/private_apps/bridge/index.cjs`, proces PM2 `bridge-backend` zrestartowany bez błędów.
- Backup bazy przed masowym przeliczeniem: `data.db.bak_pre_vat_recalc_20260731_1441` (219 MB, po WAL checkpoint).
- Jednorazowo przeliczono `cena_sprzedazy` dla wszystkich 7036 aktywnych produktów wg nowego wzoru.
- Zregenerowano eksport CSV dla Selly (`sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv`, 7036 wierszy).

## Weryfikacja
Zgodność matematyczna potwierdzona na próbkach (np. zakup 213,60 zł, marża 6%, VAT 23% → 278 zł). W panelu Bridge potwierdzono: ceny bez groszy, stosunek cena_sprzedazy/cena_zakupu ≈ 1,30, brak błędów JS.

## Otwarta kwestia (niezmieniona, do decyzji w przyszłości)
Kolumna `marza_pct` liczona jako `(cena_sprzedazy - cena_zakupu)/cena_zakupu` od teraz pokazuje marżę razem z VAT-em (~30% zamiast czystych ~6%), bo `cena_sprzedazy` jest już brutto. Użytkownik zdecydował nie ruszać tego teraz.

## Pliki w tym pakiecie
- `backup_kod_produkcyjny/index.cjs_2026-07-31.txt` — pełna wersja backendu wdrożona po poprawce.
