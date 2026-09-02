// Promocje — tabela `promotions` (`hn` w zmangowanym oryginale).
//
// Port `U.listPromotions`/`addPromotion`/`updatePromotion`/`deletePromotion`
// (`deminified/backend-index.cjs:44988-45007`). Struktura bliźniacza do `markups.ts`;
// różnice są trzy i wszystkie są w oryginale, nie w naszym porcie:
//   • aktywny status to `"aktywna"` (rodzaj żeński), nie `"aktywny"`;
//   • zamiast `typ`/`zakres` promocja ma `zasieg` i dopasowuje się ODWROTNIE (patrz `ceny.ts`);
//   • trasa `PATCH` NIE MA sprawdzenia 404 (plan.md D5).

import { eq } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { promotions } from "../db/schema.js";
import { przeliczCenyZRegul } from "./ceny.js";
import { odsiejPola } from "./pola-edytowalne.js";
import type { PodpisZmiany } from "./markups.js";

export type Promocja = typeof promotions.$inferSelect;

/**
 * Pola edytowalne przez użytkownika — decyzja plan.md D3, zamknięcie backlogu #14
 * dla promocji. Uzasadnienie jak w `markups.ts`; poza listą zostają `id`,
 * `zmienilUzytkownikId` i `zmienionoData`.
 *
 * ⚠ `start` i `koniec` SĄ edytowalne, choć silnik cen ich w ogóle nie czyta (plan.md D4).
 * Odcięcie ich byłoby cichym przyznaniem, że kolumny są martwe — a one są NOT NULL,
 * widoczne w API i sesja 4b musi je pokazać. Defekt zostaje opisany, nie zamaskowany.
 */
export const POLA_EDYTOWALNE_PROMOCJI = [
  "nazwa",
  "rabatPct",
  "zasieg",
  "warunki",
  "priorytet",
  "start",
  "koniec",
  "status",
] as const satisfies readonly (keyof Promocja)[];

export type PolePromocji = (typeof POLA_EDYTOWALNE_PROMOCJI)[number];

/** Ciało żądania po odsianiu — bez pól serwerowych, które trasa dokłada osobno. */
export type PatchPromocji = Partial<Record<PolePromocji, unknown>>;

/** Odsiew ciała żądania przez listę pól edytowalnych. */
export function odsiejPolaPromocji(cialo: unknown): PatchPromocji {
  return odsiejPola(cialo, POLA_EDYTOWALNE_PROMOCJI);
}

/** Pełna lista promocji — port `U.listPromotions` (`:44988`). Bez `ORDER BY`, jak oryginał. */
export function listaPromocji(db: Baza): Promocja[] {
  return db.select().from(promotions).all();
}

/** Jedna promocja po `id`. */
export function promocjaPoId(db: Baza, id: number): Promocja | undefined {
  return db.select().from(promotions).where(eq(promotions.id, id)).get();
}

/** Dodanie promocji — port `U.addPromotion` (`:44991`). */
export function dodajPromocje(db: Baza, dane: PatchPromocji & PodpisZmiany): Promocja {
  const wiersz = db
    .insert(promotions)
    .values(dane as typeof promotions.$inferInsert)
    .returning()
    .get();
  przeliczPoCichu(db);
  return wiersz;
}

/**
 * Zmiana promocji — port `U.updatePromotion` (`:44998`). Jak przy narzucie: `UPDATE`
 * bez sprawdzania istnienia, przeliczenie, dopiero potem odczyt wiersza.
 */
export function aktualizujPromocje(
  db: Baza,
  id: number,
  patch: PatchPromocji & PodpisZmiany,
): Promocja | undefined {
  db.update(promotions)
    .set(patch as Partial<typeof promotions.$inferInsert>)
    .where(eq(promotions.id, id))
    .run();
  przeliczPoCichu(db);
  return promocjaPoId(db, id);
}

/** Kasowanie promocji — port `U.deletePromotion` (`:45003`). */
export function usunPromocje(db: Baza, id: number): void {
  db.delete(promotions).where(eq(promotions.id, id)).run();
  przeliczPoCichu(db);
}

/** `try { recalcPricesFromRules() } catch {}` — jak w oryginale. */
function przeliczPoCichu(db: Baza): void {
  try {
    przeliczCenyZRegul(db);
  } catch {
    /* jak `catch {}` w oryginale */
  }
}
