
2026-08-25 13:15
obszar: backend + baza danych

pliki:
  - parsers/tyre_params.cjs (+ .bak_pre_flagsfix_20260825_1315)
  - parsers/adapter.cjs (+ .bak_pre_flagsfix_20260825_1315)
  - data.db (+ .bak_pre_flagsfix_20260825_1315, .backup — WAL-safe)

zmiana:
  Naprawa rozjazdow w kolumnach flag opon i normalizacji tekstu. Wszystkie
  flagi UE (ms, snow_3pmsf, label_ice, cfo, stubble_resistant) sa teraz Tak/NULL
  konsekwentnie zgodnie z poprawka checkmark_tak z 2026-07-21, a label_noise
  ma zawsze format NNdB albo NULL.

  KOD (naprawa nadpisywania przy imporcie):
  1) tyre_params.cjs: normalizeLabelFlag() dostal 2 dodatkowe zastosowania — linie
     514-515 i 1063-1064 (ms/snow3pmsf zwracaly hardkodowane 1/0 zamiast Tak/null)
     i linia 1070 (labelIce przez normalizeQty zwracal string "0.0" zamiast Tak/null).
     Nowa funkcja normalizeLabelNoise() ustala format "NNdB" w zakresie 60-90 albo
     NULL (odsiewa "B", "24dB", "73dB - )))"). Zastosowana w liniach 519 i 1067.
     Eksport modulowy rozszerzony: normalizeLabelFlag i normalizeLabelNoise dostepne
     dla adaptera.
  2) adapter.cjs: cfo i stubbleResistant propagowane przez tyre.normalizeLabelFlag()
     przed zapisem do bazy (wczesniej ?? null bez konwersji 0/1 → Tak/NULL). Ms i
     snow3pmsf tez przechodza przez normalizeLabelFlag jako druga linia obrony na
     wypadek starych sciezek importu ktore moglyby zwrocic surowa liczbe.

  DANE (jednorazowe czyszczenie w transakcji):
  - label_ice: 2278 wartosci "0.0" i 134 pustych stringow → NULL (parser wpisywal
    ilosc jako string, kolumna TEXT trzymala smieci)
  - label_noise: 22 smieci ("B", "70"/"73"/"74" bez dB, "72dB - )))", "24dB") →
    NULL albo znormalizowane do NNdB
  - ms: 1311 wartosci 1 → 'Tak', 2830 wartosci 0 → NULL
  - snow_3pmsf: 1358 → 'Tak', 2783 → NULL
  - cfo: 57 → 'Tak', 2716 → NULL
  - stubble_resistant: 2 → 'Tak', 2147 → NULL
  - marka: 2 rekordy MO2 z rozmiarem opony jako marka (MO2_999991688, MO2_999991691)
    zamienione na 'UNKNOWN' (marka ma NOT NULL, parser MO2 do zbadania osobno);
    1 rekord "Alliance" → UPPER
  - nazwa: 1139 rekordow z realnie malymi literami (glownie MO5 Trelleborg/Ozka,
    MO9 BKT V-Flecto/Agrimax) → UPPER. Przy najblizszym imporcie parser zwroci
    male 'x' w rozmiarze przez toUpperPLName().

  MIGRACJA SCHEMATU: pominieta. SQLite ma dynamic typing i przyjmuje 'Tak' w
  kolumnie deklarowanej jako INTEGER (typ trzyma sie na wartosci, nie kolumnie).
  Zmiana INTEGER→TEXT nie jest konieczna.

  WERYFIKACJA:
  - PM2 restart bridge-backend (uptime OK, wszystkie moduly zarejestrowane)
  - PRAGMA integrity_check: ok
  - Symulacja parsera na realnym CSV MO5 (5194 wierszy, sample 500): ms Tak=429/null=71,
    snow Tak=415/null=85, label_ice Tak=0/null=500, label_noise OK=383/smieci=0

powod:
  Zgloszenie Anny: "sprawdz czy nie ma wiecej [poprawek], np. mialo sie nie
  pojawiac 0 w kolumnie lod i snieg". Audit potwierdzil 6543 zerowych flag i
  22 smieciowych label_noise mimo poprawki sniegfix z 18.08. Notatka
  diagnostyczna z 2026-08-21 (wpis wyzej) juz identyfikowala te 4 miejsca
  w tyre_params.cjs — teraz naprawione zgodnie z zasada z system-promptu
  "poprawki danych zawsze tez w parserach" (bez tego auto-pull 04:00 nadpisze).

obszar: backend + frontend
pliki:
  - uwaga_cena_patch.cjs (+bak_pre_holdreasons_20260824_143500)
  - public_html/panel/assets/hold-reason-injection.js (+bak_v2_20260824_144000)
zmiana:
  - Backend: dodano endpoint GET /api/products/hold-reasons zwracający powód wstrzymania dla KAŻDEGO produktu ze statusem 'wstrzymany' (nie tylko z uwaga_cena).
    Katalog powodów liczony runtime: uwaga_cena (jeśli set) / "Brak ceny i stanu u dostawcy" / "Brak ceny u dostawcy" / "Brak stanu magazynowego u dostawcy" / "Wstrzymane — sprawdź ręcznie".
  - Frontend v3: injection wywołuje nowy endpoint, dokleja ikonę "i" do wszystkich 507 wstrzymanych (356 brak stanu, 136 sprawdź ręcznie, 9 brak ceny+stanu, 6 na zapytanie).
  - Frontend przełącza się na dopasowanie po EAN (widoczna kolumna) zamiast kod (niewidoczny).
powód:
  Anna: "możemy ustawić standard taki że do każdego wstrzymanego będzie taki podgląd żeby było widać jaki powód wstrzymania?"
  Poprzednia wersja (v1/v2) pokazywała ikonę tylko dla 6 pozycji z uwaga_cena. Nowy standard: KAŻDY wstrzymany ma widoczny powód.
2026-08-24 12:25
obszar: backend + baza danych + frontend

pliki: common.cjs (+bak_pre_uwagacena_20260824_121500), parsers/mo7_nokian.cjs (+bak), parsers/adapter.cjs (+bak), extensions.cjs (+bak), uwaga_cena_patch.cjs (NEW), data.db (+bak_pre_uwagacena_20260824_121500), panel/index.html (+bak_pre_holdreason_20260824_121500), panel/assets/hold-reason-injection.js (NEW), index.cjs (+bak — nie zmodyfikowany, backup profilaktyczny)

zmiana: obsługa "ceny na zapytanie" dla dostawców zwracających cenę nienumeryczną (np. Nokian dla wielkoformatowych VF Float King: "- zł" zamiast liczby). (1) common.cjs — nowa funkcja detectPriceOnRequest() wykrywa myślnik/tekst-bez-cyfr → 'na zapytanie'; normalizeRecord propaguje uwaga_cena. (2) parsers/mo7_nokian.cjs — dla row['Zakup 1 szt'] wywołuje detectPriceOnRequest, ustawia uwaga_cena w rec. (3) parsers/adapter.cjs — output surowe ma pole uwagaCena obok cenaZakupu. (4) uwaga_cena_patch.cjs — nowy moduł: ALTER TABLE products ADD COLUMN uwaga_cena TEXT (idempotentnie), monkey-patch U.acceptStaging odczytuje uwagaCena ze snapshotJson i wykonuje UPDATE products.uwaga_cena po zaakceptowaniu staging, monkey-patch U.addProductsBulk propaguje z payload, endpoint GET /api/products/uwagi-cena. (5) extensions.cjs — wywołuje installUwagaCena w register(). (6) frontend hold-reason-injection.js — MutationObserver+cache dodaje ikonę "i" w kółku obok badge'a statusu "wstrzymany" w widoku katalogu, tooltip pokazuje uwaga_cena. (7) Backfill 5 rekordów MO7 Nokian VF Float King (MO7_T445819/22/23/25/26) — uwaga_cena='na zapytanie'.

powód: prośba Anny — pozycje z ceną 0 wynikającą z "ceny na zapytanie" u dostawcy miały wyglądać identycznie jak realnie zepsute dane. Teraz kolumna uwaga_cena w bazie dokumentuje powód wstrzymania, a frontend pokazuje wizualnie odnośnik przy statusie "wstrzymany" żeby każdy wiedział że to celowe (nie błąd importu). Weryfikacja parserem live-feedu: 6 pozycji wykrytych (5 katalogowych + 1 wycofana T445824), wszystkie z uwagaCena='na zapytanie'.

 
2026-08-21 15:15
obszar: backend + baza danych

pliki: usuniete stare backupy (data.db.bak_* x49, index.cjs.bak_* x55, parsers/*.bak* x124, common/bridge_ext/extensions/selly .bak x22, panel/assets stare bundle i .bak x42)

zmiana: Sprzatanie serwera po diagnozie "wracajacych" poprawek. Usunieto 292 stare pliki backup (~6 GB; dysk 77% -> 58%). Zachowano najnowsze punkty przywracania: data.db.bak_pre_szertxt_20260819_154550, data.db.bak_pre_szerorig_20260819_145623, data.db.bak_pre_atrybutycleanup_20260805095548, index.cjs.bak_arch_core_20260821, index.cjs.bak_pre_atrybutyfix_20260805093822, index.cjs.bak_post_masowaakceptacja_20260804143100 + najnowsze .bak per parser/modul. DIAGNOZA: zasmiecenia w label_noise ("B", "74", "73dB - )))") oraz zera w ms/snow_3pmsf/label_ice NIE pochodza z przywrocenia starego backupu — produkcyjny index.cjs (2026-08-21 12:58) zawiera wszystkie poprawki (authfix, VAT, marza_pct, parserfix, nieobecnosc_pod_rzad). Przyczyna: parsery przy KAZDYM imporcie wpisuja surowe wartosci — tyre_params.cjs:520 emptyToNull(record.halasDb) bez normalizacji, tyre_params.cjs:514-515/1063-1064 ms/snow3pmsf hardkodowane 1/0, tyre_params.cjs:1070 labelIce przez normalizeQty. Czyszczenie czysto danych (SQL 2026-07-24) jest nadpisywane przez kolejne importy MO2/MO5. Dodatkowe ryzyko systemowe: snapshoty backend__*.txt w repo plikow projektu sa nieaktualne (nawet 6 tygodni) — NIGDY nie wdrazac z nich; zrodlem prawdy sa pliki na serwerze.

powod: zgloszenie Anny — stare zasmiecenia wracaja, podejrzenie nadpisywania zlych wersji; polecenie usuniecia starych backupow.

2026-08-21 13:55
obszar: backend

pliki: archive_module.cjs (+ .bak_ret7_20260821)

zmiana: Retencja archiwum importow zmieniona z 90 na 7 dni (RETENTION_DAYS=7). Limit 5 GB bez zmian. Panel pokazuje nowa retencje automatycznie (czyta z /api/import-archive/stats).

powod: prosba Anny — 90 dni to za dlugo, wystarczy 7.
2026-08-21 13:05
obszar: backend

pliki: index.cjs (+ .bak_arch_core_20260821)

zmiana: Rozszerzenie archiwum na rdzen — podpieto archiveBuffer() w centralnym lejku nq() w index.cjs. Do tej pory archiwizowaly sie tylko sciezki z extensions.cjs (auto-pull, from-url, parse-file). Teraz objete sa tez reczne akcje rdzenia: „Synchronizuj teraz" (L4->nq) oraz upload pliku z panelu (/api/dostawcy/:kod/upload -> nq). Zrodlo w metadanych: „rdzen-nq". Archiwum w try/catch — nigdy nie przerywa importu. Test E2E: POST /api/dostawcy/MO2/synchronizuj-teraz -> plik trafil do archiwum (MO2 | rdzen-nq | ok).

powod: pytanie Anny czy KAZDY wpadajacy plik bedzie zapisywany — domkniecie luki w recznych importach rdzenia.
2026-08-21 12:58
obszar: backend + frontend

pliki: archive_module.cjs (+ .bak_dlfix_20260821), assets/archive-injection.js (+ .bak_dlfix_20260821)

zmiana: Poprawka pobierania z archiwum — trasa /api/import-archive/file/:id zamieniona na /file/:month/:name (dwa segmenty sciezki). Przyczyna: Apache (AllowEncodedSlashes=Off) odrzucal zakodowany %2F w sciezce, wiec klik „Pobierz" w panelu zwracal 404. Injection buduje teraz URL z dwoch segmentow. Przetestowane przez publiczny adres — pobieranie dziala (HTTP 200, pelny plik).

powod: zgloszenie Anny — „Nie udalo sie pobrac pliku: 404" w zakladce Archiwum importow.
2026-08-21 10:52
obszar: backend + frontend

pliki: archive_module.cjs (NOWY), extensions.cjs (+ .bak_archiwum_20260821), assets/archive-injection.js (NOWY), index.html (+ .bak_archiwum_20260821)

zmiana: Archiwum plikow importu — kazdy plik, ktory wpada do Bridge (auto-pull, from-url, upload z panelu) jest kopiowany PRZED parsowaniem do import_archive/RRRR-MM/ wraz z metadanymi JSON (zrodlo, uzytkownik, rozmiar, sha256, rekordy, status ok/blad, tresc bledu). Archiwizowane sa tez pliki, ktore nie przeszly parsowaniem. Rotacja: usuwanie starszych niz 90 dni oraz najstarszych przy przekroczeniu 5 GB. Nowe endpointy (auth JWT): GET /api/import-archive (lista z filtrami dostawca/miesiac/status), GET /api/import-archive/stats, GET /api/import-archive/file/:id (pobranie). Frontend: nowa zakladka „Archiwum importow" w sidebarze (injection archive-injection.js, przejmuje trase /archiwum) — tabela z filtrami, pasek zajecia archiwum, pobieranie plikow.

powod: prosba Anny — historia zapisywanych plikow, ktore wpadaja z importow, dostepna do wgladu i pobrania z panelu.
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

