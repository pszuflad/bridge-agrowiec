# 191 — Cena sprzedaży nie przeliczała się po zmianie ceny zakupu

## Zgłoszenie (Ania, 2026-10-06)
710/45-26.5 ALLIANCE FORESTAR 644 III: MO1 zakup 5402 → sprzedaż 7474, MO2 zakup 5947,50 → sprzedaż 6906,
przy jednym narzucie globalnym 6% (oczekiwane: 7043 i 7754).

## Przyczyna
Cicha aktualizacja importera (`import/polityka/fabryka.ts`, port `staging_policy.cjs:495`) i „Odrzuć”
w stagingu (`odrzucenie-zmiany.ts`) zmieniały `cena_zakupu`, ale nie `cena_sprzedazy` — adapter daje
`cenaSprzedazy: null`, a reguły cenowe liczyły się tylko przy akceptacji stagingu i edycji narzutu.
Stan produkcji 2026-10-06: 2523 z 5447 aktywnych kart niezgodnych z narzutem, 338 poniżej zakupu + VAT.

## Zmiana
- `repos/ceny.ts`: `cenaSprzedazyPoZmianieZakupu()` — formuła z `zastosujRegulyCenowe` na kopii (bez `status`).
- `fabryka.ts`: gdy w patchu jest nowa `cenaZakupu`, a plik/poprawka Marty nie niesie ceny sprzedaży —
  przelicz `cenaSprzedazy` i `marzaPct` z reguł. Reguły czytane raz na import.
- `odrzucenie-zmiany.ts`: to samo, z pominięciem kart z poprawką `cenaSprzedazy` w `manual_overrides`.
- Test: `test/cena-sprzedazy-po-zmianie-zakupu.test.ts`.

## Jednorazowo na produkcji (po akceptacji)
Backup `VACUUM INTO`, przeliczenie `floor(zakup × (1+narzut) × (1−rabat) × (1+VAT))` dla kart z zakupem > 0,
z pominięciem kart z poprawką ceny sprzedaży; wpis do `history` (zrodlo `przeliczenie_191`). Tor 1 wyśle ceny do Selly.
