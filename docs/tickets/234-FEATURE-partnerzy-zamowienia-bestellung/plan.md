# 234 — drugi format zamówień: TyreWorld `bestellung` (PRT-7.1b)

> Status: Approved (użytkownik 2026-10-12 przesłał przykłady zamówień i zrzuty FTP; pracujemy autonomicznie) · Gałąź: `claude/peaceful-gates-a8yebr`

Karta: `docs/karty/PARTNERZY/` · poziom 7. Do tej pory parser znał jeden format (`DOCUMENTORDER`, Adtyres — jedyny przykład w karcie). Przykłady od użytkownika pokazały, że **TyreWorld wysyła zamówienia
w zupełnie innym formacie** (`bestellung`, niemiecki, system TopM R6). Bez tego zamówienia TyreWorld kończyłyby błędem pliku.

## Zakres
- `parsujZamowienie` rozpoznaje format po elemencie głównym: `DOCUMENTORDER` (bez zmian) albo `bestellung`; oba trafiają do tego samego modelu `Zamowienie` (zapis, walidacja względem katalogu, panel — bez zmian).
  Nie ma konfiguracji per partner i nie ma migracji: format wynika z pliku.
- Mapowanie `bestellung`: `bestellnummer` → numer partnera; `bestelldatum` → data; `lieferadresse/lkz` → kraj; `positionen/pos`: `artnr` → kod (tekst, zera wiodące znaczą), `menge` → ilość, `preis` → cena (opcjonalna),
  `bezeichnung` → nazwa. Adres dostawy i `neutralversand`/`bemerkung`/`bemerkungintern` w mapie `dostawa` pod oryginalnymi nazwami. Brak waluty i kosztu dostawy w formacie → `null`.
- Panel: polskie etykiety niemieckich pól adresu.
- Dokumentacja: fakty z przykładów i zrzutów serwera plików (układ katalogów, nazwy plików cenników, `done`) w karcie; pytania do rozstrzygnięcia w `decyzje-do-konsultacji-marty.md`.

## Decyzje (samodzielnie)
- Fixtures w repozytorium są ZANONIMIZOWANE (struktura jak w prawdziwych plikach, dane zmyślone): repozytorium jest publiczne, a przykłady zawierają dane osób i adresy klientów końcowych. Prawdziwych plików nie commitujemy.
- Waluta zamówienia z `bestellung` zostaje `null` (format jej nie podaje); założenie EUR i netto/brutto `preis` to pytania do potwierdzenia, nie wiedza.

## Kontrakt i fixtures
Brak (moduł wewnętrzny, trasy bez zmian).

## Testy
Parser (oba formaty, błędy, anonimowy fixture), odbiór e-mail (zamówienie `bestellung` przechodzi tym samym kanałem i walidacją), panel (etykiety).

## Poza zakresem
Skąd dokładnie przychodzą zamówienia TyreWorld (kanał), kontrola ceny, zmiana nazw plików cenników i układu katalogów FTP (osobne decyzje).

## Definition of done
- [ ] Bramki backendu i frontendu zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop`
