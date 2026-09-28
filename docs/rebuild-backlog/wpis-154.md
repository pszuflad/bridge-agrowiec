# Backlog — wpisy ticketu 154 (`154-BUG-csv-selly-flagi-tak`) · 2026-09-24

Nie triaż zmian produkcji — ustalenie wyszło przy naprawie generatora CSV (karta `FIX.1`, wpis `#153.1`).

### #154.1 · 2026-09-24 · [BACKEND] · sync REST do Selly gubi te same flagi `'Tak'` co gubił CSV

| Pole | Wartość |
|---|---|
| **Data** | wykryte 2026-09-24 (usterka istnieje od wdrożenia mappera, karta I15.x / Selly REST) |
| **Kategoria** | BACKEND |
| **Pliki** | `rebuild/backend/src/selly/mapper.ts:197-203` (`zbudujOpisOpony`) |
| **Commit** | — (nie zmiana produkcji; ustalenie ticketu 154) |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | ⬜ niezałatane — świadomie poza zakresem karty `FIX.1` |

**Opis biznesowy.** Ten sam błąd, który kazał generatorowi CSV wypisywać pustkę zamiast `Tak`
(wpis `#153.1`, naprawione ticketem 154), siedzi **drugi raz** — w tabeli atrybutów wysyłanej do
Selly przez **sync REST**. Produkty, które mają flagę zapisaną w bazie jako tekst `'Tak'`, trafiają
do sklepu **bez wiersza** `M+S`, `3PMSF`, `Reinforced`, `Extra Load` i trzech odpornościowych
w opisie HTML. Skala jest ta sama, co przy CSV: na kopii produkcji z 23.09 tekst `'Tak'` miało
713 produktów w `ms` i 750 w `snow_3pmsf` (z 5396 aktywnych).

Różnica wobec CSV jest tylko w tym, **jak to widać**: CSV to jeden plik, który dało się porównać
bajt w bajt z plikiem produkcji. Tu chodzi o pole `content_html` w payloadzie REST, więc rozjazd
nie wyjdzie z żadnego `diff`a — zobaczy go dopiero ktoś, kto obejrzy kartę produktu w sklepie.

**Szczegół techniczny (dla rebuildu).** Ta sama przyczyna, co w `#153.1`: odczyt przez Drizzle
w trybie boolean, gdzie mapper robi `Number(v) === 1`, więc tekst `'Tak'` daje `false`.

Łańcuch wywołań (sprawdzony `grep`em, nie z nazw funkcji):

```
POST /api/selly/sync-product   → routes/selly.ts:184  produktPoKodzie(db, kod)
POST /api/selly/sync-supplier  → routes/selly.ts:262  produktyDoSynchronizacji(db, dostawca, …)
        ↓ oba oddają ProduktWewnetrzny = typeof products.$inferSelect (flagi już zmapowane na boolean)
   routes/selly.ts:197,275     naPayloadSelly(db, produkt, mapy)
        ↓
   mapper.ts:269               content_html: zbudujOpisOpony(produkt)
        ↓
   mapper.ts:197-203           dodaj("M+S", p.ms ? "tak" : null)   ← tu ginie tekst 'Tak'
```

`produktPoKodzie` i `katalogDoImportu` (`repos/products.ts:148`) czytają `db.select().from(products)`,
czyli pełną projekcję modelu — dokładnie ten sam wzorzec, który naprawiliśmy w generatorze CSV.

Dotknięte pola (`mapper.ts:197-203`): `ms`, `snow3pmsf`, `reinforced`, `extraLoad`, `cutResistant`,
`heatResistant`, `stubbleResistant`. **Trzech z dziesiątki `KOLUMNY_BOOL` mapper nie używa** —
`nro`, `cho`, `cfo` nie wchodzą do opisu HTML, więc ich to nie dotyczy.

**Dlaczego nie naprawione w tickecie 154.** Karta `FIX.1` daje na wyłączną własność
`rebuild/backend/src/selly/generator-csv.ts` + jego test i wprost wyłącza inne pliki; sync REST jest
zakresem kart Selly REST, które mogą chodzić równolegle. Decyzja użytkownika (2026-09-24): zgłosić,
nie naprawiać — żeby nie wejść w cudzy plik i nie zrobić z tego ticketu dwóch nieporównywalnych
dowodów wierności (dla CSV dowodem jest `diff` pliku; dla REST trzeba by porównywać payloady).

**Czego NIE zmieniać przy naprawie.** Modelu Drizzle (`src/db/schema.ts`) — tak samo jak w `#153.1`.
Oryginał trzyma te kolumny w trybie boolean (`deminified/backend-index.cjs:43733-43752`), więc
`GET /api/products` ma dalej zwracać `false` na `'Tak'`, zgodnie z `contract/fixtures/GET_products.json`.
Poprawka należy do warstwy odczytu — wzorzec do przepisania jest w `generator-csv.ts`
(`FLAGI_SUROWE` + `.select({ ...getTableColumns(products), ...FLAGI_SUROWE })`).

**⚠ Uwaga przy weryfikacji.** `POST /api/selly/sync-supplier` z `dry_run=false` **realnie modyfikuje
cudzy sklep** (`CLAUDE.md`, „Środowisko"). Sprawdzać wyłącznie na `dry_run=true` / na atrapie
(`test/gate/selly-atrapa.ts`), nigdy przez wysyłkę do żywego Selly.
