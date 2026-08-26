// Poprawki Marty — tabela `manual_overrides`.
//
// To ręczne korekty pól produktu, które import ma RESPEKTOWAĆ, a nie nadpisywać. Powstają
// przy edycji w katalogu i przy edycji pozycji stagingu (`PUT /api/staging/{id}`), a silnik
// importu czyta je przez `Gq()` (`src/import/silnik/overrides.ts`).
//
// ZAKRES 3d-1 potrzebuje wyłącznie odczytu dla pary (dostawca, kod). Zapis
// (`upsertOverride`, `:44930`), pełna lista (`listOverrides`, `:44912`) i kasowanie
// (`deleteOverride`) należą do 3d-2 razem z endpointami `GET/POST /api/overrides`,
// `DELETE /api/overrides/{id}` i z `acceptStaging` — dopisz je TUTAJ, nie w nowym pliku.

import { sql } from "drizzle-orm";

import { manualOverrides } from "../db/schema.js";
import type { Baza } from "../db/index.js";

export type Poprawka = typeof manualOverrides.$inferSelect;

/**
 * Port `U.getOverridesFor` (`deminified/backend-index.cjs:44915-44917`).
 *
 * ⚠ BRAK `ORDER BY` JEST ZNACZĄCY — i nie oznacza „kolejności wstawienia". Schemat ma
 * `UNIQUE(supplier_kod, supplier_product_id, field_name)`, więc SQLite realizuje ten filtr
 * skanem tego indeksu i oddaje wiersze POSORTOWANE PO `field_name` (potwierdzone
 * `EXPLAIN QUERY PLAN`). Kolejność przecieka na zewnątrz: `Gq()` zbiera z niej `naruszono`,
 * a ta lista trafia wprost do ostrzeżenia „plik nadpisuje poprawke Marty: …", które czyta
 * człowiek. Dlatego zostawiamy zapytanie dokładnie takie jak oryginał — dodanie `ORDER BY`
 * albo zmiana indeksu zmieniłaby treść komunikatu.
 */
export function poprawkiDla(db: Baza, dostawca: string, kodDostawcy: string): Poprawka[] {
  return db
    .select()
    .from(manualOverrides)
    .where(sql`supplier_kod = ${dostawca} AND supplier_product_id = ${kodDostawcy}`)
    .all();
}
