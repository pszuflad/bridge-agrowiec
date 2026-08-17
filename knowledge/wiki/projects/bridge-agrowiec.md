---
id: projects/bridge-agrowiec
item_type: wiki_page
semantic_type: project
title: Bridge for Agrowiec
description: Bridge for Agrowiec to istniejący panel na panel.agritires.eu do importu plików CSV dostawców, stagingu zmian produktowych, prowadzenia katalogu produktów, eksportu danych oraz rozwijania analityki biznesowej wspierającej decyzje zakupowe dotyczące opon rolniczych.
created_at: '2026-06-11T00:00:00+00:00'
updated_at: '2026-08-06T07:51:00+00:00'
language: pl
---
# Bridge for Agrowiec

Bridge for Agrowiec to istniejący panel na panel.agritires.eu do importu plików CSV/API dostawców, stagingu zmian produktowych, prowadzenia katalogu, eksportów oraz analityki biznesowej dla opon rolniczych[cite:1][cite:2].

## Jak to działa

Bridge działa jako produkcyjna aplikacja Node/SQLite z parserami MO1–MO10, katalogiem `products`, stagingiem importów, słownikami atrybutów, modułami Selly i integracją Agrorami; zmiany są wykonywane jako ukierunkowane poprawki w istniejącym systemie, nie jako przebudowa od zera[cite:1][cite:2][cite:3].

- **Istniejąca produkcja jako źródło prawdy** — żywy backend działa pod `/home/admin/private_apps/bridge/`, a frontend w publicznym panelu jest zbudowanym pakietem React/Vite; kopie Space/Codex są odniesieniami, ale bezpośrednia opieka nad błędami odbywa się na aktualnym VPS[cite:4][cite:5].
- **SQLite zamiast plików CSV jako baza** — CSV i API dostawców są danymi wejściowymi parserów, ale stan roboczy Bridge żyje w SQLite `data.db` przez `better-sqlite3` w trybie WAL; bezpieczny backup wymaga `VACUUM INTO` albo kompletu `data.db`, `data.db-wal`, `data.db-shm`[cite:1][cite:6].
- **Staging jako warstwa kontroli zmian** — import tworzy rekordy stagingu, a katalog aktualizuje się po akceptacji; zmiany niekluczowe mogą być automatyczne, natomiast zmiany kluczowe, konflikty ręcznych korekt i błędne EAN-y pozostają do przeglądu[cite:1][cite:6].
- **EAN i `kod_importu` jako grupowanie produktu** — EAN jest kluczem między dostawcami, gdy jest poprawny, a `kod_importu` grupuje ten sam produkt w wielu magazynach, zachowując odrębne wiersze dostawców, stany i ceny[cite:6][cite:7].
- **Pamięci chronią ręczne dane** — `manual_overrides`, `nazwa_pamiec`, pamięć wag, pamięć EAN i pamięć linków zdjęć utrzymują ręcznie potwierdzone wartości po kolejnych importach; konflikty wracają tylko przy nowej niezaakceptowanej wartości źródłowej[cite:6][cite:7].
- **Słowniki atrybutów są kontrolowane** — importy nie zasiewają automatycznie `atrybuty_wartosci`; nowe wartości przechodzą przez kolejkę pending z akceptacją, edycją/aliasem albo odrzuceniem, aby nie odtwarzać duplikatów w rozwijanych listach UI[cite:2][cite:8].
- **Katalog i staging są projektowane pod duże listy** — UI używa paginacji, wirtualizacji, wyszukiwania po nazwie/EAN/kodzie/dostawcy i osobnych akcji dla bieżącej strony, zaznaczonych rekordów oraz całego aktualnego filtra[cite:2][cite:6].
- **Ceny mają warstwy** — cena sprzedaży wychodzi z ceny zakupu, reguł narzutu i VAT, a promocje są osobną warstwą po marży; pozornie ujemna marża może wynikać z aktywnej promocji, nie z reguły narzutu[cite:6][cite:7].
- **Selly jest modułem Bridge** — integracja Selly używa backendowych tras `/api/selly/*`, cache tokenu OAuth, mappera, tabel mapowania produktów/słowników/logów i bootstrapu kategorii, producentów, VAT oraz magazynów MO1–MO10[cite:3].
- **Agrorami/MO9 idzie przez API** — MO9 korzysta z modułu API Agrorami i odczytuje realny stan z `stock_availability.in_stock_real`; stabilnym technicznym identyfikatorem pozostaje Magento `entity_id`, a widoczny kod dostawcy korzysta z `sku`[cite:6].
- **Eksporty filtrują dane ryzykowne** — eksport Shoper i eksport wybranych kolumn pomijają produkty z zerową ceną decyzyjną, a eksport brakujących EAN udostępnia pola potrzebne do ręcznego uzupełniania danych[cite:6].
- **Atrybut `Zastosowanie` jest trwały** — Bridge ma `products.zastosowanie`, słownik kontrolowany i master CSV w `/bridge/zastosowania/`; import uzupełnia tylko puste pola, aby nie kasować przypisanych ani ręcznych zastosowań[cite:6][cite:8].
- **Zdjęcia są pamiętane poza bieżącym importem** — linki zdjęć produktów trafiają do tabel pamięci po kodzie i po producent/model/rozmiar, a puste wartości z importu nie nadpisują istniejących linków[cite:4][cite:8].
- **Parsery mają reguły branżowe** — DOT pozostaje literalne, dętki są odrzucane, `inne` zwykle mapuje się na rolnicze, rozmiary i znaczniki `VF/IF/SB/HF/LF/TL/TT` są wydobywane z nazwy lub pól źródłowych, a wyjątki YARDMASTER/FARMPRO/Handlopex są obsługiwane per dostawca[cite:2][cite:8].
- **Scalanie wielomagazynowe zachowuje oddzielne oferty** — ręczne scalanie przez `kod_importu` ujednolica nazwę grupy, ale nie traci dostawcy, stanu, EAN, ceny ani osobnego wiersza magazynowego[cite:7][cite:9].
- **Format paczek scaleń** — robocze paczki można przygotowywać jako zbiorczy plik `Kody;Scalona nazwa`, gdzie wiele kodów w jednej komórce rozdziela się średnikami i mapuje do jednej nazwy docelowej[cite:9].
- **Selly pobiera pełny eksport z Bridge** — stabilny eksport HTTP z katalogu `ex-port-files` generuje pełny plik CSV z BOM UTF-8 i separatorem `;`, ograniczony na serwerze do adresu IP integratora Selly; pełny plik jest właściwym kształtem, bo integrator mapuje wybrane kolumny i ignoruje resztę[cite:7].
- **Panel ukrywa dane testowe** — ekran logowania nie pokazuje już przykładowych kont, a zmiana hasła działa jako operacja zalogowanego użytkownika na `/api/password/change`; reset hasła e-mailem pozostaje zależny od wyboru transportu poczty i przepływu UX[cite:7].
- **GitHub jako źródło prawdy dla kodu** — docelowy model pracy przenosi backend do prywatnego repozytorium, gdzie gałąź `develop` wdraża środowisko testowe, `main` produkcję, a VPS przechowuje tylko runtime, sekrety, bazy SQLite i procesy PM2 poza commitem[cite:12][cite:13].
- **Migracja repo zaczyna się od dostępnego kodu** — pierwszy stan repo ma objąć czytelne moduły backendu i parsery, sanitizowaną konfigurację, wdrożony bundle frontendu oraz dokumentację; `.env`, `data.db*`, backupy, logi i `node_modules` pozostają poza Git, a brak źródeł Reacta nie powinien blokować utworzenia repo[cite:15].
- **Frontend jako rebuild/injection, nie zwykły build** — aktywny frontend produkcyjny jest zbudowanym bundlem z dodatkowymi injection scripts, więc małe zmiany UI mogą iść jako nowy skrypt wstrzyknięcia, a głębokie zmiany wymagają odzyskania albo odbudowania źródeł na podstawie zachowania bundle/API[cite:10][cite:11][cite:14].
- **Publiczny frontend ma odrębną ścieżkę** — rzeczywisty panel jest serwowany przez Apache z `/home/admin/domains/agritires.eu/public_html/panel/`, natomiast `/home/admin/private_apps/bridge/public/` na porcie 5000 jest tylko nieużywanym fallbackiem; poprawki bundle muszą trafiać do pierwszej ścieżki[cite:7].
- **Brak etykiety nie jest zerem** — parser Handlopex zapisuje brak `labelSnow` i `labelIce` jako `null`, nie `0`; wartości śniegu bez potwierdzenia `MS`/`3PMSF` zostały wyczyszczone, aby kolejne importy nie przedstawiały braku danych jako cechy opony[cite:7].
- **Eksport OT ma format biznesowy** — pola logiczne eksportują `Tak` albo pustą wartość, skróty `SB/SF/HF/LS` są prezentowane jako `Tak`, konstrukcja pokazuje `R` jako `Radialna` i `D/L/B` jako `Diagonalna`, a `PR` ma postać `{liczba}PR`[cite:7].
- **Szerokość zachowuje zapis branżowy** — kolumna `Szerokość opony` zachowuje zera dziesiętne, dla formatów bez ukośnika pokazuje oba segmenty przed średnicą (`16x6-8` → `16x6`), a formaty z ukośnikiem (`425/50x18`) pozostawia w dotychczasowej logice[cite:7].
- **Stan logowania zależy od wyboru użytkownika** — frontend ma zapisywać token w `localStorage` po zaznaczeniu „zapamiętaj mnie”, a bez zaznaczenia korzystać z `sessionStorage`; pierwsza poprawka bundle wymagała zmiany nazw funkcji po kolizji ze zminifikowanym komponentem Radix UI Toast[cite:16].
- **API katalogu wymaga JWT** — `GET /api/dostawcy`, alias `/api/suppliers` i `GET /api/products` zostały objęte tym samym middleware autoryzacji co panel; Selly nadal pobiera statyczny CSV, więc zabezpieczenie tras nie zmienia kontraktu integratora[cite:17][cite:18].
- **Wycofanie wymaga trzech braków z rzędu** — produkt trafia do stagingu jako `wycofana` dopiero po nieobecności w trzech kolejnych importach dostawcy, co ogranicza fałszywe alarmy powodowane niepełnym plikiem jednego dnia[cite:18].
- **Klasyfikator rozpoznaje branżowe formaty rozmiarów** — poprawki `Zc()` obejmują rozmiary skid-steer z częścią dziesiętną, `VF`, całkowite, ułamkowe, modele `TR-` i sygnały `PR TL/TT`; rekordy bez danych pozwalających rozpoznać oponę pozostają odrzucone[cite:18].
- **Moduł Atrybuty ma jedną chronioną ścieżkę** — usunięto sześć starszych tras `/api/atrybuty*`, które przesłaniały `atrybuty_module.cjs`; podgląd produktów działa dla 15 typów, błędy autoryzacji są jawne, a token jest czytany z `sessionStorage` i `localStorage`[cite:18].
- **Słownik atrybutów odzwierciedla użycie w katalogu** — wartości nieużywane przez żaden produkt mogą być usuwane po pełnym przeliczeniu; po czyszczeniu 1755 z 6899 wartości zostało usuniętych, a puste `sezon` i `wentyl` wynikają z pustych kolumn produktów[cite:18].

## Otwarte decyzje techniczne

- **Standaryzacja modeli** — bieżniki/model/nazwa są standaryzowane wielkimi literami, z zachowaniem formy spacji albo myślnika według większości w bazie i wyjątków użytkowniczki, np. Trelleborg `TM 600` bez myślnika oraz `T-991` z myślnikiem[cite:7].
- **DOT jako dane jawne** — dwucyfrowe lata DOT z Grasdorf są uzupełniane prefiksem `20`, wartości czterocyfrowe typu `0323` zostają bez zmiany, a nazwa zawierająca `DOT` może oznaczać wartość `starsza niż 3 lata`, jeśli użytkowniczka zatwierdzi taką regułę[cite:6].
- **Kategorie jako pięć form kanonicznych** — po ujednoliceniu kategorie Bridge mają czyste warianty `Rolnicze`, `Ciężarowe`, `Przemysłowe`, `Leśne` i `Rolnicze małe`; adapter powinien normalizować warianty bez polskich znaków, żeby duplikaty nie wracały po imporcie[cite:6].
- **Granica odzyskanego kodu** — moduły backendu, parsery, skrypty, SQL i moduły Selly są w dużej części czytelne, ale główny `index.cjs` i frontend wymagają szczególnej ostrożności, bo część produkcji pozostaje minifikowanym buildem bez sourcemap[cite:14].
- **Dane testowe w publicznym bundle** — kod frontendu nadal zawiera twardo zapisane dane testowych kont mimo ukrycia ich w UI; wymagają usunięcia jako osobna poprawka bezpieczeństwa[cite:16].

## See also

- [[projects/selly-tire-search-ux]] — model wyszukiwania w sklepie
- [[projects/agrorami-api-integration]] — feed dostawcy GraphQL
- [[projects/selly-agroopony-catalog-configuration]] — filtry kategorii Selly
- [[projects/agroopony-tire-data-enrichment]] — EAN i wagi

## References

[cite:1]: pplx://sessions/0c08d699-112b-4d19-8c6c-5665cd38c538
[cite:2]: pplx://sessions/4a63f119-a015-462d-b0ac-0cbd959d8928
[cite:3]: pplx://sessions/f83616b5-5c51-4c6e-8873-4ef2493323d6
[cite:4]: pplx://sessions/ee48724e-1407-4653-bfc8-781188e58fc9
[cite:5]: pplx://sessions/9dccf618-7b25-41e3-bf0b-5e3a56a6a573
[cite:6]: pplx://sessions/f99ad55a-0b84-4812-a3af-113c0e4a075d
[cite:7]: pplx://sessions/fc2830c5-1fb5-44f7-8294-1854dfef123c
[cite:8]: pplx://sessions/b7b532ad-dc91-4b84-828d-50e4fb361ca5
[cite:9]: pplx://sessions/92f95de1-1229-451f-8b25-d99dfd1d56d0
[cite:10]: pplx://sessions/9d749782-345f-4396-ab96-6c67e25ada40
[cite:11]: pplx://sessions/cc24a1be-5884-45ba-95ff-5c11eddfdfa4
[cite:12]: pplx://sessions/b4336cb4-4c63-4d92-8c3d-bd022bcf64d3
[cite:13]: pplx://sessions/11a52e4b-b232-4a2f-a7c7-cda41ad59444
[cite:14]: pplx://sessions/7136cd47-a6fe-4c72-a54e-27e5940e0aac
[cite:15]: pplx://files/7fcd8b97-8d7b-4f15-bc6e-d3850ae7e018/ai_outputs/Notatka-migracja-Bridge-do-repozytorium.md
[cite:16]: pplx://sessions/204b8fdb-4ffa-4e26-9806-ef930b7ed29b
[cite:17]: pplx://sessions/d35fafff-edd8-4f55-8680-0705b06a8115
[cite:18]: pplx://sessions/626ef740-6f4e-4284-9b3a-b6c1e6fc3a12
