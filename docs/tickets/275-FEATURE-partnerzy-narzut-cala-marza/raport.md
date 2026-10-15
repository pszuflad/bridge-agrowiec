# 275 — narzut partnera jest całą marżą od ceny zakupu

Decyzja Ani (2026-10-15): bez opcji „marża z katalogu + dopłata”; cena netto z katalogu = nasza cena zakupu, a narzut dla kraju/partnera determinuje cenę. Narzut 0 % i ujemny dozwolone. Do obecnych wartości dodać 6 pkt proc. (marża sklepu), np. sklep 6 % + Niemcy 2 % = 8 %. U góry panelu Partnerzy drobny druk, że marża jest liczona od ceny zakupu.

## Zmiany
- `selekcja.ts` (`wycenPozycje`), `symulacja-ceny.ts`: narzut = reguła albo narzut kraju; bez `marzaSklepuProc`; brak blokady 0 %.
- Walidacja: `narzutProc` w `PUT …/kraje/:kraj` wymagany, (-100; 1000]; reguła narzutu `wartosc` (-100; 1000].
- Krok wdrożenia `2026-10-15-partnerzy-narzut-cala-marza` (`partnerzy/narzut-cala-marza.ts`): +6 pkt proc. do narzutów krajów i reguł > 0, w transakcji; kraje z 0 % bez zmian (nie startujemy publikacji dla krajów, których nikt nie skonfigurował).
- Frontend: druk „Narzut (marża) partnera jest liczony od ceny zakupu…” na liście partnerów i w szczegółach partnera, etykiety „Narzut %”, symulacja bez „marża sklepu + dopłata”.

## Uwaga operacyjna
Narzut 0 % publikuje ceny po koszcie (zakup + przesyłka) — kraj dodany z narzutem 0 % od razu trafia do pliku partnera. Dlatego API wymaga jawnego `narzutProc`, a formularz kraju nie przyjmuje pustego pola.
