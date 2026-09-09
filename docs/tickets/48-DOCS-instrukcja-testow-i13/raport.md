# 48-DOCS-instrukcja-testow-i13 — raport

**Data:** 2026-09-09 · **Typ:** docs (instrukcja testów dla Ani)

## Co

`docs/instrukcja-testow-I13.md` — instrukcja testów Iteracji 13 dla Ani, napisana jako **DELTA
do przeczytania NAJPIERW**: I13 nie dodaje ekranu, tylko zmienia wartości na ekranach już znanych
(Katalog, Import), więc dokument mówi, co się zmieniło i co jest już nieaktualne w starszych
instrukcjach (I2/I3). Starsze instrukcje zostają bez zmian.

## Zakres (co Ania testuje w I13)

Zmiany 13a/13b/13c/13e (wszystkie z produkcji, odtworzone 1:1): nazwa „Bridge ONE", nazwy CAPS,
konstrukcja słowami, kategorie Wielką literą, NRO/CHO „Tak"/pusto, szerokość pierwszy człon,
filtr marek bez liczb, poprawki parsera (WxSxD/L-series/ułamki, MO8 CSV, WULSTBAND, marka
„UNKNOWN", brak fałszywej „zmiany kluczowej" z wielkości liter).

## Świadomie odnotowane w dokumencie

- **13d (Selly REST) NIE ma w tej wersji** — odłożone do ustabilizowania u Ani. Instrukcja mówi
  „nie szukaj tego".
- **Pułapki 1:1** wpisane do sekcji 6: CAPS z polskimi diakrytykami („PROWADZąCA"), szerokość
  pierwszy człon, asymetria filtra marka/kategoria.
- **#71** (konstrukcja „—" w żywej produkcji przez martwy bundle) — opisane jako „tutaj jest
  poprawnie, produkcja nie; zgłosimy osobno".

## Bramki
Nie dotyczy (docs). Zero zmian w `rebuild/`.
