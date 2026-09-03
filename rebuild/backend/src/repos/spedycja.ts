import { eq } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { spedycjaLimity } from "../db/schema.js";
import { odsiejPola } from "./pola-edytowalne.js";

/** Wiersz `spedycja_limity` — kształt oddawany przez `GET /api/spedycja`. */
export type LimitSpedycji = typeof spedycjaLimity.$inferSelect;

/**
 * Port `U.listSpedycja()` (`backend-index.cjs:45074-45076`): `X.select().from(gn).all()`.
 *
 * ⚠ BEZ `ORDER BY` — świadomie, 1:1 z oryginałem. Kolejność w odpowiedzi wynika z kolejności
 * wstawiania (rowid), więc po zasianiu `SPEDYCJA_POCZATKOWA` wychodzi MO1…MO10, dokładnie
 * jak w `contract/fixtures/GET_spedycja.json`. Dopisanie sortowania zmieniłoby kolejność,
 * którą Ania zna z produkcji.
 */
export function listaSpedycji(db: Baza): LimitSpedycji[] {
  return db.select().from(spedycjaLimity).all();
}

/**
 * Pola, które `POST /api/spedycja` wolno zapisać.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (plan.md D5): oryginał podaje `c.body` wprost do `upsertSpedycja`
 * (`:48736`), więc pole spoza schematu wywracało zapis. Ten sam ruch, co przy
 * `POST /api/markups` w I4a — dwie trasy tego samego zasobu nie powinny mieć różnej
 * powierzchni ataku.
 */
export const POLA_EDYTOWALNE_SPEDYCJI = [
  "dostawcaKod",
  "progNetto",
  "kosztPonizej",
  "kosztPowyzej",
  "dodatkoweReguly",
] as const satisfies readonly (keyof LimitSpedycji)[];

export type PoleSpedycji = (typeof POLA_EDYTOWALNE_SPEDYCJI)[number];

/** Ciało żądania po odsianiu — poza listą zostaje tylko `id`, czyli tożsamość wiersza. */
export type PatchSpedycji = Partial<Record<PoleSpedycji, unknown>>;

export function odsiejPolaSpedycji(cialo: unknown): PatchSpedycji {
  return odsiejPola(cialo, POLA_EDYTOWALNE_SPEDYCJI);
}

/**
 * Port `U.upsertSpedycja(t)` (`:45077-45080`): szukaj po `dostawcaKod`, znalezione
 * AKTUALIZUJ po `id`, brakujące wstaw.
 *
 * Odtwarzamy select-then-write zamiast `ON CONFLICT`, bo oryginał aktualizuje WYŁĄCZNIE
 * pola obecne w ciele (`X.update(gn).set(t)`) — częściowy zapis nie ma prawa wyzerować
 * pozostałych kolumn. `onConflictDoUpdate` wymagałby wyliczania tej samej listy drugi raz.
 */
export function zapiszLimitSpedycji(
  db: Baza,
  wiersz: PatchSpedycji & { dostawcaKod: string },
): void {
  const istniejacy = db
    .select()
    .from(spedycjaLimity)
    .where(eq(spedycjaLimity.dostawcaKod, wiersz.dostawcaKod))
    .get();

  // Rzutowanie jak w `repos/markups.ts:97` — `odsiejPola` z założenia oddaje `unknown`,
  // bo ciało żądania nie ma gwarancji typu. `dostawcaKod` jest zawsze obecny, więc `set`
  // nigdy nie jest pusty (Drizzle rzuca na `set({})`).
  const wartosci = wiersz as Partial<typeof spedycjaLimity.$inferInsert> & { dostawcaKod: string };

  if (istniejacy) {
    db.update(spedycjaLimity).set(wartosci).where(eq(spedycjaLimity.id, istniejacy.id)).run();
    return;
  }
  db.insert(spedycjaLimity).values(wartosci).run();
}
