# Wpis 236 — numer katalogowy partnera `EAN-dostawca`

Ticket `236-FEATURE-partnerzy-numer-katalogowy-ean-dostawca`. Nowa funkcjonalność (bez migracji).

- `PozycjaEksportu.numerPartnera` = `<EAN>-<dostawca>` bez białych znaków; `null`, gdy brak EAN lub dostawcy. Dozwolone źródło kolumny `katalog`.
- CSV: pozycja z `numerPartnera = null` wypada z pliku, jeśli plik ma taką kolumnę; licznik `bezNumeru` → ostrzeżenie generatora.
- Zamówienia: `CODE` = `products.kod` albo `EAN-dostawca` (dzielone na ostatnim `-`); wiele trafień → aktywna z największym stanem. To jedyne miejsce mapowania (`znajdzPozycjeKatalogu`).
- Ryzyko znane: ten sam EAN+dostawca w kilku magazynach daje jeden numer dla kilku pozycji; w pliku pojawią się dwa wiersze z tym samym numerem.
