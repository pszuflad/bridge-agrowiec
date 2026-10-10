# Wpis 214 — selekcja pozycji eksportu partnera

Ticket `214-FEATURE-partnerzy-selekcja-pozycji` (PRT-3.1). `src/partnerzy/selekcja.ts`: `wybierzPozycje` zwraca pozycje katalogu `status='aktywny'`
z wybranych magazynów partnera, bez wykluczeń, ze stanem ≥ `stan_min` i dodatnią ceną zakupu, po jednej na pozycję (bez agregacji magazynów), z wyczyszczonym
tekstem; liczy też pominięte (stan, wykluczenia, brak ceny). `wycenPozycje` woła kalkulator (213) dla każdego kraju partnera i zwraca `ceny[kraj]` (`null` przy błędzie)
oraz listę błędów kalkulacji i ostrzeżeń. Odczyt przez jawną projekcję (bez mappera flag boolean). Konsument: szablony CSV/XML (PRT-3.2/3.3).
