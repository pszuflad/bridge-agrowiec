# 217 — generator cennika partnera: zapis atomowy i archiwum (PRT-3.4)

Karta: `docs/karty/PARTNERZY/` · poziom 3 · zależy od 210, 213–216.

## Zakres
`src/partnerzy/generator.ts`: `generujPlikiPartnera(db, klientNbp, partnerId, {katalog, teraz?})` → `WynikGenerowania` (pliki, błędy, ostrzeżenia, kursy, liczniki);
`wyczyscArchiwum`. Bez harmonogramu (4.1), logów w bazie (4.2), tras i FTP (poziom 6).

## Przebieg
wybór pozycji → kurs na kraj (raz na plik; awaria NBP = rezerwa + ostrzeżenie; brak kursu = błąd dla kraju) → wycena → CSV/XML → zapis → zapis użytego kursu (`partner_kursy`).

## Decyzje
- **Układ plików:** kolumny z cenami ≥ 2 krajów → jeden plik z kolumnami krajów (TyreWorld); inaczej plik na każdy kraj, a kolumna ceny pokazuje cenę kraju pliku (Adtyres). XML zawsze plik na kraj.
- **Nazwy plików robocze** (`<partner>.csv`, `<partner>_<KRAJ>.csv|xml`) — schematy ustali użytkownik (otwarte pytanie z karty); zmiana to jedna linia w generatorze.
- **Zapis atomowy:** plik tymczasowy + rename w `<katalog>/pricelist/`; kopia w `<katalog>/archive/<YYYYMMDD_HHMMSS>_<plik>`; archiwum starsze niż 30 dni czyszczone (wiek z nazwy).
- **Pusty wynik (0 wierszy) NIE nadpisuje** poprzedniego cennika (zła konfiguracja magazynów, awaria danych) — to błąd operacji.
- `katalog` podaje wywołujący; docelowe katalogi serwera plików (`NAZWA_<16 znaków>/public/pricelist`, `private/archive`) to poziom 6.

## Zmiana zachowania produkcji
Brak — nowy moduł, nikt go jeszcze nie woła. Zapisuje tylko pod podany katalog.

## Testy
`test/partnerzy.generator.test.ts` — oba układy, XML, kurs zapisany, awaria NBP, pusty wynik, błędy kalkulacji, błędy konfiguracji, retencja archiwum.
