---
id: projects/agroopony-tire-data-enrichment
item_type: wiki_page
semantic_type: project
title: Agroopony Tire Data Enrichment
description: Agroopony Tire Data Enrichment to praca nad uzupełnianiem katalogu opon o zweryfikowane EAN/GTIN i rzeczywiste masy opon, tak aby Bridge, Selly i arkusze operacyjne korzystały z danych przypisanych do konkretnego rozmiaru, modelu i wariantu...
created_at: '2026-07-15T05:22:00+00:00'
updated_at: '2026-07-25T07:46:00+00:00'
language: pl
---
# Agroopony Tire Data Enrichment

Agroopony Tire Data Enrichment to praca nad uzupełnianiem katalogu opon o zweryfikowane EAN/GTIN i rzeczywiste masy opon, tak aby Bridge, Selly i arkusze operacyjne korzystały z danych przypisanych do konkretnego rozmiaru, modelu i wariantu[cite:1][cite:2][cite:3].

## Jak to działa

Proces rozdziela dwa typy danych: kody EAN trafiają do arkuszy, katalogu Bridge i `manual_overrides`, natomiast masy opon pochodzą z katalogów technicznych producentów i muszą być dopasowane po rozmiarze oraz serii/modelu[cite:1][cite:2][cite:3].

- **Dopasowanie wag po serii i rozmiarze** — praca nad wagami dzieli listę po producentach i seriach, preferuje manuale techniczne producentów, a niejednoznaczne masy zostawia puste zamiast zgadywania[cite:2].
- **Batchowe pokrycie wag** — kontynuacja batchy raportowała 331 z 427 pozycji z wagą w bieżącej części pracy oraz przejście 12 dużych producentów; słabsze pokrycie Kleber, Continental i Kabat wynikało z ograniczonej publikacji mas albo braków w rozpoznaniu serii[cite:3].
- **Nokian Float King jako ręczna luka** — lista Float King VF obejmuje m.in. VF800/60R32, VF710/50R26.5, VF650/65R26.5, VF650/55R26.5, VF620/60R26.5, VF600/55R26.5 i VF750/60R30.5; wartości `Weight kg` znajdują się w manualu Nokian, ale sesja 2026-07-14 nie wydobyła konkretnych liczb[cite:2].
- **Arkusz referencyjny EAN** — potwierdzone pary nazwa/EAN są gromadzone w arkuszu referencyjnym, a pozycje bez wiarygodnego publicznego GTIN są pomijane lub oznaczane jako `brak EAN`, żeby nie wprowadzać podobnych wariantów jako prawdziwych kodów[cite:4][cite:5].
- **Brakujące EAN nie są przepisywane z podobnych wariantów** — arkusz `produkty_bez_ean.xlsx` miał 271 uzupełnionych pozycji z 279, a 8 wariantów pozostało jako `brak EAN`, bo publiczne źródła nie potwierdzały jednoznacznego kodu dla konkretnego modelu, rozmiaru, TT/TL lub wersji[cite:5].
- **EAN w Bridge i pamięci importu** — 114 EAN-ów zostało zapisanych w katalogu i w `manual_overrides`, dzięki czemu kolejne importy od MO1, MO3, MO4, MO5 i MO9 mogą ponownie zastosować potwierdzone wartości[cite:1].
- **Pamięć EAN bez nadpisywania konfliktów** — produkcyjny Bridge odtwarza puste EAN-y z trwałej pamięci, ale nie nadpisuje 88 konfliktów, w których import API ma już inny EAN; obecne EAN-y z dostawcy pozostają w bazie, dopóki użytkowniczka nie zatwierdzi nadpisania[cite:5].
- **Nieoficjalne EAN-y są oznaczane** — po uzupełnieniu 14 z 17 brakujących EAN trzy kody wewnętrzne lub nieoficjalne zapisano z `ean_is_valid=0`, a trzy produkty pozostały bez EAN, bo nie znaleziono żadnego wiarygodnego kodu w dostępnych źródłach[cite:5].
- **MO9 wymaga właściwego identyfikatora** — ręczne nadpisania EAN dla Agrorami/MO9 muszą używać stabilnego Magento `entity_id`, a nie handlowego SKU, ponieważ import MO9 dopasowuje produkty po wewnętrznym identyfikatorze[cite:1].
- **Konflikty zostają do decyzji** — po dodatkowym dopasowaniu rozmiaru i modelu plik weryfikacyjny miał 63 konflikty EAN i 77 pozycji bez bezpiecznego dopasowania; automatyczne przypisanie po samym rozmiarze jest ryzykowne, bo ten sam rozmiar BKT może mieć różne bieżniki i EAN-y[cite:1].
- **Unikalność bieżnika jako porównanie wariantu** — wykrywanie pozycji dostępnych tylko u jednego dostawcy powinno porównywać pełny wariant opony, a nie samą markę lub nazwę bieżnika; AT 108 i AGRIMAX RT 765 nie są bezpiecznymi przykładami „BKT-only” bez dalszego diffu po rozmiarze i indeksach[cite:6].
- **Korekta obciętych rozmiarów BKT** — żółte pozycje BKT z uszkodzonym EAN w notacji naukowej należy dopasowywać po pełnej nazwie, modelu i PR, bo ten sam skrót rozmiaru może oznaczać różne szerokości zależnie od modelu i nośności[cite:7].
- **Brak indeksów Nokian jako luka źródłowa** — braki indeksów nośności/prędkości w wybranych pozycjach MO7/Nokian wynikają z pustego pola `LI/SI` w pliku Nokian, więc ich uzupełnianie wymaga danych od dostawcy lub manualnej weryfikacji technicznej, a nie poprawki parsera[cite:5].
- **Masowe uzupełnienie wag w Bridge** — po dopasowaniu 2968 pozycji dokładnie po nazwie, 32 po nazwie bez indeksów/`demo` oraz 271 kolejnych po kluczach i medianie rozmiaru, 6822 z 6843 produktów Bridge miało wagę, a 21 zostało bez wzorca do oszacowania[cite:5].
- **Szacunki wag bez etykiety w polu** — użytkowniczka zdecydowała, że w bazie w kolumnie wagi ma zostać sama wartość, bez słowa `SZACUNEK`; informacja o pochodzeniu szacunku może żyć w mechanizmie ochrony/override, ale nie w widocznej wartości wagi[cite:5].
- **Niepewne masy wymagają późniejszej weryfikacji** — pięć nazw w Excelu miało po dwie różne wagi i zostało rozstrzygnięte na korzyść wyższej masy, więc pozostaje to grupa do sprawdzenia u źródła technicznego[cite:5].

## See also

- [[projects/bridge-agrowiec]] — katalog i importy
- [[projects/selly-agroopony-catalog-configuration]] — filtry produktu

## References

[cite:1]: pplx://sessions/12d4afdd-feb3-4848-af89-20f8fdc9450a
[cite:2]: pplx://sessions/0efb554c-6e95-41af-8605-77ca80dcc897
[cite:3]: pplx://sessions/c1cbe13a-311a-4ba3-aab3-98d5c6460f91
[cite:4]: pplx://sessions/7d346558-418b-4ddb-ab2d-1f3fbb3458e8
[cite:5]: pplx://sessions/f99ad55a-0b84-4812-a3af-113c0e4a075d
[cite:6]: pplx://sessions/d38f64ee-4416-45d1-85cf-7886b813cb8c
[cite:7]: pplx://sessions/975c279b-8574-449d-a6bb-11d2d4729730
