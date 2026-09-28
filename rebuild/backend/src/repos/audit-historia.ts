import { desc, inArray } from "drizzle-orm";
import type { Baza } from "../db/index.js";
import { auditLog } from "../db/schema.js";
import type { WierszAudytu } from "./audit.js";

/**
 * Wiersze `audit_log` dla widoku „Historia zmian" (`GET /api/history/meta`, `/paged`) —
 * wyłącznie podane akcje, od najświeższych, BEZ LIMITU.
 *
 * ⚠ ŚWIADOME ODSTĘPSTWO (backlog #87, wariant c; ticket 69). Oryginał czyta tu
 * `listAudit(5e3)` (`backend-index.cjs:48336`, `:48358`), czyli 5000 najświeższych wierszy
 * SUROWEGO `audit_log` — przed odsiewem akcji. W snapshocie produkcji 93% wierszy to akcje
 * spoza słownika, więc to one wypychały z widoku najstarsze wpisy widoczne. Tu odsiew idzie
 * PRZED ograniczeniem, a ograniczenia nie ma: widoczne zdarzenia mapuje się w całości.
 *
 * `akcje` bierze się WYŁĄCZNIE z `akcjeHistorii()` (`historia/mapowanie.ts`) — to jedyne źródło
 * słownika akcja → typ. Pusta lista daje pusty wynik (`inArray([])` → `false` w Drizzle 0.45).
 *
 * Kolejność: `kiedy DESC` jak w oryginale, plus `id DESC` przy remisie. Oryginał przy równym
 * `kiedy` ma kolejność nieokreśloną; tu jest deterministyczna, żeby strony się nie nakładały.
 * Porządek tekstowy `kiedy` jest porządkiem czasu, bo jedyny pisarz (`zapiszAudyt`) zapisuje
 * `toISOString()` — w snapshocie produkcji 3873/3873 wierszy w tym formacie, 0 remisów.
 */
export function audytDlaHistorii(db: Baza, akcje: string[]): WierszAudytu[] {
  return db
    .select()
    .from(auditLog)
    .where(inArray(auditLog.akcja, akcje))
    .orderBy(desc(auditLog.kiedy), desc(auditLog.id))
    .all();
}
