# CHANGELOG — Bridge dla Agrowca

Rejestr zmian w projekcie (frontend / backend / baza danych). Najnowsze wpisy na górze.
Zasady prowadzenia: każda zmiana (edycja bundla frontu, modułu backendu, ALTER TABLE / zmiana schematu,
nowy endpoint, zmiana parsera, skrypt migracyjny) dostaje wpis. Bez sekretów. Kopie .bak podawane
z nazwą, aby dało się powiązać z wpisem.

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
