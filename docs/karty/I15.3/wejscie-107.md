# Wejście dla I15.3 od ticketu 107 (I15.1) · 2026-09-22

Pole modelu `blokowaneFormyPlatnosci` już istnieje (`rebuild/backend/src/db/schema.ts`, kolumna
`products.blokowane_formy_platnosci` z migracji 011) i jest utrzymywane przez trigger `products_blokowane_formy_ai/_au`
po każdej zmianie `dostawca`. Dziś jest **celowo ukryte** w `KOLUMNY_POZA_KONTRAKTEM.products`
(`rebuild/backend/src/repos/kolumny.ts`) jako stan przejściowy — komentarz w migracji wprost mówi „wystawia karta
I15.3”.

**Wystawienie pola = zdjęcie z listy wykluczeń + aktualizacja strażników**, które dziś pilnują, że pole NIE wychodzi:
- `test/katalog.gate.test.ts` — asercja na `GET /api/products` (dziś 72 klucze bez tego pola);
- `test/produkty.mutacje.test.ts` — asercja na odpowiedź `PATCH /api/products/{id}` (też 72 klucze).
Obie trzeba zmienić świadomie na 73 klucze + wartość pola, plus ewentualnie `contract/fixtures/GET_products.json`
i `contract/openapi.yaml`.

**PATCH nie zapisuje tego pola** — nie jest na liście pól edytowalnych w `src/repos/products.ts`; wartość utrzymują
wyłącznie triggery po zmianie `dostawca`. Jeśli I15.3 ma pozwolić na ręczną edycję (a nie tylko odczyt), to osobna
decyzja — dziś "blokowaneFormyPlatnosci" jest polem tylko-do-odczytu z punktu widzenia API.

**MO6 = `NULL`** — dostawca `MO6` (Uniglory) celowo nie ma mapowania w CASE triggera (CHANGELOG produkcji
2026-09-10 14:53: „nie będzie na razie w sprzedaży”), więc dla tych produktów pole wyjdzie jako `null`, nie pusty
string. Warto to uwzględnić przy renderze kolumny w `/katalog` (port `payment-blocks-injection.js`), żeby `null`
nie wyglądał jak błąd.
