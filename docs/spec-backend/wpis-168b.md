# Wpis do spec-backend od ticketu 168b (`168-FEATURE-uzupelnianie-ean-999`) · 2026-09-30

**Sekcja:** §2 (import/staging, akceptacja) i nowe trasy `/api/ean-pary/*`.

**Nowe w 168** (`168-FEATURE-uzupelnianie-ean-999`, 2026-09-30): reguła uzupełniania PUSTYCH `products.ean`
— ⚠ **NOWA logika biznesowa, nie odtworzenie produkcji** (produkcja ma tylko ręczny skrypt
`mirror/backend/apply_ean_memory.cjs`). Decyzje użytkownika:

- **Tabela `ean_pary`** (migracja `017_ean_pary.sql`): `kod` (= `products.kod`) ↔ `ean`, `numer`, `status`
  (`aktywny` / `zastapiony`); UNIQUE na `kod`, `ean` i `numer`.
- **Format EAN:** `999` + 9-cyfrowy numer kolejny (licznik = `MAX(numer)+1`, bez losowania) + cyfra kontrolna EAN-13
  (`src/ean-pary/generator.ts`; `validateEan` odrzuca EAN-13 z błędną sumą). Numery, których EAN już nosi produkt w
  katalogu, są pomijane.
- **Zakres:** wyłącznie puste `products.ean` (NULL, `''`, same spacje). Produkt z EAN nie jest ruszany — także w
  `POST /api/products` bez klucza `ean` (dziedziczy EAN istniejącej karty).
- **Prawdziwy EAN z importu wygrywa:** para dostaje `zastapiony`, numer pozostaje zarezerwowany.
- **Staging:** `polityka/fabryka.ts` uzupełnia pusty EAN z pary (snapshot + `ean_raw`), więc kolejny import nie pokazuje
  „EAN → pusty" i EAN przeżywa akceptację także po `POST /api/products/clear`. Akceptacja (`zatwierdzPozycjeStagingu`,
  flaga `uzupelnijEan`) i `dodajProduktyBulk` nadają EAN nowym pozycjom. Flaga domyślnie wyłączona, żeby testy
  charakteryzacji (port == oryginał) mierzyły dalej zachowanie produkcji; włączają ją `polityka/akceptacja.ts` (poza
  wycofaniami) i `POST /api/products`.
- **Selly:** EAN 999… idzie jak zwykły EAN (bez zmian w generatorze CSV/mapperze).
- **Trasy (spoza `contract/openapi.yaml`, `requireAuth`):** `GET /api/ean-pary/po-kodzie/:kod`,
  `GET /api/ean-pary/po-ean/:ean`, `POST /api/ean-pary/generuj` (`{kod}`), `POST /api/ean-pary/uzupelnij`
  (`{dry_run?: boolean}`), `GET /api/ean-pary` (`limit`/`offset`).

Szczegóły: `docs/tickets/168-FEATURE-uzupelnianie-ean-999/`.
