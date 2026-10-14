# 258 — PARTNERZY: narzuty startowe z rozpiski starego panelu (krok wdrożenia)

Zlecenie użytkowniczki 2026-10-13: „uzupełnij narzuty partnerów zgodnie z rozpiską” (odczyt starego panelu narzutów v2.agroopony.eu: Adtyres i Fuhrmann = TyreWorld). Poprawka danych idzie krokiem wdrożenia (CLAUDE.md, pkt 1), tylko uzupełnia, niczego nie nadpisuje.

Rozpiska: 189 wpisów = 182 domyślne (5 % dla KAŻDEGO z 7 dostawców × 13 krajów × 2 partnerów) + 7 reguł marek (Niemcy, kategoria Rolnicze: Alliance u JMK i Bohnenkamp 2 %, CEAT u Bohnenkamp 2 % — obaj partnerzy; Vredestein u Handlopex Rzeszów 3 % — tylko Fuhrmann).

Odwzorowanie na nowy model (wariant B, ticket 255 — wartości to DOPŁATA w p.p. do marży sklepu produktu):
- Narzut domyślny: w nowym modelu jest jedna wartość na kraj (`partner_kraje.narzut_proc`), a wszystkie dostawcy mieli 5 % → ustawiamy 5 % w istniejących krajach partnera (z 13 ze starego panelu), **tylko tam, gdzie jest 0**. Kraje nie są zakładane.
- Reguły marek → `partner_narzuty` (kraj DE, warunki dostawca + kategoria + marka). Warunek `dostawca` porównuje `products.dostawca` = **KOD** (MO2…), a rozpiska ma nazwy → kod z tabeli `suppliers` po nazwie (nazwa równa albo „Grasdorf (kolarolnicze.pl)” po prefiksie, jednoznacznie). Brak/niejednoznaczność = krok się odkłada przed jakimkolwiek zapisem.
- Reguła o tych samych warunkach i kraju już istnieje (także ręczna) → nie dublujemy, nie zmieniamy.
Kod: `src/partnerzy/narzuty-startowe.ts`, krok `2026-10-13-partnerzy-narzuty-startowe` na końcu rejestru, test `test/partnerzy.narzuty-startowe.test.ts`.

Skutek w działaniu: kraje z narzutem 0 przestają blokować publikację cen — pliki aktywnego partnera zaczną zawierać ceny (zakup × (1 + marża sklepu + 5 p.p.)) przy najbliższym generowaniu. Nazw/pól produktu nie dotykamy (reguła `nazwa_pamiec` nie dotyczy).
Otwarte: TyreWorld ma w pliku 6 krajów (FR, DE, NL, BE, AT, IT), rozpiska Fuhrmanna 13 — brakujące 7 (CZ, SK, LT, LV, RO, HU, LU) wymaga decyzji o kolumnach cen w pliku; nie zakładam ich.
