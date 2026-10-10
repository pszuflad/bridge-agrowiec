# Wpis 217 — generator cennika partnera

Ticket `217-FEATURE-partnerzy-generator-plikow` (PRT-3.4). `src/partnerzy/generator.ts`: `generujPlikiPartnera` orkiestruje selekcję (214), kurs (210), wycenę (213) i szablony CSV/XML (215/216).
Jeden plik z kolumnami krajów, gdy kolumny mają ceny ≥ 2 krajów, inaczej plik na kraj. Zapis przez plik tymczasowy + rename do `pricelist/`, kopia do `archive/` (30 dni), użyty kurs do `partner_kursy`.
Pusty wynik nie nadpisuje cennika. Zwraca błędy (kalkulacji, konfiguracji, operacyjne) i ostrzeżenia do logów (PRT-4.2). Nazwy plików robocze.
