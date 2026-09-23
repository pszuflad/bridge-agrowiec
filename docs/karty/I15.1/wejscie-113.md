# Wejście dla I15.1 od ticketu 113 (koordynator) · 2026-09-23 — lista „Zostało przed PR” WYCZERPANA

Próba na **prawdziwej kopii produkcji** wykonana 2026-09-23 14:07–14:20 na VPS (kopia `.backup` z żywej
`data.db`, 8329 produktów, `integrity_check = ok`, brak tabeli `_migracje`). Migracje uruchomione z gałęzi
`feature/107-products-blokady-triggery` (commit `3eabfee`), build na VPS, binarka `better-sqlite3` podłożona
z produkcji.

**Wynik `npm run migrate`:**

```
migrate: zastosowano 12 (001_schema.sql, 002_import.sql, 003_szerokosc_text.sql, 004_kategoria_wielka_litera.sql,
005_konstrukcja_slowa.sql, 006_nazwa_caps.sql, 007_waga_gab_przewoznicy.sql, 008_alerty_katalogu_statusy.sql,
009_alerty_polskie_znaki.sql, 010_marka_caps.sql, 011_blokowane_formy_i_triggery.sql,
013_selly_products_warianty.sql), pominięto 0 (już zastosowane)
migrate: w tym bez treści (warunek dyrektywy @pomin-jesli-…): 003_szerokosc_text.sql, 013_selly_products_warianty.sql
```

**Cały łańcuch przeszedł bez błędu** — uodpornienie `002` (dyrektywa `@dodaj-kolumne-jesli-brak`), `003`
i `013` (warunki) działa na realnym schemacie produkcji (74 kolumny `products`, `szerokosc` już TEXT,
`selly_products` w nowym kształcie).

**Pomiary po migracji na tej kopii:** produkty 8329 · triggery **6** (`products_blokowane_formy_ai/_au`,
`products_zastosowanie_ai/_au`, `manual_overrides_kategoria_ai/_au`) · alerty z „?” **0** · `marka='Alliance'`
**0** · przewoźnicy **6** · blokady puste (znani dostawcy) **0** · blokady puste MO6 **0** ·
`zastosowanie` z łańcuchem ` ; ` **0**.

**Pomiar #101 na ŻYWEJ produkcji (tylko odczyt, przed migracją):** produktów z pustym
`blokowane_formy_platnosci` — **0**, w żadnej grupie dostawcy; triggerów na produkcji **6**.
Czyli zgłoszenie Ani „każdy nowy produkt ma to pole puste” **nie dotyczy bazy Bridge** — hipoteza MO6 też
odpada. Zostaje hipoteza (b): puste pole po stronie **Selly** (produkty zakładane w sklepie bez tej cechy) —
sprawdza to karta I15.7/I15.6 w payloadzie `mapper_v2`.

**Wniosek dla karty:** wszystkie cztery punkty sekcji „Zostało przed PR (scenariusz A)” są rozliczone —
próba migracji, porównanie triggerów, pomiar #101, pomiar łańcuchów `zastosowanie`. **PR #122 można mergować.**
Karta przy zamknięciu niech przepisze te liczby do „Dowiezione” i zdejmie sekcję „Zostało przed PR”.
