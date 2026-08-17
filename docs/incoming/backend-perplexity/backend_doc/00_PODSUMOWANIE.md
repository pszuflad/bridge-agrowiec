# 00. Podsumowanie techniczne

## Stan zweryfikowany

| Element | Wynik | Dowód |
|---|---|---|
| MD5 rdzenia | `b745bf958a991105adc70cd85a3462b1` | Fakt potwierdzony w briefie (Krok 0); dokumentacja analizuje deminifikat `/tmp/bridge_be/be.cjs`. |
| Endpointy rdzenia | 49 rejestracji `/api` | `/tmp/bridge_be/be.cjs:48156-48853`; pełna lista w `01_ENDPOINTY.md`. |
| Endpointy modułowe | 66 unikalnych definicji (w tym 2 `/admin`); 64 żywe i niezasłonięte przez rdzeń | `01_ENDPOINTY.md`, sekcja duplikatów. |
| Endpointy po deduplikacji | 113 unikalnych par `metoda+ścieżka` | 49 rdzeń + 66 moduły − 2 pokryte przez rdzeń. |
| Baza | 27 tabel, `products` 72 kolumny, `products` 7405 wierszy, WAL | żywe zapytania; pełny eksport `schema.sql`; `02_SCHEMAT_BAZY.md`. |
| Selly | **Ładowane w runtime warunkowo** po powodzeniu otwarcia `_bridgeDb` | `/home/admin/private_apps/bridge/extensions.cjs:369-400`. |
| PM2 | `bridge-backend` online (fork) | żywe `pm2 list`; config `ecosystem.config.cjs:4-29`. |

## Obiekty dryfu

* Tabele: `atrybuty_wartosci_pending`, `atrybuty_wartosci_odrzucone`, `selly_kategoria_norm_map`, `selly_zastosowanie_category_map`.
* Kolumny: `products.kod_importu`, `products.zastosowanie`.

Uzasadnienie stworzenia/nieutworzenia i użycia każdego obiektu znajduje się w `02_SCHEMAT_BAZY.md`.

## Rozbieżności względem audytu użytkownika

| Pozycja | Aktualny, potwierdzony stan | Stary audyt / brief użytkownika | Rozstrzygnięcie |
|---|---|---|---|
| MD5 rdzenia | `b745bf958a991105adc70cd85a3462b1` | `3eca99b8…` | Rdzeń się zmienił po 08-05. |
| Liczba tabel | 27 | 26 | Jedna tabela więcej w żywej bazie. |
| `products` | 72 kolumny | 71 | Jedna kolumna więcej w żywym schemacie. |
| Produkty | 7405 | 6941 | Wynik `SELECT COUNT(*)` z żywej bazy w WAL. |
| Selly routes | Są ładowane warunkowo w runtime | „nie są ładowane” | Aktualny kod Extensions wywołuje rejestrację. |
| PM2 | Proces online | „PM2 nie działa / nie ma w PATH” | Aktualny proces PM2 działa. |
| Atrybuty jako duplikat rdzeń/moduł | Nie potwierdzono rejestracji Atrybutów w rdzeniu | brief sugerował równoległość | Obowiązuje bieżący deminifikat: Atrybuty rejestruje Extensions. |
| Metody `U` | 50 metod zdefiniowanych w aktualnym obiekcie | 47 w materiale audytowym | Pełny inwentarz zawiera `04_WARSTWA_DANYCH.md`; liczba wynika z definicji w aktualnym rdzeniu. |

## Granice pewności

Każdy endpoint w inwentarzu ma lokalizację `plik:linia`; schemat i liczności pochodzą z żywej bazy. Tam, gdzie kod nie ujawnia kontraktu albo nie można go stwierdzić z odczytu, dokumentacja mówi **NIEZNANE**. Nie podano żadnej wartości `.env`, sekretu JWT, hasła Agrorami, klucza Selly ani danych SSH.
