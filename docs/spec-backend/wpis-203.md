# Wpis do spec-backend od ticketu 203 · 2026-10-09

**Sekcja:** §2 (import — zapis produktu) i trasy konserwacyjne katalogu.

**NOWA logika biznesowa, NIE potwierdzenie zachowania oryginału.** Produkcja ma tylko pamięć linków
(`applyLinkMemory`, `legacy/bridge_ext.cjs`: po kodzie albo marce+modelu+ROZMIARZE), i to wyłącznie
przy akceptacji stagingu / auto-zatwierdzaniu. Dopasowania po samej marce i modelu ani przebiegu po
katalogu nie ma.

**Od ticketu 203** (`203-FEATURE-link-zdjecia-po-modelu`, decyzje użytkownika, 2026-10-09):
- Pusty `linkZdjecia` dostaje **najczęstszy** link produktów o tej samej **marce i modelu** (bez
  rozmiaru; klucz: wielkie litery, zwinięte spacje; remis → najmniejszy alfabetycznie). Źródłem są
  wyłącznie linki już obecne w katalogu (nie tabele `link_pamiec_*`). Logika:
  `src/import/dziedziczenieLinkow.ts`.
- Wpięcie w zapis: `acceptStaging` (Staging v2 — parametr `uzupelnijLink`, jak `uzupelnijEan`) i
  `dodajProduktyBulk` (opcja `uzupelnijLink`; `POST /api/products` włącza) — TUŻ PO `applyLinkMemory`,
  więc pamięć linków wygrywa. Domyślnie wyłączone, żeby harness charakteryzacyjny nadal porównywał
  port z oryginałem. Auto-zatwierdzanie (`polityka/fabryka.ts`) nie jest objęte — uzupełnia katalog
  przycisk poniżej.
- **Ochrona:** uzupełniony link zapisuje się jako poprawka Marty (`manual_overrides`,
  `fieldName = 'linkZdjecia'`), więc import dostawcy go nie nadpisze (i zgłosi „konflikt ze
  źródłem", gdy plik poda inny link). Produkt z poprawką linku — także pustą (= celowe wyczyszczenie)
  — nie jest uzupełniany.
- Katalog: `POST /api/products/uzupelnij-zdjecia` (`dry_run: true` → podgląd; bez → zapis, opcjonalnie
  `ids`) + skrypt `npm run uzupelnij-zdjecia` (domyślnie tylko podgląd, `-- --zapisz` zapisuje) +
  sekcja „Uzupełnianie zdjęć" w Konfiguracja → Katalog. Audyt: `uzupelnienie_linkow_zdjec`.
- Staging: `GET /api/staging/{id}/propozycja-zdjecia` (podpowiedź w szczegółach pozycji) i nowe
  edytowalne pole `linkZdjecia` w `PUT /api/staging/{id}` (zapisuje poprawkę Marty).

Kontrakt: dwie nowe ścieżki + pole w `PUT /api/staging/{id}`; istniejące odpowiedzi bez zmian.
Fixtures ręczne: `POST_products_uzupelnij-zdjecia.json`, `GET_staging_id_propozycja-zdjecia.json`.

Szczegóły: `docs/tickets/203-FEATURE-link-zdjecia-po-modelu/`.
