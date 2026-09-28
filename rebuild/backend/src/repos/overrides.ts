// Poprawki Marty — tabela `manual_overrides`.
//
// To ręczne korekty pól produktu, które import ma RESPEKTOWAĆ, a nie nadpisywać. Powstają
// przy edycji w katalogu i przy edycji pozycji stagingu (`PUT /api/staging/{id}`), a silnik
// importu czyta je przez `Gq()` (`src/import/silnik/overrides.ts`).
//
import { desc, eq, sql } from "drizzle-orm";

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

/**
 * Pełna lista poprawek — port `U.listOverrides` (`:44928`).
 *
 * Sortowanie `createdAt` MALEJĄCO jest w oryginale i wychodzi na zewnątrz przez
 * `GET /api/overrides`, więc jest częścią kontraktu, a nie szczegółem implementacji.
 */
export function listaPoprawek(db: Baza): Poprawka[] {
  return db.select().from(manualOverrides).orderBy(desc(manualOverrides.createdAt)).all();
}

/** Dane do zapisu poprawki. `acknowledgedSourceValue` celowo opcjonalne — patrz niżej. */
export type NowaPoprawka = {
  supplierKod: string;
  supplierProductId: string;
  fieldName: string;
  overrideValue: string;
  reason?: string | null;
  createdBy?: number | null;
  createdAt: string;
  acknowledgedSourceValue?: string | null;
};

/**
 * Zapis poprawki — port `U.upsertOverride` (`:44934`). Klucz: (dostawca, kod, pole).
 *
 * ⚠ NIESYMETRIA, KTÓRA MA ZNACZENIE: `acknowledgedSourceValue` trafia do UPDATE-u TYLKO
 * wtedy, gdy zostało jawnie podane. Gdyby nadpisywać je zawsze, edycja pozycji przez
 * `PUT /api/staging/{id}` (która ack-a nie podaje) kasowałaby potwierdzenie konfliktu
 * zapisane wcześniej przez `acceptStaging` — i ten sam alarm wracałby przy każdym imporcie.
 */
export function zapiszPoprawke(db: Baza, dane: NowaPoprawka): Poprawka {
  const istniejaca = db
    .select()
    .from(manualOverrides)
    .where(
      sql`supplier_kod = ${dane.supplierKod} AND supplier_product_id = ${dane.supplierProductId} AND field_name = ${dane.fieldName}`,
    )
    .get();

  if (!istniejaca) {
    return db.insert(manualOverrides).values(dane).returning().get();
  }

  const zmiany: Partial<typeof manualOverrides.$inferInsert> = {
    overrideValue: dane.overrideValue,
    reason: dane.reason ?? null,
    createdBy: dane.createdBy ?? null,
    createdAt: dane.createdAt,
  };
  if (dane.acknowledgedSourceValue !== undefined) {
    zmiany.acknowledgedSourceValue = dane.acknowledgedSourceValue;
  }

  db.update(manualOverrides).set(zmiany).where(eq(manualOverrides.id, istniejaca.id)).run();
  return db.select().from(manualOverrides).where(eq(manualOverrides.id, istniejaca.id)).get()!;
}

/**
 * Kasowanie poprawki — port `U.deleteOverride` (`:44947`).
 *
 * @returns skasowany wiersz (endpoint wypisuje z niego dane do audit logu) albo `null`,
 *   gdy poprawki o tym id nie było — na tym oryginał opiera odpowiedź 404.
 */
export function usunPoprawke(db: Baza, id: number): Poprawka | null {
  const istniejaca = db.select().from(manualOverrides).where(eq(manualOverrides.id, id)).get();
  if (!istniejaca) return null;
  db.delete(manualOverrides).where(eq(manualOverrides.id, id)).run();
  return istniejaca;
}
