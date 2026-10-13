# Wpis 245 — „magazyn” partnera = kod dostawcy

`partner_magazyny.magazyn` przechowuje kod dostawcy (`products.dostawca`: MO1, MO2…). `dostepneMagazyny` grupuje po dostawcy; `wybierzPozycje` filtruje `products.dostawca IN (…)`, a `PozycjaEksportu.magazyn` niesie dostawcę (kolumna „Warehouse”). Fizyczny magazyn (`products.magazyn`) nie jest używany. Krok `2026-10-13-partnerzy-magazyny-dostawcy`: partner z wyborem zawierającym wartości spoza dostawców katalogu dostaje komplet bez MO6/7/8.
