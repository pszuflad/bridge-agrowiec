# CHANGELOG — Bridge dla Agrowca

Rejestr zmian w projekcie (frontend / backend / baza danych). Najnowsze wpisy na górze.
Zasady prowadzenia: każda zmiana (edycja bundla frontu, modułu backendu, ALTER TABLE / zmiana schematu,
nowy endpoint, zmiana parsera, skrypt migracyjny) dostaje wpis. Bez sekretów. Kopie .bak podawane
z nazwą, aby dało się powiązać z wpisem.

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
