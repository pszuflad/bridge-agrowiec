2026-08-19 15:50
obszar: backend + baza danych

pliki: parsers/tyre_params.cjs (.bak_pre_szertxt_20260819_154550), data.db (.bak_pre_szertxt_20260819_154550)

zmiana: products.szerokosc: REAL -> TEXT. parseSize zwraca teraz szerokosc jako string 1:1 z rozmiaru (zachowane zera koncowe: "10.0", "10.00", "12.00", "24.00"). Dodane pole szerokoscRaw w wyniku parseSize (kopia stringa). Migracja: CREATE TABLE products_new (TEXT) + INSERT SELECT z ekstrakcja pierwszej liczby z rozmiar jako string (regex /(\d+(?:[.,]\d+)?)/, przecinek -> kropka) + DROP + RENAME + odtworzenie indeksu idx_products_kod_importu. Zmigrowano 7405 rekordow, 880 zmienionych (odzyskane zera koncowe np. 24.00R35: 24 -> "24.00", 10.0/75x15.3: 10 -> "10.0"), 6525 bez zmian, integrity_check ok. PM2 zrestartowany. wysokoscBokuCm i wysokoscRzeczywistaCm dalej liczone z float (kolejnosc w parseSize: najpierw obliczenia z liczby, potem nadpisanie result.szerokosc stringiem). Konsekwencja: eksport CSV Selly (generate_selly_export.cjs) w kolumnie "Szerokosc-opony-mm" bedzie teraz mial 1:1 z rozmiaru — nazwa naglowka z sufiksem "-mm" jest historyczna, faktyczna jednostka to jednostka oryginalna z rozmiaru (mm dla slash, cale dla WxD/W-D/L-series).

powod: Anna zauwazyla ze float ucina zera koncowe (10.0 -> 10). Wymog: "jezeli jest 10.0 to ma byc 10.0, jezeli 10.00 to 10.00" — kolumna musi trzymac dokladny string z pliku dostawcy.

---

2026-08-19 14:56
obszar: backend + baza danych

pliki: parsers/tyre_params.cjs (.bak_pre_szerorig_20260819_145623), bridge_ext.cjs (.bak_pre_szerorig_20260819_145623), data.db (.bak_pre_szerorig_20260819_145623)

zmiana: cofniete przeliczanie products.szerokosc -> mm z 2026-08-18. Teraz szerokosc zostaje w jednostce oryginalnej z rozmiaru (mm dla notacji slash W/PxD/W/PRD; cale dla WxD, W-D, WxP-D, WRD, L-series). Usunieto koncowe "result.szerokosc = mm" w parseSize(). Usunieto fallback tireWidthMm() w bridge_ext.applyDims() (tireWidthMm mial dodatkowo bug: dla notacji AxB traktowal A jako srednice zamiast szerokosci, wiec dla 13.6x24, 14.9x24, 12.4x24 wszystkie 3 dostawaly 609.6 = 24*25.4). Backfill: przeliczono 7405 rekordow, 2665 zmienionych, 4702 bez zmian, 38 nieparsowalnych rozmiarow (28 wyzerowanych do NULL, 10 juz mialo NULL). PRAGMA integrity_check: ok. PM2 zrestartowany.

powod: Anna zglosila ze panel pokazywal "706.2" dla 14.9x28 i "609.6" dla 13.6x24 / 14.9x24 / 12.4x24 (identyczne dla roznych szerokosci) — konwersja cali na mm mieszala jednostki i ukrywala bug tireWidthMm.

---

# CHANGELOG — Bridge dla Agrowca

Rejestr zmian w projekcie (frontend / backend / baza danych). Najnowsze wpisy na górze.
Zasady prowadzenia: każda zmiana (edycja bundla frontu, modułu backendu, ALTER TABLE / zmiana schematu,
nowy endpoint, zmiana parsera, skrypt migracyjny) dostaje wpis. Bez sekretów. Kopie .bak podawane
z nazwą, aby dało się powiązać z wpisem.

## 2026-08-18 12:08
- obszar: backend, baza danych
- pliki: parsers/tyre_params.cjs (funkcja parseSize() — konwersja szerokosc do mm; nowa funkcja parseWidthFallbackMm(); 2 miejsca fallbacku w normalizeJmk/normalizeHandlopex); kopie zapasowe: parsers/tyre_params.cjs.bak_pre_szerokoscfix_20260818100723, data.db.bak_pre_szerokoscfix_20260818100743 (+backfill skrypt jednorazowy backfill_szerokosc_20260818.js, usunac po weryfikacji)
- zmiana:
    1) Przyczyna: parseSize() w tyre_params.cjs zwracal result.szerokosc jako surowa liczbe z tekstu rozmiaru (np. 11.2 dla "11.2-24"), mimo ze wewnetrznie liczyl widthCm (poprawnie przeliczone cm) tylko do wysokosci opony. adapter.cjs zapisuje enriched.szerokosc 1:1 do bazy; bridge_ext.cjs's applyDims() dopisuje mm z tire_dims.js's tireWidthMm() TYLKO gdy pole jest null — wiec gdy parser cokolwiek ustawil (nawet surowa liczbe), poprawka nigdy sie nie uruchamiala. Efekt: dla identycznego rozmiaru (np. "11.2-24") raz zapisywano 11.2 (cale), raz 284.5 (mm) w zaleznosci od sciezki parsera/dostawcy — 177 rozmiarow z rozbieznymi wartosciami, 2027 rekordow dotkniete.
    2) Kod: parseSize() teraz zawsze przypisuje result.szerokosc = widthCm przeliczone na mm (ta sama logika inch/mm co juz istniala lokalnie dla wysokosci, teraz stosowana konsekwentnie do samej szerokosci). Dodano parseWidthFallbackMm() i zastosowano w 2 miejscach (normalizeJmk linia ok.490, normalizeHandlopex linia ok.1039), gdzie istnial ryzykowny fallback do surowej niesprzeliczonej kolumny CSV (parseNumber(record.szerokosc)) — teraz ten fallback rowniez konwertuje do mm. Obejmuje wszystkich dostawcow (MO1-MO10), bo wszyscy przechodza przez parseSize().
    3) Backfill danych: skrypt jednorazowy przeliczyl products.szerokosc dla wszystkich 7405 produktow z rozmiar niepusty, uzywajac kanonicznego tireWidthMm() z tire_dims.js. Zaktualizowano 1827 rekordow (bylo w calach/surowej liczbie), 5568 bez zmian (juz poprawne), 10 nieparsowalny format rozmiaru (bez zmian, do przyszlej analizy). Po naprawie: 0 rozmiarow z rozbieznymi wartosciami szerokosc (bylo 177). PRAGMA integrity_check: ok.
    4) Weryfikacja: pozostale 32 rekordy z szerokosc<100mm sa prawidlowe (male opony do taczek/wozkow, np. "3.00-4"=76.2mm, "3.50-8"=88.9mm) — nie blad.
- powód: na prosbe Anny — zbadanie i naprawa niekonsekwentnego formatu w products.szerokosc ("11 vs 11.00"); po ustaleniu ze to nie problem formatowania (kolumna REAL) a rzeczywisty blad konwersji jednostek, naprawiono kod + dane za zgoda uzytkownika ("znajdz problem i napraw od razu").

## 2026-08-18 11:50
- obszar: backend, baza danych
- pliki: common.cjs (nowa funkcja capitalizeKategoria, klasyfikator classifyByName), parsers/adapter.cjs (import common.cjs, zastosowanie capitalizeKategoria przy zapisie kategoria), zastosowania/audit.cjs (slownik SLOWNIK); kopie zapasowe: common.cjs.bak_pre_kategoriafix_20260818114801, parsers/adapter.cjs.bak_pre_kategoriafix_20260818114801, zastosowania/audit.cjs.bak_pre_kategoriafix_20260818114801
- zmiana:
    1) products.zastosowanie — ujednolicono wielkosc liter dla 343 rekordow (harwester→Harwester, kompaktor→Kompaktor, kosiarka/ogród→Kosiarka/ogród, maszyny górnicze→Maszyny górnicze, suwnica/dźwig→Suwnica/dźwig). Dodano 5 brakujacych wartosci do slownika atrybuty_wartosci (rodzaj=zastosowanie, origin=selly).
    2) products.kategoria — scalono prawdziwe duplikaty case-insensitive dla 537 rekordow (rolnicze/Rolnicze, przemyslowe/Przemyslowe, ciezarowe/Ciezarowe, lesne/Lesne) na jedna wersje z Wielka litera kazda. Stan po naprawie: Rolnicze 4533, Ciezarowe 1463, Przemyslowe 1195, Lesne 214 (bez duplikatow).
    3) Kod: classifyByName() w common.cjs zwraca teraz kategorie z Wielkiej litery (bylo malej). Nowa funkcja capitalizeKategoria() w common.cjs mapuje kazdy znany wariant (mala/wielka litera, z/bez polskich znakow) na kanoniczna forme; zastosowana w adapter.cjs's recordToSurowe() na koncu pipeline (przed zapisem do DB), wiec obejmuje WSZYSTKICH dostawcow (w tym MO9/Agrorami i inne hardkody w tyre_params.cjs) bez potrzeby edycji kazdego parsera osobno. audit.cjs's SLOWNIK zastosowania rowniez ujednolicony, zeby nie zglaszal naprawionych wartosci jako "zle" przy audycie.
- powód: na prosbe Anny — sprawdzenie standaryzacji wielkosci liter w zastosowanie/kategoria (wykryto przy okazji real duplicates w kategoria, naprawione za zgoda uzytkownika w tym samym zadaniu).

## 2026-08-05 11:55
- obszar: backend, baza danych
- pliki: index.cjs (zmiana 11:40), atrybuty_module.cjs (zmiana 11:43), cleanup_atrybuty.cjs; kopie zapasowe przed zmianą: index.cjs.bak_pre_atrybutyfix_20260805093822, data.db.bak_pre_atrybutycleanup_20260805095548 (+ -shm, -wal)
- zmiana:
    1) Zabezpieczenie API katalogu — trasy /api/dostawcy, /api/suppliers i /api/products objęte tym samym middleware autoryzacji JWT co panel (wcześniej były publiczne, bez logowania). Statyczny CSV dla integratora Selly bez zmian.
    2) Moduł Atrybuty — usunięto 6 starszych, nakładających się tras /api/atrybuty*; ujednolicono do jednej chronionej ścieżki. Podgląd produktów działa dla 15 typów; błędy autoryzacji jawne; token czytany z sessionStorage i localStorage.
    3) Reguła wycofania (staging) — produkt oznaczany jako 'wycofana' dopiero po nieobecności w 3 kolejnych importach dostawcy (redukcja fałszywych alarmów).
    4) Klasyfikator opon Zc() — rozszerzone rozpoznawanie formatów rozmiarów (skid-steer z częścią dziesiętną, VF, wartości całkowite/ułamkowe, modele TR-, sygnały PR TL/TT); rekordy bez danych rozpoznawczych nadal odrzucane.
    5) Czyszczenie słownika — schemat/dane: z tabeli słownikowej atrybuty_wartosci usunięto 1755 z 6899 wartości nieużywanych przez żaden produkt (po pełnym przeliczeniu użycia). Bez zmiany struktury tabel (brak ALTER TABLE) — operacja tylko na danych (DELETE nieużywanych wierszy). Dane produktów nie migrowane; puste 'sezon'/'wentyl' wynikają z pustych kolumn produktów. Kopia bazy przed operacją: data.db.bak_pre_atrybutycleanup_20260805095548.
- powód: zamknięcie publicznego dostępu do API katalogu (bezpieczeństwo), usunięcie konfliktu duplikujących się tras maskujących moduł Atrybuty, ograniczenie błędnych wycofań przy niepełnym imporcie, poprawność klasyfikacji rozmiarów opon oraz uporządkowanie słownika atrybutów.
